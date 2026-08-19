/* ======================================================================
   BAGIAN 1: AMBIL DATA DARI API LOKAL (api/index.js)
   ====================================================================== */

const BULAN_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function formatTanggalPendek(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${BULAN_ID[month - 1]}`;
}

function formatRupiah(value) {
  return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format Date object jadi string ISO "YYYY-MM-DD" (dibutuhkan formatTanggalPendek).
function toISODate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// code.gs sekarang HANYA mengirim array "close" (tanpa tanggal), dengan urutan
// data terlama di index 0 dan data TERBARU (hari ini) di index terakhir.
// Jadi tanggalnya kita generate sendiri di sini: mulai dari hari ini, mundur
// satu hari per index, sepanjang jumlah data yang diterima dari API.
function generateTanggalMundur(jumlahHari) {
  const hasil = [];
  const hariIni = new Date();

  for (let i = jumlahHari - 1; i >= 0; i--) {
    const tgl = new Date(hariIni);
    tgl.setDate(hariIni.getDate() - i);
    hasil.push(toISODate(tgl));
  }

  return hasil; // urutan: terlama -> terbaru, sama seperti urutan array "close"
}

async function fetchRealRates() {
  const url = `/api/projects/Simulasi-perkuat-Rupiah`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`API lokal merespons status ${res.status}`);
  }

  const data = await res.json();

  // Validasi bentuk data baru: harus ada field "close" berupa array berisi data.
  if (!Array.isArray(data.close) || data.close.length === 0) {
    throw new Error('Data kosong atau format tidak sesuai (field "close" tidak ditemukan)');
  }

  // Nilai dari Apps Script masih berbentuk STRING (mis. "17987.3"), jadi
  // di-parse dulu jadi number di sini sebelum dipakai untuk kalkulasi chart.
  const points = data.close.map(Number);

  // Cek kalau ada nilai yang gagal di-parse (NaN), lebih baik gagal early
  // dengan pesan jelas daripada bikin chart-nya rusak diam-diam.
  if (points.some((v) => Number.isNaN(v))) {
    throw new Error('Salah satu nilai "close" tidak valid (bukan angka)');
  }

  const dates = generateTanggalMundur(points.length);

  return { points, dates };
}

/* ======================================================================
   BAGIAN 2: RENDER CHART SVG 
   ====================================================================== */

const chartLeft = 52, chartRight = 470, chartTop = 20, chartBottom = 230;

function scaleX(i, totalPoints) {
  return chartLeft + (i / (totalPoints - 1)) * (chartRight - chartLeft);
}

function scaleY(v, minVal, maxVal) {
  return chartBottom - ((v - minVal) / (maxVal - minVal)) * (chartBottom - chartTop);
}

function renderChart(points, dates) {
  const areaPath = document.getElementById('areaPath');
  const linePath = document.getElementById('linePath');
  const lastDot  = document.getElementById('lastDot');

  const rawMin = Math.min(...points);
  const rawMax = Math.max(...points);
  const padding = (rawMax - rawMin) * 0.1 || rawMax * 0.01; 
  const minVal = rawMin - padding;
  const maxVal = rawMax + padding;

  let linePathD = '';
  points.forEach((v, i) => {
    const x = scaleX(i, points.length);
    const y = scaleY(v, minVal, maxVal);
    linePathD += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
  });
  linePath.setAttribute('d', linePathD.trim());

  const areaPathD = linePathD.trim()
    + ` L${scaleX(points.length - 1, points.length).toFixed(1)},${chartBottom}`
    + ` L${scaleX(0, points.length).toFixed(1)},${chartBottom} Z`;
  areaPath.setAttribute('d', areaPathD);

  const lastX = scaleX(points.length - 1, points.length);
  const lastY = scaleY(points[points.length - 1], minVal, maxVal);
  lastDot.setAttribute('cx', lastX);
  lastDot.setAttribute('cy', lastY);

  const yLabelIds = ['yLabel0', 'yLabel1', 'yLabel2', 'yLabel3'];
  yLabelIds.forEach((id, i) => {
    const value = minVal + (i / (yLabelIds.length - 1)) * (maxVal - minVal);
    const el = document.getElementById(id);
    if (el) el.textContent = Math.round(value).toLocaleString('id-ID');
  });

  const xStartEl = document.getElementById('xLabelStart');
  const xEndEl   = document.getElementById('xLabelEnd');
  if (xStartEl) xStartEl.textContent = formatTanggalPendek(dates[0]);
  if (xEndEl)   xEndEl.textContent   = formatTanggalPendek(dates[dates.length - 1]);

  const lastValue = points[points.length - 1];
  const conversionValueEl = document.getElementById('conversionValue');
  const idrInputEl = document.getElementById('idrInput');
  if (conversionValueEl) conversionValueEl.textContent = formatRupiah(lastValue);
  if (idrInputEl) idrInputEl.value = formatRupiah(lastValue);

  const lastUpdatedEl = document.getElementById('lastUpdated');
  if (lastUpdatedEl) {
    const now = new Date();
    const jam = now.getUTCHours().toString().padStart(2, '0');
    const menit = now.getUTCMinutes().toString().padStart(2, '0');
    lastUpdatedEl.textContent = `${formatTanggalPendek(dates[dates.length - 1])}, ${jam}.${menit} UTC`;
  }
}

// Menampilkan status fetch (sukses/gagal) langsung di elemen #lastUpdated,
// supaya user tidak perlu buka DevTools Console untuk tahu data live
// berhasil ter-update atau tidak.
function tampilkanStatusFetch(pesan, statusError) {
  const lastUpdatedEl = document.getElementById('lastUpdated');
  if (!lastUpdatedEl) return;
  lastUpdatedEl.textContent = pesan;
  lastUpdatedEl.style.color = statusError ? '#d93025' : ''; // merah kalau error, default kalau normal
}

async function initChart() {
  try {
    const { points, dates } = await fetchRealRates();
    renderChart(points, dates);
    console.info('[Chart] Live update berhasil dari /api');
  } catch (err) {
    // Sekarang error juga ditampilkan di UI (bukan cuma console.error),
    // supaya jelas kelihatan kalau data yang tampil BUKAN data live terbaru.
    console.error('[Chart] Gagal fetch data real. Detail Error:', err.message);
    tampilkanStatusFetch('Gagal memuat data live, coba muat ulang', true);
  }
}

/* ======================================================================
   BAGIAN 3 & 4: PANEL AKUN & UPLOAD
   ====================================================================== */
function initAccountPanel() {
  const avatarBtn = document.getElementById('avatarBtn');
  const accountPanel = document.getElementById('accountPanel');
  if(avatarBtn && accountPanel) {
      avatarBtn.addEventListener('click', (e) => { e.stopPropagation(); accountPanel.classList.toggle('open'); });
      document.addEventListener('click', (e) => { if (!accountPanel.contains(e.target) && e.target !== avatarBtn) accountPanel.classList.remove('open'); });
  }
}

function initAvatarUpload() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const avatarPreview = document.getElementById('avatarPreview'); 
  const avatarImg = document.getElementById('avatarImg');     

  function applyAvatarFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const objectUrl = URL.createObjectURL(file);
    avatarPreview.src = objectUrl;
    avatarImg.src = objectUrl;
  }

  if(uploadBtn && dropZone && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => { if (fileInput.files && fileInput.files[0]) applyAvatarFile(fileInput.files[0]); });
  }
}

/* ======================================================================
   BAGIAN 5: TOMBOL BAGIKAN (Modal Custom, sama di HP maupun Desktop)
   ====================================================================== */

/**
 * Handler saat tombol "Bagikan" (id: shareContentBtn) diklik.
 *
 * CATATAN PERUBAHAN: sebelumnya di sini ada percabangan native share
 * (navigator.share) khusus HP vs modal khusus desktop. Sekarang
 * disederhanakan jadi SATU perilaku untuk semua device -> selalu buka
 * modal custom. Beda tampilan HP vs desktop cukup diatur lewat CSS
 * (ukuran/padding modal di media query), bukan lewat JS lagi. Ini
 * dipilih karena deteksi device via matchMedia/navigator.share ternyata
 * gak selalu konsisten hasilnya di semua browser/emulator.
 */
/**
 * Handler saat tombol "Bagikan" (id: shareContentBtn) diklik.
 *
 * Logika disesuaikan berdasarkan ukuran layar (maks 820px).
 */
function handleShareClick() {
  // Mengecek apakah lebar layar 820px atau lebih kecil (tampilan HP)
  if (window.innerWidth <= 820 &&navigator.share) {
    // Layar HP: gunakan navigator.share
    navigator.share({
      title: 'Kurs Dolar ke Rupiah',
      text: 'Cek konversi Dolar ke Rupiah terbaru hari ini!',
      url: 'https://labsyadidera-beta.vercel.app/projects/USD-to-RP/' // Sesuai dengan permintaan
    }).catch((err) => console.error('[Share] Batal atau gagal membagikan:', err));
  } else {
    // Layar Desktop (> 820px): buka modal custom
    openShareModal();
  }
}

function openShareModal() {
  const overlay = document.getElementById('shareModalOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeShareModal() {
  const overlay = document.getElementById('shareModalOverlay');
  if (overlay) overlay.classList.remove('open');
}

/**
 * Menyalin isi field link ke clipboard, dengan fallback manual kalau
 * navigator.clipboard tidak tersedia (misal dibuka lewat protokol file://
 * atau di browser lama yang belum support Clipboard API).
 */
async function copyShareLink() {
  const shareLinkInput = document.getElementById('shareLinkInput');
  const copyBtn = document.getElementById('shareCopyBtn');
  const copyLabel = document.getElementById('shareCopyLabel');
  if (!shareLinkInput) return;

  const textToCopy = shareLinkInput.value;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
    } else {
      // Fallback lama: select teks di input lalu document.execCommand.
      shareLinkInput.removeAttribute('readonly');
      shareLinkInput.select();
      shareLinkInput.setSelectionRange(0, textToCopy.length);
      document.execCommand('copy');
      shareLinkInput.setAttribute('readonly', true);
    }

    // Feedback visual sederhana: label & style tombol berubah sebentar.
    if (copyBtn && copyLabel) {
      const originalLabel = copyLabel.textContent;
      copyLabel.textContent = 'Tersalin!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyLabel.textContent = originalLabel;
        copyBtn.classList.remove('copied');
      }, 1800);
    }
  } catch (err) {
    console.error('[Share] Gagal menyalin link ke clipboard:', err);
  }
}

function initShareModal() {
  const shareBtn = document.getElementById('shareContentBtn');
  const overlay = document.getElementById('shareModalOverlay');
  const closeBtn = document.getElementById('shareModalClose');
  const copyBtn = document.getElementById('shareCopyBtn');

  if (shareBtn) shareBtn.addEventListener('click', handleShareClick);
  if (closeBtn) closeBtn.addEventListener('click', closeShareModal);
  if (copyBtn) copyBtn.addEventListener('click', copyShareLink);

  // Klik area gelap di luar card (overlay) juga harus nutup modal,
  // tapi klik DI DALAM card (event.target === card) jangan ikut nutup.
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeShareModal();
    });
  }

  // UX tambahan: tombol Escape juga bisa nutup modal.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeShareModal();
  });
}

/* ======================================================================
   INIT SEMUA + POLLING TERUS MENERUS
   ====================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initChart(); // Tarikan data pertama kali
  initAccountPanel();
  initAvatarUpload();
  initShareModal();

  // Terus-menerus mengambil data setiap 600.000 ms (10 menit)
  setInterval(initChart, 600000); 
});