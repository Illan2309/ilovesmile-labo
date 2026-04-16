// ══════════════════════════════════════════
// DIGILAB PDF — Fiche de commande minimaliste
// Style inspiré des fiches Digilab officielles
// ══════════════════════════════════════════

window.generateDigilabPdf = async function(caseData) {
  if (!caseData) return;
  var jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
  if (!jsPDF) { console.error('jsPDF non disponible'); return; }

  var doc = new jsPDF({ unit: 'mm', format: 'a4' });
  var W = 210, H = 297;
  var margin = 12;
  var secW = W - margin * 2;

  // ── Palette minimaliste ──
  var teal = [91, 196, 192];
  var dark = [40, 40, 40];
  var muted = [120, 120, 120];
  var lightGray = [245, 245, 245];
  var borderGray = [220, 220, 220];
  var white = [255, 255, 255];
  var accentBlue = [26, 92, 138];
  var red = [192, 57, 43];

  // ── Données ──
  var dentist = caseData.dentistCreator || {};
  var ofData = caseData.of || {};
  var cabinetName = dentist.name || ofData.user_name || caseData.realDentist || '';
  var patientName = caseData.patient_name || '';
  var caseId = caseData._id || caseData._digilabId || '';
  var service = (caseData.service || '').toUpperCase();
  var comment = caseData.comment || '';
  var creationDate = _dlbFmt(caseData.creation_date || caseData._receivedAt || '');
  var deadline = _dlbFmt(caseData.globalDeadline || '');
  var priceList = caseData.priceList || [];
  var cameraData = caseData.cameraData || [];
  var linkCase = caseData.link_case || ('https://app.digilab.dental/case2/' + caseId);
  var dentistName = caseData.dentistName || dentist.name || caseData.senderEmail || '';

  // ══════════════════════════════════
  // DATE + NOM LABO (en-tête discret)
  // ══════════════════════════════════
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text(creationDate + '  ' + (_dlbFmtTime(caseData.creation_date || caseData._receivedAt || '')), margin, 8);
  doc.text('I love smile', W - margin, 8, { align: 'right' });

  // ══════════════════════════════════
  // HEADER — Box avec QR + infos
  // ══════════════════════════════════
  var hY = 14;
  var hH = 32;

  // Box fond gris clair avec bordure teal
  doc.setFillColor(...lightGray);
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, hY, secW, hH, 3, 3, 'FD');

  // QR Code (gauche)
  var qrSize = 22;
  var qrX = margin + 5;
  var qrY = hY + (hH - qrSize) / 2;
  if (linkCase && typeof qrcode !== 'undefined') {
    try {
      var _qrFn = (typeof qrcode === 'function') ? qrcode : (qrcode.default || null);
      if (_qrFn) {
        var _qr = _qrFn(0, 'M');
        _qr.addData(linkCase);
        _qr.make();
        var _qrCanvas = document.createElement('canvas');
        var _qrMod = _qr.getModuleCount();
        var _qrCell = 4;
        _qrCanvas.width = _qrMod * _qrCell;
        _qrCanvas.height = _qrMod * _qrCell;
        var _qrCtx = _qrCanvas.getContext('2d');
        _qrCtx.fillStyle = '#f5f5f5';
        _qrCtx.fillRect(0, 0, _qrCanvas.width, _qrCanvas.height);
        for (var qr = 0; qr < _qrMod; qr++) {
          for (var qc = 0; qc < _qrMod; qc++) {
            if (_qr.isDark(qr, qc)) {
              _qrCtx.fillStyle = '#1a5c8a';
              _qrCtx.fillRect(qc * _qrCell, qr * _qrCell, _qrCell, _qrCell);
            }
          }
        }
        doc.addImage(_qrCanvas.toDataURL('image/png'), 'PNG', qrX, qrY, qrSize, qrSize);
      }
    } catch(e) {}
  }

  // Infos (centre)
  var infoX = qrX + qrSize + 8;
  var infoY = hY + 7;
  var lineH = 5;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...muted);
  doc.text('Numero: ', infoX, infoY);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...dark);
  doc.text(String(caseId), infoX + doc.getTextWidth('Numero: '), infoY);

  infoY += lineH;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...muted);
  doc.text('Auteur: ', infoX, infoY);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...dark);
  doc.text(cabinetName || '-', infoX + doc.getTextWidth('Auteur: '), infoY);

  infoY += lineH;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...muted);
  doc.text('Reference patient: ', infoX, infoY);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...dark);
  doc.text(patientName || '-', infoX + doc.getTextWidth('Reference patient: '), infoY);

  infoY += lineH;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...muted);
  doc.text('Dentiste: ', infoX, infoY);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...dark);
  doc.text(dentistName || cabinetName || '-', infoX + doc.getTextWidth('Dentiste: '), infoY);

  infoY += lineH;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...muted);
  doc.text('Date de livraison souhaitee: ', infoX, infoY);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...dark);
  doc.text(deadline || '-', infoX + doc.getTextWidth('Date de livraison souhaitee: '), infoY);

  // Logo "I love smile" cursif (droite) — canvas avec Dancing Script
  try {
    var danceCanvas = document.createElement('canvas');
    var dScale = 4;
    var dW = 220, dH = 48;
    danceCanvas.width = dW * dScale;
    danceCanvas.height = dH * dScale;
    var dCtx = danceCanvas.getContext('2d');
    dCtx.scale(dScale, dScale);
    dCtx.clearRect(0, 0, dW, dH);
    dCtx.font = "bold 30px 'Dancing Script', cursive";
    var textGrad = dCtx.createLinearGradient(0, 0, 180, 0);
    textGrad.addColorStop(0, '#1a5c8a');
    textGrad.addColorStop(0.6, '#5bc4c0');
    textGrad.addColorStop(1, '#4ab0ac');
    dCtx.fillStyle = textGrad;
    dCtx.fillText('I love smile', 0, 30);
    var lineGrad = dCtx.createLinearGradient(0, 0, 180, 0);
    lineGrad.addColorStop(0, '#1a5c8a');
    lineGrad.addColorStop(1, '#5bc4c0');
    dCtx.strokeStyle = lineGrad;
    dCtx.lineWidth = 2;
    dCtx.lineCap = 'round';
    dCtx.beginPath(); dCtx.moveTo(0, 36); dCtx.lineTo(160, 36); dCtx.stroke();
    var danceImg = danceCanvas.toDataURL('image/png');
    var mmPerPx = 25.4 / 96;
    var logoX = W - margin - dW * mmPerPx - 2;
    doc.addImage(danceImg, 'PNG', logoX, hY + 5, dW * mmPerPx, dH * mmPerPx);
  } catch(e) {}

  // ══════════════════════════════════
  // SCHEMA DENTAIRE
  // ══════════════════════════════════
  var y = hY + hH + 10;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...dark);
  doc.setDrawColor(...dark); doc.setLineWidth(0.3);
  doc.text('Choix du travail', margin, y);
  doc.line(margin, y + 1.5, margin + doc.getTextWidth('Choix du travail'), y + 1.5);

  y += 8;

  var selectedTeeth = _extractTeethDlb(cameraData, priceList);
  var DENTS_H = [[18,17,16,15,14,13,12,11],[21,22,23,24,25,26,27,28]];
  var DENTS_B = [[48,47,46,45,44,43,42,41],[31,32,33,34,35,36,37,38]];
  var btnW = 9.5, btnH = 7;
  var gap = 4;
  var totalDW = 8 * btnW * 2 + gap;
  var startX = (W - totalDW) / 2;

  function drawToothRow(rowDents, rowY) {
    var dx = startX;
    rowDents[0].forEach(function(n) {
      var sel = selectedTeeth.includes(n);
      if (sel) {
        doc.setFillColor(...teal);
        doc.roundedRect(dx, rowY, btnW - 1, btnH, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...white);
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...muted);
      }
      doc.text(String(n), dx + (btnW - 1) / 2, rowY + btnH / 2 + 2, { align: 'center' });
      dx += btnW;
    });
    dx += gap;
    rowDents[1].forEach(function(n) {
      var sel = selectedTeeth.includes(n);
      if (sel) {
        doc.setFillColor(...teal);
        doc.roundedRect(dx, rowY, btnW - 1, btnH, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...white);
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...muted);
      }
      doc.text(String(n), dx + (btnW - 1) / 2, rowY + btnH / 2 + 2, { align: 'center' });
      dx += btnW;
    });
  }

  drawToothRow(DENTS_H, y);
  y += btnH + 3;
  // Ligne séparatrice mâchoires
  doc.setDrawColor(...borderGray); doc.setLineWidth(0.2);
  doc.line(startX, y, startX + totalDW, y);
  y += 3;
  drawToothRow(DENTS_B, y);
  y += btnH + 12;

  // ══════════════════════════════════
  // TABLEAU DES TRAVAUX
  // ══════════════════════════════════
  if (priceList.length > 0) {
    // En-têtes tableau (minimaliste : ZONE, TEINTE, DÉSIGNATION, MATÉRIAU)
    var cols = [
      { label: 'ZONE', x: margin, w: 22 },
      { label: 'TEINTE', x: margin + 22, w: 22 },
      { label: 'DESIGNATION', x: margin + 44, w: 60 },
      { label: 'MATERIAU', x: margin + 104, w: secW - 104 },
    ];

    // Header row
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...muted);
    cols.forEach(function(col) {
      doc.text(col.label, col.x, y);
    });
    y += 2;
    doc.setDrawColor(...dark); doc.setLineWidth(0.3);
    doc.line(margin, y, margin + secW, y);
    y += 5;

    // Data rows
    priceList.forEach(function(item) {
      var zone = item.area || '';
      var teinte = item.shade || '';
      var designation = item.frDesignation || item.designation || '';
      var materiau = item.material || '';

      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...dark);

      // Teinte, désignation, matériau sur la première ligne
      doc.text(String(teinte), cols[1].x, y);
      doc.text(String(designation), cols[2].x, y, { maxWidth: cols[2].w - 2 });
      doc.text(String(materiau), cols[3].x, y, { maxWidth: cols[3].w - 2 });

      // Zone : retour à la ligne tous les ~30 caractères (aux virgules)
      var zoneStr = String(zone);
      var zoneLines = [];
      if (zoneStr.length <= 10) {
        zoneLines = [zoneStr];
      } else {
        var parts = zoneStr.split(',');
        var current = '';
        for (var zi = 0; zi < parts.length; zi++) {
          var test = current ? current + ',' + parts[zi].trim() : parts[zi].trim();
          if (test.length > 10 && current) {
            zoneLines.push(current);
            current = parts[zi].trim();
          } else {
            current = test;
          }
        }
        if (current) zoneLines.push(current);
      }
      doc.text(zoneLines[0], cols[0].x, y);
      for (var li = 1; li < zoneLines.length; li++) {
        doc.text(zoneLines[li], cols[0].x, y + li * 4);
      }
      y += Math.max(8, zoneLines.length * 4 + 2);

      // Ligne séparatrice légère
      doc.setDrawColor(...borderGray); doc.setLineWidth(0.1);
      doc.line(margin, y - 3, margin + secW, y - 3);
    });

    y += 5;
  }

  // ══════════════════════════════════
  // COMMENTAIRE
  // ══════════════════════════════════
  if (comment) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...dark);
    doc.setDrawColor(...dark); doc.setLineWidth(0.3);
    doc.text('Commentaire', margin, y);
    doc.line(margin, y + 1.5, margin + doc.getTextWidth('Commentaire'), y + 1.5);
    y += 6;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...dark);
    var commLines = doc.splitTextToSize(comment, secW - 4);
    doc.text(commLines, margin, y);
    y += commLines.length * 4 + 8;
  }

  // ══════════════════════════════════
  // PIED DE PAGE
  // ══════════════════════════════════
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...muted);
  doc.text(linkCase || '', margin, H - 6);
  doc.text('1/1', W - margin, H - 6, { align: 'right' });

  // ══════════════════════════════════
  // RETOUR
  // ══════════════════════════════════
  var safeName = (patientName || 'digilab').toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
  return { doc: doc, filename: 'fiche_digilab_' + safeName + '.pdf' };
};

// ── Télécharger le PDF ──
window.dlbDownloadPdf = function(caseId) {
  fetch('https://digilab-webhook.cohenillan29.workers.dev/v1/orders?key=ils_webhook_2026_Sm1leL4b')
    .then(function(r) { return r.json(); })
    .then(async function(data) {
      var c = (data.orders || []).find(function(o) { return (o._digilabId || o._id) === caseId; });
      if (!c) { showToast('Cas introuvable', true); return; }
      var result = await window.generateDigilabPdf(c);
      if (result && result.doc) {
        result.doc.save(result.filename);
        showToast('PDF genere : ' + result.filename);
      }
    })
    .catch(function(e) { showToast('Erreur PDF : ' + e.message, true); });
};

// ── Helpers ──
function _dlbFmt(isoStr) {
  if (!isoStr) return '';
  try { return new Date(isoStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch(e) { return isoStr; }
}

function _dlbFmtTime(isoStr) {
  if (!isoStr) return '';
  try { return new Date(isoStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch(e) { return ''; }
}

function _extractTeethDlb(cameraData, priceList) {
  var teeth = [];
  (cameraData || []).forEach(function(cam) {
    var zone = cam.zone || (cam.details && cam.details.area) || '';
    if (/^\d{2}$/.test(zone)) { var n = parseInt(zone); if (n >= 11 && n <= 48) teeth.push(n); }
    var jaw = (cam.details && cam.details.jawType) || '';
    if (jaw.includes('UPPER')) { for (var i = 11; i <= 28; i++) if (!teeth.includes(i)) teeth.push(i); }
    if (jaw.includes('LOWER')) { for (var i = 31; i <= 48; i++) if (!teeth.includes(i)) teeth.push(i); }
  });
  (priceList || []).forEach(function(item) {
    var area = item.area || '';
    if (/^\d{2}$/.test(area)) { var n = parseInt(area); if (n >= 11 && n <= 48) teeth.push(n); }
  });
  return teeth.filter(function(v, i, a) { return a.indexOf(v) === i; });
}
