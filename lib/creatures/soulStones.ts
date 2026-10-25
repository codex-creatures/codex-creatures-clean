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

import type { Drop, Rarity } from "../types";
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
// utility move to use it with (Divine: Mirage; Undead: Corpsify). The six new
// Combat V2 species' pools are Claude's drafts (2026-10-26).
export const POOLS: Record<string, SoulStoneKey[]> = {
  // Rare
  bellow_toad:      ["toxic_skin", "revitalise"],
  crystalback:      ["unstoppable_force", "revitalise"],
  veilstalker:      ["haunting_presence", "trickster"],
  dustwraith:       ["haunting_presence", "trickster"],
  aurelius:         ["perfectionist", "revitalise"],
  deep_angler:      ["haunting_presence", "perfectionist"],
  glob:             ["toxic_skin", "revitalise"],
  // Epic
  dire_wolf:        ["perfectionist", "unstoppable_force"],
  crystal_golem:    ["unstoppable_force", "revitalise"],
  the_watcher:      ["haunting_presence", "perfectionist", "trickster"],
  mr_shadows:       ["haunting_presence", "trickster"],
  swamp_witch:      ["toxic_skin", "revitalise"],
  tunnel_wyrm:      ["unstoppable_force", "revitalise"],
  dreadpox:         ["toxic_skin", "trickster"],
  // Legendary
  ironhide:         ["unstoppable_force", "perfectionist"],
  hollow_matriarch: ["toxic_skin", "haunting_presence", "revitalise"],
  void_serpent:     ["toxic_skin", "trickster", "haunting_presence"],
  storm_phoenix:    ["haunting_presence", "perfectionist", "revitalise"],
  sylvaran:         ["perfectionist", "revitalise"],
  thunderhead:      ["perfectionist", "unstoppable_force", "haunting_presence"],
  pale_rider:       ["haunting_presence", "trickster", "perfectionist"],
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

// ── Loose soul stones (the user, 2026-10-25) ────────────────────────────
// Found on their own: 1% of first-ever scans (SCAN_ODDS) and now and then in
// a boss's chest (lib/dungeon/run.ts). Each is one particular stone. It goes
// into any creature, from its window: free into an empty slot; replacing a
// stone costs SOUL_STONE_REPLACE_COST gold, and the old stone is destroyed.
export const SOUL_STONE_KEYS = Object.keys(SOUL_STONES) as SoulStoneKey[];
export const randomSoulStone = (rng: () => number = Math.random): SoulStoneKey => SOUL_STONE_KEYS[Math.floor(rng() * SOUL_STONE_KEYS.length)];
export const SOUL_STONE_REPLACE_COST = 5000;
export const setStoneCost = (current?: SoulStoneKey | null) => (current ? SOUL_STONE_REPLACE_COST : 0);

// Set loose stone `stoneId` in creature `creatureId`: the new inventory (the
// stone used up, any old stone gone) and the gold it costs, or null if it
// can't be done (no such creature or stone, or not enough gold).
export function setStoneIn(inventory: Drop[], creatureId: string, stoneId: string, gold: number): { inventory: Drop[]; cost: number } | null {
  const creature = inventory.find((d) => d.id === creatureId);
  const stone = inventory.find((d) => d.id === stoneId);
  const key = stone?.dropType === "item" ? stone.stone : undefined;
  if (creature?.dropType !== "creature" || !key) return null;
  const cost = setStoneCost(creature.soulStone);
  if (gold < cost) return null;
  return { cost, inventory: inventory.filter((d) => d.id !== stoneId).map((d) => (d.id === creatureId ? { ...d, soulStone: key } : d)) };
}
