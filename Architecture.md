# Architecture — Labo I Love Smile

## Vue d'ensemble technique

Application web monolithique **single-page** servie comme un fichier HTML statique unique (~6000+ lignes). Pas de framework frontend, pas de build system — vanilla HTML/CSS/JS avec des CDN pour les dépendances.

```
┌─────────────────────────────────────────────────────┐
│                   index.html                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │   CSS    │ │   HTML   │ │    JS    │            │
│  │ (inline) │ │ (inline) │ │ (inline) │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│         │           │           │                   │
│         ▼           ▼           ▼                   │
│  ┌─────────────────────────────────────┐            │
│  │        Logique applicative          │            │
│  │  Scan IA │ Formulaire │ Export      │            │
│  │  Tarifs  │ Contacts   │ Paramètres │            │
│  └─────────────────────────────────────┘            │
└────────────┬──────────┬──────────┬──────────────────┘
             │          │          │
     ┌───────▼──┐  ┌────▼────┐  ┌─▼──────────┐
     │ Firebase │  │Cloudinary│  │ Gemini AI  │
     │Firestore │  │  (CDN)  │  │(CF Worker) │
     └──────────┘  └─────────┘  └────────────┘
```

## Stack technique

| Composant | Technologie | Version | Usage |
|-----------|-------------|---------|-------|
| Frontend | Vanilla JS | ES6+ | Logique applicative |
| CSS | Custom Properties | CSS3 | Design system avec variables |
| Fonts | Google Fonts | — | DM Sans, DM Mono, Dancing Script |
| Persistence | Firebase Firestore | 9.6.10 (compat) | BDD temps réel |
| Storage images | Cloudinary | API REST | Upload/stockage photos et PDFs |
| IA extraction | Google Gemini | 3.1 Pro / 2.5 Pro | OCR + extraction structurée |
| Proxy IA | Cloudflare Worker | — | Cache clé API, rate limiting |
| PDF render | PDF.js | 3.11.174 | Affichage PDFs dans le navigateur |
| PDF generate | jsPDF | 2.5.1 | Génération PDFs anglais |
| Screenshot | html2canvas | 1.4.1 | Conversion HTML→image |
| ZIP | JSZip | 3.10.1 | Export batch PDFs |
| QR Code | qrcode-generator | 1.4.4 | QR dans les PDFs anglais |

## Persistence — Firebase Firestore

### Collections

```
firestore/
├── prescriptions/          # 1 doc par prescription (_id = clé)
│   ├── {id}/               # Données complètes de la prescription
│   │   ├── numero, code_labo, cabinet, praticien
│   │   ├── patient {nom, age, sexe}
│   │   ├── dates {empreinte, livraison, sansDate}
│   │   ├── conjointe[], adjointe[]
│   │   ├── dents[], dentsActes{}, solidGroups[]
│   │   ├── teinte, piv, fraisage, commentaires
│   │   ├── statut (attente|verifie|importe)
│   │   ├── photo_url, photo_type, photo_html
│   │   ├── pdf_url, scanIA, cogilog_exporte
│   │   └── _ts, _id, createdAt
│   └── ...
├── contacts/
│   ├── dentistes           # {cabinet: [praticiens]}
│   ├── mapping             # {cabinet: grille_tarifaire}
│   └── cogilog_clients_custom  # Clients ajoutés/modifiés
├── tarifs/
│   └── surcharges          # {cabinet: {code_acte: prix}}
└── meta/
    ├── config              # {nextNum: 31461}
    ├── ia_memory           # Mémoire apprentissage IA
    ├── custom_rules        # Règles personnalisées prompt
    ├── cogilog_mapping     # Item formulaire → code produit
    ├── acte_labels         # Code → nom affiché
    ├── app_prefs           # Préférences utilisateur
    ├── gc_meta             # {statuts: {}, notes: {}}
    ├── gc_groupes          # {groupe: [cabinets]}
    ├── gc_groupes_ordre    # {ordre: [noms_groupes]}
    ├── clients_supprimes   # {liste: [noms_masqués]}
    ├── aliases_cabinet     # Alias nom fiche → code Cogilog
    ├── aliases_produit     # Alias termes → produits
    └── ui_prefs            # Filtres période sauvegardés
```

### Synchronisation

- **Temps réel** via `onSnapshot` sur la collection `prescriptions` — toute modification est propagée instantanément à tous les onglets/appareils
- **Anti-race condition** : `editingIndex` capturé par snapshot avant les opérations async, recherche par `_id` stable au lieu d'index
- **Verrou anti-double-clic** : `window._saveLock` empêche les sauvegardes simultanées
- **Réservation atomique nextNum** : transaction Firebase pour éviter les collisions multi-user sur les numéros de prescription

### Stockage photos

Les photos ne sont **pas** stockées dans Firestore (limite 1MB/doc). Workflow :

1. Photo base64 capturée côté client → cache local `window._photoCache`
2. Upload async vers **Cloudinary** (preset `ILOVESMILE`, folder `ilovesmile`)
3. URL Cloudinary (`photo_url`) sauvegardée dans Firestore
4. Dans Firestore, `photo` = `'__photo__'` (marqueur, pas la donnée)
5. Les fiches HTML gardent aussi `photo_html` (base64 local pour affichage srcdoc)

## IA — Pipeline Gemini

### Architecture du proxy

```
Client (index.html)
    │
    │ POST JSON {systemInstruction, contents, generationConfig}
    ▼
Cloudflare Worker (gemini-proxy.cohenillan29.workers.dev)
    │
    │ Ajoute la clé API Gemini (côté serveur)
    │ Route : Gemini 3.1 Pro → fallback 2.5 Pro → Flash
    ▼
Google Gemini API (SSE streaming)
    │
    │ Réponse streaming (data: JSON chunks)
    ▼
Client : assemble les chunks, extrait le JSON
```

### Prompt system

Le prompt Gemini (~400 lignes) est structuré en phases :
1. **PHASE 1** — Lecture de la fiche (extraction brute)
2. **PHASE 2** — Remplissage du JSON (mapping texte → valeurs exactes)
3. **MAPPING** — Table de correspondance texte lu → valeurs autorisées
4. **GROUPES EXCLUSIFS** — Contraintes mutuellement exclusives
5. **UNITAIRE/SOLIDAIRE** — Logique de groupage des dents
6. **DENTSACTES** — Format d'association acte↔dents
7. **TRADUCTION EN** — Règles de formulation anglaise
8. **CHECKLIST FINALE** — Vérifications avant réponse

### Injection dynamique dans le prompt

À chaque scan, le prompt inclut :
- **Règles personnalisées** (`window._customRules`) — priorité absolue
- **Alias cabinets** (localStorage + Firebase) — mapping nom fiche → code Cogilog
- **Alias produits** — mapping termes → cases du formulaire
- **Index Cogilog compact** — tous les clients avec code, nom, ville, contacts
- **Date du jour** — pour validation des dates

### Post-traitement côté client

Après réponse Gemini, le JS applique :
1. `enforceGroupesExclusifs` — max 1 par groupe (maquillage, embrasure, etc.)
2. `enforceParents` — auto-coche parents si sous-items cochés
3. `enforceFinitionParDefaut` — "montage" seulement si explicite, sinon "finition"
4. `_postTraiterDentsActes` — propage mâchoire globale aux items adjointe
5. `_postTraiterSolidGroups` — déduit les groupes depuis dentsActes
6. `matchCabinetLocal` — fallback JS si Gemini ne trouve pas le code Cogilog
7. `standardizePraticien` — matching fuzzy du nom du Dr contre CONTACTS

## Export Cogilog

### Format de sortie

Fichier TSV (tab-separated) en **encodage MacRoman** (table de conversion UTF-16 → MacRoman intégrée).

### Structure du fichier

```
**Gestion    Clients    **Modifier
#Catégorie   Code   Préfixe   Nom...  (header 138 colonnes)
[données clients réels depuis COGILOG_CLIENTS]

**Gestion    Bons de commande
#Date pièce  Code client  Mode facturation...  (header 116 colonnes)
#            Code produit  Libellé  Prix...     (header lignes produit 48 colonnes)
[ligne pièce : 116 colonnes, infos du bon]
[ligne étoiles : praticien + patient + numéro]
[lignes produit : 1 par acte coché, avec prix et dents]
```

### Logique métier export

| Cas | Règle |
|-----|-------|
| PEI + Cire | → 1 ligne `1-PEICIRE` au lieu de 2 |
| Implant CCM + transvisé | → code `2-CCMIT` (pas `2-CCMI`) |
| IC clavette | → ligne `1-IC` + ligne `CL` supplémentaire |
| À refaire | → codes `9-xx` avec prix 0€ et style Rouge |
| Scan coché | → ligne `FS` avec quantité 1 ou 2 selon position |
| Stellite finition | → `1-STFDC` (pas de ligne parent "Stellite") |

## Données embarquées

### COGILOG_CLIENTS (~150 entrées)

Objet JS inline avec la structure exacte de la base Cogilog : 138 colonnes par client (catégorie, code, nom, adresse, contacts, email, mode paiement, commercial, notes, etc.).

### TARIFS_BASE (~60 grilles)

Objet JS inline : `{nomGrille: {codeActe: prix}}`. Chaque grille contient ~80 codes produits avec leurs prix. Les surcharges éditées sont stockées séparément dans Firebase (`tarifs/surcharges`).

### CONTACTS_DENTISTES (~60 cabinets)

Objet JS inline : `{nomCabinet: [praticiens]}`. Synchronisé avec Firebase au chargement.

### COGILOG_LIBELLES (~150 codes)

Objet JS inline : `{codeProduit: libelléCogilog}`. Utilisé pour l'affichage dans le mapping et l'injection dans les bons de commande.

## UI — Structure des composants

```
<header>
  Logo + Boutons scan (Photo/Galerie/Dossiers) + Status Firebase

<split-wrapper>
  ├── Colonne gauche
  │   ├── Onglets outils (Gestion clients / Paramètres / Mémoire IA)
  │   ├── Card formulaire
  │   │   ├── Header (code labo + N° + rescan)
  │   │   ├── Top row (Cabinet/Patient/Dates)
  │   │   ├── Main row (Conjointe | Adjointe)
  │   │   ├── Grille dents FDI
  │   │   ├── Bottom row (Teinte | Commentaires)
  │   │   └── Actions (Reset/Save/Saisie continue)
  │   └── ...
  └── Colonne droite
      └── Preview panel (aperçu fiche originale)

<list-card>
  ├── Header (stats + export buttons)
  ├── Filtres (statut/tri/recherche/période)
  └── Liste prescriptions (items cliquables)

<modales>
  ├── Gestion clients (sidebar + fiche + tarifs)
  ├── Paramètres (mapping/labels/préférences)
  ├── Alias cabinet
  ├── Alias produits
  ├── Unitaire/Solidaire
  └── À refaire
```

## Variables CSS (Design System)

```css
--bg: #eef4f8          /* fond page */
--surface: #ffffff     /* fond cartes */
--border: #d0e0ea      /* bordures */
--accent: #1a5c8a      /* bleu principal */
--teal: #5bc4c0        /* turquoise */
--text: #1c2a35        /* texte principal */
--muted: #7a96a8       /* texte secondaire */
--success: #2d7a4f     /* vert */
--danger: #c0392b      /* rouge */
--grad: linear-gradient(120deg, #1a5c8a, #5bc4c0)  /* dégradé signature */
```

## Limitations actuelles

1. **Monolithe** — tout dans 1 fichier, pas de modules ES, pas de bundler
2. **Pas d'authentification** — Firebase ouvert, n'importe qui avec l'URL peut lire/écrire
3. **Pas de pagination** — toutes les prescriptions chargées en mémoire
4. **Données inline** — ~2MB de JS rien que pour COGILOG_CLIENTS + TARIFS_BASE
5. **Pas de PWA** — pas de service worker, pas de mode offline
6. **Pas de tests** — aucun test unitaire ou d'intégration
7. **Pas de versioning API** — le proxy Gemini est un endpoint unique
