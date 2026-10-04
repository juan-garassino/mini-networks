import os from "node:os";
import type { NextConfig } from "next";

// This Mac's private IPv4 addresses, read when the dev server starts: the dev
// server only lets its own host load dev resources (HMR, RSC), so pages opened
// at http://<lan-ip>:3000 (or a per-UI port, scripts/ports.mjs) from the
// owner's phone would never hydrate without them. Follows the Mac between
// networks (home Wi-Fi, phone hotspot) on each restart.
const lanHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === "IPv4" && !a.internal)
  .map((a) => a.address);

// Static export — FastAPI serves the built `out/` at /. No Node at runtime.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  devIndicators: false,
  allowedDevOrigins: lanHosts,
};

export default nextConfig;
