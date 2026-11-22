# WebScanner

Pemindai dokumen di browser — gratis, tanpa watermark, tanpa server.

**Cara pakai:** buka `index.html` di browser (klik dua kali). Tidak perlu instalasi atau internet.
Kamera bekerja di `https://`, `http://localhost`, dan umumnya di `file://` pada Chrome/Edge.

Semua pemrosesan terjadi di perangkat Anda. Tidak ada data yang disimpan; refresh atau tutup tab menghapus semuanya.

## Catatan teknis
- JavaScript biasa (tanpa build step), skrip klasik agar bisa dibuka langsung dari file.
- `src/vendor/pdf-lib.min.js` — pembuatan PDF.
- Deteksi dokumen (`features/documentDetection.js`) dan koreksi perspektif (`features/perspective.js`) ditulis sendiri dalam JavaScript murni (tanpa jscanify/OpenCV).
