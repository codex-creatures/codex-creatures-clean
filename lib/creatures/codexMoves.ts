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

// Horn Rush: the share of its agility it swings with. Spirit Blade: the share of the target's max HP each swing adds.
export const HORN_RUSH_AGILITY = 0.6;
export const SPIRIT_BLADE = { share: 0.06, boss: 0.03 };
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

// Who can read each codex, and some rarities and races, are the user's v2
// codex review (2026-11-16), over Claude's drafts.

export const CODEX_MOVES_2026: Skill[] = [
  move("Whiplash", "melee", "humanoid", 15, 40, "common", { kind: "agility", gain: 0.5 },
    ["moss_wolf", "amber_wasp", "bellow_toad", "dire_wolf", "cave_bat", "rust_beetle", "hollow_matriarch", "veilstalker", "the_watcher", "void_serpent", "mr_shadows", "storm_phoenix", "thicket_archer", "leafblade_scout", "aurelius", "sylvaran", "flame_imp", "thunderhead", "deep_angler", "plague_rat", "rotgut_fly", "pale_rider", "cinder_husk", "gravewarden", "gutsnout", "hexed_puppet", "skinwing"],
    "Then +50% agility for the rest of the fight. Doesn't stack."),
  utility("Nullifying Voice", "divine", 40, "uncommon", { kind: "weaken", style: "magic", loss: 0.5 },
    ["bellow_toad", "crystalback", "crystal_golem", "dust_sprite", "flicker_wisp", "veilstalker", "the_watcher", "void_serpent", "dustwraith", "mr_shadows", "storm_phoenix", "swamp_witch", "gleamling", "flame_imp", "thunderhead", "dreadpox", "cinder_husk", "hexed_puppet", "skinwing", "labyrinth_sprite"],
    "The target's magic attack is halved until it leaves the field."),
  move("Smoke Bomb", "magic", "geo", 5, 40, "rare", { kind: "smoke" },
    ["ironhide", "cave_bat", "rust_beetle", "crystalback", "crystal_golem", "dust_sprite", "veilstalker", "dustwraith", "mr_shadows", "leafblade_scout", "swamp_witch", "flame_imp", "thunderhead", "tunnel_wyrm", "dreadpox", "cinder_husk", "gloom_gnome", "mole_hag", "labyrinth_sprite"],
    "Goes first: a small hit, then it swaps out. The one coming in takes their hit.", { cooldown: 3 }),
  move("Vampiric Bite", "melee", "underkin", 20, 60, "uncommon", { kind: "lifesteal", share: 0.3 },
    ["ironhide", "cave_bat", "hollow_matriarch", "veilstalker", "void_serpent", "shambler", "swamp_witch", "deep_angler", "tunnel_wyrm", "plague_rat", "glob", "cinder_husk", "hexed_puppet", "skinwing"],
    "Heals 30% of the damage it does."),
  // (Up to 10 times in a row, +100%: the user, 2026-11-20; it was 5, +50%.)
  move("Nibble", "melee", "undead", 8, 20, "common", { kind: "chain", step: 0.1, cap: 1 },
    ["moss_wolf", "dire_wolf", "ironhide", "cave_bat", "rust_beetle", "crystalback", "hollow_matriarch", "veilstalker", "void_serpent", "rattlebones", "shambler", "mr_shadows", "swamp_witch", "flame_imp", "deep_angler", "tunnel_wyrm", "plague_rat", "glob", "hexed_puppet", "mole_hag", "skinwing"],
    "+10% each time in a row (up to 10 times: +100%). Stacks with Perfectionist."),
  utility("Crystal Armour", "divine", 40, "common", { kind: "ward", rounds: 3 },
    ["bellow_toad", "ironhide", "rust_beetle", "crystalback", "crystal_golem", "hollow_matriarch", "the_watcher", "void_serpent", "mr_shadows", "storm_phoenix", "aurelius", "swamp_witch", "sylvaran", "gleamling", "flame_imp", "thunderhead", "tunnel_wyrm", "pale_rider", "cinder_husk", "labyrinth_sprite"],
    "Clears its status effects, and none can touch it for 3 rounds (no cripple, poison, bleed, clouds).", { self: true, cooldown: 5 }),
  // (A sure bleed, so a slow one: 6% a round since 2026-11-25; Razor Arrows is the 10% gamble.)
  move("Obsidian Arrows", "ranged", "geo", 15, 60, "rare", { kind: "bleed", chance: 1, tick: 0.06 },
    ["crystalback", "crystal_golem", "hollow_matriarch", "flicker_wisp", "storm_phoenix", "thicket_archer", "leafblade_scout", "aurelius", "sylvaran", "flame_imp", "thunderhead", "pale_rider", "cinder_husk"],
    "The target bleeds 6% of its max HP a round until it leaves the field. Undead don't bleed."),
  move("Bone Javelin", "ranged", "underkin", 25, 40, "rare", undefined,
    ["cave_bat", "hollow_matriarch", "rattlebones", "shambler", "storm_phoenix", "thicket_archer", "aurelius", "sylvaran", "deep_angler", "pale_rider", "troglodyte_brute"],
    "A heavy throw for little energy: 1.3× a heavy hit.", { cooldown: 3, mult: 1.3 }),
  utility("Caltrops", "humanoid", 40, "epic", { kind: "caltrops", entry: 0.1 }, // (Epic since 2026-11-24, the user: they last the whole fight)
    ["ironhide", "cave_bat", "crystal_golem", "hollow_matriarch", "rattlebones", "thicket_archer", "leafblade_scout", "aurelius", "sylvaran", "flame_imp", "tunnel_wyrm", "dreadpox", "pale_rider", "gravewarden", "grub_keeper"],
    "Under the foes for the rest of the fight: each creature that comes in loses 10% of its max HP."),
  utility("Cleansing Water", "geo", 40, "common", { kind: "cleanse" },
    ["bellow_toad", "crystalback", "crystal_golem", "flicker_wisp", "mr_shadows", "swamp_witch", "gleamling", "thunderhead", "deep_angler", "glob", "dreadpox", "gravewarden", "mole_hag", "labyrinth_sprite"],
    "Your whole team is cured of venom, poison, burns and bleed; any cloud or blood under your team washes away.", { self: true, cooldown: 3 }),
  move("Septic Shock", "ranged", "toxic", 15, 50, "rare", { kind: "septic", mult: 2 },
    ["amber_wasp", "bellow_toad", "hollow_matriarch", "the_watcher", "void_serpent", "shambler", "mr_shadows", "storm_phoenix", "swamp_witch", "plague_rat", "rotgut_fly", "glob", "dreadpox", "hexed_puppet"],
    "Double damage if the target is bleeding or blood lies under it."),
  move("Smite", "magic", "divine", 25, 55, "epic", { kind: "execute", below: 0.3, bonus: 0.5 },
    ["crystalback", "crystal_golem", "flicker_wisp", "the_watcher", "dustwraith", "mr_shadows", "swamp_witch", "sylvaran", "gleamling", "flame_imp", "thunderhead", "pale_rider", "gravewarden", "labyrinth_sprite"],
    "+50% damage if the target is below 30% HP."),
  utility("Haunting Scream", "undead", 50, "legendary", { kind: "weaken", loss: 0.5, rounds: 5, forceSwap: 0.7 },
    ["dustwraith", "mr_shadows", "tunnel_wyrm", "dreadpox", "pale_rider", "cinder_husk", "hexed_puppet"],
    "70%: the target flees for a random teammate. If not, all its attacks are halved for 5 rounds.", { cooldown: 5 }),
  move("Mega Smash", "melee", "beast", 25, 50, "rare", { kind: "charge" },
    ["moss_wolf", "bellow_toad", "dire_wolf", "ironhide", "rust_beetle", "crystalback", "crystal_golem", "hollow_matriarch", "the_watcher", "void_serpent", "aurelius", "thunderhead", "gravewarden", "gutsnout", "troglodyte_brute"],
    "Winds up for a turn, then hits for 2.5× a heavy hit (free, and it still regains energy).", { mult: 2.5 }),
  move("Soul Snatch", "magic", "undead", 20, 60, "rare", { kind: "lifesteal", share: 0.3 },
    ["hollow_matriarch", "dust_sprite", "flicker_wisp", "veilstalker", "the_watcher", "dustwraith", "mr_shadows", "swamp_witch", "flame_imp", "thunderhead", "dreadpox", "pale_rider", "cinder_husk", "gloom_gnome", "hexed_puppet"],
    "Heals 30% of the damage it does."),
  utility("Choking Smog", "toxic", 75, "legendary", { kind: "cloud", tick: 0.1, minRounds: 5, maxRounds: 7, tailMin: 1, tailMax: 3 }, 
    ["bellow_toad", "crystal_golem", "the_watcher", "void_serpent", "mr_shadows", "swamp_witch", "plague_rat", "glob", "dreadpox"],
    "A poison cloud under the foes for 5–7 rounds: 10% max HP a round to the one out, and 1–3 rounds more after. Toxic are immune."),
  // The user's answer to Caltrops (2026-11-24): a weak magic hit that shoves the hazards off your side of the field.
  move("Force Push", "magic", "geo", 5, 40, "rare", { kind: "forcepush", burst: 0.1 },
    ["crystalback", "crystal_golem", "dust_sprite", "flicker_wisp", "the_watcher", "dustwraith", "mr_shadows", "swamp_witch", "gleamling", "thunderhead", "tunnel_wyrm", "sylvaran", "troglodyte_brute"],
    "A small hit that shoves any caltrops or cloud off your side; caltrops are hurled at the target for 10% of its max HP."),
  move("Emulate", "magic", "geo", 20, 50, "rare", { kind: "ignite", mult: 2 },
    ["crystalback", "crystal_golem", "dust_sprite", "flicker_wisp", "the_watcher", "dustwraith", "mr_shadows", "swamp_witch", "gleamling", "flame_imp", "thunderhead", "dreadpox", "cinder_husk", "gloom_gnome"],
    "Double damage if a cloud lies under the target's team: it goes up in flames, for one more tick of it."),
  move("Ambush", "melee", "underkin", 15, 50, "uncommon", { kind: "ambush", bonus: 0.5 },
    ["moss_wolf", "dire_wolf", "cave_bat", "hollow_matriarch", "veilstalker", "void_serpent", "deep_angler", "tunnel_wyrm", "plague_rat", "pale_rider", "cinder_husk", "hexed_puppet", "mole_hag", "skinwing"],
    "Always goes first. +50% damage if the target is at full HP."),
  move("Voltage Surge", "magic", "geo", 15, 60, "rare", { kind: "surge", gain: 0.25 },
    ["crystalback", "crystal_golem", "dust_sprite", "flicker_wisp", "the_watcher", "dustwraith", "mr_shadows", "storm_phoenix", "swamp_witch", "gleamling", "flame_imp", "thunderhead", "dreadpox", "cinder_husk"],
    "Then +25% magic damage for the rest of the fight. Doesn't stack."),
  move("Poison Dart", "ranged", "toxic", 10, 40, "common", { kind: "poison", chance: 0.7, tick: 0.05, minRounds: 3, maxRounds: 5 },
    ["amber_wasp", "bellow_toad", "cave_bat", "hollow_matriarch", "veilstalker", "the_watcher", "void_serpent", "storm_phoenix", "thicket_archer", "leafblade_scout", "swamp_witch", "sylvaran", "deep_angler", "rotgut_fly", "glob", "dreadpox", "gloom_gnome", "skinwing", "labyrinth_sprite"],
    "70% chance to poison: 5% max HP a round for 3–5 rounds. Toxic are immune."),
  move("Bolas Shot", "ranged", "humanoid", 10, 60, "uncommon", { kind: "cripple", chance: 0.7 },
    ["cave_bat", "hollow_matriarch", "storm_phoenix", "thicket_archer", "leafblade_scout", "aurelius", "sylvaran", "rotgut_fly", "pale_rider", "gravewarden", "mole_hag", "troglodyte_brute"],
    "70% chance to cripple for 3–5 rounds: slower, and may stumble and lose an attack."),
  utility("Enfeeble", "undead", 50, "uncommon", { kind: "cripple", chance: 1, minRounds: 3, maxRounds: 3 },
    ["crystalback", "crystal_golem", "the_watcher", "shambler", "dustwraith", "mr_shadows", "swamp_witch", "thunderhead", "dreadpox", "pale_rider", "hexed_puppet", "mole_hag"],
    "Cripples the target for 3 rounds: slower, and may stumble and lose an attack.", { cooldown: 5 }),
  move("Implode", "melee", "toxic", 25, 50, "epic", { kind: "implode", tick: 0.1, minRounds: 3, maxRounds: 5, tailMin: 1, tailMax: 3 },
    ["bellow_toad", "crystal_golem", "the_watcher", "gleamling", "flame_imp", "thunderhead", "plague_rat", "rotgut_fly", "glob", "dreadpox"],
    "Goes last. If it lives to act: 2.5× a heavy hit, it falls, and a poison cloud lies under the foes for 3–5 rounds.", { mult: 2.5 }),
  utility("Flame Body", "geo", 40, "rare", { kind: "flamebody", reflect: 0.3, rounds: 3 },
    ["ironhide", "rust_beetle", "crystalback", "crystal_golem", "dust_sprite", "dustwraith", "gleamling", "flame_imp", "thunderhead", "tunnel_wyrm", "glob", "cinder_husk", "gloom_gnome", "gravewarden"],
    "Burns away the cloud under your team. For 3 rounds, melee attackers take 30% of their hit.", { self: true, cooldown: 5 }),
  move("Haemorrhage", "melee", "underkin", 10, 50, "rare", { kind: "gore", rounds: 4, amp: 0.5 },
    ["cave_bat", "rust_beetle", "hollow_matriarch", "veilstalker", "void_serpent", "rattlebones", "mr_shadows", "storm_phoenix", "deep_angler", "tunnel_wyrm", "pale_rider", "skinwing", "troglodyte_brute"],
    "Blood under the foes for 4 rounds: toxic damage on them is +50%. A cloud soaks it up and grows stronger. Not Undead."),
  move("Fissure", "melee", "geo", 15, 60, "epic", { kind: "barrage" },
    ["ironhide", "rust_beetle", "crystalback", "crystal_golem", "dust_sprite", "dustwraith", "mr_shadows", "swamp_witch", "flame_imp", "thunderhead", "tunnel_wyrm", "dreadpox", "cinder_husk"],
    "Splits the ground under every foe on the field."),
  move("Headbutt", "melee", undefined, 25, 50, "common", { kind: "recoil", share: 0.35 },
    ["moss_wolf", "amber_wasp", "bellow_toad", "dire_wolf", "ironhide", "cave_bat", "rust_beetle", "crystal_golem", "hollow_matriarch", "veilstalker", "the_watcher", "void_serpent", "rattlebones", "shambler", "storm_phoenix", "thicket_archer", "leafblade_scout", "aurelius", "thunderhead", "deep_angler", "tunnel_wyrm", "plague_rat", "rotgut_fly", "glob", "pale_rider", "gravewarden", "grub_keeper", "gutsnout", "troglodyte_brute"],
    "1.4× a heavy hit, but it takes 35% of the damage itself.", { mult: 1.4 }),
  move("Slap", "melee", undefined, 10, 35, "common", { kind: "slap", chance: 0.7 }, 
    ["bellow_toad", "cave_bat", "crystal_golem", "hollow_matriarch", "veilstalker", "rattlebones", "shambler", "mr_shadows", "thicket_archer", "leafblade_scout", "aurelius", "swamp_witch", "sylvaran", "thunderhead", "plague_rat", "dreadpox", "pale_rider", "gloom_gnome", "grub_keeper", "hexed_puppet", "mole_hag", "troglodyte_brute"],
    "70% chance to wipe the target's stat changes (boosts, soaks, weakens)."),
  move("Razor Arrows", "ranged", "humanoid", 15, 50, "uncommon", { kind: "bleed", chance: 0.25, tick: 0.1 },
    ["hollow_matriarch", "veilstalker", "storm_phoenix", "thicket_archer", "leafblade_scout", "aurelius", "sylvaran", "pale_rider", "gravewarden"],
    "25% chance the target bleeds 10% of its max HP a round until it leaves the field. Undead don't bleed."),

  // The user's third batch (2026-11-19): moves, learners and rules all theirs. "Usual damage"
  // is the core moves' rate (half a power per energy); numbers not yet simmed.
  move("Flame Spit", "ranged", "geo", 10, 20, "common", { kind: "burn", chance: 0.05, tick: 0.05, minRounds: 3, maxRounds: 5 },
    ["rust_beetle", "tunnel_wyrm", "dust_sprite", "flame_imp", "crystalback", "crystal_golem", "thunderhead", "gleamling", "flicker_wisp", "rotgut_fly", "cinder_husk", "gutsnout", "mole_hag", "labyrinth_sprite"],
    "5% chance to burn: 5% max HP a round for 3–5 rounds. Burning puts out bleeding. Geo are immune."),
  move("Cursed Claw", "melee", "undead", 20, 40, "uncommon", { kind: "fright", chance: 0.1 },
    ["dire_wolf", "ironhide", "cave_bat", "veilstalker", "shambler", "mr_shadows", "dreadpox", "pale_rider", "cinder_husk", "gloom_gnome", "hexed_puppet"],
    "If it strikes first, 10% chance the target is struck with fear and loses its attack."),
  move("Claw", "melee", "beast", 10, 20, "common", undefined,
    ["moss_wolf", "dire_wolf", "ironhide", "cave_bat", "rust_beetle", "deep_angler", "hollow_matriarch", "flame_imp", "crystalback", "crystal_golem", "veilstalker", "rattlebones", "shambler", "storm_phoenix", "plague_rat", "dreadpox", "cinder_husk", "gutsnout", "hexed_puppet", "mole_hag", "skinwing", "labyrinth_sprite"],
    "A plain claw."),
  // Divine's basic hit (the user, 2026-11-20: name, style, rarity and energy; the power is Claude's, a 30-energy
  // plain hit's 15). A new player's Divine starter knows it.
  move("Blessed Bolt", "ranged", "divine", 15, 30, "uncommon", undefined,
    ["flicker_wisp", "veilstalker", "the_watcher", "void_serpent", "gleamling", "flame_imp", "labyrinth_sprite"],
    "A plain bolt of holy light."),
  // Underkin's basic hit (the user, 2026-11-20: a new player's Underkin starter knows it; the name is Claude's).
  move("Rock Toss", "ranged", "underkin", 10, 20, "common", undefined,
    ["cave_bat", "rust_beetle", "hollow_matriarch", "veilstalker", "deep_angler", "tunnel_wyrm", "cinder_husk", "gravewarden", "grub_keeper", "gutsnout", "troglodyte_brute"],
    "A plain thrown rock."),
  // Smoke Bomb's numbers, but it doesn't go first, and the player picks who comes in.
  move("Bounce", "melee", "beast", 5, 40, "rare", { kind: "bounce" },
    ["moss_wolf", "amber_wasp", "bellow_toad", "dire_wolf", "ironhide", "rust_beetle", "hollow_matriarch", "veilstalker", "storm_phoenix", "leafblade_scout", "aurelius", "plague_rat", "pale_rider", "gutsnout", "troglodyte_brute"],
    "A small hit, then it swaps out to a teammate you pick. The one coming in takes their hit.", { cooldown: 3 }),
  move("Stalactite", "ranged", "underkin", 25, 50, "epic", undefined,
    ["ironhide", "rust_beetle", "tunnel_wyrm", "crystalback", "crystal_golem", "thunderhead", "void_serpent", "storm_phoenix", "troglodyte_brute"],
    "A plain big hit: 2× a heavy hit.", { mult: 2 }),
  utility("Curse", "undead", 60, "legendary", { kind: "curse", power: 6, minRounds: 2, maxRounds: 3, spread: 0.6 },
    ["the_watcher", "dustwraith", "mr_shadows", "swamp_witch", "dreadpox", "hexed_puppet"],
    "A small magic hit each round for 2–3 rounds. Each swap-out, 60% it passes to a benched teammate. 3-round cooldown.", { cooldown: 3 }),

  // The user's Mythiclaw moves (2026-11-26): names, rarities, races and what they do the user's; the numbers
  // Claude's, simmed. Learners are Claude's draft for the user's tick chart.
  // Horn Rush swings with 60% of its agility for its attack: geared agility runs 1.6–1.8× melee attack on every
  // creature (tanks too), so the whole of it would hit about twice as hard as any melee move.
  move("Horn Rush", "melee", "beast", 20, 50, "rare", { kind: "agilstrike", share: HORN_RUSH_AGILITY },
    ["dire_wolf", "gutsnout", "crystal_golem", "crystalback", "flame_imp", "ironhide", "mole_hag", "rust_beetle", "tunnel_wyrm"],
    "Melee, but it swings with its agility, not its attack: the faster it is, the harder it hits."),
  move("Leg Sweep", "melee", undefined, 10, 30, "common", { kind: "slow", chance: 0.3, loss: 0.3, rounds: 3 },
    ["dire_wolf", "moss_wolf", "hollow_matriarch", "veilstalker", "rattlebones", "mr_shadows", "thicket_archer", "leafblade_scout", "sylvaran", "crystal_golem", "deep_angler", "tunnel_wyrm", "plague_rat", "gutsnout", "grub_keeper", "mole_hag", "cinder_husk", "troglodyte_brute", "gravewarden", "hexed_puppet", "bellow_toad", "cave_bat", "dreadpox", "flame_imp", "gloom_gnome", "shambler", "swamp_witch", "the_watcher", "void_serpent"],
    "30% chance the target loses 30% of its agility for 3 rounds."),
  move("Spirit Blade", "melee", "divine", 20, 60, "epic", { kind: "spiritblade", share: SPIRIT_BLADE.share, bossShare: SPIRIT_BLADE.boss, swings: 3 },
    ["veilstalker", "mr_shadows", "aurelius", "pale_rider", "gravewarden", "crystal_golem", "hexed_puppet", "leafblade_scout", "storm_phoenix", "sylvaran", "thunderhead"],
    "+6% of the target's max HP through armour (3% on a boss). Locked in for 3 rounds (paid once) unless it swaps out."),
];
