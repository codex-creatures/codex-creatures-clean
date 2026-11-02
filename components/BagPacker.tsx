"use client";
// components/BagPacker.tsx
// Packing your bindle or backpack: its slots, the one picked (take it out or
// store it back), and what you can pack from your Inventory. Used in the
// Den's Bindle and at the Labyrinth's entrance (lib/dungeon/run.ts: the bag).

import { useState } from "react";
import PixelSprite, { itemSprite, PotionIcon } from "@/components/PixelSprite";
import { CODEX_SPRITE } from "@/lib/sprites/items";
import BagSlots, { slotLook } from "@/components/BagSlots";
import ItemPicker from "@/components/ItemPicker";
import { GearStatLine } from "@/components/GearCompare";
import type { useGameState } from "@/hooks/useGameState";
import {
  bagSize, isPotionEntry, gearEntry, gearIdOf, lootEntry, lootIdOf, POTIONS,
  type BagEntry, type DungeonSave,
} from "@/lib/dungeon/run";
import { WEAPON_AFFINITY } from "@/lib/items/ceilings";
import { DAMAGE_TYPE_INFO } from "@/lib/creatures/creatureData";
import { damageTypesOn } from "@/lib/combat/engine";
import { ARMOR_SLOT_INFO } from "@/lib/items/armor";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { potionDrop } from "@/lib/drops";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

// onSave: the labyrinth save with the bag changed (save it and show it).
export default function BagPacker({ game, lab, onSave }: {
  game: ReturnType<typeof useGameState>; lab: DungeonSave; onSave: (next: DungeonSave) => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const bag = lab.meta.bag ?? [];
  const slots = bagSize(lab.meta);
  const gear = game.inventory.filter((d) => d.dropType === "item" && (d.itemCategory === "weapon" || d.itemCategory === "armor")) as CreatureOrItemDrop[];
  const byId = new Map(gear.map((w) => [w.id, w]));
  const packed = new Set(bag.map(gearIdOf).filter(Boolean) as string[]);
  // Spare gear: not on a creature (or Klutz) and not already packed.
  const spare = gear.filter((w) => !game.equippedOn.has(w.id) && !packed.has(w.id));
  // Potions in storage (from scans) can be packed too: they become bag potions.
  const potions = game.inventory.filter((d) => d.dropType === "item" && d.potion) as CreatureOrItemDrop[];
  // …and so can flares and clairvoyance scrolls (bought at the tavern, or brought home from a run).
  const tools = game.inventory.filter((d) => d.dropType === "item" && d.tool) as CreatureOrItemDrop[];
  const shelfFree = game.bookcaseSize - game.inventory.filter((d) => d.dropType === "item" && d.codexMove).length;
  const save = (next: DungeonSave) => { onSave(next); setSel(null); };
  const setBag = (next: BagEntry[]) => save({ ...lab, meta: { ...lab.meta, bag: next } });
  const away = !!lab.run;
  // Put a potion from the bag back into storage (the Inventory), freeing its slot.
  function store(i: number) {
    const e = bag[i];
    if (!isPotionEntry(e)) return;
    game.addDrop(potionDrop("", e));
    setBag(bag.filter((_, j) => j !== i));
  }

  // Pack a flare or clairvoyance scroll from the Inventory: it travels as
  // found loot does; one not used comes home to the Inventory.
  function packTool(x: CreatureOrItemDrop) {
    game.removeDrop(x.id);
    save({ ...lab, meta: { ...lab.meta, bag: [...bag, lootEntry(x.id)], loot: { ...(lab.meta.loot ?? {}), [x.id]: x } } });
  }
  // A tool or a codex in the bag back to the Inventory (a codex only while the bookcase has room).
  function unpack(e: BagEntry) {
    const id = lootIdOf(e);
    const x = id ? lab.meta.loot?.[id] : undefined;
    if (!id || !x) return;
    game.addDrop(x);
    const loot = { ...(lab.meta.loot ?? {}) };
    delete loot[id];
    save({ ...lab, meta: { ...lab.meta, bag: bag.filter((b) => b !== e), loot } });
  }

  const gearLine = (w: CreatureOrItemDrop) => {
    // (A weapon's damage type only counts under the old rules: Combat V2 has none.)
    const aff = damageTypesOn() && w.itemCategory === "weapon" && w.itemKey ? DAMAGE_TYPE_INFO[WEAPON_AFFINITY[w.itemKey]] : undefined;
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
    <>
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
            {isPotionEntry(e) ? <span><PotionIcon kind={e} /><b>{POTIONS[e].name}</b> <span style={{ fontSize: 12, color: MUTED }}>+{POTIONS[e].heal} HP</span></span>
              : own ? gearLine(own)
              : found?.tool ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PixelSprite sprite={itemSprite(found)!} scale={1.25} /><b>{found.name}</b></span>
              : found ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PixelSprite sprite={CODEX_SPRITE} scale={1.25} /><b>{found.name}</b> <span style={{ fontSize: 12, color: MUTED }}>— the bookcase was full</span></span>
              : <span style={{ color: MUTED }}>Something you no longer have</span>}
            {(own || (!isPotionEntry(e) && !found)) && !away && <button className="chip" onClick={() => setBag(bag.filter((x) => x !== e))}>{own ? "Take out" : "Clear the slot"}</button>}
            {isPotionEntry(e) && !away && <button className="chip" onClick={() => store(sel)}>Store it</button>}
            {found?.tool && !away && <button className="chip" onClick={() => unpack(e)}>Store it</button>}
            {found && !found.tool && !away && <button className="chip" disabled={shelfFree <= 0} onClick={() => unpack(e)}>Put on the bookcase</button>}
          </div>
        );
      })()}
      {away && <p style={{ fontSize: 12, color: MUTED }}>You&apos;re in the middle of a Labyrinth run — repack when you&apos;re home.</p>}

      {/* What you can pack from your Inventory, laid out as in the chest: tap
          a thing to see it, then Pack it. (Gear on a creature isn't here.) */}
      {!away && (
        <>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD, margin: "18px 0 8px" }}>Pack from your Inventory</div>
          <ItemPicker emptyText="Nothing of this kind to pack (gear on a creature isn't here)." start="consumables" small
            tabs={[
              { key: "consumables", label: "Consumables", items: [...potions, ...tools] },
              { key: "weapons", label: "Weapons", items: spare.filter((w) => w.itemCategory === "weapon") },
              { key: "armor", label: "Armour", items: spare.filter((w) => w.itemCategory === "armor") },
            ]}
            action={(x) => (
              <button className="chip" style={{ minHeight: 44 }} disabled={bag.length >= slots}
                onClick={() => x.potion ? (game.removeDrop(x.id), setBag([...bag, x.potion])) : x.tool ? packTool(x) : setBag([...bag, gearEntry(x.id)])}>
                {bag.length >= slots ? "Bag full" : "Pack it"}
              </button>
            )} />
        </>
      )}
    </>
  );
}
