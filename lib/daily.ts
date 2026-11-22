// lib/daily.ts
// The daily quests, on the quest board's Quests tab (docs/design.md §9): two a
// day, a primary (a dungeon's boss) and a secondary (something smaller), the
// same for everyone (picked from the date), new at local midnight. A quest
// you can't do yet steps down to one you can (dailyQuest): the Abyss to the
// Minotaur, the Minotaur to the Hydra, the Hydra to the Cyclops, the Cyclops to the Encampment, unless
// you've beaten it before; a duel offline, Klutz before he helps, a sale
// before the tavern's repaired and a summon without three matching cards, to
// winning fights. Which quests you got is fixed for the day the
// first time they're looked at, so a first win doesn't swap them mid-day.
// Progress counts from midnight. Once one's done you claim its reward, once.
//
// Kept in its own field of the save (lib/save.ts: OWN_FIELDS), as both the
// Den (scans, sales, Klutz, summoning) and the Labyrinth (fights, rooms, wins,
// its merchant) write it.

import { readSave, writeSaveField } from "./save";
import { isCardDrop, type Drop } from "./types";
import type { Rarity } from "./items/budgets";
import { RARITY_WEIGHTS } from "./items/budgets";
import { ITEM_KEYS } from "./items/ceilings";
import { ARMOR_KEYS, ARMOR_SLOTS } from "./items/armor";
import { weaponDrop, armorDrop, codexDrop, scrollDrop, dropFromOutcome, randomBasicMove, randomUncommonMove, randomStrongMove, randomCodexMove } from "./drops";
import { rollItemStats } from "./items/rollItemStats";
import { rollArmorPiece } from "./items/rollArmorStats";
import { materialBundle, toolDrop } from "./items/materials";
import { CREATURES_BY_RARITY } from "./creatures/creatureData";
import { makeCreatureDrop, CARDS_TO_SUMMON } from "./creatures/summon";
import { rollBarcodeOutcome } from "./barcodeRegistry";
import { klutzHelping, type QuestState } from "./quest";
import { TAVERN_FIELD } from "./tavern";
import type { DungeonId } from "./dungeon/run";
import { readOnlineConfig } from "./online/config";

type Rng = () => number;

// What counts towards a quest: a new barcode scanned (a Code Cache, sealed or
// not; a rescan's gold doesn't count), gold from selling things (at home or to
// the Labyrinth's merchant), a fight won in any dungeon, rooms finished (counted
// as each run ends), a mini boss beaten, Klutz sent hunting, a creature
// summoned from cards, a duel won (in battle, not by the other leaving), a
// species you'd never owned, or a dungeon's final boss beaten.
export type DailyEvent = "scan" | "sell" | "battle" | "room" | "miniboss" | "klutz" | "summon" | "duel" | "species" | `win:${DungeonId}`;
// What it pays: gold; Klutz's box but Rare or better (DAILY_BOX pieces); a
// creature (Rare at most); Rare or Epic gear; an Epic weapon or armour piece;
// an XP scroll; a bundle of one material; a Revival Elixir; a codex of a rolled
// rarity; a Code Cache at the altar; or the travelling merchant at the tavern.
export type DailyReward = "gold" | "box" | "creature" | "gear" | "epic" | "scroll" | "material" | "elixir" | "codex" | "cache" | "merchant";
// loot: what a boss's quest pays (rollDailyReward): n weapons and armour pieces between lo and hi
// (at the usual odds, held between them), the first of them at least the rarities in `sure`.
// Never enchanted, like every daily reward's gear (lib/items/enchantments.ts).
export type DailyLoot = { n: number; lo: Rarity; hi: Rarity; sure?: Rarity[] };
export type DailyQuest = {
  id: string;
  name: string;
  task: string;      // what to do (one line)
  event: DailyEvent;
  goal: number;
  reward: DailyReward;
  gold?: number;     // (a gold reward: how much)
  loot?: DailyLoot;  // (a boss's: what's in it)
  pays: string;      // the reward, in words
};

// The primaries: a dungeon's boss. Each pays the Cyclops' box (DAILY_BOX pieces, Rare or better, as
// the user set it on 2026-11-02), a little better the deeper the boss (the user, 2026-11-23: until
// then the Hydra's paid 3 Rare or Epic pieces and the Abyss's one Epic, less than the Cyclops', and
// the Minotaur had none). Kept small on purpose (the user, the same day: a first, bigger ladder
// would have made "log in, do the daily, log out" the game): the chase is the Challenge to come
// (docs/design/den.md). 🧪 Claude's numbers.
export const DAILY_BOX = 5;
const box = (...sure: Rarity[]): DailyLoot => ({ n: DAILY_BOX, lo: "rare", hi: "legendary", ...(sure.length ? { sure } : {}) });
export const PRIMARY_QUESTS: DailyQuest[] = [
  { id: "cyclops",  name: "Cyclops slayer",  task: "Beat the Cyclops",          event: "win:1", goal: 1, reward: "box",      loot: box(), pays: `A box of ${DAILY_BOX} Rare+ gear` },
  { id: "camp",     name: "Camp raider",     task: "Beat the Encampment twice", event: "win:0", goal: 2, reward: "creature", pays: "A creature (up to Rare)" },
  { id: "hydra",    name: "Hydra hunter",    task: "Beat the Hydra",            event: "win:2", goal: 1, reward: "box",      loot: box("epic"), pays: `A box of ${DAILY_BOX} Rare+ gear, one at least Epic` },
  { id: "minotaur", name: "Bull by the horns", task: "Beat the Minotaur",       event: "win:4", goal: 1, reward: "box",      loot: box("epic", "epic"), pays: `A box of ${DAILY_BOX} Rare+ gear, two at least Epic` },
  { id: "abyss",    name: "Into the Abyss",  task: "Beat the Abyss",            event: "win:3", goal: 1, reward: "box",      loot: box("legendary", "epic"), pays: `A box of ${DAILY_BOX} Rare+ gear, one Legendary and one at least Epic` },
];
// The secondaries: something smaller.
export const SECONDARY_QUESTS: DailyQuest[] = [
  { id: "scans",   name: "Barcode hunter", task: "Scan 5 new barcodes",            event: "scan",    goal: 5,   reward: "gold", gold: 500, pays: "500 gold" },
  { id: "sell",    name: "Good trade",     task: "Sell 300 gold's worth of items", event: "sell",    goal: 300, reward: "merchant", pays: "The travelling merchant calls" },
  { id: "battles", name: "Brawler",        task: "Win 5 fights in a dungeon",      event: "battle",  goal: 5,   reward: "scroll",   pays: "An XP scroll" },
  { id: "klutz",   name: "Send Klutz",     task: "Send Klutz out hunting",         event: "klutz",   goal: 1,   reward: "material", pays: "A bundle of materials" },
  { id: "rooms",   name: "Explorer",       task: "Clear 10 rooms in a dungeon",    event: "room",    goal: 10,  reward: "elixir",   pays: "A Revival Elixir" },
  { id: "miniboss", name: "Big game",      task: "Beat a mini boss",               event: "miniboss", goal: 1,  reward: "codex",    pays: "A codex (rarity rolled)" },
  { id: "summon",  name: "Summoner",       task: "Summon a creature from 3 cards", event: "summon",  goal: 1,   reward: "gold", gold: 250, pays: "250 gold" },
  { id: "duel",    name: "Duellist",       task: "Win a duel with a friend",       event: "duel",    goal: 1,   reward: "gold", gold: 100, pays: "100 gold" },
  { id: "species", name: "Collector",      task: "Find a creature you've never owned", event: "species", goal: 1, reward: "cache", pays: "A Code Cache" },
];
const QUEST_BY_ID = new Map([...PRIMARY_QUESTS, ...SECONDARY_QUESTS].map((q) => [q.id, q]));
export const questById = (id: string) => QUEST_BY_ID.get(id);

// What decides whether you can do a quest yet: final bosses you've beaten
// (per dungeon), whether this copy of the game has online (duels), whether
// Klutz hunts for you yet, whether the tavern's repaired (the merchant, the
// sales quest's reward, calls there), and whether you hold CARDS_TO_SUMMON
// cards of one creature (something to summon).
export type DailyCtx = { wins: Partial<Record<DungeonId, number>>; online: boolean; klutz: boolean; tavern: boolean; cards: boolean };
// A quest you can't do yet, and what it steps down to.
const STEP_DOWN: Record<string, { can: (c: DailyCtx) => boolean; to: string }> = {
  abyss:   { can: (c) => (c.wins[3] ?? 0) > 0, to: "minotaur" },
  minotaur: { can: (c) => (c.wins[4] ?? 0) > 0, to: "hydra" },
  hydra:   { can: (c) => (c.wins[2] ?? 0) > 0, to: "cyclops" },
  cyclops: { can: (c) => (c.wins[1] ?? 0) > 0, to: "camp" },
  duel:    { can: (c) => c.online, to: "battles" },
  klutz:   { can: (c) => c.klutz, to: "battles" },
  sell:    { can: (c) => c.tavern, to: "battles" },
  summon:  { can: (c) => c.cards, to: "battles" },
};
export function dailyQuest(id: string, ctx: DailyCtx): DailyQuest {
  let q = questById(id) ?? SECONDARY_QUESTS[0];
  for (let s = STEP_DOWN[q.id]; s && !s.can(ctx); s = STEP_DOWN[q.id]) q = questById(s.to)!;
  return q;
}

// Today, by the clock on this device: "2026-11-02".
export function dayKey(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
// The day's two quests, before any step down: the same for everyone on that date.
export const questsOfDay = (day: string): [DailyQuest, DailyQuest] =>
  [PRIMARY_QUESTS[hash(`${day}:primary`) % PRIMARY_QUESTS.length], SECONDARY_QUESTS[hash(`${day}:secondary`) % SECONDARY_QUESTS.length]];

// Saved: which day it's for, the two quests you got (primary, secondary), how
// far along each is, and which have been claimed. (A save from the first
// version, with one quest, starts the day afresh.)
export type DailyState = { day?: string; ids?: string[]; progress?: number[]; claimed?: boolean[] };
// The state for today: a new day gets its quests (stepped down for you) at 0.
export function dailyFor(s: DailyState, day: string, ctx: DailyCtx): Required<DailyState> {
  if (s.day === day && Array.isArray(s.ids) && s.ids.length === 2 && s.ids.every((id) => questById(id)))
    return { day, ids: s.ids, progress: [0, 1].map((i) => s.progress?.[i] ?? 0), claimed: [0, 1].map((i) => !!s.claimed?.[i]) };
  return { day, ids: questsOfDay(day).map((q) => dailyQuest(q.id, ctx).id), progress: [0, 0], claimed: [false, false] };
}
export const todaysQuests = (s: Required<DailyState>): DailyQuest[] => s.ids.map((id) => questById(id)!);

// Something happened that may count (amount: 1, or the gold a sale made, or rooms).
export function noteDaily(s: DailyState, event: DailyEvent, amount: number, day: string, ctx: DailyCtx): Required<DailyState> {
  const t = dailyFor(s, day, ctx);
  if (amount <= 0) return t;
  const qs = todaysQuests(t);
  return { ...t, progress: t.progress.map((n, i) => (qs[i].event === event && !t.claimed[i] ? n + amount : n)) };
}
// The merchant calls at the tavern, so a quest paying it waits for the repair.
// (dailyQuest steps it down before the repair; this covers a day whose quests
// were fixed before that rule.)
export const waitsForTavern = (q: DailyQuest, repaired: boolean) => q.reward === "merchant" && !repaired;
export const dailyDone = (s: Required<DailyState>, i: number) => s.progress[i] >= todaysQuests(s)[i].goal;
export const canClaim = (s: Required<DailyState>, i: number) => dailyDone(s, i) && !s.claimed[i];
export const claimDaily = (s: Required<DailyState>, i: number): Required<DailyState> =>
  (canClaim(s, i) ? { ...s, claimed: s.claimed.map((c, j) => c || j === i) } : s);

// Something on the board to claim now (the Den marks the board): a quest done,
// not claimed, and not waiting for the tavern.
export const dailyNews = (s: Required<DailyState>, repaired: boolean) =>
  todaysQuests(s).some((q, i) => canClaim(s, i) && !waitsForTavern(q, repaired));

// What the Den reminds you of as you come in (a popup, once a day per visit:
// components/DailyPopup.tsx): today's quests not yet claimed, with how far
// along each is (done: ready to claim at the board).
export const openQuests = (s: Required<DailyState>) =>
  todaysQuests(s).map((q, i) => ({ q, i, done: dailyDone(s, i), progress: Math.min(s.progress[i], q.goal) })).filter((x) => !s.claimed[x.i]);

// ── The rewards ──────────────────────────────────────────────────────
const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
// A rarity at the usual odds (RARITY_WEIGHTS), held between lo and hi.
export function rollRarity(rng: Rng, lo: Rarity = "common", hi: Rarity = "legendary"): Rarity {
  const total = ORDER.reduce((n, r) => n + RARITY_WEIGHTS[r], 0);
  let x = rng() * total, r: Rarity = "legendary";
  for (const k of ORDER) { if (x < RARITY_WEIGHTS[k]) { r = k; break; } x -= RARITY_WEIGHTS[k]; }
  return ORDER[Math.min(Math.max(ORDER.indexOf(r), ORDER.indexOf(lo)), ORDER.indexOf(hi))];
}
const pick = <T,>(xs: readonly T[], rng: Rng) => xs[Math.floor(rng() * xs.length)];

// A weapon a third of the time, otherwise an armour piece (as in Klutz's box).
export function gearPiece(lo: Rarity, hi: Rarity, rng: Rng): Drop {
  const rarity = rollRarity(rng, lo, hi);
  if (rng() < 1 / 3) {
    const key = pick(ITEM_KEYS, rng);
    return weaponDrop(key, rarity, "", rollItemStats(key, rarity, rng).stats);
  }
  const key = pick(ARMOR_KEYS, rng), slot = pick(ARMOR_SLOTS, rng);
  return armorDrop(key, rarity, "", rollArmorPiece(key, rarity, rng), slot);
}
// A codex of a rolled rarity, from the codexes a scan of that rarity gives
// (Epic and up: a race codex, as librarians and chests have).
function codexOfRarity(r: Rarity): Drop {
  return codexDrop(r === "common" ? randomBasicMove() : r === "uncommon" ? randomUncommonMove() : r === "rare" ? randomStrongMove() : randomCodexMove());
}

// A boss's loot (DailyLoot): its pieces, the first ones at least the rarities in `sure`.
export const dailyLoot = (l: DailyLoot, rng: Rng = Math.random): Drop[] =>
  Array.from({ length: l.n }, (_, i) => gearPiece(l.sure?.[i] ?? l.lo, l.hi, rng));
// The things a reward gives. Gold and the merchant give none (they're paid
// directly); a Code Cache is one drop, waiting at the altar. loot: a boss's quest's (DailyQuest.loot).
export function rollDailyReward(reward: DailyReward, rng: Rng = Math.random, loot?: DailyLoot): Drop[] {
  if (loot) return dailyLoot(loot, rng);
  switch (reward) {
    case "creature": {
      const pool = CREATURES_BY_RARITY[rollRarity(rng, "common", "rare")];
      return pool.length ? [makeCreatureDrop(pick(pool, rng), "creature", "")] : [];
    }
    case "scroll": return [scrollDrop()];
    case "material": return [materialBundle(rollRarity(rng), rng)];
    case "elixir": return [toolDrop("revival")];
    case "codex": return [codexOfRarity(rollRarity(rng))];
    case "cache": { const d = dropFromOutcome(rollBarcodeOutcome()); return d ? [d] : []; }
    default: return [];
  }
}

// ── Saved progress ───────────────────────────────────────────────────
export const DAILY_FIELD = "daily";

export function loadDaily(): DailyState {
  const d = readSave()[DAILY_FIELD];
  return d && typeof d === "object" ? (d as DailyState) : {};
}
// What you can do, from the save: bosses beaten, Klutz, the tavern and your cards. online: this copy has it.
export function dailyCtx(online: boolean): DailyCtx {
  const save = readSave();
  const meta = ((save.labyrinth as { meta?: Record<string, unknown> } | undefined)?.meta ?? {}) as Record<string, number | undefined>;
  return {
    wins: { 0: meta.campClears ?? 0, 1: meta.clears ?? 0, 2: meta.deepClears ?? 0, 3: meta.abyssClears ?? 0, 4: meta.minoClears ?? 0 },
    online,
    klutz: !!save.quest && klutzHelping(save.quest as QuestState),
    tavern: !!(save[TAVERN_FIELD] as { repaired?: boolean } | undefined)?.repaired,
    cards: hasCardsToSummon(Array.isArray(save.inventory) ? (save.inventory as Drop[]) : []),
  };
}
// CARDS_TO_SUMMON cards of one creature among these.
export function hasCardsToSummon(inventory: Drop[]): boolean {
  const n = new Map<string, number>();
  for (const d of inventory) if (isCardDrop(d) && d.creatureId) n.set(d.creatureId, (n.get(d.creatureId) ?? 0) + 1);
  return [...n.values()].some((k) => k >= CARDS_TO_SUMMON);
}
// Today's quests and progress, fixed in the save the first time (see the top).
export function todayDaily(online: boolean): Required<DailyState> {
  const s = loadDaily(), t = dailyFor(s, dayKey(), dailyCtx(online));
  if (s.day !== t.day || s.ids?.join() !== t.ids.join()) writeSaveField(DAILY_FIELD, t);
  return t;
}
// Change today's (read, change, write: whoever else wrote it meanwhile is kept).
export function updateDaily(online: boolean, fn: (s: Required<DailyState>) => Required<DailyState>): Required<DailyState> {
  const next = fn(todayDaily(online));
  writeSaveField(DAILY_FIELD, next);
  return next;
}
// Does this copy of the game have online (for duels)? (As lib/online/client.ts reads it.)
export const DAILY_ONLINE = readOnlineConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY).ok;
// Count something towards today's quests.
export const countDaily = (event: DailyEvent, amount = 1) =>
  updateDaily(DAILY_ONLINE, (s) => noteDaily(s, event, amount, s.day, dailyCtx(DAILY_ONLINE)));
// "Reset Player": they start over.
export const clearDaily = () => writeSaveField(DAILY_FIELD, undefined);
