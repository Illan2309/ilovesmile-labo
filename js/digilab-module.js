// ══════════════════════════════════════════
// MODULE DIGILAB — Intégration scan intra-oral
// Affiche les cas Digilab, télécharge les fichiers,
// et crée les prescriptions via scan IA
// ══════════════════════════════════════════

(function() {
  'use strict';

  // ── Config ──
  var WORKER_URL = 'https://digilab-webhook.cohenillan29.workers.dev';
  var AUTH_KEY = 'ils_webhook_2026_Sm1leL4b';
  var SERVICES_NEED_FICHE = ['medit', 'dscore2', 'shining3d'];

  // ── State ──
  var _cases = [];
  var _selectedCaseId = null;
  var _processing = false;
  var _unsubFirebase = null;
  var _badgeListener = null;

  // ═══════════════════════════════════════════
  // BADGE NOTIFICATION — écoute en permanence
  // ═══════════════════════════════════════════

  function _initBadgeListener() {
    var db = window.getDB ? window.getDB() : null;
    if (!db || _badgeListener) return;

    _badgeListener = db.collection('digilab_orders')
      .where('_status', '==', 'nouveau')
      .onSnapshot(function(snapshot) {
        var count = snapshot.size;
        _updateBadge(count);
      }, function() {
        // Erreur silencieuse
      });
  }

  function _updateBadge(count) {
    var btn = document.querySelector('[onclick="ouvrirDigilab()"]');
    if (!btn) return;

    // Supprimer l'ancien badge
    var old = btn.querySelector('.dlb-notif-badge');
    if (old) old.remove();

    if (count > 0) {
      var badge = document.createElement('span');
      badge.className = 'dlb-notif-badge';
      badge.textContent = count;
      badge.style.cssText = 'position:absolute;top:-6px;right:-6px;background:#e53935;color:white;font-size:0.6rem;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;box-shadow:0 2px 6px rgba(229,57,53,0.4);';
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }

  // Démarrer le listener dès que Firebase est prêt
  // On attend un peu pour que getDB soit disponible
  setTimeout(function() { _initBadgeListener(); }, 3000);
  // Retry si Firebase pas encore prêt
  setTimeout(function() { if (!_badgeListener) _initBadgeListener(); }, 8000);

  // ═══════════════════════════════════════════
  // MODAL — Ouvrir / Fermer
  // ═══════════════════════════════════════════

  window.ouvrirDigilab = function() {
    document.getElementById('modal-digilab').style.display = 'flex';
    _chargerCasFirebase();
  };

  window.fermerDigilab = function() {
    document.getElementById('modal-digilab').style.display = 'none';
    // Ne PAS déconnecter le listener Firebase — on garde le badge actif
  };

  // ═══════════════════════════════════════════
  // CHARGEMENT DES CAS
  // ═══════════════════════════════════════════

  function _chargerCasFirebase() {
    var db = window.getDB ? window.getDB() : null;
    if (!db) {
      // Fallback : charger via le Worker
      _chargerCasWorker();
      return;
    }

    // Temps réel via onSnapshot
    if (_unsubFirebase) _unsubFirebase();
    _unsubFirebase = db.collection('digilab_orders')
      .orderBy('_receivedAt', 'desc')
      .limit(100)
      .onSnapshot(function(snapshot) {
        _cases = [];
        snapshot.forEach(function(doc) {
          var data = doc.data();
          data._firebaseId = doc.id;
          _cases.push(data);
        });
        _renderListe();
      }, function(err) {
        console.error('[DIGILAB] Firebase error:', err);
        _chargerCasWorker();
      });
  }

  function _chargerCasWorker() {
    fetch(WORKER_URL + '/v1/orders?key=' + AUTH_KEY)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        _cases = data.orders || [];
        _renderListe();
      })
      .catch(function(e) {
        console.error('[DIGILAB] Worker error:', e);
        _renderListe();
      });
  }

  window.dlbRefresh = function() {
    _chargerCasFirebase();
    if (typeof showToast === 'function') showToast('Digilab : actualisation...');
  };

  window.dlbFilterList = function() {
    _renderListe();
  };

  // ═══════════════════════════════════════════
  // RENDU LISTE DES CAS
  // ═══════════════════════════════════════════

  function _renderListe() {
    var container = document.getElementById('dlb-case-list');
    if (!container) return;

    var stats = document.getElementById('dlb-stats');
    var nouveau = _cases.filter(function(c) { return c._status === 'nouveau'; }).length;
    var traite = _cases.filter(function(c) { return c._status === 'traite'; }).length;
    if (stats) {
      stats.innerHTML = '<span style="color:#f57f17;font-weight:600;">' + nouveau + ' nouveau' + (nouveau > 1 ? 'x' : '') + '</span> · <span style="color:#2e7d32;">' + traite + ' traité' + (traite > 1 ? 's' : '') + '</span> · ' + _cases.length + ' total';
    }

    if (_cases.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Aucun cas Digilab reçu</div>';
      return;
    }

    // Filtrer par recherche
    var searchInput = document.getElementById('dlb-search');
    var query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    var filtered = _cases;
    if (query) {
      filtered = _cases.filter(function(c) {
        var patient = (c.patient_name || c.patientName || '').toLowerCase();
        var cabinet = ((c.dentistCreator && c.dentistCreator.name) || c.realDentist || c.dentistName || '').toLowerCase();
        var service = (c.service || '').toLowerCase();
        var id = String(c._digilabId || c._firebaseId || c._id || '').toLowerCase();
        var status = (c._status || '').toLowerCase();
        var comment = (c.comment || '').toLowerCase();
        return patient.includes(query) || cabinet.includes(query) || service.includes(query) || id.includes(query) || status.includes(query) || comment.includes(query);
      });
    }

    var html = '';
    // En-tête tableau
    html += '<table class="dlb-table"><thead><tr>';
    html += '<th>Date de creation</th><th>Patient</th><th>Statut</th><th>Cabinet</th><th>Service</th><th>Id du cas</th><th></th>';
    html += '</tr></thead><tbody>';

    filtered.forEach(function(c) {
      var id = c._digilabId || c._firebaseId || c._id || '';
      var patient = c.patient_name || c.patientName || 'Patient inconnu';
      var service = (c.service || '').toLowerCase();
      var dateRaw = c.creation_date || c._receivedAt || '';
      var dateStr = _formatDate(dateRaw);
      var timeStr = _formatTime(dateRaw);
      var status = c._status || 'nouveau';
      var isSelected = id === _selectedCaseId;
      var cabinet = (c.dentistCreator && c.dentistCreator.name) || c.realDentist || '';

      var serviceClass = 'other';
      if (service.includes('medit')) serviceClass = 'medit';
      else if (service.includes('3shape')) serviceClass = 'threeshape';
      else if (service.includes('shining')) serviceClass = 'shining';
      else if (service.includes('dscore')) serviceClass = 'dscore';
      else if (service.includes('itero')) serviceClass = 'itero';

      var statusLabel = status === 'nouveau' ? 'En attente' : status === 'traite' ? 'Traite' : status === 'en_cours' ? 'En cours' : status;
      if (status.startsWith('envoye_')) statusLabel = 'Envoye ' + status.replace('envoye_', '').toUpperCase();
      var statusClass = status.startsWith('envoye') ? 'envoye' : status;

      html += '<tr class="dlb-table-row ' + (isSelected ? 'selected' : '') + '" onclick="dlbSelectCase(\'' + _esc(id) + '\')" oncontextmenu="event.preventDefault();dlbContextMenu(event,\'' + _esc(id) + '\')">';
      html += '  <td class="dlb-td-date">' + dateStr + ' ' + timeStr + '</td>';
      html += '  <td class="dlb-td-patient"><div class="dlb-td-name">' + _esc(patient) + '</div></td>';
      html += '  <td><span class="dlb-badge dlb-status-' + statusClass + '">' + statusLabel + '</span></td>';
      html += '  <td class="dlb-td-cabinet">' + _esc(cabinet) + '</td>';
      html += '  <td><span class="dlb-badge dlb-service-' + serviceClass + '">' + _esc(service || '?') + '</span></td>';
      html += '  <td class="dlb-td-caseid">' + _esc(id) + '</td>';
      html += '  <td class="dlb-td-actions">';
      html += '    <button class="dlb-btn dlb-btn-dl" onclick="event.stopPropagation();dlbDownloadFiles(\'' + _esc(id) + '\')" title="Telecharger">&#11015;</button>';
      html += '    <button class="dlb-btn dlb-btn-scan" onclick="event.stopPropagation();dlbScanFiche(\'' + _esc(id) + '\')" title="Scanner">&#9881;</button>';
      var linkCase = c.link_case || ('https://app.digilab.dental/case2/' + id);
      html += '    <a class="dlb-btn dlb-btn-view" href="' + _esc(linkCase) + '" target="_blank" onclick="event.stopPropagation()" title="Voir en 3D sur Digilab">&#128065;</a>';
      html += '    <button class="dlb-btn dlb-btn-del" onclick="event.stopPropagation();dlbDeleteCase(\'' + _esc(id) + '\')" title="Supprimer">&#10005;</button>';
      html += '  </td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ═══════════════════════════════════════════
  // DÉTAIL D'UN CAS
  // ═══════════════════════════════════════════

  window.dlbSelectCase = function(caseId) {
    _selectedCaseId = caseId;
    _renderListe();

    var detail = document.getElementById('dlb-detail');
    if (!detail) return;

    var c = _cases.find(function(x) { return (x._digilabId || x._firebaseId || x._id) === caseId; });
    if (!c) { detail.innerHTML = ''; return; }

    var patient = c.patient_name || c.patientName || 'Patient inconnu';
    var service = c.service || '?';
    var comment = c.comment || '';
    var date = _formatDate(c._receivedAt || c.creation_date || '');
    var deadline = _formatDate(c.globalDeadline || '');
    var status = c._status || 'nouveau';
    var linkCase = c.link_case || '';

    var html = '<div class="dlb-detail-header">';
    html += '  <h3 style="margin:0;">' + _esc(patient) + '</h3>';
    html += '  <span class="dlb-badge dlb-status-' + status + '">' + status + '</span>';
    html += '</div>';
    html += '<div class="dlb-detail-grid">';
    html += '  <div class="dlb-detail-field"><label>Service</label><span>' + _esc(service) + '</span></div>';
    html += '  <div class="dlb-detail-field"><label>Recu le</label><span>' + date + '</span></div>';
    if (deadline) html += '  <div class="dlb-detail-field"><label>Deadline</label><span>' + deadline + '</span></div>';
    var cabinet = (c.dentistCreator && c.dentistCreator.name) || c.realDentist || '';
    if (cabinet) html += '  <div class="dlb-detail-field"><label>Cabinet</label><span>' + _esc(cabinet) + '</span></div>';
    html += '</div>';
    if (comment) {
      html += '<div class="dlb-detail-comment"><label>Commentaire dentiste</label><div>' + _esc(comment) + '</div></div>';
    }
    html += '<div class="dlb-detail-actions">';
    html += '  <button class="dlb-btn dlb-btn-primary" onclick="dlbDownloadFiles(\'' + _esc(caseId) + '\')">Telecharger fichiers</button>';
    html += '  <button class="dlb-btn dlb-btn-primary" onclick="dlbDownloadPdf(\'' + _esc(caseId) + '\')">Fiche PDF</button>';
    html += '  <button class="dlb-btn dlb-btn-primary" onclick="dlbScanFiche(\'' + _esc(caseId) + '\')">Scanner la fiche</button>';
    html += '  <button class="dlb-btn dlb-btn-accent" onclick="dlbProcessCase(\'' + _esc(caseId) + '\')">Tout traiter</button>';
    html += '</div>';

    // Zone fichiers (chargée en async)
    html += '<div id="dlb-files-list" style="margin-top:16px;"><em style="color:#999;">Chargement des fichiers...</em></div>';

    detail.innerHTML = html;

    // Charger la liste des fichiers
    _chargerFichiersCas(caseId);
  };

  function _chargerFichiersCas(caseId) {
    var container = document.getElementById('dlb-files-list');
    if (!container) return;

    // Utiliser les fichiers stockés dans les données webhook (Firebase)
    var c = _findCase(caseId);
    var files = (c && c.files) || [];

    if (files.length === 0) {
      container.innerHTML = '<em style="color:#999;">Aucun fichier dans les données webhook</em>';
      return;
    }

    var html = '<label style="font-weight:600;font-size:0.78rem;color:#1a5c8a;">Fichiers (' + files.length + ')</label>';
    html += '<div class="dlb-file-list">';
    files.forEach(function(f) {
      var size = f.size ? Math.round(parseInt(f.size) / 1024) + ' KB' : '';
      var name = f.name || f.fullPath || '?';
      html += '<div class="dlb-file-item">';
      html += '  <span>' + _esc(name) + '</span>';
      html += '  <span style="color:#999;font-size:0.7rem;">' + size + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div style="margin-top:8px;font-size:0.68rem;color:#f57f17;">Les URLs de téléchargement expirent 1h après réception. Si expiré, ouvrez le cas sur Digilab.</div>';
    container.innerHTML = html;
  }

  // ═══════════════════════════════════════════
  // TÉLÉCHARGEMENT FICHIERS
  // ═══════════════════════════════════════════

  window.dlbDownloadFiles = async function(caseId) {
    var c = _findCase(caseId);
    if (!c) { showToast('Cas introuvable', true); return; }

    var patient = (c.patient_name || c.patientName || 'patient').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    var service = (c.service || '').toLowerCase();
    var needsFilter = SERVICES_NEED_FICHE.some(function(s) { return service.includes(s); });

    // Récupérer les fichiers depuis les données webhook (Firebase)
    var files = (c.files || []).filter(function(f) { return f.url; });

    if (files.length === 0 && c.file_archive) {
      // Fallback : URL d'archive directe
      files = [{ name: patient + '_files.zip', url: c.file_archive }];
    }

    if (files.length === 0) {
      showToast('Aucun fichier disponible — clé API Digilab nécessaire', true);
      return;
    }

    showToast('Téléchargement des fichiers...');

    try {
      // Filtrer les fichiers POF pour medit/dscore/shining
      if (needsFilter) {
        var before = files.length;
        files = files.filter(function(f) {
          var name = (f.name || '').split('/').pop();
          return !/^(POF_|FULL_POF_)/i.test(name);
        });
        if (files.length < before) {
          console.log('[DIGILAB] Filtré ' + (before - files.length) + ' fichier(s) POF');
        }
      }

      // Si 1 seul fichier ZIP et pas de filtrage → télécharger directement via proxy
      if (files.length === 1 && !needsFilter) {
        // Télécharger via POST pour éviter les problèmes d'URL longues
        try {
          var _dlResp = await fetch(WORKER_URL + '/v1/digilab/proxy-file?key=' + AUTH_KEY, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: files[0].url })
          });
          if (_dlResp.ok) {
            var _dlBlob = await _dlResp.blob();
            var _dlA = document.createElement('a');
            _dlA.href = URL.createObjectURL(_dlBlob);
            _dlA.download = patient + '_files.zip';
            _dlA.click();
            URL.revokeObjectURL(_dlA.href);
          }
        } catch(e) { console.error('[DIGILAB] Download error', e); }
        showToast('Téléchargement lancé : ' + patient);
        return;
      }

      // Télécharger chaque fichier via proxy et recréer un ZIP propre (aplati, sans POF)
      var zip = new JSZip();
      var downloaded = 0;
      var errors = 0;

      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var fileName = (f.name || 'file_' + i).split('/').pop(); // aplatir
        showToast('Téléchargement ' + (i + 1) + '/' + files.length + ' : ' + fileName);

        try {
          var fileResp = await fetch(WORKER_URL + '/v1/digilab/proxy-file?key=' + AUTH_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: f.url })
          });
          if (!fileResp.ok) throw new Error('HTTP ' + fileResp.status);
          var blob = await fileResp.blob();

          // Si c'est un ZIP, l'extraire et aplatir le contenu
          if (fileName.endsWith('.zip') && typeof JSZip !== 'undefined') {
            try {
              var innerZip = await JSZip.loadAsync(blob);
              var innerCount = 0;
              var promises = [];
              innerZip.forEach(function(path, entry) {
                if (entry.dir) return;
                var innerName = path.split('/').pop();
                // Filtrer POF si nécessaire
                if (needsFilter && /^(POF_|FULL_POF_)/i.test(innerName)) return;
                promises.push(entry.async('blob').then(function(b) {
                  zip.file(innerName, b);
                  innerCount++;
                }));
              });
              await Promise.all(promises);
              downloaded += innerCount;
              console.log('[DIGILAB] ZIP extrait: ' + innerCount + ' fichiers de ' + fileName);
            } catch (ze) {
              // Pas un vrai ZIP ou erreur → garder tel quel
              zip.file(fileName, blob);
              downloaded++;
            }
          } else {
            zip.file(fileName, blob);
            downloaded++;
          }
        } catch (e) {
          console.error('[DIGILAB] Erreur fichier:', f.name, e);
          errors++;
        }
      }

      if (downloaded === 0 && errors > 0) {
        showToast('Echec telechargement — URLs probablement expirees', true);
        return;
      }

      // Générer et télécharger le ZIP nettoyé
      var zipBlob = await zip.generateAsync({ type: 'blob' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = patient + '_files.zip';
      a.click();
      URL.revokeObjectURL(a.href);

      showToast(downloaded + ' fichier(s) téléchargé(s) pour ' + patient);

    } catch (e) {
      console.error('[DIGILAB] Download error:', e);
      showToast('Erreur telechargement : ' + e.message, true);
    }
  };

  // ═══════════════════════════════════════════
  // SCAN FICHE → PRESCRIPTION (hybride)
  // Données structurées Digilab + IA sur commentaire
  // ═══════════════════════════════════════════

  window.dlbScanFiche = async function(caseId) {
    var c = _findCase(caseId);
    if (!c) { showToast('Cas introuvable', true); return; }

    showToast('Traitement de la fiche Digilab...');
    _updateStatus(caseId, 'en_cours');

    try {
      // 1. MAPPING DIRECT depuis les données structurées (base)
      var mapped = _mapDigilabToPrescription(c);

      // 2. Chercher la fiche originale HTML/PDF du cas
      var originalFile = _findOriginalFile(c);
      var photoDataUrl = null;

      if (originalFile && originalFile.url) {
        // ── FLOW FICHE ORIGINALE : télécharger + IA complète ──
        console.log('[DIGILAB] Fiche originale trouvée:', originalFile.name);
        try {
          var fileData = await _downloadFileAsBase64(originalFile.url, originalFile.name);
          var isHTML = fileData.mediaType === 'text/html';
          photoDataUrl = fileData.dataUrl;

          // 3a. Envoyer la fiche complète à Gemini (comme un scan classique)
          var parsed = await callGemini(fileData.base64, fileData.mediaType, isHTML);

          // 3b. Fusionner : l'IA a la priorité, le mapping brut sert de fallback
          if (parsed) {
            // Garder les champs du mapping brut que l'IA n'a pas trouvé
            var fallbackFields = ['cabinet_nom', 'praticien', 'date_empreinte', 'date_livraison'];
            fallbackFields.forEach(function(field) {
              if (!parsed[field] && mapped[field]) {
                parsed[field] = mapped[field];
              }
            });
            mapped = parsed;
          }
        } catch (e) {
          console.warn('[DIGILAB] Erreur fiche originale, fallback PDF généré + IA:', e.message);
          // Fallback : générer notre PDF + envoyer à l'IA
          try {
            var pdfFallback = await window.generateDigilabPdf(c);
            if (pdfFallback && pdfFallback.doc) {
              var pdfBlobFb = pdfFallback.doc.output('blob');
              photoDataUrl = await _blobToDataUrl(pdfBlobFb);
              var pdfB64Fb = photoDataUrl.split(',')[1];
              var parsedFb = await callGemini(pdfB64Fb, 'application/pdf', false);
              if (parsedFb) {
                var fbFields = ['cabinet_nom', 'praticien', 'date_empreinte', 'date_livraison'];
                fbFields.forEach(function(f) { if (!parsedFb[f] && mapped[f]) parsedFb[f] = mapped[f]; });
                mapped = parsedFb;
              }
            }
          } catch (e2) {
            console.warn('[DIGILAB] Fallback PDF aussi échoué, mapping brut seul:', e2.message);
            // Dernier recours : au moins le commentaire
            var comment = c.comment || '';
            if (comment.trim()) {
              var ficheHtml = _buildFicheHtml(c);
              var base64 = btoa(unescape(encodeURIComponent(ficheHtml)));
              var parsedFallback = await callGemini(base64, 'text/html', true);
              _mergeIaResults(mapped, parsedFallback);
            }
          }
        }
      } else {
        // ── FLOW SANS FICHE : générer PDF custom puis envoyer à l'IA ──
        console.log('[DIGILAB] Pas de fiche originale, génération PDF + IA');
        var pdfResult = await window.generateDigilabPdf(c);
        if (pdfResult && pdfResult.doc) {
          var pdfBlob = pdfResult.doc.output('blob');
          photoDataUrl = await _blobToDataUrl(pdfBlob);
          console.log('[DIGILAB] PDF généré, photoDataUrl:', photoDataUrl ? (photoDataUrl.substring(0, 50) + '...') : 'NULL');

          // Envoyer le PDF généré à Gemini comme un scan classique
          try {
            var pdfBase64 = photoDataUrl.split(',')[1];
            var parsedPdf = await callGemini(pdfBase64, 'application/pdf', false);
            if (parsedPdf) {
              // L'IA a la priorité, le mapping brut sert de fallback
              var fallbackFields2 = ['cabinet_nom', 'praticien', 'date_empreinte', 'date_livraison'];
              fallbackFields2.forEach(function(field) {
                if (!parsedPdf[field] && mapped[field]) {
                  parsedPdf[field] = mapped[field];
                }
              });
              mapped = parsedPdf;
            }
          } catch (e) {
            console.warn('[DIGILAB] IA sur PDF généré échoué, fallback mapping brut:', e.message);
            // Fallback : au moins traiter le commentaire
            var comment2 = c.comment || '';
            if (comment2.trim()) {
              var ficheHtml2 = _buildFicheHtml(c);
              var base642 = btoa(unescape(encodeURIComponent(ficheHtml2)));
              var parsed2 = await callGemini(base642, 'text/html', true);
              _mergeIaResults(mapped, parsed2);
            }
          }
        }
      }

      // 4. Construire la prescription via le pipeline standard
      var prescription = await buildPrescriptionFromScan(mapped, photoDataUrl, mapped, true);

      // 6. Métadonnées Digilab
      prescription._digilabCaseId = caseId;
      prescription._digilabService = c.service || '';
      prescription.scan = true;
      console.log('[DIGILAB] Prescription créée avec _digilabCaseId:', caseId, 'patient:', prescription.patient?.nom || mapped.patient_nom);

      // 6. Sauvegarder
      if (window.sauvegarderUnePrescription) {
        window.sauvegarderUnePrescription(prescription);
      }

      // 7. Marquer comme traité
      _updateStatus(caseId, 'traite');

      showToast('Prescription créée pour ' + (c.patient_name || 'patient'));

    } catch (e) {
      console.error('[DIGILAB] Scan error:', e);
      _updateStatus(caseId, 'nouveau');
      showToast('Erreur scan : ' + e.message, true);
    }
  };

  // ── Mapping direct données Digilab → format prescription ──
  function _mapDigilabToPrescription(c) {
    var dentist = c.dentistCreator || {};
    var ofData = c.of || {};
    var priceList = c.priceList || [];
    var cameraData = c.cameraData || [];
    var comment = c.comment || '';

    // Parser patient_name : souvent "NOM Prenom/ DR NOM_PRATICIEN"
    var rawPatientName = c.patient_name || '';
    var patientName = rawPatientName;
    var praticienFromName = '';
    var slashMatch = rawPatientName.match(/^(.+?)\s*\/\s*(?:DR\.?\s*)(.+)$/i);
    if (slashMatch) {
      patientName = slashMatch[1].trim();
      praticienFromName = 'Dr ' + slashMatch[2].trim();
    }

    // Chercher aussi le praticien dans le commentaire
    var praticienFromComment = '';
    var drMatch = comment.match(/(?:DR\.?\s+|Docteur\s+)([A-Z][A-Za-zÀ-ÿ\-]+(?:\s+[A-Z][A-Za-zÀ-ÿ\-]+)?)/i);
    if (drMatch) praticienFromComment = 'Dr ' + drMatch[1].trim();

    // Aussi dans "Case Name: Cas de NOM / DR NOM"
    var caseNameMatch = comment.match(/Case Name:\s*(?:Cas de\s+)?(.+?)(?:\/\s*(?:DR\.?\s*)(.+))?$/im);
    if (caseNameMatch) {
      if (!patientName || patientName === rawPatientName) patientName = caseNameMatch[1].trim();
      if (caseNameMatch[2] && !praticienFromName) praticienFromName = 'Dr ' + caseNameMatch[2].trim();
    }

    var praticien = praticienFromName || praticienFromComment || '';

    // Cabinet
    var cabinetName = dentist.name || ofData.user_name || c.realDentist || '';

    // Mâchoire depuis cameraData
    var hasUpper = false, hasLower = false;
    cameraData.forEach(function(cam) {
      var jaw = (cam.details && cam.details.jawType) || '';
      if (jaw.includes('UPPER')) hasUpper = true;
      if (jaw.includes('LOWER')) hasLower = true;
    });
    var machoire = '';
    if (hasUpper && hasLower) machoire = 'bas+haut';
    else if (hasUpper) machoire = 'haut';
    else if (hasLower) machoire = 'bas';

    // Dents depuis priceList zones
    var dents = [];
    priceList.forEach(function(item) {
      var area = item.area || '';
      if (/^\d{2}$/.test(area)) {
        var n = parseInt(area);
        if (n >= 11 && n <= 48 && !dents.includes(n)) dents.push(n);
      }
    });

    // Teinte
    var teinte = '';
    priceList.forEach(function(item) {
      if (item.shade && !teinte) teinte = item.shade;
    });

    // Dates
    var dateEmpreinte = c.creation_date || c._receivedAt || '';
    var dateLivraison = c.globalDeadline || '';
    if (dateEmpreinte && dateEmpreinte.includes('T')) dateEmpreinte = dateEmpreinte.split('T')[0];
    if (dateLivraison && dateLivraison.includes('T')) dateLivraison = dateLivraison.split('T')[0];

    // Nettoyer le commentaire (retirer "Case Name: ..." qui est du bruit)
    var cleanComment = comment.replace(/Case Name:\s*.*/gi, '').trim();

    // Numéro prescription depuis Digilab
    var numero = c._id || c._digilabId || '';

    return {
      numero_prescription: numero,
      code_labo: '',
      raw_cabinet: cabinetName,
      raw_praticien: praticien || cabinetName,
      raw_commentaires: cleanComment,
      cabinet: cabinetName,
      code_cogilog: '',
      praticien: praticien,
      patient_nom: patientName,
      patient_age: '',
      patient_sexe: '',
      date_empreinte: dateEmpreinte,
      date_livraison: dateLivraison,
      sans_date_livraison: !dateLivraison,
      a_refaire: false,
      urgent: false,
      call_me: false,
      cas_esthetique: false,
      dents: dents,
      conjointe: [],
      adjointe: [],
      machoire: machoire,
      fraisage: '',
      piv: '',
      teinte: teinte,
      dent_extraire: '',
      commentaires: cleanComment,
      commentaires_en: '',
      dentsActes: {},
      solidGroups: []
    };
  }

  // ── Fusionner les résultats IA avec le mapping direct ──
  // L'IA prime sur les actes (conjointe/adjointe/dentsActes)
  // Le mapping direct prime sur les infos structurelles (cabinet, patient, dates)
  function _mergeIaResults(mapped, ia) {
    // Actes : l'IA prime car elle parse le commentaire
    if (ia.conjointe && ia.conjointe.length) mapped.conjointe = ia.conjointe;
    if (ia.adjointe && ia.adjointe.length) mapped.adjointe = ia.adjointe;
    if (ia.dentsActes && Object.keys(ia.dentsActes).length) mapped.dentsActes = ia.dentsActes;
    if (ia.solidGroups && ia.solidGroups.length) mapped.solidGroups = ia.solidGroups;
    if (ia.fraisage) mapped.fraisage = ia.fraisage;
    if (ia.piv) mapped.piv = ia.piv;
    if (ia.dent_extraire) mapped.dent_extraire = ia.dent_extraire;

    // Dents : fusionner (IA peut trouver des dents dans le commentaire)
    if (ia.dents && ia.dents.length) {
      ia.dents.forEach(function(d) {
        if (!mapped.dents.includes(d)) mapped.dents.push(d);
      });
    }

    // Teinte : IA complète si pas trouvée dans les données structurées
    if (!mapped.teinte && ia.teinte) mapped.teinte = ia.teinte;

    // Praticien : l'IA peut mieux matcher via la base Cogilog
    if (ia.praticien && ia.praticien !== 'Dr ???') mapped.praticien = ia.praticien;
    if (ia.cabinet) mapped.cabinet = ia.cabinet;
    if (ia.code_cogilog) mapped.code_cogilog = ia.code_cogilog;

    // Commentaires filtrés par l'IA (plus propres)
    if (ia.commentaires !== undefined) mapped.commentaires = ia.commentaires;

    // Machoire : le mapping direct est plus fiable (jawType structuré)
    // On ne laisse pas l'IA écraser sauf si le mapping n'a rien trouvé
    if (!mapped.machoire && ia.machoire) mapped.machoire = ia.machoire;
  }

  // ── Blob → DataURL ──
  function _blobToDataUrl(blob) {
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { resolve(null); };
      reader.readAsDataURL(blob);
    });
  }

  // ═══════════════════════════════════════════
  // PROCESS COMPLET (download + scan)
  // ═══════════════════════════════════════════

  window.dlbProcessCase = async function(caseId) {
    if (_processing) { showToast('Traitement en cours...'); return; }
    _processing = true;

    try {
      await window.dlbScanFiche(caseId);
    } catch (e) {
      console.error('[DIGILAB] Process error:', e);
    }

    _processing = false;
  };

  // ═══════════════════════════════════════════
  // BATCH — Traiter tous les nouveaux
  // ═══════════════════════════════════════════

  window.dlbProcessAll = async function() {
    var nouveaux = _cases.filter(function(c) { return c._status === 'nouveau'; });
    if (nouveaux.length === 0) { showToast('Aucun nouveau cas à traiter'); return; }

    if (!confirm(nouveaux.length + ' cas à traiter. Continuer ?')) return;

    var progress = document.getElementById('dlb-progress');
    if (progress) progress.style.display = 'block';

    var success = 0, errors = 0;

    for (var i = 0; i < nouveaux.length; i++) {
      var c = nouveaux[i];
      var id = c._digilabId || c._firebaseId || c._id;
      var patient = c.patient_name || 'patient';

      var bar = document.getElementById('dlb-progress-bar');
      var status = document.getElementById('dlb-progress-status');
      if (bar) bar.style.width = Math.round(((i + 1) / nouveaux.length) * 100) + '%';
      if (status) status.textContent = (i + 1) + '/' + nouveaux.length + ' — ' + patient;

      try {
        await window.dlbScanFiche(id);
        success++;
      } catch (e) {
        console.error('[DIGILAB] Batch error for', id, e);
        errors++;
      }

      // Pause entre les cas pour éviter le rate limit
      if (i < nouveaux.length - 1) {
        await new Promise(function(r) { setTimeout(r, 2000); });
      }
    }

    if (progress) progress.style.display = 'none';
    showToast(success + ' cas traité(s), ' + errors + ' erreur(s)');
  };

  // ═══════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════

  // ── Menu contextuel (clic droit) sur un cas ──
  window.dlbContextMenu = function(event, caseId) {
    // Supprimer un ancien menu s'il existe
    var old = document.getElementById('dlb-ctx-menu');
    if (old) old.remove();

    var c = _findCase(caseId);
    if (!c) return;

    var menu = document.createElement('div');
    menu.id = 'dlb-ctx-menu';
    menu.style.cssText = 'position:fixed;z-index:9999;background:white;border:1px solid #ddd;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:6px 0;min-width:200px;font-family:DM Sans,sans-serif;font-size:0.82rem;';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';

    var items = [];

    if (c._status === 'traite' || c._status === 'en_cours' || (c._status && c._status.startsWith('envoye'))) {
      items.push({ label: 'Remettre en attente', icon: '&#8634;', action: 'dlbResetCase(\'' + _esc(caseId) + '\')' });
    }
    if (c._status === 'nouveau') {
      items.push({ label: 'Tout traiter', icon: '&#9881;', action: 'dlbProcessCase(\'' + _esc(caseId) + '\')' });
    }
    items.push({ label: 'Scanner la fiche', icon: '&#128196;', action: 'dlbScanFiche(\'' + _esc(caseId) + '\')' });
    items.push({ label: 'Telecharger fichiers', icon: '&#11015;', action: 'dlbDownloadFiles(\'' + _esc(caseId) + '\')' });
    items.push({ label: 'Supprimer', icon: '&#10005;', action: 'dlbDeleteCase(\'' + _esc(caseId) + '\')', color: '#e53935' });

    items.forEach(function(item) {
      var div = document.createElement('div');
      div.style.cssText = 'padding:8px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;color:' + (item.color || '#333') + ';';
      div.innerHTML = '<span style="width:18px;text-align:center;">' + item.icon + '</span> ' + item.label;
      div.onmouseenter = function() { div.style.background = '#f5f5f5'; };
      div.onmouseleave = function() { div.style.background = 'none'; };
      div.onclick = function() { menu.remove(); eval(item.action); };
      menu.appendChild(div);
    });

    document.body.appendChild(menu);

    // Fermer au clic ailleurs
    var _closeCtx = function(e) {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', _closeCtx); }
    };
    setTimeout(function() { document.addEventListener('click', _closeCtx); }, 10);
  };

  // ── Remettre un cas traité en attente (nouveau) ──
  window.dlbResetCase = function(caseId) {
    _updateStatus(caseId, 'nouveau');
    showToast('Cas remis en attente');
  };

  window.dlbDeleteCase = function(caseId) {
    if (!confirm('Supprimer ce cas Digilab ?')) return;
    var db = window.getDB ? window.getDB() : null;
    if (db) {
      db.collection('digilab_orders').doc(caseId).delete()
        .then(function() { showToast('Cas supprime'); })
        .catch(function(e) { showToast('Erreur suppression : ' + e.message, true); });
    }
    _cases = _cases.filter(function(c) { return (c._digilabId || c._firebaseId || c._id) !== caseId; });
    _renderListe();
    if (_selectedCaseId === caseId) {
      _selectedCaseId = null;
      var detail = document.getElementById('dlb-detail');
      if (detail) detail.innerHTML = '<div style="color:#999;text-align:center;padding:60px;">Selectionnez un cas</div>';
    }
  };

  function _findCase(caseId) {
    return _cases.find(function(c) {
      return (c._digilabId || c._firebaseId || c._id) === caseId;
    });
  }

  function _buildFicheHtml(caseData) {
    var patient = caseData.patient_name || caseData.patientName || '';
    var comment = caseData.comment || '';
    var service = caseData.service || '';
    var creation = caseData.creation_date || caseData._receivedAt || '';
    var deadline = caseData.globalDeadline || '';
    var dentist = caseData.dentistName || caseData.senderEmail || '';

    return '<!DOCTYPE html><html><body>' +
      '<h1>Fiche Digilab - ' + _esc(service) + '</h1>' +
      '<p><strong>Patient :</strong> ' + _esc(patient) + '</p>' +
      '<p><strong>Praticien :</strong> ' + _esc(dentist) + '</p>' +
      '<p><strong>Service :</strong> ' + _esc(service) + '</p>' +
      (creation ? '<p><strong>Creation date:</strong> ' + _esc(creation) + '</p>' : '') +
      (deadline ? '<p><strong>Update date:</strong> ' + _esc(deadline) + '</p>' : '') +
      (comment ? '<p><strong>Commentaire :</strong> ' + _esc(comment) + '</p>' : '') +
      '</body></html>';
  }

  function _updateStatus(caseId, newStatus) {
    var db = window.getDB ? window.getDB() : null;
    if (db) {
      db.collection('digilab_orders').doc(caseId).update({
        _status: newStatus,
        _processedAt: newStatus === 'traite' ? new Date().toISOString() : null,
      }).catch(function(e) { console.warn('[DIGILAB] Status update failed:', e); });
    }
    // Mettre à jour localement aussi
    var c = _findCase(caseId);
    if (c) c._status = newStatus;
    _renderListe();
  }

  // ── Trouver la fiche originale HTML/PDF dans les fichiers du cas ──
  function _findOriginalFile(c) {
    var files = c.files || [];
    if (!files.length) return null;

    // Priorité : POF HTML > HTML > POF PDF > PDF
    var pofHtml = files.find(function(f) {
      var n = (f.name || '').toLowerCase();
      return /^pof[_\s]/i.test(n) && n.endsWith('.html') && !/^full[_\s]?pof/i.test(n);
    });
    if (pofHtml) return pofHtml;

    var anyHtml = files.find(function(f) {
      var n = (f.name || '').toLowerCase();
      return n.endsWith('.html') && !/^full[_\s]?pof/i.test(n);
    });
    if (anyHtml) return anyHtml;

    var pofPdf = files.find(function(f) {
      var n = (f.name || '').toLowerCase();
      return /^pof[_\s]/i.test(n) && n.endsWith('.pdf') && !/^full[_\s]?pof/i.test(n);
    });
    if (pofPdf) return pofPdf;

    var anyPdf = files.find(function(f) {
      var n = (f.name || '').toLowerCase();
      return n.endsWith('.pdf') && !/^full[_\s]?pof/i.test(n);
    });
    if (anyPdf) return anyPdf;

    return null;
  }

  // ── Télécharger un fichier Digilab et le convertir en base64 ──
  async function _downloadFileAsBase64(fileUrl, fileName) {
    var resp = await fetch(WORKER_URL + '/v1/digilab/proxy-file?key=' + AUTH_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fileUrl })
    });
    if (!resp.ok) throw new Error('Download failed: ' + resp.status);

    var blob = await resp.blob();
    var mimeType = blob.type || 'application/octet-stream';

    // Déterminer le mediaType pour Gemini (MIME du blob + fallback nom de fichier)
    var mediaType = 'application/octet-stream';
    var nameLower = (fileName || '').toLowerCase();
    if (mimeType.includes('html') || mimeType.includes('text') || nameLower.endsWith('.html') || nameLower.endsWith('.htm')) {
      mediaType = 'text/html';
    } else if (mimeType.includes('pdf') || nameLower.endsWith('.pdf')) {
      mediaType = 'application/pdf';
    }

    // Forcer le bon type sur le blob pour que le dataUrl ait le bon préfixe
    if (mediaType !== mimeType) {
      blob = new Blob([blob], { type: mediaType });
    }

    // Convertir en base64 via FileReader
    var dataUrl = await new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { reject(new Error('FileReader error')); };
      reader.readAsDataURL(blob);
    });

    var base64 = dataUrl.split(',')[1];
    return { base64: base64, mediaType: mediaType, dataUrl: dataUrl };
  }

  function _downloadUrl(url, filename) {
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    a.target = '_blank';
    a.click();
  }

  function _formatTime(isoStr) {
    if (!isoStr) return '';
    try { return new Date(isoStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
    catch(e) { return ''; }
  }

  function _formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      var d = new Date(isoStr);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return isoStr; }
  }

  function _esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

})();
