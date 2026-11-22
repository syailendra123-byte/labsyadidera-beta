/* emptyState.js — layar awal: seluruh area bisa diketuk */
(function (WS) {
  'use strict';
  const { h } = WS.dom;
  WS.views = WS.views || {};

  WS.views.emptyState = {
    mount(root) {
      const corner = (c) => h('span', { class: 'corner corner-' + c, 'aria-hidden': 'true' });
      root.appendChild(h('div', { class: 'screen empty-screen' },
        h('button', { class: 'empty-tap', type: 'button', onclick: () => WS.flow.openSourcePicker() },
          h('span', { class: 'scan-frame' }, corner('tl'), corner('tr'), corner('br'), corner('bl'),
            h('span', { class: 'empty-text' }, 'Ketuk di mana saja untuk membuka foto'))),
        h('p', { class: 'empty-note' }, 'File tidak diproses di Cloud manapun')));
    },
    unmount() {},
  };
})(window.WS = window.WS || {});
