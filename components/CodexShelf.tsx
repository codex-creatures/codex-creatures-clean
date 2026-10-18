"use client";
// components/CodexShelf.tsx
// Your codexes, on the bookcase's shelves (size: how many it holds), with who
// could learn each. Shown in the Bookcase and the Inventory's Codex tab.

import Link from "next/link";
import RaceTag from "./RaceTag";
import { MOVE_BY_NAME, canLearnFromCodex, findCreatureTemplate } from "@/lib/creatures/creatureData";
import { moveKind } from "./ClassBadge";
import type { CreatureOrItemDrop, Drop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

export default function CodexShelf({ inventory, size }: { inventory: Drop[]; size: number }) {
  const codexes = inventory.filter((d) => d.dropType === "item" && d.codexMove) as CreatureOrItemDrop[];
  const creatures = inventory.filter((d) => d.dropType === "creature") as CreatureOrItemDrop[];
  return (
    <>
      <div className="pixel-font" style={{ fontSize: 15, color: GOLD, margin: "4px 0 8px" }}>On the shelf ({codexes.length}/{size})</div>
      {codexes.length === 0 ? (
        <p style={{ fontSize: 13, color: MUTED }}>Nothing yet. Codexes come from scanning and Labyrinth chests; wandering librarians sell race codexes.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {codexes.map((c) => {
            const move = MOVE_BY_NAME[c.codexMove!];
            const learners = creatures.filter((x) => {
              const t = findCreatureTemplate(x.creatureId, x.name);
              return t && canLearnFromCodex(t, c.codexMove!) && !x.learned?.includes(c.codexMove!) && !(x.moves ?? []).includes(c.codexMove!);
            });
            return (
              <div key={c.id} className="stone-panel" style={{ padding: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <b style={{ color: GOLD }}>📖 {c.name}</b>
                  {move?.race && <RaceTag race={move.race} />}
                </div>
                {move && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{move.self ? "utility" : moveKind(move)} · {move.desc}</div>}
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  {learners.length > 0
                    ? <>Could teach: {learners.map((x) => x.name).join(", ")} — <Link href="/pit" style={{ textDecoration: "underline" }}>open one in the Pit</Link></>
                    : <span style={{ color: MUTED }}>None of your creatures can learn it yet.</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
