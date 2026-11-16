"use client";
// app/bag/page.tsx
// Your bindle (later a rugged backpack): what you carry into the Labyrinth.
// Pack spare gear here: a weapon to swap in mid-fight (say, a magic one for a
// foe with thin magic defence), or armour to change into between rooms.
// Potions come from merchants and stashes. Potions, flares and clairvoyance
// scrolls kept in your Inventory can be packed here, and stored back. Whatever you find down there
// needs a free slot to come home. (The packing itself: components/BagPacker.tsx,
// also at the Labyrinth's entrance.)

import { useEffect, useState } from "react";
import DenFrame from "@/components/DenFrame";
import BagPacker from "@/components/BagPacker";
import Help from "@/components/Help";
import { useGameState } from "@/hooks/useGameState";
import { loadDungeon, saveDungeon, bagSize, bagName, BINDLE, BACKPACK, type DungeonSave } from "@/lib/dungeon/run";

const MUTED = "rgba(255,255,255,0.5)";

export default function BagPage() {
  const game = useGameState();
  const [lab, setLab] = useState<DungeonSave | null>(null);
  useEffect(() => { setLab(loadDungeon()); }, []);

  if (!lab || !game.hydrated) return <DenFrame title="Bindle" icon="🎒"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const slots = bagSize(lab.meta);
  return (
    <DenFrame title={bagName(lab.meta)} icon="🎒">
      {/* One line on screen, the rest behind the "?", so the screen fits without scrolling. */}
      <div className="stone-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px" }}>
        <p style={{ fontSize: 13, color: "#c8c4b8", lineHeight: 1.4, margin: 0 }}>
          What you carry in the Labyrinth: <b>{slots} slots</b>, one thing each.
        </p>
        <Help title={bagName(lab.meta)}>
          <p>What you carry in the Labyrinth: <b>{slots} slots</b>, one thing each. Gold and creature cards take no space;
            potions, gear, codexes and materials take a slot (materials stack), including what you find, so choose what&apos;s worth bringing home.</p>
          <p>Packed gear can go on a creature between rooms, and a packed weapon can be swapped in mid-fight (it uses your turn).</p>
          {slots <= BINDLE && <p>It&apos;s only a bindle for now: a rugged backpack ({BACKPACK} slots) is on merchants&apos; carts, and in some storehouses.</p>}
        </Help>
      </div>
      <BagPacker game={game} lab={lab} onSave={(next) => { saveDungeon(next); setLab(next); }} />
    </DenFrame>
  );
}
