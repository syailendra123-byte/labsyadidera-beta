// ============================================
// ENDPOINT: /api/auth/callback
// ============================================
// Fungsi: Dipanggil OTOMATIS oleh Google setelah user berhasil login.
// Tugas kita di sini: tukar "code" pemberian Google jadi data profil user,
// lalu bikin session (dalam bentuk cookie JWT) supaya user dianggap "sudah login".

import jwt from "jsonwebtoken";
import { serialize } from "cookie";

export default async function handler(req, res) {
  // "code" ini dikirim Google lewat query string, contoh: /api/auth/callback?code=xxxx
  const { code } = req.query;

  // Kalau gak ada code, berarti request ini gak valid / user batal login
  if (!code) {
    return res.status(400).send("Login gagal: kode otorisasi tidak ditemukan.");
  }

  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");
  const redirectUri = `${APP_URL}/api/auth/callback`;

  try {
    // ----------------------------------------
    // LANGKAH 1: Tukar "code" dengan access_token
    // ----------------------------------------
    // Ini request server-to-server (Vercel -> Google), CLIENT_SECRET aman
    // dipakai di sini karena gak pernah terekspos ke browser user
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    // Kalau Google nolak (misal code kadaluarsa/invalid), hentikan proses
    if (!tokenData.access_token) {
      console.error("Gagal ambil access token:", tokenData);
      return res.status(401).send("Login gagal: tidak bisa memverifikasi akun.");
    }

    // ----------------------------------------
    // LANGKAH 2: Pakai access_token buat ambil data profil user
    // ----------------------------------------
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const profile = await profileResponse.json();

    // profile berisi: { id, email, name, picture, ... }
    // Ini data MINIMAL yang kita perlu simpen di session
    const userSession = {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };

    // ----------------------------------------
    // LANGKAH 3: Bikin JWT (token session) dari data user
    // ----------------------------------------
    // JWT ini yang nanti disimpen di cookie browser user.
    // Isinya di-sign pakai SESSION_SECRET, jadi kalau user coba edit
    // manual, signature-nya bakal invalid dan ketauan curang.
    const token = jwt.sign(userSession, process.env.SESSION_SECRET, {
      expiresIn: "7d", // session berlaku 7 hari, setelah itu wajib login ulang
    });

    // ----------------------------------------
    // LANGKAH 4: Simpen JWT ke cookie (httpOnly biar gak bisa diakses JS di browser)
    // ----------------------------------------
    const cookie = serialize("session_token", token, {
      httpOnly: true, // JS di browser gak bisa baca cookie ini -> mencegah XSS curi token
      secure: process.env.NODE_ENV === "production", // cookie cuma dikirim lewat HTTPS di production
      sameSite: "lax", // proteksi dasar dari CSRF
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 hari dalam detik
    });

    res.setHeader("Set-Cookie", cookie);

    // Setelah login sukses, lempar user ke /home (bukan ke "/" lagi)
    // supaya landing page tetep bersih khusus buat yang belum login
    res.redirect(302, "/home");

    // Setelah login sukses, lempar user balik ke halaman utama
    res.redirect(302, "/");
  } catch (error) {
    console.error("Error saat proses callback OAuth:", error);
    res.status(500).send("Terjadi kesalahan server saat login.");
  }
}
