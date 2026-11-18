"use client";
// app/lab/models/page.tsx — 🧪 the new Den's 3D things one at a time, on a plain background, turned freely on
// any axis (the user, 2026-11-18: "a place I could view them in 3D, rotate them on any axis on a blank
// background and actually look at it"). The game's own models (components/Den3DPlaces.tsx), so this shows
// how each is really built: which parts are shapes and which are flat pictures. Nothing is saved.
// Three.js is loaded on this page only.

import { useState } from "react";
import dynamic from "next/dynamic";
import { stations } from "@/lib/den3d/layout";

const ModelScene = dynamic(() => import("./ModelScene"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });

// Every place in a Den with both rooms open, the tavern mended and its pit dug (the old wall's socket from a shut one).
const ALL = [...stations({ opened: true, pit: true, trainingPit: false, repaired: true }), ...stations({ opened: false, pit: false, trainingPit: false, repaired: false }).filter((s) => s.key === "rubble")];
const BACKGROUNDS = [["#1a1a1f", "Dark"], ["#808080", "Grey"], ["#f4f4f4", "Light"]] as const;

export default function ModelsLab() {
  const [at, setAt] = useState(0);
  const [bg, setBg] = useState<string>(BACKGROUNDS[1][0]);
  const [wire, setWire] = useState(false);
  const [spin, setSpin] = useState(false);
  const [reset, setReset] = useState(0);
  const btn = (on: boolean) => ({ minHeight: 44, padding: "0 10px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
  const s = ALL[at];
  return (
    <div style={{ background: "#111", color: "#f1d9a0", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>The Den&apos;s 3D models</h1>
      <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 8px", maxWidth: 560 }}>
        Each thing as the game builds it. Drag to turn it any way, scroll or pinch to zoom, right-drag or two fingers to slide. Wireframe shows its real shape: flat squares are pictures.
      </p>
      <div style={{ position: "relative", width: "100%", maxWidth: 560, aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden" }}>
        <ModelScene s={s} bg={bg} wire={wire} spin={spin} reset={reset} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 560 }}>
        {BACKGROUNDS.map(([c, name]) => <button key={c} style={btn(bg === c)} onClick={() => setBg(c)}>{name}</button>)}
        <button style={btn(wire)} onClick={() => setWire(!wire)}>Wireframe</button>
        <button style={btn(spin)} onClick={() => setSpin(!spin)}>Spin</button>
        <button style={btn(false)} onClick={() => setReset((n) => n + 1)}>Reset view</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 560 }}>
        {ALL.map((q, i) => <button key={q.key} style={btn(at === i)} onClick={() => setAt(i)}>{q.label}</button>)}
      </div>
    </div>
  );
}
