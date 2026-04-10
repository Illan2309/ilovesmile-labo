// Système Undo
// ═══════════════════════════════════════════════════
window._undoStack = [];  // [{ label, snapshot: [{id, champs modifiés}] }]

function undoPush(label, prescriptionsAffectees, champsAModifier) {
  // Sauvegarder uniquement les champs qui vont changer, par ID
  const snapshot = prescriptionsAffectees.map(p => {
    const entry = { _id: p._id };
    champsAModifier.forEach(k => { entry[k] = p[k]; });
    return entry;
  });
  window._undoStack.push({ label, snapshot, champsAModifier });
  // Garder max 5 niveaux
  if (window._undoStack.length > 5) window._undoStack.shift();
  // Afficher le bouton undo
  const btn = document.getElementById('btn-undo');
  if (btn) { btn.style.display = ''; btn.textContent = '↩ Annuler : ' + label; }
}

async function undoDerniereAction() {
  if (!window._undoStack.length) { showToast('Rien à annuler', true); return; }
  const { label, snapshot, champsAModifier } = window._undoStack.pop();
  let count = 0;
  for (const entry of snapshot) {
    const p = prescriptions.find(x => x._id === entry._id);
    if (!p) continue;
    champsAModifier.forEach(k => { p[k] = entry[k] !== undefined ? entry[k] : null; });
    if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(p);
    count++;
  }
  renderList();
  showToast('↩ Annulé : ' + label + ' (' + count + ' bons restaurés)');
  // Mettre à jour le bouton
  const btn = document.getElementById('btn-undo');
  if (btn) {
    if (window._undoStack.length > 0) {
      const prev = window._undoStack[window._undoStack.length - 1];
      btn.textContent = '↩ Annuler : ' + prev.label;
    } else {
      btn.style.display = 'none';
    }
  }
}

