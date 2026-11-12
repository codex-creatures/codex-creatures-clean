// lib/creatures/codexMoves.ts
// The 2026-11 codex moves: the user's 29 (names and what they do), with
// Claude's draft numbers and learners (by race and by how the creature looks;
// not race-locked). Simmed in two rounds (3v3 and 5v5, Lv 5–30) before they
// went in. They join SPECIAL_MOVES (creatureData.ts), so codexes of them
// come from scans, chests and librarians by their rarity. How each effect
// plays is in lib/combat/battle.ts.
//
// Big hits use a damage multiplier (mult), not big power: power counts for
// less and less as attack grows, a multiplier holds at every level.

import type { CombatClass, MoveEffect, Skill } from "./creatureData";
import type { RaceV2 } from "./racesV2";

type Rarity = NonNullable<Skill["codexRarity"]>;
type Extra = Partial<Skill>;

// A move that lands as its own race (asRace), and is that race's codex (race).
const move = (name: string, type: CombatClass, race: RaceV2 | undefined, damage: number, energyCost: number,
  codexRarity: Rarity, effect: MoveEffect | undefined, learners: string[] | undefined, desc: string, extra: Extra = {}): Skill => ({
  name, type, damage, energyCost, dmgType: "force", codexRarity, desc,
  ...(effect ? { effect } : {}), ...(learners ? { learners } : {}), ...(race ? { race, asRace: race } : {}), ...extra,
});
// No damage: the "utility" moves (a style only for the tablet's mark).
const utility = (name: string, race: RaceV2 | undefined, energyCost: number, codexRarity: Rarity, effect: MoveEffect, learners: string[] | undefined, desc: string, extra: Extra = {}) =>
  move(name, "magic", race, 0, energyCost, codexRarity, effect, learners, desc, extra);

// Creatures with hands (Caltrops, Slap).
const HANDS = ["cave_bat", "rattlebones", "shambler", "leafblade_scout", "swamp_witch", "mr_shadows", "crystal_golem", "dreadpox", "pale_rider", "aurelius", "thicket_archer", "sylvaran", "veilstalker"];
const ARCHERS = ["thicket_archer", "sylvaran", "aurelius", "leafblade_scout"];
const TOXIC_CROWD = ["dreadpox", "swamp_witch", "rotgut_fly", "glob", "plague_rat", "shambler", "bellow_toad"];

export const CODEX_MOVES_2026: Skill[] = [
  move("Whiplash", "melee", "humanoid", 15, 50, "common", { kind: "agility", gain: 0.5 },
    ["leafblade_scout", "aurelius", "pale_rider", "cave_bat", "veilstalker"],
    "Then +50% agility for the rest of the fight. Doesn't stack."),
  utility("Nullifying Voice", "divine", 40, "uncommon", { kind: "weaken", style: "magic", loss: 0.5 },
    ["flicker_wisp", "gleamling", "the_watcher", "veilstalker", "void_serpent", "flame_imp"],
    "The target's magic attack is halved until it leaves the field."),
  move("Smoke Bomb", "magic", "geo", 5, 40, "rare", { kind: "smoke" },
    ["flame_imp", "dust_sprite", "dustwraith", "thunderhead", "mr_shadows", "cave_bat"],
    "Goes first: a small hit, then it swaps out. The one coming in takes their hit.", { cooldown: 3 }),
  move("Vampiric Bite", "melee", "underkin", 20, 60, "uncommon", { kind: "lifesteal", share: 0.3 },
    ["deep_angler", "hollow_matriarch", "tunnel_wyrm", "veilstalker", "cave_bat", "plague_rat"],
    "Heals 30% of the damage it does."),
  move("Nibble", "melee", "undead", 8, 20, "common", { kind: "chain", step: 0.1, cap: 0.5 },
    ["rattlebones", "shambler", "plague_rat", "storm_phoenix", "rust_beetle"],
    "+10% each time in a row (up to +50%). Stacks with Perfectionist."),
  utility("Crystal Armour", "divine", 40, "common", { kind: "ward", rounds: 3 },
    ["crystalback", "crystal_golem", "gleamling", "the_watcher", "void_serpent"],
    "Clears its status effects, and none can touch it for 3 rounds (no cripple, poison, bleed, clouds).", { self: true, cooldown: 5 }),
  move("Obsidian Arrows", "ranged", "geo", 15, 60, "rare", { kind: "bleed", chance: 1, tick: 0.1 },
    ["dustwraith", "thicket_archer", "aurelius", "sylvaran", "flame_imp", "leafblade_scout"],
    "The target bleeds 10% of its max HP a round until it leaves the field. Undead don't bleed."),
  move("Bone Javelin", "ranged", "underkin", 25, 40, "uncommon", undefined,
    ["hollow_matriarch", "cave_bat", "rattlebones", "storm_phoenix", "leafblade_scout", "aurelius"],
    "A heavy throw for little energy: 1.3× a heavy hit.", { cooldown: 3, mult: 1.3 }),
  utility("Caltrops", undefined, 40, "uncommon", { kind: "caltrops", entry: 0.1 }, HANDS,
    "Under the foes for the rest of the fight: each creature that comes in loses 10% of its max HP."),
  utility("Cleansing Water", "geo", 60, "uncommon", { kind: "cleanse" },
    ["thunderhead", "crystalback", "crystal_golem", "bellow_toad", "deep_angler"],
    "Your whole team is cured of venom, poison and bleed; any cloud or blood under your team washes away.", { self: true, cooldown: 3 }),
  move("Septic Shock", "ranged", "toxic", 15, 50, "rare", { kind: "septic", mult: 2 },
    ["rotgut_fly", "bellow_toad", "amber_wasp", "dreadpox", "swamp_witch"],
    "Double damage if the target is bleeding or blood lies under it."),
  move("Smite", "magic", "divine", 25, 55, "rare", { kind: "execute", below: 0.3, bonus: 0.5 },
    ["flicker_wisp", "gleamling", "the_watcher", "void_serpent", "veilstalker", "flame_imp", "thunderhead"],
    "+50% damage if the target is below 30% HP."),
  utility("Haunting Scream", "undead", 50, "epic", { kind: "weaken", loss: 0.5, rounds: 3, forceSwap: 0.7 },
    ["dustwraith", "mr_shadows", "storm_phoenix", "shambler", "pale_rider", "dreadpox"],
    "70%: the target flees for a random teammate. If not, all its attacks are halved for 3 rounds.", { cooldown: 5 }),
  move("Mega Smash", "melee", "beast", 25, 50, "rare", { kind: "charge" },
    ["ironhide", "dire_wolf", "moss_wolf", "crystalback", "aurelius", "void_serpent", "hollow_matriarch"],
    "Winds up for a turn, then hits for 2.5× a heavy hit (free, and it still regains energy).", { mult: 2.5 }),
  move("Soul Snatch", "magic", "undead", 20, 60, "uncommon", { kind: "lifesteal", share: 0.3 },
    ["dustwraith", "mr_shadows", "dreadpox", "pale_rider", "swamp_witch"],
    "Heals 30% of the damage it does."),
  utility("Choking Smog", "toxic", 90, "epic", { kind: "cloud", tick: 0.1, minRounds: 5, maxRounds: 7, tailMin: 1, tailMax: 3 }, TOXIC_CROWD,
    "A poison cloud under the foes for 5–7 rounds: 10% max HP a round to the one out, and 1–3 rounds more after. Toxic are immune."),
  move("Emulate", "magic", "geo", 20, 50, "rare", { kind: "ignite", mult: 2 },
    ["flame_imp", "thunderhead", "dust_sprite", "dustwraith", "crystal_golem"],
    "Double damage if a cloud lies under the target's team, and it burns the cloud away."),
  move("Ambush", "melee", "underkin", 15, 50, "uncommon", { kind: "ambush", bonus: 0.5 },
    ["cave_bat", "hollow_matriarch", "deep_angler", "veilstalker", "tunnel_wyrm", "rust_beetle"],
    "Always goes first. +50% damage if the target is at full HP."),
  move("Voltage Surge", "magic", "geo", 15, 60, "rare", { kind: "surge", gain: 0.25 },
    ["thunderhead", "flame_imp", "dust_sprite", "crystal_golem", "dustwraith"],
    "Then +25% magic damage for the rest of the fight. Doesn't stack."),
  move("Poison Dart", "ranged", "toxic", 10, 40, "common", { kind: "poison", chance: 0.7, tick: 0.05, minRounds: 3, maxRounds: 5 },
    ["rotgut_fly", "amber_wasp", "bellow_toad", "swamp_witch", "dreadpox", "thicket_archer", "cave_bat"],
    "70% chance to poison: 5% max HP a round for 3–5 rounds. Toxic are immune."),
  move("Bolas Shot", "ranged", "humanoid", 10, 60, "uncommon", { kind: "cripple", chance: 0.7 },
    ["thicket_archer", "leafblade_scout", "aurelius", "sylvaran", "pale_rider"],
    "70% chance to cripple for 3 rounds: slower, and may stumble and lose an attack."),
  utility("Enfeeble", "undead", 50, "uncommon", { kind: "cripple", chance: 1, minRounds: 5, maxRounds: 5 },
    ["dreadpox", "mr_shadows", "swamp_witch", "shambler", "pale_rider", "dustwraith"],
    "Cripples the target for 5 rounds: slower, and may stumble and lose an attack.", { cooldown: 5 }),
  move("Implode", "melee", "toxic", 25, 50, "epic", { kind: "implode", tick: 0.1, minRounds: 3, maxRounds: 5, tailMin: 1, tailMax: 3 },
    ["glob", "bellow_toad", "rotgut_fly", "plague_rat", "amber_wasp"],
    "Goes last. If it lives to act: 2.5× a heavy hit, it falls, and a poison cloud lies under the foes for 3–5 rounds.", { mult: 2.5 }),
  utility("Flame Body", "geo", 40, "rare", { kind: "flamebody", reflect: 0.3, rounds: 3 },
    ["flame_imp", "dust_sprite", "thunderhead", "gleamling", "tunnel_wyrm"],
    "Burns away the cloud under your team. For 3 rounds, melee attackers take 30% of their hit.", { self: true, cooldown: 5 }),
  move("Haemorrhage", "melee", "underkin", 10, 50, "rare", { kind: "gore", rounds: 4, amp: 0.5 },
    ["hollow_matriarch", "deep_angler", "veilstalker", "cave_bat", "tunnel_wyrm", "rust_beetle"],
    "Blood under the foes for 4 rounds: toxic damage on them is +50%. A cloud soaks it up and grows stronger. Not Undead."),
  move("Fissure", "melee", "geo", 15, 60, "epic", { kind: "barrage" },
    ["tunnel_wyrm", "ironhide", "crystal_golem", "thunderhead", "crystalback", "rust_beetle"],
    "Splits the ground under every foe on the field."),
  move("Headbutt", "melee", undefined, 25, 50, "common", { kind: "recoil", share: 0.2 }, undefined,
    "1.4× a heavy hit, but it takes 20% of the damage itself.", { mult: 1.4, learnStyles: ["melee"] }),
  move("Slap", "melee", undefined, 10, 35, "common", { kind: "slap", chance: 0.7 }, HANDS,
    "70% chance to wipe the target's stat changes (boosts, soaks, weakens)."),
  move("Razor Arrows", "ranged", "humanoid", 15, 50, "uncommon", { kind: "bleed", chance: 0.5, tick: 0.1 }, ARCHERS,
    "50% chance the target bleeds 10% of its max HP a round until it leaves the field. Undead don't bleed."),
];
