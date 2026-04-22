// ===== COGILOG EXPORT =====

// Liste de tous les actes conjointe + adjointe
var ACTES_CONJOINTE = [
  'CCM','Épaulement céram.','Couronne coulée','EMAX','Zirconium CCC','Full zirconium',
  'Dent provisoire','Implant CCM','Implant CCC','Implant scellé','Implant transvisé',
  'Inlay Core céramisé','Inlay Core clavette','Inlay Onlay','Inlay Onlay composite',
  'Inlay Onlay céramique','Facette','Facette composite','Facette céramique',
  'Ceramic Rose Collet','Unitaire','Solidaire','Armature','Richmond'
];
var ACTES_ADJOINTE = [
  'PEI','Cire d\'occlusion','Réparation','Rebasage','Adjonction','Gouttière',
  'Gouttière souple','Gouttière dur résine','Gouttière souple intra dur extra',
  'Blanchissement','Contention','Dent à extraire','Stellite','Ackers stellite',
  'Stellite montage stellite','Stellite finition stellite','Stellite sup. valplast',
  'App résine','Ackers résine','App résine montage','App résine finition',
  'App résine grille de renfort','Complet','Complet montage','Complet finition',
  'Complet grille de renfort','Valplast','Ackers valplast','Valplast montage',
  'Valplast finition','Valplast grille de renfort'
];
var TOUS_ACTES = [
  ...ACTES_CONJOINTE.map(a => ({ acte: a, cat: 'Prothèse conjointe' })),
  ...ACTES_ADJOINTE.map(a => ({ acte: a, cat: 'Prothèse adjointe' }))
];

// Mapping par défaut actes → codes produits Cogilog



// ---- Codes produits Cogilog ----
var COGILOG_CODES_DEFAULT = {
  // ══ CONJOINTE ══════════════════════════════════════════
  // Couronnes principales
  'CCM':                    '1-CCM',
  'CIV':                    'CIV',
  'Couronne coulée':        '3-CCCOULE',
  'EMAX':                   '1-CCEMAX',
  'Zirconium CCC':          '1-CCZI',
  'Full zirconium':         '1-CCZIF',
  'Dent provisoire':        '3-DP',
  'Richmond':               '3-CCRICH',
  'Ceramic Rose Collet':    '3-CERG',

  // Implants CCM — le sous-item scellé/transvisé détermine le code
  'Implant CCM':            '2-CCMI',   // parent seul = scellé par défaut
  'Implant scellé':         '2-CCMI',   // sous-item → remplace le code parent
  'Implant transvisé':      '2-CCMIT',  // sous-item → remplace le code parent

  // Implants CCC — même logique
  'Implant CCC':            '2-CCCIZ',  // parent seul = scellé par défaut
  // sous-items gérés dynamiquement dans l'export (scellé → 2-CCCIZ, transvisé → 2-CCCIZT)

  // Inlay Core
  'Inlay Core':             '1-IC',     // parent seul
  'Inlay Core céramisé':    '1-ICCER',
  'Inlay Core clavette':    '1-IC',     // IC normal + CL ajouté automatiquement en section 8

  // Inlay Onlay
  'Inlay Onlay':            '',         // parent → pas de ligne propre
  'Inlay Onlay composite':  '1-OCO',
  'Inlay Onlay céramique':  '1-OE',
  'Inlay Onlay métal':      '1-OE',

  // Facettes
  'Facette':                'FCR',      // parent seul = composite par défaut
  'Facette composite':      'FCR',
  'Facette céramique':      'FE',

  // Articles EN PLUS (s'ajoutent à la couronne, ne la remplacent pas)
  'Épaulement céram.':      'EC',       // EN PLUS de la couronne
  'Ailette métal':          '3-AIME',

  // Cases sans ligne produit Cogilog
  'Unitaire':               '',
  'Solidaire':              '',
  'Armature':               '',
  'Maquillage sillon oui':  '',
  'Maquillage sillon non':  '',
  'Point de contact fort':  '',
  'Point de contact léger': '',
  'Occlusion sous occ':     '',
  'Occlusion légère':       '',
  'Occlusion forte':        '',
  'Embrasure fermée':       '',
  'Embrasure ouverte':      '',
  'Limite sous gingival':   '',

  // ══ ADJOINTE ═══════════════════════════════════════════
  // PEI / Cire
  'PEI':                    '1-PEI',
  "Cire d'occlusion":       '1-CIRE',
  // Combinaison PEI + Cire → 1-PEICIRE (géré dynamiquement dans l'export)

  // Stellite
  'Stellite plaque nue':        'STPN',
  'Stellite':                   '',         // case mère : pas de ligne propre si sous-article présent
  'Stellite finition':          '1-STFDC',
  'Stellite montage stellite':  '8-000ESSST',
  'Stellite finition stellite': '1-STFDC',  // finition = article tout fini dents comprises
  'Stellite sup. valplast':     'STVAL',
  'Ackers stellite':            '',          // info structurelle, pas de code propre
  'Stellite Valplast':          'STVAL',

  // App résine (PAP)
  'App résine':             '1-PAP1',
  'App résine finition':    '1-PAP1',
  'Ackers résine':          '',

  // Complet
  'Complet résine':         '2-COMPL',
  'Complet':                '2-COMPL',
  'Complet finition':       '2-COMPL',

  // Valplast
  'Valplast':               '1-VALPLAST',
  'Valplast finition':      '1-VALPLAST',
  'Ackers valplast':        '',

  // Gouttières
  'Gouttière souple':                 '1-GOB',
  'Gouttière dur résine':             '1-GORD',
  'Gouttière souple intra dur extra': '1-GORD',  // intra souple / extra dur → code gouttière dure
  'Blanchissement':                   '1-GOBL',
  'Contention':                       '1-GORC',

  // Grille renfort → GM en plus de l'article mère
  'App résine grille de renfort':   'GM',
  'Complet grille de renfort':      'GM',
  'Valplast grille de renfort':     'GM',

  // Essayage (montage explicite)
  'App résine montage':     '8-000ESSPAP',
  'Complet montage':        '8-000ESSCO',
  'Valplast montage':       '8-000ESSVA',

  // Divers
  'Réparation':             'REP',
  'Rebasage':               'RE',
  'Fraisage':               'FR',
  'PIV':                    'FR',
  'Scan':                   'FS',
  'Adjonction dent':        'RA',
  'Adjonction':             'RA',
  'Adjonction crochet':     'ACRO',
};

function sauvegarderCodesCogilogData(codes) {
  try { localStorage.setItem('cogilog_codes', JSON.stringify(codes)); } catch(e) {}
}

function chargerCodesCogilog() {
  try {
    const saved = localStorage.getItem('cogilog_codes');
    if (saved) {
      // Merger : les defaults ont priorité pour les nouvelles clés
      const savedObj = JSON.parse(saved);
      return { ...COGILOG_CODES_DEFAULT, ...savedObj };
    }
  } catch(e) {}
  sauvegarderCodesCogilogData(COGILOG_CODES_DEFAULT);
  return { ...COGILOG_CODES_DEFAULT };
}

// ---- Autocomplete clients Cogilog ----
// GLOBAL pour accès depuis handlers dynamiques
window.filtrerClientsCogilog = function filtrerClientsCogilog(val) {
  const box = document.getElementById('cogilog-suggestions');
  if (!box) return;
  if (!val || val.length < 1) { box.style.display = 'none'; return; }
  const q = val.toLowerCase();
  // COGILOG_CLIENTS est un objet {code: [données...]} — col[1]=code, col[3]=nom
  const matches = Object.entries(COGILOG_CLIENTS)
    .filter(([code, data]) =>
      code.toLowerCase().includes(q) || (data[3] || '').toLowerCase().includes(q)
    )
    .slice(0, 10);
  if (!matches.length) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(([code, data]) => {
    const nom = data[3] || '';
    const safeCode = code.replace(/"/g, '&quot;');
    return `<div onmousedown="choisirClientCogilog('${safeCode}')"
      style="padding:7px 10px;cursor:pointer;font-size:0.75rem;border-bottom:1px solid #eee;display:flex;justify-content:space-between;gap:8px;"
      onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background=''">
      <span style="font-weight:600;color:var(--accent);white-space:nowrap;">${code}<\/span>
      <span style="color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nom}<\/span>
    <\/div>`;
  }).join('');
  box.style.display = 'block';
}

window.choisirClientCogilog = function choisirClientCogilog(code) {
  const inp = document.getElementById('code-cogilog');
  if (inp) inp.value = code;
  fermerSuggestionsCogilog();
}

// ---- PRATICIENS DROPDOWN ----
// Retourne les praticiens du cabinet actuellement sélectionné

window.getPraticiensDuCabinet = function() {
  const nomCabinet = (document.getElementById('cabinet')?.value || '').trim();
  if (!nomCabinet) return [];

  // Utiliser CONTACTS (mis à jour depuis Firebase) en priorité
  const source = (typeof CONTACTS !== 'undefined' && Object.keys(CONTACTS).length)
    ? CONTACTS : CONTACTS_DENTISTES;

  const nomUp = nomCabinet.toUpperCase();

  // 1. Correspondance exacte
  let matchKey = Object.keys(source).find(k => k.toUpperCase() === nomUp);

  // 2. Correspondance partielle (le nom du cabinet contient la clé ou vice versa)
  if (!matchKey) {
    matchKey = Object.keys(source).find(k =>
      nomUp.includes(k.toUpperCase()) || k.toUpperCase().includes(nomUp)
    );
  }

  // 3. Correspondance par mots (ex: "Brie" matche "BRIE")
  if (!matchKey) {
    const words = nomUp.split(/\s+/).filter(w => w.length > 2);
    matchKey = Object.keys(source).find(k =>
      words.some(w => k.toUpperCase().includes(w))
    );
  }

  if (!matchKey) return [];
  return (source[matchKey] || []).map(nom => ({ nom }));
}

window.ouvrirPraticiens = function ouvrirPraticiens() {
  const praticiens = getPraticiensDuCabinet();
  const val = document.getElementById('praticien')?.value || '';
  if (praticiens.length > 0) {
    afficherSuggestionsPraticiens(praticiens);
  } else if (val.length > 0) {
    filtrerPraticiens(val);
  }
}

window.filtrerPraticiens = function filtrerPraticiens(val) {
  const box = document.getElementById('praticien-suggestions');
  if (!box) return;
  // D'abord chercher dans le cabinet sélectionné
  let praticiens = getPraticiensDuCabinet();
  if (val && val.length > 0) {
    const q = val.toLowerCase();
    if (praticiens.length > 0) {
      praticiens = praticiens.filter(p => p.nom.toLowerCase().includes(q));
    } else {
      // Sinon chercher dans tous les clients
      praticiens = Object.entries(COGILOG_CLIENTS)
        .filter(([code, data]) => {
          const prenom = (data[15] || '').toLowerCase();
          const nom = (data[14] || '').toLowerCase();
          return prenom.includes(q) || nom.includes(q);
        })
        .slice(0, 10)
        .map(([code, data]) => ({
          code,
          nom: [(data[15] || '').trim(), (data[14] || '').trim()].filter(Boolean).join(' ') || data[3],
          email: ''
        }));
    }
  }
  if (!praticiens.length) { box.style.display = 'none'; return; }
  afficherSuggestionsPraticiens(praticiens);
}

window.afficherSuggestionsPraticiens = function afficherSuggestionsPraticiens(praticiens) {
  const box = document.getElementById('praticien-suggestions');
  if (!box || !praticiens.length) return;
  box.innerHTML = praticiens.map(p => {
    const safeNom = _enc(p.nom);
    return `<div onmousedown="choisirPraticien(decodeURIComponent('${safeNom}'))"
      style="padding:7px 10px;cursor:pointer;font-size:0.75rem;border-bottom:1px solid #eee;display:flex;align-items:center;gap:8px;"
      onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background=''">
      <span style="font-weight:600;color:var(--accent);">Dr.<\/span>
      <span style="color:#333;">${p.nom}<\/span>
    <\/div>`;
  }).join('');
  box.style.display = 'block';
}

window.choisirPraticien = function choisirPraticien(nom) {
  const inp = document.getElementById('praticien');
  if (inp) inp.value = nom;
  fermerSuggestionsPraticiens();
}

window.fermerSuggestionsPraticiens = function fermerSuggestionsPraticiens() {
  const box = document.getElementById('praticien-suggestions');
  if (box) box.style.display = 'none';
}


function exportCogilogTSV() {
  const selected = [...document.querySelectorAll('.prescription-cb:checked')]
    .map(cb => prescriptions[parseInt(cb.dataset.index)])
    .filter(Boolean);

  if (selected.length === 0) {
    showToast('Sélectionne des prescriptions dans la liste avant d\'exporter.', true);
    return;
  }

  if (selected.length > 100) {
    if (!confirm('Attention : ' + selected.length + ' bons sélectionnés, c\'est beaucoup.\nC\'est peut-être une erreur. Continuer l\'export Cogilog ?')) return;
  }

  const lignes = [];
  const sansCodes = [];

  // ── Section Clients complète (données réelles Cogilog) ──
  lignes.push(['**Gestion', 'Clients', '**Modifier']);
  lignes.push(['#Catégorie','Code','Préfixe','Nom du client','Numéro (adresse)','Voie (adresse)','Complément (adresse)','Complément (adresse)','Code postal','Ville','Cedex','Pays','Contact principal sexe','Contact principal civilité','Contact principal nom','Contact principal prénom','Contact principal fonction','Téléphone 1','Téléphone 2','Fax','E-mail','Préfixe intracom','SIRET','Compte comptable','Préfixe (adresse facturation)','Nom (adresse facturation)','Complément 1 (adresse facturation)','Numéro (adresse facturation)','Voie (adresse facturation)','Complément 2 (adresse facturation)','Code Postal (adresse facturation)','Ville (adresse facturation)','Cedex (adresse facturation)','Pays (adresse facturation)','exonéré éco-contribution','Vide','Vide','Vide','Vide','Vide','Vide','Vide','Vide','Vide','Vide','Vide','Vide','Vide','Vide','Vide','Vide','Nom de la banque 1','Code banque','Code guichet','N° de compte banque','Clé RIB','Mode de facturation','Mode de paiement (texte)','Remise type','Taux de remise générale','Délai','Nombre de jours','Paiement','Jour','Découvert autorisé','Avertir découvert','Relance 1','Relance 2','Relance 3','Relance 4','Nom du commercial','Prénom du commercial','Facture','Devis','Pro forma','Bon commande','Bon livraison','Conf. commande','Notation','Notes','Taux escompte','Nbre exemplaires factures','Texte 1','Texte 2','Texte 3','Texte 4','Texte 5','Texte 6','Texte 7','Texte 8','Texte 9','Nombre 1','Nombre 2','Nombre 3','Nombre 4','Nombre 5','Nombre 6','Nombre 7','Nombre 8','Nombre 9','Date 1','Date 2','Date 3','Date 4','Date 5','Date 6','Date 7','Date 8','Date 9','Pénalités','Client bloqué','IBAN 1','BIC 1','Date mandat prélèvements 1','Dossier attaché','Nom de la banque 2','IBAN 2','BIC 2','Date mandat prélèvements 2','Nom de la banque 3','IBAN 3','BIC 3','Date mandat prélèvements 3','Nom de la banque 4','IBAN 4','BIC 4','Date mandat prélèvements 4','Nbre exemplaires devis','Nbre exemplaires factures pro forma','Nbre exemplaires bons de commande','Nbre exemplaires bons de livraison','Nbre exemplaires confirmations de commandes','RUM 1','RUM 2','RUM 3','RUM 4','Site web',"Compte d'acompte",'Marqueur']);
  // Ajouter les vraies données clients pour chaque prescription exportée
  const clientsDejaAjoutes = new Set();
  var _nbColsClient = 140;
  // Colonnes avec valeurs par defaut obligatoires si vides
  var _defaultColsClient = {
    60: '0', 61: '0', 62: '0', 63: '10',   // Delai, Nombre de jours, Paiement, Jour
    64: '0,00',                              // Taux remise
    65: 'NON',                               // Decouvert autorise
    66: '30', 67: '15', 68: '10', 69: '7',  // Relance 1-4
    91: '0', 92: '0', 93: '0', 94: '0', 95: '0', 96: '0', 97: '0', 98: '0', 99: '0' // Nombre 1-9
  };
  for (const p of selected) {
    const cc = (p.code_cogilog || '').trim();
    if (cc && !clientsDejaAjoutes.has(cc) && COGILOG_CLIENTS[cc]) {
      var clientRow = COGILOG_CLIENTS[cc].slice();
      while (clientRow.length < _nbColsClient) clientRow.push('');
      // Forcer les valeurs par defaut sur les colonnes critiques
      Object.entries(_defaultColsClient).forEach(function(e) {
        var ci = parseInt(e[0]), dv = e[1];
        if (!clientRow[ci] && clientRow[ci] !== '0') clientRow[ci] = dv;
      });
      lignes.push(clientRow);
      clientsDejaAjoutes.add(cc);
    }
  }
  // ── Section Bons de commande ──
  lignes.push(['**Gestion', 'Bons de commande']);
  lignes.push(['#Date pièce','Code client','Mode facturation','Paiement proposé','Date échéance','Acompte','Taux remise','Taux escompte','Commercial ou acheteur','Compte comptable','Civilité','Nom','Numéro','Voie','Complément 1','Complément 2','Code postal','Ville','Cedex','Pays','Téléphone','Fax','E-mail','Intracom','SIRET','Nom livraison','Numéro livraison','Voie livraison','Complément livraison','Complément livraison','Code postal livraison','Ville livraison','Cedex livraison','Pays livraison','Nom remise','Banque','Code banque','Code guichet','Compte banque','Clé banque','Message','Référence','Contact','Commentaires','Notes','Texte 1','Texte 2','Texte 3','Texte 4','Texte 5','Texte 6','Texte 7','Texte 8','Texte 9','Nombre 1','Nombre 2','Nombre 3','Nombre 4','Nombre 5','Nombre 6','Nombre 7','Nombre 8','Nombre 9','Date 1','Date 2','Date 3','Date 4','Date 5','Date 6','Date 7','Date 8','Date 9','IBAN','BIC','Contact livraison','Code affaire','Retenue','Service livraison','Téléphone livraison','Imprimée','Verrouillée','Archivée','Date heure transfert en comptabilité','Relance 1','Relance 2','Relance 3','Relance 4','Préfixe (adresse facturation)','Nom (adresse facturation)','Complément 1 (adresse facturation)','Numéro (adresse facturation)','Voie (adresse facturation)','Complément 2 (adresse facturation)','Code Postal (adresse facturation)','Ville (adresse facturation)','Cedex (adresse facturation)','Pays (adresse facturation)','Téléphone 2','Fonction contact','Numéro de pièce','Importer totaux','Net ht','Montant TVA','Marge','Montant TAd1','Montant TAd2','Mouvementer stock','Importer solde','Solde','N° commande site marchand','Nom site marchand','État commande site marchand','Date et heure commande site marchand',"Compte d'acompte",'Adresse e-mail livraison','ID commande site marchand','exonéré d’éco-contribution','Lien','Libre','Réservé','Réservé','Réservé','Prénom et nom signataire','Email signataire']);
  lignes.push(['#','Code produit','Libellé','Prix unitaire ht','Unité','Quantité','Taux remise','Code tva','Taux tva',"Prix d'achat",'Date 1','Date 2','Nombre 1','Nombre 2','Nombre 3','Nombre 4','Nombre 5','Nombre 6','Nombre 7','Texte 1','Texte 2','Texte 3','Texte 4','Texte 5','Texte 6','Texte 7','Texte 8','Texte 9','Section analytique','Style','Référence','Sous-total','Plusieurs lignes','Exclure remise générale','Avancement','Coefficient','Libre','Avancement précédent','Longueur','Hauteur','Epaisseur','Coefficient','Code taxe add1','Taux taxe add1','Code taxe add2','Taux taxe add2','TVA sur marge']);

  for (const p of selected) {
    // Cloner les codes pour chaque prescription (évite pollution entre bons à refaire et normaux)
    const codes = { ...chargerCodesCogilog() };

    const codeClient = (p.code_cogilog || '').trim();
    if (!codeClient) sansCodes.push(p.code_labo || p.numero || '?');

    const praticien = (p.praticien || '').trim();
    const nomPatient = p.patient?.nom ? p.patient.nom.toUpperCase() : '';
    const numPresc = (p.numero || '').replace('N° ', '');

    // Dates au format JJ/MM/AAAA — avec validation stricte
    const _dl = p.dates?.livraison || '';
    const _fmtDate = (iso) => {
      if (!iso) return new Date().toLocaleDateString('fr-FR');
      const mISO = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mISO) {
        const yi = parseInt(mISO[1]), mi = parseInt(mISO[2]), di = parseInt(mISO[3]);
        if (yi >= 2000 && yi <= 2099 && mi >= 1 && mi <= 12 && di >= 1 && di <= 31)
          return String(di).padStart(2,'0') + '/' + String(mi).padStart(2,'0') + '/' + yi;
      }
      const mFR = iso.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (mFR) {
        const di = parseInt(mFR[1]), mi = parseInt(mFR[2]), yi = parseInt(mFR[3]);
        if (yi >= 2000 && yi <= 2099 && mi >= 1 && mi <= 12 && di >= 1 && di <= 31) return iso;
      }
      return new Date().toLocaleDateString('fr-FR');
    };
    const dateLivraison = _fmtDate(_dl);
    const datePiece = dateLivraison; // date pièce = date livraison

    const dentsStr = p.dents && p.dents.length > 0
      ? p.dents.filter(d => d !== null && d !== undefined && !Number.isNaN(Number(d))).map(d => String(d)).join(', ')
      : '';
    const teinte = p.teinte || '';

    // ── Ligne pièce (bon de commande) — structure exacte Cogilog (116 cols) ──
    // Calquée colonne par colonne sur le vrai bon Cogilog (4382/AZAR01)
    const lp = new Array(116).fill('');
    lp[0]   = datePiece;       // Date pièce (JJ/MM/AAAA)
    lp[1]   = codeClient;      // Code client
    lp[2]   = '5';             // Mode facturation
    lp[5]   = '0,00';          // Acompte
    lp[7]   = '0,00';          // Taux escompte
    // cols 8..22 : infos cabinet laissées vides, Cogilog remplit depuis sa base
    // Remplir les infos client depuis COGILOG_CLIENTS
    const clientData = COGILOG_CLIENTS[codeClient] || [];
    if (clientData.length > 0) {
      lp[8]  = (clientData[70] || '') + (clientData[71] ? ' ' + clientData[71] : ''); // commercial
      lp[9]  = clientData[23] || '';   // compte comptable
      lp[10] = clientData[0]  || '';   // catégorie/civilité
      lp[11] = clientData[3]  || '';   // nom client
      lp[12] = clientData[4]  || '';   // numéro adresse
      lp[13] = clientData[5]  || '';   // voie
      lp[14] = clientData[6]  || '';   // complément
      lp[16] = clientData[8]  || '';   // code postal
      lp[17] = clientData[9]  || '';   // ville
      lp[19] = clientData[11] || '';   // pays
      lp[20] = clientData[17] || '';   // téléphone
      lp[22] = clientData[20] || '';   // email
      lp[34] = clientData[58] || '';   // nom livraison
      lp[113] = clientData[137] || ''; // compte acompte
    }
    // Padding code labo : si se termine par 1 chiffre, ajouter un 0 (Q2→Q02, XW9→XW09)
    const _padCodeLabo = (c) => c ? c.replace(/([A-Za-z])(\d)$/, '$10$2') : c;
    lp[41]  = _padCodeLabo((p.code_labo || numPresc).trim()); // Référence → code labo
    lp[42]  = praticien;       // Contact → praticien
    lp[54]  = '0'; lp[55] = '0'; lp[56] = '0'; lp[57] = '0';
    lp[58]  = '0'; lp[59] = '0'; lp[60] = '0'; lp[61] = '0'; lp[62] = '0';
    lp[76]  = '0,00';          // Retenue
    lp[79]  = 'NON';           // Imprimée
    lp[80]  = 'NON';           // Verrouillée
    lp[81]  = 'NON';           // Archivée
    // col 99 : Numéro de pièce → vide = CRÉATION (nécessite abonnement import Cogilog)
    lp[100] = 'NON';           // Importer totaux
    lp[101] = '0,00'; lp[102] = '0,00'; lp[103] = '0,00';
    lp[104] = '0,00'; lp[105] = '0,00';
    lp[106] = 'OUI';           // Mouvementer stock
    lp[107] = 'NON';           // Importer solde
    lp[108] = '0,00';          // Solde
    lp[111] = '0';             // État commande
    lp[113] = lp[113] || ('419' + codeClient); // Compte d'acompte (priorité données client)
    lp[115] = '0';             // ID commande
    // Cols 116-123 : Libre, Réservé x3, Prénom signataire, Email signataire (vides)
    lignes.push(lp);

    // ── Lignes produit ──
    // Col  0 : vide (la ligne produit commence par une cellule vide = ligne détail)
    // Col  1 : Code produit
    // Col  2 : Libellé
    // Col  3 : Prix unitaire HT (0)
    // Col  4 : Unité (vide)
    // Col  5 : Quantité
    // Col  6 : Taux remise (0,000000000)
    // Col  7 : Code TVA (0)
    // Col  8 : Taux TVA (0,00)
    // Col  9 : Prix d'achat (0)
    // Col 19 : Texte 1 → praticien
    // Col 20 : Texte 2 → nom patient
    // Col 21 : Texte 3 → dents
    // Col 22 : Texte 4 → teinte

    const tousActes = [...new Set([...(p.conjointe || []), ...(p.adjointe || [])])];
    const actesAvecCode = tousActes.filter(acte => codes[acte] && codes[acte].trim() !== '');

    // Articles adjointe → quantité = 1 appareil (pas comptage par dent)
    // NOTE : RA (Adjonction dent) et ACRO (Adjonction crochet) NE sont PAS ici —
    // ils se comptent par dent/crochet ajoute (2 dents = qty 2), pas par appareil.
    const ARTICLES_MACHOIRE = new Set([
      '1-GOB','1-GORD','1-GOBL','1-GORC','1-GORD',
      '1-VALPLAST','1-PAP1','1-PAP11A3','2-COMPL','2-COMPLV','2-COMPSTEPN',
      'STPN','1-STFDC','STVAL','1-PEI','1-PEICIRE','1-CIRE',
      'GM','REP','RE','RM','CRAC','CRM','CRVALP',
      '8-000ESSST','8-000ESSPAP','8-000ESSCO','8-000ESSVA','8-000',
      '1GORO','GOBO','1-GORC','1GOAM','PDH','MED','4-PROORTHO',
      // Codes "a refaire" des articles amovibles (quantite = 1, pas par dent)
      '9-00STE','9-00STEVAL','9-00VAL','9-00COMP','9-00PAP1','9-00GOU','9-00GOUD',
    ]);

    // COGILOG_LIBELLES : utilise la version globale (ligne 5465) qui contient tous les codes avec les bons noms
    const buildLigneProd = (codeProd, libelle, qty) => {
      // Articles amovibles (adjointe) → quantité = 1 par défaut, SAUF haut+bas → 2
      const isAmovible = ARTICLES_MACHOIRE.has(codeProd);
      let rawD = (p.dentsActes || {})[libelle] || (p.dentsActes || {})[codeProd] || '';
      // Implant : dents dans les sous-items (scellé/transvisé), pas dans le parent
      if (!rawD && (libelle === 'Implant CCM' || libelle === 'Implant CCC')) {
        rawD = (p.dentsActes || {})['Implant transvisé'] || (p.dentsActes || {})['Implant scellé'] || '';
      }
      // Couronne sur implant (EMAX/Full Zircon/Provisoire avec code 2-*) : aussi chercher dents implant
      if (!rawD && codeProd && codeProd.startsWith('2-')) {
        rawD = (p.dentsActes || {})['Implant transvisé'] || (p.dentsActes || {})['Implant scellé'] || '';
      }
      const _posRaw = rawD.includes('|') ? rawD.split('|')[0].trim() : rawD;

      if (isAmovible) {
        // Amovible haut+bas → quantité 2
        if (_posRaw === 'haut+bas') qty = 2;
      } else if (!qty || qty === 1) {
        // Conjointe : déduire depuis dentsActes
        const cleanD = rawD.includes('|') ? rawD.split('|').pop().trim() : rawD;
        if (cleanD && !['haut','bas','haut+bas'].includes(cleanD)) {
          // Retirer les parenthèses (format solidaire) avant de compter
          const _cleanNoParen = cleanD.replace(/[()]/g, '').replace(/-/g, ' ');
          const d = _cleanNoParen.trim().split(/[,\s]+/).filter(x => /^\d+$/.test(x));
          if (d.length > 1) qty = d.length;
        } else if (cleanD === 'haut+bas') qty = 2;
      }
      qty = qty || 1;
      // Utiliser le libellé exact Cogilog si disponible
      libelle = COGILOG_LIBELLES[codeProd] || libelle;
      // Col 0 = VIDE, col 1 = code produit, col 2 = libellé (structure exacte vrai Cogilog)
      const lc = new Array(48).fill('');
      lc[0]  = '';               // VIDE obligatoire en col 0
      lc[1]  = codeProd;         // code produit
      lc[2]  = libelle;          // libellé
      // lc[3] = prix → vide = Cogilog prend son prix fiche client
      lc[5]  = String(qty);      // quantité (col 5 = Quantité)
      lc[6]  = '0,000000000';   // taux remise
      lc[7]  = '0';              // code TVA
      lc[8]  = '0,00';           // taux TVA
      // Remplir le prix depuis la table TARIFS si disponible
      // Articles "à refaire" (9-xx) → prix à 0€ + style Rouge dans Cogilog
      if (codeProd === '__IC_REFAIRE__') {
        // Inlay Core à refaire : code 1-IC, prix 0, style Rouge
        lc[1] = '1-IC';
        lc[2] = COGILOG_LIBELLES['1-IC'] || 'INLAY CORE METAL';
        lc[3] = '0';
        lc[29] = ';0;1;1;0;1;0.501963;0.000000;0.008128';
      } else if (codeProd.startsWith('__REFAIRE_') && codeProd.endsWith('__')) {
        // Article sans code 9-xx mais marqué à refaire → prix 0 + Rouge
        const vraiCode = codeProd.slice(10, -2); // enlever __REFAIRE_ et __
        lc[1] = vraiCode;
        lc[2] = COGILOG_LIBELLES[vraiCode] || libelle;
        lc[3] = '0';
        lc[29] = ';0;1;1;0;1;0.501963;0.000000;0.008128';
      } else if (codeProd.startsWith('9-')) {
        lc[3] = '0';
        lc[29] = ';0;1;1;0;1;0.501963;0.000000;0.008128';
      } else {
        // Essayer p.cabinet → code Cogilog → nom résolu depuis Cogilog
        const nomPourTarif = (p.cabinet || '').trim()
          || getCabinetFromCodeCogilog(codeClient)
          || '';
        // Chercher le prix : d'abord par nom cabinet, puis par code Cogilog
        let prixTarif = getTarif(nomPourTarif, codeProd);
        if (prixTarif === null && codeClient) prixTarif = getTarif(codeClient, codeProd);
        if (prixTarif !== null && prixTarif > 0) {
          lc[3] = String(prixTarif).replace('.', ',');
        }
      }
      lc[9]  = '0';              // prix achat
      lc[12] = '0'; lc[13] = '0'; lc[14] = '0'; lc[15] = '0';
      lc[16] = '0'; lc[17] = '0'; lc[18] = '0';
      // Dents : utiliser rawD (deja resolu avec fallback implant)
      var detailActe = rawD || '';
      // Nettoyer : retirer position machoire, garder que les dents
      if (detailActe.includes('|')) detailActe = detailActe.split('|').pop().trim();
      if (['haut','bas','haut+bas'].includes(detailActe)) detailActe = '';
      lc[23] = detailActe;  // dents uniquement depuis dentsActes
      lc[27] = teinte;           // teinte (Texte 9)
      lc[31] = '0'; lc[32] = '0';
      lc[33] = 'NON';
      lc[34] = '100,00';
      lc[35] = '1,00';
      lc[37] = '0';
      lc[38] = '1'; lc[39] = '1'; lc[40] = '1'; lc[41] = '1';
      lc[42] = '0'; lc[43] = '0,00'; lc[44] = '0'; lc[45] = '0,00';
      lc[46] = 'NON';
      return lc;
    };

    // Ligne étoiles avec infos praticien/patient/numéro (comme dans le vrai bon Cogilog)
    // Col 0='0', Col 1='****', Col 19=praticien, Col 20=nomPatient, Col 21=numPresc
    const ligneInfo = buildLigneProd('0', '**************************************************');
    ligneInfo[3]  = '0';          // col 3 = 0
    ligneInfo[5]  = '0';          // quantité = 0 sur ligne étoiles
    ligneInfo[21] = praticien;    // Texte 3 = praticien
    ligneInfo[23] = '';           // pas de dents
    ligneInfo[24] = nomPatient;   // Texte 6 = nom patient
    ligneInfo[26] = numPresc.replace('N° ','').replace(/\s*\(\d+\)\s*$/, '').slice(-9).replace(/_/g, '-'); // 9 derniers chars, sans (1)/(2), _ → -
    ligneInfo[27] = '';           // pas de teinte
    lignes.push(ligneInfo);

    // ── Logique dynamique ─────────────────────────────────

    // PEI et Cire → toujours 2 lignes séparées (1-PEI + 1-CIRE), chacune avec sa qty haut/bas
    const actesNormalises = [...tousActes];

    // 2. Scan → pas d'article Scan pour l'instant, logique à implémenter plus tard

    // 3. Implant : scellé/transvisé détermine le code selon le type de couronne
    const hasScelle    = tousActes.includes('Implant scellé');
    const hasTransvise = tousActes.includes('Implant transvisé');
    const hasImplantSub = hasScelle || hasTransvise;
    if (tousActes.includes('Implant CCM')) {
      codes['Implant CCM'] = hasTransvise ? '2-CCMIT' : '2-CCMI';
    }
    if (tousActes.includes('Implant CCC')) {
      codes['Implant CCC'] = hasTransvise ? '2-CCCIZT' : '2-CCCIZ';
    }
    // Couronne sur implant sans Implant CCM/CCC coché : EMAX, Full Zircon, Dent provisoire
    if (hasImplantSub && !tousActes.includes('Implant CCM') && !tousActes.includes('Implant CCC')) {
      if (tousActes.includes('EMAX')) {
        codes['EMAX'] = hasTransvise ? '2-CCEMAXIT' : '2-CCEMAXIS';
      }
      if (tousActes.includes('Full zirconium')) {
        codes['Full zirconium'] = hasTransvise ? '2-CCCFULLIT' : '2-CCCFULLIS';
      }
      if (tousActes.includes('Dent provisoire')) {
        codes['Dent provisoire'] = hasTransvise ? '2-DPIT' : '2-DPIS';
      }
    }

    // 4. À refaire → code 9-00X selon l'article principal
    const aRefaireMap = {
      '1-CCM': '9-00CCM', '1-CCEMAX': '9-00EMAX', '1-CCZI': '9-00ZIR',
      '1-CCZIF': '9-00ZIRF', '2-CCMI': '9-00CCMIS', '2-CCMIT': '9-00CCMIT',
      '2-CCCIZ': '9-00ZIRIS', '2-CCCIZT': '9-00ZIRIT', '1-GOB': '9-00GOU',
      '1-GORD': '9-00GOUD', '1-OCO': '9-00ONC', '1-OE': '9-00ONCER',
      '1-PAP1': '9-00PAP1', 'STPN': '9-00STE', '1-STFDC': '9-00STE',
      'STVAL': '9-00STEVAL', '1-VALPLAST': '9-00VAL', '2-COMPL': '9-00COMP',
    };

    // 5. Produits annexes (depuis les cases cochées dans la popup Annexes)
    const produitsAnnexes = (p.produitsAnnexes || []).slice();
    const produitsAnnexesDents = p.produitsAnnexesDents || {};

    // 6. Filtrer les parents si sous-articles présents, et articles vides
    const actesAvecCodeFiltres = actesNormalises.filter(acte => {
      const code = codes[acte];
      if (!code || code.trim() === '') return false; // pas de code = pas de ligne
      if (acte === 'Inlay Onlay' && (tousActes.includes('Inlay Onlay composite') || tousActes.includes('Inlay Onlay céramique') || tousActes.includes('Inlay Onlay métal'))) return false;
      if (acte === 'Inlay Core' && (tousActes.includes('Inlay Core céramisé') || tousActes.includes('Inlay Core clavette'))) return false;
      // Stellite mère → supprimée si finition ou montage présent
      if (acte === 'Stellite' && (tousActes.includes('Stellite finition stellite') || tousActes.includes('Stellite montage stellite') || tousActes.includes('Stellite sup. valplast'))) return false;
      // Valplast/App résine/Complet mère → supprimée si finition ou montage présent
      if (acte === 'Valplast' && (tousActes.includes('Valplast finition') || tousActes.includes('Valplast montage'))) return false;
      if (acte === 'App résine' && (tousActes.includes('App résine finition') || tousActes.includes('App résine montage'))) return false;
      if ((acte === 'Complet' || acte === 'Complet résine') && (tousActes.includes('Complet finition') || tousActes.includes('Complet montage'))) return false;
      if (acte === 'Implant scellé' || acte === 'Implant transvisé') return false; // géré via parent
      return true;
    });

    // 7. À refaire ─────────────────────────────────────────────────────────────
    // Règle simple :
    //   p.aRefaire !== true  → on ne touche à rien, codes normaux
    //   p.aRefaire === true  → on applique les codes à refaire sur les articles concernés
    //     aRefaireActes null/undefined → TOUS les articles
    //     aRefaireActes [...]          → seulement les articles de la liste
    //   IC / ICCER : pas de code 9-00 dans Cogilog → on garde 1-IC mais prix 0 + Rouge

    // toRefaire : objet { acte: dentsArr } ou null (tout) ou false (pas à refaire)
    // Rétrocompatibilité : ancien format string[] → objet { acte: [] }
    let toRefaire = false;
    if (p.aRefaire === true) {
      if (p.aRefaireActes === null || p.aRefaireActes === undefined) {
        toRefaire = null; // tout à refaire
      } else if (Array.isArray(p.aRefaireActes)) {
        // Ancien format string[] → objet { acte: [] }
        toRefaire = {};
        p.aRefaireActes.forEach(a => { toRefaire[a] = []; });
      } else if (typeof p.aRefaireActes === 'object') {
        toRefaire = p.aRefaireActes; // nouveau format objet
      }
    }

    // Map des actes à splitter : { acte: { redoDents: [...], normalDents: [...] } }
    const _splitRefaire = {};

    if (p.aRefaire === true) {
      for (const acte of actesAvecCodeFiltres) {
        // Vérifier si cet acte est à refaire
        const isRefaire = (toRefaire === null) || (toRefaire && acte in toRefaire);
        if (!isRefaire) continue;

        // Récupérer les dents redo spécifiques (vide = toutes)
        const redoDents = (toRefaire !== null && toRefaire[acte] && toRefaire[acte].length > 0)
          ? toRefaire[acte].map(Number)
          : null; // null = toutes les dents

        // Récupérer les dents totales de l'acte
        const detailActe = (p.dentsActes || {})[acte] || '';
        const allDentsStr = detailActe.toString().replace(/^(haut|bas)(\+\w+)?\|?/, '').trim();
        const allDents = allDentsStr.match(/\d{2}/g)?.map(Number) || [];

        if (redoDents && allDents.length > 0) {
          // Split : certaines dents redo, d'autres normales
          const normalDents = allDents.filter(d => !redoDents.includes(d));
          if (normalDents.length > 0) {
            // On doit splitter cet acte en 2 lignes
            _splitRefaire[acte] = { redoDents, normalDents };
            // Ne PAS changer le code global — sera géré dans la boucle de génération
            continue;
          }
        }

        // Pas de split (toutes les dents à refaire) → comportement actuel
        const code = codes[acte];
        if (aRefaireMap[code]) {
          codes[acte] = aRefaireMap[code];
        } else if (code === '1-IC' || code === '1-ICCER') {
          codes[acte] = '__IC_REFAIRE__';
        } else if (code) {
          codes[acte] = '__REFAIRE_' + code + '__';
        }
      }
    }

    // 8. Inlay Core clavette → ajouter CL en plus de 1-IC
    const actesFinaux = [...actesAvecCodeFiltres];
    if (tousActes.includes('Inlay Core clavette') && !actesFinaux.includes('__CL_EXTRA__')) {
      actesFinaux.push('__CL_EXTRA__');
      codes['__CL_EXTRA__'] = 'CL';
    }
    // Épaulement → déjà dans la liste normalement, s'ajoute en plus

    // 9. Dents : conjointe = numéros FDI, adjointe = haut/bas/haut bas selon mâchoire
    const estSolidaire = tousActes.includes('Solidaire');
    const dentsFormate = estSolidaire && dentsStr ? '(' + dentsStr + ')' : dentsStr;

    // Articles adjointe → on affiche mâchoire au lieu des dents (ARTICLES_MACHOIRE déclaré plus haut)
    const machoireVals = Array.isArray(p.machoire) ? p.machoire : (p.machoire ? [p.machoire] : []);
    let machoireStr = '';
    if (machoireVals.length > 0) {
      const hauts = machoireVals.filter(v => v === 'haut');
      const bas   = machoireVals.filter(v => v === 'bas');
      if (hauts.length && bas.length) machoireStr = 'haut bas';
      else if (hauts.length) machoireStr = 'haut';
      else if (bas.length) machoireStr = 'bas';
    }

    // 10. Générer les lignes produit
    const quantites = p.quantites || {};

    // Formater les dents solidarisées en groupes (ex: "(34-35) (44-45)")
    const _formatDentsSolid = (dentsActeStr) => {
      if (!dentsActeStr) return dentsFormate;
      const nums = dentsActeStr.trim().split(/[,\s]+/).filter(x => /^\d+$/.test(x)).map(Number);
      if (nums.length === 0) return dentsFormate;
      const groups = (p.solidGroups || []);
      if (!estSolidaire || groups.length === 0) return nums.join(' ');
      // Associer chaque dent à son groupe solidaire
      const dentToGroup = {};
      groups.forEach((g, i) => { (g.dents || []).forEach(d => { dentToGroup[d] = i; }); });
      // Regrouper les dents de cet acte par solidGroup
      const buckets = {};
      const noGroup = [];
      nums.forEach(d => {
        if (dentToGroup[d] !== undefined) {
          const gi = dentToGroup[d];
          if (!buckets[gi]) buckets[gi] = [];
          buckets[gi].push(d);
        } else {
          noGroup.push(d);
        }
      });
      const parts = [];
      Object.keys(buckets).sort((a,b) => a-b).forEach(gi => {
        const sorted = buckets[gi].sort((a,b) => a-b);
        parts.push('(' + sorted.join('-') + ')');
      });
      if (noGroup.length) parts.push(noGroup.join(' '));
      return parts.join(' ');
    };

    // Helper : remplir la colonne dents d'une ligne produit
    const _fillDents = (lc, acte, code, dentsOverride) => {
      const detailActe = dentsOverride || (p.dentsActes || {})[acte] || (p.dentsActes || {})[code] || '';
      if (detailActe) {
        const pipeIdx = detailActe.indexOf('|');
        if (pipeIdx >= 0) {
          const mPart = detailActe.substring(0, pipeIdx).trim();
          const dPart = detailActe.substring(pipeIdx + 1).trim();
          lc[23] = (mPart ? mPart + ' ' : '') + dPart;
        } else if (ARTICLES_MACHOIRE.has(code)) {
          lc[23] = detailActe;
        } else {
          lc[23] = _formatDentsSolid(detailActe);
        }
      } else if (ARTICLES_MACHOIRE.has(code) && machoireStr) {
        lc[23] = machoireStr;
      }
    };

    if (actesFinaux.length > 0) {
      for (const acte of actesFinaux) {
        // Vérifier si cet acte doit être splitté (certaines dents redo, d'autres normales)
        if (_splitRefaire[acte]) {
          const split = _splitRefaire[acte];
          const origCode = codes[acte]; // code normal (non modifié car split)

          // Ligne 1 : dents redo → code 9-xx, prix 0, Rouge
          const redoCode = aRefaireMap[origCode] || ('__REFAIRE_' + origCode + '__');
          const lcRedo = buildLigneProd(redoCode, acte, split.redoDents.length);
          _fillDents(lcRedo, acte, redoCode, split.redoDents.join(' '));
          lignes.push(lcRedo);

          // Ligne 2 : dents normales → code normal, prix normal
          const lcNorm = buildLigneProd(origCode, acte, split.normalDents.length);
          _fillDents(lcNorm, acte, origCode, split.normalDents.join(' '));
          lignes.push(lcNorm);
        } else {
          // Pas de split → comportement normal
          const code = codes[acte];
          const qty = quantites[acte] || 1;
          const lc = buildLigneProd(code, acte, qty);
          _fillDents(lc, acte, code, null);
          lignes.push(lc);
        }
      }
    } else if (tousActes.length > 0) {
      lignes.push(buildLigneProd('0', tousActes.join(' / ')));
    }

    // 11. Produits annexes (cases cochées dans la popup Annexes)
    for (const code of produitsAnnexes) {
      // Vérifier si ce produit annexe est marqué "à refaire"
      const annexeLabel = (typeof PRODUITS_ANNEXES !== 'undefined' ? PRODUITS_ANNEXES : []).find(pa => pa.code === code);
      const annexeName = annexeLabel ? annexeLabel.label : code;
      const isAnnexeRefaire = (toRefaire !== false) && (toRefaire === null || toRefaire.has(annexeName));
      // Calculer la quantité : nombre de dents ou positions (haut+bas=2, haut=1, 14 15 16=3)
      const dentVal = produitsAnnexesDents[code] || '';
      let annexeQty = 1;
      if (dentVal) {
        if (dentVal.includes('+')) {
          annexeQty = dentVal.split('+').length; // haut+bas = 2
        } else if (/^\d/.test(dentVal.trim())) {
          annexeQty = dentVal.trim().split(/[\s,|]+/).filter(Boolean).length; // 14 15 16 = 3
        }
      }
      const lc = buildLigneProd(
        isAnnexeRefaire ? ('__REFAIRE_' + code + '__') : code,
        COGILOG_LIBELLES[code] || code,
        annexeQty
      );
      // Appliquer les dents/mâchoire si renseignées
      if (dentVal) lc[23] = dentVal;
      lignes.push(lc);
    }

    // 12. Scan → ligne produit FS (position depuis scanPosition ou détection auto par dents)
    if (p.scan === true) {
      let scanPos = (p.scanPosition || '').trim();
      // Fallback : détecter haut/bas depuis les dents si pas de position manuelle
      if (!scanPos) {
        const dentsArr = p.dents || [];
        const hasHaut = dentsArr.some(d => d >= 11 && d <= 28);
        const hasBas  = dentsArr.some(d => d >= 31 && d <= 48);
        if (hasHaut && hasBas) scanPos = 'haut+bas';
        else if (hasHaut) scanPos = 'haut';
        else if (hasBas) scanPos = 'bas';
      }
      if (scanPos === 'haut+bas') {
        const lScan = buildLigneProd('FS', 'Scan', 2);
        lScan[23] = 'haut bas';
        lignes.push(lScan);
      } else if (scanPos === 'haut' || scanPos === 'bas') {
        const lScan = buildLigneProd('FS', 'Scan', 1);
        lScan[23] = scanPos;
        lignes.push(lScan);
      } else {
        lignes.push(buildLigneProd('FS', 'Scan', 1));
      }
    }

    // Note : les commentaires ne sont pas exportés dans le bon Cogilog
  }

  // Bloquer l'export si des codes Cogilog manquent
  if (sansCodes.length > 0) {
    showToast('⛔ Export bloqué — Code Cogilog manquant sur : ' + sansCodes.join(', '), true);
    return;
  }

  // Génération TSV en MacRoman (encodage natif Cogilog Mac)
  const tsv = lignes.map(l => l.join('\t')).join('\r\n');
  // Table de conversion UTF-16 → MacRoman pour les caractères accentués français
  const macRomanMap = {
    0xC0:'\xCB', 0xC1:'\xE7', 0xC2:'\xE5', 0xC3:'\xCC', 0xC4:'\x80', 0xC5:'\x81',
    0xC6:'\xAE', 0xC7:'\x82', 0xC8:'\xE9', 0xC9:'\x83', 0xCA:'\xE6', 0xCB:'\xE8',
    0xCC:'\xED', 0xCD:'\xEA', 0xCE:'\xEB', 0xCF:'\xEC',
    0xD0:'\xEE', 0xD1:'\x84', 0xD2:'\xF1', 0xD3:'\xEF', 0xD4:'\xF2', 0xD5:'\xF3',
    0xD6:'\x85', 0xD8:'\xAF', 0xD9:'\xF4', 0xDA:'\xF5', 0xDB:'\xF6', 0xDC:'\x86',
    0xDD:'\xF8', 0xDE:'\xFA',
    0xDF:'\xA7', 0xE0:'\x88', 0xE1:'\x87', 0xE2:'\x89', 0xE3:'\x8B', 0xE4:'\x8A',
    0xE5:'\x8C', 0xE6:'\xBE', 0xE7:'\x8D', 0xE8:'\x8F', 0xE9:'\x8E', 0xEA:'\x90',
    0xEB:'\x91', 0xEC:'\x93', 0xED:'\x92', 0xEE:'\x94', 0xEF:'\x95',
    0xF0:'\xFF', 0xF1:'\x96', 0xF2:'\x98', 0xF3:'\x97', 0xF4:'\x99', 0xF5:'\x9B',
    0xF6:'\x9A', 0xF8:'\xBF', 0xF9:'\x9D', 0xFA:'\x9C', 0xFB:'\x9E', 0xFC:'\x9F',
    0xFD:'\xFC', 0xFE:'\xFB', 0xFF:'\xD8',
    0x152:'\xCE', 0x153:'\xCF', 0x178:'\xD9', 0x2019:'\xD5', 0x2018:'\xD4',
    0x201C:'\xD2', 0x201D:'\xD3', 0x2013:'\xD0', 0x2014:'\xD1', 0x20AC:'\xDB',
  };
  const bytes = new Uint8Array(tsv.length * 2);
  let byteLen = 0;
  for (let i = 0; i < tsv.length; i++) {
    const code = tsv.charCodeAt(i);
    if (code < 128) {
      bytes[byteLen++] = code;
    } else if (macRomanMap[code] !== undefined) {
      bytes[byteLen++] = macRomanMap[code].charCodeAt(0);
    } else if (code < 256) {
      bytes[byteLen++] = code;
    } else {
      bytes[byteLen++] = 63; // '?'
    }
  }
  const blob = new Blob([bytes.slice(0, byteLen)], { type: 'text/plain;charset=x-mac-roman' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const today = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
  link.download = 'BonsCommande_Cogilog_' + today + '.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Sauvegarder snapshot pour undo avant de modifier
  undoPush('Export Cogilog (' + selected.length + ' bons)', selected, ['cogilog_exporte']);

  // Marquer les prescriptions comme exportées vers Cogilog
  for (const p of selected) {
    p.cogilog_exporte = true;
    if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(p);
  }
  renderList();

  showToast('✅ Export Cogilog généré (' + selected.length + ' bon(s)) 🌼 — ↩ bouton Annuler disponible');
}

