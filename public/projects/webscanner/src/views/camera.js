/* camera.js — pratinjau kamera langsung + ambil foto */
(function (WS) {
  'use strict';
  const { h, icon } = WS.dom;
  let stream = null, destroyed = false;

  function stop() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }

  WS.views.camera = {
    mount(root) {
      destroyed = false;
      let facing = 'environment';
      const video = h('video', { class: 'cam-video', playsinline: true, autoplay: true });
      video.muted = true;
      const body = h('div', { class: 'cam-body' }, video);
      const switchBtn = h('button', { class: 'cam-side', type: 'button', 'aria-label': 'Ganti kamera', hidden: true, onclick: () => { facing = facing === 'environment' ? 'user' : 'environment'; start(); } }, icon('flip', 24));
      const shutter = h('button', { class: 'shutter', type: 'button', 'aria-label': 'Ambil foto', disabled: true, onclick: capture }, h('span'));
      const cancel = h('button', { class: 'cam-side', type: 'button', 'aria-label': 'Batal', onclick: () => WS.flow.closeCamera() }, icon('x', 24));
      const screen = h('div', { class: 'screen cam-screen' }, body, h('div', { class: 'cam-controls' }, cancel, shutter, switchBtn));
      root.appendChild(screen);

      function showError(msg) {
        shutter.disabled = true;
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'cam-error' }, icon('alert', 32), h('p', null, msg),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { WS.flow.closeCamera(); WS.flow.pickFiles(); } }, 'Pilih Foto')));
      }

      async function start() {
        stop();
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showError('Kamera tidak ditemukan pada perangkat ini.'); return; }
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
          if (destroyed) { s.getTracks().forEach((t) => t.stop()); return; }
          stream = s;
          video.srcObject = s;
          await video.play().catch(() => {});
          shutter.disabled = false;
          const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
          switchBtn.hidden = devs.filter((d) => d.kind === 'videoinput').length < 2;
        } catch (e) {
          if (destroyed) return;
          if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'PermissionDeniedError')) showError('Akses kamera tidak diizinkan. Anda masih dapat memilih foto dari perangkat.');
          else showError('Kamera tidak ditemukan pada perangkat ini.');
        }
      }

      function capture() {
        if (!video.videoWidth) return;
        const c = WS.canvas.createCanvas(video.videoWidth, video.videoHeight);
        WS.canvas.ctx2d(c).drawImage(video, 0, 0, c.width, c.height);
        WS.fileImport.importCanvas(c);
      }

      start();
    },
    unmount() { destroyed = true; stop(); },
  };
})(window.WS = window.WS || {});
