"use client";
// app/lab/chest/page.tsx — 🧪 a draft 3D chest (the user, 2026-11-11), on the game's floor under the
// game's camera, to judge the look before any 3D object goes in the dungeon. Boxes for the shape
// (lib/render3d/chest3d.ts) with PixelLab's painted faces, a dark outline and lit top edges (or plain
// stand-ins, to compare); the old flat chest and you beside it for
// comparison and scale. Nothing is saved, and the game doesn't use it.
// Dev tool: Three.js is loaded on this page only.

import { useState } from "react";
import dynamic from "next/dynamic";
import { CHEST_W } from "@/lib/render3d/chest3d";
import type { ChestView, Thing3D } from "./ChestScene";
import type { Rarity } from "@/lib/types";

const ChestScene = dynamic(() => import("./ChestScene"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });

const SIZES = [1, CHEST_W, 1.5, 1.75];
const THINGS: { thing: Thing3D; label: string }[] = [{ thing: "chest", label: "Chest" }, { thing: "stash", label: "Stash" }, { thing: "bookcase", label: "Bookcase" }, { thing: "table", label: "Table" }, { thing: "deck", label: "Deck" }];
// Drafts of the dungeon's other things (components/Drafts3D.tsx; the broken bookcase and the campfire are in the game).
const DRAFTS: { thing: Thing3D; label: string }[] = [
  { thing: "strongbox", label: "Strongbox" }, { thing: "broken", label: "Broken bookcase ✓" }, { thing: "gem", label: "Healing gem ✓" }, { thing: "campfire", label: "Campfire ✓" },
  { thing: "cage", label: "Cage" }, { thing: "lectern", label: "Lectern" }, { thing: "floortorch", label: "Floor torch" }, { thing: "torch", label: "Wall torch" },
];
const LIGHTS: Thing3D[] = ["campfire", "floortorch", "torch"];
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const ACROSS = [0, 2, 4, 6]; // units the chest stands across from you
const ZOOMS = [{ label: "Game zoom", across: 15 }, { label: "Close", across: 7 }];

export default function ChestLab() {
  const [view, setView] = useState<ChestView>({ open: false, across: 15, width: CHEST_W, moving: true, old: true, art: true, outline: true, edges: true, at: 0, lean: true, thing: "chest", turned: false, candle: true, rarity: "epic", lit: true });
  const set = (p: Partial<ChestView>) => setView((v) => ({ ...v, ...p }));
  const btn = (on: boolean) => ({ minHeight: 44, padding: "0 12px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
  return (
    <div style={{ background: "#111", color: "#f1d9a0", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>3D object drafts</h1>
      <div style={{ width: "100%", maxWidth: 480, aspectRatio: "3 / 4" }}>
        <ChestScene view={view} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, maxWidth: 480 }}>
        {THINGS.map((k) => <button key={k.thing} style={btn(view.thing === k.thing)} onClick={() => set({ thing: k.thing })}>{k.label}</button>)}
        <button style={btn(view.turned)} onClick={() => set({ turned: !view.turned })}>{view.turned ? "Turned (end on)" : "Facing you"}</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 480, alignItems: "center" }}>
        <span>Drafts:</span>
        {DRAFTS.map((k) => <button key={k.thing} style={btn(view.thing === k.thing)} onClick={() => set({ thing: k.thing })}>{k.label}</button>)}
      </div>
      {LIGHTS.includes(view.thing) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 480 }}>
          <button style={btn(view.lit)} onClick={() => set({ lit: !view.lit })}>{view.lit ? "Lit" : "Out"}</button>
        </div>
      )}
      {view.thing === "table" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 480 }}>
          <button style={btn(view.candle)} onClick={() => set({ candle: !view.candle })}>Candle {view.candle ? "on" : "off"}</button>
        </div>
      )}
      {view.thing === "deck" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 480, alignItems: "center" }}>
          <span>Rarest card:</span>
          {RARITIES.map((r) => <button key={r} style={{ ...btn(view.rarity === r), textTransform: "capitalize" }} onClick={() => set({ rarity: r })}>{r}</button>)}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 480 }}>
        <button style={btn(view.open)} onClick={() => set({ open: !view.open })}>{view.thing === "deck" ? (view.open ? "Deck back" : "Turn them over") : view.open ? "Shut" : "Open"}</button>
        <button style={btn(view.art)} onClick={() => set({ art: !view.art })}>{view.art ? "PixelLab art" : "Stand-in"}</button>
        <button style={btn(view.outline)} onClick={() => set({ outline: !view.outline })}>Outline {view.outline ? "on" : "off"}</button>
        <button style={btn(view.edges)} onClick={() => set({ edges: !view.edges })}>Lit edges {view.edges ? "on" : "off"}</button>
        <button style={btn(view.moving)} onClick={() => set({ moving: !view.moving })}>Torch {view.moving ? "moving" : "still"}</button>
        <button style={btn(view.old)} onClick={() => set({ old: !view.old })}>Old chest {view.old ? "shown" : "hidden"}</button>
        {ZOOMS.map((z) => <button key={z.across} style={btn(view.across === z.across)} onClick={() => set({ across: z.across })}>{z.label}</button>)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 480, alignItems: "center" }}>
        <span>Chest across from you:</span>
        {ACROSS.map((a) => <button key={a} style={btn(view.at === a)} onClick={() => set({ at: a })}>{a}</button>)}
        <button style={btn(view.lean)} onClick={() => set({ lean: !view.lean })}>Lean {view.lean ? "on" : "off"}</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 480, alignItems: "center" }}>
        <span>Stand-in width (units):</span>
        {SIZES.map((w) => <button key={w} style={btn(view.width === w)} onClick={() => set({ width: w })}>{w}</button>)}
      </div>
      <p style={{ color: "#a89878", fontSize: 13, maxWidth: 480 }}>
        PixelLab art: the front and lid top are painted; the sides reuse the front&apos;s end, and the gold
        inside is still a stand-in. Lit by a test torch, not yet the game&apos;s own light.
      </p>
    </div>
  );
}
