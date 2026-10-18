import type { NextConfig } from "next";

// `npm run build:offline` makes a static copy of the game in out/ (it all
// runs in the browser), for playing on a laptop with no internet. See
// offline/README.md.
const offline = process.env.OFFLINE_BUILD === "1";

const nextConfig: NextConfig = {
  // Let a phone on the home network load the dev server (http://<this PC's IP>:3000).
  allowedDevOrigins: ["192.168.0.45", "192.168.*.*"],
  ...(offline ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
};

export default nextConfig;
