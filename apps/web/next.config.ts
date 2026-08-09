import type { NextConfig } from "next";

// URL Laravel lokal (Herd). Bisa di-override via env untuk Docker/production.
// Dev default: domain Herd yang di-link untuk apps/api (lihat `herd links`).
const LARAVEL_API_URL =
  process.env.LARAVEL_API_URL ?? "http://velcro-api.test";

const nextConfig: NextConfig = {
  // Emit a self-contained production server at `.next/standalone` (with its own
  // minimal `server.js` and only the traced node_modules) so the Docker runner
  // image can ship the build output alone and start via `node server.js`.
  output: "standalone",

  // Whitelist host yang boleh dipakai next/image untuk load foto produk dari
  // Laravel storage (lihat ProductImageResource::resolveUrl di apps/api —
  // foto hasil upload Filament di-serve dari situ, bukan aset statis Next.js).
  //
  // Domain production (VPS/domain asli Velcro Ethereal) BELUM final — nginx
  // config di docker/nginx/nginx.conf masih pakai `server_name _;` (catch-all)
  // dan tidak ada domain riil tercatat di manapun di repo ini. Pattern kedua
  // (https) perlu ditambahkan terpisah begitu domain production sudah fix,
  // supaya next/image tidak menolak load gambar di production nanti.
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "velcro-api.test",
        pathname: "/storage/**",
      },
    ],
    // `velcro-api.test` resolves to 127.0.0.1 (Herd), dan next/image menolak
    // fetch ke IP privat/loopback secara default (proteksi SSRF) — tanpa ini,
    // remotePatterns di atas lolos tapi requestnya tetap ditolak saat runtime
    // ("resolved to private ip"). Hanya diaktifkan di luar production supaya
    // proteksi SSRF tetap utuh saat domain production (bukan IP privat) nanti
    // dipakai.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },

  // Proxy /api/* ke Laravel supaya dari sisi browser request terlihat
  // same-origin (localhost:3000/api/...), sama seperti nginx reverse proxy di
  // production (Milestone 2) — perilaku dev & prod konsisten. Server Component
  // yang fetch via lib/api.ts memanggil Laravel langsung (lihat lib/api.ts).
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${LARAVEL_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
