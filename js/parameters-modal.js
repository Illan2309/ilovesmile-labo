// ══════════════════════════════════════════════════════════════════
// MODALE PARAMÈTRES
// ══════════════════════════════════════════════════════════════════

var _pmTabActif = 'mapping';
var _pmMappingData = null; // copie locale éditable

function ouvrirModalParametres() {
  document.getElementById('modal-parametres').style.display = 'flex';
  // Charger la data en mémoire
  _pmMappingData = Object.assign({}, chargerCodesCogilog());
  pmSwitchTab('mapping');
}

function fermerModalParametres() {
  document.getElementById('modal-parametres').style.display = 'none';
}

function pmSwitchTab(tab) {
  _pmTabActif = tab;
  const panels = { mapping: 'pm-panel-mapping', labels: 'pm-panel-labels', prefs: 'pm-panel-prefs' };
  const btns   = { mapping: 'pm-tab-mapping-btn', labels: 'pm-tab-labels-btn', prefs: 'pm-tab-prefs-btn' };
  Object.keys(panels).forEach(t => {
    const p = document.getElementById(panels[t]);
    const b = document.getElementById(btns[t]);
    if (p) p.style.display = t === tab ? 'flex' : 'none';
    if (b) { b.style.background = t === tab ? dmTabActive() : dmTabInactive(); b.style.color = t === tab ? '#6a1b9a' : dmTabTextInactive(); }
  });
  if (tab === 'mapping') pmRenderMapping();
  else if (tab === 'labels') pmRenderLabels();
  else if (tab === 'prefs') pmRenderPrefs();
}

// ── MAPPING ───────────────────────────────────────────────────────

// Groupes pour le mapping
var PM_GROUPES_MAPPING = {
  'CONJOINTE': ['CCM','CIV','Couronne coulée','EMAX','Zirconium CCC','Full zirconium','Dent provisoire','Richmond','Ceramic Rose Collet',
    'Implant CCM','Implant scellé','Implant transvisé','Implant CCC','Inlay Core','Inlay Core céramisé','Inlay Core clavette',
    'Inlay Onlay','Inlay Onlay composite','Inlay Onlay céramique','Inlay Onlay métal','Facette','Facette composite','Facette céramique',
    'Épaulement céram.','Ailette métal','Unitaire','Solidaire','Armature'],
  'ADJOINTE': ['PEI',"Cire d'occlusion",'Stellite plaque nue','Stellite','Stellite finition','Stellite montage stellite',
    'Stellite finition stellite','Stellite sup. valplast','Ackers stellite','Stellite Valplast',
    'App résine','App résine finition','Ackers résine','Complet résine','Complet','Complet finition',
    'Valplast','Valplast finition','Ackers valplast','Gouttière souple','Gouttière dur résine',
    'Gouttière souple intra dur extra','Blanchissement','Contention','App résine grille de renfort',
    'Complet grille de renfort','Valplast grille de renfort','App résine montage','Complet montage','Valplast montage'],
  'DIVERS': ['Réparation','Rebasage','Fraisage','PIV','Scan','Adjonction dent','Adjonction','Adjonction crochet'],
};

function pmGetGroupe(item) {
  for (const [g, items] of Object.entries(PM_GROUPES_MAPPING)) {
    if (items.includes(item)) return g;
  }
  return 'DIVERS';
}

function pmRenderMapping(filtreTexte, filtreGroupe) {
  const tbody = document.getElementById('pm-mapping-tbody');
  if (!tbody) return;
  const search = (filtreTexte ?? document.getElementById('pm-mapping-search')?.value ?? '').toLowerCase().trim();
  const groupe = filtreGroupe ?? document.getElementById('pm-mapping-groupe')?.value ?? '';

  const entries = Object.entries(_pmMappingData || {});
  const filtered = entries.filter(([item]) => {
    const matchSearch = !search || item.toLowerCase().includes(search);
    const matchGroupe = !groupe || pmGetGroupe(item) === groupe;
    return matchSearch && matchGroupe;
  });

  // Couleurs de groupe
  const groupeColors = { CONJOINTE: '#e3f2fd', ADJOINTE: '#f3e5f5', DIVERS: '#e8f5e9' };
  const groupeTextColors = { CONJOINTE: '#1565c0', ADJOINTE: '#6a1b9a', DIVERS: '#2e7d32' };

  tbody.innerHTML = filtered.map(([item, code], idx) => {
    const gr = pmGetGroupe(item);
    const libelle = code ? (COGILOG_LIBELLES[code] || '—') : '—';
    const codeValide = code && COGILOG_LIBELLES[code];
    const bg = idx % 2 === 0 ? 'white' : '#fafafa';
    const safeItem = _enc(item);
    return `<tr style="background:${bg}; border-bottom:1px solid #f0ecf8;" data-item="${item.replace(/"/g,'&quot;')}">
      <td style="padding:5px 8px; text-align:center;">
        <span style="font-size:0.8rem; color:${codeValide ? '#2e7d32' : (code ? '#e65100' : '#bbb')};">${codeValide ? '✅' : (code ? '⚠️' : '○')}</span>
      </td>
      <td style="padding:5px 12px; font-size:0.78rem; color:#333; font-weight:500;">${item}</td>
      <td style="padding:5px 8px;">
        <input type="text" value="${code || ''}" placeholder="Code…"
          onchange="pmUpdateCode(decodeURIComponent('${safeItem}'), this.value)"
          oninput="pmSuggestCode(this)"
          style="width:100%; padding:4px 8px; border:1px solid ${codeValide ? '#b2dfdb' : '#d0c0e8'}; border-radius:6px; font-size:0.76rem; font-family:'DM Mono',monospace; color:#1a5c8a; font-weight:600; box-sizing:border-box;"
          autocomplete="off" list="pm-codes-list">
      </td>
      <td style="padding:5px 8px; font-size:0.73rem; color:#555; font-style:${libelle === '—' ? 'italic' : 'normal'};">${libelle}</td>
      <td style="padding:5px 8px;">
        <span style="font-size:0.65rem; padding:2px 7px; border-radius:10px; background:${groupeColors[gr]||'#f5f5f5'}; color:${groupeTextColors[gr]||'#555'}; font-weight:600;">${gr}</span>
      </td>
      <td style="padding:5px 8px; text-align:center;">
        <button onclick="pmSupprimerLigne(decodeURIComponent('${safeItem}'))" style="background:none; border:none; cursor:pointer; font-size:0.8rem; color:#ccc;" title="Supprimer">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  // Datalist pour autocomplétion codes
  let dl = document.getElementById('pm-codes-list');
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = 'pm-codes-list';
    document.body.appendChild(dl);
  }
  dl.innerHTML = Object.keys(COGILOG_LIBELLES).map(c => `<option value="${c}">${COGILOG_LIBELLES[c]}</option>`).join('');
}

function pmFiltrerMapping() {
  pmRenderMapping();
}

function pmUpdateCode(item, code) {
  if (!_pmMappingData) return;
  _pmMappingData[item] = code.trim();
  // Mettre à jour le libellé affiché dans la ligne
  pmRenderMapping();
  pmMarquerModifie();
}

function pmSupprimerLigne(item) {
  if (!confirm(`Supprimer la ligne "${item}" du mapping ?`)) return;
  delete _pmMappingData[item];
  pmRenderMapping();
  pmMarquerModifie();
}

function pmAjouterLigne() {
  const item = prompt('Nom du nouvel item (tel qu\'il apparaît dans le formulaire) :');
  if (!item || !item.trim()) return;
  const nomTrim = item.trim();
  if (_pmMappingData[nomTrim] !== undefined) { showToast('Cet item existe déjà', true); return; }
  _pmMappingData[nomTrim] = '';
  pmRenderMapping();
  pmMarquerModifie();
  showToast(`✅ "${nomTrim}" ajouté — assigne-lui un code`);
}

function pmResetMapping() {
  if (!confirm('Réinitialiser tous les codes aux valeurs par défaut ? Les modifications seront perdues.')) return;
  _pmMappingData = Object.assign({}, COGILOG_CODES_DEFAULT);
  pmRenderMapping();
  pmMarquerModifie();
  showToast('↩ Mapping réinitialisé aux valeurs par défaut');
}

function pmMarquerModifie() {
  const st = document.getElementById('pm-save-status');
  if (st) { st.textContent = '● Modifié, non sauvegardé'; st.style.color = '#e65100'; }
}

// ── LABELS ────────────────────────────────────────────────────────

function pmRenderLabels() {
  const tbody = document.getElementById('pm-labels-tbody');
  if (!tbody) return;

  const tousGroupes = GROUPES_ACTES;
  const codeToGroupe = {};
  Object.entries(tousGroupes).forEach(([g, codes]) => codes.forEach(c => codeToGroupe[c] = g));

  const entries = Object.entries(window.ACTE_LABELS || {});
  tbody.innerHTML = entries.map(([code, label], idx) => {
    const gr = codeToGroupe[code] || '—';
    const bg = idx % 2 === 0 ? 'white' : '#fafafa';
    return `<tr style="background:${bg}; border-bottom:1px solid #f0f0f0;">
      <td style="padding:5px 12px; font-family:'DM Mono',monospace; font-size:0.74rem; color:#6a1b9a; font-weight:600;">${code}</td>
      <td style="padding:5px 8px;">
        <input type="text" value="${label.replace(/"/g,'&quot;')}"
          onchange="pmUpdateLabel(decodeURIComponent('${_enc(code)}'), this.value)"
          style="width:100%; padding:4px 8px; border:1px solid #e0d0f0; border-radius:6px; font-size:0.78rem; font-family:'DM Sans',sans-serif; box-sizing:border-box;">
      </td>
      <td style="padding:5px 12px; font-size:0.72rem; color:#888;">${gr}</td>
    </tr>`;
  }).join('');
}

function pmUpdateLabel(code, val) {
  if (!val.trim()) return;
  window.ACTE_LABELS[code] = val.trim();
  pmMarquerModifie();
}

// ── PRÉFÉRENCES ───────────────────────────────────────────────────

function pmRenderPrefs() {
  const el = document.getElementById('pm-prefs-content');
  if (!el) return;
  const prefs = window._appPrefs || {};

  el.innerHTML = `
    <div style="max-width:600px;">
      <h3 style="font-size:0.85rem; font-weight:700; color:#4a148c; margin:0 0 16px;">🎛️ Préférences générales</h3>

      <!-- Export Cogilog -->
      <div style="background:#f8f4ff; border:1px solid #d0c0e8; border-radius:10px; padding:16px; margin-bottom:14px;">
        <div style="font-size:0.8rem; font-weight:700; color:#6a1b9a; margin-bottom:12px;">📦 Export Cogilog</div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label style="display:flex; align-items:center; gap:10px; font-size:0.78rem; cursor:pointer;">
            <input type="checkbox" ${prefs.cogilog_skip_vide !== false ? 'checked' : ''}
              onchange="pmUpdatePref('cogilog_skip_vide', this.checked)"
              style="width:16px; height:16px; accent-color:#6a1b9a;">
            <span>Ignorer les actes sans code Cogilog lors de l'export</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; font-size:0.78rem; cursor:pointer;">
            <input type="checkbox" ${prefs.cogilog_alerte_sans_code ? 'checked' : ''}
              onchange="pmUpdatePref('cogilog_alerte_sans_code', this.checked)"
              style="width:16px; height:16px; accent-color:#6a1b9a;">
            <span>Afficher une alerte si des actes n'ont pas de code lors de l'export</span>
          </label>
        </div>
      </div>

      <!-- Interface -->
      <div style="background:#f8f4ff; border:1px solid #d0c0e8; border-radius:10px; padding:16px; margin-bottom:14px;">
        <div style="font-size:0.8rem; font-weight:700; color:#6a1b9a; margin-bottom:12px;">🖥️ Interface</div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label style="display:flex; align-items:center; gap:10px; font-size:0.78rem; cursor:pointer;">
            <input type="checkbox" ${prefs.rappel_note_prescription !== false ? 'checked' : ''}
              onchange="pmUpdatePref('rappel_note_prescription', this.checked)"
              style="width:16px; height:16px; accent-color:#6a1b9a;">
            <span>Afficher le rappel de note cabinet à l'ouverture d'une prescription</span>
          </label>
          <label style="display:flex; align-items:center; gap:10px; font-size:0.78rem; cursor:pointer;">
            <input type="checkbox" ${prefs.alerte_inactivite !== false ? 'checked' : ''}
              onchange="pmUpdatePref('alerte_inactivite', this.checked)"
              style="width:16px; height:16px; accent-color:#6a1b9a;">
            <span>Afficher l'alerte d'inactivité sur les fiches clients (seuil : 30 jours)</span>
          </label>
        </div>
      </div>

      <!-- Clés API & expirations -->
      <div style="background:#f8f4ff; border:1px solid #d0c0e8; border-radius:10px; padding:16px; margin-bottom:14px;">
        <div style="font-size:0.8rem; font-weight:700; color:#6a1b9a; margin-bottom:12px;">🔑 Clés API & expirations</div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div>
            <label style="font-size:0.72rem; color:#888; display:block; margin-bottom:2px;">Expiration clé Digilab API <span id="pm-digilab-expiry-info" style="color:#bbb; font-size:0.68rem;"></span></label>
            <input type="date" id="pm-digilab-expiry" value="${prefs.digilab_api_key_expires_at || '2027-04-22'}"
              onchange="pmUpdatePref('digilab_api_key_expires_at', this.value); pmMajExpiryInfo()"
              style="width:100%; padding:6px 10px; border:1px solid #d0c0e8; border-radius:8px; font-size:0.78rem; box-sizing:border-box;">
            <div style="font-size:0.68rem; color:#888; margin-top:4px;">Une alerte rouge apparaitra 30 jours avant expiration. À renouveler en contactant Digilab pour obtenir une nouvelle clé <code>dlb_live_*</code>, puis la mettre à jour dans Cloudflare (secret <code>DIGILAB_API_KEY</code>).</div>
          </div>
        </div>
      </div>

      <!-- Dropbox / Fournisseurs -->
      <div style="background:#f8f4ff; border:1px solid #d0c0e8; border-radius:10px; padding:16px; margin-bottom:14px;">
        <div style="font-size:0.8rem; font-weight:700; color:#6a1b9a; margin-bottom:12px;">📤 Envoi Dropbox / Fournisseurs</div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div>
            <label style="font-size:0.72rem; color:#888; display:block; margin-bottom:2px;">Email MERDENTAL</label>
            <input type="email" value="${prefs.email_fournisseur_merdental || 'kerry@merdental.com'}"
              onchange="pmUpdatePref('email_fournisseur_merdental', this.value)"
              style="width:100%; padding:6px 10px; border:1px solid #d0c0e8; border-radius:8px; font-size:0.78rem; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:0.72rem; color:#888; display:block; margin-bottom:2px;">Email HUILE</label>
            <input type="email" value="${prefs.email_fournisseur_huile || 'customerdata@microunion.com'}"
              onchange="pmUpdatePref('email_fournisseur_huile', this.value)"
              style="width:100%; padding:6px 10px; border:1px solid #d0c0e8; border-radius:8px; font-size:0.78rem; box-sizing:border-box;">
          </div>
        </div>
      </div>

      <!-- Info -->
      <div style="background:#f5f5f5; border-radius:8px; padding:12px; font-size:0.73rem; color:#888; line-height:1.6;">
        💡 Les préférences et le mapping sont sauvegardés dans Firebase et s'appliquent sur tous les appareils.
      </div>
    </div>
  `;
  // Mise à jour de l'indicateur jours restants pour la clé Digilab
  if (typeof pmMajExpiryInfo === 'function') pmMajExpiryInfo();
}

function pmUpdatePref(key, val) {
  if (!window._appPrefs) window._appPrefs = {};
  window._appPrefs[key] = val;
  pmMarquerModifie();
}

// Affiche "(expire dans Xj)" ou "(EXPIRÉE)" à côté du label
function pmMajExpiryInfo() {
  const el = document.getElementById('pm-digilab-expiry-info');
  if (!el) return;
  const dateStr = (window._appPrefs && window._appPrefs.digilab_api_key_expires_at) || '2027-04-22';
  const exp = new Date(dateStr);
  if (isNaN(exp)) { el.textContent = ''; return; }
  const today = new Date(); today.setHours(0,0,0,0);
  exp.setHours(0,0,0,0);
  const days = Math.round((exp - today) / 86400000);
  if (days < 0) {
    el.textContent = '⚠️ EXPIRÉE depuis ' + Math.abs(days) + ' jour(s)';
    el.style.color = '#c62828'; el.style.fontWeight = '700';
  } else if (days <= 30) {
    el.textContent = '⚠️ Expire dans ' + days + ' jour(s)';
    el.style.color = '#e65100'; el.style.fontWeight = '700';
  } else {
    el.textContent = '(expire dans ' + days + ' jours)';
    el.style.color = '#888'; el.style.fontWeight = '400';
  }
}

// Vérifie l'expiration de la clé Digilab au chargement de l'app et alerte si proche.
// Re-affiche l'alerte tous les 7 jours (anti-spam via localStorage).
window.checkDigilabApiKeyExpiry = function() {
  try {
    const dateStr = (window._appPrefs && window._appPrefs.digilab_api_key_expires_at) || '2027-04-22';
    const exp = new Date(dateStr);
    if (isNaN(exp)) return;
    const today = new Date(); today.setHours(0,0,0,0);
    exp.setHours(0,0,0,0);
    const days = Math.round((exp - today) / 86400000);

    // Anti-spam : ne pas re-alerter si on a déjà alerté < 7 jours
    const lastAlert = parseInt(localStorage.getItem('digilab_expiry_last_alert') || '0', 10);
    const daysSinceLastAlert = (Date.now() - lastAlert) / 86400000;

    if (days < 0) {
      // Expirée : alerte à chaque démarrage (critique)
      if (typeof showToast === 'function') {
        showToast('🚨 Clé API Digilab EXPIRÉE depuis ' + Math.abs(days) + ' j — renouveler chez Digilab puis mettre à jour le secret DIGILAB_API_KEY dans Cloudflare', true);
      }
    } else if (days <= 30 && daysSinceLastAlert >= 7) {
      // Proche expiration : 1 alerte tous les 7 jours
      if (typeof showToast === 'function') {
        showToast('⚠️ Clé API Digilab expire dans ' + days + ' jour(s) — pense à la renouveler', true);
      }
      localStorage.setItem('digilab_expiry_last_alert', String(Date.now()));
    }
  } catch (e) { /* silencieux */ }
};

// ── SAUVEGARDE GLOBALE ────────────────────────────────────────────

async function pmSauvegarderTout() {
  const db = getDB();
  if (!db) { showToast('Firebase non disponible', true); return; }

  try {
    // 1. Mapping Cogilog → Firebase + localStorage
    const mappingANettoyer = Object.fromEntries(
      Object.entries(_pmMappingData || {}).map(([k,v]) => [k, v || ''])
    );
    await db.collection('meta').doc('cogilog_mapping').set(window.withTenant(mappingANettoyer));
    sauvegarderCodesCogilogData(mappingANettoyer);
    // Mettre à jour en mémoire
    Object.assign(COGILOG_CODES_DEFAULT, mappingANettoyer);

    // 2. Labels actes → Firebase
    await db.collection('meta').doc('acte_labels').set(window.withTenant(window.ACTE_LABELS || {}));

    // 3. Préférences → Firebase
    if (window._appPrefs) {
      await db.collection('meta').doc('app_prefs').set(window.withTenant(window._appPrefs));
    }

    const st = document.getElementById('pm-save-status');
    if (st) { st.textContent = '✅ Sauvegardé'; st.style.color = '#2e7d32'; setTimeout(() => { st.textContent = ''; }, 3000); }
    showToast('✅ Paramètres sauvegardés dans Firebase');
  } catch(e) {
    showToast('❌ Erreur : ' + e.message, true);
  }
}

// ── CHARGEMENT AU DÉMARRAGE ───────────────────────────────────────

function pmChargerDepuisFirebase(db) {
  // Mapping Cogilog
  db.collection('meta').doc('cogilog_mapping').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID) {
      const data = Object.assign({}, doc.data());
      delete data.tenant_id;
      Object.assign(COGILOG_CODES_DEFAULT, data);
      sauvegarderCodesCogilogData(data);
      console.log('🗂 Mapping Cogilog chargé depuis Firebase :', Object.keys(data).length, 'entrées');
    }
  }).catch(() => {});

  // Labels actes
  db.collection('meta').doc('acte_labels').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID) {
      const data = Object.assign({}, doc.data());
      delete data.tenant_id;
      Object.assign(window.ACTE_LABELS, data);
      console.log('🏷️ Labels actes chargés depuis Firebase');
    }
  }).catch(() => {});

  // Préférences
  db.collection('meta').doc('app_prefs').get().then(doc => {
    if (doc.exists && doc.data().tenant_id === window.TENANT_ID) {
      const data = Object.assign({}, doc.data());
      delete data.tenant_id;
      window._appPrefs = data;
    } else {
      window._appPrefs = {};
    }
    console.log('🎛️ Préférences chargées depuis Firebase');
    // Vérifier expiration de la clé Digilab API (alerte si <30j ou expirée)
    if (typeof window.checkDigilabApiKeyExpiry === 'function') {
      setTimeout(window.checkDigilabApiKeyExpiry, 1500);
    }
  }).catch(() => { window._appPrefs = {}; });
}

function exporterTarifsExcel() {
  const actes = getActesFiltres();
  const cabinets = tarifsSelectedCabinets;
  let csv = 'Acte;Code;' + cabinets.join(';') + '\n';
  actes.forEach(code => {
    const label = ACTE_LABELS[code] || code;
    const vals = cabinets.map(c => (TARIFS[c]?.[code] ?? '').toString().replace('.', ','));
    csv += `${label};${code};${vals.join(';')}\n`;
  });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tarifs_cabinets_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

// Fonction pour récupérer le tarif d'un cabinet/acte (utilisable dans export Cogilog)
function getTarif(nomCabinet, codeActe) {
  if (!nomCabinet) return null;
  // TARIFS inclut les surcharges éditables au-dessus de TARIFS_BASE
  const mappedKey = getTarifKey(nomCabinet);
  if (mappedKey && TARIFS[mappedKey] && TARIFS[mappedKey][codeActe] !== undefined) {
    return TARIFS[mappedKey][codeActe];
  }
  // Fallback normalisation directe
  const norm = s => s.toLowerCase().replace(/[''`_éèêëàâùûüîïôç']/g, c =>
    ({é:'e',è:'e',ê:'e',ë:'e',à:'a',â:'a',ù:'u',û:'u',ü:'u',î:'i',ï:'i',ô:'o',ç:'c',"'":" ","'":" ","`":" ","_":" "}[c]||c)
  ).replace(/\s+/g,' ').trim();
  const nomN = norm(nomCabinet);
  const key = Object.keys(TARIFS_BASE).find(k => norm(k) === nomN)
           || Object.keys(TARIFS_BASE).find(k => nomN.includes(norm(k)) && norm(k).length > 4)
           || Object.keys(TARIFS_BASE).find(k => norm(k).includes(nomN) && nomN.length > 4);
  return key ? (TARIFS_BASE[key]?.[codeActe] ?? null) : null;
}

// Résoudre le nom cabinet depuis un code Cogilog (ex: BROC01 → BROCA)
function getCabinetFromCodeCogilog(codeCogilog) {
  if (!codeCogilog) return '';
  const clientData = COGILOG_CLIENTS[codeCogilog];
  if (!clientData) return '';
  // clientData[3] = nom du client (ex: BROCA, COLLIARD, MEHDAOUI YASSINE)
  return clientData[3] || '';
}


// ── Nettoyage des faux "à refaire" ──────────────────────────────────────────
// Appelé manuellement depuis Paramètres → pour corriger les anciennes prescriptions
async function nettoyerFauxARefaire() {
  const db = getDB();
  if (!db) { showToast('Firebase non disponible', true); return; }

  const total = (window.prescriptions || []).filter(p => p.aRefaire === true).length;
  if (total === 0) { showToast('✅ Aucune prescription "à refaire" à réinitialiser'); return; }

  if (!confirm(total + ' prescription(s) ont "à refaire" coché.\nToutes vont être remises à zéro (non coché).\nContinuer ?')) return;

  const prescCopy = (window.prescriptions || []).map(p =>
    p.aRefaire === true ? Object.assign({}, p, { aRefaire: false, aRefaireActes: null }) : p
  );

  try {
    await db.collection('prescriptions').doc('data').set(window.withTenant({ prescriptions: prescCopy }));
    window.prescriptions = prescCopy;
    renderList();
    showToast('✅ ' + total + ' prescription(s) réinitialisée(s)');
  } catch(e) {
    showToast('❌ Erreur : ' + e.message, true);
  }
}
window.nettoyerFauxARefaire = nettoyerFauxARefaire;
