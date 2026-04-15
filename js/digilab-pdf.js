// ══════════════════════════════════════════
// DIGILAB PDF — Fiche de commande design
// Même style que le PDF anglais I Love Smile
// Logo, gradient, losanges, schéma FDI
// ══════════════════════════════════════════

window.generateDigilabPdf = async function(caseData) {
  if (!caseData) return;
  var jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
  if (!jsPDF) { console.error('jsPDF non disponible'); return; }

  var doc = new jsPDF({ unit: 'mm', format: 'a4' });
  var W = 210, H = 297;
  var margin = 10;
  var secW = W - margin * 2;

  // ── Palette I Love Smile (identique au PDF EN) ──
  var blue = [26, 92, 138];
  var teal = [91, 196, 192];
  var dark = [28, 42, 53];
  var muted = [122, 150, 168];
  var white = [255, 255, 255];
  var offWhite = [248, 251, 253];
  var borderCol = [195, 215, 228];
  var dangerRed = [192, 57, 43];

  // ── Données ──
  var dentist = caseData.dentistCreator || {};
  var ofData = caseData.of || {};
  var cabinetName = dentist.name || ofData.user_name || caseData.realDentist || '';
  var cabinetAddr = dentist.address || '';
  var cabinetCity = ((dentist.zipcode || '') + ' ' + (dentist.city || '')).trim();
  var cabinetPhone = dentist.phoneNumber || ofData.user_phoneNumber || '';
  var patientName = caseData.patient_name || '';
  var caseId = caseData._id || caseData._digilabId || '';
  var service = (caseData.service || '').toUpperCase();
  var comment = caseData.comment || '';
  var creationDate = _dlbFmt(caseData.creation_date || caseData._receivedAt || '');
  var deadline = _dlbFmt(caseData.globalDeadline || '');
  var priceList = caseData.priceList || [];
  var cameraData = caseData.cameraData || [];
  var linkCase = caseData.link_case || '';

  // ── Helpers graphiques (identiques PDF EN) ──
  function gradRect(x, y, w, h, steps) {
    steps = steps || 32;
    var sw = w / steps;
    for (var i = 0; i < steps; i++) {
      var r = i / steps;
      doc.setFillColor(
        Math.round(blue[0] + (teal[0] - blue[0]) * r),
        Math.round(blue[1] + (teal[1] - blue[1]) * r),
        Math.round(blue[2] + (teal[2] - blue[2]) * r)
      );
      doc.rect(x + i * sw, y, sw + 0.5, h, 'F');
    }
  }

  function sectionHeader(label, x, y, w) {
    var h = 7;
    doc.setFillColor(...white);
    doc.roundedRect(x, y, w, h + 4, 3.5, 3.5, 'F');
    gradRect(x, y, w, h);
    for (var i = 0; i < 32; i++) {
      var r = i / 32;
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

  function box(x, y, w, h) {
    doc.setFillColor(...borderCol);
    doc.roundedRect(x + 0.6, y + 0.8, w, h, 3.5, 3.5, 'F');
    doc.setFillColor(...white);
    doc.setDrawColor(...borderCol);
    doc.setLineWidth(0.22);
    doc.roundedRect(x, y, w, h, 3.5, 3.5, 'FD');
  }

  function checkbox(label, isBold, x, y) {
    var s = 2.0;
    var cx = x + s + 0.5;
    var cy = y - s + 0.8;
    for (var i = 0; i < 10; i++) {
      var r = i / 10;
      doc.setFillColor(
        Math.round(blue[0] + (teal[0] - blue[0]) * r),
        Math.round(blue[1] + (teal[1] - blue[1]) * r),
        Math.round(blue[2] + (teal[2] - blue[2]) * r)
      );
      var w2 = s * (1 - i / 10);
      doc.triangle(cx, cy - s + i * (s / 10), cx + w2, cy, cx, cy + s - i * (s / 10), 'F');
      doc.triangle(cx, cy - s + i * (s / 10), cx - w2, cy, cx, cy + s - i * (s / 10), 'F');
    }
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 7.8 : 7.2);
    doc.setTextColor(...(isBold ? dark : [60, 80, 100]));
    doc.text(label, x + s * 2 + 3, y + 0.2);
  }

  // ══════════════════════════════════
  // FOND + TRAME DE POINTS
  // ══════════════════════════════════
  doc.setFillColor(...white);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(234, 242, 248);
  for (var px = 18; px < W - 5; px += 12) {
    for (var py = 55; py < H - 22; py += 12) {
      doc.circle(px, py, 0.28, 'F');
    }
  }

  // ══════════════════════════════════
  // HEADER (identique PDF EN)
  // ══════════════════════════════════
  var hH = 50;
  doc.setFillColor(...white);
  doc.rect(0, 0, W, hH, 'F');
  gradRect(0, hH - 1.2, W, 1.2, 40);

  // Badge fiche (gauche)
  var bx = 6, by = 4, bw = 80, bh = hH - 8;
  doc.setFillColor(...white);
  doc.roundedRect(bx, by, bw, bh, 3, 3, 'F');
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.6);
  doc.roundedRect(bx, by, bw, bh, 3, 3, 'S');
  doc.setFillColor(...teal);
  doc.roundedRect(bx, by, bw, 5, 3, 3, 'F');
  doc.rect(bx, by + 2, bw, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(...white);
  doc.text('DIGILAB ORDER', bx + bw / 2, by + 4, { align: 'center' });

  // Numéro — taille auto
  var numStr = 'N\u00B0 ' + caseId;
  doc.setTextColor(...blue);
  doc.setFont('helvetica', 'bold');
  var numFs = 14;
  doc.setFontSize(numFs);
  while (doc.getTextWidth(numStr) > bw - 6 && numFs > 6) { numFs -= 0.5; doc.setFontSize(numFs); }
  doc.text(numStr, bx + bw / 2, by + 15, { align: 'center' });

  doc.setDrawColor(220, 230, 240);
  doc.setLineWidth(0.2);
  doc.line(bx + 5, by + 17, bx + bw - 5, by + 17);

  // Date + service
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...muted);
  doc.text('Date : ' + creationDate, bx + bw / 2, by + 22, { align: 'center' });

  // Service en badge couleur
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...teal);
  doc.text(service, bx + bw / 2, by + 29, { align: 'center' });

  // Deadline en rouge
  if (deadline) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...dangerRed);
    doc.text(deadline, bx + bw / 2, by + 37, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(...muted);
    doc.text('LIVRAISON', bx + bw / 2, by + 40, { align: 'center' });
  }

  // Logo I Love Smile (droite) — texte cursif + logo image
  var tx = bx + bw + 8;
  var textCy = hH / 2;

  // "I love smile" en canvas cursif (même technique PDF EN)
  var danceCanvas = document.createElement('canvas');
  var dScale = 4;
  var dW = 260, dH = 52;
  danceCanvas.width = dW * dScale;
  danceCanvas.height = dH * dScale;
  var dCtx = danceCanvas.getContext('2d');
  dCtx.scale(dScale, dScale);
  dCtx.clearRect(0, 0, dW, dH);
  dCtx.font = "bold 34px 'Dancing Script', cursive";
  var tm = dCtx.measureText('I love smile');
  var textGrad = dCtx.createLinearGradient(0, 0, tm.width, 0);
  textGrad.addColorStop(0, '#1a5c8a');
  textGrad.addColorStop(0.6, '#5bc4c0');
  textGrad.addColorStop(1, '#4ab0ac');
  dCtx.fillStyle = 'rgba(195,218,238,0.65)';
  dCtx.fillText('I love smile', 2, 36);
  dCtx.fillStyle = textGrad;
  dCtx.fillText('I love smile', 0, 34);
  var lineGrad = dCtx.createLinearGradient(0, 0, tm.width, 0);
  lineGrad.addColorStop(0, '#1a5c8a');
  lineGrad.addColorStop(1, '#5bc4c0');
  dCtx.strokeStyle = lineGrad;
  dCtx.lineWidth = 2.8;
  dCtx.lineCap = 'round';
  dCtx.beginPath();
  dCtx.moveTo(0, 41);
  dCtx.lineTo(tm.width, 41);
  dCtx.stroke();
  var danceImg = danceCanvas.toDataURL('image/png');
  var mmPerPx = 25.4 / 96;
  doc.addImage(danceImg, 'PNG', tx, textCy - 8, dW * mmPerPx, dH * mmPerPx);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...muted);
  doc.text('Laboratoire de protheses dentaires', tx, textCy + 7);

  // Logo image (si LOGO_B64 disponible)
  if (typeof LOGO_B64 !== 'undefined' && LOGO_B64) {
    try {
      var logoImg = new Image();
      logoImg.src = LOGO_B64;
      await new Promise(function(r) { logoImg.onload = r; logoImg.onerror = r; });
      var logoCanvas = document.createElement('canvas');
      logoCanvas.width = logoImg.naturalWidth || 200;
      logoCanvas.height = logoImg.naturalHeight || 200;
      var logoCtx = logoCanvas.getContext('2d');
      logoCtx.drawImage(logoImg, 0, 0);
      var logoData = logoCtx.getImageData(0, 0, logoCanvas.width, logoCanvas.height);
      var ld = logoData.data;
      for (var li = 0; li < ld.length; li += 4) {
        var avg = (ld[li] + ld[li+1] + ld[li+2]) / 3;
        if (avg > 228 && ld[li+3] > 180) ld[li+3] = 0;
      }
      logoCtx.putImageData(logoData, 0, 0);
      var logoPNG = logoCanvas.toDataURL('image/png');
      var logoH_mm = 32;
      var logoRatio = logoCanvas.width / logoCanvas.height;
      var logoW_mm = logoH_mm * logoRatio;
      doc.addImage(logoPNG, 'PNG', W - logoW_mm - 8, (hH - logoH_mm) / 2, logoW_mm, logoH_mm);
    } catch(e) {}
  }

  // QR Code vers la page Digilab
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
        _qrCtx.fillStyle = '#ffffff';
        _qrCtx.fillRect(0, 0, _qrCanvas.width, _qrCanvas.height);
        for (var qr = 0; qr < _qrMod; qr++) {
          for (var qc = 0; qc < _qrMod; qc++) {
            if (_qr.isDark(qr, qc)) {
              _qrCtx.fillStyle = '#1a5c8a';
              _qrCtx.fillRect(qc * _qrCell, qr * _qrCell, _qrCell, _qrCell);
            }
          }
        }
        var _qrData = _qrCanvas.toDataURL('image/png');
        var _qrMM = 20;
        var _qrX = (typeof LOGO_B64 !== 'undefined') ? W - 32 - _qrMM - 4 : W - margin - _qrMM;
        doc.addImage(_qrData, 'PNG', _qrX, (hH - _qrMM) / 2, _qrMM, _qrMM);
      }
    } catch(e) {}
  }

  // ══════════════════════════════════
  // SECTION 1 : CABINET / DATES / PATIENT
  // ══════════════════════════════════
  var y = hH + 8;
  var col3W = secW / 3;
  var rowH1 = 30;

  sectionHeader('CABINET DENTAIRE', margin, y, col3W - 2);
  box(margin, y + 7, col3W - 2, rowH1 - 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...muted);
  doc.text('NOM', margin + 4, y + 13);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...blue);
  doc.text(cabinetName || '\u2014', margin + 4, y + 19, { maxWidth: col3W - 10 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(...muted);
  if (cabinetAddr) doc.text(cabinetAddr, margin + 4, y + 24);
  if (cabinetCity) doc.text(cabinetCity, margin + 4, y + 28);
  if (cabinetPhone) doc.text('Tel : ' + cabinetPhone, margin + 4, y + 32);

  var px2 = margin + col3W + 1;
  sectionHeader('DATES', px2, y, col3W - 2);
  box(px2, y + 7, col3W - 2, rowH1 - 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...muted);
  doc.text('DATE COMMANDE', px2 + 4, y + 14);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
  doc.text(creationDate || '\u2014', px2 + 4, y + 19);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...muted);
  doc.text('LIVRAISON SOUHAITEE', px2 + 4, y + 24);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...dangerRed);
  doc.text(deadline || '\u2014', px2 + 4, y + 30);

  var px3 = margin + col3W * 2 + 2;
  var col3Wr = secW - (col3W - 2) * 2 - 4;
  sectionHeader('PATIENT', px3, y, col3Wr);
  box(px3, y + 7, col3Wr, rowH1 - 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...muted);
  doc.text('REFERENCE PATIENT', px3 + 4, y + 14);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...dark);
  doc.text(patientName || '\u2014', px3 + 4, y + 19, { maxWidth: col3Wr - 10 });

  y += rowH1 + 5;

  // ══════════════════════════════════
  // SECTION 2 : SCHEMA DENTAIRE FDI
  // ══════════════════════════════════
  var teethSH = 32;
  sectionHeader('SCHEMA DENTAIRE', margin, y, secW);
  box(margin, y + 7, secW, teethSH - 7);

  var selectedTeeth = _extractTeethDlb(cameraData, priceList);
  var DENTS_H = [[18,17,16,15,14,13,12,11],[21,22,23,24,25,26,27,28]];
  var DENTS_B = [[48,47,46,45,44,43,42,41],[31,32,33,34,35,36,37,38]];
  var btnW = 7.1, btnH = 5.3;
  var totalDW = 16 * btnW + 3;
  var startX = W / 2 - totalDW / 2;

  function drawRow(rowDents, rowY) {
    var dx = startX;
    rowDents[0].forEach(function(n) {
      var sel = selectedTeeth.includes(n);
      if (sel) { gradRect(dx, rowY, btnW - 0.8, btnH); }
      else {
        doc.setFillColor(...offWhite); doc.setDrawColor(...borderCol); doc.setLineWidth(0.18);
        doc.rect(dx, rowY, btnW - 0.8, btnH, 'FD');
      }
      doc.setFontSize(5); doc.setFont('helvetica', sel ? 'bold' : 'normal');
      doc.setTextColor(...(sel ? white : muted));
      doc.text(String(n), dx + (btnW - 0.8) / 2, rowY + 3.5, { align: 'center' });
      dx += btnW;
    });
    dx += 3;
    rowDents[1].forEach(function(n) {
      var sel = selectedTeeth.includes(n);
      if (sel) { gradRect(dx, rowY, btnW - 0.8, btnH); }
      else {
        doc.setFillColor(...offWhite); doc.setDrawColor(...borderCol); doc.setLineWidth(0.18);
        doc.rect(dx, rowY, btnW - 0.8, btnH, 'FD');
      }
      doc.setFontSize(5); doc.setFont('helvetica', sel ? 'bold' : 'normal');
      doc.setTextColor(...(sel ? white : muted));
      doc.text(String(n), dx + (btnW - 0.8) / 2, rowY + 3.5, { align: 'center' });
      dx += btnW;
    });
  }

  var rowY_H = y + 10;
  drawRow(DENTS_H, rowY_H);
  var sepY = rowY_H + btnH + 1.5;
  doc.setDrawColor(...borderCol); doc.setLineWidth(0.35);
  doc.line(startX, sepY, startX + totalDW, sepY);
  drawRow(DENTS_B, sepY + 2);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...muted);
  doc.text('R', startX - 3.5, rowY_H + 3.5);
  doc.text('L', startX + totalDW + 0.5, rowY_H + 3.5);
  doc.text('R', startX - 3.5, sepY + 5.5);
  doc.text('L', startX + totalDW + 0.5, sepY + 5.5);

  y += teethSH + 5;

  // ══════════════════════════════════
  // SECTION 3 : TRAVAUX DEMANDÉS
  // ══════════════════════════════════
  if (priceList.length > 0) {
    sectionHeader('TRAVAUX DEMANDES', margin, y, secW);
    box(margin, y + 7, secW, Math.max(priceList.length * 10 + 4, 20));
    var iy = y + 12;

    priceList.forEach(function(item) {
      var label = item.frDesignation || item.designation || '';
      var mat = item.material || '';
      var shade = item.shade || '';
      var qty = item.quantity || 1;
      var zone = item.area || '';

      checkbox(label, true, margin + 4, iy);

      // Détails à droite
      var detailX = margin + 90;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...muted);
      if (mat) doc.text('Materiau : ' + mat, detailX, iy + 0.2);
      if (shade) doc.text('Teinte : ' + shade, detailX + 40, iy + 0.2);
      if (zone) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...teal);
        doc.text('Zone ' + zone, detailX + 70, iy + 0.2);
      }

      // Quantité badge
      if (qty > 1) {
        doc.setFillColor(255, 243, 224); doc.setDrawColor(255, 152, 0);
        doc.roundedRect(secW - 4, iy - 3, 12, 5, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(230, 81, 0);
        doc.text('x' + qty, secW + 2, iy + 0.2, { align: 'center' });
      }

      iy += 10;
    });

    y = iy + 4;
  }

  // ══════════════════════════════════
  // SECTION 4 : COMMENTAIRE
  // ══════════════════════════════════
  if (comment) {
    var commLines = doc.splitTextToSize(comment, secW - 12);
    var commH = Math.max(16, commLines.length * 5 + 8);

    sectionHeader('COMMENTAIRE DU PRATICIEN', margin, y, secW);
    // Box jaune pâle pour le commentaire
    doc.setFillColor(255, 253, 231);
    doc.setDrawColor(255, 235, 59);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y + 7, secW, commH, 3.5, 3.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    doc.text(commLines, margin + 5, y + 14);

    y += commH + 12;
  }

  // ══════════════════════════════════
  // SECTION 5 : ADMINISTRATION
  // ══════════════════════════════════
  if (ofData.billingAddress || cabinetAddr) {
    sectionHeader('ADMINISTRATION', margin, y, secW);
    box(margin, y + 7, secW, 20);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...muted);
    var ay = y + 13;
    if (ofData.orderDate) { doc.text('Date commande : ' + ofData.orderDate, margin + 4, ay); ay += 4; }
    if (ofData.billingAddress) { doc.text('Facturation : ' + ofData.billingAddress, margin + 4, ay); ay += 4; }
    if (ofData.shippingAddress && ofData.shippingAddress !== ofData.billingAddress) {
      doc.text('Livraison : ' + ofData.shippingAddress, margin + 4, ay); ay += 4;
    }
    if (ofData.shippingDate) {
      doc.setTextColor(...dangerRed); doc.setFont('helvetica', 'bold');
      doc.text('Date livraison souhaitee : ' + ofData.shippingDate, margin + 4, ay);
    }

    y += 32;
  }

  // ══════════════════════════════════
  // PIED DE PAGE
  // ══════════════════════════════════
  gradRect(0, H - 12, W, 1, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...muted);
  doc.text('I Love Smile \u2014 25 rue Boinod 75018 Paris \u2014 laboilovesmile.com \u2014 01 83 95 87 00', W / 2, H - 7, { align: 'center' });
  doc.text('Fiche generee depuis Digilab \u00B7 ' + new Date().toLocaleDateString('fr-FR'), W / 2, H - 4, { align: 'center' });

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

function _extractTeethDlb(cameraData, priceList) {
  var teeth = [];
  (cameraData || []).forEach(function(cam) {
    var zone = cam.zone || (cam.details && cam.details.area) || '';
    if (/^\d{2}$/.test(zone)) { var n = parseInt(zone); if (n >= 11 && n <= 48) teeth.push(n); }
    // jawType → surligner toute l'arcade
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
