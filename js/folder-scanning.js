// ---- GALERIE : 1 ou plusieurs fichiers ----
function handleGalleryInput(input) {
  if (input.files.length === 1) {
    scanPrescription(input);
  } else if (input.files.length > 1) {
    scanMultiple(input);
  }
}

// ---- SCAN PAR DOSSIER (multi-dossiers) ----
var _dossierHandles = []; // via showDirectoryPicker
var _dossierEntries = []; // via drag & drop {name, files[]}

// ---- DRAG & DROP GLOBAL DOSSIERS ----
var _dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  if ([...e.dataTransfer.items].some(i => i.kind === 'file')) {
    _dragCounter++;
    document.getElementById('global-drop-overlay').classList.add('active');
  }
});
document.addEventListener('dragleave', () => {
  _dragCounter = Math.max(0, _dragCounter - 1);
  if (_dragCounter === 0) document.getElementById('global-drop-overlay').classList.remove('active');
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  _dragCounter = 0;
  document.getElementById('global-drop-overlay').classList.remove('active');
  await _traiterDrop(e.dataTransfer.items);
});

async function handleFolderDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('folder-drop-zone').classList.remove('drop-hover');
  await _traiterDrop(e.dataTransfer.items);
}

async function _traiterDrop(dtItems) {
  // ⚠️ CRITIQUE : extraire TOUTES les entries/handles IMMÉDIATEMENT
  // avant tout await — les DataTransferItems expirent après le premier await
  const items = [...dtItems].filter(i => i.kind === 'file');

  // Collecter les handles et entries en synchrone d'abord
  const handles = [];   // via getAsFileSystemHandle
  const entries = [];   // via webkitGetAsEntry (fallback)

  for (const item of items) {
    if (item.getAsFileSystemHandle) {
      try { handles.push(item.getAsFileSystemHandle()); } catch(e) {}
    }
    // Toujours collecter l'entry aussi (pour fallback si handle échoue)
    if (item.webkitGetAsEntry) {
      const e = item.webkitGetAsEntry();
      if (e) entries.push(e);
    }
  }

  // Maintenant on peut faire des awaits
  const pofFiles = [];
  let usedHandles = 0;

  // Essayer les handles d'abord (plus fiable)
  const resolvedHandles = await Promise.allSettled(handles);
  for (const result of resolvedHandles) {
    if (result.status !== 'fulfilled') continue;
    const handle = result.value;
    usedHandles++;
    try {
      if (handle.kind === 'directory') {
        for await (const entry of handle.values()) {
          if (entry.kind !== 'file') continue;
          if (_isPOF(entry.name)) {
            try {
              const file = await entry.getFile();
              pofFiles.push({ file, dirName: handle.name });
            } catch(e) {}
          }
        }
      } else if (handle.kind === 'file' && _isPOF(handle.name)) {
        const file = await handle.getFile();
        pofFiles.push({ file, dirName: '.' });
      }
    } catch(e) {
      console.warn('Erreur lecture dossier "' + (handle.name || '?') + '":', e);
    }
  }

  // Si handles n'ont rien donné, fallback webkitGetAsEntry
  if (pofFiles.length === 0 && entries.length > 0) {
    for (const entry of entries) {
      try {
        if (entry.isDirectory) {
          const files = await _readDirEntry(entry);
          files.forEach(f => { if (_isPOF(f.name)) pofFiles.push({ file: f, dirName: entry.name }); });
        } else if (entry.isFile) {
          const file = await new Promise(r => entry.file(r));
          if (_isPOF(file.name)) pofFiles.push({ file, dirName: '.' });
        }
      } catch(e) {
        console.warn('Erreur lecture entry "' + (entry.name || '?') + '":', e);
      }
    }
  }

  if (pofFiles.length === 0) {
    showToast('Aucun fichier POF/PDF/HTML trouvé dans les dossiers glissés.', true);
    return;
  }

  // Grouper par dossier
  const byDir = {};
  pofFiles.forEach(({ file, dirName }) => {
    if (!byDir[dirName]) byDir[dirName] = [];
    byDir[dirName].push(file);
  });
  Object.entries(byDir).forEach(([name, files]) => {
    _dossierEntries.push({ name, files });
  });

  document.getElementById('folder-picker-panel').style.display = 'block';
  document.getElementById('folder-progress').style.display = 'none';
  _rafraichirListeDossiers();
}

function _isPOF(name) {
  const nl = name.toLowerCase();
  if (!nl.endsWith('.html') && !nl.endsWith('.pdf')) return false;
  // PDF → tout accepté (POF, FULL_POF, et autres)
  if (nl.endsWith('.pdf')) return true;
  // HTML → seulement les fichiers commençant par "pof" mais pas "full_pof"
  if (/^full[\s_\-]?pof/i.test(name)) return false;
  return /^pof/i.test(name);
}

async function _readDirEntry(dirEntry) {
  return new Promise((resolve) => {
    const reader = dirEntry.createReader();
    const allEntries = [];
    const read = () => reader.readEntries((batch) => {
      if (!batch.length) {
        Promise.all(allEntries.map(e => new Promise(r => e.file(r)))).then(resolve);
      } else {
        batch.forEach(e => { if (e.isFile) allEntries.push(e); });
        read();
      }
    });
    read();
  });
}


async function ouvrirSelecteurDossiers() {
  _dossierHandles = [];
  _dossierEntries = [];
  document.getElementById('folder-list').innerHTML = '';
  document.getElementById('folder-summary').textContent = '';
  document.getElementById('folder-picker-panel').style.display = 'block';
  document.getElementById('folder-progress').style.display = 'none';
  _rafraichirListeDossiers();
}

async function ajouterDossier() {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    _dossierHandles.push(dirHandle);
    _rafraichirListeDossiers();
  } catch(e) {}
}



function _rafraichirListeDossiers() {
  const list = document.getElementById('folder-list');
  list.innerHTML = '';
  // Dossiers via picker
  _dossierHandles.forEach((h, i) => {
    const tag = document.createElement('span');
    tag.className = 'folder-tag folder-tag-handle';
    tag.innerHTML = `📁 ${h.name} <span class="folder-tag-remove" onclick="_retirerHandle(${i})" title="Retirer">✕</span>`;
    list.appendChild(tag);
  });
  // Dossiers via drag & drop
  _dossierEntries.forEach((e, i) => {
    const tag = document.createElement('span');
    tag.className = 'folder-tag folder-tag-entry';
    tag.innerHTML = `📂 ${e.name} (${e.files.length} POF) <span class="folder-tag-remove" onclick="_retirerEntry(${i})" title="Retirer">✕</span>`;
    list.appendChild(tag);
  });
  const total = _dossierHandles.length + _dossierEntries.length;
  document.getElementById('folder-summary').textContent = total === 0
    ? 'Glisse tes dossiers dans la zone ci-dessus ou clique + Ajouter.'
    : total + ' dossier(s) pret(s) - clique Scanner pour lancer.';
}

function _retirerHandle(i) {
  _dossierHandles.splice(i, 1);
  _rafraichirListeDossiers();
}

function _retirerDossier(i) { _retirerHandle(i); } // compat

function _retirerEntry(i) {
  _dossierEntries.splice(i, 1);
  _rafraichirListeDossiers();
}

function annulerSelecteurDossiers() {
  _dossierHandles = [];
  _dossierEntries = [];
  document.getElementById('folder-picker-panel').style.display = 'none';
}

window._scanRunning = false;
window.addEventListener('beforeunload', function(e) {
  if (window._scanRunning) {
    e.preventDefault();
    e.returnValue = 'Un scan est en cours. Quitter la page annulera le scan. Continuer ?';
    return e.returnValue;
  }
});

async function lancerScanDossiers() {
  if (_dossierHandles.length === 0 && _dossierEntries.length === 0) return;
  window._scanRunning = true;

  // Collecter tous les fichiers POF (picker + drag & drop)
  let allPofFiles = []; // [{file, dirName}]
  let totalIgnored = 0;

  // Source 1 : dossiers via showDirectoryPicker
  for (const dirHandle of _dossierHandles) {
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind !== 'file') continue;
        const name = entry.name.trim();
        const nameLower = name.toLowerCase();
        const isHtml = nameLower.endsWith('.html');
        const isPdf  = nameLower.endsWith('.pdf');
        if (!isHtml && !isPdf) { totalIgnored++; continue; }
        if (/^full[\s_\-]?pof/i.test(name)) { totalIgnored++; continue; }
        if (!/^pof/i.test(name)) { totalIgnored++; continue; }
        const file = await entry.getFile();
        allPofFiles.push({ file, dirName: dirHandle.name });
      }
    } catch(e) {
      console.warn('Erreur lecture dossier "' + (dirHandle.name || '?') + '":', e);
    }
  }

  // Source 2 : dossiers via drag & drop (fichiers déjà filtrés)
  for (const entry of _dossierEntries) {
    for (const file of entry.files) {
      allPofFiles.push({ file, dirName: entry.name });
    }
  }

  if (allPofFiles.length === 0) {
    showToast('Aucun fichier POF/PDF/HTML trouvé dans les dossiers sélectionnés.', true);
    return;
  }

  // Réserver les numéros localement (pas de transaction Firebase pour éviter 429)
  let _dossierPremierNum = nextNum;
  nextNum += allPofFiles.length;
  let _dossierNumIdx = 0; // index local pour attribuer les numéros réservés

  // Passer au panneau progression
  document.getElementById('folder-picker-panel').style.display = 'none';
  const prog = document.getElementById('folder-progress');
  prog.style.display = 'block';
  const total = allPofFiles.length;
  document.getElementById('folder-total').textContent = total;
  document.getElementById('folder-current').textContent = '0';
  document.getElementById('folder-bar').style.width = '0%';
  document.getElementById('folder-found').textContent = '';
  document.getElementById('folder-skipped').textContent = totalIgnored > 0 ? totalIgnored + ' ignoré(s)' : '';
  document.getElementById('folder-errors').textContent = '';
  document.getElementById('folder-status').textContent = 'Préparation...';

  let successCount = 0;
  let errorCount = 0;

  // ── Traitement parallèle (5 fichiers simultanés, fallback Pro→Flash via worker) ──
  const folderTasks = allPofFiles.map(({ file, dirName }, i) => {
    const _fileId = 'id_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2);
    const _fileNumIdx = _dossierNumIdx++;
    const isPDF  = file.name.toLowerCase().endsWith('.pdf');
    const isHTML = file.name.toLowerCase().endsWith('.html');

    return async () => {
      document.getElementById('folder-status').textContent = '⏳ [' + dirName + '] ' + file.name;

      let attempts = 0;
      while (true) {
        const now = Date.now();
        if (_rateLimitUntil > now) await new Promise(r => setTimeout(r, _rateLimitUntil - now));

        try {
          const _isImage = !isPDF && !isHTML;
          const _fileForScan = _isImage ? await enhanceImageForScan(file) : file;
          const _cropB64 = _isImage ? await cropTopZone(file) : null;
          const _cropCommB64 = _isImage ? await cropCommentZone(file) : null;
          const dataUrlDisplay = await fileToDataUrl(file);
          const base64  = (await fileToDataUrl(_fileForScan)).split(',')[1];
          const mediaType = isPDF ? 'application/pdf' : (isHTML ? 'text/html' : _fileForScan.type);
          const _useFallback = attempts >= 5;
          if (_useFallback && attempts === 5) console.log('[SCAN] ' + file.name + ' → fallback 2.5 Pro');
          document.getElementById('folder-status').textContent = '🤖 [' + dirName + '] ' + file.name + (attempts > 0 ? ' (retry ' + attempts + (_useFallback ? ' · 2.5' : '') + ')' : '');
          const data = await callGemini(base64, mediaType, isHTML, _useFallback, _cropB64, _cropCommB64);
          const prescription = await buildPrescriptionFromScan(data, dataUrlDisplay, data, isHTML || isPDF);
          prescription._id = _fileId;
          if (!data.numero_prescription) {
            prescription.numero = 'N° ' + (_dossierPremierNum + _fileNumIdx);
          }
          if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(prescription);
          successCount++;

          const done = successCount + errorCount;
          document.getElementById('folder-current').textContent = done;
          document.getElementById('folder-bar').style.width = Math.round((done / total) * 100) + '%';
          document.getElementById('folder-found').textContent = successCount + ' importée(s)';
          return null;
        } catch (err) {
          attempts++;
          const errMsg = err.message || '';
          const isOverload = errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('500') || errMsg.includes('524') || errMsg.includes('overloaded');
          const is400 = errMsg.includes('400');
          console.error('Erreur scan [' + file.name + '] tentative ' + attempts + ' :', errMsg);

          // 400 sur image → déjà compressée en amont, pas de retry spécial

          if (isOverload) _rateLimitUntil = Math.max(_rateLimitUntil, Date.now() + Math.min(attempts, 5) * 8000);
          const wait = Math.min(attempts * 5000, 40000);
          document.getElementById('folder-status').textContent = '⚠️ [' + file.name + '] retry ' + attempts + ' dans ' + Math.round(wait/1000) + 's...';
          await new Promise(r => setTimeout(r, wait));
        }
      }
    };
  });

  await runWithConcurrency(folderTasks, 1);

  // Fin
  document.getElementById('folder-bar').style.width = '100%';
  document.getElementById('folder-current').textContent = total;
  document.getElementById('folder-status').textContent = '✅ Terminé';
  document.getElementById('folder-found').textContent = successCount + ' prescription(s) importée(s)';

  renderList();
  showToast(successCount + ' prescription(s) importée(s) !');

  window._scanRunning = false;
  _dossierHandles = [];
  _dossierEntries = [];
  setTimeout(() => { prog.style.display = 'none'; }, 5000);
}




// Affiche n'importe quel type de fichier dans le panel (image, PDF, HTML)
async function afficherFichierDansPanel(body, dataUrl, photoType) {
  if (!dataUrl || dataUrl === '__photo__') return;
  // Token anti-race : si un autre appel arrive pendant qu'on charge, on abandonne
  const _token = Date.now() + Math.random();
  body._displayToken = _token;
  const _isStillCurrent = () => body._displayToken === _token;

  // URL Cloudinary (http/https) → image ou PDF
  if (dataUrl.startsWith('http')) {
    const urlLower = dataUrl.toLowerCase();
    const isPdf = photoType !== 'html' && (
      photoType === 'pdf'
      || urlLower.includes('.pdf')
      || (urlLower.includes('/raw/') && !urlLower.includes('.html'))
      || urlLower.includes('fl_attachment')
    );

    if (isPdf) {
      // Rendu PDF via PDF.js → canvas, contourne les restrictions CORS de Cloudinary
      body.innerHTML = `
        <div style="width:100%;height:80vh;overflow-y:auto;background:#525659;border-radius:8px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px;" id="pdfjs-container">
          <div style="font-size:0.8rem;color:#ccc;">⏳ Chargement du PDF...</div>
        </div>`;
      const container = body.querySelector('#pdfjs-container');

      // Fallback si PDF.js non disponible
      if (!window.pdfjsLib) {
        container.innerHTML = `<div style="color:#fff;font-size:0.85rem;text-align:center;">
          PDF.js non disponible — <a href="${dataUrl}" target="_blank" style="color:#7ec8e3;">ouvrir dans un nouvel onglet</a></div>`;
        return;
      }

      try {
        const loadingTask = pdfjsLib.getDocument({ url: dataUrl, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (!_isStillCurrent()) return;
        container.innerHTML = `<div style="font-size:0.75rem;color:#aaa;margin-bottom:4px;">${pdf.numPages} page(s) — <a href="${dataUrl}" target="_blank" style="color:#7ec8e3;">ouvrir dans un nouvel onglet</a></div>`;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (!_isStillCurrent()) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 3 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = 'width:100%;max-width:700px;background:white;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
          container.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
      } catch(e) {
        console.warn('PDF.js direct échoué (CORS probable) :', e.message);
        // Fallback : proxy Google Docs (contourne CORS Cloudinary)
        try {
          const proxyUrl = 'https://docs.google.com/viewer?embedded=true&url=' + encodeURIComponent(dataUrl);
          container.innerHTML = `
            <div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">
              📄 PDF — <a href="${dataUrl}" target="_blank" style="color:#7ec8e3;">ouvrir directement</a>
            </div>
            <iframe src="${proxyUrl}" style="width:100%;height:75vh;border:none;border-radius:6px;background:white;" allowfullscreen></iframe>`;
        } catch(e2) {
          container.innerHTML = `<div style="color:#ffb3b3;font-size:0.85rem;text-align:center;">
            ❌ Impossible d'afficher le PDF<br><br>
            <a href="${dataUrl}" target="_blank" style="color:#7ec8e3;">Ouvrir dans un nouvel onglet</a></div>`;
        }
      }
    } else {
      body.innerHTML = `
        <img id="preview-panel-img" src="${dataUrl}" style="width:100%;max-height:80vh;object-fit:contain;display:block;cursor:zoom-in;transition:transform 0.2s;" onclick="toggleImgZoom(this)">
        <div class="preview-zoom">
          <button onclick="zoomIn()" title="Zoom +">＋<\/button>
          <button onclick="zoomOut()" title="Zoom -">－<\/button>
          <button onclick="resetZoom()" title="Réinitialiser">⊙<\/button>
        <\/div>`;
    }
    return;
  }

  const type = dataUrl.split(';')[0].replace('data:', '');
  if (type === 'text/html') {
    try {
      const htmlContent = atob(dataUrl.split(',')[1]);
      // srcdoc au lieu de blob URL → fonctionne partout y compris HTTPS
      body.innerHTML = `<iframe srcdoc="" style="width:100%;height:80vh;border:none;background:white;"><\/iframe>`;
      body.querySelector('iframe').srcdoc = htmlContent;
    } catch(e) {
      body.innerHTML = `<div class="preview-panel-empty">❌ Impossible d'afficher ce fichier HTML<\/div>`;
    }
  } else if (type === 'application/pdf') {
    // Rendu PDF.js pour les PDFs base64 locaux aussi
    body.innerHTML = `<div style="width:100%;height:80vh;overflow-y:auto;background:#525659;border-radius:8px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px;" id="pdfjs-container-local"><div style="font-size:0.8rem;color:#ccc;">⏳ Chargement...</div></div>`;
    const cont = body.querySelector('#pdfjs-container-local');
    if (window.pdfjsLib) {
      try {
        const pdf = await pdfjsLib.getDocument({ data: atob(dataUrl.split(',')[1]) }).promise;
        if (!_isStillCurrent()) return;
        cont.innerHTML = `<div style="font-size:0.75rem;color:#aaa;">${pdf.numPages} page(s)</div>`;
        for (let n = 1; n <= pdf.numPages; n++) {
          if (!_isStillCurrent()) return;
          const page = await pdf.getPage(n);
          const vp = page.getViewport({ scale: 3 });
          const cv = document.createElement('canvas');
          cv.width = vp.width; cv.height = vp.height;
          cv.style.cssText = 'width:100%;max-width:700px;background:white;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
          cont.appendChild(cv);
          await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        }
      } catch(e) {
        cont.innerHTML = `<div style="color:#ffb3b3;">❌ Erreur affichage PDF</div>`;
      }
    } else {
      cont.innerHTML = `<embed src="${dataUrl}" type="application/pdf" class="pdf-embed">`;
    }
  } else {
    body.innerHTML = `
      <img id="preview-panel-img" src="${dataUrl}" style="width:100%;max-height:80vh;object-fit:contain;display:block;cursor:zoom-in;transition:transform 0.2s;" onclick="toggleImgZoom(this)">
      <div class="preview-zoom">
        <button onclick="zoomIn()" title="Zoom +">＋<\/button>
        <button onclick="zoomOut()" title="Zoom -">－<\/button>
        <button onclick="resetZoom()" title="Réinitialiser">⊙<\/button>
      <\/div>`;
  }
}

function updatePreviewPanel(dataUrl, file) {
  const panel = document.getElementById('preview-panel');
  const body = document.getElementById('preview-panel-body');
  const filename = document.getElementById('preview-filename');
  panel.style.display = 'block';
  panel.classList.add('visible');
  filename.textContent = file.name;
  afficherFichierDansPanel(body, dataUrl);
}

var currentZoom = 1;
function zoomIn() { currentZoom = Math.min(currentZoom + 0.25, 4); applyZoom(); }
function zoomOut() { currentZoom = Math.max(currentZoom - 0.25, 0.5); applyZoom(); }
function resetZoom() { currentZoom = 1; applyZoom(); }
function applyZoom() {
  const img = document.getElementById('preview-panel-img');
  if (img) img.style.transform = `scale(${currentZoom})`;
}
function toggleImgZoom(img) {
  currentZoom = currentZoom === 1 ? 2 : 1;
  img.style.transform = `scale(${currentZoom})`;
  img.style.cursor = currentZoom > 1 ? 'zoom-out' : 'zoom-in';
}

var previewExpanded = false;
function togglePreviewSize() {
  const panel = document.getElementById('preview-panel');
  const btn = document.getElementById('preview-size-btn');
  previewExpanded = !previewExpanded;
  if (previewExpanded) {
    panel.style.position = 'fixed';
    panel.style.top = '0';
    panel.style.right = '0';
    panel.style.width = '50vw';
    panel.style.height = '100vh';
    panel.style.zIndex = '500';
    panel.style.borderRadius = '0';
    document.getElementById('preview-panel-body').style.maxHeight = 'calc(100vh - 50px)';
    btn.textContent = '⊠ Réduire';
  } else {
    panel.style.position = 'sticky';
    panel.style.top = '20px';
    panel.style.width = '';
    panel.style.height = '';
    panel.style.zIndex = '';
    panel.style.borderRadius = '16px';
    document.getElementById('preview-panel-body').style.maxHeight = '';
    btn.textContent = '⛶ Agrandir';
  }
}

// ---- SCAN MULTIPLE ----
// ═══════════════════════════════════════════════════

async function scanMultiple(input) {
  const files = [...input.files];
  if (files.length === 0) return;
  window._scanRunning = true;

  const total = files.length;

  document.getElementById('multi-progress').style.display = 'block';
  document.getElementById('multi-total').textContent = total;
  document.getElementById('multi-errors').textContent = '';

  // Pré-réserver _id unique par fichier (anti-duplicata sur retry)
  const ts = Date.now();
  const filesMeta = files.map((file, i) => ({
    file,
    fileId: 'id_' + ts + '_' + i + '_' + Math.random().toString(36).slice(2),
    fileNum: null, // sera rempli après réservation atomique Firebase
  }));

  // Réserver les numéros localement (pas de transaction Firebase pour éviter 429)
  let premierNum = nextNum;
  nextNum += files.length;
  filesMeta.forEach((m, i) => { m.fileNum = premierNum + i; });

  // Fonction de traitement d'un fichier avec retries
  async function processFile(meta, index, maxAttempts, label) {
    const { file, fileId, fileNum } = meta;
    const isPDF = file.type === 'application/pdf';
    const isHTML = file.type === 'text/html' || file.name.endsWith('.html');
    document.getElementById('multi-current').textContent = index + 1;
    document.getElementById('multi-status').textContent = `⏳ ${label}Analyse de : ${file.name}`;
    document.getElementById('multi-bar').style.width = Math.round((index / total) * 100) + '%';

    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const now = Date.now();
        if (_rateLimitUntil > now) await new Promise(r => setTimeout(r, _rateLimitUntil - now));
        const _isImage = !isPDF && !isHTML;
        const _fileForScan = _isImage ? await enhanceImageForScan(file) : file;
        const _cropB64 = _isImage ? await cropTopZone(file) : null;
        const _cropCommB64 = _isImage ? await cropCommentZone(file) : null;
        const dataUrlOriginal = await fileToDataUrl(file); // Original pour l'affichage
        const dataUrlScan = await fileToDataUrl(_fileForScan); // Amélioré pour GPT
        const base64 = dataUrlScan.split(',')[1];
        const mediaType = isPDF ? 'application/pdf' : (isHTML ? 'text/html' : _fileForScan.type);
        const _useFallback = attempts >= 5; // après 5 échecs → passer sur 2.5
        if (_useFallback && attempts === 5) console.log('[SCAN] ' + file.name + ' → fallback 2.5 Pro');
        const data = await callGemini(base64, mediaType, isHTML, _useFallback, _cropB64, _cropCommB64);
        document.getElementById('multi-status').textContent = '🌐 Traduction : ' + file.name;
        let photoUrl = dataUrlOriginal;
        if (isHTML) {
          const imgConverti = await convertirHtmlEnImage(dataUrl);
          if (imgConverti) photoUrl = imgConverti;
        }
        const prescription = await buildPrescriptionFromScan(data, photoUrl, data, isHTML || isPDF);
        prescription._id = fileId;
        if (!data.numero_prescription) prescription.numero = 'N° ' + fileNum;
        if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(prescription);
        return null; // succès
      } catch (err) {
        attempts++;
        const errMsg = err.message || '';
        const isOverload = errMsg.includes('high demand') || errMsg.includes('overloaded') || errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('500') || errMsg.includes('524') || errMsg.includes('rate_limit');
        if (isOverload) {
          const waitMs = errMsg.startsWith('rate_limit:') ? parseInt(errMsg.split(':')[1]) : Math.min(attempts, 5) * 8000;
          _rateLimitUntil = Math.max(_rateLimitUntil, Date.now() + waitMs);
        }
        console.error('Erreur scan [' + file.name + '] tentative ' + attempts + '/' + maxAttempts + ' :', errMsg);
        if (attempts >= maxAttempts) return { meta, index }; // échec définitif
        const wait = Math.min(attempts * 5000, 40000);
        document.getElementById('multi-status').textContent = `⚠️ [${file.name}] retry ${attempts}/${maxAttempts} dans ${Math.round(wait/1000)}s...`;
        await new Promise(r => setTimeout(r, wait));
      }
    }
    return { meta, index }; // sécurité
  }

  // ── Passe 1 : traitement parallèle (2 fichiers simultanés, 5 tentatives chacun) ──
  let completed = 0;
  const tasks = filesMeta.map((meta, i) => async () => {
    const result = await processFile(meta, i, 5, '');
    completed++;
    document.getElementById('multi-current').textContent = completed;
    document.getElementById('multi-bar').style.width = Math.round((completed / total) * 100) + '%';
    return result;
  });
  const results = await runWithConcurrency(tasks, 1);
  let failed = results.filter(r => r !== null);

  // ── Passe 2 : rattrapage des échecs (concurrence 1, 5 tentatives supplémentaires) ──
  if (failed.length > 0) {
    document.getElementById('multi-status').textContent = `🔄 Rattrapage de ${failed.length} fiche(s) échouée(s)...`;
    await new Promise(r => setTimeout(r, 5000)); // courte pause avant rattrapage

    const retryTasks = failed.map((f) => async () => {
      return await processFile(f.meta, f.index, 5, '🔄 Rattrapage — ');
    });
    const retryResults = await runWithConcurrency(retryTasks, 1);
    failed = retryResults.filter(r => r !== null);
  }

  document.getElementById('multi-bar').style.width = '100%';
  document.getElementById('multi-current').textContent = total;
  const nbOk = total - failed.length;
  document.getElementById('multi-status').textContent = '✅ ' + nbOk + ' fiche(s) importée(s) avec succès !';
  if (failed.length > 0) {
    document.getElementById('multi-errors').textContent = '❌ ' + failed.length + ' fiche(s) non importée(s) : ' + failed.map(f => f.meta.file.name).join(', ');
  }

  window._scanRunning = false;
  renderList();
  showToast(nbOk + ' prescription(s) importées !' + (failed.length > 0 ? ` ⚠️ ${failed.length} échec(s)` : ''));

  input.value = '';
}
