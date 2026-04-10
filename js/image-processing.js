// ══════════════════════════════════════════
// IMAGE PROCESSING — traitement d'images
// ══════════════════════════════════════════

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
      // Même traitement gris+contraste que l'image complète
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        let gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        gray = ((gray - 128) * 1.5) + 128; // contraste un peu plus fort sur le crop
        gray = gray < 0 ? 0 : (gray > 255 ? 255 : gray);
        data[i] = data[i+1] = data[i+2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
      const b64 = canvas.toDataURL('image/jpeg', 0.90).split(',')[1];
      console.log('[SCAN] Crop top zone: ' + canvas.width + 'x' + canvas.height);
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

      // Pré-traitement : niveaux de gris + contraste pour améliorer la lisibilité OCR
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Niveaux de gris (luminance)
        let gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        // Augmenter le contraste : étirer les valeurs autour de 128
        gray = ((gray - 128) * 1.4) + 128;
        gray = gray < 0 ? 0 : (gray > 255 ? 255 : gray);
        data[i] = data[i+1] = data[i+2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);

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
