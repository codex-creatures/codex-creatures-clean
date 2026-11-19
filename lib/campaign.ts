// lib/campaign.ts
// The campaign (the user, 2026-11-16; docs/design/den.md §9): quests that
// aren't daily and lead through the game, on the quest board's Campaign tab.
// Five chapters, each leading up to a dungeon's boss (the Encampment, the
// Cyclops, the Hydra, the Abyss), then a long last one for what's left.
//
// Progress counts all along: most quests read the save as it is now (levels,
// gold, gear worn, bosses beaten), so an old save starts with most done. The
// rest count events from here on (fights won, cages opened…: `tally`). But
// rewards are claimed in order: a quest's reward waits until every one
// before it has been claimed.
//
// The order and the numbers follow a model of a normal player's progress
// (2026-11-16, docs/design/den.md): slow quests sit late in a chapter or in
// the next, so one never holds up a chapter's boss for long.
//
// Kept in its own field of the save (lib/save.ts: OWN_FIELDS), as both the
// Den and the Labyrinth write it.

import { readSave, writeSaveField } from "./save";
import type { CreatureOrItemDrop, Drop, Rarity } from "./types";
import { ITEM_KEYS } from "./items/ceilings";
import { weaponDrop, armorDrop, potionDrop, scrollDrop, codexDrop, randomBasicMove, randomUncommonMove, randomStrongMove, randomCodexMove } from "./drops";
import { rollItemStats } from "./items/rollItemStats";
import { rollArmorPiece } from "./items/rollArmorStats";
import { ARMOR_KEYS, ARMOR_SLOTS, wornArmor } from "./items/armor";
import { CHEST_ENCHANT, enchanted, enchantOf } from "./items/enchantments";
import { materialBundle, toolDrop } from "./items/materials";
import { BINDLE } from "./dungeon/run";
import { SKILL_KEYS, type KlutzState } from "./klutz";
import { calibrating, readFirstScans, CALIBRATION_SCANS } from "./firstScans";
import { gearPiece, rollRarity } from "./daily";
import { raceOfMove, raceVsAll } from "./combat/raceChart";
import type { RaceV2 } from "./creatures/racesV2";
import type { BattleEvent } from "./combat/battle";
import { VISITORS, type TavernQuest, type Visitor } from "./tavern";

type Rng = () => number;
const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const atLeast = (r: Rarity | undefined, lo: Rarity) => !!r && ORDER.indexOf(r) >= ORDER.indexOf(lo);

// ── What the save says ──────────────────────────────────────────────
// Everything a quest reads, worked out from the save (campaignCtx).
export type CampaignCtx = {
  tally: Record<string, number>; // events counted since the campaign came in (countCampaign)
  scans: number;          // barcodes scanned (new ones)
  bestiary: number;       // creatures in the Bestiary (seen, owned or carded)
  cards: number;          // creature cards held now
  creatureLevel: number;  // your highest creature's level
  klutzLevel: number;
  klutzSent: boolean;     // he's been out hunting at least once
  klutzSkills: number;    // how many of his skills have a level
  explorer: number;       // your explorer level
  gold: number;
  fullyEquipped: boolean; // a creature in a weapon and all three armour pieces
  setBonus: boolean;      // a creature in a whole armour set
  learned: boolean;       // a creature has learned a move from a codex
  weapon?: Rarity;        // the rarest weapon a creature has on
  worn?: Rarity;          // the rarest thing a creature has on
  enchantedWeapon: boolean;
  enchantedArmour: boolean;
  calibrated: boolean;    // the altar's calibration scans are done
  wins: { camp: number; cyclops: number; hydra: number; abyss: number };
  campRuns: number;       // Encampment runs started
  blasted: boolean;       // the rubble's blown open
  repaired: boolean;      // the tavern's repaired
  blueprints: number;     // schematics built
  bagUpgraded: boolean;   // your bag holds more than the bindle you start with
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function campaignCtx(save: Obj): CampaignCtx {
  const inventory = (Array.isArray(save.inventory) ? save.inventory : []) as CreatureOrItemDrop[];
  const caged = (Array.isArray(save.caged) ? save.caged : []) as CreatureOrItemDrop[];
  const byId = new Map(inventory.map((d) => [d.id, d]));
  const creatures = inventory.filter((d) => d.dropType === "creature");
  const equipment = obj(save.equipment) as Record<string, Record<string, string | undefined>>;
  // What each of your creatures has on (Klutz's gear is under his own id, not a creature's).
  const loadouts = creatures.map((c) => {
    const l = equipment[c.id] ?? {};
    const get = (k: string) => (l[k] ? byId.get(l[k]!) : undefined);
    return { weapon: get("weaponId"), armour: [get("helmetId"), get("chestId"), get("legsId")] };
  });
  const worn = loadouts.flatMap((l) => [l.weapon, ...l.armour]).filter((d): d is CreatureOrItemDrop => !!d);
  const best = (ds: CreatureOrItemDrop[]) => ds.reduce<Rarity | undefined>((r, d) => (!r || ORDER.indexOf(d.rarity) > ORDER.indexOf(r) ? d.rarity : r), undefined);
  const klutz = obj(save.klutz) as KlutzState;
  const tavern = obj(save.tavern) as TavernQuest;
  const meta = obj(obj(save.labyrinth).meta);
  const seen = new Set<string>([
    ...(Array.isArray(save.seen) ? (save.seen as string[]) : []),
    ...[...inventory, ...caged].flatMap((d) => ((d.dropType === "creature" || d.dropType === "card") && d.creatureId ? [d.creatureId] : [])),
  ]);
  const firstScans = readFirstScans(save.firstScans);
  return {
    tally: loadCampaign(save).tally ?? {},
    scans: Object.keys(obj(save.scanCounts)).length,
    bestiary: seen.size,
    cards: inventory.filter((d) => d.dropType === "card").length,
    creatureLevel: creatures.reduce((n, c) => Math.max(n, c.level ?? 1), 0),
    klutzLevel: Math.max(1, num(klutz.level)),
    klutzSent: num(klutz.level) > 1 || !!klutz.expedition,
    klutzSkills: SKILL_KEYS.filter((s) => (klutz.skills?.[s] ?? 0) > 0).length,
    explorer: Math.max(1, num(obj(save.player).level)),
    gold: num(save.gold),
    fullyEquipped: loadouts.some((l) => l.weapon && l.armour.every(Boolean)),
    setBonus: loadouts.some((l) => !!wornArmor(l.armour).set),
    learned: creatures.some((c) => (c.learned?.length ?? 0) > 0),
    weapon: best(loadouts.flatMap((l) => (l.weapon ? [l.weapon] : []))),
    worn: best(worn),
    enchantedWeapon: loadouts.some((l) => !!enchantOf(l.weapon)),
    enchantedArmour: loadouts.some((l) => l.armour.some((a) => !!enchantOf(a))),
    calibrated: !calibrating(firstScans),
    wins: { camp: num(meta.campClears), cyclops: num(meta.clears), hydra: num(meta.deepClears), abyss: num(meta.abyssClears) },
    campRuns: num(meta.campRuns),
    blasted: !!tavern.blasted,
    repaired: !!tavern.repaired,
    blueprints: (num(save.bookcase) >= 2 ? 1 : 0) + (num(save.cage) >= 2 ? 1 : 0) + (Array.isArray(save.storage) ? save.storage.length : 0) + (tavern.pit ? 1 : 0),
    bagUpgraded: num(meta.bagSize) > BINDLE,
  };
}

// ── The events counted ──────────────────────────────────────────────
// battle: a fight won in a dungeon; scan: a new barcode; klutz: Klutz sent
// out; card: a creature card got; buy: something bought from a merchant (in
// the Labyrinth or at the tavern); cage: a camp cage opened; goldchest: a
// golden chest opened with a Gold Key; effective: a fight won with only
// effective hits; spar: a level gained in the Sparring Pit; summon:<rarity>,
// kfind:<rarity> (gear Klutz brought home), clean:<dungeon> (its boss beaten
// without drinking a potion), visit:<visitor> (a visitor at the tavern).
export type CampaignEvent = "battle" | "scan" | "klutz" | "card" | "buy" | "cage" | "goldchest" | "effective" | "spar"
  | `summon:${Rarity}` | `kfind:${Rarity}` | `clean:${number}` | `visit:${Visitor}`;

// How many of an event; for Klutz's finds, a rarity counts for itself and everything below it.
const tallied = (c: CampaignCtx, ev: string) => c.tally[ev] ?? 0;
const ofRarity = (c: CampaignCtx, ev: "kfind", lo: Rarity) =>
  ORDER.slice(ORDER.indexOf(lo)).reduce((n, r) => n + tallied(c, `${ev}:${r}`), 0);

// ── The rewards ─────────────────────────────────────────────────────
// Crates (the user, 2026-11-16): opened as you claim them, their loot shown
// like a Code Cache's. Materials: bundles of a rarity band; gear: weapons and
// armour of a band (a chest's chance at an enchantment); supplies: potions,
// a Revival Elixir and a torch; codexes: codexes of a band.
export type CrateKind = "materials" | "gear" | "supplies" | "codex";
export type CampaignReward =
  | { gold: number }
  | { scrolls: number }
  | { crate: CrateKind; lo: Rarity; hi: Rarity; n: number }
  | { goldKey: true }
  | { enchanted: "weapon" | "armour"; rarity: Rarity }
  | { bookcasePlans: true };

// (The codex reward is a bookcase, not a crate: the user, 2026-11-16. The gear one's a barrel, to be drawn.)
export const CRATE_NAMES: Record<CrateKind, string> = { materials: "Materials Crate", gear: "Gear Barrel", supplies: "Supplies Crate", codex: "Codex Bookcase" };
const RARITY_WORD: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const band = (lo: Rarity, hi: Rarity) => (lo === hi ? RARITY_WORD[lo] : `${RARITY_WORD[lo]}–${RARITY_WORD[hi]}`);
export function rewardText(r: CampaignReward): string {
  if ("gold" in r) return `${r.gold.toLocaleString()} gold`;
  if ("scrolls" in r) return r.scrolls === 1 ? "A Tattered XP Scroll" : `${r.scrolls} Tattered XP Scrolls`;
  if ("crate" in r) return r.crate === "supplies" ? CRATE_NAMES.supplies : `${CRATE_NAMES[r.crate]} (${band(r.lo, r.hi)})`;
  if ("goldKey" in r) return "A Gold Key";
  if ("enchanted" in r) return `An enchanted ${RARITY_WORD[r.rarity]} ${r.enchanted}`;
  return "The Crooked Bookcase Schematic";
}

// The bookcase's plans when you have them already (or the bookcase is built): gold instead.
export const PLANS_TAKEN_GOLD = 500;
// What a crate reward is shown as in 3D before its loot (components/RewardReveal.tsx): the Materials and
// Supplies Crates, the Gear Barrel, the Codex Bookcase. Anything else goes straight to its loot.
export type RewardModel = "crate-materials" | "crate-supplies" | "barrel" | "bookcase";
const MODELS: Record<CrateKind, RewardModel> = { materials: "crate-materials", supplies: "crate-supplies", gear: "barrel", codex: "bookcase" };
export const rewardModel = (r: CampaignReward): RewardModel | undefined => ("crate" in r ? MODELS[r.crate] : undefined);

export const SUPPLIES = 5; // a supplies crate: 2 Lesser Potions, a Healing Potion, a Revival Elixir and a torch
function codexOf(r: Rarity): Drop {
  return codexDrop(r === "common" ? randomBasicMove() : r === "uncommon" ? randomUncommonMove() : r === "rare" ? randomStrongMove() : randomCodexMove());
}
// A weapon or armour piece of exactly this rarity, always enchanted.
function enchantedPiece(kind: "weapon" | "armour", rarity: Rarity, rng: Rng): Drop {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  if (kind === "weapon") { const key = pick(ITEM_KEYS); return enchanted(weaponDrop(key, rarity, "", rollItemStats(key, rarity, rng).stats), 1, rng); }
  const key = pick(ARMOR_KEYS), slot = pick(ARMOR_SLOTS);
  return enchanted(armorDrop(key, rarity, "", rollArmorPiece(key, rarity, rng), slot), 1, rng);
}
// The things a reward gives. Gold and the bookcase's plans give none (they're
// paid directly).
export function rollCampaignReward(r: CampaignReward, rng: Rng = Math.random): Drop[] {
  if ("scrolls" in r) return Array.from({ length: r.scrolls }, () => scrollDrop());
  if ("goldKey" in r) return [toolDrop("gold_key")];
  if ("enchanted" in r) return [enchantedPiece(r.enchanted, r.rarity, rng)];
  if (!("crate" in r)) return [];
  if (r.crate === "supplies") return [potionDrop(), potionDrop(), potionDrop("", "potion"), toolDrop("revival"), toolDrop("flare")];
  return Array.from({ length: r.n }, () => {
    const rarity = rollRarity(rng, r.lo, r.hi);
    if (r.crate === "materials") return materialBundle(rarity, rng);
    if (r.crate === "codex") return codexOf(rarity);
    return enchanted(gearPiece(rarity, rarity, rng), CHEST_ENCHANT, rng);
  });
}

// What stops a reward being claimed (null: nothing). A reward always comes home, even into a full
// weapons, armour or consumables box, as a run's haul does (the user, 2026-11-17: a full consumables box
// held back an XP scroll, and with it, claimed in order, every reward after it). Only a codex needs room:
// it goes on the bookcase. A reward with no codex is never held back, however full the bookcase is
// (shelfFree goes below 0 once codexes from the Labyrinth come home over its size: that had been holding
// back every reward, the user, 2026-11-17).
export function rewardBlocked(drops: Drop[], shelfFree: number): string | null {
  const codexes = drops.filter((d) => d.dropType === "item" && d.codexMove).length;
  return codexes > 0 && codexes > shelfFree ? `Your bookcase is full: make room for ${codexes === 1 ? "the codex" : `${codexes} codexes`} first.` : null;
}

// ── The quests ──────────────────────────────────────────────────────
// task: what to do (one line); go: the screen it's done on (a ➜ button);
// progress: how far along, out of goal.
export type CampaignQuest = { id: string; task: string; go?: string; goal: number; progress: (c: CampaignCtx) => number; reward: CampaignReward };
export type Chapter = { name: string; quests: CampaignQuest[] };

const flag = (b: boolean) => (b ? 1 : 0);
const gold = (n: number): CampaignReward => ({ gold: n });
const scrolls = (n: number): CampaignReward => ({ scrolls: n });
const crate = (kind: CrateKind, lo: Rarity, hi: Rarity, n = 3): CampaignReward => ({ crate: kind, lo, hi, n });
const supplies: CampaignReward = { crate: "supplies", lo: "common", hi: "rare", n: SUPPLIES };

// Quest makers, one per kind of quest (the id carries the number, so each is unique).
const q = {
  scan: (n: number, reward: CampaignReward): CampaignQuest => ({ id: `scan${n}`, task: `Scan ${n} barcodes`, go: "/scan", goal: n, progress: (c) => Math.max(c.scans, tallied(c, "scan")), reward }),
  bestiary: (n: number, reward: CampaignReward): CampaignQuest => ({ id: `bestiary${n}`, task: `Identify ${n} creatures in the Bestiary`, go: "/guide", goal: n, progress: (c) => c.bestiary, reward }),
  fights: (n: number, reward: CampaignReward): CampaignQuest => ({ id: `fights${n}`, task: `Win ${n} fights in the Labyrinth`, go: "/dungeon", goal: n, progress: (c) => tallied(c, "battle"), reward }),
  cards: (n: number, reward: CampaignReward): CampaignQuest => ({ id: `cards${n}`, task: `Collect ${n} creature cards`, go: "/pit", goal: n, progress: (c) => Math.max(c.cards, tallied(c, "card")), reward }),
  level: (n: number, reward: CampaignReward): CampaignQuest => ({ id: `level${n}`, task: `Get a creature to level ${n}`, go: "/pit", goal: n, progress: (c) => c.creatureLevel, reward }),
  klutz: (n: number, reward: CampaignReward): CampaignQuest => ({ id: `klutz${n}`, task: `Get Klutz to level ${n}`, go: "/klutz", goal: n, progress: (c) => c.klutzLevel, reward }),
  explorer: (n: number, reward: CampaignReward): CampaignQuest => ({ id: `explorer${n}`, task: `Reach explorer level ${n}`, go: "/scan", goal: n, progress: (c) => c.explorer, reward }),
  gold: (n: number, reward: CampaignReward): CampaignQuest => ({ id: `gold${n}`, task: `Have ${n.toLocaleString()} gold saved up`, goal: n, progress: (c) => c.gold, reward }),
  // (Summons are exact, the user, 2026-11-16: a Common, then an Uncommon, and so on.)
  summon: (r: Rarity, reward: CampaignReward): CampaignQuest => ({ id: `summon-${r}`, task: `Summon ${r === "uncommon" || r === "epic" ? "an" : "a"} ${RARITY_WORD[r]} creature from cards`, go: "/pit", goal: 1, progress: (c) => tallied(c, `summon:${r}`), reward }),
  kfind: (r: Rarity, reward: CampaignReward): CampaignQuest => ({ id: `kfind-${r}`, task: `Klutz brings home ${r === "epic" ? "an" : "a"} ${RARITY_WORD[r]} weapon or armour${r === "legendary" ? "" : " (or rarer)"}`, go: "/klutz", goal: 1, progress: (c) => ofRarity(c, "kfind", r), reward }),
  worn: (r: Rarity, reward: CampaignReward): CampaignQuest => ({ id: `wear-${r}`, task: `Put ${r === "epic" ? "an" : "a"} ${RARITY_WORD[r]} item on a creature (or rarer)`, go: "/pit", goal: 1, progress: (c) => flag(atLeast(c.worn, r)), reward }),
  spar: (n: number, reward: CampaignReward): CampaignQuest => ({ id: `spar${n}`, task: `Level up creatures ${n} times in the Sparring Pit`, goal: n, progress: (c) => tallied(c, "spar"), reward }),
  clean: (d: number, name: string, reward: CampaignReward): CampaignQuest => ({ id: `clean${d}`, task: `Beat ${name} without drinking a potion`, go: "/dungeon", goal: 1, progress: (c) => tallied(c, `clean:${d}`), reward }),
  once: (id: string, task: string, go: string | undefined, progress: (c: CampaignCtx) => boolean, reward: CampaignReward): CampaignQuest => ({ id, task, go, goal: 1, progress: (c) => flag(progress(c)), reward }),
};

export const CHAPTERS: Chapter[] = [
  { name: "The Encampment", quests: [
    // (First since 2026-11-20, the user: once Klutz's box is home, off to the Encampment. CAMPAIGN_V.)
    q.once("camp-run", "Do an Encampment run", "/dungeon", (c) => c.campRuns > 0, gold(50)),
    q.scan(3, gold(50)),
    q.bestiary(3, gold(50)),
    q.once("klutz-out", "Send Klutz out hunting", "/klutz", (c) => c.klutzSent || tallied(c, "klutz") > 0, scrolls(1)),
    q.once("kit", "Put a weapon and all three armour pieces on a creature", "/pit", (c) => c.fullyEquipped, gold(100)),
    q.fights(5, gold(100)),
    q.cards(3, gold(100)),
    q.level(5, scrolls(1)),
    q.once("camp", "Beat the Encampment", "/dungeon", (c) => c.wins.camp > 0, crate("gear", "uncommon", "rare")),
  ] },
  { name: "The Cyclops", quests: [
    q.once("calibrate", `Calibrate the scanner (your first ${CALIBRATION_SCANS} scans)`, "/scan", (c) => c.calibrated, gold(150)),
    q.explorer(5, scrolls(1)),
    q.once("codex", "Teach a creature a move from a codex", "/bookcase", (c) => c.learned, gold(150)),
    q.once("buy", "Buy something from a merchant", "/dungeon", (c) => tallied(c, "buy") > 0, gold(150)),
    q.summon("common", supplies),
    { id: "cages3", task: "Open 3 camp cages", go: "/dungeon", goal: 3, progress: (c) => tallied(c, "cage"), reward: gold(200) },
    q.once("rare-weapon", "Put a Rare weapon on a creature (or rarer)", "/pit", (c) => atLeast(c.weapon, "rare"), gold(250)),
    q.kfind("rare", scrolls(1)),
    q.fights(25, scrolls(1)),
    q.once("set", "Get an armour set bonus on a creature", "/pit", (c) => c.setBonus, gold(250)),
    q.gold(1000, crate("materials", "common", "uncommon")),
    q.clean(0, "the Encampment", gold(300)),
    q.once("rubble", "Blow open the rubble in the Den", "/", (c) => c.blasted, { bookcasePlans: true }),
    q.once("cyclops", "Beat the Cyclops", "/dungeon", (c) => c.wins.cyclops > 0, { enchanted: "weapon", rarity: "epic" }),
  ] },
  { name: "The Hydra", quests: [
    q.klutz(5, scrolls(1)),
    q.level(10, crate("materials", "uncommon", "rare")),
    q.once("enchanted-weapon", "Put an enchanted weapon on a creature", "/pit", (c) => c.enchantedWeapon, gold(300)),
    q.once("skills", "Give every one of Klutz's skills a level", "/klutz", (c) => c.klutzSkills >= SKILL_KEYS.length, gold(300)),
    q.once("tavern", "Fix up the tavern", "/tavern", (c) => c.repaired, { goldKey: true }),
    q.once("effective", "Win a fight using only effective moves", "/dungeon", (c) => tallied(c, "effective") > 0, gold(400)),
    q.summon("uncommon", supplies),
    q.scan(50, gold(500)),
    q.bestiary(15, scrolls(1)),
    q.once("bag", "Get a bigger bag", "/bag", (c) => c.bagUpgraded, gold(500)),
    q.spar(3, scrolls(2)),
    q.kfind("epic", crate("materials", "rare", "epic")),
    q.worn("epic", gold(500)),
    q.fights(100, crate("codex", "uncommon", "rare", 2)),
    q.once("gold-key", "Open a golden chest with a Gold Key", "/dungeon", (c) => tallied(c, "goldchest") > 0, crate("gear", "rare", "epic")),
    q.gold(5000, scrolls(2)),
    q.clean(1, "the Cyclops", gold(1000)),
    q.level(15, crate("gear", "rare", "epic")),
    q.once("hydra", "Beat the Hydra", "/dungeon", (c) => c.wins.hydra > 0, { enchanted: "armour", rarity: "epic" }),
  ] },
  { name: "The Abyss", quests: [
    q.once("enchanted-armour", "Put an enchanted armour piece on a creature", "/pit", (c) => c.enchantedArmour, gold(1000)),
    q.klutz(10, crate("materials", "rare", "epic")),
    { id: "visitors", task: "Have every visitor call at the tavern", go: "/tavern", goal: VISITORS.length, progress: (c) => VISITORS.filter((v) => tallied(c, `visit:${v}`) > 0).length, reward: scrolls(2) },
    q.summon("rare", supplies),
    { id: "blueprints3", task: "Build 3 schematics", go: "/chest", goal: 3, progress: (c) => c.blueprints, reward: crate("materials", "rare", "epic") },
    q.explorer(20, gold(2000)),
    q.spar(10, scrolls(3)),
    q.level(20, crate("gear", "epic", "epic")),
    q.gold(15000, scrolls(3)),
    q.fights(250, crate("codex", "rare", "epic", 2)),
    q.clean(2, "the Hydra", crate("gear", "epic", "epic")),
    q.once("abyss", "Beat the Abyss", "/dungeon", (c) => c.wins.abyss > 0, { enchanted: "weapon", rarity: "legendary" }),
  ] },
  { name: "Legend", quests: [
    q.level(25, crate("materials", "epic", "legendary")),
    q.klutz(15, scrolls(3)),
    q.summon("epic", crate("codex", "epic", "epic", 2)),
    q.kfind("legendary", crate("materials", "epic", "legendary")),
    q.worn("legendary", gold(5000)),
    q.scan(250, gold(5000)),
    q.bestiary(35, crate("gear", "epic", "legendary")),
    q.explorer(30, crate("gear", "epic", "legendary")),
    q.gold(50000, scrolls(5)),
    q.clean(3, "the Abyss", crate("gear", "epic", "legendary")),
    q.level(30, { enchanted: "armour", rarity: "legendary" }),
    q.klutz(20, scrolls(5)),
    q.summon("legendary", crate("gear", "legendary", "legendary")),
    q.klutz(25, crate("materials", "legendary", "legendary")),
    q.klutz(30, { enchanted: "weapon", rarity: "legendary" }),
  ] },
];
// Every quest in order, each with its chapter.
export const CAMPAIGN = CHAPTERS.flatMap((ch, chapter) => ch.quests.map((quest) => ({ ...quest, chapter })));

// ── Where you're at ─────────────────────────────────────────────────
// Saved: how many rewards you've claimed (in order), and the events counted.
// drank: the run (its id) a potion was last drunk on. (Before 2026-11-17, meta.runs: but only the
// Labyrinth counts those, so a potion drunk once marked every Encampment, Deep and Abyss run after it.)
// v: the quest list it counts claims in (missing: before CAMPAIGN_V). looked: the campaign's been opened (missing: never).
export type CampaignState = { claimed?: number; tally?: Record<string, number>; drank?: string | number; v?: number; looked?: boolean };
// 2 (2026-11-20): "Do an Encampment run" came in first. A save from before that had claimed some counts it
// as claimed too (they're past it: its 50 gold isn't owed), so every claim stays on the quest it was.
export const CAMPAIGN_V = 2;
export function upToDate(s: CampaignState): CampaignState {
  if ((s.v ?? 1) >= CAMPAIGN_V) return s;
  const claimed = Math.floor(s.claimed ?? 0);
  return { ...s, v: CAMPAIGN_V, ...(claimed > 0 ? { claimed: claimed + 1 } : {}) };
}

export const questDone = (quest: CampaignQuest, c: CampaignCtx) => quest.progress(c) >= quest.goal;
// A ❗ on the Den's quest board till the campaign's first been looked at (the user, 2026-11-20: "encourage them to check it
// out and then go to the Encampment"). Anyone who's claimed a reward has found it already.
export const campaignUnseen = (s: CampaignState) => !s.looked && claimedCount(s) === 0;
export const lookedAtCampaign = (s: CampaignState): CampaignState => (s.looked ? s : { ...s, looked: true });
export const claimedCount = (s: CampaignState) => Math.max(0, Math.min(CAMPAIGN.length, Math.floor(s.claimed ?? 0)));
// The next quest to claim (undefined: all claimed), and whether it's ready.
export const nextQuest = (s: CampaignState) => CAMPAIGN[claimedCount(s)];
export const canClaimNext = (s: CampaignState, c: CampaignCtx) => { const n = nextQuest(s); return !!n && questDone(n, c); };
// The chapter you're on: the next quest's (or the last, when everything's claimed).
export const currentChapter = (s: CampaignState) => nextQuest(s)?.chapter ?? CHAPTERS.length - 1;
// Claim the next reward (only that one, and only when its quest's done).
export const claimNext = (s: CampaignState, c: CampaignCtx): CampaignState => (canClaimNext(s, c) ? { ...s, claimed: claimedCount(s) + 1 } : s);

// Something happened that counts (amount: 1, or how many).
export function noteCampaign(s: CampaignState, event: CampaignEvent, amount = 1): CampaignState {
  if (amount <= 0) return s;
  return { ...s, tally: { ...s.tally, [event]: (s.tally?.[event] ?? 0) + amount } };
}

// A won fight where every hit your side made was a move effective on what it
// hit (moves with no race aren't). foeRaces: the other side's races, by place
// in its team. Swaps and moves that don't hit don't count either way, but
// there has to be at least one hit.
export function onlyEffective(log: BattleEvent[], foeRaces: (readonly RaceV2[] | undefined)[]): boolean {
  const hits = log.filter((e): e is Extract<BattleEvent, { type: "attack" }> => e.type === "attack" && e.side === "A");
  return hits.length > 0 && hits.every((e) => {
    const r = raceOfMove(e.skill), races = foeRaces[e.targetIndex ?? 0] ?? [];
    return !!r && races.length > 0 && raceVsAll(r, [...races]) > 1;
  });
}

// ── Saved progress ──────────────────────────────────────────────────
export const CAMPAIGN_FIELD = "campaign";
export function loadCampaign(save: Obj = readSave()): CampaignState {
  const c = save[CAMPAIGN_FIELD];
  return upToDate(c && typeof c === "object" ? (c as CampaignState) : {});
}
export const readCampaignCtx = () => campaignCtx(readSave());
// Change it (read, change, write: whoever else wrote it meanwhile is kept).
export function updateCampaign(fn: (s: CampaignState) => CampaignState): CampaignState {
  const s = loadCampaign(), next = fn(s);
  if (next !== s) writeSaveField(CAMPAIGN_FIELD, next);
  return next;
}
// Count something towards the campaign.
export const countCampaign = (event: CampaignEvent, amount = 1) => updateCampaign((s) => noteCampaign(s, event, amount));
// A potion drunk on this run (meta.runs): its boss won't count as beaten without one.
export const noteDrank = (run: string) => updateCampaign((s) => (s.drank === run ? s : { ...s, drank: run }));
export const drankOn = (run: string) => loadCampaign().drank === run;
// "Reset Player": they start over.
export const clearCampaign = () => writeSaveField(CAMPAIGN_FIELD, undefined);
