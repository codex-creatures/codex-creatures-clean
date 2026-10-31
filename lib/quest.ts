// lib/quest.ts
// The first quest: Klutz's stolen box.
//
// Klutz has been stashing weapons and armour he found in the Labyrinth in a
// box — and a Baby Cyclops ran off into the Labyrinth with it.
// 0. A new player has no creature yet: Klutz's first words are that he
//    dragged you in out of the Labyrinth, and that he caught an evil
//    creature you can recruit. The cage glows until you do (the starter
//    waits in it: lib/creatures/starter.ts). (Still the "start" stage.)
// 1. "start":    Klutz has something to tell you (talk to him).
// 2. "hunt":     into the Labyrinth: a short run of its own (questMap in
//                lib/dungeon/map.ts), one tunnel to a "?" room with Klutz's
//                old club on the floor, dropped by the fleeing thief (picked
//                up like any loot: a tutorial in the loot window walks you
//                through taking it and equipping it, by tap or by drag), then
//                one on to the thief itself (a guided fight: Klutz coaches you
//                to use a move it's weak to, and shows you the race chart).
// 3. "boxFound": you beat it (no gold: the box is the prize), it drops the
//                box, you pick it up and head home.
// 4. "stash":    you open the box at Klutz's (like a Code Cache); its gear
//                goes into your storage, and Klutz sends you to look.
// 5. "lend":     you've opened your storage: Klutz asks to borrow some gear.
//                But first he has you kit out your own creature: some armour
//                from his box (the club alone doesn't count).
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
import { RACES_V2, type RaceV2 } from "./creatures/racesV2";
import { raceOfMove, raceVsAll } from "./combat/raceChart";

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

// The room the club lies in (the first room of the quest run): on the
// floor, picked up like any other loot (its sack: just the club).
export const clubRoom = (): Room => ({ kind: "treasure", quest: "club", sack: [{ gear: klutzClub() }], done: false });
export const isClub = (it?: { itemKey?: string }) => it?.itemKey === "klutz_club";

// The thief: a Baby Cyclops (no gold: beating it gets you the box, and only
// the box). It's the guided first fight: your creature against it, with its
// own moves (and Klutz's club), while Klutz watches from the side and talks
// you through races (tutorialSteps in components/BattleScreen.tsx). So it's
// built to teach:
// - its race is one your creature's moves are effective against (thiefRace;
//   the user, 2026-10-31), so Klutz can have you hit it with one of them;
// - no weapon or armour, but lots of HP (THIEF_HP_MULT) and only a weak
//   slap, so the lesson has time to land;
// - it can't knock your creature out (gentle: its slap leaves 1 HP), so you
//   always win (the user, 2026-10-26: a close one now and then had a Lv 3
//   starter down to 1% HP).
// (Sim, a Lv 3 Rare with the club and its own moves: 3–8 rounds, about 6; never a loss.)
export const THIEF_LEVEL = 8;
export const THIEF_HP_MULT = 2;
export function thiefRoom(race: RaceV2 = "humanoid"): Room {
  const thief: Enemy = {
    creatureId: "baby_cyclops", proficiency: { ...CREATURE_BY_ID.baby_cyclops.proficiency }, moves: ["Backhand"], level: THIEF_LEVEL,
    gear: [], hpMult: THIEF_HP_MULT, gentle: true, races: [race],
  };
  return { kind: "easy", quest: "thief", enemies: [thief], level: "easy", gold: 0, done: false };
}

// Does this move's race land well on these races?
export const effectiveOn = (move: { name: string }, races: readonly RaceV2[]) => {
  const r = raceOfMove(move);
  return !!r && raceVsAll(r, [...races]) > 1;
};

// The thief's race: one of the races your creature's moves are effective
// against (picked at random). With no race moves at all, Humanoid.
export function thiefRace(moves: readonly { name: string }[], rng: Rng = Math.random): RaceV2 {
  const weak = RACES_V2.filter((r) => moves.some((m) => effectiveOn(m, [r])));
  return weak.length ? pick(weak, rng) : "humanoid";
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
    return armorDrop(key, rarity, "", rollArmorPiece(key, rarity, rng), slot);
  });
}

// Is the quest waiting on something in the Labyrinth right now?
export const wantsClub = (q: QuestState) => (q.stage === "start" || q.stage === "hunt") && !q.clubFound;
export const wantsThief = (q: QuestState) => (q.stage === "start" || q.stage === "hunt") && !!q.clubFound;
// Klutz has something to say (a ❗ over his head).
export const klutzHasNews = (q: QuestState) => q.stage === "start" || q.stage === "boxFound" || q.stage === "lend";
// The intro: you haven't got a creature yet, so Klutz sends you to the cage.
export const needsFirstCreature = (q: QuestState, ownsCreature: boolean) => q.stage === "start" && !ownsCreature;
// Before he borrows gear, one of your creatures has to wear some armour.
type Worn = { helmetId?: string; chestId?: string; legsId?: string };
export const wearsArmour = (l?: Worn) => !!(l?.helmetId || l?.chestId || l?.legsId);
export const needsGearUp = (q: QuestState, loadouts: (Worn | undefined)[]) => q.stage === "lend" && !loadouts.some(wearsArmour);
// Once the box is open, you can skip the rest of the walk-through (looking in
// your Inventory, kitting out your creature): straight to Klutz hunting for you.
export const skipTutorial = (q: QuestState): QuestState => (q.stage === "stash" || q.stage === "lend" ? { ...q, stage: "done" } : q);
// Klutz will borrow your gear and hunt for you.
export const klutzHelping = (q: QuestState) => q.stage === "done";
