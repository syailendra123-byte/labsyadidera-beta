/* documentDetection.js — deteksi tepi dokumen (JavaScript murni, tanpa OpenCV)
 *
 * Cara kerja: perkecil gambar -> grayscale -> blur -> ambang Otsu -> komponen terhubung terbesar
 * (dicoba untuk kertas lebih terang dan lebih gelap dari latar) -> convex hull -> sederhanakan jadi 4 sudut.
 */
(function (WS) {
  'use strict';
  const G = WS.geometry;

  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Uint8Array(w * h);
    const win = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      let sum = 0; const row = y * w;
      for (let x = -r; x <= r; x++) sum += src[row + G.clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = sum / win;
        sum += src[row + G.clamp(x + r + 1, 0, w - 1)] - src[row + G.clamp(x - r, 0, w - 1)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[G.clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / win;
        sum += tmp[G.clamp(y + r + 1, 0, h - 1) * w + x] - tmp[G.clamp(y - r, 0, h - 1) * w + x];
      }
    }
    return out;
  }

  function otsu(gray) {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
    const total = gray.length;
    let sumAll = 0; for (let i = 0; i < 256; i++) sumAll += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sumAll - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = t; }
    }
    return thr;
  }

  // Komponen terhubung (4-arah). Kembalikan daftar { id, area, sides } terurut dari terbesar.
  function components(mask, w, h) {
    const labels = new Int32Array(w * h);
    const stack = new Int32Array(w * h);
    const comps = [];
    let id = 0;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || labels[i]) continue;
      id++;
      let sp = 0, area = 0, L = false, R = false, T = false, B = false;
      stack[sp++] = i; labels[i] = id;
      while (sp) {
        const p = stack[--sp]; area++;
        const x = p % w, y = (p / w) | 0;
        if (x === 0) L = true; if (x === w - 1) R = true; if (y === 0) T = true; if (y === h - 1) B = true;
        if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = id; stack[sp++] = p - 1; }
        if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = id; stack[sp++] = p + 1; }
        if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = id; stack[sp++] = p - w; }
        if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = id; stack[sp++] = p + w; }
      }
      comps.push({ id, area, sides: (L ? 1 : 0) + (R ? 1 : 0) + (T ? 1 : 0) + (B ? 1 : 0) });
    }
    comps.sort((a, b) => b.area - a.area);
    return { labels, comps };
  }

  function boundaryPoints(labels, id, w, h) {
    const pts = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (labels[p] !== id) continue;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
            labels[p - 1] !== id || labels[p + 1] !== id || labels[p - w] !== id || labels[p + w] !== id) pts.push({ x, y });
      }
    }
    return pts;
  }

  function convexHull(points) {
    const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  // Perpotongan dua garis (a1-a2) dan (b1-b2); null jika sejajar
  function intersect(a1, a2, b1, b2) {
    const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
    if (Math.abs(d) < 1e-9) return null;
    const A = a1.x * a2.y - a1.y * a2.x, B = b1.x * b2.y - b1.y * b2.x;
    return { x: (A * (b1.x - b2.x) - (a1.x - a2.x) * B) / d, y: (A * (b1.y - b2.y) - (a1.y - a2.y) * B) / d };
  }
  const triArea = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;

  // Kurangi poligon cembung menjadi 4 titik yang MELINGKUPI poligon:
  // hapus satu sisi dengan memperpanjang dua sisi tetangganya sampai berpotongan,
  // pilih sisi yang menambah luas paling sedikit.
  function reduceToQuad(poly) {
    let p = poly.slice();
    while (p.length > 4) {
      const n = p.length;
      let bestAdd = Infinity, bestI = -1, bestQ = null;
      for (let i = 0; i < n; i++) {
        const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n], d = p[(i + 2) % n];
        const q = intersect(a, b, d, c);
        if (!q) continue;
        if ((q.x - b.x) * (b.x - a.x) + (q.y - b.y) * (b.y - a.y) <= 0) continue;   // harus di luar sisi
        if ((q.x - c.x) * (c.x - d.x) + (q.y - c.y) * (c.y - d.y) <= 0) continue;
        const add = triArea(b, q, c);
        if (add < bestAdd) { bestAdd = add; bestI = i; bestQ = q; }
      }
      if (bestI >= 0) {
        const j = (bestI + 1) % n;
        p = j === 0 ? p.slice(1, n - 1).concat([bestQ]) : p.slice(0, bestI).concat([bestQ], p.slice(bestI + 2));
      } else {
        let minA = Infinity, idx = 0;
        for (let i = 0; i < n; i++) {
          const area = triArea(p[(i - 1 + n) % n], p[i], p[(i + 1) % n]);
          if (area < minA) { minA = area; idx = i; }
        }
        p.splice(idx, 1);
      }
    }
    return p;
  }

  function evaluate(gray, w, h, bright, thr) {
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = bright ? (gray[i] > thr ? 1 : 0) : (gray[i] <= thr ? 1 : 0);
    const { labels, comps } = components(mask, w, h);
    let best = null;
    for (const c of comps.slice(0, 3)) {
      if (c.area < w * h * 0.06) break;
      if (c.sides >= 3) continue; // hampir pasti latar belakang
      const hull = convexHull(boundaryPoints(labels, c.id, w, h));
      if (hull.length < 4) continue;
      const hullArea = G.polygonArea(hull);
      const quad = G.orderCorners(reduceToQuad(hull));
      const quadArea = G.polygonArea(quad);
      const frac = quadArea / (w * h);
      const solidity = c.area / Math.max(1, hullArea);
      if (frac < 0.1 || frac > 0.96 || solidity < 0.72 || !G.isValidQuad(quad, w * h * 0.05)) continue;
      const score = frac * solidity * solidity;
      if (!best || score > best.score) best = { quad, score };
    }
    return best;
  }

  /** @returns {{points: {x,y}[], confident: boolean}} titik urutan TL,TR,BR,BL dalam koordinat gambar asli */
  function detect(canvas) {
    const W = canvas.width, H = canvas.height;
    const s = Math.min(1, 360 / Math.max(W, H));
    const w = Math.max(16, Math.round(W * s)), h = Math.max(16, Math.round(H * s));
    const small = WS.canvas.createCanvas(w, h);
    const ctx = WS.canvas.ctx2d(small, { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
    const r = Math.max(2, Math.round(Math.max(w, h) / 90));
    const blurred = boxBlur(boxBlur(gray, w, h, r), w, h, r);
    const thr = otsu(blurred);

    const a = evaluate(blurred, w, h, true, thr);
    const b = evaluate(blurred, w, h, false, thr);
    const best = a && b ? (a.score >= b.score ? a : b) : (a || b);
    small.width = small.height = 1;

    if (!best) return { points: G.defaultPoints(W, H), confident: false };
    // geser sedikit ke dalam agar tepi gelap latar tidak ikut terpotong
    const cx = best.quad.reduce((a, p) => a + p.x, 0) / 4, cy = best.quad.reduce((a, p) => a + p.y, 0) / 4;
    const pts = best.quad.map((p) => ({ x: G.clamp((p.x + (cx - p.x) * 0.012) / s, 0, W), y: G.clamp((p.y + (cy - p.y) * 0.012) / s, 0, H) }));
    return { points: pts, confident: true };
  }

  WS.detection = { detect };
})(window.WS = window.WS || {});
