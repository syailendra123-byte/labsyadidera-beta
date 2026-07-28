// ============================================
// ENDPOINT: /api/auth/login
// ============================================
// Fungsi: Redirect user ke halaman login Google
// Ini langkah PERTAMA dari alur OAuth (belum ada data user di sini)

export default function handler(req, res) {
  // Ambil credential dari environment variable (BUKAN hardcode di kode!)
  // process.env.XXX ini otomatis dibaca Vercel dari Environment Variables
  // yang lo set di dashboard, jadi aman walau kode ini public di GitHub
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const APP_URL = process.env.APP_URL;

  // redirect_uri = URL yang Google bakal panggil balik setelah user login sukses
  // Ini HARUS sama persis dengan yang didaftarin di Google Cloud Console
  const redirectUri = `${APP_URL}/api/auth/callback`;

  // Susun parameter query buat URL OAuth Google
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code", // minta "authorization code", bukan token langsung (lebih aman)
    scope: "openid email profile", // data apa aja yang kita minta dari akun Google user
    prompt: "select_account", // supaya user selalu bisa milih akun, gak auto-login akun terakhir
  });

  // URL resmi endpoint OAuth Google
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // Lempar user ke halaman login Google
  res.redirect(302, googleAuthUrl);
}
