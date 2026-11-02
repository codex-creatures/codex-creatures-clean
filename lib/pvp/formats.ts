// lib/pvp/formats.ts
// Duels (live PvP, docs/design.md §12): the formats, the screen that keeps
// creatures and gear above a format's rarity out, and the timers.
//
// - Custom formats (the user, 2026-11-02): whoever invites picks the size
//   (3v3 or 5v5), the highest rarity, the level, and whether everyone's
//   scaled to that level. Not scaled (the default): a creature above the
//   level is scaled down to it, one below keeps its own level. Scaled: every
//   creature fights at exactly the level (as all duels did before). Its real
//   level is untouched either way: the duel never changes your save.
// - Bring 2 more (BRING_EXTRA, the user, 2026-11-02): each player brings up
//   to size + 2, both line-ups are shown, then each picks who fights.
// - The screen (the user, 2026-11-01): a creature over the format's rarity
//   can't be picked, and nor can one wearing gear over it (a Rare creature
//   with an Epic sword). Moves learned from codexes are fine, whatever their rarity.
//
// A format travels as its id (in the duel's link and the invite), e.g.
// "3v3-rare-15" or "5v5-legendary-25-scaled".

import type { Rarity } from "../items/budgets";

export type PvpFormatId = string;
export type PvpOptions = { size: number; maxRarity: Rarity; level: number; scaleUp: boolean };
export type PvpFormat = PvpOptions & { id: PvpFormatId; name: string };

// What can be chosen, and the default (3v3, Rare, up to Lv 15, not scaled).
export const PVP_SIZES = [3, 5];
export const PVP_RARITIES: Rarity[] = ["rare", "epic", "legendary"];
export const PVP_LEVELS = [15, 25];
export const DEFAULT_PVP: PvpOptions = { size: 3, maxRarity: "rare", level: 15, scaleUp: false };
export const BRING_EXTRA = 2;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
export function makeFormat(o: PvpOptions): PvpFormat {
  return {
    ...o,
    id: `${o.size}v${o.size}-${o.maxRarity}-${o.level}${o.scaleUp ? "-scaled" : ""}`,
    name: `${o.size}v${o.size} · ${cap(o.maxRarity)} · ${o.scaleUp ? "" : "up to "}Lv ${o.level}`,
  };
}

// The three formats before custom ones: their old ids still read (all scaled).
export const PVP_FORMATS: Record<string, PvpFormat> = {
  "3v3-rare":      makeFormat({ size: 3, maxRarity: "rare",      level: 15, scaleUp: true }),
  "5v5-rare":      makeFormat({ size: 5, maxRarity: "rare",      level: 15, scaleUp: true }),
  "5v5-legendary": makeFormat({ size: 5, maxRarity: "legendary", level: 25, scaleUp: true }),
};

// A format from its id, or null if it isn't one.
export function parseFormat(v: unknown): PvpFormat | null {
  if (typeof v !== "string") return null;
  if (v in PVP_FORMATS) return PVP_FORMATS[v];
  const m = /^(\d)v\1-([a-z]+)-(\d+)(-scaled)?$/.exec(v);
  if (!m) return null;
  const size = Number(m[1]), maxRarity = m[2] as Rarity, level = Number(m[3]);
  if (!PVP_SIZES.includes(size) || !PVP_RARITIES.includes(maxRarity) || !PVP_LEVELS.includes(level)) return null;
  return makeFormat({ size, maxRarity, level, scaleUp: !!m[4] });
}
export const isFormatId = (v: unknown): v is PvpFormatId => parseFormat(v) !== null;

// The level a creature fights at in this format.
export const duelLevel = (own: number, f: Pick<PvpOptions, "level" | "scaleUp">) => (f.scaleUp ? f.level : Math.min(Math.max(1, own), f.level));
// How many you bring: at least the format's size, at most BRING_EXTRA more.
export const bringMax = (f: PvpOptions) => f.size + BRING_EXTRA;

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
