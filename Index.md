# Index — Labo I Love Smile

## Documentation du projet

| Document | Description |
|----------|-------------|
| [PRD.md](PRD.md) | Product Requirements Document — fonctionnalites, workflow, contraintes metier |
| [Architecture.md](Architecture.md) | Architecture technique — stack, persistence, IA, export, donnees |
| [Index.md](Index.md) | Ce fichier — vue d'ensemble et cartographie du code |

## Structure du projet

```
/
  index.html              (1151 lignes — HTML pur, zero JS inline)
  style.css               (844 lignes — design system complet)
  implant-refs.js         (1106 lignes — dictionnaire references implants)
  inter-font.js           (3 lignes — police Inter base64 pour PDF)
  js/
    data/
      contacts-dentistes.js   CONTACTS_DENTISTES (~60 cabinets, praticiens)
      cogilog-clients.js      COGILOG_CLIENTS (~150 clients, 138 colonnes)
      cogilog-libelles.js     COGILOG_LIBELLES (~150 codes produits)
      tarifs-base.js           TARIFS_BASE (~60 grilles tarifaires)
      mapping-contacts.js      MAPPING_CONTACTS_TARIFS + MAPPING_CODE_TARIFS
      system-prompt.js         buildSystemPrompt() — prompt Gemini (~340 lignes)
    utils.js                  getDB, debounce, compressImage, showToast, _enc
    image-processing.js       fileToDataUrl, cropTopZone, enhanceImageForScan, pdfToImages
    concurrency.js            runWithConcurrency (execution parallele avec limite)
    ai-learning.js            Memoire IA, regles personnalisees, apprentissage
    aliases-cabinet.js        Aliases cabinet, standardizePraticien, matchCabinetLocal
    aliases-products.js       Aliases produits
    undo.js                   Systeme undo (undoPush, undoDerniereAction)
    gemini-api.js             callGemini, callGeminiBatch, post-traitement IA
    prescription-scan.js      buildPrescriptionFromScan, fillFormFromScan, scan
    folder-scanning.js        lancerScanDossiers, drag&drop, preview panel
    autocomplete.js           Suggestions cabinet/praticien
    form-editor.js            Grille dents, teintes, savePrescription, editPrescription
    prescription-list.js      renderList, filtres, selection, suppression
    unitaire-solidaire.js     Modal U/S, lasso selection, solidGroups
    dents-actes.js            parseDentsString, bulle actes, badges
    ui-helpers.js             Modals alias, corrections, helpers date, popups
    export-pdf-fr.js          Export PDF francais (jsPDF)
    export-pdf-en.js          Export PDF anglais + ZIP
    export-cogilog.js         Export TSV Cogilog (MacRoman)
    contacts-tariffs.js       Gestion clients, tarifs, contacts
    parameters-modal.js       Modal parametres (mapping, labels, prefs)
    implants-module.js        Module implants (IIFE auto-contenue, 2334 lignes)
    firebase-init.js          Init Firebase, onSnapshot, persistence
    app.js                    DOMContentLoaded, cablage events
```

## Ordre de chargement des scripts

### Dans `<head>` (donnees + utilitaires + logique coeur)

```html
<!-- CDN : jsPDF, JSZip, html2canvas, PDF.js, qrcode, xlsx, Firebase -->
<script src="implant-refs.js"></script>
<script src="inter-font.js"></script>
<link rel="stylesheet" href="style.css">
<!-- Donnees -->
<script src="js/data/contacts-dentistes.js"></script>
<script src="js/data/cogilog-clients.js"></script>
<script src="js/data/cogilog-libelles.js"></script>
<script src="js/data/tarifs-base.js"></script>
<script src="js/data/mapping-contacts.js"></script>
<!-- Utilitaires -->
<script src="js/utils.js"></script>
<script src="js/image-processing.js"></script>
<script src="js/concurrency.js"></script>
<script src="js/ai-learning.js"></script>
<script src="js/aliases-cabinet.js"></script>
<script src="js/aliases-products.js"></script>
<script src="js/undo.js"></script>
<script src="js/implants-module.js"></script>
<!-- Logique coeur -->
<script src="js/data/system-prompt.js"></script>
<script src="js/gemini-api.js"></script>
<script src="js/prescription-scan.js"></script>
<script src="js/folder-scanning.js"></script>
<script src="js/autocomplete.js"></script>
```

### En fin de `<body>` (modules DOM)

```html
<script src="js/form-editor.js"></script>
<script src="js/prescription-list.js"></script>
<script src="js/unitaire-solidaire.js"></script>
<script src="js/dents-actes.js"></script>
<script src="js/ui-helpers.js"></script>
<script src="js/export-pdf-fr.js"></script>
<script src="js/export-pdf-en.js"></script>
<script src="js/export-cogilog.js"></script>
<script src="js/contacts-tariffs.js"></script>
<script src="js/parameters-modal.js"></script>
<script src="js/firebase-init.js"></script>
<script src="js/app.js"></script>
```

## Objets globaux cles

### Etat applicatif (window)

| Variable | Type | Fichier source | Description |
|----------|------|----------------|-------------|
| `window.prescriptions` | Array | firebase-init.js | Toutes les prescriptions (sync Firebase) |
| `window._db` | Firestore | utils.js | Instance Firestore singleton |
| `window._photoCache` | Object | firebase-init.js | Cache photos base64 par _id |
| `window._dentsActesCourant` | Object | dents-actes.js | Association acte-dents en cours d'edition |
| `window._solidGroups` | Array | unitaire-solidaire.js | Groupes unitaire/solidaire en cours |
| `window._usSelection` | Set | unitaire-solidaire.js | Dents selectionnees dans la modal U/S |
| `window._customRules` | Array | ai-learning.js | Regles IA personnalisees |
| `window._iaMemoireCache` | Object | ai-learning.js | Cache memoire IA |
| `window._gcStatuts` | Object | contacts-tariffs.js | Statuts clients (actif/inactif) |
| `window._gcNotes` | Object | contacts-tariffs.js | Notes internes par cabinet |
| `window._gcGroupes` | Object | contacts-tariffs.js | Groupes de cabinets |
| `window._appPrefs` | Object | parameters-modal.js | Preferences utilisateur |
| `window._scanRunning` | Boolean | folder-scanning.js | Scan en cours (beforeunload guard) |
| `window._rescanData` | Object | prescription-scan.js | Donnees pour rescan de la fiche courante |
| `window.CONTACTS_DENTISTES` | Object | data/contacts-dentistes.js | ~60 cabinets + praticiens |
| `window.COGILOG_CLIENTS` | Object | data/cogilog-clients.js | ~150 clients Cogilog |
| `window.COGILOG_LIBELLES` | Object | data/cogilog-libelles.js | ~150 codes produits |
| `window.TARIFS_BASE` | Object | data/tarifs-base.js | Grilles tarifaires de base |
| `window.MAPPING_CONTACTS_TARIFS_DEFAULT` | Object | data/mapping-contacts.js | Mapping contacts-tarifs |
| `window.MAPPING_CODE_TARIFS` | Object | data/mapping-contacts.js | Mapping codes-tarifs |

## Fonctions principales par module

### Scan & IA (gemini-api.js, prescription-scan.js)
| Fonction | Description |
|----------|-------------|
| `scanPrescription(input)` | Scan single file -> Gemini -> form |
| `scanMultiple(input)` | Scan batch avec concurrence et retries |
| `callGemini(base64, mediaType, isHTML, useFallback)` | Appel proxy Gemini (streaming SSE) |
| `buildPrescriptionFromScan(data, photo, scanIA)` | Construit l'objet prescription depuis la reponse IA |
| `fillFormFromScan(data, ignoreCodeLabo)` | Remplit le formulaire HTML |

### Dossiers (folder-scanning.js)
| Fonction | Description |
|----------|-------------|
| `lancerScanDossiers()` | Scan dossiers (File System API) |
| `ouvrirSelecteurDossiers()` | Picker dossier natif |
| `afficherFichierDansPanel()` | Preview panel |

### Persistence (firebase-init.js)
| Fonction | Description |
|----------|-------------|
| `sauvegarderUnePrescription(p)` | Save 1 prescription -> Cloudinary + Firebase |
| `supprimerPrescriptionCloud(id)` | Delete 1 prescription de Firebase |

### Export (export-cogilog.js, export-pdf-fr.js, export-pdf-en.js)
| Fonction | Description |
|----------|-------------|
| `exportCogilogTSV()` | Genere le TSV Cogilog (MacRoman) |
| `exportPDF(i)` | PDF francais (jsPDF) |
| `buildPDFAnglaisDoc(p, commentaireEN)` | PDF anglais premium |
| `exportZIPAnglais()` | ZIP de tous les PDFs verifies |

### Matching (aliases-cabinet.js)
| Fonction | Description |
|----------|-------------|
| `matchCabinetLocal(text)` | Matching fuzzy texte -> code Cogilog |
| `standardizePraticien(raw, cabinet)` | Matching fuzzy praticien -> CONTACTS |

## Services externes

| Service | URL | Usage |
|---------|-----|-------|
| Firebase | `ilovesmile-labo-fd511.firebaseapp.com` | Persistence Firestore |
| Gemini Proxy | `gemini-proxy.cohenillan29.workers.dev` | IA extraction prescriptions |
| Cloudinary | `api.cloudinary.com/v1_1/dqxusgkff` | Stockage photos/PDFs |
| Google Fonts | `fonts.googleapis.com` | DM Sans, DM Mono, Dancing Script |
| CDN libs | `cdnjs.cloudflare.com` + `cdn.jsdelivr.net` | jsPDF, JSZip, html2canvas, PDF.js, qrcode, xlsx |

## Versioning

```html
<!-- ILS_VERSION_2026-03-27_12h00 -->
```

Git initialise sur la branche `modularize`. Deploiement sur GitHub Pages.
