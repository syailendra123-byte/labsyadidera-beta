// ============================================
// ENDPOINT: /api/auth/logout
// ============================================
// Fungsi: Hapus cookie session, jadi user dianggap logout

import { serialize } from "cookie";

export default function handler(req, res) {
  // Trik hapus cookie: kirim cookie dengan nama sama,
  // tapi maxAge: -1 (langsung expired) dan value kosong
  const cookie = serialize("session_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: -1,
  });

  res.setHeader("Set-Cookie", cookie);
  res.redirect(302, "/");
}
