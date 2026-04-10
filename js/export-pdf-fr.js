// ---- EXPORT PDF ----
function exportPDF(i) {
  const p = prescriptions[i];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const blue = [26, 92, 138];
  const lightBlue = [232, 242, 249];
  const gray = [138, 134, 128];
  const lightGray = [249, 247, 244];
  const dark = [28, 26, 23];
  const borderGray = [217, 212, 204];

  const W = 210;
  let y = 0;

  // Header bar
  doc.setFillColor(...blue);
  doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('LABO I LOVE SMILE – PRESCRIPTION DENTAIRE', 14, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(p.numero, 14, 17);
  doc.text('Créé le : ' + (p.createdAt || '—'), W - 14, 17, { align: 'right' });

  y = 28;

  // Helper functions
  function sectionBox(title, x, yy, w, h) {
    doc.setFillColor(...lightGray);
    doc.setDrawColor(...borderGray);
    doc.roundedRect(x, yy, w, h, 2, 2, 'FD');
    doc.setFillColor(...blue);
    doc.setDrawColor(...blue);
    doc.roundedRect(x, yy, w, 6, 2, 2, 'F');
    doc.rect(x, yy + 3, w, 3, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), x + 3, yy + 4.5);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'normal');
  }

  function field(label, value, x, yy, w) {
    doc.setTextColor(...gray);
    doc.setFontSize(6);
    doc.text(label, x, yy);
    doc.setTextColor(...dark);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const val = value || '—';
    doc.text(String(val).substring(0, Math.floor(w / 1.8)), x, yy + 4.5);
    doc.setFont('helvetica', 'normal');
  }

  function checkList(items, x, yy, colW) {
    doc.setFontSize(7);
    doc.setTextColor(...dark);
    items.forEach((item, idx) => {
      const cx = x;
      const cy = yy + idx * 5;
      doc.setFillColor(...blue);
      doc.roundedRect(cx, cy - 2.5, 3, 3, 0.5, 0.5, 'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(5.5);
      doc.text('✓', cx + 0.6, cy - 0.2);
      doc.setTextColor(...dark);
      doc.setFontSize(7);
      doc.text(item.substring(0, Math.floor(colW / 1.6)), cx + 4.5, cy);
    });
  }

  // ROW 1: Praticien / Patient / Dates
  const row1H = 32;
  const col1W = 60; const col2W = 70; const col3W = 60;
  const margin = 10;
  const gap = 5;

  sectionBox('Commande', margin, y, col1W, row1H);
  field('Praticien', p.praticien, margin + 3, y + 10, col1W - 6);
  field('Statut', p.aRefaire ? 'À REFAIRE ⚠' : 'Normal', margin + 3, y + 20, col1W - 6);

  const x2 = margin + col1W + gap;
  sectionBox('Patient', x2, y, col2W, row1H);
  field('Nom', p.patient?.nom, x2 + 3, y + 10, col2W - 6);
  field('Âge', p.patient?.age ? p.patient.age + ' ans' : '—', x2 + 3, y + 20, 20);
  field('Sexe', p.patient?.sexe || '—', x2 + 26, y + 20, 40);

  const x3 = x2 + col2W + gap;
  sectionBox('Dates & Infos', x3, y, col3W, row1H);
  field('Prise d\'empreinte', p.dates?.empreinte ? new Date(p.dates.empreinte).toLocaleDateString('fr-FR') : '—', x3 + 3, y + 10, col3W - 6);
  field('Livraison', p.dates?.livraison ? new Date(p.dates.livraison).toLocaleDateString('fr-FR') : '—', x3 + 3, y + 20, col3W - 6);

  y += row1H + 5;

  // ROW 2: Dents
  sectionBox('Dents concernées', margin, y, W - margin * 2, 22);
  if (p.dents && p.dents.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...blue);
    doc.text(p.dents.sort((a,b)=>a-b).join('  –  '), margin + 3, y + 14);
    doc.setFont('helvetica', 'normal');
  } else {
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.text('Aucune dent sélectionnée', margin + 3, y + 14);
  }

  y += 27;

  // ROW 3: Conjointe + Adjointe
  const halfW = (W - margin * 2 - gap) / 2;
  const conjointeItems = p.conjointe || [];
  const adjointeItems = p.adjointe || [];
  const maxRows = Math.max(conjointeItems.length, adjointeItems.length, 1);
  const row3H = Math.max(maxRows * 5 + 14, 30);

  sectionBox('Prothèse Conjointe', margin, y, halfW, row3H);
  if (conjointeItems.length > 0) {
    checkList(conjointeItems, margin + 3, y + 10, halfW - 6);
  } else {
    doc.setFontSize(7); doc.setTextColor(...gray);
    doc.text('Aucune sélection', margin + 3, y + 14);
  }
  if (p.fraisage) {
    doc.setFontSize(6.5); doc.setTextColor(...gray);
    doc.text('Fraisage : ' + p.fraisage, margin + 3, y + row3H - 6);
  }
  if (p.piv) {
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5);
    const _frPivMaxW = halfW - 10;
    const _frPivEntries = p.piv.split(/\s*\/\s*/);
    const _frPivLines = [];
    _frPivEntries.forEach(function(entry) {
      var line = _frPivLines.length === 0 ? 'Scan body : ' + entry : entry;
      var lineW = doc.getStringUnitWidth(line) * 6.5 / doc.internal.scaleFactor;
      if (lineW > _frPivMaxW) {
        doc.splitTextToSize(line, _frPivMaxW).forEach(function(w) { _frPivLines.push(w); });
      } else {
        _frPivLines.push(line);
      }
    });
    const _frPivLineH = 4;
    const _frPivStartY = y + row3H - 2 - (_frPivLines.length - 1) * _frPivLineH;
    doc.setFillColor(255,243,205);
    doc.roundedRect(margin+2, _frPivStartY - 3.5, halfW - 6, _frPivLines.length * _frPivLineH + 3, 1, 1, 'F');
    doc.setDrawColor(230,160,0); doc.setLineWidth(0.2);
    doc.roundedRect(margin+2, _frPivStartY - 3.5, halfW - 6, _frPivLines.length * _frPivLineH + 3, 1, 1, 'S');
    doc.setTextColor(150,90,0);
    _frPivLines.forEach(function(line, li) {
      doc.text(line, margin + 4, _frPivStartY + li * _frPivLineH);
    });
  }

  const x4 = margin + halfW + gap;
  sectionBox('Prothèse Adjointe', x4, y, halfW, row3H);
  if (p.machoire && p.machoire.length > 0) {
    const machoireVals = Array.isArray(p.machoire) ? p.machoire : [p.machoire];
    doc.setFontSize(7); doc.setTextColor(...blue); doc.setFont('helvetica','bold');
    doc.text('Mâchoire : ' + machoireVals.map(v => v.toUpperCase()).join(' + '), x4 + 3, y + 9);
    doc.setFont('helvetica','normal');
  }
  if (adjointeItems.length > 0) {
    checkList(adjointeItems, x4 + 3, y + 10, halfW - 6);
  } else {
    doc.setFontSize(7); doc.setTextColor(...gray);
    doc.text('Aucune sélection', x4 + 3, y + 14);
  }

  y += row3H + 5;

  // ROW 4: Teinte + Commentaires
  const teinteW = 50;
  const commW = W - margin * 2 - gap - teinteW;
  const row4H = 30;

  sectionBox('Teinte', margin, y, teinteW, row4H);
  doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(...blue);
  doc.text(p.teinte || '—', margin + teinteW/2, y + 20, { align: 'center' });
  doc.setFont('helvetica','normal');
  if (p.dentExtraireVal) {
    doc.setFontSize(6.5); doc.setTextColor(...gray);
    doc.text('Dent à extraire : ' + p.dentExtraireVal, margin + 3, y + 27);
  }

  const x5 = margin + teinteW + gap;
  sectionBox('Commentaires', x5, y, commW, row4H);
  if (p.commentaires) {
    doc.setFontSize(7.5); doc.setTextColor(...dark);
    const lines = doc.splitTextToSize(p.commentaires, commW - 6);
    lines.slice(0, 4).forEach((line, li) => {
      doc.text(line, x5 + 3, y + 10 + li * 5);
    });
  } else {
    doc.setFontSize(7); doc.setTextColor(...gray);
    doc.text('Aucun commentaire', x5 + 3, y + 14);
  }

  y += row4H + 5;

  // Footer
  doc.setFillColor(...blue);
  doc.rect(0, 285, W, 12, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(7);
  doc.text('laboilovesmile.com  |  09 80 88 67 88  |  contact@laboilovesmile.com', W/2, 292, { align: 'center' });

  // Export via lien téléchargement — compatible mobile et desktop
  const pdfDataUri = doc.output('datauristring');
  const link = document.createElement('a');
  link.href = pdfDataUri;
  const numStr = p.numero.replace('N° ', '');
  const codeLabo = p.code_labo || 'LABO';
  link.download = codeLabo + ' ' + numStr + '.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('PDF téléchargé !');
}
