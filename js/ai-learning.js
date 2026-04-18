
// ════════════════════════════════════════════════════════════════
// SYSTÈME D'APPRENTISSAGE IA v2 — corrections concrètes et actionnables
// ════════════════════════════════════════════════════════════════
//
// Structure stockée dans localStorage('ia_memory') :
// {
//   erreurs: {
//     "conjointe_manquant_CCM": { count: 3, regle: "...", exemple: "..." },
//     "conjointe_faux_EMAX":    { count: 1, regle: "...", exemple: "..." },
//     ...
//   }
// }
//
// Chaque clé = un cas d'erreur précis et reproductible.
// La règle injectée dans le prompt est directement actionnable par Gemini.
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// MÉMOIRE IA — stockée dans Firebase (meta/ia_memory) pour persistance multi-appareils
// Fallback localStorage si Firebase non disponible
// ════════════════════════════════════════════════════════════════

// Cache en mémoire vive pour éviter des lectures Firebase répétées
window._iaMemoireCache = null;
window._iaMemoreSaveTimeout = null;

function _getMemoire() {
  // Priorité : cache mémoire vive (déjà chargé depuis Firebase)
  if (window._iaMemoireCache) return window._iaMemoireCache;
  // Fallback : localStorage (avant que Firebase charge)
  try { return JSON.parse(localStorage.getItem('ia_memory') || '{"erreurs":{}}'); }
  catch(e) { return { erreurs: {} }; }
}

function _setMemoire(mem) {
  // Système d'apprentissage désactivé — fonction conservée pour resetApprentissage
  window._iaMemoireCache = mem;
  try { localStorage.setItem('ia_memory', JSON.stringify(mem)); } catch(e) {}
  clearTimeout(window._iaMemoreSaveTimeout);
  window._iaMemoreSaveTimeout = setTimeout(() => {
    const db = getDB();
    if (db) {
      db.collection('meta').doc('ia_memory').set(window.withTenant(mem))
        .catch(e => {});
    }
  }, 1000);
}

// ── Extraire les diffs entre ce que l'IA a fait et ce que tu as corrigé ──
function extraireDiffs(ia, humain) {
  const diffs = [];

  // Champs scalaires
  const champScalaires = {
    cabinet:        [ia.cabinet,          humain.cabinet],
    code_labo:      [ia.code_labo,        humain.code_labo],
    praticien:      [ia.praticien,        humain.praticien],
    patient_nom:    [ia.patient_nom,      humain.patient?.nom],
    patient_age:    [ia.patient_age,      humain.patient?.age],
    patient_sexe:   [ia.patient_sexe,     humain.patient?.sexe],
    date_empreinte: [ia.date_empreinte,   humain.dates?.empreinte],
    date_livraison: [ia.date_livraison,   humain.dates?.livraison],
    machoire:       [
      Array.isArray(ia.machoire) ? ia.machoire.sort().join('+') : (ia.machoire || ''),
      Array.isArray(humain.machoire) ? humain.machoire.sort().join('+') : (humain.machoire || '')
    ],
    fraisage:       [ia.fraisage,         humain.fraisage],
    teinte:         [ia.teinte,           humain.teinte],
    commentaires:   [ia.commentaires,     humain.commentaires],
  };

  Object.entries(champScalaires).forEach(([champ, [vIA, vH]]) => {
    const a = (vIA || '').toString().trim();
    const b = (vH  || '').toString().trim();
    if (b && a.toLowerCase() !== b.toLowerCase()) {
      diffs.push({ type: 'scalaire', champ, ia: a || '(vide)', correction: b });
    }
  });

  // Cases conjointe — manquantes vs en trop
  const conjIA  = new Set(ia.conjointe || []);
  const conjH   = new Set(humain.conjointe || []);
  conjH.forEach(v => { if (!conjIA.has(v))  diffs.push({ type: 'case_manquante',  champ: 'conjointe', valeur: v, contexteIA: [...conjIA] }); });
  conjIA.forEach(v => { if (!conjH.has(v))   diffs.push({ type: 'case_en_trop',    champ: 'conjointe', valeur: v, contexteIA: [...conjIA] }); });

  // Cases adjointe
  const adjIA   = new Set(ia.adjointe || []);
  const adjH    = new Set(humain.adjointe || []);
  adjH.forEach(v => { if (!adjIA.has(v))   diffs.push({ type: 'case_manquante',  champ: 'adjointe',  valeur: v, contexteIA: [...adjIA] }); });
  adjIA.forEach(v => { if (!adjH.has(v))    diffs.push({ type: 'case_en_trop',    champ: 'adjointe',  valeur: v, contexteIA: [...adjIA] }); });

  // Dents — ajoutées / retirées
  const dentsIA = new Set(ia.dents || []);
  const dentsH  = new Set(humain.dents || []);
  const dentsAjoutees  = [...dentsH].filter(d => !dentsIA.has(d)).sort((a,b) => a-b);
  const dentsRetirees  = [...dentsIA].filter(d => !dentsH.has(d)).sort((a,b) => a-b);
  if (dentsAjoutees.length || dentsRetirees.length) {
    diffs.push({ type: 'dents_modifiees', ia: [...dentsIA].sort((a,b) => a-b), humain: [...dentsH].sort((a,b) => a-b), ajoutees: dentsAjoutees, retirees: dentsRetirees });
  }

  // DentsActes — mapping acte→dents modifié
  const daIA = ia.dentsActes || {};
  const daH  = humain.dentsActes || {};
  const tousActes = new Set([...Object.keys(daIA), ...Object.keys(daH)]);
  tousActes.forEach(acte => {
    const vIA = (daIA[acte] || '').toString().trim();
    const vH  = (daH[acte]  || '').toString().trim();
    if (vIA !== vH) {
      diffs.push({ type: 'dentsActes_modifie', acte, ia: vIA || '(vide)', humain: vH || '(vide)' });
    }
  });

  // SolidGroups — groupes unitaire/solidaire modifiés
  const sgIA = JSON.stringify(ia.solidGroups || []);
  const sgH  = JSON.stringify(humain.solidGroups || []);
  if (sgIA !== sgH) {
    diffs.push({ type: 'solidGroups_modifie', ia: ia.solidGroups || [], humain: humain.solidGroups || [] });
  }

  // Flags booléens
  const flags = {
    urgent:        [ia.urgent,         humain.urgent],
    call_me:       [ia.call_me,        humain.call_me],
    cas_esthetique:[ia.cas_esthetique, humain.casEsthetique],
    a_refaire:     [ia.a_refaire,      humain.aRefaire],
    scan:          [ia.scan,           humain.scan],
  };
  Object.entries(flags).forEach(([flag, [vIA, vH]]) => {
    const a = !!vIA;
    const b = !!vH;
    if (a !== b) {
      diffs.push({ type: 'flag_modifie', champ: flag, ia: a, correction: b });
    }
  });

  return diffs;
}

// ── Construire une clé unique et une règle actionnable pour chaque diff ──
// ── Apprentissage désactivé — fonction conservée pour compatibilité ──
function sauvegarderApprentissage(diffs, explication) { return null; }

// ── Générer le bloc de prompt injecté dans Gemini ──
// ══ RÈGLES PERSONNALISÉES — injectées dans le prompt Gemini ══
window._customRules = [];

function _loadCustomRules() {
  try {
    const saved = localStorage.getItem('custom_rules');
    if (saved) window._customRules = JSON.parse(saved);
  } catch(e) {}
}
_loadCustomRules();

function _saveCustomRules() {
  try {
    localStorage.setItem('custom_rules', JSON.stringify(window._customRules));
    const db = getDB();
    if (db) db.collection('meta').doc('custom_rules').set(window.withTenant({ rules: window._customRules })).catch(() => {});
  } catch(e) {}
}

function getPromptApprentissage() {
  if (!window._customRules || window._customRules.length === 0) return '';
  return '\n\n⛔⛔⛔ RÈGLES PERSONNALISÉES DU LABO — PRIORITÉ ABSOLUE (lire AVANT tout le reste) ⛔⛔⛔\n'
    + 'Ces règles ÉCRASENT toutes les autres en cas de conflit. Tu DOIS les appliquer systématiquement.\n\n'
    + window._customRules.map((r, i) => '⛔ RÈGLE ' + (i+1) + ' : ' + r).join('\n\n') + '\n\n';
}

function resetApprentissage() {
  if (!confirm('Effacer toutes les règles personnalisées ?')) return;
  window._customRules = [];
  _saveCustomRules();
  showToast('🧠 Règles personnalisées effacées');
}

function afficherMemoire() {
  const ancien = document.getElementById('popup-memoire-ia');
  if (ancien) { ancien.remove(); return; }

  const popup = document.createElement('div');
  popup.id = 'popup-memoire-ia';
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.25);padding:0;z-index:10000;width:min(90vw,600px);max-height:80vh;display:flex;flex-direction:column;';

  const rulesHtml = window._customRules.map((r, i) => `
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;padding:8px 10px;background:#fafafa;border:1px solid #e8e8e8;border-left:4px solid #4a148c;border-radius:8px;">
      <div style="flex:1;font-size:0.78rem;color:#333;line-height:1.5;">${r.replace(/</g,'&lt;')}</div>
      <button onclick="_deleteCustomRule(${i})" style="background:none;border:none;cursor:pointer;color:#c62828;font-size:0.9rem;flex-shrink:0;" title="Supprimer">✕</button>
    </div>`).join('');

  popup.innerHTML = `
    <div style="padding:14px 18px;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:#f8f4ff;border-radius:14px 14px 0 0;">
      <div>
        <span style="font-size:0.9rem;font-weight:700;color:#4a148c;">📝 Règles personnalisées — ${window._customRules.length}</span>
        <div style="font-size:0.65rem;color:#888;margin-top:2px;">Injectées dans le prompt Gemini à chaque scan</div>
      </div>
      <button onclick="document.getElementById('popup-memoire-ia').remove()" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:#999;">✕</button>
    </div>
    <div style="overflow-y:auto;flex:1;padding:14px 18px;">
      ${rulesHtml || '<div style="text-align:center;color:#aaa;padding:20px;font-size:0.82rem;">Aucune règle ajoutée</div>'}
    </div>
    <div style="padding:12px 18px;border-top:1px solid #e8e8e8;flex-shrink:0;background:#fafafa;border-radius:0 0 14px 14px;">
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <input type="text" id="new-rule-input" placeholder="Ex: Quand le cabinet est X, toujours cocher Stellite finition..."
          style="flex:1;padding:8px 12px;border:1px solid #d0d0d0;border-radius:8px;font-size:0.78rem;font-family:inherit;"
          onkeydown="if(event.key==='Enter'){_addCustomRule();}">
        <button onclick="_addCustomRule()" style="background:#4a148c;color:white;border:none;border-radius:8px;padding:8px 16px;font-size:0.78rem;cursor:pointer;font-weight:600;white-space:nowrap;">+ Ajouter</button>
      </div>
      <div id="rule-chat-zone" style="display:none;border-top:1px solid #e0e0e0;padding-top:8px;">
        <div id="rule-chat-messages" style="max-height:120px;overflow-y:auto;margin-bottom:6px;"></div>
        <div style="display:flex;gap:6px;">
          <input type="text" id="rule-chat-input" placeholder="Pose une question à l'IA sur tes règles..."
            style="flex:1;padding:6px 10px;border:1px solid #d0d0d0;border-radius:8px;font-size:0.75rem;font-family:inherit;"
            onkeydown="if(event.key==='Enter'){_askRuleChat();}">
          <button onclick="_askRuleChat()" style="background:#1a5c8a;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:0.75rem;cursor:pointer;font-weight:600;">💬</button>
        </div>
      </div>
      <div style="text-align:center;margin-top:4px;">
        <button onclick="var z=document.getElementById('rule-chat-zone');z.style.display=z.style.display==='none'?'block':'none';"
          style="background:none;border:none;cursor:pointer;font-size:0.7rem;color:#1a5c8a;">💬 Tester avec l'IA</button>
      </div>
    </div>`;
  document.body.appendChild(popup);
  setTimeout(() => document.getElementById('new-rule-input')?.focus(), 100);
}

function _addCustomRule() {
  const inp = document.getElementById('new-rule-input');
  if (!inp) return;
  const rule = inp.value.trim();
  if (!rule) { showToast('Écris une règle d\'abord', true); return; }
  window._customRules.push(rule);
  _saveCustomRules();
  inp.value = '';
  showToast('✅ Règle ajoutée (' + window._customRules.length + ' au total)');
  // Re-render le popup
  document.getElementById('popup-memoire-ia')?.remove();
  afficherMemoire();
}

function _deleteCustomRule(idx) {
  window._customRules.splice(idx, 1);
  _saveCustomRules();
  showToast('Règle supprimée');
  document.getElementById('popup-memoire-ia')?.remove();
  afficherMemoire();
}

async function _askRuleChat() {
  const inp = document.getElementById('rule-chat-input');
  const msgs = document.getElementById('rule-chat-messages');
  if (!inp || !msgs) return;
  const question = inp.value.trim();
  if (!question) return;
  inp.value = '';

  // Afficher la question
  msgs.innerHTML += '<div style="font-size:0.73rem;margin-bottom:4px;"><b style="color:#1a5c8a;">Toi :</b> ' + question.replace(/</g,'&lt;') + '</div>';
  msgs.innerHTML += '<div id="rule-chat-loading" style="font-size:0.73rem;color:#888;margin-bottom:4px;">⏳ L\'IA réfléchit...</div>';
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const rulesText = window._customRules.length > 0
      ? 'Voici les règles personnalisées actuelles :\n' + window._customRules.map((r,i) => (i+1) + '. ' + r).join('\n')
      : 'Aucune règle personnalisée pour le moment.';

    // Chat via le worker mais avec flag _forceFlash pour réponse rapide
    const response = await fetch('https://gemini-proxy.cohenillan29.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT_SCAN + '\n\n' + rulesText + '\n\nTu es en mode CHAT. L\'utilisateur te pose des questions sur les règles ci-dessus. Réponds en français, de façon courte et claire (3-5 lignes max). Confirme que tu as bien compris chaque règle en donnant un exemple concret.' }] },
        contents: [{ parts: [{ text: question }] }],
        generationConfig: { temperature: 0.3 },
        _forceFlash: true // Flash direct, réponse rapide
      })
    });

    const rawText = await response.text();
    let answer = '';
    for (const line of rawText.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const chunk = JSON.parse(line.slice(6));
        if (chunk.error) continue;
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const p of parts) { if (p.text && !p.thought) answer += p.text; }
      } catch(e) {}
    }

    const loading = document.getElementById('rule-chat-loading');
    if (loading) loading.remove();
    msgs.innerHTML += '<div style="font-size:0.73rem;margin-bottom:8px;padding:6px 8px;background:#f0f7ff;border-radius:6px;"><b style="color:#4a148c;">IA :</b> ' + (answer || 'Pas de réponse').replace(/</g,'&lt;').replace(/\n/g,'<br>') + '</div>';
    msgs.scrollTop = msgs.scrollHeight;
  } catch(e) {
    const loading = document.getElementById('rule-chat-loading');
    if (loading) loading.remove();
    msgs.innerHTML += '<div style="font-size:0.73rem;color:#c62828;margin-bottom:4px;">❌ Erreur : ' + (e.message||'').slice(0,60) + '</div>';
  }
}
