"use client";
// app/lab/chest/page.tsx — 🧪 a draft 3D chest (the user, 2026-11-11), on the game's floor under the
// game's camera, to judge the look before any 3D object goes in the dungeon. Boxes for the shape
// (lib/render3d/chest3d.ts) with plain stand-in surfaces; the old flat chest and you beside it for
// comparison and scale. Nothing is saved, and the game doesn't use it.
// Dev tool: Three.js is loaded on this page only.

import { useState } from "react";
import dynamic from "next/dynamic";
import { CHEST_W } from "@/lib/render3d/chest3d";
import type { ChestView } from "./ChestScene";

const ChestScene = dynamic(() => import("./ChestScene"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });

const SIZES = [1, CHEST_W, 1.5, 1.75];
const ZOOMS = [{ label: "Game zoom", across: 15 }, { label: "Close", across: 7 }];

export default function ChestLab() {
  const [view, setView] = useState<ChestView>({ open: false, across: 15, width: CHEST_W, moving: true, old: true });
  const set = (p: Partial<ChestView>) => setView((v) => ({ ...v, ...p }));
  const btn = (on: boolean) => ({ minHeight: 44, padding: "0 12px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
  return (
    <div style={{ background: "#111", color: "#f1d9a0", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>3D chest draft</h1>
      <div style={{ width: "100%", maxWidth: 480, aspectRatio: "3 / 4" }}>
        <ChestScene view={view} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, maxWidth: 480 }}>
        <button style={btn(view.open)} onClick={() => set({ open: !view.open })}>{view.open ? "Shut" : "Open"}</button>
        <button style={btn(view.moving)} onClick={() => set({ moving: !view.moving })}>Torch {view.moving ? "moving" : "still"}</button>
        <button style={btn(view.old)} onClick={() => set({ old: !view.old })}>Old chest {view.old ? "shown" : "hidden"}</button>
        {ZOOMS.map((z) => <button key={z.across} style={btn(view.across === z.across)} onClick={() => set({ across: z.across })}>{z.label}</button>)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 480, alignItems: "center" }}>
        <span>Width (units):</span>
        {SIZES.map((w) => <button key={w} style={btn(view.width === w)} onClick={() => set({ width: w })}>{w}</button>)}
      </div>
      <p style={{ color: "#a89878", fontSize: 13, maxWidth: 480 }}>
        Shape only: the wood, iron and gold are plain stand-ins. The real surfaces would be PixelLab art
        laid on the same boxes. Lit by a test torch, not yet the game&apos;s own light.
      </p>
    </div>
  );
}
