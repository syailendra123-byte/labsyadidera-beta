// ============================================
// ENDPOINT: /api/me
// ============================================
// Fungsi: Dipanggil dari halaman frontend buat ngecek
// "user ini siapa, dan udah login belum?"

import { verifySession } from "../lib/verifySession.js";

export default function handler(req, res) {
  const user = verifySession(req);

  if (!user) {
    // Belum login -> balikin status 401 (Unauthorized)
    return res.status(401).json({ loggedIn: false });
  }

  // Udah login -> balikin data profil (aman, gak ada data sensitif)
  return res.status(200).json({ loggedIn: true, user });
}
