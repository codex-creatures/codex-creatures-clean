// lib/creatures/creatureData.ts

import { RACES_V2, SPECIES_RACES, type RaceV2 } from "./racesV2";
import { CORE_MOVES, CORE_MOVE_NAMES, RETIRED_KIT_MOVES } from "./raceKitsV2";
import { CODEX_MOVES_2026 } from "./codexMoves";
import { ARCHETYPE_INFO, NEW_SPECIES_V2, SPECIES_ARCHETYPE, V2_RESTYLE, v2Moves } from "./rosterV2";

export type CreatureProficiency = {
  atk: number;    // melee
  rng: number;    // ranged
  mag: number;    // magic
  agil: number;
  mdef: number;   // melee defence
  rdef: number;   // ranged defence
  magdef: number; // magic defence
};

// Every creature has a primary class (its main fighting style), and every
// attack move has a style: which attack and defence stats it uses. (Before
// Combat V2 these made a triangle; races replaced it.)
export type CombatClass = "melee" | "ranged" | "magic";
export const COMBAT_CLASSES: CombatClass[] = ["melee", "ranged", "magic"];
export const CLASS_INFO: Record<CombatClass, { name: string; icon: string; beats: CombatClass; color: string }> = {
  melee:  { name: "Melee",  icon: "⚔️", beats: "ranged", color: "#eadfc6" },
  ranged: { name: "Ranged", icon: "🏹", beats: "magic",  color: "#eadfc6" },
  magic:  { name: "Magic",  icon: "🔮", beats: "melee",  color: "#eadfc6" },
};

// How a move does its damage (tuning in lib/combat/engine.ts):
// - force:  hits harder, no armour penetration;
// - pierce: hits softer, ignores a good share of armour;
// - arcane: in between, plus a slice of the target's max HP.
// Combat V2 switches damage types off (CombatRules in lib/combat/engine.ts):
// moves still carry one, but it doesn't count.
export type DamageType = "force" | "pierce" | "arcane";
export const DAMAGE_TYPE_INFO: Record<DamageType, { name: string; icon: string; color: string }> = {
  force:  { name: "Force",  icon: "🔨", color: "#ff8a5c" },
  pierce: { name: "Pierce", icon: "🗡️", color: "#9fd8ff" },
  arcane: { name: "Arcane", icon: "✨", color: "#d6a8ff" },
};

// Extra behaviour on top of damage (tuning numbers live in lib/combat/battle.ts).
export type MoveEffect =
  | { kind: "cripple"; chance: number; agilityLoss?: number; minRounds?: number; maxRounds?: number } // chance to cripple (slow) the target; loss defaults to CRIPPLE_AGILITY_LOSS, rounds to CRIPPLE_ROUNDS
  | { kind: "dash"; agilityBonus: number }    // extra agility this round only (to strike first)
  | { kind: "precise"; hitChance: number }    // can miss, but every hit is precise
  | { kind: "quick" }                         // always strikes first this round (Combat V2 kits)
  // Race moves (from codexes):
  | { kind: "pounce"; lowHpBonus: number }    // acts first this round; extra damage vs a target below half HP
  | { kind: "venom"; tick: number; minRounds: number; maxRounds: number } // share of max HP lost each round, even on the bench
  | { kind: "mirage"; evade: number; rounds: number } // self: chance to dodge each attack
  | { kind: "corpsify"; reviveHp: number }    // self: knocked out before the end of next round → back with this share of HP
  | { kind: "barrage" }                       // hits every enemy on the field
  // Special moves (SPECIAL_MOVES):
  | { kind: "seal"; rounds: number; chance: number; extraChance?: number } // the target can't swap out for some rounds (extraChance: one round more)
  | { kind: "meditate"; energy: number }      // self: extra energy back
  | { kind: "blessing"; heal: number }        // self: next round, after the attacks, whoever is on the field heals this share of max HP
  | { kind: "soak"; cut: number }             // the target's defences drop by this share until it leaves the field
  | { kind: "brace"; cut: number }            // self: goes first; the next attack on it this round does this share less
  | { kind: "empower"; style: CombatClass; boost: number } // self: its attack stat in that style is this share higher while it stays on the field
  // A blood pool under the foes (lib/combat/battle.ts: ground effects): cost, its share of max HP
  // paid; tick, each round to whoever's on their field; entry, to each that comes in; the
  // entries'th entry bursts for a burst-power magic hit; leech, the share your creature on the field heals.
  | { kind: "blood"; cost: number; tick: number; entry: number; entries: number; burst: number; leech: number }
  // The 2026-11 codex moves (lib/creatures/codexMoves.ts; how they play: lib/combat/battle.ts).
  | { kind: "agility"; gain: number }                    // a hit, then its agility is this share higher for the rest of the fight
  | { kind: "weaken"; loss: number; style?: CombatClass; rounds?: number; chance?: number; forceSwap?: number } // the target's attack (one style, or all) is down; forceSwap: first, a chance it's driven out instead
  | { kind: "smoke" }                                    // goes first, a small hit, then it swaps out
  | { kind: "lifesteal"; share: number }                 // heals this share of the damage it did
  | { kind: "chain"; step: number; cap: number }         // each use in a row hits this much harder (up to cap)
  | { kind: "ward"; rounds: number }                     // self: clears its status effects, and is immune to new ones (and clouds) for a few rounds
  | { kind: "bleed"; chance: number; tick: number }      // a chance the target bleeds this share of max HP a round until it leaves the field (not Undead)
  | { kind: "caltrops"; entry: number }                  // under the foes: each creature that comes in loses this share of max HP
  | { kind: "cleanse" }                                  // self: your team loses venom, poison and bleed; clouds and blood under your team go
  | { kind: "septic"; mult: number }                     // more damage if the target bleeds or blood lies under it
  | { kind: "execute"; below: number; bonus: number }    // more damage if the target is below this share of HP
  | { kind: "cloud"; tick: number; minRounds: number; maxRounds: number; tailMin: number; tailMax: number } // a poison cloud under the foes (see battle.ts: clouds)
  | { kind: "ignite"; mult: number }                     // more damage if a cloud lies under the target, and the cloud burns away
  | { kind: "ambush"; bonus: number }                    // goes first; more damage if the target is at full HP
  | { kind: "surge"; gain: number }                      // a hit, then its magic damage is this share higher for the rest of the fight
  | { kind: "poison"; chance: number; tick: number; minRounds: number; maxRounds: number } // a chance to poison the target
  | { kind: "implode"; tick: number; minRounds: number; maxRounds: number; tailMin: number; tailMax: number } // goes last; a big hit, the user falls, and a cloud lies under the foes
  | { kind: "flamebody"; reflect: number; rounds: number } // self: burns away the cloud under your team; melee attackers take this share of their hit for a few rounds
  | { kind: "gore"; rounds: number; amp: number }        // blood under the foes for a few rounds: toxic damage on them is this share higher (not Undead)
  | { kind: "recoil"; share: number }                    // the user takes this share of the damage it did
  | { kind: "slap"; chance: number }                     // a chance to wipe the target's stat changes
  | { kind: "charge" };                                  // winds up (pays its energy), then strikes next turn for mult× (no cost, still regains energy)

export type Skill = {
  name: string;
  damage: number;
  energyCost: number;
  type: CombatClass;     // the move's style
  dmgType: DamageType;   // how it does damage
  effect?: MoveEffect;
  desc?: string;
  self?: boolean;    // a utility move used on yourself: no target, no damage
  cooldown?: number; // rounds before it can be used again
  race?: Race;       // a race move: its race (only that race can learn it, from a codex, unless learnRaces says otherwise)
  asRace?: Race;     // a core move (no race of its own): the race it lands as, its creature's main race
  learnRaces?: Race[]; // a race move several races can learn (Rabid Bite)
  learners?: string[]; // a special move only these species can learn (missing: anyone, unless learnStyles)
  learnStyles?: CombatClass[]; // a special move any creature fighting in one of these styles can learn (its archetype's)
  alsoLearners?: string[]; // a race move these species can learn too, whatever their race
  notLearners?: string[];  // a race move these species can't learn, though of its race (Ironhide: Pounce)
  codexRarity?: "common" | "uncommon" | "rare" | "epic"; // a special move's codex rarity
  mult?: number;     // its damage is this many times a hit of its power (big hits: power fades as attack grows, a multiplier doesn't)
};

// Every creature has one or two races (Combat V2, lib/creatures/racesV2.ts).
// A move's race against the target's races decides how well it lands (the
// race chart, lib/combat/raceChart.ts). Races also decide which codexes
// (race-locked moves) a creature can learn.
export type Race = RaceV2;

export const RACES: Race[] = RACES_V2;

// A creature's race names, e.g. "Geo / Beast" ("" for none).
export const raceNames = (c: Pick<CreatureTemplate, "race" | "races">) => (c.races ?? (c.race ? [c.race] : [])).map((r) => RACE_INFO[r].name).join(" / ");

// Each race's colour (the user, 2026-10-26): on chips, cards and move tablets.
// art: its PixelLab icon (public/sprites/icons, drawn by components/Glyph.tsx);
// the emoji stays for plain text (tooltips) and for races still waiting on art.
export const RACE_INFO: Record<Race, { name: string; color: string; icon: string; art?: string }> = {
  undead:   { name: "Undead",   color: "#c9c5b8", icon: "💀", art: "race_undead" },   // bone grey
  divine:   { name: "Divine",   color: "#f3dc8a", icon: "✨", art: "race_divine" },   // light gold
  beast:    { name: "Beast",    color: "#6fdc6f", icon: "🐾", art: "race_beast" },    // green
  underkin: { name: "Underkin", color: "#c08a55", icon: "🪨" },                       // brown
  geo:      { name: "Geo",      color: "#ff6b5c", icon: "🔥", art: "race_geo" },      // red
  humanoid: { name: "Humanoid", color: "#6fb0ff", icon: "🛡️", art: "race_humanoid" }, // blue
  toxic:    { name: "Toxic",    color: "#b98cf0", icon: "🦠" },                       // purple
};
// A move with no race (the Balanced moves, lib/creatures/raceKitsV2.ts): neutral against everyone.
export const BALANCED_INFO: { name: string; color: string; icon: string; art?: string } = { name: "Neutral", color: "#8e929c", icon: "⚖️", art: "neutral" }; // slate grey

export type CreatureTemplate = {
  id: string;
  name: string;
  race?: Race;         // its first race: every scannable creature has one (bosses don't)
  races?: Race[];      // all its races (one or two; lib/creatures/racesV2.ts)
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  baseHp: number;
  cls: CombatClass;    // primary class: its main style
  proficiency: CreatureProficiency;
  skills: Skill[];
  flavour: string;
  companion?: boolean; // story companion: not found by scanning, not in the collection count
  neutral?: boolean;   // can learn any class's codex (Klutz)
  boss?: boolean;      // part of a dungeon boss: never found, never owned
};

export const ALL_SKILLS: Skill[] = [
  // Melee
  { name: "Flick",         damage: 5,  energyCost: 10, type: "melee",  dmgType: "force"  },
  { name: "Jab",           damage: 10, energyCost: 20, type: "melee",  dmgType: "pierce" },
  { name: "Slash",         damage: 15, energyCost: 30, type: "melee",  dmgType: "pierce" },
  { name: "Hexblade",      damage: 15, energyCost: 30, type: "melee",  dmgType: "arcane" },
  { name: "Heavy Blow",    damage: 20, energyCost: 40, type: "melee",  dmgType: "force"  },
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

// Moves any creature can learn into one of its move slots, from a codex.
// (The dash and precise ones were retired on 2026-11-12: the core moves'
// first-strike move does the dash's job, and RETIRED_LEARNABLES turns them
// over to their closest core move.)
const OLD_LEARNABLES: Skill[] = [
  { name: "Cripple",        damage: 15, energyCost: 60, type: "melee",  dmgType: "force",  effect: { kind: "cripple", chance: 0.5 },    desc: "50% chance to cripple for 3–5 rounds: the target loses 50% agility and has a 50% chance to stumble and lose each attack." },
  { name: "Crippling Shot", damage: 15, energyCost: 60, type: "ranged", dmgType: "pierce", effect: { kind: "cripple", chance: 0.5 },    desc: "50% chance to cripple for 3–5 rounds: the target loses 50% agility and has a 50% chance to stumble and lose each attack." },
  { name: "Hobble Hex",     damage: 15, energyCost: 60, type: "magic",  dmgType: "arcane", effect: { kind: "cripple", chance: 0.5 },    desc: "50% chance to cripple for 3–5 rounds: the target loses 50% agility and has a 50% chance to stumble and lose each attack." },
  { name: "Dash Lash",      damage: 15, energyCost: 60, type: "melee",  dmgType: "pierce", effect: { kind: "dash", agilityBonus: 1 }, desc: "Double agility this round (so it can strike first)." },
  { name: "Quick Bolt",     damage: 15, energyCost: 60, type: "ranged", dmgType: "pierce", effect: { kind: "dash", agilityBonus: 1 }, desc: "Double agility this round (so it can strike first)." },
  { name: "Quickcast",      damage: 15, energyCost: 60, type: "magic",  dmgType: "force",  effect: { kind: "dash", agilityBonus: 1 }, desc: "Double agility this round (so it can strike first)." },
  { name: "Precise Slice",  damage: 15, energyCost: 30, type: "melee",  dmgType: "pierce", effect: { kind: "precise", hitChance: 0.7 }, desc: "70% chance to hit, but every hit is a precise hit." },
  { name: "Precise Shot",   damage: 15, energyCost: 30, type: "ranged", dmgType: "pierce", effect: { kind: "precise", hitChance: 0.7 }, desc: "70% chance to hit, but every hit is a precise hit." },
  { name: "Seeker Spark",   damage: 15, energyCost: 30, type: "magic",  dmgType: "pierce", effect: { kind: "precise", hitChance: 0.7 }, desc: "70% chance to hit, but every hit is a precise hit." },
];
export const LEARNABLE_MOVES: Skill[] = OLD_LEARNABLES.filter((m) => m.effect?.kind === "cripple");
const RETIRED_LEARNABLES: Skill[] = OLD_LEARNABLES.filter((m) => m.effect?.kind !== "cripple");

// Race moves: each is taught by a single-use codex (bought from wandering
// librarians or found in dungeon chests), and only creatures of its race
// can learn it. Tuning lives here and in lib/combat/battle.ts.
export const RACE_MOVES: Skill[] = [
  { name: "Pounce",     damage: 15, energyCost: 50, type: "melee",  dmgType: "force",  race: "beast",        effect: { kind: "pounce", lowHpBonus: 0.5 },
    // The user, 2026-10-31: these non-Beasts can learn it too, and Ironhide can't.
    alsoLearners: ["void_serpent", "deep_angler", "veilstalker", "cave_bat"], notLearners: ["ironhide"],
    desc: "Always strikes first this round, whatever its agility. +50% damage if the target is below half HP." },
  { name: "Rabid Bite", damage: 15, energyCost: 70, type: "melee",  dmgType: "pierce", race: "toxic", learnRaces: ["beast", "underkin", "toxic"], effect: { kind: "venom", tick: 0.1, minRounds: 3, maxRounds: 5 },
    desc: "Venom: the target loses 10% of its max HP at the end of each round for 3–5 rounds — even if it swaps to the bench. Toxic creatures are immune." },
  { name: "Mirage",     damage: 0,  energyCost: 40, type: "magic",  dmgType: "arcane", race: "divine", effect: { kind: "mirage", evade: 0.3, rounds: 3 }, self: true,
    alsoLearners: ["dust_sprite", "dustwraith", "swamp_witch", "mr_shadows", "dreadpox", "thunderhead", "pale_rider", "storm_phoenix"],
    desc: "Shimmers half out of the world: a 30% chance to dodge each attack for 3 rounds." },
  { name: "Corpsify",   damage: 0,  energyCost: 30, type: "melee",  dmgType: "force",  race: "undead",       effect: { kind: "corpsify", reviveHp: 0.55 }, self: true, cooldown: 3,
    alsoLearners: ["hollow_matriarch", "plague_rat"],
    desc: "If it's knocked out before the end of next round, it rises again with 55% HP. 3-round cooldown." },
  { name: "Barrage",    damage: 15, energyCost: 60, type: "ranged", dmgType: "pierce", race: "humanoid", effect: { kind: "barrage" },
    alsoLearners: ["rotgut_fly", "the_watcher", "thunderhead", "storm_phoenix", "hollow_matriarch"],
    desc: "A volley that hits every enemy on the field." },
  // Geo's race move (the user, 2026-10-31).
  { name: "Erupt",      damage: 25, energyCost: 70, type: "magic",  dmgType: "force",  race: "geo", effect: { kind: "cripple", chance: 0.25, minRounds: 3, maxRounds: 5 },
    alsoLearners: ["swamp_witch", "mr_shadows", "ironhide"],
    desc: "25% chance to cripple for 3–5 rounds: the target loses 50% agility and has a 50% chance to stumble and lose each attack." },
];

// Special moves (the user, 2026-10-27): each comes as a codex of its own
// rarity, and only the species listed can read it (Meditate: anyone). Not
// race-locked: the list is the user's pick. (The old melee Impale was
// retired for the new one: an old Impale codex is now this one.)
const DARK_SEAL_LEARNERS = ["dreadpox", "swamp_witch", "mr_shadows", "flame_imp", "dustwraith", "thunderhead"];
// The Divine blessings (the user, 2026-11-03): one per style, for the
// creatures that fight in it (hybrids too).
const empower = (name: string, style: CombatClass): Skill => ({
  name, damage: 0, energyCost: 50, type: style, dmgType: "force", race: "divine", codexRarity: "epic", cooldown: 5, self: true,
  effect: { kind: "empower", style, boost: 0.5 }, learnStyles: [style],
  desc: `+50% ${CLASS_INFO[style].name.toLowerCase()} attack for the rest of the fight, while it stays on the field (swapping out loses it). Doesn't stack. 5-round cooldown.`,
});
export const SPECIAL_MOVES: Skill[] = [
  { name: "Dark Seal", damage: 5, energyCost: 50, type: "magic", dmgType: "force", race: "undead", codexRarity: "rare", cooldown: 5,
    effect: { kind: "seal", rounds: 3, chance: 1 },
    learners: DARK_SEAL_LEARNERS,
    desc: "The target can't swap out for 3 rounds, even if you swap. 5-round cooldown." },
  { name: "Meditate", damage: 0, energyCost: 0, type: "magic", dmgType: "force", codexRarity: "common", cooldown: 3, self: true,
    effect: { kind: "meditate", energy: 30 },
    desc: "Restores 30 extra energy. 3-round cooldown." },
  { name: "Healing Blessing", damage: 0, energyCost: 40, type: "magic", dmgType: "force", race: "divine", codexRarity: "uncommon", cooldown: 3, self: true,
    effect: { kind: "blessing", heal: 0.6 },
    learners: ["thunderhead", "crystal_golem", "veilstalker", "flicker_wisp", "sylvaran"],
    desc: "Next round, once everyone has attacked, whoever you have on the field heals 60% of its max HP (stay, or swap in someone hurt). 3-round cooldown." },
  { name: "Corrosive Soak", damage: 0, energyCost: 40, type: "magic", dmgType: "force", race: "toxic", codexRarity: "rare",
    effect: { kind: "soak", cut: 0.3 },
    learners: ["bellow_toad", "rotgut_fly", "plague_rat", "glob", "deep_angler", "dreadpox", "void_serpent", "hollow_matriarch"],
    desc: "The target's melee, ranged and magic defences drop by 30% until it leaves the field. Doesn't stack." },
  { name: "Impale", damage: 25, energyCost: 80, type: "ranged", dmgType: "force", race: "underkin", codexRarity: "epic",
    effect: { kind: "seal", rounds: 2, chance: 0.6 },
    learners: ["deep_angler", "aurelius", "crystal_golem", "storm_phoenix", "sylvaran", "pale_rider"],
    desc: "60% chance the target can't swap out for 2 rounds." },
  { name: "Pin Down", damage: 10, energyCost: 60, type: "ranged", dmgType: "force", race: "humanoid", codexRarity: "rare", cooldown: 5,
    effect: { kind: "seal", rounds: 2, chance: 1, extraChance: 0.3 },
    learners: ["thicket_archer", "aurelius", "storm_phoenix", "sylvaran", "hollow_matriarch", "rotgut_fly"],
    desc: "The target can't swap out for 2 rounds (30% chance of a third). 5-round cooldown." },
  // The user, 2026-11-03.
  { name: "Brace", damage: 0, energyCost: 50, type: "magic", dmgType: "force", codexRarity: "rare", self: true,
    effect: { kind: "brace", cut: 0.9 },
    desc: "Always goes first. The next attack on it this round does 90% less damage." },
  empower("Divine Strength", "melee"),
  empower("Arcane Channel", "magic"),
  empower("Sureshot Blessing", "ranged"),
  { name: "Blood Sacrifice", damage: 0, energyCost: 70, type: "magic", dmgType: "force", race: "undead", codexRarity: "epic",
    effect: { kind: "blood", cost: 0.25, tick: 0.05, entry: 0.2, entries: 3, burst: 25, leech: 0.5 },
    learners: DARK_SEAL_LEARNERS,
    desc: "Costs 25% of its max HP. Blood pools under the foes: 5% max HP a round to the one out, 20% to each that comes in, and the third bursts for a 25-power magic hit. Whoever you have out heals half of it. Undead are untouched." },
  // The 2026-11 codex moves (the user's 29; lib/creatures/codexMoves.ts).
  ...CODEX_MOVES_2026,
];
const SPECIAL_MOVE_NAMES = new Set(SPECIAL_MOVES.map((m) => m.name));
export const isSpecialMove = (name: string) => SPECIAL_MOVE_NAMES.has(name);
// The styles a species fights in (its archetype's; none for Klutz and bosses).
export const stylesOf = (c: Pick<CreatureTemplate, "id">): CombatClass[] => ARCHETYPE_INFO[SPECIES_ARCHETYPE[c.id]]?.styles ?? [];
// Can this species read a special move's codex?
const canLearnSpecial = (c: CreatureTemplate, m: Skill) =>
  m.learnStyles ? stylesOf(c).some((st) => m.learnStyles!.includes(st)) : !m.learners || m.learners.includes(c.id);

// The older plain moves (ALL_SKILLS) and the race kits' no longer come as
// codexes (the user, 2026-11-12): every creature knows its core moves.
// Each older one's closest core move: up to this much damage the light one,
// more the heavy one; a dash move the first-strike one.
const LIGHT_MAX_DAMAGE = 20;
const closestCore = (m: Skill): Skill => CORE_MOVES.filter((c) => c.type === m.type)[m.effect?.kind === "dash" ? 2 : m.damage >= LIGHT_MAX_DAMAGE ? 1 : 0];
// Two retired kit moves' names were taken by 2026-11 codex moves (the user,
// 2026-11-12: the old ones are wiped and the names are the new moves'). An
// old one still in a save is wiped once (wipeReusedNames, instance.ts).
export const REUSED_NAMES: Record<string, string> = { Smite: RETIRED_KIT_MOVES.Smite, Ambush: RETIRED_KIT_MOVES.Ambush };
const KIT_MOVES_STILL_RETIRED = Object.fromEntries(Object.entries(RETIRED_KIT_MOVES).filter(([n]) => !(n in REUSED_NAMES)));
export const RETIRED_MOVES: Record<string, string> = {
  ...KIT_MOVES_STILL_RETIRED,
  ...Object.fromEntries([...ALL_SKILLS, ...RETIRED_LEARNABLES].map((m) => [m.name, closestCore(m).name])),
};

// Boss-only moves (see lib/creatures/bosses.ts). Never learnable.
export const BOSS_MOVES: Skill[] = [
  { name: "Club Smash",    damage: 20, energyCost: 40, type: "melee", dmgType: "force"  },
  { name: "Backhand",      damage: 10, energyCost: 20, type: "melee", dmgType: "force"  },
  { name: "Stomp",         damage: 12, energyCost: 40, type: "melee", dmgType: "force",  effect: { kind: "cripple", chance: 0.5, agilityLoss: 0.5, minRounds: 3, maxRounds: 3 }, desc: "50% chance to cripple: −50% agility, and a 50% chance to stumble and lose each attack, for 3 rounds." },
  { name: "Eye Laser",     damage: 30, energyCost: 70, type: "magic", dmgType: "arcane" },
  { name: "Claw Rake",     damage: 15, energyCost: 30, type: "melee", dmgType: "pierce" },
  { name: "Crushing Grip", damage: 25, energyCost: 50, type: "melee", dmgType: "force"  },
  { name: "Laser",         damage: 15, energyCost: 30, type: "magic", dmgType: "pierce" },
  { name: "Searing Beam",  damage: 25, energyCost: 50, type: "magic", dmgType: "arcane" },
  // The Hydra (the Deep Labyrinth's boss): a quick and a heavy move for each
  // head, and the breath any head can use (lib/combat/bossAi.ts HYDRA).
  { name: "Snap",          damage: 12, energyCost: 25, type: "melee",  dmgType: "pierce" },
  { name: "Rending Bite",  damage: 22, energyCost: 45, type: "melee",  dmgType: "pierce" },
  { name: "Acid Spit",     damage: 12, energyCost: 25, type: "ranged", dmgType: "pierce" },
  { name: "Acid Torrent",  damage: 22, energyCost: 45, type: "ranged", dmgType: "force"  },
  { name: "Hex Bolt",      damage: 12, energyCost: 25, type: "magic",  dmgType: "arcane" },
  { name: "Withering Curse", damage: 22, energyCost: 45, type: "magic", dmgType: "arcane" },
  { name: "Toxic Breath",  damage: 0,  energyCost: 0,  type: "magic",  dmgType: "arcane", self: true,
    desc: "A poison cloud for 3 rounds: your creature on the field, and any that come in while it hangs there, are poisoned (2.5% of max HP a round, for 20 rounds). It doesn't poison a creature that's already poisoned." },
];

export const ALL_MOVES: Skill[] = [...ALL_SKILLS, ...LEARNABLE_MOVES];
// (With the core moves, lib/creatures/raceKitsV2.ts, the moves creatures are born with.)
// (The older plain moves and the retired learnables stay in it, for the old
// species in tests: PRE_V2_SPECIES.)
export const MOVE_BY_NAME: Record<string, Skill> = Object.fromEntries([...ALL_MOVES, ...RETIRED_LEARNABLES, ...RACE_MOVES, ...BOSS_MOVES, ...CORE_MOVES, ...SPECIAL_MOVES].map((m) => [m.name, m]));
// (A retired kit move, still in some saves, finds its core move.)
for (const [old, now] of Object.entries(KIT_MOVES_STILL_RETIRED)) MOVE_BY_NAME[old] = MOVE_BY_NAME[now];

// Moves without a note of their own (the core moves' plain hits, the older
// moves) get a plain one so they read like the rest. It never says what the
// race is strong against: working that out is the player's job (the race
// chart is there for it). Bosses' moves don't need one.
const BOSS_MOVE_NAMES = new Set(BOSS_MOVES.map((m) => m.name));
for (const m of Object.values(MOVE_BY_NAME)) if (!m.desc && !m.self && !BOSS_MOVE_NAMES.has(m.name)) m.desc = `A plain ${CLASS_INFO[m.type].name.toLowerCase()} hit.`;

// Who can read a codex of this move, in a few words ("Underkin melee only"),
// in its race's colour (grey: any creature).
export function codexLearners(moveName: string): { text: string; color: string } {
  const m = MOVE_BY_NAME[moveName];
  if (m?.learnStyles) return { text: `${m.learnStyles.map((st) => CLASS_INFO[st].name).join(" / ")} fighters only`, color: m.race ? RACE_INFO[m.race].color : BALANCED_INFO.color };
  if (m?.learners) return { text: `${m.learners.length} creatures only`, color: m.race ? RACE_INFO[m.race].color : BALANCED_INFO.color };
  const races = m ? learnRacesOf(m) : [];
  const also = m?.alsoLearners?.length ? ` + ${m.alsoLearners.length} more` : " only";
  if (races.length) return { text: `${races.map((r) => RACE_INFO[r].name).join(" / ")}${also}`, color: RACE_INFO[races[0]].color };
  return { text: "any creature", color: "rgba(255,255,255,0.5)" };
}

// The race moves a creature of these races (or named on the move) could learn.
export const raceMovesFor = (c: CreatureTemplate): Skill[] => RACE_MOVES.filter((m) => !m.notLearners?.includes(c.id) &&
  (m.alsoLearners?.includes(c.id) || learnRacesOf(m).some((r) => (c.races ?? (c.race ? [c.race] : [])).includes(r))));
// The races that can learn a race move (most: just its own).
export const learnRacesOf = (m: Skill): Race[] => m.learnRaces ?? (m.race ? [m.race] : []);

function s(...names: string[]): Skill[] {
  return names.map(n => ALL_SKILLS.find(sk => sk.name === n)!).filter(Boolean);
}

// The older 25 species as they were before Combat V2 (5 old races × one of
// each rarity). Creatures that moved tier had their %s and HP scaled to fit it.
// Their V2 races, styles and moves are added below (CREATURE_TEMPLATES).
const OLDER_SPECIES: CreatureTemplate[] = [
  // BEAST
  { id: "moss_wolf",        name: "Moss Wolf",        rarity: "common",    baseHp: 65, cls: "melee", proficiency: { atk: 16, rng: 2, mag: 0, agil: 12, mdef: 4, rdef: 2, magdef: 3 }, skills: s("Slash","Jab","Heavy Blow"),                           flavour: "Camouflaged in undergrowth. Pounces before you spot it." },
  { id: "amber_wasp",       name: "Amber Wasp",       rarity: "uncommon",  baseHp: 72, cls: "ranged", proficiency: { atk: 10, rng: 12, mag: 0, agil: 22, mdef: 3, rdef: 3, magdef: 3 }, skills: s("Pebble Shot","Bolt","Jab","Stone Throw"),                  flavour: "Glass jaw but lightning fast. Always strikes first." },
  { id: "bellow_toad",      name: "Bellow Toad",      rarity: "rare",      baseHp: 102, cls: "melee", proficiency: { atk: 14, rng: 12, mag: 0, agil: 24, mdef: 10, rdef: 3, magdef: 18 }, skills: s("Cripple","Crippling Shot","Slash","Bolt"),         flavour: "Its throat swells like a bellows before it spits. The glands on its back glow when it's angry, and it's always angry." },
  { id: "dire_wolf",        name: "Dire Wolf",        rarity: "epic",      baseHp: 113, cls: "melee", proficiency: { atk: 42, rng: 4, mag: 0, agil: 22, mdef: 12, rdef: 8, magdef: 10 }, skills: s("Crush","Heavy Blow","Slash","Devastator","Impale"),     flavour: "Three times the size of a normal wolf. Twice as hungry." },
  { id: "ironhide",         name: "Ironhide",         rarity: "legendary", baseHp: 150, cls: "melee", proficiency: { atk: 52, rng: 6, mag: 0, agil: 10, mdef: 44, rdef: 30, magdef: 37 }, skills: s("Devastator","Crush","Impale","Heavy Blow","Slash","Stone Throw"), flavour: "A war elephant whose trunk was replaced with a double-headed battleaxe." },
  // UNDERKIN
  { id: "cave_bat",         name: "Cave Goblin",      rarity: "common",    baseHp: 60, cls: "ranged", proficiency: { atk: 4, rng: 14, mag: 0, agil: 16, mdef: 2, rdef: 6, magdef: 4 }, skills: s("Pebble Shot","Bolt","Flick"),                         flavour: "Pale as a cave fish and twice as mean. It sees you long before you see it, and it's already picked out a rock." },
  { id: "rust_beetle",      name: "Rust Beetle",      rarity: "uncommon",  baseHp: 82, cls: "melee", proficiency: { atk: 10, rng: 3, mag: 0, agil: 3, mdef: 24, rdef: 12, magdef: 18 }, skills: s("Slash","Jab","Flick","Heavy Blow"),                   flavour: "A walking fortress. Slow, but its shell absorbs tremendous punishment." },
  { id: "crystalback",      name: "Crystalback",      rarity: "rare",      baseHp: 100, cls: "magic", proficiency: { atk: 6, rng: 0, mag: 8, agil: 4, mdef: 30, rdef: 24, magdef: 30 }, skills: s("Frost Shard","Hex","Jab","Ice Lance"),            flavour: "Its crystalline shell refracts both blade and bolt." },
  { id: "crystal_golem",    name: "Crystal Golem",    rarity: "epic",      baseHp: 133, cls: "melee", proficiency: { atk: 28, rng: 6, mag: 0, agil: 4, mdef: 32, rdef: 20, magdef: 26 }, skills: s("Devastator","Crush","Heavy Blow","Jab"),               flavour: "Slow enough to dodge. Strong enough that it doesn't matter." },
  { id: "hollow_matriarch", name: "Hollow Matriarch", rarity: "legendary", baseHp: 140, cls: "ranged", proficiency: { atk: 24, rng: 40, mag: 0, agil: 30, mdef: 24, rdef: 22, magdef: 23 }, skills: s("Piercing Shot","Cursed Volley","Crush","Bolt","Annihilator","Heavy Blow"), flavour: "A cave-spider queen the size of a cart. The tunnels go quiet before she arrives; every thread in the dark leads back to her." },
  // ETHERIAL
  { id: "dust_sprite",      name: "Dust Sprite",      rarity: "common",    baseHp: 58, cls: "ranged", proficiency: { atk: 2, rng: 18, mag: 0, agil: 10, mdef: 2, rdef: 4, magdef: 6 }, skills: s("Pebble Shot","Stone Throw","Bolt"),                   flavour: "A tiny wind spirit. Barely visible. Surprisingly annoying." },
  { id: "flicker_wisp",     name: "Flicker Wisp",     rarity: "uncommon",  baseHp: 72, cls: "magic", proficiency: { atk: 4, rng: 0, mag: 20, agil: 16, mdef: 4, rdef: 6, magdef: 8 }, skills: s("Hex","Spark","Frost Shard","Firebolt"),            flavour: "A lantern-light that bobs just out of reach. Follow it and you're lost; fight it and you miss." },
  { id: "veilstalker",      name: "Veilstalker",      rarity: "rare",      baseHp: 85, cls: "melee", proficiency: { atk: 20, rng: 0, mag: 16, agil: 20, mdef: 6, rdef: 6, magdef: 8 }, skills: s("Slash","Hexblade","Heavy Blow","Hex"),           flavour: "Exists partially out of phase. Attacks from angles that shouldn't exist." },
  { id: "the_watcher",      name: "The Watcher",      rarity: "epic",      baseHp: 103, cls: "ranged", proficiency: { atk: 10, rng: 42, mag: 0, agil: 12, mdef: 10, rdef: 16, magdef: 20 }, skills: s("Piercing Shot","Hex Arrow","Annihilator","Bolt","Cursed Volley"),   flavour: "A Cthulhu-like eye that floats in silence. When it opens fully, something breaks." },
  { id: "void_serpent",     name: "Void Serpent",     rarity: "legendary", baseHp: 143, cls: "magic", proficiency: { atk: 34, rng: 0, mag: 38, agil: 28, mdef: 20, rdef: 20, magdef: 24 }, skills: s("Starfall","Soul Drain","Hex","Devastator","Crush","Slash"), flavour: "It doesn't come from somewhere. It comes from the absence of somewhere." },
  // UNDEAD
  { id: "rattlebones",      name: "Rattlebones",      rarity: "common",    baseHp: 62, cls: "melee", proficiency: { atk: 16, rng: 4, mag: 0, agil: 8, mdef: 8, rdef: 4, magdef: 6 }, skills: s("Slash","Jab","Flick"),                               flavour: "A skeleton that never got the message. It rattles when it laughs, and it laughs when it hits." },
  { id: "shambler",         name: "Shambler",         rarity: "uncommon",  baseHp: 84, cls: "melee", proficiency: { atk: 18, rng: 2, mag: 0, agil: 4, mdef: 16, rdef: 10, magdef: 13 }, skills: s("Heavy Blow","Slash","Jab","Flick"),                   flavour: "Slow, stubborn and missing an arm. It's been missing that arm for centuries and hasn't slowed down." },
  { id: "dustwraith",       name: "Dustwraith",       rarity: "rare",      baseHp: 83, cls: "magic", proficiency: { atk: 6, rng: 0, mag: 20, agil: 32, mdef: 4, rdef: 8, magdef: 6 }, skills: s("Hex","Spark","Frost Shard","Ice Lance"),         flavour: "A whirlwind given intent. You cannot hit what you cannot catch." },
  { id: "mr_shadows",       name: "Mr. Shadows",      rarity: "epic",      baseHp: 113, cls: "magic", proficiency: { atk: 14, rng: 0, mag: 24, agil: 16, mdef: 18, rdef: 14, magdef: 16 }, skills: s("Hex","Soul Drain","Hexblade","Starfall","Slash"),   flavour: "A worn teddy bear sits innocently. Behind it, a demonic shadow stretches across the wall." },
  { id: "storm_phoenix",    name: "Skull Raven",      rarity: "legendary", baseHp: 133, cls: "ranged", proficiency: { atk: 20, rng: 48, mag: 0, agil: 44, mdef: 14, rdef: 24, magdef: 19 }, skills: s("Annihilator","Piercing Shot","Bolt","Devastator","Flick","Stone Throw"), flavour: "A corpse ravaging scavenger." },
  // ELVISH
  { id: "thicket_archer",   name: "Thicket Archer",   rarity: "common",    baseHp: 60, cls: "ranged", proficiency: { atk: 4, rng: 20, mag: 0, agil: 10, mdef: 2, rdef: 4, magdef: 3 }, skills: s("Pebble Shot","Stone Throw","Bolt"),                   flavour: "Small, green-cloaked, and never where the arrow came from." },
  { id: "leafblade_scout",  name: "Leafblade Scout",  rarity: "uncommon",  baseHp: 74, cls: "melee", proficiency: { atk: 16, rng: 12, mag: 0, agil: 14, mdef: 4, rdef: 4, magdef: 4 }, skills: s("Slash","Bolt","Jab","Stone Throw"),                   flavour: "Runs the canopy paths with a blade in one hand and a bow on its back." },
  { id: "aurelius",         name: "Aurelius",         rarity: "rare",      baseHp: 95, cls: "ranged", proficiency: { atk: 12, rng: 22, mag: 0, agil: 14, mdef: 16, rdef: 6, magdef: 11 }, skills: s("Bolt","Piercing Shot","Heavy Blow","Stone Throw"),             flavour: "Half man, half horse, all warrior. Carries the weight of myth." },
  { id: "swamp_witch",      name: "Swamp Witch",      rarity: "epic",      baseHp: 105, cls: "magic", proficiency: { atk: 6, rng: 0, mag: 46, agil: 14, mdef: 8, rdef: 14, magdef: 11 }, skills: s("Hex","Ice Lance","Starfall","Frost Shard","Spark"), flavour: "Never seen in the open. Attacks from fog and distance." },
  { id: "sylvaran",         name: "Sylvaran, the Last Archer", rarity: "legendary", baseHp: 135, cls: "ranged", proficiency: { atk: 14, rng: 52, mag: 0, agil: 34, mdef: 16, rdef: 24, magdef: 20 }, skills: s("Annihilator","Piercing Shot","Bolt","Slash","Stone Throw","Pebble Shot"), flavour: "The last of the old archers. They say Sylvaran has never missed — only chosen not to hit." },
];

// The scannable roster (Combat V2, live since 2026-10-26): 7 races × one of
// each rarity = 35, the older species plus the new ones
// (lib/creatures/rosterV2.ts), each with its races, its V2 style and its
// race-kit moves (the first 3 are the ones it starts with: STARTING_MOVES).
const withRaces = (c: CreatureTemplate): CreatureTemplate => {
  const races = SPECIES_RACES[c.id];
  return races ? { ...c, race: races[0], races } : c;
};
export const CREATURE_TEMPLATES: CreatureTemplate[] = [...OLDER_SPECIES, ...NEW_SPECIES_V2.map((c) => ({ ...c, skills: [] }))]
  .map((c) => ({ ...c, ...V2_RESTYLE[c.id] }))
  .map((c) => withRaces({ ...c, skills: v2Moves(c) }));

// The older species as they were before Combat V2, with their old styles and
// moves, by id: for tests of battle mechanics written with those moves.
export const PRE_V2_SPECIES: Record<string, CreatureTemplate> = Object.fromEntries(
  OLDER_SPECIES.map(withRaces).map((c) => [c.id, c]),
);

// Klutz: the dopey goblin who drags you into the Den. He's your helper, not
// one of your creatures: gear him up and he'll hunt in the Labyrinth for
// you (lib/klutz.ts). He's a Rare.
// He's neutral (any style's core moves; no races, so he deals and takes neutral damage). His %s
// start at 0 and are the points you spend on him as he levels (lib/klutz.ts
// POINTS_PER_LEVEL), so you, his weapon and the codexes you teach him decide
// how he fights. He starts as a brawler; other styles come from codexes.
export const KLUTZ: CreatureTemplate = {
  id: "klutz", name: "Klutz", rarity: "rare", baseHp: 80, companion: true, cls: "melee", neutral: true,
  proficiency: { atk: 0, rng: 0, mag: 0, agil: 0, mdef: 0, rdef: 0, magdef: 0 },
  skills: CORE_MOVES, // all 9 (no race: they land neutral); he starts with the first 4
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
  // The Hydra (the Deep Labyrinth's boss): three heads, each its own fighter, left to right.
  { id: "hydra_fang", name: "Fang Head", rarity: "legendary", baseHp: 250, boss: true, cls: "melee", proficiency: NO_PROF,
    skills: bossMoves("Snap", "Rending Bite", "Toxic Breath"),
    flavour: "The right head. All teeth, and it never lets go." },
  { id: "hydra_spitter", name: "Spitter Head", rarity: "legendary", baseHp: 225, boss: true, cls: "ranged", proficiency: NO_PROF,
    skills: bossMoves("Acid Spit", "Acid Torrent", "Toxic Breath"),
    flavour: "The left head. Its spit eats through stone." },
  { id: "hydra_hex", name: "Hex Head", rarity: "legendary", baseHp: 225, boss: true, cls: "magic", proficiency: NO_PROF,
    skills: bossMoves("Hex Bolt", "Withering Curse", "Toxic Breath"),
    flavour: "The middle head. Its eyes glow, and its whispers hurt." },
  // The first quest's thief (lib/quest.ts): the guided first fight.
  { id: "baby_cyclops", name: "Baby Cyclops", rarity: "rare", baseHp: 76, boss: true, cls: "melee", proficiency: NO_PROF,
    skills: bossMoves("Backhand", "Club Smash"),
    flavour: "A Cyclops whelp with sticky fingers and a hide like a door. It grabbed Klutz's box and ran." },
];

// Every creature that can exist (scannable, companions, boss parts), by id.
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

// Combat V2 creatures start with 3 moves; a codex fills the fourth slot
// (the user, 2026-10-26). Klutz and the old species (PRE_V2_SPECIES, for
// tests) still start with 4. A V2 creature: its main style's core moves.
export const STARTING_MOVES = 3;
export const startingMoveCount = (c: CreatureTemplate) => (!c.neutral && CORE_MOVE_NAMES.has(c.skills[0]?.name) ? STARTING_MOVES : MOVE_SLOTS);
export function defaultMoveNames(c: CreatureTemplate): string[] {
  return c.skills.slice(0, startingMoveCount(c)).map((m) => m.name);
}

// A saved move's name today: a retired move is its closest core move
// (RETIRED_MOVES).
export const currentMoveName = (name: string) => RETIRED_MOVES[name] ?? name;
export const isRetiredMove = (name: string) => name in RETIRED_MOVES;

// A creature's saved moves with each retired one replaced by its closest
// core move (the user, 2026-11-12). If that's one it already has, the next
// of its core moves it doesn't (so it keeps as many moves as it had).
export function replaceRetired(c: CreatureTemplate, names: string[], retired: Record<string, string> = RETIRED_MOVES): string[] {
  const out: string[] = [];
  const own = (n: string) => c.skills.some((m) => m.name === n);
  for (const n of names) {
    if (own(n) || !(n in retired)) { if (!out.includes(n)) out.push(n); continue; }
    const now = retired[n];
    const style = MOVE_BY_NAME[now]?.type;
    const free = (m: Skill) => !out.includes(m.name) && !names.includes(m.name);
    const pick = own(now) && !out.includes(now) ? now
      : (c.skills.find((m) => m.type === style && free(m)) ?? c.skills.find(free))?.name;
    if (pick) out.push(pick);
  }
  return out;
}

// Moves that were renamed after a new move took the name (the user,
// 2026-10-26: Blink is now the Neutral priority magic move; the older haste
// spell is Quickcast). Only for codexes, moves learned from codexes and the
// discovery list: the new Blink never comes as a codex, so a Blink there is
// always the old one.
export const RENAMED_MOVES: Record<string, string> = { Blink: "Quickcast" };
export const renamedMove = (name: string) => RENAMED_MOVES[name] ?? name;

// Can this creature learn a move from a codex? Learnable moves: anyone.
// Race moves: only creatures of that race (or named on the move; never
// Klutz). Special moves: their own lists. (The retired moves: no one.)
export function canLearnFromCodex(c: CreatureTemplate, moveName: string): boolean {
  if (isSpecialMove(moveName)) return canLearnSpecial(c, MOVE_BY_NAME[moveName]);
  if (LEARNABLE_MOVES.some((m) => m.name === moveName)) return true;
  if (c.neutral && RACE_MOVES.some((m) => m.name === moveName)) return false;
  return [...raceMovesFor(c), ...c.skills].some((m) => m.name === moveName);
}

// The moves a creature can put in its slots: the ones it was born with (its
// rolled moves; its species' starting moves if it has none saved) and any it
// has learned from codexes.
export function movesAvailableTo(c: CreatureTemplate, learned: string[] = [], own?: string[]): Skill[] {
  const names = [...new Set([...(own?.length ? own.map(currentMoveName) : defaultMoveNames(c)), ...learned.filter((n) => canLearnFromCodex(c, n))])];
  return names.map((n) => moveOf(c, n)).filter(Boolean);
}

// A move as this creature knows it: one of its own (a core move lands as its
// race), else the move itself.
export const moveOf = (c: CreatureTemplate, name: string): Skill => c.skills.find((m) => m.name === name) ?? MOVE_BY_NAME[name];

// The 4 moves a creature fights with. Unknown or duplicate names are
// dropped; an empty selection falls back to the defaults. (Race and class
// codex moves are only offered once learned, so a saved one is trusted here.)
export function resolveMoves(c: CreatureTemplate, names?: string[]): Skill[] {
  const allowed = new Set([...c.skills, ...raceMovesFor(c), ...LEARNABLE_MOVES, ...SPECIAL_MOVES.filter((m) => canLearnSpecial(c, m))].map((m) => m.name));
  // (A move of its own keeps its name: the old species in tests know the older moves.)
  const picked = [...new Set(replaceRetired(c, names ?? []))].filter((n) => allowed.has(n)).slice(0, MOVE_SLOTS);
  // A species' own moves first: Combat V2's kit moves aren't in MOVE_BY_NAME.
  const moves = (picked.length > 0 ? picked : defaultMoveNames(c)).map((n) => c.skills.find((m) => m.name === n) ?? MOVE_BY_NAME[n]);
  // There's no resting, so every set keeps a steady move. One without (a
  // set saved before the rule) gets its first steady move in the last slot.
  if (hasSteadyMove(moves)) return moves;
  const steady = [...c.skills, ...ALL_SKILLS].find(isSteadyMove);
  if (!steady) return moves;
  return moves.length < MOVE_SLOTS ? [...moves, steady] : [...moves.slice(0, -1), steady];
}

// A steady move costs at most STEADY_MAX_ENERGY, so it's always affordable
// (energy never drops below ENERGY_REGEN after an attack) and a creature never
// has to rest. Every set of moves keeps one (the user, 2026-10-26: no resting).
export const STEADY_MAX_ENERGY = 30;
export const isSteadyMove = (m: Skill) => m.energyCost <= STEADY_MAX_ENERGY && !m.cooldown && !m.self;
export const hasSteadyMove = (moves: Skill[]) => moves.some(isSteadyMove);
