// ══════════════════════════════════════════
// COMPARAISON VISUELLE — Fiche originale side-by-side
// ══════════════════════════════════════════

function toggleComparaisonVisuelle() {
  var existing = document.getElementById('comparaison-panel');
  if (existing) { existing.remove(); return; }

  var photoSrc = window.lastScanPhoto || (window._rescanData && window._rescanData.photoSrc);
  if (!photoSrc) {
    if (typeof showToast === 'function') showToast('Pas de fiche scannee a afficher', true);
    return;
  }

  var panel = document.createElement('div');
  panel.id = 'comparaison-panel';
  panel.style.cssText = 'position:fixed;top:0;right:0;width:45vw;height:100vh;background:#fff;z-index:9999;box-shadow:-4px 0 20px rgba(0,0,0,0.2);display:flex;flex-direction:column;';

  var header = document.createElement('div');
  header.style.cssText = 'padding:10px 16px;background:#1976d2;color:#fff;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
  header.innerHTML = '<strong>Fiche originale</strong><div><button onclick="var p=document.getElementById(\'comparaison-panel\');var w=parseInt(p.style.width)||45;w=Math.min(w+10,80);p.style.width=w+\'vw\';" style="background:none;border:1px solid rgba(255,255,255,0.5);color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;margin-right:6px;">Agrandir</button><button onclick="document.getElementById(\'comparaison-panel\').remove()" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;">\u2715</button></div>';
  panel.appendChild(header);

  var imgContainer = document.createElement('div');
  imgContainer.style.cssText = 'flex:1;overflow:auto;padding:8px;background:#f5f5f5;';

  if (photoSrc.startsWith('data:application/pdf')) {
    imgContainer.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">Apercu PDF non disponible en mode comparaison</p>';
  } else {
    var img = document.createElement('img');
    img.src = photoSrc;
    img.style.cssText = 'width:100%;height:auto;border-radius:8px;';
    img.draggable = false;
    imgContainer.appendChild(img);
  }

  panel.appendChild(imgContainer);
  document.body.appendChild(panel);
}

// Stubs pour éviter les erreurs si appelés ailleurs
function _afficherConfiance() {}
function toggleValidationExpress() {}
var _validationExpressActive = false;
