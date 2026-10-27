// scripts/sim-encampment.ts
// The Encampment (the first labyrinth, CAMP_ROUTE rooms, its chief at the
// end): how many runs a new player takes to beat it. Run with:
//   npx vite-node scripts/sim-encampment.ts [players]
// The player is a new game's starter (a Rare, Lv 3) in the best of Klutz's
// box and club, and plays without thinking: its strongest race move whenever
// it can afford one, otherwise its strongest move. It drinks a potion
// between rooms when under half HP, keeps its XP from run to run, and comes
// home healed (HEAL_AT_HOME). It picks up no gear on the way (so a little
// pessimistic). It walks a real Encampment map, heading for a stash while it
// can still reach one (they're always marked).

import { CREATURE_BY_ID, type CreatureTemplate } from "../lib/creatures/creatureData";
import { starterCreature } from "../lib/creatures/starter";
import { rollBox, klutzClub, THIEF_LEVEL } from "../lib/quest";
import { buildFighter } from "../lib/combat/loadout";
import { wornArmor, type ArmorSlot } from "../lib/items/armor";
import type { ItemKey } from "../lib/items/ceilings";
import { createBattle, resolveRound, sendInReplacement, activeOf, affordableSkills, type BattleAction, type BattleState } from "../lib/combat/battle";
import { chooseAiAction, chooseAiReplacement, type AiLevel } from "../lib/combat/thinkingAi";
import { raceOfMove } from "../lib/combat/raceChart";
import type { Fighter } from "../lib/combat/engine";
import { addXp, xpForEnemy, type Progress } from "../lib/creatures/levels";
import { makeEnemy, lightenGear, enemyFighter, makeRoom, hasFight, campCages, DUNGEONS, CAMP_STASH, CAMP_ROUTE, FIRST_ROOM_LEVELS, POTIONS, type Enemy, type PotionKey } from "../lib/dungeon/run";
import { rollMap, routeLength, waysOn } from "../lib/dungeon/map";
import { rollCreature } from "../lib/creatures/creatureRoll";
import { aiChooseReplacement } from "../lib/combat/teamBattle";
import type { CreatureOrItemDrop as Drop, Rarity } from "../lib/types";

const PLAYERS = Number(process.argv[2] ?? 150);
const MAX_RUNS = 12;
const rnd = Math.random;
const randInt = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const weighted = <T,>(mix: [T, number][]) => {
  let r = rnd() * mix.reduce((s, [, w]) => s + w, 0);
  for (const [t, w] of mix) { if (r < w) return t; r -= w; }
  return mix[0][0];
};

// ── The player ─────────────────────────────────────────────────────
type Player = { t: CreatureTemplate; drop: Drop; kit: Drop[]; weapon?: Drop; armour: Partial<Record<ArmorSlot, Drop>>; p: Progress };
const sum = (s?: Record<string, number>) => Object.values(s ?? {}).reduce((a, b) => a + b, 0);
const STYLE_STAT = { melee: "melee", ranged: "ranged", magic: "magic" } as const;

function newPlayer(): Player {
  const drop = starterCreature() as Drop;
  const t = CREATURE_BY_ID[(drop as { creatureId: string }).creatureId];
  const kit = [...rollBox(), klutzClub()] as Drop[];
  // Gear on as a casual player would: the weapon with most of its style's stat, the biggest piece per slot.
  const stat = STYLE_STAT[t.cls];
  const weapons = kit.filter((d) => d.dropType === "item" && d.itemCategory === "weapon");
  const weapon = weapons.sort((a, b) => ((b.stats?.[stat] ?? 0) - (a.stats?.[stat] ?? 0)) || sum(b.stats) - sum(a.stats))[0];
  const armour: Player["armour"] = {};
  for (const d of kit) {
    if (d.dropType !== "item" || d.itemCategory !== "armor") continue;
    const slot = d.armorSlot as ArmorSlot;
    if (!armour[slot] || sum(d.stats) > sum(armour[slot]!.stats)) armour[slot] = d;
  }
  return { t, drop, kit, weapon, armour, p: { level: (drop as { level?: number }).level ?? 3, xp: 0 } };
}

function playerFighter(pl: Player): Fighter {
  const d = pl.drop as { moves?: string[]; proficiency?: Fighter["proficiency"]; soulStone?: string | null };
  const armour = wornArmor(Object.values(pl.armour).map((x) => ({ stats: x!.stats ?? {} }))).stats;
  const f = buildFighter(pl.t, pl.weapon?.stats, armour, d.moves, d.proficiency as never, undefined, pl.weapon?.itemKey as ItemKey | undefined, pl.p.level);
  return { ...f, ...(d.soulStone ? { soulStone: d.soulStone } : {}) } as Fighter;
}

// Spam the race move: its strongest race move it can afford, else its strongest move.
function raceSpam(s: BattleState): BattleAction {
  const moves = affordableSkills(activeOf(s.sides.A)).filter((m) => !m.self);
  if (moves.length === 0) return { kind: "pass" };
  const race = moves.filter((m) => raceOfMove(m));
  const best = (race.length ? race : moves).sort((a, b) => b.damage - a.damage)[0];
  return { kind: "attack", skillName: best.name };
}

// One fight; hp is the player's HP going in. Returns the HP left (0 = lost) and the XP won.
function fight(pl: Player, hp: number, enemies: Enemy[], ai: AiLevel): { hp: number; xp: number } {
  const me = playerFighter(pl);
  const s = createBattle([me], enemies.map(enemyFighter), { A: [hp] });
  while (!s.winner) {
    resolveRound(s, { A: raceSpam(s), B: chooseAiAction(s, "B", ai) });
    for (const k of [...s.needsReplacement]) sendInReplacement(s, k, chooseAiReplacement(s, k, ai));
  }
  if (s.winner !== "A") return { hp: 0, xp: 0 };
  const xp = enemies.reduce((t, e) => t + xpForEnemy(e.level ?? 15, CREATURE_BY_ID[e.creatureId].rarity), 0);
  return { hp: s.sides.A.team[0].hp, xp };
}

// ── The run ───────────────────────────────────────────────────────
// A mini boss option: creature rarity, gear rarity, level, its weapon or not, how it plays.
type Boss = { name: string; rarity: Rarity; gear: Rarity; level: number; weapon: boolean; ai: AiLevel };

function den(depth: number): Enemy[] {
  const size = depth <= 2 ? 1 : randInt(1, 2);
  const out: Enemy[] = [];
  for (let i = 0; i < size; i++) {
    const level = depth <= 2 ? weighted(FIRST_ROOM_LEVELS) : randInt(1, 4);
    out.push(lightenGear(makeEnemy("common", "common", out.map((e) => e.creatureId), rnd, level), depth <= 3 ? 1 : 4));
  }
  return out;
}

function bossEnemy(b: Boss): Enemy {
  const e = makeEnemy(b.rarity, b.gear, [], rnd, b.level);
  return b.weapon ? e : { ...e, gear: e.gear.filter((g) => g.slot !== "weapon") };
}

// Rooms 1–4: rooms 1–2 a den 90% of the time (else a stash); rooms 3–4 from a gentle mix.
const LATER_MIX: [string, number][] = [["easy", 55], ["pool", 20], ["stash", 15], ["chest", 10]];

// STASHES: rooms 1–4 are dens or stashes, a stash this share of the time (never two in a row;
// missing: the game's CAMP_STASH). STASHES=old: the first option study's mix.
const STASHES = process.env.STASHES === "old" ? undefined : process.env.STASHES === undefined ? CAMP_STASH : Number(process.env.STASHES);
function playRun(pl: Player, boss: Boss): { won: boolean; reached: number } {
  // LEGACY=1: the old fixed walk (CAMP_ROUTE rooms, a stash STASHES of the time).
  if (process.env.LEGACY) return playLegacy(pl, boss);
  // The real map: stashes are always marked, so it heads for one it can still reach.
  const map = rollMap(false, rnd, DUNGEONS[0].spec, 0);
  const canReachStash = (id: string): boolean => map.nodes[id].kind === "stash" || waysOn(map, id).some((n) => canReachStash(n.id));
  const me = playerFighter(pl);
  let hp = me.maxHp;
  const bag: PotionKey[] = [];
  const drink = () => {
    while (hp < me.maxHp / 2 && bag.length) hp = Math.min(me.maxHp, hp + POTIONS[bag.shift()!].heal);
  };
  let at = map.start;
  for (let depth = 1; at !== map.boss; depth++) {
    const ways = waysOn(map, at);
    const toStash = ways.filter((n) => canReachStash(n.id));
    const pickFrom = toStash.length ? toStash : ways;
    at = pickFrom[Math.floor(rnd() * pickFrom.length)].id;
    if (at === map.boss) break;
    const room = makeRoom(map.nodes[at].kind, rnd, routeLength(map, at), 0);
    if (room.kind === "stash") {
      for (const it of room.sack ?? []) if ("potion" in it && it.potion && bag.length < 3) bag.push(it.potion);
      continue;
    }
    const r = fight(pl, hp, room.enemies ?? [], room.level ?? "easy");
    if (r.hp <= 0) return { won: false, reached: depth };
    pl.p = addXp(pl.p, r.xp);
    hp = Math.min(r.hp, playerFighter(pl).maxHp);
    drink();
  }
  const r = fight(pl, hp, [bossEnemy(boss)], boss.ai);
  return { won: r.hp > 0, reached: CAMP_ROUTE };
}

function playLegacy(pl: Player, boss: Boss): { won: boolean; reached: number } {
  let lastStash = false;
  const me = playerFighter(pl);
  let hp = me.maxHp;
  const bag: PotionKey[] = [];
  const drink = () => {
    while (hp < me.maxHp / 2 && bag.length) hp = Math.min(me.maxHp, hp + POTIONS[bag.shift()!].heal);
  };
  for (let depth = 1; depth <= CAMP_ROUTE; depth++) {
    const kind: string = depth === CAMP_ROUTE ? "boss" : STASHES !== undefined ? (!lastStash && rnd() < STASHES ? "stash" : "easy")
      : depth <= 2 ? (rnd() < 0.9 ? "easy" : "stash") : weighted(LATER_MIX);
    lastStash = kind === "stash";
    if (kind === "pool") { hp = playerFighter(pl).maxHp; continue; }
    if (kind === "stash" || kind === "chest") {
      for (let i = 0; i < (kind === "stash" ? 2 + (rnd() < 0.25 ? 1 : 0) : 1); i++) if (bag.length < 3) bag.push(rnd() < 0.3 ? "potion" : "lesser");
      continue;
    }
    const r = kind === "boss" ? fight(pl, hp, [bossEnemy(boss)], boss.ai) : fight(pl, hp, den(depth), "easy");
    if (r.hp <= 0) return { won: false, reached: depth };
    pl.p = addXp(pl.p, r.xp);
    hp = Math.min(r.hp, playerFighter(pl).maxHp);
    drink();
  }
  return { won: true, reached: CAMP_ROUTE };
}

// ── The study ─────────────────────────────────────────────────────
function study(boss: Boss) {
  const firstWin: number[] = [];
  const bySpecies: Record<string, [number, number]> = {};
  const diedAt: Record<number, number> = {};
  let attempts = 0, bossWins = 0, bossTries = 0, levelAtWin = 0;
  for (let n = 0; n < PLAYERS; n++) {
    const pl = newPlayer();
    pl.p = addXp(pl.p, xpForEnemy(THIEF_LEVEL, "rare")); // the guided first fight
    let won = 0;
    for (let run = 1; run <= MAX_RUNS && !won; run++) {
      attempts++;
      const r = playRun(pl, boss);
      if (r.reached === CAMP_ROUTE) bossTries++;
      if (!r.won) diedAt[r.reached] = (diedAt[r.reached] ?? 0) + 1;
      if (r.won) { won = run; bossWins++; levelAtWin += pl.p.level; }
    }
    firstWin.push(won || MAX_RUNS + 1);
    const k = pl.t.name; (bySpecies[k] ??= [0, 0])[0]++; if (!won) bySpecies[k][1]++;
  }
  firstWin.sort((a, b) => a - b);
  const q = (f: number) => firstWin[Math.floor(f * (firstWin.length - 1))];
  const by = (r: number) => Math.round((firstWin.filter((x) => x <= r).length / PLAYERS) * 100);
  const never = firstWin.filter((x) => x > MAX_RUNS).length;
  console.log(
    `${boss.name.padEnd(34)} median run ${String(q(0.5)).padStart(3)} | won by run 1: ${String(by(1)).padStart(3)}%  2: ${String(by(2)).padStart(3)}%  4: ${String(by(4)).padStart(3)}%  6: ${String(by(6)).padStart(3)}%` +
    ` | not by ${MAX_RUNS}: ${String(Math.round((never / PLAYERS) * 100)).padStart(3)}% | reached boss ${Math.round((bossTries / attempts) * 100)}% of runs, beat it ${Math.round((bossWins / Math.max(1, bossTries)) * 100)}% | Lv at win ${(levelAtWin / Math.max(1, bossWins)).toFixed(1)}`,
  );
  if (process.env.STUCK) console.log("   runs lost in room: " + Object.entries(diedAt).map(([k, n]) => `${k}: ${Math.round((n / attempts) * 100)}%`).join(", "));
  if (process.env.STUCK) console.log("   stuck by starter: " + Object.entries(bySpecies).map(([k, [n, x]]) => `${k} ${Math.round((x / n) * 100)}%`).join(", "));
}

// ── After the Encampment: the Labyrinth's first rooms, with a team of 3 ──
// MODE=cyclops: each player plays until it beats the chief (as above), takes its
// two cage creatures (campCages: Lv 2–4, no race of the starter's), puts the
// box's leftovers on them (LEFTOVERS=0: none), and walks the first 5 rooms of
// a real Labyrinth map, a tunnel at random each time, LAB_TRIES times.
type Member = { f: Fighter; hp: number };
function cageTeam(pl: Player): Member[] {
  const kit = pl.kit.filter((d) => d !== pl.weapon && !Object.values(pl.armour).includes(d));
  return campCages(true, pl.t.races ?? []).map((c) => {
    const t = CREATURE_BY_ID[c.creatureId!];
    const roll = rollCreature(t);
    let weapon: Drop | undefined;
    const armour: Partial<Record<ArmorSlot, Drop>> = {};
    if (process.env.LEFTOVERS !== "0") {
      const stat = STYLE_STAT[t.cls];
      const wi = kit.map((d, i) => [d, i] as const).filter(([d]) => d.itemCategory === "weapon").sort(([a], [b]) => (b.stats?.[stat] ?? 0) - (a.stats?.[stat] ?? 0))[0];
      if (wi) { weapon = wi[0]; kit.splice(wi[1], 1); }
      for (const slot of ["helmet", "chest", "legs"] as ArmorSlot[]) {
        const i = kit.findIndex((d) => d.itemCategory === "armor" && d.armorSlot === slot);
        if (i >= 0) { armour[slot] = kit[i]; kit.splice(i, 1); }
      }
    }
    const worn = wornArmor(Object.values(armour).map((x) => ({ stats: x!.stats ?? {} }))).stats;
    const f = buildFighter(t, weapon?.stats, worn, roll.moves, roll.proficiency, undefined, weapon?.itemKey as ItemKey | undefined, c.level);
    return { f: { ...f, ...(roll.soulStone ? { soulStone: roll.soulStone } : {}) } as Fighter, hp: f.maxHp };
  });
}

function teamFight(team: Member[], enemies: Enemy[], ai: AiLevel): boolean {
  const up = team.filter((m) => m.hp > 0);
  const s = createBattle(up.map((m) => m.f), enemies.map(enemyFighter), { A: up.map((m) => m.hp) });
  while (!s.winner) {
    resolveRound(s, { A: raceSpam(s), B: chooseAiAction(s, "B", ai) });
    for (const k of [...s.needsReplacement]) sendInReplacement(s, k, k === "A" ? aiChooseReplacement(s, "A") : chooseAiReplacement(s, k, ai));
  }
  up.forEach((m, i) => { m.hp = s.sides.A.team[i].hp; });
  return s.winner === "A";
}

const LAB_TRIES = 3;
function labyrinthStudy(boss: Boss) {
  let tries = 0, through = 0, fights = 0, lost = 0;
  const lostTo: Record<string, number> = {}, met: Record<string, number> = {};
  for (let n = 0; n < PLAYERS; n++) {
    const pl = newPlayer();
    pl.p = addXp(pl.p, xpForEnemy(THIEF_LEVEL, "rare"));
    let won = false;
    for (let run = 1; run <= 30 && !won; run++) won = playRun(pl, boss).won;
    if (!won) continue;
    for (let k = 0; k < LAB_TRIES; k++) {
      tries++;
      const me = playerFighter(pl);
      const team: Member[] = [{ f: me, hp: me.maxHp }, ...cageTeam(pl)];
      const map = rollMap(false, rnd, DUNGEONS[1].spec, 1);
      let at = map.start, ok = true;
      for (let room = 1; room <= 5 && ok; room++) {
        const ways = waysOn(map, at);
        at = ways[Math.floor(rnd() * ways.length)].id;
        const r = makeRoom(map.nodes[at].kind, rnd, routeLength(map, at), 1);
        if (r.kind === "pool") { const hurt = team.filter((m) => m.hp < m.f.maxHp).sort((a, b) => a.hp / a.f.maxHp - b.hp / b.f.maxHp)[0]; if (hurt) hurt.hp = hurt.f.maxHp; }
        if (!hasFight(r) || !r.enemies) continue;
        met[r.kind] = (met[r.kind] ?? 0) + 1;
        fights++;
        if (!teamFight(team, r.enemies, r.level ?? "normal")) { ok = false; lost++; lostTo[r.kind] = (lostTo[r.kind] ?? 0) + 1; }
      }
      if (ok) through++;
    }
  }
  console.log(`Labyrinth rooms 1–5 with a team of 3 (${process.env.LEFTOVERS === "0" ? "cage creatures ungeared" : "box leftovers on the cage creatures"}): ` +
    `through all 5 rooms ${Math.round((through / tries) * 100)}% of ${tries} runs; fights lost ${Math.round((lost / fights) * 100)}%`);
  console.log("   lost, by room kind: " + Object.entries(met).map(([k, m]) => `${k} ${Math.round(((lostTo[k] ?? 0) / m) * 100)}% of ${m}`).join(", "));
}

const ai = (process.env.AI ?? "hard") as AiLevel;
if (process.env.MODE === "cyclops") {
  labyrinthStudy({ name: "chief", rarity: "uncommon", gear: "common", level: 5, weapon: true, ai });
  process.exit(0);
}
const BOSSES: Boss[] = process.env.SET === "final" ? [
  { name: `Uncommon, Common gear, Lv 5, stash ${STASHES ?? "old mix"}`, rarity: "uncommon", gear: "common", level: 5, weapon: true, ai },
] : process.env.SET === "2" ? [
  { name: "Uncommon, Uncommon gear, no weapon, Lv 4", rarity: "uncommon", gear: "uncommon", level: 4, weapon: false, ai },
  { name: "Uncommon, Uncommon gear, no weapon, Lv 6", rarity: "uncommon", gear: "uncommon", level: 6, weapon: false, ai },
  { name: "Uncommon, Common gear, Lv 4", rarity: "uncommon", gear: "common", level: 4, weapon: true, ai },
  { name: "Uncommon, Common gear, Lv 5", rarity: "uncommon", gear: "common", level: 5, weapon: true, ai },
  { name: "Rare, Uncommon gear, no weapon, Lv 4", rarity: "rare", gear: "uncommon", level: 4, weapon: false, ai },
  { name: "Rare, Uncommon gear, no weapon, Lv 6", rarity: "rare", gear: "uncommon", level: 6, weapon: false, ai },
  { name: "Rare, Rare gear, no weapon, Lv 6", rarity: "rare", gear: "rare", level: 6, weapon: false, ai },
] : [
  { name: "Uncommon, Uncommon gear, Lv 4", rarity: "uncommon", gear: "uncommon", level: 4, weapon: true, ai },
  { name: "Uncommon, Uncommon gear, Lv 5", rarity: "uncommon", gear: "uncommon", level: 5, weapon: true, ai },
  { name: "Uncommon, Uncommon gear, Lv 6", rarity: "uncommon", gear: "uncommon", level: 6, weapon: true, ai },
  { name: "Rare, Uncommon gear, Lv 4", rarity: "rare", gear: "uncommon", level: 4, weapon: true, ai },
  { name: "Rare, Rare gear, no weapon, Lv 4", rarity: "rare", gear: "rare", level: 4, weapon: false, ai },
  { name: "Rare, Rare gear, Lv 4", rarity: "rare", gear: "rare", level: 4, weapon: true, ai },
  { name: "Rare, Rare gear, Lv 6 (today's)", rarity: "rare", gear: "rare", level: 6, weapon: true, ai },
];
console.log(`${PLAYERS} players each, mini boss played by the ${ai} AI`);
for (const b of process.env.ONLY ? BOSSES.filter((x) => x.name.includes(process.env.ONLY!)) : BOSSES) study(b);
