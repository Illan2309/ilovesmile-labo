// Attendre que firebase soit disponible — appele par auth.js apres connexion
function initFirebase() {
  if (typeof firebase === 'undefined') {
    setTimeout(initFirebase, 50);
    return;
  }
  if (window._firebaseReady) return; // Deja initialise

  // initializeApp deja fait par auth.js, ne pas rappeler
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyCFEazX7KrxC4jfLCDuLiCT7ZJhcjDQpdM",
      authDomain: "ilovesmile-labo-fd511.firebaseapp.com",
      projectId: "ilovesmile-labo-fd511",
      storageBucket: "ilovesmile-labo-fd511.firebasestorage.app",
      messagingSenderId: "702662622870",
      appId: "1:702662622870:web:dc9a1fbed329c7942f4cb7"
    });
  }
  const _db = firebase.firestore();
  window._db = _db; // Alimente le singleton getDB()
  const _prescriptionsCol = _db.collection('prescriptions');
  const _metaDoc = _db.collection('meta').doc('config');

  // Cache local pour les photos (pas stockées dans Firebase)
  window._photoCache = window._photoCache || {};

  // Charger les contacts depuis Firebase
  _db.collection('contacts').doc('dentistes').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID) {
      const data = { ...doc.data() };
      delete data.tenant_id;
      Object.assign(CONTACTS, data);
      Object.assign(CONTACTS_DENTISTES, data);
      console.log('Contacts chargés depuis Firebase :', Object.keys(data).length, 'cabinets');
    }
  }).catch(e => console.warn('Contacts Firebase non trouvés, utilisation des données par défaut', e));

  // Charger les surcharges tarifaires depuis Firebase (au-dessus de TARIFS_BASE)
  _db.collection('tarifs').doc('surcharges').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID) {
      const data = { ...doc.data() };
      delete data.tenant_id;
      Object.entries(data).forEach(([cab, actes]) => {
        if (TARIFS[cab]) Object.assign(TARIFS[cab], actes);
        else TARIFS[cab] = Object.assign({}, TARIFS_BASE[cab] || {}, actes);
      });
      console.log('Surcharges tarifaires chargées:', Object.keys(data).length, 'cabinets');
    }
  }).catch(() => {});

  // Charger la liste des clients masqués (supprimés)
  window._gcClientsSupprimes = new Set();
  _db.collection('meta').doc('clients_supprimes').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID && doc.data().liste) {
      window._gcClientsSupprimes = new Set(doc.data().liste);
      gcConstruireListe();
    }
  }).catch(() => {});

  // Charger le mapping contacts→tarifs depuis Firebase
  _db.collection('contacts').doc('mapping').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID) {
      // Ne pas écraser les defaults avec des valeurs vides
      const firebaseMapping = { ...doc.data() };
      delete firebaseMapping.tenant_id;
      Object.entries(firebaseMapping).forEach(([cab, grille]) => {
        if (grille && typeof grille === 'string' && grille.trim()) {
          MAPPING_CONTACTS_TARIFS[cab] = grille;
        }
      });
      console.log('Mapping contacts→tarifs chargé depuis Firebase');
    }
  }).catch(e => console.warn('Mapping non trouvé, utilisation du mapping par défaut', e));

  // Charger les clients custom (ajoutés/modifiés via Gestion Clients) depuis Firebase
  _db.collection('contacts').doc('cogilog_clients_custom').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID) {
      const data = { ...doc.data() };
      delete data.tenant_id;
      // Fusionner dans COGILOG_CLIENTS (écrase les valeurs hardcodées si même code)
      Object.assign(COGILOG_CLIENTS, data);
      // Mémoriser les codes originaux pour ne sauvegarder que les custom
      window.COGILOG_CLIENTS_ORIGINAL = Object.fromEntries(
        Object.keys(COGILOG_CLIENTS).filter(k => !data[k]).map(k => [k, true])
      );
      // Mémoriser les codes déjà modifiés (stockés dans Firebase)
      window.COGILOG_CLIENTS_MODIFIED = Object.fromEntries(Object.keys(data).map(k => [k, true]));
      console.log('Clients custom chargés depuis Firebase :', Object.keys(data).length, 'client(s)');
    } else {
      // Aucun custom : marquer tous les existants comme originaux
      window.COGILOG_CLIENTS_ORIGINAL = Object.fromEntries(Object.keys(COGILOG_CLIENTS).map(k => [k, true]));
    }
  }).catch(e => console.warn('Clients custom non trouvés:', e));

  // Charger les métadonnées clients (statuts, notes) depuis Firebase
  _db.collection('meta').doc('gc_meta').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID) {
      const data = doc.data();
      window._gcStatuts = data.statuts || {};
      window._gcNotes   = data.notes   || {};
      console.log('Métadonnées clients chargées :', Object.keys(window._gcStatuts).length, 'statuts');
    } else {
      window._gcStatuts = {};
      window._gcNotes   = {};
    }
  }).catch(e => { window._gcStatuts = {}; window._gcNotes = {}; });

  // Charger les groupes de cabinets
  gcChargerGroupes();

  // Charger les paramètres (mapping Cogilog, labels, préférences)
  pmChargerDepuisFirebase(_db);

  // Charger les règles personnalisées depuis Firebase
  _db.collection('meta').doc('custom_rules').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID && doc.data().rules) {
      window._customRules = doc.data().rules;
      try { localStorage.setItem('custom_rules', JSON.stringify(window._customRules)); } catch(e) {}
      console.log('📝 Règles personnalisées chargées :', window._customRules.length);
    }
  }).catch(() => {});

  // Charger la mémoire IA depuis Firebase
  _db.collection('meta').doc('ia_memory').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID) {
      const data = { ...doc.data() };
      delete data.tenant_id;
      window._iaMemoireCache = data;
      // Synchroniser aussi le localStorage pour le fallback hors-ligne
      try { localStorage.setItem('ia_memory', JSON.stringify(data)); } catch(e) {}
      const nbRegles = Object.keys(data.erreurs || {}).length;
      console.log(`🧠 Mémoire IA chargée depuis Firebase : ${nbRegles} règle(s)`);
    } else {
      // Pas encore de doc Firebase → migrer depuis localStorage si existant
      try {
        const local = localStorage.getItem('ia_memory');
        if (local) {
          const parsed = JSON.parse(local);
          window._iaMemoireCache = parsed;
          // Uploader vers Firebase immédiatement
          _db.collection('meta').doc('ia_memory').set(window.withTenant(parsed))
            .then(() => console.log('🧠 Mémoire IA migrée localStorage → Firebase'))
            .catch(e => console.warn('Erreur migration mémoire IA:', e));
        } else {
          window._iaMemoireCache = { erreurs: {} };
        }
      } catch(e) { window._iaMemoireCache = { erreurs: {} }; }
    }
  }).catch(e => {
    console.warn('Mémoire IA Firebase non accessible, utilisation localStorage', e);
    // Fallback : garder localStorage
  });

  // Écoute temps réel des prescriptions
  let _renderPending = false;
  window.tenantQuery(_prescriptionsCol).onSnapshot((snapshot) => {
    const data = [];
    snapshot.forEach(d => data.push(d.data()));
    data.sort((a, b) => (b._ts || 0) - (a._ts || 0));
    // Réinjecter les photos : priorité Cloudinary (photo_url), sinon cache local/session
    data.forEach(p => {
      if (p.photo_html) {
        p.photo = p.photo_html;
        p._photoType = 'html';
      } else if (p.photo_url) {
        p.photo = p.photo_url;
        p._photoType = p.photo_type || 'image';
      } else if (p.photo === '__photo__' && p._id) {
        p.photo = window._photoCache[p._id]
               || sessionStorage.getItem('photo_' + p._id)
               || null;
      }
    });

    if (editingIndex >= 0) {
      // ── MODE ÉDITION : merger sans écraser ──
      // Garder la prescription en cours d'édition intacte, ajouter/mettre à jour les autres
      const editId = (window.prescriptions[editingIndex] || {})._id;
      const existingIds = new Set((window.prescriptions || []).map(p => p._id));

      // Ajouter les nouvelles prescriptions (du scan IA) sans toucher aux existantes
      data.forEach(p => {
        if (p._id === editId) return; // ne pas toucher à celle en édition
        const idx = window.prescriptions.findIndex(x => x._id === p._id);
        if (idx >= 0) {
          // Mise à jour d'une existante (sauf celle en édition)
          window.prescriptions[idx] = p;
        } else {
          // Nouvelle prescription (ajoutée par le scan IA)
          window.prescriptions.push(p);
        }
      });

      // Supprimer les prescriptions qui n'existent plus dans Firebase (supprimées ailleurs)
      const firebaseIds = new Set(data.map(p => p._id));
      window.prescriptions = window.prescriptions.filter(p => p._id === editId || firebaseIds.has(p._id));

      window._renderAfterEdit = true;
    } else {
      // ── MODE NORMAL : remplacement complet ──
      window.prescriptions = data;
      // Nettoyer les codes labo pending (maintenant dans Firebase)
      window._pendingCodeLabos = [];
      if (!_renderPending) {
        _renderPending = true;
        setTimeout(() => {
          _renderPending = false;
          if (typeof window.renderList === 'function') window.renderList();
        }, 0);
      }
    }
  });

  // Écoute nextNum
  _metaDoc.onSnapshot((snap) => {
    if (snap.exists && snap.data().tenant_id === window.TENANT_ID) {
      const d = snap.data();
      if (d && d.nextNum && d.nextNum > (window.nextNum || 0)) window.nextNum = d.nextNum;
    }
  });

  // ── Cloudinary config ──
  const CLOUDINARY_CLOUD = 'dqxusgkff';
  const CLOUDINARY_PRESET = 'ILOVESMILE';

  // Upload vers Cloudinary → retourne l'URL publique
  window.uploadPhotoCloudinary = async function(dataUrl) {
    if (!dataUrl || dataUrl === '__photo__') return null;
    try {
      const isPdf = dataUrl.startsWith('data:application/pdf');
      // Pour les PDFs : convertir en Blob binaire
      let fileData = dataUrl;
      if (isPdf) {
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        fileData = new Blob([bytes], { type: 'application/pdf' });
      }
      const formData = new FormData();
      // Pour les PDFs : nommer le fichier avec .pdf pour que l'URL Cloudinary contienne l'extension
      if (isPdf) {
        formData.append('file', fileData, 'prescription.pdf');
        formData.append('public_id', 'ilovesmile/presc_' + Date.now());
      } else {
        formData.append('file', fileData);
      }
      formData.append('upload_preset', CLOUDINARY_PRESET);
      formData.append('folder', 'ilovesmile');
      // PDFs → endpoint raw, images → auto
      const endpoint = isPdf ? 'raw' : 'auto';
      const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${endpoint}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await resp.json();
      return data.secure_url || null;
    } catch(e) {
      console.error('Erreur upload Cloudinary', e);
      return null;
    }
  };

  // ── Réservation atomique nextNum (anti-collision multi-user) ───────────
  // Réserve n numéros consécutifs via transaction Firebase.
  // Retourne le premier numéro réservé. Jamais de collision entre sessions.
  window._reserverNextNums = async function(n = 1) {
    const db = getDB();
    if (!db) { const f = window.nextNum || 31461; window.nextNum = f + n; return f; }
    try {
      let debut;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(_metaDoc);
        const current = (snap.exists && snap.data().nextNum) ? snap.data().nextNum : (window.nextNum || 31461);
        debut = current;
        tx.set(_metaDoc, window.withTenant({ nextNum: current + n }), { merge: true });
      });
      window.nextNum = debut + n;
      return debut;
    } catch(e) {
      console.error('Erreur réservation nextNum:', e);
      const f = window.nextNum || 31461; window.nextNum = f + n; return f;
    }
  };

  // Fonctions cloud
  window.sauvegarderUnePrescription = async function(p) {
    try {
      if (!p._id) p._id = 'id_' + Date.now() + Math.random().toString(36).slice(2);

      let photoUrl = p.photo_url || null;

      // Upload seulement si nouvelle photo base64 ET pas déjà sur Cloudinary
      if (p.photo && p.photo !== '__photo__' && !p.photo.startsWith('http') && p.photo.startsWith('data:') && !photoUrl) {
        window._photoCache[p._id] = p.photo;
        const isHtmlPhoto = p.photo.startsWith('data:text/html');
        const isPdfPhoto  = p.photo.startsWith('data:application/pdf');
        if (isHtmlPhoto) {
          p.photo_html = p.photo;
          p.photo_type = 'html';
          // Uploader le HTML comme fichier .html sur Cloudinary (ouvrable dans le navigateur via QR)
          try {
            const _htmlBase64 = p.photo.split(',')[1];
            const _htmlBinary = atob(_htmlBase64);
            const _htmlBytes = new Uint8Array(_htmlBinary.length);
            for (let _i = 0; _i < _htmlBinary.length; _i++) _htmlBytes[_i] = _htmlBinary.charCodeAt(_i);
            const _htmlBlob = new Blob([_htmlBytes], { type: 'text/html' });
            const _htmlForm = new FormData();
            _htmlForm.append('file', _htmlBlob, 'prescription_' + Date.now() + '.html');
            _htmlForm.append('upload_preset', CLOUDINARY_PRESET);
            _htmlForm.append('folder', 'ilovesmile');
            _htmlForm.append('resource_type', 'raw');
            const _htmlResp = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/raw/upload', {
              method: 'POST', body: _htmlForm
            });
            const _htmlData = await _htmlResp.json();
            if (_htmlData.secure_url) {
              p.photo_url = _htmlData.secure_url;
              photoUrl = _htmlData.secure_url;
              showToast('✅ Fiche HTML sauvegardée + lien cloud !');
            } else {
              showToast('✅ Fiche HTML sauvegardée !');
            }
          } catch(e) {
            console.warn('Upload HTML cloud échoué', e);
            showToast('✅ Fiche HTML sauvegardée !');
          }
        } else {
          try {
            showToast('📤 Upload en cours...');
            photoUrl = await window.uploadPhotoCloudinary(p.photo);
            if (photoUrl) {
              p.photo_url  = photoUrl;
              p.photo_type = isPdfPhoto ? 'pdf' : 'image';
              showToast(isPdfPhoto ? '✅ PDF sauvegardé dans le cloud !' : '✅ Image sauvegardée dans le cloud !');
              // Bug PDF 2 fix — mettre à jour aussi dans window.prescriptions avant onSnapshot
              if (window.prescriptions) {
                const idx = window.prescriptions.findIndex(x => x._id === p._id);
                if (idx !== -1) {
                  window.prescriptions[idx].photo_url  = photoUrl;
                  window.prescriptions[idx].photo_type = p.photo_type;
                  window.prescriptions[idx]._photoType = p.photo_type;
                }
              }
            } else {
              showToast('⚠️ Upload Cloudinary échoué — photo non sauvegardée dans le cloud', true);
            }
          } catch(e) {
            console.warn('[SAVE] Upload Cloudinary échoué, prescription sauvegardée sans photo cloud', e);
            showToast('⚠️ Upload photo échoué — prescription sauvegardée quand même', true);
          }
        }
      }

      // Bug PDF 5 fix — tous les champs photo toujours explicites dans pSans
      const pSans = {
        ...p,
        photo:      p.photo ? '__photo__' : null,
        _ts:        Date.now(),
        photo_url:  p.photo_url  || null,
        photo_type: p.photo_type || null,
        photo_html: p.photo_html || null,
        cogilog_exporte: p.cogilog_exporte || null,
        _digilabCaseId: p._digilabCaseId || null,
        _digilabService: p._digilabService || null,
      };
      // Nettoyer les undefined (Firebase les refuse)
      Object.keys(pSans).forEach(k => { if (pSans[k] === undefined) pSans[k] = null; });
      await _prescriptionsCol.doc(p._id).set(window.withTenant(pSans));
      // Debounce l'écriture de nextNum pour éviter le rate-limit 429 en scan batch
      _debounceSaveNextNum();
    } catch(e) {
      console.error('Erreur sauvegarde Firebase', e);
      showToast('⚠️ Erreur sauvegarde cloud', true);
    }
  };

  // Écriture de nextNum debounced (1 seule écriture même si 50 fiches sauvegardées en rafale)
  let _nextNumTimer = null;
  function _debounceSaveNextNum() {
    clearTimeout(_nextNumTimer);
    _nextNumTimer = setTimeout(function() {
      _metaDoc.set(window.withTenant({ nextNum: window.nextNum || 31461 }), { merge: true })
        .catch(function(e) { console.warn('nextNum sync échoué:', e.message); });
    }, 3000);
  }

  window.sauvegarderPrescriptions = async function() {
    try {
      for (const p of (window.prescriptions || [])) {
        if (!p._id) p._id = 'id_' + Date.now() + Math.random().toString(36).slice(2);
        const pSans = { ...p, photo: p.photo ? '__photo__' : null };
        await _prescriptionsCol.doc(p._id).set(window.withTenant(pSans));
      }
      _debounceSaveNextNum();
    } catch(e) {
      console.error('Erreur sauvegarde Firebase', e);
      showToast('⚠️ Erreur sauvegarde cloud', true);
    }
  };

  window.supprimerPrescriptionCloud = async function(id) {
    try {
      await _prescriptionsCol.doc(id).delete();
    } catch(e) {
      console.error('Erreur suppression Firebase', e);
    }
  };

  window._firebaseReady = true;
  console.log('✅ Firebase connecté');
  const statusEl = document.getElementById('firebase-status');
  if (statusEl) statusEl.textContent = '☁️ Cloud connecté';
  // Re-render si données déjà chargées
  if (window.prescriptions && window.prescriptions.length > 0 && typeof renderList === 'function') {
    renderList();
  }
  // Charger le filtre période et les alias sauvegardés
  if (typeof chargerFiltrePeriode === 'function') chargerFiltrePeriode();
  if (typeof _chargerAliasesFirebase === 'function') {
    _chargerAliasesFirebase();
    // Sync initiale : sauvegarder les alias locaux vers Firebase s'ils existent
    setTimeout(function() {
      if (localStorage.getItem('cabinet_aliases')) _syncAliasesToFirebase('cabinet');
      if (localStorage.getItem('product_aliases')) _syncAliasesToFirebase('product');
    }, 3000);
  }
}
// initFirebase() est appele par auth.js apres connexion

