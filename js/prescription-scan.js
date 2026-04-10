async function buildPrescriptionFromScan(data, photoDataUrl = null, scanIA = null, ignoreCodeLabo = false) {
  const fr = data.commentaires || '';
  let commentairesFinal = fr;
  if (fr.trim()) {
    // Traduction séparée via _traduireGemini (filtrage des produits, uniquement annexe)
    try {
      const en = await traduireCommentairesEN(fr.trim());
      if (en) commentairesFinal = fr + '\n--- EN ---\n' + en;
    } catch(e) { /* silencieux, on garde le FR */ }
  }
  // ── Résolution cabinet Cogilog (même logique que fillFormFromScan) ──
  let _bResolvedCode = null;
  let _bCabinetName = data.cabinet || '';
  let _bPraticien = data.praticien || '';
  var _bRawCode = (data.code_cogilog || '').trim().toUpperCase();
  if (_bRawCode && COGILOG_CLIENTS[_bRawCode]) {
    _bResolvedCode = _bRawCode;
  }
  // Fallback direct : nom cabinet exact
  if (!_bResolvedCode && data.cabinet && COGILOG_CLIENTS) {
    var _bNorm = function(s) { return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim(); };
    var _bCabUp = _bNorm(data.cabinet);
    for (var _bk in COGILOG_CLIENTS) {
      if (_bNorm(COGILOG_CLIENTS[_bk][3] || '') === _bCabUp) {
        _bResolvedCode = _bk; break;
      }
    }
  }
  // Fallback : matchCabinetLocal sur cabinet et commentaires UNIQUEMENT (pas praticien — risque de matcher le mauvais cabinet)
  if (!_bResolvedCode) {
    var _bSources = [data.cabinet];
    if (data.commentaires) _bSources.push(data.commentaires.replace(/[,;.\n]/g, ' '));
    for (var _bi = 0; _bi < _bSources.length && !_bResolvedCode; _bi++) {
      if (_bSources[_bi]) _bResolvedCode = matchCabinetLocal(_bSources[_bi]);
    }
  }
  if (_bResolvedCode) {
    var _bClientData = COGILOG_CLIENTS[_bResolvedCode] || [];
    _bCabinetName = _bClientData[3] || _bCabinetName;
    _bPraticien = data.praticien ? standardizePraticien(data.praticien, _bCabinetName) : 'Dr ???';
    // Cabinet trouvé → on le garde. Si praticien pas trouvé dans ce cabinet :
    // Garder le nom brut SEULEMENT s'il ressemble à un nom de docteur (contient "Dr" ou au moins 2 mots-noms)
    // Sinon c'est probablement un nom de cabinet/logiciel → "Dr ???"
    // Si standardizePraticien n'a pas trouvé → Dr ???. Ne PAS garder le nom brut (risque d'erreur de lecture).
    // Le praticien sera corrigé manuellement si besoin.
  } else if (data.praticien) {
    // Aucun cabinet trouvé → tenter de résoudre via le nom du praticien
    var _bResolvedViaDr = matchCabinetLocal(data.praticien);
    if (_bResolvedViaDr) {
      _bResolvedCode = _bResolvedViaDr;
      var _bClientViaDr = COGILOG_CLIENTS[_bResolvedViaDr] || [];
      _bCabinetName = _bClientViaDr[3] || _bCabinetName;
      _bPraticien = standardizePraticien(data.praticien, _bCabinetName);
      console.log('[Cabinet] Résolu via praticien: ' + _bCabinetName + ' (Dr: ' + _bPraticien + ')');
    }
  }

  // ── Fallback par numéro de prescription (carnet du praticien) ──
  // Les numéros proches (±30) viennent du même carnet = même praticien/cabinet
  // Fallback carnet : uniquement pour les fiches image (pas PDF/HTML qui sont des scans digitaux sans carnet)
  var _numPresc = parseInt(data.numero_prescription);
  if (!ignoreCodeLabo && _numPresc && (!_bResolvedCode || _bPraticien === 'Dr ???')) {
    var _nearby = {};
    (window.prescriptions || []).forEach(function(p) {
      var pNum = parseInt((p.numero || '').replace('N° ', ''));
      if (!pNum || Math.abs(pNum - _numPresc) > 30) return;
      var key = (p.code_cogilog || '') + '|' + (p.praticien || '');
      if (!key || key === '|' || key === '|Dr ???') return;
      if (!_nearby[key]) _nearby[key] = 0;
      _nearby[key]++;
    });
    // Prendre le couple cabinet/praticien le plus fréquent (min 2 occurrences)
    var _bestNearby = null, _bestCount = 1;
    Object.entries(_nearby).forEach(function([key, count]) {
      if (count > _bestCount) { _bestCount = count; _bestNearby = key; }
    });
    if (_bestNearby) {
      var _parts = _bestNearby.split('|');
      if (!_bResolvedCode && _parts[0]) {
        _bResolvedCode = _parts[0];
        _bCabinetName = (COGILOG_CLIENTS[_parts[0]] || [])[3] || _bCabinetName;
        console.log('[Carnet] Cabinet résolu par proximité N°: ' + _bCabinetName);
      }
      if (_bPraticien === 'Dr ???' && _parts[1] && _parts[1] !== 'Dr ???') {
        _bPraticien = _parts[1];
        console.log('[Carnet] Praticien résolu par proximité N°: ' + _bPraticien);
      }
    }
  }

  // Compteur temporaire : codes assignés pendant ce batch (pas encore dans Firebase)
  if (!window._pendingCodeLabos) window._pendingCodeLabos = [];

  // ── Post-correction code labo (3 étapes) ──
  if (!ignoreCodeLabo && data.code_labo) {
    let _clFixed = data.code_labo.toUpperCase().trim();
    const _clJour = getCodeLaboLetterForDay(new Date().getDate());

    // Extraire lettre(s) + chiffres (ex: "CM2" → lettre="CM", num="2" / "C106" → lettre="C", num="106")
    const _clParts = _clFixed.match(/^([A-Z]+)(\d+)$/);
    if (_clParts) {
      let _clLettre = _clParts[1];
      let _clNum = parseInt(_clParts[2]);

      // ÉTAPE 1 : Valider la lettre (seuls A-Z et AA-AE sont valides)
      const _lettresValides = new Set();
      for (let d = 1; d <= 31; d++) _lettresValides.add(getCodeLaboLetterForDay(d));
      if (!_lettresValides.has(_clLettre)) {
        // Lettre invalide (ex: CM, CG, BM...) → forcer la lettre du jour
        console.log('[Code labo] Lettre invalide: "' + _clLettre + '" → forcé à "' + _clJour + '"');
        _clLettre = _clJour;
      }

      // ÉTAPE 2 : Corriger la lettre si elle est minoritaire par rapport à la lettre du jour
      if (_clLettre !== _clJour) {
        var _aujourdhuiStr = new Date().toLocaleDateString('fr-FR');
        var _countLettre = 0, _countJour = 0;
        (window.prescriptions || []).forEach(function(p) {
          if (p.createdAt !== _aujourdhuiStr) return;
          var cl = (p.code_labo || '').toUpperCase();
          var m = cl.match(/^(X?)([A-Z]{1,2})\d+$/);
          if (!m) return;
          if (m[2] === _clLettre) _countLettre++;
          if (m[2] === _clJour) _countJour++;
        });
        // Compter aussi les pending du batch
        (window._pendingCodeLabos || []).forEach(function(c) {
          var m = c.match(/^(X?)([A-Z]{1,2})\d+$/);
          if (!m) return;
          if (m[2] === _clLettre) _countLettre++;
          if (m[2] === _clJour) _countJour++;
        });
        // Si la lettre du jour est majoritaire OU si la lettre lue n'existe pas du tout → corriger
        if (_countJour > _countLettre) {
          console.log('[Code labo] Correction lettre jour: ' + _clLettre + ' → ' + _clJour + ' (' + _clJour + ':' + _countJour + ' vs ' + _clLettre + ':' + _countLettre + ')');
          _clLettre = _clJour;
        }
      }

      // ÉTAPE 3 : Continuité numérique — corriger vers le prochain numéro attendu
      // Inclut les codes pending (batch en cours, pas encore dans Firebase)
      const _allCodes = (window.prescriptions || []).map(p => (p.code_labo || '').toUpperCase())
        .concat(window._pendingCodeLabos || []);
      // Trouver le max dans chaque plage pour cette lettre
      let _maxMerd = 0, _maxHuile = 100;
      _allCodes.forEach(function(cl) {
        if (!cl) return;
        const m = cl.match(/^(X?)([A-Z]{1,2})(\d+)$/);
        if (!m || m[1] === 'X') return;
        if (m[2] !== _clLettre) return;
        const n = parseInt(m[3]);
        if (n >= 1 && n <= 99 && n > _maxMerd) _maxMerd = n;
        if (n >= 100 && n <= 199 && n > _maxHuile) _maxHuile = n;
      });
      // Pas de correction cross-plage ni continuité — le numéro lu par l'IA est gardé tel quel

      data.code_labo = _clLettre + _clNum;
      // Enregistrer dans le batch pending pour les scans suivants
      window._pendingCodeLabos.push((_clLettre + _clNum).toUpperCase());
    }
  }

  // Fournisseur auto (via code labo si disponible)
  var _bFournisseur = '';
  if (!ignoreCodeLabo && data.code_labo) {
    var _fm = data.code_labo.match(/[A-Za-z]+(\d+)/);
    if (_fm) { var _fn = parseInt(_fm[1]); _bFournisseur = (_fn >= 0 && _fn <= 99) ? 'MERDENTAL' : (_fn >= 100 && _fn <= 200) ? 'HUILE' : ''; }
  }
  // Scan (PDF/HTML) → fournisseur MERDENTAL par défaut + code labo auto avec préfixe X
  // Scan PDF/HTML : pas de code labo ni fournisseur auto — sera assigné quand l'utilisateur choisit le fournisseur

  return {
    numero: 'N° ' + (data.numero_prescription ? String(data.numero_prescription).trim() : nextNum),
    code_labo: ignoreCodeLabo ? '' : (data.code_labo || ''),
    cabinet: _bCabinetName,
    code_cogilog: _bResolvedCode || data.code_cogilog || '',
    praticien: _bPraticien,
    fournisseur: _bFournisseur,
    patient: { nom: data.patient_nom || '', age: data.patient_age || '', sexe: data.patient_sexe || '' },
    aRefaire: data.a_refaire === true,
    urgent: data.urgent === true,
    call_me: data.call_me === true,
    casEsthetique: data.cas_esthetique === true,
    scan: ignoreCodeLabo === true, // PDF ou HTML → scan auto-coché
    scanPosition: ignoreCodeLabo ? _autoScanPos(data.dents || []) : '',
    dates: { empreinte: data.date_empreinte || '', livraison: data.date_livraison || '', sansDate: data.sans_date_livraison === true },
    dents: data.dents || [],
    ...(() => { const p = enforceParents(enforceGroupesExclusifs(data.conjointe || []), enforceFinitionParDefaut(data.adjointe || [], data.commentaires)); return { conjointe: p.conjointe, adjointe: p.adjointe }; })(),
    fraisage: data.fraisage || '',
    machoire: data.machoire || '',
    dentsActes: _postTraiterDentsActes(data.dentsActes || {}, data.adjointe || [], data.machoire || ''),
    solidGroups: _postTraiterSolidGroups(data.solidGroups || [], data.conjointe || [], data.dentsActes || {}),
    teinte: data.teinte || '',
    piv: regroupPiv(data.piv || ''),
    dentExtraireVal: data.dent_extraire || '',
    commentaires: commentairesFinal,
    statut: 'attente',
    createdAt: new Date().toLocaleDateString('fr-FR'),
    photo: photoDataUrl || null,
    // Bug PDF 1 fix — stocker le type dès la création
    photo_type: photoDataUrl
      ? (photoDataUrl.startsWith('data:application/pdf') ? 'pdf'
        : photoDataUrl.startsWith('data:text/html') ? 'html'
        : 'image')
      : null,
    scanIA: scanIA || null,
  };
}

// ---- SCAN PRESCRIPTION (single) ----
async function scanPrescription(input) {
  const file = input.files[0];
  if (!file) return;

  const isPDF = file.type === 'application/pdf';
  const isHTML = file.type === 'text/html' || file.name.endsWith('.html');

  document.getElementById('scan-loading').style.display = 'block';
  document.getElementById('scan-status').textContent = '';
  document.getElementById('correction-zone').style.display = 'none';

  const reader = new FileReader();
  reader.onload = async (e) => {
    const originalDataUrl = e.target.result;
    const base64 = originalDataUrl.split(',')[1];
    const mediaType = isPDF ? 'application/pdf' : (isHTML ? 'text/html' : file.type);

    try {
      // Utilise callGemini (prompt complet unifié)
      const parsed = await callGemini(base64, mediaType, isHTML);
      lastScanIA = parsed;
      // Si HTML → convertir en image JPEG compressée pour le stockage
      if (isHTML) {
        showToast('🖼️ Conversion fiche HTML en image...');
        const imgConverti = await convertirHtmlEnImage(originalDataUrl);
        lastScanPhoto = imgConverti || originalDataUrl;
      } else {
        lastScanPhoto = originalDataUrl;
      }
      fillFormFromScan(parsed, isHTML || isPDF);
      updatePreviewPanel(originalDataUrl, file);
      // Mémoriser pour rescan + afficher le bouton
      var _rescanType = isHTML ? 'html' : (isPDF ? 'pdf' : 'image');
      window._rescanData = { photoSrc: originalDataUrl, photoType: _rescanType, patientName: parsed.patient_nom || '', _editIdx: -1 };
      var _btnR = document.getElementById('btn-rescan');
      if (_btnR) _btnR.style.display = 'inline-block';
      document.getElementById('scan-status').textContent = '✅ Formulaire rempli — vérifie et corrige si besoin';
      document.getElementById('correction-zone').style.display = 'block';
      showToast('Fiche analysée ! Corrige les erreurs si besoin.');

    } catch (err) {
      console.error(err);
      document.getElementById('scan-status').textContent = '❌ Erreur : ' + err.message;
      showToast('Erreur lors de l\'analyse : ' + err.message, true);
    } finally {
      document.getElementById('scan-loading').style.display = 'none';
      // Vider l'input pour permettre de rescanner le même fichier
      input.value = '';
    }
  };
  reader.readAsDataURL(file);
}

// ── RESCAN — re-analyse la prescription actuellement ouverte avec l'IA ──
async function rescanCurrentPrescription() {
  // Rafraîchir _rescanData si on est en mode édition
  if (editingIndex >= 0 && (!window._rescanData || !window._rescanData.photoSrc)) {
    var p = (window.prescriptions || [])[editingIndex];
    if (p) {
      var src = p.photo_html || p.photo_url || p.photo || (window._photoCache && window._photoCache[p._id]);
      if (src && src !== '__photo__') {
        window._rescanData = { photoSrc: src, photoType: p.photo_type || 'image', patientName: p.patient?.nom || p.numero || '', _editIdx: editingIndex };
      }
    }
  }
  // Fallback : dernier scan photo
  if ((!window._rescanData || !window._rescanData.photoSrc) && lastScanPhoto) {
    var type = 'image';
    if (lastScanPhoto.startsWith('data:text/html')) type = 'html';
    else if (lastScanPhoto.startsWith('data:application/pdf')) type = 'pdf';
    window._rescanData = { photoSrc: lastScanPhoto, photoType: type, patientName: '', _editIdx: -1 };
  }

  if (!window._rescanData || !window._rescanData.photoSrc) {
    showToast('Pas de fiche scannée disponible — rescan impossible.', true);
    return;
  }

  if (!confirm('🔄 Rescanner cette fiche avec l\'IA ?\n\nLe formulaire sera rempli avec les nouvelles données.\nTu pourras vérifier et corriger avant de sauvegarder.')) return;

  var photoSrc = window._rescanData.photoSrc;
  var isHTML = window._rescanData.photoType === 'html';
  var isPDF  = window._rescanData.photoType === 'pdf';
  var patientName = window._rescanData.patientName;

  document.getElementById('scan-loading').style.display = 'block';
  showToast('🔄 Rescan en cours — l\'IA ré-analyse la fiche...');

  try {
    var base64, mediaType, dataUrl;

    if (photoSrc.startsWith('data:')) {
      dataUrl = photoSrc;
      base64 = photoSrc.split(',')[1];
      mediaType = isHTML ? 'text/html' : (isPDF ? 'application/pdf' : photoSrc.split(';')[0].replace('data:', ''));
    } else {
      showToast('📥 Téléchargement de la fiche...');
      var resp = await fetch(photoSrc);
      var blob = await resp.blob();
      dataUrl = await new Promise(function(resolve) {
        var r = new FileReader();
        r.onload = function() { resolve(r.result); };
        r.readAsDataURL(blob);
      });
      base64 = dataUrl.split(',')[1];
      mediaType = isHTML ? 'text/html' : (isPDF ? 'application/pdf' : blob.type);
    }

    var parsed = await callGemini(base64, mediaType, isHTML);
    lastScanIA = parsed;
    lastScanPhoto = dataUrl;

    fillFormFromScan(parsed, isHTML || isPDF);
    // Restaurer editingIndex si on éditait une prescription
    if (editingIndex < 0 && window._rescanData && window._rescanData._editIdx >= 0) {
      editingIndex = window._rescanData._editIdx;
      document.getElementById('save-btn').textContent = '💾 Mettre à jour';
      document.getElementById('save-btn').style.background = '#f59e0b';
    }
    updatePreviewPanel(dataUrl, { name: patientName || 'Rescan' });

    document.getElementById('correction-zone').style.display = 'block';
    showToast('✅ Rescan terminé — vérifie les données et sauvegarde !');

  } catch (err) {
    console.error('Rescan error:', err);
    showToast('❌ Erreur rescan : ' + (err.message || err), true);
  } finally {
    document.getElementById('scan-loading').style.display = 'none';
  }
}

function fillFormFromScan(data, _ignoreCodeLabo = false) {
  editingIndex = -1;
  document.getElementById('save-btn').textContent = 'Enregistrer la prescription';
  document.getElementById('save-btn').style.background = '';

  if (data.numero_prescription) {
    const raw = String(data.numero_prescription).trim();
    document.getElementById('num-display').value = raw;
    // Pour nextNum : seulement si c'est un numéro court numérique (fiches papier)
    const num = parseInt(raw);
    if (!isNaN(num) && raw === String(num) && num >= nextNum) nextNum = num;
  }
  if (data.code_labo && !_ignoreCodeLabo) {
    document.getElementById('code-labo-display').value = data.code_labo;
    document.getElementById('num-display').dataset.codeLabo = data.code_labo;
    autoSelectFournisseur(data.code_labo);
  } else if (_ignoreCodeLabo) {
    // Scan PDF/HTML : code labo et fournisseur vides — assignés quand l'utilisateur choisit le fournisseur
  }
  // ── Résolution cabinet via Cogilog (Gemini d'abord, fallback JS local multi-sources) ──
  {
    let resolvedCode = null;
    var _rawCode = (data.code_cogilog || '').trim().toUpperCase();
    console.log('[SCAN] Gemini →', JSON.stringify({cab: data.cabinet, code: data.code_cogilog, prat: data.praticien, comm: (data.commentaires||'').substring(0,80)}));
    if (_rawCode && COGILOG_CLIENTS[_rawCode]) {
      resolvedCode = _rawCode;
    }
    // Fallback direct : si Gemini a retourné un cabinet qui correspond exactement à un nom Cogilog
    if (!resolvedCode && data.cabinet && COGILOG_CLIENTS) {
      var _fNorm = function(s) { return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim(); };
      var _cabUp = _fNorm(data.cabinet);
      for (var _ck in COGILOG_CLIENTS) {
        if (_fNorm(COGILOG_CLIENTS[_ck][3] || '') === _cabUp) {
          resolvedCode = _ck;
          break;
        }
      }
    }
    // Fallback : chercher dans cabinet, praticien (son nom peut identifier le cabinet), puis commentaires
    if (!resolvedCode) {
      var _sources = [data.cabinet, data.praticien];
      // Extraire les mots-clés des commentaires (noms de cabinet potentiels)
      if (data.commentaires) {
        // Cherche des patterns comme "MK Dental", "Centre Broca", etc.
        var _comm = data.commentaires.replace(/[,;.\n]/g, ' ');
        _sources.push(_comm);
      }
      for (var _si = 0; _si < _sources.length && !resolvedCode; _si++) {
        if (_sources[_si]) {
          resolvedCode = matchCabinetLocal(_sources[_si]);
          if (resolvedCode) break;
        }
      }
    }
    if (resolvedCode) {
      // Récupérer le nom officiel depuis COGILOG_CLIENTS
      var _clientData = COGILOG_CLIENTS[resolvedCode] || [];
      var _cabinetName = _clientData[3] || '';
      // Remplir cabinet + code + badge directement (sans dépendre du early-exit de choisirCabinet)
      var _cabInp = document.getElementById('cabinet');
      var _cogInp = document.getElementById('code-cogilog');
      var _badge = document.getElementById('cogilog-code-badge');
      var _clearBtn = document.getElementById('btn-clear-cabinet');
      if (_cabInp) _cabInp.value = _cabinetName || data.cabinet || '';
      if (_cogInp) _cogInp.value = resolvedCode;
      if (_badge) { _badge.textContent = resolvedCode; _badge.style.display = 'block'; }
      if (_clearBtn) _clearBtn.style.display = 'block';
      // Standardiser le praticien contre CONTACTS_DENTISTES du cabinet
      var _stdPraticien = data.praticien ? standardizePraticien(data.praticien, _cabinetName) : 'Dr ???';
      setTimeout(function() {
        const praticienInp = document.getElementById('praticien');
        if (praticienInp) praticienInp.value = _stdPraticien;
      }, 150);
    } else {
      // Aucun match Cogilog — champs bruts du scan
      if (data.cabinet) document.getElementById('cabinet').value = data.cabinet;
      // Même sans code Cogilog, tenter de standardiser le praticien contre les contacts connus
      if (data.praticien) {
        var _fallbackCab = data.cabinet || '';
        var _stdFallback = _fallbackCab ? standardizePraticien(data.praticien, _fallbackCab) : null;
        document.getElementById('praticien').value = (_stdFallback && _stdFallback !== 'Dr ???') ? _stdFallback : data.praticien;
      }
      const _cogInp = document.getElementById('code-cogilog');
      if (_cogInp) _cogInp.value = data.code_cogilog || '';
    }
  }
  if (data.patient_nom) document.getElementById('patient-nom').value = data.patient_nom;
  if (data.patient_age) document.getElementById('patient-age').value = data.patient_age;
  if (data.patient_sexe) {
    const sexeVal = data.patient_sexe.toLowerCase();
    const radio = document.querySelector(`input[name="sexe"][value="${sexeVal}"]`);
    if (radio) radio.checked = true;
  }
  if (data.date_empreinte) document.getElementById('date-empreinte').value = dateFromISO(data.date_empreinte);
  if (data.date_livraison) document.getElementById('date-livraison').value = dateFromISO(data.date_livraison);
  if (data.sans_date_livraison === true && !data.date_livraison) {
    var _sdCb = document.getElementById('sans-date-livraison');
    if (_sdCb) { _sdCb.checked = true; if (typeof toggleSansDate === 'function') toggleSansDate(_sdCb); }
  }
  // aRefaire : ne jamais cocher automatiquement depuis le scan — décision manuelle uniquement
  document.getElementById('a-refaire').checked = false;
  document.getElementById('urgent').checked = data.urgent || false;
  document.getElementById('call-me').checked = data.call_me || false;
  document.getElementById('cas-esthetique').checked = data.cas_esthetique || false;
  document.getElementById('scan-check').checked = data.scan || false;
  highlightCasEsthetique();
  highlightScan();
  highlightARefaire();
  if (data.fraisage) {
    document.getElementById('fraisage').value = data.fraisage;
    // Auto-cocher la checkbox Fraisage si elle existe
    const cbFrais = document.querySelector('input[name="conjointe"][value="Fraisage"]');
    if (cbFrais) cbFrais.checked = true;
  }
  if (data.piv) { document.getElementById('piv').value = regroupPiv(data.piv); highlightPivField(); }
  if (data.teinte) {
    document.getElementById('teinte-custom').value = data.teinte;
    document.querySelectorAll('.teinte-chip').forEach(c => {
      if (c.textContent === data.teinte) c.classList.add('selected');
    });
  }
  // dent_extraire → numéro dent à extraire
  const dentExtraireInput = document.getElementById('dent-extraire');
  if (dentExtraireInput) {
    if (data.dent_extraire) {
      dentExtraireInput.value = data.dent_extraire;
    } else if ((data.adjointe || []).includes('Dent à extraire') && data.commentaires) {
      // Fallback : extraire le numéro depuis les commentaires
      const m = data.commentaires.match(/[Dd]ent[\s\u00C0-\u017E]*[àa]\s*extraire\s*[:\-]?\s*([\d,\s]+)/i)
                || data.commentaires.match(/extraire?\s*(?:dent\s*)?([\d]{2}(?:[,\s]+[\d]{2})*)/i);
      if (m) dentExtraireInput.value = m[1].trim();
    }
    highlightDentExtraire();
  }
  if (data.commentaires) {
    const ta = document.getElementById('commentaires');
    ta.value = data.commentaires;
    // Traduction EN sera lancée APRÈS le cochage des cases (voir plus bas)
  }
  if (data.machoire) {
    const vals = Array.isArray(data.machoire) ? data.machoire : [data.machoire];
    vals.forEach(v => {
      const cb = document.querySelector(`input[name="mach"][value="${v}"]`);
      if (cb) cb.checked = true;
    });
  }

  // Dents
  if (data.dents && data.dents.length > 0) {
    selectedDents.clear();
    document.querySelectorAll('.dent-btn').forEach(b => b.classList.remove('selected'));
    data.dents.forEach(n => {
      selectedDents.add(Number(n));
      const btn = document.querySelector(`.dent-btn[data-dent="${n}"]`);
      if (btn) btn.classList.add('selected');
    });
  }

  // Cases conjointe — correspondance exacte + groupes exclusifs enforced
  const { conjointe: conjointeClean, adjointe: adjointeClean } = enforceParents(
    enforceGroupesExclusifs(data.conjointe || []),
    enforceFinitionParDefaut(data.adjointe || [], data.commentaires)
  );
  // Reset complet — badges, groupes, sélection
  clearTimeout(window._dentsActesTimeout);
  window._dentsActesCourant = {};
  window._solidGroups = [];
  window._usSelection = new Set();
  document.querySelectorAll('.acte-detail-badge').forEach(b => b.remove());
  ['unitaire','solidaire'].forEach(id => {
    const badge = document.getElementById('badge-' + id);
    if (badge) badge.innerHTML = '';
  });

  // Cocher les cases d'abord
  document.querySelectorAll('input[name="conjointe"]').forEach(cb => {
    cb.checked = conjointeClean.some(v => v === cb.value);
  });
  document.querySelectorAll('input[name="adjointe"]').forEach(cb => {
    cb.checked = adjointeClean.some(v => v === cb.value);
  });

  // Appliquer dentsActes et solidGroups APRÈS que les cases sont cochées
  // Nettoyer les parents sans dents avant d'appliquer
  var _cleanDA = Object.assign({}, data.dentsActes || {});
  ['Inlay Onlay','Facette','Implant CCM','Implant CCC','Stellite','App résine','Complet','Valplast','Gouttière','Adjonction'].forEach(function(p) { delete _cleanDA[p]; });
  appliquerDentsActes(_cleanDA);
  appliquerSolidGroups(data.solidGroups);

  // Afficher les inputs quantité pour les cases cochées (défaut = 1)
  document.querySelectorAll('.qty-input').forEach(function(inp) {
    const cb = inp.parentElement.querySelector('input[type="checkbox"]');
    if (cb && cb.checked) {
      inp.value = '1';
      inp.style.display = 'inline-block';
    } else {
      inp.style.display = 'none';
    }
  });

  // Traduction EN — uniquement la partie annexe (commentaires libres du praticien)
  if (data.commentaires && !data.commentaires.includes('--- EN ---')) {
    const ta = document.getElementById('commentaires');
    const fr = data.commentaires.trim();
    ta.value = fr + '\n--- EN (traduction en cours...) ---';
    _traduireGemini(fr).then(function(en) {
      ta.value = fr + '\n--- EN ---\n' + (en || fr);
    });
  }

  // Scroll vers le formulaire
  document.querySelector('.card:last-of-type') && document.getElementById('prescription-form').scrollIntoView({ behavior: 'smooth' });
}
