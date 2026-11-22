// tests/battleSoak.test.ts: battles at random, by the thousand (lib/combat/battle.ts). Every creature, with any four
// of every move in the game, any soul stone, armour set and enchantment, against random choices, each AI and each
// boss, in every kind of fight. Whatever happens, some things must always hold: HP stays between 0 and its most,
// energy between 0 and 100, a creature knocked out doesn't act, every battle ends, and its end makes sense
// (docs/polish-audit-2026-11.md, bugs).
import { describe, expect, it } from "vitest";
import { CREATURE_TEMPLATES, MOVE_BY_NAME, isSteadyMove, type Skill } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { MAX_ENERGY, type Fighter } from "../lib/combat/engine";
import {
  createBattle, resolveRound, sendInReplacement, cloneBattle, isValidAction, affordableSkills, activeOf, attackTargets, swapTargets, revivable, aliveCount, fieldOf, MAX_ROUNDS,
  type BattleAction, type BattleState, type SideKey,
} from "../lib/combat/battle";
import { chooseAiAction, chooseAiReplacement, type AiLevel } from "../lib/combat/thinkingAi";
import { aiChooseAction, aiChooseReplacement } from "../lib/combat/teamBattle";
import { bossTeam } from "../lib/creatures/bosses";
import type { BossKind } from "../lib/combat/bossAi";
import { SOUL_STONE_KEYS } from "../lib/creatures/soulStones";
import { ARMOR_META, type ArmorKey } from "../lib/items/armor";
import { slowIt } from "./slow";

// A small seeded dice, so a failing battle can be fought again by its number. (The rules' own dice are Math.random:
// the test swaps it for this while a battle runs.)
const dice = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Every move there is: each species' own, and every move by name (learnable, race, special, core, retired, bosses').
const EVERY_MOVE: Skill[] = [...new Map([...CREATURE_TEMPLATES.flatMap((c) => c.skills), ...Object.values(MOVE_BY_NAME)].map((m) => [m.name, m])).values()];
const STEADY = EVERY_MOVE.filter(isSteadyMove);
const SETS = Object.keys(ARMOR_META) as ArmorKey[];
const ENCHANTS = ["bounty", "scholars", "bossbane", "leeching", "keen", "piercing", "vampiric", "cleansing", "victorious"] as const;
const BOSSES: BossKind[] = ["cyclops", "hydra", "minotaur"];

type Rng = () => number;
const pick = <T,>(rng: Rng, a: readonly T[]) => a[Math.floor(rng() * a.length)];
const stats = (rng: Rng, keys: string[]) => Object.fromEntries(keys.map((k) => [k, Math.floor(rng() * 60)]));

// A fighter of any species at any level, with any four moves (one of them steady, as every set has), and maybe a
// soul stone, a full armour set, enchantments.
function anyFighter(rng: Rng, name: string): Fighter {
  const t = pick(rng, CREATURE_TEMPLATES);
  const f = buildFighter(t, rng() < 0.7 ? stats(rng, ["melee", "ranged", "magic", "agility", "hp"]) : undefined, rng() < 0.7 ? stats(rng, ["mDef", "rDef", "magDef", "agility", "hp"]) : undefined,
    undefined, undefined, rng() < 0.3 ? pick(rng, SETS) : undefined, undefined, 1 + Math.floor(rng() * 50), rng() < 0.2 ? Math.floor(rng() * 3) : 0);
  const moves = new Map<string, Skill>([[pick(rng, STEADY).name, pick(rng, STEADY)]]);
  for (let n = 0; moves.size < 4 && n < 20; n++) { const m = pick(rng, EVERY_MOVE); moves.set(m.name, m); }
  const skills = [...moves.values()];
  if (!skills.some(isSteadyMove)) skills[0] = pick(rng, STEADY);
  return {
    ...f, name, skills,
    ...(rng() < 0.5 ? { soulStone: pick(rng, SOUL_STONE_KEYS) } : {}),
    ...(rng() < 0.3 ? { enchant: Object.fromEntries(Array.from({ length: 1 + Math.floor(rng() * 2) }, () => [pick(rng, ENCHANTS), 0.05 + rng() * 0.3])) } : {}),
  };
}
const anyTeam = (rng: Rng, side: string, n: number) => Array.from({ length: n }, (_, i) => anyFighter(rng, `${side}${i + 1}`));

// Any choice the rules allow: a move (at any target it can reach), a swap, a potion, an elixir, a weapon from the
// bag, a rest when nothing's affordable.
function anyAction(state: BattleState, key: SideKey, rng: Rng): BattleAction {
  const s = state.sides[key], me = activeOf(s), targets = attackTargets(state, key);
  const options: BattleAction[] = [
    ...affordableSkills(me).flatMap((sk): BattleAction[] => [
      { kind: "attack", skillName: sk.name, ...(targets.length ? { target: pick(rng, targets) } : {}) },
      { kind: "attack", skillName: sk.name },
      ...(swapTargets(s).length ? [{ kind: "attack", skillName: sk.name, swapTo: pick(rng, swapTargets(s)) } as BattleAction] : []),
    ]),
    ...swapTargets(s).map((to): BattleAction => ({ kind: "swap", to })),
    { kind: "item", item: "Potion", heal: 50 },
    ...revivable(s).map((index): BattleAction => ({ kind: "item", item: "Revival Elixir", heal: 0, revive: { index, share: 0.5 } })),
    { kind: "weapon", name: "Spare", weapon: { atk: 20, rng: 20, mag: 20, agil: 5, mdef: 0, rdef: 0, magdef: 0, hp: 0 } },
    { kind: "pass" },
  ];
  const ok = options.filter((a) => isValidAction(state, key, a));
  if (!ok.length) throw new Error(`no choice at all for side ${key}`);
  return pick(rng, ok);
}

type Player = { act: (s: BattleState, k: SideKey) => BattleAction; replace: (s: BattleState, k: SideKey) => number; name: string };
function anyPlayer(rng: Rng): Player {
  const r = rng();
  if (r < 0.7) return { name: "random", act: (s, k) => anyAction(s, k, rng), replace: (s, k) => pick(rng, s.sides[k].team.flatMap((f, i) => (f.hp > 0 && i !== s.sides[k].active ? [i] : []))) };
  // (The thinking AIs look moves ahead: a hard one takes a tenth of a second a round here, so they play fewer.)
  if (r < 0.82) { const level: AiLevel = r < 0.76 ? "easy" : r < 0.8 ? "normal" : "hard"; return { name: `ai:${level}`, act: (s, k) => chooseAiAction(s, k, level), replace: (s, k) => chooseAiReplacement(s, k, level) }; }
  const smart = rng() < 0.5;
  return { name: "ai:plain", act: (s, k) => aiChooseAction(s, k, { canSwap: true, smartReplace: smart }), replace: (s, k) => aiChooseReplacement(s, k, smart) };
}

// Every number in the battle a real, finite number.
function badNumber(v: unknown, at = "state"): string | null {
  if (typeof v === "number") return Number.isFinite(v) ? null : `${at} is ${v}`;
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const w = badNumber(v[i], `${at}[${i}]`); if (w) return w; } return null; }
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k === "log" || k === "skills") continue; const w = badNumber(x, `${at}.${k}`); if (w) return w; }
  return null;
}

// What must hold after anything happens.
function broken(state: BattleState): string | null {
  for (const k of ["A", "B"] as SideKey[]) {
    const s = state.sides[k];
    for (const [i, f] of s.team.entries()) {
      if (!(f.hp >= 0 && f.hp <= f.maxHp)) return `${k}${i} ${f.name}: HP ${f.hp} of ${f.maxHp}`;
      if (!(f.energy >= 0 && f.energy <= MAX_ENERGY)) return `${k}${i} ${f.name}: energy ${f.energy}`;
      if (!(f.maxHp > 0)) return `${k}${i} ${f.name}: most HP ${f.maxHp}`;
      for (const st of f.statuses) if (!(st.rounds >= 0)) return `${k}${i} ${f.name}: status ${st.id} with ${st.rounds} rounds left`;
    }
    if (!s.team[s.active]) return `side ${k}'s active creature (${s.active}) isn't in its team`;
    // Between rounds, whoever's out is standing, unless it's waiting to be replaced or the fight's over.
    if (!state.winner && !s.boss && !state.needsReplacement.includes(k) && activeOf(s).hp <= 0) return `side ${k}'s creature out (${activeOf(s).name}) is knocked out with no replacement asked for`;
    if (state.needsReplacement.includes(k) && !s.team.some((f, i) => f.hp > 0 && i !== s.active)) return `side ${k} must replace, with nobody left to send`;
  }
  const w = badNumber(state);
  if (w) return w;
  const ends = state.log.filter((e) => e.type === "end");
  if (state.winner) {
    if (ends.length !== 1 || state.log[state.log.length - 1].type !== "end") return `won by ${state.winner}, with ${ends.length} endings in the log`;
    const a = aliveCount(state.sides.A), b = aliveCount(state.sides.B), timeUp = !!state.turnLimit && state.round >= state.turnLimit;
    if (state.winner === "A" && !(a > 0 && b === 0)) return `A won with ${a} standing against ${b}`;
    if (state.winner === "B" && !(b > 0 && (a === 0 || timeUp))) return `B won with ${b} standing against ${a}`;
    if (state.winner === "draw" && !(state.round >= MAX_ROUNDS || (a === 0 && b === 0) || (timeUp && b === 0))) return `a draw in round ${state.round} with ${a} against ${b}`;
  } else if (ends.length) return "an ending in the log, and no winner";
  return null;
}

// A round's new lines of the log: nobody knocked out in it acts afterwards (unless something brought it back).
function actedAfterFainting(state: BattleState, from: number): string | null {
  const down = new Set<string>();
  for (const e of state.log.slice(from)) {
    if (e.type === "faint") down.add(`${e.side}:${e.name}`);
    else if (e.type === "effect" && (e.kind === "revive" || e.kind === "regrow" || e.hp > 0)) down.delete(`${e.side}:${e.name}`);
    else if (e.type === "sendIn" || e.type === "lineup") { /* someone else comes on */ }
    else if (e.type === "attack" && down.has(`${e.side}:${e.attacker}`)) return `${e.attacker} (side ${e.side}) used ${e.skill.name} after being knocked out in round ${state.round}`;
    else if (e.type === "pass" && down.has(`${e.side}:${e.name}`)) return `${e.name} (side ${e.side}) rested after being knocked out in round ${state.round}`;
  }
  return null;
}

// One battle, start to finish. Returns what went wrong (null: nothing).
function fight(seed: number): string | null {
  const rng = dice(seed), real = Math.random;
  Math.random = rng;
  try {
    const kind = rng();
    const boss = kind < 0.25 ? pick(rng, BOSSES) : undefined;
    const pair = !boss && kind < 0.4, limit = !boss && kind >= 0.4 && kind < 0.5 ? 3 + Math.floor(rng() * 20) : undefined;
    const teamA = anyTeam(rng, "A", 1 + Math.floor(rng() * 5));
    const teamB = boss ? bossTeam(boss, 1 + Math.floor(rng() * 50)) : anyTeam(rng, "B", 1 + Math.floor(rng() * 5));
    const hurt = rng() < 0.3 ? { A: teamA.map((f) => Math.ceil(rng() * f.maxHp)) } : {};
    let state = createBattle(teamA, teamB, hurt, boss, { pairB: pair, ...(limit ? { turnLimit: limit } : {}) });
    const players: Record<SideKey, Player> = { A: anyPlayer(rng), B: anyPlayer(rng) };
    const tag = `${boss ?? (pair ? "ambush" : limit ? `limit ${limit}` : "plain")}, ${players.A.name} v ${boss ? "its script" : players.B.name}`;
    let w = broken(state);
    if (w) return `${tag}: at the start: ${w}`;
    for (let step = 0; step < MAX_ROUNDS * 12; step++) {
      if (state.winner) return null;
      const from = state.log.length, round = state.round;
      if (state.needsReplacement.length) {
        const k = state.needsReplacement[0];
        const index = players[k].replace(state, k);
        const f = state.sides[k].team[index];
        if (!f || f.hp <= 0 || index === state.sides[k].active) return `${tag}: side ${k}'s ${players[k].name} sent in ${index}, who can't come`;
        state = sendInReplacement(cloneBattle(state), k, index);
      } else {
        const actions = {} as Record<SideKey, BattleAction>;
        for (const k of ["A", "B"] as SideKey[]) {
          actions[k] = state.sides[k].boss ? { kind: "pass" } : players[k].act(state, k);
          if (!state.sides[k].boss && !isValidAction(state, k, actions[k])) return `${tag}: side ${k}'s ${players[k].name} chose what isn't allowed: ${JSON.stringify(actions[k]).slice(0, 120)}`;
        }
        // (As the game does it: the round is worked out on a copy, and the battle as it stood isn't touched.
        // Checked one round in six: it's the slowest check here.)
        const watch = rng() < 1 / 6, before = watch ? JSON.stringify(state.sides) : "";
        const next = resolveRound(cloneBattle(state), actions);
        if (watch && JSON.stringify(state.sides) !== before) return `${tag}: round ${round + 1} changed the battle as it stood before it (a copy isn't a whole copy)`;
        if (next.round !== round + 1) return `${tag}: round ${round} was followed by ${next.round}`;
        state = next;
        if (state.round > MAX_ROUNDS) return `${tag}: round ${state.round}, past the last (${MAX_ROUNDS})`;
      }
      w = broken(state) ?? actedAfterFainting(state, from);
      if (w) return `${tag}: round ${state.round}: ${w}`;
    }
    return `${tag}: never ended (round ${state.round})`;
  } catch (e) {
    return `threw: ${(e as Error).message.slice(0, 200)}`;
  } finally {
    Math.random = real;
  }
}

function sweep(from: number, n: number): string[] {
  const wrong: string[] = [];
  for (let seed = from; seed < from + n; seed++) { const w = fight(seed); if (w) wrong.push(`#${seed}: ${w}`); }
  return wrong;
}

describe("battles at random", () => {
  it("the test's own moves: every move in the game is in the pot", () => {
    expect(EVERY_MOVE.length).toBeGreaterThan(100);
    expect(STEADY.length).toBeGreaterThan(5);
  });
  it("150 battles: HP and energy in bounds, nobody acts knocked out, every one ends, and ends as it should", () => {
    expect(sweep(1, 150).slice(0, 12)).toEqual([]);
  });
  // (BATTLE_SWEEP=12000 for a long soak, about 12 minutes; BATTLE_FROM for other battles than the usual ones.
  // Run so on 2026-11-23, with the 4,000 before it: 16,000 battles, nothing wrong.)
  const many = Number(process.env.BATTLE_SWEEP) || 600, first = Number(process.env.BATTLE_FROM) || 10_000;
  slowIt(`${many} more`, () => {
    expect(sweep(first, many).slice(0, 12)).toEqual([]);
  }, 3_600_000);
});
