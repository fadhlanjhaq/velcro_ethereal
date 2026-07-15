import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Gate produksi — mengarahkan seluruh route (main) ke /coming-soon selama
 * situs utama belum "live". BUKAN middleware.ts: Next.js 16 me-rename
 * konvensi ini jadi proxy.ts/`export function proxy` (middleware.ts
 * deprecated, lihat node_modules/next/dist/docs/01-app/02-guides/upgrading/
 * version-16.md — "middleware to proxy"). File ini dibuat sesuai konvensi
 * baru per AGENTS.md ("read the docs before writing code").
 *
 * Gate HANYA aktif saat NODE_ENV production DAN NEXT_PUBLIC_SITE_LIVE belum
 * "true". Cek NODE_ENV disengaja (bukan cuma cek NEXT_PUBLIC_SITE_LIVE) —
 * tanpa itu, `npm run dev` lokal ikut ter-gate secara default (env var
 * tak pernah di-set di dev), padahal dev harian WAJIB tetap bisa akses semua
 * halaman tanpa setup tambahan. `npm run build && npm start` lokal (validasi
 * pra-deploy, lihat Milestone 2) sengaja IKUT ter-gate — env-nya sama seperti
 * production sungguhan, jadi perilaku gate juga harus paritas.
 *
 * Matcher di bawah HANYA mencantumkan route (main) yang perlu di-gate — /info
 * dan /coming-soon sengaja TIDAK termasuk (mencegah redirect loop), begitu
 * juga asset statis (_next/*, favicon, dll) karena memang tidak pernah masuk
 * daftar match, bukan lewat negative-lookahead di seluruh situs.
 */
export function proxy(request: NextRequest) {
  const gateActive =
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_SITE_LIVE !== "true";

  if (gateActive) {
    return NextResponse.redirect(new URL("/coming-soon", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/shop",
    "/shop/:path*",
    "/cart",
    "/checkout",
    "/checkout/:path*",
  ],
};
