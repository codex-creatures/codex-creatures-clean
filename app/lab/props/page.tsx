"use client";
// app/lab/props/page.tsx — 🧪 every 3D thing you can find in the Labyrinth (the user, 2026-11-17: "a lab of all
// 3D assets that can be found in the labyrinth"), drawn with the game's own models: all of them laid out on
// the floor, or one at a time up close under a torch, opened or shut. Nothing is saved; the game doesn't use it.
// Three.js is loaded on this page only.

import { useState } from "react";
import dynamic from "next/dynamic";
import { PROPS } from "./PropsScene";

const PropsScene = dynamic(() => import("./PropsScene"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });

export default function PropsLab() {
  const [at, setAt] = useState(0);
  const [all, setAll] = useState(true);
  const [open, setOpen] = useState(false);
  const btn = (on: boolean) => ({ minHeight: 44, padding: "0 10px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
  const p = PROPS[at];
  return (
    <div style={{ background: "#111", color: "#f1d9a0", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>The Labyrinth&apos;s 3D things</h1>
      <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 8px", maxWidth: 560 }}>
        Everything you can find in the Labyrinth that&apos;s drawn in 3D, with the game&apos;s own models. Tap one to look at it up close by torchlight; Open swings lids and doors, puts out the campfire and uses the gem.
      </p>
      <div style={{ width: "100%", maxWidth: 560, aspectRatio: "4 / 3", borderRadius: 8, overflow: "hidden" }}>
        <PropsScene at={at} all={all} open={open} />
      </div>
      {/* The one you're looking at: one line each, so nothing moves. */}
      <div style={{ maxWidth: 560, marginTop: 8, minHeight: 40 }}>
        <div style={{ fontWeight: 700, visibility: all ? "hidden" : "visible" }}>{p.name}</div>
        <div style={{ fontSize: 12, color: "#cbbf9f", visibility: all ? "hidden" : "visible" }}>{p.where}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4, maxWidth: 560 }}>
        <button style={btn(all)} onClick={() => setAll(true)}>All of them</button>
        <button style={btn(open)} onClick={() => setOpen((v) => !v)}>{open ? "Open / used" : "Shut / unused"}</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 560 }}>
        {PROPS.map((q, i) => <button key={q.id} style={btn(!all && at === i)} onClick={() => { setAt(i); setAll(false); }}>{q.name}</button>)}
      </div>
    </div>
  );
}
