import { describe, it, expect } from "vitest";
import { rollMap, depths, routeLength, knownRooms, inSight, waysOn, LARGE_FROM, FLARE_RADIUS, SIGHT_RADIUS } from "../lib/dungeon/map";
import {
  DUNGEONS, makeRoom, hasFight, canMoveOn, startRun, enemyFighter, rollWares, codexPrice, minibossExtras,
  MERCHANT_SLOTS, ENCAMP_DRUNK_HP, LIBRARY_BOOKS, LARGE_MIX, CAGE_PLAN_CHANCE, type DungeonRun,
} from "../lib/dungeon/run";
import { SCHEMATICS, cageSize } from "../lib/items/materials";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";

const LARGE = LARGE_MIX.map(([k]) => k);

describe("large rooms", () => {
  it("the Labyrinth has one, the Deep Labyrinth two (of different kinds), well inside", () => {
    for (const d of [1, 2] as const) {
      for (let i = 0; i < 40; i++) {
        const map = rollMap(false, Math.random, DUNGEONS[d].spec);
        expect(routeLength(map)).toBe(15);
        const large = Object.values(map.nodes).filter((n) => n.large);
        expect(large).toHaveLength(d);
        expect(new Set(large.map((n) => n.kind)).size).toBe(d);
        const depth = depths(map);
        for (const n of large) {
          expect(LARGE).toContain(n.kind);
          expect(depth.get(n.id)!).toBeGreaterThanOrEqual(LARGE_FROM); // room 5 at the earliest
          expect(!!n.known).toBe(!n.mystery); // either marked from the start, or a "?"
        }
      }
    }
  });

  it("encampments: Rares (×3 HP when drunk), 1–3 cages; an ambush is two, hidden until a cage is opened", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const r = makeRoom("encampment", Math.random, 8);
      seen.add(r.variant!);
      expect(r.cages!.length).toBeGreaterThanOrEqual(1);
      expect(r.cages!.length).toBeLessThanOrEqual(3);
      for (const e of r.enemies!) expect(CREATURE_BY_ID[e.creatureId].rarity).toBe("rare");
      if (r.variant === "ambush") {
        expect(r.enemies).toHaveLength(2);
        expect(hasFight(r)).toBe(false);
        expect(hasFight({ ...r, sprung: true })).toBe(true);
      } else expect(hasFight(r)).toBe(true);
      if (r.variant === "drunk") {
        const e = r.enemies![0];
        const plain = buildFighter(CREATURE_BY_ID[e.creatureId]);
        expect(enemyFighter(e).maxHp).toBeGreaterThan(enemyFighter({ ...e, hpMult: undefined }).maxHp * (ENCAMP_DRUNK_HP - 0.1));
        expect(enemyFighter(e).hpMult).toBe(ENCAMP_DRUNK_HP);
        expect(plain.hpMult).toBeUndefined();
      }
    }
    expect(seen.size).toBe(4);
  });

  it("libraries: codexes to find, or a librarian with 5 books", () => {
    let found = 0, librarians = 0;
    for (let i = 0; i < 400; i++) {
      const r = makeRoom("library");
      if (r.librarian) {
        librarians++;
        expect(r.offers).toHaveLength(LIBRARY_BOOKS);
        expect(new Set(r.offers).size).toBe(LIBRARY_BOOKS);
        for (const m of r.offers!) expect(codexPrice(m)).toBeGreaterThan(0);
      } else {
        found++;
        expect(r.sack!.length).toBeGreaterThanOrEqual(1);
        expect(r.sack!.length).toBeLessThanOrEqual(3);
      }
      expect(hasFight(r)).toBe(false);
    }
    expect(librarians / 400).toBeGreaterThan(0.17);
    expect(librarians / 400).toBeLessThan(0.33);
  });

  it("storehouses: mostly materials; sometimes a mini boss guards them", () => {
    let guarded = 0;
    for (let i = 0; i < 300; i++) {
      const r = makeRoom("storehouse", Math.random, 8);
      expect(r.sack!.some((x) => "gear" in x && x.gear.dropType === "item" && x.gear.material)).toBe(true);
      if (r.guarded) { guarded++; expect(hasFight(r)).toBe(true); expect(CREATURE_BY_ID[r.enemies![0].creatureId].rarity).toBe("rare"); }
    }
    expect(guarded / 300).toBeGreaterThan(0.25);
    expect(guarded / 300).toBeLessThan(0.45);
  });

  it("you can walk past a library, a storehouse or a quiet camp, but not a fight", () => {
    const run = startRun(["a"], ["a"], {}, 2) as DungeonRun;
    const at = (current: DungeonRun["current"]) => canMoveOn({ ...run, current });
    expect(at({ ...makeRoom("library"), done: false })).toBe(true);
    expect(at({ kind: "encampment", variant: "ambush", cages: [{}], enemies: [], done: false })).toBe(true);
    expect(at({ kind: "encampment", variant: "rigged", cages: [{}], enemies: [], done: false })).toBe(false);
    expect(at({ kind: "storehouse", guarded: true, enemies: [], done: false })).toBe(false);
  });
});

describe("the merchant and loot", () => {
  it("a merchant has up to 10 things: both potions and a flare, sometimes rare wares and scrolls, then every material", () => {
    let clair = 0;
    for (let i = 0; i < 500; i++) {
      const w = rollWares();
      expect(w.length).toBeLessThanOrEqual(MERCHANT_SLOTS);
      expect(new Set(w.map((x) => x.key)).size).toBe(w.length);
      const others = w.filter((x) => !("material" in x)).length;
      expect(w.length - others).toBe(Math.min(4, MERCHANT_SLOTS - others)); // materials fill what's left
      expect(w.map((x) => x.key)).toEqual(expect.arrayContaining(["potion", "lesser", "flare"]));
      if (w.some((x) => x.key === "clairvoyance")) clair++;
    }
    expect(clair / 500).toBeGreaterThan(0.32);
    expect(clair / 500).toBeLessThan(0.48);
  });

  it("a mini boss's chest has 1–2 potions", () => {
    for (let i = 0; i < 100; i++) {
      const n = minibossExtras().filter((x) => "potion" in x).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("a mini boss's chest holds the Iron Cage Schematic 20% of the time, until you've found it", () => {
    const plan = (cagePlan: boolean) => minibossExtras(Math.random, cagePlan).some((x) => "gear" in x && x.gear.dropType === "item" && x.gear.schematic === "iron_cage");
    let n = 0;
    for (let i = 0; i < 2000; i++) {
      if (plan(true)) n++;
      expect(plan(false)).toBe(false);
    }
    expect(Math.abs(n / 2000 - CAGE_PLAN_CHANCE)).toBeLessThan(0.03);
    expect([cageSize(1), cageSize(2), cageSize()]).toEqual([1, 3, 1]);
    expect(SCHEMATICS.iron_cage.cost).toEqual({ metal_bars: 10 });
  });
});

describe("flares and clairvoyance", () => {
  it("a lit spot reveals rooms around it; a clairvoyance look reveals even a mystery", () => {
    for (let i = 0; i < 30; i++) {
      const map = rollMap(false);
      const far = Object.values(map.nodes).find((n) => n.mystery && !inSight(map, map.start).has(n.id))!;
      expect(knownRooms(map, [map.start]).has(far.id)).toBe(false);
      const seen = knownRooms(map, [map.start], [far.id], [far.id]);
      expect(seen.has(far.id)).toBe(true);
      for (const id of inSight(map, far.id)) if (!map.nodes[id].mystery) expect(seen.has(id)).toBe(true);
      // A flare at the entrance lights the first step.
      const lit = knownRooms(map, [map.start], [map.start]);
      for (const n of waysOn(map, map.start)) if (!n.mystery && inSight(map, map.start).has(n.id)) expect(lit.has(n.id)).toBe(true);
    }
  });

  it("a flare lights twice as far as a torch; a clairvoyance look only a torch's worth", () => {
    expect(FLARE_RADIUS).toBe(SIGHT_RADIUS * 2);
    let further = 0;
    for (let i = 0; i < 30; i++) {
      const map = rollMap(false);
      const flared = knownRooms(map, [map.start], [map.start]);
      for (const id of inSight(map, map.start, FLARE_RADIUS)) if (!map.nodes[id].mystery) expect(flared.has(id)).toBe(true);
      // Past the torch, so only the flare shows it.
      const beyond = [...inSight(map, map.start, FLARE_RADIUS)].filter((id) => !inSight(map, map.start).has(id) && !map.nodes[id].mystery && !map.nodes[id].known);
      further += beyond.length;
      const looked = knownRooms(map, [map.start], [map.start], [map.start]);
      for (const id of beyond) expect(looked.has(id)).toBe(false);
    }
    expect(further).toBeGreaterThan(0);
  });
});
