# Plan Chine — Portail fournisseur (à faire plus tard)

> Plan détaillé pour créer un portail web dédié aux fournisseurs chinois
> (Merdental, HUILE) leur permettant de consulter et valider les commandes
> sans passer par Digilab / Firebase (bloqués en Chine). Statut : **à
> implémenter quand on décidera de s'y attaquer**. Estimé : ~1 semaine de
> dev. Pré-requis bloquant : vérifier l'accès Chine réel avant de coder.

---

## Contexte

**Workflow actuel** (manuel, papier-intensif) :
1. Labo envoie PDF anglais + scans via WeTransfer au fournisseur chinois
2. Fournisseur envoie le lendemain la liste des codes qu'il va livrer
3. Labo sort les fiches originales, trie par cabinet, déballe les colis
4. Annote au stylo sur le PDF anglais ce qui a vraiment été fait (ex: « CCM x2 » au lieu de « CCM »)
5. Quelqu'un recopie manuellement ces annotations dans Cogilog

**Problèmes** :
- Pas de visibilité live sur l'avancement côté fournisseur
- Saisie manuelle Cogilog = source d'erreurs
- Logistique papier lourde
- Fournisseur en Chine → impossibilité d'accéder à l'app actuelle (Firebase bloqué)

**Solution** : portail web dédié pour le fournisseur, accessible en Chine (via Cloudflare Worker qui fait le pont vers Firebase), permettant :
- Authentification par identifiant + mot de passe (pas de token en URL)
- Voir ses commandes avec statuts
- Valider réception → produire → expédier (+ statuts annexes : retardé, problème, en attente)
- Éditer les quantités réellement livrées (ex: CCM x2) → remontée **auto** dans Cogilog à l'export
- Télécharger PDF + scans directement depuis le portail (plus de WeTransfer)

**Le QR code existant sur le PDF anglais N'EST PAS touché** — il continue à pointer vers la photo Cloudinary de la fiche originale comme aujourd'hui.

### Outcome attendu

- **Fournisseur** : ouvre l'URL du portail, se connecte avec identifiant/mot de passe, voit la liste de ses commandes, édite les statuts et quantités.
- **Labo** : dashboard temps réel des statuts fournisseur, plus de saisie Cogilog manuelle, workflow papier réduit.
- **Accessible en Chine sans VPN** : page statique Cloudflare Pages + Worker qui proxifie toutes les données. Aucun SDK Firebase côté fournisseur, aucune police Google. ⚠️ À valider en conditions réelles avant déploiement (cf. section « Vérification accès Chine »).

---

## Architecture

```
[Fournisseur Chine]
       │ ouvre https://ilovesmile-labo.pages.dev/supplier/
       │ → écran login (username + password)
       │ → POST /v1/supplier/login → reçoit session_token
       │ → session_token stocké en localStorage, valide 30 jours
       ▼
[Cloudflare Pages /supplier/]
   Page statique HTML + JS vanilla, polices système,
   pas de Firebase SDK, pas de Google Fonts
       │ fetch REST avec Authorization: Bearer session_token
       ▼
[Cloudflare Worker — digilab-webhook]
   Nouveaux endpoints /v1/supplier/*
   Auth :
     - POST /supplier/login { username, password } → génère session_token
     - Autres endpoints : vérifient Authorization header → session_token valide
   Proxy vers Firestore (read + write scoped au fournisseur du token)
   Proxy vers Digilab API (scans)
       │
       ▼
[Firebase Firestore]
   - meta/suppliers : { MERDENTAL: {username, password_hash, salt, email, ...}, HUILE: {...} }
   - meta/supplier_sessions : { session_token: { supplier: 'MERDENTAL', expires_at } }
   - prescriptions/ : + champs statut_fournisseur, items_livres, supplier_log
```

---

## Phase 1 — Modèle Firestore étendu

### A. Collection `meta/suppliers` (nouvelle)

```json
{
  "tenant_id": "lab_ilovesmile",
  "suppliers": {
    "MERDENTAL": {
      "nom": "Merdental Co., Ltd.",
      "email": "kerry@merdental.com",
      "username": "merdental",
      "password_hash": "sha256_base64_...",
      "salt": "random_32_chars",
      "locale": "en",
      "createdAt": 1713800000000
    },
    "HUILE": {
      "nom": "HUILE / Microunion",
      "email": "customerdata@microunion.com",
      "username": "huile",
      "password_hash": "...",
      "salt": "...",
      "locale": "en"
    }
  }
}
```

Le hash est calculé côté worker via Web Crypto SubtleCrypto (SHA-256 sur `salt + password`, encodé base64). Les identifiants sont créés une fois via le script console (Phase 6) et communiqués aux fournisseurs hors ligne (par mail séparé).

### B. Collection `meta/supplier_sessions` (nouvelle, session auth)

```json
{
  "tenant_id": "lab_ilovesmile",
  "sessions": {
    "sess_a1b2c3d4...": {
      "supplier": "MERDENTAL",
      "created_at": 1713800000000,
      "expires_at": 1716392000000,
      "last_used_at": 1713810000000
    }
  }
}
```

TTL 30 jours. Le session_token est un UUID aléatoire (32 chars hex). Purgé au login suivant si expiré (nettoyage passif, pas de job).

### C. Nouveaux champs sur chaque document `prescriptions/{id}`

```js
// Statut fournisseur (distinct du statut labo existant 'attente' | 'verifie' | 'importe')
statut_fournisseur: 'envoye' | 'recu' | 'en_production' | 'expedie'
                  | 'retarde' | 'probleme' | 'en_attente_reponse',

// Quantités livrées par acte (écrase celles de la demande à l'export Cogilog si présent)
items_livres: {
  'CCM': 2,
  'Inlay Core clavette': 1,
  // ...
},

// Annotations libres du fournisseur (commentaire, problème signalé)
note_fournisseur: string,

// Date d'expédition saisie par le fournisseur
date_expedition: 'YYYY-MM-DD',

// Log des changements de statut (pour traçabilité)
supplier_log: [
  { date: '2026-04-23T10:00:00Z', by: 'MERDENTAL', action: 'recu' },
  { date: '2026-04-24T15:30:00Z', by: 'MERDENTAL', action: 'expedie', note: 'sent by DHL' }
]
```

Aucune migration pour les anciennes prescriptions : les champs sont ajoutés à la volée quand le fournisseur valide. Par défaut `statut_fournisseur = 'envoye'` implicite.

---

## Phase 2 — Worker Cloudflare (nouveaux endpoints)

**Fichier** : `workers/digilab-webhook/worker.js`

Nouveaux handlers sous `/v1/supplier/*`, **auth en 2 étapes** :
1. Login avec username/password → retourne session_token
2. Autres endpoints : header `Authorization: Bearer session_token`

```
POST   /v1/supplier/login                       body: { username, password }
                                                → { session_token, supplier_name, expires_at }
                                                → 401 si invalide
POST   /v1/supplier/logout                      header Auth → supprime la session
GET    /v1/supplier/orders                      header Auth → liste prescriptions du fournisseur
                                                    (filtre: fournisseur match, tri par date)
GET    /v1/supplier/orders/:id                  header Auth → détail d'une commande
GET    /v1/supplier/orders/:id/files            header Auth → URLs signées Digilab (si _digilabCaseId)
POST   /v1/supplier/orders/:id/status           header Auth body: { status, note } → update + log
POST   /v1/supplier/orders/:id/items            header Auth body: { items_livres: {acte: qty} } → update
```

**Helper auth interne** `resolveSession(request, env)` :
1. Lit `Authorization: Bearer xxx`
2. `firestoreGet(meta/supplier_sessions)` → cherche session
3. Si expirée ou absente → retourne null (401 côté appelant)
4. Sinon retourne `{ supplier_name: 'MERDENTAL', ... }` + update `last_used_at`

**Helper hash** `hashPassword(password, salt)` :
```js
async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
```

Chaque endpoint sauf login :
1. `resolveSession()` → 401 si invalide
2. Toute requête sur `orders/:id` vérifie que `prescription.fournisseur === session.supplier_name` (isolation).
3. Retourne 403 si commande d'un autre fournisseur, 404 si inconnue.

**Rate limiting basique du login** : max 5 tentatives/minute par IP (utilise `request.headers.get('CF-Connecting-IP')`). Compteur mémoire (ou Cloudflare KV si on veut persister).

**Réutilise** :
- `proxyDigilabFile` existant pour streamer les scans
- `firestoreGet`, `firestoreList`, `firestoreSet` existants (ajouter `firestoreUpdate` avec `updateMask`)

---

## Phase 3 — Page portail fournisseur

**Fichier nouveau** : `supplier/index.html` (à la racine du repo, servi par Cloudflare Pages comme sous-chemin)

Structure :
```
supplier/
├── index.html          — page unique, 2 vues (liste + détail) gérées via JS
├── app.js              — logique fetch, render, actions
├── styles.css          — polices système + palette simple
└── fonts/              — vide pour l'instant (polices système suffisent)
```

### Vue liste
- Table : *Date · Patient · Lab code · Cabinet · Status* (avec couleurs)
- Filtres rapides en haut : chips [All · Received · In production · Shipped · Issues]
- Badge nombre de nouvelles commandes
- Click → vue détail

### Vue détail
- Bandeau patient + code labo + cabinet
- **Actes demandés** (tableau depuis `conjointe` / `adjointe` / `dentsActes`) avec colonne éditable « Quantity delivered » pré-remplie avec la qty demandée
- **Zone commentaire** libre (`note_fournisseur`)
- **Sélecteur de statut** (boutons : Received / In production / Shipped / Delayed / Issue / Waiting for reply)
- **Bouton Download ZIP** → appelle `/v1/supplier/orders/:id/files` puis proxy-file pour chaque → JSZip côté client → PDF prescription anglais + tous les scans dans 1 ZIP
- **Historique** (`supplier_log`) en bas

### Génération du PDF anglais côté portail
Le PDF anglais n'est pas stocké — il est regénéré au clic. Pour ça, je copie `js/export-pdf-en.js` + deps minimales (`js/data/system-prompt.js` non requis, mais `jsPDF` + `qrcode-generator` sont chargés via CDN cdnjs/jsdelivr qui passent en Chine). La page portail embarque uniquement les deps nécessaires.

### Accessibilité Chine
- Polices **système uniquement** : `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;`
- Pas de `<link href="fonts.googleapis.com">`
- CDN à vérifier (voir section « Vérification accès Chine »)
- URL forme : `https://ilovesmile-labo.pages.dev/supplier/`
  - Si pas connecté → écran login
  - Si session valide en localStorage → vue liste directement
  - Vue détail : navigation client-side via hash route `#/order/:id`

---

## Phase 4 — Export Cogilog : utiliser `items_livres` si présent

**Fichier** : `js/export-cogilog.js`

Dans `buildLigneProd(codeProd, libelle, qty)` (ligne ~466), avant le calcul de qty par dents/appareil :

```js
// Si le fournisseur a renseigné une quantité livrée → prioritaire
if (p.items_livres && p.items_livres[libelle] != null) {
  qty = parseInt(p.items_livres[libelle]) || qty;
}
```

Placer ça tout en haut de la fonction, **avant** le fallback `dentsActes`. Si `items_livres` vide → comportement actuel inchangé.

---

## Phase 5 — Dashboard labo : visualisation des statuts

**Fichier** : `js/prescription-list.js`

Ajouter une colonne / badge « Supplier status » dans la liste des prescriptions :
- 🟢 Shipped / ⚪ Received / 🟠 In production / 🔴 Issue / ⏳ Delayed / ❓ Waiting
- Affichage condensé en icône avec tooltip
- Filtre rapide « Show only: Shipped / Issues »

Firestore `onSnapshot` déjà actif sur `prescriptions/` (cf. `firebase-init.js:157`) → les changements du fournisseur apparaissent automatiquement sans action user.

Toast notification au premier chargement pour les cas `probleme` ou `retarde` non encore vus (anti-spam via flag `_supplier_notified` en localStorage).

---

## Phase 6 — Admin : créer les identifiants fournisseurs

Script console à fournir à l'utilisateur (one-shot) pour créer les 2 comptes initiaux :

```js
await (async () => {
  const db = window.getDB();
  const enc = new TextEncoder();
  const mkSalt = () => Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const hashPw = async (password, salt) => {
    const h = await crypto.subtle.digest('SHA-256', enc.encode(salt + password));
    return btoa(String.fromCharCode(...new Uint8Array(h)));
  };

  // Choisir les mots de passe à l'avance (ou saisie via prompt)
  const pwMerdental = prompt('Password pour MERDENTAL ?');
  const pwHuile     = prompt('Password pour HUILE ?');

  const saltM = mkSalt(), saltH = mkSalt();
  const suppliers = {
    MERDENTAL: {
      nom: 'Merdental Co., Ltd.',
      email: 'kerry@merdental.com',
      username: 'merdental',
      password_hash: await hashPw(pwMerdental, saltM),
      salt: saltM,
      locale: 'en',
      createdAt: Date.now()
    },
    HUILE: {
      nom: 'HUILE / Microunion',
      email: 'customerdata@microunion.com',
      username: 'huile',
      password_hash: await hashPw(pwHuile, saltH),
      salt: saltH,
      locale: 'en',
      createdAt: Date.now()
    }
  };
  await db.collection('meta').doc('suppliers').set(window.withTenant({ suppliers }));
  console.log('Fournisseurs créés. Communique username + password par canal séparé (WeChat, mail perso, etc.)');
})()
```

Les mots de passe ne sont jamais stockés en clair. L'utilisateur doit les noter au moment de leur saisie pour les communiquer ensuite.

Pour la réinitialisation d'un mot de passe oublié : script similaire avec seulement un fournisseur. Une future UI admin dans Paramètres pourra remplacer ce script.

---

## ⚠️ Vérification accès Chine (CRITIQUE — à faire AVANT dev portail)

On avait faussement supposé que Dropbox marchait en Chine. Pour éviter le même piège avec Cloudflare Pages / Workers / CDN, on **vérifie en conditions réelles** avant d'investir ~1 semaine de dev qui pourrait s'avérer inutile.

### Méthode recommandée (zéro coût, 10 min)

1. **Demander au fournisseur de tester depuis son poste** (le plus fiable) :
   - `https://ilovesmile-labo.pages.dev/health.html` — page statique test (à créer)
   - `https://digilab-webhook.cohenillan29.workers.dev/health` (worker)
   - `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js` (CDN lib)
   - `https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js` (CDN lib)
   - Pour chacun : chargement en < 5s, sans VPN, sans erreur

2. **Checker en ligne via un service de test Chine réel** :
   - https://www.websitepulse.com/tools/china-firewall-test (gratuit, teste depuis des nœuds en Chine)
   - https://en.greatfire.org/ (base de données des sites bloqués, historique)

3. **Tester individuellement chaque domaine** utilisé dans le portail :
   | Domaine | Usage | À vérifier |
   |---|---|---|
   | `*.pages.dev` | hébergement page portail | accessibilité + vitesse |
   | `*.workers.dev` | API backend | accessibilité + vitesse |
   | `cdnjs.cloudflare.com` | jsPDF, JSZip | accessibilité |
   | `cdn.jsdelivr.net` | qrcode-generator | accessibilité |
   | `storage.googleapis.com` | scans Digilab (URLs signées) | **risque élevé** — Google Cloud Storage souvent bloqué |

### Risque identifié : téléchargement des scans

Les scans Digilab sont stockés sur **Google Cloud Storage** (URLs signées `storage.googleapis.com`). Même si on les proxifie via le worker, **le worker lui-même télécharge depuis Google Cloud Storage** — mais ça se passe côté serveur (pas bloqué). Par contre si l'URL renvoyée au client pointe directement vers Google, ça ne marchera pas en Chine.

**Stratégie** : toujours passer par `/v1/digilab/proxy-file` (POST avec URL en body) pour que le client ne contacte que le worker. Déjà en place dans le code actuel ✅.

### Plan B si Cloudflare Pages est lent/bloqué

- **Alibaba Cloud Web Hosting (OSS + CDN)** : serveur en Chine, nécessite un ICP (licence) ou utilisation sans nom de domaine personnalisé
- **Self-host sur VPS Hong Kong** : passe mieux qu'un server mainland pour des sites étrangers
- **Fallback : envoyer les URL par mail** et garder workflow WeTransfer actuel jusqu'à trouver solution

### Décision proposée

**Avant de coder**, créer juste `supplier/health.html` (page statique de 10 lignes) et la déployer. Demander au fournisseur de l'ouvrir sans VPN. Si OK → on code. Si KO → on repart en plan B. Coût du test : 5 min.

---

## Fichiers modifiés / créés — récap

| Fichier | Action | ~lignes |
|---|---|---|
| `workers/digilab-webhook/worker.js` | + handlers `/v1/supplier/*` + helper auth session | +180 |
| `supplier/health.html` | Nouveau (test accessibilité Chine avant dev) | ~30 |
| `supplier/index.html` | Nouveau (login + vue liste + vue détail) | ~150 |
| `supplier/app.js` | Nouveau (auth, fetch, render, actions) | ~450 |
| `supplier/styles.css` | Nouveau (polices système) | ~150 |
| `supplier/export-pdf-en-min.js` | Copie allégée de `js/export-pdf-en.js` (pour regen PDF) | ~600 |
| `js/export-cogilog.js` | Priorité `items_livres` sur qty demande | ~5 lignes |
| `js/prescription-list.js` | Badge statut fournisseur + filtre | ~40 |
| `js/firebase-init.js` | (aucun changement — pas besoin de charger suppliers côté labo) | 0 |

**Non modifié** : `js/export-pdf-en.js` (QR code reste inchangé).

---

## Ordre d'exécution

0. **Vérif Chine** (bloquant) : créer `supplier/health.html`, déployer, faire tester au fournisseur. Si KO → stop et plan B.
1. **Phase 1** (Firestore) : structures `meta/suppliers` et `meta/supplier_sessions` (pas de doc créé, ils seront créés à la volée)
2. **Phase 6** (Admin comptes) : script console pour créer les 2 comptes fournisseur avec mots de passe. Noter les credentials.
3. **Phase 2** (Worker) : ajouter les endpoints `/v1/supplier/*` + helper auth session. Déployer. Tester avec curl + login.
4. **Phase 3** (Portail) : page `supplier/index.html` + `app.js` + `styles.css` + `export-pdf-en-min.js`. Tester localement, puis push (Pages redéploie).
5. **Phase 4** (Cogilog) : modifier `buildLigneProd` pour prioriser `items_livres`. Tester avec une prescription ayant `items_livres` simulé.
6. **Phase 5** (Dashboard labo) : badges statut fournisseur + filtre dans la liste des prescriptions.
7. **Test E2E** avec Merdental en conditions réelles sur 2-3 commandes avant rollout complet.

---

## Vérification end-to-end

1. **Accès Chine** : le fournisseur ouvre `supplier/health.html` sans VPN → vert.
2. Lance le script console → crée les 2 comptes avec mots de passe choisis.
3. Communique username + password à ton contact Merdental **par canal séparé** (WeChat, mail perso, pas email pro).
4. Il ouvre `https://ilovesmile-labo.pages.dev/supplier/` → écran login → se connecte.
5. Il voit la liste de ses commandes récentes (`fournisseur === 'MERDENTAL'`). Clique l'une d'elles.
6. Il coche « Received ». Côté labo, le badge passe au blanc dans la liste des prescriptions (sans refresh, grâce à `onSnapshot`).
7. Plus tard, il saisit « CCM : 2 » dans Quantity delivered et passe en « Shipped » avec note « DHL tracking XYZ ».
8. Côté labo, tu exportes Cogilog → la ligne CCM sort avec qty 2 (au lieu de la qty déduite des dents).
9. Vérifie que le téléchargement ZIP depuis le portail fonctionne (PDF anglais régénéré + scans Digilab via proxy worker).
10. Ferme le navigateur → ouvre à nouveau le portail → il est toujours connecté (session_token valide 30j).
11. Attends 30+ jours ou modifie manuellement `expires_at` → recharge → il est redirigé vers l'écran login (session expirée).

---

## Sécurité

- **Auth login/password** : chaque fournisseur a un username + mot de passe (pas partageable comme un token URL). Mot de passe stocké hashé (SHA-256 + salt) dans Firestore.
- **Session token** : généré au login, valide 30 jours, stocké en localStorage côté fournisseur. Révocable via delete du doc `meta/supplier_sessions`.
- **Rate limit login** : 5 tentatives/minute/IP côté worker pour éviter brute-force.
- **Isolation par fournisseur** : chaque endpoint vérifie `prescription.fournisseur === session.supplier_name`.
- **Pas d'écriture libre** : le fournisseur ne peut modifier QUE `statut_fournisseur`, `items_livres`, `note_fournisseur`, `date_expedition`, `supplier_log` (append only). Jamais les autres champs (patient, cabinet, etc.).
- **HTTPS only** : Cloudflare Pages et Workers forcent HTTPS par défaut.
- **Pas d'infos ultra-sensibles** : pas de DMP, juste actes dentaires + noms patients (acceptable risk).

---

## Hors scope MVP (pour plus tard)

- UI admin dans Paramètres pour créer/régénérer les comptes fournisseurs (plutôt que script console)
- Notifications email / WeChat au fournisseur quand nouvelle commande
- Multi-tenant (autres labos) — l'archi le supportera naturellement via `tenant_id`
- Mode hors-ligne (PWA)
- Traduction chinoise des libellés (la page reste en anglais pour le MVP)
