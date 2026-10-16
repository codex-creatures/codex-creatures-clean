import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Pixelify_Sans } from "next/font/google";
import "./globals.css";
import EscapeBack from "@/components/EscapeBack";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Headings, labels and buttons in the dungeon style.
const pixel = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
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
      <body className={`${geistSans.variable} ${geistMono.variable} ${pixel.variable}`}>
        <EscapeBack />
        {children}
      </body>
    </html>
  );
}
