// Module Implants (IIFE auto-contenue)
// ═══════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── State ──
  let _impRawRows = [];       // lignes brutes importees
  let _impGrouped = [];       // lignes regroupees
  let _impMarques = [];       // marques detectees
  let _impStock = {};          // stock par marque {marque: [{ref, qty, categorie, produit}]}
  let _impRefDict = {};        // dictionnaire ref → {produit, categorie, marque}
  let _impFournisseurs = [];   // fournisseurs Firebase
  let _impArchive = new Set();  // cles archivees (commandes deja validees)
  let _impChipFiltre = '';       // filtre actif via chip
  let _impVueArchive = 'en-cours'; // 'en-cours', 'archivees', 'toutes'
  let _impTabActif = 'commandes';

  // ── Modal open/close ──
  window.ouvrirModalImplants = async function() {
    document.getElementById('modal-implants').style.display = 'flex';
    await impChargerArchive();
    await impChargerRefDict();
    await impChargerStockArchive();
    await impChargerFournisseursArchive();
    await impChargerRefCats();
    await impChargerCatOrder();
    await impChargerFournisseurs();
    // Charger les donnees sauvegardees si pas deja en memoire
    if (_impRawRows.length === 0) {
      await impChargerStockDB();
      await impChargerTrackingDB();
    }
  };
  window.fermerModalImplants = function() {
    // Sauvegarde automatique en quittant
    if (_impRawRows.length > 0) {
      impSauverTrackingDB();
    }
    document.getElementById('modal-implants').style.display = 'none';
  };

  // ── Tab switching ──
  window.impSwitchTab = function(tab) {
    _impTabActif = tab;
    const btnC = document.getElementById('imp-tab-commandes-btn');
    const btnF = document.getElementById('imp-tab-fournisseurs-btn');
    const panC = document.getElementById('imp-panel-commandes');
    const panF = document.getElementById('imp-panel-fournisseurs');
    [btnC, btnF].forEach(b => b.classList.remove('active'));
    [panC, panF].forEach(p => p.style.display = 'none');
    if (tab === 'commandes') {
      btnC.classList.add('active');
      panC.style.display = 'flex';
    } else {
      btnF.classList.add('active');
      panF.style.display = 'flex';
      impRenderFournisseurs();
    }
  };

  // ── File handling ──
  window.impHandleDrop = function(e) {
    const f = e.dataTransfer.files[0];
    if (f) impHandleFile(f);
  };
  window.impHandleFile = function(file) {
    if (!file) return;
    // Afficher le nom du fichier
    document.getElementById('imp-file-name').textContent = file.name;
    document.getElementById('imp-file-info').style.display = 'block';
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellStyles: true });
        impParseWorkbook(wb);
      } catch (err) {
        showToast('❌ Erreur lecture Excel : ' + err.message, true);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Effacer l'import ──
  window.impEffacerImport = function() {
    // Effacer seulement les commandes (tracking), PAS le stock
    _impRawRows = [];
    _impGrouped = [];
    _impMarques = [];
    // _impStock est preserve — le stock reste intact
    document.getElementById('imp-order-tbody').innerHTML = '';
    document.getElementById('imp-stats').style.display = 'none';
    document.getElementById('imp-btn-pdf').style.display = 'none';
    if (document.getElementById('imp-btn-email')) document.getElementById('imp-btn-email').style.display = 'none';
    document.getElementById('imp-btn-valider').style.display = 'none';
    document.getElementById('imp-btn-annuler').style.display = 'none';
    document.getElementById('imp-btn-clear').style.display = 'none';
    document.getElementById('imp-vue-toggle').style.display = 'none';
    document.getElementById('imp-date-filters').style.display = 'none';
    _impVueArchive = 'en-cours';
    document.getElementById('imp-file-info').style.display = 'none';
    document.getElementById('imp-empty-msg').style.display = 'block';
    document.getElementById('imp-file-input').value = '';
    document.getElementById('imp-filtre-marque').innerHTML = '<option value="">Toutes les marques</option>';
    document.getElementById('imp-date-from').value = '';
    document.getElementById('imp-date-to').value = '';
    // Effacer seulement le tracking en Firebase (pas le stock)
    try {
      const db = window._db || firebase.firestore();
      db.collection('meta').doc('implant_tracking_data').delete();
    } catch(e) {}
    showToast('Import effacé (local + Firebase)');
  };

  // ── Archive : cle unique pour chaque ligne tracking ──
  function impRowKey(row) {
    // Cle = marque + codeLabo + reference piece + date (pour eviter que 2 mois differents partagent la meme cle)
    const dateKey = row._dateMs ? new Date(row._dateMs).toISOString().slice(0, 10) : '';
    return [row.marque || '', row.codeLabo || '', row.reference || '', dateKey].join('|').toUpperCase();
  }

  // ── Charger l'archive depuis Firebase ──
  async function impChargerArchive() {
    try {
      const db = window._db || firebase.firestore();
      const doc = await db.collection('meta').doc('implant_archive').get();
      if (doc.exists) {
        _impArchive = new Set(doc.data().keys || []);
      }
    } catch (e) {
      _impArchive = new Set();
    }
  }

  // ── Sauvegarder l'archive dans Firebase ──
  async function impSauverArchive() {
    try {
      const db = window._db || firebase.firestore();
      await db.collection('meta').doc('implant_archive').set({ keys: Array.from(_impArchive) });
    } catch (e) {
      showToast('❌ Erreur sauvegarde archive : ' + e.message, true);
    }
  }

  // ── Marquer les lignes archivees (sans les supprimer) ──
  function impMarquerArchive(rows) {
    rows.forEach(r => {
      r._archived = _impArchive.has(impRowKey(r));
    });
  }

  // ── Snapshot pour undo ──
  let _impArchiveSnapshot = null; // copie de _impArchive AVANT la derniere validation

  // ── Bouton "Valider commande" : archive les lignes en cours visibles ──
  window.impValiderCommande = function() {
    const enCours = _impRawRows.filter(r => !r._archived);
    if (!enCours.length) { showToast('Aucune ligne en cours à valider', true); return; }
    // Sauvegarder le snapshot AVANT modification (pour undo)
    _impArchiveSnapshot = new Set(_impArchive);
    enCours.forEach(r => { _impArchive.add(impRowKey(r)); r._archived = true; });
    impSauverArchive();
    showToast('✅ ' + enCours.length + ' cas validés et archivés');
    impAppliquerFiltres();
  };

  // ── Bouton "Vider archive" : remet tout en cours ──
  window.impViderArchive = function() {
    if (!_impArchive.size) { showToast('Archive deja vide', true); return; }
    if (!confirm('Vider l\'archive ? Toutes les commandes repasseront en "en cours".')) return;
    _impArchiveSnapshot = new Set(_impArchive);
    _impArchive.clear();
    impMarquerArchive(_impRawRows);
    impSauverArchive();
    _impVueArchive = 'en-cours';
    showToast('Archive videe — ' + _impRawRows.length + ' lignes en cours');
    impAppliquerFiltres();
  };

  // ── Bouton "Annuler validation" : restaure le snapshot (ctrl+z) ──
  window.impAnnulerValidation = function() {
    if (!_impArchiveSnapshot) { showToast('Rien à annuler', true); return; }
    // Restaurer l'archive au snapshot
    _impArchive = _impArchiveSnapshot;
    _impArchiveSnapshot = null;
    // Re-marquer toutes les lignes selon le snapshot restaure
    impMarquerArchive(_impRawRows);
    impSauverArchive();
    // Revenir sur la vue "en cours"
    _impVueArchive = 'en-cours';
    showToast('↩ Validation annulée — état précédent restauré');
    impAppliquerFiltres();
  };

  // ══════════════════════════════════════
  // BLOC 2 : IMPORT EXCEL
  // ══════════════════════════════════════

  function impParseWorkbook(wb) {
    const newRows = [];
    _impStock = {};
    const marqueSet = new Set();

    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws['!ref']) continue;
      const nl = name.toLowerCase();
      if (nl.includes('résumé') || nl.includes('resume') || nl.includes('exportation') || nl.includes('list of customer')) continue;

      const headers = impGetHeaders(ws);

      if (headers.codeLab >= 0 && headers.reference >= 0 && headers.qtyUsed >= 0) {
        const marque = impExtrairMarque(name);
        if (marque) marqueSet.add(marque);
        const rows = impParseTracking(ws, headers, marque);
        newRows.push(...rows);
      }
      else if (headers.refStock >= 0 && headers.qtyStock >= 0 && headers.codeLab < 0) {
        const marque = impExtrairMarque(name);
        if (marque) {
          _impStock[marque] = impParseStock(ws, headers);
          marqueSet.add(marque);
        }
      }
    }

    // Merger avec les donnees Firebase existantes
    const existingKeys = new Set(_impRawRows.map(r => impRowKey(r)));
    let nbNouvelles = 0;
    newRows.forEach(r => {
      const key = impRowKey(r);
      if (!existingKeys.has(key)) {
        _impRawRows.push(r);
        existingKeys.add(key);
        nbNouvelles++;
      }
    });

    // Mettre a jour les marques
    _impRawRows.forEach(r => { if (r.marque) marqueSet.add(r.marque); });
    _impMarques = Array.from(marqueSet).sort();
    impRemplirFiltreMarques();

    // Auto-creer les fournisseurs
    impAutoCreerFournisseurs();

    // Construire le dictionnaire de references depuis les feuilles Stock
    _impRefDict = {};
    Object.entries(_impStock).forEach(([marque, items]) => {
      items.forEach(item => {
        if (item.ref && !_impRefDict[item.ref]) {
          _impRefDict[item.ref] = { produit: item.produit || '', categorie: item.categorie || '', marque };
        }
      });
    });

    // Sauvegarder le stock en Firebase
    impSauverStockDB();

    // Filtrer les lignes archivees
    const totalAvantArchive = _impRawRows.length;
    impMarquerArchive(_impRawRows);
    const archivees = totalAvantArchive - _impRawRows.length;

    // Sauvegarder les lignes tracking en Firebase
    impSauverTrackingDB();

    // Enrichir + grouper + afficher
    enrichImplantRows(_impRawRows);
    impAppliquerFiltres();

    const archiveMsg = archivees > 0 ? ' (' + archivees + ' déjà commandées)' : '';
    showToast('📦 ' + nbNouvelles + ' nouvelles pièces importées' + archiveMsg);
  }

  // ── Persistence Firebase : tracking ──
  async function impSauverTrackingDB() {
    try {
      const db = window._db || firebase.firestore();
      // Serialiser les lignes (sans fonctions ni Maps)
      // On sauvegarde les donnees BRUTES (sans enrichissement) pour que le re-enrichissement
      // se fasse proprement au rechargement
      const data = _impRawRows.map(r => ({
        marque: r.marque || '', codeLabo: r.codeLabo || '', codeRX: r.codeRX || '',
        customer: r.customer || '', patient: r.patient || '', reference: r.reference || '',
        quantite: r.quantite || 0, cabinet: r.cabinet || '', _dateMs: r._dateMs || 0
      }));
      await db.collection('meta').doc('implant_tracking_data').set({ rows: data, updatedAt: Date.now() });
    } catch (e) {
      console.warn('[Implants] Erreur sauvegarde tracking:', e.message);
    }
  }

  async function impChargerTrackingDB() {
    try {
      const db = window._db || firebase.firestore();
      const doc = await db.collection('meta').doc('implant_tracking_data').get();
      if (doc.exists && doc.data().rows) {
        _impRawRows = doc.data().rows;
        // Forcer reset cabinet/patient pour re-enrichir proprement a chaque chargement
        // Re-enrichir seulement les lignes qui n'ont PAS de cabinet/patient deja sauvegarde
        // (les edits manuels sont preserves)
        // Reconstituer les marques
        const marqueSet = new Set();
        _impRawRows.forEach(r => { if (r.marque) marqueSet.add(r.marque); });
        _impMarques = Array.from(marqueSet).sort();
        impRemplirFiltreMarques();
        // Filtrer archive
        impMarquerArchive(_impRawRows);
        // Enrichir et afficher (toujours re-enrichir depuis les prescriptions actuelles)
        enrichImplantRows(_impRawRows);
        impAppliquerFiltres();
        // Montrer les controles si on a des donnees
        if (_impRawRows.length > 0) {
          document.getElementById('imp-file-info').style.display = 'block';
          document.getElementById('imp-file-name').textContent = 'Données sauvegardées';
        }
      }
    } catch (e) {
      console.warn('[Implants] Erreur chargement tracking:', e.message);
    }
  }

  // ── Persistence Firebase : stock ──
  async function impSauverStockDB() {
    try {
      const db = window._db || firebase.firestore();
      await db.collection('meta').doc('implant_stock_data').set({ stock: _impStock, updatedAt: Date.now() });
    } catch (e) {
      console.warn('[Implants] Erreur sauvegarde stock:', e.message);
    }
  }

  async function impChargerStockDB() {
    try {
      const db = window._db || firebase.firestore();
      const doc = await db.collection('meta').doc('implant_stock_data').get();
      if (doc.exists && doc.data().stock) {
        _impStock = doc.data().stock;
        // Reconstruire le dictionnaire de references
        _impRefDict = {};
        Object.entries(_impStock).forEach(([marque, items]) => {
          if (!Array.isArray(items)) return;
          items.forEach(item => {
            if (item.ref && !_impRefDict[item.ref]) {
              _impRefDict[item.ref] = { produit: item.produit || '', categorie: item.categorie || '', marque };
            }
          });
        });
      }
    } catch (e) {
      console.warn('[Implants] Erreur chargement stock:', e.message);
    }
  }

  // Utilitaire : description d'une reference (fichier externe implant-refs.js > dict Excel)
  function impRefDesc(ref) {
    if (!ref) return '';
    const r = ref.trim();
    const dict = window.IMPLANT_REF_DICT || {};
    // 1. Chercher dans le dict statique (implant-refs.js)
    if (dict[r]) return dict[r];
    // 2. Chercher dans le dict dynamique (Excel)
    const d = _impRefDict[r] || _impRefDict[r.toUpperCase()] || _impRefDict[r.toLowerCase()];
    if (d && d.produit) return d.produit + (d.categorie ? ' (' + d.categorie.split('(')[0].trim() + ')' : '');
    return '';
  }

  // Auto-creer les fournisseurs depuis les marques detectees dans l'Excel
  async function impAutoCreerFournisseurs() {
    let changed = false;
    for (const marque of _impMarques) {
      const exists = _impFournisseurs.some(f =>
        f.nom.toLowerCase() === marque.toLowerCase()
      );
      if (!exists) {
        _impFournisseurs.push({
          id: 'four_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          nom: marque,
          email: '',
          logoUrl: '',
          notes: 'Auto-créé depuis import Excel',
          createdAt: Date.now()
        });
        changed = true;
      }
    }
    if (changed) {
      await impSauverFournisseursDB();
    }
  }

  function impGetHeaders(ws) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    const h = { codeLab: -1, codeRX: -1, reference: -1, qtyUsed: -1, customer: -1, patient: -1, date: -1, refStock: -1, qtyStock: -1, catStock: -1, prodStock: -1 };
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (!cell) continue;
      const v = String(cell.v || '').toLowerCase().trim();
      if (v.includes('code lab')) h.codeLab = c;
      else if (v.includes('code rx')) h.codeRX = c;
      else if (v === 'reference' || v === 'référence') {
        if (h.codeLab >= 0) h.reference = c; else h.refStock = c;
      }
      else if (v.includes('quantity used') || v.includes('quantité utilisée')) h.qtyUsed = c;
      else if (v === 'quantity' || v === 'quantité') h.qtyStock = c;
      else if (v.includes('customer')) h.customer = c;
      else if (v.includes('patient') || v.includes('name of patient')) h.patient = c;
      else if (v === 'date') h.date = c;
    }
    // Fallback pour feuilles Stock sans header "Code Lab"
    if (h.refStock < 0 && h.codeLab < 0) {
      for (let c = 0; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
        if (!cell) continue;
        const v = String(cell.v || '').toLowerCase().trim();
        if (v === 'reference' || v === 'référence') h.refStock = c;
        if (v === 'quantity' || v === 'quantité') h.qtyStock = c;
        if (v.includes('categ') || v === 'category' || v === 'catégorie') h.catStock = c;
        if (v.includes('product') || v === 'produit') h.prodStock = c;
      }
    }
    return h;
  }

  function impExtrairMarque(sheetName) {
    const n = sheetName.toLowerCase();
    if (n.includes('biotech') && !n.includes('alpha')) return 'Biotech';
    if (n.includes('alphabio') || n.includes('alpha bio')) return 'AlphaBio';
    if (n.includes('deep')) return 'Deep';
    if (n.includes('zimmer')) return 'Zimmer';
    if (n.includes('etk')) return 'ETk';
    if (n.includes('idi')) return 'IDI';
    if (n.includes('neodent')) return 'Neodent';
    if (n.includes('osstem')) return 'Osstem';
    if (n.includes('nobel')) return 'Nobel Biocare';
    if (n.includes('dentium')) return 'Dentium';
    if (n.includes('access')) return 'Access Implant';
    if (n.includes('straumann')) return 'Straumann';
    if (n.includes('zest')) return 'Zest Dental';
    if (n.includes('kerator')) return 'Kerator';
    // Fallback : premier mot significatif
    const words = sheetName.replace(/stock|tracking|tableau|\d+|-/gi, '').trim().split(/\s+/);
    return words[0] || sheetName;
  }

  function impParseTracking(ws, headers, marque) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    const rows = [];
    for (let r = 1; r <= range.e.r; r++) {
      const ref = impCellVal(ws, r, headers.reference);
      const qty = impCellNum(ws, r, headers.qtyUsed);
      if (!ref || qty <= 0) continue;

      // Convertir date Excel (serial number) en timestamp ms
      let dateMs = 0;
      if (headers.date >= 0) {
        const dateCell = ws[XLSX.utils.encode_cell({ r, c: headers.date })];
        if (dateCell && typeof dateCell.v === 'number') {
          // Excel serial date → JS Date (epoch Excel = 1900-01-01, ajuster -2 jours)
          dateMs = (dateCell.v - 25569) * 86400000;
        }
      }

      rows.push({
        marque: marque,
        codeLabo: impCellVal(ws, r, headers.codeLab).toUpperCase().trim(),
        codeRX: impCellVal(ws, r, headers.codeRX).trim(),
        customer: impCellVal(ws, r, headers.customer).trim(),
        patient: impCellVal(ws, r, headers.patient).trim(),
        reference: ref.trim(),
        quantite: qty,
        cabinet: '',  // sera enrichi
        _row: r,
        _dateMs: dateMs
      });
    }
    return rows;
  }

  function impParseStock(ws, headers) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    const seen = new Map(); // deduplication par ref normalisee
    let lastCat = '', lastProd = '';
    for (let r = 1; r <= range.e.r; r++) {
      const ref = impCellVal(ws, r, headers.refStock);
      if (!ref) continue;
      const cat = impCellVal(ws, r, headers.catStock).trim() || lastCat;
      const prod = impCellVal(ws, r, headers.prodStock).trim() || lastProd;
      if (impCellVal(ws, r, headers.catStock).trim()) lastCat = cat;
      if (impCellVal(ws, r, headers.prodStock).trim()) lastProd = prod;
      const qty = impCellNum(ws, r, headers.qtyStock);
      const refClean = ref.trim();
      // Deduplication : si meme ref (ou variante sans leading zero) deja vue, cumuler
      const key = refClean.replace(/^0+/, '') || refClean;
      if (seen.has(key)) {
        const existing = seen.get(key);
        existing.qty += qty;
      } else {
        const item = { ref: refClean, qty, categorie: cat, produit: prod };
        seen.set(key, item);
      }
    }
    return Array.from(seen.values());
  }

  function impCellVal(ws, r, c) {
    if (c < 0) return '';
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    return cell ? String(cell.v ?? '') : '';
  }
  function impCellNum(ws, r, c) {
    if (c < 0) return 0;
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell) return 0;
    const n = parseFloat(cell.v);
    return isNaN(n) ? 0 : Math.max(0, Math.round(n));
  }

  // ══════════════════════════════════════
  // BLOC 3 : ENRICHISSEMENT
  // ══════════════════════════════════════

  function enrichImplantRows(rows) {
    const prescriptions = window.prescriptions || [];

    // Utilitaire : extraire timestamp ms d'une prescription
    function getPrescriptionTs(p) {
      const ts = p._ts || p.createdAt;
      if (typeof ts === 'number' && ts > 1e12) return ts;
      if (typeof ts === 'number' && ts > 1e9) return ts * 1000;
      if (typeof ts === 'string') {
        let d;
        if (ts.includes('/')) {
          const [dd, mm, yy] = ts.split('/');
          d = new Date(yy.length === 2 ? '20' + yy : yy, mm - 1, dd);
        } else d = new Date(ts);
        if (d && !isNaN(d)) return d.getTime();
      }
      return 0;
    }

    // Filtre : prescription avec implants
    function hasImplant(p) {
      const conj = p.conjointe || [];
      return conj.some(v => typeof v === 'string' && v.toLowerCase().includes('implant'));
    }

    // Verifier coherence de date :
    // La prescription est creee AVANT la ligne Excel (on envoie le cas, le fournisseur pioche dans le stock)
    // Delai typique : 0 a 10 jours. On prend 20 jours de marge.
    // Donc : dateExcel >= datePrescription ET dateExcel <= datePrescription + 20 jours
    const WINDOW_AFTER_MS = 20 * 24 * 60 * 60 * 1000;
    function datesCoherent(rowDateMs, prescTs) {
      if (!rowDateMs || !prescTs) return false;
      const delta = rowDateMs - prescTs; // positif si Excel apres prescription
      return delta >= 0 && delta <= WINDOW_AFTER_MS;
    }

    // Index par code_labo — prescriptions avec implants uniquement
    const indexByCode = {};
    prescriptions.forEach(p => {
      if (!hasImplant(p)) return;
      const cl = (p.code_labo || '').toUpperCase().trim();
      if (cl) {
        // Stocker TOUTES les prescriptions pour ce code (il peut y avoir des doublons dans le temps)
        if (!indexByCode[cl]) indexByCode[cl] = [];
        indexByCode[cl].push(p);
      }
    });

    // Index par numero_prescription — prescriptions avec implants uniquement
    const indexByNum = {};
    prescriptions.forEach(p => {
      if (!hasImplant(p)) return;
      const num = String(p.numero_prescription || p.numero || '').trim();
      if (num && !indexByNum[num]) indexByNum[num] = p;
      const numClean = num.replace(/^0+/, '');
      if (numClean && !indexByNum[numClean]) indexByNum[numClean] = p;
    });

    // Trouver la meilleure prescription pour un code labo + date
    function findBestMatch(codeLabo, rowDateMs) {
      const candidates = indexByCode[codeLabo];
      if (!candidates || !candidates.length) return null;
      // Si une seule candidate et dates coherentes → ok
      // Si plusieurs → prendre celle dont la date est la plus proche
      let best = null, bestDelta = Infinity;
      for (const p of candidates) {
        const pTs = getPrescriptionTs(p);
        if (!datesCoherent(rowDateMs, pTs)) continue;
        const delta = Math.abs((rowDateMs || 0) - pTs);
        if (delta < bestDelta) { best = p; bestDelta = delta; }
      }
      return best;
    }

    // DEBUG: compteurs
    let _dbgMatched = 0, _dbgSkipped = 0;

    rows.forEach(row => {
      if (!row.codeLabo) row.codeLabo = 'SCAN';

      let matched = null;
      let matchSource = '';

      const hasCodeRX = row.codeRX && String(row.codeRX).trim().length > 0;

      if (hasCodeRX) {
        // Numero de fiche present → match 100% ou rien (pas de fallback code labo)
        const rxClean = String(row.codeRX).trim();
        const p = indexByNum[rxClean] || indexByNum[rxClean.replace(/^0+/, '')];
        if (p && hasImplant(p)) {
          const pTs = getPrescriptionTs(p);
          if (datesCoherent(row._dateMs, pTs)) { matched = p; matchSource = 'codeRX'; }
        }
        // Essayer format "LETTRE-NUMERO" (ex: "T55-155068")
        if (!matched && row.codeRX.includes('-')) {
          const parts = row.codeRX.split('-');
          if (parts.length === 2) {
            const p2 = indexByNum[parts[1]];
            if (p2 && hasImplant(p2)) {
              const pTs2 = getPrescriptionTs(p2);
              if (datesCoherent(row._dateMs, pTs2)) { matched = p2; matchSource = 'codeRX-split'; }
            }
          }
        }
        // Si pas de match → on laisse vide, PAS de fallback code labo
      } else {
        // Pas de numero de fiche → chercher par code labo (seule option)
        if (row.codeLabo && row.codeLabo !== 'SCAN') {
          matched = findBestMatch(row.codeLabo, row._dateMs);
          if (matched) matchSource = 'code_labo';
        }
      }

      // DEBUG: log chaque match
      if (matched) {
        _dbgMatched++;
        const rowDate = row._dateMs ? new Date(row._dateMs).toLocaleDateString('fr-FR') : 'no-date';
        const pTs = getPrescriptionTs(matched);
        const prescDate = pTs ? new Date(pTs).toLocaleDateString('fr-FR') : 'no-date';
        const delta = row._dateMs && pTs ? ((row._dateMs - pTs) / 86400000).toFixed(1) : 'N/A';
        console.log('[IMP MATCH]', row.codeLabo, '| Excel:', rowDate, '| Prescription:', prescDate, '| delta(j):', delta, '| via:', matchSource, '| cabinet:', matched.cabinet, '| patient:', matched.patient_nom || (matched.patient && matched.patient.nom));
      }

      if (matched) {
        // Enrichir cabinet
        if (!row.cabinet && !row.customer) {
          row.cabinet = matched.cabinet || '';
          // Enrichir avec COGILOG_CLIENTS pour un nom plus propre
          if (matched.code_cogilog && typeof COGILOG_CLIENTS !== 'undefined') {
            const cog = COGILOG_CLIENTS[matched.code_cogilog];
            if (cog && cog[3]) row.cabinet = cog[3];
          }
        }
        // Enrichir patient
        if (!row.patient) {
          const pNom = matched.patient_nom || (matched.patient && matched.patient.nom) || '';
          if (pNom) row.patient = pNom;
        }
        // Enrichir codeRX (numero de fiche) si vide
        if (!row.codeRX) {
          row.codeRX = String(matched.numero_prescription || matched.numero || '').trim();
        }
      }

      // Si cabinet toujours vide mais customer rempli dans Excel
      if (!row.cabinet && row.customer) {
        row.cabinet = row.customer;
      }

      // Nettoyage
      row.cabinet = (row.cabinet || '').trim().toUpperCase();
      row.patient = (row.patient || '').trim();
    });
  }

  // ══════════════════════════════════════
  // BLOC 4+5 : REGROUPEMENT + TOTAUX
  // ══════════════════════════════════════

  function groupImplantRows(rows) {
    // Grouper les lignes du meme code labo + meme marque qui sont proches en date (< 5 jours)
    // Un meme code labo reutilise des semaines plus tard = nouveau groupe
    const PROXIMITY_MS = 5 * 86400000; // 5 jours
    const map = new Map();
    // Pour chaque marque+codeLabo, stocker le dernier groupe et sa date max
    const lastGroup = new Map(); // baseKey → { key, maxDate }

    rows.forEach(row => {
      const baseKey = (row.marque || '') + '|' + (row.codeLabo || '').toUpperCase().trim();
      const rowDate = row._dateMs || 0;
      let key;

      const last = lastGroup.get(baseKey);
      if (last && rowDate && last.maxDate && Math.abs(rowDate - last.maxDate) < PROXIMITY_MS) {
        // Proche du dernier groupe → fusionner
        key = last.key;
      } else {
        // Nouveau groupe (premier ou trop eloigne en date)
        key = baseKey + '|' + (rowDate || Math.random());
        lastGroup.set(baseKey, { key, maxDate: rowDate });
      }

      // Mettre a jour la date max du groupe
      const lg = lastGroup.get(baseKey);
      if (lg && lg.key === key && rowDate > lg.maxDate) lg.maxDate = rowDate;

      if (!map.has(key)) {
        map.set(key, {
          cabinet: row.cabinet,
          codeLabo: row.codeLabo,
          patient: row.patient,
          reference: row.codeRX,
          pieces: new Map(),
          marque: row.marque,
          dateMs: rowDate
        });
      }
      const g = map.get(key);
      if (!g.cabinet && row.cabinet) g.cabinet = row.cabinet;
      if (!g.patient && row.patient) g.patient = row.patient;
      if (!g.reference && row.codeRX) g.reference = row.codeRX;
      if (rowDate && rowDate > g.dateMs) g.dateMs = rowDate;
      const prevQty = g.pieces.get(row.reference) || 0;
      g.pieces.set(row.reference, prevQty + row.quantite);
    });

    // Convertir — PAS de tri, on garde l'ordre d'insertion (= ordre Excel)
    return Array.from(map.values()).map(g => ({
      cabinet: g.cabinet,
      codeLabo: g.codeLabo,
      patient: g.patient,
      reference: g.reference,
      marque: g.marque,
      dateMs: g.dateMs,
      dateStr: g.dateMs ? new Date(g.dateMs).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '',
      piecesMap: g.pieces,
      piecesText: formatPieces(g.pieces, ' ; ', 3)
    }));
  }

  function computeCabinetTotals(grouped) {
    // Cumuler par cabinet (seulement pour les lignes qui ONT un cabinet)
    const totals = new Map();
    grouped.forEach(row => {
      const cab = row.cabinet || '';
      if (!cab) return; // pas de total pour les lignes sans cabinet
      if (!totals.has(cab)) totals.set(cab, new Map());
      const cabMap = totals.get(cab);
      row.piecesMap.forEach((qty, ref) => {
        cabMap.set(ref, (cabMap.get(ref) || 0) + qty);
      });
    });

    // Marquer la premiere ligne de chaque cabinet
    let lastCab = null;
    grouped.forEach(row => {
      const cab = row.cabinet || '';
      if (!cab) {
        // Pas de cabinet → pas de total cabinet, chaque ligne est independante
        row.totalCabinet = '';
        return;
      }
      if (cab !== lastCab) {
        const cabMap = totals.get(cab);
        row.totalCabinet = cabMap ? formatPieces(cabMap, ' / ', 3) : '';
        lastCab = cab;
      } else {
        row.totalCabinet = '';
      }
    });

    return grouped;
  }

  function formatPieces(map, separator, wrapEvery) {
    const parts = [];
    map.forEach((qty, ref) => {
      parts.push(ref + ' ×' + qty);
    });
    const lines = [];
    for (let i = 0; i < parts.length; i += wrapEvery) {
      lines.push(parts.slice(i, i + wrapEvery).join(separator));
    }
    return lines.join('\n');
  }

  // Version HTML des pieces avec tooltips descriptifs
  function formatPiecesHTML(map, separator, wrapEvery) {
    const parts = [];
    map.forEach((qty, ref) => {
      const desc = impRefDesc(ref);
      const tip = desc ? ' title="' + escT(desc).replace(/"/g, '&quot;') + '"' : '';
      parts.push('<span' + tip + ' style="' + (desc ? 'border-bottom:1px dotted #aaa;cursor:help;' : '') + '">' + escT(ref) + ' ×' + qty + '</span>');
    });
    const lines = [];
    for (let i = 0; i < parts.length; i += wrapEvery) {
      lines.push(parts.slice(i, i + wrapEvery).join(separator));
    }
    return lines.join('<br>');
  }

  function wrapLongName(text, maxWords) {
    if (!text) return '';
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text;
    const lines = [];
    for (let i = 0; i < words.length; i += maxWords) {
      lines.push(words.slice(i, i + maxWords).join(' '));
    }
    return lines.join('\n');
  }

  // ══════════════════════════════════════
  // FILTRES + STATS
  // ══════════════════════════════════════

  function impRemplirFiltreMarques() {
    const sel = document.getElementById('imp-filtre-marque');
    sel.innerHTML = '<option value="">Toutes les marques</option>';
    _impMarques.forEach(m => {
      sel.innerHTML += '<option value="' + m + '">' + m + '</option>';
    });
  }

  window.impSetVueArchive = function(vue) {
    _impVueArchive = vue;
    impAppliquerFiltres();
  };

  window.impAppliquerFiltres = function() {
    let filtered = _impRawRows;
    // Filtre archive (en-cours / archivees / toutes)
    if (_impVueArchive === 'en-cours') {
      filtered = filtered.filter(r => !r._archived);
    } else if (_impVueArchive === 'archivees') {
      filtered = filtered.filter(r => r._archived);
    }
    // Filtre marque
    const marqueFiltre = document.getElementById('imp-filtre-marque').value;
    if (marqueFiltre) {
      filtered = filtered.filter(r => r.marque === marqueFiltre);
    }
    // Filtre date
    const dateFrom = document.getElementById('imp-date-from').value;
    const dateTo = document.getElementById('imp-date-to').value;
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      filtered = filtered.filter(r => !r._dateMs || r._dateMs >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000;
      filtered = filtered.filter(r => !r._dateMs || r._dateMs < to);
    }

    // Grouper d'abord (avant filtre chip, car le chip filtre sur les lignes groupees)
    let grouped = groupImplantRows(filtered);
    computeCabinetTotals(grouped);

    // Filtre chip (sur les lignes groupees)
    if (_impChipFiltre === 'enrichies') {
      grouped = grouped.filter(r => r.cabinet);
    } else if (_impChipFiltre === 'non-trouvees') {
      grouped = grouped.filter(r => !r.cabinet);
    } else if (_impChipFiltre.startsWith('cab:')) {
      const cabVal = _impChipFiltre.slice(4);
      grouped = grouped.filter(r => (r.cabinet || '') === cabVal);
    } else if (_impChipFiltre.startsWith('marque:')) {
      const marqueVal = _impChipFiltre.slice(7);
      grouped = grouped.filter(r => (r.marque || '') === marqueVal);
    }

    _impGrouped = grouped;
    renderImplantTable(_impGrouped);
    impUpdateStats(filtered, _impGrouped);
  };

  // Toggle filtre chip
  window.impToggleChip = function(chip, value) {
    if (value !== undefined) {
      // Filtre par valeur specifique (cabinet ou marque)
      _impChipFiltre = chip + ':' + value;
    } else {
      _impChipFiltre = (_impChipFiltre === chip) ? '' : chip;
    }
    impAppliquerFiltres();
  };

  function impUpdateStats(raw, grouped) {
    const statsDiv = document.getElementById('imp-stats');
    const btnPdf = document.getElementById('imp-btn-pdf');
    const btnValider = document.getElementById('imp-btn-valider');
    const btnAnnuler = document.getElementById('imp-btn-annuler');
    const btnClear = document.getElementById('imp-btn-clear');
    const vueToggle = document.getElementById('imp-vue-toggle');
    const dateFilters = document.getElementById('imp-date-filters');
    const emptyMsg = document.getElementById('imp-empty-msg');

    if (_impRawRows.length === 0) {
      statsDiv.style.display = 'none';
      btnPdf.style.display = 'none';
      if (document.getElementById('imp-btn-email')) document.getElementById('imp-btn-email').style.display = 'none';
      btnValider.style.display = 'none';
      btnAnnuler.style.display = 'none';
      btnClear.style.display = 'none';
      vueToggle.style.display = 'none';
      dateFilters.style.display = 'none';
      emptyMsg.style.display = 'block';
      return;
    }

    const hasArchived = _impRawRows.some(r => r._archived);
    const hasEnCours = _impRawRows.some(r => !r._archived);

    emptyMsg.style.display = 'none';
    statsDiv.style.display = 'flex';
    btnPdf.style.display = 'inline-block';
    if (document.getElementById('imp-btn-email')) document.getElementById('imp-btn-email').style.display = 'inline-block';
    dateFilters.style.display = 'flex';
    btnClear.style.display = 'inline-block';

    // Afficher le toggle archive seulement s'il y a des archivees
    vueToggle.style.display = hasArchived ? 'inline-flex' : 'none';
    if (document.getElementById('imp-btn-vider-archive')) document.getElementById('imp-btn-vider-archive').style.display = hasArchived ? 'inline-block' : 'none';
    // Boutons contextuels
    btnValider.style.display = (_impVueArchive !== 'archivees' && hasEnCours) ? 'inline-block' : 'none';
    btnAnnuler.style.display = (_impVueArchive === 'archivees' && hasArchived) ? 'inline-block' : 'none';

    // Styler le toggle actif
    ['en-cours', 'archivees', 'toutes'].forEach(v => {
      const btn = document.getElementById('imp-vue-' + v);
      if (v === _impVueArchive) {
        btn.style.background = '#2e7d32'; btn.style.color = 'white';
      } else {
        btn.style.background = 'white'; btn.style.color = '#888';
      }
    });

    const cabinets = new Set(grouped.map(r => r.cabinet).filter(Boolean));
    const enriched = grouped.filter(r => r.cabinet).length;

    // Style actif pour le chip selectionne
    const ac = (chip) => _impChipFiltre === chip ? 'outline:2px solid currentColor;outline-offset:1px;cursor:pointer;' : 'cursor:pointer;opacity:0.85;';
    const nonTrouvees = grouped.filter(r => !r.cabinet).length;

    // Listes pour les dropdowns
    const cabList = Array.from(cabinets).sort();
    const marquesList = Array.from(new Set(_impRawRows.map(r => r.marque).filter(Boolean))).sort();

    // Chip actif : afficher le nom du filtre
    const isChipCab = _impChipFiltre.startsWith('cab:');
    const isChipMarque = _impChipFiltre.startsWith('marque:');
    const chipCabVal = isChipCab ? _impChipFiltre.slice(4) : '';
    const chipMarqueVal = isChipMarque ? _impChipFiltre.slice(7) : '';

    // Cabinet dropdown
    let cabDropdown = '<span style="position:relative;display:inline-block;">' +
      '<span class="imp-stat-chip" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'block\'?\'none\':\'block\'" style="background:#fff3e0;color:#e65100;' + (isChipCab ? 'outline:2px solid #e65100;outline-offset:1px;' : '') + 'cursor:pointer;">' +
      (isChipCab ? chipCabVal : cabinets.size + ' cabinets') + '</span>' +
      '<div style="display:none;position:absolute;top:100%;left:0;background:white;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:99;max-height:250px;overflow-y:auto;min-width:200px;padding:4px 0;margin-top:4px;">';
    cabList.forEach(c => {
      const cEsc = c.replace(/'/g, "\\'");
      cabDropdown += '<div onclick="impToggleChip(\'cab\',\'' + cEsc + '\');this.parentElement.style.display=\'none\'" style="padding:5px 12px;font-size:0.74rem;cursor:pointer;white-space:nowrap;' + (chipCabVal === c ? 'background:#fff3e0;font-weight:700;' : '') + '" onmouseover="this.style.background=\'#f5f5f5\'" onmouseout="this.style.background=\'' + (chipCabVal === c ? '#fff3e0' : 'white') + '\'">' + escT(c) + '</div>';
    });
    cabDropdown += '</div></span>';

    // Marque dropdown
    let marqueDropdown = '<span style="position:relative;display:inline-block;">' +
      '<span class="imp-stat-chip" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'block\'?\'none\':\'block\'" style="background:#f3e5f5;color:#6a1b9a;' + (isChipMarque ? 'outline:2px solid #6a1b9a;outline-offset:1px;' : '') + 'cursor:pointer;">' +
      (isChipMarque ? chipMarqueVal : marquesList.length + ' marques') + '</span>' +
      '<div style="display:none;position:absolute;top:100%;left:0;background:white;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:99;max-height:250px;overflow-y:auto;min-width:180px;padding:4px 0;margin-top:4px;">';
    marquesList.forEach(m => {
      const mEsc = m.replace(/'/g, "\\'");
      marqueDropdown += '<div onclick="impToggleChip(\'marque\',\'' + mEsc + '\');this.parentElement.style.display=\'none\'" style="padding:5px 12px;font-size:0.74rem;cursor:pointer;white-space:nowrap;' + (chipMarqueVal === m ? 'background:#f3e5f5;font-weight:700;' : '') + '" onmouseover="this.style.background=\'#f5f5f5\'" onmouseout="this.style.background=\'' + (chipMarqueVal === m ? '#f3e5f5' : 'white') + '\'">' + escT(m) + '</div>';
    });
    marqueDropdown += '</div></span>';

    statsDiv.innerHTML =
      '<span class="imp-stat-chip" style="background:#e3f2fd;color:#0277bd;">' + grouped.length + ' cas</span>' +
      '<span class="imp-stat-chip" onclick="impToggleChip(\'enrichies\')" style="background:#e8f5e9;color:#2e7d32;' + ac('enrichies') + '">' + enriched + ' enrichies</span>' +
      '<span class="imp-stat-chip" onclick="impToggleChip(\'non-trouvees\')" style="background:#fce4ec;color:#c62828;' + ac('non-trouvees') + '">' + nonTrouvees + ' non trouvées</span>' +
      cabDropdown +
      marqueDropdown +
      (_impChipFiltre ? '<span class="imp-stat-chip" onclick="impToggleChip(\'\')" style="background:#eee;color:#555;cursor:pointer;">✕ Retirer filtre</span>' : '');
  }

  // ══════════════════════════════════════
  // BLOC 6 : RENDU TABLEAU HTML
  // ══════════════════════════════════════

  function renderImplantTable(data) {
    const tbody = document.getElementById('imp-order-tbody');
    if (!data.length) {
      tbody.innerHTML = '';
      return;
    }

    let html = '';
    let lastCab = null;
    let cabIdx = 0;

    data.forEach((row, idx) => {
      const cab = row.cabinet || '';
      if (cab !== lastCab) {
        cabIdx++;
        lastCab = cab;
      }
      const altClass = cabIdx % 2 === 0 ? ' class="cab-alt"' : '';
      const archClass = row._archived ? ' opacity:0.5;' : '';

      const piecesHtml = escT(row.piecesText || '');
      const codeLaboHtml = escT(row.codeLabo || '');

      // Cellules editables : double-clic pour editer
      const editable = 'onclick="impEditCell(this,' + idx + ',\'{{FIELD}}\')" style="cursor:text;{{STYLE}}"';
      const cabTd = editable.replace('{{FIELD}}', 'cabinet').replace('{{STYLE}}', (cab ? 'font-weight:600;font-size:0.72rem;' : 'font-weight:400;font-size:0.72rem;color:#bbb;font-style:italic;') + archClass);
      const patTd = editable.replace('{{FIELD}}', 'patient').replace('{{STYLE}}', archClass);
      const refTd = editable.replace('{{FIELD}}', 'reference').replace('{{STYLE}}', 'font-family:\'DM Mono\',monospace;font-size:0.7rem;' + archClass);

      const cabText = cab ? escT(wrapLongName(cab, 2)) : '(non trouvé)';
      const patText = escT(wrapLongName(row.patient || '', 2)) || '<span style="color:#bbb;font-style:italic;">(vide)</span>';

      html += '<tr' + altClass + '>' +
        '<td style="font-family:\'DM Mono\',monospace;font-size:0.68rem;color:#888;white-space:nowrap;' + archClass + '">' + escT(row.dateStr || '') + '</td>' +
        '<td ' + cabTd + '>' + cabText + '</td>' +
        '<td style="' + archClass + '"><span style="font-family:\'DM Mono\',monospace;font-size:0.72rem;background:#e3f2fd;padding:2px 6px;border-radius:4px;">' + codeLaboHtml + '</span></td>' +
        '<td ' + patTd + '>' + patText + '</td>' +
        '<td ' + refTd + '>' + escT(row.reference || '') + '</td>' +
        '<td style="font-size:0.7rem;' + archClass + '">' + piecesHtml + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
  }

  // Escape text pour HTML puis convertir \n en <br>
  // ── Edition manuelle des cellules ──
  // Construire la liste des cabinets Cogilog pour autocomplete
  function impGetCogilogCabinets() {
    if (typeof COGILOG_CLIENTS === 'undefined') return [];
    const list = [];
    Object.entries(COGILOG_CLIENTS).forEach(([code, data]) => {
      const nom = (data[3] || '').trim().toUpperCase();
      if (nom) list.push(nom);
    });
    return [...new Set(list)].sort();
  }

  window.impEditCell = function(td, rowIdx, field) {
    if (td.querySelector('input')) return;
    const row = _impGrouped[rowIdx];
    if (!row) return;
    const oldVal = row[field] || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldVal;
    input.style.cssText = 'width:100%;padding:0 2px;margin:0;border:none;border-bottom:1px solid var(--teal);font-size:inherit;font-family:inherit;background:transparent;outline:none;box-sizing:border-box;line-height:inherit;height:auto;';
    td.innerHTML = '';
    td.appendChild(input);

    // Dropdown autocomplete pour cabinet
    let dropdown = null;
    if (field === 'cabinet') {
      dropdown = document.createElement('div');
      dropdown.style.cssText = 'position:absolute;z-index:999;background:white;border:1px solid #ddd;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.12);max-height:150px;overflow-y:auto;width:200px;display:none;';
      td.style.position = 'relative';
      td.appendChild(dropdown);

      const allCabs = impGetCogilogCabinets();
      input.addEventListener('input', function() {
        const q = this.value.trim().toUpperCase();
        if (q.length < 1) { dropdown.style.display = 'none'; return; }
        const matches = allCabs.filter(c => c.includes(q)).slice(0, 8);
        if (!matches.length) { dropdown.style.display = 'none'; return; }
        dropdown.innerHTML = matches.map(c =>
          '<div style="padding:4px 8px;font-size:0.72rem;cursor:pointer;" onmouseover="this.style.background=\'#e3f2fd\'" onmouseout="this.style.background=\'white\'">' + escT(c) + '</div>'
        ).join('');
        dropdown.querySelectorAll('div').forEach(d => {
          d.addEventListener('mousedown', function(e) {
            e.preventDefault();
            input.value = this.textContent;
            dropdown.style.display = 'none';
            save();
          });
        });
        dropdown.style.display = 'block';
      });
    }

    input.focus();
    input.select();

    let saved = false;
    function save() {
      if (saved) return;
      saved = true;
      if (dropdown) dropdown.remove();
      const newVal = input.value.trim();
      row[field] = newVal;
      // Propager dans les lignes brutes
      _impRawRows.forEach(r => {
        if ((r.codeLabo || '').toUpperCase() === (row.codeLabo || '').toUpperCase()) {
          const mk = r._dateMs ? new Date(r._dateMs).toISOString().slice(0, 7) : 'no-date';
          const rk = row.dateMs ? new Date(row.dateMs).toISOString().slice(0, 7) : 'no-date';
          if (mk === rk) {
            if (field === 'cabinet') r.cabinet = newVal;
            if (field === 'patient') r.patient = newVal;
            if (field === 'reference') r.codeRX = newVal;
          }
        }
      });
      // Mettre a jour la cellule + corriger le style
      if (field === 'cabinet') {
        td.style.fontWeight = newVal ? '600' : '400';
        td.style.color = newVal ? '' : '#bbb';
        td.style.fontStyle = newVal ? '' : 'italic';
      }
      const display = field === 'cabinet'
        ? (newVal ? escT(wrapLongName(newVal, 2)) : '<span style="color:#bbb;font-style:italic;">(non trouvé)</span>')
        : (newVal ? escT(wrapLongName(newVal, 2)) : '<span style="color:#bbb;font-style:italic;">(vide)</span>');
      td.innerHTML = display;
      // Sauvegarder en arriere-plan
      clearTimeout(window._impSaveTimer);
      window._impSaveTimer = setTimeout(() => impSauverTrackingDB(), 500);
    }

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') {
        if (dropdown) dropdown.remove();
        td.innerHTML = oldVal ? escT(wrapLongName(oldVal, 2)) : '<span style="color:#bbb;font-style:italic;">(vide)</span>';
        saved = true;
      }
      if (e.key === 'Tab') { e.preventDefault(); save(); impEditNextCell(td, rowIdx, field, e.shiftKey); }
    });
    input.addEventListener('blur', save);
  };

  // Navigation Tab entre cellules editables
  function impEditNextCell(currentTd, rowIdx, field, reverse) {
    const fields = ['cabinet', 'patient', 'reference'];
    let fi = fields.indexOf(field);
    let ri = rowIdx;
    if (reverse) {
      fi--;
      if (fi < 0) { fi = fields.length - 1; ri--; }
    } else {
      fi++;
      if (fi >= fields.length) { fi = 0; ri++; }
    }
    if (ri < 0 || ri >= _impGrouped.length) return;
    // Trouver la cellule dans le tableau
    const tbody = document.getElementById('imp-order-tbody');
    const tr = tbody.children[ri];
    if (!tr) return;
    // Colonnes editables : cabinet=1, patient=3, reference=4
    const colMap = { cabinet: 1, patient: 3, reference: 4 };
    const td = tr.children[colMap[fields[fi]]];
    if (td) setTimeout(() => impEditCell(td, ri, fields[fi]), 10);
  }

  function escT(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/\n/g, '<br>');
  }

  // ══════════════════════════════════════
  // BLOC 7 : EXPORT PDF
  // ══════════════════════════════════════

  window.impExporterPDF = function() {
    if (!_impGrouped.length) { showToast('Aucune donnée à exporter', true); return; }

    // ── Preparer les donnees pour le PDF : trier par cabinet ──
    const pdfRows = _impGrouped.filter(r => !r._archived).slice();
    pdfRows.sort((a, b) => {
      const ac = (a.cabinet || 'ZZZZZZ').toUpperCase();
      const bc = (b.cabinet || 'ZZZZZZ').toUpperCase();
      const cmp = ac.localeCompare(bc);
      if (cmp !== 0) return cmp;
      return (a.codeLabo || '').localeCompare(b.codeLabo || '');
    });

    // Recalculer TOTAL CABINET sur les donnees triees
    const cabTotals = new Map();
    pdfRows.forEach(row => {
      const cab = row.cabinet || '';
      if (!cab) return;
      if (!cabTotals.has(cab)) cabTotals.set(cab, new Map());
      const m = cabTotals.get(cab);
      row.piecesMap.forEach((qty, ref) => { m.set(ref, (m.get(ref) || 0) + qty); });
    });
    let pdfLastCab = null;
    pdfRows.forEach(row => {
      const cab = row.cabinet || '';
      if (cab && cab !== pdfLastCab) {
        row._pdfTotal = cabTotals.has(cab) ? formatPieces(cabTotals.get(cab), ' / ', 3) : '';
        pdfLastCab = cab;
      } else {
        row._pdfTotal = '';
      }
    });

    // ── jsPDF ──
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297;
    const mL = 5, mR = 5, mT = 14, mB = 10;
    const W = pageW - mL - mR;

    // Colonnes
    const cols = [
      { label: 'Cabinet',            w: W * 0.13 },
      { label: 'Code labo',          w: W * 0.07 },
      { label: 'Patient',            w: W * 0.13 },
      { label: 'Référence',          w: W * 0.10 },
      { label: 'Pièces à commander', w: W * 0.30 },
      { label: 'TOTAL CABINET',      w: W * 0.27 }
    ];
    const fs = 7.5, hdrH = 8, lnH = 3.6;
    let y = mT;

    // Couleurs I Love Smile
    const B = [26, 92, 138], T = [91, 196, 192], BL = [200, 225, 238];

    // Enregistrer la police Inter
    if (window.INTER_REGULAR_B64) {
      doc.addFileToVFS('Inter-Regular.ttf', window.INTER_REGULAR_B64);
      doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    }
    if (window.INTER_BOLD_B64) {
      doc.addFileToVFS('Inter-Bold.ttf', window.INTER_BOLD_B64);
      doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
    }
    const FN = window.INTER_REGULAR_B64 ? 'Inter' : FN;

    // ── En-tete de page (logo style) ──
    function drawPageHeader() {
      // "I love smile" en Dancing Script avec degradé (meme style que PDF anglais)
      const dScale = 4, dW = 200, dH = 40;
      const dCanvas = document.createElement('canvas');
      dCanvas.width = dW * dScale; dCanvas.height = dH * dScale;
      const dCtx = dCanvas.getContext('2d');
      dCtx.scale(dScale, dScale);
      dCtx.clearRect(0, 0, dW, dH);
      dCtx.font = "bold 28px 'Dancing Script', cursive";
      const tm = dCtx.measureText('I love smile');
      const tg = dCtx.createLinearGradient(0, 0, tm.width, 0);
      tg.addColorStop(0, '#1a5c8a');
      tg.addColorStop(0.6, '#5bc4c0');
      tg.addColorStop(1, '#4ab0ac');
      dCtx.fillStyle = 'rgba(195,218,238,0.5)';
      dCtx.fillText('I love smile', 1.5, 28);
      dCtx.fillStyle = tg;
      dCtx.fillText('I love smile', 0, 26);
      const imgData = dCanvas.toDataURL('image/png');
      const imgW = 52, imgH = imgW * (dH / dW);
      doc.addImage(imgData, 'PNG', mL, y - 1, imgW, imgH);

      // Sous-titre
      doc.setFont(FN, 'normal'); doc.setFontSize(8); doc.setTextColor(120, 150, 168);
      doc.text('Commandes Implants \u2014 ' + new Date().toLocaleDateString('fr-FR'), mL + imgW + 3, y + 4);

      // Filet degrade fin
      const steps = 40;
      for (let s = 0; s < steps; s++) {
        const ratio = s / steps;
        doc.setFillColor(
          Math.round(B[0] + (T[0] - B[0]) * ratio),
          Math.round(B[1] + (T[1] - B[1]) * ratio),
          Math.round(B[2] + (T[2] - B[2]) * ratio)
        );
        doc.rect(mL + (W / steps) * s, y + imgH + 1, W / steps + 0.5, 0.7, 'F');
      }
      y += imgH + 4;
    }

    // ── En-tete de tableau ──
    function drawHdr() {
      // Degradé smooth bleu → teal
      const steps = 30;
      for (let s = 0; s < steps; s++) {
        const ratio = s / steps;
        doc.setFillColor(
          Math.round(B[0] + (T[0] - B[0]) * ratio),
          Math.round(B[1] + (T[1] - B[1]) * ratio),
          Math.round(B[2] + (T[2] - B[2]) * ratio)
        );
        doc.rect(mL + (W / steps) * s, y, W / steps + 0.5, hdrH, 'F');
      }
      doc.setFont(FN, 'bold'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255);
      let x = mL;
      cols.forEach(c => { doc.text(c.label, x + 1.5, y + 5.2); x += c.w; });
      // Separateurs blancs fins
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.15);
      x = mL;
      cols.forEach((c, i) => { if (i > 0) doc.line(x, y + 1.5, x, y + hdrH - 1.5); x += c.w; });
      y += hdrH;
    }

    drawPageHeader();

    function wrap(text, maxW) {
      if (!text) return [''];
      doc.setFont(FN, 'normal'); doc.setFontSize(fs);
      const parts = text.split(/\n/);
      const all = [];
      parts.forEach(part => {
        const words = part.split(/\s+/);
        let cur = '';
        words.forEach(w => {
          const test = cur ? cur + ' ' + w : w;
          if (doc.getTextWidth(test) > maxW - 2) { if (cur) all.push(cur); cur = w; }
          else cur = test;
        });
        if (cur) all.push(cur);
      });
      return all.length ? all : [''];
    }

    function shortenRef(ref) {
      if (!ref) return '';
      // Garder les 9 derniers caracteres pour les longues references
      const clean = ref.replace(/^N°\s*/, '').trim();
      return clean.length > 12 ? clean.slice(-9) : clean;
    }

    function rowTexts(row) {
      return [
        wrapLongName(row.cabinet || '', 2),
        row.codeLabo || '',
        wrapLongName(row.patient || '', 2),
        shortenRef(row.reference),
        (row.piecesText || ''),
        (row._pdfTotal || '')
      ];
    }

    function rowH(row) {
      let mx = 1;
      rowTexts(row).forEach((t, i) => { const l = wrap(t, cols[i].w).length; if (l > mx) mx = l; });
      return Math.max(mx * lnH + 1.5, 5);
    }

    drawHdr();
    let ci = 0;
    const tableTop = y;

    // Grouper les lignes par cabinet pour fusion — SEULEMENT si le cabinet est renseigne
    // Les cas "non trouve" (cabinet vide) restent seuls, pas de fusion
    const cabBlocks = [];
    let currentBlock = null;
    pdfRows.forEach(row => {
      const cab = row.cabinet || '';
      if (cab && currentBlock && cab === currentBlock.cab) {
        // Meme cabinet non-vide → fusionner
        currentBlock.rows.push(row);
      } else {
        // Nouveau bloc (cabinet different ou cabinet vide = toujours seul)
        currentBlock = { cab, rows: [row], total: row._pdfTotal || '' };
        cabBlocks.push(currentBlock);
      }
    });

    cabBlocks.forEach(block => {
      ci++;
      const isMerged = block.cab && block.rows.length > 1;
      const rowHeights = block.rows.map(r => rowH(r));

      if (y + rowHeights[0] > pageH - mB) {
        doc.addPage(); y = mT; drawHdr();
      }

      // Separateur cabinet : degradé fin bleu → teal
      if (y > mT + hdrH + 5 && block.cab) {
        const sepSteps = 15;
        for (let s = 0; s < sepSteps; s++) {
          const ratio = s / sepSteps;
          doc.setDrawColor(
            Math.round(B[0] + (T[0] - B[0]) * ratio),
            Math.round(B[1] + (T[1] - B[1]) * ratio),
            Math.round(B[2] + (T[2] - B[2]) * ratio)
          );
          doc.setLineWidth(0.3);
          const segW = W / sepSteps;
          doc.line(mL + segW * s, y, mL + segW * (s + 1), y);
        }
      }

      const blockStartY = y;

      block.rows.forEach((row, ri) => {
        const rh = rowHeights[ri];
        if (ri > 0 && y + rh > pageH - mB) {
          doc.addPage(); y = mT; drawHdr();
        }

        // Bordure bas de ligne (fine, bleu clair)
        doc.setDrawColor(...BL); doc.setLineWidth(0.1);
        doc.line(mL + cols[0].w, y + rh, mL + W - cols[5].w, y + rh);
        if (!isMerged || ri === block.rows.length - 1) {
          doc.setDrawColor(...BL); doc.setLineWidth(0.15);
          doc.line(mL, y + rh, mL + W, y + rh);
        }

        // Bordures verticales (tres fines)
        let xb = mL;
        cols.forEach((c, ci2) => {
          if (ci2 > 0) {
            doc.setDrawColor(...BL); doc.setLineWidth(0.08);
            doc.line(xb, y, xb, y + rh);
          }
          xb += c.w;
        });

        // Textes colonnes 1-4 (pas 0=Cabinet ni 5=Total si fusionne)
        const txts = rowTexts(row);
        let x = mL;
        txts.forEach((t, i) => {
          if (isMerged && (i === 0 || i === 5)) { x += cols[i].w; return; }
          doc.setFont(FN, (i === 0 && block.cab) ? 'bold' : 'normal');
          doc.setFontSize(i === 5 ? 6.5 : fs);
          doc.setTextColor(i === 0 ? 33 : 50, i === 0 ? 33 : 50, i === 0 ? 33 : 60);
          const lines = wrap(t, cols[i].w);
          lines.forEach((ln, li) => {
            const ty = y + 3.2 + li * lnH;
            if (ty < y + rh) doc.text(ln, x + 1, ty);
          });
          x += cols[i].w;
        });

        y += rh;
      });

      const blockEndY = y;

      // Cellules fusionnees : Cabinet en haut + Total en haut (seulement si bloc fusionne)
      if (isMerged) {
        // Cabinet en haut a gauche
        doc.setFont(FN, 'bold');
        doc.setFontSize(fs);
        doc.setTextColor(33, 33, 33);
        const cabLines = wrap(wrapLongName(block.cab, 2), cols[0].w);
        cabLines.forEach((ln, li) => {
          doc.text(ln, mL + 1, blockStartY + 3.2 + li * lnH);
        });

        // Total en haut a droite
        if (block.total) {
          doc.setFont(FN, 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(50, 50, 60);
          const totalX = mL + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w;
          const totalLines = wrap(block.total, cols[5].w);
          totalLines.forEach((ln, li) => {
            doc.text(ln, totalX + 1, blockStartY + 3.2 + li * lnH);
          });
        }
      }
    });

    // Bordure exterieure arrondie (bleu I Love Smile)
    doc.setDrawColor(...B); doc.setLineWidth(0.5);
    doc.roundedRect(mL, tableTop, W, y - tableTop, 2, 2);

    doc.save('Commandes_Implants_' + new Date().toISOString().slice(0, 10) + '.pdf');
    showToast('📄 PDF exporté');
  };

  // ══════════════════════════════════════
  // BLOC 8 : FOURNISSEURS (CRUD Firebase)
  // ══════════════════════════════════════

  async function impChargerFournisseurs() {
    try {
      const db = window._db || firebase.firestore();
      const doc = await db.collection('meta').doc('implant_fournisseurs').get();
      _impFournisseurs = doc.exists ? (doc.data().list || []) : [];
    } catch (e) {
      _impFournisseurs = [];
    }
    if (_impTabActif === 'fournisseurs') impRenderFournisseurs();
  }

  async function impSauverFournisseursDB() {
    try {
      const db = window._db || firebase.firestore();
      await db.collection('meta').doc('implant_fournisseurs').set({ list: _impFournisseurs });
    } catch (e) {
      showToast('❌ Erreur sauvegarde fournisseurs : ' + e.message, true);
    }
  }

  window.impAjouterFournisseur = function() {
    document.getElementById('imp-edit-four-id').value = '';
    document.getElementById('imp-edit-four-nom').value = '';
    document.getElementById('imp-edit-four-email').value = '';
    document.getElementById('imp-edit-four-logo').value = '';
    document.getElementById('imp-edit-four-site').value = '';
    document.getElementById('imp-edit-four-catalogue').value = '';
    document.getElementById('imp-edit-four-catalogue-name').textContent = '';
    document.getElementById('imp-edit-four-notes').value = '';
    document.getElementById('imp-edit-four-title').textContent = 'Ajouter un fournisseur';
    document.getElementById('modal-edit-fournisseur').style.display = 'flex';
  };

  window.impEditerFournisseur = function(id) {
    const f = _impFournisseurs.find(x => x.id === id);
    if (!f) return;
    document.getElementById('imp-edit-four-id').value = f.id;
    document.getElementById('imp-edit-four-nom').value = f.nom || '';
    document.getElementById('imp-edit-four-email').value = f.email || '';
    document.getElementById('imp-edit-four-logo').value = f.logoUrl || '';
    document.getElementById('imp-edit-four-site').value = f.siteUrl || '';
    document.getElementById('imp-edit-four-catalogue').value = f.catalogueUrl || '';
    document.getElementById('imp-edit-four-catalogue-name').textContent = f.catalogueUrl ? '📄 Catalogue enregistré' : '';
    document.getElementById('imp-edit-four-notes').value = f.notes || '';
    document.getElementById('imp-edit-four-title').textContent = 'Modifier ' + f.nom;
    document.getElementById('modal-edit-fournisseur').style.display = 'flex';
  };

  window.impSupprimerFournisseur = function(id) {
    if (!confirm('Supprimer ce fournisseur ?')) return;
    _impFournisseurs = _impFournisseurs.filter(x => x.id !== id);
    impSauverFournisseursDB();
    impRenderFournisseurs();
    showToast('Fournisseur supprimé');
  };

  window.impSauverFournisseur = function() {
    const id = document.getElementById('imp-edit-four-id').value;
    const nom = document.getElementById('imp-edit-four-nom').value.trim();
    if (!nom) { showToast('Le nom est obligatoire', true); return; }

    const existing = id ? (_impFournisseurs.find(x => x.id === id) || {}) : {};
    const data = {
      id: id || ('four_' + Date.now()),
      nom,
      email: document.getElementById('imp-edit-four-email').value.trim(),
      logoUrl: document.getElementById('imp-edit-four-logo').value.trim(),
      siteUrl: document.getElementById('imp-edit-four-site').value.trim(),
      catalogueUrl: document.getElementById('imp-edit-four-catalogue').value.trim() || existing.catalogueUrl || '',
      notes: document.getElementById('imp-edit-four-notes').value.trim(),
      createdAt: existing.createdAt || Date.now()
    };

    if (id) {
      const idx = _impFournisseurs.findIndex(x => x.id === id);
      if (idx >= 0) _impFournisseurs[idx] = data;
    } else {
      _impFournisseurs.push(data);
    }

    impSauverFournisseursDB();
    impRenderFournisseurs();
    document.getElementById('modal-edit-fournisseur').style.display = 'none';
    showToast('✅ Fournisseur enregistré');
  };

  function impRenderFournisseurs() {
    var container = document.getElementById('imp-fournisseurs-list');
    if (!_impFournisseurs.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:0.82rem;grid-column:1/-1;">Aucun fournisseur configure</div>';
      return;
    }

    // Separer actifs et archives
    var actifs = _impFournisseurs.filter(function(f) { return !_impFournisseursArchive.has(f.id); });
    var archives = _impFournisseurs.filter(function(f) { return _impFournisseursArchive.has(f.id); });

    var html = '';

    function renderCard(f, isArchived) {
      var logoHtml = f.logoUrl
        ? '<img src="' + escT(f.logoUrl) + '" class="imp-fournisseur-logo" alt="' + escT(f.nom) + '" onerror="this.style.display=\'none\'">'
        : '<div class="imp-fournisseur-logo" style="display:flex;align-items:center;justify-content:center;font-size:1.3rem;">🏭</div>';

      // Stock
      var stockKey = impMatchFournisseurMarque(f.nom);
      var stockItems = stockKey ? (_impStock[stockKey] || []) : [];
      var stockCount = stockItems.reduce(function(s, item) { return s + item.qty; }, 0);

      // Tags compacts (email, stock, site)
      var tags = '';
      if (f.email) tags += '<span class="imp-fournisseur-tag email">✉ ' + escT(f.email) + '</span>';
      if (stockItems.length) {
        var stockClass = stockCount === 0 ? 'stock empty' : 'stock';
        tags += '<span class="imp-fournisseur-tag ' + stockClass + '">📦 ' + stockCount + ' pc / ' + stockItems.length + ' ref</span>';
      }
      if (f.siteUrl) tags += '<span class="imp-fournisseur-tag site" onclick="window.open(\'' + escT(f.siteUrl).replace(/'/g, "\\'") + '\',\'_blank\')" title="' + escT(f.siteUrl) + '">🛒 Shop</span>';

      // Boutons verticaux
      var nomEsc = escT(f.nom).replace(/'/g, "\\'");
      var idEsc = escT(f.id).replace(/'/g, "\\'");
      var btns = '';
      btns += '<button onclick="impVoirStock(\'' + nomEsc + '\')" title="Voir stock">📦</button>';
      if (f.catalogueUrl) btns += '<button onclick="impOuvrirCatalogue(\'' + idEsc + '\')" title="Catalogue PDF" style="color:#6a1b9a;">📖</button>';
      btns += '<button onclick="impEditerFournisseur(\'' + idEsc + '\')" title="Modifier">✏️</button>';
      if (isArchived) {
        btns += '<button onclick="impDesarchiverFournisseur(\'' + idEsc + '\')" title="Desarchiver" style="color:#2e7d32;">↩</button>';
      } else {
        btns += '<button onclick="impArchiverFournisseur(\'' + idEsc + '\')" title="Archiver" style="color:#999;">📥</button>';
      }
      btns += '<button class="danger" onclick="impSupprimerFournisseur(\'' + idEsc + '\')" title="Supprimer">🗑</button>';

      return '<div class="imp-fournisseur-card' + (isArchived ? ' archived' : '') + '">' +
        logoHtml +
        '<div class="imp-fournisseur-body">' +
          '<div class="imp-fournisseur-info">' +
            '<div class="imp-fournisseur-name">' + escT(f.nom) + '</div>' +
            (tags ? '<div class="imp-fournisseur-meta">' + tags + '</div>' : '') +
            (f.notes ? '<div class="imp-fournisseur-notes">' + escT(f.notes) + '</div>' : '') +
          '</div>' +
          '<div class="imp-fournisseur-actions">' + btns + '</div>' +
        '</div>' +
      '</div>';
    }

    actifs.forEach(function(f) { html += renderCard(f, false); });

    if (archives.length) {
      html += '<div style="grid-column:1/-1;padding:10px 0 4px;border-top:2px solid #e0e0e0;margin-top:8px;">' +
        '<span style="font-size:0.72rem;font-weight:700;color:#999;">📥 Archives (' + archives.length + ')</span></div>';
      archives.forEach(function(f) { html += renderCard(f, true); });
    }

    container.innerHTML = html;
  }

  // Upload catalogue PDF → convertit en data URL base64 et stocke dans le champ
  window.impUploadCatalogue = function(file) {
    if (!file || file.type !== 'application/pdf') {
      showToast('Sélectionner un fichier PDF', true); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Fichier trop volumineux (max 10 Mo)', true); return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('imp-edit-four-catalogue').value = e.target.result;
      document.getElementById('imp-edit-four-catalogue-name').textContent = '📄 ' + file.name + ' (' + (file.size / 1024).toFixed(0) + ' Ko)';
      showToast('📄 Catalogue chargé : ' + file.name);
    };
    reader.readAsDataURL(file);
  };

  // Ouvrir catalogue PDF dans un nouvel onglet
  window.impOuvrirCatalogue = function(id) {
    const f = _impFournisseurs.find(x => x.id === id);
    if (!f || !f.catalogueUrl) { showToast('Pas de catalogue pour ce fournisseur', true); return; }
    if (f.catalogueUrl.startsWith('data:')) {
      // Data URL → ouvrir dans un nouvel onglet
      const w = window.open();
      if (w) {
        w.document.write('<html><head><title>Catalogue ' + (f.nom || '') + '</title></head><body style="margin:0;"><iframe src="' + f.catalogueUrl + '" style="width:100%;height:100vh;border:none;"></iframe></body></html>');
        w.document.close();
      }
    } else {
      // URL externe
      window.open(f.catalogueUrl, '_blank');
    }
  };

  function impMatchFournisseurMarque(nomFournisseur) {
    const n = (nomFournisseur || '').toLowerCase();
    for (const marque of Object.keys(_impStock)) {
      if (n.includes(marque.toLowerCase()) || marque.toLowerCase().includes(n)) {
        return marque;
      }
    }
    return null;
  }

  // ══════════════════════════════════════
  // STOCK : Visualisation par marque
  // ══════════════════════════════════════

  let _impStockVue = []; // items affiches dans le modal stock

  window.impVoirStock = function(nomFournisseur) {
    const marque = impMatchFournisseurMarque(nomFournisseur);
    const items = marque ? (_impStock[marque] || []) : [];
    _impStockVue = items;

    document.getElementById('modal-stock-title').textContent = '📦 Stock ' + (nomFournisseur || 'inconnu');
    document.getElementById('modal-stock-search').value = '';

    // Stats
    const totalPieces = items.reduce((s, i) => s + i.qty, 0);
    const enStock = items.filter(i => i.qty > 0).length;
    const rupture = items.filter(i => i.qty === 0).length;
    document.getElementById('modal-stock-stats').innerHTML =
      '<b>' + items.length + '</b> références — <b>' + totalPieces + '</b> pièces en stock — ' +
      '<span style="color:#2e7d32;">' + enStock + ' en stock</span> · ' +
      '<span style="color:#c62828;">' + rupture + ' en rupture</span>';

    impRenderStockTable(items);
    document.getElementById('modal-stock-fournisseur').style.display = 'flex';
  };

  window.impFiltrerStock = function() {
    const q = (document.getElementById('modal-stock-search').value || '').toLowerCase().trim();
    if (!q) { impRenderStockTable(_impStockVue); return; }
    const filtered = _impStockVue.filter(i =>
      (i.ref || '').toLowerCase().includes(q) ||
      (i.categorie || '').toLowerCase().includes(q) ||
      (i.produit || '').toLowerCase().includes(q)
    );
    impRenderStockTable(filtered);
  };

  // Refs stock archivees
  let _impStockArchive = new Set();

  async function impChargerStockArchive() {
    try {
      const db = window._db || firebase.firestore();
      const doc = await db.collection('meta').doc('implant_stock_archive').get();
      if (doc.exists) _impStockArchive = new Set(doc.data().refs || []);
    } catch(e) { _impStockArchive = new Set(); }
  }
  async function impSauverStockArchive() {
    try {
      const db = window._db || firebase.firestore();
      await db.collection('meta').doc('implant_stock_archive').set({ refs: Array.from(_impStockArchive) });
    } catch(e) {}
  }

  // Fournisseurs archives
  var _impFournisseursArchive = new Set();

  async function impChargerFournisseursArchive() {
    try {
      var db = window._db || firebase.firestore();
      var doc = await db.collection('meta').doc('implant_fournisseurs_archive').get();
      if (doc.exists) _impFournisseursArchive = new Set(doc.data().ids || []);
    } catch(e) { _impFournisseursArchive = new Set(); }
  }
  async function impSauverFournisseursArchive() {
    try {
      var db = window._db || firebase.firestore();
      await db.collection('meta').doc('implant_fournisseurs_archive').set({ ids: Array.from(_impFournisseursArchive) });
    } catch(e) {}
  }

  window.impArchiverFournisseur = function(id) {
    _impFournisseursArchive.add(id);
    impSauverFournisseursArchive();
    impRenderFournisseurs();
    showToast('Fournisseur archive');
  };
  window.impDesarchiverFournisseur = function(id) {
    _impFournisseursArchive.delete(id);
    impSauverFournisseursArchive();
    impRenderFournisseurs();
    showToast('Fournisseur desarchive');
  };

  window.impArchiverStockRef = function(ref) {
    _impStockArchive.add(ref);
    impSauverStockArchive();
    impRenderStockTable(_impStockVue);
  };
  window.impDesarchiverStockRef = function(ref) {
    _impStockArchive.delete(ref);
    impSauverStockArchive();
    impRenderStockTable(_impStockVue);
  };

  function impRenderStockTable(items) {
    const tbody = document.getElementById('modal-stock-tbody');
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">Aucune donnée stock — importez un fichier Excel d\'abord</td></tr>';
      return;
    }

    // Fonction pour obtenir la categorie d'une ref
    function getRefCat(ref, desc) {
      // 1. Categorie custom Firebase
      if (_impRefCats[ref]) return _impRefCats[ref];
      // 2. Categorie par defaut (fichier statique)
      const defaults = window.IMPLANT_DEFAULT_CATS || {};
      if (defaults[ref]) return defaults[ref];
      // 3. Matcher la description contre les categories connues
      const d = (desc || '').trim();
      if (!d) return 'Sans catégorie';
      const knownCats = window.IMPLANT_DEFAULT_CAT_ORDER || [];
      // Chercher la categorie la plus longue qui correspond au debut de la description
      let bestCat = '', bestLen = 0;
      knownCats.forEach(cat => {
        if (d.startsWith(cat) && cat.length > bestLen) { bestCat = cat; bestLen = cat.length; }
      });
      if (bestCat) return bestCat;
      // 4. Fallback : prefixe avant Ø
      return d.split('Ø')[0].replace(/H\d.*/,'').trim() || 'Sans catégorie';
    }

    // Enrichir + separer actifs vs archives
    const enriched = items.map(item => {
      const desc = impRefDesc(item.ref);
      const fullDesc = desc || item.produit || '';
      return { ...item, description: fullDesc, category: getRefCat(item.ref, fullDesc), _archived: _impStockArchive.has(item.ref) };
    });

    const actifs = enriched.filter(i => !i._archived);
    const archives = enriched.filter(i => i._archived);

    // Extraire la hauteur numerique d'une description (ex: "H2.5mm" → 2.5)
    function extractHeight(desc) {
      const m = (desc || '').match(/H(\d+(?:\.\d+)?)\s*mm/i);
      return m ? parseFloat(m[1]) : 999;
    }
    // Extraire le diametre numerique (ex: "Ø4.7" → 4.7)
    function extractDiam(desc) {
      const m = (desc || '').match(/Ø(\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : 999;
    }

    // Trier actifs par categorie, puis diametre, puis hauteur
    actifs.sort((a, b) => {
      const ka = impGetCatSortKey(a.category || '');
      const kb = impGetCatSortKey(b.category || '');
      const cmp = ka.localeCompare(kb);
      if (cmp !== 0) return cmp;
      const da = extractDiam(a.description), db = extractDiam(b.description);
      if (da !== db) return da - db;
      const ha = extractHeight(a.description), hb = extractHeight(b.description);
      if (ha !== hb) return ha - hb;
      return (a.description || '').localeCompare(b.description || '');
    });
    archives.sort((a, b) => (a.ref || '').localeCompare(b.ref || ''));

    let html = '';

    // ── Collecter TOUTES les categories ──
    const allCats = new Set();
    // 1. TOUTES les categories de l'ordre par defaut (toujours presentes, meme vides)
    (window.IMPLANT_DEFAULT_CAT_ORDER || []).forEach(c => allCats.add(c));
    // 2. Categories des refs (defaults + Firebase)
    const defaultCats = window.IMPLANT_DEFAULT_CATS || {};
    Object.values(defaultCats).forEach(c => allCats.add(c));
    Object.values(_impRefCats).forEach(c => allCats.add(c));
    // 3. Categories des items actifs
    actifs.forEach(i => allCats.add(i.category));

    // Grouper les actifs par categorie
    const catItems = {};
    actifs.forEach(item => {
      if (!catItems[item.category]) catItems[item.category] = [];
      catItems[item.category].push(item);
    });

    // Trier les categories
    const sortedCats = Array.from(allCats).sort((a, b) => {
      return impGetCatSortKey(a).localeCompare(impGetCatSortKey(b));
    });

    // ── Actifs par categorie (y compris vides) ──
    let globalIdx = 0;
    sortedCats.forEach(cat => {
      const items = catItems[cat] || [];
      const catEsc = cat.replace(/"/g, '&quot;');
      const isEmpty = items.length === 0;
      html += '<tr><td colspan="4" style="padding:0; background:linear-gradient(120deg,#e3f2fd,#e0f7fa); border-bottom:2px solid #90caf9;' + (isEmpty ? 'opacity:0.5;' : '') + '">' +
        '<div style="display:flex; align-items:center; gap:6px; padding:5px 8px;">' +
        '<span data-catname="' + catEsc + '" class="imp-cat-title-span" style="flex:1; font-size:0.72rem; font-weight:700; color:#0277bd; cursor:text; padding:1px 4px; border-radius:4px;" onmouseover="this.style.background=\'rgba(2,119,189,0.08)\'" onmouseout="this.style.background=\'none\'">' + escT(cat) + (isEmpty ? ' <span style="font-weight:400;color:#aaa;font-size:0.65rem;">(vide)</span>' : '') + '</span>' +
        '<button class="imp-cat-del-btn" data-catname="' + catEsc + '" style="background:none;border:1px solid #ef9a9a;border-radius:4px;cursor:pointer;font-size:0.65rem;color:#c62828;padding:1px 5px;line-height:1;" title="Supprimer catégorie">🗑</button>' +
        '</div></td></tr>';
      items.forEach(item => {
        html += impStockRow(item, globalIdx++, false);
      });
    });

    // ── Archives (tout en bas) ──
    if (archives.length) {
      html += '<tr><td colspan="4" style="padding:8px; background:#f5f5f5; border-top:2px solid #ccc; font-size:0.72rem; font-weight:700; color:#888;">📦 Archivées (' + archives.length + ' réf.)</td></tr>';
      archives.forEach((item, i) => {
        html += impStockRow(item, i, true);
      });
    }

    tbody.innerHTML = html;

    // Attacher events sur les titres de categorie (via data-catname, pas d'inline onclick)
    tbody.querySelectorAll('.imp-cat-title-span').forEach(span => {
      span.addEventListener('click', function() {
        impEditStockTitle(this, this.dataset.catname);
      });
    });
    tbody.querySelectorAll('.imp-cat-del-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        impDeleteCategory(this.dataset.catname);
      });
    });
  }

  function impStockRow(item, i, isArchived) {
    var rowBg = i % 2 === 0 ? '' : ' background:#f8fbff;';
    var opacity = isArchived ? 'opacity:0.45;' : '';
    var qtyVal = item.qty;
    var qtyBadge = '';
    if (qtyVal === 0) {
      qtyBadge = '<span style="color:#fff;font-weight:700;background:#c62828;padding:2px 10px;border-radius:20px;font-size:0.72rem;">0</span>';
    } else if (qtyVal <= 2) {
      qtyBadge = '<span style="color:#fff;font-weight:700;background:#e65100;padding:2px 10px;border-radius:20px;font-size:0.72rem;">' + qtyVal + '</span>';
    } else {
      qtyBadge = '<span style="color:#2e7d32;font-weight:700;font-size:0.78rem;">' + qtyVal + '</span>';
    }
    var refEsc = escT(item.ref).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    var archBtn = isArchived
      ? '<button onclick="impDesarchiverStockRef(\'' + refEsc + '\')" style="background:none;border:1px solid #c8e6c9;border-radius:6px;cursor:pointer;font-size:0.72rem;color:#2e7d32;padding:3px 6px;" title="Desarchiver">↩</button>'
      : '<button onclick="impArchiverStockRef(\'' + refEsc + '\')" style="background:none;border:1px solid #e0e0e0;border-radius:6px;cursor:pointer;font-size:0.72rem;color:#999;padding:3px 6px;" title="Archiver">📥</button>';
    return '<tr style="' + rowBg + 'transition:background 0.1s;" onmouseover="this.style.background=\'#e3f2fd\'" onmouseout="this.style.background=\'' + (i % 2 === 0 ? '' : '#f8fbff') + '\'">' +
      '<td oncontextmenu="event.preventDefault();impShowCatMenu(event,\'' + refEsc + '\')" style="padding:6px 10px; border-bottom:1px solid #eee; width:28%;' + opacity + '"><span onclick="impEditStockCell(this.parentElement,\'' + refEsc + '\',\'ref\')" style="font-family:\'DM Mono\',monospace; font-size:0.76rem; font-weight:700; cursor:text; padding:2px 4px; border-radius:4px; color:var(--accent);">' + escT(item.ref) + '</span></td>' +
      '<td style="padding:6px 10px; border-bottom:1px solid #eee; width:44%;' + opacity + '"><span onclick="impEditStockCell(this.parentElement,\'' + refEsc + '\',\'desc\')" style="font-size:0.74rem; color:#444; cursor:text; padding:2px 4px; border-radius:4px;">' + (item.description ? escT(item.description) : '<i style="color:#bbb;">(cliquer pour decrire)</i>') + '</span></td>' +
      '<td style="padding:6px 10px; border-bottom:1px solid #eee; text-align:center; width:18%;' + opacity + '">' + qtyBadge + '</td>' +
      '<td style="padding:4px 6px; border-bottom:1px solid #eee; width:10%; text-align:center;">' + archBtn + '</td>' +
      '</tr>';
  }

  // ── Menu contextuel : changer de categorie ──
  window.impShowCatMenu = function(e, ref) {
    // Fermer un menu existant
    const old = document.getElementById('imp-cat-context-menu');
    if (old) old.remove();

    // Collecter TOUTES les categories (ordre par defaut + marque en cours)
    const cats = new Set();
    // 1. Toutes les categories de l'ordre par defaut (toujours presentes)
    (window.IMPLANT_DEFAULT_CAT_ORDER || []).forEach(c => cats.add(c));
    // 2. Categories de la marque en cours
    const currentItems = _impStockVue || [];
    currentItems.forEach(item => {
      if (_impRefCats[item.ref]) {
        cats.add(_impRefCats[item.ref]);
      } else {
        const desc = impRefDesc(item.ref) || item.produit || '';
        const short = desc.split('Ø')[0].replace(/H\d.*/,'').trim();
        if (short) cats.add(short);
      }
    });
    // 3. Categories customs Firebase
    Object.values(_impRefCats).forEach(cat => cats.add(cat));
    const catList = Array.from(cats).sort((a, b) => impGetCatSortKey(a).localeCompare(impGetCatSortKey(b)));

    // Categorie actuelle de la ref
    const currentCat = _impRefCats[ref] || (impRefDesc(ref) || '').split('Ø')[0].replace(/H\d.*/,'').trim();

    // Construire le menu
    const menu = document.createElement('div');
    menu.id = 'imp-cat-context-menu';
    menu.style.cssText = 'position:fixed;z-index:9999;background:white;border:1px solid #ddd;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.15);max-height:350px;min-width:250px;padding:0;display:flex;flex-direction:column;';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 260) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 360) + 'px';

    // Header + recherche
    const header = document.createElement('div');
    header.style.cssText = 'padding:8px 10px;border-bottom:1px solid #eee;flex-shrink:0;';
    header.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;"><span style="font-size:0.68rem;color:#888;font-weight:600;">Ranger ' + escT(ref) + ' dans :</span><span onclick="document.getElementById(\'imp-cat-context-menu\').remove()" style="cursor:pointer;color:#999;font-size:1rem;line-height:1;padding:0 2px;" title="Fermer">✕</span></div>';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '🔍 Filtrer...';
    searchInput.style.cssText = 'width:100%;padding:4px 8px;border:1px solid #ddd;border-radius:6px;font-size:0.74rem;font-family:inherit;outline:none;box-sizing:border-box;';
    header.appendChild(searchInput);
    menu.appendChild(header);

    // Liste scrollable
    const listDiv = document.createElement('div');
    listDiv.style.cssText = 'overflow-y:auto;flex:1;padding:4px 0;';

    // Index : pour chaque categorie, lister ses refs (pour recherche par ref)
    const catRefs = {};
    currentItems.forEach(item => {
      const desc = impRefDesc(item.ref) || item.produit || '';
      const short = desc.split('Ø')[0].replace(/H\d.*/,'').trim();
      if (short) {
        if (!catRefs[short]) catRefs[short] = [];
        catRefs[short].push(item.ref.toLowerCase());
      }
    });

    function renderOptions(filter) {
      const q = (filter || '').toLowerCase();
      let html = '';
      html += '<div class="imp-ctx-opt" data-action="new" style="padding:6px 10px;font-size:0.74rem;cursor:pointer;color:#0277bd;font-weight:600;border-bottom:1px solid #eee;">+ Nouvelle catégorie...</div>';
      catList.forEach(cat => {
        if (q) {
          // Chercher dans le nom de la categorie OU dans les refs de cette categorie
          const catMatch = cat.toLowerCase().includes(q);
          const refMatch = (catRefs[cat] || []).some(r => r.includes(q));
          if (!catMatch && !refMatch) return;
        }
        const isCurrent = cat === currentCat;
        // Montrer les refs matchees si c'est un match par ref
        let hint = '';
        if (q && !cat.toLowerCase().includes(q)) {
          const matched = (catRefs[cat] || []).filter(r => r.includes(q)).slice(0, 3);
          if (matched.length) hint = '<div style="font-size:0.62rem;color:#888;margin-top:1px;">contient : ' + matched.join(', ').toUpperCase() + (matched.length < (catRefs[cat] || []).filter(r => r.includes(q)).length ? '...' : '') + '</div>';
        }
        html += '<div class="imp-ctx-opt" data-cat="' + escT(cat).replace(/"/g,'&quot;') + '" style="padding:5px 10px;font-size:0.74rem;cursor:pointer;' + (isCurrent ? 'background:#e8f5e9;font-weight:600;color:#2e7d32;' : '') + '">' + (isCurrent ? '✓ ' : '') + escT(cat) + hint + '</div>';
      });
      listDiv.innerHTML = html;
      // Events
      listDiv.querySelectorAll('.imp-ctx-opt').forEach(el => {
        el.onmouseover = function() { if (!this.dataset.cat || this.dataset.cat !== currentCat) this.style.background = '#f0f4ff'; };
        el.onmouseout = function() { this.style.background = this.dataset.cat === currentCat ? '#e8f5e9' : ''; };
        el.onclick = function() {
          menu.remove();
          if (this.dataset.action === 'new') {
            const name = prompt('Nom de la nouvelle catégorie :');
            if (name && name.trim()) impMoveRefToCategory(ref, name.trim());
          } else if (this.dataset.cat) {
            impMoveRefToCategory(ref, this.dataset.cat);
          }
        };
      });
    }

    renderOptions('');
    menu.appendChild(listDiv);
    document.body.appendChild(menu);
    searchInput.focus();

    // Filtre en temps reel
    searchInput.addEventListener('input', function() { renderOptions(this.value); });
    // Enter = selectionner le premier resultat visible
    searchInput.addEventListener('keydown', function(ev) {
      if (ev.key === 'Escape') { menu.remove(); return; }
      if (ev.key === 'Enter') {
        const first = listDiv.querySelector('.imp-ctx-opt[data-cat]');
        if (first) { first.click(); }
      }
    });

    // Fermer au clic ailleurs ou clic droit ailleurs
    function closeMenu(ev) {
      if (menu.contains(ev.target)) return;
      menu.remove();
      document.removeEventListener('mousedown', closeMenu, true);
      document.removeEventListener('contextmenu', closeMenu, true);
    }
    setTimeout(() => {
      document.addEventListener('mousedown', closeMenu, true);
      document.addEventListener('contextmenu', closeMenu, true);
    }, 10);
  };

  function impMoveRefToCategory(ref, targetCat) {
    // Ne modifie PAS la description — change seulement la categorie custom
    _impRefCats[ref] = targetCat;
    impSauverRefCats();
    impRenderStockTable(_impStockVue);
  }

  async function impSauverRefCats() {
    try {
      const db = window._db || firebase.firestore();
      await db.collection('meta').doc('implant_ref_cats').set({ cats: _impRefCats, updatedAt: Date.now() });
    } catch(e) {}
  }
  async function impChargerRefCats() {
    try {
      // 1. Charger les categories par defaut (implant-refs.js) comme base
      const defaults = window.IMPLANT_DEFAULT_CATS || {};
      Object.keys(defaults).forEach(ref => {
        _impRefCats[ref] = defaults[ref];
      });
      // 2. Charger Firebase — les modifs manuelles de l'utilisateur ECRASENT les defaults
      const db = window._db || firebase.firestore();
      const doc = await db.collection('meta').doc('implant_ref_cats').get();
      if (doc.exists && doc.data().cats) {
        const saved = doc.data().cats;
        Object.keys(saved).forEach(ref => {
          _impRefCats[ref] = saved[ref];
        });
      }
    } catch(e) {}
  }

  // Supprimer une categorie → toutes ses refs passent en "En attente de catégorie"
  window.impDeleteCategory = function(catName) {
    if (!confirm('Supprimer la catégorie "' + catName + '" ?\nLes références seront placées dans "En attente de catégorie".')) return;
    // Deplacer toutes les refs de cette categorie vers "En attente de catégorie"
    Object.keys(_impRefCats).forEach(ref => {
      if (_impRefCats[ref] === catName) _impRefCats[ref] = 'En attente de catégorie';
    });
    // Aussi les refs dont la categorie est derivee de la description
    const currentItems = _impStockVue || [];
    currentItems.forEach(item => {
      const desc = impRefDesc(item.ref) || item.produit || '';
      const derivedCat = desc.split('Ø')[0].replace(/H\d.*/,'').trim();
      if (derivedCat === catName && !_impRefCats[item.ref]) {
        _impRefCats[item.ref] = 'En attente de catégorie';
      }
    });
    _impCatOrder = _impCatOrder.filter(c => c !== catName);
    impSauverRefCats();
    impSauverCatOrder();
    impRenderStockTable(_impStockVue);
    showToast('Catégorie "' + catName + '" supprimée — refs en attente');
  };

  // Creer une nouvelle categorie (vide pour l'instant, on y range des refs ensuite via clic droit)
  window.impCreerCategorie = function() {
    const name = prompt('Nom de la nouvelle catégorie :');
    if (!name || !name.trim()) return;
    showToast('✅ Catégorie "' + name.trim() + '" créée — clic droit sur une référence pour l\'y ranger');
  };

  // ── Ordre des categories (persiste en Firebase) ──
  let _impCatOrder = []; // ['Analogue numérique', 'Pilier conique droit', ...]
  let _impRefCats = {};  // mapping ref → categorie custom (independant de la description)

  async function impChargerCatOrder() {
    try {
      const db = window._db || firebase.firestore();
      const doc = await db.collection('meta').doc('implant_cat_order').get();
      if (doc.exists) _impCatOrder = doc.data().order || [];
    } catch(e) {}
  }
  async function impSauverCatOrder() {
    try {
      const db = window._db || firebase.firestore();
      await db.collection('meta').doc('implant_cat_order').set({ order: _impCatOrder });
    } catch(e) {}
  }

  function impGetCatSortKey(cat) {
    // 1. Ordre custom Firebase (si defini par l'utilisateur)
    if (_impCatOrder.length > 0) {
      const idx = _impCatOrder.indexOf(cat);
      if (idx >= 0) return String(idx).padStart(4, '0');
    }
    // 2. Ordre par defaut Biotech (fichier statique)
    const defaults = window.IMPLANT_DEFAULT_CAT_ORDER || [];
    const dIdx = defaults.indexOf(cat);
    if (dIdx >= 0) return String(dIdx).padStart(4, '0');
    // 3. Categories inconnues a la fin (dans l'ordre d'apparition)
    return '9999';
  }

  // ── Modal d'ordonnancement des categories (drag & drop) ──
  function impGetCurrentCats() {
    const cats = new Set();
    // 1. Toutes les categories de reference Biotech (toujours presentes, meme vides)
    (window.IMPLANT_DEFAULT_CAT_ORDER || []).forEach(c => cats.add(c));
    // 2. Categories des refs presentes (customs + defaults + derivees)
    (_impStockVue || []).forEach(item => {
      if (_impStockArchive.has(item.ref)) return;
      const desc = impRefDesc(item.ref) || item.produit || '';
      const cat = _impRefCats[item.ref] || (window.IMPLANT_DEFAULT_CATS || {})[item.ref];
      if (cat) { cats.add(cat); return; }
      // Matcher contre categories connues
      const d = desc.trim();
      const knownCats = window.IMPLANT_DEFAULT_CAT_ORDER || [];
      let found = false;
      knownCats.forEach(c => { if (d.startsWith(c)) { cats.add(c); found = true; } });
      if (!found) {
        const short = d.split('Ø')[0].replace(/H\d.*/,'').trim();
        if (short) cats.add(short);
      }
    });
    return Array.from(cats);
  }

  // State pour le reordonnement
  let _impDragCats = [];

  window.impOuvrirOrdreCategories = function() {
    _impDragCats = impGetCurrentCats();
    // Trier selon l'ordre : custom Firebase > defaut fichier statique > alphabetique
    const orderRef = _impCatOrder.length ? _impCatOrder : (window.IMPLANT_DEFAULT_CAT_ORDER || []);
    _impDragCats.sort((a, b) => {
      const ia = orderRef.indexOf(a), ib = orderRef.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return 0;
    });
    impBuildCatDragList();
    document.getElementById('modal-ordre-cats').style.display = 'flex';
  };

  function impBuildCatDragList() {
    const list = document.getElementById('ordre-cats-list');
    list.innerHTML = '';
    _impDragCats.forEach((cat, i) => {
      const row = document.createElement('div');
      row.dataset.idx = String(i);
      row.style.cssText = 'padding:8px 12px;margin:3px 0;background:white;border:1px solid #ddd;border-radius:8px;font-size:0.78rem;font-weight:600;color:var(--accent);display:flex;align-items:center;gap:8px;user-select:none;';

      // Poignee de grab (mousedown pour demarrer le deplacement custom)
      const handle = document.createElement('span');
      handle.textContent = '☰';
      handle.style.cssText = 'color:#bbb;font-size:0.85rem;cursor:grab;padding:2px 4px;';
      handle.addEventListener('mousedown', function(e) { impStartCatDrag(e, i, list); });

      const label = document.createElement('span');
      label.style.flex = '1';
      label.textContent = cat;

      const num = document.createElement('span');
      num.style.cssText = 'color:#ccc;font-size:0.65rem;';
      num.textContent = (i + 1);

      row.appendChild(handle);
      row.appendChild(label);
      row.appendChild(num);
      list.appendChild(row);
    });
  }

  // Deplacement custom par mousedown/mousemove/mouseup (pas de drag natif)
  function impStartCatDrag(startEvent, srcIdx, list) {
    startEvent.preventDefault();
    const rows = Array.from(list.children);
    const srcRow = rows[srcIdx];
    if (!srcRow) return;

    // Clone fantome qui suit la souris
    const ghost = srcRow.cloneNode(true);
    ghost.style.cssText = srcRow.style.cssText + 'position:fixed;z-index:9999;pointer-events:none;opacity:0.85;box-shadow:0 4px 16px rgba(0,0,0,0.2);width:' + srcRow.offsetWidth + 'px;';
    document.body.appendChild(ghost);
    srcRow.style.opacity = '0.3';

    let targetIdx = srcIdx;

    function onMove(e) {
      ghost.style.left = (e.clientX - 20) + 'px';
      ghost.style.top = (e.clientY - 15) + 'px';

      // Trouver la row sous le curseur
      rows.forEach((r, i) => {
        r.style.borderTop = '';
        r.style.borderBottom = '';
        if (i === srcIdx) return;
        const rect = r.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          targetIdx = i;
          if (e.clientY < rect.top + rect.height / 2) r.style.borderTop = '3px solid var(--teal)';
          else r.style.borderBottom = '3px solid var(--teal)';
        }
      });
    }

    function onUp(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      ghost.remove();
      srcRow.style.opacity = '1';
      rows.forEach(r => { r.style.borderTop = ''; r.style.borderBottom = ''; });

      if (targetIdx !== srcIdx) {
        const moved = _impDragCats.splice(srcIdx, 1)[0];
        _impDragCats.splice(targetIdx > srcIdx ? targetIdx : targetIdx, 0, moved);
        impBuildCatDragList();
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  window.impAppliquerOrdreCategories = function() {
    _impCatOrder = _impDragCats.slice();
    impSauverCatOrder();
    document.getElementById('modal-ordre-cats').style.display = 'none';
    impRenderStockTable(_impStockVue);
    showToast('✅ Ordre des catégories appliqué');
  };

  // ── Edition titre de categorie ──
  window.impEditStockTitle = function(el, oldTitle) {
    if (el.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldTitle;
    input.style.cssText = 'width:100%;padding:3px 6px;border:2px solid var(--teal);border-radius:5px;font-size:0.74rem;font-weight:700;font-family:inherit;background:white;outline:none;box-shadow:0 0 0 3px rgba(91,196,192,0.15);';
    // Remplacer le contenu du span clique par l'input
    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    let saved = false;
    function save() {
      if (saved) return;
      saved = true;
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== oldTitle) {
        let count = 0;
        // 1. Renommer les refs deja dans _impRefCats avec l'ancien nom
        Object.keys(_impRefCats).forEach(ref => {
          if (_impRefCats[ref] === oldTitle) { _impRefCats[ref] = newTitle; count++; }
        });
        // 2. Aussi ajouter les refs dont la categorie EFFECTIVE correspond a l'ancien nom
        (_impStockVue || []).forEach(item => {
          if (_impRefCats[item.ref]) return; // deja custom (traite etape 1 ou autre)
          const desc = impRefDesc(item.ref) || item.produit || '';
          const derived = desc.split('Ø')[0].replace(/H\d.*/,'').trim() || 'Sans catégorie';
          if (derived === oldTitle) {
            _impRefCats[item.ref] = newTitle;
            count++;
          }
        });
        // 3. Renommer dans l'ordre des categories
        const idx = _impCatOrder.indexOf(oldTitle);
        if (idx >= 0) _impCatOrder[idx] = newTitle;
        console.log('[EDIT TITLE] Renamed', count, 'refs from', JSON.stringify(oldTitle), 'to', JSON.stringify(newTitle));
        impSauverRefCats();
        impSauverCatOrder();
      }
      impRenderStockTable(_impStockVue);
    }

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { saved = true; impRenderStockTable(_impStockVue); }
    });
    input.addEventListener('blur', save);
  };

  // ── Edition stock : clic sur ref ou description ──
  window.impEditStockCell = function(td, ref, field) {
    if (td.querySelector('input')) return;
    const dict = window.IMPLANT_REF_DICT || {};
    const oldVal = field === 'desc' ? (dict[ref] || '') : ref;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldVal;
    input.style.cssText = 'width:100%;padding:0 2px;margin:0;border:none;border-bottom:1px solid var(--teal);font-size:inherit;font-family:inherit;background:transparent;outline:none;box-sizing:border-box;line-height:inherit;height:auto;';
    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    input.select();

    let saved = false;
    function save() {
      if (saved) return;
      saved = true;
      const newVal = input.value.trim();

      if (field === 'desc') {
        // Mettre a jour le dictionnaire
        if (!window.IMPLANT_REF_DICT) window.IMPLANT_REF_DICT = {};
        window.IMPLANT_REF_DICT[ref] = newVal;
        td.innerHTML = newVal ? escT(newVal) : '<span style="color:#bbb;font-style:italic;">(cliquer pour décrire)</span>';
      } else {
        // Renommer une reference : supprimer l'ancienne, ajouter la nouvelle
        if (newVal !== ref && window.IMPLANT_REF_DICT) {
          const desc = window.IMPLANT_REF_DICT[ref] || '';
          delete window.IMPLANT_REF_DICT[ref];
          if (newVal) window.IMPLANT_REF_DICT[newVal] = desc;
        }
        td.textContent = newVal || ref;
      }

      // Sauvegarder le dictionnaire custom en Firebase
      impSauverRefDict();
    }

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { saved = true; impRenderStockTable(_impStockVue); }
    });
    input.addEventListener('blur', save);
  };

  // ── Persistence du dictionnaire custom en Firebase ──
  async function impSauverRefDict() {
    try {
      const db = window._db || firebase.firestore();
      const dict = window.IMPLANT_REF_DICT || {};
      // Sauvegarder TOUT le dictionnaire (statique + edits) pour que les modifs persistent
      await db.collection('meta').doc('implant_ref_dict').set({ dict, updatedAt: Date.now() });
    } catch (e) {
      console.warn('[Implants] Erreur sauvegarde dict refs:', e.message);
    }
  }

  // Charger le dictionnaire custom depuis Firebase
  // Les edits manuels de l'utilisateur ECRASENT toujours le fichier statique
  async function impChargerRefDict() {
    try {
      const db = window._db || firebase.firestore();
      const doc = await db.collection('meta').doc('implant_ref_dict').get();
      if (doc.exists && doc.data().dict) {
        const saved = doc.data().dict;
        if (!window.IMPLANT_REF_DICT) window.IMPLANT_REF_DICT = {};
        // Les edits Firebase ecrasent le statique (c'est l'utilisateur qui a edite)
        Object.assign(window.IMPLANT_REF_DICT, saved);
      }
    } catch (e) {
      console.warn('[Implants] Erreur chargement dict refs:', e.message);
    }
  }

  // ══════════════════════════════════════
  // EMAIL COMMANDE PAR MARQUE
  // ══════════════════════════════════════

  window.impEnvoyerEmailCommande = function() {
    // Commandes en cours (non archivees)
    var rows = (_impGrouped || []).filter(function(r) { return !r._archived; });
    if (!rows.length) { showToast('Aucune commande en cours.', true); return; }

    // Verifier que toutes les lignes sont enrichies (cabinet + patient)
    var nonEnrichies = rows.filter(function(r) { return !r.cabinet || !r.patient; });
    if (nonEnrichies.length) {
      showToast('Impossible : ' + nonEnrichies.length + ' ligne(s) sans cabinet ou patient. Completez-les avant d\'envoyer.', true);
      return;
    }

    // Regrouper par marque
    var parMarque = {};
    rows.forEach(function(r) {
      var m = r.marque || 'Inconnu';
      if (!parMarque[m]) parMarque[m] = [];
      parMarque[m].push(r);
    });

    var marques = Object.keys(parMarque).sort();

    // Si une seule marque, generer le mailto directement dans le handler (geste utilisateur preservé)
    if (marques.length === 1) {
      var url = _impBuildMailtoUrl(marques[0], parMarque[marques[0]]);
      var a = document.createElement('a');
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Mail ' + marques[0] + ' ouvert');
      return;
    }

    // Plusieurs marques : afficher un popup HTML avec boutons
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:16px;padding:24px;min-width:300px;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
    box.innerHTML = '<div style="font-weight:700;font-size:0.92rem;margin-bottom:12px;">Choisir la marque</div>';

    marques.forEach(function(m) {
      var btn = document.createElement('a');
      btn.href = _impBuildMailtoUrl(m, parMarque[m]);
      btn.style.cssText = 'display:block;padding:10px 14px;margin:6px 0;background:#e3f2fd;border-radius:10px;color:#0277bd;font-weight:600;font-size:0.82rem;text-decoration:none;cursor:pointer;transition:background 0.15s;';
      btn.textContent = '✉️ ' + m + ' (' + parMarque[m].length + ' lignes)';
      btn.onmouseover = function() { this.style.background = '#bbdefb'; };
      btn.onmouseout = function() { this.style.background = '#e3f2fd'; };
      btn.onclick = function() { document.body.removeChild(overlay); showToast('Mail ' + m + ' ouvert'); };
      box.appendChild(btn);
    });

    var closeBtn = document.createElement('button');
    closeBtn.textContent = 'Annuler';
    closeBtn.style.cssText = 'margin-top:12px;width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;background:white;color:#888;font-size:0.78rem;cursor:pointer;';
    closeBtn.onclick = function() { document.body.removeChild(overlay); };
    box.appendChild(closeBtn);

    overlay.appendChild(box);
    overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
    document.body.appendChild(overlay);
  };

  function _impBuildMailtoUrl(marque, rows) {
    // Trouver le fournisseur correspondant (pour l'email)
    var fournisseur = _impFournisseurs.find(function(f) {
      return f.nom.toLowerCase().includes(marque.toLowerCase()) || marque.toLowerCase().includes(f.nom.toLowerCase());
    });
    var emailDest = (fournisseur && fournisseur.email) ? fournisseur.email : '';

    // Regrouper par cabinet
    var parCabinet = {};
    rows.forEach(function(r) {
      var cab = r.cabinet || 'Non identifie';
      if (!parCabinet[cab]) parCabinet[cab] = [];
      parCabinet[cab].push(r);
    });

    // Construire le corps du mail
    var body = 'Bonjour, j\'aimerais passer une commande\n\n';

    // Sections par cabinet
    Object.keys(parCabinet).sort().forEach(function(cab) {
      var lignes = parCabinet[cab];

      // Chercher les infos Cogilog du cabinet
      var adresse = '';
      var tel = '';
      if (typeof COGILOG_CLIENTS !== 'undefined') {
        // Chercher par nom de cabinet dans COGILOG_CLIENTS
        var found = null;
        Object.entries(COGILOG_CLIENTS).forEach(function(entry) {
          var data = entry[1];
          var nomClient = (data[3] || '').trim().toUpperCase();
          if (nomClient === cab.toUpperCase() || nomClient.includes(cab.toUpperCase()) || cab.toUpperCase().includes(nomClient)) {
            found = data;
          }
        });
        if (found) {
          // Adresse : colonnes 4 (n), 5 (rue), 8 (CP), 9 (ville)
          var parts = [found[4], found[5], found[8], found[9]].filter(function(x) { return x && x.trim(); });
          adresse = parts.join(' ');
          // Telephone : colonne 17
          tel = (found[17] || '').trim();
        }
      }

      body += 'Facturation : ' + cab;
      if (adresse) body += ' - ' + adresse;
      if (tel) body += ' - ' + tel;
      body += '\n\n';

      // Patients sur une ligne, separes par /
      var patients = [];
      lignes.forEach(function(r) {
        var p = (r.patient || '').trim();
        var fiche = (r.codeRX || '').trim();
        if (p || fiche) {
          var entry = p || 'Patient inconnu';
          if (fiche) entry += ' - ' + fiche;
          if (patients.indexOf(entry) === -1) patients.push(entry);
        }
      });
      if (patients.length) {
        body += 'Patient : ' + patients.join(' / ') + '\n';
      }
      body += '\n';
    });

    // Pieces a commander (total regroupe depuis piecesMap de chaque ligne)
    var piecesMap = {};
    rows.forEach(function(r) {
      if (r.piecesMap && r.piecesMap.forEach) {
        r.piecesMap.forEach(function(qty, ref) {
          if (!ref) return;
          if (!piecesMap[ref]) piecesMap[ref] = 0;
          piecesMap[ref] += qty;
        });
      } else {
        // Fallback : utiliser reference + quantite
        var ref = (r.reference || '').trim();
        if (!ref) return;
        var qty = r.quantite || 1;
        if (!piecesMap[ref]) piecesMap[ref] = 0;
        piecesMap[ref] += qty;
      }
    });

    var piecesList = Object.keys(piecesMap).sort();
    if (piecesList.length) {
      body += 'Pi\u00e8ces \u00e0 commander :\n\n';
      piecesList.forEach(function(ref) {
        body += ref + ' \u00d7' + piecesMap[ref] + '\n';
      });
      body += '\n';
    }

    body += 'Livraison laboratoire I LOVE SMILE, 23 RUE BOURSAULT 75017\n';

    // Objet du mail
    var objet = 'Commande implants - ' + marque + ' - I Love Smile';

    // Ouvrir mailto via un lien clique programmatiquement
    var mailto = 'mailto:' + encodeURIComponent(emailDest) +
      '?subject=' + encodeURIComponent(objet) +
      '&body=' + encodeURIComponent(body);

    return mailto;
  }

})();
