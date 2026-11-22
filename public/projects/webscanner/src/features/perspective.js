/* perspective.js — koreksi perspektif (homografi + interpolasi bilinear), implementasi sendiri */
(function (WS) {
  'use strict';
  const G = WS.geometry;
  const MAX_OUT_SIDE = 3000;

  /** @param {HTMLCanvasElement} src  @param {{x,y}[]} pts urutan TL,TR,BR,BL (koordinat src) */
  function extractPaper(src, pts, maxSide) {
    const lim = maxSide || MAX_OUT_SIDE;
    let { w, h } = G.quadSize(pts);
    const k = Math.min(1, lim / Math.max(w, h));
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));

    const H = G.solveHomography([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], pts);
    if (!H) throw new Error('homography-failed');

    const sw = src.width, sh = src.height;
    const sdata = WS.canvas.ctx2d(src, { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
    const out = WS.canvas.createCanvas(w, h);
    const octx = WS.canvas.ctx2d(out);
    const img = octx.createImageData(w, h);
    const od = img.data;
    const [h0, h1, h2, h3, h4, h5, h6, h7] = H;
    const maxX = sw - 1.001, maxY = sh - 1.001;

    let o = 0;
    for (let y = 0; y < h; y++) {
      const yy = y + 0.5;
      for (let x = 0; x < w; x++, o += 4) {
        const xx = x + 0.5;
        const d = h6 * xx + h7 * yy + 1;
        let sx = (h0 * xx + h1 * yy + h2) / d - 0.5;
        let sy = (h3 * xx + h4 * yy + h5) / d - 0.5;
        sx = sx < 0 ? 0 : sx > maxX ? maxX : sx;
        sy = sy < 0 ? 0 : sy > maxY ? maxY : sy;
        const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
        const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        od[o] = sdata[i00] * w00 + sdata[i10] * w10 + sdata[i01] * w01 + sdata[i11] * w11;
        od[o + 1] = sdata[i00 + 1] * w00 + sdata[i10 + 1] * w10 + sdata[i01 + 1] * w01 + sdata[i11 + 1] * w11;
        od[o + 2] = sdata[i00 + 2] * w00 + sdata[i10 + 2] * w10 + sdata[i01 + 2] * w01 + sdata[i11 + 2] * w11;
        od[o + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    return out;
  }

  WS.perspective = { extractPaper };
})(window.WS = window.WS || {});
