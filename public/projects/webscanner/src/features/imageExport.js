/* imageExport.js — ekspor PNG/JPG: satu per satu atau digabung vertikal */
(function (WS) {
  'use strict';
  const GAP = 16;          // pemisah putih antar halaman (px)
  const JPG_QUALITY = 0.9;

  const mime = (fmt) => (fmt === 'jpg' ? 'image/jpeg' : 'image/png');
  const pageNumber = (page) => WS.store.getState().pages.findIndex((p) => p.id === page.id) + 1;
  const renderFull = (page) => WS.filters.render(page.perspectiveCorrectedCanvas, page.filterSettings);
  const free = (c) => { c.width = 1; c.height = 1; };

  async function exportIndividual({ pages, format, dir, onProgress }) {
    for (let i = 0; i < pages.length; i++) {
      onProgress && onProgress(i, pages.length);
      await WS.canvas.nextFrame();
      const canvas = renderFull(pages[i]);
      let out = canvas;
      if (format === 'jpg') { // latar putih agar tidak hitam jika ada piksel transparan
        out = WS.canvas.createCanvas(canvas.width, canvas.height);
        const ctx = WS.canvas.ctx2d(out); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height); ctx.drawImage(canvas, 0, 0);
        free(canvas);
      }
      const blob = await WS.canvas.toBlob(out, mime(format), JPG_QUALITY);
      free(out);
      const name = `docscan-halaman-${pageNumber(pages[i])}.${format}`;
      if (dir) await WS.download.writeToDirectory(dir, name, blob);
      else { WS.download.downloadBlob(blob, name); await WS.download.wait(350); }
    }
    onProgress && onProgress(pages.length, pages.length);
  }

  async function exportCombined({ pages, format, onProgress }) {
    // Lebar seragam = halaman terlebar; tiap halaman diskalakan proporsional (tanpa distorsi)
    const width = Math.max(...pages.map((p) => p.perspectiveCorrectedCanvas.width));
    const heights = pages.map((p) => Math.round(p.perspectiveCorrectedCanvas.height * (width / p.perspectiveCorrectedCanvas.width)));
    let totalH = heights.reduce((a, b) => a + b, 0) + GAP * (pages.length - 1);

    // Batas ukuran canvas browser (lebih ketat di perangkat seluler)
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const maxArea = mobile ? 16e6 : 120e6;
    const k = Math.min(1, 30000 / totalH, Math.sqrt(maxArea / (width * totalH)));
    const W = Math.max(1, Math.floor(width * k));
    const H = Math.max(1, Math.floor(totalH * k));
    if (k < 1) WS.dom.toast('Gambar gabungan diperkecil agar muat di browser.');

    const out = WS.canvas.createCanvas(W, H);
    const ctx = WS.canvas.ctx2d(out);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    let y = 0;
    for (let i = 0; i < pages.length; i++) {
      onProgress && onProgress(i, pages.length);
      await WS.canvas.nextFrame();
      const c = renderFull(pages[i]);
      const hh = Math.round(heights[i] * k);
      ctx.drawImage(c, 0, Math.round(y), W, hh);
      free(c);
      y += (heights[i] + GAP) * k;
    }
    onProgress && onProgress(pages.length, pages.length);
    const blob = await WS.canvas.toBlob(out, mime(format), JPG_QUALITY);
    free(out);
    WS.download.downloadBlob(blob, `docscan-gabungan.${format}`);
  }

  WS.imageExport = { exportIndividual, exportCombined, renderFull };
})(window.WS = window.WS || {});
