// lib/items/enchantments.ts
// Enchantments (the user, 2026-11-16, decision 46; docs/design/items.md §3):
// marginal edges on Rare, Epic and Legendary weapons and armour, one an item.
// They're rolled apart from the stat budget, so the stat roller doesn't change.
//
// - Weapons: Bounty, Scholar's, Bossbane, Leeching (meant for the Labyrinth),
//   Keen, Piercing, Vampiric (meant for PvP).
// - Armour: a stat on top of the budget (Ironbound, Shielded, Runed, Stalwart,
//   Fleet), Cleansing and Victorious.
// They all work in every fight (the user, 2026-11-16): one with nothing to do
// there (Bounty in a duel: no gold) just does nothing.
//
// Where they come from: scans SCAN_ENCHANT of the time (the global registry's
// rules carry it), any Labyrinth chest that holds weapons or armour
// CHEST_ENCHANT, golden chests always. Never from foes' own gear, merchants,
// Klutz or daily quests: those make their gear without it.
// A drop keeps its enchantment as `enchant` (missing: none, as in every old save).

import type { Drop, ItemCategory, Rarity } from "../types";

export type EnchantKey =
  | "bounty" | "scholars" | "bossbane" | "leeching" | "keen" | "piercing" | "vampiric"
  | "ironbound" | "shielded" | "runed" | "stalwart" | "fleet" | "cleansing" | "victorious";
// A stat enchantment's stat (the item stat names: lib/combat/loadout.ts maps them).
type StatKey = "mDef" | "rDef" | "magDef" | "hp" | "agility";

type EnchantInfo = {
  name: string;
  on: "weapon" | "armor";
  values: [number, number, number];      // Rare / Epic / Legendary (shares, or stat points)
  stat?: StatKey;                        // a stat on top of the budget
  text: (v: number) => string;           // its one-line effect
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
export const ENCHANTS: Record<EnchantKey, EnchantInfo> = {
  bounty:     { name: "Bounty",     on: "weapon", values: [0.1, 0.15, 0.2],    text: (v) => `+${pct(v)} of a Labyrinth fight's gold, if its wielder dealt damage.` },
  scholars:   { name: "Scholar's",  on: "weapon", values: [0.1, 0.15, 0.2],    text: (v) => `+${pct(v)} XP for its wielder.` },
  bossbane:   { name: "Bossbane",   on: "weapon", values: [0.04, 0.06, 0.08],  text: (v) => `+${pct(v)} damage to bosses.` },
  leeching:   { name: "Leeching",   on: "weapon", values: [0.03, 0.04, 0.05],  text: (v) => `Heals ${pct(v)} of the damage it deals.` },
  keen:       { name: "Keen",       on: "weapon", values: [0.06, 0.08, 0.1],   text: (v) => `Precise hit chance ${pct(v)} (from 5%).` },
  piercing:   { name: "Piercing",   on: "weapon", values: [0.06, 0.08, 0.1],   text: (v) => `Ignores ${pct(v)} of the target's defence.` },
  vampiric:   { name: "Vampiric",   on: "weapon", values: [0.02, 0.03, 0.05],  text: (v) => `Heals ${pct(v)} of the damage it deals.` },
  ironbound:  { name: "Ironbound",  on: "armor", stat: "mDef",    values: [5, 10, 20], text: (v) => `+${v} melee defence.` },
  shielded:   { name: "Shielded",   on: "armor", stat: "rDef",    values: [5, 10, 20], text: (v) => `+${v} ranged defence.` },
  runed:      { name: "Runed",      on: "armor", stat: "magDef",  values: [5, 10, 20], text: (v) => `+${v} magic defence.` },
  stalwart:   { name: "Stalwart",   on: "armor", stat: "hp",      values: [5, 10, 20], text: (v) => `+${v} HP.` },
  fleet:      { name: "Fleet",      on: "armor", stat: "agility", values: [5, 10, 20], text: (v) => `+${v} agility.` },
  cleansing:  { name: "Cleansing",  on: "armor", values: [0.02, 0.03, 0.05], text: (v) => `${pct(v)} a round to shake off its latest harmful effect (pieces add up).` },
  victorious: { name: "Victorious", on: "armor", values: [0.02, 0.03, 0.05], text: (v) => `Heals ${pct(v)} of max HP when a foe falls while it's out (pieces add up).` },
};
export const ENCHANT_KEYS = Object.keys(ENCHANTS) as EnchantKey[];

// The odds of an enchantment on a Rare or better weapon or armour piece, by where it's found.
export const SCAN_ENCHANT = 0.25;
export const CHEST_ENCHANT = 0.1;
export const GOLDEN_ENCHANT = 1;

// The rarities that can carry one, and where each sits in an enchantment's values.
const TIER: Partial<Record<Rarity, 0 | 1 | 2>> = { rare: 0, epic: 1, legendary: 2 };

// (Anything with these: a drop, an armour piece being summed.)
type Gear = { itemCategory?: ItemCategory; rarity?: Rarity; enchant?: EnchantKey };
const slotOf = (g: Gear) => (g.itemCategory === "weapon" ? "weapon" : g.itemCategory === "armor" ? "armor" : undefined);
export const canEnchant = (g: Gear) => !!slotOf(g) && !!g.rarity && TIER[g.rarity] !== undefined;

// An item's enchantment, if it has one that fits it (anything else in a save counts as none).
export function enchantOf(g: Gear | undefined): EnchantKey | undefined {
  const k = g?.enchant;
  return k && k in ENCHANTS && canEnchant(g!) && ENCHANTS[k].on === slotOf(g!) ? k : undefined;
}
export const enchantValue = (k: EnchantKey, rarity: Rarity) => ENCHANTS[k].values[TIER[rarity] ?? 0];
export const enchantText = (k: EnchantKey, rarity: Rarity) => ENCHANTS[k].text(enchantValue(k, rarity));

// The enchantments an item can roll: every one for its kind, each as likely.
// but: one to leave out (the Enchantress rerolls to a different one).
export const enchantPool = (g: Gear, but?: EnchantKey) =>
  ENCHANT_KEYS.filter((k) => ENCHANTS[k].on === slotOf(g) && k !== but);
export function rollEnchant(g: Gear, rng: () => number = Math.random, but?: EnchantKey): EnchantKey {
  const pool = enchantPool(g, but);
  return pool[Math.floor(rng() * pool.length)];
}

// A drop as found: a Rare or better weapon or armour piece is enchanted `chance`
// of the time. (Anything else, and the RNG isn't touched.)
export function enchanted<D extends Drop | null>(d: D, chance: number, rng: () => number = Math.random): D {
  if (!d || d.dropType !== "item" || !canEnchant(d) || chance <= 0) return d;
  if (chance < 1 && rng() >= chance) return d;
  return { ...d, enchant: rollEnchant(d, rng) };
}

// ── In a fight ─────────────────────────────────────────────────────
// What a creature's gear gives it, as shares (lib/combat/battle.ts uses them).
// Stat enchantments aren't here: they go on the armour's stats (armourStats).
export type FighterEnchants = Partial<Record<"bounty" | "scholars" | "bossbane" | "leeching" | "keen" | "piercing" | "vampiric" | "cleansing" | "victorious", number>>;
export function fighterEnchants(weapon: Gear | undefined, armour: (Gear | undefined)[]): FighterEnchants | undefined {
  const out: FighterEnchants = {};
  for (const g of [weapon, ...armour]) {
    const k = enchantOf(g);
    if (!k || ENCHANTS[k].stat) continue;
    const key = k as keyof FighterEnchants;
    out[key] = (out[key] ?? 0) + enchantValue(k, g!.rarity!); // (armour pieces add up)
  }
  return Object.keys(out).length ? out : undefined;
}

// An armour piece's stat enchantment, as stats to add to the piece's own.
export function enchantStats(g: Gear | undefined): Record<string, number> {
  const k = enchantOf(g);
  const stat = k && ENCHANTS[k].stat;
  return stat ? { [stat]: enchantValue(k, g!.rarity!) } : {};
}

// ── After a Labyrinth fight ────────────────────────────────────────
// Bounty: the fight's own gold (not a chest's), with each Bounty weapon whose
// wielder dealt damage in it on top (they add up). dealt: by team index.
export const bountiful = (gold: number, team: { enchant?: FighterEnchants }[], dealt: boolean[]) =>
  Math.round(gold * (1 + team.reduce((n, f, i) => n + (dealt[i] ? f.enchant?.bounty ?? 0 : 0), 0)));

// An enchanted item sells for this much more (the user, 2026-11-16).
export const ENCHANT_SELL_BONUS = 1.2;
// Scholar's: a creature's share of the fight's XP, with its weapon's on top.
export const scholarly = (xp: number, f?: { enchant?: FighterEnchants }) => Math.round(xp * (1 + (f?.enchant?.scholars ?? 0)));
