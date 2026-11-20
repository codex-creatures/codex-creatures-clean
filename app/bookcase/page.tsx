"use client";
// app/bookcase/page.tsx
// The bookcase in the Den, where codexes are kept. It grows in stages (lib/items/materials.ts BOOKCASE_STAGES:
// 5, 15, 30, 50; the user, 2026-11-20): the old shelf; the crooked bookcase (planks and nails, no plan); the
// sturdy one (its schematic: the campaign's reward for the rubble, chests, merchants); the carved one (its
// schematic: chests from the Cyclops on, merchants; lib/items/plans.ts).
// A codex is read from a creature's page (only creatures of its race can
// learn a race codex). One you don't want can be sold to make room.

import DenFrame from "@/components/DenFrame";
import CodexShelf from "@/components/CodexShelf";
import Help from "@/components/Help";
import PlanBuild, { heldOf } from "@/components/PlanBuild";
import { useGameState } from "@/hooks/useGameState";
import { MaterialIcon } from "@/components/PixelSprite";
import { BOOKCASE_CROOKED_COST, BOOKCASE_NAMES, BOOKCASE_STAGES, MATERIALS, canAfford, countMaterial, type MaterialKey } from "@/lib/items/materials";
import { tavernPlan } from "@/lib/tavern";

const MUTED = "rgba(255,255,255,0.5)";

export default function BookcasePage() {
  const game = useGameState();
  if (!game.hydrated) return <DenFrame title="Bookcase" icon="📚"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const stage = Math.min(BOOKCASE_STAGES.length, Math.max(1, game.bookcase));
  // The next stage's plan you're holding: one found, or the campaign's (the sturdy one's, from the broken tavern).
  const held = heldOf(game.inventory, stage < 3 ? ["crooked_bookcase", "carved_bookcase"] : stage < 4 ? ["carved_bookcase"] : [])[0];
  const plan = held ?? (tavernPlan(game.tavern, game.bookcase) ? { id: undefined, key: "crooked_bookcase" as const } : undefined);
  const crooked = stage === 1; // (the crooked bookcase takes no plan)

  return (
    <DenFrame title="Bookcase" icon="📚">
      <div className="stone-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 17, color: "#f1d9a0" }}>
            {BOOKCASE_NAMES[stage - 1]} · holds {game.bookcaseSize}
          </div>
          <Help title="The bookcase">
            <ul>
              <li>Codexes you bring home go here. If it&apos;s full they <b>stay in your bag</b>.</li>
              <li>Read a codex from a creature&apos;s <b>Moves</b> tab. Race codexes only work on that race.</li>
              <li>Don&apos;t want one? Tap it, then <b>Sell</b>: you get what a merchant would pay (half a librarian&apos;s price), and it makes room.</li>
              <li>It grows: the <b>crooked bookcase</b> ({BOOKCASE_STAGES[1]}) from planks and nails; the <b>sturdy</b> one ({BOOKCASE_STAGES[2]}) and the <b>carved</b> one ({BOOKCASE_STAGES[3]}) each from a <b>schematic</b>, found in chests or sold by merchants.</li>
            </ul>
          </Help>
        </div>
        {crooked && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, color: "#d8d4c8" }}>Build the <b>crooked bookcase</b> (holds {BOOKCASE_STAGES[1]}).</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "6px 0 8px" }}>
              {(Object.entries(BOOKCASE_CROOKED_COST) as [MaterialKey, number][]).map(([k, n]) => {
                const have = countMaterial(game.materials, k);
                return (
                  <span key={k} className="pixel-font" style={{ fontSize: 13, color: have >= n ? "#5ee08a" : "#ff8a80" }}>
                    <MaterialIcon k={k} /> {have}/{n} {MATERIALS[k].name.toLowerCase()}
                  </span>
                );
              })}
            </div>
            <button className="pixel-btn" style={{ minHeight: 44 }} disabled={!canAfford(game.materials, BOOKCASE_CROOKED_COST)} onClick={() => game.upgradeBookcase()}>🔨 Build it</button>
          </div>
        )}
        {plan && <PlanBuild plan={plan.key} materials={game.materials} gold={game.gold} onBuild={() => game.buildSchematic(plan.id)}
          note={crooked ? "Build the crooked bookcase first." : undefined} />}
      </div>
      <div style={{ marginTop: 14 }}><CodexShelf inventory={game.inventory} size={game.bookcaseSize} teach={{ onLearn: game.learnCodex, onSetMoves: game.setMoves, movesOf: (id) => game.equipment[id]?.moves }} onSell={game.sellCodex} /></div>
    </DenFrame>
  );
}
