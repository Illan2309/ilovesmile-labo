var DENTS_HAUT = [
  [18,17,16,15,14,13,12,11],
  [21,22,23,24,25,26,27,28]
];
var DENTS_BAS = [
  [48,47,46,45,44,43,42,41],
  [31,32,33,34,35,36,37,38]
];

// Grille globale de dents retirée — les dents sont gérées par acte (dentsActes).
// selectedDents reste déclaré (vide) pour ne pas casser les références existantes.
var selectedDents = new Set();
function buildDentsGrid() { /* désactivé */ }
function toggleDent() { /* désactivé */ }

// ---- TEINTES ----
var TEINTES = ['A1','A2','A3','A3.5','A4','B1','B2','B3','B4','C1','C2','C3','D2','D3'];
var selectedTeinte = '';

function buildTeintes() {
  const grid = document.getElementById('teinte-grid');
  TEINTES.forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'teinte-chip';
    chip.textContent = t;
    chip.onclick = () => {
      document.querySelectorAll('.teinte-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedTeinte = t;
      document.getElementById('teinte-custom').value = t;
    };
    grid.appendChild(chip);
  });
}

// ---- NUMÉRO ----
// ---- PERSISTANCE PRESCRIPTIONS ----
// ── Sauvegarde / chargement via Firebase (remplace localStorage) ──

function sauvegarderPrescriptions() {
  // Délégué à window.sauvegarderPrescriptions défini dans le module Firebase
  // Guard : ne pas appeler si Firebase n'a pas encore remplacé cette fonction
  if (window._firebaseReady && window.sauvegarderPrescriptions) window.sauvegarderPrescriptions();
}

function chargerPrescriptions() {
  // Le chargement se fait via onSnapshot Firebase (temps réel)
  // Rien à faire ici, Firebase pousse les données automatiquement
}

window.prescriptions = window.prescriptions || [];
// Alias vers window.prescriptions — resynchronisé à chaque lecture via getter
// onSnapshot remplace window.prescriptions par une nouvelle array →
// on ne doit JAMAIS stocker un alias local stale.
// Solution : utiliser window.prescriptions partout dans les fonctions critiques.
var nextNum = 31461;

function updateNum() {
  // Le numéro est maintenant directement éditable dans le champ
}

// ---- SAVE ----
// ---- EDITING STATE ----
var editingIndex = -1;


// ── Auto-apprentissage : créer des alias depuis la LECTURE BRUTE de l'IA ──
function _autoLearnAliases(ancienne, corrigee) {
  var _norm = function(s) { return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); };
  var scanIA = ancienne.scanIA;
  if (!scanIA || typeof scanIA !== 'object') return;

  // 1. CABINET : raw_cabinet (lecture brute) → code_cogilog corrigé
  var rawCab = _norm(scanIA.raw_cabinet || '');
  var codeCorrige = corrigee.code_cogilog || '';
  if (rawCab && rawCab.length >= 4 && codeCorrige) {
    // Ne pas créer d'alias si le raw correspond déjà au bon cabinet
    var cabinetCorrige = _norm(corrigee.cabinet || '');
    if (rawCab !== cabinetCorrige) {
      // Sécurité : vérifier que l'alias ne crée pas de confusion
      var _aliasBlocked = false;
      var _aliasBlockReason = '';
      if (typeof COGILOG_CLIENTS !== 'undefined') {
        Object.entries(COGILOG_CLIENTS).forEach(function([code, d]) {
          var nomCab = _norm(d[3] || '');
          if (!nomCab) return;
          // Match exact → c'est un cabinet existant, pas un alias
          if (nomCab === rawCab) {
            _aliasBlocked = true;
            _aliasBlockReason = 'cabinet existant exact "' + d[3] + '"';
          }
          // Match partiel → le raw est un sous-ensemble d'un AUTRE cabinet
          // (ex: "asniere" matche "ASNIERES MAIRIE" mais on cible ROUAH)
          if (!_aliasBlocked && code !== codeCorrige) {
            if ((nomCab.includes(rawCab) || rawCab.includes(nomCab)) && rawCab.length >= 4) {
              _aliasBlocked = true;
              _aliasBlockReason = 'ambigu avec "' + d[3] + '" (code ' + code + ')';
            }
          }
        });
      }
      // Bloquer aussi si le raw ressemble à un nom de praticien
      if (!_aliasBlocked && /^dr[\s.]/.test(rawCab)) {
        _aliasBlocked = true;
        _aliasBlockReason = 'ressemble à un nom de praticien';
      }
      if (!_aliasBlocked) {
        var aliases = JSON.parse(localStorage.getItem('cabinet_aliases') || '{}');
        if (!aliases[rawCab]) {
          aliases[rawCab] = codeCorrige;
          localStorage.setItem('cabinet_aliases', JSON.stringify(aliases));
          _syncAliasesToFirebase('cabinet');
          showToast('🧠 Alias cabinet auto : "' + rawCab + '" → ' + codeCorrige);
          console.log('[🧠 Auto-alias cabinet] "' + rawCab + '" → ' + codeCorrige);
        }
      } else {
        console.log('[🧠 Auto-alias cabinet] BLOQUÉ "' + rawCab + '" → ' + codeCorrige + ' — ' + _aliasBlockReason);
      }
    }
  }

  // 2. PRATICIEN : la création auto d'alias contact est DÉSACTIVÉE.
  // Décision : 86% des alias créés automatiquement étaient du bruit jamais
  // matché, et certains étaient dangereux (ex: alias 3-lettres "rou").
  // Les alias contacts restent éditables manuellement via l'UI contacts
  // (ex: "defa" pour Dr DE FRESNOYE ANTOINE).
}

function savePrescription() {
  // ── VERROU ANTI-DOUBLE-CLIC (triple protection) ──
  // 1. Flag booléen
  if (window._saveLock) { return; }
  // 2. Timestamp : minimum 1 seconde entre 2 sauvegardes
  var now = Date.now();
  if (window._saveLastTime && (now - window._saveLastTime) < 1000) { return; }
  window._saveLastTime = now;
  window._saveLock = true;
  // 3. Désactiver le bouton immédiatement
  const _saveBtn = document.getElementById('save-btn');
  if (_saveBtn) { _saveBtn.disabled = true; _saveBtn.style.opacity = '0.6'; _saveBtn.style.pointerEvents = 'none'; }
  const _releaseSaveLock = () => {
    window._saveLock = false;
    if (_saveBtn) { _saveBtn.disabled = false; _saveBtn.style.opacity = ''; _saveBtn.style.pointerEvents = ''; }
  };

  const cabinet = document.getElementById('cabinet').value.trim();
  const praticien = document.getElementById('praticien').value.trim();
  const patientNom = document.getElementById('patient-nom').value.trim();

  const numDisplay = document.getElementById('num-display').value.trim();
  if (!praticien && !cabinet && !patientNom && !numDisplay) {
    showToast('Veuillez renseigner au moins le cabinet, le praticien, le patient ou le numéro.', true);
    _releaseSaveLock(); return;
  }

  const codeLabo = document.getElementById('code-labo-display').value.trim();
  const dateLivraison = dateToISO(document.getElementById('date-livraison').value.trim()) || document.getElementById('date-livraison').value.trim();
  if (!codeLabo) {
    showToast('⚠️ Code labo manquant — veuillez le renseigner avant de valider.', true);
    document.getElementById('code-labo-display').focus();
    _releaseSaveLock(); return;
  }
  const sansDate = document.getElementById('sans-date-livraison')?.checked;
  if (!dateLivraison && !sansDate) {
    showToast('⚠️ Date de livraison manquante — renseignez-la ou cochez "Sans date connue".', true);
    document.getElementById('date-livraison').focus();
    _releaseSaveLock(); return;
  }
  const fournisseur = document.getElementById('fournisseur').value;
  if (!fournisseur) {
    showToast('⚠️ Fournisseur manquant — veuillez sélectionner MERDENTAL ou HUILE.', true);
    document.getElementById('fournisseur').focus();
    _releaseSaveLock(); return;
  }

  // Capturer AVANT resetForm qui remet à null
  const scanIACourant = lastScanIA;
  const scanPhotoCourant = lastScanPhoto;
  // Snapshot de la prescription en cours d'édition par _id (anti-race onSnapshot)
  // window.prescriptions peut être remplacé par onSnapshot entre-temps — on cherche par _id
  const _anciennePresc = editingIndex >= 0
    ? (window.prescriptions || []).find(p => p._id === ((window.prescriptions||[])[editingIndex]||{})._id) || (window.prescriptions||[])[editingIndex] || null
    : null;
  // Capturer l'explication — depuis la zone scan ou la zone édition selon le contexte
  const explicationsaisie = (
    document.getElementById('edit-explication')?.value ||
    document.getElementById('correction-explication')?.value ||
    ''
  ).trim();

  const conjointe = [...document.querySelectorAll('input[name="conjointe"]:checked')].map(el => el.value);
  const adjointe = [...document.querySelectorAll('input[name="adjointe"]:checked')].map(el => el.value);
  const sexe = document.querySelector('input[name="sexe"]:checked')?.value || '';
  const mach = [...document.querySelectorAll('input[name="mach"]:checked')].map(e => e.value);

  const prescription = {
    numero: 'N° ' + (document.getElementById('num-display').value.trim() || nextNum),
    code_labo: document.getElementById('code-labo-display').value.trim() || '',
    code_cogilog: document.getElementById('code-cogilog').value.trim() || '',
    fournisseur: document.getElementById('fournisseur').value || '',
    cabinet,
    praticien,
    patient: { nom: patientNom, age: document.getElementById('patient-age').value, sexe },
    aRefaire: document.getElementById('a-refaire').checked === true,
    aRefaireActes: window.aRefaireActes, // null = tous, [] = aucun, [...] = sélection
    urgent: document.getElementById('urgent').checked,
    call_me: document.getElementById('call-me').checked,
    casEsthetique: document.getElementById('cas-esthetique').checked,
    scan: document.getElementById('scan-check').checked,
    scanPosition: window._scanPosition || '',
    dates: {
      empreinte: dateToISO(document.getElementById('date-empreinte').value),
      livraison: dateToISO(document.getElementById('date-livraison').value),
      sansDate: document.getElementById('sans-date-livraison')?.checked || false,
    },
    dents: [], // grille globale retirée, dents gérées par acte (dentsActes)
    conjointe,
    fraisage: (window._dentsActesCourant && window._dentsActesCourant['Fraisage']) || document.getElementById('fraisage').value || '',
    piv: document.getElementById('piv').value.trim() || '',
    adjointe,
    quantites: (function() {
      var q = {};
      document.querySelectorAll('.qty-input').forEach(function(inp) {
        if (inp.style.display !== 'none' && inp.dataset.acte) {
          q[inp.dataset.acte] = parseInt(inp.value) || 1;
        }
      });
      // Merger les quantités manuelles saisies via la bulle clic-droit
      // (Stellite/App résine/Valplast — cas rare du Valplast coupé en 2 etc.)
      if (window._quantitesActesCourant) {
        Object.keys(window._quantitesActesCourant).forEach(function(acte) {
          var v = parseInt(window._quantitesActesCourant[acte]);
          if (v && v > 0) q[acte] = v;
        });
      }
      return q;
    })(),
    dentExtraire: (window._dentsActesCourant || {})['Dent à extraire'] || document.getElementById('dent-extraire').value.trim(),
    adjonctionDent: (window._dentsActesCourant || {})['Adjonction dent'] || document.getElementById('adjonction-dent').value.trim(),
    adjonctionCrochet: (window._dentsActesCourant || {})['Adjonction crochet'] || document.getElementById('adjonction-crochet').value.trim(),
    machoire: mach,
    teinte: document.getElementById('teinte-custom').value || selectedTeinte,
    dentExtraireVal: '',
    dentsActes: Object.assign({}, window._dentsActesCourant || {}),
    solidGroups: JSON.parse(JSON.stringify(window._solidGroups || [])),
    produitsAnnexes: (window._produitsAnnexes || []).slice(),
    produitsAnnexesDents: Object.assign({}, window._produitsAnnexesDents || {}),
    commentaires: document.getElementById('commentaires').value,
    statut: _anciennePresc
      ? (_anciennePresc.statut === 'importe' ? 'importe' : 'verifie')
      : 'attente',
    cogilog_exporte: _anciennePresc ? (_anciennePresc.cogilog_exporte || null) : null,
    createdAt: _anciennePresc ? _anciennePresc.createdAt : new Date().toLocaleDateString('fr-FR'),
    // Préserver photo_url + photo_type existants si pas de nouveau scan
    photo:      _anciennePresc ? (scanPhotoCourant || _anciennePresc.photo || null) : (scanPhotoCourant || null),
    photo_url:  _anciennePresc ? (_anciennePresc.photo_url || null) : null,
    photo_type: _anciennePresc ? (_anciennePresc.photo_type || null) : null,
    photo_html: _anciennePresc ? (_anciennePresc.photo_html || null) : null,
    scanIA: _anciennePresc ? _anciennePresc.scanIA : (scanIACourant || null),
    // Préserver les métadonnées Digilab
    _digilabCaseId: _anciennePresc ? (_anciennePresc._digilabCaseId || null) : null,
    _digilabService: _anciennePresc ? (_anciennePresc._digilabService || null) : null,
  };

  // Snapshot de editingIndex au clic (anti-race avec onSnapshot Firebase)
  const _snapshotEditingIndex = editingIndex;
  editingIndex = -1; // libérer immédiatement

  if (_snapshotEditingIndex >= 0) {
    // Utiliser _anciennePresc (snapshotée par _id, immunisée contre onSnapshot)
    if (!_anciennePresc || !_anciennePresc._id) {
      showToast('⚠️ Prescription introuvable — annulation.', true);
      _releaseSaveLock(); return;
    }
    // Réutiliser l'_id existant — overwrite Firestore garanti, jamais de doublon
    prescription._id = _anciennePresc._id;
    // Mettre à jour en mémoire locale par _id (pas par index, évite erreur de position)
    const _idxLocal = (window.prescriptions || []).findIndex(p => p._id === _anciennePresc._id);
    if (_idxLocal >= 0) {
      window.prescriptions[_idxLocal] = prescription;
    } else {
      // onSnapshot a remplacé l'array entre-temps — forcer la MAJ dans le nouvel array
      const _idxRetry = (window.prescriptions || []).findIndex(p => p._id === prescription._id);
      if (_idxRetry >= 0) window.prescriptions[_idxRetry] = prescription;
      else window.prescriptions.unshift(prescription); // dernier recours
      console.warn('[SAVE] Prescription introuvable en mémoire, forcé la MAJ');
    }
    if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(prescription);

    // Auto-apprentissage alias depuis la lecture brute de l'IA
    if (_anciennePresc.scanIA) {
      _autoLearnAliases(_anciennePresc, prescription);
    }

    if (_anciennePresc.scanIA) {
      const diffs = sauvegarderCorrectionLog(_anciennePresc.scanIA, prescription);
      if (diffs && diffs.length > 0) showToast(`💾 Mis à jour · 🧠 ${diffs.length} correction(s) loguée(s)`);
      else showToast('✅ Prescription mise à jour ! (IA avait tout bon 👍)');
    } else {
      showToast('✅ Prescription mise à jour !');
    }

  } else {
    // Nouvelle prescription — assigner _id AVANT sauvegarder (anti-doublon double-clic)
    prescription._id = 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2);

    const numSaisi = document.getElementById('num-display').value.trim();
    if (!numSaisi || isNaN(numSaisi)) {
      nextNum++;
    }
    if (scanIACourant) prescription.scanIA = scanIACourant;
    if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(prescription);

    if (scanIACourant) {
      const diffs = sauvegarderCorrectionLog(scanIACourant, prescription);
      if (diffs && diffs.length > 0) showToast(`✅ Enregistrée · 🧠 ${diffs.length} correction(s) loguée(s)`);
      else showToast('✅ Prescription enregistrée ! (IA avait tout bon 👍)');
    } else {
      showToast('✅ Prescription enregistrée avec succès !');
    }
  }

  lastScanPhoto = null;
  lastScanIA = null;
  // Déclencher le renderList différé si des onSnapshot étaient bloqués pendant l'édition
  if (window._renderAfterEdit) window._renderAfterEdit = false;
  renderList();

  // Saisie continue : charger la prochaine prescription en attente
  if (document.getElementById('saisie-continue')?.checked) {
    // Forcer le statut dans window.prescriptions pour éviter de recharger celle qu'on vient de sauver
    (window.prescriptions || []).forEach(function(p) {
      if (p._id === prescription._id) p.statut = prescription.statut;
    });
    // Petite pause pour laisser Firebase sync avant de chercher la prochaine
    var next = _trouverProchainePrescription(prescription);
    if (next) {
      var _nextId = next._id;
      var _savedFournisseur = prescription.fournisseur || '';
      setTimeout(function() {
        editPrescriptionById(_nextId);
        // Auto-incrémenter le code labo SEULEMENT si la fiche n'en a pas déjà un (scans PDF/HTML)
        var codeLaboInput = document.getElementById('code-labo-display');
        if (codeLaboInput && !codeLaboInput.value.trim()) {
          var fournInput = document.getElementById('fournisseur');
          var nextFourn = fournInput ? fournInput.value : '';
          if (nextFourn) codeLaboInput.value = getNextCodeLabo(nextFourn);
        }
      }, 300);
      _releaseSaveLock();
      return;
    } else {
      showToast('Saisie continue : aucune prescription en attente.', true);
    }
  }

  resetForm();
  _releaseSaveLock();
}

// ---- POPUP COMMENTAIRES ----
function toggleCommentairePopup() {
  var popup = document.getElementById('commentaire-popup');
  var ta = document.getElementById('commentaires');
  var edit = document.getElementById('commentaires-edit');
  if (!popup || !ta || !edit) return;
  edit.value = ta.value;
  popup.style.display = 'flex';
  edit.focus();
}
function fermerCommentairePopup() {
  var popup = document.getElementById('commentaire-popup');
  if (popup) popup.style.display = 'none';
}
function validerCommentairePopup() {
  var ta = document.getElementById('commentaires');
  var edit = document.getElementById('commentaires-edit');
  if (ta && edit) ta.value = edit.value;
  fermerCommentairePopup();
}

// ---- RECHERCHE PAR NUMÉRO DE FICHE ----
function rechercherNumFiche(query) {
  var box = document.getElementById('num-suggestions');
  if (!box) return;
  if (!query || query.length < 2) { box.style.display = 'none'; return; }
  var q = query.toLowerCase();
  var results = (window.prescriptions || []).map(function(p, i) { return Object.assign({}, p, { _index: i }); })
    .filter(function(p) {
      var s = p.statut || 'attente';
      return s === 'attente' || s === 'en-cours';
    })
    .filter(function(p) {
      var num = (p.numero || '').toLowerCase().replace('n° ', '');
      var codeLabo = (p.code_labo || '').toLowerCase();
      var patient = (p.patient?.nom || '').toLowerCase();
      return num.includes(q) || codeLabo.includes(q) || patient.includes(q) || (codeLabo + num).includes(q);
    })
    .slice(0, 8);
  if (!results.length) { box.style.display = 'none'; return; }
  box.innerHTML = results.map(function(p) {
    var num = (p.numero || '').replace('N° ', '');
    var codeLabo = p.code_labo ? '<span style="color:#5bc4c0;font-weight:700;margin-right:4px;">' + p.code_labo + '</span>' : '';
    var patient = p.patient?.nom || '';
    var cabinet = p.cabinet || '';
    return '<div onmousedown="document.getElementById(\'num-suggestions\').style.display=\'none\';editPrescription(' + p._index + ')"'
      + ' style="padding:8px 12px;cursor:pointer;font-size:0.78rem;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;"'
      + ' onmouseover="this.style.background=\'#f0f7ff\'" onmouseout="this.style.background=\'\'">'
      + '<span style="color:#1c2a35;">' + codeLabo + '<b>' + num + '</b></span>'
      + '<span style="display:flex;align-items:center;gap:6px;"><span style="font-size:0.6rem;padding:1px 6px;border-radius:10px;background:' + ({attente:'#fff3cd','en-cours':'#fff3cd',verifie:'#d4edda',importe:'#cce5ff'}[p.statut]||'#eee') + ';color:' + ({attente:'#856404','en-cours':'#856404',verifie:'#155724',importe:'#004085'}[p.statut]||'#666') + ';">' + ({attente:'attente','en-cours':'attente',verifie:'vérifié',importe:'importé'}[p.statut]||p.statut) + '</span><span style="color:#888;font-size:0.7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;">' + (patient || cabinet) + '</span></span>'
      + '</div>';
  }).join('');
  box.style.display = 'block';
}

// ---- SAISIE CONTINUE ----
function _trouverProchainePrescription(vientDeSauver) {
  var all = window.prescriptions || [];
  var sortMode = window._sortMode || 'recent';

  function naturalKey(s) {
    return (s || '').trim().replace(/(\d+)/g, function(_, n) { return n.padStart(10, '0'); });
  }
  function parseDate(d) {
    if (!d) return 0;
    var p = (d || '').split('/');
    if (p.length === 3) return new Date(p[2] < 100 ? '20'+p[2] : p[2], p[1]-1, p[0]).getTime();
    return new Date(d).getTime() || 0;
  }

  // Toutes les prescriptions en attente
  var enAttente = all.filter(function(p) {
    var s = p.statut || 'attente';
    return (s === 'attente' || s === 'en-cours') && p._id !== vientDeSauver._id;
  });

  if (!enAttente.length) return null;

  // Trier avec le meme tri que la liste affichee
  enAttente.sort(function(a, b) {
    if (sortMode === 'creation_desc') return parseDate(b.createdAt) - parseDate(a.createdAt);
    if (sortMode === 'recent')        return (b._ts || 0) - (a._ts || 0);
    if (sortMode === 'ancien')        return (a._ts || 0) - (b._ts || 0);
    if (sortMode === 'code_asc' || sortMode === 'code_desc') {
      var ka = naturalKey(a.code_labo), kb = naturalKey(b.code_labo);
      var cmp = ka.localeCompare(kb, 'fr');
      return sortMode === 'code_asc' ? cmp : -cmp;
    }
    if (sortMode === 'livraison_asc')  return (a.dates?.livraison || '').localeCompare(b.dates?.livraison || '');
    if (sortMode === 'livraison_desc') return (b.dates?.livraison || '').localeCompare(a.dates?.livraison || '');
    return 0;
  });

  // Trouver la position de la prescription sauvee dans cet ordre
  // Chercher la prochaine apres elle
  var savedId = vientDeSauver._id;
  // Reconstruire la liste complete (attente + non-attente) triee pour trouver la position
  var allTrie = all.slice().sort(function(a, b) {
    if (sortMode === 'creation_desc') return parseDate(b.createdAt) - parseDate(a.createdAt);
    if (sortMode === 'recent')        return (b._ts || 0) - (a._ts || 0);
    if (sortMode === 'ancien')        return (a._ts || 0) - (b._ts || 0);
    if (sortMode === 'code_asc' || sortMode === 'code_desc') {
      var ka = naturalKey(a.code_labo), kb = naturalKey(b.code_labo);
      var cmp = ka.localeCompare(kb, 'fr');
      return sortMode === 'code_asc' ? cmp : -cmp;
    }
    if (sortMode === 'livraison_asc')  return (a.dates?.livraison || '').localeCompare(b.dates?.livraison || '');
    if (sortMode === 'livraison_desc') return (b.dates?.livraison || '').localeCompare(a.dates?.livraison || '');
    return 0;
  });

  // Position de la sauvee dans la liste triee complete
  var savedIdx = allTrie.findIndex(function(p) { return p._id === savedId; });

  // Chercher la prochaine en attente apres cette position
  for (var i = savedIdx + 1; i < allTrie.length; i++) {
    var s = allTrie[i].statut || 'attente';
    if ((s === 'attente' || s === 'en-cours') && allTrie[i]._id !== savedId) {
      return allTrie[i];
    }
  }
  // Boucle : reprendre du debut
  for (var j = 0; j < savedIdx; j++) {
    var s2 = allTrie[j].statut || 'attente';
    if ((s2 === 'attente' || s2 === 'en-cours') && allTrie[j]._id !== savedId) {
      return allTrie[j];
    }
  }

  return enAttente[0];
}

// ---- RESET ----
function resetForm() {
  // Reset le snapshot correction-log (pas de log si formulaire rempli manuellement)
  window._snapshotAvantCorrection = null;
  // Déclencher le renderList différé si des onSnapshot étaient bloqués
  if (window._renderAfterEdit) {
    window._renderAfterEdit = false;
    setTimeout(() => { if (typeof renderList === 'function') renderList(); }, 100);
  }
  document.getElementById('prescription-form').reset();
  const _noteRappel = document.getElementById('gc-note-rappel');
  if (_noteRappel) _noteRappel.remove();
  selectedDents.clear();
  selectedTeinte = '';
  editingIndex = -1;
  document.querySelectorAll('.dent-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.teinte-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('num-display').value = '';
  document.getElementById('num-display').dataset.codeLabo = '';
  document.getElementById('code-labo-display').value = '';
  document.getElementById('cabinet').value = '';
  const _csel = document.getElementById('code-cogilog');
  if (_csel) _csel.value = '';
  const _badge = document.getElementById('cogilog-code-badge');
  if (_badge) { _badge.textContent = ''; _badge.style.display = 'none'; }
  const _clearBtn = document.getElementById('btn-clear-cabinet');
  if (_clearBtn) _clearBtn.style.display = 'none';
  document.getElementById('fournisseur').value = '';
  document.getElementById('piv').value = '';
  document.getElementById('dent-extraire').value = '';
  document.getElementById('adjonction-dent').value = '';
  document.getElementById('adjonction-crochet').value = '';
  document.getElementById('cas-esthetique').checked = false;
  document.getElementById('scan-check').checked = false;
  window._scanPosition = '';
  window._produitsAnnexes = [];
  window._produitsAnnexesDents = {};
  highlightCasEsthetique();
  highlightScan();
  highlightAnnexes();
  highlightPivField();
  highlightDentExtraire();
  const _sdcb = document.getElementById('sans-date-livraison');
  if (_sdcb) { _sdcb.checked = false; toggleSansDate(_sdcb); }
  // Reset panneau aperçu
  document.getElementById('preview-panel').style.display = 'none';
  document.getElementById('preview-panel').classList.remove('visible');
  document.getElementById('preview-panel-body').innerHTML = '<div class="preview-panel-empty"><div style="font-size:2rem;margin-bottom:8px;">📂<\/div><div>Scannez une fiche pour voir l\'aperçu ici<\/div><\/div>';
  currentZoom = 1;
  const btn = document.getElementById('save-btn');
  btn.textContent = 'Enregistrer la prescription';
  btn.style.background = '';
  // Masquer le bouton rescan
  const _btnRescan = document.getElementById('btn-rescan');
  if (_btnRescan) _btnRescan.style.display = 'none';
  // Masquer et vider le champ d'explication
  const explZone = document.getElementById('edit-explication-zone');
  const explInp = document.getElementById('edit-explication');
  if (explZone) explZone.style.display = 'none';
  if (explInp) explInp.value = '';
  // Reset à refaire
  window.aRefaireActes = null;
  const btnRef = document.getElementById('btn-refaire-detail');
  if (btnRef) { btnRef.style.display = 'none'; btnRef.textContent = 'Configurer ✏️'; }
  // Reset quantités
  document.querySelectorAll('.qty-input').forEach(function(inp) {
    inp.value = '1';
    inp.style.display = 'none';
  });
}


function editPrescription(i) {
  // Toujours lire dans window.prescriptions (jamais l'alias stale)
  const p = (window.prescriptions || [])[i];
  if (!p) { showToast('Prescription introuvable', true); return; }
  editingIndex = i;
  // FIX C : couper la contamination scan — vider lastScan* dès qu'on entre en édition
  lastScanPhoto = null;
  lastScanIA = null;

  // Supprimer l'ancienne note cabinet avant d'en afficher une nouvelle
  const _ancienneNote = document.getElementById('gc-note-rappel');
  if (_ancienneNote) _ancienneNote.remove();

  // Popup rappel notes cabinet (si préférence activée)
  if (p.cabinet && (window._appPrefs?.rappel_note_prescription !== false)) {
    const _nAcc = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const notesCab = Object.entries(window._gcNotes || {}).find(([k]) => _nAcc(k) === _nAcc(p.cabinet));
    if (notesCab && notesCab[1] && notesCab[1].trim()) {
      gcAfficherRappelNote(p.cabinet, notesCab[1]);
    }
  }

  // Remplir le formulaire
  document.getElementById('cabinet').value = p.cabinet || '';
  document.getElementById('praticien').value = p.praticien || '';
  document.getElementById('patient-nom').value = p.patient?.nom || '';
  document.getElementById('patient-age').value = p.patient?.age || '';
  document.getElementById('a-refaire').checked = p.aRefaire || false;
  window.aRefaireActes = (p.aRefaireActes !== undefined) ? p.aRefaireActes : null;
  const btnRef = document.getElementById('btn-refaire-detail');
  if (btnRef) {
    btnRef.style.display = p.aRefaire ? 'inline-block' : 'none';
    var _refCount = Array.isArray(p.aRefaireActes) ? p.aRefaireActes.length : (p.aRefaireActes && typeof p.aRefaireActes === 'object' ? Object.keys(p.aRefaireActes).length : 0);
    if (_refCount) btnRef.textContent = `Configurer ✏️ (${_refCount})`;
  }
  document.getElementById('urgent').checked = p.urgent || false;
  document.getElementById('call-me').checked = p.call_me || false;
  document.getElementById('cas-esthetique').checked = p.casEsthetique || false;
  document.getElementById('scan-check').checked = p.scan || false;
  window._scanPosition = p.scanPosition || '';
  setScanPosition(window._scanPosition);
  window._produitsAnnexes = (p.produitsAnnexes || []).slice();
  window._produitsAnnexesDents = Object.assign({}, p.produitsAnnexesDents || {});
  highlightScan();
  highlightCasEsthetique();
  highlightAnnexes();
  document.getElementById('date-empreinte').value = dateFromISO(p.dates?.empreinte || '');
  document.getElementById('date-livraison').value = dateFromISO(p.dates?.livraison || '');
  const sansDateCb = document.getElementById('sans-date-livraison');
  if (sansDateCb) {
    sansDateCb.checked = p.dates?.sansDate || false;
    toggleSansDate(sansDateCb);
  }
  document.getElementById('fraisage').value = p.fraisage || '';
  if (p.fraisage) {
    const cbFrais = document.querySelector('input[name="conjointe"][value="Fraisage"]');
    if (cbFrais) cbFrais.checked = true;
  }
  document.getElementById('piv').value = p.piv || '';
  document.getElementById('dent-extraire').value = p.dentExtraire || '';
  document.getElementById('adjonction-dent').value = p.adjonctionDent || '';
  document.getElementById('adjonction-crochet').value = p.adjonctionCrochet || '';
  // Injecter dans dentsActes pour que la bulle clic droit affiche les bonnes valeurs
  if (p.dentExtraire) window._dentsActesCourant['Dent à extraire'] = p.dentExtraire;
  if (p.adjonctionDent) window._dentsActesCourant['Adjonction dent'] = p.adjonctionDent;
  if (p.adjonctionCrochet) window._dentsActesCourant['Adjonction crochet'] = p.adjonctionCrochet;
  document.getElementById('teinte-custom').value = p.teinte || '';
  // inter-bridge supprimé
  document.getElementById('commentaires').value = p.commentaires || '';
  document.getElementById('num-display').value = p.numero.replace('N° ', '');
  document.getElementById('num-display').dataset.codeLabo = p.code_labo || '';
  document.getElementById('code-labo-display').value = p.code_labo || '';
  document.getElementById('code-cogilog').value = p.code_cogilog || '';
  const _editBadge = document.getElementById('cogilog-code-badge');
  const _editClearBtn = document.getElementById('btn-clear-cabinet');
  if (_editBadge) { _editBadge.textContent = p.code_cogilog || ''; _editBadge.style.display = p.code_cogilog ? 'block' : 'none'; }
  if (_editClearBtn) _editClearBtn.style.display = (p.cabinet || p.code_cogilog) ? 'block' : 'none';
  document.getElementById('fournisseur').value = p.fournisseur || '';

  // Sexe
  if (p.patient?.sexe) {
    const radio = document.querySelector(`input[name="sexe"][value="${p.patient.sexe}"]`);
    if (radio) radio.checked = true;
  }

  // Mâchoire
  if (p.machoire) {
    const vals = Array.isArray(p.machoire) ? p.machoire : [p.machoire];
    document.querySelectorAll('input[name="mach"]').forEach(cb => {
      cb.checked = vals.includes(cb.value);
    });
  }

  // Dents
  selectedDents.clear();
  document.querySelectorAll('.dent-btn').forEach(b => b.classList.remove('selected'));
  (p.dents || []).forEach(n => {
    selectedDents.add(Number(n));
    const btn = document.querySelector(`.dent-btn[data-dent="${n}"]`);
    if (btn) btn.classList.add('selected');
  });

  // Reset badges/groupes AVANT de cocher les cases
  clearTimeout(window._dentsActesTimeout);
  window._dentsActesCourant = {};
  window._quantitesActesCourant = {};
  window._solidGroups = [];
  window._usSelection = new Set();
  document.querySelectorAll('.acte-detail-badge').forEach(b => b.remove());
  ['unitaire','solidaire'].forEach(id => {
    const badge = document.getElementById('badge-' + id);
    if (badge) badge.innerHTML = '';
  });

  // Cases conjointe
  document.querySelectorAll('input[name="conjointe"]').forEach(cb => {
    cb.checked = (p.conjointe || []).includes(cb.value);
  });

  // Cases adjointe
  document.querySelectorAll('input[name="adjointe"]').forEach(cb => {
    cb.checked = (p.adjointe || []).includes(cb.value);
  });

  // Appliquer dentsActes et solidGroups APRÈS les cases cochées
  appliquerDentsActes(p.dentsActes, p.quantites);
  appliquerSolidGroups(p.solidGroups);

  // Quantités — restaurer les valeurs et afficher/masquer les inputs
  const quantites = p.quantites || {};
  document.querySelectorAll('.qty-input').forEach(function(inp) {
    const acte = inp.dataset.acte;
    const cb = inp.parentElement.querySelector('input[type="checkbox"]');
    if (cb && cb.checked) {
      inp.value = quantites[acte] || 1;
      inp.style.display = 'inline-block';
    } else {
      inp.value = '1';
      inp.style.display = 'none';
    }
  });

  // Teinte
  document.querySelectorAll('.teinte-chip').forEach(c => {
    c.classList.toggle('selected', c.textContent === p.teinte);
  });

  // Changer le bouton
  document.getElementById('save-btn').textContent = '💾 Mettre à jour';
  document.getElementById('save-btn').style.background = '#f59e0b';

  // Afficher le bouton rescan (seulement si la prescription a une photo)
  const _btnRescan = document.getElementById('btn-rescan');
  const _hasPhoto = p.photo_html || p.photo_url || p.photo || (window._photoCache && window._photoCache[p._id]);
  if (_btnRescan) {
    _btnRescan.style.display = (_hasPhoto && _hasPhoto !== '__photo__') ? 'inline-block' : 'none';
  }
  // Mémoriser les données pour le rescan
  if (_hasPhoto && _hasPhoto !== '__photo__') {
    window._rescanData = { photoSrc: _hasPhoto, photoType: p.photo_type || 'image', patientName: p.patient?.nom || p.numero || '', _editIdx: i };
  } else {
    window._rescanData = null;
  }

  // Afficher le champ d'explication si la prescription a un scanIA (donc corrigeable)
  const explZone = document.getElementById('edit-explication-zone');
  const explInp = document.getElementById('edit-explication');
  if (explZone) {
    explZone.style.display = p.scanIA ? 'flex' : 'none';
    if (explInp) explInp.value = '';
  }

  // Afficher le panneau aperçu avec la photo ou un message
  const panel = document.getElementById('preview-panel');
  const body = document.getElementById('preview-panel-body');
  const filename = document.getElementById('preview-filename');

  panel.style.display = 'block'; // forcer l'affichage directement
  filename.textContent = p.patient?.nom || p.numero;

  // Pour les HTML : toujours utiliser photo_html (le base64 local) pour l'affichage, pas le lien Cloudinary raw
  // Pour les PDF : préférer le base64 local (multi-page garanti via PDF.js) plutôt que l'URL Cloudinary (CORS)
  var photoAfficher, photoType;
  if (p.photo_type === 'html' && p.photo_html) {
    photoAfficher = p.photo_html;
    photoType = 'html';
  } else if (p.photo_type === 'pdf' && p.photo && p.photo !== '__photo__' && p.photo.startsWith('data:')) {
    // PDF base64 local disponible → utiliser directement (pas de CORS, multi-page OK)
    photoAfficher = p.photo;
    photoType = 'pdf';
  } else {
    photoAfficher = p.photo_url || p.photo;
    photoType = p._photoType || p.photo_type || 'image';
    // Détection auto si l'URL ou le data URL ressemble à un PDF
    if (photoType === 'image' && photoAfficher) {
      if (photoAfficher.startsWith('data:application/pdf') || (photoAfficher.startsWith('http') && (photoAfficher.toLowerCase().includes('.pdf') || photoAfficher.toLowerCase().includes('/raw/')))) {
        photoType = 'pdf';
      }
    }
  }
  if (photoAfficher && photoAfficher !== '__photo__') {
    afficherFichierDansPanel(body, photoAfficher, photoType);
  } else {
    body.innerHTML = `<div class="preview-panel-empty"><div style="font-size:2.5rem;margin-bottom:12px;">📋<\/div><div style="font-weight:600;margin-bottom:6px;">${p.patient?.nom || p.numero}<\/div><div style="opacity:0.6;">Aucune fiche scannée<br>pour cette prescription<\/div><\/div>`;
  }

  // Scroll après rendu
  setTimeout(() => {
    document.getElementById('split-wrapper').scrollIntoView({ behavior: 'smooth' });
  }, 50);

  // Capturer le snapshot pour les correction logs (si fiche issue d'un scan IA)
  // Délai pour laisser les badges/dentsActes se rendre avant de capturer
  if (p.scanIA && typeof capturerSnapshotFormulaire === 'function') {
    setTimeout(function() { capturerSnapshotFormulaire(); }, 500);
  }

  showToast('Prescription chargée — modifie et sauvegarde !');
}
