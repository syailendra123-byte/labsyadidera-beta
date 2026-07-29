// ============================================
// ENDPOINT: /api/projects
// ============================================
// Fungsi: Scan folder public/projects/ secara real-time,
// terus balikin daftar semua proyek yang ketemu di situ.
// Endpoint ini DILINDUNGI login, jadi cuma user yang udah
// login yang bisa liat daftar proyeknya.

import fs from "fs";
import path from "path";
import { verifySession } from "../lib/verifySession.js";

export default function handler(req, res) {
  // Cek dulu, harus login buat liat daftar proyek
  const user = verifySession(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Lokasi folder projects di dalam struktur deploy Vercel
  const projectsDir = path.join(process.cwd(), "public", "projects");

  // Kalau foldernya belum pernah dibuat sama sekali, balikin array kosong
  // (biar gak error pas fs.readdirSync dipanggil ke folder yang gak ada)
  if (!fs.existsSync(projectsDir)) {
    return res.status(200).json({ projects: [] });
  }

  // Baca semua item di dalam public/projects/, filter cuma yang FOLDER
  // (withFileTypes: true biar kita dapet info tipe tiap item)
  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory());

  // Untuk tiap folder, cek apakah ada index.html (syarat wajib biar valid)
  // dan coba baca meta.json kalau ada, buat dapet judul/deskripsi custom
  const projects = folders
    .filter((folder) => {
      const indexPath = path.join(projectsDir, folder.name, "index.html");
      return fs.existsSync(indexPath); // skip folder yang gak ada index.html-nya
    })
    .map((folder) => {
      const metaPath = path.join(projectsDir, folder.name, "meta.json");
      let meta = { title: folder.name, description: "", tag: "Project" };

      if (fs.existsSync(metaPath)) {
        try {
          const raw = fs.readFileSync(metaPath, "utf-8");
          meta = { ...meta, ...JSON.parse(raw) };
        } catch (err) {
          // Kalau meta.json ada tapi formatnya rusak, ya udah pakai default aja
          console.error(`meta.json rusak di folder ${folder.name}:`, err);
        }
      }

      return {
        slug: folder.name, // dipakai buat bentuk URL: /projects/<slug>
        title: meta.title,
        description: meta.description,
        tag: meta.tag,
      };
    });

  return res.status(200).json({ projects });
}