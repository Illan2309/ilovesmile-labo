// ═══════════════════════════════════════════════════════
// UI HELPERS — Alias modals, corrections, date helpers, highlights, popups
// ═══════════════════════════════════════════════════════

// ── MODAL ALIAS CABINET + PRODUITS ──
function ouvrirModalAliases() {
  renderAliasList();
  const m = document.getElementById('modal-aliases-cabinet');
  if (m) { m.style.display = 'flex'; }
  const sg = document.getElementById('alias-cogilog-suggestions');
  if (sg) sg.innerHTML = '<p style="text-align:center;color:#aaa;font-size:0.78rem;padding:24px 12px;margin:0;">Commence à taper pour rechercher un cabinet...</p>';
  const toInp = document.getElementById('alias-to-input');
  if (toInp) toInp.value = '';
  const fromInp = document.getElementById('alias-from-input');
  if (fromInp) fromInp.value = '';
}

function fermerModalAliases() {
  const m = document.getElementById('modal-aliases-cabinet');
  if (m) m.style.display = 'none';
}

function renderAliasList(filter) {
  const container = document.getElementById('alias-list-items');
  if (!container) return;
  const stored  = JSON.parse(localStorage.getItem('cabinet_aliases') || '{}');
  const aliases = getAliases();
  const entries = Object.entries(aliases);
  if (!entries.length) {
    container.innerHTML = '<p style="font-size:0.75rem;color:#aaa;text-align:center;padding:8px 0;">Aucun alias défini.</p>';
    return;
  }
  // Normaliser le filtre
  const _q = (filter || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  // Grouper par code Cogilog
  var groups = {};
  entries.forEach(function([from, to]) {
    if (!groups[to]) groups[to] = [];
    groups[to].push(from);
  });
  var html = '';
  Object.entries(groups).sort(function(a, b) { return a[0].localeCompare(b[0]); }).forEach(function([code, froms]) {
    // Filtrer : chercher dans le code, le nom du cabinet et les alias
    if (_q) {
      var cabinetName = (COGILOG_CLIENTS[code] && COGILOG_CLIENTS[code][3]) ? COGILOG_CLIENTS[code][3] : '';
      var searchStr = (code + ' ' + cabinetName + ' ' + froms.join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (!searchStr.includes(_q)) return;
    }
    froms.sort();
    var cabinetName = (COGILOG_CLIENTS[code] && COGILOG_CLIENTS[code][3]) ? COGILOG_CLIENTS[code][3] : '';
    html += '<div style="background:#f6f8fc;border:1px solid #e0e4ed;border-radius:8px;padding:8px 10px;margin-bottom:8px;">';
    html += '<div style="font-size:0.78rem;font-weight:700;color:#1a5c8a;margin-bottom:4px;">'
      + code + (cabinetName ? ' <span style="font-weight:400;color:#666;">— ' + cabinetName + '</span>' : '')
      + '</div>';
    froms.forEach(function(from) {
      var esc = from.replace(/'/g, "\\'");
      var isDefault = DEFAULT_CABINET_ALIASES[from] !== undefined && !stored[from];
      html += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0 3px 12px;">'
        + '<span style="flex:1;font-size:0.74rem;color:#333;min-width:0;overflow:hidden;text-overflow:ellipsis;">'
        + '\u2192 <b>' + from + '</b>'
        + (isDefault ? ' <span style="color:#bbb;font-size:0.62rem;">(défaut)</span>' : '')
        + '</span>'
        + '<button type="button" onclick="editerAlias(\'' + esc + '\',\'' + code + '\')" '
        + 'style="flex-shrink:0;background:#e3f2fd;border:none;border-radius:5px;padding:2px 7px;font-size:0.66rem;color:#1565c0;cursor:pointer;">Modif.</button>'
        + '<button type="button" onclick="supprimerAlias(\'' + esc + '\')" '
        + 'style="flex-shrink:0;background:#fce4ec;border:none;border-radius:5px;padding:2px 7px;font-size:0.66rem;color:#c62828;cursor:pointer;">Suppr.</button>'
        + '</div>';
    });
    // Bouton ajouter un alias supplémentaire à ce cabinet
    html += '<div style="padding:3px 0 0 12px;">'
      + '<button type="button" onclick="ajouterAliasPourCabinet(\'' + code + '\')" '
      + 'style="background:none;border:none;color:#1a5c8a;font-size:0.68rem;cursor:pointer;padding:2px 0;text-decoration:underline;">+ Ajouter un alias</button>'
      + '</div>';
    html += '</div>';
  });
  container.innerHTML = html;
}

var _aliasEditingKey = null; // clé en cours d'édition (null = mode ajout)

function ajouterAlias() {
  const fromInp = document.getElementById('alias-from-input');
  const toInp   = document.getElementById('alias-to-input');
  const btn     = document.getElementById('alias-add-btn');
  if (!fromInp || !toInp) return;
  const from = fromInp.value.trim();
  const to   = toInp.value.trim().toUpperCase();
  if (!from || !to) { showToast('Remplis les deux champs', true); return; }
  if (!COGILOG_CLIENTS[to]) { showToast('Code Cogilog "' + to + '" introuvable dans la base', true); return; }
  // Si on éditait un alias, supprimer l'ancien d'abord
  if (_aliasEditingKey !== null) {
    deleteAlias(_aliasEditingKey);
    _aliasEditingKey = null;
  }
  saveAlias(from, to);
  fromInp.value = '';
  toInp.value   = '';
  if (btn) { btn.textContent = '+ Ajouter'; btn.style.background = '#3060b0'; }
  renderAliasList();
  // Reset la zone de recherche
  var sg = document.getElementById('alias-cogilog-suggestions');
  if (sg) sg.innerHTML = '<p style="text-align:center;color:#2e7d32;font-size:0.78rem;padding:16px 12px;margin:0;">✓ Alias sauvegardé</p>';
  showToast('✅ Alias sauvegardé : ' + _nAccAlias(from) + ' → ' + to);
}

function annulerEdition() {
  _aliasEditingKey = null;
  var fromInp = document.getElementById('alias-from-input');
  var toInp   = document.getElementById('alias-to-input');
  var btn     = document.getElementById('alias-add-btn');
  if (fromInp) fromInp.value = '';
  if (toInp) toInp.value = '';
  if (btn) { btn.textContent = '+ Ajouter'; btn.style.background = '#3060b0'; }
  var cancel = document.getElementById('alias-cancel-btn');
  if (cancel) cancel.style.display = 'none';
}

function editerAlias(fromKey, code) {
  _aliasEditingKey = fromKey;
  var fromInp = document.getElementById('alias-from-input');
  var toInp   = document.getElementById('alias-to-input');
  var btn     = document.getElementById('alias-add-btn');
  var cancel  = document.getElementById('alias-cancel-btn');
  if (fromInp) { fromInp.value = fromKey; fromInp.focus(); }
  if (toInp) toInp.value = code;
  if (btn) { btn.textContent = 'Modifier'; btn.style.background = '#e65100'; }
  if (cancel) cancel.style.display = 'inline-block';
  // Afficher le cabinet sélectionné dans la zone de recherche
  var sg = document.getElementById('alias-cogilog-suggestions');
  if (sg) sg.innerHTML = '<p style="text-align:center;color:#1565c0;font-size:0.78rem;padding:16px 12px;margin:0;">Edition : <b>' + fromKey + '</b> → <b>' + code + '</b> — modifie les champs puis clique "Modifier"</p>';
}

function ajouterAliasPourCabinet(code) {
  _aliasEditingKey = null;
  var fromInp = document.getElementById('alias-from-input');
  var toInp   = document.getElementById('alias-to-input');
  var btn     = document.getElementById('alias-add-btn');
  var cancel  = document.getElementById('alias-cancel-btn');
  if (toInp) toInp.value = code;
  if (fromInp) { fromInp.value = ''; fromInp.focus(); }
  if (btn) { btn.textContent = '+ Ajouter'; btn.style.background = '#3060b0'; }
  if (cancel) cancel.style.display = 'none';
  var sg = document.getElementById('alias-cogilog-suggestions');
  var cabinetName = (COGILOG_CLIENTS[code] && COGILOG_CLIENTS[code][3]) ? COGILOG_CLIENTS[code][3] : code;
  if (sg) sg.innerHTML = '<p style="text-align:center;color:#1a5c8a;font-size:0.78rem;padding:16px 12px;margin:0;">Ajoute un alias pour <b>' + code + '</b> (' + cabinetName + ') — tape le nom dans "Nom sur la fiche"</p>';
}

function supprimerAlias(fromKey) {
  deleteAlias(fromKey);
  renderAliasList();
  showToast('Alias supprimé');
}

function rechercheAliasCogilog(val) {
  const container = document.getElementById('alias-cogilog-suggestions');
  if (!container) return;
  const q = _nAccAlias(val);
  if (q.length < 1) {
    container.innerHTML = '<p style="text-align:center;color:#aaa;font-size:0.78rem;padding:24px 12px;margin:0;">Commence à taper pour rechercher un cabinet...</p>';
    return;
  }
  var results = [];
  var entries = Object.entries(COGILOG_CLIENTS);
  for (var i = 0; i < entries.length; i++) {
    var code = entries[i][0];
    var d = entries[i][1];
    var nom = d[3] || '';
    var ville = (d[8] || '') + ' ' + (d[9] || '');
    var contact = (d[13] && d[13] !== 'Dr ???') ? d[13] : '';
    var searchable = _nAccAlias(code + ' ' + nom + ' ' + ville + ' ' + contact);
    if (searchable.indexOf(q) !== -1) {
      results.push({ code: code, nom: nom, ville: (d[9] || ''), contact: contact });
    }
  }
  if (!results.length) {
    container.innerHTML = '<p style="text-align:center;color:#cc6600;font-size:0.78rem;padding:24px 12px;margin:0;">Aucun cabinet trouvé pour "<b>' + val + '</b>"</p>';
    return;
  }
  container.innerHTML = results.map(function(r) {
    return '<div onclick="choisirAliasCogilog(\'' + r.code + '\')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #eef0f3;font-size:0.78rem;transition:background 0.15s;background:white;" onmouseenter="this.style.background=\'#e8f0fe\'" onmouseleave="this.style.background=\'white\'">'
      + '<b style="color:#1a5c8a;font-size:0.82rem;">' + r.code + '</b>'
      + ' — <span style="color:#333;">' + r.nom + '</span>'
      + (r.ville ? ' <span style="color:#999;font-size:0.72rem;">(' + r.ville + ')</span>' : '')
      + (r.contact ? '<br><span style="color:#666;font-size:0.72rem;margin-left:4px;">Contact : ' + r.contact + '</span>' : '')
      + '</div>';
  }).join('');
}

function choisirAliasCogilog(code) {
  var inp = document.getElementById('alias-to-input');
  if (inp) inp.value = code;
  var container = document.getElementById('alias-cogilog-suggestions');
  if (container) container.innerHTML = '<p style="text-align:center;color:#2e7d32;font-size:0.78rem;padding:16px 12px;margin:0;">✓ <b>' + code + '</b> sélectionné</p>';
}

// ═══════════════════════════════════════════════════════════════════════
// MODAL ALIAS PRODUITS — UI de gestion (bulle par produit)
// ═══════════════════════════════════════════════════════════════════════
var _prodAliasBulleProduct = null; // produit actuellement ouvert dans la bulle

function ouvrirModalAliasProduits() {
  var modal = document.getElementById('modal-aliases-produits');
  if (!modal) return;
  modal.style.display = 'flex';
  fermerProdAliasBulle();
  buildProdAliasPrescription(); // génère le HTML depuis les vrais checkboxes
  refreshProdAliasCounters();
}

// Génère dynamiquement la reproduction de la prescription depuis les vrais checkboxes du formulaire
function buildProdAliasPrescription() {
  var zone = document.getElementById('prod-alias-prescription-zone');
  if (!zone) return;

  // Helper : crée un pa-item cliquable
  function I(product, label, sub, extraStyle) {
    var cls = 'pa-item' + (sub ? ' pa-sub' : '');
    var st = extraStyle ? ' style="' + extraStyle + '"' : '';
    return '<div class="' + cls + '"' + st + ' data-product="' + product.replace(/"/g, '&quot;') + '" onclick="toggleProdAliasBulle(this)">'
      + label + ' <span class="pa-count"></span></div>';
  }
  // Helper : titre de catégorie finition
  function T(text) {
    return '<div style="font-size:0.65rem;font-weight:700;color:#999;margin:4px 0 2px;">' + text + '</div>';
  }
  // Helper : séparateur
  var SEP = '<div style="border-top:1px solid #e0e0e0;margin:8px 0;"></div>';
  // Helper : titre de section
  function TITLE(t) {
    return '<div style="text-align:center;font-size:0.82rem;font-weight:700;letter-spacing:2px;color:#cc0000;margin-bottom:8px;border-bottom:2px solid #cc0000;padding-bottom:4px;">' + t + '</div>';
  }
  // Helper : row avec /
  function SLASH_ROW(items) {
    var parts = [];
    items.forEach(function(it, i) {
      if (i > 0) parts.push('<span style="color:#999;font-size:0.65rem;flex-shrink:0;">/</span>');
      parts.push('<div style="flex:1">' + it + '</div>');
    });
    return '<div style="display:flex;gap:4px;align-items:center;">' + parts.join('') + '</div>';
  }

  // ═══ CONJOINTE ═══
  var conj = TITLE('CONJOINTE');
  conj += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';

  // Colonne gauche conjointe
  conj += '<div>';
  conj += I('CCM', 'CCM');
  conj += '<div style="margin-left:12px;">' + I('Épaulement céram.', 'épaulement Céram', true) + '</div>';
  conj += I('Couronne coulée', 'Couronne métal coulée');
  conj += I('EMAX', 'EMAX');
  conj += I('Zirconium CCC', 'CCC (céramo céramique)');
  conj += I('Full zirconium', 'Full Zircone');
  conj += I('Dent provisoire', 'Dent provisoire');
  conj += SLASH_ROW([I('Implant CCM', 'Implant CCM'), I('Implant CCC', 'CCC')]);
  conj += '<div style="margin-left:12px;">';
  conj += I('Implant scellé', 'scellée', true);
  conj += I('Implant transvisé', 'transvisée', true);
  conj += '</div></div>';

  // Colonne droite conjointe
  conj += '<div>';
  conj += '<div style="font-size:0.72rem;font-weight:700;color:#333;margin-bottom:2px;">INLAY CORE</div>';
  conj += '<div style="margin-left:10px;">';
  conj += I('Inlay Core', 'métal', true);
  conj += I('Inlay Core céramisé', 'céramisé', true);
  conj += I('Inlay Core clavette', 'clavette', true);
  conj += I('Scan body', 'scan body', true);
  conj += '</div>';
  conj += I('Inlay Onlay', 'INLAY ONLAY', false, 'margin-top:6px');
  conj += I('Inlay Onlay composite', 'INLAY ONLAY composite', false, 'margin-left:10px');
  conj += I('Inlay Onlay céramique', 'INLAY ONLAY céramique', false, 'margin-left:10px');
  conj += I('Facette', 'FACETTE', false, 'margin-top:6px');
  conj += I('Facette composite', 'FACETTE composite', false, 'margin-left:10px');
  conj += I('Facette céramique', 'FACETTE céramique', false, 'margin-left:10px');
  conj += I('Ceramic Rose Collet', 'Céram. Rose Collet', false, 'margin-top:6px');
  conj += '</div></div>'; // fin grid + col droite

  conj += SEP;

  // Unitaire / Solidaire / Armature / Richmond
  conj += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">';
  conj += I('Unitaire', 'Unitaire');
  conj += I('Solidaire', 'Solidaire');
  conj += I('Armature', 'Armature');
  conj += I('Richmond', 'Richmond');
  conj += '</div>';

  conj += SEP;

  // ═══ FINITIONS — reproduites fidèlement ═══
  conj += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
  // Col gauche finitions
  conj += '<div>';
  conj += T('MAQUILLAGE SILLON');
  conj += I('Maquillage sillon oui', 'oui', true);
  conj += I('Maquillage sillon non', 'non', true);
  conj += T('EMBRASURE');
  conj += I('Embrasure fermée', 'fermée', true);
  conj += I('Embrasure ouverte', 'ouverte', true);
  conj += '</div>';
  // Col droite finitions
  conj += '<div>';
  conj += T('POINT DE CONTACT');
  conj += I('Point de contact fort', 'fort', true);
  conj += I('Point de contact léger', 'léger', true);
  conj += T('OCCLUSION');
  conj += I('Occlusion sous occ', 'sous occ', true);
  conj += I('Occlusion légère', 'légère', true);
  conj += I('Occlusion forte', 'forte', true);
  conj += T('LIMITE');
  conj += I('Limite sous gingival', 'sous gingival', true);
  conj += '</div></div>';

  // ═══ ADJOINTE ═══
  var adj = TITLE('ADJOINTE');
  adj += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';

  // Col gauche adjointe
  adj += '<div>';
  adj += I('PEI', 'PEI');
  adj += I("Cire d'occlusion", 'CIRE D\'OCCLUSION');
  adj += I('Réparation', 'RÉPARATION');
  adj += I('Rebasage', 'REBASAGE');
  adj += I('Adjonction', 'ADJONCTION', false, 'margin-top:4px');
  adj += '<div style="margin-left:12px;">';
  adj += I('Adjonction dent', 'dent', true);
  adj += I('Adjonction crochet', 'crochet', true);
  adj += '</div>';
  adj += I('Gouttière', 'GOUTTIÈRE', false, 'margin-top:4px');
  adj += '<div style="margin-left:12px;">';
  adj += I('Gouttière souple', 'souple / semi rigide', true);
  adj += I('Gouttière dur résine', 'dure résine', true);
  adj += I('Gouttière souple intra dur extra', 'souple intra – dur extra', true);
  adj += I('Blanchissement', 'blanchiment', true);
  adj += I('Contention', 'contention', true);
  adj += '</div>';
  adj += I('Dent à extraire', 'DENT À EXTRAIRE', false, 'margin-top:4px;color:#cc0000;font-weight:600');
  adj += '</div>';

  // Col droite adjointe
  adj += '<div>';
  adj += SLASH_ROW([I('Stellite', 'STELLITE'), I('Ackers stellite', 'ACKERS')]);
  adj += '<div style="margin-left:12px;">';
  adj += I('Stellite montage stellite', 'montage stellite', true);
  adj += I('Stellite finition stellite', 'finition stellite', true);
  adj += I('Stellite sup. valplast', 'finition valplast', true);
  adj += '</div>';

  adj += '<div style="margin-top:5px;">' + SLASH_ROW([I('App résine', 'APP. RÉSINE'), I('Ackers résine', 'ACKERS')]) + '</div>';
  adj += '<div style="margin-left:12px;">';
  adj += I('App résine montage', 'montage', true);
  adj += I('App résine finition', 'finition', true);
  adj += I('App résine grille de renfort', 'grille de renfort', true);
  adj += '</div>';

  adj += I('Complet', 'COMPLET', false, 'margin-top:5px');
  adj += '<div style="margin-left:12px;">';
  adj += I('Complet montage', 'montage', true);
  adj += I('Complet finition', 'finition', true);
  adj += I('Complet grille de renfort', 'grille de renfort', true);
  adj += '</div>';

  adj += '<div style="margin-top:5px;">' + SLASH_ROW([I('Valplast', 'VALPLAST'), I('Ackers valplast', 'ACKERS')]) + '</div>';
  adj += '<div style="margin-left:12px;">';
  adj += I('Valplast montage', 'montage', true);
  adj += I('Valplast finition', 'finition', true);
  adj += I('Valplast grille de renfort', 'grille de renfort', true);
  adj += '</div>';

  adj += '</div></div>'; // fin col droite + grid

  // ═══ CHAMPS SPÉCIAUX ═══
  var special = SEP;
  special += '<div style="text-align:center;font-size:0.78rem;font-weight:700;letter-spacing:1px;color:#b8860b;margin-bottom:6px;">CHAMPS SPÉCIAUX</div>';
  special += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
  special += I('a_refaire', 'À refaire', false, 'color:#cc0000;font-weight:600');
  special += I('cas_esthetique', 'Cas esthétique', false, 'color:#b8860b;font-weight:600');
  special += I('urgent', 'Urgent', false, 'color:#cc0000;font-weight:600');
  special += I('call_me', 'Call me', false, 'color:#cc0000;font-weight:600');
  special += '</div>';

  zone.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">'
    + '<div>' + conj + '</div>'
    + '<div>' + adj + special + '</div>'
    + '</div>';
}

function fermerModalAliasProduits() {
  var modal = document.getElementById('modal-aliases-produits');
  if (modal) modal.style.display = 'none';
  fermerProdAliasBulle();
}

// Compte les alias qui pointent vers chaque produit et met à jour les badges
function refreshProdAliasCounters() {
  var aliases = getProductAliases();
  // Construire un map produit → [expressions]
  var prodMap = {};
  Object.entries(aliases).forEach(function(e) {
    e[1].forEach(function(prod) {
      if (!prodMap[prod]) prodMap[prod] = [];
      prodMap[prod].push(e[0]);
    });
  });

  document.querySelectorAll('#modal-aliases-produits .pa-item').forEach(function(el) {
    var prod = el.getAttribute('data-product');
    var count = prodMap[prod] ? prodMap[prod].length : 0;
    var badge = el.querySelector('.pa-count');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline' : 'none';
    }
    if (count > 0) {
      el.classList.add('has-aliases');
    } else {
      el.classList.remove('has-aliases');
    }
  });
}

// Ouvrir/fermer la bulle d'un produit
function toggleProdAliasBulle(el) {
  var product = el.getAttribute('data-product');
  if (!product) return;

  // Si on reclique sur le même → fermer
  if (_prodAliasBulleProduct === product) {
    fermerProdAliasBulle();
    return;
  }

  // Retirer l'état actif des autres
  document.querySelectorAll('#modal-aliases-produits .pa-item.pa-active').forEach(function(e) { e.classList.remove('pa-active'); });
  el.classList.add('pa-active');

  _prodAliasBulleProduct = product;

  // Positionner la bulle
  var bulle = document.getElementById('prod-alias-bulle');
  if (!bulle) return;

  var rect = el.getBoundingClientRect();
  var bulleW = 320;
  var left = rect.right + 12;
  // Si dépasse à droite → mettre à gauche
  if (left + bulleW > window.innerWidth - 10) {
    left = rect.left - bulleW - 12;
  }
  // Si dépasse encore → centrer sous l'élément
  if (left < 10) {
    left = Math.max(10, rect.left);
  }
  var top = Math.min(rect.top, window.innerHeight - 300);
  if (top < 10) top = 10;

  bulle.style.left = left + 'px';
  bulle.style.top = top + 'px';
  bulle.style.display = 'block';

  // Remplir le titre
  document.getElementById('prod-alias-bulle-title').textContent = product;

  // Remplir la liste des alias existants
  renderBulleAliasList(product);

  // Focus sur l'input
  var inp = document.getElementById('prod-alias-bulle-input');
  if (inp) { inp.value = ''; inp.focus(); }
}

function fermerProdAliasBulle() {
  var bulle = document.getElementById('prod-alias-bulle');
  if (bulle) bulle.style.display = 'none';
  _prodAliasBulleProduct = null;
  document.querySelectorAll('#modal-aliases-produits .pa-item.pa-active').forEach(function(e) { e.classList.remove('pa-active'); });
}

// Afficher les alias existants qui incluent ce produit
function renderBulleAliasList(product) {
  var container = document.getElementById('prod-alias-bulle-list');
  if (!container) return;

  var aliases = getProductAliases();
  // Trouver toutes les expressions qui ciblent ce produit
  var matching = [];
  Object.entries(aliases).forEach(function(e) {
    if (e[1].indexOf(product) !== -1) {
      matching.push(e[0]);
    }
  });

  if (!matching.length) {
    container.innerHTML = '<p style="color:#aaa;font-size:0.75rem;text-align:center;margin:4px 0;">Aucun alias pour ce produit</p>';
    return;
  }

  matching.sort();
  var html = '';
  matching.forEach(function(expr) {
    var escapedExpr = expr.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 6px;background:#f5f0ff;border-radius:6px;margin:3px 0;">'
      + '<span style="font-size:0.78rem;color:#333;font-weight:500;">"' + expr + '"</span>'
      + '<button onclick="supprimerAliasDeBulle(\'' + escapedExpr + '\')" style="background:#ffebee;border:1px solid #ef9a9a;border-radius:4px;padding:1px 8px;font-size:0.65rem;cursor:pointer;color:#c62828;flex-shrink:0;">✕</button>'
      + '</div>';
  });
  container.innerHTML = html;
}

// Ajouter un alias depuis la bulle
function ajouterAliasBulle() {
  var inp = document.getElementById('prod-alias-bulle-input');
  var expression = (inp ? inp.value : '').trim().toLowerCase();
  if (!expression) { showToast('Entrez un terme ou expression'); return; }
  if (!_prodAliasBulleProduct) return;

  var aliases = getProductAliases();
  // Si l'expression existe déjà, ajouter le produit à la liste (multi-produit)
  if (aliases[expression]) {
    if (aliases[expression].indexOf(_prodAliasBulleProduct) === -1) {
      aliases[expression].push(_prodAliasBulleProduct);
    } else {
      showToast('Cet alias existe déjà pour ce produit');
      return;
    }
  } else {
    aliases[expression] = [_prodAliasBulleProduct];
  }

  localStorage.setItem('product_aliases', JSON.stringify(aliases));
  _syncAliasesToFirebase('product');
  renderBulleAliasList(_prodAliasBulleProduct);
  refreshProdAliasCounters();
  if (inp) { inp.value = ''; inp.focus(); }
  showToast('Alias "' + expression + '" ajouté !');
}

// Supprimer un alias spécifique de la bulle (retire ce produit de l'alias)
function supprimerAliasDeBulle(expression) {
  if (!_prodAliasBulleProduct) return;
  var aliases = getProductAliases();
  if (!aliases[expression]) return;

  // Retirer ce produit de l'alias
  aliases[expression] = aliases[expression].filter(function(p) { return p !== _prodAliasBulleProduct; });

  // Si l'alias n'a plus de produits, le supprimer entièrement
  if (!aliases[expression].length) {
    delete aliases[expression];
  }

  localStorage.setItem('product_aliases', JSON.stringify(aliases));
  _syncAliasesToFirebase('product');
  renderBulleAliasList(_prodAliasBulleProduct);
  refreshProdAliasCounters();
  showToast('Alias supprimé');
}




// ── CORRECTIONS ──
// ---- CORRECTIONS ----
var lastScanIA = null;
var lastScanPhoto = null;

function getCurrentFormData() {
  return {
    praticien: document.getElementById('praticien').value,
    patient_nom: document.getElementById('patient-nom').value,
    patient_age: document.getElementById('patient-age').value,
    patient_sexe: document.querySelector('input[name="sexe"]:checked')?.value || '',
    date_empreinte: document.getElementById('date-empreinte').value,
    date_livraison: document.getElementById('date-livraison').value,
    a_refaire: document.getElementById('a-refaire').checked,
    dents: [...selectedDents].sort((a,b) => a-b),
    conjointe: [...document.querySelectorAll('input[name="conjointe"]:checked')].map(e => e.value),
    adjointe: [...document.querySelectorAll('input[name="adjointe"]:checked')].map(e => e.value),
    dentsActes: Object.assign({}, window._dentsActesCourant),
    solidGroups: JSON.parse(JSON.stringify(window._solidGroups || [])),
    machoire: [...document.querySelectorAll('input[name="mach"]:checked')].map(e => e.value),
    fraisage: (window._dentsActesCourant && window._dentsActesCourant['Fraisage']) || document.getElementById('fraisage').value || '',
    teinte: document.getElementById('teinte-custom').value,
    commentaires: document.getElementById('commentaires').value,
  };
}

function envoyerCorrection() {
  if (!lastScanIA) {
    showToast('Aucun scan IA en cours à corriger', true);
    return;
  }
  const corrected = getCurrentFormData();
  const explication = (document.getElementById('correction-explication')?.value || '').trim();
  const diffs = extraireDiffs(lastScanIA, corrected);

  // Sauvegarder la correction brute (historique)
  const corrections = JSON.parse(localStorage.getItem('corrections') || '[]');
  corrections.push({
    date: new Date().toLocaleDateString('fr-FR'),
    ia: lastScanIA,
    correction: corrected,
    explication: explication || null,
  });
  if (corrections.length > 100) corrections.shift();
  localStorage.setItem('corrections', JSON.stringify(corrections));

  // Apprentissage avec l'explication
  const stats = sauvegarderApprentissage(diffs, explication);

  // Vider le champ pour la prochaine fois
  const expEl = document.getElementById('correction-explication');
  if (expEl) expEl.value = '';

  const msg = diffs.length === 0
    ? '✅ Aucune différence — l\'IA avait tout bon !'
    : stats
      ? `🧠 ${stats.nouvelles} nouveau(x) cas appris, ${stats.renforcees} renforcé(s) (${stats.total} en mémoire)`
      : `🧠 ${diffs.length} correction(s) enregistrée(s)`;

  document.getElementById('correction-status').textContent = msg;
  document.getElementById('correction-zone').style.display = 'none';
  showToast(msg);
}

function exportCorrections() {
  const corrections = JSON.parse(localStorage.getItem('corrections') || '[]') || [];
  if (corrections.length === 0) {
    showToast('Aucune correction à exporter', true);
    return;
  }

  let txt = '=== CORRECTIONS IA – LABO I LOVE SMILE ===\n';
  txt += 'Exporté le ' + new Date().toLocaleDateString('fr-FR') + '\n';
  txt += corrections.length + ' correction(s)\n\n';

  corrections.forEach((c, i) => {
    txt += '--- Correction #' + (i+1) + ' (' + c.date + ') ---\n';
    txt += 'CE QUE L\'IA A RECONNU :\n';
    txt += JSON.stringify(c.ia, null, 2) + '\n\n';
    txt += 'CE QUE TU AS CORRIGÉ :\n';
    txt += JSON.stringify(c.correction, null, 2) + '\n\n';

    // Diff simplifié
    txt += 'DIFFÉRENCES :\n';
    if (c.ia && c.correction) {
      Object.keys(c.correction).forEach(k => {
        const avant = JSON.stringify(c.ia?.[k] || '');
        const apres = JSON.stringify(c.correction[k] || '');
        if (avant !== apres) {
          txt += '  • ' + k + ' : "' + (c.ia?.[k] || '') + '" → "' + c.correction[k] + '"\n';
        }
      });
    }
    txt += '\n';
  });

  const blob = new Blob([txt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'corrections_labo_' + new Date().toLocaleDateString('fr-FR').replace(/\//g,'-') + '.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Corrections exportées !');
}

function ignorerCorrection() {
  document.getElementById('correction-zone').style.display = 'none';
  const expEl = document.getElementById('correction-explication');
  if (expEl) expEl.value = '';
}

// ---- DENTS ----

// ── DATE HELPERS ──
function autoFormatDate(input) {
  let v = input.value.replace(/[^0-9]/g, '');
  if (v.length >= 3 && v.length <= 4) v = v.slice(0,2) + '/' + v.slice(2);
  else if (v.length >= 5) v = v.slice(0,2) + '/' + v.slice(2,4) + '/' + v.slice(4,8);
  input.value = v;
}

// Convertit JJ/MM/AA → YYYY-MM-DD pour la sauvegarde
function dateToISO(str) {
  if (!str || str.length < 6) return '';
  // Si déjà au format ISO (YYYY-MM-DD), retourner tel quel
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split('/');
  if (parts.length !== 3) return '';
  const [dd, mm, yy] = parts;
  const yyyy = yy.length === 4 ? yy : '20' + yy;
  return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
}

// Convertit YYYY-MM-DD → JJ/MM/AA pour l'affichage
function dateFromISO(iso) {
  if (!iso || !iso.includes('-')) return iso || '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy.slice(2)}`;
}

function toggleSansDate(cb) {
  const input = document.getElementById('date-livraison');
  if (cb.checked) {
    input.value = '';
    input.disabled = true;
    input.style.opacity = '0.4';
  } else {
    input.disabled = false;
    input.style.opacity = '1';
  }
}

// ── FILTRES, HIGHLIGHTS, POPUPS ──
// Auto-sélection fournisseur selon code labo
// Lettre + numéro : 0-99 → MERDENTAL, 100-200 → HUILE
function sauverFiltrePeriode() {
  var from = (document.getElementById('filter-date-from')?.value || '').trim();
  var to = (document.getElementById('filter-date-to')?.value || '').trim();
  if (window._db) {
    window._db.collection('meta').doc('ui_prefs').set({ filtre_date_from: from, filtre_date_to: to }, { merge: true })
      .catch(function(e) { console.warn('Erreur sauvegarde filtre période:', e); });
  }
}
function clearFiltrePeriode() {
  var f = document.getElementById('filter-date-from');
  var t = document.getElementById('filter-date-to');
  if (f) f.value = '';
  if (t) t.value = '';
  sauverFiltrePeriode();
  renderList();
}
function chargerFiltrePeriode() {
  if (!window._db) return;
  window._db.collection('meta').doc('ui_prefs').get().then(function(doc) {
    if (doc.exists) {
      var data = doc.data();
      var f = document.getElementById('filter-date-from');
      var t = document.getElementById('filter-date-to');
      if (f && data.filtre_date_from) f.value = data.filtre_date_from;
      if (t && data.filtre_date_to) t.value = data.filtre_date_to;
      if (data.filtre_date_from || data.filtre_date_to) renderList();
    }
  }).catch(function() {});
}

function colorerFiltreStatut() {
  var sel = document.getElementById('filter-statut');
  if (!sel) return;
  var colors = {tous:'#e8e8e8;color:#555',attente:'#fff3cd;color:#856404',verifie:'#d4edda;color:#155724',importe:'#cce5ff;color:#004085',cogilog:'#f3e8ff;color:#6b21a8'};
  var c = colors[sel.value] || '#fff;color:#333';
  sel.style.background = c.split(';')[0];
  sel.style.color = c.split('color:')[1];
}

function highlightUrgentCallme() {
  ['urgent','call-me'].forEach(function(id) {
    var cb = document.getElementById(id);
    var container = document.getElementById(id === 'call-me' ? 'callme-container' : 'urgent-container');
    if (!cb || !container) return;
    if (cb.checked) {
      container.style.background = '#fde8e8';
      container.style.border = '2px solid #c0392b';
      container.style.boxShadow = '0 0 8px rgba(192,57,43,0.3)';
    } else {
      container.style.background = '';
      container.style.border = '';
      container.style.boxShadow = '';
    }
  });
}

function highlightARefaire() {
  const cb = document.getElementById('a-refaire');
  const container = document.getElementById('a-refaire-container');
  if (!cb || !container) return;
  if (cb.checked) {
    container.style.background = '#fde8e8';
    container.style.border = '2px solid #c0392b';
    container.style.boxShadow = '0 0 8px rgba(192,57,43,0.3)';
  } else {
    container.style.background = '';
    container.style.border = '';
    container.style.boxShadow = '';
  }
}

function highlightCasEsthetique() {
  const cb = document.getElementById('cas-esthetique');
  const container = document.getElementById('cas-esthetique-container');
  if (!cb || !container) return;
  if (cb.checked) {
    container.style.background = '#fff8e1';
    container.style.border = '2px solid #f9a825';
    container.style.boxShadow = '0 0 8px rgba(249,168,37,0.3)';
  } else {
    container.style.background = '';
    container.style.border = '';
    container.style.boxShadow = '';
  }
}

function highlightScan() {
  const cb = document.getElementById('scan-check');
  const container = document.getElementById('scan-container');
  if (!cb || !container) return;
  if (cb.checked) {
    container.style.background = '#f3e5f5';
    container.style.border = '2px solid #7b2d8e';
    container.style.boxShadow = '0 0 8px rgba(123,45,142,0.3)';
  } else {
    container.style.background = '';
    container.style.border = '';
    container.style.boxShadow = '';
    // Reset scan position
    window._scanPosition = '';
    const badge = document.getElementById('scan-badge');
    if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
  }
}

// Popup clic droit Scan → haut / bas / les 2
function ouvrirPopupScan(e) {
  // Auto-cocher si pas coché
  const cb = document.getElementById('scan-check');
  if (cb && !cb.checked) { cb.checked = true; highlightScan(); }

  // Fermer popup existante
  const old = document.getElementById('scan-popup');
  if (old) old.remove();

  const current = window._scanPosition || '';
  const popup = document.createElement('div');
  popup.id = 'scan-popup';
  popup.style.cssText = 'position:fixed;z-index:2000;background:white;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,0.22);padding:12px 14px;width:180px;border:1px solid #d0e0ea;';
  popup.style.top = (e.clientY + 6) + 'px';
  popup.style.left = (e.clientX) + 'px';
  if (e.clientX + 190 > window.innerWidth) popup.style.left = (window.innerWidth - 190) + 'px';

  popup.innerHTML = `
    <div style="font-size:0.72rem;font-weight:700;color:#7b2d8e;margin-bottom:8px;display:flex;justify-content:space-between;">
      <span>📡 Scan</span>
      <span style="color:#888;cursor:pointer;font-size:1rem;" onclick="document.getElementById('scan-popup')?.remove()">×</span>
    </div>
    <div style="font-size:0.68rem;color:#888;margin-bottom:5px;">Position :</div>
    <div style="display:flex;gap:4px;margin-bottom:10px;">
      <button onclick="setScanPosition('haut')" style="flex:1;padding:6px;border:1px solid ${current==='haut'?'#7b2d8e':'#ccc'};background:${current==='haut'?'#f3e5f5':'white'};border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;color:#7b2d8e;">⬆ Haut</button>
      <button onclick="setScanPosition('bas')" style="flex:1;padding:6px;border:1px solid ${current==='bas'?'#7b2d8e':'#ccc'};background:${current==='bas'?'#f3e5f5':'white'};border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;color:#7b2d8e;">⬇ Bas</button>
      <button onclick="setScanPosition('haut+bas')" style="flex:1;padding:6px;border:1px solid ${current==='haut+bas'?'#7b2d8e':'#ccc'};background:${current==='haut+bas'?'#f3e5f5':'white'};border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;color:#7b2d8e;">↕ 2</button>
    </div>
    <div style="display:flex;gap:4px;">
      <button onclick="setScanPosition('');document.getElementById('scan-popup')?.remove();" style="flex:1;padding:4px;border:1px solid #ccc;background:white;border-radius:6px;font-size:0.68rem;cursor:pointer;color:#888;">✕ Effacer</button>
    </div>`;
  document.body.appendChild(popup);
  setTimeout(() => {
    const handler = (ev) => { if (!popup.contains(ev.target)) { popup.remove(); document.removeEventListener('mousedown', handler); } };
    document.addEventListener('mousedown', handler);
  }, 50);
}

function setScanPosition(pos) {
  window._scanPosition = pos;
  const badge = document.getElementById('scan-badge');
  if (badge) {
    if (pos) {
      const labels = { 'haut': '⬆ Haut', 'bas': '⬇ Bas', 'haut+bas': '↕ H+B' };
      badge.textContent = labels[pos] || pos;
      badge.style.display = 'inline';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }
  document.getElementById('scan-popup')?.remove();
}

// Regroupe les entrées PIV : dents avec la même référence sont fusionnées
function regroupPiv(raw) {
  if (!raw || !raw.trim()) return '';
  var entries = raw.split(/\s*\/\s*/);
  // Parser chaque entrée en {dents: [...], ref: "..."}
  // Gère les formats : "34 (PN3-xxx)", "34 - pn3-xxx", "34-35 (PIV 1,2 LONG)"
  var parsed = entries.map(function(e) {
    var s = e.trim();
    // Format "DENTS (REF)"
    var m = s.match(/^([\d\s,\-]+)\s*\((.+)\)\s*$/);
    if (m) return { dents: parsePivDents(m[1]), ref: m[2].trim() };
    // Format "DENT - REF" (tiret séparateur entre dent et ref)
    var m2 = s.match(/^(\d{2})\s*[\-–]\s*([a-zA-Z].+)$/);
    if (m2) return { dents: [m2[1]], ref: m2[2].trim() };
    // Format "DENTS : REF"
    var m3 = s.match(/^([\d\s,]+)\s*:\s*(.+)$/);
    if (m3) return { dents: parsePivDents(m3[1]), ref: m3[2].trim() };
    // Pas de dents, juste une ref
    return { dents: [], ref: s };
  });
  function parsePivDents(str) {
    // "34 35" → ["34","35"], "34-35" → ["34","35"], "34,35" → ["34","35"]
    return str.replace(/-/g, ' ').split(/[\s,]+/).filter(function(d) { return /^\d{2}$/.test(d); });
  }
  // Normaliser les refs pour comparaison fuzzy
  // Gère : O→0, supprime tirets/espaces/points, ignore "d" optionnel devant chiffres
  function normRef(r) {
    return r.toLowerCase()
      .replace(/[\s\-_\.]+/g, '')
      .replace(/o/g, '0')
      .replace(/d(\d)/g, '$1');
  }
  // Grouper par référence normalisée
  var groups = {};
  var order = [];
  parsed.forEach(function(p) {
    var key = normRef(p.ref);
    if (!groups[key]) { groups[key] = { dents: [], ref: p.ref }; order.push(key); }
    p.dents.forEach(function(d) { if (groups[key].dents.indexOf(d) === -1) groups[key].dents.push(d); });
  });
  // Reconstruire le string
  return order.map(function(key) {
    var g = groups[key];
    if (g.dents.length === 0) return g.ref;
    return g.dents.join(' ') + ' (' + g.ref + ')';
  }).join(' / ');
}

function highlightPivField() {
  const inp = document.getElementById('piv');
  const container = document.getElementById('piv-container');
  if (!inp || !container) return;
  if (inp.value.trim()) {
    container.style.background = '#fff3e0';
    container.style.border = '2px solid #f57c00';
    container.style.boxShadow = '0 0 8px rgba(245,124,0,0.3)';
    inp.style.fontWeight = '700';
    inp.style.color = '#e65100';
  } else {
    container.style.background = '';
    container.style.border = '';
    container.style.boxShadow = '';
    inp.style.fontWeight = '';
    inp.style.color = '';
  }
}

function togglePivPopup() {
  const popup = document.getElementById('piv-popup');
  const inp = document.getElementById('piv');
  const content = document.getElementById('piv-popup-content');
  if (!popup || !inp || !content) return;
  if (popup.style.display === 'none') {
    const val = inp.value.trim();
    if (!val) { content.textContent = '(vide)'; }
    else {
      // Séparer les entrées par " / " et les afficher sur des lignes distinctes
      content.innerHTML = val.split(/\s*\/\s*/).map(function(e) {
        return '<div style="padding:3px 0;border-bottom:1px solid #fee0b0;">' + e.replace(/</g,'&lt;') + '</div>';
      }).join('');
    }
    popup.style.display = 'block';
  } else {
    popup.style.display = 'none';
  }
}

function highlightDentExtraire() {
  const cb = document.querySelector('input[name="adjointe"][value="Dent à extraire"]');
  const container = document.getElementById('dent-extraire-container');
  const inp = document.getElementById('dent-extraire');
  if (!container) return;
  if (cb && cb.checked) {
    container.style.background = '#fde8e8';
    container.style.border = '2px solid #c0392b';
    container.style.boxShadow = '0 0 8px rgba(192,57,43,0.3)';
    if (inp) {
      inp.style.fontWeight = '700';
      inp.style.color = '#c0392b';
    }
  } else {
    container.style.background = '';
    container.style.border = '';
    container.style.boxShadow = '';
    if (inp) {
      inp.style.fontWeight = '';
      inp.style.color = '';
    }
  }
  // Afficher le texte en dessous si trop long
  var expand = document.getElementById('dent-extraire-expand');
  if (inp && expand) {
    var val = inp.value.trim();
    if (val.length > 6) {
      expand.textContent = val;
      expand.style.display = 'block';
    } else {
      expand.style.display = 'none';
    }
  }
}

function autoSelectFournisseur(codeLabo) {
  if (!codeLabo) return;
  const match = codeLabo.match(/[A-Za-z]+(\d+)/);
  if (!match) return;
  const num = parseInt(match[1]);
  const select = document.getElementById('fournisseur');
  if (!select) return;
  if (num >= 0 && num <= 99) {
    select.value = 'MERDENTAL';
  } else if (num >= 100 && num <= 200) {
    select.value = 'HUILE';
  }
}

// Quand l'utilisateur change le fournisseur → auto-remplir le code labo
function onFournisseurChange(fournisseur) {
  if (!fournisseur) return;
  var codeLaboInput = document.getElementById('code-labo-display');
  if (!codeLaboInput) return;
  var currentCode = codeLaboInput.value.trim();
  // Ne pas écraser un code déjà complet (lettre + numéro) sauf si c'est juste une lettre seule
  var isLetterOnly = /^X?[A-Z]{1,2}$/i.test(currentCode);
  var isEmpty = !currentCode;
  if (isEmpty || isLetterOnly) {
    // Détecter si c'est un scan (checkbox Scan cochée)
    var isScan = document.getElementById('scan-check')?.checked || false;
    codeLaboInput.value = getNextCodeLabo(fournisseur, isScan);
  }
}

// ═══ POPUP À REFAIRE ═══════════════════════════════════
window.aRefaireActes = null; // null = jamais configuré (tout par défaut), [] = configuré mais vide

window.onARefaireChange = function(cb) {
  const btn = document.getElementById('btn-refaire-detail');
  if (cb.checked) {
    btn.style.display = 'inline-block';
    // Plus d'ouverture automatique — l'utilisateur ouvre manuellement si besoin
  } else {
    btn.style.display = 'none';
    aRefaireActes = null; // reset pour prochaine utilisation
  }
}

window.ouvrirPopupRefaire = function() {
  // Récupérer tous les articles cochés dans la fiche
  const conjointe = [...document.querySelectorAll('input[name="conjointe"]:checked')].map(i => i.value);
  const adjointe  = [...document.querySelectorAll('input[name="adjointe"]:checked')].map(i => i.value);
  const tousActes = [...conjointe, ...adjointe].filter(a => {
    // Exclure les articles sans code Cogilog
    const sans = ['Unitaire','Solidaire','Armature','Maquillage sillon oui','Maquillage sillon non',
      'Point de contact fort','Point de contact léger','Occlusion sous occ','Occlusion légère',
      'Occlusion forte','Embrasure fermée','Embrasure ouverte','Limite sous gingival',
      'Implant scellé','Implant transvisé'];
    return !sans.includes(a);
  });

  const liste = document.getElementById('popup-refaire-liste');
  if (!tousActes.length) {
    liste.innerHTML = '<p style="color:#888;font-size:0.78rem;">Aucun article coché dans la fiche.<\/p>';
  } else {
    liste.innerHTML = tousActes.map(acte => {
      const isSelected = aRefaireActes === null || aRefaireActes.includes(acte);
      return `<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:#fafafa;border-radius:6px;cursor:pointer;font-size:0.78rem;">
        <input type="checkbox" data-acte="${acte.replace(/"/g,'&quot;')}" ${isSelected ? 'checked' : ''} style="accent-color:#cc0000;">
        <span>${acte}<\/span>
      <\/label>`;
    }).join('');
    // Si première ouverture → tout sélectionner
    if (aRefaireActes === null) aRefaireActes = [...tousActes];
  }
  document.getElementById('popup-refaire').style.display = 'flex';
}

window.fermerPopupRefaire = function() {
  document.getElementById('popup-refaire').style.display = 'none';
}

window.toutSelectionnerRefaire = function(val) {
  document.querySelectorAll('#popup-refaire-liste input[type="checkbox"]')
    .forEach(cb => cb.checked = val);
}

window.validerPopupRefaire = function() {
  aRefaireActes = [...document.querySelectorAll('#popup-refaire-liste input[type="checkbox"]:checked')]
    .map(cb => cb.dataset.acte);
  fermerPopupRefaire();
  // Mettre à jour le label du bouton
  const btn = document.getElementById('btn-refaire-detail');
  if (btn) btn.textContent = `Configurer ✏️ (${aRefaireActes.length})`;
  // Si on est en mode édition d'un bon existant → sauvegarder immédiatement
  if (editingIndex >= 0 && prescriptions[editingIndex]) {
    prescriptions[editingIndex].aRefaireActes = aRefaireActes;
    if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(prescriptions[editingIndex]);
    showToast('✅ Sélection à refaire sauvegardée');
  }
}



// ═══════════════════════════════════════════════════════
// UNITAIRE / SOLIDAIRE — groupes visuels de dents
// p.solidGroups : [ { type:'solid'|'unit', dents:[33,34] } ]
// ═══════════════════════════════════════════════════════
