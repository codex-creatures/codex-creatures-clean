// lib/tavern.ts
// The tavern questline (docs/design.md §9), stage by stage. Built so far:
// 1. Klutz's quest. Once any of your creatures is Lv QUEST_CREATURE_LEVEL
//    and Klutz is Lv QUEST_KLUTZ_LEVEL (only won hunts give him XP, so his
//    level is the record of having hunted), he has news (a ❗), unless he's
//    out hunting: then it waits until he's home. Talking to him gives the
//    quest, once.
// 2. The storehouse. From then until you've got the dynamite, each run's
//    first large room is a Storehouse, marked on the scroll from the start,
//    with the dynamite among its crates (lib/dungeon/map.ts: rollMap). Taking
//    it is for good: it needs no bag slot and comes home even if the run goes
//    wrong (there's no second stick), and rooms go back to normal.
// 3. The rubble. A heap on the Den's right-hand wall; the dynamite blows it
//    open (once), and a passage leads to a second room: the tavern's.
// 4. The tavern stands there broken, a Cyclops wanted poster already up. The
//    first time you see it Klutz has something to say (once).
// 5. The repair: REPAIR_COST in materials, taken once, and it's restored.
// (Next: the Cyclops bounty, the head, the bookcase schematic.)
//
// Kept in its own field of the save (lib/save.ts: OWN_FIELDS), as both the
// Den (Klutz) and the Labyrinth (the dynamite) write it.

import { readSave, writeSaveField } from "./save";
import { addMaterials, canAfford, countMaterial, type MaterialKey, type Materials } from "./items/materials";

export const QUEST_CREATURE_LEVEL = 6;
export const QUEST_KLUTZ_LEVEL = 2;

export type TavernQuest = {
  accepted?: boolean; // Klutz has given you the quest
  dynamite?: boolean; // you've got the dynamite (for good)
  blasted?: boolean;  // the rubble's blown open: the tavern's room is open
  seen?: boolean;     // you've seen the tavern (and heard Klutz on it)
  repaired?: boolean; // the tavern's been repaired
  visitor?: Visitor;  // a wanderer calling at the tavern (who comes is rolled in stage 9, not built yet)
};
export type Visitor = "merchant" | "librarian";

// Who's in the tavern: only a repaired tavern has visitors. (A ❗ shows at the
// Den's doorway while someone's there.)
export const tavernVisitor = (t: TavernQuest): Visitor | undefined => (t.repaired ? t.visitor : undefined);

// What the repair takes.
export const REPAIR_COST: Materials = { metal_bars: 5, planks: 20, nails: 5 };

// Is Klutz's quest waiting for you to talk to him? firstQuestDone: his box is
// back and he's helping (lib/quest.ts: klutzHelping).
export function tavernQuestDue(t: TavernQuest, firstQuestDone: boolean, creatureLevels: number[], klutzLevel: number, klutzAway: boolean): boolean {
  return firstQuestDone && !t.accepted && !klutzAway
    && klutzLevel >= QUEST_KLUTZ_LEVEL && creatureLevels.some((l) => l >= QUEST_CREATURE_LEVEL);
}

// Should this run's large room be the dynamite's storehouse?
export const wantsStorehouse = (t: TavernQuest) => !!t.accepted && !t.dynamite;

// The rubble can be blown open once you've got the dynamite (and only once).
export const canBlast = (t: TavernQuest) => !!t.dynamite && !t.blasted;
export const blast = (t: TavernQuest): TavernQuest => (canBlast(t) ? { ...t, blasted: true } : t);

// The repair, material by material: what you have and what it needs.
export const repairNeeds = (have: Materials) =>
  (Object.entries(REPAIR_COST) as [MaterialKey, number][]).map(([key, need]) => ({ key, have: countMaterial(have, key), need }));
export const canRepair = (t: TavernQuest, have: Materials) => !!t.blasted && !t.repaired && canAfford(have, REPAIR_COST);
// Repair it: the tavern restored and your materials less the cost, or null
// if you can't (already repaired, or short of something).
export function repair(t: TavernQuest, have: Materials): { tavern: TavernQuest; materials: Materials } | null {
  if (!canRepair(t, have)) return null;
  const cost = Object.fromEntries(Object.entries(REPAIR_COST).map(([k, n]) => [k, -n!]));
  return { tavern: { ...t, repaired: true }, materials: addMaterials(have, cost) };
}

// ── Saved progress ───────────────────────────────────────────────────
export const TAVERN_FIELD = "tavern";

export function loadTavern(): TavernQuest {
  const t = readSave()[TAVERN_FIELD];
  return t && typeof t === "object" ? (t as TavernQuest) : {};
}

// Change it (read, change, write: whoever else wrote it meanwhile is kept).
export function updateTavern(fn: (t: TavernQuest) => TavernQuest): TavernQuest {
  const next = fn(loadTavern());
  writeSaveField(TAVERN_FIELD, next);
  return next;
}

// "Reset Player": the questline starts over.
export const clearTavern = () => writeSaveField(TAVERN_FIELD, undefined);
