// lib/quest.ts
// The first quest: Klutz's stolen box.
//
// Klutz has been stashing weapons and armour he found in the Labyrinth in a
// box — and a Rattlebones ran off into the Labyrinth with it.
// 1. "start":    Klutz has something to tell you (talk to him).
// 2. "hunt":     into the Labyrinth: a short run of its own (questMap in
//                lib/dungeon/map.ts), one tunnel to a "?" room with Klutz's
//                old club on the floor, dropped by the fleeing Rattlebones
//                (pick it up; a tutorial walks you through equipping it from
//                your bag), then one on to the Rattlebones itself.
// 3. "boxFound": you beat it (no gold: the box is the prize), it drops the
//                box, you pick it up and head home.
// 4. "stash":    you open the box at Klutz's (like a Code Cache); its gear
//                goes into your storage, and Klutz sends you to look.
// 5. "lend":     you've opened your storage: Klutz asks to borrow some gear.
// 6. "done":     you agree: Klutz's gear, moves and hunting open up.
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

export type QuestStage = "start" | "hunt" | "boxFound" | "stash" | "lend" | "done";
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

// The room the club lies in (the first room of the quest run).
export const clubRoom = (): Room => ({ kind: "treasure", quest: "club", done: false });

// The thief: a lone Rattlebones with nothing but its bones (and no gold:
// beating it gets you the box, and only the box).
export function rattlebonesRoom(rng: Rng = Math.random): Room {
  const roll = rollCreature(CREATURE_BY_ID.rattlebones, rng);
  const thief: Enemy = { creatureId: "rattlebones", proficiency: roll.proficiency, moves: roll.moves, gear: [] };
  return { kind: "easy", quest: "rattlebones", enemies: [thief], level: "easy", gold: 0, done: false };
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
export const klutzHasNews = (q: QuestState) => q.stage === "start" || q.stage === "boxFound" || q.stage === "lend";
// Klutz will borrow your gear and hunt for you.
export const klutzHelping = (q: QuestState) => q.stage === "done";
