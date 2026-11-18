"use client";
// app/lab/propbuilder/page.tsx — 🧪 building Den and dungeon props in 3D from PixelLab drawings (the user,
// 2026-11-19): a prop is a recipe of simple parts (lib/props/recipe.ts, saved in lib/props/recipes/), drawn
// through the game's camera (./Preview.tsx). Stage 1: the recipes, read only, each beside what the game draws
// now. (Stages to come: editing parts and faces, the drawing over the view, torch light, saving.) Nothing is saved.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { readRecipe } from "@/lib/props/recipe";
import { RECIPE_FILES } from "@/lib/props/recipes";
import type { StationKey } from "@/lib/den3d/layout";

const Preview = dynamic(() => import("./Preview"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });

// What the game draws now for each recipe, to match against (the Den's places).
const NOW: Record<string, StationKey> = { altar: "altar" };

export default function PropBuilder() {
  const ids = Object.keys(RECIPE_FILES);
  const [id, setId] = useState(ids[0]);
  const [angle, setAngle] = useState(60);
  const [warm, setWarm] = useState(true);
  const [lean, setLean] = useState(true);
  const [compare, setCompare] = useState(true);
  const read = useMemo(() => readRecipe(RECIPE_FILES[id]), [id]);
  const btn = (on: boolean) => ({ minHeight: 44, padding: "0 10px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
  return (
    <div style={{ background: "#111", color: "#f1d9a0", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Prop builder</h1>
      <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 8px", maxWidth: 720 }}>
        A prop built from simple parts, as the game will draw it: near the left edge, in the middle and near the right edge, so the lean shows its sides. Behind each: what the game draws now.
      </p>
      <div style={{ position: "relative", width: "100%", maxWidth: 720, aspectRatio: "4 / 3", borderRadius: 8, overflow: "hidden" }}>
        {read.ok
          ? <Preview recipe={read.recipe} compare={compare ? NOW[id] : undefined} angle={angle} warm={warm} lean={lean} />
          : <pre style={{ color: "#e88", padding: 12, whiteSpace: "pre-wrap" }}>{read.errors.join("\n")}</pre>}
      </div>
      {read.ok && <div style={{ fontSize: 12, color: "#cbbf9f", marginTop: 6 }}>{read.recipe.name}: {read.recipe.parts.length} parts ({read.recipe.parts.map((p) => p.id).join(", ")})</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 720 }}>
        {ids.map((k) => <button key={k} style={btn(id === k)} onClick={() => setId(k)}>{k}</button>)}
        <button style={btn(compare)} onClick={() => setCompare(!compare)}>Game&apos;s own behind</button>
        <button style={btn(warm)} onClick={() => setWarm(!warm)}>Den light</button>
        <button style={btn(lean)} onClick={() => setLean(!lean)}>Lean</button>
        {[45, 60, 75].map((a) => <button key={a} style={btn(angle === a)} onClick={() => setAngle(a)}>{a}°</button>)}
      </div>
    </div>
  );
}
