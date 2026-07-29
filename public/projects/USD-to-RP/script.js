/* ======================================================================
   BAGIAN 1: AMBIL DATA KURS USD -> IDR (Frankfurter API + fallback)
   ====================================================================== */

/*
  Data dummy ini FALLBACK doang -- dipakai kalau fetch ke API gagal
  (misal: internet putus, API down, atau di-block CORS/network).
  Bentuknya sama kayak sebelumnya, cuma sekarang statusnya "cadangan",
  bukan data utama lagi.
*/
const FALLBACK_POINTS = [
  18010, 17960, 17820, 17780, 17740, 17870, 17830, 17800,
  17820, 17920, 17960, 17900, 17870, 17960, 17930, 17960,
  18000, 17910, 17960, 18010, 18050, 17980, 18040, 18060,
  18090, 18130, 18090, 18160
];

// Nama bulan Indonesia, dipakai buat format label tanggal ("19 Jun", dst)
const BULAN_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

/**
 * Format tanggal "YYYY-MM-DD" jadi label pendek ala Google, misal "19 Jun".
 * @param {string} isoDate - tanggal format ISO (YYYY-MM-DD)
 * @returns {string}
 */
function formatTanggalPendek(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${BULAN_ID[month - 1]}`;
}

/**
 * Format angka jadi format Rupiah ala Indonesia: "18.105,05"
 * (titik buat ribuan, koma buat desimal).
 * @param {number} value
 * @returns {string}
 */
function formatRupiah(value) {
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Ambil histori kurs USD -> IDR 30 hari terakhir dari Frankfurter API.
 * Frankfurter gratis, gak perlu API key, dan CORS-friendly buat dipanggil
 * langsung dari browser (client-side fetch).
 *
 * @returns {Promise<{points: number[], dates: string[]}>}
 * @throws akan throw error kalau fetch gagal / response gak valid,
 *         supaya bisa ditangkap try-catch di initChart() dan pindah ke fallback.
 */
async function fetchRealRates() {
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);

  const startDateObj = new Date(today);
  startDateObj.setDate(startDateObj.getDate() - 30);
  const startDate = startDateObj.toISOString().slice(0, 10);

  const url = `https://api.frankfurter.app/${startDate}..${endDate}?from=USD&to=IDR`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Frankfurter API merespons status ${res.status}`);
  }

  const data = await res.json();

  // data.rates itu object: { "2026-06-25": { IDR: 17820 }, "2026-06-26": {...}, ... }
  // Object key gak dijamin urut, jadi tanggalnya di-sort dulu secara ascending
  const sortedDates = Object.keys(data.rates).sort();

  if (sortedDates.length === 0) {
    throw new Error('Frankfurter API gak ngembaliin data rates sama sekali');
  }

  const points = sortedDates.map(date => data.rates[date].IDR);

  return { points, dates: sortedDates };
}


/* ======================================================================
   BAGIAN 2: RENDER CHART SVG (garis + area + titik terakhir)
   ====================================================================== */

const chartLeft = 52, chartRight = 470, chartTop = 20, chartBottom = 230;

/**
 * Konversi index titik data (0..n) jadi posisi X di SVG.
 */
function scaleX(i, totalPoints) {
  return chartLeft + (i / (totalPoints - 1)) * (chartRight - chartLeft);
}

/**
 * Konversi nilai kurs jadi posisi Y di SVG.
 * minVal/maxVal sekarang dihitung dinamis dari data asli (bukan hardcode lagi),
 * jadi skala grafiknya otomatis nyesuain berapa pun rentang harganya hari itu.
 */
function scaleY(v, minVal, maxVal) {
  return chartBottom - ((v - minVal) / (maxVal - minVal)) * (chartBottom - chartTop);
}

/**
 * Render chart SVG (garis, area fill, titik terakhir) + update semua label
 * sumbu X (tanggal) dan sumbu Y (harga) berdasarkan data yang dikasih.
 *
 * @param {number[]} points - array nilai kurs berurutan dari lama ke terbaru
 * @param {string[]} dates  - array tanggal ISO, urutan sejajar sama `points`
 */
function renderChart(points, dates) {
  const areaPath = document.getElementById('areaPath');
  const linePath = document.getElementById('linePath');
  const lastDot  = document.getElementById('lastDot');

  // Kasih padding dikit di atas & bawah (2%) biar garis chart gak nempel
  // persis di tepi atas/bawah area SVG-nya
  const rawMin = Math.min(...points);
  const rawMax = Math.max(...points);
  const padding = (rawMax - rawMin) * 0.1 || rawMax * 0.01; // fallback kalau data flat semua
  const minVal = rawMin - padding;
  const maxVal = rawMax + padding;

  // ---- Gambar garis + area ----
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

  // ---- Update label sumbu Y (4 titik harga, dari bawah ke atas) ----
  const yLabelIds = ['yLabel0', 'yLabel1', 'yLabel2', 'yLabel3'];
  yLabelIds.forEach((id, i) => {
    const value = minVal + (i / (yLabelIds.length - 1)) * (maxVal - minVal);
    const el = document.getElementById(id);
    if (el) el.textContent = Math.round(value).toLocaleString('id-ID');
  });

  // ---- Update label sumbu X (tanggal awal & akhir rentang data) ----
  const xStartEl = document.getElementById('xLabelStart');
  const xEndEl   = document.getElementById('xLabelEnd');
  if (xStartEl) xStartEl.textContent = formatTanggalPendek(dates[0]);
  if (xEndEl)   xEndEl.textContent   = formatTanggalPendek(dates[dates.length - 1]);

  // ---- Update angka kurs besar + input IDR biar sinkron sama data terakhir ----
  const lastValue = points[points.length - 1];
  const conversionValueEl = document.getElementById('conversionValue');
  const idrInputEl = document.getElementById('idrInput');
  if (conversionValueEl) conversionValueEl.textContent = formatRupiah(lastValue);
  if (idrInputEl) idrInputEl.value = formatRupiah(lastValue);

  // ---- Update jam terakhir update (waktu render, bukan waktu data API) ----
  const lastUpdatedEl = document.getElementById('lastUpdated');
  if (lastUpdatedEl) {
    const now = new Date();
    const jam = now.getUTCHours().toString().padStart(2, '0');
    const menit = now.getUTCMinutes().toString().padStart(2, '0');
    lastUpdatedEl.textContent = `${formatTanggalPendek(dates[dates.length - 1])}, ${jam}.${menit} UTC`;
  }
}

/**
 * Entry point buat chart: coba ambil data real dulu dari Frankfurter API.
 * Kalau gagal (network error, API down, dll), otomatis pindah ke data
 * fallback biar chart-nya TETEP kegambar (gak blank/kosong).
 */
async function initChart() {
  try {
    const { points, dates } = await fetchRealRates();
    renderChart(points, dates);
    console.info('[Chart] Berhasil pakai data real dari Frankfurter API.');
  } catch (err) {
    // Fallback: generate tanggal dummy 28 hari ke belakang biar label X tetap masuk akal
    console.warn('[Chart] Gagal fetch data real, pakai fallback. Alasan:', err.message);
    const dummyDates = FALLBACK_POINTS.map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (FALLBACK_POINTS.length - 1 - i));
      return d.toISOString().slice(0, 10);
    });
    renderChart(FALLBACK_POINTS, dummyDates);
  }
}


/* ======================================================================
   BAGIAN 3: PANEL AKUN (buka/tutup pas avatar diklik)
   ====================================================================== */

function initAccountPanel() {
  const avatarBtn    = document.getElementById('avatarBtn');
  const accountPanel = document.getElementById('accountPanel');

  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // biar klik avatar gak langsung ke-detect sebagai "klik di luar panel"
    accountPanel.classList.toggle('open');
  });

  // Klik di luar panel -> otomatis nutup panel
  document.addEventListener('click', (e) => {
    if (!accountPanel.contains(e.target) && e.target !== avatarBtn) {
      accountPanel.classList.remove('open');
    }
  });
}


/* ======================================================================
   BAGIAN 4: UPLOAD FOTO AVATAR (klik tombol ATAU drag & drop)
   ====================================================================== */

function initAvatarUpload() {
  const dropZone      = document.getElementById('dropZone');
  const fileInput     = document.getElementById('fileInput');
  const uploadBtn     = document.getElementById('uploadBtn');
  const avatarPreview = document.getElementById('avatarPreview'); // foto besar di dalam panel
  const avatarImg     = document.getElementById('avatarImg');     // foto kecil di pojok kanan atas

  /**
   * Terapkan file gambar yang dipilih/di-drop ke kedua elemen avatar
   * (preview besar di panel + icon kecil di header), pakai object URL
   * biar gak perlu upload ke server (murni preview di browser/client-side).
   * @param {File} file
   */
  function applyAvatarFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('File yang dipilih bukan gambar. Coba pilih file .jpg/.png ya.');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    avatarPreview.src = objectUrl;
    avatarImg.src = objectUrl;
  }

  // ---- Trigger lewat tombol "Upload Foto" atau klik langsung di foto ----
  uploadBtn.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      applyAvatarFile(fileInput.files[0]);
    }
  });

  // ---- Drag & drop langsung ke foto ----
  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) applyAvatarFile(file);
  });
}


/* ======================================================================
   INIT SEMUA
   ====================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initChart();          // fetch data real (atau fallback) + render chart
  initAccountPanel();
  initAvatarUpload();
});