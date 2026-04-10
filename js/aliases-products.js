// ═══════════════════════════════════════════════════════════════
// ALIAS PRODUITS — associe des termes/expressions aux produits
// ═══════════════════════════════════════════════════════════════

function getProductAliases() {
  try {
    var stored = localStorage.getItem('product_aliases');
    return stored ? JSON.parse(stored) : {};
  } catch(e) { return {}; }
}

// Sync aliases vers Firebase (debounce)
function _syncAliasesToFirebase(type) {
  var key = type === 'cabinet' ? 'cabinet_aliases' : 'product_aliases';
  var docName = type === 'cabinet' ? 'aliases_cabinet' : 'aliases_produit';
  clearTimeout(window['_aliasSync_' + type]);
  window['_aliasSync_' + type] = setTimeout(function() {
    var db = window._db;
    if (!db) return;
    try {
      var data = JSON.parse(localStorage.getItem(key) || '{}');
      db.collection('meta').doc(docName).set(data)
        .then(function() { console.log('☁️ Alias ' + type + ' synchronisés'); })
        .catch(function(e) { console.warn('Erreur sync alias ' + type + ':', e); });
    } catch(e) {}
  }, 500);
}

// Charger aliases depuis Firebase au démarrage
function _chargerAliasesFirebase() {
  var db = window._db;
  if (!db) return;
  // Alias cabinet
  db.collection('meta').doc('aliases_cabinet').get().then(function(doc) {
    if (doc.exists) {
      var data = doc.data();
      var local = JSON.parse(localStorage.getItem('cabinet_aliases') || '{}');
      var merged = Object.assign({}, data, local);
      localStorage.setItem('cabinet_aliases', JSON.stringify(merged));
      console.log('☁️ Alias cabinet chargés:', Object.keys(data).length);
    }
  }).catch(function() {});
  // Alias produit
  db.collection('meta').doc('aliases_produit').get().then(function(doc) {
    if (doc.exists) {
      var data = doc.data();
      var local = JSON.parse(localStorage.getItem('product_aliases') || '{}');
      // Merge : Firebase + local (local écrase Firebase si conflit)
      var merged = Object.assign({}, data, local);
      localStorage.setItem('product_aliases', JSON.stringify(merged));
      console.log('☁️ Alias produit chargés:', Object.keys(data).length);
    }
  }).catch(function() {});
  // Alias contacts (praticiens)
  db.collection('meta').doc('aliases_contact').get().then(function(doc) {
    if (doc.exists) {
      var data = doc.data();
      var local = JSON.parse(localStorage.getItem('contact_aliases') || '{}');
      var merged = Object.assign({}, data, local);
      localStorage.setItem('contact_aliases', JSON.stringify(merged));
      console.log('☁️ Alias contacts chargés:', Object.keys(data).length);
    }
  }).catch(function() {});
}

function getProductAliasesText() {
  var aliases = getProductAliases();
  var entries = Object.entries(aliases);
  if (!entries.length) return '(aucun alias produit défini)';
  return entries.map(function(e) {
    return '- "' + e[0] + '" → ' + e[1].join(' + ');
  }).join('\n');
}

