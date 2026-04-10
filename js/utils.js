// ══════════════════════════════════════════
// UTILS — fonctions utilitaires globales
// ══════════════════════════════════════════


// ── DB SINGLETON ─────────────────────────────────────────
// Un seul appel à firebase.firestore() partagé dans tout le fichier
function getDB() {
  if (!window._db && window.firebase && firebase.firestore) {
    window._db = firebase.firestore();
  }
  return window._db || null;
}

// ── DEBOUNCE ─────────────────────────────────────────────
function debounce(fn, delay = 180) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ---- API KEY (cachée côté serveur via Cloudflare Worker) ----
function saveApiKey() {}


// ---- COMPRESSION IMAGE ----
function compressImage(dataUrl, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed.split(',')[1]);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Toast notifications
// ---- TOAST ----
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = isError ? 'var(--danger)' : 'var(--success)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 5000);
}

// Helper d'encodage URL
function _enc(s) { return encodeURIComponent(String(s)).replace(/'/g, '%27'); }
