"use client";
// app/lab/propreview/Review.tsx — 🧪 reviewing the props built from recipes (the user, 2026-11-19): walk round them
// lit (./ReviewScene.tsx). Every recipe in lib/props/recipes/ stands here as its file has it; with `?drafts` in the
// address, the prop builder's unsaved drafts in this browser stand in for their files (build there, walk round it
// here). Nothing is saved.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Stick } from "@/components/WalkParts";
import { readRecipe, type Recipe } from "@/lib/props/recipe";
import { RECIPE_FILES } from "@/lib/props/recipes";
import { DRAFT_KEY } from "@/app/lab/propbuilder/drafts";
import { newWalk, pushWalk, jumpTo, onNear, type LightMode, type Walk } from "./walk";

const ReviewScene = dynamic(() => import("./ReviewScene"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });
const LIGHTS: [LightMode, string][] = [["den", "Den light"], ["torch", "Torch only"], ["game", "Game look (flat)"]];

// The recipes to show: the files', or with `?drafts` the builder's drafts over them; and any that won't read, with why.
function load(): { recipes: Recipe[]; broken: string[] } {
  let drafts: Record<string, unknown> = {};
  try { if (new URLSearchParams(location.search).has("drafts")) drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); } catch { /* (no drafts) */ }
  const recipes: Recipe[] = [], broken: string[] = [];
  for (const [id, j] of Object.entries({ ...RECIPE_FILES, ...drafts })) { const r = readRecipe(j); if (r.ok) recipes.push(r.recipe); else broken.push(`${id}: ${r.errors.join("; ")}`); }
  return { recipes, broken };
}

export default function PropReview() {
  const [{ recipes, broken }] = useState(load);
  const [light, setLight] = useState<LightMode>("den");
  const [across, setAcross] = useState(8); // (close, to review its detail; the game's zoom is 15)
  const [near, setNear] = useState<number | null>(null);
  const [scale, setScale] = useState(false); // (Klutz beside each prop, to judge its size)
  const [walk] = useState<Walk>(newWalk);
  useEffect(() => { onNear(walk, setNear); }, [walk]);
  const btn = (on: boolean) => ({ minHeight: 44, padding: "0 10px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
  return (
    <div style={{ background: "#111", color: "#f1d9a0", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Props, lit</h1>
      <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 8px", maxWidth: 760 }}>
        Walk round the props built in the prop builder: the stick, the arrow keys or WASD, or tap the floor. Your torch lights what&apos;s near. &quot;Game look&quot; shows them flat, as the game draws its 3D things today.
      </p>
      <div style={{ position: "relative", width: "100%", maxWidth: 760, aspectRatio: "3 / 4", maxHeight: "78vh", borderRadius: 8, overflow: "hidden", containerType: "size" }}>
        <ReviewScene recipes={recipes} light={light} across={across} walk={walk} scale={scale} />
        <Stick onPush={(q) => pushWalk(walk, q)} />
      </div>
      {broken.length > 0 && <pre style={{ color: "#e88", fontSize: 12, whiteSpace: "pre-wrap", margin: "6px 0 0", maxWidth: 760 }}>Not shown (they don&apos;t read):{"\n"}{broken.join("\n")}</pre>}
      <div style={{ fontSize: 13, marginTop: 6, minHeight: 20, visibility: near === null ? "hidden" : "visible" }}>{near === null ? "-" : recipes[near]?.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, maxWidth: 760 }}>
        {LIGHTS.map(([k, n]) => <button key={k} style={btn(light === k)} onClick={() => setLight(k)}>{n}</button>)}
        {([[8, "Close"], [11, "Near"], [15, "Game zoom"], [19, "Far"]] as const).map(([a, n]) => <button key={a} style={btn(across === a)} onClick={() => setAcross(a)}>{n}</button>)}
        <button style={btn(scale)} onClick={() => setScale(!scale)}>Klutz for scale</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 760 }}>
        {recipes.map((r, i) => <button key={r.id} style={btn(near === i)} onClick={() => jumpTo(walk, i)}>Go to {r.name}</button>)}
      </div>
    </div>
  );
}
