/* filters.js — filter dokumen non-destruktif (parameter disimpan terpisah, dihitung ulang dari hasil perspektif) */
(function (WS) {
  'use strict';
  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  const PRESETS = [
    { id: 'original', label: 'Asli', strength: 0 },
    { id: 'document', label: 'Dokumen', strength: 80 },
    { id: 'grayscale', label: 'Grayscale', strength: 100 },
    { id: 'bw', label: 'Hitam-Putih', strength: 100 },
    { id: 'dark', label: 'Gelap', strength: 100 },
  ];

  function defaultsFor(id) {
    const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
    return { preset: p.id, strength: p.strength, brightness: 0, contrast: 0, sharpness: 0 };
  }

  // Rata-rata lokal (kotak) memakai integral image — untuk meratakan pencahayaan
  function localMean(lum, w, h, r) {
    const W = w + 1;
    const integ = new Uint32Array(W * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += lum[y * w + x];
        integ[(y + 1) * W + x + 1] = integ[y * W + x + 1] + row;
      }
    }
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const sum = integ[y1 * W + x1] - integ[y0 * W + x1] - integ[y1 * W + x0] + integ[y0 * W + x0];
        out[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
      }
    }
    return out;
  }

  function applyPreset(d, w, h, id, s) {
    if (id === 'original' || s <= 0) return;
    const n = w * h;
    const lum = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) lum[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    const r = Math.max(8, Math.round(Math.min(w, h) / 16));
    const inv = 1 - s;

    if (id === 'grayscale') {
      for (let i = 0, j = 0; i < n; i++, j += 4) {
        const g = lum[i];
        d[j] = d[j] * inv + g * s; d[j + 1] = d[j + 1] * inv + g * s; d[j + 2] = d[j + 2] * inv + g * s;
      }
    } else if (id === 'document') {
      const mean = localMean(lum, w, h, r);
      for (let i = 0, j = 0; i < n; i++, j += 4) {
        const sc = 255 / Math.max(50, mean[i] * 0.93);
        for (let c = 0; c < 3; c++) {
          let v = clamp255(d[j + c] * sc);
          v = 255 * Math.pow(v / 255, 1.3);
          d[j + c] = d[j + c] * inv + v * s;
        }
      }
    } else if (id === 'bw') {
      const mean = localMean(lum, w, h, r);
      for (let i = 0, j = 0; i < n; i++, j += 4) {
        const ratio = lum[i] / Math.max(1, mean[i]);
        const v = 255 * Math.min(1, Math.max(0, (ratio - 0.72) / 0.21));
        d[j] = d[j] * inv + v * s; d[j + 1] = d[j + 1] * inv + v * s; d[j + 2] = d[j + 2] * inv + v * s;
      }
    } else if (id === 'dark') {
      const g = new Uint8Array(n);
      for (let i = 0; i < n; i++) g[i] = 255 - lum[i];
      const mean = localMean(g, w, h, r);
      for (let i = 0, j = 0; i < n; i++, j += 4) {
        let v = clamp255(g[i] * (255 / Math.max(50, mean[i] * 0.93)));
        v = 255 * Math.pow(v / 255, 1.3);
        d[j] = d[j] * inv + v * s; d[j + 1] = d[j + 1] * inv + v * s; d[j + 2] = d[j + 2] * inv + v * s;
      }
    }
  }

  function applyBrightnessContrast(d, brightness, contrast) {
    if (!brightness && !contrast) return;
    const c2 = contrast * 2.2;
    const cf = (259 * (c2 + 255)) / (255 * (259 - c2));
    const add = brightness * 1.28;
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = (v - 128) * cf + 128 + add;
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i] | 0]; d[i + 1] = lut[d[i + 1] | 0]; d[i + 2] = lut[d[i + 2] | 0]; }
  }

  function applySharpen(d, w, h, amount) {
    if (amount <= 0) return;
    const a = (amount / 100) * 1.2;
    const src = new Uint8ClampedArray(d);
    const row = w * 4;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * row + x * 4;
        for (let c = 0; c < 3; c++) {
          const k = i + c;
          d[k] = src[k] + a * (4 * src[k] - src[k - 4] - src[k + 4] - src[k - row] - src[k + row]);
        }
      }
    }
  }

  /** Hasilkan canvas baru yang sudah difilter. maxSide opsional (untuk preview). */
  function render(srcCanvas, settings, maxSide) {
    const base = maxSide ? WS.canvas.scaleTo(srcCanvas, maxSide, true) : WS.canvas.scaleTo(srcCanvas, Infinity, true);
    const ctx = WS.canvas.ctx2d(base, { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, base.width, base.height);
    const d = img.data;
    const s = settings || defaultsFor('original');
    applyPreset(d, base.width, base.height, s.preset, (s.strength || 0) / 100);
    applyBrightnessContrast(d, s.brightness || 0, s.contrast || 0);
    applySharpen(d, base.width, base.height, s.sharpness || 0);
    ctx.putImageData(img, 0, 0);
    return base;
  }

  WS.filters = { PRESETS, defaultsFor, render };
})(window.WS = window.WS || {});
