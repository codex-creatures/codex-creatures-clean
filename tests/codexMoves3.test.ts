import { describe, it, expect, vi, afterEach } from "vitest";
import { createBattle, resolveRound, activeOf, burnWith, type BattleAction, type Combatant } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { CREATURE_BY_ID, CREATURE_TEMPLATES, MOVE_BY_NAME, canLearnFromCodex } from "../lib/creatures/creatureData";
import { abilityOf } from "../lib/creatures/moveAbility";

// The user's third codex batch (2026-11-19).
const fighter = (id: string, moves: string[]) => buildFighter(CREATURE_BY_ID[id], { melee: 20, ranged: 20, magic: 20 }, { mDef: 5, rDef: 5, magDef: 5 }, moves);
const big = <T extends { maxHp: number; hp: number }>(f: T) => ({ ...f, maxHp: 999, hp: 999 });
const fast = <T extends Pick<Combatant, "weapon">>(f: T): T => ({ ...f, weapon: { ...f.weapon, agil: 80 } });
const attack = (skillName: string, extra: Partial<Extract<BattleAction, { kind: "attack" }>> = {}): BattleAction => ({ kind: "attack", skillName, ...extra });
const swap = (to: number): BattleAction => ({ kind: "swap", to });
const status = (f: Combatant, id: string) => f.statuses.find((s) => s.id === id);
afterEach(() => vi.restoreAllMocks());

describe("the third codex batch: who and what", () => {
  it("each has the user's learners, race, style and rarity", () => {
    const want: Record<string, [string, string, string, number]> = {
      "Flame Spit": ["ranged", "geo", "common", 13], "Cursed Claw": ["melee", "undead", "uncommon", 11], Claw: ["melee", "beast", "common", 21],
      Bounce: ["melee", "beast", "rare", 15], Stalactite: ["ranged", "underkin", "epic", 9], Curse: ["magic", "undead", "legendary", 6], // (with the new creatures, the user's ticks, 2026-11-26)
    };
    for (const [name, [type, race, rarity, n]] of Object.entries(want)) {
      const m = MOVE_BY_NAME[name];
      expect([m.type, m.asRace, m.codexRarity], name).toEqual([type, race, rarity]);
      expect(CREATURE_TEMPLATES.filter((t) => canLearnFromCodex(t, name)).length, name).toBe(n);
    }
    expect(canLearnFromCodex(CREATURE_BY_ID.dreadpox, "Curse")).toBe(true);
    expect(canLearnFromCodex(CREATURE_BY_ID.moss_wolf, "Curse")).toBe(false);
    expect([MOVE_BY_NAME.Bounce.energyCost, MOVE_BY_NAME.Bounce.damage, MOVE_BY_NAME.Bounce.cooldown]).toEqual([40, 5, 3]);
    expect([MOVE_BY_NAME.Stalactite.energyCost, MOVE_BY_NAME.Stalactite.mult, MOVE_BY_NAME.Stalactite.cooldown]).toEqual([50, 2, undefined]); // (50 energy and 2× since 2026-11-25; 65 and 1.5× priced it out of use)
    expect(MOVE_BY_NAME.Curse.effect).toMatchObject({ kind: "curse", power: 6 }); // (10 until 2026-11-25: it won 93% of mirror fights)
    expect(MOVE_BY_NAME.Curse.cooldown).toBe(3); // (none until 2026-11-25: the tick is mostly the caster's attack, so power alone couldn't tame it)
    expect(abilityOf(MOVE_BY_NAME.Stalactite)).toBe("Big hit");
    expect(abilityOf(MOVE_BY_NAME.Claw)).toBe("Plain hit");
  });
});

describe("the third codex batch in a fight", () => {
  it("Flame Spit: a burn like poison (5% a round); Geo are immune", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const s = createBattle([big(fighter("flame_imp", ["Zap", "Flame Spit"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    resolveRound(s, { A: attack("Flame Spit"), B: attack("Strike") });
    const wolf = activeOf(s.sides.B);
    expect(status(wolf, "burn")?.dmg).toBe(50); // 5% of 999
    expect(s.log.some((e) => e.type === "effect" && e.kind === "burn" && e.damage === 50)).toBe(true);
    const g = createBattle([big(fighter("flame_imp", ["Zap", "Flame Spit"]))], [big(fighter("dust_sprite", ["Zap"]))]);
    resolveRound(g, { A: attack("Flame Spit"), B: attack("Zap") });
    expect(status(activeOf(g.sides.B), "burn")).toBeUndefined();
  });

  it("burn sits alongside poison, puts out a bleed, and a new bleed puts out a burn; it doesn't stack", () => {
    const [f] = createBattle([fighter("moss_wolf", ["Strike"])], [fighter("moss_wolf", ["Strike"])]).sides.A.team;
    f.statuses.push({ id: "poison", rounds: 3, dmg: 5 }, { id: "bleed", rounds: 99, dmg: 5 });
    expect(burnWith(f, 5, 4)).toBe(true);
    expect(f.statuses.map((x) => x.id).sort()).toEqual(["burn", "poison"]);
    expect(burnWith(f, 5, 2)).toBe(false); // the one with more left stays
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const s = createBattle([big(fighter("thicket_archer", ["Shot", "Obsidian Arrows"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    activeOf(s.sides.B).statuses.push({ id: "burn", rounds: 4, dmg: 5 });
    resolveRound(s, { A: attack("Obsidian Arrows"), B: attack("Strike") });
    expect(status(activeOf(s.sides.B), "burn")).toBeUndefined();
    expect(status(activeOf(s.sides.B), "bleed")).toBeDefined();
  });

  it("Cursed Claw: striking first, it may strike fear (they lose their attack); striking second, never", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    const s = createBattle([fast(big(fighter("mr_shadows", ["Strike", "Cursed Claw"])))], [big(fighter("moss_wolf", ["Strike"]))]);
    resolveRound(s, { A: attack("Cursed Claw"), B: attack("Strike") });
    expect(activeOf(s.sides.A).hp).toBe(999);
    expect(s.log.some((e) => e.type === "effect" && e.kind === "fear" && e.text.includes("Cursed Claw"))).toBe(true);
    const slow = createBattle([big(fighter("mr_shadows", ["Strike", "Cursed Claw"]))], [fast(big(fighter("moss_wolf", ["Strike"])))]);
    resolveRound(slow, { A: attack("Cursed Claw"), B: attack("Strike") });
    expect(activeOf(slow.sides.A).hp).toBeLessThan(999);
    expect(status(activeOf(slow.sides.B), "fear")).toBeUndefined();
  });

  it("Bounce: a small hit, then it swaps to the teammate picked; it doesn't go first", () => {
    const team = () => [big(fighter("moss_wolf", ["Strike", "Bounce"])), big(fighter("ironhide", ["Strike"])), big(fighter("glob", ["Strike"]))];
    const s = createBattle(team(), [fast(big(fighter("moss_wolf", ["Strike"])))]);
    resolveRound(s, { A: attack("Bounce", { swapTo: 2 }), B: attack("Strike") });
    expect(s.sides.A.active).toBe(2);
    expect(s.sides.A.team[0].hp).toBeLessThan(999); // the faster foe hit it before it bounced
    expect(s.sides.A.team[0].cooldowns?.Bounce).toBeGreaterThan(0);
    // A slower foe's hit lands on the one coming in.
    const t = createBattle([fast(team()[0]), ...team().slice(1)], [big(fighter("moss_wolf", ["Strike"]))]);
    resolveRound(t, { A: attack("Bounce", { swapTo: 1 }), B: attack("Strike") });
    expect([t.sides.A.active, t.sides.A.team[0].hp]).toEqual([1, 999]);
    expect(t.sides.A.team[1].hp).toBeLessThan(999);
  });

  it("Curse: no hit, then a magic hit each round for 2–3 rounds", () => {
    const s = createBattle([big(fighter("mr_shadows", ["Zap", "Curse"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    resolveRound(s, { A: attack("Curse"), B: attack("Strike") });
    const wolf = activeOf(s.sides.B);
    const curse = status(wolf, "curse")!;
    expect(curse.dmg).toBeGreaterThan(0);
    expect(999 - wolf.hp).toBe(curse.dmg); // only the curse's tick, no hit
    let rounds = 1;
    while (status(wolf, "curse")) { resolveRound(s, { A: attack("Zap"), B: attack("Strike") }); rounds++; }
    expect(rounds).toBeGreaterThanOrEqual(2);
    expect(rounds).toBeLessThanOrEqual(3);
  });

  it("Curse: swapping out, 60% it passes to a benched teammate (not the one coming in); again on every swap-out; a new one restarts the clock", () => {
    const s = createBattle([big(fighter("mr_shadows", ["Zap", "Curse"]))],
      [big(fighter("moss_wolf", ["Strike"])), big(fighter("ironhide", ["Strike"])), big(fighter("glob", ["Strike"]))]);
    resolveRound(s, { A: attack("Curse"), B: attack("Strike") });
    const lasts = (f: Combatant) => (f.statuses = f.statuses.map((x) => (x.id === "curse" ? { ...x, rounds: 5 } : x)));
    lasts(s.sides.B.team[0]); // (still on when it swaps out)
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    resolveRound(s, { A: attack("Zap"), B: swap(1) });
    const [wolf, hide, glob] = s.sides.B.team;
    expect(status(wolf, "curse")).toBeDefined(); // it keeps its own
    expect(status(hide, "curse")).toBeUndefined(); // the one coming in is spared
    expect(status(glob, "curse")).toBeDefined();
    expect(s.log.some((e) => e.type === "effect" && e.text.includes("catches the curse"))).toBe(true);
    // At 60%, a roll above it passes nothing.
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const t = createBattle([big(fighter("mr_shadows", ["Zap", "Curse"]))],
      [big(fighter("moss_wolf", ["Strike"])), big(fighter("ironhide", ["Strike"])), big(fighter("glob", ["Strike"]))]);
    resolveRound(t, { A: attack("Curse"), B: attack("Strike") });
    lasts(t.sides.B.team[0]);
    resolveRound(t, { A: attack("Zap"), B: swap(1) });
    expect(status(t.sides.B.team[2], "curse")).toBeUndefined();
  });

  it("Curse: passing to one already cursed restarts its clock (it never stacks)", () => {
    const s = createBattle([big(fighter("mr_shadows", ["Zap", "Curse"]))],
      [big(fighter("glob", ["Strike"])), big(fighter("ironhide", ["Strike"])), big(fighter("moss_wolf", ["Strike"]))]);
    const [glob, , wolf] = s.sides.B.team;
    glob.statuses.push({ id: "curse", rounds: 5, dmg: 3, by: 0, move: "Curse", chance: 0.6 });
    wolf.statuses.push({ id: "curse", rounds: 1, dmg: 3, by: 0, move: "Curse", chance: 0.6 }); // would end this round
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    resolveRound(s, { A: attack("Zap"), B: swap(1) });
    expect(wolf.statuses.filter((x) => x.id === "curse")).toHaveLength(1);
    expect(status(wolf, "curse")!.rounds).toBeGreaterThanOrEqual(1); // a fresh 2–3, one ticked
  });
});
