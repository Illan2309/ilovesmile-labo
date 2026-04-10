window._dentsActesCourant = {};

// Tous les items adjointe ont Haut/Bas + dent optionnel (sauf ACTES_SANS_DETAIL)
// Items conjointe avec leur propre numéro de dent
var ACTES_SOUS_DENT = [
  'Implant scellé','Implant transvisé',
  'Inlay Core céramisé','Inlay Core clavette',
  'Inlay Onlay composite','Inlay Onlay céramique','Inlay Onlay métal',
  'Facette composite','Facette céramique',
];

// Actes sans aucun détail
var ACTES_SANS_DETAIL = ['Unitaire','Solidaire','Armature','Richmond',
  'Maquillage sillon oui','Maquillage sillon non','Embrasure fermée','Embrasure ouverte',
  'Point de contact fort','Point de contact léger','Occlusion sous occ','Occlusion légère',
  'Occlusion forte','Limite sous gingival',
  'Stellite','App résine','Complet','Valplast','Gouttière','Adjonction',
  'Inlay Onlay','Facette','Implant CCM','Implant CCC'];

// Tous les items adjointe non listés dans ACTES_SANS_DETAIL → bulle Haut/Bas + dent
var ACTES_MACHOIRE = []; // plus utilisé directement — voir acteIsMachoire()
var ACTES_ADJOINTE_DENT = []; // plus utilisé — tout adjointe a haut/bas maintenant

function acteNeedsDetail(val) { return !ACTES_SANS_DETAIL.includes(val); }

// Tous les items adjointe ont Haut/Bas + dent optionnel — liste complète
var TOUS_ACTES_ADJOINTE = [
  'PEI','Ackers stellite','Stellite montage stellite','Stellite finition stellite',
  'Stellite sup. valplast','Ackers résine','App résine montage','App résine finition',
  "App résine grille de renfort",'Complet montage','Complet finition',
  'Complet grille de renfort','Ackers valplast','Valplast montage','Valplast finition',
  'Valplast grille de renfort','Gouttière','Gouttière souple','Gouttière dur résine',
  'Gouttière souple intra dur extra','Blanchissement','Contention',
  "Cire d'occlusion",'Réparation','Rebasage','Adjonction',
];
function acteIsMachoire(val) {
  return TOUS_ACTES_ADJOINTE.includes(val);
}
function acteIsSousDent(val) {
  return ACTES_SOUS_DENT.includes(val);
}
function acteIsAdjointegDent(val) {
  return false; // plus utilisé — tout adjointe a haut/bas
}

// ── Parser les dents depuis une string ──
// "13 14" → [13,14]   "13-15" → [13,14,15]   "13, 14" → [13,14]
// Ordre anatomique FDI complet
var FDI_FULL = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28,
                  48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];

function parseDentsString(str) {
  if (!str || !str.trim()) return [];
  const parts = str.split(/[,\s]+/).filter(Boolean);
  const dents = new Set();
  for (const part of parts) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = parseInt(range[1]), b = parseInt(range[2]);
      const ia = FDI_FULL.indexOf(a), ib = FDI_FULL.indexOf(b);
      if (ia !== -1 && ib !== -1) {
        // Plage dans l'ordre anatomique FDI
        const start = Math.min(ia, ib), end = Math.max(ia, ib);
        for (let i = start; i <= end; i++) dents.add(FDI_FULL[i]);
      } else {
        // Fallback numérique si dents non reconnues
        for (let d = Math.min(a,b); d <= Math.max(a,b); d++) {
          if (FDI_FULL.includes(d)) dents.add(d);
        }
      }
    } else {
      const n = parseInt(part);
      if (!isNaN(n) && FDI_FULL.includes(n)) dents.add(n);
    }
  }
  // Retourner dans l'ordre anatomique FDI
  return FDI_FULL.filter(d => dents.has(d));
}

// ── Formater les dents de façon compacte ──
function formatDentsCompact(dentsArr) {
  if (!dentsArr.length) return '';
  if (dentsArr.length <= 3) return dentsArr.join(' ');
  // Regrouper les séquences consécutives
  const groups = [];
  let start = dentsArr[0], prev = dentsArr[0];
  for (let i = 1; i <= dentsArr.length; i++) {
    const cur = dentsArr[i];
    if (cur === prev + 1) { prev = cur; continue; }
    groups.push(start === prev ? String(start) : start + '-' + prev);
    start = prev = cur;
  }
  const label = groups.join(' ');
  return label + ' (' + dentsArr.length + ')';
}

// ── Sync qty-input depuis le nombre de dents ──
function syncQtyFromDents(acteValue, dentsArr, machoire) {
  // qty-input supprimé — la quantité est déduite des dents au moment de l'export Cogilog
}

// ── Init listeners ──
function initActeDetailListeners() {
  document.querySelectorAll('input[name="conjointe"], input[name="adjointe"]').forEach(cb => {
    const lbl = cb.closest('label');
    if (!lbl) return;
    // Clic droit → ouvrir bulle dent/mâchoire
    lbl.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      if (acteNeedsDetail(cb.value)) {
        ouvrirBulleActe(cb, e);
      }
    });
  });
}

function initActeUncheckListeners() {
  document.querySelectorAll('input[name="conjointe"], input[name="adjointe"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (!cb.checked) {
        delete window._dentsActesCourant[cb.value];
        rafraichirBadgeActe(cb);
  
      }
    });
  });
}

var _bulleCurrentCb = null;

function ouvrirBulleActe(cb, triggerEvent) {
  fermerBulleActe();
  const val = cb.value;
  const isMach = acteIsMachoire(val);
  const current = window._dentsActesCourant[val] || '';

  const popup = document.createElement('div');
  popup.id = 'acte-detail-popup';

  const lbl = cb.closest('label');
  const rect = lbl.getBoundingClientRect();
  const popupH = isMach ? 160 : 150;
  const popupW = 230;
  // Toujours juste sous le label (rect.bottom = bas du label en viewport)
  let top = rect.bottom + 6;
  let left = rect.left;
  if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
  if (left < 4) left = 4;
  if (top + popupH > window.innerHeight - 8) top = rect.top - popupH - 6;
  if (top < 4) top = 4;
  popup.style.cssText = 'position:fixed;z-index:2000;background:white;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,0.22);padding:12px 14px;width:' + popupW + 'px;border:1px solid #d0e0ea;';
  popup.style.top = top + 'px';
  popup.style.left = left + 'px';

  const isSousDent = acteIsSousDent(val);
  const isAdjDent = acteIsAdjointegDent(val);
  const isOpt = isAdjDent || isSousDent; // champ dent optionnel

  popup.innerHTML = `
    <div style="font-size:0.72rem;font-weight:700;color:#1a5c8a;margin-bottom:8px;display:flex;justify-content:space-between;">
      <span>📌 ${val}</span>
      <span style="color:#888;cursor:pointer;font-size:1rem;" onclick="fermerBulleActe()">×</span>
    </div>
    ${isMach ? `
      <div style="font-size:0.68rem;color:#888;margin-bottom:5px;">Position :</div>
      <div class="acte-popup-jaw">
        <button id="jaw-haut" class="${current==='haut'||current.startsWith('haut|')?'active':''}" onclick="acteSetJaw('haut')">⬆ Haut</button>
        <button id="jaw-bas" class="${current==='bas'||current.startsWith('bas|')?'active':''}" onclick="acteSetJaw('bas')">⬇ Bas</button>
        <button id="jaw-2m" class="${current==='haut+bas'||current.startsWith('haut+bas|')?'active':''}" onclick="acteSetJaw('haut+bas')">↕ Les 2</button>
      </div>
      <div style="font-size:0.67rem;color:#aaa;margin:6px 0 3px;">Dents <span style="color:#ccc;">(optionnel)</span></div>
      <input type="text" id="acte-mach-dents" placeholder="ex: 34 35"
        value="${current.includes('|') ? current.split('|')[1] : ''}"
        onkeydown="if(event.key==='Enter'){validerBulleActe();}"
        style="width:100%;box-sizing:border-box;padding:4px 7px;font-size:0.78rem;border:1px solid #c8daf8;border-radius:7px;margin-bottom:8px;font-family:inherit;" autocomplete="off">
    ` : `
      <div style="font-size:0.68rem;color:#888;margin-bottom:4px;">Numéros de dents
        ${isOpt ? '<span style="color:#aaa;font-style:italic;"> (optionnel)</span>' : '<span style="color:#aaa;">(ex: 13 14 ou 13-15)</span>'}
      </div>
      <input type="text" id="acte-dent-input"
        placeholder="${isOpt ? 'ex: 37 (optionnel)' : 'ex: 13 14'}"
        value="${current}"
        oninput="actePreviewQty(this.value)"
        onkeydown="if(event.key==='Enter'){validerBulleActe();}"
        autocomplete="off">
      <div id="acte-qty-preview" style="font-size:0.68rem;color:#2e7d32;min-height:14px;margin-bottom:6px;"></div>
    `}
    <div class="acte-popup-actions">
      <button class="acte-popup-ok" onclick="validerBulleActe()">✓ OK</button>
      <button class="acte-popup-clear" onclick="effacerDetailActe(decodeURIComponent('${_enc(val)}'))">✕ Effacer</button>
    </div>`;

  document.body.appendChild(popup);
  _bulleCurrentCb = cb;

  if (!isMach) {
    const inp = document.getElementById('acte-dent-input');
    if (inp) {
      inp.focus(); inp.select();
      actePreviewQty(current);
    }
  }
  setTimeout(() => { document.addEventListener('mousedown', _bulleOutsideHandler); }, 50);
}

function actePreviewQty(val) {
  const preview = document.getElementById('acte-qty-preview');
  if (!preview) return;
  const dents = parseDentsString(val);
  if (dents.length === 0) { preview.textContent = ''; return; }
  preview.textContent = dents.length + ' élément' + (dents.length > 1 ? 's' : '') + ' → ' + formatDentsCompact(dents);
}

function _bulleOutsideHandler(e) {
  const popup = document.getElementById('acte-detail-popup');
  if (popup && !popup.contains(e.target)) fermerBulleActe();
}

function acteSetJaw(val) {
  ['haut','bas','haut+bas'].forEach(j => {
    const btn = document.getElementById('jaw-' + (j === 'haut+bas' ? '2m' : j));
    if (btn) btn.className = j === val ? 'active' : '';
  });
  window._jawTmp = val;
  // Auto-cocher HAUT / BAS selon le choix
  const cbHaut = document.querySelector('input[name="mach"][value="haut"]');
  const cbBas  = document.querySelector('input[name="mach"][value="bas"]');
  if (val === 'haut')     { if (cbHaut) cbHaut.checked = true; }
  else if (val === 'bas') { if (cbBas)  cbBas.checked  = true; }
  else if (val === 'haut+bas') {
    if (cbHaut) cbHaut.checked = true;
    if (cbBas)  cbBas.checked  = true;
  }
}

function validerBulleActe() {
  if (!_bulleCurrentCb) return;
  const inp = document.getElementById('acte-dent-input');
  const machDentsInp = document.getElementById('acte-mach-dents');

  if (inp) {
    // Conjointe : dents numériques
    const raw = inp.value.trim();
    window._dentsActesCourant[_bulleCurrentCb.value] = raw;
    const dents = parseDentsString(raw);
    syncQtyFromDents(_bulleCurrentCb.value, dents, null);
  } else if (machDentsInp !== null) {
    // Adjointe : position mâchoire + dents optionnelles
    // Récupérer la position active
    let jaw = window._jawTmp;
    if (!jaw) {
      // Lire depuis les boutons si pas de clic
      const current = window._dentsActesCourant[_bulleCurrentCb.value] || '';
      jaw = current.split('|')[0] || '';
    }
    const machDents = machDentsInp.value.trim();
    const stored = machDents ? jaw + '|' + machDents : jaw;
    window._dentsActesCourant[_bulleCurrentCb.value] = stored;
    syncQtyFromDents(_bulleCurrentCb.value, parseDentsString(machDents), jaw);
  }
  window._jawTmp = null;
  rafraichirBadgeActe(_bulleCurrentCb);
  fermerBulleActe();
}

function effacerDetailActe(val) {
  delete window._dentsActesCourant[val];
  if (_bulleCurrentCb) {
    rafraichirBadgeActe(_bulleCurrentCb);

  }
  fermerBulleActe();
}

function fermerBulleActe() {
  const popup = document.getElementById('acte-detail-popup');
  if (popup) popup.remove();
  document.removeEventListener('mousedown', _bulleOutsideHandler);
  _bulleCurrentCb = null;
}

function rafraichirBadgeActe(cb) {
  const lbl = cb.closest('label');
  if (!lbl) return;
  const old = lbl.querySelector('.acte-detail-badge');
  if (old) old.remove();
  const raw = window._dentsActesCourant[cb.value];
  if (!raw || !cb.checked) return;
  const isMach = acteIsMachoire(cb.value);
  let label;
  if (isMach) {
    const parts = raw.split('|');
    const pos = parts[0];
    const dts = parts[1] ? ' ' + parts[1] : '';
    label = (pos === 'haut+bas' ? '↕' : pos === 'haut' ? '⬆' : '⬇') + dts;
  } else {
    const dents = parseDentsString(raw);
    label = dents.length > 0 ? formatDentsCompact(dents) : raw;
  }
  const badge = document.createElement('span');
  badge.className = 'acte-detail-badge';
  badge.title = 'Cliquer pour modifier (' + raw + ')';
  badge.textContent = label;
  badge.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); ouvrirBulleActe(cb, e); });
  lbl.appendChild(badge);
}

function appliquerDentsActes(dentsActes) {
  window._dentsActesCourant = Object.assign({}, dentsActes || {});
  // Supprimer TOUS les badges existants (cases cochées ET non cochées)
  document.querySelectorAll('input[name="conjointe"], input[name="adjointe"]').forEach(cb => {
    const lbl = cb.closest('label');
    if (lbl) lbl.querySelectorAll('.acte-detail-badge').forEach(b => b.remove());
  });
  // Recréer uniquement pour les cases cochées
  document.querySelectorAll('input[name="conjointe"]:checked, input[name="adjointe"]:checked').forEach(cb => {
    rafraichirBadgeActe(cb);
    const raw = window._dentsActesCourant[cb.value];
    if (raw) {
      const isMach = acteIsMachoire(cb.value);
      const dents = isMach ? [] : parseDentsString(raw);
      syncQtyFromDents(cb.value, dents, isMach ? raw : null);
    }
  });
}


window.filtrerCabinets = function filtrerCabinets(val) {
  var box = document.getElementById('cabinet-suggestions');
  if (!box) return;
  if (!val || val.length < 1) { box.style.display = 'none'; return; }

  var _nAcc = function(s) { return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); };
  var q = _nAcc(val);

  // Source unique : COGILOG_CLIENTS (nom cabinet = data[3])
  // Dédoublonner par nom normalisé (garder le premier code trouvé)
  var seen = new Map();
  Object.entries(COGILOG_CLIENTS).forEach(function(e) {
    var code = e[0], data = e[1];
    var nom = (data[3] || '').trim();
    if (!nom) return;
    var nomN = _nAcc(nom);
    if (!seen.has(nomN)) seen.set(nomN, { code: code, nom: nom });
  });

  var matches = [];
  seen.forEach(function(v) {
    if (_nAcc(v.nom).includes(q) || _nAcc(v.code).includes(q)) matches.push(v);
  });
  matches = matches.slice(0, 12);

  if (!matches.length) { box.style.display = 'none'; return; }

  box.innerHTML = '';
  matches.forEach(function(item) {
    // Praticiens associés depuis CONTACTS_DENTISTES
    var source = (typeof CONTACTS !== 'undefined' && Object.keys(CONTACTS).length > 0) ? CONTACTS : CONTACTS_DENTISTES;
    var praticiens = [];
    Object.entries(source).forEach(function(e) {
      if (_nAcc(e[0]) === _nAcc(item.nom)) praticiens = e[1] || [];
    });
    var apercu = praticiens.filter(function(p){ return p !== 'Dr ???'; }).slice(0, 3).join(' · ');

    var div = document.createElement('div');
    div.style.cssText = 'padding:7px 10px;cursor:pointer;font-size:0.75rem;border-bottom:1px solid #eee;display:flex;justify-content:space-between;gap:8px;align-items:flex-start;';
    div.innerHTML = '<div style="flex:1;overflow:hidden;">'
      + '<div style="font-weight:600;color:#333;">' + item.nom + '<\/div>'
      + (apercu ? '<div style="font-size:0.68rem;color:#888;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + apercu + '<\/div>' : '')
      + '<\/div>'
      + '<span style="font-weight:600;color:var(--accent);white-space:nowrap;font-size:0.7rem;">' + item.code + '<\/span>';
    div.addEventListener('mouseover', function() { this.style.background = '#f0f7ff'; });
    div.addEventListener('mouseout', function() { this.style.background = ''; });
    div.addEventListener('mousedown', function() { choisirCabinet(item.code); });
    box.appendChild(div);
  });

  box.style.display = 'block';
}


// Choisir un cabinet depuis les CONTACTS (pas Cogilog)
window.choisirCabinetContact = function choisirCabinetContact(nom) {
  const inp = document.getElementById('cabinet');
  if (inp) { inp.value = nom; }
  const cog = document.getElementById('code-cogilog');
  const badge = document.getElementById('cogilog-code-badge');
  const clearBtn = document.getElementById('btn-clear-cabinet');
  const _nfkC = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const match = Object.entries(COGILOG_CLIENTS).find(function(e) {
    return _nfkC(e[1][3] || '') === _nfkC(nom);
  });
  const code = match ? match[0] : '';
  if (cog) cog.value = code;
  if (badge) { badge.textContent = code; badge.style.display = code ? 'block' : 'none'; }
  if (clearBtn) clearBtn.style.display = nom ? 'block' : 'none';
  fermerSuggestionsCabinet();
  setTimeout(() => ouvrirPraticiens(), 80);
}

window.choisirCabinet = function choisirCabinet(code, silent) {
  const data = COGILOG_CLIENTS[code];
  const inp = document.getElementById('cabinet');
  const cog = document.getElementById('code-cogilog');
  const badge = document.getElementById('cogilog-code-badge');
  const clearBtn = document.getElementById('btn-clear-cabinet');
  if (data) {
    if (inp) { inp.value = data[3] || ''; }
  }
  if (cog) cog.value = code;
  if (badge) { badge.textContent = code; badge.style.display = code ? 'block' : 'none'; }
  if (clearBtn) clearBtn.style.display = code ? 'block' : 'none';
  fermerSuggestionsCabinet();
  // silent=true : appelé depuis un scan automatique, ne pas ouvrir le dropdown praticiens
  if (!silent) setTimeout(() => ouvrirPraticiens(), 80);
}

window.fermerSuggestionsCabinet = function fermerSuggestionsCabinet() {
  const box = document.getElementById('cabinet-suggestions');
  if (box) box.style.display = 'none';
}

window.fermerSuggestionsCogilog = function fermerSuggestionsCogilog() {
  const box = document.getElementById('cogilog-suggestions');
  if (box) box.style.display = 'none';
}

window.effacerClientCogilog = function effacerClientCogilog() {
  const inp = document.getElementById('cabinet');
  const cog = document.getElementById('code-cogilog');
  const badge = document.getElementById('cogilog-code-badge');
  const clearBtn = document.getElementById('btn-clear-cabinet');
  const praticien = document.getElementById('praticien');
  if (inp) inp.value = '';
  if (cog) cog.value = '';
  if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
  if (clearBtn) clearBtn.style.display = 'none';
  if (praticien) praticien.value = '';
  fermerSuggestionsCabinet();
}
