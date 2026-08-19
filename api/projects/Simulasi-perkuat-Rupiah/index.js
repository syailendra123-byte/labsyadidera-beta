export default async function handler(req, res) {
  // GANTI dengan URL Aplikasi Web (Web App) Google Apps Script Anda
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzjhAg3VmRTeYdS4BPWa22rrYkePh-YzR_Q0tSHcIdW_nK9ZLcn_9wDmqI8T-C0pDxH/exec";

  try {
    // PENTING: kirim header Accept + User-Agent supaya Google Apps Script
    // tidak mem-perlakukan request ini sebagai request browser biasa yang
    // butuh sesi login. Ini juga membantu kalau ada proxy/CDN di antara
    // yang mengecek header sebelum meneruskan request.
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "GET",
      redirect: "follow", // Apps Script /exec sering redirect ke script.googleusercontent.com, wajib diikuti
      headers: {
        "Accept": "application/json",
      },
    });

    // Ambil body sebagai TEXT dulu (bukan langsung .json()).
    // Alasannya: kalau deployment Apps Script salah setting akses
    // (misal "Anyone with Google account"), Google akan membalas
    // dengan halaman HTML login, bukan JSON. Kalau kita langsung
    // panggil .json(), errornya jadi generic "Unexpected token <"
    // yang membingungkan buat di-debug.
    const rawText = await response.text();

    // Deteksi dini: kalau body-nya diawali tag HTML, hampir pasti itu
    // halaman login/error dari Google, bukan hasil script kita.
    const looksLikeHtml = rawText.trim().startsWith("<");

    if (!response.ok || looksLikeHtml) {
      console.error(
        "API Error: Respons dari Google Script bukan JSON valid.",
        "Status:", response.status,
        "Cuplikan body:", rawText.slice(0, 300)
      );

      return res.status(502).json({
        error: "Google Apps Script tidak mengembalikan data JSON yang valid.",
        kemungkinan_penyebab: looksLikeHtml
          ? "Deployment Apps Script kemungkinan diset ke 'Anyone with Google account'. Ubah ke 'Anyone' di Deploy > Manage deployments."
          : `Google Script merespons dengan status ${response.status}.`,
      });
    }

    // Baru di sini kita parse JSON-nya, setelah yakin bentuknya benar.
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error("API Error: Gagal parse JSON.", parseError.message, "Body:", rawText.slice(0, 300));
      return res.status(502).json({ error: "Format data dari Google Script tidak sesuai (bukan JSON)." });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    // s-maxage=600 artinya Vercel akan menyimpan data (cache) selama 10 menit
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');

    res.status(200).json(data);
  } catch (error) {
    // Ini menangkap error jaringan (fetch gagal total, timeout, dsb),
    // bukan error dari respons Google Script yang sudah ditangani di atas.
    console.error("API Error (network):", error.message);
    res.status(500).json({ error: "Gagal menghubungi Google Apps Script.", detail: error.message });
  }
}