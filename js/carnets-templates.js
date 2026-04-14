// ══════════════════════════════════════════
// CARNETS PRÉ-ENREGISTRÉS — Templates visuels
// Template du carnet I Love Smile (fourni aux cabinets)
// Utilisé pour guider l'IA sur l'emplacement exact de chaque champ
// ══════════════════════════════════════════

/**
 * Template du carnet I Love Smile — format image (JPG/photo)
 * Les fiches PDF/HTML proviennent de logiciels de scan et ont leur propre structure.
 * Ce template ne s'applique qu'aux images (photos de fiches papier).
 */
var CARNET_ILS = {
  id: 'ils-standard',
  nom: 'Carnet I Love Smile',
  description: 'Format A5 paysage, distribué par le labo aux cabinets dentaires. Structure fixe avec zones clairement délimitées.',

  // ── LAYOUT GLOBAL ──
  // La fiche est divisée en 3 bandes horizontales :
  // HAUT (20%) : identification (code labo, cabinet, patient, dates)
  // MILIEU (50%) : actes (conjointe gauche, adjointe droite) + schéma dentaire
  // BAS (30%) : teinte + commentaires manuscrits

  zones: {
    // ── BANDE HAUTE (identification) ──
    code_labo: {
      position: 'haut-gauche, coin supérieur gauche',
      description: 'Encadré "CODE LABO" — le dentiste écrit à la main un code court (lettre + nombre, ex: N41). Souvent écrit en gros, parfois entouré ou encadré. Zone dédiée à gauche du titre "CABINET / CENTRE".'
    },
    cabinet: {
      position: 'haut-centre',
      description: 'Champ "CABINET / CENTRE + NOM DU DENTISTE" — zone imprimée en bleu avec un grand espace pour écrire. Le nom du cabinet et du dentiste sont écrits ici à la main par le dentiste. Parfois le cabinet est un tampon.'
    },
    praticien: {
      position: 'haut-centre, sous le nom du cabinet',
      description: 'Le nom du praticien (Dr + NOM) est écrit dans la même zone que le cabinet, souvent sur la 2ème ligne. Peut aussi être un tampon.'
    },
    patient: {
      position: 'haut-droite, zone "PATIENT"',
      description: 'Champ "PATIENT" avec nom, Âge, et cases Femme/Homme. Le nom est écrit à la main. L\'âge est un petit champ à droite du nom. Le sexe est une case cochée (F ou H).'
    },
    dates: {
      position: 'extrême droite en haut',
      description: 'Deux champs empilés verticalement : "DATE DE PRISE D\'EMPREINTE" (en haut) et "DATE DE RETOUR" / "DATE DE RDV ET HEURE" (en bas). Format JJ/MM/AA manuscrit. La date de retour = date de livraison.'
    },
    numero: {
      position: 'sous le code labo, centré',
      description: 'N° suivi de chiffres (ex: "N° 157232"). Numéro pré-imprimé sur la fiche, unique. Format long (6+ chiffres).'
    },
    flags: {
      position: 'entre patient et dates',
      description: 'Cases à cocher : "URGENT", "CALL ME", "A REFAIRE R/NR", "Cas esthétique". Petites cases alignées horizontalement.'
    },

    // ── BANDE MILIEU (actes) ──
    conjointe: {
      position: 'milieu-gauche, colonne "CONJOINTE"',
      description: 'Titre "CONJOINTE" en haut. Cases à cocher organisées en colonnes :\n' +
        '- Colonne 1 (gauche) : CCM, Couronne métal coulée, CCC (Zircone céramique), EMAX, Dent provisoire, Implant CCM / CCC\n' +
        '- Sous-section "INLAY CORE" : métal, céramisé, clavette\n' +
        '- Cases Unitaire / Solidaire en bas\n' +
        '- Colonne 2 (centre) : FACETTES, Ceramic Rose Collet, INLAY ONLAY, Fraisage sur\n' +
        '- Options : MAQUILLAGE SILLON (oui/non), EMBRASURE, POINT DE CONTACT, OCCLUSION\n' +
        '- Ligne "Scanbody" avec champ texte pour références PIV/PL/PN3'
    },
    adjointe: {
      position: 'milieu-droite, colonne "ADJOINTE"',
      description: 'Titre "ADJOINTE" en haut. Cases organisées :\n' +
        '- HAUT / BAS (cases position mâchoire)\n' +
        '- PEI (trou / sans trou)\n' +
        '- CIRE D\'OCCLUSION\n' +
        '- STELLITE / ACKERS : montage stellite, finition stellite, finition valplast\n' +
        '- COURONNE MÉTAL COULÉE, GOUTTIÈRE\n' +
        '- VALPLAST / ACKERS\n' +
        '- COMPLET\n' +
        '- RÉSINE : montage résine, finition résine, grille de renfort'
    },
    dents: {
      position: 'milieu-bas, entre conjointe et adjointe',
      description: 'Schéma dentaire FDI avec boutons 18-11 | 21-28 (haut) et 48-41 | 31-38 (bas). Le dentiste coche ou entoure les dents concernées. Parfois les numéros sont écrits à la main à côté des cases cochées dans conjointe/adjointe.'
    },

    // ── BANDE BASSE ──
    teinte: {
      position: 'bas-gauche',
      description: 'Zone "TEINTE" avec 4 illustrations de dents et espace pour écrire la teinte (ex: A2, BL1, 3M2). La teinte est manuscrite, souvent en gros caractères.'
    },
    commentaires: {
      position: 'bas-droite, grande zone',
      description: 'Zone "COMMENTAIRES" — grand espace blanc pour écriture manuscrite libre du dentiste. C\'est ici que le dentiste écrit ses instructions spécifiques : types d\'actes, marques d\'implant, instructions techniques. ZONE LA PLUS IMPORTANTE À LIRE ATTENTIVEMENT — chaque mot compte.'
    },

    // ── PIED DE PAGE ──
    footer: {
      position: 'tout en bas',
      description: 'Adresse du labo : "25 rue Boinod 75018 Paris — laboilovesmile.com — ..." Ignorer cette zone.'
    }
  }
};

// ── Génération du contexte pour le prompt Gemini (images uniquement) ──

function getCarnetsGlobalContext() {
  // Ne s'applique qu'aux images (le template est injecté dans la section image de callGemini)
  var lines = [
    '\n═══ STRUCTURE DU CARNET I LOVE SMILE (format standard des fiches papier) ═══',
    'Ce carnet est TOUJOURS le même format. Voici exactement où chercher chaque information :'
  ];

  var zoneOrder = ['code_labo', 'cabinet', 'praticien', 'patient', 'dates', 'numero', 'flags', 'conjointe', 'adjointe', 'dents', 'teinte', 'commentaires'];
  var zoneLabels = {
    code_labo: 'CODE LABO', cabinet: 'CABINET/DENTISTE', praticien: 'PRATICIEN',
    patient: 'PATIENT', dates: 'DATES', numero: 'N° PRESCRIPTION', flags: 'FLAGS',
    conjointe: 'CONJOINTE', adjointe: 'ADJOINTE', dents: 'DENTS',
    teinte: 'TEINTE', commentaires: 'COMMENTAIRES'
  };

  zoneOrder.forEach(function(key) {
    var zone = CARNET_ILS.zones[key];
    if (!zone) return;
    lines.push('• ' + zoneLabels[key] + ' [' + zone.position + '] : ' + zone.description.split('\n')[0]);
  });

  lines.push('');
  lines.push('⚠️ PRIORITÉ DE LECTURE : 1) COMMENTAIRES manuscrits (bas-droite) 2) Cases cochées (milieu) 3) En-tête (haut)');

  return lines.join('\n');
}

// Fonctions conservées pour compatibilité (plus de UI, templates en dur)
function getCarnetsTemplates() { return [CARNET_ILS]; }
function findCarnetForCabinet() { return CARNET_ILS; }
function getCarnetContextForPrompt() { return getCarnetsGlobalContext(); }
function loadCarnetsFromFirebase() { /* no-op */ }
