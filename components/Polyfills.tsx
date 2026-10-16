"use client";
// components/Polyfills.tsx
// crypto.randomUUID only exists on secure pages (https, or localhost), so
// the game crashed when opened from a phone on the local network
// (http://192.168.x.x:3000). Fill it in from getRandomValues, which works
// everywhere. Runs as soon as the client code loads.

if (typeof window !== "undefined" && window.crypto && !window.crypto.randomUUID) {
  window.crypto.randomUUID = (() => {
    const b = window.crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }) as Crypto["randomUUID"];
}

export default function Polyfills() {
  return null;
}
