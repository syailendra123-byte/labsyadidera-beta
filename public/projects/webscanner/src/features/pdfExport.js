/* pdfExport.js — buat PDF lokal dengan pdf-lib (satu gambar = satu halaman, tanpa watermark/metadata) */
(function (WS) {
  'use strict';

  // Titik slider -> kualitas JPG (interpolasi linear antar titik tabel)
  const STOPS = [[0, 0.45], [25, 0.60], [50, 0.75], [75, 0.85], [100, 1.0]];
  function qualityFromSlider(v) {
    for (let i = 1; i < STOPS.length; i++) {
      if (v <= STOPS[i][0]) {
        const [x0, y0] = STOPS[i - 1], [x1, y1] = STOPS[i];
        return y0 + ((v - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return 1;
  }

  function describe(v) {
    if (v <= 10) return 'Sangat kecil, cocok untuk berbagi cepat';
    if (v <= 35) return 'Kompresi tinggi';
    if (v <= 60) return 'Seimbang';
    if (v <= 90) return 'Kualitas tinggi';
    return 'Kualitas asli / tanpa kompresi tambahan';
  }

  // 300 dpi -> 72 pt: halaman A4 (2480x3508 px) menjadi 595x842 pt
  const PX_TO_PT = 72 / 300;

  async function exportPdf({ pages, quality, lossless, onProgress }) {
    if (!window.PDFLib) throw new Error('pdf-lib-missing');
    const doc = await window.PDFLib.PDFDocument.create({ updateMetadata: false });
    for (let i = 0; i < pages.length; i++) {
      onProgress && onProgress(i, pages.length);
      await WS.canvas.nextFrame();
      const canvas = WS.imageExport.renderFull(pages[i]);
      const blob = await WS.canvas.toBlob(canvas, lossless ? 'image/png' : 'image/jpeg', lossless ? undefined : quality);
      const w = canvas.width * PX_TO_PT, h = canvas.height * PX_TO_PT;
      canvas.width = canvas.height = 1;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const img = lossless ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const page = doc.addPage([w, h]);
      page.drawImage(img, { x: 0, y: 0, width: w, height: h });
    }
    onProgress && onProgress(pages.length, pages.length);
    const out = await doc.save();
    return new Blob([out], { type: 'application/pdf' });
  }

  WS.pdfExport = { exportPdf, qualityFromSlider, describe };
})(window.WS = window.WS || {});
