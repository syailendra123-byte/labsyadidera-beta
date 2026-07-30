// ============================================
// ROUTING MIDDLEWARE (Vercel)
// ============================================
// File ini jalan SEBELUM request nyampe ke static file atau cache CDN.
// Tugasnya: cegat akses ke /home dan /projects/* kalau session gak valid,
// jadi proteksinya di level SERVER, bukan cuma di JS browser.

import { parse } from "cookie";
import jwt from "jsonwebtoken";
import { next } from "@vercel/functions";

// Runtime WAJIB "nodejs" (bukan default "edge"), soalnya library
// jsonwebtoken butuh modul crypto Node yang gak tersedia di Edge Runtime.
export const config = {
  runtime: "nodejs",
  // :path* biar semua file DI DALAM folder proyek (css, js, gambar, dll)
  // ikut ke-proteksi juga, gak cuma index.html-nya doang
  matcher: ["/home", "/projects/:path*"],
};

export default function middleware(request) {
  // Middleware nerima Fetch API Request standar, jadi ambil cookie
  // lewat request.headers.get("cookie") -- BEDA sama req.headers.cookie
  // yang dipakai di lib/verifySession.js (itu buat serverless function biasa)
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = parse(cookieHeader);
  const token = cookies.session_token;

  if (!token) {
    // Gak ada cookie session sama sekali -> tendang ke landing page
    return Response.redirect(new URL("/", request.url));
  }

  try {
    // Verifikasi signature JWT, logicnya sama persis kayak verifySession.js
    jwt.verify(token, process.env.SESSION_SECRET);
  } catch (err) {
    // Token invalid / kadaluarsa -> tendang juga
    return Response.redirect(new URL("/", request.url));
  }

  // Token valid -> lanjutin request ke tujuan aslinya (file statis proyeknya)
  return next();
}