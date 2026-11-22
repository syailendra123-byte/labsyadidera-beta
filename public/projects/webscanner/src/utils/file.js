/* file.js — validasi file */
(function (WS) {
  'use strict';

  const MAX_BYTES = 25 * 1024 * 1024;
  const WARN_BYTES = 10 * 1024 * 1024;
  const OK_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const OK_EXT = /\.(png|jpe?g|webp)$/i;

  const isImage = (f) => OK_TYPES.includes((f.type || '').toLowerCase()) || (!f.type && OK_EXT.test(f.name || ''));

  // Kembalikan { valid: File[], errors: string[], warnBig: boolean }
  function validate(files) {
    const valid = [], errors = [];
    let warnBig = false;
    Array.from(files).forEach((f) => {
      if (!isImage(f)) { if (!errors.includes('Hanya file gambar yang didukung.')) errors.push('Hanya file gambar yang didukung.'); return; }
      if (f.size > MAX_BYTES) { const m = 'Ukuran file terlalu besar. Gunakan gambar di bawah 25 MB.'; if (!errors.includes(m)) errors.push(m); return; }
      if (f.size > WARN_BYTES) warnBig = true;
      valid.push(f);
    });
    return { valid, errors, warnBig };
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  WS.file = { validate, isImage, formatBytes, MAX_BYTES };
})(window.WS = window.WS || {});
