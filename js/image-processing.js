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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Lecture impossible'));
    reader.readAsDataURL(file);
  });
}

// Compresser une image avant envoi à Gemini (max 1200px, qualité 0.6)
// Crop le tiers supérieur de l'image (zone code labo + cabinet + dentiste)
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
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, img.width, cropH, 0, 0, img.width, cropH);
      // Binarisation Otsu : separe net l'encre du papier
      var otsuT = _applyOtsu(ctx, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
      console.log('[SCAN] Crop top zone: ' + canvas.width + 'x' + canvas.height + ' (Otsu threshold=' + otsuT + ')');
      resolve(b64);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

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
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // Binarisation Otsu : separe l'encre du papier pour meilleure lisibilite IA
      var otsuT = _applyOtsu(ctx, w, h);
      console.log('[SCAN] Enhance Otsu threshold=' + otsuT);

      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const enhanced = new File([blob], file.name, { type: 'image/jpeg' });
        console.log('[SCAN] Enhanced ' + file.name + ' : ' + Math.round(file.size/1024) + 'KB → ' + Math.round(blob.size/1024) + 'KB (grayscale+contrast)');
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
