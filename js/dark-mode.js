/* ── Dark Mode Toggle ─────────────────────────────────────────────
   Bascule entre thème clair et sombre via data-theme sur <html>.
   Persistance : localStorage (instantané) + window._appPrefs.
───────────────────────────────────────────────────────────────── */

(function () {
  // Appliquer immédiatement pour éviter le flash blanc
  const saved = localStorage.getItem('dark_mode');
  if (saved === 'true') document.documentElement.setAttribute('data-theme', 'dark');
})();

function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const newMode = !isDark;

  if (newMode) {
    html.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme');
  }

  localStorage.setItem('dark_mode', String(newMode));

  // Sync avec le système de prefs existant
  if (window._appPrefs) window._appPrefs.dark_mode = newMode;

  // Mettre à jour l'icône du bouton
  const btn = document.getElementById('btn-dark-mode');
  if (btn) btn.textContent = newMode ? '☀️' : '🌙';
}

// Helpers pour les couleurs dark-aware (utilisés par les switchTab JS)
function isDarkMode() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
function dmTabActive() { return isDarkMode() ? '#2a3040' : 'white'; }
function dmTabInactive() { return 'transparent'; }
function dmTabTextInactive() { return isDarkMode() ? '#8899aa' : '#666'; }

// Au chargement du DOM, mettre à jour l'icône selon l'état initial
document.addEventListener('DOMContentLoaded', function () {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const btn = document.getElementById('btn-dark-mode');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
});
