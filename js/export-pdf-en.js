// ---- TRADUCTION AUTO COMMENTAIRES FR → EN via Gemini ----
// Convertit un dataUrl HTML en JPEG compressé via html2canvas
async function convertirHtmlEnImage(htmlDataUrl) {
  return new Promise((resolve) => {
    try {
      const htmlContent = atob(htmlDataUrl.split(',')[1]);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:1100px;border:none;visibility:hidden;';
      document.body.appendChild(iframe);
      iframe.onload = async () => {
        try {
          const canvas = await html2canvas(iframe.contentDocument.body, {
            width: 800, height: 1100, scale: 1,
            useCORS: true, logging: false, backgroundColor: '#ffffff'
          });
          // JPEG qualité 0.6 → très économe en espace
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
          resolve(jpegDataUrl);
        } catch(e) {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      iframe.src = url;
    } catch(e) {
      resolve(null);
    }
  });
}

async function retraduireCommentaire() {
  const ta = document.getElementById('commentaires');
  const edit = document.getElementById('commentaires-edit');
  // Utiliser la popup si ouverte, sinon le textarea principal
  var source = (edit && document.getElementById('commentaire-popup')?.style.display === 'flex') ? edit : ta;
  if (!source) return;
  const fr = source.value.split('--- EN ---')[0].trim();
  if (!fr) { showToast('Aucun commentaire à traduire.', true); return; }
  source.value = fr + '\n--- EN (traduction en cours...) ---';
  showToast('🔄 Traduction en cours...');
  try {
    const en = await _traduireGemini(fr, true); // forceFullTranslation = true (l'utilisateur a écrit ce qu'il veut voir traduit)
    source.value = fr + '\n--- EN ---\n' + (en || '');
    if (ta) ta.value = source.value;
    showToast(en ? '✅ Traduction mise à jour !' : '✅ Rien à traduire');
  } catch(e) {
    source.value = fr;
    if (ta) ta.value = fr;
    showToast('⚠️ Erreur traduction.', true);
  }
}

// Traduction automatique EN basée sur les cases cochées (plus fiable que Gemini)
function buildCommentaireEN() {
  var parts = [];
  var conjointe = [...document.querySelectorAll('input[name="conjointe"]:checked')].map(c => c.value);
  var adjointe = [...document.querySelectorAll('input[name="adjointe"]:checked')].map(c => c.value);
  var da = window._dentsActesCourant || {};
  var solidGrps = window._solidGroups || [];

  // Actes conjointe principaux avec dents
  var TRAD = {
    'CCM':'PFM','Couronne coulée':'FCC','EMAX':'EMAX','Zirconium CCC':'Zirconia',
    'Full zirconium':'Full zirconia','Dent provisoire':'Temporary crown',
    'Implant CCM':'Implant PFM','Implant CCC':'Implant zirconia',
    'Implant scellé':'cement-retained','Implant transvisé':'screw-retained',
    'Inlay Core':'Post core','Inlay Core céramisé':'ceramised','Inlay Core clavette':'pin keys',
    'Inlay Onlay':'Inlay Onlay','Inlay Onlay composite':'composite','Inlay Onlay céramique':'ceramic',
    'Inlay Onlay métal':'metal','Facette':'Veneer','Facette composite':'composite',
    'Facette céramique':'ceramic','Épaulement céram.':'porcelain shoulder',
    'Ceramic Rose Collet':'Pink ceramic collet','CIV':'CIV','Fraisage':'Milling',
    'Armature':'Framework','Richmond':'Richmond',
    'Stellite':'CCP','Stellite montage stellite':'CCP set up',
    'Stellite finition stellite':'CCP finish','Stellite sup. valplast':'CCP finish valplast',
    'Ackers stellite':'CCP ackers',
    'App résine':'Acrylic denture','App résine montage':'Acrylic denture try-in',
    'App résine finition':'Acrylic denture finish','App résine grille de renfort':'Acrylic denture mesh',
    'Ackers résine':'Acrylic denture ackers',
    'Complet':'Complet','Complet montage':'Complet try-in',
    'Complet finition':'Complet finish','Complet grille de renfort':'Complet mesh',
    'Valplast':'Valplast','Valplast montage':'Valplast try-in',
    'Valplast finition':'Valplast finish','Valplast grille de renfort':'Valplast mesh',
    'Ackers valplast':'Valplast ackers','Crochet valplast':'Valplast clasp',
    'Gouttière':'Guttery','Gouttière souple':'Guttery soft','Gouttière dur résine':'Guttery hard resin',
    'Gouttière souple intra dur extra':'Guttery hard top soft inside',
    'Blanchissement':'Bleaching guttery','Contention':'GUTTERY thinner',
    'PEI':'Custom tray',
    'Réparation':'Repair','Rebasage':'Reline','Dent à extraire':'Cut teeth',
    'Adjonction':'Addition','Adjonction dent':'Tooth addition','Adjonction crochet':'Clasp addition',
    "Cire d'occlusion":'Bite wax'
  };

  var SKIP = new Set(['Unitaire','Solidaire','Maquillage sillon oui','Maquillage sillon non',
    'Point de contact fort','Point de contact léger','Occlusion sous occ','Occlusion légère',
    'Occlusion forte','Embrasure fermée','Embrasure ouverte','Limite sous gingival',
    'Stellite','App résine','Complet','Valplast','Gouttière','Adjonction',
    'Inlay Onlay','Facette','Implant CCM','Implant CCC']);
  // Actes qui ne peuvent JAMAIS être solidarisés
  var NO_SPLINT = new Set(['Inlay Core','Inlay Core céramisé','Inlay Core clavette',
    'Inlay Onlay','Inlay Onlay composite','Inlay Onlay céramique','Inlay Onlay métal',
    'Facette','Facette composite','Facette céramique','Ceramic Rose Collet','Fraisage',
    'Épaulement céram.','Ailette métal']);

  // Grouper des dents consécutives par arc : [34,35,44,45] → "34-35/44-45"
  var FDI_ARC_H = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  var FDI_ARC_B = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  function formatDentsGrouped(dentsList) {
    if (!dentsList.length) return '';
    // Trier dans l'ordre anatomique
    var sorted = dentsList.slice().sort(function(a,b) {
      var ia = FDI_ARC_H.indexOf(a), ib = FDI_ARC_H.indexOf(b);
      if (ia === -1) ia = FDI_ARC_H.length + FDI_ARC_B.indexOf(a);
      if (ib === -1) ib = FDI_ARC_H.length + FDI_ARC_B.indexOf(b);
      return ia - ib;
    });
    // Grouper les consécutifs dans le même arc
    var runs = [];
    var cur = [sorted[0]];
    for (var i = 1; i < sorted.length; i++) {
      var prev = cur[cur.length - 1], next = sorted[i];
      var arcH = FDI_ARC_H, arcB = FDI_ARC_B;
      var pi = arcH.indexOf(prev), ni = arcH.indexOf(next);
      if (pi === -1 || ni === -1) { pi = arcB.indexOf(prev); ni = arcB.indexOf(next); }
      if (pi !== -1 && ni !== -1 && Math.abs(ni - pi) === 1) {
        cur.push(next);
      } else {
        runs.push(cur);
        cur = [next];
      }
    }
    runs.push(cur);
    return runs.map(function(r) {
      return r.length === 1 ? String(r[0]) : r[0] + '-' + r[r.length-1];
    }).join('/');
  }

  // Parents à masquer si un sous-item est coché
  var PARENT_SUBS = {
    'Stellite': ['Stellite montage stellite','Stellite finition stellite','Stellite sup. valplast','Ackers stellite'],
    'App résine': ['App résine montage','App résine finition','App résine grille de renfort','Ackers résine'],
    'Complet': ['Complet montage','Complet finition','Complet grille de renfort'],
    'Valplast': ['Valplast montage','Valplast finition','Valplast grille de renfort','Ackers valplast','Crochet valplast'],
    'Gouttière': ['Gouttière souple','Gouttière dur résine','Gouttière souple intra dur extra','Blanchissement','Contention'],
    'Adjonction': ['Adjonction dent','Adjonction crochet'],
    'Inlay Onlay': ['Inlay Onlay composite','Inlay Onlay céramique','Inlay Onlay métal'],
    'Facette': ['Facette composite','Facette céramique'],
    'Implant CCM': ['Implant scellé','Implant transvisé'],
    'Implant CCC': ['Implant scellé','Implant transvisé'],
  };
  var allChecked = new Set(conjointe.concat(adjointe));
  function parentHasSub(v) {
    var subs = PARENT_SUBS[v];
    return subs && subs.some(function(s) { return allChecked.has(s); });
  }

  // Sous-items → parent pour fusion du label
  var SUB_TO_PARENT = {
    'Inlay Onlay composite':'Inlay Onlay','Inlay Onlay céramique':'Inlay Onlay','Inlay Onlay métal':'Inlay Onlay',
    'Facette composite':'Facette','Facette céramique':'Facette',
    'Implant scellé':'Implant CCM','Implant transvisé':'Implant CCM',
    'Inlay Core céramisé':'Inlay Core','Inlay Core clavette':'Inlay Core',
    'Stellite montage stellite':'Stellite','Stellite finition stellite':'Stellite','Stellite sup. valplast':'Stellite',
    'App résine montage':'App résine','App résine finition':'App résine','App résine grille de renfort':'App résine',
    'Complet montage':'Complet','Complet finition':'Complet','Complet grille de renfort':'Complet',
    'Valplast montage':'Valplast','Valplast finition':'Valplast','Valplast grille de renfort':'Valplast',
  };
  function getFullLabel(v) {
    var label = TRAD[v] || v;
    // Si le sous-item a sa propre traduction complète dans TRAD, l'utiliser directement
    if (TRAD[v]) return label;
    // Sinon fusionner avec le parent (ex: sous-item sans traduction propre)
    var parentKey = SUB_TO_PARENT[v];
    if (parentKey && parentHasSub(parentKey)) {
      var parentLabel = TRAD[parentKey] || parentKey;
      return parentLabel + ' ' + label;
    }
    return label;
  }

  // Conjointe
  var hasSolid = conjointe.includes('Solidaire');
  conjointe.forEach(function(v) {
    if (SKIP.has(v)) return;
    if (parentHasSub(v)) return;
    var label = getFullLabel(v);
    var dents = da[v] ? da[v].replace(/[^0-9\s]/g,'').trim() : '';
    if (!dents) return;
    var dentsList = dents.split(/\s+/).map(Number).filter(Boolean);
    var prefix = '';
    if (hasSolid && !NO_SPLINT.has(v)) {
      var isSplinted = solidGrps.some(function(g) { return g.type === 'solid' && dentsList.some(function(d) { return g.dents.includes(d); }); });
      if (isSplinted) prefix = 'JOINED ';
    }
    parts.push(prefix + label + ' ' + formatDentsGrouped(dentsList));
  });
  // Items conjointe sans dents (skip parents si sous-item coché)
  conjointe.forEach(function(v) {
    if (SKIP.has(v)) return;
    if (parentHasSub(v)) return;
    var dents = da[v] ? da[v].replace(/[^0-9\s]/g,'').trim() : '';
    if (dents) return;
    var label = getFullLabel(v);
    parts.push(label);
  });

  // Adjointe
  adjointe.forEach(function(v) {
    if (SKIP.has(v)) return; // skip parents
    if (parentHasSub(v)) return; // skip parent si sous-item coché
    var label = getFullLabel(v);
    var raw = da[v] || '';
    var jaw = '';
    if (raw.includes('haut') && raw.includes('bas')) jaw = 'upper+lower';
    else if (raw.includes('haut')) jaw = 'upper';
    else if (raw.includes('bas')) jaw = 'lower';
    var dents = raw.replace(/haut\+?bas?|haut|bas|\|/g,'').replace(/[^0-9\s]/g,'').trim();
    var detail = [jaw, dents].filter(Boolean).join(' ');
    parts.push(label + (detail ? ' ' + detail : ''));
  });

  // Teinte
  var teinteVal = document.getElementById('teinte-custom')?.value?.trim();
  if (teinteVal) parts.push('Shade ' + teinteVal);

  // Scan body
  var pivVal = document.getElementById('piv')?.value?.trim();
  if (pivVal) parts.push('Scan ref: ' + pivVal);

  return parts.join(' + ');
}

// Traduction Gemini seule (notes du dentiste)
async function _traduireGemini(texte, forceFullTranslation) {
  if (!texte || !texte.trim()) return '';
  try {
    var prompt;
    if (forceFullTranslation) {
      // Retraduire manuellement → traduire TOUT fidèlement (l'utilisateur a écrit ce qu'il veut voir traduit)
      prompt = 'Translate the following French dental lab text to English. Translate EVERYTHING faithfully, word by word. '
        + 'Do NOT remove or filter anything. Reply ONLY with the English translation.\n\n' + texte;
    } else {
      // Scan automatique → filtrer les produits (déjà sur le PDF)
      prompt = 'You are translating a French dental prescription comment to English for a dental lab technician. '
        + 'Translate ONLY the free-form notes written by the dentist. Be methodical and faithful to the original meaning.'
        + '\n\nREMOVE (do NOT translate these — they are already shown elsewhere on the PDF form): '
        + '- Greetings and pleasantries: bonjour, merci, cordialement, svp, veuillez réaliser '
        + '- Product descriptions (WHAT to make): couronne, bridge, CCM, CCC, zircone, EMAX, stellite, appareil, résine, gouttière, valplast, complet, inlay, onlay, facette, PEI, cire, implant, provisoire '
        + '- Tooth numbers when they only describe what product goes where (ex: "zircone sur 36" → REMOVE) '
        + '- Jaw positions alone: haut, bas, maxillaire, mandibulaire '
        + '- Shade/teinte alone: A1, A2, 3M2... ';
    }
    if (!forceFullTranslation) prompt += '\nKEEP and translate faithfully: '
      + '- Clasp types with teeth: "crochet Nally Martinet sur 13 23" → "Nally Martinet clasps on 13 and 23" '
      + '- Technical instructions: empreintes, DVO, occlusion, articulateur, remarques sur le patient '
      + '- Urgency: urgent, en urgence, en attente depuis, à faire rapidement '
      + '- Deadlines, dates, delays '
      + '- Any instruction that tells the technician HOW to do the work '
      + '- Patient-specific notes (allergies, particularities, preferences) '
      + '- References to previous work, remakes, adjustments '
      + '\nIf NOTHING useful remains after removing greetings, reply with just a dot. '
      + 'Reply ONLY with the translated text, no explanations.\n\n' + texte;
    const response = await fetch('https://gemini-proxy.cohenillan29.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
        _forceFlash: true
      })
    });
    const _rawText = await response.text();
    var t = '';
    for (const line of _rawText.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const chunk = JSON.parse(line.slice(6));
        if (chunk.error) continue;
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const p of parts) { if (p.text && !p.thought) t += p.text; }
      } catch(e) {}
    }
    t = t.trim();
    if (t === '.' || t.toLowerCase() === 'nothing' || t.length < 3) return '';
    return t;
  } catch (e) {
    console.error('Erreur traduction:', e);
    return '';
  }
}

// Traduction : uniquement la partie annexe (commentaires libres du praticien)
async function traduireCommentairesEN(texte) {
  if (!texte || !texte.trim()) return '';
  return await _traduireGemini(texte);
}

// ---- TRADUCTION FR → EN ----
var TRAD_CONJOINTE = {
  'CCM': 'PFM',
  'CIV': 'CIV',
  'Couronne coulée': 'FCC',
  'EMAX': 'EMAX',
  'Zirconium CCC': 'ZIRCONIA',
  'Full zirconium': 'FULL ZIRCONIA',
  'Dent provisoire': 'TEMPORY TEETH',
  'Implant CCM': 'IMPLANT PFM',
  'Implant CCC': 'IMPLANT ZIRCONIA',
  'Implant scellé': '  cement',
  'Implant transvisé': '  screw',
  'Inlay Core': 'POST CORE',
  'Inlay Core céramisé': 'POST CORE ceramised',
  'Inlay Core clavette': '  pin keys',
  'Inlay Onlay': 'INLAY ONLAY',
  'Inlay Onlay composite': 'INLAY ONLAY composite',
  'Inlay Onlay céramique': 'INLAY ONLAY ceramic',
  'Inlay Onlay métal': '  metal',
  'Facette': 'VENEER',
  'Facette composite': 'VENEER composite',
  'Facette céramique': 'VENEER ceramic',
  'Épaulement céram.': 'PORCELAIN SHOULDER',
  'Ailette métal': 'metal wing',
  'Ceramic Rose Collet': 'PINK CERAMIC COLLET',
  'Fraisage': 'MILLING',
  'Unitaire': 'UNIT',
  'Solidaire': 'JOINED',
  'Armature': 'FRAME WORK',
  'Richmond': 'RICHMOND',
  'Maquillage sillon oui': 'GROOVES MAKE-UP: yes',
  'Maquillage sillon non': 'GROOVES MAKE-UP: no',
  'Point de contact fort': 'CONTACT POINT: strong',
  'Point de contact léger': 'CONTACT POINT: light',
  'Occlusion sous occ': 'OCCLUSION: under',
  'Occlusion légère': 'OCCLUSION: light',
  'Occlusion forte': 'OCCLUSION: strong',
  'Embrasure fermée': 'EMBRASURE: close',
  'Embrasure ouverte': 'EMBRASURE: open',
  'Limite sous gingival': 'LIMIT: under ginger',
};

var TRAD_ADJOINTE = {
  'PEI': 'INDIVIDUAL TRAY',
  "Cire d'occlusion": 'BITE WAX',
  'Réparation': 'REPAIR',
  'Rebasage': 'REBASE',
  'Adjonction dent': 'ADD tooth',
  'Adjonction crochet': 'ADD claps',
  'Gouttière souple': 'GUTTERY soft/semi rigide',
  'Gouttière dur résine': 'GUTTERY hard',
  'Gouttière souple intra dur extra': 'GUTTERY hard top - soft inside',
  'Blanchissement': 'GUTTERY bleaching',
  'Contention': 'GUTTERY thinner',
  'Dent à extraire': 'CUT TEETH',
  'Stellite': 'CCP',
  'Ackers stellite': '  ACKERS',
  'Stellite montage stellite': 'CCP set up',
  'Stellite finition stellite': 'CCP finish',
  'Stellite sup. valplast': 'CCP valplast clasp',
  'App résine': 'ACRYLIC DENTURE',
  'Ackers résine': '  ACKERS',
  'App résine montage': 'ACRYLIC DENTURE try-in',
  'App résine finition': 'ACRYLIC DENTURE finish',
  'App résine grille de renfort': '  MESH inside',
  'Complet': 'COMPLET',
  'Complet montage': 'COMPLET try-in',
  'Complet finition': 'COMPLET finish',
  'Complet grille de renfort': '  MESH inside',
  'Valplast': 'VALPLAST',
  'Ackers valplast': '  ACKERS',
  'Valplast montage': 'VALPLAST try-in',
  'Valplast finition': 'VALPLAST finish',
  'Valplast grille de renfort': '  MESH inside',
};

function traduire(val, dict) {
  return dict[val] || val;
}

async function traduireCommentaire(texte) {
  if (!texte || !texte.trim()) return '';
  // Si une traduction EN existe déjà (manuelle ou IA), on l'utilise directement
  if (texte.includes('--- EN ---')) {
    const parts = texte.split('--- EN ---');
    // Joindre TOUTES les parties après le premier séparateur (il peut y en avoir 2+)
    const en = parts.slice(1).map(p => p.trim()).filter(Boolean).join('\n');
    if (en) return en;
  }
  // Sinon on traduit via Gemini
  try {
    const resp = await fetch('https://gemini-proxy.cohenillan29.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `Translate the following French dental lab comment to English. Return ONLY the translated text, nothing else.\n\n${texte}` }]
        }]
      })
    });
    const data = await resp.json();
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return translated || texte;
  } catch(e) {
    return texte;
  }
}

async function buildPDFAnglaisDoc(p, commentaireEN) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ─── PALETTE ──────────────────────────────────────────────────────────────
  const W = 210, H = 297;
  const blue      = [26,  92, 138];
  const teal      = [91, 196, 192];
  const blueLight = [230, 242, 250];
  const offWhite  = [248, 250, 252];
  const borderCol = [208, 224, 234];
  const muted     = [122, 150, 168];
  const dark      = [28,  42,  53];
  const white     = [255, 255, 255];
  const successGreen = [45, 122, 79];
  const dangerRed    = [192, 57, 43];


  // ─── HELPERS ──────────────────────────────────────────────────────────────
  function gradRect(x, y, w, h, steps = 32) {
    for (let i = 0; i < steps; i++) {
      const r = i / steps;
      doc.setFillColor(
        Math.round(blue[0] + (teal[0] - blue[0]) * r),
        Math.round(blue[1] + (teal[1] - blue[1]) * r),
        Math.round(blue[2] + (teal[2] - blue[2]) * r)
      );
      doc.rect(x + i * (w / steps), y, w / steps + 0.5, h, 'F');
    }
  }

  function sectionHeader(label, x, y, w, h = 7) {
    // Coins arrondis en haut uniquement : on dessine le fond arrondi complet
    // puis on comble les coins du bas avec un rect plein pour les "fermer"
    doc.setFillColor(...white);   // fond blanc dessous (pour l'arrondi)
    doc.roundedRect(x, y, w, h + 4, 3.5, 3.5, 'F'); // déborde vers le bas
    // Dégradé par-dessus
    gradRect(x, y, w, h);
    // Recouvrir le bas de la section header avec le même dégradé (arrondi seulement en haut)
    // On trace un rect droit en bas pour annuler l'arrondi bas
    for (let i = 0; i < 32; i++) {
      const r = i / 32;
      doc.setFillColor(
        Math.round(blue[0] + (teal[0] - blue[0]) * r),
        Math.round(blue[1] + (teal[1] - blue[1]) * r),
        Math.round(blue[2] + (teal[2] - blue[2]) * r)
      );
      doc.rect(x + i * (w / 32), y + h - 3, w / 32 + 0.5, 3, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...white);
    doc.text(label.toUpperCase(), x + 5, y + h / 2 + 2.8);
  }

  function box(x, y, w, h, fill = offWhite) {
    // Ombre portée légère (rectangle légèrement décalé, couleur borderCol atténuée)
    doc.setFillColor(195, 215, 228);
    doc.setLineWidth(0);
    doc.roundedRect(x + 0.6, y + 0.8, w, h, 3.5, 3.5, 'F');
    // Fond principal avec coins arrondis
    doc.setFillColor(...fill);
    doc.setDrawColor(...borderCol);
    doc.setLineWidth(0.22);
    doc.roundedRect(x, y, w, h, 3.5, 3.5, 'FD');
  }

  // Checkbox toujours coché (on n'affiche que les items cochés)
  function checkbox(label, isBold, x, y) {
    // Losange dégradé bleu→teal signature I Love Smile
    const s = 2.0; // demi-taille
    const cx = x + s + 0.5;
    const cy = y - s + 0.8;
    // Dessiner le losange avec dégradé (4 triangles colorés)
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const r = i / steps;
      doc.setFillColor(
        Math.round(blue[0] + (teal[0] - blue[0]) * r),
        Math.round(blue[1] + (teal[1] - blue[1]) * r),
        Math.round(blue[2] + (teal[2] - blue[2]) * r)
      );
      const w2 = s * (1 - i / steps);
      doc.triangle(cx, cy - s + i * (s / steps), cx + w2, cy, cx, cy + s - i * (s / steps), 'F');
      doc.triangle(cx, cy - s + i * (s / steps), cx - w2, cy, cx, cy + s - i * (s / steps), 'F');
    }
    // Texte
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 7.8 : 7.2);
    doc.setTextColor(...(isBold ? dark : [60, 80, 100]));
    doc.text(label, x + s * 2 + 3, y + 0.2);
  }

  // ─── PAGE BACKGROUND ──────────────────────────────────────────────────────
  doc.setFillColor(...white);
  doc.rect(0, 0, W, H, 'F');
  // Trame de points discrets en arrière-plan
  doc.setFillColor(234, 242, 248);
  for (let px = 18; px < W - 5; px += 12) {
    for (let py = 55; py < H - 22; py += 12) {
      doc.circle(px, py, 0.28, 'F');
    }
  }

  // ─── HEADER ───────────────────────────────────────────────────────────────
  const hH = 50;
  doc.setFillColor(...white);
  doc.rect(0, 0, W, hH, 'F');
  // Filet dégradé fin en bas du header
  gradRect(0, hH - 1.2, W, 1.2, 40);

  // ── BADGE PRESCRIPTION (GAUCHE) — sans fond coloré, style épuré ──
  const bx = 6, by = 4, bw = 80, bh = hH - 8;
  // Fond blanc + fine bordure teal
  doc.setFillColor(...white);
  doc.roundedRect(bx, by, bw, bh, 3, 3, 'F');
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.6);
  doc.roundedRect(bx, by, bw, bh, 3, 3, 'S');
  // Filet teal fin en haut
  doc.setFillColor(...teal);
  doc.roundedRect(bx, by, bw, 5, 3, 3, 'F');
  doc.rect(bx, by + 2, bw, 3, 'F');

  // "DENTAL PRESCRIPTION" sur le filet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(...white);
  doc.text('DENTAL PRESCRIPTION', bx + bw / 2, by + 4, { align: 'center' });

  // Numéro de fiche — toujours sur une seule ligne, taille auto
  const numStr = String(p.numero || '').replace('N° ', '');
  doc.setTextColor(...blue);
  doc.setFont('helvetica', 'bold');
  // Calcul de la taille de police pour tenir sur une ligne dans bw - 4mm
  const maxNumW = bw - 6;
  let numFs = 14;
  doc.setFontSize(numFs);
  while (doc.getTextWidth(numStr) > maxNumW && numFs > 6) {
    numFs -= 0.5;
    doc.setFontSize(numFs);
  }
  doc.text(numStr, bx + bw / 2, by + 15, { align: 'center' });

  // Séparateur fin
  doc.setDrawColor(220, 230, 240);
  doc.setLineWidth(0.2);
  doc.line(bx + 5, by + 17, bx + bw - 5, by + 17);

  // Date création
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...muted);
  // Formater la date en JJ/MM/AAAA si besoin
  const _formatDate = (d) => {
    if (!d) return '—';
    if (d.includes('T')) { // format ISO
      const dt = new Date(d);
      return dt.toLocaleDateString('fr-FR');
    }
    return d;
  };
  doc.text('Created: ' + _formatDate(p.createdAt), bx + bw / 2, by + 22, { align: 'center' });

  // Code labo — rouge gras bien visible
  if (p.code_labo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(210, 30, 30);
    doc.text(p.code_labo, bx + bw / 2, by + 33, { align: 'center' });
  }

  // TO REDO
  if (p.aRefaire) {
    doc.setFillColor(...dangerRed);
    doc.roundedRect(bx + 6, by + 35, bw - 12, 6, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...white);
    doc.text('! TO REDO !', bx + bw / 2, by + 39.5, { align: 'center' });
  }

  // ── LOGO + I LOVE SMILE (DROITE) ──
  const logoImg = new Image();
  logoImg.src = LOGO_B64;
  await new Promise(r => { logoImg.onload = r; logoImg.onerror = r; });
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = logoImg.naturalWidth || 200;
  logoCanvas.height = logoImg.naturalHeight || 200;
  const logoCtx = logoCanvas.getContext('2d');
  logoCtx.drawImage(logoImg, 0, 0);
  const logoData = logoCtx.getImageData(0, 0, logoCanvas.width, logoCanvas.height);
  const d = logoData.data;
  for (let i = 0; i < d.length; i += 4) {
    const avg = (d[i] + d[i+1] + d[i+2]) / 3;
    if (avg > 228 && d[i+3] > 180) d[i+3] = 0;
  }
  logoCtx.putImageData(logoData, 0, 0);
  const logoPNG = logoCanvas.toDataURL('image/png');
  const logoH_mm = 32;
  const logoRatio = logoCanvas.width / logoCanvas.height;
  const logoW_mm = logoH_mm * logoRatio;
  const logoX = W - logoW_mm - 8;
  const logoY = (hH - logoH_mm) / 2;
  doc.addImage(logoPNG, 'PNG', logoX, logoY, logoW_mm, logoH_mm);

  // Texte "I love smile" à gauche du logo
  const tx = bx + bw + 8;
  const textCy = hH / 2;
  const danceCanvas = document.createElement('canvas');
  const dScale = 4;
  const dW = 260, dH = 52;
  danceCanvas.width = dW * dScale;
  danceCanvas.height = dH * dScale;
  const dCtx = danceCanvas.getContext('2d');
  dCtx.scale(dScale, dScale);
  dCtx.clearRect(0, 0, dW, dH);
  dCtx.font = "bold 34px 'Dancing Script', cursive";
  const tm = dCtx.measureText('I love smile');
  const textGrad = dCtx.createLinearGradient(0, 0, tm.width, 0);
  textGrad.addColorStop(0,   '#1a5c8a');
  textGrad.addColorStop(0.6, '#5bc4c0');
  textGrad.addColorStop(1,   '#4ab0ac');
  dCtx.fillStyle = 'rgba(195,218,238,0.65)';
  dCtx.fillText('I love smile', 2, 36);
  dCtx.fillStyle = textGrad;
  dCtx.fillText('I love smile', 0, 34);
  const lineGrad = dCtx.createLinearGradient(0, 0, tm.width, 0);
  lineGrad.addColorStop(0, '#1a5c8a');
  lineGrad.addColorStop(1, '#5bc4c0');
  dCtx.strokeStyle = lineGrad;
  dCtx.lineWidth = 2.8;
  dCtx.lineCap = 'round';
  dCtx.beginPath();
  dCtx.moveTo(0, 41);
  dCtx.lineTo(tm.width, 41);
  dCtx.stroke();
  const danceImg = danceCanvas.toDataURL('image/png');
  const mmPerPx = 25.4 / 96;
  doc.addImage(danceImg, 'PNG', tx, textCy - 8, dW * mmPerPx, dH * mmPerPx);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...muted);
  doc.text('Prosthetics  ·  Removable  ·  Fixed  ·  Implantology', tx, textCy + 20);

  // ── QR CODE → lien direct vers la photo Cloudinary ──
  const _qrPhotoUrl = (p.photo_url && p.photo_url.startsWith('http')) ? p.photo_url : null;
  if (_qrPhotoUrl && typeof qrcode !== 'undefined') {
    try {
      const qrUrl = _qrPhotoUrl;
      const _qrFn = (typeof qrcode === 'function') ? qrcode : (qrcode.default || null);
      if (!_qrFn) throw new Error('qrcode lib not callable');
      const _qr = _qrFn(0, 'M');
      _qr.addData(qrUrl);
      _qr.make();
      const _qrCanvas = document.createElement('canvas');
      const _qrModules = _qr.getModuleCount();
      const _qrCell = 4;
      _qrCanvas.width = _qrModules * _qrCell;
      _qrCanvas.height = _qrModules * _qrCell;
      const _qrCtx = _qrCanvas.getContext('2d');
      _qrCtx.fillStyle = '#ffffff';
      _qrCtx.fillRect(0, 0, _qrCanvas.width, _qrCanvas.height);
      for (let _qrR = 0; _qrR < _qrModules; _qrR++) {
        for (let _qrC = 0; _qrC < _qrModules; _qrC++) {
          if (_qr.isDark(_qrR, _qrC)) {
            _qrCtx.fillStyle = '#1a5c8a';
            _qrCtx.fillRect(_qrC * _qrCell, _qrR * _qrCell, _qrCell, _qrCell);
          }
        }
      }
      const _qrData = _qrCanvas.toDataURL('image/png');
      const _qrMM = 20;
      const _qrX = logoX - _qrMM - 4; // juste à gauche du logo
      const _qrY = (hH - _qrMM) / 2;
      doc.addImage(_qrData, 'PNG', _qrX, _qrY, _qrMM, _qrMM);
    } catch(e) { console.warn('QR code generation failed', e); }
  }

  // ─── CORPS ────────────────────────────────────────────────────────────────
  let y = hH + 8;
  const margin = 10;
  const secW = W - margin * 2;

  // ─── SECTION 1 : DENTIST / PATIENT / DATES ────────────────────────────────
  const col3W = secW / 3;
  const rowH1 = 30;

  sectionHeader('DENTIST', margin, y, col3W - 2, 7);
  box(margin, y + 7, col3W - 2, rowH1 - 7, white);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...muted);
  doc.text('CLINIC', margin + 4, y + 13);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...blue);
  doc.text(p.cabinet || '—', margin + 4, y + 19, { maxWidth: col3W - 10 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(...muted);
  doc.text('PRACTITIONER', margin + 4, y + 22.5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...dark);
  doc.text(p.praticien || '—', margin + 4, y + 27, { maxWidth: col3W - 10 });

  const px2 = margin + col3W + 1;
  sectionHeader('PATIENT', px2, y, col3W - 2, 7);
  box(px2, y + 7, col3W - 2, rowH1 - 7, white);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...muted);
  doc.text('NAME', px2 + 4, y + 14);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...dark);
  doc.text(p.patient?.nom || '—', px2 + 4, y + 19, { maxWidth: col3W - 22 });
  const age = p.patient?.age ? p.patient.age + ' y.' : '—';
  const sexe = p.patient?.sexe ? (p.patient.sexe === 'homme' ? 'M' : 'F') : '—';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...muted);
  doc.text('AGE', px2 + 4, y + 24);
  doc.text('SEX', px2 + 22, y + 24);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
  doc.text(age, px2 + 4, y + 29);
  doc.text(sexe, px2 + 22, y + 29);

  const px3 = margin + col3W * 2 + 2;
  const col3Wr = secW - (col3W - 2) * 2 - 4;
  sectionHeader('DATES', px3, y, col3Wr, 7);
  box(px3, y + 7, col3Wr, rowH1 - 7, white);
  const dateFmt = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...muted);
  doc.text('IMPRINT DATE', px3 + 4, y + 14);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
  doc.text(dateFmt(p.dates?.empreinte), px3 + 4, y + 19);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...muted);
  doc.text('DELIVERY DATE', px3 + 4, y + 24);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...dangerRed);
  doc.text(dateFmt(p.dates?.livraison), px3 + 4, y + 29);

  y += rowH1 + 5;

  // ─── SECTION 2 : TEETH (schéma FDI) ──────────────────────────────────────
  const teethSH = 32;
  sectionHeader('TEETH INVOLVED', margin, y, secW, 7);
  box(margin, y + 7, secW, teethSH - 7, white);

  const dents = p.dents || [];
  const DENTS_H = [[18,17,16,15,14,13,12,11],[21,22,23,24,25,26,27,28]];
  const DENTS_B = [[48,47,46,45,44,43,42,41],[31,32,33,34,35,36,37,38]];
  const btnW = 7.1, btnH = 5.3;
  const totalW = 16 * btnW + 3;
  const startX = W / 2 - totalW / 2;

  const drawRow = (rowDents, rowY) => {
    let dx = startX;
    rowDents[0].forEach((n) => {
      const sel = dents.includes(n);
      if (sel) { gradRect(dx, rowY, btnW - 0.8, btnH); }
      else {
        doc.setFillColor(...offWhite);
        doc.setDrawColor(...borderCol);
        doc.setLineWidth(0.18);
        doc.rect(dx, rowY, btnW - 0.8, btnH, 'FD');
      }
      doc.setFontSize(5); doc.setFont('helvetica', sel ? 'bold' : 'normal');
      doc.setTextColor(...(sel ? white : muted));
      doc.text(String(n), dx + (btnW - 0.8) / 2, rowY + 3.5, { align: 'center' });
      dx += btnW;
    });
    dx += 3;
    rowDents[1].forEach((n) => {
      const sel = dents.includes(n);
      if (sel) { gradRect(dx, rowY, btnW - 0.8, btnH); }
      else {
        doc.setFillColor(...offWhite);
        doc.setDrawColor(...borderCol);
        doc.setLineWidth(0.18);
        doc.rect(dx, rowY, btnW - 0.8, btnH, 'FD');
      }
      doc.setFontSize(5); doc.setFont('helvetica', sel ? 'bold' : 'normal');
      doc.setTextColor(...(sel ? white : muted));
      doc.text(String(n), dx + (btnW - 0.8) / 2, rowY + 3.5, { align: 'center' });
      dx += btnW;
    });
  };

  const rowY_H = y + 10;
  drawRow(DENTS_H, rowY_H);
  const sepY = rowY_H + btnH + 1.5;
  doc.setDrawColor(...borderCol); doc.setLineWidth(0.35);
  doc.line(startX, sepY, startX + totalW, sepY);
  const rowY_B = sepY + 2;
  drawRow(DENTS_B, rowY_B);

  // Labels R/L
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...muted);
  doc.text('R', startX - 3.5, rowY_H + 3.5);
  doc.text('L', startX + totalW + 0.5, rowY_H + 3.5);
  doc.text('R', startX - 3.5, rowY_B + 3.5);
  doc.text('L', startX + totalW + 0.5, rowY_B + 3.5);

  y += teethSH + 5;

  // ─── SECTION 3 : FIXED + REMOVABLE ───────────────────────────────────────

  // Helper : compacter une liste de dents en plage "21-27" si consécutives
  const _compactDents = (arr) => {
    if (!arr.length) return '';
    const sorted = [...arr].sort((a,b)=>a-b);
    const groups = [];
    let start = sorted[0], prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      if (sorted[i] === prev + 1) { prev = sorted[i]; continue; }
      groups.push(start === prev ? String(start) : start + '-' + prev);
      start = prev = sorted[i];
    }
    return groups.join(' ');
  };

  const _solidGrps = p.solidGroups || [];
  const _dentsAct  = p.dentsActes  || {};

  // ── Helpers ──
  const jawLabel = (raw) => {
    if (!raw) return '';
    const base = raw.includes('|') ? raw.split('|')[0] : raw;
    if (base === 'haut')     return 'UPPER';
    if (base === 'bas')      return 'LOWER';
    if (base === 'haut+bas') return 'UPPER + LOWER';
    // Ne retourner que les positions mâchoire, pas les numéros de dents
    return '';
  };
  const teethBadge = (raw) => {
    if (!raw) return '';
    // Si format "haut|14 15" ou "bas|36 37" → extraire les dents après le |
    if (['haut','bas','haut+bas'].some(m => raw === m || raw.startsWith(m+'|'))) {
      var parts = raw.split('|');
      return parts.length > 1 ? parts.slice(1).join(' ').trim() : '';
    }
    return raw.trim();
  };

  // ── Build FIXED items ──
  // Structure: { label, teeth, jaw, bold, indent, jointTag, isFinition }
  const fixedItems = [];
  // Seuls ces actes peuvent être JOINED/UNIT
  const CONJ_MAIN = ['CCM','Couronne coulée','EMAX','Zirconium CCC','Full zirconium',
    'Dent provisoire','Implant CCM','Implant CCC'];
  // Autres actes principaux (sans solidaire/unitaire)
  const CONJ_OTHER = ['Inlay Core','Inlay Core céramisé',
    'Inlay Onlay','Inlay Onlay composite','Inlay Onlay céramique',
    'Facette','Facette composite','Facette céramique',
    'Ceramic Rose Collet','CIV','Fraisage'];
  const CONJ_STRUCT = ['Unitaire','Solidaire','Armature','Richmond'];
  const CONJ_FIN = ['Maquillage sillon oui','Maquillage sillon non','Point de contact fort',
    'Point de contact léger','Occlusion sous occ','Occlusion légère','Occlusion forte',
    'Embrasure fermée','Embrasure ouverte','Limite sous gingival'];

  // Map acte → group info
  const unitGroups  = _solidGrps.filter(g => g.type === 'unit');
  const solidGroups = _solidGrps.filter(g => g.type === 'solid');
  const getJointTag = (v) => {
    const raw = _dentsAct[v] || '';
    const t = teethBadge(raw);
    if (!t) return '';
    const dentsList = t.split(/[\s,]+/).map(Number).filter(Boolean);
    for (const g of solidGroups) {
      if (dentsList.some(d => g.dents.includes(d))) return 'JOINED';
    }
    for (const g of unitGroups) {
      if (dentsList.some(d => g.dents.includes(d))) return 'UNIT';
    }
    return '';
  };

  // Toutes les dents dans solidGroups (pour fallback si dentsActes vide)
  const _allGroupDents = _solidGrps.flatMap(g => g.dents);
  const _allGroupDentsStr = [...new Set(_allGroupDents)].sort((a,b)=>a-b).join(' ');
  const hasUnit   = p.conjointe?.includes('Unitaire');
  const hasSolid  = p.conjointe?.includes('Solidaire');

  let lastMainLabel = '';
  (p.conjointe || []).forEach(v => {
    const label = TRAD_CONJOINTE[v] || v;
    const raw = _dentsAct[v] || '';
    // Fallback : si l'acte n'a pas de dents dans dentsActes mais qu'il y a des groupes,
    // utiliser les dents des groupes (cas cochage manuel Unitaire/Solidaire sans bulle)
    let teeth = teethBadge(raw);
    if (!teeth && (CONJ_MAIN.includes(v) || CONJ_OTHER.includes(v)) && _allGroupDentsStr) {
      teeth = _allGroupDentsStr;
    }
    const jaw = jawLabel(raw);

    if (CONJ_STRUCT.includes(v)) {
      if (v === 'Solidaire') {
        fixedItems.push({ label: 'JOINED', teeth: '', bold: true, indent: false, tag: 'joined', isFinition: false });
      } else if (v === 'Unitaire') {
        fixedItems.push({ label: 'UNIT', teeth: '', bold: true, indent: false, tag: 'unit', isFinition: false });
      } else {
        fixedItems.push({ label: TRAD_CONJOINTE[v] || v, teeth: '', bold: false, indent: false, tag: '', isFinition: false });
      }
    } else if (CONJ_FIN.includes(v)) {
      fixedItems.push({ label, teeth: '', bold: false, indent: false, tag: '', isFinition: true });
    } else if (CONJ_MAIN.includes(v)) {
      lastMainLabel = label;
      // Implant CCM/CCC : dents uniquement sur sous-item (scellé/transvisé)
      const hideTeethOnParent = (v === 'Implant CCM' || v === 'Implant CCC');
      fixedItems.push({ label, teeth: hideTeethOnParent ? '' : teeth, bold: true, indent: false, tag: '', isFinition: false });
    } else if (CONJ_OTHER.includes(v)) {
      lastMainLabel = label;
      // Inlay Onlay / Facette parents : dents uniquement sur sous-item (si variante cochée)
      const hideParentTeeth = (v === 'Inlay Onlay' || v === 'Facette');
      const teethFinal = hideParentTeeth ? '' : teethBadge(_dentsAct[v] || '');
      fixedItems.push({ label, teeth: teethFinal, bold: true, indent: false, tag: '', isFinition: false, noGroupColor: true, _val: v });
    } else {
      // Sous-items restants : Inlay Core clavette, Implant scellé/transvisé, Épaulement, Ailette
      const parentNoGroup = ['Inlay Core clavette','Inlay Onlay métal'].includes(v);
      let subLabel = label;
      // Préfixer avec le nom du parent si le sous-item commence par des espaces
      if (subLabel.startsWith('  ')) {
        const parentMap = {
          'Inlay Core clavette': 'POST CORE',
          'Inlay Onlay métal': 'INLAY ONLAY',
          'Implant scellé': 'IMPLANT', 'Implant transvisé': 'IMPLANT',
        };
        const parentLabel = parentMap[v] || lastMainLabel || '';
        subLabel = parentLabel + ' ' + subLabel.trim();
      }
      fixedItems.push({ label: subLabel, teeth, bold: false, indent: true, tag: '', isFinition: false, noGroupColor: parentNoGroup, _origVal: v });
    }
  });

  // Trier : Inlay Core + ses variantes/sous-items en premier
  const _icVals = new Set(['Inlay Core','Inlay Core céramisé','Inlay Core clavette']);
  const icItems = fixedItems.filter(i => _icVals.has(i._val) || _icVals.has(i._origVal));
  const otherItems = fixedItems.filter(i => !_icVals.has(i._val) && !_icVals.has(i._origVal));
  fixedItems.length = 0;
  fixedItems.push(...icItems, ...otherItems);

  // ── Build REMOVABLE items ──
  const removItems = [];
  const REMOV_MAIN = ['Stellite','App résine','Complet','Valplast','Gouttière',
    'Gouttière souple/semi rigide','Gouttière dure résine','Gouttière souple intra-dur extra',
    'Gouttière blanchiment','Gouttière contention','PEI',"Cire d'occlusion"];
  const REMOV_ACKERS = ['Ackers stellite','Ackers résine','Ackers valplast'];

  (p.adjointe || []).forEach(v => {
    const label = TRAD_ADJOINTE[v] || v;
    const raw   = _dentsAct[v] || '';
    const PARENTS_SUPPRIMES = ['Stellite','App résine','Complet','Valplast','Gouttière','Adjonction'];
    const isAckers = v.startsWith('Ackers ') || v.endsWith('grille de renfort') || v === 'Crochet valplast' || v === 'Contre plaque';
    const isSubOfRemoved = !isAckers && (PARENTS_SUPPRIMES.some(function(par) { return v.startsWith(par + ' '); })
      || ['Blanchissement','Contention'].includes(v));
    const isMain = REMOV_MAIN.includes(v) || isSubOfRemoved;
    const isDent = ['Dent à extraire','Réparation','Rebasage','Adjonction dent','Adjonction crochet'].includes(v);

    // Dent à extraire : afficher les numéros de dents (dentExtraire), jamais la mâchoire
    if (v === 'Dent à extraire') {
      const dentStr = (p.dentExtraire || '').trim();
      removItems.push({ label, jaw: '', teeth: dentStr || '', bold: isMain, indent: !isMain && !isDent, isDent });
      return;
    }

    const jaw   = jawLabel(raw);
    const teeth = teethBadge(raw);
    removItems.push({ label, jaw, teeth, bold: isMain && !isAckers, indent: isAckers, isDent, isFinition: isAckers, _v: v });
  });

  // Placer les Ackers juste après leur sous-item parent
  var ACKERS_PARENT = {
    'Ackers stellite': ['Stellite finition stellite','Stellite montage stellite'],
    'Ackers résine': ['App résine finition','App résine montage'],
    'Ackers valplast': ['Valplast finition','Valplast montage'],
    'App résine grille de renfort': ['App résine finition','App résine montage'],
    'Complet grille de renfort': ['Complet finition','Complet montage'],
    'Valplast grille de renfort': ['Valplast finition','Valplast montage'],
  };
  Object.entries(ACKERS_PARENT).forEach(function([ackersVal, parentVals]) {
    var ackersIdx = removItems.findIndex(function(i) { return i._v === ackersVal; });
    if (ackersIdx === -1) return;
    // Trouver le dernier sous-item parent dans la liste
    var lastParentIdx = -1;
    parentVals.forEach(function(pv) {
      var idx = removItems.findIndex(function(i) { return i._v === pv; });
      if (idx > lastParentIdx) lastParentIdx = idx;
    });
    if (lastParentIdx !== -1 && ackersIdx !== lastParentIdx + 1) {
      var ackers = removItems.splice(ackersIdx, 1)[0];
      var insertAt = lastParentIdx >= ackersIdx ? lastParentIdx : lastParentIdx + 1;
      removItems.splice(insertAt, 0, ackers);
    }
  });

  // Ajouter machoire globale si définie et aucun item adjointe ne l'a
  const machoireGlobal = Array.isArray(p.machoire) ? p.machoire : (p.machoire ? [p.machoire] : []);
  const hasMachoirePerItem = removItems.some(i => i.jaw);
  const showGlobalJaw = machoireGlobal.length > 0 && !hasMachoirePerItem;

  // ── Calcul hauteur dynamique (inclut PIV + fraisage) ──
  var _pivEstimateH = 0;
  if (p.piv) {
    const _pivEntries = p.piv.split(/\s*\/\s*/);
    _pivEstimateH = _pivEntries.length * 5 + 8;
  }
  if (p.fraisage) _pivEstimateH += 8;
  // Estimation initiale — sera ajustee apres rendu
  var _estFixedH  = Math.max(fixedItems.length, 1) * 8 + 14 + _pivEstimateH;
  var _estRemovH  = Math.max(removItems.length + (showGlobalJaw ? 1 : 0), 1) * 8 + 14;
  var sect3BodyH = Math.max(_estFixedH, _estRemovH);
  const halfW = (secW - 3) / 2;

  // ── Render FIXED PROSTHETICS ──
  sectionHeader('FIXED PROSTHETICS', margin, y, halfW, 7);
  var _fixedBoxY = y + 7;
  box(margin, _fixedBoxY, halfW, sect3BodyH, white);

  var _fixedCy = y + 13;
  if (fixedItems.length === 0) {
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...muted);
    doc.text('None', margin + 4, y + 14);
  } else {
    let cy = y + 13;
    let prevWasMain = false;

    fixedItems.forEach((item, idx) => {
      const x = margin + 4 + (item.indent ? 7 : 0);

      if (item.isFinition) {
        // Finition : petit, grisé, sans losange
        if (!prevWasMain && idx > 0) {
          doc.setDrawColor(210,220,230); doc.setLineWidth(0.2);
          doc.line(margin+4, cy-1, margin+halfW-4, cy-1);
          cy += 1;
        }
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...muted);
        doc.text('· ' + item.label, x, cy + 0.3);
        cy += 5.5;
        prevWasMain = false;
        return;
      }

      if (item.tag === 'joined' || item.tag === 'unit') {
        // Badge JOINED/UNIT coloré
        const isJoined = item.tag === 'joined';
        const tagColor = isJoined ? [22,101,52] : [30,64,175];
        const tagBg    = isJoined ? [220,252,231] : [219,234,254];
        const tagTxt   = item.label + (item.teeth ? '  ' + item.teeth : '');
        const tw = doc.getStringUnitWidth(tagTxt) * 7.5 / doc.internal.scaleFactor + 10;
        doc.setFillColor(...tagBg);
        doc.roundedRect(x, cy - 4, Math.min(tw, halfW - x - margin - 4), 6, 1.5, 1.5, 'F');
        doc.setDrawColor(...tagColor);
        doc.setLineWidth(0.4);
        doc.roundedRect(x, cy - 4, Math.min(tw, halfW - x - margin - 4), 6, 1.5, 1.5, 'S');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...tagColor);
        doc.text(tagTxt, x + 4, cy + 0.5);
        cy += 6.5;
        prevWasMain = false;
        return;
      }

      // Item normal : losange + label
      if (item.bold && idx > 0 && !fixedItems[idx-1]?.indent) {
        doc.setDrawColor(210,220,230); doc.setLineWidth(0.2);
        doc.line(margin+4, cy-2, margin+halfW-4, cy-2);
        cy += 1.5;
      }

      checkbox(item.label, item.bold, x, cy);

      // Badges dents colorés selon solidGroups
      if (item.teeth) {
        const labelW = doc.getStringUnitWidth(item.label) * (item.bold ? 7.8 : 7.2) / doc.internal.scaleFactor;
        let bx = x + 5 + labelW + 3;
        var _bxStart = bx; // pour wrap

        // Parser les dents de cet acte
        const dentsList = parseDentsString(item.teeth); // gère espaces ET plages FDI ex: 16-14

        // Grouper les dents consécutives du même solidGroup
        const dentGroups = []; // [{dents:[], type:'solid'|'unit'|null}]
        let di = 0;
        while (di < dentsList.length) {
          const d = dentsList[di];
          // Trouver si cette dent est dans un solidGroup
          let matchGrp = null;
          _solidGrps.forEach(g => { if (g.dents.includes(d)) matchGrp = g; });

          if (matchGrp && !item.noGroupColor) {
            // Collecter les dents consécutives du même groupe présentes dans dentsList
            const grpDentsInActe = dentsList.slice(di).filter((dd, i2) => {
              if (!matchGrp.dents.includes(dd)) return false;
              // Consécutives ?
              for (let k = di; k < di + i2; k++) {
                if (!matchGrp.dents.includes(dentsList[k])) return false;
              }
              return true;
            });
            // Avancer jusqu'à la fin des dents du groupe
            const advance = grpDentsInActe.length || 1;
            dentGroups.push({ dents: grpDentsInActe, type: matchGrp.type });
            di += advance;
          } else {
            // noGroupColor (POST CORE, Inlay Onlay, Facette) → toujours neutre
            const fallbackType = item.noGroupColor ? null : (hasSolid ? 'solid' : (hasUnit ? 'unit' : null));
            dentGroups.push({ dents: [d], type: fallbackType });
            di++;
          }
        }

        // Dessiner chaque groupe de badges
        dentGroups.forEach(grp => {
          const isSolid = grp.type === 'solid';
          const isUnit  = grp.type === 'unit';
          const tBg  = isSolid ? [220,252,231] : isUnit ? [219,234,254] : [240,245,255];
          const tCol = isSolid ? [22,101,52]   : isUnit ? [30,64,175]   : [26,92,138];
          const tBdr = isSolid ? [22,101,52]   : isUnit ? [30,64,175]   : [180,200,230];

          if (isSolid && grp.dents.length > 1) {
            // Badge fusionné pour les solidaires
            const dArr = [...grp.dents].sort((a,b)=>a-b);
            const label = _compactDents(dArr);
            const tw2 = doc.getStringUnitWidth(label) * 7 / doc.internal.scaleFactor + 8;
            // Wrap si depasse
            if (bx + tw2 >= margin + halfW - 2) { bx = margin + 8; cy += 6.5; }
            doc.setFillColor(...tBg);
            doc.roundedRect(bx, cy-4, tw2, 6.5, 2, 2, 'F');
            doc.setDrawColor(...tBdr); doc.setLineWidth(0.35);
            doc.roundedRect(bx, cy-4, tw2, 6.5, 2, 2, 'S');
            doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...tCol);
            doc.text(label, bx + tw2/2, cy+0.6, {align:'center'});
            bx += tw2 + 3;
          } else {
            // Badge individuel pour chaque dent
            grp.dents.forEach(d => {
              const lbl = String(d);
              const tw2 = doc.getStringUnitWidth(lbl) * 7 / doc.internal.scaleFactor + 6;
              // Wrap si depasse
              if (bx + tw2 >= margin + halfW - 2) { bx = margin + 8; cy += 6.5; }
              doc.setFillColor(...tBg);
              doc.roundedRect(bx, cy-4, tw2, 6, 1.5, 1.5, 'F');
              if (isUnit) {
                doc.setDrawColor(...tBdr); doc.setLineWidth(0.35);
                doc.roundedRect(bx, cy-4, tw2, 6, 1.5, 1.5, 'S');
              }
              doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...tCol);
              doc.text(lbl, bx + tw2/2, cy+0.5, {align:'center'});
              bx += tw2 + 2;
            });
          }
        });
      }

      cy += item.bold ? 7 : 6;
      prevWasMain = item.bold;
    });
    _fixedCy = cy;
  }

  // PIV + Fraisage — rendus DANS la box Fixed Prosthetics
  if (p.piv) {
    _fixedCy += 2;
    doc.setFont('helvetica','bold'); doc.setFontSize(7);
    const pivMaxW = halfW - 12;
    const pivEntries = p.piv.split(/\s*\/\s*/);
    const pivLines = [];
    pivEntries.forEach(function(entry) {
      var line = pivLines.length === 0 ? 'SCAN BODY: ' + entry : entry;
      var lineW = doc.getStringUnitWidth(line) * 7 / doc.internal.scaleFactor;
      if (lineW > pivMaxW) {
        doc.splitTextToSize(line, pivMaxW).forEach(function(w) { pivLines.push(w); });
      } else {
        pivLines.push(line);
      }
    });
    const pivLineH = 5;
    const pivBoxH = pivLines.length * pivLineH + 3;
    doc.setFillColor(255,243,205);
    doc.roundedRect(margin+3, _fixedCy, halfW - 8, pivBoxH, 1.5, 1.5, 'F');
    doc.setDrawColor(230,160,0); doc.setLineWidth(0.3);
    doc.roundedRect(margin+3, _fixedCy, halfW - 8, pivBoxH, 1.5, 1.5, 'S');
    doc.setTextColor(150,90,0);
    pivLines.forEach(function(line, li) {
      doc.text(line, margin+6, _fixedCy + 4 + li * pivLineH);
    });
    _fixedCy += pivBoxH + 2;
  }
  if (p.fraisage) {
    doc.setFont('helvetica','italic'); doc.setFontSize(6); doc.setTextColor(...muted);
    doc.text('Milling: ' + p.fraisage, margin+4, _fixedCy + 3);
    _fixedCy += 8;
  }

  // ── Render REMOVABLE PROSTHETICS ──
  const rx = margin + halfW + 3;
  sectionHeader('REMOVABLE PROSTHETICS', rx, y, halfW, 7);
  box(rx, y+7, halfW, sect3BodyH, white);

  let acy = y + 13;

  if (showGlobalJaw) {
    const macLbl = machoireGlobal.map(v => v==='haut'?'UPPER':v==='bas'?'LOWER':'UPPER+LOWER').join(' + ');
    const macTW = Math.min(doc.getStringUnitWidth('JAW: '+macLbl)*6.5/doc.internal.scaleFactor+8, halfW-10);
    doc.setFillColor(...teal);
    doc.roundedRect(rx+4, acy-4, macTW, 6, 1.5, 1.5, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...white);
    doc.text('JAW: '+macLbl, rx+7, acy+0.5);
    acy += 8;
  }

  if (removItems.length === 0) {
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...muted);
    doc.text('None', rx+4, acy);
  } else {
    removItems.forEach((item, idx) => {
      const x = rx + 4 + (item.indent ? 6 : 0);
      const isCutTeeth = item.label === 'CUT TEETH' || item.label === 'Dent à extraire';

      // Sous-item (Ackers, grille, etc.) : petit, grisé, sans losange
      if (item.isFinition) {
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...muted);
        doc.text('· ' + item.label, x, acy + 0.3);
        acy += 5.5;
        return;
      }

      if (item.bold && idx > 0) {
        doc.setDrawColor(210,220,230); doc.setLineWidth(0.2);
        doc.line(rx+4, acy-2, rx+halfW-4, acy-2);
        acy += 1.5;
      }

      // CUT TEETH : encadré rouge bien visible
      if (isCutTeeth) {
        // Label rouge
        const cutLabelW = doc.getStringUnitWidth(item.label) * 7.5 / doc.internal.scaleFactor + 8;
        doc.setFillColor(253,232,232);
        doc.roundedRect(x, acy - 4, cutLabelW, 7, 1.5, 1.5, 'F');
        doc.setDrawColor(192,57,43); doc.setLineWidth(0.4);
        doc.roundedRect(x, acy - 4, cutLabelW, 7, 1.5, 1.5, 'S');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(192,57,43);
        doc.text(item.label, x + 3, acy + 0.5);
        // Badge dents séparé
        if (item.teeth) {
          var bxCut = x + cutLabelW + 3;
          var twCut = doc.getStringUnitWidth(item.teeth) * 6.5 / doc.internal.scaleFactor + 6;
          doc.setFillColor(253,232,232);
          doc.roundedRect(bxCut, acy - 3.5, twCut, 5, 1.2, 1.2, 'F');
          doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(192,57,43);
          doc.text(item.teeth, bxCut + 3, acy + 0.5);
        }
        acy += item.bold ? 7 : 6;
        return;
      }

      checkbox(item.label, item.bold, x, acy);

      // Badge jaw + teeth combinés
      {
        const labelW2 = doc.getStringUnitWidth(item.label) * (item.bold?7.8:7.2) / doc.internal.scaleFactor;
        let bx2 = x + 5 + labelW2 + 3;

        if (item.jaw) {
          const jawText = item.jaw + (item.teeth ? ' : ' + item.teeth : '');
          const jawCol = item.jaw.includes('+') ? [91,69,180] : (item.jaw==='UPPER'?[173,20,87]:[0,131,143]);
          const jawBg  = item.jaw.includes('+') ? [237,233,254] : (item.jaw==='UPPER'?[252,228,236]:[224,247,250]);
          const tw3 = Math.min(doc.getStringUnitWidth(jawText)*6.5/doc.internal.scaleFactor+8, rx+halfW-bx2-4);
          if (tw3 > 5) {
            doc.setFillColor(...jawBg);
            doc.roundedRect(bx2, acy-4, tw3, 6, 1.5, 1.5, 'F');
            doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...jawCol);
            doc.text(jawText, bx2+3, acy+0.5);
          }
        } else if (item.teeth) {
          const tw4 = doc.getStringUnitWidth(item.teeth)*7/doc.internal.scaleFactor+6;
          doc.setFillColor(240,245,255);
          doc.roundedRect(bx2, acy-4, tw4, 6, 1.5, 1.5, 'F');
          doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(26,92,138);
          doc.text(item.teeth, bx2+tw4/2, acy+0.5, {align:'center'});
        }
      }

      acy += item.bold ? 7 : 6;
    });
  }


  // Recalculer la vraie hauteur apres rendu (les badges peuvent avoir wrappe)
  var _realFixedH = (_fixedCy - (_fixedBoxY)) + 4;
  var _realRemovH = (acy - (_fixedBoxY)) + 4;
  var _realSect3H = Math.max(_realFixedH, _realRemovH, sect3BodyH);

  // Redessiner les boxes avec la vraie hauteur (fond blanc par-dessus rien, c'est juste le cadre)
  // On dessine les boxes APRES le contenu pour couvrir la bonne hauteur
  doc.setFillColor(255,255,255); doc.setDrawColor(210,220,230); doc.setLineWidth(0.3);
  // Effacer et redessiner fixed box
  doc.setFillColor(255,255,255);
  doc.roundedRect(margin, _fixedBoxY, halfW, _realSect3H, 2, 2, 'S');
  // Effacer et redessiner removable box
  doc.roundedRect(rx, _fixedBoxY, halfW, _realSect3H, 2, 2, 'S');

  y += _realSect3H + 7 + 5;

  // ─── SECTION 4 : SHADE + COMMENTS ────────────────────────────────────────
  const shadeW = 38;
  const commW2 = secW - shadeW - 3;
  const shadeSH = 58;

  sectionHeader('SHADE', margin, y, shadeW, 7);
  box(margin, y + 7, shadeW, shadeSH - 7, white);
  const teinte = p.teinte || '—';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(teinte.length > 4 ? 16 : 22);
  doc.setTextColor(...dangerRed);
  const shTw = doc.getTextWidth(teinte);
  doc.text(teinte, margin + shadeW / 2 - shTw / 2, y + 21);
  for (let i = 0; i < 14; i++) {
    const r = i / 14;
    doc.setDrawColor(Math.round(blue[0]+(teal[0]-blue[0])*r), Math.round(blue[1]+(teal[1]-blue[1])*r), Math.round(blue[2]+(teal[2]-blue[2])*r));
    doc.setLineWidth(0.6);
    doc.line(margin + 6 + i * 2, y + 25, margin + 7 + i * 2, y + 25);
  }

  const comx = margin + shadeW + 3;
  sectionHeader('COMMENTS & LAB INSTRUCTIONS', comx, y, commW2, 7);
  box(comx, y + 7, commW2, shadeSH - 7, white);
  // Badges URGENT et CALL ME
  let badgeX = comx + 4;
  const badgeY = y + 12;
  if (p.urgent) {
    doc.setFillColor(220, 0, 0);
    const urgW = 26;
    doc.roundedRect(badgeX, badgeY - 4.5, urgW, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(255,255,255);
    doc.text('URGENT', badgeX + urgW/2, badgeY, { align: 'center' });
    badgeX += urgW + 4;
  }
  if (p.call_me) {
    doc.setFillColor(220, 0, 0);
    const callW = 26;
    doc.roundedRect(badgeX, badgeY - 4.5, callW, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(255,255,255);
    doc.text('CALL ME', badgeX + callW/2, badgeY, { align: 'center' });
    badgeX += callW + 4;
  }
  if (p.casEsthetique) {
    doc.setFillColor(249, 168, 37);
    const estW = 32;
    doc.roundedRect(badgeX, badgeY - 4.5, estW, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(255,255,255);
    doc.text('AESTHETIC', badgeX + estW/2, badgeY, { align: 'center' });
  }
  const commentStartY = (p.urgent || p.call_me || p.casEsthetique) ? y + 18 : y + 14;
  const commentText = commentaireEN || p.commentaires || '';
  if (commentText.trim()) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...dark);
    const clines = doc.splitTextToSize(commentText, commW2 - 8);
    const maxL = Math.floor((shadeSH - 16) / 5);
    doc.text(clines.slice(0, maxL), comx + 4, commentStartY);
  } else if (!p.urgent && !p.call_me) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...muted);
    doc.text('No special instructions', comx + 4, y + 16);
  }

  y += shadeSH + 5;

  // ─── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = H - 16;
  gradRect(0, footerY, W, 16, 40);
  doc.setGState(new doc.GState({ opacity: 0.22 }));
  doc.setDrawColor(...white); doc.setLineWidth(0.3);
  doc.line(0, footerY, W, footerY);
  doc.setGState(new doc.GState({ opacity: 1 }));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...white);
  doc.text('laboilovesmile.com', margin, footerY + 7);
  doc.setFont('helvetica', 'bold');
  doc.text('09 80 88 67 88', W / 2, footerY + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('contact@laboilovesmile.com', W - margin, footerY + 7, { align: 'right' });
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(6.8); doc.setTextColor(215, 238, 250);
  doc.text('I love smile — Dental Laboratory', W / 2, footerY + 12, { align: 'center' });
  doc.setGState(new doc.GState({ opacity: 0.32 }));
  doc.setDrawColor(...white); doc.setLineWidth(0.2);
  doc.line(W / 3, footerY + 2, W / 3, footerY + 14);
  doc.line((W * 2) / 3, footerY + 2, (W * 2) / 3, footerY + 14);
  doc.setGState(new doc.GState({ opacity: 1 }));

  return doc;
}


async function exportPDFAnglais(i) {
  const p = prescriptions[i];
  showToast('Traduction du commentaire...');
  const commentaireEN = await traduireCommentaire(p.commentaires);
  const doc = await buildPDFAnglaisDoc(p, commentaireEN);
  const numStr = p.numero.replace('N° ', '');
  const pdfDataUri = doc.output('datauristring');
  const link = document.createElement('a');
  link.href = pdfDataUri;
  const codeLabo = p.code_labo ? p.code_labo.trim() : '';
  link.download = (codeLabo ? codeLabo + '(' + numStr + ')' : numStr) + '.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('PDF anglais téléchargé !');
}

async function exportZIPAnglais() {
  const encours = prescriptions.filter(p => p.statut === 'verifie');
  if (!encours.length) { showToast('Aucune prescription vérifiée à exporter. Seules les fiches "Vérifiées" peuvent être exportées.', true); return; }
  showToast('⏳ Traduction en cours (' + encours.length + ' fiches)...');

  // 1. Paralléliser les traductions (toutes en même temps)
  const traductions = await Promise.all(encours.map(p => {
    // Skip si déjà traduit (contient --- EN ---)
    if (p.commentaires && p.commentaires.includes('--- EN ---')) {
      const parts = p.commentaires.split('--- EN ---');
      return Promise.resolve(parts[1]?.trim() || '');
    }
    return traduireCommentaire(p.commentaires).catch(() => '');
  }));

  showToast('⏳ Génération des PDFs...');

  // 2. Générer les PDFs (séquentiel car jsPDF utilise le DOM)
  const zip = new JSZip();
  const uploadsToDoLater = [];
  for (let i = 0; i < encours.length; i++) {
    const p = encours[i];
    const commentaireEN = traductions[i];
    const doc = await buildPDFAnglaisDoc(p, commentaireEN);
    const numStr = p.numero.replace('N° ', '');
    const clZip = p.code_labo ? p.code_labo.trim() : '';
    zip.file((clZip ? clZip + '(' + numStr + ')' : numStr) + '.pdf', doc.output('arraybuffer'));
    // Préparer l'upload Cloudinary pour après (pas pendant la génération)
    if (!p.pdf_url) {
      uploadsToDoLater.push({ p, pdfBase64: doc.output('datauristring') });
    }
  }

  // 3. Télécharger le ZIP immédiatement
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const codes = encours.map(p => (p.code_labo || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const zipName = codes.length >= 2 ? codes[0] + ' TO ' + codes[codes.length - 1] : (codes[0] || 'Prescriptions_EN');
  link.download = zipName + '.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Passer en statut 'importe'
  for (const p of encours) {
    p.statut = 'importe';
    if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(p);
  }
  renderList();
  showToast('✅ ZIP téléchargé — ' + encours.length + ' fiche(s) passées en Importé !');

  // 4. Uploads Cloudinary en background (après le ZIP)
  if (uploadsToDoLater.length > 0) {
    (async () => {
      for (const { p, pdfBase64 } of uploadsToDoLater) {
        try {
          const pdfUrl = await window.uploadPhotoCloudinary(pdfBase64);
          if (pdfUrl) {
            p.pdf_url = pdfUrl;
            if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(p);
          }
        } catch(e) { console.warn('Upload PDF Cloudinary échoué:', p.code_labo, e); }
      }
      console.log('📤 ' + uploadsToDoLater.length + ' PDFs uploadés sur Cloudinary en background');
    })();
  }
}
