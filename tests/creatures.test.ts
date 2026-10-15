import { describe, it, expect } from "vitest";
import { CREATURE_TEMPLATES, CREATURE_BY_ID, CREATURES_BY_RARITY, KLUTZ, LEARNABLE_MOVES, MOVE_SLOTS, RACES, RETIRED_CREATURES } from "../lib/creatures/creatureData";
import { rollProficiency, rollMoves, ROLL_SPREAD } from "../lib/creatures/creatureRoll";
import { creatureOrCard, makeCreatureDrop, summonFromCards, REAL_CREATURE_CHANCE } from "../lib/creatures/summon";
import { pickCreatureId } from "../lib/items/gameHelpers";

const sum = (p: Record<string, number>) => Object.values(p).reduce((a, b) => a + b, 0);

describe("creature % rolls", () => {
  it("keep the same total, stay within ±2 of the species, and never go negative", () => {
    for (const c of CREATURE_TEMPLATES) {
      for (let i = 0; i < 300; i++) {
        const p = rollProficiency(c.proficiency);
        expect(sum(p)).toBe(sum(c.proficiency));
        for (const k of Object.keys(p) as (keyof typeof p)[]) {
          expect(Math.abs(p[k] - c.proficiency[k])).toBeLessThanOrEqual(ROLL_SPREAD);
          expect(p[k]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("starting moves: up to 4 distinct moves, from the species or the rare (learnable) list", () => {
    const rare = new Set(LEARNABLE_MOVES.map((m) => m.name));
    let rareSeen = 0;
    for (const c of CREATURE_TEMPLATES) {
      const own = new Set(c.skills.map((s) => s.name));
      for (let i = 0; i < 200; i++) {
        const moves = rollMoves(c);
        expect(moves.length).toBeLessThanOrEqual(MOVE_SLOTS);
        expect(new Set(moves).size).toBe(moves.length);
        for (const m of moves) expect(own.has(m) || rare.has(m)).toBe(true);
        if (moves.some((m) => rare.has(m))) rareSeen++;
      }
    }
    const share = rareSeen / (CREATURE_TEMPLATES.length * 200);
    expect(share).toBeGreaterThan(0.2); // ~1 - 0.9^4 ≈ 34%
    expect(share).toBeLessThan(0.5);
  });
});

describe("cards and summoning", () => {
  const t = CREATURE_BY_ID.dire_wolf;
  const cards = () => [0, 1, 2].map(() => makeCreatureDrop(t, "card", "123456"));

  it("about 10% of creature barcodes give the real creature, the rest a card", () => {
    let real = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (creatureOrCard(t, "123456").dropType === "creature") real++;
    expect(real / N).toBeGreaterThan(REAL_CREATURE_CHANCE - 0.01);
    expect(real / N).toBeLessThan(REAL_CREATURE_CHANCE + 0.01);
  });

  it("'choose' summons exactly the kept card — same %s and moves, no new roll", () => {
    const cs = cards();
    const made = summonFromCards(cs, cs[1].id);
    expect(made.dropType).toBe("creature");
    expect(made.proficiency).toEqual(cs[1].proficiency);
    expect(made.moves).toEqual(cs[1].moves);
  });

  it("'random' summons a fresh roll of the same creature", () => {
    const made = summonFromCards(cards(), null);
    expect(made.creatureId).toBe("dire_wolf");
    expect(sum(made.proficiency!)).toBe(sum(t.proficiency));
  });

  it("needs exactly 3 cards of the same creature", () => {
    const cs = cards();
    expect(() => summonFromCards(cs.slice(0, 2), null)).toThrow();
    expect(() => summonFromCards([...cs.slice(0, 2), makeCreatureDrop(CREATURE_BY_ID.cave_bat, "card", "1")], null)).toThrow();
    expect(() => summonFromCards([...cs.slice(0, 2), makeCreatureDrop(t, "creature", "1")], null)).toThrow();
  });
});

describe("Klutz", () => {
  it("is an Uncommon helper that can't be found by scanning", () => {
    expect(KLUTZ.rarity).toBe("uncommon");
    expect(CREATURE_BY_ID.klutz).toBe(KLUTZ);
    expect(CREATURE_TEMPLATES).not.toContain(KLUTZ);
    expect(CREATURES_BY_RARITY.uncommon).not.toContain(KLUTZ);
    for (let i = 0; i < 2000; i++) expect(pickCreatureId("uncommon")).not.toBe("klutz");
  });
});

describe("races", () => {
  it("every race has exactly one creature of each rarity", () => {
    expect(CREATURE_TEMPLATES).toHaveLength(RACES.length * 5);
    for (const race of RACES) {
      const mine = CREATURE_TEMPLATES.filter((c) => c.race === race).map((c) => c.rarity).sort();
      expect(mine).toEqual(["common", "epic", "legendary", "rare", "uncommon"]);
    }
  });

  it("retired creatures still load from old saves but never come from scans", () => {
    for (const c of RETIRED_CREATURES) {
      expect(CREATURE_BY_ID[c.id]).toBe(c);
      expect(CREATURE_TEMPLATES).not.toContain(c);
    }
    const scannable = new Set(CREATURE_TEMPLATES.map((c) => c.id));
    for (const r of ["common", "uncommon", "rare", "epic", "legendary"] as const) {
      for (let i = 0; i < 500; i++) expect(scannable.has(pickCreatureId(r))).toBe(true);
    }
  });
});
