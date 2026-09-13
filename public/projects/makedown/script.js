/* ==========================================================================
   MARKITDOWN — script.js
   Semua konversi jalan 100% di browser (client-side). Gak ada fetch() ke
   server manapun buat proses file-nya, jadi aman buat dokumen sensitif.
   ========================================================================== */

// PDF.js butuh worker terpisah biar parsing-nya gak nge-block main thread.
// Harus disamain versinya sama <script> yang di-load di index.html.
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

/* ========================================================================
   BAGIAN 1: ROUTER — nentuin converter mana yang dipanggil berdasarkan
   ekstensi file. Ini "otak" dari markitdown, mirip fungsi utama di
   package markitdown Python-nya Microsoft, cuma versi browser.
   ======================================================================== */
async function convertFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  switch (ext) {
    case "docx":
      return await convertDocx(file);
    case "pdf":
      return await convertPdf(file);
    case "xlsx":
    case "xls":
      return await convertExcel(file);
    case "pptx":
      return await convertPptx(file);
    case "txt":
      return await convertPlainText(file);
    case "html":
    case "htm":
      return await convertHtml(file);
    case "json":
      return await convertJson(file);
    default:
      // .doc lama (bukan .docx) & .ppt lama gak bisa diparse murni di browser
      // (formatnya biner lama, beda struktur sama .docx/.pptx yang basically zip+xml)
      throw new Error(
        `Format ".${ext}" belum didukung. Kalau ini file Word/PowerPoint lama ` +
        `(.doc / .ppt), coba "Save As" dulu ke .docx / .pptx.`
      );
  }
}

/* ========================================================================
   BAGIAN 2: CONVERTER — WORD (.docx)
   Strategi: mammoth.js baca .docx jadi HTML dulu (biar heading, list, bold,
   tabel ke-detect strukturnya), baru HTML itu diubah ke Markdown pakai
   turndown. Kalau langsung extract raw text, semua formatting ilang.
   ======================================================================== */
async function convertDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  const turndownService = new TurndownService({
    headingStyle: "atx",       // heading pakai "# " bukan underline
    codeBlockStyle: "fenced",  // code block pakai ``` bukan indent
    bulletListMarker: "-",
  });

  return turndownService.turndown(result.value).trim();
}

/* ========================================================================
   BAGIAN 3: CONVERTER — HTML (.html)
   Paling sederhana: tinggal lempar isi file mentah-mentah ke turndown.
   ======================================================================== */
async function convertHtml(file) {
  const htmlText = await file.text();
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  return turndownService.turndown(htmlText).trim();
}

/* ========================================================================
   BAGIAN 4: CONVERTER — PLAIN TEXT (.txt)
   Gak ada yang perlu dikonversi, teks polos ya emang udah "markdown valid"
   (markdown itu superset dari plain text). Cuma dirapihin whitespace-nya.
   ======================================================================== */
async function convertPlainText(file) {
  const text = await file.text();
  return text.trim();
}

/* ========================================================================
   BAGIAN 5: CONVERTER — JSON (.json)
   Dua mode:
   1. Kalau isinya array of object rata (misal hasil export DB/API) ->
      diubah jadi tabel Markdown, lebih enak dibaca.
   2. Selain itu (nested object, array campuran, dst) -> di-pretty-print
      aja dalam fenced code block ```json, biar strukturnya tetep valid.
   ======================================================================== */
async function convertJson(file) {
  const raw = await file.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`File JSON gak valid / rusak: ${err.message}`);
  }

  const isFlatObjectArray =
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(
      (item) => item !== null && typeof item === "object" && !Array.isArray(item)
    );

  if (isFlatObjectArray) {
    return jsonArrayToMarkdownTable(data);
  }

  return "```json\n" + JSON.stringify(data, null, 2) + "\n```";
}

// Helper: ubah array of object jadi tabel Markdown.
// Kolom diambil dari GABUNGAN semua key yang ada (jaga-jaga kalau ada
// object yang field-nya beda-beda / gak konsisten).
function jsonArrayToMarkdownTable(arr) {
  const columns = [...new Set(arr.flatMap((obj) => Object.keys(obj)))];

  const escapeCell = (val) => {
    if (val === undefined || val === null) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    // Karakter "|" dan newline harus di-escape/dihilangin biar tabel gak rusak
    return str.replace(/\|/g, "\\|").replace(/\n/g, " ");
  };

  let md = `| ${columns.join(" | ")} |\n`;
  md += `| ${columns.map(() => "---").join(" | ")} |\n`;

  for (const row of arr) {
    md += `| ${columns.map((col) => escapeCell(row[col])).join(" | ")} |\n`;
  }

  return md.trim();
}

/* ========================================================================
   BAGIAN 6: CONVERTER — EXCEL (.xlsx / .xls)
   Pakai SheetJS. Tiap sheet di-render jadi heading "## NamaSheet" + tabel
   Markdown terpisah, biar kalau workbook-nya multi-sheet tetep jelas
   batasnya.
   ======================================================================== */
async function convertExcel(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const sections = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    // header: 1 -> hasilnya array-of-array (baris demi baris), bukan
    // array-of-object. Lebih gampang di-mapping jadi tabel Markdown apa
    // adanya, termasuk kalau ada baris header yang aneh/kosong.
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    if (rows.length === 0) continue;

    const header = rows[0].map((h) => String(h ?? "").trim() || " ");
    let sheetMd = `## ${sheetName}\n\n`;
    sheetMd += `| ${header.join(" | ")} |\n`;
    sheetMd += `| ${header.map(() => "---").join(" | ")} |\n`;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = header.map((_, colIdx) =>
        String(row[colIdx] ?? "").replace(/\|/g, "\\|")
      );
      sheetMd += `| ${cells.join(" | ")} |\n`;
    }

    sections.push(sheetMd.trim());
  }

  if (sections.length === 0) {
    throw new Error("File Excel-nya kedetect kosong (gak ada baris data).");
  }

  return sections.join("\n\n");
}

/* ========================================================================
   BAGIAN 7: CONVERTER — POWERPOINT (.pptx)
   .pptx itu sebenernya file ZIP berisi XML per slide (ppt/slides/slideN.xml).
   Jadi strateginya: buka pakai JSZip, ambil tiap slideN.xml, parse XML-nya,
   terus tarik semua teks yang ada di dalam tag <a:t> (text run PowerPoint).
   Ini gak nangkep gambar/layout, tapi cukup buat ambil ISI teksnya.
   ======================================================================== */
async function convertPptx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Cari semua file slide, terus urutin berdasarkan nomornya (slide1, slide2, ...)
  // soalnya Object.keys() dari zip gak jamin urutannya bener.
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    throw new Error("Gak ketemu slide di dalam file .pptx ini (mungkin file-nya corrupt).");
  }

  const parser = new DOMParser();
  const slideSections = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xmlText = await zip.files[slideFiles[i]].async("text");
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");

    // Semua teks di slide PowerPoint disimpen di tag <a:t> (text run).
    // getElementsByTagNameNS lebih aman daripada getElementsByTagName biasa
    // buat XML yang pakai namespace kayak gini.
    const textNodes = xmlDoc.getElementsByTagNameNS(
      "http://schemas.openxmlformats.org/drawingml/2006/main",
      "t"
    );

    const texts = Array.from(textNodes)
      .map((node) => node.textContent.trim())
      .filter((t) => t.length > 0);

    let slideMd = `## Slide ${i + 1}\n\n`;
    slideMd += texts.length > 0
      ? texts.map((t) => `- ${t}`).join("\n")
      : "_(slide ini gak ada teksnya — mungkin cuma gambar/chart)_";

    slideSections.push(slideMd);
  }

  return slideSections.join("\n\n");
}

/* ========================================================================
   BAGIAN 8: CONVERTER — PDF (.pdf)
   Pakai pdf.js buat extract teks per halaman. Catatan: ini cuma narik
   teksnya doang (gak ada heading/bold detection), soalnya PDF emang gak
   nyimpen struktur dokumen kayak Word — cuma posisi teks di kanvas.
   ======================================================================== */
async function convertPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageSections = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Gabungin semua "item" teks jadi satu string per halaman.
    // pdf.js motong teks jadi potongan-potongan kecil (per text-run),
    // jadi digabung pakai spasi biar kebaca normal.
    const pageText = textContent.items.map((item) => item.str).join(" ");

    pageSections.push(`## Halaman ${pageNum}\n\n${pageText.trim()}`);
  }

  return pageSections.join("\n\n");
}

/* ========================================================================
   BAGIAN 9: UI — drag & drop, render hasil, copy & download
   ======================================================================== */
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const resultsEl = document.getElementById("results");
const emptyHint = document.getElementById("emptyHint");

let fileCounter = 0; // dipake buat bikin id unik tiap card hasil

// --- Klik dropzone -> buka file picker ---
dropzone.addEventListener("click", () => fileInput.click());

// --- Drag & drop events ---
["dragenter", "dragover"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("drag-over");
  });
});
["dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("drag-over");
  });
});
dropzone.addEventListener("drop", (e) => {
  const files = e.dataTransfer.files;
  if (files && files.length > 0) handleFiles(files);
});

// --- Pilih file lewat dialog biasa ---
fileInput.addEventListener("change", () => {
  if (fileInput.files && fileInput.files.length > 0) {
    handleFiles(fileInput.files);
    fileInput.value = ""; // reset biar bisa pilih file yang sama lagi kalau perlu
  }
});

/**
 * Proses banyak file sekaligus. Tiap file punya card sendiri di UI,
 * dan diproses secara PARALEL (Promise per file jalan independen),
 * jadi file yang gede gak nge-block file lain yang lebih kecil.
 */
function handleFiles(fileList) {
  emptyHint.style.display = "none";

  Array.from(fileList).forEach((file) => {
    const cardId = `result-${++fileCounter}`;
    renderPendingCard(file, cardId);
    processOneFile(file, cardId);
  });
}

async function processOneFile(file, cardId) {
  try {
    const markdown = await convertFile(file);
    updateCardSuccess(cardId, markdown);
  } catch (err) {
    console.error(`[Markitdown] Gagal convert "${file.name}":`, err);
    updateCardError(cardId, err.message || "Terjadi error gak terduga.");
  }
}

// --- Render card awal (status: memproses...) ---
function renderPendingCard(file, cardId) {
  const ext = file.name.split(".").pop().toUpperCase();

  const card = document.createElement("div");
  card.className = "result-card";
  card.id = cardId;
  card.innerHTML = `
    <div class="result-head">
      <div class="result-file">
        <span class="file-ext">${ext}</span>
        <span class="file-name">${escapeHtml(file.name)}</span>
      </div>
      <div class="result-status processing">
        <span class="spinner"></span> memproses...
      </div>
    </div>
    <div class="result-body"></div>
  `;
  resultsEl.prepend(card); // file terbaru muncul paling atas
}

// --- Update card jadi "selesai" + tampilin hasil markdown ---
function updateCardSuccess(cardId, markdown) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const statusEl = card.querySelector(".result-status");
  statusEl.className = "result-status done";
  statusEl.innerHTML = "✓ selesai";

  const bodyEl = card.querySelector(".result-body");
  bodyEl.innerHTML = `
    <div class="result-toolbar">
      <button class="btn-mini btn-copy">Copy Markdown</button>
      <button class="btn-mini btn-download">Download .md</button>
    </div>
    <textarea class="result-output" readonly spellcheck="false"></textarea>
  `;
  bodyEl.querySelector(".result-output").value = markdown;

  // Klik header buat expand/collapse hasilnya
  card.querySelector(".result-head").addEventListener("click", () => {
    bodyEl.classList.toggle("open");
  });
  bodyEl.classList.add("open"); // langsung kebuka pas pertama selesai

  // Tombol copy ke clipboard
  const copyBtn = bodyEl.querySelector(".btn-copy");
  copyBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(markdown);
    copyBtn.textContent = "Ke-copy! ✓";
    copyBtn.classList.add("copied");
    setTimeout(() => {
      copyBtn.textContent = "Copy Markdown";
      copyBtn.classList.remove("copied");
    }, 1800);
  });

  // Tombol download sebagai file .md
  const downloadBtn = bodyEl.querySelector(".btn-download");
  downloadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const originalName = card.querySelector(".file-name").textContent;
    const baseName = originalName.replace(/\.[^/.]+$/, ""); // buang ekstensi asli
    downloadAsFile(`${baseName}.md`, markdown);
  });
}

// --- Update card jadi "error" ---
function updateCardError(cardId, message) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const statusEl = card.querySelector(".result-status");
  statusEl.className = "result-status error";
  statusEl.innerHTML = "✕ gagal";

  const bodyEl = card.querySelector(".result-body");
  bodyEl.innerHTML = `<div class="result-toolbar" style="color:var(--danger); font-family:var(--font-mono); font-size:12.5px; padding:14px 18px;">${escapeHtml(message)}</div>`;
  bodyEl.classList.add("open");

  card.querySelector(".result-head").addEventListener("click", () => {
    bodyEl.classList.toggle("open");
  });
}

// --- Helper: trigger download file text di browser (tanpa server) ---
function downloadAsFile(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Helper: escape HTML biar nama file yang aneh-aneh gak jadi XSS vector ---
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
