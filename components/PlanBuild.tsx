"use client";
// components/PlanBuild.tsx
// A schematic you're holding, to build where it goes (the cage, the Inventory's boxes, the bookcase, the
// Training Pit): what it does, each material it takes (have/need, green once you've enough), any gold, and Build.
// The Den's ladders of plans: lib/items/plans.ts.

import { MaterialIcon, SchematicIcon } from "@/components/PixelSprite";
import type { Drop } from "@/lib/types";
import { MATERIALS, SCHEMATICS, canAfford, countMaterial, type MaterialKey, type SchematicKey } from "@/lib/items/materials";

const GREEN = "#5ee08a";
const RED = "#ff8a80";

export default function PlanBuild({ plan, materials, gold, onBuild, note }: {
  plan: SchematicKey; materials: Partial<Record<MaterialKey, number>>; gold: number; onBuild: () => void; note?: string;
}) {
  const { name, desc, cost, gold: price = 0 } = SCHEMATICS[plan];
  const ok = canAfford(materials, cost) && gold >= price && !note;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 13, color: "#d8d4c8" }}><SchematicIcon /> <b>{name}</b>: {desc}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "6px 0 8px" }}>
        {(Object.entries(cost) as [MaterialKey, number][]).map(([k, n]) => {
          const have = countMaterial(materials, k);
          return (
            <span key={k} className="pixel-font" style={{ fontSize: 13, color: have >= n ? GREEN : RED }}>
              <MaterialIcon k={k} /> {have}/{n} {MATERIALS[k].name.toLowerCase()}
            </span>
          );
        })}
        {price > 0 && <span className="pixel-font" style={{ fontSize: 13, color: gold >= price ? GREEN : RED }}>🪙 {price.toLocaleString()} gold</span>}
      </div>
      {note && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{note}</div>}
      <button className="pixel-btn" style={{ minHeight: 44 }} disabled={!ok} onClick={onBuild}>🔨 Build it</button>
    </div>
  );
}

// The schematics of these kinds you're holding at home (the first of each, in the order given).
export function heldOf<K extends SchematicKey>(inventory: readonly Drop[], keys: readonly K[]): { id: string; key: K }[] {
  return keys.flatMap((k) => { const d = inventory.find((x) => x.dropType === "item" && x.schematic === k); return d ? [{ id: d.id, key: k }] : []; });
}
