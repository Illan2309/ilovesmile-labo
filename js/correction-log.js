
// ════════════════════════════════════════════════════════════════
// CORRECTION LOG — sauvegarde des corrections humaines sur les scans IA
// ════════════════════════════════════════════════════════════════
//
// Chaque fois qu'un humain modifie le résultat d'un scan IA avant
// d'enregistrer, on sauvegarde un log détaillé dans Firebase
// (collection "correction_logs"). Ces logs permettent d'analyser
// les erreurs récurrentes de l'IA et d'améliorer le prompt.
//
// Dépendances : extraireDiffs() (ai-learning.js), getDB() (firebase-init.js)
// ════════════════════════════════════════════════════════════════

function sauvegarderCorrectionLog(scanIA, prescription) {
  if (!scanIA) return;

  const diffs = extraireDiffs(scanIA, prescription);

  // Rien à logger — l'IA avait tout bon
  if (!diffs.length) {
    console.log('[CORRECTION-LOG] Aucune correction — IA 100% correcte');
    return;
  }

  const log = {
    prescription_id: prescription._id || null,
    timestamp: Date.now(),
    date_humain: new Date().toLocaleDateString('fr-FR'),

    // Contexte pour comprendre la correction
    cabinet: prescription.cabinet || '',
    praticien: prescription.praticien || '',
    raw_commentaires: scanIA.raw_commentaires || scanIA.commentaires || '',
    photo_url: prescription.photo_url || null,

    // Nombre de corrections
    nb_corrections: diffs.length,

    // Le diff complet
    diffs: diffs,

    // Snapshots pour analyse approfondie
    snapshot_ia: {
      cabinet:      scanIA.cabinet || '',
      code_labo:    scanIA.code_labo || '',
      praticien:    scanIA.praticien || '',
      patient_nom:  scanIA.patient_nom || '',
      conjointe:    scanIA.conjointe || [],
      adjointe:     scanIA.adjointe || [],
      dents:        scanIA.dents || [],
      dentsActes:   scanIA.dentsActes || {},
      solidGroups:  scanIA.solidGroups || [],
      machoire:     scanIA.machoire || '',
      teinte:       scanIA.teinte || '',
      fraisage:     scanIA.fraisage || '',
      commentaires: scanIA.commentaires || '',
      urgent:       !!scanIA.urgent,
      call_me:      !!scanIA.call_me,
      cas_esthetique: !!scanIA.cas_esthetique,
      a_refaire:    !!scanIA.a_refaire,
    },
    snapshot_humain: {
      cabinet:      prescription.cabinet || '',
      code_labo:    prescription.code_labo || '',
      praticien:    prescription.praticien || '',
      patient_nom:  prescription.patient?.nom || '',
      conjointe:    prescription.conjointe || [],
      adjointe:     prescription.adjointe || [],
      dents:        prescription.dents || [],
      dentsActes:   prescription.dentsActes || {},
      solidGroups:  prescription.solidGroups || [],
      machoire:     prescription.machoire || '',
      teinte:       prescription.teinte || '',
      fraisage:     prescription.fraisage || '',
      commentaires: prescription.commentaires || '',
      urgent:       !!prescription.urgent,
      call_me:      !!prescription.call_me,
      casEsthetique:!!prescription.casEsthetique,
      aRefaire:     !!prescription.aRefaire,
    },

    // Flag pour suivi
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
      console.log('[CORRECTION-LOG] Sauvegardé :', docId, '—', diffs.length, 'correction(s)');
    })
    .catch(e => {
      console.error('[CORRECTION-LOG] Erreur sauvegarde :', e);
    });

  return diffs;
}
