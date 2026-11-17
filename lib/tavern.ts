// lib/tavern.ts
// The tavern questline (docs/design.md §9), stage by stage. Built so far:
// 1. Klutz's quest. Once any of your creatures is Lv QUEST_CREATURE_LEVEL
//    and Klutz is Lv QUEST_KLUTZ_LEVEL (only won hunts give him XP, so his
//    level is the record of having hunted), he has news (a ❗), unless he's
//    out hunting: then it waits until he's home. Talking to him gives the
//    quest, once.
// 2. The storehouse. From then until you've got the dynamite, each run's
//    first large room is a Storehouse, marked on the scroll from the start,
//    with the dynamite among its crates (lib/dungeon/map.ts: rollMap). Taking
//    it is for good: it needs no bag slot and comes home even if the run goes
//    wrong (there's no second stick), and rooms go back to normal.
// 3. The rubble. A heap on the Den's right-hand wall; the dynamite blows it
//    open (once), and a passage leads to a second room: the tavern's.
// 4. The tavern stands there broken. The first time you see it Klutz has
//    something to say (once).
// 5. The repair: REPAIR_COST in materials, taken once, and it's restored.
// 6–7. (The Cyclops bounty, replaced by the campaign on 2026-11-16: its
//    "Beat the Cyclops" step, lib/campaign.ts.) The Cyclops Head goes up on
//    the tavern wall by itself once the tavern's repaired and the Cyclops is
//    beaten (headUp). The Crooked Bookcase Schematic is the campaign's reward
//    for blowing open the rubble (bookPlans).
// 8. Visitors. Once it's repaired, a travelling merchant, a wandering
//    librarian, the creature collector (lib/collector.ts) and the Enchantress
//    (lib/enchantress.ts) each call on their own chance every half hour of real
//    time (onTheClock), and stay that half hour, with what they'd have in the
//    Labyrinth to sell (materials dearer: TAVERN_MATERIAL_PRICES). Tavern
//    upgrades, paid in materials, make each more likely (UPGRADE_COSTS).
//    The merchant also buys from your Inventory, at the Labyrinth's prices
//    (merchantOffer): gear for what the crate pays, the rest at half his.
//
// Kept in its own field of the save (lib/save.ts: OWN_FIELDS), as both the
// Den (Klutz) and the Labyrinth (the dynamite) write it.

import { readSave, writeSaveField } from "./save";
import { MERCHANT_BUYBACK, MERCHANT_MATERIALS, loadDungeon, lootEntry, makeRoom, merchantOffer, onBindle, type Ware } from "./dungeon/run";
import type { CreatureOrItemDrop, Drop } from "./types";
import { addMaterials, canAfford, countMaterial, type MaterialKey, type Materials } from "./items/materials";
import { seeded } from "./creatures/soulStones";

export const QUEST_CREATURE_LEVEL = 6;
export const QUEST_KLUTZ_LEVEL = 2;

export type TavernQuest = {
  accepted?: boolean; // Klutz has given you the quest
  dynamite?: boolean; // you've got the dynamite (for good)
  blasted?: boolean;  // the rubble's blown open: the tavern's room is open
  seen?: boolean;     // you've seen the tavern (and heard Klutz on it)
  repaired?: boolean; // the tavern's been repaired
  bounty?: boolean;   // (before the campaign) you'd taken the Cyclops bounty
  mounted?: boolean;  // (before the campaign) you'd handed in the Cyclops Head: the bounty paid the bookcase schematic
  bookPlans?: boolean; // the Crooked Bookcase Schematic, found in the broken tavern (the campaign's reward: lib/campaign.ts)
  guests?: Partial<Record<Visitor, Guest>>; // who's calling at the tavern (on the clock: onTheClock)
  seed?: string;      // …the tavern's own seed for the clock's rolls (made the first time it's needed)
  rolled?: number;    // …the last window rolled (windowOf)
  upgrades?: Partial<Record<Visitor, number>>; // tavern upgrades: each visitor's level (missing: 0)
  // Before the clock (read once, then moved into guests: fromOldSave):
  visitor?: Visitor;  // the one wanderer calling at the tavern
  stay?: number;      // …how many more runs they'll stay
  wares?: Ware[];     // a merchant's cart
  offers?: string[];  // a librarian's codexes
  bought?: string[];  // …and what you've bought (ware keys, codex names)
  visited?: boolean;  // someone had called since the repair
  misses?: number;    // homecomings in a row with nobody calling
  pit?: boolean;      // the Training Pit's built over the Sparring Pit, in the tavern's room (lib/trainingPit.ts)
  plans?: boolean;    // …its plans, claimed from the Hydra quest on the quest board
  training?: { id: string; since: string }; // …the creature in it, training since then (ISO time)
  trainedXp?: number; // …all the XP it has ever trained into creatures (banked; missing: 0)
};
// The Enchantress (lib/enchantress.ts) rerolls enchantments.
export type Visitor = "merchant" | "librarian" | "collector" | "enchantress";
// Those who call. The collector's away for now (the user, 2026-11-18: the Soul
// Altar's ascension is the better use for spare creatures); his code stays, in
// lib/collector.ts, for if he comes back. (Each visitor rolls on their own seed,
// so leaving him out changes nobody else's calls.)
export const VISITORS: Visitor[] = ["merchant", "librarian", "enchantress"];
// One calling: until when (on the clock: ms), or how many more runs (one from before the clock), and their stock.
export type Guest = {
  until?: number;
  runs?: number;
  wares?: Ware[];     // a merchant's cart
  offers?: string[];  // a librarian's codexes
  bought?: string[];  // …and what you've bought (ware keys, codex names)
};

// Who's in the tavern: only a repaired tavern has visitors. (A ❗ shows at the
// Den's doorway while someone's there.)
//
// On the clock (the user, 2026-11-16, decision 47): real time is cut into
// VISITOR_WINDOW windows, and in each one every visitor rolls on their own
// chance (visitorChance), so several can be in at once. One who comes stays
// to the end of that window; one sent for stays SUMMON_STAY from then. The
// rolls come from the tavern's own seed and the window's number, so they're
// fixed: reloading doesn't roll again, and a window you weren't there for is
// simply gone (only the current one is ever rolled). No pity rule.
// A visitor from before the clock (one save field, `visitor`, staying a number
// of runs) stays their old stay out, counted down as you come home (comeHome).
export const VISITOR_WINDOW = 30 * 60 * 1000;
export const SUMMON_STAY = VISITOR_WINDOW;
export const windowOf = (now: number) => Math.floor(now / VISITOR_WINDOW);

// Each visitor's chance a window: VISITOR_BASE, plus UPGRADE_STEP for each
// level of the tavern upgrade for them (up to MAX_UPGRADE).
export const VISITOR_BASE = 0.05;
export const UPGRADE_STEP = 0.01;
export const MAX_UPGRADE = 10;
export const upgradeLevel = (t: TavernQuest, who: Visitor) => Math.max(0, Math.min(MAX_UPGRADE, Math.floor(t.upgrades?.[who] ?? 0)));
export const visitorChance = (t: TavernQuest, who: Visitor) => VISITOR_BASE + UPGRADE_STEP * upgradeLevel(t, who);

// Someone in: until (on the clock) or runs (from before it) says how long.
const isIn = (g: Guest | undefined, now: number): g is Guest => !!g && ((g.runs ?? 0) > 0 || (g.until ?? 0) > now);
export const guestOf = (t: TavernQuest, who: Visitor, now = Date.now()): Guest | undefined => {
  const g = t.repaired ? t.guests?.[who] : undefined;
  return isIn(g, now) ? g : undefined;
};
export const tavernVisitors = (t: TavernQuest, now = Date.now()): Visitor[] => VISITORS.filter((v) => guestOf(t, v, now));

// A save from before the clock: its one visitor becomes a guest staying the
// runs they had left. (The old fields go.)
function fromOldSave(t: TavernQuest): TavernQuest {
  if ([t.visitor, t.stay, t.visited, t.misses, t.wares, t.offers, t.bought].every((v) => v === undefined)) return t;
  const { visitor, stay, wares, offers, bought, ...rest } = t;
  delete rest.visited;
  delete rest.misses;
  if (!visitor) return rest;
  return { ...rest, guests: { ...rest.guests, [visitor]: { runs: Math.max(1, stay ?? 1), wares, offers, bought } } };
}

// The tavern now: old visitors brought over, guests whose stay is up gone, and
// the current window rolled if it hasn't been. newSeed: the tavern's seed, the
// first time it needs one. bindle: you're still on the bindle, so a merchant
// brings the rugged backpack.
export function onTheClock(t: TavernQuest, now: number, bindle = false, newSeed: () => string = () => crypto.randomUUID()): TavernQuest {
  if (!t.repaired) return t;
  const x = fromOldSave(t);
  const guests: Partial<Record<Visitor, Guest>> = Object.fromEntries(Object.entries(x.guests ?? {}).filter(([, g]) => isIn(g, now)));
  const w = windowOf(now);
  if (x.rolled === w) return sameGuests(x.guests, guests) ? x : { ...x, guests };
  const seed = x.seed ?? newSeed();
  const until = (w + 1) * VISITOR_WINDOW;
  for (const who of VISITORS) {
    if (seeded(`${seed}:${w}:${who}`)() >= visitorChance(x, who)) continue;
    const g = guests[who];
    if (g?.runs) continue; // (one from before the clock stays as they were)
    guests[who] = g ? { ...g, until: Math.max(g.until ?? 0, until) } : { ...stockOf(who, seeded(`${seed}:${w}:${who}:stock`), bindle), until };
  }
  return { ...x, seed, rolled: w, guests };
}
const sameGuests = (a: TavernQuest["guests"], b: TavernQuest["guests"]) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

// Home from a run: a visitor from before the clock stays one run less (and
// leaves at 0). Nobody new comes for a run: that's the clock's job now.
export function comeHome(t: TavernQuest): TavernQuest {
  if (!t.repaired) return t;
  const x = fromOldSave(t);
  if (!x.guests || !Object.values(x.guests).some((g) => g?.runs)) return x;
  const guests = Object.fromEntries(Object.entries(x.guests)
    .map(([who, g]) => [who, g?.runs ? { ...g, runs: g.runs - 1 } : g] as const)
    .filter(([, g]) => g && (g.runs === undefined || g.runs > 0)));
  return { ...x, guests };
}

// What a visitor brings: the stock they'd have in the Labyrinth (the collector
// and the Enchantress bring none: they work on what's yours).
function stockOf(who: Visitor, rng: () => number, bindle: boolean): Guest {
  const stock: { wares?: Ware[]; offers?: string[] } = who === "merchant" || who === "librarian" ? makeRoom(who, rng, Infinity, 1, bindle) : {};
  return { ...(stock.wares ? { wares: tavernWares(stock.wares) } : {}), ...(stock.offers ? { offers: stock.offers } : {}), bought: [] };
}

// At the tavern the merchant charges more for materials than in the Labyrinth
// (the user, 2026-11-02: at the old prices you'd just buy the lot every
// time). A stack's price, by
// material; he still buys yours back at half his Labyrinth price
// (materialOffer), so there's nothing to gain buying in one and selling in the other.
export const TAVERN_MATERIAL_PRICES: Partial<Record<MaterialKey, number>> = {
  planks: 150,        // ×5 (Labyrinth 40)
  nails: 100,         // ×5 (Labyrinth 30)
  metal_bars: 300,    // ×2 (Labyrinth 90)
  essence_stones: 300, // stone ×1 (Labyrinth 150; the user, 2026-11-03)
  essence: 1000,       // essence stones ×1 (Labyrinth 500)
};
export const tavernWares = (wares: Ware[] | undefined): Ware[] | undefined =>
  wares?.map((w) => ("material" in w ? { ...w, price: TAVERN_MATERIAL_PRICES[w.material] ?? w.price } : w));

// A daily quest's reward (lib/daily.ts): the merchant calls at the repaired
// tavern now, as if sent for.
export const merchantCalls = (t: TavernQuest, rng: () => number = Math.random, bindle = false, now = Date.now()): TavernQuest => summonVisitor(t, "merchant", rng, bindle, now);

// Sending for one (the user, 2026-11-03): at the repaired tavern you can pay
// SUMMON_PRICE to have any visitor call now, for SUMMON_STAY, in place of one
// of the same kind who's in (a new one, with new stock). The others stay. The
// gold is the game state's (hooks/useGameState.ts).
export const SUMMON_PRICE = 500;
export function summonVisitor(t: TavernQuest, who: Visitor, rng: () => number = Math.random, bindle = false, now = Date.now()): TavernQuest {
  if (!t.repaired) return t;
  const x = fromOldSave(t);
  return { ...x, guests: { ...x.guests, [who]: { ...stockOf(who, rng, bindle), until: now + SUMMON_STAY } } };
}

// For testing (the altar): open and repair the tavern, and have who call right now.
export function callVisitor(t: TavernQuest, who: Visitor, rng: () => number = Math.random, bindle = false, now = Date.now()): TavernQuest {
  return summonVisitor({ ...forceOpen(t), seen: true, repaired: true }, who, rng, bindle, now);
}

// Mark something bought from a visitor (one of each).
export function buyFromVisitor(t: TavernQuest, who: Visitor, key: string, now = Date.now()): TavernQuest {
  const g = guestOf(t, who, now);
  return g && !g.bought?.includes(key) ? { ...t, guests: { ...t.guests, [who]: { ...g, bought: [...(g.bought ?? []), key] } } } : t;
}

// ── Tavern upgrades (the user, 2026-11-16, decision 47) ───────────────
// A row per visitor at the tavern: each level is +UPGRADE_STEP to their
// chance, paid in materials, dearer each level (index 0: the 1st level).
// 🧪 Testing costs (the user's pick of the slowest pace): per visitor, 120
// planks, 45 nails, 85 metal bars, 26 stone and 2 essence stones in all;
// planks and nails first, then metal bars, with stone and essence at the top.
export const UPGRADE_COSTS: Materials[] = [
  { planks: 6, nails: 3 },
  { planks: 8, nails: 4 },
  { planks: 10, nails: 5, metal_bars: 2 },
  { planks: 12, nails: 5, metal_bars: 4 },
  { planks: 14, nails: 6, metal_bars: 6 },
  { planks: 16, nails: 6, metal_bars: 8, essence_stones: 1 },
  { planks: 16, nails: 6, metal_bars: 10, essence_stones: 2 },
  { planks: 14, nails: 5, metal_bars: 14, essence_stones: 4 },
  { planks: 12, nails: 3, metal_bars: 18, essence_stones: 7, essence: 1 },
  { planks: 12, nails: 2, metal_bars: 23, essence_stones: 12, essence: 1 },
];
// The next level's cost (null: at the top).
export const upgradeCost = (t: TavernQuest, who: Visitor): Materials | null => UPGRADE_COSTS[upgradeLevel(t, who)] ?? null;
export function canUpgrade(t: TavernQuest, who: Visitor, have: Materials): boolean {
  const cost = upgradeCost(t, who);
  return !!t.repaired && !!cost && canAfford(have, cost);
}
// One level more: the tavern and your materials after, or null if you can't.
export function upgradeVisitor(t: TavernQuest, who: Visitor, have: Materials): { tavern: TavernQuest; materials: Materials } | null {
  const cost = upgradeCost(t, who);
  if (!cost || !canUpgrade(t, who, have)) return null;
  return {
    tavern: { ...t, upgrades: { ...t.upgrades, [who]: upgradeLevel(t, who) + 1 } },
    materials: addMaterials(have, Object.fromEntries(Object.entries(cost).map(([k, n]) => [k, -n!]))),
  };
}

// What the merchant will buy from your Inventory, and for how much: not
// what's worn, packed or favourited (locked), nor what he won't take (Klutz's
// club, a schematic). Gear goes for gearValue (the crate's price).
export function tavernSellables(inventory: Drop[], locked: Set<string>, gearValue: (d: Drop) => number): { drop: CreatureOrItemDrop; price: number }[] {
  return inventory
    .filter((d): d is CreatureOrItemDrop => d.dropType === "item" && !locked.has(d.id))
    .map((drop) => ({ drop, price: merchantOffer(lootEntry(drop.id), drop, gearValue) }))
    .filter((x) => x.price > 0);
}
// One of a material from your stores (half his price for one).
export function materialOffer(key: MaterialKey): number {
  const m = MERCHANT_MATERIALS.find((x) => x.material === key);
  return m ? Math.floor((m.price / m.qty) * MERCHANT_BUYBACK) : 0;
}

// What the repair takes.
export const REPAIR_COST: Materials = { metal_bars: 5, planks: 20, nails: 5 };

// Is Klutz's quest waiting for you to talk to him? firstQuestDone: his box is
// back and he's helping (lib/quest.ts: klutzHelping).
export function tavernQuestDue(t: TavernQuest, firstQuestDone: boolean, creatureLevels: number[], klutzLevel: number, klutzAway: boolean): boolean {
  return firstQuestDone && !t.accepted && !klutzAway
    && klutzLevel >= QUEST_KLUTZ_LEVEL && creatureLevels.some((l) => l >= QUEST_CREATURE_LEVEL);
}

// Should this run's large room be the dynamite's storehouse?
export const wantsStorehouse = (t: TavernQuest) => !!t.accepted && !t.dynamite;

// The rubble can be blown open once you've got the dynamite (and only once).
export const canBlast = (t: TavernQuest) => !!t.dynamite && !t.blasted;
export const blast = (t: TavernQuest): TavernQuest => (canBlast(t) ? { ...t, blasted: true } : t);
// Testing (the altar's testing tools): open the rubble straight away, as if
// you'd done Klutz's quest and fetched the dynamite.
export const forceOpen = (t: TavernQuest): TavernQuest => ({ ...t, accepted: true, dynamite: true, blasted: true });

// The repair, material by material: what you have and what it needs.
export const repairNeeds = (have: Materials) =>
  (Object.entries(REPAIR_COST) as [MaterialKey, number][]).map(([key, need]) => ({ key, have: countMaterial(have, key), need }));
export const canRepair = (t: TavernQuest, have: Materials) => !!t.blasted && !t.repaired && canAfford(have, REPAIR_COST);
// Repair it: the tavern restored and your materials less the cost, or null
// if you can't (already repaired, or short of something).
export function repair(t: TavernQuest, have: Materials): { tavern: TavernQuest; materials: Materials } | null {
  if (!canRepair(t, have)) return null;
  const cost = Object.fromEntries(Object.entries(REPAIR_COST).map(([k, n]) => [k, -n!]));
  return { tavern: { ...t, repaired: true }, materials: addMaterials(have, cost) };
}

// The Cyclops Head over the tavern door: up once the tavern's repaired and
// you've beaten the Cyclops (clears), or handed in before the campaign.
export const headUp = (t: TavernQuest, clears: number) => !!t.mounted || (!!t.repaired && clears > 0);
// The bookcase schematic, to build while the bookcase is still the broken
// shelf (level 1): the campaign's reward, or the old bounty's (the plans
// weren't an item: the bookcase offers to build).
export const hasBookPlans = (t: TavernQuest) => !!t.bookPlans || !!t.mounted;
export const tavernPlan = (t: TavernQuest, bookcaseLevel: number) => hasBookPlans(t) && bookcaseLevel < 2;

// ── Saved progress ───────────────────────────────────────────────────
export const TAVERN_FIELD = "tavern";

export function loadTavern(): TavernQuest {
  const t = readSave()[TAVERN_FIELD];
  return t && typeof t === "object" ? (t as TavernQuest) : {};
}

// The tavern as it is now, on the clock (onTheClock): saved if that changed
// anything (a window rolled, a guest gone, an old save brought over).
export function tavernNow(now = Date.now()): TavernQuest {
  const t = loadTavern();
  const next = onTheClock(t, now, onBindle(loadDungeon().meta));
  if (next !== t) writeSaveField(TAVERN_FIELD, next);
  return next;
}

// Change it (read, change, write: whoever else wrote it meanwhile is kept).
export function updateTavern(fn: (t: TavernQuest) => TavernQuest): TavernQuest {
  const next = fn(loadTavern());
  writeSaveField(TAVERN_FIELD, next);
  return next;
}

// "Reset Player": the questline starts over.
export const clearTavern = () => writeSaveField(TAVERN_FIELD, undefined);
