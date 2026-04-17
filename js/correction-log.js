
// ════════════════════════════════════════════════════════════════
// CORRECTION LOG — sauvegarde des VRAIES corrections humaines
// ════════════════════════════════════════════════════════════════
//
// On compare l'état du formulaire APRÈS remplissage auto (post-IA +
// auto-corrections du logiciel) avec la version finale au moment où
// l'humain clique "Mettre à jour". Seules les modifications humaines
// sont loguées — pas les auto-corrections (code labo, traduction EN,
// résolution alias, etc.)
//
// Flow :
//   1. fillFormFromScan() remplit le formulaire (IA + auto-corrections)
//   2. capturerSnapshotFormulaire() prend une photo de l'état affiché
//   3. L'humain corrige manuellement
//   4. enregistrerPrescription() appelle sauvegarderCorrectionLog()
//      qui compare le snapshot vs la version finale
//
// Dépendances : getDB() (firebase-init.js)
// ════════════════════════════════════════════════════════════════

// Snapshot stocké en mémoire — écrasé à chaque nouveau scan
window._snapshotAvantCorrection = null;

/**
 * Capture l'état du formulaire tel qu'il est affiché APRÈS toutes les
 * auto-corrections (code labo, traduction, aliases, cohérence, etc.)
 * Appelée à la fin de fillFormFromScan().
 */
function capturerSnapshotFormulaire() {
  window._snapshotAvantCorrection = {
    code_labo:    document.getElementById('code-labo-display')?.value || '',
    cabinet:      document.getElementById('cabinet')?.value || '',
    praticien:    document.getElementById('praticien')?.value || '',
    patient_nom:  document.getElementById('patient-nom')?.value || '',
    patient_age:  document.getElementById('patient-age')?.value || '',
    patient_sexe: (document.querySelector('input[name="sexe"]:checked') || {}).value || '',
    date_empreinte: document.getElementById('date-empreinte')?.value || '',
    date_livraison: document.getElementById('date-livraison')?.value || '',
    teinte:       document.getElementById('teinte-custom')?.value || window.selectedTeinte || '',
    fraisage:     document.getElementById('fraisage')?.value || '',
    piv:          document.getElementById('piv')?.value || '',
    commentaires: document.getElementById('commentaires')?.value || '',
    conjointe:    [...document.querySelectorAll('input[name="conjointe"]:checked')].map(el => el.value),
    adjointe:     [...document.querySelectorAll('input[name="adjointe"]:checked')].map(el => el.value),
    dents:        [...(window.selectedDents || [])].sort((a, b) => a - b),
    dentsActes:   Object.assign({}, window._dentsActesCourant || {}),
    solidGroups:  JSON.parse(JSON.stringify(window._solidGroups || [])),
    machoire:     [...document.querySelectorAll('input[name="mach"]:checked')].map(e => e.value),
    urgent:       !!document.getElementById('urgent')?.checked,
    call_me:      !!document.getElementById('call-me')?.checked,
    casEsthetique:!!document.getElementById('cas-esthetique')?.checked,
    aRefaire:     !!document.getElementById('a-refaire')?.checked,
    scan:         !!document.getElementById('scan-check')?.checked,
  };

  console.log('[CORRECTION-LOG] Snapshot formulaire capturé (post auto-correction)');
}

/**
 * Compare le snapshot pré-correction avec la prescription finale et
 * sauvegarde les vraies corrections humaines dans Firebase.
 */
function sauvegarderCorrectionLog(scanIA, prescription) {
  const avant = window._snapshotAvantCorrection;
  if (!avant) {
    console.log('[CORRECTION-LOG] Pas de snapshot — skip (pas un scan IA)');
    return;
  }

  // Comparer snapshot (ce que l'humain a vu) vs prescription finale (ce qu'il a validé)
  const diffs = _comparerSnapshots(avant, prescription);

  // Rien à logger — l'humain n'a rien changé
  if (!diffs.length) {
    console.log('[CORRECTION-LOG] Aucune correction humaine — formulaire validé tel quel');
    window._snapshotAvantCorrection = null;
    return;
  }

  const log = {
    prescription_id: prescription._id || null,
    numero: prescription.numero || '',
    code_labo: prescription.code_labo || '',
    timestamp: Date.now(),
    date_humain: new Date().toLocaleDateString('fr-FR'),

    // Contexte
    cabinet: prescription.cabinet || '',
    praticien: prescription.praticien || '',
    raw_commentaires: (scanIA || {}).raw_commentaires || '',
    photo_url: prescription.photo_url || null,

    // Corrections humaines uniquement
    nb_corrections: diffs.length,
    diffs: diffs,

    // Snapshots complets pour analyse
    snapshot_avant: avant,
    snapshot_apres: {
      numero:       prescription.numero || '',
      code_labo:    prescription.code_labo || '',
      cabinet:      prescription.cabinet || '',
      praticien:    prescription.praticien || '',
      patient_nom:  prescription.patient?.nom || '',
      patient_age:  prescription.patient?.age || '',
      patient_sexe: prescription.patient?.sexe || '',
      teinte:       prescription.teinte || '',
      fraisage:     prescription.fraisage || '',
      piv:          prescription.piv || '',
      commentaires: prescription.commentaires || '',
      conjointe:    prescription.conjointe || [],
      adjointe:     prescription.adjointe || [],
      dents:        prescription.dents || [],
      dentsActes:   prescription.dentsActes || {},
      solidGroups:  prescription.solidGroups || [],
      machoire:     prescription.machoire || [],
      urgent:       !!prescription.urgent,
      call_me:      !!prescription.call_me,
      casEsthetique:!!prescription.casEsthetique,
      aRefaire:     !!prescription.aRefaire,
      scan:         !!prescription.scan,
    },

    reviewed: false,
  };

  // Sauvegarder dans Firebase
  const db = getDB();
  if (!db) {
    console.warn('[CORRECTION-LOG] Firebase non disponible — log perdu');
    return;
  }

  const docId = 'corr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  db.collection('correction_logs').doc(docId).set(log)
    .then(() => {
      console.log('[CORRECTION-LOG] Sauvegardé :', docId, '—', diffs.length, 'correction(s) humaine(s)');
    })
    .catch(e => {
      console.error('[CORRECTION-LOG] Erreur sauvegarde :', e);
    });

  // Reset le snapshot
  window._snapshotAvantCorrection = null;

  return diffs;
}

/**
 * Compare deux états du formulaire et retourne les diffs.
 * "avant" = snapshot post-auto-correction, "apres" = prescription finale.
 */
function _comparerSnapshots(avant, apres) {
  const diffs = [];

  // ── Champs texte ──
  const champsTexte = {
    cabinet:      [avant.cabinet,      apres.cabinet],
    praticien:    [avant.praticien,    apres.praticien],
    patient_nom:  [avant.patient_nom,  apres.patient?.nom || ''],
    patient_age:  [avant.patient_age,  apres.patient?.age || ''],
    patient_sexe: [avant.patient_sexe, apres.patient?.sexe || ''],
    teinte:       [avant.teinte,       apres.teinte],
    fraisage:     [avant.fraisage,     apres.fraisage],
    piv:          [avant.piv,          apres.piv],
    commentaires: [avant.commentaires, apres.commentaires],
  };

  Object.entries(champsTexte).forEach(([champ, [a, b]]) => {
    const va = (a || '').toString().trim();
    const vb = (b || '').toString().trim();
    if (va !== vb) {
      diffs.push({ type: 'texte', champ, avant: va || '(vide)', apres: vb || '(vide)' });
    }
  });

  // ── Cases conjointe ──
  const conjAvant = new Set(avant.conjointe || []);
  const conjApres = new Set(apres.conjointe || []);
  conjApres.forEach(v => { if (!conjAvant.has(v)) diffs.push({ type: 'case_ajoutee', champ: 'conjointe', valeur: v }); });
  conjAvant.forEach(v => { if (!conjApres.has(v)) diffs.push({ type: 'case_retiree', champ: 'conjointe', valeur: v }); });

  // ── Cases adjointe ──
  const adjAvant = new Set(avant.adjointe || []);
  const adjApres = new Set(apres.adjointe || []);
  adjApres.forEach(v => { if (!adjAvant.has(v)) diffs.push({ type: 'case_ajoutee', champ: 'adjointe', valeur: v }); });
  adjAvant.forEach(v => { if (!adjApres.has(v)) diffs.push({ type: 'case_retiree', champ: 'adjointe', valeur: v }); });

  // ── Dents ──
  const dentsAvant = new Set(avant.dents || []);
  const dentsApres = new Set(apres.dents || []);
  const dentsAjoutees = [...dentsApres].filter(d => !dentsAvant.has(d)).sort((a, b) => a - b);
  const dentsRetirees = [...dentsAvant].filter(d => !dentsApres.has(d)).sort((a, b) => a - b);
  if (dentsAjoutees.length || dentsRetirees.length) {
    diffs.push({
      type: 'dents',
      avant: [...dentsAvant].sort((a, b) => a - b),
      apres: [...dentsApres].sort((a, b) => a - b),
      ajoutees: dentsAjoutees,
      retirees: dentsRetirees,
    });
  }

  // ── DentsActes ──
  const daAvant = avant.dentsActes || {};
  const daApres = apres.dentsActes || {};
  const tousActes = new Set([...Object.keys(daAvant), ...Object.keys(daApres)]);
  tousActes.forEach(acte => {
    const va = (daAvant[acte] || '').toString().trim();
    const vb = (daApres[acte] || '').toString().trim();
    if (va !== vb) {
      diffs.push({ type: 'dentsActes', acte, avant: va || '(vide)', apres: vb || '(vide)' });
    }
  });

  // ── SolidGroups ──
  if (JSON.stringify(avant.solidGroups || []) !== JSON.stringify(apres.solidGroups || [])) {
    diffs.push({ type: 'solidGroups', avant: avant.solidGroups || [], apres: apres.solidGroups || [] });
  }

  // ── Mâchoire ──
  const machAvant = (Array.isArray(avant.machoire) ? avant.machoire : [avant.machoire || '']).sort().join('+');
  const machApres = (Array.isArray(apres.machoire) ? apres.machoire : [apres.machoire || '']).sort().join('+');
  if (machAvant !== machApres) {
    diffs.push({ type: 'machoire', avant: machAvant || '(vide)', apres: machApres || '(vide)' });
  }

  // ── Flags ──
  const flags = { urgent: 'urgent', call_me: 'call_me', casEsthetique: 'casEsthetique', aRefaire: 'aRefaire', scan: 'scan' };
  Object.entries(flags).forEach(([key, label]) => {
    if (!!avant[key] !== !!apres[key]) {
      diffs.push({ type: 'flag', champ: label, avant: !!avant[key], apres: !!apres[key] });
    }
  });

  return diffs;
}
