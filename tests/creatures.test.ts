import { describe, it, expect } from "vitest";
import { slowIt } from "./slow";
import { CREATURE_TEMPLATES, CREATURE_BY_ID, CREATURES_BY_RARITY, KLUTZ, LEARNABLE_MOVES, MOVE_SLOTS, RACES, defaultMoveNames } from "../lib/creatures/creatureData";
import { rollProficiency, rollMoves, rollSpread, RARE_MOVE_CHANCE, BORN_MOVES } from "../lib/creatures/creatureRoll";
import { creatureOrCard, makeCreatureDrop, summonFromCards, REAL_CREATURE_CHANCE } from "../lib/creatures/summon";
import { pickCreatureId } from "../lib/items/gameHelpers";
import { CREATURE_SPRITES, BACK_SPRITES, fightSprite, creatureArtSrc } from "../lib/sprites/creatures";
import { readFileSync } from "node:fs";
import { SPECIES_RACES } from "../lib/creatures/racesV2";
import { artFor, flipToFace } from "../lib/sprites/art";

const sum = (p: Record<string, number>) => Object.values(p).reduce((a, b) => a + b, 0);

describe("creature % rolls", () => {
  it("vary more for rarer creatures (more stats to work with)", () => {
    const spread = (id: string) => rollSpread(CREATURE_BY_ID[id].proficiency);
    expect(spread("moss_wolf")).toBe(2);
    expect(spread("ironhide")).toBeGreaterThan(spread("dustwraith"));
    expect(spread("dustwraith")).toBeGreaterThan(spread("moss_wolf"));
  });

  slowIt("keep the same total, stay within the spread for the species, and never go negative", () => {
    for (const c of CREATURE_TEMPLATES) {
      for (let i = 0; i < 300; i++) {
        const p = rollProficiency(c.proficiency);
        expect(sum(p)).toBe(sum(c.proficiency));
        for (const k of Object.keys(p) as (keyof typeof p)[]) {
          expect(Math.abs(p[k] - c.proficiency[k])).toBeLessThanOrEqual(rollSpread(c.proficiency));
          expect(p[k]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("starting moves: its 3, and now and then a rare (learnable) move in the empty 4th slot, never in place of one", () => {
    const rare = new Set(LEARNABLE_MOVES.map((m) => m.name));
    let rareSeen = 0;
    // (Not the species born knowing a signature move, BORN_MOVES: the Labyrinth Sprite's Mirage, in mythiclawMoves.test.ts.)
    const rolled = CREATURE_TEMPLATES.filter((c) => !BORN_MOVES[c.id]);
    for (const c of rolled) {
      for (let i = 0; i < 200; i++) {
        const moves = rollMoves(c);
        expect(moves.slice(0, 3)).toEqual(defaultMoveNames(c));
        expect(moves.length).toBeLessThanOrEqual(MOVE_SLOTS);
        expect(new Set(moves).size).toBe(moves.length);
        if (moves.length === MOVE_SLOTS) { expect(rare.has(moves[3])).toBe(true); rareSeen++; }
      }
    }
    const share = rareSeen / (rolled.length * 200);
    expect(share).toBeGreaterThan(RARE_MOVE_CHANCE - 0.03);
    expect(share).toBeLessThan(RARE_MOVE_CHANCE + 0.03);
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
  it("is a Rare helper that can't be found by scanning", () => {
    expect(KLUTZ.rarity).toBe("rare");
    expect(CREATURE_BY_ID.klutz).toBe(KLUTZ);
    expect(CREATURE_TEMPLATES).not.toContain(KLUTZ);
    expect(CREATURES_BY_RARITY.rare).not.toContain(KLUTZ);
    for (let i = 0; i < 2000; i++) expect(pickCreatureId("rare")).not.toBe("klutz");
  });
});

describe("races", () => {
  it("45 creatures: the 35 (7 of each rarity), the user's 9 picks of 2026-11-26 and the Labyrinth Sprite; each with one or two races", () => {
    const picks = new Set(["skinwing", "gutsnout", "grub_keeper", "mole_hag", "gloom_gnome", "cinder_husk", "troglodyte_brute", "gravewarden", "hexed_puppet", "labyrinth_sprite"]);
    expect(CREATURE_TEMPLATES).toHaveLength(RACES.length * 5 + picks.size);
    for (const r of ["common", "uncommon", "rare", "epic", "legendary"]) expect(CREATURE_TEMPLATES.filter((c) => c.rarity === r && !picks.has(c.id))).toHaveLength(RACES.length);
    for (const c of CREATURE_TEMPLATES) {
      expect(c.races?.length, c.id).toBeGreaterThanOrEqual(1);
      expect(c.races!.length, c.id).toBeLessThanOrEqual(2);
      expect(c.race, c.id).toBe(c.races![0]);
    }
  });

  it("scans only ever give scannable creatures", () => {
    const scannable = new Set(CREATURE_TEMPLATES.map((c) => c.id));
    for (const r of ["common", "uncommon", "rare", "epic", "legendary"] as const) {
      for (let i = 0; i < 500; i++) expect(scannable.has(pickCreatureId(r))).toBe(true);
    }
  });
});

describe("creature art", () => {
  it("every creature you can scan has its PixelLab art (none falls back to the egg)", () => {
    const scannable = Object.values(CREATURES_BY_RARITY).flat();
    expect(scannable.length).toBeGreaterThan(0);
    for (const t of scannable) expect(artFor(CREATURE_SPRITES[t.id]), t.id).toMatchObject({ src: creatureArtSrc(t.id) });
    // A redrawn one gets a new address, so phones that kept the old picture fetch the new one (the Mythiclaw, ex-Dire Wolf).
    expect(creatureArtSrc("dire_wolf")).toBe("/sprites/creatures/dire_wolf.png?v=2");
    expect(creatureArtSrc("moss_wolf")).toBe("/sprites/creatures/moss_wolf.png");
  });

  it("your creature shows its back in a fight when it has one, unmirrored; theirs and the rest show their usual art", () => {
    const ids = Object.keys(BACK_SPRITES);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const art = artFor(BACK_SPRITES[id]);
      expect(art!.src.split("?")[0], id).toBe(`/sprites/creatures/back/${id}.png`);
      // Its listed size is the picture's own (a PNG keeps its width and height at bytes 16 and 20).
      const png = readFileSync(`public/sprites/creatures/back/${id}.png`);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], id).toEqual([art!.w, art!.h]);
      expect(fightSprite(id, true), id).toBe(BACK_SPRITES[id]);
      expect(fightSprite(id, false), id).toBe(CREATURE_SPRITES[id]);
      expect(flipToFace(BACK_SPRITES[id], true), id).toBe(false);
    }
    expect(fightSprite("cyclops", true)).toBe(CREATURE_SPRITES.cyclops);
    // Every creature a player can own has its back view (redone 2026-11-27), Klutz too.
    expect([...Object.keys(SPECIES_RACES), "klutz"].filter((id) => !BACK_SPRITES[id])).toEqual([]);
    // A redrawn creature's back gets a new address too, so phones fetch it at once (the Mythiclaw's).
    expect(artFor(BACK_SPRITES.dire_wolf)!.src).toBe("/sprites/creatures/back/dire_wolf.png?v=2");
  });
});
