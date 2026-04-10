// ── Init UI au chargement ──
document.addEventListener('DOMContentLoaded', function() {
  // Init détail actes (bulle dent/mâchoire)
  initActeDetailListeners();
  initActeUncheckListeners();

  // ── Quantités sur les checkboxes conjointe/adjointe ──
  // Items qui ne sont PAS des produits (modifiers, parents sans code propre)
  const ITEMS_SANS_QTY = ['Unitaire','Solidaire','Armature','Richmond','Implant scellé','Implant transvisé',
    'Maquillage sillon oui','Maquillage sillon non','Embrasure fermée','Embrasure ouverte',
    'Point de contact fort','Point de contact léger','Occlusion sous occ','Occlusion légère','Occlusion forte',
    'Limite sous gingival','Inlay Onlay','Facette',
    'Stellite montage stellite','App résine montage','Complet montage','Valplast montage',
    'Stellite finition stellite','App résine finition','Complet finition','Valplast finition',
    'Gouttière','Gouttière souple','Gouttière dur résine','Gouttière souple intra dur extra',
    'Ackers stellite','Ackers résine','Ackers valplast','Dent à extraire'];

  // qty-input supprimé — quantité déduite des dents dans dentsActes

  // Nettoyer les photos base64 du localStorage (saturation → JSON.parse crash)
  try {
    var toClean = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && (k.startsWith('photo_') || k.startsWith('photo_id_'))) toClean.push(k);
    }
    if (toClean.length > 0) {
      toClean.forEach(k => localStorage.removeItem(k));
      console.log('🧹 ' + toClean.length + ' photos nettoyées du localStorage');
    }
  } catch(e) {}

  // Dents FDI
  buildDentsGrid();
  // Teintes
  buildTeintes();
  // Liste prescriptions (première fois avec données vides)
  renderList();
  // Sécurité : si Firebase a déjà chargé les données avant DOMContentLoaded, re-render
  setTimeout(() => {
    if (window.prescriptions && window.prescriptions.length > 0) renderList();
  }, 2000);
  // Autocomplete Cogilog
  const inp = document.getElementById('code-cogilog');
  if (inp) {
    inp.addEventListener('input', () => filtrerClientsCogilog(inp.value));
    inp.addEventListener('focus', () => filtrerClientsCogilog(inp.value));
    inp.addEventListener('blur', () => setTimeout(fermerSuggestionsCogilog, 200));
  }

  // ── Debounce sur les inputs de recherche (évite appels à chaque frappe) ──
  const _dSearch   = debounce(() => renderList(), 180);
  const _dFiltCab  = debounce((v) => filterSuggestCabinet(v), 150);
  const _dFiltPrat = debounce((v) => filterSuggestPraticien(v), 150);
  const _dGcSearch = debounce(() => filtrerCabinetsGC(), 150);
  const _dGrilles  = debounce(() => gcFiltrerGrilles(), 150);

  const elSearch = document.getElementById('search-input');
  if (elSearch) { elSearch.removeAttribute('oninput'); elSearch.addEventListener('input', _dSearch); }

  const elFCab = document.getElementById('filter-search-cabinet');
  if (elFCab) { elFCab.removeAttribute('oninput'); elFCab.addEventListener('input', e => _dFiltCab(e.target.value)); }

  const elFPrat = document.getElementById('filter-search-praticien');
  if (elFPrat) { elFPrat.removeAttribute('oninput'); elFPrat.addEventListener('input', e => _dFiltPrat(e.target.value)); }

  const elGcSearch = document.getElementById('gc-search');
  if (elGcSearch) { elGcSearch.removeAttribute('oninput'); elGcSearch.addEventListener('input', _dGcSearch); }

  const elGrillesSearch = document.getElementById('gc-grilles-search');
  if (elGrillesSearch) { elGrillesSearch.removeAttribute('oninput'); elGrillesSearch.addEventListener('input', _dGrilles); }
});
