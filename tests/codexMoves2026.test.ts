import { describe, it, expect, vi, afterEach } from "vitest";
import { createBattle, resolveRound, sendInReplacement, activeOf, poisonWith, CRIPPLE, CRIPPLE_ROUNDS, CRIPPLE_ROUNDS_MAX, type BattleAction, type Combatant } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage } from "../lib/combat/engine";
import { CREATURE_BY_ID, CREATURE_TEMPLATES, MOVE_BY_NAME, SPECIAL_MOVES, canLearnFromCodex, isRetiredMove, REUSED_NAMES } from "../lib/creatures/creatureData";
import { CODEX_MOVES_2026 } from "../lib/creatures/codexMoves";
import { codexesOfRarity, codexRarityOf } from "../lib/drops";
import { wipeReusedNames } from "../lib/creatures/instance";
import { HYDRA } from "../lib/combat/bossAi";

const fighter = (id: string, moves: string[]) => buildFighter(CREATURE_BY_ID[id], { melee: 20, ranged: 20, magic: 20 }, { mDef: 5, rDef: 5, magDef: 5 }, moves);
const big = <T extends { maxHp: number; hp: number }>(f: T) => ({ ...f, maxHp: 999, hp: 999 });
const attack = (skillName: string): BattleAction => ({ kind: "attack", skillName });
const swap = (to: number): BattleAction => ({ kind: "swap", to });
const has = (f: Combatant, id: string) => f.statuses.some((s) => s.id === id);
afterEach(() => vi.restoreAllMocks());

describe("the 2026-11 codex moves: who, what rarity, where they come from", () => {
  it("all 29 are special-move codexes, each with learners, a rarity and a short description", () => {
    expect(CODEX_MOVES_2026).toHaveLength(29);
    for (const m of CODEX_MOVES_2026) {
      expect(SPECIAL_MOVES).toContain(m);
      expect(MOVE_BY_NAME[m.name], m.name).toBe(m);
      expect(codexRarityOf(m.name), m.name).toBe(m.codexRarity);
      expect(codexesOfRarity(m.codexRarity!), m.name).toContain(m.name);
      const learners = CREATURE_TEMPLATES.filter((t) => canLearnFromCodex(t, m.name));
      expect(learners.length, m.name).toBeGreaterThan(0);
      expect(m.desc!.length, m.name).toBeLessThanOrEqual(130);
    }
    // By race and look, not race-locked: the Deep Angler (Underkin) learns Cleansing Water (Geo).
    expect(canLearnFromCodex(CREATURE_BY_ID.deep_angler, "Cleansing Water")).toBe(true);
    expect(canLearnFromCodex(CREATURE_BY_ID.moss_wolf, "Cleansing Water")).toBe(false);
  });
  it("Smite and Ambush are the new moves now; an old one in a save is wiped once", () => {
    expect(isRetiredMove("Smite")).toBe(false);
    expect(MOVE_BY_NAME.Smite.effect?.kind).toBe("execute");
    expect(Object.keys(REUSED_NAMES)).toEqual(["Smite", "Ambush"]);
    const t = CREATURE_BY_ID.flicker_wisp; // learns the new Smite
    const old = { moves: ["Zap", "Smite", "Blast"], learned: ["Smite"] };
    expect(wipeReusedNames(old, t)).toBe(true);
    expect(old.moves).not.toContain("Smite");
    expect(old.moves).toHaveLength(3);
    expect(old.learned).toEqual([]);
    // Once stamped, a Smite it learns is kept.
    const now = { ...old, moves: [...old.moves, "Smite"] };
    expect(wipeReusedNames(now, t)).toBe(false);
    expect(now.moves).toContain("Smite");
  });
});

describe("the 2026-11 codex moves in a fight", () => {
  it("Mega Smash winds up (paying), then strikes for 2.5× next turn for free; meanwhile only it or a swap", () => {
    const s = createBattle([big(fighter("ironhide", ["Strike", "Smash", "Mega Smash"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    const me = () => activeOf(s.sides.A);
    resolveRound(s, { A: attack("Mega Smash"), B: attack("Strike") });
    expect(has(me(), "charged")).toBe(true);
    expect(me().energy).toBe(100 - 50 + 30);
    expect(() => resolveRound(s, { A: attack("Smash"), B: attack("Strike") })).toThrow(); // wound up: strike or swap
    const hp = activeOf(s.sides.B).hp, energy = me().energy;
    resolveRound(s, { A: attack("Mega Smash"), B: attack("Strike") });
    expect(hp - activeOf(s.sides.B).hp).toBeGreaterThan(calcDamage(MOVE_BY_NAME.Smash, me(), activeOf(s.sides.B), false).damage * 2);
    expect(me().energy).toBe(Math.min(100, energy + 30));
    expect(has(me(), "charged")).toBe(false);
  });

  it("Smoke Bomb goes first, hits, and swaps out; the one coming in takes their hit", () => {
    const s = createBattle([fighter("flame_imp", ["Zap", "Smoke Bomb"]), big(fighter("ironhide", ["Strike"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    resolveRound(s, { A: attack("Smoke Bomb"), B: attack("Strike") });
    expect(s.sides.A.active).toBe(1);
    expect(s.sides.A.team[0].hp).toBe(s.sides.A.team[0].maxHp);
    expect(s.sides.A.team[1].hp).toBeLessThan(999);
  });

  it("Choking Smog: a cloud under the foes for 5–7 rounds; whoever stands in it is poisoned 10% a round, and 1–3 rounds more after; Toxic are immune", () => {
    const s = createBattle([big(fighter("dreadpox", ["Zap", "Choking Smog"]))], [big(fighter("moss_wolf", ["Strike"])), big(fighter("glob", ["Strike"])), big(fighter("rattlebones", ["Strike"]))]);
    resolveRound(s, { A: attack("Choking Smog"), B: attack("Strike") });
    const cloud = s.sides.B.ground?.find((g) => g.kind === "cloud");
    expect(cloud && "rounds" in cloud && cloud.rounds).toBeGreaterThanOrEqual(5);
    expect(s.sides.A.ground ?? []).toEqual([]); // only theirs
    const wolf = s.sides.B.team[0];
    expect(999 - wolf.hp).toBeGreaterThanOrEqual(100); // a tenth of 999, plus the hit
    resolveRound(s, { A: attack("Zap"), B: swap(1) }); // the Glob (Toxic) comes in: immune
    expect(has(s.sides.B.team[1], "poison")).toBe(false);
    expect(has(wolf, "poison")).toBe(true); // the wolf keeps it on the bench for a while
    const left = wolf.statuses.find((x) => x.id === "poison")!.rounds;
    expect(left).toBeGreaterThanOrEqual(1);
    expect(left).toBeLessThanOrEqual(3);
  });

  it("clouds don't stack; blood under a cloud is soaked up and makes it stronger", () => {
    const s = createBattle([big(fighter("hollow_matriarch", ["Strike", "Haemorrhage"])), big(fighter("dreadpox", ["Zap", "Choking Smog"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    resolveRound(s, { A: attack("Haemorrhage"), B: attack("Strike") });
    expect(s.sides.B.ground?.map((g) => g.kind)).toEqual(["gore"]);
    resolveRound(s, { A: swap(1), B: attack("Strike") });
    resolveRound(s, { A: attack("Choking Smog"), B: attack("Strike") });
    expect(s.sides.B.ground?.map((g) => g.kind)).toEqual(["cloud"]);
    const cloud = s.sides.B.ground![0];
    expect(cloud.kind === "cloud" && cloud.boost).toBe(1.5);
  });

  it("Flame Body burns away only the cloud under its own team; Emulate doubles on a cloud under the target and burns it", () => {
    const s = createBattle([big(fighter("flame_imp", ["Zap", "Flame Body", "Emulate"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    const cloud = { kind: "cloud" as const, move: "x", rounds: 5, tick: 0.1, tailMin: 1, tailMax: 3 };
    s.sides.A.ground = [{ ...cloud }];
    s.sides.B.ground = [{ ...cloud }];
    resolveRound(s, { A: attack("Flame Body"), B: attack("Strike") });
    expect(s.sides.A.ground).toEqual([]);
    expect(s.sides.B.ground?.length).toBe(1);
    const imp = activeOf(s.sides.A), wolf = activeOf(s.sides.B);
    const plain = calcDamage(MOVE_BY_NAME.Emulate, imp, wolf, false).damage;
    vi.spyOn(Math, "random").mockReturnValue(0.5); // (no precise hit, the middle damage roll)
    const hp = wolf.hp;
    resolveRound(s, { A: attack("Emulate"), B: attack("Strike") });
    expect(hp - wolf.hp).toBeGreaterThanOrEqual(plain * 2 - 2 + Math.round(999 * 0.1)); // ×2, and one more tick as it burns
    expect(s.log.some((e) => e.type === "effect" && e.text.includes("goes up in flames"))).toBe(true);
    expect(s.sides.B.ground).toEqual([]);
  });

  it("cripple lasts 3–5 rounds with a 50% stumble (the user, 2026-11-13); Enfeeble a sure 3", () => {
    expect([CRIPPLE_ROUNDS, CRIPPLE_ROUNDS_MAX, CRIPPLE.stumble]).toEqual([3, 5, 0.5]);
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const s = createBattle([big(fighter("thicket_archer", ["Shot", "Bolas Shot"]))], [big(fighter("moss_wolf", ["Strike"]))]);
      resolveRound(s, { A: attack("Bolas Shot"), B: attack("Strike") });
      const c = activeOf(s.sides.B).statuses.find((x) => x.id === "cripple");
      if (c) seen.add(c.rounds);
    }
    expect([...seen].sort()).toEqual([3, 4, 5]); // (after this round's tick: 3–5 more)
    expect(MOVE_BY_NAME.Enfeeble.effect).toMatchObject({ chance: 1, minRounds: 3, maxRounds: 3 });
  });

  it("poison doesn't stack: the one with more left stays", () => {
    const [f] = createBattle([fighter("moss_wolf", ["Strike"])], [fighter("moss_wolf", ["Strike"])]).sides.A.team;
    expect(poisonWith(f, 10, 5)).toBe(true);
    expect(poisonWith(f, 10, 2)).toBe(false);
    expect(poisonWith(f, 30, 2)).toBe(true);
    expect(f.statuses.filter((x) => x.id === "poison")).toEqual([{ id: "poison", rounds: 2, dmg: 30 }]);
  });

  it("Crystal Armour clears its statuses and blocks new ones (and clouds) for 3 rounds", () => {
    const s = createBattle([big(fighter("crystal_golem", ["Strike", "Crystal Armour"]))], [big(fighter("aurelius", ["Shot", "Obsidian Arrows", "Bolas Shot"]))]);
    const golem = activeOf(s.sides.A);
    golem.statuses.push({ id: "venom", rounds: 3, dmg: 5 });
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    resolveRound(s, { A: attack("Crystal Armour"), B: attack("Shot") });
    expect(has(golem, "venom")).toBe(false);
    resolveRound(s, { A: attack("Strike"), B: attack("Obsidian Arrows") });
    resolveRound(s, { A: attack("Strike"), B: attack("Bolas Shot") });
    expect(has(golem, "bleed") || has(golem, "cripple")).toBe(false);
  });

  it("Obsidian Arrows: the target bleeds 10% a round until it leaves the field; Undead don't bleed", () => {
    const s = createBattle([big(fighter("thicket_archer", ["Shot", "Obsidian Arrows"]))], [big(fighter("moss_wolf", ["Strike"])), big(fighter("rattlebones", ["Strike"]))]);
    resolveRound(s, { A: attack("Obsidian Arrows"), B: attack("Strike") });
    expect(has(s.sides.B.team[0], "bleed")).toBe(true);
    resolveRound(s, { A: attack("Shot"), B: swap(1) });
    expect(has(s.sides.B.team[0], "bleed")).toBe(false);
    resolveRound(s, { A: attack("Obsidian Arrows"), B: attack("Strike") });
    expect(has(s.sides.B.team[1], "bleed")).toBe(false);
  });

  it("Caltrops: each creature that comes in on their side loses 10% of its max HP", () => {
    const s = createBattle([big(fighter("cave_bat", ["Strike", "Caltrops"]))], [big(fighter("moss_wolf", ["Strike"])), big(fighter("glob", ["Strike"]))]);
    resolveRound(s, { A: attack("Caltrops"), B: attack("Strike") });
    resolveRound(s, { A: attack("Strike"), B: swap(1) });
    expect(999 - s.sides.B.team[1].hp).toBeGreaterThanOrEqual(100);
  });

  it("Haunting Scream: 70% they flee for a random teammate (who doesn't act this round); otherwise their attacks are halved", () => {
    const s = createBattle([big(fighter("pale_rider", ["Strike", "Haunting Scream"]))], [big(fighter("moss_wolf", ["Strike"])), big(fighter("glob", ["Strike"]))]);
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const rider = activeOf(s.sides.A);
    s.sides.A.team[0] = { ...rider, weapon: { ...rider.weapon, agil: 50 } }; // goes first
    resolveRound(s, { A: attack("Haunting Scream"), B: attack("Strike") });
    expect(s.sides.B.active).toBe(1);
    expect(s.sides.A.team[0].hp).toBe(999); // the wolf fled before it struck, the Glob doesn't act
  });

  it("Fissure hits every foe on the field, no one on the bench", () => {
    const s = createBattle([big(fighter("tunnel_wyrm", ["Strike", "Fissure"])), big(fighter("moss_wolf", ["Strike"]))], [big(fighter("moss_wolf", ["Strike"])), big(fighter("glob", ["Strike"])), big(fighter("rattlebones", ["Strike"]))], {}, undefined, { pairB: true });
    resolveRound(s, { A: attack("Fissure"), B: attack("Strike") });
    expect(s.sides.B.team[0].hp).toBeLessThan(999);
    expect(s.sides.B.team[1].hp).toBeLessThan(999);
    expect(s.sides.B.team[2].hp).toBe(999);
    expect(s.sides.A.team[1].hp).toBe(999);
  });

  it("Vampiric Bite heals 30% of its damage; Headbutt costs the user 20% of it", () => {
    const s = createBattle([big(fighter("deep_angler", ["Strike", "Vampiric Bite"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    activeOf(s.sides.A).hp = 400; // (hurt, with room to heal)
    resolveRound(s, { A: attack("Vampiric Bite"), B: attack("Strike") });
    expect(s.log.some((e) => e.type === "effect" && e.text.startsWith("drains"))).toBe(true);
    const t = createBattle([big(fighter("ironhide", ["Strike", "Headbutt"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    resolveRound(t, { A: attack("Headbutt"), B: attack("Strike") });
    expect(t.log.some((e) => e.type === "effect" && e.text.includes("recoil"))).toBe(true);
  });

  it("the Hydra's breath is a cloud like Choking Smog's: Cleansing Water washes it away", () => {
    const s = createBattle([big(fighter("thunderhead", ["Zap", "Cleansing Water"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    s.sides.A.ground = [{ kind: "cloud", move: "Toxic Breath", rounds: HYDRA.CLOUD_ROUNDS, tick: HYDRA.POISON_TICK, tailMin: 19, tailMax: 19, onEntry: true }];
    activeOf(s.sides.A).statuses.push({ id: "poison", rounds: 19, dmg: 5 });
    resolveRound(s, { A: attack("Cleansing Water"), B: attack("Strike") });
    expect(s.sides.A.ground).toEqual([]);
    expect(has(activeOf(s.sides.A), "poison")).toBe(false);
    sendInReplacement(s, "A", 0); // (nothing to do: no one's down)
  });
});
