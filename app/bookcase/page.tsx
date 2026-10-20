"use client";
// app/bookcase/page.tsx
// The bookcase in the Den, where codexes are kept. It starts as a broken
// shelf holding 10; the Crooked Bookcase Schematic (the tavern's Cyclops
// bounty: lib/tavern.ts) builds it up to 20, with planks and nails
// (lib/items/materials.ts). Saves that built it before the tavern keep 25.
// A codex is read from a creature's page (only creatures of its race can
// learn a race codex).

import DenFrame from "@/components/DenFrame";
import CodexShelf from "@/components/CodexShelf";
import Help from "@/components/Help";
import { useGameState } from "@/hooks/useGameState";
import { MATERIALS, SCHEMATICS, canAfford, countMaterial, type MaterialKey } from "@/lib/items/materials";
import { tavernPlan } from "@/lib/tavern";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";

export default function BookcasePage() {
  const game = useGameState();
  if (!game.hydrated) return <DenFrame title="Bookcase" icon="📚"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  // A bookcase schematic you could build from: the tavern bounty's, or one an
  // older save found in the Labyrinth.
  const found = game.bookcase < 2
    ? (game.inventory.find((d) => d.dropType === "item" && d.schematic === "crooked_bookcase") as CreatureOrItemDrop | undefined)
    : undefined;
  const plan = found ?? (tavernPlan(game.tavern, game.bookcase) ? { id: undefined, name: SCHEMATICS.crooked_bookcase.name } : undefined);
  const cost = SCHEMATICS.crooked_bookcase.cost;

  return (
    <DenFrame title="Bookcase" icon="📚">
      <div className="stone-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 17, color: "#f1d9a0" }}>
            {game.bookcase >= 2 ? "Crooked bookcase" : "Broken shelf"} · holds {game.bookcaseSize}
          </div>
          <Help title="The bookcase">
            <ul>
              <li>Codexes you bring home go here. If it&apos;s full they <b>stay in your bag</b>.</li>
              <li>Read a codex from a creature&apos;s <b>Moves</b> tab. Race codexes only work on that race.</li>
              <li>The <b>Crooked Bookcase Schematic</b> (the tavern&apos;s Cyclops bounty) builds it up to <b>20</b>: {SCHEMATICS.crooked_bookcase.cost.planks} planks and {SCHEMATICS.crooked_bookcase.cost.nails} nails.</li>
            </ul>
          </Help>
        </div>
        {plan && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, color: "#d8d4c8" }}>📐 You have the <b>{plan.name}</b>.</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "6px 0 8px" }}>
              {(Object.entries(cost) as [MaterialKey, number][]).map(([k, n]) => {
                const have = countMaterial(game.materials, k);
                return (
                  <span key={k} className="pixel-font" style={{ fontSize: 13, color: have >= n ? "#5ee08a" : "#ff8a80" }}>
                    {MATERIALS[k].icon} {have}/{n} {MATERIALS[k].name.toLowerCase()}
                  </span>
                );
              })}
            </div>
            <button className="pixel-btn" disabled={!canAfford(game.materials, cost)} onClick={() => game.buildSchematic(plan.id)}>🔨 Build it</button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 14 }}><CodexShelf inventory={game.inventory} size={game.bookcaseSize} teach={{ onLearn: game.learnCodex, onSetMoves: game.setMoves, movesOf: (id) => game.equipment[id]?.moves }} /></div>
    </DenFrame>
  );
}
