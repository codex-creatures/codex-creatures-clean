"use client";
// components/dungeon/Haul.tsx
// The haul after a boss: your bag, the boss's chest and what you left on the floors. Moved out of app/dungeon/page.tsx as it was.

import { useState } from "react";
import BagSlots, { slotLook } from "@/components/BagSlots";
import LootGrid from "@/components/LootGrid";
import type { Drop } from "@/lib/types";
import type { CreatureOrItemDrop } from "@/lib/types";
import { bagSize, bagName, isPotionEntry, type BagEntry, type GotItem, type DungeonSave, type DungeonRun, type Room, DUNGEONS, isRareFind } from "@/lib/dungeon/run";
import { MUTED } from "@/components/BattleScreen";
import EncampmentPanel from "./EncampmentPanel";

// The boss beaten: its name in the celebration's banner, and a line about the clear.
export function beatenTitle(run: DungeonRun) {
  return run.dungeon === 0 ? "The Encampment is yours!" : run.dungeon === 2 ? "The Hydra falls!" : run.dungeon === 3 ? "The Warden falls!" : "The Cyclops falls!";
}
export function clearedLine(run: DungeonRun, lab: DungeonSave) {
  return run.dungeon === 0
    ? `The chief goes down, and the camp is yours. You beat the Encampment on run ${run.runNumber}!${lab.meta.campClears ? "" : " The Cyclops's way in is open now."}`
    : run.dungeon && run.dungeon !== 1
    ? `${run.dungeon === 2 ? "The last head falls" : "The Warden falls"}, and the deep goes quiet. You beat ${DUNGEONS[run.dungeon].name.replace("The", "the")} on run ${run.runNumber}!`
    : `The Eye bursts in a shower of sparks. You beat the Cyclops on run ${run.runNumber}${lab.meta.firstClearRun ? "" : " — your first clear"}! Its head comes home with you: a trophy, and a bounty if anyone's offering one.`;
}
export const chestName = (room: Room) => (room.container === "strongbox" ? "The strongbox" : room.kind === "encampment" ? "The chief's chest" : "The Cyclops' chest");

// The haul, once the boss is beaten (the user, 2026-11-02: one looting
// screen, then home): your bag's free space, the boss's chest (and the
// Encampment's cages), then everything you left on the floors. Open either
// to sort it into your bag. Whatever's left when you head home stays here,
// except gold and creature cards, which come along free.
export default function Haul({ run, lab, itemOf, notes, onOpen, onCage, onHome }: {
  run: DungeonRun; lab: DungeonSave; itemOf: (e: BagEntry) => CreatureOrItemDrop | undefined; notes: string[];
  onOpen: (which: "boss" | "floor") => void; onCage: (i: number) => void; onHome: () => void;
}) {
  const [sure, setSure] = useState(false); // heading home, leaving rare things behind
  const room = run.current;
  const sack = room?.sack ?? [];
  const floor = run.floor ?? [];
  const bag = lab.meta.bag ?? [];
  const slots = bagSize(lab.meta);
  const fromSack: GotItem[] = sack.flatMap((x): GotItem[] => ("gold" in x ? [{ drop: { id: "", barcode: "", dropType: "reward", rewardKind: "resource", amount: x.gold, createdAt: "" } as Drop }] : "potion" in x ? [{ potion: x.potion }] : "gear" in x ? [{ drop: x.gear }] : []));
  const left: GotItem[] = floor.map((f) => (f.drop ? { drop: f.drop } : { potion: f.potion! }));
  const rareLeft = [...sack.flatMap((x) => ("gear" in x ? [x.gear] : [])), ...floor.flatMap((f) => (f.drop ? [f.drop] : []))].filter(isRareFind).length;
  const heading = (title: string, count: number, which: "boss" | "floor") => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
      <span className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>{title}</span>
      <button className="chip" disabled={count === 0} style={{ visibility: count === 0 ? "hidden" : "visible" }} onClick={() => onOpen(which)}>Sort ({count})</button>
    </div>
  );
  return (
    <>
      <div className="stone-panel" style={{ textAlign: "center" }}>
        <div className="pixel-font" style={{ fontSize: 22, color: "#5ee08a" }}>{beatenTitle(run)}</div>
        {notes.map((n, i) => <div key={i} style={{ fontSize: 12, color: "#d8d4c8", marginTop: 4 }}>{n}</div>)}
      </div>

      <div className="stone-panel" style={{ marginTop: 10 }}>
        <div className="pixel-font" style={{ fontSize: 15, color: bag.length >= slots ? "#ff8a80" : "#f1d9a0", marginBottom: 6 }}>
          🎒 {bagName(lab.meta)} · {slots - bag.length} free
        </div>
        <BagSlots slots={slots} looks={bag.map((e) => slotLook(e, isPotionEntry(e) ? undefined : itemOf(e)))} selected={null}
          onSelect={() => onOpen(sack.length > 0 || floor.length === 0 ? "boss" : "floor")} size={44} />
      </div>

      <div className="stone-panel" style={{ marginTop: 10 }}>
        {heading(room ? chestName(room) : "The chest", sack.length, "boss")}
        {fromSack.length > 0 ? <LootGrid items={fromSack} grouped /> : <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Empty now.</p>}
        {room?.cages?.length ? <EncampmentPanel room={room} fuse={0} onCage={onCage} /> : null}
      </div>

      <div className="stone-panel" style={{ marginTop: 10 }}>
        {heading("Left on the floors", floor.length, "floor")}
        {left.length > 0 ? <LootGrid items={left} grouped /> : <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Nothing left behind.</p>}
      </div>

      <div style={{ marginTop: 14 }}>
        {sure ? (
          <div className="stone-panel" style={{ borderColor: "#ff8a80" }}>
            <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>{rareLeft} rare thing{rareLeft === 1 ? " is" : "s are"} still here. Leave {rareLeft === 1 ? "it" : "them"} for good?</p>
            <div className="dock-tabs">
              <button className="dock-tab" onClick={() => setSure(false)}>Keep sorting</button>
              <button className="dock-tab" style={{ color: "#ff8a80" }} onClick={onHome}>Return to Den</button>
            </div>
          </div>
        ) : (
          <button className="pixel-btn" style={{ width: "100%" }} onClick={() => (rareLeft > 0 ? setSure(true) : onHome())}>🏠 Return to Den</button>
        )}
      </div>
    </>
  );
}
