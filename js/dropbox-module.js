// ══════════════════════════════════════════
// MODULE DROPBOX — Envoi fichiers fournisseur
// Upload prescriptions vérifiées + fichiers scan
// vers Dropbox avec lien partagé
// ══════════════════════════════════════════

(function() {
  'use strict';

  var WORKER_URL = 'https://digilab-webhook.cohenillan29.workers.dev';
  var AUTH_KEY = 'ils_webhook_2026_Sm1leL4b';

  var EMAILS_FOURNISSEURS = {
    'MERDENTAL': 'kerry@merdental.com',
    'HUILE': 'customerdata@microunion.com'
  };

  // ═══════════════════════════════════════════
  // OUVRIR LA MODALE D'ENVOI
  // ═══════════════════════════════════════════

  window.ouvrirEnvoiDropbox = function() {
    // Récupérer les prescriptions sélectionnées
    var selected = _getSelectedPrescriptions();
    if (selected.length === 0) {
      showToast('Selectionnez des prescriptions a envoyer', true);
      return;
    }

    // Charger les emails depuis les prefs Firebase
    var prefs = window._appPrefs || {};
    if (prefs.email_fournisseur_merdental) EMAILS_FOURNISSEURS.MERDENTAL = prefs.email_fournisseur_merdental;
    if (prefs.email_fournisseur_huile) EMAILS_FOURNISSEURS.HUILE = prefs.email_fournisseur_huile;

    // Créer/afficher la modale
    var existing = document.getElementById('modal-dropbox');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-dropbox';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:950;display:flex;align-items:center;justify-content:center;';

    var resumeHtml = '';
    selected.forEach(function(p) {
      var patient = (p.patient || {}).nom || p.patient_nom || '?';
      var code = p.code_labo || '';
      var hasScan = !!(p._digilabCaseId);
      resumeHtml += '<div style="padding:4px 0;font-size:0.78rem;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;">';
      resumeHtml += '  <span>' + _esc(patient) + ' <span style="color:#1a5c8a;font-weight:600;">' + _esc(code) + '</span></span>';
      resumeHtml += '  <span style="font-size:0.68rem;color:#999;">' + (hasScan ? 'PDF + Scan' : 'PDF') + '</span>';
      resumeHtml += '</div>';
    });

    // Grouper par fournisseur
    var byFournisseur = {};
    selected.forEach(function(p) {
      var f = p.fournisseur || 'INCONNU';
      if (!byFournisseur[f]) byFournisseur[f] = [];
      byFournisseur[f].push(p);
    });

    var fournisseurResume = '';
    Object.entries(byFournisseur).forEach(function(entry) {
      var f = entry[0];
      var ps = entry[1];
      var email = EMAILS_FOURNISSEURS[f] || '?';
      fournisseurResume += '<div style="background:#f8fafb;border:1px solid #e0e8ee;border-radius:8px;padding:8px 12px;margin-bottom:8px;">';
      fournisseurResume += '<strong style="color:#1a5c8a;">' + _esc(f) + '</strong> <span style="color:#999;font-size:0.72rem;">(' + ps.length + ' prescription' + (ps.length > 1 ? 's' : '') + ' → ' + _esc(email) + ')</span>';
      fournisseurResume += '</div>';
    });

    modal.innerHTML = '<div style="background:white;border-radius:16px;width:560px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.2);">' +
      '<div style="padding:16px 20px;background:linear-gradient(120deg,#e0f7fa,#e1f5fe);border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:space-between;">' +
      '  <div style="display:flex;align-items:center;gap:10px;"><span style="font-size:1.2rem;">📦</span><span style="font-weight:700;font-size:1rem;color:#1a5c8a;">Envoyer au fournisseur</span></div>' +
      '  <button onclick="document.getElementById(\'modal-dropbox\').remove()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:#999;">✕</button>' +
      '</div>' +
      '<div style="padding:20px;">' +
      '  <div style="margin-bottom:12px;">' + fournisseurResume + '</div>' +
      '  <div style="max-height:150px;overflow-y:auto;border:1px solid #eee;border-radius:10px;padding:8px 12px;margin-bottom:16px;">' + resumeHtml + '</div>' +
      '  <div id="dbx-progress" style="display:none;margin-bottom:16px;">' +
      '    <div style="display:flex;align-items:center;gap:10px;">' +
      '      <div style="flex:1;background:#e0e0e0;border-radius:4px;height:6px;overflow:hidden;">' +
      '        <div id="dbx-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#1a5c8a,#5bc4c0);border-radius:4px;transition:width 0.3s;"></div>' +
      '      </div>' +
      '      <span id="dbx-progress-status" style="font-size:0.72rem;color:#666;white-space:nowrap;">0/0</span>' +
      '    </div>' +
      '    <div id="dbx-progress-detail" style="font-size:0.72rem;color:#999;margin-top:4px;"></div>' +
      '  </div>' +
      '  <div id="dbx-result" style="display:none;margin-bottom:16px;"></div>' +
      '  <div style="background:#fff8e1;border:1px solid #fff176;border-radius:10px;padding:12px;margin-bottom:16px;font-size:0.78rem;color:#f57f17;">' +
      '    <strong>Etape 1 :</strong> Telechargez le ZIP.<br>' +
      '    <strong>Etape 2 :</strong> Ouvrez WeTransfer et glissez le ZIP dedans.' +
      '  </div>' +
      '  <div style="display:flex;gap:8px;">' +
      '    <button id="dbx-download-btn" onclick="window._dbxTelechargerZip()" style="flex:1;background:#fff3e0;color:#e65100;border:1px solid #ffcc80;border-radius:10px;padding:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">1. Telecharger</button>' +
      '    <button id="dbx-send-btn" onclick="window._ouvrirWeTransfer()" style="flex:1;background:linear-gradient(120deg,#409cff,#6bc5f8);color:white;border:none;border-radius:10px;padding:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">2. Ouvrir WeTransfer</button>' +
      '  </div>' +
      '  <div style="margin-top:8px;text-align:right;">' +
      '    <button onclick="document.getElementById(\'modal-dropbox\').remove()" style="background:none;border:none;color:#999;font-size:0.78rem;cursor:pointer;text-decoration:underline;">Annuler</button>' +
      '  </div>' +
      '</div></div>';

    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  };

  // ═══════════════════════════════════════════
  // ÉTAPE 1 : TÉLÉCHARGER ZIP POUR VÉRIFICATION
  // ═══════════════════════════════════════════

  window._dbxTelechargerZip = async function() {
    var selected = _getSelectedPrescriptions();
    if (selected.length === 0) return;

    var dlBtn = document.getElementById('dbx-download-btn');
    if (dlBtn) { dlBtn.disabled = true; dlBtn.textContent = 'Preparation...'; }

    var progress = document.getElementById('dbx-progress');
    if (progress) progress.style.display = 'block';

    try {
      var zip = new JSZip();
      var total = selected.length;

      // Grouper par fournisseur
      var byFournisseur = {};
      selected.forEach(function(p) {
        var f = p.fournisseur || 'AUTRE';
        if (!byFournisseur[f]) byFournisseur[f] = [];
        byFournisseur[f].push(p);
      });

      var done = 0;
      for (var fournisseur in byFournisseur) {
        var prescriptions = byFournisseur[fournisseur];
        var fFolder = zip.folder(fournisseur);

        for (var i = 0; i < prescriptions.length; i++) {
          var p = prescriptions[i];
          var patient = ((p.patient || {}).nom || p.patient_nom || 'PATIENT').toUpperCase().replace(/[^A-Z0-9]/g, '_');
          var code = (p.code_labo || '').replace(/[^A-Za-z0-9]/g, '');
          var subName = (code ? code + '_' : '') + patient;

          done++;
          _dbxProgress(done / total, done + '/' + total);
          _dbxStatus('PDF ' + patient + '...');

          var sub = fFolder.folder(subName);

          // Générer le PDF anglais
          try {
            var commentEN = '';
            var commField = p.commentaires || '';
            var enMatch = commField.match(/--- EN ---\n?([\s\S]*)/);
            if (enMatch) commentEN = enMatch[1].trim();

            var doc = await buildPDFAnglaisDoc(p, commentEN);
            var pdfBuffer = doc.output('arraybuffer');
            sub.file((code || 'RX') + '_' + patient + '.pdf', pdfBuffer);
          } catch (e) {
            console.error('[DROPBOX] PDF error for', patient, e);
          }

          // Fichiers scan Digilab (si disponibles)
          var digilabId = p._digilabCaseId;
          console.log('[DROPBOX] Patient:', patient, 'digilabId:', digilabId);
          if (digilabId) {
            try {
              await _addDigilabFilesToZip(digilabId, sub);
              _dbxStatus('Scan files ' + patient + '...');
            } catch (e) {
              console.error('[DROPBOX] Scan files error', e);
            }
          }
        }
      }

      // Générer et télécharger le ZIP
      _dbxStatus('Generation du ZIP...');
      var dateStr = new Date().toISOString().split('T')[0];

      var allCodes = selected.map(function(p) { return (p.code_labo || '').replace(/[^A-Za-z0-9]/g, ''); }).filter(Boolean);
      var zipName = allCodes.length >= 2 ? allCodes[0] + '-' + allCodes[allCodes.length - 1] : (allCodes[0] || 'envoi');

      var zipBlob = await zip.generateAsync({ type: 'blob' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = zipName + '.zip';
      a.click();
      URL.revokeObjectURL(a.href);

      if (progress) progress.style.display = 'none';
      if (dlBtn) { dlBtn.textContent = 'ZIP telecharge !'; dlBtn.style.background = '#e8f5e9'; dlBtn.style.color = '#2e7d32'; }

      showToast('ZIP telecharge !');

    } catch (e) {
      console.error('[DROPBOX] ZIP error:', e);
      showToast('Erreur generation ZIP : ' + e.message, true);
      if (dlBtn) { dlBtn.disabled = false; dlBtn.textContent = '1. Telecharger'; }
      if (progress) progress.style.display = 'none';
    }
  };

  // ═══════════════════════════════════════════
  // ÉTAPE 2 : OUVRIR WETRANSFER
  // ═══════════════════════════════════════════

  window._ouvrirWeTransfer = function() {
    window.open('https://wetransfer.com/', '_blank', 'width=900,height=700,menubar=no,toolbar=no,location=no,status=no');
  };

  // Ajouter les fichiers scan Digilab dans un folder JSZip
  // Priorité : Dropbox staging (sauvegardé au webhook) > URLs Digilab (peut être expiré)
  async function _addDigilabFilesToZip(caseId, zipFolder) {
    console.log('[DROPBOX] _addDigilabFilesToZip called for caseId:', caseId);
    var db = window.getDB ? window.getDB() : null;
    if (!db) { console.log('[DROPBOX] No DB'); return; }

    var docSnap = await db.collection('digilab_orders').doc(caseId).get();
    if (!docSnap.exists) { console.log('[DROPBOX] Case not found in Firebase:', caseId); return; }

    var caseData = docSnap.data();
    var stagingPath = caseData._dropboxStagingPath || '';
    console.log('[DROPBOX] stagingPath:', stagingPath);

    // MÉTHODE 1 : depuis Dropbox staging (fiable)
    if (stagingPath) {
      try {
        var listResp = await fetch(WORKER_URL + '/v1/dropbox/list-folder?key=' + AUTH_KEY, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: stagingPath })
        });
        if (listResp.ok) {
          var listData = await listResp.json();
          var entries = listData.entries || [];

          // Prendre le premier ZIP _scan et le dézipper
          var scanZip = entries.find(function(e) { return e['.tag'] === 'file' && /_scan\.zip$/i.test(e.name); });
          if (!scanZip) scanZip = entries.find(function(e) { return e['.tag'] === 'file' && e.name.endsWith('.zip'); });

          if (scanZip) {
            try {
              var dlResp = await fetch(WORKER_URL + '/v1/dropbox/download?key=' + AUTH_KEY, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: scanZip.path_lower || scanZip.path_display })
              });
              if (dlResp.ok) {
                var zipBlob = await dlResp.blob();
                var innerZip = await JSZip.loadAsync(zipBlob);
                var count = 0;
                var promises = [];
                innerZip.forEach(function(path, entry) {
                  if (entry.dir) return;
                  var name = path.split('/').pop();
                  promises.push(entry.async('blob').then(function(b) {
                    zipFolder.file(name, b);
                    count++;
                    console.log('[DROPBOX] Extracted:', name, Math.round(b.size / 1024) + 'KB');
                  }));
                });
                await Promise.all(promises);
                console.log('[DROPBOX] Extracted', count, 'files from', scanZip.name);
              }
            } catch (e) { console.warn('[DROPBOX] ZIP extract error:', e.message); }
          } else {
            // Pas de ZIP → prendre les fichiers individuels (sans les .zip)
            for (var i = 0; i < entries.length; i++) {
              var entry = entries[i];
              if (entry['.tag'] !== 'file') continue;
              if (entry.name.endsWith('.zip')) continue;
              try {
                var dlResp2 = await fetch(WORKER_URL + '/v1/dropbox/download?key=' + AUTH_KEY, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: entry.path_lower || entry.path_display })
                });
                if (dlResp2.ok) {
                  var blob = await dlResp2.blob();
                  zipFolder.file(entry.name, blob);
                }
              } catch (e) { console.warn('[DROPBOX] Skip:', entry.name); }
            }
          }
          return;
        }
      } catch (e) { console.warn('[DROPBOX] Staging fallback:', e.message); }
    }

    // MÉTHODE 2 : fallback URLs Digilab
    var files = caseData.files || [];
    var service = (caseData.service || '').toLowerCase();
    var needsFilter = ['medit', 'dscore2', 'shining3d'].some(function(s) { return service.includes(s); });

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var name = (f.name || '').split('/').pop();
      if (needsFilter && /^(POF_|FULL_POF_)/i.test(name)) continue;
      if (!f.url) continue;
      if (name.endsWith('.zip') && files.some(function(ff) { return ff.name && /\.(ply|stl|obj|dcm)$/i.test(ff.name); })) continue;

      try {
        var resp = await fetch(WORKER_URL + '/v1/digilab/proxy-file?key=' + AUTH_KEY, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: f.url })
        });
        if (resp.ok) {
          var blob = await resp.blob();
          zipFolder.file(name, blob);
        }
      } catch (e) { console.warn('[DROPBOX] Skip:', name); }
    }
  }

  // ═══════════════════════════════════════════
  // ÉTAPE 2 : CONFIRMER ENVOI DROPBOX
  // ═══════════════════════════════════════════

  window._dbxLancerEnvoi = async function() {
    var selected = _getSelectedPrescriptions();
    if (selected.length === 0) return;

    var sendBtn = document.getElementById('dbx-send-btn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Envoi en cours...'; }

    var progress = document.getElementById('dbx-progress');
    if (progress) progress.style.display = 'block';

    var prefs = window._appPrefs || {};
    var now = new Date();
    var dateStr = now.toISOString().split('T')[0];

    // Grouper par fournisseur
    var byFournisseur = {};
    selected.forEach(function(p) {
      var f = p.fournisseur || 'AUTRE';
      if (!byFournisseur[f]) byFournisseur[f] = [];
      byFournisseur[f].push(p);
    });

    var allLinks = [];
    var totalDone = 0;
    var totalCount = selected.length;

    try {
      for (var fournisseur in byFournisseur) {
        var prescriptions = byFournisseur[fournisseur];
        var fCodes = prescriptions.map(function(p) { return (p.code_labo || '').replace(/[^A-Za-z0-9]/g, ''); }).filter(Boolean);
        var folderName = fCodes.length >= 2 ? fCodes[0] + '-' + fCodes[fCodes.length - 1] : (fCodes[0] || dateStr + '_' + fournisseur);
        var basePath = '/ILoveSmile/ENVOIS/' + folderName;
        var email = prefs['email_fournisseur_' + fournisseur.toLowerCase()] || EMAILS_FOURNISSEURS[fournisseur] || '';

        _dbxStatus('Creation dossier ' + fournisseur + '...');
        await _dbxCreateFolder(basePath);

        for (var i = 0; i < prescriptions.length; i++) {
          var p = prescriptions[i];
          var patient = ((p.patient || {}).nom || p.patient_nom || 'PATIENT').toUpperCase().replace(/[^A-Z0-9]/g, '_');
          var code = (p.code_labo || '').replace(/[^A-Za-z0-9]/g, '');
          var subName = (code ? code + '_' : '') + patient;
          var subPath = basePath + '/' + subName;

          totalDone++;
          _dbxProgress(totalDone / totalCount, totalDone + '/' + totalCount);
          _dbxStatus('Upload ' + fournisseur + ' — ' + (p.patient || {}).nom);

          await _dbxCreateFolder(subPath);

          // Upload PDF anglais
          try {
            var commentEN = '';
            var commField = p.commentaires || '';
            var enMatch = commField.match(/--- EN ---\n?([\s\S]*)/);
            if (enMatch) commentEN = enMatch[1].trim();

            var doc = await buildPDFAnglaisDoc(p, commentEN);
            var pdfBuffer = doc.output('arraybuffer');
            await _dbxUploadFile(subPath + '/' + (code || 'RX') + '_' + patient + '.pdf', pdfBuffer);
          } catch (e) {
            console.error('[DROPBOX] PDF upload error', e);
          }

          // Upload fichiers scan Digilab
          var digilabId2 = p._digilabCaseId;
          if (digilabId2) {
            try {
              await _dbxUploadDigilabFiles(digilabId2, subPath, fournisseur);
            } catch (e) {
              console.error('[DROPBOX] Scan upload error', e);
            }
          }
        }

        // Créer lien partagé pour ce fournisseur
        _dbxStatus('Lien partage ' + fournisseur + '...');
        var shareResult = await _dbxShare(basePath);
        var shareUrl = shareResult.url || '';

        allLinks.push({ fournisseur: fournisseur, email: email, url: shareUrl, count: prescriptions.length, folderName: folderName });

        // Marquer les prescriptions + cas Digilab
        for (var j = 0; j < prescriptions.length; j++) {
          prescriptions[j].dropbox_envoye = true;
          prescriptions[j].dropbox_date = now.toISOString();
          prescriptions[j].dropbox_fournisseur = fournisseur;
          prescriptions[j].dropbox_lien = shareUrl;
          prescriptions[j].statut = 'importe';
          if (window.sauvegarderUnePrescription) {
            window.sauvegarderUnePrescription(prescriptions[j]);
          }
          // Mettre à jour le cas Digilab
          if (prescriptions[j]._digilabCaseId) {
            var _dlbDb = window.getDB ? window.getDB() : null;
            if (_dlbDb) {
              _dlbDb.collection('digilab_orders').doc(prescriptions[j]._digilabCaseId).update({
                _status: 'envoye_' + fournisseur.toLowerCase(),
                _dropboxLien: shareUrl,
                _dropboxDate: now.toISOString(),
              }).catch(function(e) { console.warn('[DROPBOX] Digilab status update error', e); });
            }
          }
        }
      }

      // Partager les dossiers par email via Dropbox
      for (var li = 0; li < allLinks.length; li++) {
        var link = allLinks[li];
        if (link.email && link.folderName) {
          _dbxStatus('Partage avec ' + link.email + '...');
          try {
            await _dbxShareByEmail(link.folderName, link.email);
            console.log('[DROPBOX] Dossier partage avec', link.email);
          } catch (e) {
            console.warn('[DROPBOX] Partage email error:', e.message);
          }
        }
      }

      // Afficher les résultats
      var resultEl = document.getElementById('dbx-result');
      if (resultEl) {
        var resHtml = '<div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:10px;padding:14px;">';
        resHtml += '<div style="font-weight:700;color:#2e7d32;margin-bottom:8px;">Envoi termine !</div>';
        allLinks.forEach(function(link) {
          resHtml += '<div style="margin-bottom:8px;padding:8px;background:white;border-radius:8px;border:1px solid #e0e0e0;">';
          resHtml += '<strong style="color:#1a5c8a;">' + link.fournisseur + '</strong> — ' + link.count + ' prescription(s)<br>';
          if (link.url) {
            resHtml += '<a href="' + _esc(link.url) + '" target="_blank" style="color:#1a5c8a;font-size:0.78rem;">Ouvrir Dropbox</a>';
            resHtml += ' <button onclick="navigator.clipboard.writeText(\'' + _esc(link.url) + '\');showToast(\'Lien copie !\')" style="background:#e3f2fd;border:1px solid #90caf9;border-radius:6px;padding:2px 8px;font-size:0.68rem;cursor:pointer;margin-left:4px;">Copier</button>';
          }
          if (link.email) {
            resHtml += '<div style="font-size:0.72rem;color:#2e7d32;margin-top:4px;">Email envoye a : <strong>' + _esc(link.email) + '</strong></div>';
          }
          resHtml += '</div>';
        });
        resHtml += '</div>';
        resultEl.style.display = 'block';
        resultEl.innerHTML = resHtml;
      }

      if (progress) progress.style.display = 'none';
      if (sendBtn) { sendBtn.textContent = 'Envoye !'; sendBtn.style.background = '#2e7d32'; sendBtn.style.color = 'white'; }
      showToast(totalCount + ' prescription(s) envoyee(s) sur Dropbox');
      if (typeof renderList === 'function') renderList();

    } catch (e) {
      console.error('[DROPBOX] Error:', e);
      showToast('Erreur Dropbox : ' + e.message, true);
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '2. Confirmer envoi Dropbox'; }
      if (progress) progress.style.display = 'none';
    }
  };

  // ═══════════════════════════════════════════
  // HELPERS API DROPBOX (via Worker proxy)
  // ═══════════════════════════════════════════

  async function _dbxCreateFolder(path) {
    var resp = await fetch(WORKER_URL + '/v1/dropbox/create-folder?key=' + AUTH_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path })
    });
    // 409 = folder already exists → OK
    if (resp.status === 409 || resp.ok) return true;
    var data = await resp.text();
    console.warn('[DROPBOX] Create folder:', path, resp.status, data);
    return true; // continue anyway
  }

  async function _dbxUploadFile(path, arrayBuffer) {
    var resp = await fetch(WORKER_URL + '/v1/dropbox/upload?key=' + AUTH_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: path, mode: 'add', autorename: true, mute: true })
      },
      body: arrayBuffer
    });
    if (!resp.ok) {
      var err = await resp.text();
      throw new Error('Upload failed: ' + resp.status + ' ' + err);
    }
    return resp.json();
  }

  async function _dbxUploadFromUrl(fileUrl, dropboxPath) {
    var resp = await fetch(WORKER_URL + '/v1/dropbox/upload-from-url?key=' + AUTH_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fileUrl, path: dropboxPath })
    });
    if (!resp.ok) {
      var err = await resp.text();
      console.warn('[DROPBOX] Upload from URL failed:', dropboxPath, err);
      return null;
    }
    return resp.json();
  }

  async function _dbxShare(path) {
    var resp = await fetch(WORKER_URL + '/v1/dropbox/share?key=' + AUTH_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path })
    });
    return resp.json();
  }

  async function _dbxShareByEmail(folderPath, email) {
    var resp = await fetch(WORKER_URL + '/v1/dropbox/share-email?key=' + AUTH_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/ILoveSmile/ENVOIS/' + folderPath, email: email })
    });
    return resp.json();
  }

  // Upload les fichiers scan Digilab vers Dropbox (copie depuis staging ou URLs)
  async function _dbxUploadDigilabFiles(caseId, subPath, fournisseur) {
    var db = window.getDB ? window.getDB() : null;
    if (!db) return;

    var docSnap = await db.collection('digilab_orders').doc(caseId).get();
    if (!docSnap.exists) return;

    var caseData = docSnap.data();
    var stagingPath = caseData._dropboxStagingPath || '';

    // MÉTHODE 1 : copier depuis Dropbox staging vers le dossier final
    if (stagingPath) {
      try {
        var listResp = await fetch(WORKER_URL + '/v1/dropbox/list-folder?key=' + AUTH_KEY, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: stagingPath })
        });
        if (listResp.ok) {
          var listData = await listResp.json();
          var entries = listData.entries || [];
          for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (entry['.tag'] !== 'file') continue;
            // Copier le fichier staging → dossier fournisseur
            await fetch(WORKER_URL + '/v1/dropbox/copy?key=' + AUTH_KEY, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: entry.path_lower, to: subPath + '/' + entry.name })
            });
            console.log('[DROPBOX] Copié staging → final:', entry.name);
          }
          return;
        }
      } catch (e) { console.warn('[DROPBOX] Copy staging error:', e.message); }
    }

    // MÉTHODE 2 : fallback URLs Digilab
    var files = caseData.files || [];
    var service = (caseData.service || '').toLowerCase();
    var needsFilter = ['medit', 'dscore2', 'shining3d'].some(function(s) { return service.includes(s); });

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var name = (f.name || '').split('/').pop();
      if (needsFilter && /^(POF_|FULL_POF_)/i.test(name)) continue;
      if (!f.url) continue;
      await _dbxUploadFromUrl(f.url, subPath + '/' + name);
    }
  }

  // ═══════════════════════════════════════════
  // HELPERS UI
  // ═══════════════════════════════════════════

  function _getSelectedPrescriptions() {
    return [...document.querySelectorAll('.prescription-cb:checked')]
      .map(function(cb) { return (window.prescriptions || [])[parseInt(cb.dataset.index)]; })
      .filter(Boolean);
  }

  function _dbxProgress(ratio, text) {
    var bar = document.getElementById('dbx-progress-bar');
    var status = document.getElementById('dbx-progress-status');
    if (bar) bar.style.width = Math.round(ratio * 100) + '%';
    if (status) status.textContent = text;
  }

  function _dbxStatus(text) {
    var el = document.getElementById('dbx-progress-detail');
    if (el) el.textContent = text;
  }

  function _esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

})();
