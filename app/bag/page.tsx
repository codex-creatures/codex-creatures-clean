"use client";
// app/bag/page.tsx
// Your pockets / battle bag: what you carry into the Labyrinth. Pack a spare
// weapon here to swap in mid-fight (say, a Pierce weapon for a heavily
// armoured foe). Potions come from merchants and stashes.

import { useEffect, useState } from "react";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { itemSprite } from "@/components/PixelSprite";
import { useGameState } from "@/hooks/useGameState";
import {
  loadDungeon, saveDungeon, bagSize, bagName, isPotionEntry, weaponEntry, weaponIdOf, POTIONS, POCKETS, FIRST_BAG,
  type BagEntry, type DungeonSave,
} from "@/lib/dungeon/run";
import { WEAPON_AFFINITY } from "@/lib/items/ceilings";
import { DAMAGE_TYPE_INFO } from "@/lib/creatures/creatureData";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

export default function BagPage() {
  const game = useGameState();
  const [lab, setLab] = useState<DungeonSave | null>(null);
  useEffect(() => { setLab(loadDungeon()); }, []);

  if (!lab || !game.hydrated) return <DenFrame title="Battle Bag" icon="🎒"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const bag = lab.meta.bag ?? [];
  const slots = bagSize(lab.meta);
  const weapons = game.inventory.filter((d) => d.dropType === "item" && d.itemCategory === "weapon") as CreatureOrItemDrop[];
  const byId = new Map(weapons.map((w) => [w.id, w]));
  const packed = new Set(bag.map(weaponIdOf).filter(Boolean) as string[]);
  // Spare weapons: not on a creature (or Klutz) and not already packed.
  const spare = weapons.filter((w) => !game.equippedOn.has(w.id) && !packed.has(w.id));
  const save = (next: BagEntry[]) => { const s = { ...lab, meta: { ...lab.meta, bag: next } }; saveDungeon(s); setLab(s); };
  const away = !!lab.run;

  const weaponLine = (w: CreatureOrItemDrop) => {
    const aff = w.itemKey ? DAMAGE_TYPE_INFO[WEAPON_AFFINITY[w.itemKey]] : undefined;
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {itemSprite(w) && <PixelSprite sprite={itemSprite(w)!} scale={2} />}
        <span style={{ minWidth: 0 }}>
          <b style={{ color: RARITY_COLORS[w.rarity].text }}>{w.name}</b>
          <span style={{ fontSize: 12, color: MUTED, display: "block" }}>{w.rarity}{aff ? ` · ${aff.icon} ${aff.name}` : ""}</span>
        </span>
      </span>
    );
  };

  return (
    <DenFrame title={bagName(lab.meta)} icon="🎒">
      <div className="stone-panel">
        <p style={{ fontSize: 13, color: "#c8c4b8", lineHeight: 1.5, margin: 0 }}>
          What you carry into the Labyrinth: <b>{slots} slots</b>, one thing each — a potion or a spare weapon.
          In a fight you can swap the weapon in (it uses your turn), say a Pierce weapon against something heavily armoured;
          the weapon you had goes back in the slot.
          {slots <= POCKETS && <> For now it&apos;s just your two pockets — beat a mini boss in the Labyrinth to find a proper bag with {FIRST_BAG} slots.</>}
        </p>
      </div>

      <div className="pixel-font" style={{ fontSize: 15, color: GOLD, margin: "16px 0 8px" }}>Carrying ({bag.length}/{slots})</div>
      <div style={{ display: "grid", gap: 6 }}>
        {Array.from({ length: slots }, (_, i) => {
          const e = bag[i];
          const w = e ? byId.get(weaponIdOf(e) ?? "") : undefined;
          return (
            <div key={i} className="card-btn" style={{ cursor: "default", justifyContent: "space-between", gap: 8 }}>
              {!e ? <span style={{ color: MUTED }}>— empty —</span>
                : isPotionEntry(e) ? <span>{POTIONS[e].icon} <b>{POTIONS[e].name}</b> <span style={{ fontSize: 12, color: MUTED }}>+{POTIONS[e].heal} HP</span></span>
                : w ? weaponLine(w) : <span style={{ color: MUTED }}>A weapon you no longer have</span>}
              {e && !isPotionEntry(e) && !away && (
                <button className="chip" onClick={() => save(bag.filter((x) => x !== e))}>Take out</button>
              )}
            </div>
          );
        })}
      </div>
      {away && <p style={{ fontSize: 12, color: MUTED }}>You&apos;re in the middle of a Labyrinth run — repack when you&apos;re home.</p>}

      {!away && (
        <>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD, margin: "18px 0 8px" }}>Spare weapons</div>
          {spare.length === 0 ? (
            <p style={{ fontSize: 13, color: MUTED }}>No spare weapons — everything you own is on a creature (or already packed).</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {spare.map((w) => (
                <div key={w.id} className="card-btn" style={{ cursor: "default", justifyContent: "space-between", gap: 8 }}>
                  {weaponLine(w)}
                  <button className="chip" disabled={bag.length >= slots} onClick={() => save([...bag, weaponEntry(w.id)])}>Pack it</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </DenFrame>
  );
}
