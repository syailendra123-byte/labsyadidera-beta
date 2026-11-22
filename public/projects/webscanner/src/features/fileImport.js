/* fileImport.js — validasi, decode, dan masukkan gambar ke daftar halaman */
(function (WS) {
  'use strict';
  const MAX_TOTAL_PIXELS = 300e6;
  const MEMORY_MSG = 'Terlalu banyak gambar besar. Hapus beberapa halaman sebelum menambahkan lagi.';

  async function importFiles(fileList) {
    const st = WS.store.getState();
    if (st.isProcessing) return;
    const { valid, errors, warnBig } = WS.file.validate(fileList);
    if (errors.length) WS.dom.toast(errors[0], 'error');
    if (!valid.length) return;
    if (warnBig) WS.dom.toast('File berukuran besar, pemrosesan dapat memakan waktu.');

    WS.ui.busy('Memuat gambar…');
    const created = [];
    try {
      await WS.canvas.nextFrame();
      for (const f of valid) {
        if (WS.store.totalPixels() + created.reduce((s, p) => s + p.originalImageBitmap.width * p.originalImageBitmap.height, 0) > MAX_TOTAL_PIXELS) {
          WS.dom.toast(MEMORY_MSG, 'error'); break;
        }
        try { created.push(WS.store.createPage(await WS.canvas.fileToCanvas(f))); }
        catch (e) {
          WS.dom.toast(e instanceof RangeError ? MEMORY_MSG : `Gambar “${f.name}” tidak dapat dibuka.`, 'error');
        }
      }
    } finally { WS.ui.idle(); }

    if (!created.length) return;
    WS.store.addPages(created);
    WS.store.setState({
      cropQueue: created.map((p) => p.id),
      cropQueueTotal: created.length,
      activePageId: created[0].id,
      cameraOpen: false,
      currentStep: 'crop',
      previousStep: 'crop',
    });
  }

  // Foto dari kamera (canvas) -> halaman baru
  function importCanvas(canvas) {
    if (WS.store.totalPixels() + canvas.width * canvas.height > MAX_TOTAL_PIXELS) { WS.dom.toast(MEMORY_MSG, 'error'); return; }
    const page = WS.store.createPage(WS.canvas.scaleTo(canvas, WS.canvas.MAX_ORIGINAL_SIDE));
    WS.store.addPages([page]);
    WS.store.setState({ cropQueue: [page.id], cropQueueTotal: 1, activePageId: page.id, cameraOpen: false, currentStep: 'crop', previousStep: 'crop' });
  }

  WS.fileImport = { importFiles, importCanvas };
})(window.WS = window.WS || {});
