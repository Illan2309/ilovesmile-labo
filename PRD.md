# PRD — Labo I Love Smile

## Vue d'ensemble

Application web de gestion de prescriptions dentaires pour le laboratoire de prothèses **I Love Smile**. Elle permet de scanner des fiches de prescription (photo, PDF, HTML), d'extraire automatiquement les données via IA (Gemini), de gérer les clients/tarifs, et d'exporter des bons de commande au format Cogilog.

## Problème résolu

Les fiches de prescription dentaire arrivent au labo sous différents formats (papier scanné, PDF numérique, fichiers HTML générés par des logiciels comme Medicaccess). Le processus de saisie manuelle est lent, sujet aux erreurs, et ne permet pas de traçabilité. Cette application automatise l'extraction, la vérification, la traduction anglaise, et l'export comptable.

## Utilisateurs cibles

- **Prothésistes dentaires** du labo I Love Smile (saisie quotidienne des prescriptions)
- **Gestionnaires** (export Cogilog, suivi des tarifs, gestion clients)
- **Sous-traitants étrangers** (PDFs anglais générés automatiquement)

## Fonctionnalités principales

### F1 — Scan IA de prescriptions
- Scan par photo (caméra), galerie (fichier unique), ou lot (multi-fichiers)
- Scan par dossier (sélection via picker ou drag & drop)
- Support des formats : image (JPEG/PNG), PDF, HTML (fiches Medicaccess)
- Extraction automatique via Gemini : cabinet, praticien, patient, actes, dents, teinte, dates, commentaires
- Compression automatique des images avant envoi (max 1200px, JPEG 60%)
- Retry automatique avec backoff exponentiel sur erreurs 503/429
- Fallback Gemini 2.5 Pro après 5 échecs sur un fichier

### F2 — Formulaire de prescription
- **Conjointe** : CCM, EMAX, Zirconium CCC, Full Zircone, Implants (scellé/transvissé), Inlay Core (métal/céramisé/clavette), Inlay Onlay, Facette, Dent provisoire, Richmond, Fraisage
- **Adjointe** : Stellite, App résine, Complet, Valplast, Gouttières, PEI, Cire d'occlusion, Réparation, Rebasage, Adjonction, Dent à extraire
- **Finitions** : Maquillage sillon, Point de contact, Occlusion, Embrasure, Limite sous-gingival
- **Dents** : Grille FDI interactive (18-48), sélection par clic
- **Unitaire/Solidaire** : Modal de groupage avec lasso de sélection, badges visuels JOINED/UNIT
- **dentsActes** : Association acte↔dents via clic droit (bulle popup)
- **Teinte** : Chips VITA Classical + champ libre
- **Scan body (PIV)** : Champ dédié avec regroupement automatique des références
- **Commentaires** : Textarea avec traduction automatique FR→EN
- **Flags** : Urgent, Call me, Cas esthétique, Scan (avec position haut/bas), À refaire (avec sélection des actes concernés)

### F3 — Identification client Cogilog
- Base de ~150 clients dentaires (COGILOG_CLIENTS) avec adresses, contacts, emails
- Autocomplete cabinet avec recherche fuzzy (nom, code, ville, praticien)
- Système d'alias cabinet : mapping nom de fiche → code Cogilog
- Alias produits : mapping termes personnalisés → cases du formulaire
- Standardisation praticien : matching fuzzy contre CONTACTS_DENTISTES
- Fournisseur auto-détecté depuis le code labo (0-99 = MERDENTAL, 100-200 = HUILE)

### F4 — Liste des prescriptions
- Affichage avec filtres : statut (attente/vérifié/importé/Cogilog), cabinet, praticien, code labo, recherche libre, période
- Tri : création, modification, N° croissant/décroissant, livraison
- Stats en temps réel : compteurs par statut
- Sélection multiple pour suppression ou export batch
- Saisie continue : enchaînement automatique des prescriptions en attente

### F5 — Export Cogilog
- Génération TSV au format exact Cogilog (encodage MacRoman)
- Section Clients + Section Bons de commande
- Logique métier : PEI+Cire → 1-PEICIRE, Implant scellé/transvissé → code parent modifié, IC clavette → CL en plus, À refaire → codes 9-xx
- Prix injectés depuis les grilles tarifaires par client
- Quantités déduites automatiquement depuis dentsActes
- Système undo (annulation du dernier export)

### F6 — PDF anglais
- Génération jsPDF avec design premium (dégradés, QR code, losanges)
- Traduction automatique : résumé technique (cases cochées → libellés EN) + commentaires annexes (Gemini Flash)
- Upload Cloudinary automatique du PDF généré
- Export ZIP de tous les PDFs vérifiés

### F7 — Gestion clients
- Fiche client : coordonnées, statut actif/inactif, notes internes (autosave), dernières prescriptions
- Édition des données Cogilog (formulaire complet)
- Système de groupes de cabinets (drag & drop pour réordonner)
- Grilles tarifaires : affichage/édition par client, liaison cabinet↔grille
- Alerte d'inactivité (>30 jours sans prescription)

### F8 — Apprentissage IA
- Règles personnalisées injectées dans le prompt Gemini
- Interface de gestion des règles (ajout/suppression/test via chat)
- Alias produits : termes personnalisés pour le matching IA
- Alias cabinets : mapping noms de fiche → codes Cogilog

### F9 — Paramètres
- Mapping Cogilog : association items formulaire → codes produits
- Labels des actes : noms affichés dans les tarifs
- Préférences : rappel notes, alerte inactivité, options export

## Workflow utilisateur type

1. Le coursier livre des fiches papier/numériques au labo
2. L'opérateur scanne les fiches (photo, drag & drop dossier, ou galerie multi-fichiers)
3. L'IA Gemini extrait les données et pré-remplit le formulaire
4. L'opérateur vérifie, corrige si besoin, et sauvegarde
5. Les prescriptions passent en statut "Vérifié" → PDF anglais auto-généré
6. Export ZIP anglais envoyé aux sous-traitants
7. Les prescriptions "Importées EN" sont sélectionnées pour export Cogilog → TSV téléchargé et importé dans Cogilog

## Contraintes metier

- Les dates de livraison sont critiques (affichees en rouge)
- Le code labo est obligatoire pour sauvegarder
- Le fournisseur (MERDENTAL/HUILE) est obligatoire
- Les fiches "A refaire" ont un traitement special (codes 9-xx, prix a 0 EUR)
- L'export Cogilog doit etre en encodage MacRoman (Mac natif)
- Les PDFs anglais utilisent des libelles normalises (PFM, ZIRCONIA, POST CORE, etc.)

## Architecture technique

Le code est organise en **30 fichiers** modulaires (voir [Architecture.md](Architecture.md)) :

- `index.html` : HTML pur (1151 lignes, zero JS inline)
- `style.css` : design system complet
- `js/data/` : 6 fichiers de donnees (clients, tarifs, mappings, prompt IA)
- `js/` : 18 modules JS organises par responsabilite

Deploiement sur **GitHub Pages** (fichiers statiques). Versioning avec **Git**.
