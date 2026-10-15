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
  | { kind: "precise"; hitChance: number }    // can miss, but every hit is precise
  // Race moves (from codexes):
  | { kind: "pounce"; lowHpBonus: number }    // acts first this round; extra damage vs a target below half HP
  | { kind: "venom"; tick: number; minRounds: number; maxRounds: number } // share of max HP lost each round, even on the bench
  | { kind: "mirage"; evade: number; rounds: number } // self: chance to dodge each attack
  | { kind: "corpsify"; reviveHp: number }    // self: knocked out before the end of next round → back with this share of HP
  | { kind: "barrage" };                      // hits every enemy on the field

export type Skill = {
  name: string;
  damage: number;
  energyCost: number;
  type: "melee" | "ranged";
  effect?: MoveEffect;
  desc?: string;
  self?: boolean;    // a utility move used on yourself: no target, no damage
  cooldown?: number; // rounds before it can be used again
  race?: Race;       // a race move: only that race can learn it (from a codex)
};

// Every creature belongs to a race. There's no type triangle: races decide
// which codexes (race-locked moves) a creature can learn, so a good team
// mixes races.
export type Race = "beast" | "underdweller" | "etherial" | "undead" | "elvish";

export const RACES: Race[] = ["beast", "underdweller", "etherial", "undead", "elvish"];

export const RACE_INFO: Record<Race, { name: string; color: string }> = {
  beast:        { name: "Beast",         color: "#d89a5b" },
  underdweller: { name: "Under-dweller", color: "#b8a77a" },
  etherial:     { name: "Etherial",      color: "#a99cff" },
  undead:       { name: "Undead",        color: "#9fd3a8" },
  elvish:       { name: "Elvish",        color: "#7fd16f" },
};

export type CreatureTemplate = {
  id: string;
  name: string;
  race?: Race;         // every scannable creature has one (bosses don't)
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  baseHp: number;
  proficiency: CreatureProficiency;
  skills: Skill[];
  flavour: string;
  companion?: boolean; // story companion: not found by scanning, not in the collection count
  boss?: boolean;      // part of a dungeon boss: never found, never owned
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

// Race moves: each is taught by a single-use codex (bought from wandering
// librarians or found in dungeon chests), and only creatures of its race
// can learn it. Tuning lives here and in lib/combat/battle.ts.
export const RACE_MOVES: Skill[] = [
  { name: "Pounce",     damage: 15, energyCost: 50, type: "melee",  race: "beast",        effect: { kind: "pounce", lowHpBonus: 0.5 },
    desc: "Always strikes first this round, whatever its agility. +50% damage if the target is below half HP." },
  { name: "Rabid Bite", damage: 15, energyCost: 50, type: "melee",  race: "underdweller", effect: { kind: "venom", tick: 0.1, minRounds: 3, maxRounds: 5 },
    desc: "Venom: the target loses 10% of its max HP at the end of each round for 3–5 rounds — even if it swaps to the bench." },
  { name: "Mirage",     damage: 0,  energyCost: 40, type: "ranged", race: "etherial",     effect: { kind: "mirage", evade: 0.3, rounds: 3 }, self: true,
    desc: "Shimmers half out of the world: a 30% chance to dodge each attack for 3 rounds." },
  { name: "Corpsify",   damage: 0,  energyCost: 30, type: "melee",  race: "undead",       effect: { kind: "corpsify", reviveHp: 0.55 }, self: true, cooldown: 3,
    desc: "If it's knocked out before the end of next round, it rises again with 55% HP. 3-round cooldown." },
  { name: "Barrage",    damage: 15, energyCost: 60, type: "ranged", race: "elvish",       effect: { kind: "barrage" },
    desc: "A volley that hits every enemy on the field." },
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
export const MOVE_BY_NAME: Record<string, Skill> = Object.fromEntries([...ALL_MOVES, ...RACE_MOVES, ...BOSS_MOVES].map((m) => [m.name, m]));

// The race moves a creature of this race could learn.
export const raceMovesFor = (c: CreatureTemplate): Skill[] => RACE_MOVES.filter((m) => m.race && m.race === c.race);

function s(...names: string[]): Skill[] {
  return names.map(n => ALL_SKILLS.find(sk => sk.name === n)!).filter(Boolean);
}

// The scannable roster: 5 races × one creature of each rarity. Creatures that
// moved tier had their %s and HP scaled to fit it.
export const CREATURE_TEMPLATES: CreatureTemplate[] = [
  // BEAST
  { id: "moss_wolf",        name: "Moss Wolf",        race: "beast",        rarity: "common",    baseHp: 65,  proficiency: { atk: 16, rng: 2,  agil: 12, mdef: 4,  rdef: 2  }, skills: s("Slash","Jab","Heavy Blow"),                           flavour: "Camouflaged in undergrowth. Pounces before you spot it." },
  { id: "amber_wasp",       name: "Amber Wasp",       race: "beast",        rarity: "uncommon",  baseHp: 72,  proficiency: { atk: 10, rng: 12, agil: 22, mdef: 3,  rdef: 3  }, skills: s("Flick","Pebble Shot","Jab","Bolt"),                  flavour: "Glass jaw but lightning fast. Always strikes first." },
  { id: "ember_lynx",       name: "Ember Lynx",       race: "beast",        rarity: "rare",      baseHp: 88,  proficiency: { atk: 20, rng: 10, agil: 30, mdef: 6,  rdef: 4  }, skills: s("Slash","Bolt","Flick","Heavy Blow"),                  flavour: "Fastest creature in the understory. Smoke trails behind it." },
  { id: "dire_wolf",        name: "Dire Wolf",        race: "beast",        rarity: "epic",      baseHp: 113, proficiency: { atk: 42, rng: 4,  agil: 22, mdef: 12, rdef: 8  }, skills: s("Crush","Heavy Blow","Slash","Devastator","Flick"),     flavour: "Three times the size of a normal wolf. Twice as hungry." },
  { id: "ironhide",         name: "Ironhide",         race: "beast",        rarity: "legendary", baseHp: 150, proficiency: { atk: 52, rng: 6,  agil: 10, mdef: 44, rdef: 30 }, skills: s("Devastator","Crush","Heavy Blow","Slash","Jab","Stone Throw"), flavour: "A war elephant whose trunk was replaced with a double-headed battleaxe." },
  // UNDER-DWELLER
  { id: "cave_bat",         name: "Cave Bat",         race: "underdweller", rarity: "common",    baseHp: 60,  proficiency: { atk: 4,  rng: 14, agil: 16, mdef: 2,  rdef: 6  }, skills: s("Pebble Shot","Bolt","Flick"),                         flavour: "Blindingly fast. Hits and vanishes before you can react." },
  { id: "rust_beetle",      name: "Rust Beetle",      race: "underdweller", rarity: "uncommon",  baseHp: 82,  proficiency: { atk: 10, rng: 3,  agil: 3,  mdef: 24, rdef: 12 }, skills: s("Slash","Jab","Flick","Heavy Blow"),                   flavour: "A walking fortress. Slow, but its shell absorbs tremendous punishment." },
  { id: "crystalback",      name: "Crystalback",      race: "underdweller", rarity: "rare",      baseHp: 100, proficiency: { atk: 6,  rng: 8,  agil: 4,  mdef: 30, rdef: 24 }, skills: s("Jab","Pebble Shot","Stone Throw","Slash"),            flavour: "Its crystalline shell refracts both blade and bolt." },
  { id: "crystal_golem",    name: "Crystal Golem",    race: "underdweller", rarity: "epic",      baseHp: 133, proficiency: { atk: 28, rng: 6,  agil: 4,  mdef: 32, rdef: 20 }, skills: s("Devastator","Crush","Heavy Blow","Jab"),               flavour: "Slow enough to dodge. Strong enough that it doesn't matter." },
  { id: "hollow_matriarch", name: "Hollow Matriarch", race: "underdweller", rarity: "legendary", baseHp: 140, proficiency: { atk: 40, rng: 24, agil: 30, mdef: 24, rdef: 22 }, skills: s("Devastator","Crush","Piercing Shot","Heavy Blow","Bolt","Flick"), flavour: "A cave-spider queen the size of a cart. The tunnels go quiet before she arrives; every thread in the dark leads back to her." },
  // ETHERIAL
  { id: "dust_sprite",      name: "Dust Sprite",      race: "etherial",     rarity: "common",    baseHp: 58,  proficiency: { atk: 2,  rng: 18, agil: 10, mdef: 2,  rdef: 4  }, skills: s("Pebble Shot","Stone Throw","Bolt"),                   flavour: "A tiny wind spirit. Barely visible. Surprisingly annoying." },
  { id: "flicker_wisp",     name: "Flicker Wisp",     race: "etherial",     rarity: "uncommon",  baseHp: 72,  proficiency: { atk: 4,  rng: 20, agil: 16, mdef: 4,  rdef: 6  }, skills: s("Bolt","Pebble Shot","Stone Throw","Flick"),            flavour: "A lantern-light that bobs just out of reach. Follow it and you're lost; fight it and you miss." },
  { id: "veilstalker",      name: "Veilstalker",      race: "etherial",     rarity: "rare",      baseHp: 85,  proficiency: { atk: 18, rng: 18, agil: 20, mdef: 6,  rdef: 6  }, skills: s("Slash","Bolt","Heavy Blow","Piercing Shot"),           flavour: "Exists partially out of phase. Attacks from angles that shouldn't exist." },
  { id: "the_watcher",      name: "The Watcher",      race: "etherial",     rarity: "epic",      baseHp: 103, proficiency: { atk: 10, rng: 42, agil: 12, mdef: 10, rdef: 16 }, skills: s("Piercing Shot","Bolt","Annihilator","Stone Throw"),   flavour: "A Cthulhu-like eye that floats in silence. When it opens fully, something breaks." },
  { id: "void_serpent",     name: "Void Serpent",     race: "etherial",     rarity: "legendary", baseHp: 143, proficiency: { atk: 36, rng: 36, agil: 28, mdef: 20, rdef: 20 }, skills: s("Devastator","Annihilator","Crush","Piercing Shot","Bolt","Slash"), flavour: "It doesn't come from somewhere. It comes from the absence of somewhere." },
  // UNDEAD
  { id: "rattlebones",      name: "Rattlebones",      race: "undead",       rarity: "common",    baseHp: 62,  proficiency: { atk: 16, rng: 4,  agil: 8,  mdef: 8,  rdef: 4  }, skills: s("Slash","Jab","Flick"),                               flavour: "A skeleton that never got the message. It rattles when it laughs, and it laughs when it hits." },
  { id: "shambler",         name: "Shambler",         race: "undead",       rarity: "uncommon",  baseHp: 84,  proficiency: { atk: 18, rng: 2,  agil: 4,  mdef: 16, rdef: 10 }, skills: s("Heavy Blow","Slash","Jab","Flick"),                   flavour: "Slow, stubborn and missing an arm. It's been missing that arm for centuries and hasn't slowed down." },
  { id: "dustwraith",       name: "Dustwraith",       race: "undead",       rarity: "rare",      baseHp: 83,  proficiency: { atk: 6,  rng: 20, agil: 32, mdef: 4,  rdef: 8  }, skills: s("Bolt","Flick","Pebble Shot","Piercing Shot"),         flavour: "A whirlwind given intent. You cannot hit what you cannot catch." },
  { id: "mr_shadows",       name: "Mr. Shadows",      race: "undead",       rarity: "epic",      baseHp: 113, proficiency: { atk: 24, rng: 14, agil: 16, mdef: 18, rdef: 14 }, skills: s("Slash","Bolt","Crush","Devastator","Piercing Shot"),   flavour: "A worn teddy bear sits innocently. Behind it, a demonic shadow stretches across the wall." },
  { id: "storm_phoenix",    name: "Storm Phoenix",    race: "undead",       rarity: "legendary", baseHp: 133, proficiency: { atk: 20, rng: 48, agil: 44, mdef: 14, rdef: 24 }, skills: s("Annihilator","Piercing Shot","Bolt","Devastator","Flick","Stone Throw"), flavour: "Dies in lightning. Returns in thunder. Has done this many times." },
  // ELVISH
  { id: "thicket_archer",   name: "Thicket Archer",   race: "elvish",       rarity: "common",    baseHp: 60,  proficiency: { atk: 4,  rng: 20, agil: 10, mdef: 2,  rdef: 4  }, skills: s("Pebble Shot","Stone Throw","Bolt"),                   flavour: "Small, green-cloaked, and never where the arrow came from." },
  { id: "leafblade_scout",  name: "Leafblade Scout",  race: "elvish",       rarity: "uncommon",  baseHp: 74,  proficiency: { atk: 16, rng: 12, agil: 14, mdef: 4,  rdef: 4  }, skills: s("Slash","Bolt","Jab","Stone Throw"),                   flavour: "Runs the canopy paths with a blade in one hand and a bow on its back." },
  { id: "aurelius",         name: "Aurelius",         race: "elvish",       rarity: "rare",      baseHp: 95,  proficiency: { atk: 22, rng: 12, agil: 14, mdef: 16, rdef: 6  }, skills: s("Heavy Blow","Bolt","Slash","Stone Throw"),             flavour: "Half man, half horse, all warrior. Carries the weight of myth." },
  { id: "swamp_witch",      name: "Swamp Witch",      race: "elvish",       rarity: "epic",      baseHp: 105, proficiency: { atk: 6,  rng: 46, agil: 14, mdef: 8,  rdef: 14 }, skills: s("Bolt","Piercing Shot","Annihilator","Stone Throw","Pebble Shot"), flavour: "Never seen in the open. Attacks from fog and distance." },
  { id: "sylvaran",         name: "Sylvaran, the Last Archer", race: "elvish", rarity: "legendary", baseHp: 135, proficiency: { atk: 14, rng: 52, agil: 34, mdef: 16, rdef: 24 }, skills: s("Annihilator","Piercing Shot","Bolt","Slash","Stone Throw","Pebble Shot"), flavour: "The last of the old archers. They say Sylvaran has never missed — only chosen not to hit." },
];

// Creatures that no longer turn up from scans (they didn't fit a race).
// Any you already own stay yours and keep working.
export const RETIRED_CREATURES: CreatureTemplate[] = [
  { id: "mantis_warden",  name: "Mantis Warden",  rarity: "common",    baseHp: 65,  proficiency: { atk: 18, rng: 2,  agil: 6,  mdef: 12, rdef: 4  }, skills: s("Slash","Heavy Blow","Flick"),                         flavour: "One arm a serrated blade, the other a chitinous buckler. It waits." },
  { id: "forest_slime",   name: "Forest Slime",    rarity: "common",    baseHp: 68,  proficiency: { atk: 6,  rng: 6,  agil: 6,  mdef: 6,  rdef: 8  }, skills: s("Jab","Stone Throw","Flick"),                         flavour: "Unremarkable in every way. Somehow always survives." },
  { id: "stone_toad",     name: "Stone Toad",      rarity: "common",    baseHp: 73,  proficiency: { atk: 6,  rng: 4,  agil: 2,  mdef: 14, rdef: 10 }, skills: s("Slash","Stone Throw","Jab"),                         flavour: "Squat, lumpy, impossibly durable. Outlasts everything." },
  { id: "thornmaw",       name: "Thornmaw",        rarity: "uncommon",  baseHp: 78,  proficiency: { atk: 22, rng: 4,  agil: 6,  mdef: 8,  rdef: 4  }, skills: s("Heavy Blow","Crush","Slash","Jab"),                   flavour: "A carnivorous plant that learned to walk. Its bite leaves thorns behind." },
  { id: "ironjaw_hound",  name: "Ironjaw Hound",   rarity: "uncommon",  baseHp: 75,  proficiency: { atk: 26, rng: 2,  agil: 14, mdef: 6,  rdef: 2  }, skills: s("Crush","Heavy Blow","Slash","Flick"),                 flavour: "Built for the hunt. Its jaw can crush stone." },
  { id: "ashen_drifter",  name: "Ashen Drifter",   rarity: "rare",      baseHp: 88,  proficiency: { atk: 8,  rng: 32, agil: 16, mdef: 6,  rdef: 12 }, skills: s("Bolt","Piercing Shot","Stone Throw","Annihilator"),   flavour: "Orbiting rocks wrapped in smoke. Cold and quiet." },
];

// Klutz: the dopey goblin who drags you out of the dungeon and decides to
// stay. Every player starts with him. A bruiser-style hybrid, so he suits
// almost any gear.
export const KLUTZ: CreatureTemplate = {
  id: "klutz", name: "Klutz", race: "underdweller", rarity: "rare", baseHp: 98, companion: true,
  proficiency: { atk: 26, rng: 18, agil: 8, mdef: 12, rdef: 10 },
  skills: s("Slash", "Bolt", "Heavy Blow", "Stone Throw"),
  flavour: "A pot-bellied goblin with enormous eyes — all the better to see in the labyrinth. He found you down there, so now you're his.",
};

export const COMPANIONS: CreatureTemplate[] = [KLUTZ];

// The parts of dungeon bosses. Their stats come from their natural "gear"
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

// Every creature that can exist (scannable, retired, companions, boss parts), by id.
export const CREATURE_BY_ID: Record<string, CreatureTemplate> = Object.fromEntries(
  [...CREATURE_TEMPLATES, ...RETIRED_CREATURES, ...COMPANIONS, ...BOSS_PARTS].map(c => [c.id, c])
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

// learned: race moves this creature has learned from codexes.
export function movesAvailableTo(c: CreatureTemplate, learned: string[] = []): Skill[] {
  return [...c.skills, ...raceMovesFor(c).filter((m) => learned.includes(m.name)), ...LEARNABLE_MOVES];
}

// The 4 moves a creature fights with. Unknown or duplicate names are
// dropped; an empty selection falls back to the defaults. (Race moves are
// only offered once learned, so a saved one is trusted here.)
export function resolveMoves(c: CreatureTemplate, names?: string[]): Skill[] {
  const allowed = new Set(movesAvailableTo(c, raceMovesFor(c).map((m) => m.name)).map((m) => m.name));
  const picked = [...new Set(names ?? [])].filter((n) => allowed.has(n)).slice(0, MOVE_SLOTS);
  return (picked.length > 0 ? picked : defaultMoveNames(c)).map((n) => MOVE_BY_NAME[n]);
}
