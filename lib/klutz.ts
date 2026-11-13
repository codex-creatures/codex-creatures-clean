// lib/klutz.ts
// Klutz, your helper. He isn't one of your creatures: he wanders the Den,
// and you can send him into the Labyrinth to hunt.
//
// Expeditions (the user, 2026-11-14: "Klutz v2"; docs/design/klutz.md):
// - Where: one of the dungeons (KlutzDest), opened by beating its boss
//   yourself (the Encampment from the start). Each costs half your own entry
//   fee (the Encampment is free), and decides the best rarity he can meet
//   there, how much tougher its creatures are, and how many of them strike
//   first (chip damage, so a glass-cannon Klutz doesn't walk through it).
// - Every FIND_EVERY_MS he finds something (FIND_MIX): a wild creature he
//   fights, a codex, a material or consumable, or a weapon or armour piece.
//   Rarities roll at the usual split, capped by the dungeon, by what his level
//   has opened (SCAN_UNLOCK) and by your own explorer level.
// - A beaten creature is caught at CATCH_CHANCE for its rarity (more with
//   Trapping) and goes to the cage (spares he lets go, as before); 20% of the
//   time it also drops a piece of its gear (GEAR_DROP_CHANCE).
// - His skills (a point a level) give a chance of an extra find each window:
//   Armourer (gear), Scavenger (materials, consumables), Scholar (codexes);
//   Trapping raises his catch chances. His traits: a bigger pack (Lv 5,
//   bought), Selective (Lv 10: leave things below a rarity), and a cage
//   filter (Lv 15: only cage creatures of a rarity or better).
// - He comes home when his pack is full, when he's down to HOME_AT of his HP
//   (he doesn't heal on the way), or when something beats him (no penalty:
//   he keeps everything). You can call him back any time. He can set off
//   again from SEND_AT of his HP (he heals HEAL_MS_PER_HP an HP in the pool),
//   but not while his chest at home is full.
// - He levels as a creature does, at XP_SHARE of what he used to get (so XP
//   scrolls matter); his level opens rarities and makes him stronger.
//
// Trips planned before v2 (no `v`) keep what they were planned with: their
// fights in `encounters`, a find on each (`find`), read as they always were.
// The whole trip is decided when he sets off (so it plays out even with the
// game closed); the screens reveal it as the time passes.

import { createBattle, resolveRound, sendInReplacement } from "./combat/battle";
import { chooseAiAction, chooseAiReplacement } from "./combat/thinkingAi";
import type { Fighter } from "./combat/engine";
import { makeEnemy, enemyFighter, droppedPieceStats, ENTRY_FEES, type DungeonId, type Enemy } from "./dungeon/run";
import { RARITY_WEIGHTS, type Rarity } from "./items/budgets";
import { CREATURE_BY_ID } from "./creatures/creatureData";
import { coreMove } from "./creatures/raceKitsV2";
import { makeCreatureDrop } from "./creatures/summon";
import { weaponDrop, armorDrop, randomArmorSlot, codexDrop, randomCodexOfRarity, potionDrop } from "./drops";
import { ARMOR_KEYS, ARMOR_SLOTS, type ArmorKey, type ArmorSlot } from "./items/armor";
import { ITEM_KEYS, type ItemKey } from "./items/ceilings";
import { rollItemStats } from "./items/rollItemStats";
import { rollArmorPiece } from "./items/rollArmorStats";
import { materialBundle } from "./items/materials";
import { isCreatureDrop, type Drop } from "./types";
import type { CreatureProficiency } from "./creatures/creatureData";
import { setStoneCost, type SoulStoneKey } from "./creatures/soulStones";
import { addXp, canFind, clampLevel, xpForEnemy } from "./creatures/levels";

// ── v2 trips ──
export const FIND_EVERY_MS = 20 * 60 * 1000;  // a find every 20 minutes he's out
export const FIND_MIX = { creature: 0.3, codex: 0.1, goods: 0.2, gear: 0.4 }; // what a find is
export const GOODS_MATERIAL = 0.5;            // …a material or consumable: a material bundle this often, else a potion
export const HEALING_POTION = 0.3;            // …a potion: a Healing Potion this often, else a Lesser one
export const CATCH_CHANCE: Record<Rarity, number> = { common: 1, uncommon: 0.9, rare: 0.7, epic: 0.4, legendary: 0.15 };
export const GEAR_DROP_CHANCE = 0.2;          // a beaten creature drops a piece of its gear
export const HOME_AT = 0.1;                   // down to this share of his HP, he comes home
export const SEND_AT = 0.4;                   // he can set off again from this share of his HP
export const XP_SHARE = 0.5;                  // his XP, as a share of the old rules' (the user: "so you use more books")
export const MAX_WINDOWS = 100;               // a safety stop: about 33 hours out
export const PACK_START = 8;                  // his pack: slots for what he finds (creatures go to the cage)
export const PACK_MAX = 20;
export const PACK_TRAIT = { level: 5, cost: 1000, slots: 4 }; // the Bigger Pack trait
export const PACK_UPGRADE_PRICES = [500, 750, 1000, 1500, 2000, 2500, 3000, 4000]; // a merchant's pack upgrade (+1), dearer each time
export const CHEST_START = 30;                // his chest at home
export const CHEST_STEP = 10;                 // …each upgrade
export const CHEST_PRICES = [500, 1000, 2000, 3000, 5000];
export const SKILL_MAX = 10;
export const SKILL_STEP = 0.03;               // Armourer, Scavenger, Scholar: an extra find's chance a level, each window
export const TRAP_STEP = 0.02;                // Trapping: catch chance a level
export const SELECTIVE_LEVEL = 10;
export const CAGE_FILTER_LEVEL = 15;

export type KlutzDest = DungeonId; // 0 the Encampment, 1 the Cyclops, 2 the Hydra, 3 the Abyss
export const KLUTZ_DESTS: Record<KlutzDest, { name: string; best: Rarity; levelsUp: number; firstStrike: number; lift: number }> = {
  0: { name: "The Encampment", best: "rare", levelsUp: 0, firstStrike: 0.1, lift: 0 },
  1: { name: "The Cyclops", best: "epic", levelsUp: 1, firstStrike: 0.2, lift: 0 },
  2: { name: "The Hydra", best: "legendary", levelsUp: 2, firstStrike: 0.3, lift: 0 },
  3: { name: "The Abyss", best: "legendary", levelsUp: 3, firstStrike: 0.4, lift: 0.3 }, // lift: a roll goes up a rarity this often
};
export const destCost = (d: KlutzDest) => (d === 0 ? 0 : Math.round(ENTRY_FEES[d] / 2));
// Which he can go to: the Encampment, and each dungeon whose boss you've beaten.
export type BossClears = { cyclops: number; hydra: number; abyss: number };
export const destOpen = (d: KlutzDest, c: BossClears) => d === 0 || (d === 1 && c.cyclops > 0) || (d === 2 && c.hydra > 0) || (d === 3 && c.abyss > 0);

export type SkillKey = "trapping" | "armourer" | "scavenger" | "scholar";
export const SKILL_KEYS: SkillKey[] = ["trapping", "armourer", "scavenger", "scholar"];
export type KlutzTraits = { pack?: boolean; selective?: Rarity | null; cageFilter?: Rarity | null };

// Older constants (trips planned before v2 still read with them).
export const WALK_MIN_MS = 20 * 60 * 1000;
export const WALK_MAX_MS = 60 * 60 * 1000;
export const TOUGHER_AFTER_MS = 6 * 60 * 60 * 1000;
export const TOUGHER_LEVELS_PER_HOUR = 1;
export const MAX_ENCOUNTERS = 60;
export const HEAL_MS_PER_HP = 10_000;  // in the pool: 1 HP every 10 seconds
export const HUNT_BELOW = 2;           // what he meets is his level, up to this many under…
export const HUNT_ABOVE = 1;           // …or this many over
export const CATCH_MAX_LEVEL = 5;      // the highest level a catch comes home at (it fought at its own)
export const CAPTURE_XP = 50;          // on top of the KO's XP, for bringing a creature home (× XP_SHARE)
export const FIND_XP = 20;             // for each thing he brings home (× XP_SHARE)

// His %s are points you spend: POINTS_PER_LEVEL for each level over 1 (so at
// level 15 he has 84, about what a Rare creature has there), +1% each.
// A re-spec hands them all back (his skill points too) for RESPEC_COST gold.
export const POINTS_PER_LEVEL = 6;
export const RESPEC_COST = 1000;

// What Klutz is wearing, slot by slot (older trips' finds).
export type WornPiece = { slot: "weapon" | ArmorSlot; rarity: Rarity };

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const ri = (r: Rarity) => RARITIES.indexOf(r);
type Rng = () => number;

export type KlutzEncounter = {
  at: number;            // when it happens (ms timestamp)
  creatureId: string;
  rarity: Rarity;
  gearRarity: Rarity;
  won: boolean;
  caught?: boolean;      // (v2) won and caught: false = it got away (or the cage filter let it go)
  rounds: number;
  hpAfter: number;       // Klutz's HP after the fight
  xp?: number;           // XP he got for it (a win)
  loot: Drop[];          // won: the creature (if caught), then any gear it dropped
  find?: Drop;           // (before v2) a piece of gear he picked up on the walk there
};
// (v2) Something he found, and when; `skill`: an extra find one of his skills brought.
export type KlutzFind = { at: number; drop: Drop; skill?: Exclude<SkillKey, "trapping"> };

export type Expedition = {
  v?: 2;                 // planned by the v2 rules (missing: an older trip)
  dest?: KlutzDest;      // (v2) where he went…
  cost?: number;         // …what it cost
  startHp?: number;      // …his HP setting off
  finds?: KlutzFind[];   // …what he found
  left?: number;         // …things he left behind (Selective)
  home?: "pack" | "hurt" | "ko" | "limit"; // …why he came home (recalled: `recalled`)
  letGo?: boolean; // he caught something but the cage was full, so he let it go
  caged?: number;  // how many of his catches went in the cage (the first ones; the rest he let go)
  startedAt: number;
  endsAt: number;        // when the last fight is over (or you called him back) and he's home
  maxHp: number;
  encounters: KlutzEncounter[];
  find?: Drop;           // (older saves' trips: one find for the whole trip)
  recalled?: boolean;    // you called him back before anything beat him
  collected: boolean;    // its loot has been handed over
};

export type KlutzState = {
  level?: number;        // his level (missing = 1)
  xp?: number;           // …and XP towards the next
  hp?: number;           // HP when he got back (missing = full)
  hpAt?: number;         // when that was
  expedition?: Expedition;
  points?: Partial<CreatureProficiency>; // the % points you've spent on him (missing = none)
  learned?: string[];    // moves he's learned from codexes (missing = none)
  soulStone?: SoulStoneKey; // the soul stone you've given him (missing = none)
  skills?: Partial<Record<SkillKey, number>>; // (v2) his skill levels (missing = none)
  traits?: KlutzTraits;  // (v2) his traits (missing = none)
  packs?: number;        // (v2) pack upgrades sewn on (+1 slot each; missing = none)
  chestUps?: number;     // (v2) his chest's upgrades (missing = none)
  dest?: KlutzDest;      // (v2) where you last sent him (the picker remembers it)
};

// ── His soul stone (the user, 2026-10-25; given, not chosen: 2026-10-31) ──
// You give him one of your loose soul stones from his Equip window, on the
// same terms as your creatures: free into an empty slot, SOUL_STONE_REPLACE_COST
// gold to replace his (the old one is destroyed), and the stone is used up.
// Not while he's out hunting. Only the ones that do something for him: he hunts
// alone (so never swaps out: no Revitalise) and has no utility move (no Trickster).
// A stone he got back when you could pick one for free, he keeps.
export const KLUTZ_STONES: SoulStoneKey[] = ["toxic_skin", "haunting_presence", "unstoppable_force", "perfectionist"];
export function giveKlutzStone(k: KlutzState, inventory: Drop[], stoneId: string, gold: number, now = Date.now()): { klutz: KlutzState; inventory: Drop[]; cost: number } | null {
  if (k.expedition && !k.expedition.collected && now < k.expedition.endsAt) return null; // he's out hunting
  const stone = inventory.find((d) => d.id === stoneId);
  const key = stone?.dropType === "item" ? stone.stone : undefined;
  if (!key || !KLUTZ_STONES.includes(key)) return null;
  const cost = setStoneCost(k.soulStone);
  if (gold < cost) return null;
  return { cost, klutz: { ...k, soulStone: key }, inventory: inventory.filter((d) => d.id !== stoneId) };
}

// ── His points ──
const PROF_KEYS: (keyof CreatureProficiency)[] = ["atk", "rng", "mag", "agil", "mdef", "rdef", "magdef"];
export const pointsEarned = (level?: number) => (clampLevel(level) - 1) * POINTS_PER_LEVEL;
export const pointsSpent = (p: Partial<CreatureProficiency> = {}) => PROF_KEYS.reduce((s, k) => s + (p[k] ?? 0), 0);
export const pointsFree = (k: KlutzState) => Math.max(0, pointsEarned(k.level) - pointsSpent(k.points));
// His %s: just the points spent (every stat 0 to start with).
export const klutzProficiency = (p: Partial<CreatureProficiency> = {}): CreatureProficiency =>
  Object.fromEntries(PROF_KEYS.map((k) => [k, p[k] ?? 0])) as CreatureProficiency;

// Spend points (whole ones, no more than he has free).
export function spendPoints(k: KlutzState, add: Partial<CreatureProficiency>): KlutzState {
  const n = pointsSpent(add);
  if (n <= 0 || n > pointsFree(k) || PROF_KEYS.some((s) => (add[s] ?? 0) < 0 || !Number.isInteger(add[s] ?? 0))) return k;
  const now = klutzProficiency(k.points);
  return { ...k, points: Object.fromEntries(PROF_KEYS.map((s) => [s, now[s] + (add[s] ?? 0)])) };
}

// A re-spec: every point back to spend again, % and skill points (the gold is paid by the caller).
export const respecKlutz = (k: KlutzState): KlutzState => ({ ...k, points: {}, skills: {} });

// ── His skills (v2): a point a level over 1, each skill up to SKILL_MAX ──
export const skillLevel = (k: KlutzState, s: SkillKey) => Math.min(SKILL_MAX, k.skills?.[s] ?? 0);
export const skillPointsEarned = (level?: number) => clampLevel(level) - 1;
export const skillPointsFree = (k: KlutzState) => Math.max(0, skillPointsEarned(k.level) - SKILL_KEYS.reduce((n, s) => n + skillLevel(k, s), 0));
export function spendSkill(k: KlutzState, s: SkillKey): KlutzState {
  if (skillPointsFree(k) <= 0 || skillLevel(k, s) >= SKILL_MAX) return k;
  return { ...k, skills: { ...k.skills, [s]: skillLevel(k, s) + 1 } };
}
// What a skill does at a level: Trapping adds to his catch chances; the rest are an extra find's chance each window.
export const skillChance = (s: SkillKey, level: number) => (s === "trapping" ? TRAP_STEP : SKILL_STEP) * Math.min(SKILL_MAX, level);
export const catchChance = (r: Rarity, trapping = 0) => Math.min(1, CATCH_CHANCE[r] + skillChance("trapping", trapping));

// ── His pack and chest (v2) ──
export const packSize = (k: KlutzState) => Math.min(PACK_MAX, PACK_START + (k.traits?.pack ? PACK_TRAIT.slots : 0) + (k.packs ?? 0));
export const packUpgradePrice = (k: KlutzState) => PACK_UPGRADE_PRICES[Math.min(PACK_UPGRADE_PRICES.length - 1, k.packs ?? 0)];
export const canBuyPackTrait = (k: KlutzState) => !k.traits?.pack && clampLevel(k.level) >= PACK_TRAIT.level;
export const chestSize = (k: KlutzState) => CHEST_START + CHEST_STEP * (k.chestUps ?? 0);
export const chestUpgradePrice = (k: KlutzState) => CHEST_PRICES[k.chestUps ?? 0]; // undefined: fully built
// His traits: Selective and the cage filter open with his level.
export const selectiveOpen = (k: KlutzState) => clampLevel(k.level) >= SELECTIVE_LEVEL;
export const cageFilterOpen = (k: KlutzState) => clampLevel(k.level) >= CAGE_FILTER_LEVEL;

export type KlutzStatus =
  | { kind: "away"; expedition: Expedition; seen: KlutzEncounter[]; hp: number } // in the Labyrinth (hp: after his last fight)
  | { kind: "healing"; hp: number; maxHp: number; fullAt: number }     // soaking in the pool
  | { kind: "home" };                                                  // wandering the Den

function rollRarity(rng: Rng): Rarity {
  const total = RARITIES.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);
  let x = rng() * total;
  for (const r of RARITIES) { x -= RARITY_WEIGHTS[r]; if (x <= 0) return r; }
  return "common";
}
const oneLower = (r: Rarity): Rarity => RARITIES[Math.max(0, ri(r) - 1)];

// The rarest thing he can meet at his level (like scanning: SCAN_UNLOCK).
export function huntRarity(rolled: Rarity, level = 1): Rarity {
  let r = rolled;
  while (!canFind(clampLevel(level), r)) r = oneLower(r);
  return r;
}
// (v2) A roll capped by where he is, his level and your explorer level.
export function capRarity(rolled: Rarity, dest: KlutzDest, level: number, explorer: number): Rarity {
  let r = ri(rolled) > ri(KLUTZ_DESTS[dest].best) ? KLUTZ_DESTS[dest].best : rolled;
  while (ri(r) > 0 && (!canFind(clampLevel(level), r) || !canFind(clampLevel(explorer), r))) r = oneLower(r);
  return r;
}
// The best rarity he can bring back from there now (for the picker).
export const bestRarity = (dest: KlutzDest, level: number, explorer: number) => capRarity("legendary", dest, level, explorer);

// A caught creature (it comes home at its level, but no higher than CATCH_MAX_LEVEL).
function creatureFrom(e: Enemy): Drop {
  const t = CREATURE_BY_ID[e.creatureId];
  return { ...makeCreatureDrop(t, "creature", "", { proficiency: e.proficiency, moves: e.moves, soulStone: e.soulStone ?? null }), level: Math.min(e.level ?? 1, CATCH_MAX_LEVEL) };
}
// A piece of a creature's gear: its weapon, or one armour piece.
function gearFrom(e: Enemy, rng: Rng): Drop {
  const pieces = e.gear.flatMap((p) => (p.slot === "weapon" ? [{ p }] : ARMOR_SLOTS.map((slot) => ({ p, slot }))));
  const { p, slot } = pieces[Math.floor(rng() * pieces.length)] as { p: Enemy["gear"][number]; slot?: ArmorSlot };
  return p.slot === "weapon" ? weaponDrop(p.key as ItemKey, p.rarity, "", p.stats) : armorDrop(p.key as ArmorKey, p.rarity, "", droppedPieceStats(p, slot ?? randomArmorSlot()), slot);
}
// A weapon or armour piece found lying about.
function gearPiece(rarity: Rarity, rng: Rng): Drop {
  if (rng() < 0.25) {
    const key = ITEM_KEYS[Math.floor(rng() * ITEM_KEYS.length)];
    return weaponDrop(key, rarity, "", rollItemStats(key, rarity, rng).stats);
  }
  const key = ARMOR_KEYS[Math.floor(rng() * ARMOR_KEYS.length)];
  const slot = ARMOR_SLOTS[Math.floor(rng() * ARMOR_SLOTS.length)];
  return armorDrop(key, rarity, "", rollArmorPiece(key, rarity, rng), slot);
}
// A material bundle or a potion.
function goods(rarity: Rarity, rng: Rng): Drop {
  return rng() < GOODS_MATERIAL ? materialBundle(rarity, rng) : potionDrop("", rng() < HEALING_POTION ? "potion" : "lesser");
}
// A codex: Common, Uncommon or Rare at the usual odds between them (as a scan's consumables), within the caps.
function codex(rng: Rng, cap: (r: Rarity) => Rarity): Drop {
  const w = RARITY_WEIGHTS.common + RARITY_WEIGHTS.uncommon + RARITY_WEIGHTS.rare;
  const x = rng() * w, r: Rarity = x < RARITY_WEIGHTS.common ? "common" : x < RARITY_WEIGHTS.common + RARITY_WEIGHTS.uncommon ? "uncommon" : "rare";
  return codexDrop(randomCodexOfRarity(cap(r), rng));
}
const rarityOf = (d: Drop): Rarity => (d.dropType === "reward" ? "common" : d.rarity);

// One fight, Klutz (starting on hp) against a wild creature. Both sides play the simple AI.
function fight(klutz: Fighter, hp: number, foe: Fighter): { won: boolean; hpAfter: number; rounds: number } {
  const s = createBattle([klutz], [foe], { A: [hp] });
  while (!s.winner) {
    resolveRound(s, { A: chooseAiAction(s, "A", "easy"), B: chooseAiAction(s, "B", "easy") });
    for (const k of [...s.needsReplacement]) sendInReplacement(s, k, chooseAiReplacement(s, k, "easy"));
  }
  return { won: s.winner === "A", hpAfter: Math.max(0, s.sides.A.team[0].hp), rounds: s.round };
}
// A creature that fights dirty: its style's first-strike move, and its light hit while that's on cooldown.
const firstStriker = (f: Fighter): Fighter => ({ ...f, skills: [coreMove(f.cls, "first"), coreMove(f.cls, "light")] });

export type TripPlan = {
  dest: KlutzDest; explorer: number; level?: number; startHp?: number;
  skills?: KlutzState["skills"]; traits?: KlutzTraits; pack?: number;
};
// Plan a whole expedition the moment he sets off.
export function planExpedition(klutz: Fighter, now = Date.now(), rng: Rng = Math.random, plan: TripPlan = { dest: 0, explorer: 30 }): Expedition {
  const L = clampLevel(plan.level), where = KLUTZ_DESTS[plan.dest];
  const sk = (s: SkillKey) => Math.min(SKILL_MAX, plan.skills?.[s] ?? 0);
  const pack = plan.pack ?? PACK_START, leave = plan.traits?.selective ?? null, cageFrom = plan.traits?.cageFilter ?? null;
  const cap = (r: Rarity) => capRarity(r, plan.dest, L, plan.explorer);
  const roll = () => cap(where.lift && rng() < where.lift ? RARITIES[Math.min(4, ri(rollRarity(rng)) + 1)] : rollRarity(rng));
  const startHp = Math.min(klutz.maxHp, plan.startHp ?? klutz.maxHp);
  const encounters: KlutzEncounter[] = [], finds: KlutzFind[] = [];
  let hp = startHp, used = 0, left = 0, at = now, home: Expedition["home"] = "limit";
  // Into his pack, unless Selective leaves it; true when the pack's full.
  const take = (d: Drop, skill?: KlutzFind["skill"]) => {
    if (leave && ri(rarityOf(d)) < ri(leave)) { left++; return false; }
    finds.push({ at, drop: d, ...(skill ? { skill } : {}) });
    return ++used >= pack;
  };
  for (let w = 0; w < MAX_WINDOWS; w++) {
    at += FIND_EVERY_MS;
    let full = false;
    const x = rng() * (FIND_MIX.creature + FIND_MIX.codex + FIND_MIX.goods + FIND_MIX.gear);
    if (x < FIND_MIX.creature) {
      const rarity = roll(), gearRarity = oneLower(rarity);
      const lo = Math.max(1, L - HUNT_BELOW), hi = clampLevel(L + HUNT_ABOVE);
      const foeLevel = clampLevel(lo + Math.floor(rng() * (hi - lo + 1)) + where.levelsUp);
      const enemy = makeEnemy(rarity, gearRarity, [], rng, foeLevel);
      const foe = rng() < where.firstStrike ? firstStriker(enemyFighter(enemy)) : enemyFighter(enemy);
      const r = fight(klutz, hp, foe);
      hp = r.hpAfter;
      const caught = r.won && rng() < catchChance(rarity, sk("trapping")) && !(cageFrom && ri(rarity) < ri(cageFrom));
      const loot: Drop[] = caught ? [creatureFrom(enemy)] : [];
      let dropped: Drop | undefined;
      if (r.won && rng() < GEAR_DROP_CHANCE) dropped = gearFrom(enemy, rng);
      encounters.push({ at, creatureId: enemy.creatureId, rarity, gearRarity, won: r.won, ...(r.won ? { caught } : {}), rounds: r.rounds, hpAfter: r.hpAfter, loot,
        ...(r.won ? { xp: Math.round((xpForEnemy(foeLevel, rarity) + CAPTURE_XP) * XP_SHARE) } : {}) });
      if (!r.won) { home = "ko"; break; }
      if (dropped) full = take(dropped);
    } else if (x < FIND_MIX.creature + FIND_MIX.codex) full = take(codex(rng, cap));
    else if (x < FIND_MIX.creature + FIND_MIX.codex + FIND_MIX.goods) full = take(goods(roll(), rng));
    else full = take(gearPiece(roll(), rng));
    // His skills: a chance of an extra find, each window.
    if (!full && rng() < skillChance("armourer", sk("armourer"))) full = take(gearPiece(roll(), rng), "armourer");
    if (!full && rng() < skillChance("scavenger", sk("scavenger"))) full = take(goods(roll(), rng), "scavenger");
    if (!full && rng() < skillChance("scholar", sk("scholar"))) full = take(codex(rng, cap), "scholar");
    if (full) { home = "pack"; break; }
    if (hp <= HOME_AT * klutz.maxHp) { home = "hurt"; break; }
  }
  return { v: 2, dest: plan.dest, cost: destCost(plan.dest), startHp, finds, ...(left ? { left } : {}), home,
    startedAt: now, endsAt: at, maxHp: klutz.maxHp, encounters, collected: false };
}

// Call him back early: he comes home now with what he's found so far (what's still ahead never happens).
export function recallKlutz(k: KlutzState, now = Date.now()): KlutzState {
  const ex = k.expedition;
  if (!ex || ex.collected || now >= ex.endsAt) return k;
  return { ...k, expedition: { ...ex, endsAt: now, encounters: ex.encounters.filter((e) => e.at <= now), ...(ex.finds ? { finds: ex.finds.filter((f) => f.at <= now) } : {}), recalled: true } };
}

// His HP after what he's done by `upTo` (v2 trips start on startHp).
const hpBy = (ex: Expedition, upTo: number) => {
  const seen = ex.encounters.filter((e) => e.at <= upTo);
  return seen.length ? seen[seen.length - 1].hpAfter : ex.startHp ?? ex.maxHp;
};

// Where Klutz is right now.
export function klutzStatus(k: KlutzState, maxHp: number, now = Date.now()): KlutzStatus {
  const ex = k.expedition;
  if (ex && now < ex.endsAt) {
    const seen = ex.encounters.filter((e) => e.at <= now);
    return { kind: "away", expedition: ex, seen, hp: hpBy(ex, now) };
  }
  const hp = currentHp(k, maxHp, now);
  if (hp < maxHp) return { kind: "healing", hp, maxHp, fullAt: (k.hpAt ?? now) + (maxHp - (k.hp ?? maxHp)) * HEAL_MS_PER_HP };
  return { kind: "home" };
}

export function currentHp(k: KlutzState, maxHp: number, now = Date.now()): number {
  if (k.hp === undefined) return maxHp;
  const healed = k.hp + Math.floor((now - (k.hpAt ?? now)) / HEAL_MS_PER_HP);
  return Math.min(maxHp, healed);
}
// When he could set off again (SEND_AT of his HP), and whether he can now.
export const sendHp = (maxHp: number) => Math.ceil(SEND_AT * maxHp);
export const readyAt = (k: KlutzState, maxHp: number, now = Date.now()) =>
  currentHp(k, maxHp, now) >= sendHp(maxHp) ? now : (k.hpAt ?? now) + (sendHp(maxHp) - (k.hp ?? maxHp)) * HEAL_MS_PER_HP;
export type SendBlock = "away" | "hurt" | "chest" | "closed" | "gold";
// Why he can't go (or null): out already, below SEND_AT, his chest full, the dungeon not open, or you can't pay.
export function sendBlock(k: KlutzState, maxHp: number, chestCount: number, dest: KlutzDest, clears: BossClears, gold: number, now = Date.now()): SendBlock | null {
  if (klutzStatus(k, maxHp, now).kind === "away") return "away";
  if (!destOpen(dest, clears)) return "closed";
  if (currentHp(k, maxHp, now) < sendHp(maxHp)) return "hurt";
  if (chestCount >= chestSize(k)) return "chest";
  if (gold < destCost(dest)) return "gold";
  return null;
}

// Send him off (the caller checks sendBlock and takes the cost).
export function sendKlutz(k: KlutzState, klutz: Fighter, now = Date.now(), rng: Rng = Math.random, dest: KlutzDest = 0, explorer = 30): KlutzState {
  if (klutzStatus(k, klutz.maxHp, now).kind === "away") return k;
  const ex = planExpedition(klutz, now, rng, { dest, explorer, level: k.level, startHp: currentHp(k, klutz.maxHp, now), skills: k.skills, traits: k.traits, pack: packSize(k) });
  const rest = { ...k };
  delete rest.hp; delete rest.hpAt; // (his HP now runs through the trip)
  return { ...rest, dest, expedition: ex };
}

// XP for Klutz (a hunt, or a scroll). Returns the new state and his level before.
export function klutzGainXp(k: KlutzState, gained: number): { state: KlutzState; from: number; to: number } {
  const from = clampLevel(k.level);
  const p = addXp({ level: from, xp: k.xp ?? 0 }, gained);
  return { state: { ...k, level: p.level, xp: p.xp }, from, to: p.level };
}

// Every thing he carries home earns XP: older trips FIND_XP a piece of gear
// (a catch's or a find); v2 trips FIND_XP × XP_SHARE for everything he finds.
export const gearCount = (loot: Drop[]) => loot.filter((d) => !isCreatureDrop(d)).length;
const findXp = (ex: Expedition, loot: Drop[]) => (ex.v === 2 ? Math.round(FIND_XP * XP_SHARE) : FIND_XP) * gearCount(loot);

// After an expedition ends: his HP when he got back, his XP, and the loot
// to hand over (once). Returns the new state, the loot and any level-up.
export function collectKlutz(k: KlutzState, now = Date.now()): { state: KlutzState; loot: Drop[]; levelUp?: { from: number; to: number } } {
  const ex = k.expedition;
  if (!ex || ex.collected || now < ex.endsAt) return { state: k, loot: [] };
  const hp = hpBy(ex, ex.endsAt);
  const loot = [...ex.encounters.flatMap((e) => [...e.loot, ...(e.find ? [e.find] : [])]), ...(ex.finds ?? []).map((f) => f.drop), ...(ex.find ? [ex.find] : [])];
  const xp = ex.encounters.reduce((s, e) => s + (e.xp ?? 0), 0) + findXp(ex, loot);
  const { state, from, to } = klutzGainXp(k, xp);
  return {
    state: { ...state, hp: hp < ex.maxHp ? hp : undefined, hpAt: ex.endsAt, expedition: { ...ex, collected: true } },
    loot,
    ...(to > from ? { levelUp: { from, to } } : {}),
  };
}
