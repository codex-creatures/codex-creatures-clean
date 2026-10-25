import { describe, it, expect, vi, afterEach } from "vitest";
import { CREATURE_BY_ID, CREATURES_BY_RARITY } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { createBattle, resolveRound, activeOf, isCrippled, type BattleEvent } from "../lib/combat/battle";
import type { Fighter } from "../lib/combat/engine";
import {
  POOLS, SOUL_STONE_CHANCE, TOXIC_SKIN, REVITALISE_HEAL, PERFECTIONIST_STEP,
  rollSoulStone, soulStoneOf, stonesFor, type SoulStoneKey,
} from "../lib/creatures/soulStones";
import { makeCreatureDrop, summonFromCards } from "../lib/creatures/summon";
import { rollCreature } from "../lib/creatures/creatureRoll";
import { makeEnemy, enemyFighter } from "../lib/dungeon/run";

afterEach(() => vi.restoreAllMocks());

const with_ = (f: Fighter, soulStone?: SoulStoneKey): Fighter => (soulStone ? { ...f, soulStone } : f);
const attacks = (log: BattleEvent[], side: "A" | "B") => log.filter((e): e is Extract<BattleEvent, { type: "attack" }> => e.type === "attack" && e.side === side);

describe("who gets a soul stone", () => {
  it("only Rare or better, every one of those has 2+ to roll from, and nothing else does", () => {
    for (const r of ["common", "uncommon"] as const) for (const t of CREATURES_BY_RARITY[r]) expect(stonesFor(t.id)).toEqual([]);
    for (const r of ["rare", "epic", "legendary"] as const) for (const t of CREATURES_BY_RARITY[r]) expect(stonesFor(t.id).length).toBeGreaterThanOrEqual(2);
    const rarePlus = new Set((["rare", "epic", "legendary"] as const).flatMap((r) => CREATURES_BY_RARITY[r].map((t) => t.id)));
    for (const id of Object.keys(POOLS)) expect(rarePlus.has(id)).toBe(true);
  });

  it("Rare 25%, Epic 60%, Legendary always, from the species' pool", () => {
    const n = 4000;
    for (const [id, chance] of [["aurelius", SOUL_STONE_CHANCE.rare], ["dire_wolf", SOUL_STONE_CHANCE.epic], ["ironhide", SOUL_STONE_CHANCE.legendary]] as const) {
      const got = Array.from({ length: n }, () => rollSoulStone(CREATURE_BY_ID[id]));
      expect(got.filter(Boolean).length / n).toBeCloseTo(chance!, 1);
      for (const s of got) if (s) expect(POOLS[id]).toContain(s);
    }
    expect(SOUL_STONE_CHANCE).toEqual({ rare: 0.25, epic: 0.6, legendary: 1 });
  });

  it("new creatures and cards are rolled with theirs (null: none)", () => {
    const d = makeCreatureDrop(CREATURE_BY_ID.sylvaran, "card", "");
    expect(POOLS.sylvaran).toContain(d.soulStone);
    expect(makeCreatureDrop(CREATURE_BY_ID[CREATURES_BY_RARITY.common[0].id], "creature", "").soulStone).toBeNull();
  });

  it("an old creature gets the same roll every time it's loaded, and a rolled one keeps its own", () => {
    const old = { id: "an-old-creature-id" };
    const first = soulStoneOf(old, CREATURE_BY_ID.ironhide);
    expect(first).not.toBeNull(); // (Legendary: always)
    for (let i = 0; i < 5; i++) expect(soulStoneOf(old, CREATURE_BY_ID.ironhide)).toBe(first);
    expect(soulStoneOf({ id: "x", soulStone: null }, CREATURE_BY_ID.ironhide)).toBeNull();
    expect(soulStoneOf({ id: "x", soulStone: "trickster" }, CREATURE_BY_ID.ironhide)).toBe("trickster");
  });

  it("summoning from a card keeps its stone", () => {
    const t = CREATURE_BY_ID.void_serpent;
    const cards = Array.from({ length: 3 }, () => makeCreatureDrop(t, "card", "", { ...rollCreature(t), soulStone: "trickster" }));
    expect(summonFromCards(cards, cards[1].id).soulStone).toBe("trickster");
  });
});

describe("enemies' soul stones", () => {
  it("enemies roll them at the usual rates, and fight with them", () => {
    const n = 2000;
    const legends = Array.from({ length: 200 }, () => makeEnemy("legendary", "common", []));
    for (const e of legends) {
      expect(POOLS[e.creatureId]).toContain(e.soulStone);
      expect(enemyFighter(e).soulStone).toBe(e.soulStone);
    }
    const epics = Array.from({ length: n }, () => makeEnemy("epic", "common", []));
    expect(epics.filter((e) => e.soulStone).length / n).toBeCloseTo(SOUL_STONE_CHANCE.epic!, 1);
    for (const e of Array.from({ length: 300 }, () => makeEnemy("common", "common", []))) {
      expect(e.soulStone).toBeUndefined();
      expect(enemyFighter(e).soulStone).toBeUndefined();
    }
  });
});

describe("soul stones in battle", () => {
  const brute = (stone?: SoulStoneKey, agility = 0) => with_(buildFighter(CREATURE_BY_ID.ironhide, { melee: 40, hp: 900, agility }, undefined, ["Slash", "Crush"]), stone);
  const wall = (stone?: SoulStoneKey, moves = ["Jab"]) => with_(buildFighter(CREATURE_BY_ID.crystal_golem, undefined, { hp: 900 }, moves), stone);

  it("Toxic Skin: a melee hit can poison the attacker for 3–5 turns, ticking on the bench too, and a new one replaces it", () => {
    const s = createBattle([brute(), brute()], [wall("toxic_skin")]);
    vi.spyOn(Math, "random").mockReturnValue(0); // every roll succeeds: poisoned for the shortest time (3)
    resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: { kind: "attack", skillName: "Jab" } });
    const me = activeOf(s.sides.A);
    const poison = me.statuses.find((x) => x.id === "poison");
    expect(poison).toMatchObject({ dmg: Math.round(me.maxHp * TOXIC_SKIN.tick) });
    expect(s.log.some((e) => e.type === "effect" && e.kind === "poison")).toBe(true); // ticked this round
    // Swapped out, it keeps ticking on the bench.
    const hp = s.sides.A.team[0].hp;
    resolveRound(s, { A: { kind: "swap", to: 1 }, B: { kind: "attack", skillName: "Jab" } });
    expect(s.sides.A.team[0].hp).toBe(hp - poison!.dmg!);
    vi.restoreAllMocks();
    // A 5-turn roll on the next hit replaces what's left.
    vi.spyOn(Math, "random").mockReturnValue(0.4); // 0.4 < 50%, and 3 + floor(0.4 × 3) = 4 turns
    resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: { kind: "attack", skillName: "Jab" } });
    expect(activeOf(s.sides.A).statuses.find((x) => x.id === "poison")?.rounds).toBe(4 - 1); // (one tick already)
  });

  it("Toxic Skin ignores ranged and magic hits", () => {
    const archer = buildFighter(CREATURE_BY_ID.sylvaran, { ranged: 40, hp: 900 }, undefined, ["Piercing Shot"]);
    const s = createBattle([archer], [wall("toxic_skin")]);
    vi.spyOn(Math, "random").mockReturnValue(0);
    resolveRound(s, { A: { kind: "attack", skillName: "Piercing Shot" }, B: { kind: "attack", skillName: "Jab" } });
    expect(activeOf(s.sides.A).statuses.some((x) => x.id === "poison")).toBe(false);
  });

  it("Haunting Presence: the first creature out can strike fear, and the foe loses its attack (no energy spent)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const s = createBattle([wall("haunting_presence")], [brute()]);
    expect(activeOf(s.sides.B).statuses.some((x) => x.id === "fear")).toBe(true);
    resolveRound(s, { A: { kind: "attack", skillName: "Jab" }, B: { kind: "attack", skillName: "Crush" } });
    expect(attacks(s.log, "B")).toHaveLength(0);
    expect(activeOf(s.sides.B).energy).toBe(100);
    expect(activeOf(s.sides.B).statuses.some((x) => x.id === "fear")).toBe(false); // used up
  });

  it("Haunting Presence: swapping it in can stop the attack coming that same turn", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // no fear at the start
    const s = createBattle([wall(), wall("haunting_presence")], [brute()]);
    expect(activeOf(s.sides.B).statuses).toEqual([]);
    vi.restoreAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0);
    resolveRound(s, { A: { kind: "swap", to: 1 }, B: { kind: "attack", skillName: "Crush" } });
    expect(attacks(s.log, "B")).toHaveLength(0);
    expect(s.log.some((e) => e.type === "effect" && e.kind === "fear")).toBe(true);
  });

  it("Haunting Presence fails 75% of the time", () => {
    let feared = 0;
    for (let i = 0; i < 2000; i++) if (activeOf(createBattle([wall("haunting_presence")], [brute()]).sides.B).statuses.length) feared++;
    expect(feared / 2000).toBeCloseTo(0.25, 1);
  });

  it("Unstoppable Force: can't be crippled", () => {
    const crippler = buildFighter(CREATURE_BY_ID.ironhide, { melee: 40, hp: 900 }, undefined, ["Cripple"]);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const plain = createBattle([crippler], [wall()]);
    resolveRound(plain, { A: { kind: "attack", skillName: "Cripple" }, B: { kind: "attack", skillName: "Jab" } });
    expect(isCrippled(activeOf(plain.sides.B))).toBe(true);
    const s = createBattle([crippler], [wall("unstoppable_force")]);
    resolveRound(s, { A: { kind: "attack", skillName: "Cripple" }, B: { kind: "attack", skillName: "Jab" } });
    expect(isCrippled(activeOf(s.sides.B))).toBe(false);
  });

  it("Perfectionist: each use of the same move in a row hits 10% harder, and a new move starts again", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // no precise hits, no damage spread
    const run = (stone?: SoulStoneKey) => {
      const s = createBattle([brute(stone)], [wall()]);
      for (let i = 0; i < 4; i++) resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: { kind: "attack", skillName: "Jab" } });
      resolveRound(s, { A: { kind: "attack", skillName: "Crush" }, B: { kind: "attack", skillName: "Jab" } });
      return attacks(s.log, "A").map((e) => e.damage);
    };
    const plain = run(), perfect = run("perfectionist");
    for (let i = 0; i < 4; i++) expect(perfect[i]).toBe(Math.round(plain[i] * (1 + PERFECTIONIST_STEP) ** i));
    expect(perfect[4]).toBe(plain[4]); // Crush: a new run
  });

  it("Trickster: its utility move goes before a faster attacker", () => {
    const slow = with_(buildFighter(CREATURE_BY_ID.void_serpent, { hp: 900, agility: 0 }, undefined, ["Mirage", "Slash"]), "trickster");
    const fast = brute(undefined, 200);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const s = createBattle([slow], [fast]);
    resolveRound(s, { A: { kind: "attack", skillName: "Mirage" }, B: { kind: "attack", skillName: "Slash" } });
    const order = s.log.flatMap((e) => ((e.type === "effect" && e.kind === "self") || e.type === "attack" ? [e.side] : []));
    expect(order).toEqual(["A", "B"]);
    // Without the stone, the faster one goes first.
    const s2 = createBattle([{ ...slow, soulStone: undefined }], [fast]);
    resolveRound(s2, { A: { kind: "attack", skillName: "Mirage" }, B: { kind: "attack", skillName: "Slash" } });
    expect(s2.log.flatMap((e) => ((e.type === "effect" && e.kind === "self") || e.type === "attack" ? [e.side] : []))).toEqual(["B", "A"]);
  });

  it("Revitalise: swapped out to the bench, it heals 25% of its max HP", () => {
    const healer = wall("revitalise");
    const s = createBattle([healer, wall()], [wall()]);
    s.sides.A.team[0].hp = 10;
    resolveRound(s, { A: { kind: "swap", to: 1 }, B: { kind: "attack", skillName: "Jab" } });
    expect(s.sides.A.team[0].hp).toBe(10 + Math.round(healer.maxHp * REVITALISE_HEAL));
    expect(s.log.some((e) => e.type === "effect" && e.kind === "ability")).toBe(true);
  });
});

import { starterCreature } from "../lib/creatures/starter";
import { setKlutzStone, KLUTZ_STONES, type KlutzState } from "../lib/klutz";
describe("the starter's and Klutz's soul stones", () => {
  it("the starter always has a soul stone from its species pool", () => {
    for (let i = 0; i < 200; i++) {
      const s = starterCreature() as { creatureId?: string; soulStone?: string | null };
      expect(stonesFor(s.creatureId!)).toContain(s.soulStone);
    }
  });
  it("you can give Klutz one of his stones, change it or take it off", () => {
    let k: KlutzState = {};
    k = setKlutzStone(k, "perfectionist");
    expect(k.soulStone).toBe("perfectionist");
    k = setKlutzStone(k, "toxic_skin");
    expect(k.soulStone).toBe("toxic_skin");
    expect(setKlutzStone(k, null).soulStone).toBeUndefined();
  });
  it("only stones that do something for him, and not while he's out hunting", () => {
    expect(KLUTZ_STONES).not.toContain("revitalise");
    expect(KLUTZ_STONES).not.toContain("trickster");
    expect(setKlutzStone({}, "revitalise").soulStone).toBeUndefined();
    const out = { expedition: { endsAt: 2000, collected: false } } as unknown as KlutzState;
    expect(setKlutzStone(out, "perfectionist", 1000).soulStone).toBeUndefined();
    expect(setKlutzStone(out, "perfectionist", 3000).soulStone).toBe("perfectionist");
  });
});

import { SOUL_STONE_KEYS, SOUL_STONE_REPLACE_COST, setStoneIn } from "../lib/creatures/soulStones";
import { soulStoneDrop } from "../lib/drops";
import { bossSoulStone, CYCLOPS_SOUL_STONE, WARDEN_SOUL_STONE } from "../lib/dungeon/run";
import type { Drop } from "../lib/types";
describe("loose soul stones", () => {
  const creature = (soulStone: SoulStoneKey | null) => ({ ...makeCreatureDrop(CREATURE_BY_ID.bellow_toad, "creature", ""), soulStone }) as Drop;

  it("a found stone is one particular stone", () => {
    const d = soulStoneDrop("trickster");
    expect(d).toMatchObject({ dropType: "item", itemCategory: "consumable", stone: "trickster", name: "Soul Stone: Trickster" });
  });

  it("goes into an empty slot free, on any creature (a Common too), and is used up", () => {
    const c = creature(null), s = soulStoneDrop("perfectionist");
    const done = setStoneIn([c, s], c.id, s.id, 0)!;
    expect(done.cost).toBe(0);
    expect(done.inventory).toHaveLength(1);
    expect(done.inventory[0]).toMatchObject({ id: c.id, soulStone: "perfectionist" });
  });

  it("replacing a stone costs 5,000 gold and the old one is gone", () => {
    const c = creature("toxic_skin"), s = soulStoneDrop("revitalise");
    expect(setStoneIn([c, s], c.id, s.id, SOUL_STONE_REPLACE_COST - 1)).toBeNull();
    const done = setStoneIn([c, s], c.id, s.id, SOUL_STONE_REPLACE_COST)!;
    expect(done.cost).toBe(5000);
    expect(done.inventory).toEqual([{ ...c, soulStone: "revitalise" }]);
  });

  it("only into a creature (not a card), only with a stone", () => {
    const card = { ...creature(null), dropType: "card" } as Drop, s = soulStoneDrop("trickster");
    expect(setStoneIn([card, s], card.id, s.id, 1e9)).toBeNull();
    const c = creature(null);
    expect(setStoneIn([c, card], c.id, card.id, 1e9)).toBeNull();
  });

  it("boss chests: the Cyclops 2%, the Warden 5%, any of the six", () => {
    expect([CYCLOPS_SOUL_STONE, WARDEN_SOUL_STONE]).toEqual([0.02, 0.05]);
    expect(bossSoulStone(true, () => 0.019)).toHaveLength(1);
    expect(bossSoulStone(true, () => 0.02)).toHaveLength(0);
    expect(bossSoulStone(false, () => 0.049)).toHaveLength(1);
    expect(bossSoulStone(false, () => 0.05)).toHaveLength(0);
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) for (const x of bossSoulStone(false, Math.random)) if ("gear" in x && x.gear.dropType === "item") seen.add(x.gear.stone!);
    expect(seen.size).toBeGreaterThan(0);
    expect([...seen].every((k) => SOUL_STONE_KEYS.includes(k as SoulStoneKey))).toBe(true);
  });
});
