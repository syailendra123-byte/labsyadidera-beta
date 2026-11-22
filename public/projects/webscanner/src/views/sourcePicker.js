/* sourcePicker.js — bottom sheet: Buka Kamera / Pilih Foto */
(function (WS) {
  'use strict';
  const { h, icon } = WS.dom;
  let onKey = null;

  WS.views.sourcePicker = {
    mount(root) {
      const close = () => WS.flow.closeOverlay();
      const option = (ic, title, sub, fn) => h('button', { class: 'option', type: 'button', onclick: fn },
        h('span', { class: 'option-icon' }, icon(ic, 26)),
        h('span', { class: 'option-text' }, h('strong', null, title), h('small', null, sub)));

      const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pilih sumber foto' },
        h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
        option('camera', 'Buka Kamera', 'Foto dokumen langsung', () => WS.flow.openCamera()),
        option('image', 'Pilih Foto', 'Dari galeri atau file manager', () => WS.flow.pickFiles()),
        h('p', { class: 'sheet-hint' }, 'Bisa juga seret foto ke halaman ini.'));

      root.appendChild(h('div', { class: 'backdrop', onclick: (e) => { if (e.target === e.currentTarget) close(); } }, sheet));
      onKey = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey);
      sheet.querySelector('.option').focus();
    },
    unmount() { document.removeEventListener('keydown', onKey); },
  };
})(window.WS = window.WS || {});
