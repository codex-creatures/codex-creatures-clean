import type { NextConfig } from "next";

// `npm run build:offline` makes a static copy of the game in out/ (it all
// runs in the browser), for playing on a laptop with no internet. See
// offline/README.md.
const offline = process.env.OFFLINE_BUILD === "1";

const nextConfig: NextConfig = {
  ...(offline ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
};

export default nextConfig;
