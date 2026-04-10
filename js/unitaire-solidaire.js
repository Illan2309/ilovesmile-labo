window._solidGroups = [];
window._usSelection = new Set(); // dents sélectionnées dans la modal

// Seuls ces items peuvent être Unitaire/Solidaire (colonne gauche conjointe)
var ACTES_CONJOINTE_PRINCIPAUX = ['CCM','Couronne coulée','EMAX','Zirconium CCC',
  'Full zirconium','Dent provisoire','Implant CCM','Implant CCC'];

function ouvrirModalUnitSolid() {
  const existing = document.getElementById('popup-unit-solid');
  if (existing) existing.remove();

  window._usSelection = new Set();

  const popup = document.createElement('div');
  popup.id = 'popup-unit-solid';
  // Positionner comme une bulle sous les checkboxes Unitaire/Solidaire
  const _usAnchor = document.getElementById('lbl-solidaire') || document.getElementById('lbl-unitaire');
  const _usRect = _usAnchor ? _usAnchor.getBoundingClientRect() : { bottom: 200, left: 100 };
  const _usTop = Math.min(_usRect.bottom + 6, window.innerHeight - 340);
  const _usLeft = Math.max(4, Math.min(_usRect.left, window.innerWidth - 364));
  popup.style.cssText = 'position:fixed;z-index:2100;';
  popup.innerHTML = `<div class="us-modal" style="width:830px;max-width:calc(100vw - 16px);max-height:85vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,0.25);border:1px solid #d0e0ea;border-radius:14px;padding:14px 16px;background:white;position:fixed;top:${(() => { const r = (document.getElementById('lbl-solidaire')||document.getElementById('lbl-unitaire')).getBoundingClientRect(); return Math.min(r.bottom + 8, window.innerHeight - 420); })()}px;left:${(() => { const r = (document.getElementById('lbl-solidaire')||document.getElementById('lbl-unitaire')).getBoundingClientRect(); return Math.max(4, Math.min(r.left, window.innerWidth - 838)); })()}px;box-sizing:border-box;z-index:2200;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-weight:700;font-size:0.95rem;color:#1a5c8a;">🦷 Unitaire / Solidaire</span>
      <button onclick="document.getElementById('popup-unit-solid').remove();" style="border:none;background:none;font-size:1.3rem;cursor:pointer;color:#888;">×</button>
    </div>
    <div style="font-size:0.71rem;color:#888;margin-bottom:10px;">
      Clique ou fais glisser pour sélectionner plusieurs dents, puis choisis <b>Unitaire</b> ou <b>Solidaire</b>.
    </div>
    <div id="us-dents-zone" style="margin-bottom:12px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      <button onclick="usValiderSelection('unit')" style="flex:1;padding:8px;border:none;border-radius:9px;background:#dbeafe;color:#1e40af;cursor:pointer;font-size:0.8rem;font-weight:700;">• Unitaire</button>
      <button onclick="usValiderSelection('solid')" style="flex:1;padding:8px;border:none;border-radius:9px;background:#dcfce7;color:#166534;cursor:pointer;font-size:0.8rem;font-weight:700;">🔗 Solidaire</button>
      <button onclick="usResetGroupes()" style="padding:8px 12px;border:1px solid #fdd;border-radius:9px;background:#fff8f8;color:#c62828;cursor:pointer;font-size:0.78rem;">🗑</button>
    </div>
    <div id="us-groupes-zone" style="margin-bottom:10px;"></div>
    <button onclick="usFermerModal()" style="width:100%;padding:9px;border:none;border-radius:9px;background:linear-gradient(120deg,#1a5c8a,#5bc4c0);color:white;cursor:pointer;font-size:0.82rem;font-weight:700;">✓ Valider</button>
  </div>`;
  document.body.appendChild(popup);
  usRenderDents();
  usRenderGroupes();
  // Fermer si clic extérieur
  setTimeout(() => {
    document.addEventListener('mousedown', function _usOutside(e) {
      const p = document.getElementById('popup-unit-solid');
      if (p && !p.contains(e.target)) {
        p.remove();
        document.removeEventListener('mousedown', _usOutside);
      }
    });
  }, 100);
}

// Ordre anatomique FDI : 18→11 | 21→28 puis 48→41 | 31→38
var FDI_ORDER = [
  18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28,
  48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38
];
function fdiSort(arr) {
  return [...arr].sort((a,b) => {
    const ia = FDI_ORDER.indexOf(a), ib = FDI_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a - b;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function usGetToutesDents() {
  const dents = new Set();
  const _da = window._dentsActesCourant || {};

  // Actes principaux cochés (colonne gauche uniquement)
  const actesCochesPrinc = [...document.querySelectorAll('input[name="conjointe"]:checked')]
    .map(c => c.value).filter(v => ACTES_CONJOINTE_PRINCIPAUX.includes(v));

  actesCochesPrinc.forEach(acte => {
    const raw = _da[acte] || '';
    if (raw) parseDentsString(raw).forEach(d => dents.add(d));
    if (acte === 'Implant CCM' || acte === 'Implant CCC') {
      ['Implant scellé','Implant transvisé'].forEach(sub => {
        const rawSub = _da[sub] || '';
        if (rawSub) parseDentsString(rawSub).forEach(d => dents.add(d));
      });
    }
  });

  if (!dents.size) {
    (selectedDents || new Set()).forEach(d => dents.add(d));
  }
  // Retourner dans l'ordre anatomique FDI
  return fdiSort([...dents]);
}

function usRenderDents() {
  const zone = document.getElementById('us-dents-zone');
  if (!zone) return;

  const toutesDents = usGetToutesDents();
  if (!toutesDents.length) {
    zone.innerHTML = '<div style="font-size:0.75rem;color:#aaa;text-align:center;padding:12px;">Aucune dent renseignée — faites clic droit sur les actes pour ajouter les dents d\'abord.</div>';
    return;
  }

  // Dents déjà dans un groupe
  const dentsGroupees = new Map();
  window._solidGroups.forEach((g, idx) => {
    g.dents.forEach(d => dentsGroupees.set(d, { type: g.type, idx }));
  });

  // Map dent → nom court de l'acte
  const ACTE_COURT = {
    'CCM':'CCM','Couronne coulée':'FCC','EMAX':'EMAX','Zirconium CCC':'CCC',
    'Full zirconium':'FULL ZIR','Dent provisoire':'PROV','Implant CCM':'IMP CCM',
    'Implant CCC':'IMP CCC','Inlay Core':'IC','Inlay Onlay':'IO','Facette':'FAC','CIV':'CIV',
  };
  const _da = window._dentsActesCourant || {};
  // Construire map dent → acte
  const dentActeMap = new Map();
  const MAINS_ORDER = ['EMAX','Zirconium CCC','Full zirconium','Inlay Core','Inlay Onlay',
    'Facette','Implant CCM','Implant CCC','Dent provisoire','CCM','Couronne coulée','CIV'];
  MAINS_ORDER.forEach(acte => {
    const raw = _da[acte] || '';
    if (!raw) return;
    // parseDentsString gère les espaces ET les plages "13-15"
    const dents = parseDentsString(raw);
    dents.forEach(d => { if (!dentActeMap.has(d)) dentActeMap.set(d, ACTE_COURT[acte] || acte); });
  });

  // Couleurs fixes par type
  const GRP_COLORS = {
    solid: { bg: '#dcfce7', border: '#16a34a', color: '#14532d', sub: '#166534' },
    unit:  { bg: '#dbeafe', border: '#1d4ed8', color: '#1e3a8a', sub: '#1d4ed8' },
  };
  const SEL_STYLE = { bg: '#1a5c8a', border: '#1a5c8a', color: 'white', sub: 'rgba(255,255,255,0.8)' };
  const DEF_STYLE = { bg: '#f0f4ff', border: '#c8daf8', color: '#1a5c8a', sub: '#7aa4c4' };

  // Regrouper les dents par groupe pour l'affichage fusionné
  // Construire la liste avec info groupe pour chaque dent
  const dentInfos = toutesDents.map(d => ({
    d,
    grp: dentsGroupees.get(d),
    acte: dentActeMap.get(d) || '',
    sel: window._usSelection.has(d),
  }));

  // Grille alignée FDI : 16 colonnes, haut en face du bas
  const COLS_H = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28];
  const COLS_B = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];
  const dentInfoMap = new Map(dentInfos.map(x => [x.d, x]));

  const renderCell = (d) => {
    const info = dentInfoMap.get(d);
    if (!info) return `<div style="width:44px;flex-shrink:0;height:36px;"></div>`;
    const sel = info.sel, grp = info.grp;
    const st  = grp ? GRP_COLORS[grp.type] : DEF_STYLE;
    const bg2 = sel ? SEL_STYLE.bg : st.bg;
    const col2= sel ? SEL_STYLE.color : st.color;
    const sub2= sel ? SEL_STYLE.sub : st.sub;
    const brd = sel ? SEL_STYLE.border : st.border;
    return `<div data-dent="${d}" onclick="usToggleDent(${d})"
      style="width:44px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;
             padding:4px 2px;border-radius:8px;background:${bg2};color:${col2};
             border:2px solid ${brd};cursor:pointer;user-select:none;box-sizing:border-box;">
      <span style="font-weight:700;font-size:0.8rem;line-height:1.2;">${d}</span>
      <span style="font-size:0.44rem;font-weight:700;color:${sub2};white-space:nowrap;">${info.acte || ' '}</span>
    </div>`;
  };

  const sepV = '<div style="width:2px;flex-shrink:0;background:#cce0ea;margin:0 3px;border-radius:2px;align-self:stretch;"></div>';

  const renderGridRow = (cols) => {
    let h = '<div style="display:flex;flex-wrap:nowrap;gap:3px;align-items:stretch;">';
    let ci = 0;
    while (ci < cols.length) {
      if (ci === 8) h += sepV;
      const d = cols[ci];
      const info = dentInfoMap.get(d);
      const grp = info?.grp;
      // Fusion bloc solidaire adjacent
      if (grp && grp.type === 'solid' && info) {
        let j = ci + 1;
        while (j < cols.length && j !== 8) {
          const ni = dentInfoMap.get(cols[j]);
          if (!ni?.grp || ni.grp.idx !== grp.idx) break;
          j++;
        }
        if (j - ci > 1) {
          const st = GRP_COLORS['solid'];
          h += `<div style="display:inline-flex;border-radius:8px;border:2px solid ${st.border};overflow:hidden;gap:0;flex-shrink:0;">`;
          for (let k = ci; k < j; k++) {
            const dk = cols[k], ik = dentInfoMap.get(dk);
            if (!ik) { h += `<div style="width:44px;"></div>`; continue; }
            const sep = k > ci ? `border-left:1px solid ${st.border}55;` : '';
            const bg2 = ik.sel ? SEL_STYLE.bg : st.bg;
            const col2 = ik.sel ? SEL_STYLE.color : st.color;
            const sub2 = ik.sel ? SEL_STYLE.sub : st.sub;
            h += `<div data-dent="${dk}" onclick="usToggleDent(${dk})"
              style="width:44px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;
                     padding:4px 2px;background:${bg2};cursor:pointer;user-select:none;${sep}box-sizing:border-box;">
              <span style="font-weight:700;font-size:0.8rem;line-height:1.2;color:${col2};">${dk}</span>
              <span style="font-size:0.44rem;font-weight:700;color:${sub2};white-space:nowrap;">${ik.acte||' '}</span>
            </div>`;
          }
          h += '</div>';
          ci = j; continue;
        }
      }
      h += renderCell(d);
      ci++;
    }
    return h + '</div>';
  };

  let html = '<div style="overflow-x:auto;">';
  html += renderGridRow(COLS_H);
  html += '<div style="height:6px;border-bottom:2px dashed #c8dce8;margin:2px 0 5px;"></div>';
  html += renderGridRow(COLS_B);
  html += '</div>';


  // Rendu délégué à renderRow() via les deux rangées haut/bas ci-dessus
  zone.innerHTML = html;
  _usInitLasso();
}

function usRenderGroupes() {
  const zone = document.getElementById('us-groupes-zone');
  if (!zone || !window._solidGroups.length) { if(zone) zone.innerHTML=''; return; }

  const groupColors = ['#bfdbfe','#bbf7d0','#fde68a','#fecaca','#e9d5ff','#fed7aa'];
  let html = '<div style="font-size:0.7rem;font-weight:600;color:#555;margin-bottom:6px;">Groupes définis :</div>';
  window._solidGroups.forEach((g, idx) => {
    const isSolid = g.type === 'solid';
    const fullBg    = isSolid ? '#dcfce7' : '#dbeafe';
    const fullBdr   = isSolid ? '#16a34a' : '#1d4ed8';
    const fullColor = isSolid ? '#14532d' : '#1e3a8a';
    const typeLabel = isSolid ? '🔗 Solidaire' : '• Unitaire';
    html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:9px;
              background:${fullBg};border:2px solid ${fullBdr};margin-bottom:5px;">
      <span style="color:${fullColor};font-size:0.68rem;font-weight:700;">${typeLabel}</span>
      <span style="font-weight:700;font-size:0.82rem;flex:1;color:${fullColor};">${g.dents.join(' ')}</span>
      <button onclick="usSupprimerGroupe(${idx})" style="border:none;background:rgba(0,0,0,0.1);border-radius:5px;cursor:pointer;font-size:0.7rem;padding:2px 6px;color:#c62828;">✕</button>
    </div>`;
  });
  zone.innerHTML = html;
}

function usToggleDent(d) {
  if (window._usSelection.has(d)) window._usSelection.delete(d);
  else window._usSelection.add(d);
  usRenderDents();
}

function usValiderSelection(type) {
  if (!window._usSelection.size) {
    showToast('Sélectionne au moins une dent', true);
    return;
  }
  const dents = fdiSort([...window._usSelection]);

  // ── Validation solidaire : même mâchoire + dents consécutives ──
  if (type === 'solid' && dents.length >= 2) {
    // Règle 1 : toutes les dents doivent être sur la même mâchoire
    const HAUT = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
    const BAS  = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
    const toutesHaut = dents.every(d => HAUT.includes(d));
    const toutesBas  = dents.every(d => BAS.includes(d));
    if (!toutesHaut && !toutesBas) {
      showToast('Impossible de solidariser des dents du haut avec des dents du bas.', true);
      return;
    }
    // Règle 2 : les dents doivent être consécutives (pas de trou dans l'arc)
    const arcOrder = toutesHaut ? HAUT : BAS;
    const indices = dents.map(d => arcOrder.indexOf(d)).filter(i => i !== -1).sort((a,b) => a - b);
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] - indices[i-1] !== 1) {
        // Trouver les dents manquantes pour le message d'erreur
        const manquantes = [];
        for (let j = indices[i-1] + 1; j < indices[i]; j++) manquantes.push(arcOrder[j]);
        showToast('Dents non consécutives — il manque ' + manquantes.join(', ') + ' pour solidariser.', true);
        return;
      }
    }
  }

  // Retirer ces dents des groupes existants
  window._solidGroups = window._solidGroups.map(g => ({
    ...g, dents: g.dents.filter(d => !window._usSelection.has(d))
  })).filter(g => g.dents.length > 0);

  // Ajouter le nouveau groupe
  window._solidGroups.push({ type, dents });
  window._usSelection = new Set();
  usRenderDents();
  usRenderGroupes();
  usSyncBadges();
}

function usSupprimerGroupe(idx) {
  window._solidGroups.splice(idx, 1);
  usRenderDents();
  usRenderGroupes();
  usSyncBadges();
}

function usResetGroupes() {
  window._solidGroups = [];
  window._usSelection = new Set();
  usRenderDents();
  usRenderGroupes();
  usSyncBadges();
}

function usSyncBadges() {
  // Auto-cocher Unitaire/Solidaire selon les groupes
  // IMPORTANT : on coche si des groupes existent, mais on NE DÉCOCHE PAS si la case
  // a été cochée manuellement sans passer par la modal (ex: édition directe).
  const cbUnit = document.querySelector('input[name="conjointe"][value="Unitaire"]');
  const cbSolid = document.querySelector('input[name="conjointe"][value="Solidaire"]');
  const hasUnit = window._solidGroups.some(g => g.type === 'unit');
  const hasSolid = window._solidGroups.some(g => g.type === 'solid');
  // Cocher si groupes présents — ne jamais décocher automatiquement
  if (cbUnit && hasUnit) cbUnit.checked = true;
  if (cbSolid && hasSolid) cbSolid.checked = true;

  // Badge Unit sous Unitaire, Joined sous Solidaire
  ['unitaire','solidaire'].forEach(id => {
    let badge = document.getElementById('badge-' + id);
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'badge-' + id;
      badge.style.cssText = 'font-size:0.62rem;font-weight:600;margin-left:2px;margin-top:2px;cursor:pointer;display:block;';
      badge.onclick = () => ouvrirModalUnitSolid();
      const lbl = document.getElementById('lbl-' + id);
      if (lbl && lbl.parentNode) lbl.parentNode.insertBefore(badge, lbl.nextSibling);
    }
    const type = id === 'solidaire' ? 'solid' : 'unit';
    const groupes = window._solidGroups.filter(g => g.type === type);
    const label = type === 'solid' ? 'Joined' : 'Unit';
    const color = type === 'solid' ? '#166534' : '#1e40af';
    const bg = type === 'solid' ? '#dcfce7' : '#dbeafe';
    if (groupes.length) {
      badge.innerHTML = groupes.map(g =>
        `<span style="background:${bg};color:${color};padding:1px 7px;border-radius:8px;font-size:0.62rem;">${label} (${g.dents.join(' ')})</span>`
      ).join(' ');
    } else {
      badge.innerHTML = '';
    }
  });
}

function usFermerModal() {
  const p = document.getElementById('popup-unit-solid');
  if (p) p.remove();
}

function appliquerSolidGroups(solidGroups) {
  window._solidGroups = JSON.parse(JSON.stringify(solidGroups || []));
  usSyncBadges();
}



// ── Lasso sélection dents ──
var _lassoActive = false, _lassoX0 = 0, _lassoY0 = 0, _lassoMoved = false;
var _lassoEl = () => document.getElementById('us-lasso-rect');

function _usInitLasso() {
  const zone = document.getElementById('us-dents-zone');
  if (!zone || zone._lassoInit) return;
  zone._lassoInit = true;

  // Mousedown sur la zone (pas sur une chip) → démarrer lasso
  zone.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-dent]')) return;
    _lassoActive = true;
    _lassoMoved = false;
    _lassoX0 = e.clientX;
    _lassoY0 = e.clientY;
    const el = _lassoEl();
    if (el) {
      el.style.display = 'none'; // pas encore visible
      el.style.left = _lassoX0 + 'px'; el.style.top = _lassoY0 + 'px';
      el.style.width = '0'; el.style.height = '0';
    }
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!_lassoActive) return;
    const dx = Math.abs(e.clientX - _lassoX0), dy = Math.abs(e.clientY - _lassoY0);
    // Afficher le rectangle seulement après 6px de mouvement
    if (dx > 6 || dy > 6) _lassoMoved = true;
    if (!_lassoMoved) return;
    const el = _lassoEl(); if (!el) return;
    el.style.display = 'block';
    el.style.left   = Math.min(e.clientX, _lassoX0) + 'px';
    el.style.top    = Math.min(e.clientY, _lassoY0) + 'px';
    el.style.width  = dx + 'px';
    el.style.height = dy + 'px';
  });

  document.addEventListener('mouseup', (e) => {
    if (!_lassoActive) return;
    _lassoActive = false;
    const el = _lassoEl();
    if (!el) return;
    el.style.display = 'none';

    if (!_lassoMoved) {
      // Clic simple dans le vide → désélectionner tout
      window._usSelection.clear();
      usRenderDents();
      return;
    }

    // Sélectionner les chips dont le bbox intersecte le rectangle lasso
    const lx1 = parseInt(el.style.left),  ly1 = parseInt(el.style.top);
    const lx2 = lx1 + parseInt(el.style.width), ly2 = ly1 + parseInt(el.style.height);

    document.querySelectorAll('#us-dents-zone [data-dent]').forEach(chip => {
      const cr = chip.getBoundingClientRect();
      // Intersection (pas juste le centre) pour de meilleures hitboxes
      const intersects = cr.left < lx2 && cr.right > lx1 && cr.top < ly2 && cr.bottom > ly1;
      if (intersects) {
        const d = Number(chip.dataset.dent);
        window._usSelection.add(d);
      }
    });
    usRenderDents();
  });
}

// ═══════════════════════════════════════════════════════
// DÉTAIL ACTES — dent/mâchoire + quantité déduite
// p.dentsActes : { "CCM": "13 14", "Stellite": "haut", ... }
