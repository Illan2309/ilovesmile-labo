// ── Convertir un PDF base64 en tableau d'images JPEG base64 (via pdf.js + canvas) ──

// Logique code labo : jour du mois → lettre (A=1, B=2, ..., Z=26, AA=27, BB=28, YY=29, TT=30, XX=31)
function getCodeLaboLetterForDay(day) {
  if (day <= 26) return String.fromCharCode(64 + day); // A=1, B=2, ..., Z=26
  const _extras = { 27: 'AA', 28: 'BB', 29: 'YY', 30: 'TT', 31: 'XX' };
  return _extras[day] || 'A';
}

// Auto-incrément du code labo (scan en temps réel, plus de cache)

// Auto-incrément du code labo
function getNextCodeLabo(fournisseur, isScan = false) {
  var now = new Date();
  var lettre = getCodeLaboLetterForDay(now.getDate());
  var prefix = isScan ? 'X' : ''; // X devant pour les scans (PDF/HTML)
  var fullLettre = prefix + lettre;

  // Toujours scanner les prescriptions en temps réel (pas de cache par jour)
  var maxMerdental = 0;
  var maxHuile = 100;

  // Checker : attente + vérifié + importé EN + importé Cogilog (tout sauf supprimé)
  (window.prescriptions || []).forEach(function(p) {
    if (!p.code_labo) return;
    var cl = p.code_labo.toUpperCase();
    // Matcher avec ou sans préfixe X : XA1, A1, XAA101, AA101
    var match = cl.match(/^(X?)([A-Z]{1,2})(\d+)$/);
    if (!match) return;
    var pLettre = match[2];
    if (pLettre !== lettre) return;
    // Si on cherche un code scan (X), ne compter que les X. Si non-scan, ne compter que les non-X.
    var pIsScan = match[1] === 'X';
    if (pIsScan !== isScan) return;
    var num = parseInt(match[3]);
    if (num >= 1 && num <= 99 && num > maxMerdental) maxMerdental = num;
    if (num >= 101 && num <= 199 && num > maxHuile) maxHuile = num;
  });

  // Incrémenter et retourner
  if (fournisseur === 'HUILE') {
    maxHuile++;
    if (maxHuile > 199) maxHuile = 199;
    return fullLettre + maxHuile;
  } else {
    maxMerdental++;
    if (maxMerdental > 99) maxMerdental = 99;
    return fullLettre + maxMerdental;
  }
}

function getCodeLaboContext() {
  const now = new Date();
  const jour = now.getDate();
  const lettre = getCodeLaboLetterForDay(jour);
  // Lettres probables : aujourd'hui (très probable), hier et demain (probable)
  const hier = jour > 1 ? getCodeLaboLetterForDay(jour - 1) : getCodeLaboLetterForDay(31);
  const demain = jour < 31 ? getCodeLaboLetterForDay(jour + 1) : getCodeLaboLetterForDay(1);
  return { jour, lettre, hier, demain };
}

async function callGemini(base64, mediaType, isHTML = false, useFallback = false, cropBase64 = null) {
  const aujourdhui = new Date().toISOString().split('T')[0];
  const anneeActuelle = new Date().getFullYear();
  const codeLaboCtx = getCodeLaboContext();
  const regleCodeLabo = `
⚠️ RÈGLE CODE LABO — LOGIQUE STRICTE
Le code labo suit un format LETTRE + NOMBRE. La lettre correspond au JOUR DU MOIS de la prise d'empreinte :
A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, I=9, J=10, K=11, L=12, M=13, N=14, O=15, P=16, Q=17, R=18, S=19, T=20, U=21, V=22, W=23, X=24, Y=25, Z=26, AA=27, BB=28, YY=29, TT=30, XX=31.
Le nombre indique le fournisseur : 1-99 = MERDENTAL, 101-199 = HUILE.
Aujourd'hui on est le ${codeLaboCtx.jour}, donc la lettre du jour est "${codeLaboCtx.lettre}". Les lettres "${codeLaboCtx.hier}" (hier) et "${codeLaboCtx.demain}" (demain) sont aussi possibles.
Exemples de codes valides : ${codeLaboCtx.lettre}1, ${codeLaboCtx.lettre}2, ${codeLaboCtx.lettre}3 (MERDENTAL) ou ${codeLaboCtx.lettre}101, ${codeLaboCtx.lettre}102 (HUILE).
⚠️ RÈGLE CRITIQUE : lis ce qui est écrit sur la fiche. La lettre du jour sert à DÉPARTAGER les caractères manuscrits ambigus :
- C/G ressemblent → si jour 3 (C), choisir C. Si jour 7 (G), choisir G.
- B/D ressemblent → si jour 2 (B), choisir B. Si jour 4 (D), choisir D.
- I/J, O/Q, P/R → même logique, choisir celle qui correspond au jour.
En revanche, si la lettre est clairement lisible et différente du jour (ex: tu lis nettement "B" le jour 3), garde "B".
Si le code est totalement illisible → mets "" (vide).`;
  const regleDates = `
⚠️ RÈGLE DATES CRITIQUE — date du jour : ${aujourdhui}
- date_empreinte : date lue sur la fiche. Si illisible ou absente, laisser vide. Si l'année est < ${anneeActuelle} ou > ${anneeActuelle + 1}, laisser vide — c'est une erreur de lecture.
- date_livraison — ORDRE DE PRIORITÉ :
  1. Chercher d'abord dans "DATE DE RETOUR" / "DATE DE LIVRAISON" sur la fiche
  2. Si vide → chercher dans "DATE DE RDV ET HEURE" (le rendez-vous patient = date de livraison)
  3. Si les deux sont vides → mettre date_livraison = "" ET sans_date_livraison = true
- Si l'année est aberrante (< ${anneeActuelle} ou > ${anneeActuelle + 1}), laisser vide.
- Une prise d'empreinte est toujours dans les 30 jours AVANT aujourd'hui (${aujourdhui}) ou aujourd'hui.
- Une livraison est toujours dans les 60 jours APRÈS aujourd'hui.
- Ne jamais inventer une date si elle n'est pas clairement lisible sur la fiche.
- ⚠️ Si HÉSITATION entre 2 dates possibles pour la livraison (ex: "21" ou "27" manuscrit ambigu) → TOUJOURS choisir la date la PLUS PROCHE (la plus courte). Mieux vaut livrer trop tôt que trop tard.
- FORMAT ISO SPÉCIAL : si tu vois "Creation date: 2026-03-18T17:47:47Z" → c'est la date d'empreinte, convertir en YYYY-MM-DD (ex: 2026-03-18). Si tu vois "Update date: 2026-03-18T17:47:47Z" → c'est la date de livraison, même conversion. Ne jamais laisser ces champs vides si ces dates sont présentes.`;
  let parts;
  if (isHTML) {
    const htmlText = atob(base64);
    parts = [{ text: `TYPE : Fiche HTML (texte structuré).

SPÉCIFICITÉS HTML :
• Le commentaire du dentiste est LA SOURCE PRIORITAIRE — il prime sur les cases HTML cochées.
• Ordre de lecture : 1) Commentaire du dentiste 2) Cases cochées (checked, selected, class "checked"/"active") 3) Balises <strong>/<b>/surligné 4) Inputs checkbox/radio cochés 5) Mots-clés dans le texte
• En cas de contradiction commentaire vs cases cochées : le commentaire gagne.
• Le numéro de prescription est en haut à DROITE — peut être long (ex: 1573704891_20260311_1805_03_964), copier EN ENTIER.
• Code labo : sur les fiches HTML, mettre UNIQUEMENT la lettre du jour (${codeLaboCtx.lettre} pour aujourd'hui), sans numéro. Le numéro sera complété manuellement.

⚠️ PRATICIEN SUR FICHES HTML — EFFORT OBLIGATOIRE :
Le nom du praticien peut apparaître PARTOUT dans la fiche HTML : en-tête, champ "Praticien", "Docteur", signature, ou même dans le commentaire.
Tu DOIS chercher le praticien dans TOUTE la fiche et le matcher avec la BASE CLIENTS COGILOG ci-dessous.
Même si le nom est abrégé ou mal écrit (ex: "Dr MAT" dans le commentaire → chercher "Dr MATIAS" dans les contacts du cabinet).
Ne JAMAIS mettre "Dr ???" si un nom de docteur apparaît quelque part dans la fiche — fais l'effort de matcher.
${regleDates}

Contenu de la fiche HTML :
${htmlText.substring(0, 10000)}

═══════════════════════════════════════════════
ALIAS PRIORITAIRES (clés en minuscules sans accents) :
${getAliasesText()}

BASE CLIENTS COGILOG :
${getCogilogCompactIndex()}

ALIAS PRODUITS — RÈGLE OBLIGATOIRE :
Si un terme ci-dessous apparaît dans le commentaire du dentiste ou AILLEURS sur la fiche, tu DOIS cocher le(s) produit(s) associé(s). Ces alias sont PRIORITAIRES sur le mapping par défaut. Cherche-les activement dans TOUT le texte de la fiche :
${getProductAliasesText()}` }];
  } else if (mediaType === 'application/pdf') {
    // PDF → convertir en images JPEG via pdf.js (GPT ne supporte pas les PDF natifs)
    const pdfImages = await pdfToImages(base64);
    parts = [];
    for (const imgB64 of pdfImages) {
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: imgB64 } });
    }
    parts.push({ text: `TYPE : Fiche PDF (${pdfImages.length} page(s) converties en images).

SPÉCIFICITÉS PDF :
• Dates au format français JJ/MM/AAAA → convertir en YYYY-MM-DD.
• Si "Creation date: YYYY-MM-DDT..." → date_empreinte. Si "Update date: YYYY-MM-DDT..." → date_livraison.
• Code labo : sur les PDFs, mettre UNIQUEMENT la lettre du jour (${codeLaboCtx.lettre} pour aujourd'hui), sans numéro. Le numéro sera complété manuellement.
${regleDates}

ALIAS PRIORITAIRES (clés en minuscules sans accents) :
${getAliasesText()}

BASE CLIENTS COGILOG :
${getCogilogCompactIndex()}

ALIAS PRODUITS — RÈGLE OBLIGATOIRE :
Si un terme ci-dessous apparaît dans le commentaire du dentiste ou AILLEURS sur la fiche, tu DOIS cocher le(s) produit(s) associé(s). Ces alias sont PRIORITAIRES sur le mapping par défaut. Cherche-les activement dans TOUT le texte de la fiche :
${getProductAliasesText()}` });
  } else {
    parts = [
      { inline_data: { mime_type: mediaType, data: base64 } },
    ];
    // Ajouter le crop zoomé du haut (code labo + cabinet + dentiste)
    if (cropBase64) {
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: cropBase64 } });
      parts.push({ text: '⬆️ IMAGE 2 = ZOOM sur le haut de la fiche (code labo, cabinet, dentiste, patient, dates). Utilise ce zoom pour MIEUX LIRE ces champs.' });
    }
    parts.push({ text: `TYPE : Fiche image (photo ou scan).

⛔⛔⛔ PRIORITÉ N°0 ABSOLUE — CODE LABO ⛔⛔⛔
Le CODE LABO est écrit à la main sur la fiche (souvent en haut à gauche, parfois encadré, parfois entouré).
C'est un code au format LETTRE(S) + NOMBRE. Exemples : C1, C2, C3, C101, C102, AA5.
MÉTHODE DE LECTURE :
1. Cherche un code manuscrit court (1-2 lettres + 1 à 3 chiffres) en haut de la fiche
2. Lis CHAQUE caractère attentivement — ne confonds pas C/G, B/D, I/J, 1/7, 0/O
3. Recopie EXACTEMENT ce que tu lis, même si la lettre ne correspond pas au jour du mois
4. Si VRAIMENT illisible → mets "" (vide). Ne JAMAIS deviner ou inventer un code.
${regleCodeLabo}

SPÉCIFICITÉS IMAGE :
• Dates au format français JJ/MM/AAAA → convertir en YYYY-MM-DD.
${regleDates}

ALIAS PRIORITAIRES (clés en minuscules sans accents) :
${getAliasesText()}

BASE CLIENTS COGILOG :
${getCogilogCompactIndex()}

ALIAS PRODUITS — RÈGLE OBLIGATOIRE :
Si un terme ci-dessous apparaît dans le commentaire du dentiste ou AILLEURS sur la fiche, tu DOIS cocher le(s) produit(s) associé(s). Ces alias sont PRIORITAIRES sur le mapping par défaut. Cherche-les activement dans TOUT le texte de la fiche :
${getProductAliasesText()}

⛔ DENT À EXTRAIRE / ADJONCTION : numéros de dents UNIQUEMENT (jamais haut/bas).
dentsActes["Dent à extraire"] = "26 44" / dentsActes["Adjonction dent"] = "37" / dentsActes["Adjonction crochet"] = "13 23"
${getPromptApprentissage()}` });
  }
  const response = await fetch('https://gemini-proxy.cohenillan29.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
      contents: [{ parts }],
      generationConfig: { temperature: 0.1 },
      _mediaType: mediaType,
      _fallback: useFallback // true = sauter 3.1 Pro, aller direct 2.5
    })
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let errMsg = 'Erreur proxy (' + response.status + ')';
    try { const j = JSON.parse(errBody); errMsg = (j.error?.message || j.error || errMsg); } catch(e) {}
    throw new Error(errMsg);
  }

  // Lire le stream SSE et assembler le texte (ignorer thinking parts + keepalives)
  const _rawText = await response.text();
  let text = '';
  let _lastError = null;
  for (const line of _rawText.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const chunk = JSON.parse(line.slice(6));
      // Vérifier si erreur Gemini dans le stream
      if (chunk.error) { _lastError = chunk.error.message || 'Erreur Gemini'; continue; }
      const parts2 = chunk.candidates?.[0]?.content?.parts || [];
      for (const p2 of parts2) {
        // Ignorer les thinking parts (thought: true), garder uniquement le texte final
        if (p2.thought) continue;
        if (p2.text) text += p2.text;
      }
    } catch(e) { /* chunk partiel ou keepalive, ignorer */ }
  }
  if (!text && _lastError) throw new Error(_lastError);
  if (!text) throw new Error('Réponse Gemini vide — stream reçu (' + _rawText.length + ' chars) mais aucun texte extrait');
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Réponse IA invalide — aucun JSON trouvé');
  try {
    return JSON.parse(jsonMatch[0]);
  } catch(e) {
    throw new Error('JSON invalide dans la réponse IA : ' + e.message);
  }
}

// ── BATCH : envoyer N fiches en 1 requête, recevoir N JSON ──
async function callGeminiBatch(files) {
  // files = [{base64, mediaType, isHTML, fileName}, ...]
  const batchParts = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.isHTML) {
      const htmlText = atob(f.base64);
      batchParts.push({ text: `\n══ FICHE ${i + 1}/${files.length} (${f.fileName}) ══\n${htmlText.substring(0, 10000)}` });
    } else if (f.mediaType === 'application/pdf') {
      // PDF → convertir en images pour GPT
      const pdfImgs = await pdfToImages(f.base64);
      for (const imgB64 of pdfImgs) {
        batchParts.push({ inline_data: { mime_type: 'image/jpeg', data: imgB64 } });
      }
      batchParts.push({ text: `\n══ FICHE ${i + 1}/${files.length} (${f.fileName}) — ${pdfImgs.length} page(s) PDF ══` });
    } else {
      batchParts.push({ inline_data: { mime_type: f.mediaType, data: f.base64 } });
      batchParts.push({ text: `\n══ FICHE ${i + 1}/${files.length} (${f.fileName}) ══` });
    }
  }
  batchParts.push({ text: `\nIl y a ${files.length} fiches ci-dessus. Réponds avec un TABLEAU JSON de ${files.length} objets, un par fiche, dans le même ordre. Format : [{...fiche1...}, {...fiche2...}, ...]. Chaque objet doit suivre le format de prescription habituel.` });

  const response = await fetch('https://gemini-proxy.cohenillan29.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
      contents: [{ parts: batchParts }],
      generationConfig: { temperature: 0.1 },
      _mediaType: 'batch'
    })
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let errMsg = 'Erreur proxy (' + response.status + ')';
    try { const j = JSON.parse(errBody); errMsg = (j.error?.message || j.error || errMsg); } catch(e) {}
    throw new Error(errMsg);
  }

  const _rawText = await response.text();
  let text = '';
  let _lastError = null;
  for (const line of _rawText.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const chunk = JSON.parse(line.slice(6));
      if (chunk.error) { _lastError = chunk.error.message || 'Erreur Gemini'; continue; }
      const parts2 = chunk.candidates?.[0]?.content?.parts || [];
      for (const p2 of parts2) {
        if (p2.thought) continue;
        if (p2.text) text += p2.text;
      }
    } catch(e) {}
  }
  if (!text && _lastError) throw new Error(_lastError);
  if (!text) throw new Error('Batch Gemini vide');

  // Extraire le tableau JSON
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); } catch(e) {}
  }
  // Fallback : extraire tous les objets JSON individuels
  const results = [];
  const re = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try { results.push(JSON.parse(m[0])); } catch(e) {}
  }
  if (results.length === 0) throw new Error('Batch : aucun JSON trouvé dans la réponse');
  return results;
}

// Enforce groupes exclusifs — garde seulement le 1er trouvé si plusieurs cochés
// ---- PARENTS AUTO — si sous-item coché, parent ajouté automatiquement ----
function enforceParents(conjointe, adjointe) {
  // Parents supprimés — plus de cases parent à cocher automatiquement
  const PARENTS_CONJOINTE = {};
  const PARENTS_ADJOINTE = {};

  const c = [...conjointe];
  Object.entries(PARENTS_CONJOINTE).forEach(([child, parent]) => {
    if (c.includes(child) && !c.includes(parent)) c.push(parent);
  });

  const a = [...adjointe];
  Object.entries(PARENTS_ADJOINTE).forEach(([child, parent]) => {
    if (a.includes(child) && !a.includes(parent)) a.push(parent);
  });

  return { conjointe: c, adjointe: a };
}

function enforceGroupesExclusifs(conjointe) {
  const groupes = [
    ['Maquillage sillon oui', 'Maquillage sillon non'],
    ['Embrasure fermée', 'Embrasure ouverte'],
    ['Point de contact fort', 'Point de contact léger'],
    ['Occlusion sous occ', 'Occlusion légère', 'Occlusion forte'],
  ];
  let result = [...conjointe];
  groupes.forEach(groupe => {
    const trouves = result.filter(v => groupe.includes(v));
    if (trouves.length > 1) {
      trouves.slice(1).forEach(v => { result = result.filter(x => x !== v); });
    }
  });
  return result;
}

// Finition par défaut pour stellite/résine/complet/valplast
// Ne garde "montage" que si commentaire contient "essayage" ou "montage"
function enforceFinitionParDefaut(adjointe, commentaires) {
  const comm = commentaires || '';
  const mentionMontage = /essayage|montage/i.test(comm);
  if (mentionMontage) return adjointe;
  const remplacements = {
    'Stellite montage stellite': 'Stellite finition stellite',
    'App résine montage': 'App résine finition',
    'Complet montage': 'Complet finition',
    'Valplast montage': 'Valplast finition',
  };
  return adjointe.map(v => remplacements[v] || v);
}


// ── Post-traitement : cocher les cases depuis le commentaire ──
// L'IA lit bien le commentaire mais oublie parfois de cocher les cases correspondantes
function enforceCommentaireConjointe(conjointe, adjointe, commentaires) {
  if (!commentaires) return { conjointe: conjointe, adjointe: adjointe };
  var c = conjointe.slice();
  var a = adjointe.slice();
  var comm = commentaires.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Aussi verifier les alias produits
  var aliases = {};
  try { aliases = JSON.parse(localStorage.getItem('product_aliases') || '{}'); } catch(e) {}

  // Map terme → case(s) a cocher
  var TERMES_CONJOINTE = {
    'inlay core ceramise': ['Inlay Core', 'Inlay Core céramisé'],
    'inlay core ceramisee': ['Inlay Core', 'Inlay Core céramisé'],
    'ic ceramise': ['Inlay Core', 'Inlay Core céramisé'],
    'ic ceramisee': ['Inlay Core', 'Inlay Core céramisé'],
    'ic ceram': ['Inlay Core', 'Inlay Core céramisé'],
    'icc': ['Inlay Core', 'Inlay Core céramisé'],
    'inlay core clavette': ['Inlay Core', 'Inlay Core clavette'],
    'ic clavette': ['Inlay Core', 'Inlay Core clavette'],
    'inlay core': ['Inlay Core'],
    'ic': ['Inlay Core'],
    'full zircone': ['Full zirconium'],
    'full zircon': ['Full zirconium'],
    'monolithique': ['Full zirconium'],
    'ccc': ['Zirconium CCC'],
    'zircon ccc': ['Zirconium CCC'],
    'zircone stratifie': ['Zirconium CCC'],
    'ccm': ['CCM'],
    'ceramo metalique': ['CCM'],
    'ceramo-metalique': ['CCM'],
    'emax': ['EMAX'],
    'e-max': ['EMAX'],
    'e.max': ['EMAX'],
    'dent provisoire': ['Dent provisoire'],
    'provisoire': ['Dent provisoire'],
    'richmond': ['Richmond'],
    'facette ceramique': ['Facette céramique'],
    'facette composite': ['Facette composite'],
    'onlay ceramique': ['Inlay Onlay céramique'],
    'onlay composite': ['Inlay Onlay composite'],
    'inlay onlay': ['Inlay Onlay céramique'],
    'ceramique rose': ['Ceramic Rose Collet'],
    'rose collet': ['Ceramic Rose Collet'],
    'sous occ': ['Occlusion sous occ'],
    'sous ocl': ['Occlusion sous occ'],
    'sous occlusion': ['Occlusion sous occ'],
    'occlusion legere': ['Occlusion légère'],
    'occlusion forte': ['Occlusion forte'],
    'maquillage sillon': ['Maquillage sillon oui'],
    'maquillage ceram': ['Maquillage sillon oui'],
    'maquillage': ['Maquillage sillon oui'],
    'embrasure fermee': ['Embrasure fermée'],
    'embrasure ouverte': ['Embrasure ouverte'],
    'point de contact fort': ['Point de contact fort'],
    'point de contact leger': ['Point de contact léger'],
    'limite sous gingival': ['Limite sous gingival'],
    'fraisage': ['Fraisage'],
    'epaulement': ['Épaulement céram.'],
  };
  var TERMES_ADJOINTE = {
    'stellite': ['Stellite finition stellite'],
    'valplast': ['Valplast finition'],
    'gouttiere souple': ['Gouttière souple'],
    'gouttiere dure': ['Gouttière dur résine'],
    'gouttiere resine': ['Gouttière dur résine'],
    'blanchiment': ['Blanchissement'],
    'pei': ['PEI'],
    'cire d\'occlusion': ['Cire d\'occlusion'],
    'cire occlusion': ['Cire d\'occlusion'],
    'reparation': ['Réparation'],
    'rebasage': ['Rebasage'],
    'app resine': ['App résine finition'],
    'complet': ['Complet finition'],
    'adjonction dent': ['Adjonction dent'],
    'adjonction crochet': ['Adjonction crochet'],
  };

  // Verifier aussi les alias produits
  Object.entries(aliases).forEach(function(e) {
    var terme = e[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var produits = e[1] || [];
    if (_matchTerme(comm, terme)) {
      produits.forEach(function(p) {
        if (!c.includes(p) && !a.includes(p)) {
          // Determiner si c'est conjointe ou adjointe
          if (Object.values(TERMES_ADJOINTE).some(function(arr) { return arr.includes(p); })) {
            if (!a.includes(p)) { a.push(p); console.log('[POST-TRAIT] Alias produit "' + terme + '" → coche adjointe: ' + p); }
          } else {
            if (!c.includes(p)) { c.push(p); console.log('[POST-TRAIT] Alias produit "' + terme + '" → coche conjointe: ' + p); }
          }
        }
      });
    }
  });

  // Helper : matcher un terme dans le commentaire (word boundary pour termes courts)
  function _matchTerme(commentaire, terme) {
    if (terme.length <= 3) {
      // Termes courts (IC, CCC, CCM) : word boundary pour eviter faux positifs
      var re = new RegExp('(?:^|[^a-z])' + terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z])', 'i');
      return re.test(commentaire);
    }
    return commentaire.includes(terme);
  }

  // Scanner le commentaire pour les termes conjointe
  Object.entries(TERMES_CONJOINTE).forEach(function(e) {
    var terme = e[0];
    var cases = e[1];
    if (_matchTerme(comm, terme)) {
      cases.forEach(function(cs) {
        if (!c.includes(cs)) {
          c.push(cs);
          console.log('[POST-TRAIT] Commentaire contient "' + terme + '" → coche: ' + cs);
        }
      });
    }
  });

  // Scanner le commentaire pour les termes adjointe
  Object.entries(TERMES_ADJOINTE).forEach(function(e) {
    var terme = e[0];
    var cases = e[1];
    if (_matchTerme(comm, terme)) {
      cases.forEach(function(cs) {
        if (!a.includes(cs)) {
          a.push(cs);
          console.log('[POST-TRAIT] Commentaire contient "' + terme + '" → coche adjointe: ' + cs);
        }
      });
    }
  });

  return { conjointe: c, adjointe: a };
}

// ── Conflits dents conjointe ──
// Regle metier : sur une meme dent, seuls Inlay Core (+ sous-items),
// Ceramic Rose Collet, Fraisage, scelle et transvisse peuvent coexister
// avec d'autres actes. Les autres actes principaux sont exclusifs entre eux.
function enforceConflitsDentsConjointe(conjointe, dentsActes) {
  if (!dentsActes || typeof dentsActes !== 'object') return { conjointe: conjointe, dentsActes: dentsActes };

  // Actes qui peuvent coexister sur une meme dent avec n'importe quoi
  var COMPATIBLES = [
    'Inlay Core', 'Inlay Core céramisé', 'Inlay Core clavette',
    'Ceramic Rose Collet', 'Céram. Rose Collet', 'Fraisage',
    'Implant scellé', 'Implant transvisé',
    'Épaulement céram.',
    'Unitaire', 'Solidaire',
    'Maquillage sillon oui', 'Maquillage sillon non',
    'Point de contact fort', 'Point de contact léger',
    'Occlusion sous occ', 'Occlusion légère', 'Occlusion forte',
    'Embrasure fermée', 'Embrasure ouverte', 'Limite sous gingival'
  ];

  // Actes exclusifs (ne peuvent pas partager une dent entre eux)
  var EXCLUSIFS = [
    'CCM', 'CIV', 'Couronne coulée', 'EMAX', 'Zirconium CCC', 'Full zirconium',
    'Dent provisoire', 'Implant CCM', 'Implant CCC',
    'Inlay Onlay composite', 'Inlay Onlay céramique', 'Inlay Onlay métal',
    'Facette composite', 'Facette céramique', 'Richmond', 'Armature'
  ];

  // Construire un index : dent → [actes exclusifs presents]
  var dentExclusifs = {};
  EXCLUSIFS.forEach(function(acte) {
    var val = dentsActes[acte];
    if (!val) return;
    // Parser les dents (ex: "14 15 16" ou "14-16")
    var dents = [];
    String(val).replace(/\d{2}/g, function(d) { dents.push(parseInt(d)); });
    dents.forEach(function(d) {
      if (!dentExclusifs[d]) dentExclusifs[d] = [];
      dentExclusifs[d].push(acte);
    });
  });

  // Pour chaque dent avec > 1 acte exclusif, garder le premier et retirer les autres
  var actesARetirer = {};
  Object.entries(dentExclusifs).forEach(function(entry) {
    var dent = entry[0];
    var actes = entry[1];
    if (actes.length <= 1) return;
    // Garder le premier, retirer les suivants de cette dent
    for (var i = 1; i < actes.length; i++) {
      var acte = actes[i];
      if (!actesARetirer[acte]) actesARetirer[acte] = [];
      actesARetirer[acte].push(parseInt(dent));
      console.log('[CONFLIT DENT] Dent ' + dent + ' : retrait de "' + acte + '" (conflit avec "' + actes[0] + '")');
    }
  });

  // Appliquer les retraits
  var newDentsActes = Object.assign({}, dentsActes);
  var newConjointe = conjointe.slice();

  Object.entries(actesARetirer).forEach(function(entry) {
    var acte = entry[0];
    var dentsARetirer = entry[1];
    var val = newDentsActes[acte];
    if (!val) return;
    // Retirer les dents en conflit de la valeur
    var remaining = [];
    String(val).replace(/\d{2}/g, function(d) {
      if (!dentsARetirer.includes(parseInt(d))) remaining.push(d);
    });
    if (remaining.length === 0) {
      // Plus aucune dent → retirer l'acte completement
      delete newDentsActes[acte];
      newConjointe = newConjointe.filter(function(c) { return c !== acte; });
      console.log('[CONFLIT DENT] Acte "' + acte + '" retire completement (plus de dents)');
    } else {
      newDentsActes[acte] = remaining.join(' ');
    }
  });

  return { conjointe: newConjointe, dentsActes: newDentsActes };
}

// ── Post-traitement scan IA ──
// 1. Propager machoire globale aux items adjointe qui n'ont pas de position
function _postTraiterDentsActes(dentsActes, adjointe, machoireGlobal) {
  const result = Object.assign({}, dentsActes);
  // Nettoyer les parents qui ne doivent pas avoir de dents
  const PARENTS_SANS_DENTS = ['Inlay Onlay','Facette','Implant CCM','Implant CCC',
    'Stellite','App résine','Complet','Valplast','Gouttière','Adjonction'];
  PARENTS_SANS_DENTS.forEach(function(p) { delete result[p]; });
  const machBase = (machoireGlobal || '').toLowerCase();
  if (!machBase) return result;
  // Items qui ne doivent JAMAIS hériter de la mâchoire globale (dents seules)
  const ITEMS_SANS_MACHOIRE = ['Dent à extraire', 'Adjonction dent', 'Adjonction crochet'];
  // Tous les actes adjointe sans position → héritent de machoire global
  adjointe.forEach(acte => {
    // Ne pas remplir les parents sans dents
    if (PARENTS_SANS_DENTS.includes(acte)) return;
    // Dent à extraire / Adjonction : jamais de mâchoire, dents seules
    if (ITEMS_SANS_MACHOIRE.includes(acte)) return;
    if (!result[acte]) {
      // Pas de détail → mettre la position globale
      result[acte] = machBase;
    } else {
      // A une valeur mais c'est peut-être juste des dents sans position
      const v = result[acte];
      if (!['haut','bas','haut+bas'].some(p => v === p || v.startsWith(p+'|'))) {
        // C'est des dents seules → combiner avec machoire : "haut|37"
        result[acte] = machBase + '|' + v;
      }
    }
  });
  return result;
}

// 2. Déduire solidGroups depuis dentsActes si l'IA ne l'a pas rempli
function _postTraiterSolidGroups(solidGroups, conjointe, dentsActes) {
  if (solidGroups && solidGroups.length > 0) return solidGroups; // IA a déjà rempli
  // Essayer de déduire depuis les actes principaux
  const hasSolid = conjointe.includes('Solidaire');
  const hasUnit  = conjointe.includes('Unitaire');
  if (!hasSolid && !hasUnit) return [];

  const MAINS = ['CCM','Couronne coulée','EMAX','Zirconium CCC','Full zirconium',
    'Dent provisoire','Implant CCM','Implant CCC'];
  const groups = [];

  // Collecter toutes les dents des actes principaux
  const allDentsMap = {}; // acte → [dents]
  MAINS.forEach(acte => {
    const raw = dentsActes[acte] || '';
    if (raw) {
      const dents = raw.trim().split(/[\s,]+/).map(Number).filter(d => d >= 11 && d <= 48);
      if (dents.length) allDentsMap[acte] = dents;
    }
  });

  const allDents = [...new Set(Object.values(allDentsMap).flat())].sort((a,b) => a-b);
  if (!allDents.length) return [];

  if (hasSolid && !hasUnit && allDents.length > 1) {
    // Tout solidaire
    groups.push({ type: 'solid', dents: allDents });
  } else if (hasUnit && !hasSolid) {
    // Tout unitaire : un groupe par dent
    allDents.forEach(d => groups.push({ type: 'unit', dents: [d] }));
  }
  // Si les deux cochés → l'IA devait remplir solidGroups, on ne peut pas déduire
  return groups;
}

function _autoScanPos(dents) {
  if (!dents || dents.length === 0) return '';
  const h = dents.some(d => d >= 11 && d <= 28);
  const b = dents.some(d => d >= 31 && d <= 48);
  if (h && b) return 'haut+bas';
  if (h) return 'haut';
  if (b) return 'bas';
  return '';
}
