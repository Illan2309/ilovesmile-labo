
// ════════════════════════════════════════════════════════════════
// PRODUITS ANNEXES — wax up, contre plaque, guide chirurgical, etc.
// ════════════════════════════════════════════════════════════════
//
// Produits qui n'ont pas de case dans le formulaire principal mais
// qui doivent apparaître dans l'export Cogilog. Gérés via une popup
// accessible depuis le bouton "📦 Annexes".
//
// Chaque produit peut avoir des dents/mâchoire associées, stockées
// dans window._produitsAnnexesDents (même pattern que dentsActesCourant).
//
// Facilement extensible : ajouter une entrée dans PRODUITS_ANNEXES.
// ════════════════════════════════════════════════════════════════

window._produitsAnnexes = [];
window._produitsAnnexesDents = {}; // { '6-WAXUP': '14 15', 'CP': 'haut+bas' }

var PRODUITS_ANNEXES = [
  { code: '6-WAXUP', label: 'Wax up',              keywords: ['wax up', 'waxup', 'wax-up'], type: 'dents' },
  { code: 'CP',      label: 'Contre plaque',        keywords: ['contre plaque', 'contreplaque', 'contre-plaque', 'contreplaqu'], type: 'machoire' },
  { code: 'GCH',     label: 'Guide chirurgical',    keywords: ['guide chirurgical', 'guide chir'], type: 'dents' },
  { code: 'FILC',    label: 'Fil de contention',    keywords: ['fil de contention', 'fil contention'], type: 'dents' },
  { code: 'CM',      label: "Mod\u00e8le d'\u00e9tude", keywords: ['mod\u00e8le d', 'modele d', 'mod\u00e8le de travail'], type: 'machoire' },
];

// ── Popup ──

function ouvrirPopupAnnexes(e) {
  e.preventDefault();
  e.stopPropagation();

  // Fermer popup existante
  var old = document.getElementById('annexes-popup');
  if (old) { old.remove(); return; }

  var popup = document.createElement('div');
  popup.id = 'annexes-popup';
  popup.style.cssText = 'position:fixed;z-index:2000;background:white;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,0.22);padding:14px 16px;width:280px;border:1px solid #f0c040;';
  popup.style.top = (e.clientY + 6) + 'px';
  popup.style.left = (e.clientX) + 'px';
  if (e.clientX + 290 > window.innerWidth) popup.style.left = (window.innerWidth - 290) + 'px';
  if (e.clientY + 350 > window.innerHeight) popup.style.top = (e.clientY - 350) + 'px';

  var html = '<div style="font-size:0.75rem;font-weight:700;color:#e65100;margin-bottom:10px;display:flex;justify-content:space-between;">'
    + '<span>\ud83d\udce6 Produits annexes</span>'
    + '<span style="color:#888;cursor:pointer;font-size:1rem;" onclick="document.getElementById(\'annexes-popup\')?.remove()">\u00d7</span>'
    + '</div>';

  PRODUITS_ANNEXES.forEach(function(p) {
    var checked = window._produitsAnnexes.indexOf(p.code) >= 0;
    var dentVal = window._produitsAnnexesDents[p.code] || '';
    var dentDisplay = dentVal ? ' \u2014 ' + dentVal : '';

    html += '<div style="margin-bottom:6px;padding:5px 6px;border-radius:8px;border:1px solid ' + (checked ? '#f0c040' : '#eee') + ';background:' + (checked ? '#fff8e1' : '#fafafa') + ';">'
      + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.73rem;">'
      + '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="toggleProduitAnnexe(\'' + p.code + '\')">'
      + '<span style="color:#333;font-weight:' + (checked ? '600' : '400') + ';">' + p.label + '</span>'
      + '<span style="color:#aaa;font-size:0.58rem;margin-left:auto;">' + p.code + '</span>'
      + '</label>';

    // Champ dents/mâchoire — visible seulement si coché
    if (checked) {
      if (p.type === 'machoire') {
        var curMach = dentVal;
        html += '<div style="display:flex;gap:4px;margin-top:5px;margin-left:24px;">'
          + '<button onclick="setAnnexeMachoire(\'' + p.code + '\',\'haut\')" style="flex:1;padding:3px;border:1px solid ' + (curMach === 'haut' ? '#e65100' : '#ccc') + ';background:' + (curMach === 'haut' ? '#fff3e0' : 'white') + ';border-radius:5px;font-size:0.65rem;cursor:pointer;color:#e65100;font-weight:600;">\u2b06 Haut</button>'
          + '<button onclick="setAnnexeMachoire(\'' + p.code + '\',\'bas\')" style="flex:1;padding:3px;border:1px solid ' + (curMach === 'bas' ? '#e65100' : '#ccc') + ';background:' + (curMach === 'bas' ? '#fff3e0' : 'white') + ';border-radius:5px;font-size:0.65rem;cursor:pointer;color:#e65100;font-weight:600;">\u2b07 Bas</button>'
          + '<button onclick="setAnnexeMachoire(\'' + p.code + '\',\'haut+bas\')" style="flex:1;padding:3px;border:1px solid ' + (curMach === 'haut+bas' ? '#e65100' : '#ccc') + ';background:' + (curMach === 'haut+bas' ? '#fff3e0' : 'white') + ';border-radius:5px;font-size:0.65rem;cursor:pointer;color:#e65100;font-weight:600;">\u2195 2</button>'
          + '</div>';
      } else {
        html += '<div style="margin-top:5px;margin-left:24px;">'
          + '<input type="text" placeholder="Dents (ex: 13 14)" value="' + dentVal + '" '
          + 'oninput="setAnnexeDents(\'' + p.code + '\',this.value)" '
          + 'style="width:calc(100% - 8px);padding:3px 6px;font-size:0.7rem;border:1px solid #ddd;border-radius:5px;font-family:inherit;">'
          + '</div>';
      }
    }

    html += '</div>';
  });

  popup.innerHTML = html;
  document.body.appendChild(popup);

  // Fermer au clic en dehors
  setTimeout(function() {
    var handler = function(ev) {
      if (!popup.contains(ev.target) && ev.target.id !== 'btn-annexes') {
        popup.remove();
        document.removeEventListener('mousedown', handler);
      }
    };
    document.addEventListener('mousedown', handler);
  }, 50);
}

// ── Toggle ──

function toggleProduitAnnexe(code) {
  var idx = window._produitsAnnexes.indexOf(code);
  if (idx >= 0) {
    window._produitsAnnexes.splice(idx, 1);
    delete window._produitsAnnexesDents[code];
  } else {
    window._produitsAnnexes.push(code);
  }
  highlightAnnexes();
  _reRenderPopupAnnexes();
}

// ── Dents / Mâchoire ──

function setAnnexeDents(code, val) {
  window._produitsAnnexesDents[code] = val.trim();
}

function setAnnexeMachoire(code, val) {
  var current = window._produitsAnnexesDents[code] || '';
  // Toggle : si déjà la même valeur, on efface
  window._produitsAnnexesDents[code] = (current === val) ? '' : val;
  _reRenderPopupAnnexes();
}

function _reRenderPopupAnnexes() {
  var popup = document.getElementById('annexes-popup');
  if (popup) {
    var rect = popup.getBoundingClientRect();
    popup.remove();
    ouvrirPopupAnnexes({ preventDefault: function(){}, stopPropagation: function(){}, clientX: rect.left, clientY: rect.top - 6 });
  }
}

// ── Highlight badge ──

function highlightAnnexes() {
  var btn = document.getElementById('btn-annexes');
  var badge = document.getElementById('annexes-badge');
  if (!btn) return;

  var n = (window._produitsAnnexes || []).length;
  if (n > 0) {
    btn.style.background = '#fff3e0';
    btn.style.border = '2px solid #e65100';
    btn.style.boxShadow = '0 0 8px rgba(230,81,0,0.25)';
    if (badge) {
      badge.textContent = n;
      badge.style.display = 'inline';
    }
  } else {
    btn.style.background = '#fff8e1';
    btn.style.border = '1px solid #f0c040';
    btn.style.boxShadow = '';
    if (badge) {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }
}

// ── Détection automatique depuis le commentaire du dentiste ──

function detecterAnnexesDepuisCommentaire(rawComm) {
  if (!rawComm) return;
  var comm = rawComm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  var detected = [];

  PRODUITS_ANNEXES.forEach(function(p) {
    var found = p.keywords.some(function(kw) {
      return comm.indexOf(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) >= 0;
    });
    if (found) detected.push(p.code);
  });

  if (detected.length > 0) {
    window._produitsAnnexes = detected;
    highlightAnnexes();
    console.log('[ANNEXES] Détectés depuis commentaire :', detected.join(', '));
  }
}
