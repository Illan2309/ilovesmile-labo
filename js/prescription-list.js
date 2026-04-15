// ---- RENDER LIST ----


// ═══════════════════════════════════════════════════════

function renderList() {
  // Toujours synchroniser avec window.prescriptions (mis à jour par Firebase)
  prescriptions = window.prescriptions || [];
  const list = document.getElementById('prescriptions-list');
  const badge = document.getElementById('count-badge');
  const search = document.getElementById('search-input')?.value.toLowerCase() || '';
  const filtre = document.getElementById('filter-statut')?.value || 'tous';

  // Stats
  const encours = prescriptions.filter(p => p.statut !== 'livre').length;
  const livre = prescriptions.filter(p => p.statut === 'livre').length;
  const total = prescriptions.length;
  const nAttente = prescriptions.filter(p => (p.statut||'attente') === 'attente' || (p.statut||'') === 'en-cours').length;
  const nVerifie = prescriptions.filter(p => (p.statut||'') === 'verifie' || (p.statut||'') === 'livre').length;
  const nImporte = prescriptions.filter(p => (p.statut||'') === 'importe' && !p.cogilog_exporte).length;
  const nCogilog = prescriptions.filter(p => !!p.cogilog_exporte).length;
  document.getElementById('stat-tous').textContent = total + ' total';
  document.getElementById('stat-attente').textContent = nAttente + ' en attente';
  document.getElementById('stat-verifie').textContent = nVerifie + ' vérifiés';
  document.getElementById('stat-importe').textContent = nImporte + ' importés EN';
  document.getElementById('stat-cogilog').textContent = nCogilog + ' 🌼 Bons commandes Cogilog';

  // Filtrage
  let filtered = prescriptions.map((p, i) => ({ ...p, _index: i }));
  if (filtre !== 'tous') filtered = filtered.filter(p => {
    const s = p.statut;
    if (filtre === 'attente') return s === 'attente' || s === 'en-cours';
    if (filtre === 'verifie') return s === 'verifie' || s === 'livre';
    if (filtre === 'importe') return s === 'importe' && !p.cogilog_exporte;
    if (filtre === 'cogilog') return !!p.cogilog_exporte;
    return s === filtre;
  });
  // Filtre code labo (input texte, startsWith)
  const inputLabo = document.getElementById('filter-code-labo');
  const filterLabo = (inputLabo?.value || '').trim().toUpperCase();
  if (filterLabo) filtered = filtered.filter(p => (p.code_labo || '').toUpperCase().startsWith(filterLabo));
  // Filtre par période (date de création)
  var _fdFrom = (document.getElementById('filter-date-from')?.value || '').trim();
  var _fdTo = (document.getElementById('filter-date-to')?.value || '').trim();
  if (_fdFrom || _fdTo) {
    var _parseFD = function(d) {
      if (!d || d.length < 6) return null;
      var p = d.split('/');
      if (p.length !== 3) return null;
      var y = parseInt(p[2]); if (y < 100) y += 2000;
      return new Date(y, parseInt(p[1])-1, parseInt(p[0]));
    };
    var from = _parseFD(_fdFrom);
    var to = _parseFD(_fdTo);
    if (to) to.setHours(23,59,59);
    filtered = filtered.filter(function(p) {
      var d = _parseFD(p.createdAt);
      if (!d) return true;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  // Filtre cabinet sélectionné via autocomplete
  const filterCabVal = window._filterCabinet || '';
  const filterPratVal = window._filterPraticien || '';
  if (filterCabVal) filtered = filtered.filter(p => (p.cabinet || '').toLowerCase().includes(filterCabVal.toLowerCase()));
  if (filterPratVal) filtered = filtered.filter(p => (p.praticien || '').toLowerCase().includes(filterPratVal.toLowerCase()));

  // Recherche globale libre
  if (search) {
    filtered = filtered.filter(p => {
      const fields = [
        p.patient?.nom, p.patient?.prenom,
        p.cabinet, p.praticien,
        p.numero, p.code_labo,
        p.fournisseur,
        p.date_saisie, p.date_livraison,
        ...(p.conjointe || []),
        ...(p.adjointe || [])
      ].map(v => (v || '').toLowerCase());
      return fields.some(f => f.includes(search));
    });
  }

  // Afficher/cacher les tags filtres actifs
  const tagsDiv = document.getElementById('filter-active-tags');
  if (tagsDiv) {
    const tags = [];
    if (filterCabVal) tags.push({ label: '🏥 ' + filterCabVal, clear: 'filterClearCabinet' });
    if (filterPratVal) tags.push({ label: '👤 ' + filterPratVal, clear: 'filterClearPraticien' });
    if (tags.length) {
      tagsDiv.style.display = 'flex';
      tagsDiv.innerHTML = tags.map(t =>
        `<span class="filter-tag">${t.label}<button type="button" class="filter-tag-close" onclick="${t.clear}()">✕</button></span>`
      ).join('');
    } else {
      tagsDiv.style.display = 'none';
      tagsDiv.innerHTML = '';
    }
  }

  badge.textContent = prescriptions.length + ' prescription(s)';

  // Tri
  const sortMode = window._sortMode || 'recent';
  filtered.sort((a, b) => {
    if (sortMode === 'creation_desc') {
      // Trier par date de création (createdAt) — insensible aux mises à jour
      const parseDate = (d) => {
        if (!d) return 0;
        // format DD/MM/YYYY
        const p = d.split('/');
        if (p.length === 3) return new Date(p[2] < 100 ? '20'+p[2] : p[2], p[1]-1, p[0]).getTime();
        return new Date(d).getTime() || 0;
      };
      return parseDate(b.createdAt) - parseDate(a.createdAt);
    }
    if (sortMode === 'recent')         return (b._ts || 0) - (a._ts || 0);
    if (sortMode === 'ancien')         return (a._ts || 0) - (b._ts || 0);
    if (sortMode === 'code_asc' || sortMode === 'code_desc') {
      // Natural sort sur code_labo (ex: XZ1 < XZ2 < XZ10 < XZ15)
      const naturalKey = s => {
        const str = (s || '').trim();
        // Découper en segments alternés texte/nombre : "XZ10B" → ["XZ", 10, "B"]
        return str.replace(/(\d+)/g, (_, n) => n.padStart(10, '0'));
      };
      const ka = naturalKey(a.code_labo), kb = naturalKey(b.code_labo);
      const cmp = ka.localeCompare(kb, 'fr');
      return sortMode === 'code_asc' ? cmp : -cmp;
    }
    if (sortMode === 'livraison_asc')  return (a.dates?.livraison || '').localeCompare(b.dates?.livraison || '');
    if (sortMode === 'livraison_desc') return (b.dates?.livraison || '').localeCompare(a.dates?.livraison || '');
    return 0;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">${prescriptions.length === 0 ? 'Aucune prescription enregistrée pour le moment.' : 'Aucun résultat pour cette recherche.'}</div>`;
    return;
  }

  const STATUS_MAP = {
    'verifie':  { cls: 'status-verifie',  label: '✅ Vérifié' },
    'importe':  { cls: 'status-importe',  label: '🔵 Importé' },
    'attente':  { cls: 'status-attente',  label: '🟡 En attente' },
    'livre':    { cls: 'status-verifie',  label: '✅ Vérifié' },
    'en-cours': { cls: 'status-attente',  label: '🟡 En attente' },
  };

  list.innerHTML = filtered.map(p => {
    const i = p._index;
    const types = [...(p.conjointe||[]), ...(p.adjointe||[])].slice(0, 2).join(', ') || '—';
    const { cls: statusClass, label: statusLabel } = STATUS_MAP[p.statut] || STATUS_MAP['attente'];
    const codeLabo = p.code_labo ? `<span class="code-labo-badge">${p.code_labo}</span> ` : '';
    const refaireBadge = p.aRefaire ? `<span style="background:#cc0000;color:white;font-size:0.65rem;font-weight:700;padding:2px 7px;border-radius:4px;margin-left:4px;">À REFAIRE</span>` : '';
    const fournisseur = p.fournisseur ? ` <span class="fournisseur-badge">${p.fournisseur}</span>` : '';
    const cabinetNom = p.cabinet || '';
    const praticienStr = p.praticien ? 'Dr. ' + p.praticien : '';
    const cabinetDisplay = cabinetNom
      ? `<span onclick="ouvrirFicheClient(decodeURIComponent('${_enc(cabinetNom)}'), event)" style="cursor:pointer; color:#1a5c8a; font-weight:600; text-decoration:underline; text-decoration-style:dotted; text-underline-offset:2px;" title="Ouvrir la fiche cabinet">${cabinetNom}</span>${praticienStr ? ' · ' + praticienStr : ''}`
      : '—';
    const pdfEnTitle = p.pdf_url ? '✅ PDF anglais déjà généré — cliquer pour regénérer' : '⚠️ PDF anglais non généré';
    return `
      <div class="prescription-item" style="cursor:default;">
        <div class="flex-center gap-8" style="align-items:flex-start;width:100%;">
          <input type="checkbox" class="prescription-cb" data-index="${i}" onchange="updateSelection()" style="margin-top:4px;width:16px;height:16px;cursor:pointer;accent-color:var(--accent);">
          <div class="flex-center gap-8" style="flex:1;flex-wrap:wrap;align-items:flex-start;">
            <div class="pi-left" style="flex:1;min-width:180px;">
              <div class="pi-num">${codeLabo}${p.numero}${refaireBadge}</div>
              <div class="pi-patient">${p.patient?.nom || '—'} ${p.patient?.age ? `(${p.patient.age} ans)` : ''} ${p.patient?.sexe ? `· ${p.patient.sexe}` : ''}</div>
              <div class="pi-type">${cabinetDisplay}${fournisseur}</div>
              <div class="text-muted mt-2" style="font-size:0.72rem;display:flex;gap:16px;">
                <span>Date de saisie : ${p.createdAt || '—'}</span>
                <span style="color:var(--danger);font-weight:600;">Livraison : ${p.dates?.livraison ? new Date(p.dates.livraison).toLocaleDateString('fr-FR') : '—'}</span>
              </div>
            </div>
            <div class="pi-actions">
              <div class="flex-center gap-6" style="flex-wrap:wrap;">
                <span class="status-badge ${statusClass}" style="cursor:pointer;" onclick="toggleStatutById('${p._id}')">${statusLabel}</span>
                ${p.cogilog_exporte ? '<span style="margin-left:5px;font-size:1rem;" title="Exporté vers Cogilog">🌼</span>' : ''}
              </div>
              <div class="flex-center gap-6 mt-6" style="flex-wrap:wrap;">
                <button class="btn-pdf" onclick="editPrescriptionById('${p._id}')" style="background:#e8f2f9;color:var(--accent);">✏️ Modifier</button>
                <button class="btn-pdf" onclick="exportPDF(${i})">📄 PDF</button>
                <button class="btn-pdf" onclick="genererPDFAnglaisManuel(${i})" style="background:#e8f5e9;color:#2e7d32;" title="${pdfEnTitle}">${p.pdf_url ? '🇬🇧✅' : '🇬🇧'}</button>
                <button class="btn-pdf" onclick="deletePrescriptionById('${p._id}')" style="color:var(--danger);border-color:var(--danger);">🗑️</button>
              </div>
              <div class="pi-date">Livraison : ${p.dates?.livraison ? new Date(p.dates.livraison).toLocaleDateString('fr-FR') : '—'}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---- SÉLECTION MULTIPLE ----
var selectionModeActive = false;

function toggleSelectionMode() {
  selectionModeActive = !selectionModeActive;
  const btn = document.getElementById('btn-selection-mode');
  const btnAll = document.getElementById('btn-select-all');
  const btnDel = document.getElementById('btn-delete-selected');
  const countEl = document.getElementById('selection-count');
  btn.textContent = selectionModeActive ? '✕ Annuler' : '☑️ Sélectionner';
  btn.style.background = selectionModeActive ? '#fff3cd' : 'white';
  btn.style.color = selectionModeActive ? '#856404' : 'var(--accent)';
  btnAll.style.display = selectionModeActive ? 'inline-block' : 'none';
  btnDel.style.display = selectionModeActive ? 'inline-block' : 'none';
  countEl.style.display = selectionModeActive ? 'inline' : 'none';
  if (!selectionModeActive) {
    document.querySelectorAll('.prescription-cb').forEach(cb => cb.checked = false);
    document.getElementById('select-all-cb').checked = false;
    countEl.textContent = '';
  }
  renderList();
}

function updateSelection() {
  const checked = document.querySelectorAll('.prescription-cb:checked').length;
  const total = document.querySelectorAll('.prescription-cb').length;
  document.getElementById('selection-count').textContent = checked + ' sélectionné(s)';
  document.getElementById('select-all-cb').checked = checked === total && total > 0;
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.prescription-cb').forEach(cb => cb.checked = checked);
  updateSelection();
}

function deleteSelected() {
  const selected = [...document.querySelectorAll('.prescription-cb:checked')].map(cb => parseInt(cb.dataset.index));
  if (!selected.length) { showToast('Aucune prescription sélectionnée.', true); return; }
  if (selected.length > 100) {
    if (!confirm('Attention : ' + selected.length + ' prescriptions sélectionnées, c\'est beaucoup.\nC\'est peut-être une erreur. Vraiment tout supprimer ?')) return;
  }
  if (!confirm('Supprimer ' + selected.length + ' prescription(s) ?')) return;
  // Collecter les IDs à supprimer avant de modifier le tableau
  const idsToDelete = selected.map(i => (window.prescriptions || [])[i]?._id).filter(Boolean);
  // Supprimer dans Firebase
  idsToDelete.forEach(id => {
    if (window.supprimerPrescriptionCloud) window.supprimerPrescriptionCloud(id);
  });
  // Suppression locale immédiate
  window.prescriptions = (window.prescriptions || []).filter(p => !idsToDelete.includes(p._id));
  prescriptions = window.prescriptions;
  editingIndex = -1;
  renderList();
  showToast(idsToDelete.length + ' prescription(s) supprimée(s).');
  toggleSelectionMode();
}

function toggleStatut(i) {
  const cycle = { 'attente': 'verifie', 'verifie': 'importe', 'importe': 'attente',
                  'en-cours': 'verifie', 'livre': 'importe' }; // rétrocompat
  const ancienStatut = prescriptions[i].statut;
  prescriptions[i].statut = cycle[ancienStatut] || 'verifie';

  // Si on passe à "vérifié" → générer PDF anglais et l'uploader sur Cloudinary
  if (prescriptions[i].statut === 'verifie' && !prescriptions[i].pdf_url) {
    genererEtUploaderPDFAnglais(prescriptions[i]);
  }

  if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(prescriptions[i]);
  renderList();
}

async function genererPDFAnglaisManuel(i) {
  const p = prescriptions[i];
  if (!p) return;
  showToast('📄 Génération PDF anglais...');
  const commentaireEN = await traduireCommentaire(p.commentaires);
  const doc = await buildPDFAnglaisDoc(p, commentaireEN);
  // Télécharger directement
  const numStr = (p.numero || '').replace('N° ', '');
  const codeLabo = (p.code_labo || '').trim();
  const pdfDataUri = doc.output('datauristring');
  const link = document.createElement('a');
  link.href = pdfDataUri;
  link.download = (codeLabo ? codeLabo + '(' + numStr + ')' : numStr) + '.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Uploader en arrière-plan
  genererEtUploaderPDFAnglais(p);
  renderList();
}

async function genererEtUploaderPDFAnglais(p) {
  try {
    showToast('📄 Génération PDF anglais...');
    const commentaireEN = await traduireCommentaire(p.commentaires);
    const doc = await buildPDFAnglaisDoc(p, commentaireEN);
    const pdfBase64 = doc.output('datauristring'); // data:application/pdf;base64,...
    const pdfUrl = await window.uploadPhotoCloudinary(pdfBase64);
    if (pdfUrl) {
      p.pdf_url = pdfUrl;
      if (window.sauvegarderUnePrescription) window.sauvegarderUnePrescription(p);
      showToast('✅ PDF anglais sauvegardé dans le cloud !');
    }
  } catch(e) {
    console.error('Erreur génération PDF anglais:', e);
  }
}

function voirPhoto(i) {
  const photo = prescriptions[i].photo_url || prescriptions[i].photo;
  if (!photo || photo === '__photo__') return;
  document.getElementById('modal-img').src = photo;
  const modal = document.getElementById('photo-modal');
  modal.style.display = 'flex';
}

function deletePrescription(i) {
  if (!confirm('Supprimer cette prescription ?')) return;
  const p = (window.prescriptions || [])[i];
  if (!p) return;
  if (p._id && window.supprimerPrescriptionCloud) window.supprimerPrescriptionCloud(p._id);
  // Suppression locale immédiate pour feedback instantané
  window.prescriptions.splice(i, 1);
  prescriptions = window.prescriptions;
  if (editingIndex === i) { editingIndex = -1; resetForm(); }
  else if (editingIndex > i) editingIndex--;
  renderList();
  showToast('Prescription supprimée');
}

function ouvrirFicheClient(cab, event) {
  if (event) event.stopPropagation();
  ouvrirModalTarifs();
  gcCabinetSelectionne = cab;
  tarifsSelectedCabinet = getTarifKey(cab) || cab;
  tarifsSelectedCabinets = tarifsSelectedCabinet ? [tarifsSelectedCabinet] : [];
  gcSwitchTab('contacts');
  gcConstruireListe();
  // Scroller sur le cabinet dans la sidebar
  setTimeout(() => {
    const items = document.querySelectorAll('#gc-cabinet-list .gc-list-item');
    items.forEach(el => { if (el.textContent.includes(cab.substring(0,10))) el.scrollIntoView({ block:'nearest' }); });
  }, 100);
}

// ── Helpers _ById : recherche par _id stable au lieu d'index (anti-race onSnapshot) ──
function _findIdxById(id) {
  return (window.prescriptions || []).findIndex(p => p._id === id);
}

function editPrescriptionById(id) {
  const idx = _findIdxById(id);
  if (idx < 0) { showToast('Prescription introuvable', true); return; }
  editPrescription(idx);
}

function deletePrescriptionById(id) {
  const idx = _findIdxById(id);
  if (idx >= 0) deletePrescription(idx);
}

function toggleStatutById(id) {
  const idx = _findIdxById(id);
  if (idx >= 0) toggleStatut(idx);
}

