// ═══ AUTOCOMPLETE FILTRES LISTE ═══════════════════════

window._filterCabinet = '';
window._filterPraticien = '';

// Tri : 'recent' | 'ancien' | 'code_asc' | 'code_desc' | 'livraison_asc' | 'livraison_desc'
window._sortMode = 'creation_desc';
var _SORT_CYCLE = [
  { key: 'recent',        label: '🕐 Récent' },
  { key: 'ancien',        label: '🕐 Ancien' },
  { key: 'code_asc',      label: '🔢 Code ↑' },
  { key: 'code_desc',     label: '🔢 Code ↓' },
  { key: 'livraison_asc', label: '📅 Livraison ↑' },
  { key: 'livraison_desc',label: '📅 Livraison ↓' },
];
function changerTri(val) {
  window._sortMode = val;
  renderList();
}

// Garde toggleSort pour compatibilité éventuelle
function toggleSort() {}

// ── Helper partagé pour rendre une dropdown de suggestions ──
function _renderSuggestBox(box, items, onChoose) {
  if (!items.length) { box.style.display = 'none'; return; }
  box.innerHTML = items.map(item => {
    const safe = _enc(item);
    return `<div class="suggest-item" onmousedown="${onChoose}(decodeURIComponent('${safe}'))">${item}</div>`;
  }).join('');
  box.style.display = 'block';
}

function filterSuggestCabinet(val) {
  const box = document.getElementById('filter-cab-suggestions');
  if (!box) return;
  const q = (val || '').toLowerCase().trim();
  if (!q) { box.style.display = 'none'; return; }
  const fromContacts = Object.keys(CONTACTS || {}).filter(c => c.toLowerCase().includes(q));
  const fromFiches = [...new Set((window.prescriptions || []).map(p => p.cabinet).filter(Boolean))]
    .filter(c => c.toLowerCase().includes(q));
  const all = [...new Set([...fromContacts, ...fromFiches])].sort().slice(0, 10);
  _renderSuggestBox(box, all, 'filterChoisirCabinet');
}

function filterChoisirCabinet(val) {
  document.getElementById('filter-search-cabinet').value = val;
  document.getElementById('filter-cab-suggestions').style.display = 'none';
  window._filterCabinet = val;
  document.getElementById('filter-search-praticien').value = '';
  window._filterPraticien = '';
  renderList();
}

function filterClearCabinet() {
  document.getElementById('filter-search-cabinet').value = '';
  document.getElementById('filter-cab-suggestions').style.display = 'none';
  window._filterCabinet = '';
  window._filterPraticien = '';
  document.getElementById('filter-search-praticien').value = '';
  renderList();
}

function filterSuggestPraticien(val) {
  const box = document.getElementById('filter-prat-suggestions');
  if (!box) return;
  const q = (val || '').toLowerCase().trim();
  const cab = window._filterCabinet;
  let praticiens = [];
  if (cab) {
    const matchCab = Object.keys(CONTACTS || {}).find(c =>
      c.toLowerCase() === cab.toLowerCase() || c.toLowerCase().includes(cab.toLowerCase())
    );
    if (matchCab) praticiens = CONTACTS[matchCab] || [];
  }
  const fromFiches = [...new Set((window.prescriptions || [])
    .filter(p => !cab || (p.cabinet || '').toLowerCase().includes(cab.toLowerCase()))
    .map(p => p.praticien).filter(Boolean))];
  const all = [...new Set([...praticiens, ...fromFiches])].sort();
  const filtered = q ? all.filter(p => p.toLowerCase().includes(q)) : all;
  if (!filtered.length || (!q && !cab)) { box.style.display = 'none'; return; }
  _renderSuggestBox(box, filtered.slice(0, 10), 'filterChoisirPraticien');
}

function filterChoisirPraticien(val) {
  document.getElementById('filter-search-praticien').value = val;
  document.getElementById('filter-prat-suggestions').style.display = 'none';
  window._filterPraticien = val;
  renderList();
}

function filterClearPraticien() {
  document.getElementById('filter-search-praticien').value = '';
  document.getElementById('filter-prat-suggestions').style.display = 'none';
  window._filterPraticien = '';
  renderList();
}
