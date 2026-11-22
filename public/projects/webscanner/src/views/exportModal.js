/* exportModal.js — Unduh sebagai Gambar (PNG/JPG, satu per satu / gabungan) atau PDF (kualitas dapat diatur) */
(function (WS) {
  'use strict';
  const { h, icon } = WS.dom;
  let cleanup = null;

  WS.views.exportModal = {
    mount(root) {
      const store = WS.store;
      const ready = store.readyPages();
      let st = store.getState();
      let tab = st.exportMode || 'image';
      let format = st.imageFormat, mode = st.imageDownloadMode, quality = st.pdfQuality;
      let lossless = false, busy = false, progress = null, destroyed = false;
      let selected = new Set((st.selectedPageIdsForExport.length ? st.selectedPageIdsForExport : ready.map((p) => p.id)).filter((id) => ready.some((p) => p.id === id)));
      let estTimer = null, estCache = null;

      const close = () => { if (!busy) WS.flow.closeOverlay(); };
      const selectedPages = () => ready.filter((p) => selected.has(p.id));
      const persist = () => store.setState({ exportMode: tab, imageFormat: format, imageDownloadMode: mode, pdfQuality: quality, selectedPageIdsForExport: [...selected] });

      const tabContent = h('div', { class: 'export-section' });
      const selectionBox = h('div', { class: 'export-section' });
      const footer = h('div', { class: 'export-footer' });
      const tabBtns = [['image', 'Gambar'], ['pdf', 'PDF']].map(([id, label]) =>
        h('button', { class: 'seg-btn', type: 'button', role: 'tab', onclick: () => { if (busy) return; tab = id; persist(); renderAll(); } }, label));

      const sheet = h('div', { class: 'sheet sheet-export', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Unduh' },
        h('div', { class: 'sheet-head' }, h('h2', null, 'Unduh'), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Tutup', onclick: close }, icon('x', 22))),
        h('div', { class: 'segmented', role: 'tablist' }, tabBtns),
        h('div', { class: 'sheet-scroll' }, tabContent, selectionBox),
        footer);
      root.appendChild(h('div', { class: 'backdrop', onclick: (e) => { if (e.target === e.currentTarget) close(); } }, sheet));

      const radioGroup = (label, options, value, onPick) => h('div', { class: 'field' },
        h('div', { class: 'field-label' }, label),
        h('div', { class: 'segmented segmented-sm', role: 'radiogroup', 'aria-label': label }, options.map(([id, text]) =>
          h('button', { class: 'seg-btn' + (id === value ? ' is-on' : ''), type: 'button', role: 'radio', 'aria-checked': String(id === value), onclick: () => { if (!busy) onPick(id); } }, text))));

      function renderTab() {
        tabBtns.forEach((b, i) => { const on = (i === 0 ? 'image' : 'pdf') === tab; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
        tabContent.innerHTML = '';
        if (tab === 'image') {
          tabContent.append(
            radioGroup('Format', [['png', 'PNG'], ['jpg', 'JPG']], format, (v) => { format = v; persist(); renderTab(); }),
            h('p', { class: 'field-hint' }, format === 'png' ? 'PNG: lossless, ukuran biasanya lebih besar.' : 'JPG: lebih kecil, cocok untuk dokumen foto.'),
            radioGroup('Mode unduhan', [['individual', 'Satu per satu'], ['combined', 'Gabung jadi satu']], mode, (v) => { mode = v; persist(); renderTab(); }),
            h('p', { class: 'field-hint' }, mode === 'individual'
              ? (WS.download.supportsDirectoryPicker() ? 'Setiap halaman menjadi file terpisah. Anda dapat memilih folder tujuan.' : 'Setiap halaman menjadi file terpisah.')
              : 'Semua halaman digabung vertikal menjadi satu gambar panjang.'));
        } else {
          const desc = h('div', { class: 'quality-desc' });
          const estimate = h('div', { class: 'quality-est' });
          const slider = h('input', { type: 'range', min: 0, max: 100, step: 1, value: quality, 'aria-label': 'Kualitas PDF', disabled: lossless });
          const upd = () => { desc.textContent = lossless ? 'PNG lossless: kualitas penuh, ukuran file besar.' : `${quality} — ${WS.pdfExport.describe(quality)}`; };
          slider.addEventListener('input', () => { quality = Number(slider.value); upd(); persist(); scheduleEstimate(estimate); });
          const cb = h('input', { type: 'checkbox', checked: lossless, onchange: (e) => { lossless = e.target.checked; renderTab(); } });
          upd();
          tabContent.append(
            h('div', { class: 'field' }, h('div', { class: 'field-label' }, 'Kualitas'),
              h('div', { class: 'quality-row' }, h('span', null, 'Kecil'), slider, h('span', null, 'Asli')), desc),
            h('p', { class: 'field-hint' }, 'Semakin ke kiri: ukuran lebih kecil.', h('br'), 'Semakin ke kanan: kualitas lebih tinggi.'),
            h('label', { class: 'check-row' }, cb, h('span', null, 'Gunakan PNG lossless (slider tidak berlaku)')),
            estimate);
          scheduleEstimate(estimate);
        }
      }

      function scheduleEstimate(el) {
        clearTimeout(estTimer);
        const pages = selectedPages();
        if (lossless || !pages.length) { el.textContent = lossless ? 'Ukuran PNG lossless lebih besar dari JPG.' : ''; return; }
        el.textContent = 'Menghitung perkiraan ukuran…';
        estTimer = setTimeout(async () => {
          if (destroyed) return;
          try {
            const p = pages[0];
            if (!estCache || estCache.id !== p.id) {
              if (estCache) estCache.canvas.width = estCache.canvas.height = 1;
              estCache = { id: p.id, canvas: WS.imageExport.renderFull(p) };
            }
            const blob = await WS.canvas.toBlob(estCache.canvas, 'image/jpeg', WS.pdfExport.qualityFromSlider(quality));
            if (!destroyed && el.isConnected) el.textContent = `Perkiraan ukuran: sekitar ${WS.file.formatBytes(blob.size * pages.length)}`;
          } catch (e) { if (el.isConnected) el.textContent = ''; }
        }, 450);
      }

      function renderSelection() {
        selectionBox.innerHTML = '';
        const all = selected.size === ready.length;
        selectionBox.append(
          h('div', { class: 'select-head' },
            h('strong', null, `${selected.size} dari ${ready.length} halaman dipilih`),
            h('button', { class: 'link-btn', type: 'button', onclick: () => { if (busy) return; selected = all ? new Set() : new Set(ready.map((p) => p.id)); persist(); renderSelection(); renderFooter(); if (tab === 'pdf') renderTab(); } }, all ? 'Batal pilih semua' : 'Pilih semua')),
          h('div', { class: 'select-grid' }, ready.map((p) => {
            const num = store.getState().pages.indexOf(p) + 1;
            const c = WS.canvas.createCanvas(72, 96);
            const ctx = WS.canvas.ctx2d(c); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 72, 96);
            const src = p.processedCanvas, k = Math.min(72 / src.width, 96 / src.height);
            ctx.drawImage(src, (72 - src.width * k) / 2, (96 - src.height * k) / 2, src.width * k, src.height * k);
            const cb = h('input', { type: 'checkbox', checked: selected.has(p.id), 'aria-label': `Halaman ${num}`, onchange: (e) => {
              if (busy) { e.target.checked = !e.target.checked; return; }
              e.target.checked ? selected.add(p.id) : selected.delete(p.id);
              persist(); renderSelection(); renderFooter(); if (tab === 'pdf') renderTab();
            } });
            return h('label', { class: 'select-item' + (selected.has(p.id) ? ' is-on' : '') }, cb, c, h('span', null, `Halaman ${num}`));
          })));
      }

      function renderFooter() {
        footer.innerHTML = '';
        if (busy && progress) {
          footer.append(h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': progress.n, 'aria-valuenow': progress.i },
            h('div', { class: 'progress-bar', style: { width: `${Math.round((progress.i / Math.max(1, progress.n)) * 100)}%` } })),
            h('p', { class: 'field-hint center' }, progress.i >= progress.n ? 'Menyelesaikan…' : `Memproses halaman ${progress.i + 1} dari ${progress.n}…`));
        }
        footer.append(h('button', { class: 'btn btn-primary btn-big', type: 'button', disabled: busy || !selected.size, onclick: download }, busy ? 'Memproses…' : [icon('download', 22), 'Unduh']),
          h('p', { class: 'tray-note center' }, 'Semua hasil hanya tersimpan selama tab ini terbuka.'));
      }

      const renderAll = () => { renderTab(); renderSelection(); renderFooter(); };

      async function download() {
        const pages = selectedPages();
        if (!pages.length || busy) return;
        let dir = null;
        if (tab === 'image' && mode === 'individual' && pages.length > 1 && WS.download.supportsDirectoryPicker()) {
          try { dir = await WS.download.pickDirectory(); } catch (e) { if (e && e.name === 'AbortError') return; dir = null; }
        }
        busy = true; progress = { i: 0, n: pages.length }; renderFooter();
        const onProgress = (i, n) => { progress = { i, n }; if (!destroyed) renderFooter(); };
        try {
          if (tab === 'image') {
            if (mode === 'individual') await WS.imageExport.exportIndividual({ pages, format, dir, onProgress });
            else await WS.imageExport.exportCombined({ pages, format, onProgress });
          } else {
            const blob = await WS.pdfExport.exportPdf({ pages, quality: WS.pdfExport.qualityFromSlider(quality), lossless, onProgress });
            WS.download.downloadBlob(blob, 'docscan.pdf');
          }
          WS.dom.toast('Unduhan selesai.');
        } catch (e) {
          console.error(e);
          if (tab === 'pdf') WS.dom.toast('Gagal membuat PDF. Coba kurangi jumlah halaman atau kualitas gambar.', 'error');
          else WS.dom.toast(e instanceof RangeError ? 'Terlalu banyak gambar besar. Hapus beberapa halaman sebelum menambahkan lagi.' : 'Gagal memproses gambar. Coba kurangi jumlah halaman.', 'error');
        } finally { busy = false; progress = null; if (!destroyed) renderFooter(); }
      }

      const onKey = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey);
      renderAll();
      cleanup = () => {
        destroyed = true; clearTimeout(estTimer); document.removeEventListener('keydown', onKey);
        if (estCache) { estCache.canvas.width = estCache.canvas.height = 1; estCache = null; }
      };
    },
    unmount() { if (cleanup) { cleanup(); cleanup = null; } },
  };
})(window.WS = window.WS || {});
