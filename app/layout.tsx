import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Pixelify_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import EscapeBack from "@/components/EscapeBack";
import Polyfills from "@/components/Polyfills";
import GameScreen from "@/components/GameScreen";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Headings, labels and buttons in the dungeon style. (globals.css builds
// --font-pixel from this plus the digits below.)
const pixel = Pixelify_Sans({
  variable: "--font-pixelify",
  subsets: ["latin"],
});

// Pixelify's digits are hard to tell apart when small (8 looks like 2), so
// numbers use Silkscreen's clearer ones: this face only covers digits and
// the marks that go with them (% + - / . ,).
const digits = localFont({
  src: "./fonts/Silkscreen-Regular.ttf",
  variable: "--font-digits",
  adjustFontFallback: false, // (its Arial stand-in would catch the letters too)
  declarations: [{ prop: "unicode-range", value: "U+0030-0039, U+0025, U+002B, U+002D, U+002F, U+002E, U+002C" }],
});

export const metadata: Metadata = {
  title: "Codex Creatures",
  description: "Scan barcodes to discover creatures and loot.",
  // Installable on a phone's home screen, full-screen like an app.
  appleWebApp: { capable: true, title: "Codex Creatures", statusBarStyle: "black-translucent" },
};

// Phone-first: edge to edge (content stays inside the notch / home-bar safe
// areas, see globals.css), no pinch-zoom surprises, dark browser chrome.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0c11",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${pixel.variable} ${digits.variable}`}>
        <Polyfills />
        <EscapeBack />
        <GameScreen>{children}</GameScreen>
      </body>
    </html>
  );
}
