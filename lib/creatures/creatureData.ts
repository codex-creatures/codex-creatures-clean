// lib/creatures/creatureData.ts

export type ElementalType = "inferno" | "aqua" | "naturist" | null;

export type CreatureProficiency = {
  atk: number;    // melee
  rng: number;    // ranged
  mag: number;    // magic
  agil: number;
  mdef: number;   // melee defence
  rdef: number;   // ranged defence
  magdef: number; // magic defence
};

// The combat triangle: every creature has a primary class, and every attack
// move has a style. Melee beats ranged, ranged beats magic, magic beats
// melee (multipliers in lib/combat/engine.ts).
export type CombatClass = "melee" | "ranged" | "magic";
export const COMBAT_CLASSES: CombatClass[] = ["melee", "ranged", "magic"];
export const CLASS_INFO: Record<CombatClass, { name: string; icon: string; beats: CombatClass; color: string }> = {
  melee:  { name: "Melee",  icon: "⚔️", beats: "ranged", color: "#ff9f43" },
  ranged: { name: "Ranged", icon: "🏹", beats: "magic",  color: "#6fdc6f" },
  magic:  { name: "Magic",  icon: "🔮", beats: "melee",  color: "#c08cff" },
};

// How a move does its damage (tuning in lib/combat/engine.ts):
// - force:  hits harder, no armour penetration;
// - pierce: hits softer, ignores a good share of armour;
// - arcane: in between, plus a slice of the target's max HP.
export type DamageType = "force" | "pierce" | "arcane";
export const DAMAGE_TYPE_INFO: Record<DamageType, { name: string; icon: string; color: string }> = {
  force:  { name: "Force",  icon: "🔨", color: "#ff8a5c" },
  pierce: { name: "Pierce", icon: "🗡️", color: "#9fd8ff" },
  arcane: { name: "Arcane", icon: "✨", color: "#d6a8ff" },
};

// Extra behaviour on top of damage (tuning numbers live in lib/combat/battle.ts).
export type MoveEffect =
  | { kind: "cripple"; chance: number; agilityLoss?: number } // chance to cripple (slow) the target; loss defaults to CRIPPLE_AGILITY_LOSS
  | { kind: "dash"; agilityBonus: number }    // extra agility this round only (to strike first)
  | { kind: "precise"; hitChance: number }    // can miss, but every hit is precise
  | { kind: "quick" }                         // always strikes first this round (Combat V2 kits)
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
  type: CombatClass;     // the move's style (the triangle)
  dmgType: DamageType;   // how it does damage
  effect?: MoveEffect;
  desc?: string;
  self?: boolean;    // a utility move used on yourself: no target, no damage
  cooldown?: number; // rounds before it can be used again
  race?: Race;       // a race move: only that race can learn it (from a codex)
};

// Every creature belongs to a race. Races decide which codexes (race-locked
// moves) a creature can learn, so a good team mixes races. (The triangle is
// by class, not race.)
export type Race = "beast" | "underdweller" | "etherial" | "undead" | "elvish";

export const RACES: Race[] = ["beast", "underdweller", "etherial", "undead", "elvish"];

export const RACE_INFO: Record<Race, { name: string; color: string; icon: string }> = {
  beast:        { name: "Beast",         color: "#d89a5b", icon: "🐾" },
  underdweller: { name: "Underkin", color: "#b8a77a", icon: "🪨" },
  etherial:     { name: "Etherial",      color: "#a99cff", icon: "🌙" },
  undead:       { name: "Undead",        color: "#9fd3a8", icon: "💀" },
  elvish:       { name: "Elvish",        color: "#7fd16f", icon: "🍃" },
};

export type CreatureTemplate = {
  id: string;
  name: string;
  race?: Race;         // every scannable creature has one (bosses don't)
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  baseHp: number;
  cls: CombatClass;    // primary class (the triangle)
  proficiency: CreatureProficiency;
  skills: Skill[];
  flavour: string;
  companion?: boolean; // story companion: not found by scanning, not in the collection count
  neutral?: boolean;   // outside the triangle, and can learn any class's codex (Klutz)
  boss?: boolean;      // part of a dungeon boss: never found, never owned
};

export const ALL_SKILLS: Skill[] = [
  // Melee
  { name: "Flick",         damage: 5,  energyCost: 10, type: "melee",  dmgType: "force"  },
  { name: "Jab",           damage: 10, energyCost: 20, type: "melee",  dmgType: "pierce" },
  { name: "Slash",         damage: 15, energyCost: 30, type: "melee",  dmgType: "pierce" },
  { name: "Hexblade",      damage: 15, energyCost: 30, type: "melee",  dmgType: "arcane" },
  { name: "Heavy Blow",    damage: 20, energyCost: 40, type: "melee",  dmgType: "force"  },
  { name: "Impale",        damage: 25, energyCost: 50, type: "melee",  dmgType: "pierce" },
  { name: "Crush",         damage: 25, energyCost: 50, type: "melee",  dmgType: "force"  },
  { name: "Soul Rend",     damage: 25, energyCost: 50, type: "melee",  dmgType: "arcane" },
  { name: "Devastator",    damage: 40, energyCost: 80, type: "melee",  dmgType: "force"  },
  // Ranged
  { name: "Pebble Shot",   damage: 5,  energyCost: 10, type: "ranged", dmgType: "force"  },
  { name: "Stone Throw",   damage: 10, energyCost: 20, type: "ranged", dmgType: "force"  },
  { name: "Bolt",          damage: 15, energyCost: 30, type: "ranged", dmgType: "pierce" },
  { name: "Hex Arrow",     damage: 15, energyCost: 30, type: "ranged", dmgType: "arcane" },
  { name: "Piercing Shot", damage: 20, energyCost: 40, type: "ranged", dmgType: "pierce" },
  { name: "Boulder Toss",  damage: 25, energyCost: 50, type: "ranged", dmgType: "force"  },
  { name: "Cursed Volley", damage: 25, energyCost: 50, type: "ranged", dmgType: "arcane" },
  { name: "Annihilator",   damage: 45, energyCost: 90, type: "ranged", dmgType: "force"  },
  // Magic
  { name: "Spark",         damage: 5,  energyCost: 10, type: "magic",  dmgType: "force"  },
  { name: "Frost Shard",   damage: 10, energyCost: 20, type: "magic",  dmgType: "pierce" },
  { name: "Hex",           damage: 15, energyCost: 30, type: "magic",  dmgType: "arcane" },
  { name: "Firebolt",      damage: 15, energyCost: 30, type: "magic",  dmgType: "force"  },
  { name: "Ice Lance",     damage: 20, energyCost: 40, type: "magic",  dmgType: "pierce" },
  { name: "Fireball",      damage: 25, energyCost: 50, type: "magic",  dmgType: "force"  },
  { name: "Soul Drain",    damage: 25, energyCost: 50, type: "magic",  dmgType: "arcane" },
  { name: "Starfall",      damage: 40, energyCost: 80, type: "magic",  dmgType: "force"  },
];

// Moves any creature can learn into one of its move slots. For now they're
// all available to test; later they'll come from encounters, drops and quests.
export const LEARNABLE_MOVES: Skill[] = [
  { name: "Cripple",        damage: 15, energyCost: 60, type: "melee",  dmgType: "force",  effect: { kind: "cripple", chance: 0.5 },    desc: "50% chance to cripple for 3 rounds: the target loses 50% agility and has a 25% chance to stumble and lose each attack." },
  { name: "Crippling Shot", damage: 15, energyCost: 60, type: "ranged", dmgType: "pierce", effect: { kind: "cripple", chance: 0.5 },    desc: "50% chance to cripple for 3 rounds: the target loses 50% agility and has a 25% chance to stumble and lose each attack." },
  { name: "Hobble Hex",     damage: 15, energyCost: 60, type: "magic",  dmgType: "arcane", effect: { kind: "cripple", chance: 0.5 },    desc: "50% chance to cripple for 3 rounds: the target loses 50% agility and has a 25% chance to stumble and lose each attack." },
  { name: "Dash Lash",      damage: 15, energyCost: 60, type: "melee",  dmgType: "pierce", effect: { kind: "dash", agilityBonus: 1 }, desc: "Double agility this round (so it can strike first)." },
  { name: "Quick Bolt",     damage: 15, energyCost: 60, type: "ranged", dmgType: "pierce", effect: { kind: "dash", agilityBonus: 1 }, desc: "Double agility this round (so it can strike first)." },
  { name: "Blink",          damage: 15, energyCost: 60, type: "magic",  dmgType: "force",  effect: { kind: "dash", agilityBonus: 1 }, desc: "Double agility this round (so it can strike first)." },
  { name: "Precise Slice",  damage: 15, energyCost: 30, type: "melee",  dmgType: "pierce", effect: { kind: "precise", hitChance: 0.7 }, desc: "70% chance to hit, but every hit is a precise hit." },
  { name: "Precise Shot",   damage: 15, energyCost: 30, type: "ranged", dmgType: "pierce", effect: { kind: "precise", hitChance: 0.7 }, desc: "70% chance to hit, but every hit is a precise hit." },
  { name: "Seeker Spark",   damage: 15, energyCost: 30, type: "magic",  dmgType: "pierce", effect: { kind: "precise", hitChance: 0.7 }, desc: "70% chance to hit, but every hit is a precise hit." },
];

// Race moves: each is taught by a single-use codex (bought from wandering
// librarians or found in dungeon chests), and only creatures of its race
// can learn it. Tuning lives here and in lib/combat/battle.ts.
export const RACE_MOVES: Skill[] = [
  { name: "Pounce",     damage: 15, energyCost: 50, type: "melee",  dmgType: "force",  race: "beast",        effect: { kind: "pounce", lowHpBonus: 0.5 },
    desc: "Always strikes first this round, whatever its agility. +50% damage if the target is below half HP." },
  { name: "Rabid Bite", damage: 15, energyCost: 50, type: "melee",  dmgType: "pierce", race: "underdweller", effect: { kind: "venom", tick: 0.1, minRounds: 3, maxRounds: 5 },
    desc: "Venom: the target loses 10% of its max HP at the end of each round for 3–5 rounds — even if it swaps to the bench." },
  { name: "Mirage",     damage: 0,  energyCost: 40, type: "magic",  dmgType: "arcane", race: "etherial",     effect: { kind: "mirage", evade: 0.3, rounds: 3 }, self: true,
    desc: "Shimmers half out of the world: a 30% chance to dodge each attack for 3 rounds." },
  { name: "Corpsify",   damage: 0,  energyCost: 30, type: "melee",  dmgType: "force",  race: "undead",       effect: { kind: "corpsify", reviveHp: 0.55 }, self: true, cooldown: 3,
    desc: "If it's knocked out before the end of next round, it rises again with 55% HP. 3-round cooldown." },
  { name: "Barrage",    damage: 15, energyCost: 60, type: "ranged", dmgType: "pierce", race: "elvish",       effect: { kind: "barrage" },
    desc: "A volley that hits every enemy on the field." },
];

// Every move creatures are born with also comes as a codex (from scans), which
// teaches it to a creature of the move's own class. Basic moves (up to this
// much damage) are Common codexes; the stronger ones are Rare.
export const BASIC_CODEX_MAX_DAMAGE = 20;
export const BASIC_MOVES: Skill[] = ALL_SKILLS.filter((m) => m.damage <= BASIC_CODEX_MAX_DAMAGE);
export const STRONG_MOVES: Skill[] = ALL_SKILLS.filter((m) => m.damage > BASIC_CODEX_MAX_DAMAGE);
const classMovesFor = (c: CreatureTemplate): Skill[] => ALL_SKILLS.filter((m) => c.neutral || m.type === c.cls);

// Boss-only moves (see lib/creatures/bosses.ts). Never learnable.
export const BOSS_MOVES: Skill[] = [
  { name: "Club Smash",    damage: 20, energyCost: 40, type: "melee", dmgType: "force"  },
  { name: "Backhand",      damage: 10, energyCost: 20, type: "melee", dmgType: "force"  },
  { name: "Stomp",         damage: 12, energyCost: 40, type: "melee", dmgType: "force",  effect: { kind: "cripple", chance: 0.5, agilityLoss: 0.5 }, desc: "50% chance to cripple: −50% agility, and a 25% chance to stumble and lose each attack, for a few rounds." },
  { name: "Eye Laser",     damage: 30, energyCost: 70, type: "magic", dmgType: "arcane" },
  { name: "Claw Rake",     damage: 15, energyCost: 30, type: "melee", dmgType: "pierce" },
  { name: "Crushing Grip", damage: 25, energyCost: 50, type: "melee", dmgType: "force"  },
  { name: "Laser",         damage: 15, energyCost: 30, type: "magic", dmgType: "pierce" },
  { name: "Searing Beam",  damage: 25, energyCost: 50, type: "magic", dmgType: "arcane" },
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
  { id: "moss_wolf",        name: "Moss Wolf",        race: "beast",        rarity: "common",    baseHp: 65, cls: "melee", proficiency: { atk: 16, rng: 2, mag: 0, agil: 12, mdef: 4, rdef: 2, magdef: 3 }, skills: s("Slash","Jab","Heavy Blow"),                           flavour: "Camouflaged in undergrowth. Pounces before you spot it." },
  { id: "amber_wasp",       name: "Amber Wasp",       race: "beast",        rarity: "uncommon",  baseHp: 72, cls: "ranged", proficiency: { atk: 10, rng: 12, mag: 0, agil: 22, mdef: 3, rdef: 3, magdef: 3 }, skills: s("Pebble Shot","Bolt","Jab","Stone Throw"),                  flavour: "Glass jaw but lightning fast. Always strikes first." },
  { id: "bellow_toad",      name: "Bellow Toad",      race: "beast",        rarity: "rare",      baseHp: 102, cls: "melee", proficiency: { atk: 14, rng: 12, mag: 0, agil: 24, mdef: 10, rdef: 3, magdef: 18 }, skills: s("Cripple","Crippling Shot","Slash","Bolt"),         flavour: "Its throat swells like a bellows before it spits. The glands on its back glow when it's angry, and it's always angry." },
  { id: "dire_wolf",        name: "Dire Wolf",        race: "beast",        rarity: "epic",      baseHp: 113, cls: "melee", proficiency: { atk: 42, rng: 4, mag: 0, agil: 22, mdef: 12, rdef: 8, magdef: 10 }, skills: s("Crush","Heavy Blow","Slash","Devastator","Impale"),     flavour: "Three times the size of a normal wolf. Twice as hungry." },
  { id: "ironhide",         name: "Ironhide",         race: "beast",        rarity: "legendary", baseHp: 150, cls: "melee", proficiency: { atk: 52, rng: 6, mag: 0, agil: 10, mdef: 44, rdef: 30, magdef: 37 }, skills: s("Devastator","Crush","Impale","Heavy Blow","Slash","Stone Throw"), flavour: "A war elephant whose trunk was replaced with a double-headed battleaxe." },
  // UNDERKIN
  { id: "cave_bat",         name: "Cave Bat",         race: "underdweller", rarity: "common",    baseHp: 60, cls: "ranged", proficiency: { atk: 4, rng: 14, mag: 0, agil: 16, mdef: 2, rdef: 6, magdef: 4 }, skills: s("Pebble Shot","Bolt","Flick"),                         flavour: "Blindingly fast. Hits and vanishes before you can react." },
  { id: "rust_beetle",      name: "Rust Beetle",      race: "underdweller", rarity: "uncommon",  baseHp: 82, cls: "melee", proficiency: { atk: 10, rng: 3, mag: 0, agil: 3, mdef: 24, rdef: 12, magdef: 18 }, skills: s("Slash","Jab","Flick","Heavy Blow"),                   flavour: "A walking fortress. Slow, but its shell absorbs tremendous punishment." },
  { id: "crystalback",      name: "Crystalback",      race: "underdweller", rarity: "rare",      baseHp: 100, cls: "magic", proficiency: { atk: 6, rng: 0, mag: 8, agil: 4, mdef: 30, rdef: 24, magdef: 30 }, skills: s("Frost Shard","Hex","Jab","Ice Lance"),            flavour: "Its crystalline shell refracts both blade and bolt." },
  { id: "crystal_golem",    name: "Crystal Golem",    race: "underdweller", rarity: "epic",      baseHp: 133, cls: "melee", proficiency: { atk: 28, rng: 6, mag: 0, agil: 4, mdef: 32, rdef: 20, magdef: 26 }, skills: s("Devastator","Crush","Heavy Blow","Jab"),               flavour: "Slow enough to dodge. Strong enough that it doesn't matter." },
  { id: "hollow_matriarch", name: "Hollow Matriarch", race: "underdweller", rarity: "legendary", baseHp: 140, cls: "ranged", proficiency: { atk: 24, rng: 40, mag: 0, agil: 30, mdef: 24, rdef: 22, magdef: 23 }, skills: s("Piercing Shot","Cursed Volley","Crush","Bolt","Annihilator","Heavy Blow"), flavour: "A cave-spider queen the size of a cart. The tunnels go quiet before she arrives; every thread in the dark leads back to her." },
  // ETHERIAL
  { id: "dust_sprite",      name: "Dust Sprite",      race: "etherial",     rarity: "common",    baseHp: 58, cls: "ranged", proficiency: { atk: 2, rng: 18, mag: 0, agil: 10, mdef: 2, rdef: 4, magdef: 6 }, skills: s("Pebble Shot","Stone Throw","Bolt"),                   flavour: "A tiny wind spirit. Barely visible. Surprisingly annoying." },
  { id: "flicker_wisp",     name: "Flicker Wisp",     race: "etherial",     rarity: "uncommon",  baseHp: 72, cls: "magic", proficiency: { atk: 4, rng: 0, mag: 20, agil: 16, mdef: 4, rdef: 6, magdef: 8 }, skills: s("Hex","Spark","Frost Shard","Firebolt"),            flavour: "A lantern-light that bobs just out of reach. Follow it and you're lost; fight it and you miss." },
  { id: "veilstalker",      name: "Veilstalker",      race: "etherial",     rarity: "rare",      baseHp: 85, cls: "melee", proficiency: { atk: 20, rng: 0, mag: 16, agil: 20, mdef: 6, rdef: 6, magdef: 8 }, skills: s("Slash","Hexblade","Heavy Blow","Hex"),           flavour: "Exists partially out of phase. Attacks from angles that shouldn't exist." },
  { id: "the_watcher",      name: "The Watcher",      race: "etherial",     rarity: "epic",      baseHp: 103, cls: "ranged", proficiency: { atk: 10, rng: 42, mag: 0, agil: 12, mdef: 10, rdef: 16, magdef: 20 }, skills: s("Piercing Shot","Hex Arrow","Annihilator","Bolt","Cursed Volley"),   flavour: "A Cthulhu-like eye that floats in silence. When it opens fully, something breaks." },
  { id: "void_serpent",     name: "Void Serpent",     race: "etherial",     rarity: "legendary", baseHp: 143, cls: "magic", proficiency: { atk: 34, rng: 0, mag: 38, agil: 28, mdef: 20, rdef: 20, magdef: 24 }, skills: s("Starfall","Soul Drain","Hex","Devastator","Crush","Slash"), flavour: "It doesn't come from somewhere. It comes from the absence of somewhere." },
  // UNDEAD
  { id: "rattlebones",      name: "Rattlebones",      race: "undead",       rarity: "common",    baseHp: 62, cls: "melee", proficiency: { atk: 16, rng: 4, mag: 0, agil: 8, mdef: 8, rdef: 4, magdef: 6 }, skills: s("Slash","Jab","Flick"),                               flavour: "A skeleton that never got the message. It rattles when it laughs, and it laughs when it hits." },
  { id: "shambler",         name: "Shambler",         race: "undead",       rarity: "uncommon",  baseHp: 84, cls: "melee", proficiency: { atk: 18, rng: 2, mag: 0, agil: 4, mdef: 16, rdef: 10, magdef: 13 }, skills: s("Heavy Blow","Slash","Jab","Flick"),                   flavour: "Slow, stubborn and missing an arm. It's been missing that arm for centuries and hasn't slowed down." },
  { id: "dustwraith",       name: "Dustwraith",       race: "undead",       rarity: "rare",      baseHp: 83, cls: "magic", proficiency: { atk: 6, rng: 0, mag: 20, agil: 32, mdef: 4, rdef: 8, magdef: 6 }, skills: s("Hex","Spark","Frost Shard","Ice Lance"),         flavour: "A whirlwind given intent. You cannot hit what you cannot catch." },
  { id: "mr_shadows",       name: "Mr. Shadows",      race: "undead",       rarity: "epic",      baseHp: 113, cls: "magic", proficiency: { atk: 14, rng: 0, mag: 24, agil: 16, mdef: 18, rdef: 14, magdef: 16 }, skills: s("Hex","Soul Drain","Hexblade","Starfall","Slash"),   flavour: "A worn teddy bear sits innocently. Behind it, a demonic shadow stretches across the wall." },
  { id: "storm_phoenix",    name: "Skull Raven",      race: "undead",       rarity: "legendary", baseHp: 133, cls: "ranged", proficiency: { atk: 20, rng: 48, mag: 0, agil: 44, mdef: 14, rdef: 24, magdef: 19 }, skills: s("Annihilator","Piercing Shot","Bolt","Devastator","Flick","Stone Throw"), flavour: "A corpse ravaging scavenger." },
  // ELVISH
  { id: "thicket_archer",   name: "Thicket Archer",   race: "elvish",       rarity: "common",    baseHp: 60, cls: "ranged", proficiency: { atk: 4, rng: 20, mag: 0, agil: 10, mdef: 2, rdef: 4, magdef: 3 }, skills: s("Pebble Shot","Stone Throw","Bolt"),                   flavour: "Small, green-cloaked, and never where the arrow came from." },
  { id: "leafblade_scout",  name: "Leafblade Scout",  race: "elvish",       rarity: "uncommon",  baseHp: 74, cls: "melee", proficiency: { atk: 16, rng: 12, mag: 0, agil: 14, mdef: 4, rdef: 4, magdef: 4 }, skills: s("Slash","Bolt","Jab","Stone Throw"),                   flavour: "Runs the canopy paths with a blade in one hand and a bow on its back." },
  { id: "aurelius",         name: "Aurelius",         race: "elvish",       rarity: "rare",      baseHp: 95, cls: "ranged", proficiency: { atk: 12, rng: 22, mag: 0, agil: 14, mdef: 16, rdef: 6, magdef: 11 }, skills: s("Bolt","Piercing Shot","Heavy Blow","Stone Throw"),             flavour: "Half man, half horse, all warrior. Carries the weight of myth." },
  { id: "swamp_witch",      name: "Swamp Witch",      race: "elvish",       rarity: "epic",      baseHp: 105, cls: "magic", proficiency: { atk: 6, rng: 0, mag: 46, agil: 14, mdef: 8, rdef: 14, magdef: 11 }, skills: s("Hex","Ice Lance","Starfall","Frost Shard","Spark"), flavour: "Never seen in the open. Attacks from fog and distance." },
  { id: "sylvaran",         name: "Sylvaran, the Last Archer", race: "elvish", rarity: "legendary", baseHp: 135, cls: "ranged", proficiency: { atk: 14, rng: 52, mag: 0, agil: 34, mdef: 16, rdef: 24, magdef: 20 }, skills: s("Annihilator","Piercing Shot","Bolt","Slash","Stone Throw","Pebble Shot"), flavour: "The last of the old archers. They say Sylvaran has never missed — only chosen not to hit." },
];

// Creatures that no longer turn up from scans (they didn't fit a race).
// Any you already own stay yours and keep working.
export const RETIRED_CREATURES: CreatureTemplate[] = [
  // (Replaced by the Bellow Toad as the Rare beast, 2026-10-18.)
  { id: "monkey_mage",      name: "Monkey Mage",      race: "beast",        rarity: "rare",      baseHp: 88, cls: "magic", proficiency: { atk: 12, rng: 0, mag: 18, agil: 30, mdef: 6, rdef: 4, magdef: 6 }, skills: s("Firebolt","Hex","Slash","Fireball"),                  flavour: "Stole a wizard's hat and staff, and kept practising until the spells started working. Never stops chattering, never stops casting." },
  { id: "mantis_warden",  name: "Mantis Warden",  rarity: "common",    baseHp: 65, cls: "melee", proficiency: { atk: 18, rng: 2, mag: 0, agil: 6, mdef: 12, rdef: 4, magdef: 8 }, skills: s("Slash","Heavy Blow","Flick"),                         flavour: "One arm a serrated blade, the other a chitinous buckler. It waits." },
  { id: "forest_slime",   name: "Forest Slime",    rarity: "common",    baseHp: 68, cls: "melee", proficiency: { atk: 6, rng: 6, mag: 0, agil: 6, mdef: 6, rdef: 8, magdef: 7 }, skills: s("Jab","Stone Throw","Flick"),                         flavour: "Unremarkable in every way. Somehow always survives." },
  { id: "stone_toad",     name: "Stone Toad",      rarity: "common",    baseHp: 73, cls: "melee", proficiency: { atk: 6, rng: 4, mag: 0, agil: 2, mdef: 14, rdef: 10, magdef: 12 }, skills: s("Slash","Stone Throw","Jab"),                         flavour: "Squat, lumpy, impossibly durable. Outlasts everything." },
  { id: "thornmaw",       name: "Thornmaw",        rarity: "uncommon",  baseHp: 78, cls: "melee", proficiency: { atk: 22, rng: 4, mag: 0, agil: 6, mdef: 8, rdef: 4, magdef: 6 }, skills: s("Heavy Blow","Crush","Slash","Jab"),                   flavour: "A carnivorous plant that learned to walk. Its bite leaves thorns behind." },
  { id: "ironjaw_hound",  name: "Ironjaw Hound",   rarity: "uncommon",  baseHp: 75, cls: "melee", proficiency: { atk: 26, rng: 2, mag: 0, agil: 14, mdef: 6, rdef: 2, magdef: 4 }, skills: s("Crush","Heavy Blow","Slash","Flick"),                 flavour: "Built for the hunt. Its jaw can crush stone." },
  { id: "ashen_drifter",  name: "Ashen Drifter",   rarity: "rare",      baseHp: 88, cls: "ranged", proficiency: { atk: 8, rng: 32, mag: 0, agil: 16, mdef: 6, rdef: 12, magdef: 9 }, skills: s("Bolt","Piercing Shot","Stone Throw","Annihilator"),   flavour: "Orbiting rocks wrapped in smoke. Cold and quiet." },
];

// Klutz: the dopey goblin who drags you into the Den. He's your helper, not
// one of your creatures: gear him up and he'll hunt in the Labyrinth for
// you (lib/klutz.ts). He's a Rare.
// He's neutral ("Balanced": outside the triangle, any class's codex). His %s
// start at 0 and are the points you spend on him as he levels (lib/klutz.ts
// POINTS_PER_LEVEL), so you, his weapon and the codexes you teach him decide
// how he fights. He starts as a brawler; other styles come from codexes.
export const KLUTZ: CreatureTemplate = {
  id: "klutz", name: "Klutz", race: "underdweller", rarity: "rare", baseHp: 80, companion: true, cls: "melee", neutral: true,
  proficiency: { atk: 0, rng: 0, mag: 0, agil: 0, mdef: 0, rdef: 0, magdef: 0 },
  skills: s("Slash", "Heavy Blow", "Jab", "Stone Throw"),
  flavour: "A pot-bellied goblin with enormous eyes — all the better to see in the labyrinth. Pay him, gear him, and he'll go hunting for you.",
};

export const COMPANIONS: CreatureTemplate[] = [KLUTZ];

// The parts of dungeon bosses. Their stats come from their natural "gear"
// in lib/creatures/bosses.ts (proficiencies are 0 so those numbers are exact).
const bossMoves = (...names: string[]) => names.map((n) => BOSS_MOVES.find((m) => m.name === n)!);
const NO_PROF: CreatureProficiency = { atk: 0, rng: 0, mag: 0, agil: 0, mdef: 0, rdef: 0, magdef: 0 };
export const BOSS_PARTS: CreatureTemplate[] = [
  { id: "cyclops", name: "Cyclops", rarity: "legendary", baseHp: 240, boss: true, cls: "melee", proficiency: NO_PROF,
    skills: bossMoves("Club Smash", "Stomp", "Backhand", "Eye Laser"),
    flavour: "A mountain of muscle with one huge, rolling eye. The labyrinth's first warden." },
  { id: "cyclops_hand", name: "Crawling Hand", rarity: "epic", baseHp: 70, boss: true, cls: "melee", proficiency: NO_PROF,
    skills: bossMoves("Claw Rake", "Crushing Grip"),
    flavour: "It scuttles on its fingertips, much too fast." },
  { id: "cyclops_eye", name: "The Eye", rarity: "legendary", baseHp: 150, boss: true, cls: "magic", proficiency: NO_PROF,
    skills: bossMoves("Laser", "Searing Beam"),
    flavour: "Free of the skull at last, it floats — and it is furious." },
  // The first quest's thief (lib/quest.ts): the guided first fight.
  { id: "baby_cyclops", name: "Baby Cyclops", rarity: "rare", baseHp: 76, boss: true, cls: "melee", proficiency: NO_PROF,
    skills: bossMoves("Backhand", "Club Smash"),
    flavour: "A Cyclops whelp with sticky fingers and a hide like a door. It grabbed Klutz's box and ran." },
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

// Can this creature learn a move from a codex? Learnable moves: anyone.
// Race moves: only creatures of that race. Basic and strong moves: only
// creatures of that move's class (a neutral one, Klutz: any class,
// but no race moves).
export function canLearnFromCodex(c: CreatureTemplate, moveName: string): boolean {
  if (LEARNABLE_MOVES.some((m) => m.name === moveName)) return true;
  if (c.neutral && RACE_MOVES.some((m) => m.name === moveName)) return false;
  return [...raceMovesFor(c), ...classMovesFor(c)].some((m) => m.name === moveName);
}

// The moves a creature can put in its slots: the ones it was born with (its
// rolled moves; the species' first 4 if it has none saved) plus any it has
// learned from codexes.
export function movesAvailableTo(c: CreatureTemplate, learned: string[] = [], own?: string[]): Skill[] {
  const names = [...new Set([...(own?.length ? own : defaultMoveNames(c)), ...learned.filter((n) => canLearnFromCodex(c, n))])];
  return names.map((n) => MOVE_BY_NAME[n]).filter(Boolean);
}

// The 4 moves a creature fights with. Unknown or duplicate names are
// dropped; an empty selection falls back to the defaults. (Race and class
// codex moves are only offered once learned, so a saved one is trusted here.)
export function resolveMoves(c: CreatureTemplate, names?: string[]): Skill[] {
  const allowed = new Set([...c.skills, ...raceMovesFor(c), ...classMovesFor(c), ...LEARNABLE_MOVES].map((m) => m.name));
  const picked = [...new Set(names ?? [])].filter((n) => allowed.has(n)).slice(0, MOVE_SLOTS);
  // A species' own moves first: Combat V2's kit moves aren't in MOVE_BY_NAME.
  return (picked.length > 0 ? picked : defaultMoveNames(c)).map((n) => c.skills.find((m) => m.name === n) ?? MOVE_BY_NAME[n]);
}
