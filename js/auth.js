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

    // Expose l'etat courant pour le reste de l'app
    window._currentUser = null;
    window._currentUserProfile = null;

    // Detecter l'etat de connexion
    firebase.auth().onAuthStateChanged(async function(user) {
      var loginScreen = document.getElementById('login-screen');
      var appContent = document.getElementById('app-content');

      if (user) {
        // Phase 0 multi-tenant : verifier le profil + le tenant_id
        try {
          var profileDoc = await firebase.firestore().collection('users').doc(user.uid).get();
          if (profileDoc.exists) {
            var profile = profileDoc.data();
            window._currentUserProfile = profile;
            // Securite : si le user appartient a un autre tenant, refuser la connexion
            if (profile.tenant_id && profile.tenant_id !== window.TENANT_ID) {
              console.warn('[AUTH] Rejet : user tenant_id=' + profile.tenant_id +
                           ' ne correspond pas au tenant courant ' + window.TENANT_ID);
              alert('Ce compte n\'est pas autorise pour ce laboratoire.');
              await firebase.auth().signOut();
              return;
            }
            if (profile.actif === false) {
              console.warn('[AUTH] Rejet : user desactive');
              alert('Ce compte a ete desactive.');
              await firebase.auth().signOut();
              return;
            }
          } else {
            // Phase 0 transitoire : pas encore de profil Firestore
            // On autorise la connexion mais on log un warning.
            // En Phase 0.4 (rules strictes), ce cas sera bloque.
            console.warn('[AUTH] Aucun profil users/' + user.uid +
                         ' dans Firestore — autorise en Phase 0 transitoire');
            window._currentUserProfile = null;
          }
        } catch (e) {
          console.error('[AUTH] Erreur chargement profil', e);
          // Ne pas bloquer en Phase 0 si Firestore pas accessible
        }

        // Connecte → afficher l'app
        window._currentUser = user;
        console.log('[AUTH] Connecte : ' + user.email);
        if (loginScreen) loginScreen.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
        // Lancer Firebase init (chargement donnees)
        if (typeof initFirebase === 'function' && !window._firebaseReady) {
          initFirebase();
        }
      } else {
        // Non connecte → afficher le login
        window._currentUser = null;
        window._currentUserProfile = null;
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
