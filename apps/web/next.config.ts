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
