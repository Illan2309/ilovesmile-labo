// ═══════════════════════════════════════════════════════

// Helper encodage sûr pour les attributs onclick (encodeURIComponent ne encode pas l'apostrophe)
// DONNÉES TARIFS

var GROUPES_ACTES = {
  'Prothèses Fixes':['1-CCM','1-CCEMAX','1-CCZI','1-CCZIF','3-CCCOULE','CCCP','3-CCRICH','CIV','1-OE','1-OCO','FE'],
  'Accessoires Fixes':['3-AIEMAX','3-AIZIR','3-AIR','3-AIME','3-CERG','3-DP','DPROV','DM','EC','1-ICCER','1-IC','CL','2-CCMI','2-CCMIT','5-ANALO','PIU','1-PEI','1-CIRE','TAQUET','2-CHR','CP'],
  'Prothèses Mobiles':['STPN','1-STFDC','STVAL','2-COMPL','2-COMPLV','1-VALPLAST','1-PAP1','9-10D','4-BACK','PDH','MED'],
  'Gouttières':['1-GOB','1-GOBL','1-GORD','1GORO','GOBO','CLER','CLES','CLEP'],
  'Crochets & Renforts':['CRAC','CRM','GM','4-ATTM'],
  'Prestations':['6-WAXUP','FS','CM','FR','SDRE','RE','REP','RM','RA','GCH','FILC'],
};

// Tarifs modifiables (copie locale, sauvegardée dans localStorage)
// Tarifs : initialisés depuis TARIFS_BASE, mis à jour depuis Firebase au chargement
// Tarifs : TARIFS_BASE comme défaut, surcharges éditables en mémoire + Firebase
var TARIFS = JSON.parse(JSON.stringify(TARIFS_BASE));
var tarifsSelectedCabinet = Object.keys(TARIFS)[0];
var tarifsSelectedCabinets = [tarifsSelectedCabinet];

var MAPPING_CONTACTS_TARIFS = Object.assign({}, MAPPING_CONTACTS_TARIFS_DEFAULT);

// Résoudre la clé TARIFS pour un cabinet contact
function getTarifKey(contactCab) {
  if (!contactCab) return null;
  const _nfk = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const cab = _nfk(contactCab);
  // 1. Mapping explicite contacts → grille (avec normalisation Unicode)
  let mapped = MAPPING_CONTACTS_TARIFS[contactCab];
  if (!mapped) mapped = Object.keys(MAPPING_CONTACTS_TARIFS).find(k => _nfk(k) === cab);
  if (mapped) {
    const mk = mapped.constructor === String ? mapped : mapped;
    if (TARIFS_BASE[mk]) return mk;
    const tkf = Object.keys(TARIFS_BASE).find(k => _nfk(k) === _nfk(mk));
    if (tkf) return tkf;
  }
  // 2. Mapping direct par code Cogilog (ex: BROC01 → "BROCA")
  const byCode = MAPPING_CODE_TARIFS[contactCab];
  if (byCode && TARIFS_BASE[byCode]) return byCode;
  // 3. Le nom EST directement une clé TARIFS_BASE
  if (TARIFS_BASE[contactCab]) return contactCab;
  const directKey = Object.keys(TARIFS_BASE).find(k => _nfk(k) === cab);
  if (directKey) return directKey;
  // 4. Normalisation fuzzy (fallback)
  const norm = s => _nfk(s).toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
  const n = norm(contactCab);
  const key = Object.keys(TARIFS_BASE).find(k => norm(k) === n)
           || Object.keys(TARIFS_BASE).find(k => n.startsWith(norm(k)) && norm(k).length > 4);
  return key || null;
}

// ═══════════════════════════════════════════════════════
// GESTION CLIENTS — interface unifiée Contacts + Tarifs
// ═══════════════════════════════════════════════════════
var CONTACTS = JSON.parse(JSON.stringify(window.CONTACTS_DENTISTES || {}));
var gcCabinetSelectionne = null;
var gcTabActif = 'contacts';

function gcSwitchTab(tab) {
  gcTabActif = tab;
  const panC = document.getElementById('gc-panel-contacts');
  const panT = document.getElementById('gc-panel-tarifs');
  const btnC = document.getElementById('gc-tab-contacts-btn');
  const btnT = document.getElementById('gc-tab-tarifs-btn');
  const actC = document.getElementById('gc-actions-contacts');
  const actT = document.getElementById('gc-actions-tarifs');

  [panC, panT].forEach(p => { if(p) p.style.display = 'none'; });
  [btnC, btnT].forEach(b => { if(b) { b.style.background = 'transparent'; b.style.color = '#666'; }});
  [actC, actT].forEach(a => { if(a) a.style.display = 'none'; });

  if (tab === 'contacts') {
    panC.style.display = 'block';
    btnC.style.background = 'white'; btnC.style.color = '#1a5c8a';
    actC.style.display = 'flex';
    renderContactsEditor();
  } else if (tab === 'tarifs') {
    panT.style.display = 'flex';
    btnT.style.background = 'white'; btnT.style.color = '#1a5c8a';
    actT.style.display = 'flex';
    if (gcCabinetSelectionne) {
      const tk = getTarifKey(gcCabinetSelectionne);
      tarifsSelectedCabinet = tk || gcCabinetSelectionne;
      tarifsSelectedCabinets = tk ? [tk] : [];
    }
    const selGroupe = document.getElementById('tarif-groupe');
    if (selGroupe && selGroupe.options.length <= 1) {
      Object.keys(GROUPES_ACTES).forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g;
        selGroupe.appendChild(opt);
      });
    }
    gcRenderTarifsPanel();
  } else if (tab === 'grilles') {
    panG.style.display = 'flex';
    btnG.style.background = 'white'; btnG.style.color = '#1a5c8a';
    actG.style.display = 'flex';
    requestAnimationFrame(() => gcRenderGrilles());
  }
}

function filtrerCabinetsGC() {
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}


// ═══════════════════════════════════════════════════════
// SYSTÈME DE GROUPES CABINETS
// Structure Firebase : meta/gc_groupes → { "Grandental": ["GRANDENTAL PARIS 17 CLICHY", ...], ... }
// ═══════════════════════════════════════════════════════
window._gcGroupes = {};           // { nomGroupe: [cab1, cab2, ...] }
window._gcGroupesOuverts = {};    // { nomGroupe: true/false }

async function gcChargerGroupes() {
  const db = getDB();
  if (!db) return;
  try {
    const [docGroupes, docOrdre] = await Promise.all([
      db.collection('meta').doc('gc_groupes').get(),
      db.collection('meta').doc('gc_groupes_ordre').get()
    ]);
    if (docGroupes.exists) {
      window._gcGroupes = docGroupes.data() || {};
      Object.keys(window._gcGroupes).forEach(g => {
        if (window._gcGroupesOuverts[g] === undefined) window._gcGroupesOuverts[g] = true;
      });
    }
    if (docOrdre.exists && docOrdre.data().ordre) {
      window._gcGroupesOrdre = docOrdre.data().ordre;
    } else {
      window._gcGroupesOrdre = Object.keys(window._gcGroupes).sort((a,b) => a.localeCompare(b,'fr'));
    }
  } catch(e) { console.warn('Groupes non chargés:', e); }
}

async function gcSauvegarderGroupes() {
  const db = getDB();
  if (!db) return;
  try {
    await db.collection('meta').doc('gc_groupes').set(window._gcGroupes);
  } catch(e) { showToast('Erreur sauvegarde groupes', true); }
}

function gcToggleGroupe(nom) {
  window._gcGroupesOuverts[nom] = !window._gcGroupesOuverts[nom];
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function gcConstruireListeAvecGroupes(cabinets, filtre) {
  const list = document.getElementById('gc-cabinet-list');
  if (!list) return;
  const _nAcc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const hasTarifFn = cab => !!(getTarifKey(cab));

  const itemHTML = (cab) => {
    const hasTarif = hasTarifFn(cab);
    const statut = (window._gcStatuts || {})[cab] || 'actif';
    const statutDot = statut === 'inactif' ? '🔴' : '🟢';
    const sel = cab === gcCabinetSelectionne;
    return `<div class="gc-list-item${sel ? ' selected' : ''}" onclick="gcSelectionner(decodeURIComponent('${_enc(cab)}'))">
      <span class="gc-list-item-name">${statutDot} ${cab}</span>
      <span class="gc-list-item-badges">${hasTarif ? '<span class="gc-badge-tarif">💰</span>' : ''}</span>
    </div>`;
  };

  // Cabinets déjà dans un groupe
  const cabsEnGroupe = new Set(Object.values(window._gcGroupes).flat().map(c => _nAcc(c)));

  // Si recherche active → afficher tout à plat sans groupes
  if (filtre) {
    list.innerHTML = cabinets.map(itemHTML).join('');
    return;
  }

  let html = '';

  // 1. Groupes définis
  // Respecter l'ordre personnalisé, sinon alphabétique
  const ordreGroupe = window._gcGroupesOrdre || Object.keys(window._gcGroupes).sort((a,b) => a.localeCompare(b,'fr'));
  const groupesActifs = ordreGroupe
    .filter(nom => window._gcGroupes[nom] && window._gcGroupes[nom].length > 0)
    .map(nom => [nom, window._gcGroupes[nom]]);
  groupesActifs.forEach(([nom, cabsGroupe]) => {
    const ouvert = window._gcGroupesOuverts[nom] !== false;
    const cabsFiltrees = cabsGroupe.filter(c => cabinets.some(cb => _nAcc(cb) === _nAcc(c)));
    if (!cabsFiltrees.length) return;
    html += `<div style="margin:4px 0 2px;">
      <div onclick="gcToggleGroupe(decodeURIComponent('${_enc(nom)}'));" style="display:flex;align-items:center;gap:5px;padding:4px 8px;cursor:pointer;border-radius:7px;background:#e8f0fe;user-select:none;">
        <span style="font-size:0.7rem;color:#1a5c8a;transition:transform 0.15s;display:inline-block;transform:rotate(${ouvert?'90':'0'}deg);">▶</span>
        <span style="font-size:0.72rem;font-weight:700;color:#1a5c8a;flex:1;">${nom}</span>
        <span style="font-size:0.65rem;color:#5c8abf;background:#c8daf8;border-radius:10px;padding:1px 6px;">${cabsFiltrees.length}</span>
      </div>
      ${ouvert ? `<div style="padding-left:8px;border-left:2px solid #c8daf8;margin-left:10px;">${cabsFiltrees.map(c => {
        const cb = cabinets.find(x => _nAcc(x) === _nAcc(c)) || c;
        return itemHTML(cb);
      }).join('')}</div>` : ''}
    </div>`;
  });

  // 2. Cabinets sans groupe
  const sansGroupe = cabinets.filter(c => !cabsEnGroupe.has(_nAcc(c)));
  if (sansGroupe.length) {
    if (groupesActifs.length) {
      html += `<div style="font-size:0.65rem;color:#aaa;padding:6px 8px 2px;text-transform:uppercase;letter-spacing:0.5px;">Autres</div>`;
    }
    html += sansGroupe.map(itemHTML).join('');
  }

  list.innerHTML = html;
}

// ── Modal gestion des groupes ──
function gcOuvrirGroupes() {
  const existing = document.getElementById('popup-gc-groupes');
  if (existing) { existing.remove(); return; }

  const _nAcc = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // Ordre des groupes (persisté séparément pour le drag)
  if (!window._gcGroupesOrdre) {
    window._gcGroupesOrdre = Object.keys(window._gcGroupes).sort((a,b) => a.localeCompare(b,'fr'));
  }

  // Construire liste tous cabinets
  const cabMap = new Map();
  for (const k of Object.keys(CONTACTS)) cabMap.set(_nAcc(k), k);
  if (typeof COGILOG_CLIENTS !== 'undefined') {
    for (const [,data] of Object.entries(COGILOG_CLIENTS)) {
      const nom = data[3] || '';
      if (nom && !cabMap.has(_nAcc(nom))) cabMap.set(_nAcc(nom), nom);
    }
  }
  const tousCabinets = [...cabMap.values()].sort((a,b) => a.localeCompare(b,'fr'));

  function getOrdre() {
    // Synchroniser l'ordre avec les clés existantes
    const keys = Object.keys(window._gcGroupes);
    window._gcGroupesOrdre = (window._gcGroupesOrdre || [])
      .filter(k => keys.includes(k))
      .concat(keys.filter(k => !(window._gcGroupesOrdre||[]).includes(k)));
    return window._gcGroupesOrdre;
  }

  function renderGroupesModal() {
    const content = document.getElementById('gc-groupes-content');
    if (!content) return;
    const ordre = getOrdre();

    let html = '';
    ordre.forEach((nom, idx) => {
      const cabs = window._gcGroupes[nom] || [];
      const selId = 'gc-add-sel-' + idx;
      html += `<div class="gc-groupe-row" draggable="true" data-groupe="${nom.replace(/"/g,'&quot;')}"
        style="border:1px solid #e0eaf5;border-radius:10px;padding:10px 12px;margin-bottom:10px;background:#f8fbff;cursor:default;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span class="gc-drag-handle" title="Glisser pour réordonner"
            style="cursor:grab;color:#b0c8e8;font-size:1rem;padding:0 2px;user-select:none;">⠿</span>
          <span style="font-weight:700;color:#1a5c8a;font-size:0.82rem;flex:1;">📁 ${nom}</span>
          <button onclick="gcTrierAlpha()" title="Trier A→Z" style="font-size:0.65rem;padding:2px 7px;border:1px solid #d0e0ea;border-radius:5px;background:white;cursor:pointer;">A→Z</button>
          <button onclick="gcRenommerGroupe(decodeURIComponent('${_enc(nom)}'),'${idx}')" style="font-size:0.65rem;padding:2px 7px;border:1px solid #d0e0ea;border-radius:5px;background:white;cursor:pointer;">✏️</button>
          <button onclick="gcSupprimerGroupe(decodeURIComponent('${_enc(nom)}'),'${idx}')" style="font-size:0.65rem;padding:2px 7px;border:1px solid #fdd;border-radius:5px;background:#fff8f8;color:#c62828;cursor:pointer;">🗑</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">
          ${cabs.map(c => `<span style="background:#dbeafe;color:#1e40af;font-size:0.68rem;padding:2px 7px;border-radius:10px;display:flex;align-items:center;gap:4px;">
            ${c}&nbsp;<span onclick="gcRetirerDuGroupe(decodeURIComponent('${_enc(nom)}'),decodeURIComponent('${_enc(c)}'));" style="cursor:pointer;color:#c62828;font-weight:bold;font-size:0.8rem;line-height:1;">×</span>
          </span>`).join('')}
          ${cabs.length === 0 ? '<span style="font-size:0.7rem;color:#aaa;font-style:italic;">Aucun cabinet</span>' : ''}
        </div>
        <select onchange="gcAjouterAuGroupe(decodeURIComponent('${_enc(nom)}'),this)" style="font-size:0.72rem;padding:3px 6px;border:1px solid #d0e0ea;border-radius:6px;width:100%;">
          <option value="">+ Ajouter un cabinet...</option>
          ${tousCabinets.filter(c => !cabs.some(x => _nAcc(x)===_nAcc(c))).map(c => `<option value="${c.replace(/"/g,'&quot;')}">${c}</option>`).join('')}
        </select>
      </div>`;
    });
    html += `<button onclick="gcCreerGroupe()" style="width:100%;padding:8px;border:2px dashed #b0c8e8;border-radius:10px;background:transparent;color:#1a5c8a;cursor:pointer;font-size:0.78rem;font-weight:600;">＋ Nouveau groupe</button>`;
    content.innerHTML = html;

    // Drag & Drop
    let dragSrc = null;
    content.querySelectorAll('.gc-groupe-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragSrc = row;
        row.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', e => { row.style.opacity = ''; });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.style.borderColor = '#5bc4c0';
      });
      row.addEventListener('dragleave', e => { row.style.borderColor = '#e0eaf5'; });
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.style.borderColor = '#e0eaf5';
        if (dragSrc === row) return;
        const srcNom = dragSrc.dataset.groupe;
        const dstNom = row.dataset.groupe;
        const ordre = window._gcGroupesOrdre;
        const si = ordre.indexOf(srcNom);
        const di = ordre.indexOf(dstNom);
        if (si < 0 || di < 0) return;
        ordre.splice(si, 1);
        ordre.splice(di, 0, srcNom);
        gcSauvegarderOrdre();
        renderGroupesModal();
        gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
      });
    });
  }

  const popup = document.createElement('div');
  popup.id = 'popup-gc-groupes';
  popup.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:1100;display:flex;justify-content:center;align-items:center;';
  popup.innerHTML = `
    <div style="background:white;border-radius:14px;padding:20px;width:95%;max-width:500px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-weight:700;font-size:0.95rem;color:#1a5c8a;">🗂 Gérer les groupes</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <button onclick="gcTrierAlpha()" style="font-size:0.72rem;padding:3px 10px;border:1px solid #d0e0ea;border-radius:6px;background:white;cursor:pointer;color:#555;">A→Z tout trier</button>
          <button onclick="document.getElementById('popup-gc-groupes').remove();" style="border:none;background:none;font-size:1.3rem;cursor:pointer;color:#888;">×</button>
        </div>
      </div>
      <div id="gc-groupes-content" style="overflow-y:auto;flex:1;"></div>
    </div>`;
  document.body.appendChild(popup);
  renderGroupesModal();
  window._gcRenderGroupesModal = renderGroupesModal;
}

async function gcSauvegarderOrdre() {
  const db = getDB();
  if (!db) return;
  try { await db.collection('meta').doc('gc_groupes_ordre').set({ ordre: window._gcGroupesOrdre || [] }); }
  catch(e) {}
}

function gcTrierAlpha() {
  window._gcGroupesOrdre = Object.keys(window._gcGroupes).sort((a,b) => a.localeCompare(b,'fr'));
  gcSauvegarderOrdre();
  if (window._gcRenderGroupesModal) window._gcRenderGroupesModal();
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}


function gcCreerGroupe() {
  const nom = prompt('Nom du groupe :');
  if (!nom || !nom.trim()) return;
  const nomT = nom.trim();
  if (window._gcGroupes[nomT]) { showToast('Ce groupe existe déjà', true); return; }
  window._gcGroupes[nomT] = [];
  window._gcGroupesOuverts[nomT] = true;
  gcSauvegarderGroupes();
  if (window._gcRenderGroupesModal) window._gcRenderGroupesModal();
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function gcRenommerGroupe(nom) {
  const nouveau = prompt('Nouveau nom :', nom);
  if (!nouveau || !nouveau.trim() || nouveau.trim() === nom) return;
  const cabs = window._gcGroupes[nom];
  delete window._gcGroupes[nom];
  window._gcGroupes[nouveau.trim()] = cabs;
  gcSauvegarderGroupes();
  if (window._gcRenderGroupesModal) window._gcRenderGroupesModal();
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function gcSupprimerGroupe(nom) {
  if (!confirm(`Supprimer le groupe "${nom}" ? Les cabinets ne seront pas supprimés.`)) return;
  delete window._gcGroupes[nom];
  gcSauvegarderGroupes();
  if (window._gcRenderGroupesModal) window._gcRenderGroupesModal();
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function gcAjouterAuGroupe(nomGroupe, selEl) {
  const sel = selEl || document.getElementById('gc-add-select-' + nomGroupe.replace(/\s/g,'_'));
  if (!sel || !sel.value) return;
  const cab = sel.value;
  if (!window._gcGroupes[nomGroupe]) window._gcGroupes[nomGroupe] = [];
  if (!window._gcGroupes[nomGroupe].includes(cab)) window._gcGroupes[nomGroupe].push(cab);
  gcSauvegarderGroupes();
  if (window._gcRenderGroupesModal) window._gcRenderGroupesModal();
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function gcRetirerDuGroupe(nomGroupe, cab) {
  if (!window._gcGroupes[nomGroupe]) return;
  window._gcGroupes[nomGroupe] = window._gcGroupes[nomGroupe].filter(c => c !== cab);
  gcSauvegarderGroupes();
  if (window._gcRenderGroupesModal) window._gcRenderGroupesModal();
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function gcConstruireListe(filtre = '') {
  const list = document.getElementById('gc-cabinet-list');
  if (!list) return;
  const normalizeNom = s => s.normalize('NFC').replace(/\s+/g, ' ').trim();
  const _nAcc = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const cabMap = new Map();
  for (const k of Object.keys(CONTACTS)) cabMap.set(normalizeNom(k).toLowerCase(), k);
  if (typeof COGILOG_CLIENTS !== 'undefined') {
    for (const [code, data] of Object.entries(COGILOG_CLIENTS)) {
      const nom = data[3] || '';
      if (nom) { const key = normalizeNom(nom).toLowerCase(); if (!cabMap.has(key)) cabMap.set(key, nom); }
    }
  }

  // Filtre statut actif
  const filtreStatut = window._gcFiltreStatut || '';

  const _supprimes = window._gcClientsSupprimes || new Set();
  let cabinets = [...cabMap.values()]
    .filter(c => !_supprimes.has(c))
    .sort((a,b) => a.localeCompare(b, 'fr'))
    .filter(c => !filtre || c.toLowerCase().includes(filtre));

  // Compter prescriptions par cabinet (cache)
  if (!window._gcPrescCountCache) gcRefreshPrescCount();

  if (filtreStatut) {
    cabinets = cabinets.filter(cab => {
      const st = (window._gcStatuts || {})[cab] || 'actif';
      return st === filtreStatut;
    });
  }

  // Utiliser le rendu avec groupes
  gcConstruireListeAvecGroupes(cabinets, filtre);
}

function gcRefreshPrescCount() {
  window._gcPrescCountCache = {};
  const _nAcc = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  (window.prescriptions || []).forEach(p => {
    if (p.cabinet) {
      const k = _nAcc(p.cabinet);
      window._gcPrescCountCache[k] = (window._gcPrescCountCache[k] || 0) + 1;
    }
  });
}

function gcFiltreStatut(statut) {
  window._gcFiltreStatut = statut;
  ['tous','actif','inactif'].forEach(s => {
    const btn = document.getElementById('gc-filtre-' + s);
    const isActive = (s === statut) || (s === 'tous' && !statut);
    if (btn) {
      btn.style.background = isActive ? '#1a5c8a' : 'white';
      btn.style.color = isActive ? 'white' : (s === 'actif' ? '#2e7d32' : s === 'inactif' ? '#c62828' : '#555');
    }
  });
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function gcSelectionner(cab) {
  gcCabinetSelectionne = cab;
  const tarifKey = getTarifKey(cab);
  tarifsSelectedCabinet = tarifKey || cab;
  tarifsSelectedCabinets = tarifKey ? [tarifKey] : [];
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
  if (gcTabActif === 'contacts') renderContactsEditor();
  else afficherTableauTarif();
}

function gcDupliquerCabinet() {
  // Trouver le client source : celui selectionne ou demander lequel
  var sourceNom = gcCabinetSelectionne || '';
  if (!sourceNom) {
    showToast('Selectionnez d\'abord un cabinet a dupliquer.', true);
    return;
  }

  // Trouver les donnees du client source dans COGILOG_CLIENTS
  var sourceCode = null;
  var sourceData = null;
  if (typeof COGILOG_CLIENTS !== 'undefined') {
    Object.entries(COGILOG_CLIENTS).forEach(function(entry) {
      var nom = (entry[1][3] || '').trim().toUpperCase();
      if (nom === sourceNom.toUpperCase()) {
        sourceCode = entry[0];
        sourceData = entry[1];
      }
    });
  }

  if (!sourceData) {
    showToast('Client introuvable dans Cogilog.', true);
    return;
  }

  // Ouvrir le formulaire de nouveau client
  gcAjouterCabinet();

  // Pre-remplir avec les donnees du client source (sauf code et nom)
  setTimeout(function() {
    // Code vide (a remplir)
    document.getElementById('nc-code').value = '';
    document.getElementById('nc-code').placeholder = 'Nouveau code (ex: ' + sourceCode + '_COPIE)';
    // Nom vide (a modifier)
    document.getElementById('nc-nom').value = (sourceData[3] || '') + ' (COPIE)';
    // Remplir le reste
    var catSelect = document.getElementById('nc-categorie');
    if (catSelect) { for (var i = 0; i < catSelect.options.length; i++) { if (catSelect.options[i].value === (sourceData[0] || '')) catSelect.selectedIndex = i; } }
    var prefSelect = document.getElementById('nc-prefixe');
    if (prefSelect) { for (var i = 0; i < prefSelect.options.length; i++) { if (prefSelect.options[i].value === (sourceData[2] || '')) prefSelect.selectedIndex = i; } }
    document.getElementById('nc-num-adresse').value = sourceData[4] || '';
    document.getElementById('nc-voie').value = sourceData[5] || '';
    document.getElementById('nc-complement').value = sourceData[6] || '';
    document.getElementById('nc-cp').value = sourceData[8] || '';
    document.getElementById('nc-ville').value = sourceData[9] || '';
    document.getElementById('nc-pays').value = sourceData[11] || 'FRANCE';
    var civSelect = document.getElementById('nc-civilite');
    if (civSelect && sourceData[12]) { for (var i = 0; i < civSelect.options.length; i++) { if (civSelect.options[i].value === sourceData[12]) civSelect.selectedIndex = i; } }
    document.getElementById('nc-tel').value = sourceData[17] || '';
    document.getElementById('nc-tel2').value = sourceData[18] || '';
    document.getElementById('nc-email').value = sourceData[20] || '';
    var paiSelect = document.getElementById('nc-paiement');
    if (paiSelect && sourceData[57]) { for (var i = 0; i < paiSelect.options.length; i++) { if (paiSelect.options[i].value === sourceData[57]) paiSelect.selectedIndex = i; } }
    document.getElementById('nc-livraison').value = sourceData[58] || '';
    // Focus sur le code
    document.getElementById('nc-code').focus();
    showToast('Copie de ' + sourceNom + ' — modifiez le code et le nom');
  }, 100);
}

function gcAjouterCabinet() {
  // Popup formulaire complet pour ajouter un client Cogilog
  const existing = document.getElementById('popup-ajout-client');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'popup-ajout-client';
  popup.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1100;display:flex;justify-content:center;align-items:center;';
  popup.innerHTML = `
    <div style="background:white;border-radius:14px;padding:24px;width:95%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:1rem;color:var(--accent);">➕ Nouveau client</h3>
        <button onclick="document.getElementById('popup-ajout-client').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.78rem;">
        <div style="grid-column:span 2;">
          <label style="font-weight:600;color:#555;">Code client *</label>
          <input id="nc-code" placeholder="ex: MEHD01" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Catégorie</label>
          <select id="nc-categorie" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;">
            <option value="Cabinet dentaire">Cabinet dentaire</option>
            <option value="Centre dentaire">Centre dentaire</option>
            <option value="SELARL">SELARL</option>
            <option value="SELAS">SELAS</option>
            <option value="Docteur">Docteur</option>
          </select>
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Préfixe</label>
          <select id="nc-prefixe" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;">
            <option value="CABINET DENTAIRE">CABINET DENTAIRE</option>
            <option value="CENTRE DENTAIRE">CENTRE DENTAIRE</option>
            <option value="CENTRE MEDICO DENTAIRE">CENTRE MEDICO DENTAIRE</option>
            <option value="SELARL">SELARL</option>
            <option value="SELARL DE LA">SELARL DE LA</option>
            <option value="SELAS">SELAS</option>
            <option value="DOCTEUR">DOCTEUR</option>
            <option value="ESPACE DENTAIRE">ESPACE DENTAIRE</option>
            <option value="ESPACE MÉDICO DENTAIRE">ESPACE MÉDICO DENTAIRE</option>
          </select>
        </div>
        <div style="grid-column:span 2;">
          <label style="font-weight:600;color:#555;">Nom du client *</label>
          <input id="nc-nom" placeholder="ex: MEHDAOUI YASSINE" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">N° adresse</label>
          <input id="nc-num-adresse" placeholder="ex: 21" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Voie</label>
          <input id="nc-voie" placeholder="ex: AVENUE DE LA CONSTELLATION" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div style="grid-column:span 2;">
          <label style="font-weight:600;color:#555;">Complément adresse</label>
          <input id="nc-complement" placeholder="ex: CENTRE COMMERCIAL..." style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Code postal *</label>
          <input id="nc-cp" placeholder="ex: 95800" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Ville *</label>
          <input id="nc-ville" placeholder="ex: CERGY SAINT CHRISTOPHE" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Pays</label>
          <input id="nc-pays" value="FRANCE" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Civilité</label>
          <select id="nc-civilite" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;">
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Téléphone</label>
          <input id="nc-tel" placeholder="ex: 01 30 30 15 15" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Téléphone 2</label>
          <input id="nc-tel2" placeholder="" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div style="grid-column:span 2;">
          <label style="font-weight:600;color:#555;">E-mail</label>
          <input id="nc-email" placeholder="ex: contact@cabinet.fr" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Mode de paiement</label>
          <select id="nc-paiement" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;">
            <option value="Paiement par virement bancaire">Virement bancaire</option>
            <option value="Paiement par carte bancaire">Carte bancaire</option>
            <option value="Paiement par chèque à réception">Chèque à réception</option>
            <option value="">Non défini</option>
          </select>
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Nom livraison</label>
          <input id="nc-livraison" placeholder="ex: CERGY CONS 2" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div style="grid-column:span 2;">
          <label style="font-weight:600;color:#555;">Notes / Commentaires</label>
          <textarea id="nc-notes" rows="2" placeholder="ex: Code client: alpha bio5116..." style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end;">
        <button onclick="document.getElementById('popup-ajout-client').remove()" style="padding:8px 18px;border:1px solid #ddd;border-radius:8px;background:white;cursor:pointer;font-size:0.8rem;">Annuler</button>
        <button onclick="gcValiderAjoutClient()" style="padding:8px 18px;border:none;border-radius:8px;background:linear-gradient(120deg,#1a5c8a,#5bc4c0);color:white;cursor:pointer;font-size:0.8rem;font-weight:600;">✅ Ajouter le client</button>
      </div>
    </div>`;
  document.body.appendChild(popup);
}

function gcValiderAjoutClient() {
  const code = (document.getElementById('nc-code').value || '').trim().toUpperCase();
  const nom = (document.getElementById('nc-nom').value || '').trim().toUpperCase();
  if (!code) { alert('Le code client est obligatoire.'); return; }
  if (!nom) { alert('Le nom du client est obligatoire.'); return; }
  if (COGILOG_CLIENTS && COGILOG_CLIENTS[code]) { alert('Ce code client existe déjà dans Cogilog.'); return; }

  const cat = document.getElementById('nc-categorie').value;
  const prefixe = document.getElementById('nc-prefixe').value;
  const numAdr = document.getElementById('nc-num-adresse').value.trim();
  const voie = document.getElementById('nc-voie').value.trim().toUpperCase();
  const complement = document.getElementById('nc-complement').value.trim().toUpperCase();
  const cp = document.getElementById('nc-cp').value.trim();
  const ville = document.getElementById('nc-ville').value.trim().toUpperCase();
  const pays = document.getElementById('nc-pays').value.trim().toUpperCase();
  const civilite = document.getElementById('nc-civilite').value;
  const tel = document.getElementById('nc-tel').value.trim();
  const tel2 = document.getElementById('nc-tel2').value.trim();
  const email = document.getElementById('nc-email').value.trim();
  const paiement = document.getElementById('nc-paiement').value;
  const livraison = document.getElementById('nc-livraison').value.trim().toUpperCase();
  const notes = document.getElementById('nc-notes').value.trim();

  // Construire le tableau client au format COGILOG_CLIENTS (138 colonnes)
  const client = new Array(138).fill('');
  client[0]  = cat;             // Catégorie
  client[1]  = code;            // Code
  client[2]  = prefixe;         // Préfixe
  client[3]  = nom;             // Nom du client
  client[4]  = numAdr;          // Numéro adresse
  client[5]  = voie;            // Voie
  client[6]  = complement;      // Complément
  client[8]  = cp;              // Code postal
  client[9]  = ville;           // Ville
  client[11] = pays;            // Pays
  client[12] = civilite;        // Sexe contact
  client[13] = 'Dr ???';        // Civilité contact
  client[17] = tel;             // Téléphone 1
  client[18] = tel2;            // Téléphone 2
  client[20] = email;           // E-mail
  client[23] = '411' + code;    // Compte comptable
  client[56] = '5';             // Mode facturation
  client[57] = paiement;        // Mode paiement
  client[58] = livraison;       // Nom livraison
  client[64] = '0,00';          // Taux remise
  client[65] = 'NON';           // Découvert
  client[66] = '30';            // Délai
  client[67] = '15';            // Nombre jours
  client[68] = '10';            // Paiement
  client[69] = '7';             // Jour
  client[70] = 'Sabbah';        // Commercial nom
  client[71] = 'David';         // Commercial prénom
  client[72] = '0Facture ILS 2023';
  client[73] = '0Facture Proforma ILS 2022';
  client[74] = '0 Travaux livrés ILS 2022-2 sans prix';
  client[75] = '0BC ILS 2022';
  client[76] = '0BL ILS 2022';
  client[77] = '0BT ILS 2025 DE TRACABILITE';
  client[78] = '0';             // Notation
  client[79] = notes;           // Notes
  client[80] = '0,00';          // Taux escompte
  client[81] = '2';             // Nbre exemplaires
  client[100] = 'OUI';          // Pénalités
  client[101] = 'NON';          // Client bloqué
  client[122] = '1'; client[123] = '1'; client[124] = '1'; client[125] = '1'; client[126] = '1';
  client[136] = '419' + code;   // Compte acompte

  // Sauvegarder dans COGILOG_CLIENTS
  if (!window.COGILOG_CLIENTS) window.COGILOG_CLIENTS = {};
  COGILOG_CLIENTS[code] = client;

  // Ajouter aussi dans CONTACTS pour l'autocomplete cabinet
  if (!CONTACTS[nom]) {
    CONTACTS[nom] = ['Dr ???'];
  }
  gcCabinetSelectionne = nom;

  // Sauvegarder dans Firebase
  const db = getDB();
  if (db) {
    db.collection('contacts').doc('cogilog_clients_custom').set(
      Object.fromEntries(
        Object.entries(COGILOG_CLIENTS).filter(([k]) => !window.COGILOG_CLIENTS_ORIGINAL || !window.COGILOG_CLIENTS_ORIGINAL[k])
      )
    ).catch(e => console.warn('Erreur sauvegarde clients custom:', e));
  }

  document.getElementById('popup-ajout-client').remove();
  gcConstruireListe();
  renderContactsEditor();
  showToast(`✅ Client ${code} — ${nom} ajouté !`);
}

function gcEditerClient(nomForce) {
  // Trouver le code Cogilog du cabinet sélectionné (ou forcé)
  const cabCible = nomForce || gcCabinetSelectionne;
  if (!cabCible) { showToast('Sélectionne un cabinet d\'abord.', true); return; }

  // Chercher le code dans COGILOG_CLIENTS par nom (avec normalisation accents)
  const _normAccent = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  let codeClient = null;
  let clientData = null;
  const selNorm = _normAccent(cabCible);
  for (const [code, data] of Object.entries(COGILOG_CLIENTS || {})) {
    const nomNorm = _normAccent(data[3] || '');
    if (data[3] === cabCible || data[1] === cabCible
      || nomNorm === selNorm) {
      codeClient = code;
      clientData = data;
      break;
    }
  }

  if (!clientData) {
    showToast('⚠️ Ce cabinet n\'est pas dans la base Cogilog. Utilise "+ Cabinet" pour l\'ajouter.', true);
    return;
  }

  // Ouvrir le même formulaire pré-rempli
  const existing = document.getElementById('popup-ajout-client');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'popup-ajout-client';
  popup.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1100;display:flex;justify-content:center;align-items:center;';
  popup.innerHTML = `
    <div style="background:white;border-radius:14px;padding:24px;width:95%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:1rem;color:#e65100;">✏️ Modifier client — ${codeClient}</h3>
        <button onclick="document.getElementById('popup-ajout-client').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.78rem;">
        <div style="grid-column:span 2;">
          <label style="font-weight:600;color:#555;">Code client</label>
          <input id="nc-code" value="${codeClient}" readonly style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;background:#f5f5f5;color:#888;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Catégorie</label>
          <select id="nc-categorie" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;">
            ${['Cabinet dentaire','Centre dentaire','SELARL','SELAS','Docteur'].map(v => `<option value="${v}" ${clientData[0]===v?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Préfixe</label>
          <select id="nc-prefixe" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;">
            ${['CABINET DENTAIRE','CENTRE DENTAIRE','CENTRE MEDICO DENTAIRE','SELARL','SELARL DE LA','SELAS','DOCTEUR','ESPACE DENTAIRE','ESPACE MÉDICO DENTAIRE'].map(v => `<option value="${v}" ${clientData[2]===v?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div style="grid-column:span 2;">
          <label style="font-weight:600;color:#555;">Nom du client</label>
          <input id="nc-nom" value="${clientData[3]||''}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">N° adresse</label>
          <input id="nc-num-adresse" value="${clientData[4]||''}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Voie</label>
          <input id="nc-voie" value="${clientData[5]||''}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div style="grid-column:span 2;">
          <label style="font-weight:600;color:#555;">Complément adresse</label>
          <input id="nc-complement" value="${clientData[6]||''}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Code postal</label>
          <input id="nc-cp" value="${clientData[8]||''}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Ville</label>
          <input id="nc-ville" value="${clientData[9]||''}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Pays</label>
          <input id="nc-pays" value="${clientData[11]||'FRANCE'}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Civilité</label>
          <select id="nc-civilite" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;">
            <option value="M" ${clientData[12]==='M'?'selected':''}>M</option>
            <option value="F" ${clientData[12]==='F'?'selected':''}>F</option>
          </select>
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Téléphone</label>
          <input id="nc-tel" value="${clientData[17]||''}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Téléphone 2</label>
          <input id="nc-tel2" value="${clientData[18]||''}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div style="grid-column:span 2;">
          <label style="font-weight:600;color:#555;">E-mail</label>
          <input id="nc-email" value="${clientData[20]||''}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Mode de paiement</label>
          <select id="nc-paiement" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;">
            ${['Paiement par virement bancaire','Paiement par carte bancaire','Paiement par chèque à réception',''].map(v => `<option value="${v}" ${clientData[57]===v?'selected':''}>${v||'Non défini'}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-weight:600;color:#555;">Nom livraison</label>
          <input id="nc-livraison" value="${clientData[58]||''}" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div style="grid-column:span 2;">
          <label style="font-weight:600;color:#555;">Notes / Commentaires</label>
          <textarea id="nc-notes" rows="2" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:7px;font-size:0.8rem;box-sizing:border-box;resize:vertical;">${(clientData[79]||'').replace(/"/g,'&quot;')}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end;">
        <button onclick="document.getElementById('popup-ajout-client').remove()" style="padding:8px 18px;border:1px solid #ddd;border-radius:8px;background:white;cursor:pointer;font-size:0.8rem;">Annuler</button>
        <button onclick="gcValiderEditionClient('${codeClient}')" style="padding:8px 18px;border:none;border-radius:8px;background:linear-gradient(120deg,#e65100,#ff8a50);color:white;cursor:pointer;font-size:0.8rem;font-weight:600;">💾 Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(popup);
}

function gcValiderEditionClient(code) {
  const clientData = COGILOG_CLIENTS[code];
  if (!clientData) return;

  // Mettre à jour les champs modifiés
  clientData[0]  = document.getElementById('nc-categorie').value;
  clientData[2]  = document.getElementById('nc-prefixe').value;
  const ancienNom = clientData[3];
  clientData[3]  = (document.getElementById('nc-nom').value || '').trim().toUpperCase();
  clientData[4]  = document.getElementById('nc-num-adresse').value.trim();
  clientData[5]  = (document.getElementById('nc-voie').value || '').trim().toUpperCase();
  clientData[6]  = (document.getElementById('nc-complement').value || '').trim().toUpperCase();
  clientData[8]  = document.getElementById('nc-cp').value.trim();
  clientData[9]  = (document.getElementById('nc-ville').value || '').trim().toUpperCase();
  clientData[11] = (document.getElementById('nc-pays').value || '').trim().toUpperCase();
  clientData[12] = document.getElementById('nc-civilite').value;
  clientData[17] = document.getElementById('nc-tel').value.trim();
  clientData[18] = document.getElementById('nc-tel2').value.trim();
  clientData[20] = document.getElementById('nc-email').value.trim();
  clientData[57] = document.getElementById('nc-paiement').value;
  clientData[58] = (document.getElementById('nc-livraison').value || '').trim().toUpperCase();
  clientData[79] = document.getElementById('nc-notes').value.trim();

  // Si le nom a changé, mettre à jour CONTACTS
  if (ancienNom !== clientData[3]) {
    if (CONTACTS[ancienNom]) {
      CONTACTS[clientData[3]] = CONTACTS[ancienNom];
      delete CONTACTS[ancienNom];
    }
    if (gcCabinetSelectionne === ancienNom) gcCabinetSelectionne = clientData[3];
  }

  // Marquer ce client comme modifié (même s'il était original)
  if (!window.COGILOG_CLIENTS_MODIFIED) window.COGILOG_CLIENTS_MODIFIED = {};
  window.COGILOG_CLIENTS_MODIFIED[code] = true;

  // Sauvegarder dans Firebase : clients nouveaux OU modifiés
  const db = getDB();
  if (db) {
    db.collection('contacts').doc('cogilog_clients_custom').set(
      Object.fromEntries(
        Object.entries(COGILOG_CLIENTS).filter(([k]) =>
          !window.COGILOG_CLIENTS_ORIGINAL ||
          !window.COGILOG_CLIENTS_ORIGINAL[k] ||
          (window.COGILOG_CLIENTS_MODIFIED && window.COGILOG_CLIENTS_MODIFIED[k])
        )
      )
    ).catch(e => console.warn('Erreur sauvegarde clients custom:', e));
  }

  document.getElementById('popup-ajout-client').remove();
  gcConstruireListe();
  renderContactsEditor();
  showToast(`✅ Client ${code} mis à jour !`);
}


function gcRenderTarifsPanel() {
  const liazonZone = document.getElementById('gc-liaison-zone');
  const statDiv = document.getElementById('tarif-stat');
  if (!liazonZone) return;

  const cab = gcCabinetSelectionne;

  // Auto-association : si le cabinet n'a pas de mapping manuel,
  // on cherche son code Cogilog dans COGILOG_CLIENTS pour trouver la grille automatiquement
  if (!MAPPING_CONTACTS_TARIFS[cab]) {
    // Chercher par nom dans MAPPING_CODE_TARIFS (via code Cogilog)
    const cogilogEntry = Object.entries(COGILOG_CLIENTS || {}).find(([code, d]) => d[3] === cab);
    if (cogilogEntry) {
      const grille = MAPPING_CODE_TARIFS[cogilogEntry[0]];
      if (grille && TARIFS_BASE[grille]) {
        MAPPING_CONTACTS_TARIFS[cab] = grille;
      }
    }
  }

  const tarifKey = getTarifKey(cab);

  if (tarifKey) {
    liazonZone.style.display = 'none';
    tarifsSelectedCabinet = tarifKey;
    tarifsSelectedCabinets = [tarifKey];
    const hasPerso = MAPPING_CONTACTS_TARIFS[cab] === cab && TARIFS[cab];
    if (statDiv) statDiv.innerHTML = hasPerso
      ? `<span style="color:#e65100; font-weight:600;">✏️ Tarif personnalisé : <b>${cab}</b> (base : ${tarifKey})</span>`
      : `<span style="color:#2e7d32; font-weight:600;">✅ Grille Cogilog : <b>${tarifKey}</b></span>`;
    // Si copie perso existe, afficher celle-ci
    if (hasPerso) {
      tarifsSelectedCabinets = [cab];
      tarifsSelectedCabinet = cab;
    }
    afficherTableauTarif();
  } else {
    liazonZone.style.display = 'block';
    if (statDiv) statDiv.innerHTML = '';
    const thead = document.getElementById('tarif-thead');
    const tbody = document.getElementById('tarif-tbody');
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="padding:20px; text-align:center; color:#999; font-size:0.82rem;">Aucune grille Cogilog associée à ce client.</td></tr>`;
    const sel = document.getElementById('gc-liaison-select');
    const titre = document.getElementById('gc-liaison-titre');
    if (titre) titre.textContent = `Aucun tarif associé à "${cab}"`;
    if (sel) {
      sel.innerHTML = '<option value="">-- Choisir une grille --</option>' +
        Object.keys(TARIFS_BASE).sort()
          .filter(k => !k.startsWith('0') && !k.startsWith('Z'))
          .map(k => `<option value="${k.replace(/"/g, '&quot;')}">${k}</option>`).join('');
    }
  }
}

async function gcEnregistrerLiaison() {
  const sel = document.getElementById('gc-liaison-select');
  if (!sel || !sel.value) { showToast('Sélectionne une grille', true); return; }
  const cab = gcCabinetSelectionne;
  MAPPING_CONTACTS_TARIFS[cab] = sel.value;
  const db = getDB();
  if (db) {
    try {
      await db.collection('contacts').doc('mapping').set(MAPPING_CONTACTS_TARIFS);
      showToast(`✅ "${cab}" lié à "${sel.value}"`);
    } catch(e) { showToast('Liaison OK (non sauvegardée cloud)', true); }
  }
  // Réafficher
  tarifsSelectedCabinet = sel.value;
  tarifsSelectedCabinets = [sel.value];
  gcRenderTarifsPanel();
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function gcChangerLiaison() {
  // Forcer réaffichage sans tarif pour relancer la sélection
  const cab = gcCabinetSelectionne;
  delete MAPPING_CONTACTS_TARIFS[cab];
  tarifsSelectedCabinets = [];
  gcRenderTarifsPanel();
}

function gcCreerNouveauTarif() { showToast("Tarifs Cogilog — lecture seule", true); }


// ═══════════════════════════════════════════════════════
// GESTION DES GRILLES DE TARIFS
// ═══════════════════════════════════════════════════════
var gcGrilleSelectionnee = null;

function gcGrillesActives() {
  // Grilles utilisées dans le mapping ou ayant un contact du même nom
  const used = new Set(Object.values(MAPPING_CONTACTS_TARIFS));
  Object.keys(CONTACTS).forEach(c => { if (TARIFS[c]) used.add(c); });
  return used;
}

function gcRenderGrilles(filtre = '') {
  const list = document.getElementById('gc-grilles-list');
  if (!list) return;
  const used = gcGrillesActives();
  const allGrilles = Object.keys(TARIFS).sort();
  const filtrees = allGrilles.filter(g => !filtre || g.toLowerCase().includes(filtre.toLowerCase()));

  const actives = filtrees.filter(g => used.has(g));
  const orphelines = filtrees.filter(g => !used.has(g));

  let html = '';
  if (actives.length) {
    html += `<div style="font-size:0.68rem; font-weight:700; color:#888; padding:6px 8px 3px; text-transform:uppercase; letter-spacing:0.5px;">✅ Associées (${actives.length})<\/div>`;
    html += actives.map(g => gcGrilleItem(g, true)).join('');
  }
  if (orphelines.length) {
    html += `<div style="font-size:0.68rem; font-weight:700; color:#888; padding:10px 8px 3px; text-transform:uppercase; letter-spacing:0.5px;">📦 Archives (${orphelines.length})<\/div>`;
    html += orphelines.map(g => gcGrilleItem(g, false)).join('');
  }
  list.innerHTML = html;

  if (!gcGrilleSelectionnee && filtrees.length) gcGrilleSelectionnee = filtrees[0];
  gcAfficherGrille(gcGrilleSelectionnee);
}

function gcGrilleItem(grille, active) {
  const sel = grille === gcGrilleSelectionnee;
  const nb = Object.keys(TARIFS[grille] || {}).length;
  const clients = Object.entries(MAPPING_CONTACTS_TARIFS)
    .filter(([,v]) => v === grille).map(([k]) => k);
  if (CONTACTS[grille]) clients.push(grille);
  const unique = [...new Set(clients)];
  const clientsHtml = unique.length
    ? ' · ' + unique.map(c => `<span style="color:#1565c0;">${c.split(' ').slice(0,2).join(' ')}</span>`).join(', ')
    : '';
  return `<div class="grille-list-item${sel ? ' selected' : ''}" onclick="gcAfficherGrille(decodeURIComponent('${_enc(grille)}'))">
    <div class="grille-list-item-title">${grille}</div>
    <div class="grille-list-item-sub">${nb} actes${clientsHtml}</div>
  </div>`;
}

function gcAfficherGrille(grille) {
  if (!grille || !TARIFS[grille]) return;
  gcGrilleSelectionnee = grille;

  const clients = Object.entries(MAPPING_CONTACTS_TARIFS)
    .filter(([,v]) => v === grille).map(([k]) => k);
  if (CONTACTS[grille]) clients.push(grille);
  const unique = [...new Set(clients)];
  const safeName = grille.replace(/'/g, "\\'");
  const info = document.getElementById('gc-grille-info');
  if (info) {
    const delBtn = `<button type="button" class="gc-del-btn" onclick="gcSupprimerGrille('${safeName}')" style="margin-left:12px;">🗑 Supprimer</button>`;
    info.innerHTML = unique.length
      ? `<span style="color:#2e7d32;">✅ Utilisée par : ${unique.join(' · ')}</span>${delBtn}`
      : `<span style="color:#e65100;">📦 Non associée à aucun client</span>${delBtn}`;
  }

  // Afficher le tableau pour cette grille (réutilise les fonctions tarif)
  tarifsSelectedCabinet = grille;
  tarifsSelectedCabinets = [grille];
  afficherTableauTarif('tarif-thead-grilles', 'tarif-tbody-grilles');

  // Refresh liste sans re-appeler gcAfficherGrille
  gcRenderGrillesListOnly(document.getElementById('gc-grilles-search')?.value || '');
}

function gcRenderGrillesListOnly(filtre = '') {
  // Comme gcRenderGrilles mais sans rappeler gcAfficherGrille à la fin
  const list = document.getElementById('gc-grilles-list');
  if (!list) return;
  const used = gcGrillesActives();
  const allGrilles = Object.keys(TARIFS).sort();
  const filtrees = allGrilles.filter(g => !filtre || g.toLowerCase().includes(filtre.toLowerCase()));
  const actives = filtrees.filter(g => used.has(g));
  const orphelines = filtrees.filter(g => !used.has(g));
  let html = '';
  if (actives.length) {
    html += `<div style="font-size:0.68rem; font-weight:700; color:#888; padding:6px 8px 3px; text-transform:uppercase; letter-spacing:0.5px;">✅ Associées (${actives.length})<\/div>`;
    html += actives.map(g => gcGrilleItem(g, true)).join('');
  }
  if (orphelines.length) {
    html += `<div style="font-size:0.68rem; font-weight:700; color:#888; padding:10px 8px 3px; text-transform:uppercase; letter-spacing:0.5px;">📦 Archives (${orphelines.length})<\/div>`;
    html += orphelines.map(g => gcGrilleItem(g, false)).join('');
  }
  list.innerHTML = html;
}

function gcFiltrerGrilles() {
  gcRenderGrilles(document.getElementById('gc-grilles-search')?.value || '');
}

function gcCreerGrilleVierge() { showToast("Tarifs Cogilog — lecture seule", true); }

async function gcSupprimerGrille(grille) { /* noop */ }

// Compat anciens appels
function switchTabTarifs(tab) { gcSwitchTab(tab === 'tarifs' ? 'tarifs' : 'contacts'); }
function filtrerCabinetsContacts() { filtrerCabinetsGC(); }
function selectionnerCabinetContact(cab) { gcSelectionner(cab); }

function renderContactsEditor() {
  const editor = document.getElementById('contacts-editor');
  if (!editor) return;
  if (!gcCabinetSelectionne) {
    editor.innerHTML = '<div style="color:#aaa; text-align:center; margin-top:60px; font-size:0.85rem;">← Sélectionne un cabinet</div>';
    return;
  }
  const cab = gcCabinetSelectionne;
  const dentistes = CONTACTS[cab] || [];
  const _nAcc = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // Récupérer données Cogilog
  let cogilogData = null, cogilogCode = null;
  if (typeof COGILOG_CLIENTS !== 'undefined') {
    for (const [code, data] of Object.entries(COGILOG_CLIENTS)) {
      if (_nAcc(data[3]||'') === _nAcc(cab)) { cogilogData = data; cogilogCode = code; break; }
    }
  }

  // Stats prescriptions
  if (!window._gcPrescCountCache) gcRefreshPrescCount();
  const allPresc = (window.prescriptions || []).filter(p => p.cabinet && _nAcc(p.cabinet) === _nAcc(cab));
  const nbPresc = allPresc.length;
  const now = new Date();
  const allPrescSorted = [...allPresc].sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const dernierePresc = allPrescSorted[0];
  const derniereDateStr = dernierePresc?.date ? new Date(dernierePresc.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : null;

  // Calcul inactivité
  let joursInactivite = null;
  if (dernierePresc?.date) {
    joursInactivite = Math.floor((now - new Date(dernierePresc.date)) / 86400000);
  }
  const alerteInactivite = joursInactivite !== null && joursInactivite > 30;
  const alerteUrgente = joursInactivite !== null && joursInactivite > 60;

  // 5 dernières prescriptions
  const dernieres5 = allPrescSorted.slice(0, 5);

  // Statut et notes
  const statuts = window._gcStatuts || {};
  const notes = window._gcNotes || {};
  const statut = statuts[cab] || 'actif';
  const noteVal = notes[cab] || '';
  const statutColors = { actif: '#2e7d32', inactif: '#c62828' };
  const statutBg = { actif: '#e8f5e9', inactif: '#ffebee' };
  const tarifKey = getTarifKey(cab);

  // Infos Cogilog
  let adresse = '', tel = '', email = '', paiement = '', ville = '';
  if (cogilogData) {
    const num = cogilogData[4]||''; const voie = cogilogData[5]||''; const cp = cogilogData[8]||'';
    ville = cogilogData[9]||''; const pays = cogilogData[11]||'';
    adresse = [num, voie, cp, ville, pays].filter(Boolean).join(' ');
    tel = cogilogData[17] || cogilogData[18] || '';
    email = cogilogData[20] || '';
    paiement = cogilogData[57] || '';
  }

  editor.innerHTML = `
    <!-- Alerte inactivité -->
    ${(alerteInactivite && window._appPrefs?.alerte_inactivite !== false) ? `
    <div style="display:flex; align-items:center; gap:10px; background:${alerteUrgente ? '#fff3e0' : '#fff8e1'}; border:1px solid ${alerteUrgente ? '#ffb74d' : '#ffe082'}; border-left:4px solid ${alerteUrgente ? '#e65100' : '#ffa000'}; border-radius:8px; padding:10px 14px; margin-bottom:12px;">
      <span style="font-size:1.2rem;">${alerteUrgente ? '🔴' : '⚠️'}</span>
      <div>
        <div style="font-size:0.78rem; font-weight:700; color:${alerteUrgente ? '#bf360c' : '#e65100'};">
          Inactif depuis <b>${joursInactivite} jours</b>${alerteUrgente ? ' — à relancer !' : ''}
        </div>
        ${derniereDateStr ? `<div style="font-size:0.7rem; color:#888;">Dernière prescription : ${derniereDateStr}</div>` : ''}
      </div>
    </div>` : ''}

    <!-- En-tête fiche -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; gap:12px;">
      <div style="flex:1;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <h3 style="margin:0; font-size:1rem; color:#1a5c8a; font-weight:800;">${cab}</h3>
          ${cogilogCode ? `<span style="font-size:0.65rem; background:#e8f5e9; color:#2e7d32; padding:2px 7px; border-radius:10px; font-weight:700;">COG: ${cogilogCode}</span>` : ''}
          <select onchange="gcChangerStatut(decodeURIComponent('${_enc(cab)}'), this.value)"
            style="font-size:0.7rem; padding:2px 6px; border-radius:10px; border:1px solid ${statutColors[statut]}; background:${statutBg[statut]}; color:${statutColors[statut]}; font-weight:700; cursor:pointer;">
            <option value="actif" ${statut==='actif'?'selected':''}>🟢 Actif</option>
            <option value="inactif" ${statut==='inactif'?'selected':''}>🔴 Inactif</option>
          </select>
        </div>
        ${ville ? `<div style="font-size:0.73rem; color:#666; margin-top:3px;">📍 ${ville}</div>` : ''}
      </div>
      <div style="display:flex; gap:6px; flex-shrink:0;">
        <button type="button" onclick="gcEditerClientActuel()"
          style="background:#fff3e0; border:1px solid #ffb74d; border-radius:7px; padding:5px 10px; font-size:0.73rem; color:#e65100; cursor:pointer;">✏️ Modifier fiche</button>
        <button type="button" onclick="supprimerCabinetContact()"
          style="background:#ffebee; border:1px solid #ef9a9a; border-radius:7px; padding:5px 10px; font-size:0.73rem; color:#c62828; cursor:pointer;">🗑️</button>
      </div>
    </div>

    <!-- Infos coordonnées avec boutons copier -->
    ${(adresse || tel || email || paiement) ? `
    <div style="background:#f8fafc; border:1px solid #e8eef4; border-radius:10px; padding:12px; margin-bottom:12px; display:flex; flex-direction:column; gap:7px;">
      ${adresse ? `<div style="font-size:0.76rem; color:#444; display:flex; gap:6px; align-items:center;"><span style="flex-shrink:0;">📍</span><span style="flex:1;">${adresse}</span></div>` : ''}
      ${tel ? `<div style="font-size:0.76rem; color:#444; display:flex; gap:6px; align-items:center;">
        <span style="flex-shrink:0;">📞</span>
        <a href="tel:${tel}" style="color:#1a5c8a; text-decoration:none; flex:1;">${tel}</a>
        <button onclick="gcCopier('${tel}', this)" style="background:none; border:1px solid #d0e0ea; border-radius:5px; padding:1px 7px; font-size:0.68rem; color:#666; cursor:pointer; flex-shrink:0;">Copier</button>
      </div>` : ''}
      ${email ? `<div style="font-size:0.76rem; color:#444; display:flex; gap:6px; align-items:center;">
        <span style="flex-shrink:0;">📧</span>
        <a href="mailto:${email}" style="color:#1a5c8a; text-decoration:none; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${email}</a>
        <button onclick="gcCopier('${email}', this)" style="background:none; border:1px solid #d0e0ea; border-radius:5px; padding:1px 7px; font-size:0.68rem; color:#666; cursor:pointer; flex-shrink:0;">Copier</button>
      </div>` : ''}
      ${paiement ? `<div style="font-size:0.76rem; color:#444; display:flex; gap:6px; align-items:center;"><span style="flex-shrink:0;">💳</span><span>${paiement}</span></div>` : ''}
    </div>` : ''}

    <!-- Grille tarifaire -->
    <div style="margin-bottom:12px; display:flex; align-items:center; gap:8px; padding:8px 12px; background:${tarifKey ? '#f0fff4' : '#fff8e1'}; border:1px solid ${tarifKey ? '#b2dfdb' : '#ffe082'}; border-radius:8px; cursor:pointer;" onclick="gcSwitchTab('tarifs')">
      <span style="font-size:0.85rem;">${tarifKey ? '💰' : '⚠️'}</span>
      <span style="font-size:0.76rem; font-weight:600; color:${tarifKey ? '#2e7d32' : '#e65100'}; flex:1;">${tarifKey ? `Grille : ${tarifKey}` : 'Aucune grille tarifaire — cliquer pour associer'}</span>
      <span style="font-size:0.7rem; color:#999;">→</span>
    </div>

    <!-- Notes internes -->
    <div style="margin-bottom:12px; background:${noteVal ? '#fffde7' : 'white'}; border:1px solid ${noteVal ? '#ffe082' : '#d0e0ea'}; border-radius:10px; overflow:hidden; transition:all 0.2s;">
      <div style="padding:8px 12px; display:flex; align-items:center; gap:6px; border-bottom:1px solid ${noteVal ? '#ffe082' : '#e8eef4'}; background:${noteVal ? '#fff8e1' : '#f8fafc'};">
        <span style="font-size:0.85rem;">📝</span>
        <span style="font-size:0.74rem; font-weight:700; color:${noteVal ? '#e65100' : '#1a5c8a'}; flex:1;">Notes internes${noteVal ? ' — rappel actif' : ''}</span>
        <span id="gc-note-status" style="font-size:0.65rem; color:#aaa;"></span>
      </div>
      <textarea id="gc-notes-input" placeholder="Rappels, consignes, teintes préférées, habitudes du cabinet…"
        oninput="gcNoteAutosave(decodeURIComponent('${_enc(cab)}'), this)"
        style="width:100%; box-sizing:border-box; min-height:${noteVal ? '72px' : '52px'}; padding:10px 12px; border:none; font-size:0.78rem; font-family:'DM Sans',sans-serif; resize:vertical; color:#333; background:${noteVal ? '#fffde7' : 'white'}; outline:none;">${noteVal}</textarea>
    </div>

    <!-- 5 dernières prescriptions -->
    ${nbPresc > 0 ? `
    <div style="border:1px solid #e8eef4; border-radius:10px; overflow:hidden; margin-bottom:12px;">
      <div style="background:#f0f4f8; padding:8px 14px; font-size:0.74rem; font-weight:700; color:#1a5c8a;">
        🕐 Dernières prescriptions (${nbPresc} au total)
      </div>
      ${dernieres5.map(p => {
        const actes = (p.actes||[]).slice(0,3).map(a => a.code||a).join(', ');
        const date = p.date ? new Date(p.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '—';
        const statusColor = p.verifie ? '#2e7d32' : p.importe ? '#1565c0' : '#e65100';
        const statusLabel = p.verifie ? 'Vérifié' : p.importe ? 'Importé' : 'En attente';
        return `<div style="display:flex; align-items:center; gap:8px; padding:7px 14px; border-bottom:1px solid #f0f4f8; font-size:0.74rem;">
          <span style="color:#888; font-family:monospace; font-size:0.7rem; flex-shrink:0;">${date}</span>
          <span style="flex:1; color:#333; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.numero || '—'} ${p.patient?.nom ? '· '+p.patient.nom : ''} ${actes ? '· '+actes : ''}</span>
          <span style="font-size:0.62rem; font-weight:700; color:${statusColor}; flex-shrink:0;">${statusLabel}</span>
        </div>`;
      }).join('')}
    </div>` : `
    <div style="text-align:center; padding:12px; color:#aaa; font-size:0.78rem; border:1px dashed #d0e0ea; border-radius:8px; margin-bottom:12px;">
      Aucune prescription enregistrée pour ce cabinet
    </div>`}

    <!-- Section Praticiens -->
    <div style="border:1px solid #e8eef4; border-radius:10px; overflow:hidden;">
      <div style="background:#e8f4fb; padding:8px 14px; display:flex; align-items:center; gap:8px;">
        <span style="font-size:0.76rem; font-weight:700; color:#1a5c8a; flex-shrink:0;">👤 Praticiens (${dentistes.length})</span>
        ${dentistes.length > 3 ? '<input type="text" id="contacts-search" placeholder="🔍 Filtrer..." oninput="_filtrerContacts(this.value)" style="flex:1;font-size:0.72rem;padding:3px 8px;border:1px solid #d0e0ea;border-radius:6px;min-width:0;">' : ''}
      </div>
      <div id="contacts-liste" style="padding:8px 12px; display:flex; flex-direction:column; gap:5px; max-height:300px; overflow-y:auto;">
        ${dentistes.length === 0 ? '<div style="color:#aaa; font-size:0.78rem; text-align:center; padding:8px;">Aucun praticien enregistré</div>' : ''}
        ${[...dentistes].sort((a,b) => a.localeCompare(b, 'fr')).map((dr, i) => _renderContactRow(dr, dentistes.indexOf(dr))).join('')}
      </div>
      <div style="padding:8px 12px; background:#fafcfe; border-top:1px solid #e8eef4; display:flex; gap:8px;">
        <input type="text" id="nouveau-dentiste-input" placeholder="Dr NOM PRÉNOM"
          style="flex:1; padding:6px 10px; border:1px solid #d0e0ea; border-radius:7px; font-size:0.78rem; font-family:'DM Sans',sans-serif;"
          onkeydown="if(event.key==='Enter'){event.preventDefault();ajouterDentiste();}">
        <button type="button" onclick="ajouterDentiste()" style="background:linear-gradient(120deg,#1a5c8a,#5bc4c0); color:white; border:none; border-radius:7px; padding:6px 12px; font-size:0.78rem; cursor:pointer; font-weight:600; white-space:nowrap;">➕ Ajouter</button>
      </div>
    </div>
  `;
}

function gcChangerStatut(cab, statut) {
  if (!window._gcStatuts) window._gcStatuts = {};
  window._gcStatuts[cab] = statut;
  // Sauvegarder dans Firebase
  const db = getDB();
  if (db) db.collection('meta').doc('gc_meta').set({ statuts: window._gcStatuts, notes: window._gcNotes || {} }, { merge: true }).catch(()=>{});
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function gcSauvegarderNotes(cab, val) {
  if (!window._gcNotes) window._gcNotes = {};
  window._gcNotes[cab] = val;
  const db = getDB();
  if (db) db.collection('meta').doc('gc_meta').set({ statuts: window._gcStatuts || {}, notes: window._gcNotes }, { merge: true }).catch(()=>{});
  showToast('📝 Note sauvegardée');
}

// Autosave notes avec debounce 1.5s
var _gcNoteAutosaveDebounced = debounce((cab, val) => {
  if (!window._gcNotes) window._gcNotes = {};
  window._gcNotes[cab] = val;
  const db = getDB();
  if (db) db.collection('meta').doc('gc_meta').set({ statuts: window._gcStatuts || {}, notes: window._gcNotes }, { merge: true }).catch(()=>{});
  const st = document.getElementById('gc-note-status');
  if (st) { st.textContent = '✅ sauvegardé'; setTimeout(() => { if (st) st.textContent = ''; }, 2000); }
}, 1500);

function gcNoteAutosave(cab, textarea) {
  const st = document.getElementById('gc-note-status');
  if (st) st.textContent = '…';
  // Adapter couleur fond en temps réel
  const hasVal = textarea.value.trim().length > 0;
  textarea.style.background = hasVal ? '#fffde7' : 'white';
  _gcNoteAutosaveDebounced(cab, textarea.value);
}

function gcCopier(texte, btn) {
  navigator.clipboard.writeText(texte).then(() => {
    const original = btn.textContent;
    btn.textContent = '✅';
    btn.style.color = '#2e7d32';
    btn.style.borderColor = '#2e7d32';
    setTimeout(() => { btn.textContent = original; btn.style.color = '#666'; btn.style.borderColor = '#d0e0ea'; }, 1500);
  }).catch(() => showToast('Copie non supportée', true));
}

function gcAfficherRappelNote(cab, note) {
  // Supprimer un éventuel ancien rappel
  const ancien = document.getElementById('gc-note-rappel');
  if (ancien) ancien.remove();

  if (!note || !note.trim()) return;

  // Bulle persistante à gauche de la prescription (position absolute dans colonne gauche)
  const colGauche = document.getElementById('split-wrapper')?.firstElementChild;
  if (!colGauche) return;

  const bulle = document.createElement('div');
  bulle.id = 'gc-note-rappel';
  bulle.setAttribute('style', 'position:absolute; top:0; left:-215px; width:200px; max-height:50vh; overflow-y:auto; background:#fffde7; border:2px solid #ffe082; border-radius:12px; padding:12px 14px; box-shadow:0 4px 20px rgba(0,0,0,0.1); z-index:100; font-size:0.75rem; color:#5d4037; line-height:1.5;');
  bulle.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-weight:700;font-size:0.72rem;color:#e65100;">📝 Note cabinet</span>
      <button onclick="this.closest('#gc-note-rappel').remove()" style="background:none;border:none;font-size:0.9rem;cursor:pointer;color:#999;line-height:1;padding:0;">✕</button>
    </div>
    <div style="font-weight:600;font-size:0.7rem;color:#b45309;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cab}</div>
    <div style="white-space:pre-wrap;word-break:break-word;">${note.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  `;
  colGauche.appendChild(bulle);
}

function gcEditerClientActuel() {
  if (!gcCabinetSelectionne) return;
  // Réutiliser gcEditerClient en présélectionnant le cabinet actuel
  gcEditerClient(gcCabinetSelectionne);
}

function _filtrerContacts(query) {
  var container = document.getElementById('contacts-liste');
  if (!container) return;
  var q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  var dentistes = CONTACTS[gcCabinetSelectionne] || [];
  var sorted = [...dentistes].sort(function(a, b) { return a.localeCompare(b, 'fr'); });
  var filtered = q ? sorted.filter(function(dr) {
    return dr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q);
  }) : sorted;
  if (!filtered.length) {
    container.innerHTML = '<div style="color:#aaa; font-size:0.78rem; text-align:center; padding:8px;">Aucun résultat</div>';
  } else {
    container.innerHTML = filtered.map(function(dr) { return _renderContactRow(dr, dentistes.indexOf(dr)); }).join('');
  }
}

function _renderContactRow(dr, i) {
  var aliases = getContactAliases()[dr] || [];
  var drB64 = btoa(unescape(encodeURIComponent(dr)));
  var badgeHtml = aliases.length ? ' <span style="font-size:0.6rem;background:#7c4dff;color:white;border-radius:8px;padding:0 4px;margin-left:2px;">' + aliases.length + '</span>' : '';
  var aliasChips = aliases.map(function(a) {
    var aB64 = btoa(unescape(encodeURIComponent(a)));
    return '<span style="display:inline-flex;align-items:center;gap:3px;background:#ede7f6;border-radius:12px;padding:2px 8px;font-size:0.68rem;color:#4a148c;margin:2px;">'
      + a + ' <button onclick="removeContactAliasB64(\'' + drB64 + '\',\'' + aB64 + '\')" style="background:none;border:none;cursor:pointer;color:#c62828;font-size:0.7rem;padding:0;line-height:1;">✕</button></span>';
  }).join('');
  return '<div style="padding:5px 10px; background:#f5f9fc; border:1px solid #d0e0ea; border-radius:7px;">'
    + '<div style="display:flex; align-items:center; gap:8px;">'
    + '<span style="font-size:0.8rem; flex:1;">' + dr + '</span>'
    + '<button type="button" onclick="toggleContactAlias(\'' + drB64 + '\',' + i + ')" style="background:none; border:none; cursor:pointer; font-size:0.72rem; color:#7c4dff;" title="Alias praticien">🏷' + badgeHtml + '</button>'
    + '<button type="button" onclick="modifierDentiste(' + i + ')" style="background:none; border:none; cursor:pointer; font-size:0.78rem; color:#1a5c8a;" title="Modifier">✏️</button>'
    + '<button type="button" onclick="supprimerDentiste(' + i + ')" style="background:none; border:none; cursor:pointer; font-size:0.78rem; color:#c62828;" title="Supprimer">✕</button>'
    + '</div>'
    + '<div id="contact-alias-' + i + '" style="display:none; margin-top:4px; padding:4px 0 0 16px; border-top:1px dashed #d0e0ea;">'
    + aliasChips
    + '<div style="display:flex;gap:4px;margin-top:3px;">'
    + '<input type="text" placeholder="ex: defa, defre..." style="flex:1;font-size:0.72rem;padding:3px 6px;border:1px solid #ccc;border-radius:5px;" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addContactAliasB64(\'' + drB64 + '\',this);}">'
    + '<button onclick="addContactAliasB64(\'' + drB64 + '\',this.previousElementSibling)" style="background:#7c4dff;color:white;border:none;border-radius:5px;padding:3px 8px;font-size:0.68rem;cursor:pointer;">+</button>'
    + '</div></div></div>';
}

// ── Alias contacts (praticiens) ──
function getContactAliases() {
  try { return JSON.parse(localStorage.getItem('contact_aliases') || '{}'); } catch(e) { return {}; }
}
function saveContactAliases(aliases) {
  localStorage.setItem('contact_aliases', JSON.stringify(aliases));
  var db = getDB();
  if (db) db.collection('meta').doc('aliases_contact').set(aliases).catch(function(){});
}
function _decB64(b64) { return decodeURIComponent(escape(atob(b64))); }
function toggleContactAlias(drB64, idx) {
  var el = document.getElementById('contact-alias-' + idx);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function addContactAliasB64(drB64, input) {
  var dr = _decB64(drB64);
  var alias = (input.value || '').trim().toLowerCase();
  if (!alias) return;
  var all = getContactAliases();
  if (!all[dr]) all[dr] = [];
  if (all[dr].includes(alias)) { showToast('Alias déjà existant'); return; }
  all[dr].push(alias);
  saveContactAliases(all);
  input.value = '';
  renderContactsEditor();
  showToast('Alias "' + alias + '" ajouté pour ' + dr);
}
function removeContactAliasB64(drB64, aliasB64) {
  var dr = _decB64(drB64);
  var alias = _decB64(aliasB64);
  var all = getContactAliases();
  if (!all[dr]) return;
  all[dr] = all[dr].filter(function(a) { return a !== alias; });
  if (!all[dr].length) delete all[dr];
  saveContactAliases(all);
  renderContactsEditor();
  showToast('Alias supprimé');
}

function ajouterDentiste() {
  const input = document.getElementById('nouveau-dentiste-input');
  const nom = (input.value || '').trim();
  if (!nom || !gcCabinetSelectionne) return;
  if (!CONTACTS[gcCabinetSelectionne]) CONTACTS[gcCabinetSelectionne] = [];
  CONTACTS[gcCabinetSelectionne].push(nom);
  input.value = '';
  renderContactsEditor();
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function supprimerDentiste(idx) {
  if (!gcCabinetSelectionne) return;
  CONTACTS[gcCabinetSelectionne].splice(idx, 1);
  renderContactsEditor();
  gcConstruireListe(document.getElementById('gc-search')?.value?.toLowerCase() || '');
}

function modifierDentiste(idx) {
  const dentistes = CONTACTS[gcCabinetSelectionne];
  const ancien = dentistes[idx];
  const nouveau = prompt('Modifier le nom :', ancien);
  if (nouveau && nouveau.trim() && nouveau.trim() !== ancien) {
    dentistes[idx] = nouveau.trim();
    renderContactsEditor();
  }
}

function ajouterCabinetContact() {
  const nom = prompt('Nom du nouveau cabinet :');
  if (!nom || !nom.trim()) return;
  const nomTrim = nom.trim();
  if (CONTACTS[nomTrim]) { alert('Ce cabinet existe déjà.'); return; }
  CONTACTS[nomTrim] = ['Dr ???'];
  gcCabinetSelectionne = nomTrim;
  gcConstruireListe();
  renderContactsEditor();
}

function renommerCabinetContact() {
  if (!gcCabinetSelectionne) return;
  const nouveau = prompt('Nouveau nom du cabinet :', gcCabinetSelectionne);
  if (!nouveau || !nouveau.trim() || nouveau.trim() === gcCabinetSelectionne) return;
  const nomTrim = nouveau.trim();
  if (CONTACTS[nomTrim]) { alert('Ce nom existe déjà.'); return; }
  CONTACTS[nomTrim] = CONTACTS[gcCabinetSelectionne];
  delete CONTACTS[gcCabinetSelectionne];
  gcCabinetSelectionne = nomTrim;
  CONTACTS_DENTISTES[nomTrim] = CONTACTS[nomTrim];
  delete CONTACTS_DENTISTES[gcCabinetSelectionne];
  gcConstruireListe();
  renderContactsEditor();
}

async function supprimerCabinetContact() {
  if (!gcCabinetSelectionne) return;
  const cab = gcCabinetSelectionne;
  if (!confirm('Masquer le cabinet "' + cab + '" de la liste ?')) return;

  // Supprimer de CONTACTS (si présent)
  delete CONTACTS[cab];

  // Ajouter à la liste noire locale
  if (!window._gcClientsSupprimes) window._gcClientsSupprimes = new Set();
  window._gcClientsSupprimes.add(cab);

  // Passer au client suivant
  const tousCabinets = Object.keys(CONTACTS).sort();
  gcCabinetSelectionne = tousCabinets.length ? tousCabinets[0] : null;
  gcConstruireListe();
  renderContactsEditor();

  // Sauvegarder dans Firebase
  const db = getDB();
  if (!db) return;
  try {
    // Sauvegarder CONTACTS sans ce cabinet
    if (Object.keys(CONTACTS).length > 0) {
      await db.collection('contacts').doc('dentistes').set(CONTACTS);
    }
    // Persister la liste noire
    await db.collection('meta').doc('clients_supprimes').set({ liste: [...window._gcClientsSupprimes] });
    showToast('✅ Cabinet "' + cab + '" masqué');
  } catch(e) { showToast('Masqué localement (erreur cloud : ' + e.message + ')', true); }
}

async function sauvegarderContacts() {
  // Synchroniser CONTACTS_DENTISTES en mémoire
  for (const k of Object.keys(CONTACTS_DENTISTES)) {
    if (!CONTACTS[k]) delete CONTACTS_DENTISTES[k];
  }
  Object.assign(CONTACTS_DENTISTES, CONTACTS);

  const db = getDB();
  if (db) {
    try {
      await db.collection('contacts').doc('dentistes').set(CONTACTS);
      showToast('✅ Contacts sauvegardés dans le cloud !');
    } catch(e) {
      console.error('Firebase contacts error:', e);
      showToast('❌ Erreur sauvegarde cloud : ' + e.message, true);
    }
  } else {
    showToast('⚠️ Firebase non disponible', true);
  }
}

// ═══ FIN GESTION CONTACTS ═══════════════════════════════

function ouvrirModalTarifs() {
  document.getElementById('modal-tarifs').style.display = 'flex';
  // Sélectionner le premier cabinet si aucun
  if (!gcCabinetSelectionne) {
    const keys = Object.keys(CONTACTS).sort();
    if (keys.length) gcCabinetSelectionne = keys[0];
    tarifsSelectedCabinet = gcCabinetSelectionne;
    tarifsSelectedCabinets = [gcCabinetSelectionne];
  }
  gcConstruireListe();
  renderContactsEditor();
}

function fermerModalTarifs() {
  document.getElementById('modal-tarifs').style.display = 'none';
}

function construireCabinetList(filtre = '') {
  gcConstruireListe(filtre);
  const container = document.getElementById('tarif-cabinet-list');
  if (!container) return;
  const cabinets = Object.keys(TARIFS).filter(c => c.toLowerCase().includes(filtre)).sort();
  container.innerHTML = cabinets.map(c => {
    const sel = tarifsSelectedCabinets.includes(c);
    return `<button class="tarif-cab-btn${sel ? ' selected' : ''}" onclick="toggleCabinet(decodeURIComponent('${_enc(c)}'))">${c}</button>`;
  }).join('');
  document.getElementById('tarif-stat').textContent = `${cabinets.length} cabinet(s)`;
}

function toggleCabinet(nom) {
  if (tarifsSelectedCabinets.includes(nom)) {
    if (tarifsSelectedCabinets.length > 1) tarifsSelectedCabinets = tarifsSelectedCabinets.filter(c => c !== nom);
  } else {
    tarifsSelectedCabinets.push(nom);
  }
  tarifsSelectedCabinet = tarifsSelectedCabinets[0];
  construireCabinetList(document.getElementById('tarif-search').value.toLowerCase());
  afficherTableauTarif();
}

function getActesFiltres() {
  const groupeEl = document.getElementById('tarif-groupe');
  const groupe = groupeEl ? groupeEl.value : '';
  let actes;
  if (groupe && GROUPES_ACTES[groupe]) {
    actes = GROUPES_ACTES[groupe];
  } else {
    const tous = new Set();
    tarifsSelectedCabinets.forEach(c => { if (TARIFS[c]) Object.keys(TARIFS[c]).forEach(k => tous.add(k)); });
    actes = [...tous].sort();
  }
  // Filtre recherche texte
  if (_gcTarifSearchFilter) {
    actes = actes.filter(code => {
      const label = (ACTE_LABELS[code] || code).toLowerCase();
      return label.includes(_gcTarifSearchFilter) || code.toLowerCase().includes(_gcTarifSearchFilter);
    });
  }
  return actes;
}

function afficherTableauTarif(theadId = 'tarif-thead', tbodyId = 'tarif-tbody') {
  const actes = getActesFiltres();
  const thead = document.getElementById(theadId);
  const tbody = document.getElementById(tbodyId);
  if (!thead || !tbody) return;

  // Header
  thead.innerHTML = `<tr style="background:linear-gradient(120deg,#1a5c8a,#5bc4c0);">
    <th style="padding:8px 12px; text-align:left; color:white; font-size:0.72rem; font-weight:700; letter-spacing:0.5px; min-width:220px; position:sticky; left:0; background:linear-gradient(120deg,#1a5c8a,#5bc4c0); z-index:2;">ACTE<\/th>
    <th style="padding:8px 12px; text-align:center; color:rgba(255,255,255,0.7); font-size:0.65rem; font-weight:600; width:60px;">CODE<\/th>
    ${tarifsSelectedCabinets.map(c => `<th style="padding:8px 10px; text-align:center; color:white; font-size:0.72rem; font-weight:700; min-width:90px;">${c}<\/th>`).join('')}
  <\/tr>`;

  // Body par groupe
  let html = '';
  const groupeActifEl = document.getElementById('tarif-groupe');
  const groupeActif = groupeActifEl ? groupeActifEl.value : '';
  
  if (!groupeActif) {
    // Afficher par groupes
    Object.entries(GROUPES_ACTES).forEach(([groupe, codesGroupe]) => {
      const actesDuGroupe = codesGroupe.filter(c => actes.includes(c));
      if (!actesDuGroupe.length) return;
      html += `<tr><td colspan="${tarifsSelectedCabinets.length + 2}" style="padding:6px 12px; background:#e8f4fb; font-size:0.68rem; font-weight:700; color:#1a5c8a; letter-spacing:1px; text-transform:uppercase; border-bottom:1px solid #d0e0ea;">${groupe}<\/td><\/tr>`;
      html += actesDuGroupe.map((code, idx) => ligneActe(code, idx)).join('');
    });
    // Actes hors groupes
    const tousGroupes = Object.values(GROUPES_ACTES).flat();
    const horsGroupe = actes.filter(c => !tousGroupes.includes(c));
    if (horsGroupe.length) {
      html += `<tr><td colspan="${tarifsSelectedCabinets.length + 2}" style="padding:6px 12px; background:#f0f0f0; font-size:0.68rem; font-weight:700; color:#666; letter-spacing:1px; text-transform:uppercase;">AUTRES<\/td><\/tr>`;
      html += horsGroupe.map((code, idx) => ligneActe(code, idx)).join('');
    }
  } else {
    html = actes.map((code, idx) => ligneActe(code, idx)).join('');
  }

  tbody.innerHTML = html;
}

function ligneActe(code, idx) {
  const label = ACTE_LABELS[code] || code;
  const bg = idx % 2 === 0 ? 'white' : '#f8fbfd';
  const vals = tarifsSelectedCabinets.map(c => {
    // Utiliser la copie personnelle du client si elle existe
    const clientKey = (gcCabinetSelectionne && TARIFS[gcCabinetSelectionne] && MAPPING_CONTACTS_TARIFS[gcCabinetSelectionne] === gcCabinetSelectionne)
      ? gcCabinetSelectionne : c;
    const grilleBase = MAPPING_CONTACTS_TARIFS[gcCabinetSelectionne] && MAPPING_CONTACTS_TARIFS[gcCabinetSelectionne] !== gcCabinetSelectionne
      ? MAPPING_CONTACTS_TARIFS[gcCabinetSelectionne] : c;
    const prix = TARIFS[clientKey]?.[code];
    const base = TARIFS_BASE[grilleBase]?.[code] ?? TARIFS_BASE[c]?.[code];
    const val = prix !== undefined ? prix : '';
    const modifie = base !== undefined && prix !== undefined && prix !== base;
    const couleur = prix === undefined ? '#ccc' : modifie ? '#e65100' : '#1a5c8a';
    const safeC = _enc(c);
    return `<td style="padding:4px 6px; text-align:center; border-right:1px solid #eee;">
      <input type="number" value="${val}" min="0" step="0.5"
        onchange="modifierTarif(decodeURIComponent('${safeC}'),'${code}',this.value)"
        style="width:72px; text-align:center; border:1px solid ${modifie ? '#ffb74d' : '#d0e0ea'}; border-radius:6px; padding:3px 4px; font-size:0.78rem; font-weight:600; color:${couleur}; background:${modifie ? '#fff8e1' : prix === undefined ? '#f5f5f5' : 'white'};"
        placeholder="${base !== undefined ? base : '—'}" title="${modifie ? 'Modifié (base Cogilog: '+base+'€)' : ''}">
    <\/td>`;
  });
  return `<tr style="background:${bg}; border-bottom:1px solid #eef2f5;">
    <td style="padding:6px 12px; font-size:0.78rem; color:#1a5c8a; font-weight:600; position:sticky; left:0; background:${bg}; border-right:1px solid #d0e0ea; white-space:nowrap;">${label}<\/td>
    <td style="padding:4px 8px; text-align:center; font-size:0.65rem; color:#888; font-family:'DM Mono',monospace; border-right:1px solid #eee;">${code}<\/td>
    ${vals.join('')}
  <\/tr>`;
}

function modifierTarif(cabinet, code, valeur) {
  // cabinet = grille Cogilog partagee (ex: "VALMY-2").
  // On cree une copie personnelle pour le client reel afin de ne pas
  // toucher la grille partagee utilisee par d autres clients.
  const clientReel = gcCabinetSelectionne || cabinet;
  const grilleSource = cabinet;

  // Creer la copie personnelle si elle n existe pas encore
  if (!TARIFS[clientReel] || clientReel !== grilleSource) {
    if (!TARIFS[clientReel] || Object.keys(TARIFS[clientReel]).length === 0) {
      TARIFS[clientReel] = Object.assign({}, TARIFS[grilleSource] || TARIFS_BASE[grilleSource] || {});
    }
    // Pointer ce client sur sa copie personnelle
    MAPPING_CONTACTS_TARIFS[clientReel] = clientReel;
    tarifsSelectedCabinets = [clientReel];
    tarifsSelectedCabinet = clientReel;
    const statDiv = document.getElementById('tarif-stat');
    if (statDiv) statDiv.innerHTML = '<span style="color:#e65100; font-weight:600;">✏️ Tarif personnalise : <b>' + clientReel + '</b></span>';
  }

  // Appliquer la modification
  const v = parseFloat(valeur);
  if (!isNaN(v) && v >= 0) {
    TARIFS[clientReel][code] = v;
  } else if (valeur === '' || valeur === null) {
    const base = (TARIFS_BASE[grilleSource] || TARIFS_BASE[clientReel] || {})[code];
    if (base !== undefined) TARIFS[clientReel][code] = base;
    else delete TARIFS[clientReel][code];
  }
  _gcAutoSaveTarif();
}

async function sauvegarderTarifs() {
  // Sauvegarder uniquement les surcharges (différences vs TARIFS_BASE)
  const surcharges = {};
  Object.entries(TARIFS).forEach(([cab, actes]) => {
    const diff = {};
    Object.entries(actes).forEach(([code, prix]) => {
      if (TARIFS_BASE[cab]?.[code] !== prix) diff[code] = prix;
    });
    if (Object.keys(diff).length) surcharges[cab] = diff;
  });
  const db = getDB();
  if (!db) { showToast('⚠️ Firebase non disponible', true); return; }
  try {
    await db.collection('tarifs').doc('surcharges').set(surcharges);
    const nbMod = Object.values(surcharges).reduce((s,v) => s + Object.keys(v).length, 0);
    showToast(`✅ Tarifs sauvegardés (${nbMod} modification${nbMod>1?'s':''})`);
    const ind = document.getElementById('gc-tarif-autosave');
    if (ind) { ind.textContent = '✅ Sauvegardé'; ind.style.color = '#2e7d32'; setTimeout(()=>{ ind.style.display='none'; }, 2000); }
  } catch(e) { showToast('❌ Erreur sauvegarde : ' + e.message, true); }
}

// AUTOSAVE TARIFS (debounce 3s)
var _gcAutoSaveTarif = debounce(() => {
  const ind = document.getElementById('gc-tarif-autosave');
  if (ind) { ind.textContent = '💾 Sauvegarde…'; ind.style.color = '#1a5c8a'; ind.style.display = 'inline'; }
  sauvegarderTarifs();
}, 3000);
// modifierTarif — désactivé (Cogilog lecture seule)

// ── RECHERCHE ACTES DANS TABLEAU ─────────────────────────────────────────────
var _gcTarifSearchFilter = '';
function gcFiltrerActesTarif() {
  _gcTarifSearchFilter = (document.getElementById('gc-tarif-search')?.value || '').toLowerCase().trim();
  afficherTableauTarif();
}

// ── AJUSTEMENT EN MASSE ───────────────────────────────────────────────────────
function gcAppliquerAjustement() { showToast("Tarifs Cogilog — lecture seule", true); }

// ── COPIER GRILLE ─────────────────────────────────────────────────────────────
function gcCopierGrille() { showToast("Tarifs Cogilog — lecture seule", true); }

function gcValiderCopieGrille(dest) {
  const source = document.getElementById('gc-copier-source')?.value;
  if (!source) { showToast('Sélectionne une grille source', true); return; }
  if (!TARIFS[source]) { showToast('Grille source introuvable', true); return; }
  TARIFS[dest] = Object.assign({}, TARIFS[source]);
  document.getElementById('popup-copier-grille').remove();
  afficherTableauTarif();
  showToast(`✅ Grille copiée depuis "${source}" → "${dest}"`);
  const ind = document.getElementById('gc-tarif-autosave');
  if (ind) { ind.textContent = '⏳ Modification…'; ind.style.color = '#e65100'; ind.style.display = 'inline'; }
  _gcAutoSaveTarif();
}
