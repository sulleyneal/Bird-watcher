/* camera.js — live camera with graceful fallback to file upload.
   Photos are downscaled to ~1280px JPEG data URLs for storage + the
   vision API. */

let activeStream = null;

export async function startCamera(videoEl) {
  stopCamera();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('no-camera');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } },
    audio: false,
  });
  activeStream = stream;
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera() {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }
}

export function captureFrame(videoEl) {
  const w = videoEl.videoWidth, h = videoEl.videoHeight;
  if (!w || !h) throw new Error('no-frame');
  return scaleToDataURL(videoEl, w, h);
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try { resolve(scaleToDataURL(img, img.naturalWidth, img.naturalHeight)); }
      catch (e) { reject(e); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad-image')); };
    img.src = url;
  });
}

function scaleToDataURL(source, w, h, max = 1280) {
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.round(w * scale), ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  canvas.getContext('2d').drawImage(source, 0, 0, cw, ch);
  return canvas.toDataURL('image/jpeg', 0.86);
}
