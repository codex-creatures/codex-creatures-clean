// app/manifest.ts
// Web-app manifest: lets the game be installed to a phone's home screen and
// open full-screen in portrait, like a native app.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Codex Creatures",
    short_name: "Codex",
    description: "Scan barcodes to discover creatures and loot.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0c11",
    theme_color: "#0b0c11",
  };
}
