"use client";
// components/dungeon/RunOver.tsx
// A run that ended without a clear: knocked out, or slipped back out. Moved out of app/dungeon/page.tsx as it was.

import LootGrid from "@/components/LootGrid";
import { type FloorItem, freeHealing, type DungeonSave, type DungeonRun } from "@/lib/dungeon/run";

// A run that ended without a clear: knocked out, or slipped back out.
export default function RunOver({ run, lab, onHome }: { run: DungeonRun; lab: DungeonSave; onHome: () => void }) {
  const floor: FloorItem[] = [...(run.floor ?? []), ...(run.pending ?? []).map((x) => ({ room: "", drop: x }))];
  const title = run.status === "dead" ? "Everything goes dark…" : "You slip back out";
  const text = run.status === "dead"
    ? `…and you wake up in the Den, Klutz standing over you looking pleased with himself. He dragged you out after ${run.room} room${run.room === 1 ? "" : "s"}. ${freeHealing(lab.meta) ? "He's patched your creatures up, good as new." : "Your creatures are hurt — rest them at the healing pool."}`
    : run.loot.includes("Klutz's box")
      ? "You head back to the Den with Klutz's box under your arm. He'll be thrilled — go and find him."
      : `You find your way back out, ${run.room} room${run.room === 1 ? "" : "s"} explored.`;
  return (
    <div className="stone-panel" style={{ textAlign: "center" }}>
      <div className="pixel-font" style={{ fontSize: 26, color: run.status === "dead" ? "#ff8a80" : "#f1d9a0" }}>{title}</div>
      <p style={{ fontSize: 14, color: "#d8d4c8", lineHeight: 1.5 }}>{text}</p>
      <div style={{ textAlign: "left" }}>
        <div className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0", margin: "4px 0 8px" }}>Loot</div>
        <LootGrid items={run.got ?? []} grouped />
        {floor.length > 0 && (
          <>
            <div className="pixel-font" style={{ fontSize: 15, color: "#ff8a80", margin: "16px 0 8px" }}>Left behind (lost)</div>
            <LootGrid items={floor.map((f) => (f.drop ? { drop: f.drop } : { potion: f.potion! }))} faded grouped />
          </>
        )}
      </div>
      <div style={{ height: 14 }} />
      <button className="pixel-btn" onClick={onHome}>Continue</button>
    </div>
  );
}
