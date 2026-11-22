/* dragAndDrop.js — drag & drop file gambar ke seluruh halaman (HTML5 DnD native) */
(function (WS) {
  'use strict';
  let depth = 0;

  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  const overlay = () => document.getElementById('dropzone');
  const show = (v) => { const o = overlay(); if (o) o.classList.toggle('show', v); };

  function init() {
    window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; show(true); });
    window.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    window.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) show(false); });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; show(false);
      if (WS.store.getState().cameraOpen) return;
      WS.fileImport.importFiles(e.dataTransfer.files);
    });
  }

  WS.dragAndDrop = { init };
})(window.WS = window.WS || {});
