/* geometry.js — titik, urutan sudut, homografi */
(function (WS) {
  'use strict';

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // {topLeft,...} <-> [TL,TR,BR,BL]
  function toArray(c) { return [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft].map((p) => ({ x: p.x, y: p.y })); }
  function fromArray(a) { return { topLeft: { ...a[0] }, topRight: { ...a[1] }, bottomRight: { ...a[2] }, bottomLeft: { ...a[3] } }; }

  // Urutkan 4 titik: TL, TR, BR, BL (searah jarum jam di layar)
  function orderCorners(pts) {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const sorted = pts.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    let start = 0, best = Infinity;
    sorted.forEach((p, i) => { const s = p.x + p.y; if (s < best) { best = s; start = i; } });
    return [0, 1, 2, 3].map((i) => sorted[(start + i) % 4]);
  }

  function defaultPoints(w, h, inset = 0.06) {
    const ix = w * inset, iy = h * inset;
    return [{ x: ix, y: iy }, { x: w - ix, y: iy }, { x: w - ix, y: h - iy }, { x: ix, y: h - iy }];
  }

  function polygonArea(p) {
    let a = 0;
    for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i].x * q.y - q.x * p[i].y; }
    return Math.abs(a) / 2;
  }

  // Segi empat harus cembung dan tidak terlalu kecil
  function isValidQuad(p, minArea) {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) < 1e-6) return false;
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s; else if (s !== sign) return false;
    }
    return polygonArea(p) >= (minArea || 100);
  }

  // Ukuran hasil luruskan dari 4 titik
  function quadSize(p) {
    const w = Math.max(dist(p[0], p[1]), dist(p[3], p[2]));
    const h = Math.max(dist(p[0], p[3]), dist(p[1], p[2]));
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
  }

  // Selesaikan homografi H (3x3, h33=1) yang memetakan src[i] -> dst[i]
  function solveHomography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = src[i], { x: u, y: v } = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const n = 8;
    for (let i = 0; i < n; i++) A[i].push(b[i]);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
      if (Math.abs(A[piv][col]) < 1e-12) return null;
      [A[col], A[piv]] = [A[piv], A[col]];
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = A[r][col] / A[col][col];
        for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c];
      }
    }
    const h = A.map((row, i) => row[n] / row[i]);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }

  WS.geometry = { dist, clamp, toArray, fromArray, orderCorners, defaultPoints, polygonArea, isValidQuad, quadSize, solveHomography };
})(window.WS = window.WS || {});
