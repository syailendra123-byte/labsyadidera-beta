/* main.js — router tampilan, alur (flow), dan inisialisasi. Semua data hanya di memori. */
(function (WS) {
  'use strict';
  const store = WS.store;
  const $ = (id) => document.getElementById(id);

  /* ---------- UI global ---------- */
  WS.ui = {
    busy(msg) { store.setState({ isProcessing: true, processingMessage: msg || 'Memproses…' }); },
    idle() { store.setState({ isProcessing: false, processingMessage: null }); },
  };

  /* ---------- Alur antar-langkah ---------- */
  const BASE = ['empty', 'crop', 'filter', 'document'];
  const nextHome = () => (store.getState().pages.length ? 'document' : 'empty');

  WS.flow = {
    goHome() { const step = nextHome(); store.setState({ currentStep: step, previousStep: step, cameraOpen: false, cropQueue: [], cropQueueTotal: 0 }); },

    openSourcePicker() {
      const s = store.getState();
      if (s.currentStep === 'source-picker') return;
      store.setState({ previousStep: BASE.includes(s.currentStep) ? s.currentStep : s.previousStep, currentStep: 'source-picker' });
    },
    closeOverlay() { store.setState({ currentStep: store.getState().previousStep }); },

    openCamera() { store.setState({ cameraOpen: true, currentStep: store.getState().previousStep }); },
    closeCamera() { store.setState({ cameraOpen: false }); },
    pickFiles() { const input = $('file-input'); input.value = ''; input.click(); },

    openExport() {
      const ready = store.readyPages();
      if (!ready.length) return;
      store.setState({ previousStep: 'document', currentStep: 'export', selectedPageIdsForExport: ready.map((p) => p.id) });
    },

    cropConfirmed(id) {
      const s = store.getState();
      store.setState({ activePageId: id, currentStep: 'filter', previousStep: 'filter', cropQueue: s.cropQueue.filter((x) => x !== id), pagesVersion: s.pagesVersion + 1 });
    },
    filterDone(id) {
      const s = store.getState();
      if (s.cropQueue.length) store.setState({ activePageId: s.cropQueue[0], currentStep: 'crop', previousStep: 'crop', pagesVersion: s.pagesVersion + 1 });
      else store.setState({ activePageId: id, currentStep: 'document', previousStep: 'document', cropQueueTotal: 0, pagesVersion: s.pagesVersion + 1 });
    },
    cropCancel(id) {
      const page = store.getPage(id);
      if (page && page.status !== 'ready') store.removePage(id);   // gambar baru yang dibatalkan dibuang
      const s = store.getState();
      if (s.cropQueue.length) store.setState({ activePageId: s.cropQueue[0], currentStep: 'crop', previousStep: 'crop' });
      else { const step = nextHome(); store.setState({ currentStep: step, previousStep: step, cropQueueTotal: 0, activePageId: step === 'document' ? (s.pages.find((p) => p.id === id) ? id : s.pages[0].id) : null }); }
    },
    editCrop(id) {
      const s = store.getState();
      store.setState({ activePageId: id, currentStep: 'crop', previousStep: 'crop', cropQueueTotal: s.cropQueue.length ? s.cropQueueTotal : 0 });
    },
    editFilter(id) { store.setState({ activePageId: id, currentStep: 'filter', previousStep: 'filter' }); },

    async deletePage(id) {
      if (!(await WS.dom.confirm('Hapus halaman ini dari dokumen?'))) return;
      const before = store.getState().pages;
      const idx = before.findIndex((p) => p.id === id);
      const pages = store.removePage(id);
      if (!pages.length) { store.setState({ currentStep: 'empty', previousStep: 'empty', activePageId: null }); return; }
      store.setState({ activePageId: pages[Math.min(idx, pages.length - 1)].id });
    },
  };

  /* ---------- Router ---------- */
  const app = $('app'), overlay = $('overlay');
  let baseKey = null, baseView = null, ovKey = null, ovView = null;
  const BASE_VIEW = { empty: 'emptyState', crop: 'cropEditor', filter: 'filterEditor', document: 'documentEditor' };
  const OVERLAY_VIEW = { 'source-picker': 'sourcePicker', export: 'exportModal', camera: 'camera' };

  function route(state) {
    let base = state.currentStep, ov = null;
    if (base === 'source-picker' || base === 'export') { ov = base; base = state.previousStep; }
    if (state.cameraOpen) ov = 'camera';
    if (!BASE_VIEW[base]) base = state.pages.length ? 'document' : 'empty';

    const bk = base + '|' + (state.activePageId || '') + '|' + (base === 'document' ? state.pagesVersion : '');
    if (bk !== baseKey) {
      if (baseView) baseView.unmount();
      app.innerHTML = '';
      baseKey = bk;
      baseView = WS.views[BASE_VIEW[base]];
      baseView.mount(app);
      if (store.getState() !== state) return;   // mount memicu perpindahan lain
    }
    if (ov !== ovKey) {
      if (ovView) ovView.unmount();
      overlay.innerHTML = '';
      ovKey = ov; ovView = null;
      if (ov) { ovView = WS.views[OVERLAY_VIEW[ov]]; ovView.mount(overlay); }
    }
    document.body.classList.toggle('has-overlay', !!ov);
    app.toggleAttribute('inert', !!ov);

    const proc = $('processing');
    proc.hidden = !state.isProcessing;
    $('processing-msg').textContent = state.processingMessage || '';
  }

  /* ---------- Init ---------- */
  function init() {
    $('file-input').addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (files.length) WS.fileImport.importFiles(files);
    });
    WS.dragAndDrop.init();
    window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); });
    store.subscribe(route);
    route(store.getState());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.WS = window.WS || {});
