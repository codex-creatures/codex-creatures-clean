// lib/creatures/raceKitsV2.ts
// Combat V2 race moves (live since 2026-10-26). Every race
// has a kit of 5 moves in each style (melee, ranged, magic): 7 × 3 × 5 = 105.
// A creature draws from the kits of its race(s) in its archetype's style(s)
// (lib/creatures/rosterV2.ts). More moves go on top of these later.
//
// The 5 slots are the same shape in every kit (the user, 2026-10-26); only
// the names change. V2 has no damage types: a move is its style and its race.
// Except the light slot: that's a Balanced move (no race, neutral against
// everyone), the same one in every kit of a style (the user, 2026-10-26).

import type { CombatClass, Skill } from "./creatureData";
import type { RaceV2 } from "./racesV2";

export type KitSlot = "light" | "medium" | "heavy" | "quick" | "precise";
export const KIT_SLOTS: KitSlot[] = ["light", "medium", "heavy", "quick", "precise"];

// Damage per energy matches today's moves (half the cost). The quick attack
// trades power for always striking first; the precise one is today's
// Precise Slice / Shot / Seeker Spark.
export const KIT_NUMBERS: Record<KitSlot, { damage: number; energyCost: number }> = {
  light:   { damage: 10, energyCost: 20 },
  medium:  { damage: 15, energyCost: 30 },
  heavy:   { damage: 25, energyCost: 50 },
  quick:   { damage: 8,  energyCost: 20 },
  precise: { damage: 15, energyCost: 30 },
};
export const KIT_PRECISE_HIT = 0.7;

// The Balanced moves: each style's light move, with no race.
export const BALANCED_MOVES: Record<CombatClass, Skill> = {
  melee:  { name: "Strike", ...KIT_NUMBERS.light, type: "melee",  dmgType: "force" },
  ranged: { name: "Shot",   ...KIT_NUMBERS.light, type: "ranged", dmgType: "force" },
  magic:  { name: "Zap",    ...KIT_NUMBERS.light, type: "magic",  dmgType: "force" },
};

// The Neutral priority moves (the user, 2026-10-26): no race, always first,
// and dear for it. Every creature starts with its main style's one. (Names:
// the user's; the older haste spell that was called Blink is now Quickcast.)
export const NEUTRAL_QUICK_NUMBERS = { damage: 15, energyCost: 50 };
const quickDesc = "Always strikes first this round, whatever its agility (two of these: the faster goes first).";
export const NEUTRAL_QUICK_MOVES: Record<CombatClass, Skill> = {
  melee:  { name: "Rush",      ...NEUTRAL_QUICK_NUMBERS, type: "melee",  dmgType: "force", effect: { kind: "quick" }, desc: quickDesc },
  ranged: { name: "Quickshot", ...NEUTRAL_QUICK_NUMBERS, type: "ranged", dmgType: "force", effect: { kind: "quick" }, desc: quickDesc },
  magic:  { name: "Blink",     ...NEUTRAL_QUICK_NUMBERS, type: "magic",  dmgType: "force", effect: { kind: "quick" }, desc: quickDesc },
};

// Names, in KIT_SLOTS order: light, medium, heavy, quick, precise. (The light
// names are retired: the Balanced moves took their place. RETIRED_KIT_MOVES
// turns a creature that still knows one over to its Balanced move.)
type Names = [string, string, string, string, string];
export const KIT_NAMES: Record<RaceV2, Record<CombatClass, Names>> = {
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

const STYLES: CombatClass[] = ["melee", "ranged", "magic"];

function kitMove(race: RaceV2, style: CombatClass, slot: KitSlot): Skill {
  const i = KIT_SLOTS.indexOf(slot);
  // dmgType is required on every move, but Combat V2 turns damage types off
  // (CombatRules.damageTypes in engine.ts), so it never counts.
  const base = { name: KIT_NAMES[race][style][i], ...KIT_NUMBERS[slot], type: style, dmgType: "force" as const };
  if (slot === "light") return BALANCED_MOVES[style];
  if (slot === "quick") return { ...base, effect: { kind: "quick" }, desc: "Always strikes first this round, whatever its agility." };
  if (slot === "precise") return { ...base, effect: { kind: "precise", hitChance: KIT_PRECISE_HIT }, desc: "70% chance to hit, but every hit is a precise hit." };
  return base;
}

// Every kit move, and each one's race (for the race chart; none for the Neutral moves).
export const KIT_MOVES: Skill[] = [...Object.values(BALANCED_MOVES), ...Object.values(NEUTRAL_QUICK_MOVES)];
export const KIT_MOVE_RACE: Record<string, RaceV2> = {};
export const RETIRED_KIT_MOVES: Record<string, string> = {};
const KITS = {} as Record<RaceV2, Record<CombatClass, Record<KitSlot, Skill>>>;
for (const race of Object.keys(KIT_NAMES) as RaceV2[]) {
  KITS[race] = {} as Record<CombatClass, Record<KitSlot, Skill>>;
  for (const style of STYLES) {
    KITS[race][style] = {} as Record<KitSlot, Skill>;
    for (const slot of KIT_SLOTS) {
      const m = kitMove(race, style, slot);
      KITS[race][style][slot] = m;
      if (slot === "light") { RETIRED_KIT_MOVES[KIT_NAMES[race][style][0]] = m.name; continue; }
      KIT_MOVES.push(m);
      KIT_MOVE_RACE[m.name] = race;
    }
  }
}

// The kit moves with a race: the ones that come as codexes (librarians and
// scans). Everyone starts with the Neutral ones.
export const KIT_RACE_MOVES: Skill[] = KIT_MOVES.filter((m) => KIT_MOVE_RACE[m.name]);

export const kitMoveFor = (race: RaceV2, style: CombatClass, slot: KitSlot): Skill => KITS[race][style][slot];
export const kitFor = (race: RaceV2, style: CombatClass): Skill[] => KIT_SLOTS.map((s) => KITS[race][style][s]);
