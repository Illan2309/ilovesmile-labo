# Journal d'exécution — Phase 0

**Date** : 2026-04-18
**Durée effective** : ~4h (15h22 → 17h59)
**Participants** : Illan Cohen + Claude (Opus 4.7)
**Branche de travail** : `phase-0` → mergée dans `main`
**Release tag** : `phase-0-complete`
**Résultat** : ✅ Phase 0 essentiellement terminée, app multi-tenant fonctionnelle en prod

---

## 🎯 Comment utiliser ce document

**Pour reprendre dans une future conversation** :
1. Lis ce journal en entier (tu as une vision complète de ce qui a été fait)
2. Consulte ensuite le spec stratégique : `docs/superpowers/specs/2026-04-18-saas-multi-tenant-roadmap-design.md`
3. Et le plan Phase 0 (exécuté ici) : `docs/superpowers/plans/2026-04-18-phase-0-fondations-invisibles.md`
4. La Phase 1 n'a pas encore été brainstormée — c'est la prochaine étape

---

## 📋 Contexte initial (avant session)

**App** : Labo I Love Smile — gestion de prescriptions dentaires pour le labo de prothèses du propriétaire (Illan Cohen, Aix-en-Provence).

**Stack** :
- Vanilla JavaScript single-page, pas de framework, pas de bundler
- Firebase Firestore pour persistance
- Firebase Auth (email/password + Google, déjà activés)
- Cloudinary pour photos/PDFs
- Gemini via Cloudflare Worker pour l'IA
- **Hébergement** : GitHub Pages (monotenant, code public)

**Objectif business exprimé en début de session** :
> "Mon projet à pris de l'ampleur Et à terme le but va être de proposer ce projet à d'autre labo. Sauf que pour le moment le logiciel est ultra spécifique à mon laboratoire."

Transformation de l'app mono-tenant vers un SaaS multi-tenant white-label pour commercialiser à d'autres laboratoires de prothèses dentaires.

---

## 🧭 Décisions stratégiques prises (brainstorming → spec)

| Décision | Choix | Raison |
|----------|-------|--------|
| Approche | Évolution brownfield | Pas de réécriture. Solo dev 5-15h/sem. |
| Distribution | SaaS cloud centralisé | Comme Digilab, maintenance 1-to-many |
| Cible | 5-20 labos à 2-3 ans | Réaliste en solo |
| Isolation multi-tenant | Champ `tenant_id` sur chaque doc | Migration minimale, standard SaaS (Stripe, Notion, etc.) |
| URL | Sous-domaines (`labo-X.domaine.app`) | Professionnel, comme Digilab |
| Branding | Config Firestore + CSS variables dynamiques | L'app utilise déjà des CSS vars |
| Auth | Firebase Auth + profil Firestore `users/{uid}` | Firebase déjà en place |
| Protection code | Progressive (Phase 4), pas prioritaire | 80% de la valeur est dans le prompt IA et les données |
| Dentistes | Accès **gratuit** (invités par un labo) | Décision produit utilisateur |
| Nouveau labo | Base **vide** par défaut, saisie manuelle | Pas de seed partagé entre tenants |
| Nom du SaaS | **Pas encore décidé** (à trancher avant Phase 3) | User hésite entre LaboFlow, LaboForge, LabCraft, etc. |

**Docs créés pendant le brainstorming** :
- `docs/superpowers/specs/2026-04-18-saas-multi-tenant-roadmap-design.md` (spec stratégique, 6 phases, 8-12 mois)
- `docs/superpowers/plans/2026-04-18-phase-0-fondations-invisibles.md` (plan d'implémentation détaillé Phase 0, 19 tasks)
- Memory files dans `~/.claude/projects/.../memory/` pour reprise en future conv

---

## 🔨 Chronologie d'exécution Phase 0

### 15h22 — Spec stratégique écrit et committé (`f8c7408`)

Décomposition en 6 phases (0 à 5), Phase 0 détaillée au niveau étape.

### 15h29 — Plan d'implémentation Phase 0 écrit et committé (`dbdd39e`)

19 tasks décomposées en steps de 2-5 min chacun, code complet inline.

### 15h30 — Création branche `phase-0` pour isolation

`git checkout -b phase-0` — aucune prod touchée, safe pour expérimenter.

### 15h34 — Task 1 : Script backup Firestore (`6e97bfe`)

- `scripts/backup-firestore.mjs` créé (utilise `firebase-admin`)
- `.gitignore` créé (exclut `backups/`, `scripts/.service-account.json`, `node_modules/`)
- `firebase-admin` ajouté en devDependency

**Action utilisateur** : téléchargement du service account depuis Firebase console → sauvegardé dans `scripts/.service-account.json`.

**Piège rencontré** : Windows a ajouté `.json.json` à l'extension lors du renommage (extension cachée). Fix : `mv ".service-account.json.json" ".service-account.json"`.

### 15h36 — Task 7 : Module `js/tenant.js` (`292b86c`)

Module qui expose :
- `window.TENANT_ID = 'lab_ilovesmile'` (hardcodé Phase 0, sera dynamique Phase 2)
- `window.tenantQuery(query)` → ajoute `.where('tenant_id', '==', TENANT_ID)`
- `window.withTenant(data)` → injecte `tenant_id` dans les données

Include dans `index.html` ligne 29, avant tous les autres modules JS.

### ~16h30 — Backup Firestore exécuté

Lancé via `node scripts/backup-firestore.mjs` :
- 1512 prescriptions
- 3 contacts (dentistes, mapping, cogilog_clients_custom)
- 2 tarifs (cabinets, surcharges)
- 23 meta (23 docs divers)

**Total : 1540 documents sauvegardés** dans `backups/firestore-2026-04-18T14-48-52-157Z/`.

### ~16h40 — Tasks 2, 4, 5 (actions manuelles utilisateur)

**Task 2 — Cloudflare Pages** : création du projet via dashboard CF, connecté au repo GitHub `Illan2309/ilovesmile-labo`, branche `main`, framework preset "None".

**Piège** : Cloudflare a d'abord proposé le flow "Worker" (avec `npx wrangler deploy`) au lieu du flow "Pages". Résolu en revenant en arrière et cliquant "Looking to deploy Pages? Get started" en bas de l'écran.

**Résultat** : `ilovesmile-labo.pages.dev` opérationnel.

**Task 3 — Domaine custom** : **SKIPPÉE** (l'utilisateur n'a pas encore choisi le nom définitif du SaaS).

**Task 4 — Authorized Firebase domains** : ajout de `ilovesmile-labo.pages.dev` dans Firebase Auth → Settings → Authorized domains.

**Task 5 — Création du tenant `lab_ilovesmile`** dans Firestore (manuel via console) :
```
tenants/lab_ilovesmile {
  name: "I Love Smile",
  short_name: "ILS",
  subdomain: "ilovesmile",
  plan: "standard",
  actif: true,
  createdAt: [timestamp]
}
```

### 17h07 — Task 6 : Script migration `add-tenant-id` (`d248565`)

`scripts/migrate-add-tenant-id.mjs` — idempotent, utilise des batches Firestore (400 ops/batch) pour performance.

### ~17h15 — Exécution de la migration

Dry-run d'abord → OK. Puis migration réelle :
- prescriptions: 1512 écrits
- contacts: 3 écrits
- tarifs: 2 écrits
- meta: 23 écrits

**Total : 1540 docs migrés avec `tenant_id: "lab_ilovesmile"`**. Re-run du script confirme l'idempotence (0 à migrer, 1540 déjà ok).

### 17h25 — Task 8 : Scoper toutes les queries Firestore (`545bf87`)

**La task la plus risquée du plan.** Dispatchée via subagent Sonnet qui a :
- Cartographié 50+ points d'accès Firestore avec grep
- Modifié 8 fichiers :
  - `js/firebase-init.js` (~45 lignes)
  - `js/aliases-products.js` (~17 lignes)
  - `js/contacts-tariffs.js` (~43 lignes)
  - `js/ai-learning.js` (4 lignes)
  - `js/correction-log.js` (2 lignes)
  - `js/implants-module.js` (~36 lignes — IIFE 2334 lignes)
  - `js/parameters-modal.js` (~27 lignes)
  - `js/ui-helpers.js` (4 lignes)
- Total : 99 insertions, 79 suppressions

**Pattern appliqué** :
- Lectures docs à ID fixe : `if (doc.data().tenant_id === window.TENANT_ID) { ... }`
- Lectures avec `where` : via `window.tenantQuery()`
- Écritures `.set()` / `.add()` : via `window.withTenant()`
- Écritures `.update()` partielles : pas touchées (tenant_id déjà sur le doc)

**Concerns notés** :
- `digilab_orders` non scopée (créée par Worker externe, à traiter en Phase 2)
- `parameters-modal.js:400` : écriture legacy `prescriptions/data.set()` en mode batch (à revoir)

**Push phase-0 sur GitHub** → Cloudflare génère automatiquement une preview URL (`phase-0.ilovesmile-labo.pages.dev`) pour test.

### 17h30 — Test utilisateur sur preview

**Résultat** : ✅ "rien de cassé à signaler ça à l'air de bien tourner"

### 17h40 — Task 9 : Email/Password Auth

**Découverte en cours** : l'utilisateur avait déjà un écran login fonctionnel dans l'app (Google Auth + Email/Password déjà activés dans Firebase). Le plan initial ne l'avait pas prévu.

### 17h41 — Task 10 : Module `js/auth.js` (`2784534`)

**Premier dispatch subagent a commis une ERREUR** : il a **écrasé** l'ancien `auth.js` (qui contenait déjà `loginUser()`, `logoutUser()`, `onAuthStateChanged`) par un nouveau module incompatible.

**Correction immédiate** :
1. `git checkout b7b80d9^ -- js/auth.js` pour restaurer l'ancien
2. Ajout manuel de la vérification `tenant_id` dans le callback `onAuthStateChanged` existant
3. Ajout de `window._currentUser` et `window._currentUserProfile` exposés globalement
4. `git commit --amend` pour écraser le commit erroné

**Ce qui est ajouté** :
- Chargement du profil Firestore `users/{uid}` au login
- Si profil avec `tenant_id` différent → logout automatique
- Si profil avec `actif: false` → logout automatique
- Phase 0 transitoire : si pas de profil → autorisation avec warning (à durcir en Phase 0.4)

### ~17h42 — Création du profil utilisateur dans Firestore (manuel)

`users/{uid}` pour `contact@laboilovesmile.com` :
```
email: "contact@laboilovesmile.com"
nom: "Illan Cohen"
tenant_id: "lab_ilovesmile"
role: "super_admin"
actif: true
```

### 17h45 — Erreurs "Missing or insufficient permissions"

Après le login, erreurs Firestore permissions dans la console navigateur. Hypothèse : des rules existaient déjà mais ne prenaient pas en compte le nouveau champ `tenant_id`.

**Décision** : faire la Task 14 (firestore.rules) immédiatement au lieu d'attendre.

### 17h50 — Task 14 : firestore.rules multi-tenant (`4f200ac`)

Écriture et déploiement des rules. Architecture :
- **Pas de custom claims** (Phase 0 transitoire) — le `tenant_id` et le `role` sont lus depuis `users/{uid}` via `get()` dans les rules
- `isAuthedNoProfile()` : user connecté sans profil → autorisation temporaire (cas de transition où quelqu'un se connecte avant que son profil soit créé)
- 5 collections scopées : `prescriptions`, `contacts`, `tarifs`, `meta`, `tenants`, `users`
- 2 collections permissives (auth seulement) : `correction_logs`, `digilab_orders` (legacy, à durcir Phase 2)

**Fichier** : `firestore.rules` (versionné dans le repo).

**Action utilisateur** : copier-coller le contenu dans https://console.firebase.google.com/project/ilovesmile-labo-fd511/firestore/rules → Publier.

### 17h55 — Test final post-rules

**Résultat console** (copié par l'utilisateur) :
```
[tenant] TENANT_ID = lab_ilovesmile
[AUTH] Connecte : contact@laboilovesmile.com
✅ Firebase connecté
Contacts chargés depuis Firebase : 74 cabinets
Surcharges tarifaires chargées: 2 cabinets
Mapping contacts→tarifs chargé depuis Firebase
Clients custom chargés depuis Firebase : 193 client(s)
Métadonnées clients chargées : 122 statuts
🗂 Mapping Cogilog chargé depuis Firebase : 76 entrées
🏷️ Labels actes chargés depuis Firebase
🎛️ Préférences chargées depuis Firebase
📝 Règles personnalisées chargées : 7
🧠 Mémoire IA chargée depuis Firebase : 0 règle(s)
☁️ Alias cabinet chargés: 302
☁️ Alias produit chargés: 83
☁️ Alias contacts chargés: 112
☁️ Alias cabinet synchronisés
☁️ Alias product synchronisés
```

**Zéro erreur**. Multi-tenant opérationnel.

**Test de régression métier** confirmé par utilisateur : "c'est fonctionnel".

### 17h58 — Update du spec stratégique (`4ddaee4`)

Section "État d'avancement" mise à jour pour refléter ce qui est fait / skippé / reporté.

### 17h59 — Merge phase-0 → main + tag (`c9f6a56`)

```bash
git checkout main
git merge phase-0 --no-ff
git tag -a phase-0-complete
git push origin main --tags
```

Cloudflare Pages déploie automatiquement la nouvelle `main` en prod.

---

## 📦 Récap livrables Phase 0

### Commits (10)
| SHA | Message |
|-----|---------|
| `f8c7408` | Ajout spec strategique : roadmap SaaS multi-tenant |
| `dbdd39e` | Ajout plan d'implementation detaille Phase 0 |
| `6e97bfe` | Ajout script backup Firestore |
| `292b86c` | Ajout module tenant.js (TENANT_ID hardcode Phase 0) |
| `d248565` | Ajout script migration tenant_id (idempotent + batch writes) |
| `545bf87` | Scoper les queries Firestore par tenant_id |
| `2784534` | Ajout module auth.js (Firebase Auth + verification tenant_id) |
| `4f200ac` | Ajout firestore.rules Phase 0 |
| `4ddaee4` | Update spec strategique : etat d'avancement Phase 0 |
| `c9f6a56` | **Merge Phase 0 : Fondations multi-tenant** |

### Fichiers créés
- `scripts/backup-firestore.mjs`
- `scripts/migrate-add-tenant-id.mjs`
- `scripts/.service-account.json` (gitignored, sur la machine d'Illan uniquement)
- `js/tenant.js`
- `firestore.rules`
- `.gitignore`
- `docs/superpowers/specs/2026-04-18-saas-multi-tenant-roadmap-design.md`
- `docs/superpowers/plans/2026-04-18-phase-0-fondations-invisibles.md`
- `docs/journal/2026-04-18-phase-0-execution.md` (ce document)
- Memory : `~/.claude/projects/.../memory/{MEMORY,project_saas_roadmap,user_role,reference_project_docs}.md`

### Fichiers modifiés
- `js/auth.js` (vérification tenant_id ajoutée)
- `js/firebase-init.js` (queries scopées)
- `js/aliases-products.js`
- `js/contacts-tariffs.js`
- `js/ai-learning.js`
- `js/correction-log.js`
- `js/implants-module.js`
- `js/parameters-modal.js`
- `js/ui-helpers.js`
- `index.html` (include tenant.js + auth.js)
- `package.json`, `package-lock.json`

### Firestore (état actuel)
- Toutes collections existantes : `tenant_id: "lab_ilovesmile"` sur chaque doc (1540 docs taggués)
- Nouvelle collection `tenants/lab_ilovesmile` (métadonnées tenant)
- Nouvelle collection `users/{uid_illan}` (profil super_admin)
- Rules déployées : filtrage strict par tenant_id via `users/{uid}.tenant_id`

### Services externes configurés
- **Cloudflare Pages** : projet `ilovesmile-labo` connecté au repo, déploiement auto sur push main
- **Firebase Auth** : Email/Password + Google activés (Google non utilisé dans le code)
- **Firebase Firestore** : rules multi-tenant déployées

---

## ⚠️ Points d'attention pour reprise de travail

### 1. Ce qui a été skippé / reporté

- **Task 3** (domaine custom) — attend décision du nom (LaboFlow, LaboForge, LabCraft... à choisir)
- **Task 11, 12** — SKIPPÉES car UI login déjà existante avant Phase 0
- **Task 13** (Cloud Functions `setTenantClaims` + customClaims) — **reporté**. Les rules fonctionnent via `get(users/{uid}).tenant_id` au lieu de `request.auth.token.tenant_id`. C'est une optimisation perf (moins de lectures dans les rules) à faire plus tard si nécessaire. **Nécessite plan Firebase Blaze** (carte bleue).
- **Task 15** (détection sous-domaine) — **reporté en Phase 2**, utile seulement quand on aura un 2e tenant
- **Tasks 16-18** (test d'isolation strict) — **reporté en Phase 2**, sera plus significatif avec un vrai 2e tenant

### 2. Pièges rencontrés à retenir

- **Windows cache les extensions de fichier par défaut** → renommer en `.service-account.json` donne `.service-account.json.json`. Penser à activer l'affichage des extensions ou vérifier avec `ls`.
- **Cloudflare UI a changé** : le flow "Workers & Pages > Create > Continue with GitHub" lance par défaut un flow Worker et pas Pages. Il faut cliquer "Looking to deploy Pages? Get started" en bas de l'écran pour avoir le bon flow.
- **Subagents peuvent écraser du code existant** : le subagent Task 10 a écrasé `auth.js` existant sans le lire d'abord. **Leçon** : dans les prompts d'implementer subagents, toujours préciser de **lire d'abord** les fichiers existants et de les ADAPTER, pas de les remplacer.
- **L'app avait déjà un écran login** malgré ce que disait `Architecture.md` ("Pas d'authentification — Firebase ouvert"). **Leçon** : l'architecture doc peut être périmée, vérifier en lisant le code avant de planifier.

### 3. Idées notées pour plus tard

- **Mode "labo démonstration"** (Phase 2) : créer un tenant `lab_demo` pré-rempli avec des données fictives crédibles, pour démos commerciales. Demande de l'utilisateur.
- **Import CSV/Excel** pour accélérer l'onboarding des nouveaux labos (Phase 1 enrichissement).
- **Migration HDS** (Hébergement de Données de Santé) — statut flou, l'utilisateur considère qu'il est artisan (pas pro de santé), mais avocat à consulter avant 1er contrat signé.

---

## 🎯 Prochaine étape

**Phase 1 : Migration des données hardcodées vers Firestore par tenant.**

**Constantes JS à migrer** (actuellement dans `js/data/`) :
- `COGILOG_CLIENTS` (~150 clients) — dans `js/data/cogilog-clients.js`
- `TARIFS_BASE` (~60 grilles) — dans `js/data/tarifs-base.js`
- `CONTACTS_DENTISTES` (~60 cabinets) — dans `js/data/contacts-dentistes.js`
- `COGILOG_LIBELLES` (~150 codes produits) — dans `js/data/cogilog-libelles.js`
- `MAPPING_CONTACTS_TARIFS`, `MAPPING_CODE_TARIFS` — dans `js/data/mapping-contacts.js`

**Objectif** : pour chaque tenant, ces données sont stockées dans Firestore sous `tenants/{tenant_id}/clients`, `tenants/{tenant_id}/tarifs_base`, etc. (OU collection globale avec `tenant_id`, à décider au brainstorming).

**Estimation** : 20-30h de travail effectif → 2-4 semaines calendaires à 10h/sem.

**Pour démarrer Phase 1 dans une future conv** :
1. Dire : *"on attaque la Phase 1 du projet SaaS"*
2. Claude lira automatiquement les memory files et ce journal
3. Invoquer `superpowers:brainstorming` pour cadrer Phase 1
4. Puis `superpowers:writing-plans` pour le plan d'implémentation
5. Puis exécution (idéalement subagent-driven comme Phase 0)

---

## 🙌 Notes personnelles

Phase 0 estimée 2-3 mois dans le plan, faite en **~4h de session intensive**. Raisons du gain de temps :
- L'app était bien modularisée (30 fichiers JS)
- L'app utilisait déjà des CSS variables (préparé pour le branding Phase 2)
- L'app avait déjà Firebase Auth activé et un écran login (préparé pour Phase 0.3)
- Subagents très efficaces pour les tasks mécaniques (scope queries sur 8 fichiers en 10 min)
- Utilisateur réactif et disponible pour les actions manuelles
- Architecture réfléchie en amont (spec stratégique → plan → exécution)

Bon projet. Ready pour Phase 1.
