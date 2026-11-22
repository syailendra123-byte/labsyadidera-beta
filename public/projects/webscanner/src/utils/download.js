/* download.js — unduh Blob / tulis ke folder */
(function (WS) {
  'use strict';

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); // cegah memory leak
  }

  const supportsDirectoryPicker = () => typeof window.showDirectoryPicker === 'function';

  async function pickDirectory() { return window.showDirectoryPicker({ mode: 'readwrite' }); }

  async function writeToDirectory(dir, filename, blob) {
    const fh = await dir.getFileHandle(filename, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  WS.download = { downloadBlob, supportsDirectoryPicker, pickDirectory, writeToDirectory, wait };
})(window.WS = window.WS || {});
