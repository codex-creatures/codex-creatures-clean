// lib/quest.ts
// The first quest: Klutz's stolen box.
//
// Klutz has been stashing weapons and armour he found in the Labyrinth in a
// box — and a Baby Cyclops ran off into the Labyrinth with it.
// 1. "start":    Klutz has something to tell you (talk to him).
// 2. "hunt":     into the Labyrinth: a short run of its own (questMap in
//                lib/dungeon/map.ts), one tunnel to a "?" room with Klutz's
//                old club in a rickety chest the fleeing thief rummaged
//                through (looted like any chest: a tutorial in the loot window
//                walks you through taking it and equipping it, by tap or by
//                drag), then one on to the thief itself (a guided fight: Klutz coaches you).
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

export type QuestStage = "start" | "hunt" | "boxFound" | "stash" | "lend" | "done";
export type QuestState = {
  stage: QuestStage;
  clubFound?: boolean; // Klutz's Club has been picked up
  box?: Drop[];        // the box's contents (from beating the thief until you hand it over)
};

export const NEW_QUEST: QuestState = { stage: "start" };
export const BOX_ROLLS = 10;
export const BOX_UNCOMMON = 0.2;

type Rng = () => number;
const pick = <T,>(a: readonly T[], rng: Rng) => a[Math.floor(rng() * a.length)];

export const klutzClub = (): Drop => weaponDrop("klutz_club", "common", "", { ...KLUTZ_CLUB_STATS });

// The room the club lies in (the first room of the quest run): a rickety
// chest, opened and looted like any other, with the club inside.
export const clubRoom = (): Room => ({ kind: "treasure", quest: "club", container: "chest", sack: [{ gear: klutzClub() }], done: false });
export const isClub = (it?: { itemKey?: string }) => it?.itemKey === "klutz_club";

// The thief: a Baby Cyclops (no gold: beating it gets you the box, and only
// the box). It's the guided first fight: your creature against it (with
// TUTORIAL_MOVES, and Klutz's club), while Klutz watches from the side and
// talks you through the triangle and damage types (TUTORIAL_STEPS in
// components/BattleScreen.tsx). So it's built to teach:
// - a melee brute (ranged moves do half: melee beats ranged);
// - a thick hide (THIEF_HIDE): Force moves bounce off, Pierce goes through,
//   and magic (which beats melee, and its hide does little against) hurts most;
// - lots of HP, but only a weak slap, so the lesson has time to land.
// (Sim, a Lv 3 Rare with the club: wins every time, about 6 rounds, most
// often with ~70% HP left — a 1 in 10 comes down to the last fifth.)
export const THIEF_HIDE = { mDef: 40, rDef: 30, magDef: 4, agility: 4 };
export const THIEF_LEVEL = 8;
export function thiefRoom(): Room {
  const thief: Enemy = {
    creatureId: "baby_cyclops", proficiency: { ...CREATURE_BY_ID.baby_cyclops.proficiency }, moves: ["Backhand"], level: THIEF_LEVEL,
    gear: [{ slot: "armor", key: "Thick hide", rarity: "rare", stats: { ...THIEF_HIDE }, drops: false }],
  };
  return { kind: "easy", quest: "thief", enemies: [thief], level: "easy", gold: 0, done: false };
}

// Your creature's moves in the guided fight (just for that fight): one for each lesson.
export const TUTORIAL_MOVES = ["Stone Throw", "Heavy Blow", "Impale", "Slash"];

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
