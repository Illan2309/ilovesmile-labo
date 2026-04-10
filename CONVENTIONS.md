# Conventions de developpement — Labo I Love Smile

> Ce fichier est la reference. Toute modification de code DOIT respecter ces regles.

## Regle 1 : Zero JS inline dans index.html

`index.html` contient UNIQUEMENT du HTML. Aucun bloc `<script>` avec du code inline.
La seule exception tolere est le one-liner de config PDF.js (ligne 13).

Si du JS inline reapparait dans index.html, c'est une regression a corriger immediatement.

## Regle 2 : Un module = un fichier

Chaque domaine fonctionnel a son propre fichier dans `js/` :

| Domaine | Fichier |
|---------|---------|
| Utilitaires generaux | `js/utils.js` |
| Traitement images | `js/image-processing.js` |
| Appels Gemini | `js/gemini-api.js` |
| Scan prescriptions | `js/prescription-scan.js` |
| Scan dossiers | `js/folder-scanning.js` |
| Formulaire | `js/form-editor.js` |
| Liste prescriptions | `js/prescription-list.js` |
| Export PDF FR | `js/export-pdf-fr.js` |
| Export PDF EN | `js/export-pdf-en.js` |
| Export Cogilog | `js/export-cogilog.js` |
| Gestion clients | `js/contacts-tariffs.js` |
| Parametres | `js/parameters-modal.js` |
| etc. | Voir Index.md pour la liste complete |

**Pour ajouter une fonctionnalite** : creer un nouveau fichier `js/nom-feature.js` et ajouter le `<script>` dans index.html a la bonne position.

**NE JAMAIS** ajouter des fonctions dans un module qui ne correspond pas a leur domaine.

## Regle 3 : Donnees dans js/data/

Toute constante metier volumineuse (objets, tableaux, prompts) va dans `js/data/` :

- `js/data/contacts-dentistes.js` — cabinets et praticiens
- `js/data/cogilog-clients.js` — clients Cogilog
- `js/data/cogilog-libelles.js` — codes produits
- `js/data/tarifs-base.js` — grilles tarifaires
- `js/data/mapping-contacts.js` — mappings contacts/tarifs
- `js/data/system-prompt.js` — prompt Gemini

Les variables de donnees utilisent le prefixe `window.` pour etre accessibles globalement.

## Regle 4 : Scope global avec window.*

Toutes les fonctions et variables partagees entre fichiers doivent etre sur `window.*` ou declarees avec `var` (pas `const`/`let` au top-level d'un fichier separe, car elles ne seraient pas accessibles ailleurs).

Pattern standard :
```javascript
// BON — accessible depuis les autres fichiers
function maFonction() { ... }
var MA_CONSTANTE = { ... };
window.monObjet = { ... };

// MAUVAIS — invisible depuis les autres fichiers
const maFonction = () => { ... };
let maVariable = 42;
```

## Regle 5 : Ordre de chargement

L'ordre des `<script>` dans index.html est critique. Respecter cette hierarchie :

1. **CDN libs** (jsPDF, Firebase, etc.)
2. **Fichiers existants** (implant-refs.js, inter-font.js)
3. **Donnees** (`js/data/*.js`) — chargees en premier car les autres en dependent
4. **Utilitaires** (utils, image-processing, concurrency, ai-learning, aliases, undo)
5. **Logique coeur** (system-prompt, gemini-api, prescription-scan, folder-scanning, autocomplete)
6. **Modules DOM** (en fin de `<body>`, apres le HTML)
7. **Init** (firebase-init.js, app.js — toujours en dernier)

Un fichier ne peut appeler QUE des fonctions definies dans des fichiers charges AVANT lui.

## Regle 6 : Nommage

- Fichiers JS : `kebab-case.js` (ex: `folder-scanning.js`)
- Fonctions publiques : `camelCase` (ex: `buildPrescriptionFromScan`)
- Fonctions privees/internes : prefixe `_` (ex: `_postTraiterDentsActes`)
- Constantes donnees : `UPPER_SNAKE_CASE` (ex: `COGILOG_CLIENTS`)
- Variables globales etat : prefixe `window._` (ex: `window._scanRunning`)

## Regle 7 : CSS dans style.css

Tout le CSS va dans `style.css`. Pas de `<style>` inline dans index.html.
Les styles inline sur les elements HTML (`style="..."`) sont toleres pour les cas ponctuels mais a eviter quand une classe CSS peut faire le travail.

## Regle 8 : Documenter les changements

Apres toute modification structurelle :
- Mettre a jour `Index.md` (cartographie des fichiers)
- Mettre a jour `Architecture.md` si l'architecture change
- Committer avec un message descriptif

## Checklist nouvelle fonctionnalite

1. Creer `js/nom-feature.js`
2. Ajouter `<script src="js/nom-feature.js"></script>` dans index.html (bonne position)
3. Si besoin de donnees : creer `js/data/nom-data.js`
4. Si besoin de HTML : ajouter dans index.html (section body)
5. Si besoin de CSS : ajouter dans style.css
6. Mettre a jour Index.md
7. Tester, committer, pousser
