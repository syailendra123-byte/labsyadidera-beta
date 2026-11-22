/* filterEditor.js — preset + slider, pratinjau langsung. Parameter disimpan terpisah dari gambar. */
(function (WS) {
  'use strict';
  const { h, icon } = WS.dom;
  let cleanup = null;

  WS.views.filterEditor = {
    mount(root) {
      const page = WS.store.getPage(WS.store.getState().activePageId);
      if (!page || !page.previewBase) { WS.flow.goHome(); return; }
      let settings = { ...page.filterSettings };
      const live = WS.canvas.scaleTo(page.previewBase, 1000, true);      // sumber preview cepat
      const tiny = WS.canvas.scaleTo(page.previewBase, 120, true);       // sumber thumbnail preset

      const preview = h('canvas', { class: 'preview-canvas', 'aria-label': 'Pratinjau hasil' });
      const pctx = WS.canvas.ctx2d(preview);

      /* ---- preset ---- */
      const presetBtns = WS.filters.PRESETS.map((p) => {
        const tc = WS.filters.render(tiny, { ...WS.filters.defaultsFor(p.id) });
        tc.className = 'preset-thumb';
        const btn = h('button', { class: 'preset', type: 'button', role: 'tab', 'data-id': p.id, onclick: () => selectPreset(p.id) }, tc, h('span', null, p.label));
        return btn;
      });
      const tabs = h('div', { class: 'preset-tabs', role: 'tablist', 'aria-label': 'Preset filter' }, presetBtns);

      /* ---- slider ---- */
      const sliders = {};
      function slider(key, label, min, max) {
        const val = h('output', { class: 'slider-val' }, String(settings[key]));
        const input = h('input', { type: 'range', min, max, step: 1, value: settings[key], 'aria-label': label });
        input.addEventListener('input', () => { settings[key] = Number(input.value); val.textContent = input.value; schedule(); });
        sliders[key] = { input, val };
        return h('label', { class: 'slider-row' }, h('span', { class: 'slider-label' }, label), input, val);
      }
      const rows = [slider('brightness', 'Kecerahan', -100, 100), slider('contrast', 'Kontras', -100, 100), slider('sharpness', 'Ketajaman', 0, 100), slider('strength', 'Kekuatan filter', 0, 100)];

      function syncUI() {
        presetBtns.forEach((b) => { const on = b.dataset.id === settings.preset; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
        Object.keys(sliders).forEach((k) => { sliders[k].input.value = settings[k]; sliders[k].val.textContent = String(settings[k]); });
        sliders.strength.input.disabled = settings.preset === 'original';
      }

      function selectPreset(id) {
        settings = { ...settings, ...WS.filters.defaultsFor(id), brightness: settings.brightness, contrast: settings.contrast, sharpness: settings.sharpness };
        syncUI(); schedule();
      }

      /* ---- render preview (dibatasi 1x per frame) ---- */
      let raf = 0;
      function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderPreview(); }); }
      function renderPreview() {
        const out = WS.filters.render(live, settings);
        preview.width = out.width; preview.height = out.height;
        pctx.drawImage(out, 0, 0);
        out.width = out.height = 1;
        page.filterSettings = { ...settings };
      }

      const resetBtn = h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => { settings = WS.store.DEFAULT_FILTER(); syncUI(); schedule(); } }, icon('reset', 18), 'Reset Filter');
      const doneBtn = h('button', { class: 'btn btn-primary btn-pill', type: 'button', onclick: done }, icon('check', 20), 'Selesai');

      function done() {
        WS.ui.busy('Menerapkan filter…');
        setTimeout(() => {
          try {
            page.filterSettings = { ...settings };
            if (page.processedCanvas) { page.processedCanvas.width = page.processedCanvas.height = 1; }
            page.processedCanvas = WS.filters.render(page.previewBase, settings);
            WS.flow.filterDone(page.id);
          } finally { WS.ui.idle(); }
        }, 30);
      }

      root.appendChild(h('div', { class: 'screen filter-screen' },
        h('header', { class: 'topbar' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Kembali ke potong', onclick: () => { page.filterSettings = { ...settings }; WS.flow.editCrop(page.id); } }, icon('back', 24)),
          h('div', { class: 'topbar-title' }, h('strong', null, 'Filter')),
          doneBtn),
        h('div', { class: 'preview-stage' }, preview),
        h('section', { class: 'panel', 'aria-label': 'Kontrol filter' }, tabs, h('div', { class: 'sliders' }, rows), h('div', { class: 'panel-foot' }, resetBtn))));

      syncUI();
      renderPreview();
      cleanup = () => { cancelAnimationFrame(raf); [live, tiny].forEach((c) => { c.width = c.height = 1; }); };
    },
    unmount() { if (cleanup) { cleanup(); cleanup = null; } },
  };
})(window.WS = window.WS || {});
