# Phase 0 — Fondations invisibles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place les fondations multi-tenant (auth + tenant_id + sous-domaines + hosting) sans changer l'UX de l'app actuelle de I Love Smile.

**Architecture:** Évolution brownfield. On ajoute des couches (auth, tenant_id) par-dessus l'existant sans refactorer. Migration idempotente pour pouvoir rejouer. Tous les documents Firestore reçoivent un champ `tenant_id: "lab_ilovesmile"` et les queries sont scopées par ce champ hardcodé au début (dynamisation en Phase 2).

**Tech Stack:** Vanilla JS, Firebase Auth, Firestore, Firebase Cloud Functions (Node.js), Firestore rules unit testing (`@firebase/rules-unit-testing`), Cloudflare Pages, Node.js scripts pour migration.

**Prérequis manuels (à faire avant Task 1) :**
- Avoir acheté le domaine `ilovesmile.app` (ou celui choisi — adapter tous les noms dans ce plan)
- Avoir un compte Cloudflare (gratuit)
- Node.js ≥ 18 installé
- `npm install -g firebase-tools` puis `firebase login`

**Convention de nommage :**
- TENANT_ID du labo actuel : `lab_ilovesmile`
- Sous-domaine principal : `ilovesmile.ilovesmile.app`
- Domaine root : `ilovesmile.app` (redirige vers marketing plus tard)

---

## Étape 0.1 — Migration hosting GitHub Pages → Cloudflare Pages

### Task 1: Backup complet pré-migration

**Files:**
- Create: `scripts/backup-firestore.mjs`
- Modify: `package.json` (ajouter devDeps)

- [ ] **Step 1.1 : Ajouter firebase-admin en devDep**

```bash
npm install --save-dev firebase-admin
```

- [ ] **Step 1.2 : Créer le script de backup**

Créer `scripts/backup-firestore.mjs` :

```javascript
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT
  || './scripts/.service-account.json';
const OUT_DIR = `./backups/firestore-${new Date().toISOString().replace(/[:.]/g, '-')}`;

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Missing service account at ${SERVICE_ACCOUNT_PATH}`);
  console.error('Download from https://console.firebase.google.com/project/ilovesmile-labo-fd511/settings/serviceaccounts/adminsdk');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

fs.mkdirSync(OUT_DIR, { recursive: true });

async function backupCollection(name, subpath = '') {
  const ref = subpath ? db.collection(subpath).doc(name) : db.collection(name);
  const snap = subpath ? await ref.get() : await ref.get();
  if (subpath) {
    fs.writeFileSync(path.join(OUT_DIR, `${subpath}__${name}.json`),
      JSON.stringify({ id: snap.id, data: snap.data() }, null, 2));
    console.log(`✓ ${subpath}/${name} (1 doc)`);
  } else {
    const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    fs.writeFileSync(path.join(OUT_DIR, `${name}.json`),
      JSON.stringify(docs, null, 2));
    console.log(`✓ ${name} (${docs.length} docs)`);
  }
}

console.log(`Backup -> ${OUT_DIR}`);
await backupCollection('prescriptions');
await backupCollection('contacts');
await backupCollection('tarifs');
await backupCollection('meta');
console.log('Backup complete');
process.exit(0);
```

- [ ] **Step 1.3 : Ajouter `backups/` et `scripts/.service-account.json` au .gitignore**

Modifier `.gitignore` (créer s'il n'existe pas) en ajoutant :

```
backups/
scripts/.service-account.json
node_modules/
```

- [ ] **Step 1.4 : Télécharger le service account Firebase**

Manuellement : ouvrir https://console.firebase.google.com/project/ilovesmile-labo-fd511/settings/serviceaccounts/adminsdk → cliquer "Generate new private key" → sauvegarder dans `scripts/.service-account.json`

- [ ] **Step 1.5 : Exécuter le backup**

```bash
node scripts/backup-firestore.mjs
```

Expected: Un dossier `backups/firestore-2026-04-18...` avec 4 fichiers JSON (prescriptions.json, contacts.json, tarifs.json, meta.json).

- [ ] **Step 1.6 : Commit le script (pas le backup)**

```bash
git add scripts/backup-firestore.mjs package.json package-lock.json .gitignore
git commit -m "Ajout script backup Firestore pour migration Phase 0"
```

---

### Task 2: Créer projet Cloudflare Pages

**Files:** aucun code, actions manuelles dans l'UI Cloudflare.

- [ ] **Step 2.1 : Aller sur dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git**

- [ ] **Step 2.2 : Autoriser Cloudflare à accéder au repo `Illan2309/ilovesmile-labo`**

- [ ] **Step 2.3 : Configurer le déploiement**

- Production branch : `main`
- Build command : *(laisser vide)*
- Build output directory : `/` (root)
- Environment variables : aucune pour l'instant

- [ ] **Step 2.4 : Lancer le premier déploiement**

Noter l'URL fournie par Cloudflare (ex: `ilovesmile-labo.pages.dev`). Vérifier que le site charge.

- [ ] **Step 2.5 : Vérifier visuellement que l'app fonctionne**

Ouvrir `https://ilovesmile-labo.pages.dev` dans le navigateur. L'app doit se charger. Les données Firestore doivent s'afficher (peut nécessiter d'ajouter le domaine aux Authorized domains Firebase — voir Task 4).

---

### Task 3: Configurer le domaine custom ilovesmile.app

**Files:** aucun, actions Cloudflare + DNS.

- [ ] **Step 3.1 : Ajouter le domaine à Cloudflare**

Dans le dashboard Cloudflare → Websites → Add site → entrer `ilovesmile.app`. Suivre les instructions pour pointer les nameservers du registrar vers ceux de Cloudflare.

- [ ] **Step 3.2 : Attendre la propagation DNS (5 min à 24h)**

Vérifier avec : `dig ilovesmile.app NS` (ou équivalent).

- [ ] **Step 3.3 : Dans Pages → ilovesmile-labo → Custom domains → Set up a custom domain**

Entrer `ilovesmile.app`. Cloudflare crée automatiquement le record DNS.

- [ ] **Step 3.4 : Vérifier que `https://ilovesmile.app` charge l'app**

Attendre le certificat SSL (quelques minutes). Tester.

- [ ] **Step 3.5 : Ajouter également le sous-domaine `ilovesmile.ilovesmile.app` en Custom domain**

Dans Pages → Custom domains → Add → `ilovesmile.ilovesmile.app`. CF crée le record.

Expected: `https://ilovesmile.ilovesmile.app` charge l'app. Ce sera l'URL principale du labo actuel.

---

### Task 4: Autoriser le nouveau domaine dans Firebase

**Files:** aucun, console Firebase.

- [ ] **Step 4.1 : Firebase console → Authentication → Settings → Authorized domains**

- [ ] **Step 4.2 : Ajouter 3 domaines**

- `ilovesmile.app`
- `ilovesmile.ilovesmile.app`
- `ilovesmile-labo.pages.dev` (fallback dev)

- [ ] **Step 4.3 : Test de non-régression**

Ouvrir `https://ilovesmile.ilovesmile.app` → vérifier que les prescriptions se chargent (appel Firestore OK).

**Critère de sortie Étape 0.1** : L'app répond sur `ilovesmile.ilovesmile.app` avec toutes ses fonctionnalités intactes. GitHub Pages reste actif en parallèle comme filet.

---

## Étape 0.2 — Introduction du champ `tenant_id` (rétro-compatible)

### Task 5: Créer le tenant initial dans Firestore

**Files:** aucun, console Firebase.

- [ ] **Step 5.1 : Firebase console → Firestore Database → Start collection**

- Collection ID : `tenants`
- Document ID : `lab_ilovesmile`
- Fields :

```
name: "I Love Smile" (string)
short_name: "ILS" (string)
subdomain: "ilovesmile" (string)
plan: "standard" (string)
actif: true (boolean)
createdAt: [serveur timestamp maintenant]
branding: {
  couleur_principale: "#1a5c8a" (string)
  couleur_secondaire: "#5bc4c0" (string)
  couleur_fond: "#eef4f8" (string)
}
contact: {
  email: "cohenillan29@gmail.com" (string)
  telephone: "" (string)
  adresse: "Aix-en-Provence" (string)
}
```

- [ ] **Step 5.2 : Vérifier que le doc est créé**

Rafraîchir l'onglet Firestore. Le doc `tenants/lab_ilovesmile` doit être visible.

---

### Task 6: Écrire le script de migration add-tenant-id

**Files:**
- Create: `scripts/migrate-add-tenant-id.mjs`

- [ ] **Step 6.1 : Créer le script**

```javascript
// scripts/migrate-add-tenant-id.mjs
// Idempotent : peut être rejoué sans effet si déjà migré
import admin from 'firebase-admin';
import fs from 'node:fs';

const TENANT_ID = 'lab_ilovesmile';
const DRY_RUN = process.argv.includes('--dry-run');

const serviceAccount = JSON.parse(fs.readFileSync('./scripts/.service-account.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function migrateCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  let added = 0, already = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.tenant_id) { already++; continue; }
    if (DRY_RUN) {
      console.log(`  [DRY] ${collectionName}/${doc.id}`);
    } else {
      await doc.ref.update({ tenant_id: TENANT_ID });
    }
    added++;
  }
  console.log(`${collectionName}: ${added} à migrer, ${already} déjà ok`);
}

async function migrateDocsOfSubCollection(collectionName) {
  // pour contacts, tarifs, meta (sous-docs)
  const snap = await db.collection(collectionName).get();
  let added = 0, already = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.tenant_id) { already++; continue; }
    if (DRY_RUN) {
      console.log(`  [DRY] ${collectionName}/${doc.id}`);
    } else {
      await doc.ref.update({ tenant_id: TENANT_ID });
    }
    added++;
  }
  console.log(`${collectionName}: ${added} docs à migrer, ${already} déjà ok`);
}

console.log(DRY_RUN ? '=== DRY RUN ===' : '=== MIGRATION RÉELLE ===');
console.log(`Cible : tenant_id = "${TENANT_ID}"`);

await migrateCollection('prescriptions');
await migrateDocsOfSubCollection('contacts');
await migrateDocsOfSubCollection('tarifs');
await migrateDocsOfSubCollection('meta');

console.log(DRY_RUN ? 'DRY RUN terminé — rejouer sans --dry-run pour migrer' : '✓ Migration terminée');
process.exit(0);
```

- [ ] **Step 6.2 : Exécuter en dry-run**

```bash
node scripts/migrate-add-tenant-id.mjs --dry-run
```

Expected: liste tous les docs qui seraient migrés, sans modification réelle.

- [ ] **Step 6.3 : Refaire un backup (sécurité)**

```bash
node scripts/backup-firestore.mjs
```

- [ ] **Step 6.4 : Exécuter la migration réelle**

```bash
node scripts/migrate-add-tenant-id.mjs
```

Expected: tous les docs ont `tenant_id: "lab_ilovesmile"`. Rejouer le script doit donner "N docs déjà ok, 0 à migrer".

- [ ] **Step 6.5 : Vérifier dans la console Firestore**

Ouvrir une prescription au hasard → le champ `tenant_id: "lab_ilovesmile"` doit être présent.

- [ ] **Step 6.6 : Commit le script**

```bash
git add scripts/migrate-add-tenant-id.mjs
git commit -m "Ajout script migration tenant_id (idempotent)"
```

---

### Task 7: Introduire la constante TENANT_ID côté client

**Files:**
- Create: `js/tenant.js`

- [ ] **Step 7.1 : Créer js/tenant.js (version Phase 0 — tenant hardcodé)**

```javascript
// js/tenant.js
// Phase 0 : TENANT_ID hardcodé. Phase 2 : détection dynamique par sous-domaine.

window.TENANT_ID = 'lab_ilovesmile';

// Helper pour toutes les queries Firestore : ajoute le filtre tenant_id.
window.tenantQuery = function(query) {
  return query.where('tenant_id', '==', window.TENANT_ID);
};

// Helper pour toutes les écritures : force le tenant_id dans les données.
window.withTenant = function(data) {
  return { ...data, tenant_id: window.TENANT_ID };
};

console.log('[tenant] TENANT_ID =', window.TENANT_ID);
```

- [ ] **Step 7.2 : Inclure le script dans index.html**

Modifier `index.html` : ajouter `<script src="js/tenant.js"></script>` **avant** `<script src="js/utils.js"></script>` (donc avant tous les autres scripts JS). Chercher `<script src="js/utils.js"></script>` dans le fichier et insérer la ligne juste avant.

- [ ] **Step 7.3 : Vérifier en ouvrant la console du navigateur**

Recharger la page. La console doit afficher `[tenant] TENANT_ID = lab_ilovesmile`.

- [ ] **Step 7.4 : Commit**

```bash
git add js/tenant.js index.html
git commit -m "Ajout module tenant.js (TENANT_ID hardcode Phase 0)"
```

---

### Task 8: Scoper les queries Firestore par tenant_id

**Files:**
- Modify: `js/firebase-init.js`

⚠️ Cette task est la plus risquée. À chaque modification, tester en ouvrant l'app.

- [ ] **Step 8.1 : Identifier toutes les queries `.collection(...).get()` et `.collection(...).onSnapshot(...)` dans firebase-init.js**

Lire le fichier entier pour cartographier. Rechercher aussi dans :

```bash
grep -n "\.collection(" js/firebase-init.js
```

- [ ] **Step 8.2 : Modifier les lectures de documents spécifiques (contacts/dentistes, contacts/mapping, etc.)**

Les docs à `id` fixe ne peuvent pas être filtrés par `where`, donc on garde le fetch tel quel **et on filtre par `tenant_id`** après coup dans le `.then` :

Exemple, transformer :
```javascript
_db.collection('contacts').doc('dentistes').get().then(doc => {
  if (doc.exists) {
    const data = doc.data();
    Object.assign(CONTACTS, data);
    ...
  }
});
```

en :
```javascript
_db.collection('contacts').doc('dentistes').get().then(doc => {
  if (doc.exists && doc.data().tenant_id === window.TENANT_ID) {
    const data = doc.data();
    delete data.tenant_id; // ne pas polluer l'objet métier
    Object.assign(CONTACTS, data);
    ...
  }
});
```

Appliquer ce pattern à **toutes** les lectures de doc dans `firebase-init.js` (contacts/dentistes, contacts/mapping, contacts/cogilog_clients_custom, meta/gc_meta, meta/custom_rules, tarifs/surcharges, meta/clients_supprimes, meta/ia_memory, meta/cogilog_mapping, meta/acte_labels, meta/app_prefs, meta/ui_prefs, meta/aliases_cabinet, meta/aliases_produit, meta/gc_groupes, meta/gc_groupes_ordre).

- [ ] **Step 8.3 : Modifier l'écoute temps réel de `prescriptions`**

Chercher `_prescriptionsCol.onSnapshot` dans `firebase-init.js`. Remplacer par :

```javascript
window.tenantQuery(_prescriptionsCol).onSnapshot(snapshot => { ... });
```

(en utilisant le helper `window.tenantQuery` défini dans `js/tenant.js`).

- [ ] **Step 8.4 : Modifier la réservation atomique nextNum**

Chercher `meta/config` + `nextNum`. La lecture doit vérifier `tenant_id === window.TENANT_ID`. L'écriture doit inclure `tenant_id`. Utiliser `window.withTenant()`.

- [ ] **Step 8.5 : Modifier les écritures de prescriptions**

Chercher `sauvegarderUnePrescription` dans `firebase-init.js`. Avant le `.set()` ou `.update()`, injecter `tenant_id` :

```javascript
const dataToSave = window.withTenant(cleanData);
await _prescriptionsCol.doc(id).set(dataToSave);
```

- [ ] **Step 8.6 : Chercher toutes les autres écritures dans le code JS**

```bash
grep -rn "\.set(" js/ --include="*.js" | grep -v node_modules
grep -rn "\.add(" js/ --include="*.js" | grep -v node_modules
grep -rn "\.update(" js/ --include="*.js" | grep -v node_modules
```

Pour **chaque écriture de document**, s'assurer que `tenant_id` est injecté via `withTenant()` ou manuellement.

- [ ] **Step 8.7 : Test manuel complet de non-régression**

Ouvrir l'app dans un navigateur (mode privé pour repartir d'une cache vierge) et tester :
- [ ] Les prescriptions se chargent (liste non vide)
- [ ] Les contacts s'affichent dans l'autocomplete cabinet
- [ ] Les tarifs s'affichent en gestion clients
- [ ] Créer une nouvelle prescription → sauvegarde OK
- [ ] Éditer une prescription existante → sauvegarde OK
- [ ] Scanner une photo → IA répond, formulaire rempli, sauvegarde OK
- [ ] Export Cogilog → fichier généré
- [ ] Export ZIP anglais → fichier généré

Si un test échoue, corriger la query correspondante avant de continuer.

- [ ] **Step 8.8 : Commit**

```bash
git add js/firebase-init.js
# et autres fichiers modifiés
git commit -m "Scoper les queries Firestore par tenant_id (filtrage cote client)"
```

**Critère de sortie Étape 0.2** : Tous les docs Firestore ont `tenant_id`. Toutes les queries JS filtrent par `tenant_id`. L'app fonctionne comme avant, 100% des scénarios métier validés.

---

## Étape 0.3 — Authentification Firebase

### Task 9: Activer Email/Password Auth

**Files:** aucun, console Firebase.

- [ ] **Step 9.1 : Firebase console → Authentication → Sign-in method → Email/Password → Enable**

- [ ] **Step 9.2 : Créer 2 comptes via Authentication → Users → Add user**

- Compte 1 : `cohenillan29@gmail.com` + password robuste → noter l'UID (on en aura besoin)
- Compte 2 : un compte pro labo (ex: `labo@ilovesmile.fr`) + password → noter l'UID

- [ ] **Step 9.3 : Créer les docs `users/` correspondants dans Firestore**

Dans Firestore console, créer la collection `users/` avec 2 docs :

Doc ID = UID du compte super_admin :
```
email: "cohenillan29@gmail.com"
nom: "Illan Cohen"
tenant_id: "lab_ilovesmile"
role: "super_admin"
actif: true
createdAt: [timestamp]
```

Doc ID = UID du compte admin labo :
```
email: "labo@ilovesmile.fr"
nom: "Labo I Love Smile"
tenant_id: "lab_ilovesmile"
role: "admin_labo"
actif: true
createdAt: [timestamp]
```

---

### Task 10: Créer le module d'authentification client

**Files:**
- Create: `js/auth.js`

- [ ] **Step 10.1 : Créer js/auth.js**

```javascript
// js/auth.js
// Gestion session utilisateur Firebase Auth

window._currentUser = null;  // Firebase user object
window._currentUserProfile = null;  // doc Firestore users/{uid}

// Login email/password
window.authLogin = async function(email, password) {
  try {
    const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
    return { ok: true, user: cred.user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

// Logout
window.authLogout = async function() {
  await firebase.auth().signOut();
  window.location.reload();
};

// Reset password
window.authResetPassword = async function(email) {
  try {
    await firebase.auth().sendPasswordResetEmail(email);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

// Observer l'état de l'auth
// onReady est appelé dès qu'on sait si l'user est connecté (ou pas)
window.authInit = function(onReady) {
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      window._currentUser = user;
      // Charger le profil Firestore
      try {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (doc.exists) {
          window._currentUserProfile = doc.data();
          // Sécurité : vérifier que le profil correspond au TENANT_ID attendu
          if (window._currentUserProfile.tenant_id !== window.TENANT_ID) {
            console.warn('[auth] Profil user ne correspond pas au tenant courant');
            await window.authLogout();
            return;
          }
        } else {
          console.warn('[auth] Pas de profil Firestore pour cet user');
          await window.authLogout();
          return;
        }
      } catch (e) {
        console.error('[auth] Erreur chargement profil', e);
      }
    } else {
      window._currentUser = null;
      window._currentUserProfile = null;
    }
    onReady(user);
  });
};
```

- [ ] **Step 10.2 : Ajouter `<script src="js/auth.js"></script>` dans index.html**

Juste après `js/tenant.js` et avant les autres modules. Chercher l'endroit où `js/tenant.js` a été ajouté à l'Étape 0.2 et insérer `js/auth.js` juste après.

- [ ] **Step 10.3 : Commit**

```bash
git add js/auth.js index.html
git commit -m "Ajout module auth.js (Firebase Auth + session helpers)"
```

---

### Task 11: Créer l'UI de login (overlay)

**Files:**
- Modify: `index.html`
- Modify: `style.css` (append)

- [ ] **Step 11.1 : Ajouter le markup de l'overlay de login**

Dans `index.html`, juste après `<body>` (avant tout autre contenu), insérer :

```html
<!-- Overlay login - masqué par défaut, affiché si non authentifié -->
<div id="login-overlay" style="display:none;">
  <div class="login-card">
    <div class="login-logo">I Love Smile Labo</div>
    <h1>Connexion</h1>
    <form id="login-form">
      <label>Email<input type="email" id="login-email" required autocomplete="email"></label>
      <label>Mot de passe<input type="password" id="login-password" required autocomplete="current-password"></label>
      <button type="submit" class="btn-primary">Se connecter</button>
      <a href="#" id="login-forgot">Mot de passe oublié ?</a>
      <div id="login-error" class="login-error"></div>
    </form>
  </div>
</div>
```

- [ ] **Step 11.2 : Ajouter le CSS de l'overlay**

Ajouter en fin de `style.css` :

```css
/* === LOGIN OVERLAY === */
#login-overlay {
  position: fixed; inset: 0;
  background: var(--grad, linear-gradient(120deg, #1a5c8a, #5bc4c0));
  z-index: 99999;
  display: flex; align-items: center; justify-content: center;
}
#login-overlay .login-card {
  background: var(--surface, #fff);
  padding: 40px; border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  min-width: 340px; max-width: 420px;
}
#login-overlay .login-logo {
  font-family: 'Dancing Script', cursive;
  font-size: 28px; color: var(--accent); margin-bottom: 16px;
}
#login-overlay h1 { font-size: 22px; margin: 0 0 24px; color: var(--text); }
#login-overlay label {
  display: block; margin-bottom: 16px;
  font-size: 13px; color: var(--muted);
}
#login-overlay input {
  display: block; width: 100%;
  padding: 10px 14px; margin-top: 6px;
  border: 1px solid var(--border); border-radius: 8px;
  font-size: 15px;
}
#login-overlay button.btn-primary {
  display: block; width: 100%;
  padding: 12px; background: var(--accent); color: white;
  border: none; border-radius: 8px;
  font-size: 15px; font-weight: 600; cursor: pointer;
  margin-top: 8px;
}
#login-overlay button.btn-primary:hover { opacity: 0.9; }
#login-overlay #login-forgot {
  display: block; text-align: center; margin-top: 16px;
  font-size: 13px; color: var(--muted); text-decoration: none;
}
#login-overlay .login-error {
  margin-top: 12px; color: var(--danger);
  font-size: 13px; text-align: center; min-height: 18px;
}
```

- [ ] **Step 11.3 : Commit**

```bash
git add index.html style.css
git commit -m "Ajout UI overlay de login"
```

---

### Task 12: Brancher l'overlay au flow d'authentification

**Files:**
- Modify: `js/app.js`

- [ ] **Step 12.1 : Réorganiser le code de démarrage**

Dans `js/app.js`, **entourer** tout le code existant dans `DOMContentLoaded` par un flow auth. Pattern :

```javascript
document.addEventListener('DOMContentLoaded', function() {
  // Init Firebase (lib) — doit être fait avant authInit
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyCFEazX7KrxC4jfLCDuLiCT7ZJhcjDQpdM",
      authDomain: "ilovesmile-labo-fd511.firebaseapp.com",
      projectId: "ilovesmile-labo-fd511",
      storageBucket: "ilovesmile-labo-fd511.firebasestorage.app",
      messagingSenderId: "702662622870",
      appId: "1:702662622870:web:dc9a1fbed329c7942f4cb7"
    });
  }

  const mainContent = document.querySelector('.split-wrapper') || document.body;
  const overlay = document.getElementById('login-overlay');

  window.authInit(user => {
    if (user) {
      // Connecté : masquer overlay, continuer l'init normale
      overlay.style.display = 'none';
      initAppContent();
    } else {
      // Pas connecté : afficher overlay
      overlay.style.display = 'flex';
    }
  });

  // Handler form login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errBox = document.getElementById('login-error');
    errBox.textContent = '';

    const result = await window.authLogin(email, password);
    if (!result.ok) {
      errBox.textContent = 'Email ou mot de passe incorrect';
      return;
    }
    // authInit détecte le login et recharge le flow
  });

  // Handler forgot password
  document.getElementById('login-forgot').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    if (!email) {
      document.getElementById('login-error').textContent = 'Saisissez votre email d\'abord';
      return;
    }
    const result = await window.authResetPassword(email);
    const errBox = document.getElementById('login-error');
    errBox.textContent = result.ok
      ? 'Email de réinitialisation envoyé'
      : 'Erreur : ' + result.error;
  });
});

// Tout l'ancien code de DOMContentLoaded va dans initAppContent()
function initAppContent() {
  // ... contenu existant de DOMContentLoaded ...
}
```

⚠️ Être prudent : renommer la fonction sans casser l'ordre d'exécution. Prendre le temps de vérifier que `initFirebase()` (défini dans `firebase-init.js`) est bien appelé **après** l'auth (pas dans `initAppContent()`). En fait `initFirebase()` est idempotent : le `if (window._firebaseReady) return;` est déjà là.

- [ ] **Step 12.2 : Supprimer l'appel automatique à initFirebase() quand on n'est pas connecté**

Chercher l'appel à `initFirebase()` dans le code. Si appelé au module-level, le déplacer **dans** `initAppContent()`. Sinon, ne rien changer.

- [ ] **Step 12.3 : Ajouter un bouton Logout dans le header**

Dans `index.html`, chercher le `<header>` et ajouter à la fin :

```html
<button id="btn-logout" class="btn-logout" title="Se déconnecter">⏻</button>
```

Et le CSS :

```css
.btn-logout {
  background: transparent; border: 1px solid var(--border);
  padding: 6px 10px; border-radius: 6px;
  cursor: pointer; font-size: 14px;
  color: var(--muted); margin-left: 8px;
}
.btn-logout:hover { color: var(--danger); border-color: var(--danger); }
```

Et le handler dans `initAppContent()` :

```javascript
document.getElementById('btn-logout').addEventListener('click', () => {
  if (confirm('Se déconnecter ?')) window.authLogout();
});
```

- [ ] **Step 12.4 : Test manuel — login OK**

Ouvrir l'app. L'overlay doit s'afficher. Se connecter avec un des 2 comptes. L'app doit charger normalement.

- [ ] **Step 12.5 : Test manuel — logout**

Cliquer sur le bouton logout. L'overlay doit réapparaître.

- [ ] **Step 12.6 : Test manuel — mauvais mot de passe**

Saisir un email inexistant ou mauvais mot de passe. Le message d'erreur doit s'afficher.

- [ ] **Step 12.7 : Commit**

```bash
git add js/app.js index.html style.css
git commit -m "Branche login/logout + bloque l'app si non authentifie"
```

**Critère de sortie Étape 0.3** : L'accès à l'app nécessite un login. Les 2 comptes fonctionnent. Le logout déconnecte. Le reset password envoie un email.

---

## Étape 0.4 — Custom claims + règles Firestore strictes

### Task 13: Setup Firebase Functions

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `functions/index.js`
- Create: `functions/package.json`

- [ ] **Step 13.1 : Initialiser Firebase Functions**

```bash
firebase init functions
```

Répondre :
- Use an existing project → `ilovesmile-labo-fd511`
- Language : JavaScript
- ESLint : No
- Install dependencies : Yes

- [ ] **Step 13.2 : Remplacer le contenu de functions/index.js**

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Appelable : seulement par un super_admin
exports.setTenantClaims = functions.https.onCall(async (data, context) => {
  // Vérifier que l'appelant est super_admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Auth requise');
  }
  const callerUid = context.auth.uid;
  const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'super_admin') {
    throw new functions.https.HttpsError('permission-denied', 'Seul un super_admin peut appeler');
  }

  const { userId, tenant_id, role } = data;
  if (!userId || !tenant_id || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'userId, tenant_id, role requis');
  }
  const validRoles = ['super_admin', 'admin_labo', 'user_labo'];
  if (!validRoles.includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', `role doit être: ${validRoles.join(', ')}`);
  }

  await admin.auth().setCustomUserClaims(userId, { tenant_id, role });
  console.log(`Claims set for ${userId}: tenant_id=${tenant_id}, role=${role}`);
  return { ok: true };
});

// Version "bootstrap" : appelable sans auth, UNIQUEMENT en emulator ou pour le 1er super_admin.
// À désactiver (commenter) une fois le 1er super_admin configuré.
exports.bootstrapFirstSuperAdmin = functions.https.onCall(async (data, context) => {
  const { userId, bootstrapKey } = data;
  const EXPECTED_KEY = functions.config().bootstrap?.key;
  if (!EXPECTED_KEY || bootstrapKey !== EXPECTED_KEY) {
    throw new functions.https.HttpsError('permission-denied', 'Clé bootstrap invalide');
  }
  // Vérifier qu'il n'y a pas déjà un super_admin (sinon ne rien faire)
  const existing = await admin.firestore().collection('users')
    .where('role', '==', 'super_admin').limit(1).get();
  if (!existing.empty) {
    throw new functions.https.HttpsError('already-exists', 'Un super_admin existe déjà');
  }
  await admin.auth().setCustomUserClaims(userId, {
    tenant_id: 'lab_ilovesmile', role: 'super_admin'
  });
  return { ok: true };
});
```

- [ ] **Step 13.3 : Définir la clé bootstrap**

```bash
firebase functions:config:set bootstrap.key="UNE_CLE_ALEATOIRE_LONGUE_CHOISIE_ICI"
```

(Noter cette clé temporairement, elle sera détruite juste après)

- [ ] **Step 13.4 : Déployer la Function**

```bash
firebase deploy --only functions
```

Attendre la confirmation. Noter l'URL de la region.

- [ ] **Step 13.5 : Initialiser le 1er super_admin via Node REPL**

Créer un fichier temporaire `scripts/bootstrap-super-admin.mjs` :

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const app = initializeApp({
  apiKey: "AIzaSyCFEazX7KrxC4jfLCDuLiCT7ZJhcjDQpdM",
  authDomain: "ilovesmile-labo-fd511.firebaseapp.com",
  projectId: "ilovesmile-labo-fd511"
});
const auth = getAuth(app);
const functions = getFunctions(app);

// Login d'abord (nécessite un compte existant)
const EMAIL = 'cohenillan29@gmail.com';
const PASSWORD = process.env.PASSWORD;  // à passer via env
const BOOTSTRAP_KEY = process.env.BOOTSTRAP_KEY;
const USER_ID = process.env.USER_ID;  // UID du compte super_admin

await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
const callable = httpsCallable(functions, 'bootstrapFirstSuperAdmin');
const result = await callable({ userId: USER_ID, bootstrapKey: BOOTSTRAP_KEY });
console.log('Bootstrap result:', result.data);
process.exit(0);
```

Installer firebase client SDK :
```bash
npm install --save-dev firebase
```

Exécuter :
```bash
PASSWORD="xxx" BOOTSTRAP_KEY="xxx" USER_ID="uid_super_admin" node scripts/bootstrap-super-admin.mjs
```

- [ ] **Step 13.6 : Configurer le 2e compte (admin_labo) via l'app**

Ouvrir l'app en tant que super_admin. Ouvrir la console dev → exécuter :

```javascript
const callable = firebase.functions().httpsCallable('setTenantClaims');
await callable({
  userId: 'UID_ADMIN_LABO',
  tenant_id: 'lab_ilovesmile',
  role: 'admin_labo'
});
```

- [ ] **Step 13.7 : Vérifier les claims**

Firebase console → Authentication → clic sur chaque user → les custom claims doivent être visibles.

- [ ] **Step 13.8 : Désactiver la function bootstrap**

Commenter `exports.bootstrapFirstSuperAdmin = ...` dans `functions/index.js`, redéployer :

```bash
firebase deploy --only functions
```

- [ ] **Step 13.9 : Supprimer le fichier bootstrap-super-admin.mjs et commit**

```bash
rm scripts/bootstrap-super-admin.mjs
git add functions/ firebase.json .firebaserc package.json package-lock.json
git commit -m "Ajout Cloud Functions setTenantClaims + bootstrap desactive"
```

---

### Task 14: Écrire les règles Firestore strictes + tests

**Files:**
- Create: `firestore.rules`
- Create: `tests/rules.test.mjs`
- Modify: `firebase.json`
- Modify: `package.json`

- [ ] **Step 14.1 : Installer le framework de test des rules**

```bash
npm install --save-dev @firebase/rules-unit-testing firebase
```

- [ ] **Step 14.2 : Créer firestore.rules**

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthed() { return request.auth != null; }
    function userTenant() { return request.auth.token.tenant_id; }
    function userRole() { return request.auth.token.role; }
    function isSuperAdmin() { return isAuthed() && userRole() == 'super_admin'; }
    function isAdminOfTenant(t) {
      return isAuthed() && userRole() == 'admin_labo' && userTenant() == t;
    }
    function isUserOfTenant(t) {
      return isAuthed() && (userTenant() == t || isSuperAdmin());
    }

    // Prescriptions : lecture/écriture scopée par tenant_id
    match /prescriptions/{id} {
      allow read: if isUserOfTenant(resource.data.tenant_id);
      allow create: if isAuthed() && request.resource.data.tenant_id == userTenant();
      allow update: if isUserOfTenant(resource.data.tenant_id)
                    && request.resource.data.tenant_id == resource.data.tenant_id;
      allow delete: if isAdminOfTenant(resource.data.tenant_id) || isSuperAdmin();
    }

    // Collections à docs fixes (dentistes, mapping, custom, etc.)
    match /contacts/{id} {
      allow read: if isAuthed() && resource.data.tenant_id == userTenant();
      allow write: if isAdminOfTenant(resource.data.tenant_id)
                   || (!resource.exists && isAuthed()
                       && request.resource.data.tenant_id == userTenant());
    }

    match /tarifs/{id} {
      allow read: if isAuthed() && resource.data.tenant_id == userTenant();
      allow write: if isAdminOfTenant(resource.data.tenant_id);
    }

    match /meta/{id} {
      allow read: if isAuthed() && resource.data.tenant_id == userTenant();
      allow write: if isUserOfTenant(resource.data.tenant_id)
                   && request.resource.data.tenant_id == resource.data.tenant_id;
    }

    // Tenant : lecture par ses membres, écriture par admin_labo ou super_admin
    match /tenants/{tenantId} {
      allow read: if isUserOfTenant(tenantId);
      allow write: if isAdminOfTenant(tenantId) || isSuperAdmin();
    }

    // Users : lecture par soi-même + super_admin, écriture par super_admin uniquement
    match /users/{uid} {
      allow read: if isAuthed() && (request.auth.uid == uid || isSuperAdmin());
      allow write: if isSuperAdmin();
    }
  }
}
```

- [ ] **Step 14.3 : Modifier firebase.json pour déclarer les rules + emulator**

Ajouter les clés `firestore` et `emulators` :

```json
{
  "functions": { "source": "functions" },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

- [ ] **Step 14.4 : Créer firestore.indexes.json**

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 14.5 : Créer les tests de rules**

```javascript
// tests/rules.test.mjs
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import fs from 'node:fs';

const testEnv = await initializeTestEnvironment({
  projectId: 'test-project',
  firestore: {
    rules: fs.readFileSync('firestore.rules', 'utf8'),
    host: 'localhost',
    port: 8080
  }
});

// Helpers
const asUser = (uid, claims) => testEnv.authenticatedContext(uid, claims).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

// Seed admin context (bypass rules)
await testEnv.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'prescriptions', 'p1'), { tenant_id: 'lab_a', numero: 1 });
  await setDoc(doc(db, 'prescriptions', 'p2'), { tenant_id: 'lab_b', numero: 2 });
  await setDoc(doc(db, 'tenants', 'lab_a'), { name: 'Lab A' });
  await setDoc(doc(db, 'tenants', 'lab_b'), { name: 'Lab B' });
  await setDoc(doc(db, 'users', 'user_a'), { tenant_id: 'lab_a', role: 'user_labo' });
});

let pass = 0, fail = 0;
async function test(name, fn) {
  try { await fn(); console.log(`✓ ${name}`); pass++; }
  catch (e) { console.error(`✗ ${name}:`, e.message); fail++; }
}

await test('anon ne peut pas lire prescriptions', async () => {
  const db = asAnon();
  await assertFails(getDoc(doc(db, 'prescriptions', 'p1')));
});

await test('user de lab_a lit sa prescription', async () => {
  const db = asUser('user_a', { tenant_id: 'lab_a', role: 'user_labo' });
  await assertSucceeds(getDoc(doc(db, 'prescriptions', 'p1')));
});

await test('user de lab_a NE PEUT PAS lire prescription lab_b', async () => {
  const db = asUser('user_a', { tenant_id: 'lab_a', role: 'user_labo' });
  await assertFails(getDoc(doc(db, 'prescriptions', 'p2')));
});

await test('user_labo ne peut pas supprimer une prescription', async () => {
  const db = asUser('user_a', { tenant_id: 'lab_a', role: 'user_labo' });
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(db, 'prescriptions', 'p1')));
});

await test('admin_labo peut supprimer dans son tenant', async () => {
  const db = asUser('admin_a', { tenant_id: 'lab_a', role: 'admin_labo' });
  const { deleteDoc } = await import('firebase/firestore');
  await assertSucceeds(deleteDoc(doc(db, 'prescriptions', 'p1')));
});

await test('super_admin voit tout', async () => {
  const db = asUser('sa', { tenant_id: 'lab_a', role: 'super_admin' });
  await assertSucceeds(getDoc(doc(db, 'prescriptions', 'p2')));
});

await test('create refuse si tenant_id ne matche pas le token', async () => {
  const db = asUser('user_a', { tenant_id: 'lab_a', role: 'user_labo' });
  await assertFails(setDoc(doc(db, 'prescriptions', 'pnew'),
    { tenant_id: 'lab_b', numero: 99 }));
});

console.log(`\n${pass} passed, ${fail} failed`);
await testEnv.cleanup();
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 14.6 : Démarrer l'emulator et lancer les tests**

Terminal 1 :
```bash
firebase emulators:start --only firestore,auth
```

Terminal 2 :
```bash
node tests/rules.test.mjs
```

Expected: tous les tests passent (`7 passed, 0 failed`).

- [ ] **Step 14.7 : Déployer les règles en prod**

```bash
firebase deploy --only firestore:rules
```

⚠️ **C'est le moment critique**. Tester immédiatement l'app dans le navigateur en parallèle.

- [ ] **Step 14.8 : Test manuel post-déploiement**

Ouvrir l'app (mode privé, login avec compte admin_labo). Vérifier :
- [ ] Les prescriptions se chargent
- [ ] Création, édition, suppression OK
- [ ] Scan OK
- [ ] Export OK

Si quelque chose casse, c'est que le rules rejette un cas légitime. Revoir les rules.

- [ ] **Step 14.9 : Test d'intrusion manuel**

Ouvrir la console dev → exécuter :

```javascript
// Tenter de lire depuis un autre tenant (doit échouer)
firebase.firestore().collection('prescriptions')
  .where('tenant_id', '==', 'lab_autre_inventé')
  .get()
  .then(s => console.log('docs:', s.docs.length))
  .catch(e => console.log('rejected:', e.code));
```

Expected : `rejected: permission-denied` ou 0 docs (car rules filtrent à la lecture).

- [ ] **Step 14.10 : Commit**

```bash
git add firestore.rules firestore.indexes.json tests/ firebase.json package.json package-lock.json
git commit -m "Ajout firestore.rules + tests emulator"
```

**Critère de sortie Étape 0.4** : Les rules sont déployées, les tests passent, l'app fonctionne, l'intrusion est bloquée.

---

## Étape 0.5 — Détection tenant depuis sous-domaine

### Task 15: Dynamiser TENANT_ID depuis le sous-domaine

**Files:**
- Modify: `js/tenant.js`
- Create: `tests/tenant.test.mjs`

- [ ] **Step 15.1 : Réécrire js/tenant.js avec détection dynamique**

```javascript
// js/tenant.js
// Détecte le tenant depuis le sous-domaine.

(function() {
  // Export pour les tests Node (sans window)
  const ROOT_DOMAIN = 'ilovesmile.app';
  const FALLBACK_TENANT = 'lab_ilovesmile';  // pour local/preview, pas pour prod
  const DEV_HOSTS = ['localhost', '127.0.0.1', 'ilovesmile-labo.pages.dev'];

  function detectTenantFromHostname(hostname) {
    if (!hostname) return null;
    // Dev / preview → fallback sur le labo principal
    if (DEV_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))) {
      return FALLBACK_TENANT;
    }
    // ilovesmile.app (sans sous-domaine) → pas de tenant
    if (hostname === ROOT_DOMAIN) return null;
    // Format attendu : {slug}.ilovesmile.app
    if (!hostname.endsWith('.' + ROOT_DOMAIN)) return null;
    const slug = hostname.slice(0, hostname.length - ROOT_DOMAIN.length - 1);
    if (!slug || slug.includes('.')) return null;  // rejette multi-dots
    if (!/^[a-z0-9-]+$/.test(slug)) return null;
    return 'lab_' + slug;
  }

  // Export pour les tests (Node.js)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { detectTenantFromHostname };
    return;
  }

  // Côté browser
  const hostname = window.location.hostname;
  const tenantId = detectTenantFromHostname(hostname);
  if (!tenantId) {
    // Page d'erreur propre
    document.body.innerHTML = `
      <div style="font-family:sans-serif; padding:60px; text-align:center; color:#555;">
        <h1>Sous-domaine inconnu</h1>
        <p>Le sous-domaine <code>${hostname}</code> ne correspond à aucun laboratoire connu.</p>
        <p>Si vous êtes un labo client, contactez votre administrateur pour obtenir votre URL.</p>
      </div>`;
    throw new Error('Tenant introuvable depuis ' + hostname);
  }

  window.TENANT_ID = tenantId;
  window.tenantQuery = function(query) {
    return query.where('tenant_id', '==', window.TENANT_ID);
  };
  window.withTenant = function(data) {
    return { ...data, tenant_id: window.TENANT_ID };
  };
  console.log('[tenant] Détecté :', window.TENANT_ID, 'depuis', hostname);
})();
```

- [ ] **Step 15.2 : Écrire les tests Node**

```javascript
// tests/tenant.test.mjs
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Astuce : le fichier js/tenant.js s'auto-exécute dans le browser, mais en
// Node il exporte juste detectTenantFromHostname via module.exports.
const mod = require('../js/tenant.js');
const { detectTenantFromHostname } = mod;

const cases = [
  ['ilovesmile.ilovesmile.app',       'lab_ilovesmile'],
  ['labo-dupont.ilovesmile.app',      'lab_labo-dupont'],
  ['localhost',                       'lab_ilovesmile'],
  ['127.0.0.1',                       'lab_ilovesmile'],
  ['ilovesmile-labo.pages.dev',       'lab_ilovesmile'],
  ['ilovesmile.app',                  null],
  ['google.com',                      null],
  ['foo.bar.ilovesmile.app',          null],  // slug avec dot → rejet
  ['SomeCapital.ilovesmile.app',      null],  // majuscules → rejet
  ['',                                null],
];

let pass = 0, fail = 0;
for (const [host, expected] of cases) {
  const got = detectTenantFromHostname(host);
  if (got === expected) {
    console.log(`✓ "${host}" → ${got}`);
    pass++;
  } else {
    console.error(`✗ "${host}": expected ${expected}, got ${got}`);
    fail++;
  }
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 15.3 : Lancer les tests**

```bash
node tests/tenant.test.mjs
```

Expected: tous les cas passent.

- [ ] **Step 15.4 : Mettre à jour js/auth.js pour utiliser TENANT_ID dynamique**

Dans `js/auth.js`, la fonction `authInit` fait déjà :

```javascript
if (window._currentUserProfile.tenant_id !== window.TENANT_ID) {
  await window.authLogout();
}
```

Donc **automatiquement** : si un user de `lab_dupont` tente de se connecter sur `ilovesmile.ilovesmile.app`, il sera rejeté. Aucune modif nécessaire.

- [ ] **Step 15.5 : Test end-to-end — bon sous-domaine**

Ouvrir `https://ilovesmile.ilovesmile.app`. Se connecter avec le compte admin_labo. L'app charge normalement.

- [ ] **Step 15.6 : Test end-to-end — mauvais sous-domaine**

Ouvrir `https://nonexistent.ilovesmile.app`. La page d'erreur "Sous-domaine inconnu" doit s'afficher.

- [ ] **Step 15.7 : Test end-to-end — sous-domaine d'un tenant factice**

Créer un doc `tenants/lab_test` dans Firestore (via console). Ouvrir `https://test.ilovesmile.app`. La page de login s'affiche (branding par défaut, auth échoue car aucun user dans `lab_test`).

- [ ] **Step 15.8 : Commit**

```bash
git add js/tenant.js tests/tenant.test.mjs
git commit -m "Dynamiser TENANT_ID depuis le sous-domaine + tests"
```

**Critère de sortie Étape 0.5** : La détection du tenant fonctionne sur tous les environnements (prod, dev, preview). Les mauvais sous-domaines affichent une page d'erreur. Un user d'un tenant ne peut pas se connecter sur un autre tenant.

---

## Étape 0.6 — Tests de non-régression finale

### Task 16: Créer un tenant factice pour tests d'isolation

**Files:** aucun, console Firebase.

- [ ] **Step 16.1 : Créer le tenant test dans Firestore**

Collection `tenants/`, doc `lab_test` :

```
name: "Labo Test"
subdomain: "test"
plan: "test"
actif: true
createdAt: [timestamp]
branding: { couleur_principale: "#990000" }
```

- [ ] **Step 16.2 : Créer un user test dans Firebase Auth**

Authentication → Users → Add user :
- Email: `test@ilovesmile.app`
- Password: robuste
- Noter l'UID

- [ ] **Step 16.3 : Créer le profil Firestore `users/{uid}`**

```
email: "test@ilovesmile.app"
tenant_id: "lab_test"
role: "admin_labo"
actif: true
```

- [ ] **Step 16.4 : Setter les custom claims via l'app**

Connecté en super_admin, console dev :

```javascript
await firebase.functions().httpsCallable('setTenantClaims')({
  userId: 'UID_TEST',
  tenant_id: 'lab_test',
  role: 'admin_labo'
});
```

- [ ] **Step 16.5 : Créer une prescription test dans Firestore**

Collection `prescriptions/`, doc `test_pres_1` :

```
tenant_id: "lab_test"
numero: 999999
code_labo: "ZZZ"
cabinet: "CABINET TEST"
praticien: "Dr Test"
statut: "attente"
_ts: [timestamp]
_id: "test_pres_1"
createdAt: [timestamp]
```

---

### Task 17: Tests d'isolation

**Files:** aucun, validation manuelle.

- [ ] **Step 17.1 : Test isolation sens 1 — user ILS ne voit pas lab_test**

Ouvrir `https://ilovesmile.ilovesmile.app` en mode privé. Se connecter avec `labo@ilovesmile.fr` (admin_labo de lab_ilovesmile). Chercher la prescription `999999` dans la liste. **Elle ne doit PAS apparaître.**

- [ ] **Step 17.2 : Test isolation sens 2 — user test se connecte sur ILS**

Toujours sur `https://ilovesmile.ilovesmile.app`, logout et login avec `test@ilovesmile.app`. **Le login doit être rejeté** (car `_currentUserProfile.tenant_id === 'lab_test' ≠ window.TENANT_ID === 'lab_ilovesmile'`).

- [ ] **Step 17.3 : Test isolation sens 3 — user test se connecte sur son sous-domaine**

Ouvrir `https://test.ilovesmile.app`. Se connecter avec `test@ilovesmile.app`. Le login réussit. La liste des prescriptions ne contient que la prescription 999999.

- [ ] **Step 17.4 : Test intrusion via console**

Toujours connecté en tant que `test@ilovesmile.app`, ouvrir la console dev et tenter :

```javascript
firebase.firestore().collection('prescriptions')
  .where('tenant_id', '==', 'lab_ilovesmile').limit(1).get()
  .then(s => console.log(s.docs.length));
```

Expected : `0` ou rejet rules.

- [ ] **Step 17.5 : Documenter le résultat dans le spec stratégique**

Éditer `docs/superpowers/specs/2026-04-18-saas-multi-tenant-roadmap-design.md`, section "État d'avancement", cocher les étapes de Phase 0 complétées.

---

### Task 18: Scénarios métier clés — régression complète

Rejouer les scénarios critiques de l'app pour s'assurer que rien n'a cassé.

- [ ] **Step 18.1 : Scan photo**

Connecté en tant que `labo@ilovesmile.fr` sur `ilovesmile.ilovesmile.app` :
- Prendre une photo de prescription
- L'IA extrait les données
- Le formulaire est rempli
- Sauvegarder
- La nouvelle prescription apparaît dans la liste

- [ ] **Step 18.2 : Scan dossier (drag & drop)**

Glisser un dossier avec plusieurs fichiers → batch scan → toutes les prescriptions sont créées.

- [ ] **Step 18.3 : Édition + sauvegarde**

Cliquer sur une prescription existante → modifier un champ → sauvegarder → le changement est persisté.

- [ ] **Step 18.4 : Export Cogilog**

Sélectionner des prescriptions vérifiées → Export Cogilog → fichier TSV téléchargé → ouvrir dans un éditeur, vérifier encodage MacRoman et contenu cohérent.

- [ ] **Step 18.5 : Export PDF EN**

Une prescription vérifiée → Export PDF EN → PDF téléchargé → ouvrir, vérifier contenu.

- [ ] **Step 18.6 : Export ZIP EN**

Bouton Export ZIP → ZIP téléchargé → ouvrir, vérifier qu'il contient les PDFs.

- [ ] **Step 18.7 : Gestion clients**

Ouvrir modal Gestion clients → ajouter un client → fermer / rouvrir → le client est toujours là.

- [ ] **Step 18.8 : Alias cabinet / produits**

Ajouter un alias → scanner une nouvelle fiche avec le terme → l'alias est appliqué.

- [ ] **Step 18.9 : Sauvegarde puis rechargement**

Sauvegarder une prescription → fermer l'onglet → rouvrir l'app → login → la prescription est là.

- [ ] **Step 18.10 : Logout puis login**

Logout → overlay réapparaît → login → données rechargées correctement.

---

### Task 19: Nettoyage post-tests

**Files:** aucun.

- [ ] **Step 19.1 : Supprimer les données test**

Dans Firestore :
- Delete `prescriptions/test_pres_1`
- Delete `tenants/lab_test`
- Delete `users/{uid_test}` (le profil Firestore)

Dans Firebase Auth :
- Delete user `test@ilovesmile.app`

- [ ] **Step 19.2 : Mettre à jour le spec avec l'état final**

Dans `docs/superpowers/specs/2026-04-18-saas-multi-tenant-roadmap-design.md`, section "État d'avancement", cocher toutes les étapes Phase 0.

- [ ] **Step 19.3 : Commit final**

```bash
git add docs/
git commit -m "Phase 0 terminee : fondations multi-tenant en place"
```

- [ ] **Step 19.4 : Tag la release**

```bash
git tag -a phase-0-complete -m "Phase 0 : Fondations multi-tenant"
git push origin main
git push origin phase-0-complete
```

**Critère de sortie Phase 0 complète** :
- ✅ L'app répond sur `ilovesmile.ilovesmile.app`
- ✅ Login obligatoire pour accéder à l'app
- ✅ Tous les docs Firestore ont `tenant_id`
- ✅ Les rules refusent toute requête non-scopée
- ✅ Un user d'un tenant ne voit/accède jamais les données d'un autre
- ✅ Les 10 scénarios métier critiques fonctionnent
- ✅ Backup Firestore automatisable (script en place)
- ✅ Cloudflare Pages déploie automatiquement sur push main

---

## Points d'attention transverses

### Backups obligatoires

Avant **chaque** étape risquée (Task 6, Task 8, Task 14.7), exécuter :
```bash
node scripts/backup-firestore.mjs
```

### Feature flag d'urgence

Si à n'importe quel moment Phase 0 casse la prod, procédure de rollback :
1. Reverter le DNS de `ilovesmile.ilovesmile.app` pour pointer vers l'ancien GitHub Pages
2. Restaurer le backup Firestore le plus récent si des données ont été corrompues
3. Debug à froid

Pour faciliter, **garder GitHub Pages actif** tout au long de Phase 0.

### Coûts attendus (Phase 0)

- Cloudflare Pages : gratuit
- Firebase Auth : gratuit (< 50k users/mois)
- Firestore : gratuit (< 50k lectures/jour, 20k écritures/jour au plan Spark)
- Firebase Functions : **nécessite plan Blaze (pay-as-you-go)** — coût estimé ~0€/mois à ce volume, mais carte bleue requise

### Décisions reportées à Phase 1+

- Admin UI pour gérer les tenants (pour Phase 0, création manuelle via console Firebase)
- Import CSV des clients
- Facturation automatisée
- Migration des données hardcodées `COGILOG_CLIENTS` vers Firestore par tenant

---

## Self-review

### Spec coverage check

| Élément spec stratégique | Couvert par task(s) |
|--------------------------|---------------------|
| Migration Cloudflare Pages | Task 2, 3, 4 |
| Champ tenant_id sur tous docs | Task 5, 6, 7, 8 |
| Firebase Auth + customClaims | Task 9, 10, 11, 12, 13 |
| Règles Firestore strictes | Task 14 |
| Détection tenant sous-domaine | Task 15 |
| Tests de non-régression | Task 16, 17, 18 |
| Backups obligatoires avant migration | Task 1, 6.3 |
| Rôles super_admin / admin_labo / user_labo | Task 13 (Cloud Function accepte les 3 rôles) |

Toutes les étapes de la Phase 0 du spec sont couvertes.

### Placeholder check

- Aucun "TBD" / "TODO" / "implement later" / "similar to Task N" dans les steps.
- Tous les steps qui demandent du code montrent le code complet.
- Tous les commandes sont exactes (pas de `[remplacer par ...]` sauf les UIDs qui dépendent de la session).

### Type consistency

- `TENANT_ID` utilisé partout (pas de variantes `tenantId` mélangées côté client).
- `tenant_id` (snake_case) utilisé partout côté données (cohérent avec le style Firestore existant).
- `detectTenantFromHostname` nommage cohérent entre implémentation et tests.
- `withTenant` et `tenantQuery` : noms cohérents dans `js/tenant.js` et utilisation dans `firebase-init.js`.

Plan validé.
