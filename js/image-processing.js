// ══════════════════════════════════════════
// IMAGE PROCESSING — traitement d'images
// ══════════════════════════════════════════

// Seuil Otsu — trouve le seuil optimal pour separer encre/papier
function _otsuThreshold(imageData) {
  var data = imageData.data;
  var histogram = new Array(256).fill(0);
  for (var i = 0; i < data.length; i += 4) {
    var gray = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
    histogram[gray]++;
  }
  var total = data.length / 4;
  var sum = 0;
  for (var t = 0; t < 256; t++) sum += t * histogram[t];
  var sumB = 0, wB = 0, maxVariance = 0, threshold = 128;
  for (var t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    var wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    var mB = sumB / wB;
    var mF = (sum - sumB) / wF;
    var variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) { maxVariance = variance; threshold = t; }
  }
  return threshold;
}

// Applique la binarisation Otsu sur un canvas (noir/blanc pur)
function _applyOtsu(ctx, w, h) {
  var imageData = ctx.getImageData(0, 0, w, h);
  var threshold = _otsuThreshold(imageData);
  var data = imageData.data;
  for (var i = 0; i < data.length; i += 4) {
    var gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    var val = gray < threshold ? 0 : 255;
    data[i] = data[i+1] = data[i+2] = val;
  }
  ctx.putImageData(imageData, 0, 0);
  return threshold;
}

// ── Contraste adaptatif (CLAHE simplifié) ──
// Améliore le contraste sans binariser : préserve les nuances pour l'IA
function _applyAdaptiveContrast(ctx, w, h) {
  var imageData = ctx.getImageData(0, 0, w, h);
  var data = imageData.data;

  // Étape 1 : convertir en niveaux de gris et calculer min/max
  var grayValues = new Uint8Array(data.length / 4);
  var minGray = 255, maxGray = 0;
  for (var i = 0; i < data.length; i += 4) {
    var gray = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
    grayValues[i / 4] = gray;
    if (gray < minGray) minGray = gray;
    if (gray > maxGray) maxGray = gray;
  }

  // Étape 2 : stretch de l'histogramme (2% - 98% pour ignorer les outliers)
  var histogram = new Array(256).fill(0);
  var total = grayValues.length;
  for (var i = 0; i < total; i++) histogram[grayValues[i]]++;

  var cumul = 0;
  var lowCut = 0, highCut = 255;
  for (var t = 0; t < 256; t++) {
    cumul += histogram[t];
    if (cumul >= total * 0.02) { lowCut = t; break; }
  }
  cumul = 0;
  for (var t = 255; t >= 0; t--) {
    cumul += histogram[t];
    if (cumul >= total * 0.02) { highCut = t; break; }
  }

  var range = highCut - lowCut;
  if (range < 30) range = 30; // éviter division par zéro ou sur-amplification

  // Étape 3 : appliquer le stretch + léger renforcement du contraste
  for (var i = 0; i < data.length; i += 4) {
    var gray = grayValues[i / 4];
    var stretched = Math.round(((gray - lowCut) / range) * 255);
    stretched = Math.max(0, Math.min(255, stretched));
    // Courbe en S douce pour renforcer les contrastes
    var normalized = stretched / 255;
    var sigmoid = 1 / (1 + Math.exp(-8 * (normalized - 0.5)));
    var final = Math.round(sigmoid * 255);
    data[i] = data[i+1] = data[i+2] = final;
  }

  ctx.putImageData(imageData, 0, 0);
  return { lowCut: lowCut, highCut: highCut };
}

// ── Détection d'angle et redressement (deskew) ──
// Utilise la projection horizontale pour trouver l'angle de rotation optimal
function _detectSkewAngle(ctx, w, h) {
  var imageData = ctx.getImageData(0, 0, w, h);
  var data = imageData.data;

  // Binariser temporairement pour détecter les lignes de texte
  var binary = new Uint8Array(w * h);
  for (var i = 0; i < data.length; i += 4) {
    var gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    binary[i / 4] = gray < 128 ? 1 : 0;
  }

  var bestAngle = 0;
  var bestVariance = 0;

  // Tester des angles de -3° à +3° par pas de 0.25°
  for (var angle = -3; angle <= 3; angle += 0.25) {
    var rad = angle * Math.PI / 180;
    var cosA = Math.cos(rad);
    var sinA = Math.sin(rad);
    var cx = w / 2, cy = h / 2;

    // Projection horizontale : compter les pixels noirs par ligne après rotation
    var rowCounts = new Array(h).fill(0);
    for (var y = 0; y < h; y += 2) { // échantillonnage pour la vitesse
      for (var x = 0; x < w; x += 2) {
        var rx = Math.round(cosA * (x - cx) + sinA * (y - cy) + cx);
        var ry = Math.round(-sinA * (x - cx) + cosA * (y - cy) + cy);
        if (rx >= 0 && rx < w && ry >= 0 && ry < h) {
          if (binary[ry * w + rx]) rowCounts[y]++;
        }
      }
    }

    // Variance des projections : plus haute = lignes mieux alignées
    var mean = 0;
    for (var i = 0; i < h; i++) mean += rowCounts[i];
    mean /= h;
    var variance = 0;
    for (var i = 0; i < h; i++) variance += (rowCounts[i] - mean) * (rowCounts[i] - mean);
    variance /= h;

    if (variance > bestVariance) {
      bestVariance = variance;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

function _rotateCanvas(sourceCanvas, angleDeg) {
  if (Math.abs(angleDeg) < 0.3) return sourceCanvas; // pas de rotation nécessaire
  var rad = angleDeg * Math.PI / 180;
  var w = sourceCanvas.width, h = sourceCanvas.height;
  var rotated = document.createElement('canvas');
  rotated.width = w;
  rotated.height = h;
  var rCtx = rotated.getContext('2d');
  rCtx.translate(w / 2, h / 2);
  rCtx.rotate(-rad);
  rCtx.drawImage(sourceCanvas, -w / 2, -h / 2);
  return rotated;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Lecture impossible'));
    reader.readAsDataURL(file);
  });
}

// ── Crop du tiers supérieur (zone code labo + cabinet + dentiste) ──
// Utilise le contraste adaptatif + binarisation Otsu pour une lisibilité maximale
function cropTopZone(file) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith('image/')) { resolve(null); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const cropH = Math.round(img.height * 0.30); // 30% du haut
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, img.width, cropH, 0, 0, img.width, cropH);
      // Binarisation Otsu pour le header (codes courts, texte imprimé)
      var otsuT = _applyOtsu(ctx, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
      console.log('[SCAN] Crop top zone: ' + canvas.width + 'x' + canvas.height + ' (Otsu threshold=' + otsuT + ')');
      resolve(b64);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// ── Crop de la zone commentaire (bas de la fiche) ──
// Le commentaire manuscrit est souvent en bas, avec contraste adaptatif pour mieux lire l'écriture
function cropCommentZone(file) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith('image/')) { resolve(null); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Prendre les 45% du bas (zone commentaire + signature)
      const startY = Math.round(img.height * 0.55);
      const cropH = img.height - startY;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, startY, img.width, cropH, 0, 0, img.width, cropH);
      // Contraste adaptatif (pas Otsu) pour préserver les nuances de l'écriture manuscrite
      _applyAdaptiveContrast(ctx, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
      console.log('[SCAN] Crop comment zone: ' + canvas.width + 'x' + canvas.height);
      resolve(b64);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// ── Amélioration d'image principale pour envoi à Gemini ──
// Contraste adaptatif + redressement (deskew) + resize
function enhanceImageForScan(file) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 2000;
      let w = img.width, h = img.height;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);

      // 1. Détecter et corriger l'inclinaison
      var skewAngle = _detectSkewAngle(ctx, w, h);
      if (Math.abs(skewAngle) >= 0.3) {
        canvas = _rotateCanvas(canvas, skewAngle);
        ctx = canvas.getContext('2d');
        console.log('[SCAN] Deskew: ' + skewAngle.toFixed(1) + '°');
      }

      // 2. Contraste adaptatif (préserve les nuances, meilleur que Otsu pour l'IA)
      var contrastInfo = _applyAdaptiveContrast(ctx, canvas.width, canvas.height);
      console.log('[SCAN] Adaptive contrast: low=' + contrastInfo.lowCut + ' high=' + contrastInfo.highCut);

      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const enhanced = new File([blob], file.name, { type: 'image/jpeg' });
        console.log('[SCAN] Enhanced ' + file.name + ' : ' + Math.round(file.size/1024) + 'KB → ' + Math.round(blob.size/1024) + 'KB');
        resolve(enhanced);
      }, 'image/jpeg', 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// Conversion PDF → images (via PDF.js)
async function pdfToImages(base64) {
  const pdfData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const images = [];
  const scale = 2; // bonne résolution pour OCR
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    images.push(jpegDataUrl.split(',')[1]); // base64 only
  }
  return images;
}
