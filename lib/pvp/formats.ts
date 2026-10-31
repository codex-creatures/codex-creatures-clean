// lib/pvp/formats.ts
// Duels (live PvP, docs/design.md §12): the formats, the screen that keeps
// creatures and gear above a format's rarity out, and the timers.
//
// - Every creature fights at its format's level: above it, its stats are
//   scaled down to that level, below it scaled up (the user, 2026-10-31).
//   Its real level is untouched: the duel never changes your save.
// - The screen (the user, 2026-11-01): a creature over the format's rarity
//   can't be picked, and nor can one wearing gear over it (a Rare creature
//   with an Epic sword). Moves learned from codexes are fine, whatever their rarity.

import type { Rarity } from "../items/budgets";

export type PvpFormatId = "3v3-rare" | "5v5-rare" | "5v5-legendary";
export type PvpFormat = { id: PvpFormatId; name: string; size: number; maxRarity: Rarity; level: number };

export const PVP_FORMATS: Record<PvpFormatId, PvpFormat> = {
  "3v3-rare":      { id: "3v3-rare",      name: "3v3 · Rare · Lv 15",      size: 3, maxRarity: "rare",      level: 15 },
  // (The user, 2026-11-01: closer to what they can field while testing.)
  "5v5-rare":      { id: "5v5-rare",      name: "5v5 · Rare · Lv 15",      size: 5, maxRarity: "rare",      level: 15 },
  "5v5-legendary": { id: "5v5-legendary", name: "5v5 · Legendary · Lv 25", size: 5, maxRarity: "legendary", level: 25 },
};
export const PVP_FORMAT_IDS = Object.keys(PVP_FORMATS) as PvpFormatId[];
export const isFormatId = (v: unknown): v is PvpFormatId => typeof v === "string" && v in PVP_FORMATS;

// Timers, in seconds. Picking your team (the user's 20 s) and your first
// creature; each round's move (then a steady move is made for you, like a
// replacement after a knock-out: your first one standing).
export const PICK_SECONDS = 20;
export const LEAD_SECONDS = 20;
export const TURN_SECONDS = 30;
export const REPLACE_SECONDS = 20;
// How long the host waits past those for the other player's answer before
// choosing for them (a tab in the background runs its timers late).
export const GRACE_SECONDS = 10;
// The other player has left (closed the game, lost the connection): this
// long to come back, then you win.
export const GONE_SECONDS = 30;
// An invite not answered by then lapses.
export const INVITE_SECONDS = 60;

const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
export const rarityAllowed = (r: Rarity | undefined, f: PvpFormat) => !r || ORDER.indexOf(r) <= ORDER.indexOf(f.maxRarity);

// A creature as the screen sees it: its rarity and what it wears (weapon and
// armour pieces; empty slots left out).
export type PvpCandidate = { rarity: Rarity; gear: { name: string; rarity: Rarity }[] };

// Why a creature can't fight in this format, or null if it can.
export function ineligibleReason(c: PvpCandidate, f: PvpFormat): string | null {
  if (!rarityAllowed(c.rarity, f)) return `Too rare (${f.maxRarity} at most)`;
  const over = c.gear.find((g) => !rarityAllowed(g.rarity, f));
  return over ? `${over.name} is too rare` : null;
}

export const eligibleCount = (list: PvpCandidate[], f: PvpFormat) => list.filter((c) => !ineligibleReason(c, f)).length;
