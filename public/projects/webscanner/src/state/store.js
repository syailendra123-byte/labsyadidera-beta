/* store.js — state sederhana (gaya Zustand) — hanya di memori, tanpa persistence */
(function (WS) {
  'use strict';

  const DEFAULT_FILTER = () => ({ preset: 'document', strength: 80, brightness: 0, contrast: 0, sharpness: 0 });

  let state = {
    pages: [],                 // DocumentPage[]
    activePageId: null,
    currentStep: 'empty',      // 'empty' | 'source-picker' | 'crop' | 'filter' | 'document' | 'export'
    previousStep: 'empty',     // langkah dasar di bawah overlay (source-picker / export)
    cameraOpen: false,
    cropQueue: [],             // id halaman yang menunggu di Crop Editor
    cropQueueTotal: 0,         // jumlah gambar pada antrean saat diimpor (untuk label "Gambar 2 dari 5")
    pagesVersion: 0,           // dinaikkan saat daftar halaman berubah (untuk render ulang Document Editor)

    exportMode: 'image',       // 'image' | 'pdf' | null
    imageFormat: 'png',
    imageDownloadMode: 'individual',
    selectedPageIdsForExport: [],
    pdfQuality: 75,

    isProcessing: false,
    processingMessage: null,
    error: null,
  };

  const listeners = new Set();
  const getState = () => state;
  function setState(patch) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    listeners.forEach((fn) => fn(state));
  }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  let idCounter = 0;
  const newId = () => 'p' + (++idCounter) + '-' + Math.random().toString(36).slice(2, 7);

  function getPage(id) { return state.pages.find((p) => p.id === id) || null; }

  function addPages(pages) { setState({ pages: [...state.pages, ...pages], pagesVersion: state.pagesVersion + 1 }); }

  // Perubahan dalam halaman (mutasi objek) — naikkan versi agar tampilan dokumen tahu
  function touchPages() { setState({ pagesVersion: state.pagesVersion + 1 }); }

  function removePage(id) {
    const p = getPage(id);
    if (p) releasePage(p);
    const pages = state.pages.filter((x) => x.id !== id);
    setState({
      pages,
      cropQueue: state.cropQueue.filter((x) => x !== id),
      selectedPageIdsForExport: state.selectedPageIdsForExport.filter((x) => x !== id),
      pagesVersion: state.pagesVersion + 1,
    });
    return pages;
  }

  function movePage(id, toIndex) {
    const from = state.pages.findIndex((p) => p.id === id);
    if (from < 0) return;
    const to = Math.max(0, Math.min(state.pages.length - 1, toIndex));
    if (from === to) return;
    const pages = state.pages.slice();
    const [m] = pages.splice(from, 1);
    pages.splice(to, 0, m);
    setState({ pages, pagesVersion: state.pagesVersion + 1 });
  }

  // Lepaskan referensi canvas agar memori bisa dibebaskan
  function releasePage(p) {
    [p.originalImageBitmap, p.perspectiveCorrectedCanvas, p.previewBase, p.processedCanvas].forEach((c) => {
      if (c && c.width) { c.width = 1; c.height = 1; }
    });
    p.originalImageBitmap = p.perspectiveCorrectedCanvas = p.previewBase = p.processedCanvas = null;
  }

  function createPage(originalCanvas) {
    return {
      id: newId(),
      status: 'pending',                 // 'pending' (belum dipotong) | 'ready'
      originalImageBitmap: originalCanvas,
      autoPoints: null,                  // hasil deteksi awal (array TL,TR,BR,BL)
      autoConfident: false,
      cropPoints: null,                  // { topLeft, topRight, bottomRight, bottomLeft }
      perspectiveCorrectedCanvas: null,  // resolusi penuh, tanpa filter
      previewBase: null,                 // versi kecil untuk preview filter
      filterSettings: DEFAULT_FILTER(),
      processedCanvas: null,             // preview kecil (sudah difilter) untuk thumbnail/preview
    };
  }

  function totalPixels() {
    return state.pages.reduce((s, p) => {
      const o = p.originalImageBitmap, c = p.perspectiveCorrectedCanvas;
      return s + (o ? o.width * o.height : 0) + (c ? c.width * c.height : 0);
    }, 0);
  }

  const readyPages = () => state.pages.filter((p) => p.status === 'ready' && p.perspectiveCorrectedCanvas);

  WS.store = { getState, setState, subscribe, getPage, addPages, touchPages, removePage, movePage, createPage, totalPixels, readyPages, DEFAULT_FILTER };
})(window.WS = window.WS || {});
