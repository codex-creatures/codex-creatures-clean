// lib/items/enchantments.ts
// Enchantments (the user, 2026-11-16, decision 46; docs/design/items.md §3):
// marginal edges on Rare, Epic and Legendary weapons and armour, one an item.
// They're rolled apart from the stat budget, so the stat roller doesn't change.
//
// - Weapons, the Labyrinth only (PvE): Bounty, Scholar's, Bossbane, Leeching.
// - Weapons, PvP only: Keen, Piercing, Vampiric.
// - Armour, everywhere: a stat on top of the budget (Ironbound, Shielded,
//   Runed, Stalwart, Fleet), Cleansing and Victorious.
//
// Where they come from: scans SCAN_ENCHANT of the time (the global registry's
// rules carry it), Labyrinth chests CHEST_ENCHANT, golden chests always. Never
// from foes, merchants, Klutz or daily quests: those make their gear without it.
// A drop keeps its enchantment as `enchant` (missing: none, as in every old save).

import type { Drop, ItemCategory, Rarity } from "../types";

export type EnchantKey =
  | "bounty" | "scholars" | "bossbane" | "leeching" | "keen" | "piercing" | "vampiric"
  | "ironbound" | "shielded" | "runed" | "stalwart" | "fleet" | "cleansing" | "victorious";
// Where an enchantment works: the Labyrinth, PvP, or both.
export type EnchantMode = "pve" | "pvp";
// A stat enchantment's stat (the item stat names: lib/combat/loadout.ts maps them).
type StatKey = "mDef" | "rDef" | "magDef" | "hp" | "agility";

type EnchantInfo = {
  name: string;
  on: "weapon" | "armor";
  mode?: EnchantMode;                    // missing: works everywhere
  values: [number, number, number];      // Rare / Epic / Legendary (shares, or stat points)
  stat?: StatKey;                        // a stat on top of the budget
  text: (v: number) => string;           // its one-line effect
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
export const ENCHANTS: Record<EnchantKey, EnchantInfo> = {
  bounty:     { name: "Bounty",     on: "weapon", mode: "pve", values: [0.1, 0.15, 0.2],    text: (v) => `+${pct(v)} gold from Labyrinth fights it's in.` },
  scholars:   { name: "Scholar's",  on: "weapon", mode: "pve", values: [0.1, 0.15, 0.2],    text: (v) => `+${pct(v)} XP for its wielder in the Labyrinth.` },
  bossbane:   { name: "Bossbane",   on: "weapon", mode: "pve", values: [0.04, 0.06, 0.08],  text: (v) => `+${pct(v)} damage to bosses.` },
  leeching:   { name: "Leeching",   on: "weapon", mode: "pve", values: [0.03, 0.04, 0.05],  text: (v) => `Heals ${pct(v)} of the damage it deals, in the Labyrinth.` },
  keen:       { name: "Keen",       on: "weapon", mode: "pvp", values: [0.06, 0.08, 0.1],   text: (v) => `Precise hit chance ${pct(v)} (from 5%), in PvP.` },
  piercing:   { name: "Piercing",   on: "weapon", mode: "pvp", values: [0.06, 0.08, 0.1],   text: (v) => `Ignores ${pct(v)} of the target's defence, in PvP.` },
  vampiric:   { name: "Vampiric",   on: "weapon", mode: "pvp", values: [0.02, 0.03, 0.05],  text: (v) => `Heals ${pct(v)} of the damage it deals, in PvP.` },
  ironbound:  { name: "Ironbound",  on: "armor", stat: "mDef",    values: [5, 10, 20], text: (v) => `+${v} melee defence.` },
  shielded:   { name: "Shielded",   on: "armor", stat: "rDef",    values: [5, 10, 20], text: (v) => `+${v} ranged defence.` },
  runed:      { name: "Runed",      on: "armor", stat: "magDef",  values: [5, 10, 20], text: (v) => `+${v} magic defence.` },
  stalwart:   { name: "Stalwart",   on: "armor", stat: "hp",      values: [5, 10, 20], text: (v) => `+${v} HP.` },
  fleet:      { name: "Fleet",      on: "armor", stat: "agility", values: [5, 10, 20], text: (v) => `+${v} agility.` },
  cleansing:  { name: "Cleansing",  on: "armor", values: [0.02, 0.03, 0.05], text: (v) => `${pct(v)} a round to shake off its latest harmful effect (pieces add up).` },
  victorious: { name: "Victorious", on: "armor", values: [0.02, 0.03, 0.05], text: (v) => `Heals ${pct(v)} of max HP when it knocks out a foe (pieces add up).` },
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
// Whether it works here (mode: where the fight is; none: neither the Labyrinth nor PvP).
export const enchantWorks = (k: EnchantKey, mode?: EnchantMode) => !ENCHANTS[k].mode || ENCHANTS[k].mode === mode;

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
// Only those that work in this fight (createBattle keeps these).
export function enchantsFor(e: FighterEnchants | undefined, mode?: EnchantMode): FighterEnchants | undefined {
  if (!e) return undefined;
  const kept = Object.entries(e).filter(([k]) => enchantWorks(k as EnchantKey, mode));
  return kept.length ? Object.fromEntries(kept) : undefined;
}

// An armour piece's stat enchantment, as stats to add to the piece's own.
export function enchantStats(g: Gear | undefined): Record<string, number> {
  const k = enchantOf(g);
  const stat = k && ENCHANTS[k].stat;
  return stat ? { [stat]: enchantValue(k, g!.rarity!) } : {};
}

// ── After a Labyrinth fight ────────────────────────────────────────
// Bounty: the fight's gold, with each Bounty weapon on the team that fought on top (they add up).
export const bountiful = (gold: number, team: { enchant?: FighterEnchants }[]) =>
  Math.round(gold * (1 + team.reduce((n, f) => n + (f.enchant?.bounty ?? 0), 0)));
// Scholar's: a creature's share of the fight's XP, with its weapon's on top.
export const scholarly = (xp: number, f?: { enchant?: FighterEnchants }) => Math.round(xp * (1 + (f?.enchant?.scholars ?? 0)));
