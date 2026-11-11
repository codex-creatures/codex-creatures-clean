// lib/creatures/raceKitsV2.ts
// Combat V2's core moves (the user, 2026-11-12). Every creature fights with
// the same three plain moves in each of its styles: a light one, a heavy one
// and one that always strikes first. They have no race of their own: each
// lands as its creature's main race (asRace), so the race chart still decides
// every hit. Everything else comes from codexes (race and special moves).
//
// Until 2026-11-12 each race had a kit of 5 moves per style (105 in all).
// Those are retired: RETIRED_KIT_MOVES turns each over to its closest core move.

import type { CombatClass, Skill } from "./creatureData";
import type { RaceV2 } from "./racesV2";

export type CoreSlot = "light" | "heavy" | "first";
export const CORE_SLOTS: CoreSlot[] = ["light", "heavy", "first"];

// Damage per energy as before: the light and heavy moves are the old kits'
// 20 and 50 energy moves; the first-strike move is dear for always going first.
export const CORE_NUMBERS: Record<CoreSlot, { damage: number; energyCost: number }> = {
  light: { damage: 10, energyCost: 20 },
  heavy: { damage: 25, energyCost: 50 },
  first: { damage: 15, energyCost: 50 },
};
// (The first-strike numbers, by their older name.)
export const NEUTRAL_QUICK_NUMBERS = CORE_NUMBERS.first;

// The light moves (the old kits' shared light move, by its older name).
export const BALANCED_MOVES: Record<CombatClass, Skill> = {
  melee:  { name: "Strike", ...CORE_NUMBERS.light, type: "melee",  dmgType: "force" },
  ranged: { name: "Shot",   ...CORE_NUMBERS.light, type: "ranged", dmgType: "force" },
  magic:  { name: "Zap",    ...CORE_NUMBERS.light, type: "magic",  dmgType: "force" },
};

// The heavy moves (the user, 2026-11-12; names are Claude's placeholders).
export const HEAVY_MOVES: Record<CombatClass, Skill> = {
  melee:  { name: "Smash",      ...CORE_NUMBERS.heavy, type: "melee",  dmgType: "force" },
  ranged: { name: "Power Shot", ...CORE_NUMBERS.heavy, type: "ranged", dmgType: "force" },
  magic:  { name: "Blast",      ...CORE_NUMBERS.heavy, type: "magic",  dmgType: "force" },
};

// The first-strike moves (the user, 2026-10-26): always first, and dear for
// it. (The older haste spell that was called Blink is now Quickcast.)
const quickDesc = "Always strikes first this round, whatever its agility (two of these: the faster goes first).";
export const NEUTRAL_QUICK_MOVES: Record<CombatClass, Skill> = {
  melee:  { name: "Rush",      ...CORE_NUMBERS.first, type: "melee",  dmgType: "force", effect: { kind: "quick" }, desc: quickDesc },
  ranged: { name: "Quickshot", ...CORE_NUMBERS.first, type: "ranged", dmgType: "force", effect: { kind: "quick" }, desc: quickDesc },
  magic:  { name: "Blink",     ...CORE_NUMBERS.first, type: "magic",  dmgType: "force", effect: { kind: "quick" }, desc: quickDesc },
};

const CORE: Record<CoreSlot, Record<CombatClass, Skill>> = { light: BALANCED_MOVES, heavy: HEAVY_MOVES, first: NEUTRAL_QUICK_MOVES };
const STYLES: CombatClass[] = ["melee", "ranged", "magic"];

// All 9, and a style's 3 (light, heavy, first).
export const CORE_MOVES: Skill[] = STYLES.flatMap((s) => CORE_SLOTS.map((slot) => CORE[slot][s]));
export const CORE_MOVE_NAMES = new Set(CORE_MOVES.map((m) => m.name));
export const coreMove = (style: CombatClass, slot: CoreSlot): Skill => CORE[slot][style];
// A style's core moves, landing as this race (none: neutral, as Klutz's do).
export const coreFor = (style: CombatClass, race?: RaceV2): Skill[] =>
  CORE_SLOTS.map((slot) => (race ? { ...CORE[slot][style], asRace: race } : CORE[slot][style]));

// The retired race kits' names, in slot order (light, medium, heavy, quick,
// precise), kept so saves that know one find its core move.
type Names = [string, string, string, string, string];
const RETIRED_KIT_NAMES: Record<RaceV2, Record<CombatClass, Names>> = {
  beast: {
    melee:  ["Claw Swipe", "Gore", "Maul", "Lunge", "Throat Bite"],
    ranged: ["Quill Shot", "Spine Volley", "Horn Hurl", "Snap Spit", "Stinger"],
    magic:  ["Wild Howl", "Feral Roar", "Primal Fury", "Startle", "Hunter's Mark"],
  },
  underkin: {
    melee:  ["Pick Strike", "Tunnel Rush", "Cave-in Slam", "Ambush", "Backstab"],
    ranged: ["Grit Sling", "Silk Shot", "Stalactite Drop", "Echo Dart", "Blind Shot"],
    magic:  ["Gloom Bolt", "Deep Dark", "Abyssal Grasp", "Shadow Flick", "Glowlure"],
  },
  geo: {
    melee:  ["Stone Fist", "Magma Punch", "Earthshaker", "Gust Strike", "Fault Line"],
    ranged: ["Hailstone", "Ember Sling", "Rockslide", "Wind Dart", "Ice Spike"],
    magic:  ["Spark Jolt", "Flame Burst", "Eruption", "Static Snap", "Lightning Lance"],
  },
  undead: {
    melee:  ["Bone Rake", "Grave Strike", "Death Grip", "Ghoul Lunge", "Marrow Pierce"],
    ranged: ["Bone Dart", "Wailing Arrow", "Corpse Volley", "Skull Toss", "Requiem Shot"],
    magic:  ["Chill Touch", "Soul Siphon", "Necrotic Wave", "Haunt", "Death Mark"],
  },
  divine: {
    melee:  ["Holy Strike", "Radiant Blade", "Judgement", "Swift Smite", "Righteous Thrust"],
    ranged: ["Light Arrow", "Sunlance", "Heaven's Volley", "Glint Shot", "Halo Shot"],
    magic:  ["Smite", "Sacred Flame", "Divine Wrath", "Flash", "Seraph's Gaze"],
  },
  humanoid: {
    melee:  ["Sword Cut", "Shield Bash", "Cleave", "Quick Draw", "Riposte"],
    ranged: ["Arrow", "Crossbow Bolt", "Longbow Volley", "Snap Shot", "Aimed Shot"],
    magic:  ["Magic Missile", "Arcane Bolt", "Mana Blast", "Cantrip", "True Strike"],
  },
  toxic: {
    melee:  ["Festering Bite", "Rot Claw", "Plague Smash", "Gnaw", "Infect"],
    ranged: ["Bile Spit", "Blight Spray", "Swarm Burst", "Gnat Swarm", "Plague Dart"],
    magic:  ["Miasma", "Wither", "Contagion", "Fever Touch", "Blight Mark"],
  },
};

// Each retired kit move's closest core move: the light, medium (15 damage)
// and precise ones the light move; the heavy one the heavy move; the quick
// attack the first-strike move.
const CLOSEST: CoreSlot[] = ["light", "light", "heavy", "first", "light"];
export const RETIRED_KIT_MOVES: Record<string, string> = {};
for (const race of Object.keys(RETIRED_KIT_NAMES) as RaceV2[])
  for (const style of STYLES)
    RETIRED_KIT_NAMES[race][style].forEach((name, i) => { RETIRED_KIT_MOVES[name] = CORE[CLOSEST[i]][style].name; });
