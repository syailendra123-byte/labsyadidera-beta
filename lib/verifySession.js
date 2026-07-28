// ============================================
// HELPER: verifySession
// ============================================
// Fungsi ini dipakai di endpoint mana pun yang butuh proteksi login.
// Cara pakai: import fungsi ini, panggil dengan req, dapat balik data user
// (atau null kalau belum login / session invalid).

import jwt from "jsonwebtoken";
import { parse } from "cookie";

export function verifySession(req) {
  // Ambil semua cookie dari header request, terus parse jadi object
  const cookies = parse(req.headers.cookie || "");
  const token = cookies.session_token;

  // Kalau gak ada cookie session_token sama sekali -> belum login
  if (!token) return null;

  try {
    // Verifikasi signature JWT pakai SESSION_SECRET yang sama waktu bikin token
    // Kalau token udah di-edit/dipalsuin, verify() bakal throw error otomatis
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);
    return decoded; // berisi { email, name, picture }
  } catch (error) {
    // Token invalid atau udah expired -> anggap belum login
    return null;
  }
}
