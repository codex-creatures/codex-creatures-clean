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
// (Next: the rubble in the Den, the tavern, its repair, the Cyclops bounty.)
//
// Kept in its own field of the save (lib/save.ts: OWN_FIELDS), as both the
// Den (Klutz) and the Labyrinth (the dynamite) write it.

import { readSave, writeSaveField } from "./save";

export const QUEST_CREATURE_LEVEL = 6;
export const QUEST_KLUTZ_LEVEL = 2;

export type TavernQuest = {
  accepted?: boolean; // Klutz has given you the quest
  dynamite?: boolean; // you've got the dynamite (for good)
};

// Is Klutz's quest waiting for you to talk to him? firstQuestDone: his box is
// back and he's helping (lib/quest.ts: klutzHelping).
export function tavernQuestDue(t: TavernQuest, firstQuestDone: boolean, creatureLevels: number[], klutzLevel: number, klutzAway: boolean): boolean {
  return firstQuestDone && !t.accepted && !klutzAway
    && klutzLevel >= QUEST_KLUTZ_LEVEL && creatureLevels.some((l) => l >= QUEST_CREATURE_LEVEL);
}

// Should this run's large room be the dynamite's storehouse?
export const wantsStorehouse = (t: TavernQuest) => !!t.accepted && !t.dynamite;

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
