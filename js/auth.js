// ══════════════════════════════════════════
// AUTH — Firebase Authentication
// ══════════════════════════════════════════

(function() {
  // Attendre que Firebase soit charge
  function waitForFirebase(cb) {
    if (typeof firebase !== 'undefined' && firebase.auth) { cb(); return; }
    setTimeout(function() { waitForFirebase(cb); }, 100);
  }

  waitForFirebase(function() {
    // Config Firebase (meme que firebase-init.js)
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey: "AIzaSyCFEazX7KrxC4jfLCDuLiCT7ZJhcjDQpdM",
        authDomain: "ilovesmile-labo-fd511.firebaseapp.com",
        projectId: "ilovesmile-labo-fd511",
        storageBucket: "ilovesmile-labo-fd511.firebasestorage.app",
        messagingSenderId: "702662622870",
        appId: "1:702662622870:web:dc9a1fbed329c7942f4cb7"
      });
    }

    // Persistence locale — reste connecte meme apres fermeture du navigateur
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    // Detecter l'etat de connexion
    firebase.auth().onAuthStateChanged(function(user) {
      var loginScreen = document.getElementById('login-screen');
      var appContent = document.getElementById('app-content');

      if (user) {
        // Connecte → afficher l'app
        console.log('[AUTH] Connecte : ' + user.email);
        if (loginScreen) loginScreen.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
        // Lancer Firebase init (chargement donnees)
        if (typeof initFirebase === 'function' && !window._firebaseReady) {
          initFirebase();
        }
      } else {
        // Non connecte → afficher le login
        console.log('[AUTH] Non connecte');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appContent) appContent.style.display = 'none';
      }
    });
  });
})();

// Connexion email + mot de passe
function loginUser() {
  var email = (document.getElementById('login-email').value || '').trim();
  var password = document.getElementById('login-password').value || '';
  var errorDiv = document.getElementById('login-error');
  var btn = document.getElementById('login-btn');
  var loading = document.getElementById('login-loading');

  if (!email || !password) {
    errorDiv.textContent = 'Entrez votre email et mot de passe.';
    errorDiv.style.display = 'block';
    return;
  }

  errorDiv.style.display = 'none';
  btn.style.display = 'none';
  loading.style.display = 'block';

  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(function() {
      // Succes — onAuthStateChanged gere l'affichage
      loading.style.display = 'none';
      btn.style.display = 'block';
    })
    .catch(function(err) {
      loading.style.display = 'none';
      btn.style.display = 'block';
      var msg = 'Erreur de connexion.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Email ou mot de passe incorrect.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Trop de tentatives. Reessayez plus tard.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Email invalide.';
      }
      errorDiv.textContent = msg;
      errorDiv.style.display = 'block';
    });
}

// Deconnexion
function logoutUser() {
  if (!confirm('Se deconnecter ?')) return;
  firebase.auth().signOut();
}

// Permettre Entree pour valider le login
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    var focused = document.activeElement;
    if (focused && (focused.id === 'login-email' || focused.id === 'login-password')) {
      loginUser();
    }
  }
});
