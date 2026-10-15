"use client";
// app/bookcase/page.tsx
// The bookcase in the Den, where codexes are kept. It starts as a single
// shelf holding BOOKCASE_SIZE; upgrades will come later. A codex is read
// from a creature's page (only creatures of its race can learn it).

import Link from "next/link";
import DenFrame from "@/components/DenFrame";
import RaceTag from "@/components/RaceTag";
import { useGameState } from "@/hooks/useGameState";
import { BOOKCASE_SIZE } from "@/lib/dungeon/run";
import { MOVE_BY_NAME, findCreatureTemplate } from "@/lib/creatures/creatureData";
import { moveKind } from "@/components/ClassBadge";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

export default function BookcasePage() {
  const game = useGameState();
  if (!game.hydrated) return <DenFrame title="Bookcase" icon="📚"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const codexes = game.inventory.filter((d) => d.dropType === "item" && d.codexMove) as CreatureOrItemDrop[];
  const creatures = game.inventory.filter((d) => d.dropType === "creature") as CreatureOrItemDrop[];

  return (
    <DenFrame title="Bookcase" icon="📚">
      <div className="stone-panel">
        <p style={{ fontSize: 13, color: "#c8c4b8", lineHeight: 1.5, margin: 0 }}>
          Just a shelf for now: it holds <b>{BOOKCASE_SIZE} codexes</b>. Codexes you bring home from the Labyrinth go here;
          if it&apos;s full they stay in your bag. Each codex teaches its race&apos;s move once — read it from a creature&apos;s page in the Fight Pit.
        </p>
      </div>
      <div className="pixel-font" style={{ fontSize: 15, color: GOLD, margin: "16px 0 8px" }}>On the shelf ({codexes.length}/{BOOKCASE_SIZE})</div>
      {codexes.length === 0 ? (
        <p style={{ fontSize: 13, color: MUTED }}>Nothing yet. Wandering librarians in the Labyrinth sell codexes, and chests sometimes hold one.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {codexes.map((c) => {
            const move = MOVE_BY_NAME[c.codexMove!];
            const learners = creatures.filter((x) => findCreatureTemplate(x.creatureId, x.name)?.race === move?.race && !x.learned?.includes(c.codexMove!));
            return (
              <div key={c.id} className="stone-panel" style={{ padding: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <b style={{ color: GOLD }}>📖 {c.name}</b>
                  {move?.race && <RaceTag race={move.race} />}
                </div>
                {move && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{move.self ? "utility" : moveKind(move)} · {move.desc}</div>}
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  {learners.length > 0
                    ? <>Could teach: {learners.map((x) => x.name).join(", ")} — <Link href="/pit" style={{ textDecoration: "underline" }}>open one in the Fight Pit</Link></>
                    : <span style={{ color: MUTED }}>None of your creatures can learn it yet.</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DenFrame>
  );
}
