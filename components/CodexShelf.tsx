"use client";
// components/CodexShelf.tsx
// Your codexes, on the bookcase's shelves (size: how many it holds). Shown in
// the Bookcase and the Inventory's Codex tab. Each is a book on the shelf;
// tap one to see the move it teaches, as the move itself (CodexMove), and who
// could learn it. The box on top keeps its size whatever's picked, so nothing
// moves.

import { useState } from "react";
import Link from "next/link";
import CodexMove from "./CodexMove";
import { canLearnFromCodex, findCreatureTemplate } from "@/lib/creatures/creatureData";
import { RARITY_COLORS, rarityGlow } from "@/lib/items/gameHelpers";
import { sortByRarity } from "./TileGrid";
import { NAME } from "./ContainerLoot";
import type { CreatureOrItemDrop, Drop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

export default function CodexShelf({ inventory, size }: { inventory: Drop[]; size: number }) {
  const codexes = sortByRarity(inventory.filter((d) => d.dropType === "item" && d.codexMove) as CreatureOrItemDrop[]);
  const creatures = inventory.filter((d) => d.dropType === "creature") as CreatureOrItemDrop[];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = codexes.find((c) => c.id === pickedId);
  const learners = picked ? creatures.filter((x) => {
    const t = findCreatureTemplate(x.creatureId, x.name);
    return t && canLearnFromCodex(t, picked.codexMove!) && !x.learned?.includes(picked.codexMove!) && !(x.moves ?? []).includes(picked.codexMove!);
  }) : [];
  return (
    <>
      <div className="pixel-font" style={{ fontSize: 15, color: GOLD, margin: "4px 0 8px" }}>On the shelf ({codexes.length}/{size})</div>
      {codexes.length === 0 ? (
        <p style={{ fontSize: 13, color: MUTED }}>Nothing yet. Codexes come from scanning and Labyrinth chests; wandering librarians sell race codexes.</p>
      ) : (
        <>
          {/* The picked codex: its move, and who could learn it. */}
          <div className="stone-panel" style={{ padding: 10, marginBottom: 10, height: 150, boxSizing: "border-box", display: "grid", alignContent: "start", gap: 6 }}>
            {picked ? (
              <>
                <b style={{ color: RARITY_COLORS[picked.rarity].text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={picked.name}>📖 {picked.name}</b>
                <CodexMove move={picked.codexMove!} />
                <div style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {learners.length > 0
                    ? <>Could teach: {learners.map((x) => x.name).join(", ")} · <Link href="/pit" style={{ textDecoration: "underline" }}>Pit</Link></>
                    : <span style={{ color: MUTED }}>None of your creatures can learn it yet.</span>}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: MUTED, alignSelf: "center" }}>Tap a codex to see its move.</div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 6 }}>
            {codexes.map((c) => {
              const rc = RARITY_COLORS[c.rarity];
              const on = c.id === pickedId;
              return (
                <button key={c.id} onClick={() => setPickedId(on ? null : c.id)} aria-pressed={on} title={c.name}
                  style={{ minHeight: 72, padding: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    background: `radial-gradient(circle, ${rarityGlow(c.rarity)}, #101117 75%)`, border: `2px solid ${on ? "#ffd66e" : rc.border}`,
                    boxShadow: on ? "0 0 10px rgba(255,214,110,0.55)" : "0 2px 0 rgba(0,0,0,0.5)", color: "white" }}>
                  <span style={{ fontSize: 26, lineHeight: 1 }}>📖</span>
                  <span style={{ ...NAME, color: rc.text }}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
