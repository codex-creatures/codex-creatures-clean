"use client";
// hooks/useDungeonSave.ts
// The Labyrinth screen's save plumbing (app/dungeon/page.tsx): the run's state, saved after every
// change, and the helpers every handler uses to change it (the run, the bag), to look up what a bag
// entry holds, and to carry what you find. Moved out of the page as it was.

import { useState } from "react";
import type { useGameState, EquipSlot } from "@/hooks/useGameState";
import type { CreatureOrItemDrop, Drop } from "@/lib/types";
import {
  ROOM_INFO, gearIdOf, lootIdOf, loadDungeon, saveDungeon, stowDrop, usedUp, wipedOut,
  type BagEntry, type DungeonRun, type DungeonSave, type PotionKey,
} from "@/lib/dungeon/run";

export function useDungeonSave(game: ReturnType<typeof useGameState>) {
  const [lab, setLab] = useState<DungeonSave | null>(null);

  // Every change to the run is saved straight away.
  function update(next: DungeonSave) {
    saveDungeon(next);
    setLab(next);
  }
  // Nobody left standing means the run is over (you wake up in the Den).
  function updateRun(fn: (r: DungeonRun) => DungeonRun) {
    const cur = loadDungeon();
    if (!cur.run) return;
    const next = fn(cur.run);
    update({ ...cur, run: wipedOut(next) ? { ...next, status: "dead" } : next });
  }
  function updateBag(fn: (bag: BagEntry[]) => BagEntry[]) {
    const cur = loadDungeon();
    update({ ...cur, meta: { ...cur.meta, bag: fn(cur.meta.bag ?? []) } });
  }
  // A potion drunk: out of the bag, and (if it was found this run) out of the haul.
  const takeOne = (key: PotionKey) => {
    const cur = loadDungeon();
    const i = cur.meta.bag.indexOf(key);
    if (i < 0) return;
    update({ meta: { ...cur.meta, bag: [...cur.meta.bag.slice(0, i), ...cur.meta.bag.slice(i + 1)] }, run: cur.run && { ...cur.run, got: usedUp(cur.run.got, { potion: key }) } });
  };

  // What a bag entry holds: gear is one of your items (in storage); loot was
  // found this run and is kept in the bag until you get home.
  const itemsById = new Map(game.inventory.filter((x) => x.dropType === "item").map((x) => [x.id, x as CreatureOrItemDrop]));
  function itemOf(e: BagEntry, meta = lab?.meta): CreatureOrItemDrop | undefined {
    const g = gearIdOf(e);
    if (g) return itemsById.get(g);
    const l = lootIdOf(e);
    return l ? (meta?.loot?.[l] as CreatureOrItemDrop | undefined) : undefined;
  }
  const slotOf = (it: CreatureOrItemDrop): EquipSlot | null =>
    it.itemCategory === "weapon" ? "weapon" : it.itemCategory === "armor" && it.armorSlot ? it.armorSlot : null;

  // Found something. Gold and creature cards take no space (and real
  // creatures aren't found lying about: they come as cards — an
  // encampment's cages are the exception, see openCage). Everything else
  // needs a slot (a material joins its stack if you have one); if the bag's
  // full it waits for you to make room. Materials join your tally at home.
  function carry(drops: Drop[]) {
    const cur = loadDungeon();
    let meta: DungeonSave["meta"] = { ...cur.meta, bag: [...(cur.meta.bag ?? [])], loot: { ...(cur.meta.loot ?? {}) } };
    const pending: Drop[] = [];
    for (const raw of drops) {
      const x = (raw.dropType === "creature" ? { ...raw, dropType: "card" } : raw) as Drop;
      if (x.dropType === "reward") { game.addGold(x.amount); continue; }
      if (x.dropType === "card") { game.addDrop(x); continue; }
      const next = stowDrop(meta, x); // (a potion goes straight in the bag, ready to drink)
      if (next) meta = next; else pending.push(x);
    }
    update({ meta, run: cur.run ? { ...cur.run, pending: [...(cur.run.pending ?? []), ...pending] } : null });
  }

  // Where you are, for things left on the floor.
  const here = (r: DungeonRun) => (r.current ? ROOM_INFO[r.current.kind].name : "the entrance");

  return { lab, setLab, update, updateRun, updateBag, takeOne, itemsById, itemOf, slotOf, carry, here };
}
