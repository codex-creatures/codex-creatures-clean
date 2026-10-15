// lib/quest.ts
// The first quest: Klutz's stolen box.
//
// Klutz has been stashing weapons and armour he found in the Labyrinth in a
// box — and a Rattlebones ran off into the Labyrinth with it.
// 1. "start":    Klutz has something to tell you (talk to him).
// 2. "hunt":     into the Labyrinth. The first room has Klutz's old club on
//                the floor (pick it up, equip it). The first room you walk
//                into after that is the Rattlebones.
// 3. "boxFound": you beat it and have the box: take it back to Klutz.
// 4. "done":     he puts what was inside into your storage.
// The box holds BOX_ROLLS pieces of Common/Uncommon gear (Uncommon at
// BOX_UNCOMMON odds), rolled when you win — never anything better, so
// restarting the game for a lucky box isn't worth it.

import type { Drop } from "./types";
import type { Rarity } from "./items/budgets";
import { ITEM_KEYS, KLUTZ_CLUB_STATS } from "./items/ceilings";
import { ARMOR_KEYS, ARMOR_SLOTS } from "./items/armor";
import { weaponDrop, armorDrop } from "./drops";
import { rollItemStats } from "./items/rollItemStats";
import { rollArmorPiece } from "./items/rollArmorStats";
import type { Enemy, Room } from "./dungeon/run";
import { CREATURE_BY_ID } from "./creatures/creatureData";
import { rollCreature } from "./creatures/creatureRoll";

export type QuestStage = "start" | "hunt" | "boxFound" | "done";
export type QuestState = {
  stage: QuestStage;
  clubFound?: boolean; // Klutz's Club has been picked up
  box?: Drop[];        // the box's contents (from beating the Rattlebones until you hand it over)
};

export const NEW_QUEST: QuestState = { stage: "start" };
export const BOX_ROLLS = 10;
export const BOX_UNCOMMON = 0.2;

type Rng = () => number;
const pick = <T,>(a: readonly T[], rng: Rng) => a[Math.floor(rng() * a.length)];

export const klutzClub = (): Drop => weaponDrop("klutz_club", "common", "", { ...KLUTZ_CLUB_STATS });

// The room the club lies in (the start of your first run).
export const clubRoom = (): Room => ({ kind: "treasure", quest: "club", done: false });

// The thief: a lone Rattlebones with nothing but its bones.
export function rattlebonesRoom(rng: Rng = Math.random): Room {
  const roll = rollCreature(CREATURE_BY_ID.rattlebones, rng);
  const thief: Enemy = { creatureId: "rattlebones", proficiency: roll.proficiency, moves: roll.moves, gear: [] };
  return { kind: "easy", quest: "rattlebones", enemies: [thief], level: "easy", gold: 15, done: false };
}

// The box: Common gear, with the odd Uncommon (a weapon a third of the
// time, otherwise an armour piece).
export function rollBox(rng: Rng = Math.random): Drop[] {
  return Array.from({ length: BOX_ROLLS }, () => {
    const rarity: Rarity = rng() < BOX_UNCOMMON ? "uncommon" : "common";
    if (rng() < 1 / 3) {
      const key = pick(ITEM_KEYS, rng);
      return weaponDrop(key, rarity, "", rollItemStats(key, rarity, rng).stats);
    }
    const key = pick(ARMOR_KEYS, rng), slot = pick(ARMOR_SLOTS, rng);
    return armorDrop(key, rarity, "", rollArmorPiece(key, rarity, slot, rng), slot);
  });
}

// Is the quest waiting on something in the Labyrinth right now?
export const wantsClub = (q: QuestState) => (q.stage === "start" || q.stage === "hunt") && !q.clubFound;
export const wantsThief = (q: QuestState) => (q.stage === "start" || q.stage === "hunt") && !!q.clubFound;
// Klutz has something to say (a ❗ over his head).
export const klutzHasNews = (q: QuestState) => q.stage === "start" || q.stage === "boxFound";
