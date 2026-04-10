# Index — Labo I Love Smile

## Documentation du projet

| Document | Description |
|----------|-------------|
| [PRD.md](PRD.md) | Product Requirements Document — fonctionnalités, workflow, contraintes métier |
| [Architecture.md](Architecture.md) | Architecture technique — stack, persistence, IA, export, données |
| [Index.md](Index.md) | Ce fichier — vue d'ensemble et cartographie du code |

## Fichiers du projet

| Fichier | Taille | Description |
|---------|--------|-------------|
| `index.html` | ~6000+ lignes | Application complète (HTML + CSS + JS monolithique) |

## Cartographie du code (index.html)

### Structure globale

```
Ligne     Section
──────    ──────────────────────────────────────
1-14      Head : meta, fonts, CDN scripts
14-520    <style> : CSS complet (design system, composants, responsive)
520-900   HTML : Header, zones scan, drop overlay
900-1400  HTML : Formulaire prescription (top-row, conjointe, adjointe)
1400-1550 HTML : Grille dents + teinte + commentaires + actions
1550-1900 HTML : Liste prescriptions (filtres, stats, recherche)
1900-2100 HTML : Modale Gestion Clients (sidebar + panels)
2100-2300 HTML : Modale Paramètres (mapping + labels + préférences)
2300-2500 HTML : Modales Alias (cabinet + produits + bulles)
2500-2550 HTML : Modale photo + popup détails

2550-2600 JS : Helpers (getDB, debounce)
2600-2700 JS : Mémoire IA (getMemoire, setMemoire, extraireDiffs)
2700-2800 JS : Règles personnalisées (_customRules, afficherMemoire)
2800-2900 JS : Galerie input + scan dossiers
2900-3100 JS : Drag & drop global + lecture dossiers (File System API)
3100-3300 JS : Scan dossiers (lancerScanDossiers, concurrence)
3300-3400 JS : Preview panel (afficherFichierDansPanel, zoom)
3400-3600 JS : Scan multiple (scanMultiple, runWithConcurrency)
3600-3700 JS : Compression image, conversion HTML→image

3700-3800 JS : Alias cabinet (getAliases, saveAlias, matchCabinetLocal)
3800-3900 JS : Modal alias cabinet (ouvrirModalAliases, recherche Cogilog)
3900-4050 JS : Alias produits (getProductAliases, modal, bulle)

4050-4500 JS : SYSTEM_PROMPT_SCAN (~400 lignes de prompt Gemini)
4500-4600 JS : callGemini (proxy, streaming SSE, PDF→images)
4600-4700 JS : callGeminiBatch, post-traitement (enforce*, standardize*)
4700-4900 JS : buildPrescriptionFromScan, fillFormFromScan
4900-5000 JS : Corrections (extraireDiffs, envoyerCorrection)

5000-5050 JS : Dents FDI (buildDentsGrid, toggleDent)
5050-5100 JS : Teintes (buildTeintes)
5100-5300 JS : savePrescription (verrous, apprentissage, saisie continue)
5300-5500 JS : renderList (filtres, tri, stats, HTML dynamique)
5500-5600 JS : Sélection multiple, toggleStatut, delete
5600-5700 JS : editPrescription (rechargement formulaire complet)

5700-5900 JS : Export PDF français (jsPDF)
5900-6000 JS : Traduction EN (buildCommentaireEN, _traduireGemini)
6000-6300 JS : Export PDF anglais (buildPDFAnglaisDoc — design premium)
6300-6400 JS : Export ZIP anglais

6400-6500 JS : Codes Cogilog (COGILOG_CODES_DEFAULT, charger/sauvegarder)
6500-6700 JS : Export Cogilog TSV (exportCogilogTSV — logique métier complète)

6700-6800 JS : Autocomplete cabinet/praticien (filtrer, choisir, fermer)
6800-6900 JS : Helpers UI (autoFormatDate, highlight*, toggleSansDate)
6900-7000 JS : Popup scan position, PIV regroupement, dent à extraire
7000-7050 JS : Popup À refaire (sélection des actes)

7050-7300 JS : Unitaire/Solidaire (modal, lasso sélection, solidGroups)
7300-7500 JS : dentsActes (bulle clic droit, parseDentsString, badges)

7500-7700 JS : COGILOG_CLIENTS (données ~150 clients, 138 colonnes chacun)
7700-7800 JS : COGILOG_LIBELLES (~150 codes produits)
7800-7900 JS : Undo system (undoPush, undoDerniereAction)

7900-8000 JS : CONTACTS_DENTISTES (données ~60 cabinets)
8000-8100 JS : TARIFS_BASE (données ~60 grilles tarifaires)
8100-8200 JS : MAPPING_CONTACTS_TARIFS, MAPPING_CODE_TARIFS

8200-8500 JS : Gestion Clients (gcSwitchTab, gcConstruireListe, groupes)
8500-8700 JS : Fiche client (renderContactsEditor, notes, stats)
8700-8800 JS : Ajout/édition client Cogilog (formulaire complet)
8800-8900 JS : Tarifs panel (afficherTableauTarif, modifierTarif)

8900-9100 JS : Paramètres (mapping Cogilog, labels, préférences)
9100-9200 JS : Firebase init (Firestore, Cloudinary, onSnapshot)
9200-9300 JS : DOMContentLoaded (init listeners, debounce, cleanup)
```

## Objets globaux clés

### État applicatif (window)

| Variable | Type | Description |
|----------|------|-------------|
| `window.prescriptions` | Array | Toutes les prescriptions (sync Firebase) |
| `window._db` | Firestore | Instance Firestore singleton |
| `window._photoCache` | Object | Cache photos base64 par _id |
| `window._dentsActesCourant` | Object | Association acte→dents en cours d'édition |
| `window._solidGroups` | Array | Groupes unitaire/solidaire en cours |
| `window._usSelection` | Set | Dents sélectionnées dans la modal U/S |
| `window._customRules` | Array | Règles IA personnalisées |
| `window._iaMemoireCache` | Object | Cache mémoire IA |
| `window._gcStatuts` | Object | Statuts clients (actif/inactif) |
| `window._gcNotes` | Object | Notes internes par cabinet |
| `window._gcGroupes` | Object | Groupes de cabinets |
| `window._appPrefs` | Object | Préférences utilisateur |
| `window._scanRunning` | Boolean | Scan en cours (beforeunload guard) |
| `window._rescanData` | Object | Données pour rescan de la fiche courante |

### Variables module-level

| Variable | Type | Description |
|----------|------|-------------|
| `selectedDents` | Set | Dents sélectionnées dans la grille FDI |
| `selectedTeinte` | String | Teinte sélectionnée |
| `editingIndex` | Number | Index de la prescription en édition (-1 = nouvelle) |
| `nextNum` | Number | Prochain numéro de prescription (sync Firebase) |
| `lastScanIA` | Object | Dernière réponse Gemini (pour apprentissage) |
| `lastScanPhoto` | String | Dernière photo scannée (dataUrl) |
| `TARIFS` | Object | Tarifs éditables (base + surcharges) |
| `CONTACTS` | Object | Contacts dentistes (éditable) |
| `gcCabinetSelectionne` | String | Cabinet sélectionné dans Gestion Clients |
| `gcTabActif` | String | Onglet actif (contacts/tarifs) |

## Fonctions principales

### Scan & IA
| Fonction | Description |
|----------|-------------|
| `scanPrescription(input)` | Scan single file → Gemini → form |
| `scanMultiple(input)` | Scan batch avec concurrence et retries |
| `lancerScanDossiers()` | Scan dossiers (File System API) |
| `callGemini(base64, mediaType, isHTML, useFallback)` | Appel proxy Gemini (streaming SSE) |
| `buildPrescriptionFromScan(data, photo, scanIA)` | Construit l'objet prescription depuis la réponse IA |
| `fillFormFromScan(data, ignoreCodeLabo)` | Remplit le formulaire HTML |
| `rescanCurrentPrescription()` | Re-scan la fiche en cours d'édition |

### Persistence
| Fonction | Description |
|----------|-------------|
| `sauvegarderUnePrescription(p)` | Save 1 prescription → Cloudinary + Firebase |
| `supprimerPrescriptionCloud(id)` | Delete 1 prescription de Firebase |
| `_reserverNextNums(n)` | Réservation atomique de n numéros (transaction) |

### Export
| Fonction | Description |
|----------|-------------|
| `exportCogilogTSV()` | Génère le TSV Cogilog (MacRoman) |
| `exportPDF(i)` | PDF français (jsPDF) |
| `buildPDFAnglaisDoc(p, commentaireEN)` | PDF anglais premium |
| `exportZIPAnglais()` | ZIP de tous les PDFs vérifiés |
| `buildCommentaireEN()` | Traduction auto basée sur les cases cochées |

### Matching & résolution
| Fonction | Description |
|----------|-------------|
| `matchCabinetLocal(text)` | Matching fuzzy texte → code Cogilog |
| `standardizePraticien(raw, cabinet)` | Matching fuzzy praticien → CONTACTS |
| `getTarifKey(contactCab)` | Résolution cabinet → grille tarifaire |
| `getTarif(nomCabinet, codeActe)` | Prix d'un acte pour un cabinet |

## Services externes

| Service | URL | Usage |
|---------|-----|-------|
| Firebase | `ilovesmile-labo-fd511.firebaseapp.com` | Persistence Firestore |
| Gemini Proxy | `gemini-proxy.cohenillan29.workers.dev` | IA extraction prescriptions |
| Cloudinary | `api.cloudinary.com/v1_1/dqxusgkff` | Stockage photos/PDFs |
| Google Fonts | `fonts.googleapis.com` | DM Sans, DM Mono, Dancing Script |
| CDN libs | `cdnjs.cloudflare.com` + `cdn.jsdelivr.net` | jsPDF, JSZip, html2canvas, PDF.js, qrcode |

## Versioning

Le fichier contient un commentaire de version en ligne 1 :
```html
<!-- ILS_VERSION_2026-03-27_12h00 -->
```

Pas de git, pas de CI/CD, pas de déploiement automatisé visible.
