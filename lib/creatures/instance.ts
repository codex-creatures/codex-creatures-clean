// lib/creatures/instance.ts
// Turning a creature from your inventory into what it fights as: its species
// template plus its own rolled %s, its moves and its equipped gear.

import type { CreatureOrItemDrop } from "../types";
import { buildFighter } from "../combat/loadout";
import { wornArmor } from "../items/armor";
import { fighterEnchants } from "../items/enchantments";
import type { ItemKey } from "../items/ceilings";
import { RESTYLED_SPECIES } from "./rosterV2";
import { defaultMoveNames, isRetiredMove, renamedMove, replaceRetired, resolveMoves, REUSED_NAMES, startingMoveCount, STARTING_MOVES, type CreatureProficiency, type CreatureTemplate, type Skill } from "./creatureData";

type Stats = Record<string, number> | undefined;

export function proficiencyOf(drop: CreatureOrItemDrop, t: CreatureTemplate): CreatureProficiency {
  // (One saved before a stat existed, the HP %, takes its species' value for it.)
  return drop.proficiency ? { ...t.proficiency, ...drop.proficiency } : t.proficiency;
}

// Combat V2's creatures start with 3 moves, and the rest of their kits need
// codexes (the user, 2026-10-26). One from before that (no moveSet) goes back
// to its starting 3 when the save loads; what it learned from codexes stays.
// Returns whether it changed (then its chosen move slots are cleared too).
export const MOVE_SET = 2;
export function upgradeMoveSet(c: CreatureOrItemDrop, t?: CreatureTemplate): boolean {
  if (c.moveSet === MOVE_SET || !t || startingMoveCount(t) !== STARTING_MOVES) return false;
  c.moves = defaultMoveNames(t);
  c.moveSet = MOVE_SET;
  return true;
}

// The plain moves were cut to the core ones on 2026-11-12 (the user): a
// creature that knows a retired move has it replaced by its closest core
// move, keeping as many moves as it had (replaceRetired). Ones it learned
// from codexes are dropped: it knows its core moves anyway.
// Returns the list with them replaced (the same list if none were).
export function retireMoves(names: string[] | undefined, t: CreatureTemplate): string[] | undefined {
  if (!names?.some((n) => isRetiredMove(renamedMove(n)) && !t.skills.some((m) => m.name === n))) return names;
  return replaceRetired(t, names.map(renamedMove));
}
export const retireLearned = (learned: string[] | undefined) => learned?.map(renamedMove).filter((n) => !isRetiredMove(n));

// Smite and Ambush were retired kit moves, and are now 2026-11 codex moves
// (REUSED_NAMES). A creature saved before those (no codexSet) has any old one
// wiped once, as the cut did (its closest core move); after that, a Smite or
// Ambush it knows is the new one. Returns whether its moves changed.
export const CODEX_SET = 1;
export function wipeReusedNames(c: { moves?: string[]; learned?: string[]; codexSet?: number }, t: CreatureTemplate): boolean {
  if (c.codexSet === CODEX_SET) return false;
  c.codexSet = CODEX_SET;
  if (c.learned) c.learned = c.learned.filter((n) => !(n in REUSED_NAMES));
  if (!c.moves?.some((n) => n in REUSED_NAMES)) return false;
  c.moves = replaceRetired(t, c.moves, REUSED_NAMES);
  return true;
}

// Six species changed style on 2026-10-27 (RESTYLED_SPECIES). One you
// already own (no styleSet) moves over once when the save loads: its defence
// and agility rolls stay, its attack %s become the species' new ones with
// its roll's attack gain or loss on the new main style, and it goes back to
// its new starting moves (codex moves of its old style no longer fit it).
// Returns whether its moves changed (then its chosen move slots are cleared too).
export const STYLE_SET = 1;
const ATTACK_KEYS = ["atk", "rng", "mag"] as const;
const MAIN_KEY = { melee: "atk", ranged: "rng", magic: "mag" } as const;
export function upgradeStyle(c: CreatureOrItemDrop, t?: CreatureTemplate): boolean {
  if (c.styleSet === STYLE_SET || !t) return false;
  c.styleSet = STYLE_SET;
  if (!RESTYLED_SPECIES.includes(t.id)) return false;
  if (c.proficiency) {
    const sum = (p: CreatureProficiency) => ATTACK_KEYS.reduce((n, k) => n + (p[k] ?? 0), 0);
    const gain = sum(c.proficiency) - sum(t.proficiency);
    const p = { ...c.proficiency };
    for (const k of ATTACK_KEYS) p[k] = t.proficiency[k];
    p[MAIN_KEY[t.cls]] = Math.max(0, p[MAIN_KEY[t.cls]] + gain);
    c.proficiency = p;
  }
  c.moves = defaultMoveNames(t);
  return true;
}

// The species' %s changed on 2026-11-25 (the user): no zeros (a 0 is 3 now)
// and the Glob's goo (its defences down). A creature or card you already own
// (no pctSet) moves over once on load: the change is added to its saved %s,
// so its own roll stays as it was. (Its HP % needs nothing: a saved creature
// without one takes its species'.)
export const PCT_SET = 1;
export const PCT_SHIFT_2026_11_25: Record<string, Partial<CreatureProficiency>> = {
  moss_wolf: { mag: 3 }, amber_wasp: { rng: 3, mag: 3 }, bellow_toad: { mag: 3 }, dire_wolf: { mag: 3 }, ironhide: { mag: 3 },
  cave_bat: { rng: 3, mag: 3 }, rust_beetle: { mag: 3 }, crystalback: { rng: 3 }, crystal_golem: { rng: 3 }, hollow_matriarch: { mag: 3 },
  dust_sprite: { rng: 3 }, flicker_wisp: { rng: 3 }, veilstalker: { rng: 3 }, the_watcher: { rng: 3 }, void_serpent: { rng: 3 },
  rattlebones: { mag: 3 }, shambler: { mag: 3 }, mr_shadows: { rng: 3 }, storm_phoenix: { mag: 3 }, thicket_archer: { mag: 3 },
  leafblade_scout: { mag: 3 }, aurelius: { mag: 3 }, swamp_witch: { rng: 3 }, sylvaran: { mag: 3 }, flame_imp: { rng: 3 },
  thunderhead: { rng: 3 }, deep_angler: { rng: 3 }, tunnel_wyrm: { rng: 3, mag: 3 }, plague_rat: { rng: 3, mag: 3 }, rotgut_fly: { mag: 3 },
  glob: { rng: 3, mag: 3, mdef: -6, rdef: -7, magdef: -18 }, dreadpox: { rng: 3 }, pale_rider: { rng: 3 },
};
export function upgradePcts(c: CreatureOrItemDrop, t?: CreatureTemplate) {
  if (c.pctSet === PCT_SET || !t) return;
  c.pctSet = PCT_SET;
  const shift = PCT_SHIFT_2026_11_25[t.id];
  if (!shift || !c.proficiency) return;
  const p = { ...c.proficiency };
  for (const [k, d] of Object.entries(shift) as [keyof CreatureProficiency, number][]) p[k] = Math.max(0, (p[k] ?? 0) + d);
  c.proficiency = p;
}

// A creature knows only the moves in its slots (the user, 2026-11-24: "moves a
// creature used to know should be removed": teaching a codex replaces a move
// for good; nothing waits in reserve). A save from before kept its born moves
// and every codex move beside its chosen slots: on load those are cut to the
// slots (the user's choice, option 1), and `learned` to the slot moves that
// came from codexes. Idempotent, so it runs on every load. Returns whether
// anything changed. (slots: its chosen move slots, loadout.moves.)
export function pruneMoves(c: { moves?: string[]; learned?: string[] }, slots: string[] | undefined, t: CreatureTemplate): boolean {
  const kept = resolveMoves(t, slots ?? c.moves).map((m) => m.name);
  const learned = (c.learned ?? []).filter((n) => kept.includes(n));
  const same = (a: string[] | undefined, b: string[]) => (a?.length ?? 0) === b.length && b.every((n, i) => a?.[i] === n);
  if (same(c.moves, kept) && (c.learned === undefined ? learned.length === 0 : same(c.learned, learned))) return false;
  c.moves = kept;
  if (c.learned !== undefined || learned.length) c.learned = learned;
  return true;
}

// Moves chosen in the move slots win; otherwise the creature's starting moves.
export function movesOf(drop: CreatureOrItemDrop, t: CreatureTemplate, chosen?: string[]): Skill[] {
  return resolveMoves(t, chosen ?? drop.moves);
}

// armor: the creature's armour pieces (helmet, chest, legs; missing = empty).
// weaponKey: the weapon's type, for its damage-type affinity. weaponItem: the
// weapon itself, for its enchantment (the armour pieces carry theirs).
export function fighterFor(drop: CreatureOrItemDrop, t: CreatureTemplate, weapon?: Stats, armor: (CreatureOrItemDrop | undefined)[] = [], chosenMoves?: string[], weaponKey?: ItemKey, weaponItem?: CreatureOrItemDrop) {
  const worn = wornArmor(armor);
  const f = buildFighter(t, weapon, worn.stats, chosenMoves ?? drop.moves, drop.proficiency, worn.set, weaponKey, drop.level ?? 1, drop.ascended ?? 0);
  const enchant = fighterEnchants(weaponItem, armor);
  // (Its own name, if you gave it one: lib/creatures/nickname.ts.)
  return { ...f, ...(drop.nick ? { name: drop.nick } : {}), ...(drop.soulStone ? { soulStone: drop.soulStone } : {}), ...(enchant ? { enchant } : {}) };
}
