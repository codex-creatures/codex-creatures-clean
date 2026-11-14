"use client";
// app/lab/hero/page.tsx — 🧪 a draft 3D you (the user, 2026-11-14), beside the sprite the game draws
// now, walking round on the game's floor under the game's camera, to judge before it goes anywhere
// near the dungeon. Nothing is saved, and the game doesn't use it.
// Dev tool: Three.js is loaded on this page only.

import { useState } from "react";
import dynamic from "next/dynamic";
import type { HeroView, HeroPath } from "./HeroScene";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });

const PATHS: { path: HeroPath; label: string }[] = [{ path: "circle", label: "Walk round" }, { path: "diagonal", label: "Diagonal" }, { path: "still", label: "Stand" }];
const ZOOMS = [{ label: "Game zoom", across: 15 }, { label: "Close", across: 7 }];

export default function HeroLab() {
  const [view, setView] = useState<HeroView>({ path: "circle", across: 15, outline: true, sprite: true, model: false, eight: true });
  const set = (p: Partial<HeroView>) => setView((v) => ({ ...v, ...p }));
  const btn = (on: boolean) => ({ minHeight: 44, padding: "0 12px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
  return (
    <div style={{ background: "#111", color: "#f1d9a0", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Hero drafts</h1>
      <div style={{ width: "100%", maxWidth: 480, aspectRatio: "3 / 4" }}>
        <HeroScene view={view} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, maxWidth: 480 }}>
        {PATHS.map((p) => <button key={p.path} style={btn(view.path === p.path)} onClick={() => set({ path: p.path })}>{p.label}</button>)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 480 }}>
        <button style={btn(view.eight)} onClick={() => set({ eight: !view.eight })}>8-way {view.eight ? "shown" : "hidden"}</button>
        <button style={btn(view.model)} onClick={() => set({ model: !view.model })}>3D {view.model ? "shown" : "hidden"}</button>
        <button style={btn(view.sprite)} onClick={() => set({ sprite: !view.sprite })}>Sprite {view.sprite ? "shown" : "hidden"}</button>
        <button style={btn(view.outline)} onClick={() => set({ outline: !view.outline })}>Outline {view.outline ? "on" : "off"}</button>
        {ZOOMS.map((z) => <button key={z.across} style={btn(view.across === z.across)} onClick={() => set({ across: z.across })}>{z.label}</button>)}
      </div>
      <p style={{ color: "#a89878", fontSize: 13, maxWidth: 480 }}>
        Left: the new 8-way hero, torch held out ahead (stills for now: no walk yet, so it glides). Right:
        today&apos;s sprite, turning as the game now does. The boxy 3D draft is under &quot;3D&quot;. Lit by a test torch, not yet
        the game&apos;s own light.
      </p>
    </div>
  );
}
