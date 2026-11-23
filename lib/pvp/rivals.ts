// lib/pvp/rivals.ts
// The ranked ladder's simulated rivals (docs/design/online.md §12; the user,
// 2026-11-24): seven players made by playing the game's own rules with the
// AI (lib/pvp/rivalSim.ts, `npm run pvp:rivals`), kept here as fixed rosters
// (lib/pvp/rivals.json) so every player meets the same opponents, offline too.
// Each is a slice of a save: its creatures with the gear they wear and their
// move slots, plus a player's numbers (explorer level, runs, scans).
//
// A rival's team for a format is built the way a player's is (fighterFor),
// from its creatures within the format's rarity; a piece of gear above it
// is taken off first, as a player would swap it down.

import type { CreatureOrItemDrop, Drop } from "../types";
import { isCreatureDrop, isItemDrop } from "../types";
import type { Progress } from "../creatures/levels";
import { findCreatureTemplate } from "../creatures/creatureData";
import { creatureTypeLabel } from "../creatures/creatureType";
import { fighterFor } from "../creatures/instance";
import type { ItemKey } from "../items/ceilings";
import { ARMOR_META, ARMOR_SLOTS, wornArmor, type ArmorSlot } from "../items/armor";
import { RARITIES } from "../items/gear";
import { bringMax, duelLevel, rarityAllowed, type PvpFormat } from "./formats";
import type { DuelTeam } from "./duel";
import data from "./rivals.json";

// What a creature wears and fights with (the save's shape: hooks/useGameState.ts Loadout).
export type RivalLoadout = { weaponId?: string; helmetId?: string; chestId?: string; legsId?: string; moves?: string[] };

export type RivalStats = {
  scans: number;
  runs: Record<string, number>;   // by dungeon id
  clears: Record<string, number>;
  fights: number;
  wins: number;
  playTime: number;               // seconds, estimated from what it did
  species: number;
  gold: number;
};

export type Rival = {
  id: string;
  name: string;                   // shown with AI_SUFFIX
  seed: number;
  player: Progress;               // explorer level
  rating: number;                 // after its warm-up battles: the ladder's seed for it (the migration)
  stats: RivalStats;
  inventory: CreatureOrItemDrop[];
  equipment: Record<string, RivalLoadout>;
};

// How a rival's name is shown: plainly a machine (the user, 2026-11-24: "Blaze - AI").
export const AI_SUFFIX = " - AI";
export const rivalName = (r: Pick<Rival, "name">) => `${r.name}${AI_SUFFIX}`;

export const RIVALS: Rival[] = data as unknown as Rival[];
export const rivalById = (id: string) => RIVALS.find((r) => r.id === id);

const SLOT_FIELD: Record<ArmorSlot, "helmetId" | "chestId" | "legsId"> = { helmet: "helmetId", chest: "chestId", legs: "legsId" };
const order = (r: string | undefined) => RARITIES.indexOf((r ?? "common") as (typeof RARITIES)[number]);

// A rival's creatures as the format allows them: within its rarity, wearing
// only what's within it too. A piece too rare for the format comes off, and
// the best spare that fits goes on instead (as a player would swap down).
// Strongest first (level, then rarity).
export function rivalCandidates(r: Rival, f: PvpFormat) {
  const items = new Map(r.inventory.filter(isItemDrop).map((d) => [d.id, d]));
  const worn = new Set(Object.values(r.equipment).flatMap((l) => [l.weaponId, l.helmetId, l.chestId, l.legsId].filter((x): x is string => !!x)));
  const used = new Set<string>();
  const spare = (slot: "weapon" | ArmorSlot) => {
    const fitting = [...items.values()].filter((g) => !worn.has(g.id) && !used.has(g.id) && rarityAllowed(g.rarity, f) &&
      (slot === "weapon" ? g.itemCategory === "weapon" : g.itemCategory === "armor" && g.armorSlot === slot));
    const best = fitting.sort((a, b) => order(b.rarity) - order(a.rarity) || sumStats(b) - sumStats(a))[0];
    if (best) used.add(best.id);
    return best;
  };
  const sorted = r.inventory.filter(isCreatureDrop).filter((d) => rarityAllowed(d.rarity, f) && findCreatureTemplate(d.creatureId, d.name))
    .sort((a, b) => (b.level ?? 1) - (a.level ?? 1) || order(b.rarity) - order(a.rarity));
  return sorted.map((d) => {
    const l = r.equipment[d.id] ?? {};
    const fits = (id: string | undefined, slot: "weapon" | ArmorSlot) => { const g = id ? items.get(id) : undefined; return g && rarityAllowed(g.rarity, f) ? g : spare(slot); };
    return { drop: d, weapon: fits(l.weaponId, "weapon"), pieces: ARMOR_SLOTS.map((s) => fits(l[SLOT_FIELD[s]], s)), moves: l.moves };
  });
}
const sumStats = (g: CreatureOrItemDrop) => Object.values(g.stats ?? {}).reduce((a, b) => a + b, 0);

// The team a rival brings to a duel in this format: as many as may be
// brought, each fighting at the format's level. Empty if it can't fill the size.
export function rivalTeam(r: Rival, f: PvpFormat): DuelTeam {
  const picks = rivalCandidates(r, f).slice(0, bringMax(f));
  if (picks.length < f.size) return { fighters: [], info: [] };
  return {
    fighters: picks.map(({ drop, weapon, pieces, moves }) => {
      const at = { ...drop, level: duelLevel(drop.level ?? 1, f) };
      return fighterFor(at, findCreatureTemplate(drop.creatureId, drop.name)!, weapon?.stats, pieces, moves, weapon?.itemKey as ItemKey | undefined, weapon);
    }),
    info: picks.map(({ drop, weapon, pieces }) => {
      const t = findCreatureTemplate(drop.creatureId, drop.name)!;
      const worn = pieces.flatMap((p) => (p ? [p] : []));
      const set = wornArmor(pieces).set;
      return {
        rarity: drop.rarity, label: creatureTypeLabel(drop.proficiency ?? t.proficiency), creatureId: t.id,
        ...(weapon ? { weaponName: weapon.name } : {}),
        ...(set ? { armorName: `${ARMOR_META[set].name} (full set)` } : worn.length ? { armorName: worn.map((p) => p.name).join(", ") } : {}),
      };
    }),
  };
}

// Can this rival field a team in the format?
export const rivalFits = (r: Rival, f: PvpFormat) => rivalCandidates(r, f).length >= f.size;

// A rival's gear and creatures, for the Teams-style summary (what it has, by rarity).
export function rivalSummary(r: Rival) {
  const creatures = r.inventory.filter(isCreatureDrop);
  const top = [...creatures].sort((a, b) => (b.level ?? 1) - (a.level ?? 1)).slice(0, 5);
  return { creatures: creatures.length, top: top.map((d) => ({ name: d.name, level: d.level ?? 1, rarity: d.rarity })) };
}

export const isDrop = (x: unknown): x is Drop => !!x && typeof x === "object" && "dropType" in (x as object);
