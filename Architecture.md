# Architecture — Labo I Love Smile

## Vue d'ensemble technique

Application web **single-page** modulaire servie comme fichiers statiques sur GitHub Pages. Pas de framework frontend, pas de bundler — vanilla HTML/CSS/JS avec des CDN pour les dependances. Le code est decoupe en **30 fichiers** organises par responsabilite.

```
┌─────────────────────────────────────────────────────────────┐
│                    index.html (HTML pur)                     │
│                    style.css (design system)                 │
├─────────────────────────────────────────────────────────────┤
│  js/data/          │  js/ (utilitaires)  │  js/ (modules DOM)│
│  contacts-dentistes│  utils.js           │  form-editor.js   │
│  cogilog-clients   │  image-processing   │  prescription-list│
│  cogilog-libelles  │  concurrency        │  export-*.js      │
│  tarifs-base       │  ai-learning        │  contacts-tariffs │
│  mapping-contacts  │  aliases-*          │  parameters-modal │
│  system-prompt     │  gemini-api         │  unitaire-solidaire│
│                    │  prescription-scan  │  dents-actes      │
│                    │  folder-scanning    │  ui-helpers        │
│                    │  autocomplete       │  firebase-init    │
│                    │  undo               │  app.js           │
│                    │  implants-module    │                    │
├────────────────────┴─────────────────────┴───────────────────┤
│                    Services externes                          │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐                │
│  │ Firebase │  │ Cloudinary│  │ Gemini AI  │                │
│  │ Firestore│  │   (CDN)   │  │(CF Worker) │                │
│  └──────────┘  └───────────┘  └────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

## Organisation des fichiers

### Principe

- **index.html** : HTML pur (1151 lignes), zero JavaScript inline
- **style.css** : CSS complet avec variables custom (844 lignes)
- **js/data/** : Donnees statiques (constantes metier, prompt IA)
- **js/** : Logique applicative decoupee par responsabilite
- Toutes les fonctions restent sur `window.*` pour compatibilite avec les `onclick` inline du HTML
- Pas de bundler, pas de npm — fichiers `<script>` classiques

### Ordre de chargement

1. CDN libs (jsPDF, JSZip, html2canvas, PDF.js, qrcode, xlsx, Firebase)
2. Fichiers existants (implant-refs.js, inter-font.js)
3. **Donnees** (js/data/*.js) — constantes metier chargees en premier
4. **Utilitaires** (utils, image-processing, concurrency, ai-learning, aliases, undo, implants)
5. **Logique coeur** (system-prompt, gemini-api, prescription-scan, folder-scanning, autocomplete)
6. **Modules DOM** (charges en fin de `<body>` apres le HTML)

## Stack technique

| Composant | Technologie | Version | Usage |
|-----------|-------------|---------|-------|
| Frontend | Vanilla JS | ES6+ | Logique applicative |
| CSS | Custom Properties | CSS3 | Design system avec variables |
| Fonts | Google Fonts | — | DM Sans, DM Mono, Dancing Script |
| Persistence | Firebase Firestore | 9.6.10 (compat) | BDD temps reel |
| Storage images | Cloudinary | API REST | Upload/stockage photos et PDFs |
| IA extraction | Google Gemini | 3.1 Pro / 2.5 Pro | OCR + extraction structuree |
| Proxy IA | Cloudflare Worker | — | Cache cle API, rate limiting |
| PDF render | PDF.js | 3.11.174 | Affichage PDFs dans le navigateur |
| PDF generate | jsPDF | 2.5.1 | Generation PDFs anglais |
| Screenshot | html2canvas | 1.4.1 | Conversion HTML vers image |
| ZIP | JSZip | 3.10.1 | Export batch PDFs |
| QR Code | qrcode-generator | 1.4.4 | QR dans les PDFs anglais |
| Excel | SheetJS (xlsx) | 0.20.3 | Export tarifs Excel |
| Versioning | Git | — | Branche modularize |
| Deploiement | GitHub Pages | — | Fichiers statiques |

## Persistence — Firebase Firestore

### Collections

```
firestore/
  prescriptions/          # 1 doc par prescription (_id = cle)
    {id}/                 # Donnees completes de la prescription
      numero, code_labo, cabinet, praticien
      patient {nom, age, sexe}
      dates {empreinte, livraison, sansDate}
      conjointe[], adjointe[]
      dents[], dentsActes{}, solidGroups[]
      teinte, piv, fraisage, commentaires
      statut (attente|verifie|importe)
      photo_url, photo_type, photo_html
      pdf_url, scanIA, cogilog_exporte
      _ts, _id, createdAt
  contacts/
    dentistes             # {cabinet: [praticiens]}
    mapping               # {cabinet: grille_tarifaire}
    cogilog_clients_custom  # Clients ajoutes/modifies
  tarifs/
    surcharges            # {cabinet: {code_acte: prix}}
  meta/
    config                # {nextNum: 31461}
    ia_memory             # Memoire apprentissage IA
    custom_rules          # Regles personnalisees prompt
    cogilog_mapping       # Item formulaire -> code produit
    acte_labels           # Code -> nom affiche
    app_prefs             # Preferences utilisateur
    gc_meta               # {statuts: {}, notes: {}}
    gc_groupes            # {groupe: [cabinets]}
    gc_groupes_ordre      # {ordre: [noms_groupes]}
    clients_supprimes     # {liste: [noms_masques]}
    aliases_cabinet       # Alias nom fiche -> code Cogilog
    aliases_produit       # Alias termes -> produits
    ui_prefs              # Filtres periode sauvegardes
```

### Synchronisation

- **Temps reel** via `onSnapshot` sur la collection `prescriptions` (firebase-init.js)
- **Anti-race condition** : `editingIndex` capture par snapshot avant les operations async
- **Verrou anti-double-clic** : `window._saveLock` empeche les sauvegardes simultanees
- **Reservation atomique nextNum** : transaction Firebase pour eviter les collisions multi-user

### Stockage photos

1. Photo base64 capturee cote client -> cache local `window._photoCache`
2. Upload async vers **Cloudinary** (preset `ILOVESMILE`, folder `ilovesmile`)
3. URL Cloudinary (`photo_url`) sauvegardee dans Firestore
4. Dans Firestore, `photo` = `'__photo__'` (marqueur, pas la donnee)

## IA — Pipeline Gemini

### Architecture du proxy

```
Client (browser)
    |
    | POST JSON {systemInstruction, contents, generationConfig}
    v
Cloudflare Worker (gemini-proxy.cohenillan29.workers.dev)
    |
    | Ajoute la cle API Gemini (cote serveur)
    | Route : Gemini 3.1 Pro -> fallback 2.5 Pro -> Flash
    v
Google Gemini API (SSE streaming)
    |
    | Reponse streaming (data: JSON chunks)
    v
Client : assemble les chunks, extrait le JSON
```

### Prompt system (js/data/system-prompt.js)

Le prompt Gemini (~340 lignes) est genere dynamiquement par `buildSystemPrompt()` :
1. **PHASE 1** — Lecture de la fiche (extraction brute)
2. **PHASE 2** — Remplissage du JSON (mapping texte -> valeurs exactes)
3. **MAPPING** — Table de correspondance texte lu -> valeurs autorisees
4. **GROUPES EXCLUSIFS** — Contraintes mutuellement exclusives
5. **UNITAIRE/SOLIDAIRE** — Logique de groupage des dents
6. **DENTSACTES** — Format d'association acte-dents
7. **TRADUCTION EN** — Regles de formulation anglaise
8. **CHECKLIST FINALE** — Verifications avant reponse

### Injection dynamique

A chaque scan, le prompt inclut (via `getPromptApprentissage()` dans ai-learning.js) :
- **Regles personnalisees** (`window._customRules`)
- **Alias cabinets** (localStorage + Firebase)
- **Alias produits**
- **Index Cogilog compact**
- **Date du jour**

### Post-traitement (js/gemini-api.js)

1. `enforceGroupesExclusifs` — max 1 par groupe
2. `enforceParents` — auto-coche parents si sous-items coches
3. `enforceFinitionParDefaut` — "montage" seulement si explicite
4. `_postTraiterDentsActes` — propage machoire globale aux items adjointe
5. `_postTraiterSolidGroups` — deduit les groupes depuis dentsActes
6. `matchCabinetLocal` — fallback JS si Gemini ne trouve pas le code Cogilog
7. `standardizePraticien` — matching fuzzy du nom du Dr contre CONTACTS

## Export Cogilog (js/export-cogilog.js)

### Format de sortie

Fichier TSV (tab-separated) en **encodage MacRoman**.

### Logique metier

| Cas | Regle |
|-----|-------|
| PEI + Cire | -> 1 ligne `1-PEICIRE` au lieu de 2 |
| Implant CCM + transvise | -> code `2-CCMIT` (pas `2-CCMI`) |
| IC clavette | -> ligne `1-IC` + ligne `CL` supplementaire |
| A refaire | -> codes `9-xx` avec prix 0 EUR et style Rouge |
| Scan coche | -> ligne `FS` avec quantite 1 ou 2 selon position |
| Stellite finition | -> `1-STFDC` (pas de ligne parent "Stellite") |

## UI — Structure des composants

```
<header>
  Logo + Boutons scan (Photo/Galerie/Dossiers) + Status Firebase

<split-wrapper>
  +-- Colonne gauche
  |   +-- Onglets outils (Gestion clients / Parametres / Memoire IA)
  |   +-- Card formulaire
  |   |   +-- Header (code labo + N + rescan)
  |   |   +-- Top row (Cabinet/Patient/Dates)
  |   |   +-- Main row (Conjointe | Adjointe)
  |   |   +-- Grille dents FDI
  |   |   +-- Bottom row (Teinte | Commentaires)
  |   |   +-- Actions (Reset/Save/Saisie continue)
  +-- Colonne droite
      +-- Preview panel (apercu fiche originale)

<list-card>
  +-- Header (stats + export buttons)
  +-- Filtres (statut/tri/recherche/periode)
  +-- Liste prescriptions (items cliquables)

<modales>
  +-- Gestion clients (sidebar + fiche + tarifs)
  +-- Parametres (mapping/labels/preferences)
  +-- Alias cabinet / produits
  +-- Unitaire/Solidaire
  +-- A refaire
  +-- Implants (stock, references, gestion)
```

## Variables CSS — Design System (style.css)

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
--grad: linear-gradient(120deg, #1a5c8a, #5bc4c0)  /* degrade signature */
```

## Regles de developpement

Voir **[CONVENTIONS.md](CONVENTIONS.md)** pour toutes les regles obligatoires. Les points cles :

- **Zero JS inline** dans index.html — tout dans `js/`
- **1 module = 1 fichier** — nouvelle feature = nouveau fichier
- **Donnees dans js/data/** — constantes metier volumineuses
- **Ordre de chargement** des scripts a respecter (donnees -> utils -> coeur -> DOM)

## Limitations actuelles

1. **Pas d'authentification** — Firebase ouvert, n'importe qui avec l'URL peut lire/ecrire
2. **Pas de pagination** — toutes les prescriptions chargees en memoire
3. **Scope global** — toutes les fonctions sur `window.*` (pas de modules ES)
4. **Pas de PWA** — pas de service worker, pas de mode offline
5. **Pas de tests** — aucun test unitaire ou d'integration
6. **Pas de versioning API** — le proxy Gemini est un endpoint unique

## Historique de modularisation

| Date | Action | Impact |
|------|--------|--------|
| 2026-04-10 | Phase 1 : CSS extrait dans style.css | -844 lignes |
| 2026-04-10 | Phase 2 : Donnees dans js/data/ | -1447 lignes |
| 2026-04-10 | Phase 3 : Utilitaires dans js/ | -3184 lignes |
| 2026-04-10 | Phase 4 : Logique coeur dans js/ | -2080 lignes |
| 2026-04-10 | Phase 5 : Modules DOM dans js/ | -8165 lignes |
| **Total** | **16027 -> 1151 lignes** | **-92.8%** |
