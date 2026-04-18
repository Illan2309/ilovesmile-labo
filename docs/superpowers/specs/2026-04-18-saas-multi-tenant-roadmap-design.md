# Design — Transformation SaaS multi-tenant de Labo I Love Smile

**Date** : 2026-04-18
**Auteur** : Illan Cohen (avec assistance Claude)
**Statut** : Approuvé (en attente relecture utilisateur)
**Type** : Roadmap stratégique multi-phases

---

## 📖 Comment reprendre ce travail dans une nouvelle conversation

Ce document est le **point d'entrée canonique** pour toute conversation future concernant la transformation SaaS de l'app.

**Pour reprendre le travail** :
1. Lire ce document en entier (vision + phases + décisions)
2. Consulter l'état d'avancement à la section "Historique et avancement" en bas
3. Consulter les specs détaillées de phase dans `docs/superpowers/specs/` au fur et à mesure qu'elles sont créées (Phase 0, 1, 2...)
4. Ce document est volontairement haut-niveau : les détails techniques de chaque phase sont dans les specs dédiés par phase

---

## 1. Vision

Transformer l'application actuelle **Labo I Love Smile** (mono-tenant, usage interne) en **plateforme SaaS multi-tenant white-label** destinée à d'autres laboratoires de prothèses dentaires, puis à terme aux dentistes.

### Objectifs business

- **Court terme** (6-12 mois) : onboarder 1-2 labos pilotes en plus de I Love Smile
- **Moyen terme** (2-3 ans) : 5-20 labos actifs payants
- **Long terme** (3+ ans) : ajouter une interface dentiste (gratuite) pour renforcer l'écosystème

### Contraintes fondamentales

| Contrainte | Valeur |
|------------|--------|
| Équipe | Solo (1 dev) |
| Temps disponible | 5-15h/semaine |
| Approche | Évolution brownfield — **pas de réécriture** |
| Urgence | Pas pressé, privilégier la qualité |
| Maintien de l'app actuelle | I Love Smile doit rester 100% fonctionnel à toutes les étapes |

---

## 2. Architecture cible (end-state)

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│  labo-dupont.ilovesmile.app        ilovesmile.ilovesmile.app    │
│         (Labo Dupont)                  (Labo I Love Smile)       │
└────────────────────┬────────────────────────────┬────────────────┘
                     │                            │
                     └────────────┬───────────────┘
                                  ▼
              ┌──────────────────────────────────┐
              │   Cloudflare Pages (hosting)     │
              │   Même code, branding dynamique  │
              └────────────┬─────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌──────────────┐ ┌────────────┐ ┌────────────────────┐
   │  Firebase    │ │ Cloudflare │ │   Cloudinary        │
   │  Auth +      │ │  Workers   │ │  (photos, PDFs)     │
   │  Firestore   │ │ (proxy IA, │ │                     │
   │              │ │  export,   │ │                     │
   │              │ │  logique   │ │                     │
   │              │ │  sensible) │ │                     │
   └──────────────┘ └────────────┘ └────────────────────┘
```

### Stack finale

| Composant | Technologie | Évolution vs actuel |
|-----------|-------------|---------------------|
| Hosting | Cloudflare Pages | Migration depuis GitHub Pages |
| Frontend | Vanilla JS (actuel) | Inchangé |
| Auth | Firebase Auth | **Nouveau** |
| DB | Firestore (actuel) | + champ `tenant_id` sur tous docs |
| Storage | Cloudinary (actuel) | Inchangé, namespace par tenant |
| IA | Gemini via CF Worker | Inchangé |
| Logique sensible (Phase 4+) | Cloudflare Workers | **Nouveau** — prompt IA, logique export Cogilog |

---

## 3. Décisions d'architecture

### 3.1 — Isolation multi-tenant : Option `tenant_id`

**Décision** : Ajouter un champ `tenant_id` sur chaque document Firestore. Pas de sous-collections, pas de bases séparées.

```javascript
prescriptions/
  {id} { tenant_id: "lab_ilovesmile", numero: 31460, ... }
  {id} { tenant_id: "lab_dupont", numero: 218, ... }

tenants/
  lab_ilovesmile { name: "I Love Smile", branding: {...}, ... }
  lab_dupont { name: "Labo Dupont", branding: {...}, ... }
```

**Raisons** :
- Migration minimale du code existant (ajout d'un filtre `where('tenant_id', '==', ...)`)
- C'est ce que font 90% des SaaS B2B (Stripe, Intercom, Notion, probablement Digilab)
- Compatible avec les custom claims Firebase
- Suffisant pour 5-20 tenants

**Alternative rejetée** : sous-collections `tenants/{id}/prescriptions/*` — aurait nécessité de refactorer tout le code existant.

### 3.2 — Structure URL : sous-domaines

**Décision** : Chaque labo a un sous-domaine dédié.

```
ilovesmile.ilovesmile.app    → tenant lab_ilovesmile
labo-dupont.ilovesmile.app   → tenant lab_dupont
```

**Raisons** :
- Standard SaaS professionnel (Slack, Notion, Digilab)
- Login page personnalisée dès l'URL (branding)
- Wildcard DNS supporté nativement par Cloudflare Pages

**Migration nécessaire** : GitHub Pages → Cloudflare Pages (wildcard DNS non supporté par GH Pages). Migration triviale, 1 weekend.

### 3.3 — Branding dynamique

**Décision** : Config branding stockée par tenant dans Firestore, injectée au chargement via CSS variables.

```javascript
tenants/lab_dupont {
  name: "Labo Dupont Frères",
  short_name: "Dupont",
  logo_url: "https://cloudinary.../dupont-logo.png",
  favicon_url: "...",
  branding: {
    couleur_principale: "#1a5c8a",    // remplace --accent dans le CSS
    couleur_secondaire: "#5bc4c0",    // remplace --teal
    couleur_fond: "#eef4f8"           // remplace --bg
  },
  contact: { email, telephone, adresse },
  plan: "standard" | "premium",
  createdAt: timestamp
}
```

**Flow d'application** :
1. Au chargement : détecter le sous-domaine
2. Fetch `tenants/{tenant_id}` (lecture publique des champs branding uniquement)
3. `document.documentElement.style.setProperty('--accent', branding.couleur_principale)`
4. Remplacer logo + nom + favicon + title

**Atout** : le CSS actuel utilise déjà des variables CSS (`--accent`, `--teal`, etc.). **L'injection dynamique est triviale**.

### 3.4 — Authentification

**Décision** : Firebase Auth (email/password) avec `customClaims` pour encoder `tenant_id` et `role`.

**Rôles prévus** :

| Rôle | Portée | Capacités |
|------|--------|-----------|
| `super_admin` | Global (toi) | Créer/désactiver tenants, facturation, voir tout |
| `admin_labo` | Son tenant | Inviter users, config branding, gérer tarifs/clients |
| `user_labo` | Son tenant | Scanner, éditer prescriptions, exporter |
| `dentiste` *(Phase 5)* | Son tenant | Envoyer prescriptions au labo qui l'a invité |

**Règles Firestore (principe)** :

```javascript
match /prescriptions/{id} {
  allow read, write:
    if request.auth.token.tenant_id == resource.data.tenant_id;
}

match /tenants/{tenantId} {
  allow read: if request.auth.token.tenant_id == tenantId;
  allow write:
    if request.auth.token.tenant_id == tenantId
    && request.auth.token.role in ["admin_labo", "super_admin"];
}
```

**Les `customClaims` sont signés par Firebase → non forgeables côté client.**

### 3.5 — Modèle de distribution

**Décision** : SaaS cloud centralisé. Pas d'installation on-premise.

**Raisons** :
- Tenable en solo (1 seule app à maintenir)
- Updates instantanées pour tous les clients
- Facturation/métriques centralisées
- C'est ce que fait Digilab et tous les concurrents modernes

### 3.6 — Modèle économique (validé)

- **Labos** : abonnement payant (montant à définir plus tard)
- **Dentistes** : **accès gratuit**. Un dentiste est invité par un labo et utilise l'interface dentiste (Phase 5) sans coût direct. Le labo paie pour son tenant, les dentistes invités sont inclus.

### 3.7 — Onboarding d'un nouveau labo (Phase 1+)

**Décision** : nouveau labo = **base vide**. Il saisit ses propres clients, tarifs, contacts manuellement.

**Conséquences** :
- Pas de "seed data" par défaut dans le code
- Pas de données partagées entre tenants
- Ton labo actuel (I Love Smile) : migration one-shot des constantes hardcodées (`COGILOG_CLIENTS`, `TARIFS_BASE`, `CONTACTS_DENTISTES`) vers son tenant → **pas de perte de données**

**Amélioration future possible** (non planifiée) : import CSV/Excel pour accélérer l'onboarding.

---

## 4. Roadmap — Approche séquentielle

Chaque phase est **complète et production-ready** avant de passer à la suivante. L'app actuelle de I Love Smile continue de tourner normalement pendant toute la durée de la transformation.

### Vue d'ensemble

| Phase | Nom | Durée estimée (10h/sem) | Résultat |
|-------|-----|-------------------------|----------|
| **0** | Fondations invisibles | 2-3 mois | Auth + multi-tenant en place, UX inchangée |
| **1** | Migration données hardcodées | 1-2 mois | Données ton labo dans Firestore, admin UI basique |
| **2** | White-label / branding | 1-2 mois | Sous-domaines, branding dynamique |
| **3** | Premier vrai labo externe | 1 mois | Onboarding réel, feedback, itérations |
| **4** | Protection du code | 2-3 mois | Logique sensible côté serveur (Cloudflare Workers) |
| **5** | Interface dentiste | 6-12 mois (futur) | Nouveau cycle complet, rebrainstorm |

**Total Phases 0-4** : ~8-12 mois à 10h/semaine

### Points de jalon

- **Fin Phase 2** : prêt à onboarder le premier labo externe techniquement
- **Fin Phase 3** : modèle validé avec un vrai client
- **Fin Phase 4** : code IP protégé, prêt à scaler

---

## 5. Phase 0 détaillée (prochaine implémentation)

**Objectif** : mettre en place les fondations multi-tenant **sans changer l'UX** pour I Love Smile.

### Étape 0.1 — Migration hosting GitHub Pages → Cloudflare Pages (1 weekend)

- Setup compte Cloudflare Pages
- Connecter le repo GitHub
- Configurer domaine principal `ilovesmile.app` (achat domaine si pas fait)
- Vérifier que le déploiement auto marche sur push `main`
- **Critère de sortie** : l'app répond sur `ilovesmile.app` comme elle répondait sur `username.github.io/ilovesmile-labo/`

### Étape 0.2 — Introduction `tenant_id` rétro-compatible (1-2 semaines)

- Créer collection `tenants/` avec 1 doc `lab_ilovesmile`
- Script de migration idempotent : ajouter `tenant_id: "lab_ilovesmile"` sur TOUS les documents existants (prescriptions, contacts, tarifs, meta)
- Modifier toutes les queries Firestore pour filtrer par `tenant_id` (hardcodé `"lab_ilovesmile"` au début)
- **Backup Firestore avant exécution**
- **Critère de sortie** : rien ne change côté UX, tous les docs ont `tenant_id`

### Étape 0.3 — Authentification Firebase (1 semaine)

- Intégrer Firebase Auth (SDK déjà présent)
- Page de login simple (email/password)
- Page de logout
- Reset password par email
- Créer 2 comptes initiaux :
  - `cohenillan29@gmail.com` en `super_admin`
  - Compte pro en `admin_labo` pour le tenant `lab_ilovesmile`
- **Critère de sortie** : l'accès à l'app nécessite un login

### Étape 0.4 — Custom claims + règles Firestore strictes (1 semaine)

- Cloud Function `setTenantClaims(userId, tenant_id, role)`
- Appliquer claims aux comptes créés
- Écrire règles Firestore strictes (filtrage `tenant_id` + `role`)
- Tester : impossible de lire sans auth
- Tester : impossible de lire les données d'un autre tenant
- **Critère de sortie** : sécurité garantie par Firebase

### Étape 0.5 — Détection tenant depuis sous-domaine (3-4 jours)

- Configurer wildcard DNS `*.ilovesmile.app` → Cloudflare Pages
- Fonction `detectTenantFromSubdomain()`
- Sous-domaine inconnu → page d'erreur propre
- Sous-domaine connu → continue flow auth
- **Critère de sortie** : `ilovesmile.ilovesmile.app` marche

### Étape 0.6 — Tests de non-régression (1 semaine)

- Créer 1 tenant factice `lab_test` avec 1 user + 1 prescription
- Se connecter en `lab_ilovesmile` → vérifier qu'on ne voit PAS `lab_test`
- Rejouer scénarios métier clés : scan, save, export Cogilog, PDF
- **Critère de sortie** : tous les scénarios fonctionnent + isolation validée

**Durée totale Phase 0** : 5-7 semaines → **prévoir 3 mois** avec les imprévus.

### Ce qui NE fait PAS partie de la Phase 0 (reporté)

- Interface d'admin pour créer de nouveaux tenants (création manuelle via Firebase console)
- Migration des données hardcodées (`COGILOG_CLIENTS`, etc.) → Phase 1
- Branding dynamique → Phase 2
- Invitation d'users par email → Phase 1 ou 2
- Migration de la logique sensible côté serveur → Phase 4

---

## 6. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Casser I Love Smile pendant migration | Moyenne | Critique | Backup Firestore avant chaque étape, branche dev séparée, tests à chaque étape |
| Règles Firestore trop permissives | Moyenne | Critique | Tests d'intrusion systématiques (simuler user malveillant) |
| Perte de données pendant migration `tenant_id` | Faible | Critique | Script one-shot idempotent (rejouable), backup avant exécution |
| Bug custom claims | Faible | Moyen | Tests unitaires Cloud Function, logs Firebase |
| Migration DNS qui casse l'accès | Faible | Critique | Garder GitHub Pages actif 1-2 semaines en parallèle, bascule DNS propre |

### Non-risques identifiés

- **Clés API Firebase visibles dans le JS** : c'est **normal et documenté** pour Firebase. La sécurité est dans les règles Firestore, pas dans la confidentialité de la clé publique.

---

## 7. Aspects juridiques (à traiter avant le 1er contrat signé)

- [ ] Rédiger un registre des traitements RGPD (template en ligne ou avocat spécialisé)
- [ ] Préparer un contrat type de sous-traitance avec les labos clients
- [ ] Définir une politique de confidentialité + mentions légales
- [ ] Valider avec un avocat que le statut "artisan" dispense de l'HDS (conviction actuelle mais à confirmer)
- [ ] Préparer la procédure "droit à l'oubli" (endpoint pour supprimer toutes les données d'un user/tenant)

**Note** : ces points ne bloquent pas le développement. À traiter **avant le premier contrat signé**, pas avant le premier commit.

---

## 8. Décisions reportées

Ces points seront tranchés au moment opportun, pas maintenant :

- **Tarif de l'abonnement labo** : à définir après Phase 3 (feedback marché)
- **Système de facturation** : Stripe ou facturation manuelle initiale
- **Import CSV/Excel** pour onboarding : selon retour des premiers labos
- **Architecture interface dentiste** : rebrainstorming dédié en Phase 5
- **Migration vers backend complet** (Node.js + Postgres) : seulement si >50 tenants ou besoins spécifiques

---

## 9. Historique et avancement

### Journal des décisions

| Date | Décision | Source |
|------|----------|--------|
| 2026-04-18 | Choix approche séquentielle brownfield | Brainstorming initial |
| 2026-04-18 | Multi-tenant par champ `tenant_id` | Brainstorming, inspiré de Digilab |
| 2026-04-18 | URL par sous-domaines | Brainstorming |
| 2026-04-18 | Firebase Auth + customClaims | Brainstorming |
| 2026-04-18 | Migration Cloudflare Pages dès Phase 0.1 | Nécessité wildcard DNS |
| 2026-04-18 | Dentiste = accès gratuit | Décision produit utilisateur |
| 2026-04-18 | Nouveau labo = base vide, saisie manuelle | Décision produit utilisateur |

### État d'avancement

- [x] **Brainstorming** — Terminé 2026-04-18
- [x] **Spec stratégique (ce document)** — Écrit 2026-04-18
- [ ] **Plan d'implémentation Phase 0** — À créer (prochaine étape)
- [ ] **Phase 0 — Étape 0.1 : Migration Cloudflare Pages**
- [ ] **Phase 0 — Étape 0.2 : Introduction tenant_id**
- [ ] **Phase 0 — Étape 0.3 : Authentification Firebase**
- [ ] **Phase 0 — Étape 0.4 : Custom claims + règles**
- [ ] **Phase 0 — Étape 0.5 : Détection tenant**
- [ ] **Phase 0 — Étape 0.6 : Tests de non-régression**
- [ ] **Phase 1 — Migration données hardcodées**
- [ ] **Phase 2 — White-label / branding**
- [ ] **Phase 3 — Premier labo externe**
- [ ] **Phase 4 — Protection du code**
- [ ] **Phase 5 — Interface dentiste** (futur lointain)

### Comment mettre à jour ce document

Au fur et à mesure que les phases avancent :
1. Cocher les étapes complétées dans la section "État d'avancement"
2. Ajouter les décisions nouvelles dans le "Journal des décisions"
3. Ajouter les specs détaillés de chaque phase dans `docs/superpowers/specs/` avec une convention de nommage : `YYYY-MM-DD-phase-N-<nom>-design.md`
4. Lier les nouveaux specs depuis ce document

---

## 10. Références

### Code source actuel

- [index.html](../../../index.html) — HTML pur, 1151 lignes
- [style.css](../../../style.css) — Design system, variables CSS déjà en place
- [js/](../../../js/) — 30 modules JS organisés par responsabilité
- [Architecture.md](../../../Architecture.md) — Architecture technique actuelle
- [PRD.md](../../../PRD.md) — Product Requirements actuel
- [CONVENTIONS.md](../../../CONVENTIONS.md) — Règles de développement

### Inspirations externes

- [Digilab](https://www.digilab.dental/) — SaaS dental lab (concurrent/référence, white-label)
- [Firebase multi-tenancy patterns](https://firebase.google.com/docs/auth/admin/custom-claims) — custom claims pour multi-tenant
