// lib/creatures/creatureData.ts

export type ElementalType = "inferno" | "aqua" | "naturist" | null;

export type CreatureProficiency = {
  atk: number;
  rng: number;
  agil: number;
  mdef: number;
  rdef: number;
};

// Extra behaviour on top of damage (tuning numbers live in lib/combat/battle.ts).
export type MoveEffect =
  | { kind: "cripple"; chance: number; agilityLoss?: number } // chance to cripple (slow) the target; loss defaults to CRIPPLE_AGILITY_LOSS
  | { kind: "dash"; agilityBonus: number }    // extra agility this round and the next HASTE_ROUNDS
  | { kind: "precise"; hitChance: number };   // can miss, but every hit is precise

export type Skill = {
  name: string;
  damage: number;
  energyCost: number;
  type: "melee" | "ranged";
  effect?: MoveEffect;
  desc?: string;
};

export type CreatureTemplate = {
  id: string;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  baseHp: number;
  proficiency: CreatureProficiency;
  skills: Skill[];
  flavour: string;
  companion?: boolean; // story companion: not found by scanning, not in the collection count
  boss?: boolean;      // part of a labyrinth boss: never found, never owned
};

export const ALL_SKILLS: Skill[] = [
  { name: "Flick",         damage: 5,  energyCost: 10, type: "melee"  },
  { name: "Jab",           damage: 10, energyCost: 20, type: "melee"  },
  { name: "Slash",         damage: 15, energyCost: 30, type: "melee"  },
  { name: "Heavy Blow",    damage: 20, energyCost: 40, type: "melee"  },
  { name: "Crush",         damage: 25, energyCost: 50, type: "melee"  },
  { name: "Devastator",    damage: 40, energyCost: 80, type: "melee"  },
  { name: "Pebble Shot",   damage: 5,  energyCost: 10, type: "ranged" },
  { name: "Stone Throw",   damage: 10, energyCost: 20, type: "ranged" },
  { name: "Bolt",          damage: 15, energyCost: 30, type: "ranged" },
  { name: "Piercing Shot", damage: 20, energyCost: 40, type: "ranged" },
  { name: "Annihilator",   damage: 45, energyCost: 90, type: "ranged" },
];

// Moves any creature can learn into one of its move slots. For now they're
// all available to test; later they'll come from encounters, drops and quests.
export const LEARNABLE_MOVES: Skill[] = [
  { name: "Cripple",        damage: 15, energyCost: 60, type: "melee",  effect: { kind: "cripple", chance: 0.7 },    desc: "70% chance to cripple: the target loses 50% agility for 3 rounds." },
  { name: "Crippling Shot", damage: 15, energyCost: 60, type: "ranged", effect: { kind: "cripple", chance: 0.7 },    desc: "70% chance to cripple: the target loses 50% agility for 3 rounds." },
  { name: "Dash Lash",      damage: 10, energyCost: 50, type: "melee",  effect: { kind: "dash", agilityBonus: 0.5 }, desc: "Haste: +50% agility this round (so it can strike first) and the next 2." },
  { name: "Quick Bolt",     damage: 10, energyCost: 50, type: "ranged", effect: { kind: "dash", agilityBonus: 0.5 }, desc: "Haste: +50% agility this round (so it can strike first) and the next 2." },
  { name: "Precise Slice",  damage: 15, energyCost: 30, type: "melee",  effect: { kind: "precise", hitChance: 0.7 }, desc: "70% chance to hit, but every hit is a precise hit." },
  { name: "Precise Shot",   damage: 15, energyCost: 30, type: "ranged", effect: { kind: "precise", hitChance: 0.7 }, desc: "70% chance to hit, but every hit is a precise hit." },
];

// Boss-only moves (see lib/creatures/bosses.ts). Never learnable.
export const BOSS_MOVES: Skill[] = [
  { name: "Club Smash",    damage: 20, energyCost: 40, type: "melee" },
  { name: "Backhand",      damage: 10, energyCost: 20, type: "melee" },
  { name: "Stomp",         damage: 12, energyCost: 40, type: "melee",  effect: { kind: "cripple", chance: 0.5, agilityLoss: 0.5 }, desc: "50% chance to cripple: −50% agility for a few rounds." },
  { name: "Eye Laser",     damage: 30, energyCost: 70, type: "ranged" },
  { name: "Claw Rake",     damage: 15, energyCost: 30, type: "melee" },
  { name: "Crushing Grip", damage: 25, energyCost: 50, type: "melee" },
  { name: "Laser",         damage: 15, energyCost: 30, type: "ranged" },
  { name: "Searing Beam",  damage: 25, energyCost: 50, type: "ranged" },
];

export const ALL_MOVES: Skill[] = [...ALL_SKILLS, ...LEARNABLE_MOVES];
export const MOVE_BY_NAME: Record<string, Skill> = Object.fromEntries([...ALL_MOVES, ...BOSS_MOVES].map((m) => [m.name, m]));

function s(...names: string[]): Skill[] {
  return names.map(n => ALL_SKILLS.find(sk => sk.name === n)!).filter(Boolean);
}

export const CREATURE_TEMPLATES: CreatureTemplate[] = [
  // COMMON
  { id: "mantis_warden",  name: "Mantis Warden",  rarity: "common",    baseHp: 65,  proficiency: { atk: 18, rng: 2,  agil: 6,  mdef: 12, rdef: 4  }, skills: s("Slash","Heavy Blow","Flick"),                         flavour: "One arm a serrated blade, the other a chitinous buckler. It waits." },
  { id: "cave_bat",       name: "Cave Bat",        rarity: "common",    baseHp: 60,  proficiency: { atk: 4,  rng: 14, agil: 16, mdef: 2,  rdef: 6  }, skills: s("Pebble Shot","Bolt","Flick"),                         flavour: "Blindingly fast. Hits and vanishes before you can react." },
  { id: "rust_beetle",    name: "Rust Beetle",     rarity: "common",    baseHp: 70,  proficiency: { atk: 8,  rng: 2,  agil: 2,  mdef: 18, rdef: 8  }, skills: s("Slash","Jab","Flick"),                               flavour: "A walking fortress. Slow, but its shell absorbs tremendous punishment." },
  { id: "forest_slime",   name: "Forest Slime",    rarity: "common",    baseHp: 68,  proficiency: { atk: 6,  rng: 6,  agil: 6,  mdef: 6,  rdef: 8  }, skills: s("Jab","Stone Throw","Flick"),                         flavour: "Unremarkable in every way. Somehow always survives." },
  { id: "dust_sprite",    name: "Dust Sprite",     rarity: "common",    baseHp: 58,  proficiency: { atk: 2,  rng: 18, agil: 10, mdef: 2,  rdef: 4  }, skills: s("Pebble Shot","Stone Throw","Bolt"),                   flavour: "A tiny wind spirit. Barely visible. Surprisingly annoying." },
  { id: "moss_wolf",      name: "Moss Wolf",       rarity: "common",    baseHp: 65,  proficiency: { atk: 16, rng: 2,  agil: 12, mdef: 4,  rdef: 2  }, skills: s("Slash","Jab","Heavy Blow"),                           flavour: "Camouflaged in undergrowth. Pounces before you spot it." },
  { id: "amber_wasp",     name: "Amber Wasp",      rarity: "common",    baseHp: 57,  proficiency: { atk: 8,  rng: 10, agil: 18, mdef: 2,  rdef: 2  }, skills: s("Flick","Pebble Shot","Jab"),                         flavour: "Glass jaw but lightning fast. Always strikes first." },
  { id: "stone_toad",     name: "Stone Toad",      rarity: "common",    baseHp: 73,  proficiency: { atk: 6,  rng: 4,  agil: 2,  mdef: 14, rdef: 10 }, skills: s("Slash","Stone Throw","Jab"),                         flavour: "Squat, lumpy, impossibly durable. Outlasts everything." },
  // UNCOMMON
  { id: "thornmaw",       name: "Thornmaw",        rarity: "uncommon",  baseHp: 78,  proficiency: { atk: 22, rng: 4,  agil: 6,  mdef: 8,  rdef: 4  }, skills: s("Heavy Blow","Crush","Slash","Jab"),                   flavour: "A carnivorous plant that learned to walk. Its bite leaves thorns behind." },
  { id: "aurelius",       name: "Aurelius",        rarity: "uncommon",  baseHp: 80,  proficiency: { atk: 16, rng: 8,  agil: 10, mdef: 12, rdef: 4  }, skills: s("Heavy Blow","Bolt","Slash","Stone Throw"),             flavour: "Half man, half horse, all warrior. Carries the weight of myth." },
  { id: "crystalback",    name: "Crystalback",     rarity: "uncommon",  baseHp: 85,  proficiency: { atk: 4,  rng: 6,  agil: 4,  mdef: 22, rdef: 18 }, skills: s("Jab","Pebble Shot","Stone Throw"),                   flavour: "Its crystalline shell refracts both blade and bolt." },
  { id: "ironjaw_hound",  name: "Ironjaw Hound",   rarity: "uncommon",  baseHp: 75,  proficiency: { atk: 26, rng: 2,  agil: 14, mdef: 6,  rdef: 2  }, skills: s("Crush","Heavy Blow","Slash","Flick"),                 flavour: "Built for the hunt. Its jaw can crush stone." },
  { id: "swamp_witch",    name: "Swamp Witch",     rarity: "uncommon",  baseHp: 73,  proficiency: { atk: 4,  rng: 28, agil: 8,  mdef: 4,  rdef: 6  }, skills: s("Bolt","Piercing Shot","Stone Throw","Pebble Shot"),   flavour: "Never seen in the open. Attacks from fog and distance." },
  { id: "ember_lynx",     name: "Ember Lynx",      rarity: "uncommon",  baseHp: 70,  proficiency: { atk: 14, rng: 8,  agil: 22, mdef: 4,  rdef: 4  }, skills: s("Slash","Bolt","Flick","Jab"),                         flavour: "Fastest creature in the understory. Smoke trails behind it." },
  // RARE
  { id: "ashen_drifter",  name: "Ashen Drifter",   rarity: "rare",      baseHp: 88,  proficiency: { atk: 8,  rng: 32, agil: 16, mdef: 6,  rdef: 12 }, skills: s("Bolt","Piercing Shot","Stone Throw","Annihilator"),   flavour: "Orbiting rocks wrapped in smoke. Cold and quiet." },
  { id: "dustwraith",     name: "Dustwraith",      rarity: "rare",      baseHp: 83,  proficiency: { atk: 6,  rng: 20, agil: 32, mdef: 4,  rdef: 8  }, skills: s("Bolt","Flick","Pebble Shot","Piercing Shot"),         flavour: "A whirlwind given intent. You cannot hit what you cannot catch." },
  { id: "ironhide",       name: "Ironhide",        rarity: "rare",      baseHp: 108, proficiency: { atk: 30, rng: 4,  agil: 4,  mdef: 20, rdef: 8  }, skills: s("Crush","Heavy Blow","Devastator","Slash"),             flavour: "A war elephant whose trunk was replaced with a double-headed battleaxe." },
  { id: "dire_wolf",      name: "Dire Wolf",       rarity: "rare",      baseHp: 93 , proficiency: { atk: 34, rng: 4,  agil: 18, mdef: 8,  rdef: 4  }, skills: s("Crush","Heavy Blow","Slash","Flick"),                 flavour: "Three times the size of a normal wolf. Twice as hungry." },
  { id: "veilstalker",    name: "Veilstalker",     rarity: "rare",      baseHp: 85,  proficiency: { atk: 18, rng: 18, agil: 20, mdef: 6,  rdef: 6  }, skills: s("Slash","Bolt","Heavy Blow","Piercing Shot"),           flavour: "Exists partially out of phase. Attacks from angles that shouldn't exist." },
  // EPIC
  { id: "mr_shadows",     name: "Mr. Shadows",     rarity: "epic",      baseHp: 113, proficiency: { atk: 24, rng: 14, agil: 16, mdef: 18, rdef: 14 }, skills: s("Slash","Bolt","Crush","Devastator","Piercing Shot"),   flavour: "A worn teddy bear sits innocently. Behind it, a demonic shadow stretches across the wall." },
  { id: "the_watcher",    name: "The Watcher",     rarity: "epic",      baseHp: 103, proficiency: { atk: 10, rng: 42, agil: 12, mdef: 10, rdef: 16 }, skills: s("Piercing Shot","Bolt","Annihilator","Stone Throw"),   flavour: "A Cthulhu-like eye that floats in silence. When it opens fully, something breaks." },
  { id: "crystal_golem",  name: "Crystal Golem",   rarity: "epic",      baseHp: 133, proficiency: { atk: 28, rng: 6,  agil: 4,  mdef: 32, rdef: 20 }, skills: s("Devastator","Crush","Heavy Blow","Jab"),               flavour: "Slow enough to dodge. Strong enough that it doesn't matter." },
  // LEGENDARY
  { id: "void_serpent",   name: "Void Serpent",    rarity: "legendary", baseHp: 143, proficiency: { atk: 36, rng: 36, agil: 28, mdef: 20, rdef: 20 }, skills: s("Devastator","Annihilator","Crush","Piercing Shot","Bolt","Slash"), flavour: "It doesn't come from somewhere. It comes from the absence of somewhere." },
  { id: "storm_phoenix",  name: "Storm Phoenix",   rarity: "legendary", baseHp: 133, proficiency: { atk: 20, rng: 48, agil: 44, mdef: 14, rdef: 24 }, skills: s("Annihilator","Piercing Shot","Bolt","Devastator","Flick","Stone Throw"), flavour: "Dies in lightning. Returns in thunder. Has done this many times." },
];

// Klutz: the dopey goblin who drags you out of the labyrinth and decides to
// stay. Every player starts with him. A bruiser-style hybrid, so he suits
// almost any gear.
export const KLUTZ: CreatureTemplate = {
  id: "klutz", name: "Klutz", rarity: "rare", baseHp: 98, companion: true,
  proficiency: { atk: 26, rng: 18, agil: 8, mdef: 12, rdef: 10 },
  skills: s("Slash", "Bolt", "Heavy Blow", "Stone Throw"),
  flavour: "A pot-bellied goblin with enormous eyes — all the better to see in the labyrinth. He found you down there, so now you're his.",
};

export const COMPANIONS: CreatureTemplate[] = [KLUTZ];

// The parts of labyrinth bosses. Their stats come from their natural "gear"
// in lib/creatures/bosses.ts (proficiencies are 0 so those numbers are exact).
const bossMoves = (...names: string[]) => names.map((n) => BOSS_MOVES.find((m) => m.name === n)!);
const NO_PROF: CreatureProficiency = { atk: 0, rng: 0, agil: 0, mdef: 0, rdef: 0 };
export const BOSS_PARTS: CreatureTemplate[] = [
  { id: "cyclops", name: "Cyclops", rarity: "legendary", baseHp: 240, boss: true, proficiency: NO_PROF,
    skills: bossMoves("Club Smash", "Stomp", "Backhand", "Eye Laser"),
    flavour: "A mountain of muscle with one huge, rolling eye. The labyrinth's first warden." },
  { id: "cyclops_hand", name: "Crawling Hand", rarity: "epic", baseHp: 70, boss: true, proficiency: NO_PROF,
    skills: bossMoves("Claw Rake", "Crushing Grip"),
    flavour: "It scuttles on its fingertips, much too fast." },
  { id: "cyclops_eye", name: "The Eye", rarity: "legendary", baseHp: 150, boss: true, proficiency: NO_PROF,
    skills: bossMoves("Laser", "Searing Beam"),
    flavour: "Free of the skull at last, it floats — and it is furious." },
];

// Every creature that can exist (scannable ones + companions), by id.
export const CREATURE_BY_ID: Record<string, CreatureTemplate> = Object.fromEntries(
  [...CREATURE_TEMPLATES, ...COMPANIONS, ...BOSS_PARTS].map(c => [c.id, c])
);

// Template for a creature drop. Older saves stored only the name.
export function findCreatureTemplate(creatureId?: string, name?: string): CreatureTemplate | undefined {
  return (creatureId && CREATURE_BY_ID[creatureId]) || Object.values(CREATURE_BY_ID).find(c => c.name === name);
}

export const CREATURES_BY_RARITY: Record<string, CreatureTemplate[]> = {
  common:    CREATURE_TEMPLATES.filter(c => c.rarity === "common"),
  uncommon:  CREATURE_TEMPLATES.filter(c => c.rarity === "uncommon"),
  rare:      CREATURE_TEMPLATES.filter(c => c.rarity === "rare"),
  epic:      CREATURE_TEMPLATES.filter(c => c.rarity === "epic"),
  legendary: CREATURE_TEMPLATES.filter(c => c.rarity === "legendary"),
};

// ── Move slots ──────────────────────────────────────────────────────
// A creature takes 4 moves into battle, chosen from its own moves plus any
// learnable ones. Until changed, it uses the first 4 of its own.
export const MOVE_SLOTS = 4;

export function defaultMoveNames(c: CreatureTemplate): string[] {
  return c.skills.slice(0, MOVE_SLOTS).map((m) => m.name);
}

export function movesAvailableTo(c: CreatureTemplate): Skill[] {
  return [...c.skills, ...LEARNABLE_MOVES];
}

// The 4 moves a creature fights with. Unknown or duplicate names are
// dropped; an empty selection falls back to the defaults.
export function resolveMoves(c: CreatureTemplate, names?: string[]): Skill[] {
  const allowed = new Set(movesAvailableTo(c).map((m) => m.name));
  const picked = [...new Set(names ?? [])].filter((n) => allowed.has(n)).slice(0, MOVE_SLOTS);
  return (picked.length > 0 ? picked : defaultMoveNames(c)).map((n) => MOVE_BY_NAME[n]);
}
