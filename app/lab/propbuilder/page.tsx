"use client";
// app/lab/propbuilder/page.tsx — 🧪 building Den and dungeon props in 3D from PixelLab drawings (the user,
// 2026-11-19): a prop is a recipe of simple parts (lib/props/recipe.ts, saved in lib/props/recipes/), edited in
// ./Builder.tsx and drawn through the game's camera (./Preview.tsx). How to use it: world/art-pipeline.md §6.6.
// Loaded in the browser only (it reads the drafts kept there). The game doesn't use it.

import dynamic from "next/dynamic";

const Builder = dynamic(() => import("./Builder"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16, background: "#111", minHeight: "100vh", margin: 0 }}>Loading the prop builder…</p> });

export default function PropBuilderPage() {
  return <Builder />;
}
