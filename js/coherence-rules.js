// ══════════════════════════════════════════
// MOTEUR DE RÈGLES DE COHÉRENCE MÉTIER
// Post-traitement après remplissage IA pour corriger les incohérences
// ══════════════════════════════════════════

/**
 * Applique toutes les règles de cohérence métier sur une prescription.
 * Appelé APRÈS fillFormFromScan, corrige les données en place.
 * Retourne un tableau de corrections appliquées (pour affichage/log).
 */
function enforceCoherenceMetier(prescription) {
  var corrections = [];

  var conjointe = prescription.conjointe || [];
  var adjointe = prescription.adjointe || [];
  var dentsActes = prescription.dentsActes || {};
  var solidGroups = prescription.solidGroups || [];
  var commentaires = (prescription.commentaires || '').toLowerCase();
  var rawComm = (prescription.raw_commentaires || prescription.commentaires || '').toLowerCase();
  var machoire = prescription.machoire || '';

  // ── RÈGLE 1 : Implant nécessite toujours scellé ou transvisé ──
  var hasImplantType = conjointe.includes('Implant CCM') || conjointe.includes('Implant CCC');
  var hasImplantFixation = conjointe.includes('Implant scellé') || conjointe.includes('Implant transvisé');
  if (hasImplantType && !hasImplantFixation) {
    // Par défaut scellé si non précisé
    conjointe.push('Implant scellé');
    corrections.push({ champ: 'conjointe', regle: 'implant-fixation', message: 'Implant sans fixation → ajout "Implant scellé" par défaut' });
  }
  if (hasImplantFixation && !hasImplantType) {
    // Fixation sans type → Implant CCM par défaut
    conjointe.push('Implant CCM');
    corrections.push({ champ: 'conjointe', regle: 'implant-type', message: 'Fixation implant sans type → ajout "Implant CCM" par défaut' });
  }

  // ── RÈGLE 12 : Stellite + Valplast ensemble → Valplast finition uniquement ──
  // "stellite valplast" = Valplast finition, pas Stellite finition
  var hasStelliteFin = adjointe.includes('Stellite finition stellite') || adjointe.includes('Stellite montage stellite');
  var hasValplastFin = adjointe.includes('Valplast finition') || adjointe.includes('Valplast montage');
  if (hasStelliteFin && hasValplastFin) {
    // Vérifier dans le raw_commentaires si "stellite valplast" apparaît ensemble
    var _rawLow = rawComm.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/stellite\s+(?:sup\.?\s+)?valplast/i.test(_rawLow)) {
      // C'est "stellite valplast" → retirer le stellite, garder valplast
      adjointe = adjointe.filter(function(a) {
        return a !== 'Stellite finition stellite' && a !== 'Stellite montage stellite';
      });
      delete dentsActes['Stellite finition stellite'];
      delete dentsActes['Stellite montage stellite'];
      corrections.push({ champ: 'adjointe', regle: 'stellite-valplast', message: '"stellite valplast" = Valplast finition → Stellite retiré' });
    }
  }

  // ── RÈGLE 2 : Facette + Couronne sur même dent = impossible ──
  var COURONNES = ['CCM', 'EMAX', 'Zirconium CCC', 'Full zirconium', 'Couronne coulée', 'CIV'];
  var FACETTES = ['Facette composite', 'Facette céramique'];
  FACETTES.forEach(function(facette) {
    var facDents = _parseDents(dentsActes[facette]);
    if (!facDents.length) return;
    COURONNES.forEach(function(couronne) {
      var courDents = _parseDents(dentsActes[couronne]);
      var conflit = facDents.filter(function(d) { return courDents.includes(d); });
      if (conflit.length) {
        // Retirer la facette des dents en conflit (couronne prime)
        var remaining = facDents.filter(function(d) { return !conflit.includes(d); });
        if (remaining.length === 0) {
          delete dentsActes[facette];
          conjointe = conjointe.filter(function(c) { return c !== facette; });
        } else {
          dentsActes[facette] = remaining.join(' ');
        }
        corrections.push({ champ: 'conjointe', regle: 'facette-couronne-conflit', message: 'Facette + ' + couronne + ' sur dent(s) ' + conflit.join(',') + ' → facette retirée (couronne prime)' });
      }
    });
  });

  // ── RÈGLE 3 : Inlay Onlay impossible de 13 à 23 (dents antérieures) ──
  var DENTS_ANTERIEURES = [13, 12, 11, 21, 22, 23];
  var IO_TYPES = ['Inlay Onlay composite', 'Inlay Onlay céramique', 'Inlay Onlay métal'];
  IO_TYPES.forEach(function(io) {
    var ioDents = _parseDents(dentsActes[io]);
    if (!ioDents.length) return;
    var invalides = ioDents.filter(function(d) { return DENTS_ANTERIEURES.includes(d); });
    if (invalides.length) {
      var valides = ioDents.filter(function(d) { return !DENTS_ANTERIEURES.includes(d); });
      if (valides.length === 0) {
        delete dentsActes[io];
        conjointe = conjointe.filter(function(c) { return c !== io; });
      } else {
        dentsActes[io] = valides.join(' ');
      }
      corrections.push({ champ: 'dentsActes', regle: 'io-dents-anterieures', message: 'Inlay Onlay impossible sur dent(s) antérieure(s) ' + invalides.join(',') + ' → retirée(s)' });
    }
  });

  // ── RÈGLE 3bis : Une dent NE PEUT PAS être à la fois Unitaire ET Solidaire ──
  // Heuristique anatomique : on préfère retirer la dent du SOLID (un bridge
  // ne peut pas "sauter" une dent — continuité obligatoire), MAIS seulement
  // si le bridge reste continu après retrait. Sinon on retire du UNIT.
  //
  // Ordre anatomique FDI sur chaque arcade :
  //   Haut : 18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
  //   Bas  : 48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
  // Un bridge est physiquement possible seulement si ses dents sont
  // consécutives dans cet ordre.
  (function() {
    var DENT_ORDER = {};
    [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28].forEach(function(d,i) { DENT_ORDER[d] = i; });
    [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].forEach(function(d,i) { DENT_ORDER[d] = i + 100; });

    function isBridgeContinu(dents) {
      if (!dents || dents.length < 2) return true;
      var idx = dents.map(function(d) { return DENT_ORDER[d]; })
        .filter(function(i) { return i !== undefined; })
        .sort(function(a,b) { return a - b; });
      for (var k = 1; k < idx.length; k++) {
        if (idx[k] !== idx[k-1] + 1) return false;
      }
      return true;
    }

    // Indexer quelles dents sont dans quel groupe unit (pour retirer si besoin)
    var unitDentsMap = {};
    solidGroups.forEach(function(g) {
      if (g.type === 'unit' && g.dents) g.dents.forEach(function(d) { unitDentsMap[d] = g; });
    });
    var dentsRetireesDuSolid = [], dentsRetireesDuUnit = [];

    solidGroups.forEach(function(g) {
      if (g.type !== 'solid' || !g.dents) return;
      var nouvDents = g.dents.slice();
      // Pour chaque dent aussi présente en unit, décider si on peut la retirer du solid
      g.dents.forEach(function(d) {
        if (!unitDentsMap[d]) return;
        var testBridge = nouvDents.filter(function(x) { return x !== d; });
        if (testBridge.length >= 2 && isBridgeContinu(testBridge)) {
          // Retrait safe : le bridge reste continu → on retire la dent du solid
          nouvDents = testBridge;
          dentsRetireesDuSolid.push(d);
        } else {
          // Retrait impossible (casserait la continuité) → on retire du unit
          var unitG = unitDentsMap[d];
          unitG.dents = unitG.dents.filter(function(x) { return x !== d; });
          dentsRetireesDuUnit.push(d);
        }
      });
      g.dents = nouvDents;
    });

    // Nettoyage groupes vides / invalides
    solidGroups = solidGroups.reduce(function(acc, g) {
      if (g.type === 'unit' && (!g.dents || g.dents.length === 0)) return acc;
      if (g.type === 'solid' && (!g.dents || g.dents.length === 0)) return acc;
      if (g.type === 'solid' && g.dents.length === 1) {
        // Solid retombé à 1 dent → convertir en unit si pas déjà
        var exists = acc.some(function(gg) {
          return gg.type === 'unit' && gg.dents && gg.dents.indexOf(g.dents[0]) !== -1;
        });
        if (!exists) acc.push({ type: 'unit', dents: g.dents });
        return acc;
      }
      acc.push(g);
      return acc;
    }, []);

    // Maj flags conjointe si besoin
    var hasSolidGroup = solidGroups.some(function(g) { return g.type === 'solid' && g.dents.length >= 2; });
    var hasUnitGroup  = solidGroups.some(function(g) { return g.type === 'unit'  && g.dents.length >= 1; });
    if (!hasSolidGroup && conjointe.includes('Solidaire')) {
      conjointe = conjointe.filter(function(c) { return c !== 'Solidaire'; });
    }
    if (!hasUnitGroup && conjointe.includes('Unitaire')) {
      conjointe = conjointe.filter(function(c) { return c !== 'Unitaire'; });
    }

    if (dentsRetireesDuSolid.length) {
      corrections.push({
        champ: 'solidGroups',
        regle: 'unit-solid-exclusif-solid',
        message: 'Dent(s) ' + dentsRetireesDuSolid.join(',') + ' déjà en unitaire → retirée(s) du bridge (anatomie préservée)'
      });
    }
    if (dentsRetireesDuUnit.length) {
      corrections.push({
        champ: 'solidGroups',
        regle: 'unit-solid-exclusif-unit',
        message: 'Dent(s) ' + dentsRetireesDuUnit.join(',') + ' au milieu du bridge → retirée(s) de l\'unitaire (bridge continu impossible sinon)'
      });
    }
  })();

  // ── RÈGLE 4 : Solidaire nécessite minimum 2 dents ──
  if (conjointe.includes('Solidaire') && !conjointe.includes('Unitaire')) {
    // Vérifier que solidGroups a au moins un groupe avec 2+ dents
    var hasSolidGroup = solidGroups.some(function(g) {
      return g.type === 'solid' && g.dents && g.dents.length >= 2;
    });
    if (!hasSolidGroup) {
      // Compter les dents des actes principaux
      var ACTES_SOLID = ['CCM', 'EMAX', 'Zirconium CCC', 'Full zirconium', 'Dent provisoire', 'Implant scellé', 'Implant transvisé'];
      var totalDents = [];
      ACTES_SOLID.forEach(function(a) {
        _parseDents(dentsActes[a]).forEach(function(d) {
          if (!totalDents.includes(d)) totalDents.push(d);
        });
      });
      if (totalDents.length < 2) {
        // 1 seule dent → forcer Unitaire
        conjointe = conjointe.filter(function(c) { return c !== 'Solidaire'; });
        if (!conjointe.includes('Unitaire')) conjointe.push('Unitaire');
        solidGroups = [{ type: 'unit', dents: totalDents }];
        corrections.push({ champ: 'conjointe', regle: 'solidaire-min-2', message: 'Solidaire avec 1 seule dent → corrigé en Unitaire' });
      }
    }
  }

  // ── RÈGLE 5 : Complet + autre adjointe même mâchoire = impossible ──
  var COMPLET_ITEMS = ['Complet finition', 'Complet montage', 'Complet grille de renfort'];
  var AUTRES_ADJOINTE_AMOVIBLE = [
    'Stellite finition stellite', 'Stellite montage stellite', 'Stellite sup. valplast',
    'App résine finition', 'App résine montage', 'App résine grille de renfort',
    'Valplast finition', 'Valplast montage', 'Valplast grille de renfort',
    'Ackers stellite', 'Ackers résine', 'Ackers valplast'
  ];
  var completPresent = COMPLET_ITEMS.filter(function(c) { return adjointe.includes(c); });
  if (completPresent.length) {
    var completMach = _getMachoireAdjointe(dentsActes, completPresent[0], machoire);
    AUTRES_ADJOINTE_AMOVIBLE.forEach(function(autre) {
      if (!adjointe.includes(autre)) return;
      var autreMach = _getMachoireAdjointe(dentsActes, autre, machoire);
      // Si même mâchoire ou les deux haut+bas → conflit
      if (completMach && autreMach && (completMach === autreMach || completMach === 'haut+bas' || autreMach === 'haut+bas')) {
        adjointe = adjointe.filter(function(a) { return a !== autre; });
        delete dentsActes[autre];
        corrections.push({ champ: 'adjointe', regle: 'complet-exclusif', message: 'Complet + ' + autre + ' sur même mâchoire → ' + autre + ' retiré' });
      }
    });
  }

  // ── RÈGLE 6 : Conjointe seule → machoire doit être vide ──
  if (conjointe.length > 0 && adjointe.length === 0 && machoire) {
    // Exception : si machoire est remplie mais pas d'adjointe, la vider
    var onlyDecorative = conjointe.every(function(c) {
      return ['Unitaire','Solidaire','Maquillage sillon oui','Maquillage sillon non',
        'Embrasure fermée','Embrasure ouverte','Point de contact fort','Point de contact léger',
        'Occlusion sous occ','Occlusion légère','Occlusion forte','Limite sous gingival',
        'Fraisage','Épaulement céram.','Armature','Richmond','Ailette métal'].includes(c);
    });
    if (!onlyDecorative) {
      prescription.machoire = '';
      corrections.push({ champ: 'machoire', regle: 'conjointe-sans-machoire', message: 'Conjointe seule → mâchoire vidée (ne concerne que adjointe)' });
    }
  }

  // ── RÈGLE 7 : Adjointe amovible sans machoire → déduire des dents ──
  var ADJOINTE_NEEDS_MACHOIRE = [
    'Stellite finition stellite', 'Stellite montage stellite', 'Stellite sup. valplast',
    'App résine finition', 'App résine montage', 'App résine grille de renfort',
    'Complet finition', 'Complet montage', 'Complet grille de renfort',
    'Valplast finition', 'Valplast montage', 'Valplast grille de renfort',
    'Blanchissement', 'Gouttière souple', 'Gouttière dur résine', 'Gouttière souple intra dur extra',
    'Cire d\'occlusion', 'PEI'
  ];
  var hasAdjointeNeedMach = adjointe.some(function(a) { return ADJOINTE_NEEDS_MACHOIRE.includes(a); });
  if (hasAdjointeNeedMach && !machoire && !prescription.machoire) {
    // Essayer de déduire depuis les dents
    var allDents = prescription.dents || [];
    var deduced = _autoScanPos(allDents);
    if (deduced) {
      prescription.machoire = deduced;
      corrections.push({ champ: 'machoire', regle: 'adjointe-machoire-deduite', message: 'Adjointe sans mâchoire → déduite des dents: ' + deduced });
    }
  }

  // ── RÈGLE 8 : Unitaire/Solidaire seulement pour couronnes, pas IO/Facette/IC seuls ──
  var ACTES_UNIT_SOLID = ['CCM', 'Couronne coulée', 'EMAX', 'Zirconium CCC', 'Full zirconium',
    'Dent provisoire', 'Implant CCM', 'Implant CCC', 'CIV'];
  var hasActeUnitSolid = conjointe.some(function(c) { return ACTES_UNIT_SOLID.includes(c); });
  if (!hasActeUnitSolid) {
    var hadUnit = conjointe.includes('Unitaire');
    var hadSolid = conjointe.includes('Solidaire');
    if (hadUnit || hadSolid) {
      conjointe = conjointe.filter(function(c) { return c !== 'Unitaire' && c !== 'Solidaire'; });
      solidGroups = [];
      if (hadUnit || hadSolid) {
        corrections.push({ champ: 'conjointe', regle: 'unit-solid-sans-couronne', message: 'Unitaire/Solidaire retiré (pas de couronne/implant, seulement IO/Facette/IC)' });
      }
    }
  }

  // ── RÈGLE 9 : Dents implant sur sous-item (scellé/transvisé), pas sur parent ──
  ['Implant CCM', 'Implant CCC'].forEach(function(parent) {
    if (dentsActes[parent]) {
      var parentDents = dentsActes[parent];
      // Reporter sur le sous-item s'il existe
      var sousItem = conjointe.includes('Implant transvisé') ? 'Implant transvisé' : 'Implant scellé';
      if (!dentsActes[sousItem]) {
        dentsActes[sousItem] = parentDents;
      }
      delete dentsActes[parent];
      corrections.push({ champ: 'dentsActes', regle: 'implant-dents-sous-item', message: 'Dents de ' + parent + ' reportées sur ' + sousItem });
    }
  });

  // ── RÈGLE 11 : Actes exclusifs avec mêmes dents = ambiguïté → vider les dentsActes ──
  // Si 2 actes exclusifs (ex: Inlay Onlay + Couronne) ont EXACTEMENT les mêmes dents,
  // l'IA n'a pas pu départager → on vide les dents des deux pour que l'humain tranche.
  var ACTES_EXCLUSIFS_GROUPS = [
    // Couronnes vs Inlay Onlay (jamais sur la même dent, et si mêmes dents c'est ambigu)
    { groupA: ['CCM', 'EMAX', 'Zirconium CCC', 'Full zirconium', 'Couronne coulée', 'CIV'],
      groupB: ['Inlay Onlay composite', 'Inlay Onlay céramique', 'Inlay Onlay métal'] },
    // Couronnes vs Facettes
    { groupA: ['CCM', 'EMAX', 'Zirconium CCC', 'Full zirconium', 'Couronne coulée', 'CIV'],
      groupB: ['Facette composite', 'Facette céramique'] },
    // Inlay Core vs Inlay Onlay (jamais sur la même dent)
    { groupA: ['Inlay Core', 'Inlay Core céramisé', 'Inlay Core clavette'],
      groupB: ['Inlay Onlay composite', 'Inlay Onlay céramique', 'Inlay Onlay métal'] },
  ];
  ACTES_EXCLUSIFS_GROUPS.forEach(function(group) {
    // Trouver les actes présents dans chaque groupe
    var actesA = group.groupA.filter(function(a) { return conjointe.includes(a) && dentsActes[a]; });
    var actesB = group.groupB.filter(function(a) { return conjointe.includes(a) && dentsActes[a]; });
    if (!actesA.length || !actesB.length) return;

    actesA.forEach(function(acteA) {
      var dentsA = _parseDents(dentsActes[acteA]).sort().join(',');
      if (!dentsA) return;
      actesB.forEach(function(acteB) {
        var dentsB = _parseDents(dentsActes[acteB]).sort().join(',');
        if (!dentsB) return;
        // Si les dents sont identiques ou se chevauchent fortement → ambiguïté
        var setA = _parseDents(dentsActes[acteA]);
        var setB = _parseDents(dentsActes[acteB]);
        var overlap = setA.filter(function(d) { return setB.includes(d); });
        if (overlap.length > 0 && overlap.length >= Math.min(setA.length, setB.length)) {
          // Ambiguïté : vider les dents des deux actes
          delete dentsActes[acteA];
          delete dentsActes[acteB];
          corrections.push({
            champ: 'dentsActes',
            regle: 'ambiguite-actes-exclusifs',
            message: acteA + ' et ' + acteB + ' ont les mêmes dents (' + overlap.join(', ') + ') → dents vidées, vérification humaine requise'
          });
        }
      });
    });
  });

  // ── RÈGLE 13 : Épaulement céram. nécessite CCM ──
  if (conjointe.includes('Épaulement céram.') && !conjointe.includes('CCM')) {
    conjointe = conjointe.filter(function(c) { return c !== 'Épaulement céram.'; });
    delete dentsActes['Épaulement céram.'];
    corrections.push({ champ: 'conjointe', regle: 'epaulement-sans-ccm', message: 'Épaulement céram. retiré (nécessite CCM)' });
  }

  // ── RÈGLE 14 : Fraisage nécessite une couronne ──
  var COURONNES_ALL = ['CCM', 'EMAX', 'Zirconium CCC', 'Full zirconium', 'Couronne coulée', 'CIV',
    'Implant CCM', 'Implant CCC', 'Dent provisoire'];
  if (conjointe.includes('Fraisage') && !COURONNES_ALL.some(function(c) { return conjointe.includes(c); })) {
    conjointe = conjointe.filter(function(c) { return c !== 'Fraisage'; });
    delete dentsActes['Fraisage'];
    corrections.push({ champ: 'conjointe', regle: 'fraisage-sans-couronne', message: 'Fraisage retiré (pas de couronne associée)' });
  }

  // ── RÈGLE 15 : Grille de renfort jamais seule — nécessite app résine, complet ou valplast ──
  var GRILLES = ['App résine grille de renfort', 'Complet grille de renfort', 'Valplast grille de renfort'];
  var GRILLES_PARENTS = {
    'App résine grille de renfort': ['App résine finition', 'App résine montage'],
    'Complet grille de renfort': ['Complet finition', 'Complet montage'],
    'Valplast grille de renfort': ['Valplast finition', 'Valplast montage']
  };
  GRILLES.forEach(function(grille) {
    if (!adjointe.includes(grille)) return;
    var parents = GRILLES_PARENTS[grille] || [];
    var hasParent = parents.some(function(p) { return adjointe.includes(p); });
    if (!hasParent) {
      // Ajouter le parent finition par défaut
      var defaultParent = parents[0]; // finition
      if (defaultParent) {
        adjointe.push(defaultParent);
        corrections.push({ champ: 'adjointe', regle: 'grille-parent-manquant', message: grille + ' sans parent → ajout ' + defaultParent });
      }
    }
  });

  // ── RÈGLE 18 : Ackers doit correspondre à l'item principal ──
  // Ackers stellite → seulement avec Stellite
  // Ackers résine → seulement avec App résine
  // Ackers valplast → seulement avec Valplast
  var ACKERS_MAP = {
    'Ackers stellite': ['Stellite finition stellite', 'Stellite montage stellite', 'Stellite sup. valplast'],
    'Ackers résine': ['App résine finition', 'App résine montage', 'App résine grille de renfort'],
    'Ackers valplast': ['Valplast finition', 'Valplast montage', 'Valplast grille de renfort']
  };
  var ALL_ACKERS = ['Ackers stellite', 'Ackers résine', 'Ackers valplast'];
  var ackersPresents = ALL_ACKERS.filter(function(a) { return adjointe.includes(a); });

  if (ackersPresents.length > 0) {
    // Déterminer quel item principal est coché
    var hasStellite = adjointe.some(function(a) { return ACKERS_MAP['Ackers stellite'].includes(a); });
    var hasResine = adjointe.some(function(a) { return ACKERS_MAP['Ackers résine'].includes(a); });
    var hasValplast = adjointe.some(function(a) { return ACKERS_MAP['Ackers valplast'].includes(a); });

    // Le bon ackers selon l'item principal
    var bonAckers = null;
    if (hasStellite && !hasResine && !hasValplast) bonAckers = 'Ackers stellite';
    else if (hasResine && !hasStellite && !hasValplast) bonAckers = 'Ackers résine';
    else if (hasValplast && !hasStellite && !hasResine) bonAckers = 'Ackers valplast';
    // Si plusieurs items principaux → on ne touche pas (cas légitime)

    if (bonAckers) {
      // Retirer les mauvais ackers et mettre le bon
      ALL_ACKERS.forEach(function(a) {
        if (a !== bonAckers && adjointe.includes(a)) {
          adjointe = adjointe.filter(function(x) { return x !== a; });
          corrections.push({ champ: 'adjointe', regle: 'ackers-coherence', message: a + ' remplacé par ' + bonAckers + ' (cohérence avec item principal)' });
        }
      });
      if (!adjointe.includes(bonAckers)) {
        adjointe.push(bonAckers);
      }
    }
  }

  // ── RÈGLE 16 : Ailette métal → lié à "maryland" ou "bridge collé" ──
  // Si Ailette métal est cochée mais aucune mention maryland/bridge collé dans le commentaire,
  // c'est probablement une erreur — on la retire
  if (conjointe.includes('Ailette métal')) {
    var _rawNorm = rawComm.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!/maryland|bridge coll/i.test(_rawNorm)) {
      conjointe = conjointe.filter(function(c) { return c !== 'Ailette métal'; });
      corrections.push({ champ: 'conjointe', regle: 'ailette-sans-maryland', message: 'Ailette métal retirée (pas de mention maryland/bridge collé)' });
    }
  }

  // ── RÈGLE 17 : Deux types de couronnes sur même dent = impossible ──
  var TYPES_COURONNES = ['CCM', 'EMAX', 'Zirconium CCC', 'Full zirconium', 'Couronne coulée', 'CIV', 'Dent provisoire'];
  var _dentCouronneMap = {};
  TYPES_COURONNES.forEach(function(type) {
    _parseDents(dentsActes[type]).forEach(function(d) {
      if (!_dentCouronneMap[d]) _dentCouronneMap[d] = [];
      _dentCouronneMap[d].push(type);
    });
  });
  Object.entries(_dentCouronneMap).forEach(function(entry) {
    var dent = entry[0];
    var types = entry[1];
    if (types.length <= 1) return;
    // Garder le premier, retirer les autres de cette dent
    for (var i = 1; i < types.length; i++) {
      var acte = types[i];
      var remaining = _parseDents(dentsActes[acte]).filter(function(d) { return d !== parseInt(dent); });
      if (remaining.length === 0) {
        delete dentsActes[acte];
        conjointe = conjointe.filter(function(c) { return c !== acte; });
      } else {
        dentsActes[acte] = remaining.join(' ');
      }
      corrections.push({ champ: 'dentsActes', regle: 'double-couronne-dent', message: 'Dent ' + dent + ' : ' + acte + ' retiré (conflit avec ' + types[0] + ')' });
    }
  });

  // ── RÈGLE 19 : Gouttière / Blanchissement → pas de dents individuelles ──
  // Une gouttière ou blanchissement couvre une arcade entière, jamais des dents isolées.
  // Si l'IA a mis des dents (ex: 38-48 interprété comme dent 38 et 48), on les retire.
  var ACTES_ARCADE_ENTIERE = [
    'Gouttière souple', 'Gouttière dur résine', 'Gouttière souple intra dur extra',
    'Blanchissement', 'Cire d\'occlusion', 'PEI',
    'Complet finition', 'Complet montage', 'Complet grille de renfort'
  ];
  var hasActeArcade = adjointe.some(function(a) { return ACTES_ARCADE_ENTIERE.includes(a); });
  // Seulement si AUCUN acte conjointe (qui lui nécessite des dents)
  if (hasActeArcade && conjointe.length === 0) {
    var dentsBefore = prescription.dents || [];
    if (dentsBefore.length > 0) {
      prescription.dents = [];
      // Vider aussi les dents dans dentsActes pour les actes arcade
      ACTES_ARCADE_ENTIERE.forEach(function(acte) {
        if (dentsActes[acte]) {
          // Garder la mâchoire si présente (ex: "bas" ou "haut|21")
          var val = dentsActes[acte].toString();
          var machPart = val.match(/^(haut|bas)(\+.+)?/);
          if (machPart) dentsActes[acte] = machPart[0];
        }
      });
      corrections.push({ champ: 'dents', regle: 'arcade-entiere-pas-de-dents', message: 'Acte sur arcade entière → dents individuelles retirées (' + dentsBefore.join(', ') + ')' });
    }
  }

  // ── RÈGLE 20 : "Cire d\'occlusion" jamais seule sans mention explicite ──
  // L'IA coche parfois "Cire d'occlusion" sans raison. On la retire si le
  // commentaire ne mentionne pas explicitement "cire" ou "occlusion".
  if (adjointe.includes('Cire d\'occlusion')) {
    var _rawCire = rawComm.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!/cire|occlusion|mordu|articul/i.test(_rawCire)) {
      adjointe = adjointe.filter(function(a) { return a !== 'Cire d\'occlusion'; });
      delete dentsActes['Cire d\'occlusion'];
      corrections.push({ champ: 'adjointe', regle: 'cire-occlusion-non-mentionnee', message: 'Cire d\'occlusion retirée (pas mentionnée dans le commentaire)' });
    }
  }

  // ── RÈGLE 10 : Vérifier cohérence dents sélectionnées vs dentsActes ──
  var dentsDeclared = prescription.dents || [];
  var dentsFromActes = [];
  Object.values(dentsActes).forEach(function(val) {
    if (typeof val !== 'string') return;
    var nums = val.match(/\d{2}/g);
    if (nums) nums.forEach(function(n) {
      var d = parseInt(n);
      if (d >= 11 && d <= 48 && !dentsFromActes.includes(d)) dentsFromActes.push(d);
    });
  });
  // Ajouter les dents manquantes dans le tableau principal
  var dentsManquantes = dentsFromActes.filter(function(d) { return !dentsDeclared.includes(d); });
  if (dentsManquantes.length) {
    prescription.dents = dentsDeclared.concat(dentsManquantes);
    corrections.push({ champ: 'dents', regle: 'dents-sync', message: 'Dent(s) ' + dentsManquantes.join(', ') + ' ajoutée(s) depuis dentsActes' });
  }

  // ── Appliquer les modifications ──
  prescription.conjointe = conjointe;
  prescription.adjointe = adjointe;
  prescription.dentsActes = dentsActes;
  prescription.solidGroups = solidGroups;

  // Log des corrections
  if (corrections.length) {
    console.log('[COHERENCE] ' + corrections.length + ' correction(s) appliquée(s):');
    corrections.forEach(function(c) {
      console.log('  → [' + c.regle + '] ' + c.message);
    });
  }

  return corrections;
}

// ── Helpers ──

function _parseDents(val) {
  if (!val || typeof val !== 'string') return [];
  var nums = val.match(/\d{2}/g);
  if (!nums) return [];
  return nums.map(Number).filter(function(d) { return d >= 11 && d <= 48; });
}

function _getMachoireAdjointe(dentsActes, acte, machoireGlobal) {
  var val = dentsActes[acte];
  if (!val) return machoireGlobal || '';
  if (typeof val === 'string') {
    if (val === 'haut' || val === 'bas' || val === 'haut+bas') return val;
    if (val.startsWith('haut')) return 'haut';
    if (val.startsWith('bas')) return 'bas';
  }
  return machoireGlobal || '';
}
