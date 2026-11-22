/* cropEditor.js — deteksi otomatis + 4 handle sudut, zoom & pan. Gambar asli tidak pernah dipotong sebelum konfirmasi. */
(function (WS) {
  'use strict';
  const { h, icon } = WS.dom;
  const G = WS.geometry;
  let cleanup = null;

  WS.views.cropEditor = {
    mount(root) {
      const st = WS.store.getState();
      const page = WS.store.getPage(st.activePageId);
      if (!page) { WS.flow.goHome(); return; }
      const img = page.originalImageBitmap;
      const iw = img.width, ih = img.height;

      let pts = page.cropPoints ? G.toArray(page.cropPoints) : null;
      let manual = false, busy = false, destroyed = false;
      const total = st.cropQueueTotal || 0;
      const pos = total ? total - st.cropQueue.length + 1 : 0;

      /* ---------- DOM ---------- */
      const canvas = h('canvas', { class: 'crop-canvas', 'aria-label': 'Area potong dokumen' });
      const banner = h('div', { class: 'crop-banner', role: 'status', hidden: true });
      const zoomBtn = (ic, label, fn) => h('button', { class: 'tool-btn', type: 'button', 'aria-label': label, onclick: fn }, icon(ic, 20));
      const tools = h('div', { class: 'crop-tools' },
        zoomBtn('plus', 'Perbesar', () => zoomAt(cw / 2, ch / 2, 1.4)),
        zoomBtn('minus', 'Perkecil', () => zoomAt(cw / 2, ch / 2, 1 / 1.4)),
        zoomBtn('maximize', 'Pas layar', () => fit()));
      const stage = h('div', { class: 'crop-stage' }, canvas, banner, tools);

      const resetBtn = h('button', { class: 'btn btn-quiet', type: 'button', onclick: resetDetection }, icon('wand', 18), 'Reset Deteksi');
      const manualBtn = h('button', { class: 'btn btn-quiet', type: 'button', 'aria-pressed': 'false', onclick: pickManual }, icon('hand', 18), 'Pilih Manual');
      const fab = h('button', { class: 'fab', type: 'button', 'aria-label': 'Terapkan potongan', onclick: confirm }, icon('check', 30));

      const screen = h('div', { class: 'screen crop-screen' },
        h('header', { class: 'topbar topbar-dark' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Batal', onclick: () => WS.flow.cropCancel(page.id) }, icon('x', 24)),
          h('div', { class: 'topbar-title' }, h('strong', null, 'Potong dokumen'), pos > 1 || total > 1 ? h('small', null, `Gambar ${pos} dari ${total}`) : null),
          h('span', { class: 'topbar-spacer' })),
        stage,
        h('footer', { class: 'bar bar-dark' }, h('div', { class: 'bar-actions' }, resetBtn, manualBtn), fab));
      root.appendChild(screen);

      /* ---------- Tampilan (zoom & pan) ---------- */
      const ctx = WS.canvas.ctx2d(canvas);
      let cw = 0, ch = 0, dpr = 1, fitScale = 1;
      const view = { scale: 1, tx: 0, ty: 0 };
      const toScreen = (p) => ({ x: p.x * view.scale + view.tx, y: p.y * view.scale + view.ty });
      const toImage = (x, y) => ({ x: (x - view.tx) / view.scale, y: (y - view.ty) / view.scale });

      function layout() {
        const r = stage.getBoundingClientRect();
        if (!r.width || !r.height) return;
        cw = r.width; ch = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
        fit();
      }
      function fit() {
        const pad = 26;
        fitScale = Math.max(0.01, Math.min((cw - pad * 2) / iw, (ch - pad * 2) / ih));
        view.scale = fitScale; view.tx = (cw - iw * fitScale) / 2; view.ty = (ch - ih * fitScale) / 2;
        draw();
      }
      function zoomAt(cx, cy, f) {
        const ns = G.clamp(view.scale * f, fitScale * 0.7, Math.max(fitScale * 10, 3));
        const k = ns / view.scale;
        view.tx = cx - (cx - view.tx) * k; view.ty = cy - (cy - view.ty) * k; view.scale = ns;
        draw();
      }

      let dragIdx = -1;
      function draw() {
        if (!cw) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#12132A'; ctx.fillRect(0, 0, cw, ch);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, view.tx, view.ty, iw * view.scale, ih * view.scale);
        if (!pts) return;
        const sp = pts.map(toScreen);
        // overlay gelap di luar poligon
        ctx.beginPath(); ctx.rect(0, 0, cw, ch);
        ctx.moveTo(sp[0].x, sp[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(sp[i].x, sp[i].y); ctx.closePath();
        ctx.fillStyle = 'rgba(10,11,28,0.58)'; ctx.fill('evenodd');
        // garis penghubung
        ctx.beginPath(); ctx.moveTo(sp[0].x, sp[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(sp[i].x, sp[i].y); ctx.closePath();
        ctx.lineWidth = 2; ctx.strokeStyle = '#8F8DFF'; ctx.stroke();
        // handle
        sp.forEach((p, i) => {
          ctx.beginPath(); ctx.arc(p.x, p.y, i === dragIdx ? 15 : 12, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = '#3D3BE0'; ctx.stroke();
        });
        if (dragIdx >= 0) drawLoupe(pts[dragIdx], sp[dragIdx]);
      }
      function drawLoupe(p, s) {
        const R = 54, lx = s.x < cw / 2 ? cw - R - 16 : R + 16, ly = R + 16, z = Math.max(view.scale * 2.5, 1.2);
        ctx.save();
        ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#000'; ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
        ctx.drawImage(img, lx - p.x * z, ly - p.y * z, iw * z, ih * z);
        ctx.restore();
        ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - 9, ly); ctx.lineTo(lx + 9, ly); ctx.moveTo(lx, ly - 9); ctx.lineTo(lx, ly + 9);
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#3D3BE0'; ctx.stroke();
      }

      /* ---------- Pointer: geser handle, pan, pinch ---------- */
      const pointers = new Map();
      let pinch = null, panning = false, last = null;
      const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

      function hit(x, y) {
        if (!pts) return -1;
        let best = -1, bd = 30;
        pts.forEach((p, i) => { const s = toScreen(p); const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = i; } });
        return best;
      }
      canvas.addEventListener('pointerdown', (e) => {
        if (busy) return;
        canvas.setPointerCapture(e.pointerId);
        const p = local(e); pointers.set(e.pointerId, p);
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
          dragIdx = -1; panning = false;
        } else {
          dragIdx = hit(p.x, p.y);
          panning = dragIdx < 0; last = p;
        }
        draw();
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        const p = local(e); pointers.set(e.pointerId, p);
        if (pinch && pointers.size >= 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
          view.tx += cx - pinch.cx; view.ty += cy - pinch.cy;
          zoomAt(cx, cy, d / Math.max(1, pinch.d));
          pinch = { d, cx, cy };
        } else if (dragIdx >= 0) {
          const ip = toImage(p.x, p.y);
          pts[dragIdx] = { x: G.clamp(ip.x, 0, iw), y: G.clamp(ip.y, 0, ih) };
          manual = true; draw();
        } else if (panning && last) {
          view.tx += p.x - last.x; view.ty += p.y - last.y; last = p; draw();
        }
      });
      const end = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (!pointers.size) { dragIdx = -1; panning = false; last = null; }
        else if (pointers.size === 1) { last = [...pointers.values()][0]; panning = true; }
        draw();
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const p = local(e);
        zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
      }, { passive: false });

      /* ---------- Aksi ---------- */
      function setBanner(msg) { banner.hidden = !msg; banner.textContent = msg || ''; }
      function setManualUI(v) { manualBtn.setAttribute('aria-pressed', String(v)); manualBtn.classList.toggle('is-on', v); }

      function runDetection() {
        setBanner('Mendeteksi dokumen…');
        fab.disabled = resetBtn.disabled = manualBtn.disabled = true;
        setTimeout(() => {
          if (destroyed) return;
          let res;
          try { res = WS.detection.detect(img); } catch (e) { res = { points: G.defaultPoints(iw, ih), confident: false }; }
          page.autoPoints = res.points.map((p) => ({ ...p })); page.autoConfident = res.confident;
          if (!pts) pts = res.points.map((p) => ({ ...p }));
          fab.disabled = resetBtn.disabled = manualBtn.disabled = false;
          if (!res.confident) { manual = true; setManualUI(true); setBanner('Deteksi otomatis tidak akurat. Silakan sesuaikan sudut dokumen secara manual.'); }
          else setBanner(null);
          draw();
        }, 40);
      }

      function resetDetection() {
        if (!page.autoPoints) return;
        pts = page.autoPoints.map((p) => ({ ...p })); manual = false; setManualUI(false);
        setBanner(page.autoConfident ? null : 'Deteksi otomatis tidak akurat. Silakan sesuaikan sudut dokumen secara manual.');
        fit();
      }
      function pickManual() {
        pts = G.defaultPoints(iw, ih, 0.08); manual = true; setManualUI(true); setBanner(null); fit();
      }

      async function confirm() {
        if (busy || !pts) return;
        if (!G.isValidQuad(pts, iw * ih * 0.002)) { WS.dom.toast('Titik sudut tidak valid. Pastikan keempat sudut membentuk segi empat.', 'error'); return; }
        busy = true;
        WS.ui.busy('Meluruskan dokumen…');
        try {
          await WS.canvas.nextFrame();
          const corrected = WS.perspective.extractPaper(img, pts);
          [page.perspectiveCorrectedCanvas, page.previewBase, page.processedCanvas].forEach((c) => { if (c) { c.width = 1; c.height = 1; } });
          page.cropPoints = G.fromArray(pts);
          page.perspectiveCorrectedCanvas = corrected;
          page.previewBase = WS.canvas.scaleTo(corrected, 1400, true);
          page.processedCanvas = WS.filters.render(page.previewBase, page.filterSettings);
          page.status = 'ready';
          WS.flow.cropConfirmed(page.id);
        } catch (e) {
          WS.dom.toast(e instanceof RangeError ? 'Terlalu banyak gambar besar. Hapus beberapa halaman sebelum menambahkan lagi.' : 'Gagal meluruskan dokumen. Coba sesuaikan sudutnya.', 'error');
        } finally { busy = false; WS.ui.idle(); }
      }

      const onKey = (e) => { if (e.key === 'Escape') WS.flow.cropCancel(page.id); };
      document.addEventListener('keydown', onKey);
      const ro = new ResizeObserver(layout);
      ro.observe(stage);

      if (!page.autoPoints) runDetection();
      else if (!pts) pts = page.autoPoints.map((p) => ({ ...p }));
      if (page.autoPoints && !page.autoConfident && !page.cropPoints) { manual = true; setManualUI(true); setBanner('Deteksi otomatis tidak akurat. Silakan sesuaikan sudut dokumen secara manual.'); }

      cleanup = () => { destroyed = true; ro.disconnect(); document.removeEventListener('keydown', onKey); };
    },
    unmount() { if (cleanup) { cleanup(); cleanup = null; } },
  };
})(window.WS = window.WS || {});
