/* documentEditor.js — pratinjau halaman aktif + thumbnail (urut ulang, hapus, tambah) */
(function (WS) {
  'use strict';
  const { h, icon } = WS.dom;
  let stripScroll = 0;
  let stripEl = null;

  function drawThumb(page, w, hgt) {
    const c = WS.canvas.createCanvas(w, hgt);
    const src = page.processedCanvas || page.originalImageBitmap;
    const ctx = WS.canvas.ctx2d(c);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hgt);
    const k = Math.min(w / src.width, hgt / src.height);
    const dw = src.width * k, dh = src.height * k;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (w - dw) / 2, (hgt - dh) / 2, dw, dh);
    return c;
  }

  WS.views.documentEditor = {
    mount(root) {
      const st = WS.store.getState();
      const pages = st.pages;
      if (!pages.length) { WS.flow.goHome(); return; }
      const active = pages.find((p) => p.id === st.activePageId) || pages[0];
      const activeIdx = pages.indexOf(active);
      const ready = WS.store.readyPages();

      /* ---- preview ---- */
      const prev = h('canvas', { class: 'preview-canvas doc-canvas', 'aria-label': 'Pratinjau halaman ' + (activeIdx + 1) });
      const src = active.processedCanvas || active.originalImageBitmap;
      const maxS = 1600, k = Math.min(1, maxS / Math.max(src.width, src.height));
      prev.width = Math.round(src.width * k); prev.height = Math.round(src.height * k);
      WS.canvas.ctx2d(prev).drawImage(src, 0, 0, prev.width, prev.height);

      /* ---- aksi halaman ---- */
      const act = (ic, label, fn, dis) => h('button', { class: 'chip', type: 'button', disabled: dis, onclick: fn }, icon(ic, 18), h('span', null, label));
      const actions = h('div', { class: 'page-actions' },
        act('crop', 'Potong ulang', () => WS.flow.editCrop(active.id)),
        act('sliders', 'Filter', () => WS.flow.editFilter(active.id), !active.perspectiveCorrectedCanvas),
        act('left', 'Geser kiri', () => WS.store.movePage(active.id, activeIdx - 1), activeIdx === 0),
        act('right', 'Geser kanan', () => WS.store.movePage(active.id, activeIdx + 1), activeIdx === pages.length - 1),
        act('trash', 'Hapus', () => WS.flow.deletePage(active.id)));

      /* ---- thumbnail ---- */
      let dragId = null;
      const thumbs = pages.map((p, i) => {
        const isActive = p.id === active.id;
        const pending = p.status !== 'ready';
        const item = h('div', {
          class: 'thumb' + (isActive ? ' is-active' : '') + (pending ? ' is-pending' : ''),
          draggable: 'true', 'data-id': p.id, role: 'button', tabindex: '0',
          'aria-label': `Halaman ${i + 1}${isActive ? ', aktif' : ''}${pending ? ', belum dipotong' : ''}`,
          'aria-current': isActive ? 'true' : null,
          onclick: () => { if (p.id !== active.id) WS.store.setState({ activePageId: p.id }); },
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); WS.store.setState({ activePageId: p.id }); } },
          ondragstart: (e) => { dragId = p.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); item.classList.add('is-dragging'); },
          ondragend: () => { dragId = null; item.classList.remove('is-dragging'); strip.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target')); },
          ondragover: (e) => { if (!dragId) return; e.preventDefault(); item.classList.add('drop-target'); },
          ondragleave: () => item.classList.remove('drop-target'),
          ondrop: (e) => { if (!dragId) return; e.preventDefault(); const id = dragId; dragId = null; WS.store.movePage(id, i); },
        },
          drawThumb(p, 120, 164),
          h('span', { class: 'thumb-num' }, String(i + 1)),
          pending ? h('span', { class: 'thumb-flag' }, 'Belum dipotong') : null,
          h('button', { class: 'thumb-del', type: 'button', 'aria-label': `Hapus halaman ${i + 1}`, onclick: (e) => { e.stopPropagation(); WS.flow.deletePage(p.id); } }, icon('x', 14)));
        return item;
      });
      const strip = h('div', { class: 'thumb-strip' }, thumbs);
      stripEl = strip;
      strip.addEventListener('scroll', () => { stripScroll = strip.scrollLeft; }, { passive: true });

      const addBtn = h('button', { class: 'add-page', type: 'button', onclick: () => WS.flow.openSourcePicker() }, icon('plus', 26), h('span', null, 'Tambah Gambar'));

      root.appendChild(h('div', { class: 'screen doc-screen' },
        h('header', { class: 'topbar' },
          h('div', { class: 'topbar-title topbar-title-left' }, h('strong', null, 'Dokumen'), h('small', null, `${activeIdx + 1} dari ${pages.length} halaman`)),
          h('button', { class: 'btn btn-primary btn-pill', type: 'button', disabled: !ready.length, onclick: () => WS.flow.openExport() }, icon('download', 20), 'Unduh')),
        h('div', { class: 'preview-stage' }, prev),
        actions,
        h('section', { class: 'tray', 'aria-label': 'Halaman dokumen' },
          h('div', { class: 'tray-row' }, addBtn, strip),
          h('p', { class: 'tray-note' }, 'Semua hasil hanya tersimpan selama tab ini terbuka.'))));

      // pulihkan posisi gulir lalu pastikan thumbnail aktif terlihat
      strip.scrollLeft = stripScroll;
      const el = strip.querySelector('.is-active');
      if (el) {
        const l = el.offsetLeft, r = l + el.offsetWidth;
        if (l < strip.scrollLeft || r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = l - 16;
      }
    },
    unmount() { if (stripEl) stripScroll = stripEl.scrollLeft; stripEl = null; },
  };
})(window.WS = window.WS || {});
