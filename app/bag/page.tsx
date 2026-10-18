"use client";
// app/bag/page.tsx
// Your bindle (later a rugged backpack): what you carry into the Labyrinth.
// Pack spare gear here: a weapon to swap in mid-fight (say, a Pierce weapon
// for a heavily armoured foe), or armour to change into between rooms.
// Potions come from merchants and stashes. Whatever you find down there
// needs a free slot to come home.

import { useEffect, useState } from "react";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { itemSprite } from "@/components/PixelSprite";
import BagSlots, { slotLook } from "@/components/BagSlots";
import { GearStatLine } from "@/components/GearCompare";
import { useGameState } from "@/hooks/useGameState";
import {
  loadDungeon, saveDungeon, bagSize, bagName, isPotionEntry, gearEntry, gearIdOf, lootIdOf, POTIONS, BINDLE, BACKPACK, BOOKCASE_SIZE,
  type BagEntry, type DungeonSave,
} from "@/lib/dungeon/run";
import { WEAPON_AFFINITY } from "@/lib/items/ceilings";
import { DAMAGE_TYPE_INFO } from "@/lib/creatures/creatureData";
import { ARMOR_SLOT_INFO } from "@/lib/items/armor";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { potionDrop } from "@/lib/drops";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

export default function BagPage() {
  const game = useGameState();
  const [lab, setLab] = useState<DungeonSave | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => { setLab(loadDungeon()); }, []);

  if (!lab || !game.hydrated) return <DenFrame title="Bindle" icon="🎒"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const bag = lab.meta.bag ?? [];
  const slots = bagSize(lab.meta);
  const gear = game.inventory.filter((d) => d.dropType === "item" && (d.itemCategory === "weapon" || d.itemCategory === "armor")) as CreatureOrItemDrop[];
  const byId = new Map(gear.map((w) => [w.id, w]));
  const packed = new Set(bag.map(gearIdOf).filter(Boolean) as string[]);
  // Spare gear: not on a creature (or Klutz) and not already packed.
  const spare = gear.filter((w) => !game.equippedOn.has(w.id) && !packed.has(w.id));
  // Potions in storage (from scans) can be packed too: they become bag potions.
  const potions = game.inventory.filter((d) => d.dropType === "item" && d.potion) as CreatureOrItemDrop[];
  const shelfFree = BOOKCASE_SIZE - game.inventory.filter((d) => d.dropType === "item" && d.codexMove).length;
  const save = (next: DungeonSave) => { saveDungeon(next); setLab(next); setSel(null); };
  const setBag = (next: BagEntry[]) => save({ ...lab, meta: { ...lab.meta, bag: next } });
  const away = !!lab.run;
  // Put a potion from the bag back into storage (the Inventory), freeing its slot.
  function store(i: number) {
    const e = bag[i];
    if (!isPotionEntry(e)) return;
    game.addDrop(potionDrop("", e));
    setBag(bag.filter((_, j) => j !== i));
  }

  // A codex that came home while the bookcase was full: shelve it once there's room.
  function shelve(e: BagEntry) {
    const id = lootIdOf(e);
    const x = id ? lab!.meta.loot?.[id] : undefined;
    if (!id || !x || shelfFree <= 0) return;
    game.addDrop(x);
    const loot = { ...(lab!.meta.loot ?? {}) };
    delete loot[id];
    save({ ...lab!, meta: { ...lab!.meta, bag: bag.filter((b) => b !== e), loot } });
  }

  const gearLine = (w: CreatureOrItemDrop) => {
    const aff = w.itemCategory === "weapon" && w.itemKey ? DAMAGE_TYPE_INFO[WEAPON_AFFINITY[w.itemKey]] : undefined;
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {itemSprite(w) && <PixelSprite sprite={itemSprite(w)!} scale={2} />}
        <span style={{ minWidth: 0 }}>
          <b style={{ color: RARITY_COLORS[w.rarity].text }}>{w.name}</b>
          <span style={{ fontSize: 12, color: MUTED, display: "block" }}>
            {w.rarity}{aff ? ` · ${aff.icon} ${aff.name}` : w.armorSlot ? ` · ${ARMOR_SLOT_INFO[w.armorSlot].name}` : ""}
          </span>
          <GearStatLine item={w} />
        </span>
      </span>
    );
  };

  return (
    <DenFrame title={bagName(lab.meta)} icon="🎒">
      <div className="stone-panel">
        <p style={{ fontSize: 13, color: "#c8c4b8", lineHeight: 1.5, margin: 0 }}>
          What you carry in the Labyrinth: <b>{slots} slots</b>, one thing each. Gold and creature cards take no space;
          potions, gear and codexes take a slot — including what you find, so choose what&apos;s worth bringing home.
          Packed gear can go on a creature between rooms, and a packed weapon can be swapped in mid-fight (it uses your turn).
          {slots <= BINDLE && <> It&apos;s only a bindle for now — beat the Cyclops to find a rugged backpack with {BACKPACK} slots.</>}
        </p>
      </div>

      <div className="pixel-font" style={{ fontSize: 15, color: GOLD, margin: "16px 0 8px" }}>Carrying ({bag.length}/{slots})</div>
      <BagSlots slots={slots} selected={sel} onSelect={setSel}
        looks={bag.map((e) => slotLook(e, isPotionEntry(e) ? undefined : byId.get(gearIdOf(e) ?? "") ?? (lootIdOf(e) ? (lab.meta.loot?.[lootIdOf(e)!] as CreatureOrItemDrop | undefined) : undefined)))} />
      {bag.length === 0 && <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>Empty — pack some spare gear below.</p>}
      {sel !== null && bag[sel] && (() => {
        const e = bag[sel];
        const own = byId.get(gearIdOf(e) ?? "");
        const found = lootIdOf(e) ? (lab.meta.loot?.[lootIdOf(e)!] as CreatureOrItemDrop | undefined) : undefined;
        return (
          <div className="card-btn" style={{ cursor: "default", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
            {isPotionEntry(e) ? <span>{POTIONS[e].icon} <b>{POTIONS[e].name}</b> <span style={{ fontSize: 12, color: MUTED }}>+{POTIONS[e].heal} HP</span></span>
              : own ? gearLine(own)
              : found ? <span>📖 <b>{found.name}</b> <span style={{ fontSize: 12, color: MUTED }}>— the bookcase was full</span></span>
              : <span style={{ color: MUTED }}>Something you no longer have</span>}
            {own && !away && <button className="chip" onClick={() => setBag(bag.filter((x) => x !== e))}>Take out</button>}
            {isPotionEntry(e) && !away && <button className="chip" onClick={() => store(sel)}>Store it</button>}
            {found && !away && <button className="chip" disabled={shelfFree <= 0} onClick={() => shelve(e)}>Put on the bookcase</button>}
          </div>
        );
      })()}
      {away && <p style={{ fontSize: 12, color: MUTED }}>You&apos;re in the middle of a Labyrinth run — repack when you&apos;re home.</p>}

      {!away && potions.length > 0 && (
        <>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD, margin: "18px 0 8px" }}>Potions in your Inventory</div>
          <div style={{ display: "grid", gap: 6 }}>
            {potions.map((x) => (
              <div key={x.id} className="card-btn" style={{ cursor: "default", justifyContent: "space-between", gap: 8 }}>
                <span>{POTIONS[x.potion!].icon} <b>{POTIONS[x.potion!].name}</b> <span style={{ fontSize: 12, color: MUTED }}>+{POTIONS[x.potion!].heal} HP</span></span>
                <button className="chip" disabled={bag.length >= slots} onClick={() => { game.removeDrop(x.id); setBag([...bag, x.potion!]); }}>Pack it</button>
              </div>
            ))}
          </div>
        </>
      )}

      {!away && (
        <>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD, margin: "18px 0 8px" }}>Spare gear</div>
          {spare.length === 0 ? (
            <p style={{ fontSize: 13, color: MUTED }}>No spare gear — everything you own is on a creature (or already packed).</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {spare.map((w) => (
                <div key={w.id} className="card-btn" style={{ cursor: "default", justifyContent: "space-between", gap: 8 }}>
                  {gearLine(w)}
                  <button className="chip" disabled={bag.length >= slots} onClick={() => setBag([...bag, gearEntry(w.id)])}>Pack it</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </DenFrame>
  );
}
