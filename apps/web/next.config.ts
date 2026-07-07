import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained production server at `.next/standalone` (with its own
  // minimal `server.js` and only the traced node_modules) so the Docker runner
  // image can ship the build output alone and start via `node server.js`.
  output: "standalone",
};

export default nextConfig;
