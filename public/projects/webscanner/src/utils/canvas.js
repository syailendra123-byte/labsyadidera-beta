/* canvas.js — helper canvas */
(function (WS) {
  'use strict';

  const MAX_ORIGINAL_SIDE = 3200;

  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function ctx2d(c, opts) {
    const ctx = c.getContext('2d', opts);
    if (!ctx) throw new RangeError('canvas-unavailable');
    return ctx;
  }

  // Skala canvas agar sisi terpanjang <= maxSide (salinan baru, atau sumber jika sudah cukup kecil)
  function scaleTo(src, maxSide, forceCopy) {
    const long = Math.max(src.width, src.height);
    if (long <= maxSide && !forceCopy) return src;
    const s = Math.min(1, maxSide / long);
    const out = createCanvas(src.width * s, src.height * s);
    const ctx = ctx2d(out);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, out.width, out.height);
    return out;
  }

  async function decodeFile(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fallback */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode-failed')); };
      img.src = url;
    });
  }

  // File -> canvas (dibatasi MAX_ORIGINAL_SIDE agar memori terjaga)
  async function fileToCanvas(file) {
    const img = await decodeFile(file);
    const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
    const s = Math.min(1, MAX_ORIGINAL_SIDE / Math.max(w, h));
    const c = createCanvas(w * s, h * s);
    const ctx = ctx2d(c);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    if (img.close) img.close();
    return c;
  }

  function toBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob-failed'))), type, quality);
    });
  }

  // Beri kesempatan browser menggambar UI sebelum kerja berat
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

  WS.canvas = { createCanvas, ctx2d, scaleTo, fileToCanvas, toBlob, nextFrame, MAX_ORIGINAL_SIDE };
})(window.WS = window.WS || {});
