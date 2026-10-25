// lib/creatures/soulStones.ts
// Soul stones (the user, 2026-10-25): a passive power some Rare, Epic and
// Legendary creatures are born with, shown under their weapon. They replaced
// the old abilities (Keen Eye, Divine Healing).
//
// - Only Rare or better, and not every one: SOUL_STONE_CHANCE by rarity
//   (cards too: a card's stone carries over when you summon from it).
// - Each species has a pool of at least 2 stones it can get (POOLS), so two
//   of the same creature can differ. Edit the pools freely.
// - A creature's stone is rolled with it. Creatures and cards from before
//   soul stones get theirs rolled once, the first time the save loads
//   (soulStoneOf: seeded by the drop's id, so every screen sees the same).
//   null means it rolled none.
//
// What each one does is in the battle engine (lib/combat/battle.ts).

import type { Rarity } from "../types";
import type { CreatureTemplate } from "./creatureData";

export type SoulStoneKey = "toxic_skin" | "haunting_presence" | "unstoppable_force" | "perfectionist" | "trickster" | "revitalise";

export const SOUL_STONES: Record<SoulStoneKey, { name: string; icon: string; text: string }> = {
  toxic_skin:        { name: "Toxic Skin",        icon: "☣️", text: "Hit by a melee attack: 50% to poison the attacker (5% of its max HP a turn for 3–5 turns, even on the bench)." },
  haunting_presence: { name: "Haunting Presence", icon: "👻", text: "When it comes in, 25% that the enemy is crippled with fear and loses its next attack." },
  unstoppable_force: { name: "Unstoppable Force", icon: "🪨", text: "Can't be crippled." },
  perfectionist:     { name: "Perfectionist",     icon: "🎯", text: "Each use of the same move in a row hits 10% harder than the last." },
  trickster:         { name: "Trickster",         icon: "🃏", text: "Its utility moves (Mirage, Corpsify) always go first." },
  revitalise:        { name: "Revitalise",        icon: "💚", text: "Swapped out to the bench, it heals 25% of its max HP." },
};

// The numbers (used by lib/combat/battle.ts).
export const TOXIC_SKIN = { chance: 0.5, tick: 0.05, minRounds: 3, maxRounds: 5 };
export const HAUNT_CHANCE = 0.25;
export const PERFECTIONIST_STEP = 0.1;
export const REVITALISE_HEAL = 0.25;

// Chance a Rare / Epic / Legendary is born with a stone.
export const SOUL_STONE_CHANCE: Partial<Record<Rarity, number>> = { rare: 0.25, epic: 0.6, legendary: 1 };

// The stones each species can have. Trickster only goes where the race has a
// utility move to use it with (Etherial: Mirage; Undead: Corpsify).
export const POOLS: Record<string, SoulStoneKey[]> = {
  // Rare
  bellow_toad:      ["toxic_skin", "revitalise"],
  crystalback:      ["unstoppable_force", "revitalise"],
  veilstalker:      ["haunting_presence", "trickster"],
  dustwraith:       ["haunting_presence", "trickster"],
  aurelius:         ["perfectionist", "revitalise"],
  // Epic
  dire_wolf:        ["perfectionist", "unstoppable_force"],
  crystal_golem:    ["unstoppable_force", "revitalise"],
  the_watcher:      ["haunting_presence", "perfectionist", "trickster"],
  mr_shadows:       ["haunting_presence", "trickster"],
  swamp_witch:      ["toxic_skin", "revitalise"],
  // Legendary
  ironhide:         ["unstoppable_force", "perfectionist"],
  hollow_matriarch: ["toxic_skin", "haunting_presence", "revitalise"],
  void_serpent:     ["toxic_skin", "trickster", "haunting_presence"],
  storm_phoenix:    ["haunting_presence", "perfectionist", "revitalise"],
  sylvaran:         ["perfectionist", "revitalise"],
};

export const stonesFor = (creatureId: string): SoulStoneKey[] => POOLS[creatureId] ?? [];

// A new creature's stone, if it gets one.
export function rollSoulStone(t: CreatureTemplate, rng: () => number = Math.random): SoulStoneKey | undefined {
  const pool = stonesFor(t.id);
  const chance = SOUL_STONE_CHANCE[t.rarity] ?? 0;
  if (pool.length === 0 || rng() >= chance) return undefined;
  return pool[Math.floor(rng() * pool.length)];
}

// A small seeded random (so a creature from before soul stones always rolls
// the same stone, whichever screen loads it first).
function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let x = h;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// A creature's (or card's) stone, rolling one for an old one that never had
// the chance: the key, or null for none.
export function soulStoneOf(drop: { id: string; soulStone?: SoulStoneKey | null }, t: CreatureTemplate | undefined): SoulStoneKey | null {
  if (drop.soulStone !== undefined) return drop.soulStone;
  return (t && rollSoulStone(t, seeded(drop.id))) ?? null;
}
