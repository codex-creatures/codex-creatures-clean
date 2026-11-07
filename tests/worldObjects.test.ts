import { describe, expect, it } from "vitest";
import { OBJECTS, objectDef, artOf, DECOR_DEF, FOE_U, NPC_U } from "../lib/world/objects";
import { SIZE_CLASSES, SPECIES_SIZE, creatureSize } from "../lib/world/creatures";
import { walkView, legacySize, across } from "../lib/render/projection";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { SOLID_DECOR, type DecorKind } from "../lib/dungeon/decor";
import { WALK_CAGE, WALK_POOL, WALK_CAMPFIRE, WALK_CANDLE, WALK_DECOR, WALK_BANNER } from "../lib/sprites/walk";
import { TREASURE_CHEST, BURLAP_SACK, RICKETY_CHEST, CARD_DECK, MERCHANT, LIBRARIAN, CARD_WITCH } from "../lib/sprites/props";
import { CREATURE_SPRITES } from "../lib/sprites/creatures";
import { artFor } from "../lib/sprites/art";
import fs from "node:fs";
import path from "node:path";

// The object definitions (docs/world-spec.md §3) hold the walk screen's sizes
// and rules as they were on 2026-11-07 (components/WalkView.tsx's FOE_PX,
// NPC_PX, OBJECT_PX, SACK_PX, each prop's `size`, the solid things and the
// sort nudges): these are those numbers and sums, copied, against them.
const plan = layoutFloorplan(JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "walk", "encampment-mid.json"), "utf8")).walk.layout);
const FOE_PX = 22, NPC_PX = 26, OBJECT_PX = 28, SACK_PX = 16;

describe("object definitions (world-spec §3)", () => {
  it("about 25 of them, each with the four measurements and both halves", () => {
    const defs = Object.values(OBJECTS);
    expect(defs.length).toBeGreaterThanOrEqual(25);
    for (const d of defs) {
      expect(d.footprint.w >= 0 && d.footprint.d >= 0, d.id).toBe(true);
      expect(d.height, d.id).toBeGreaterThan(0);
      const b = d.visual.bounds;
      expect([b.left, b.right, b.up, b.down].every((n) => n >= 0 && Number.isFinite(n)), d.id).toBe(true);
      expect(d.visual.artPerU, d.id).toBeGreaterThan(0);
      // Nothing on a wall or walked over takes up floor.
      if (d.attach !== "floor") expect(d.footprint, d.id).toEqual({ w: 0, d: 0 });
    }
    expect(() => objectDef("nothing")).toThrow();
  });

  it("each is drawn exactly today's size, at any zoom", () => {
    const old: [string, string | undefined, (scale: number, a: { w: number; h: number }) => number][] = [
      ["chest", "shut", (s) => OBJECT_PX * s], ["rickety-chest", "open", (s) => OBJECT_PX * s], ["loot-chest", "shut", (s) => OBJECT_PX * s], ["card-deck", undefined, (s) => OBJECT_PX * s],
      ["sack", "shut", (s) => SACK_PX * s], ["loot-sack", "open", (s) => SACK_PX * s],
      ["merchant", undefined, (s, a) => (NPC_PX * s * a.w) / a.h], ["librarian", undefined, (s, a) => (NPC_PX * s * a.w) / a.h], ["witch", undefined, (s, a) => (NPC_PX * s * a.w) / a.h],
      ["pool", undefined, (s) => WALK_POOL.size * s], ["cage", "shut", (s) => WALK_CAGE.size * s], ["campfire", "lit", (s) => WALK_CAMPFIRE.size * s],
      ["candle", "lit", (s) => WALK_CANDLE.size * s], ["banner", undefined, (s) => WALK_BANNER.size * s],
      ...(Object.keys(DECOR_DEF) as DecorKind[]).map((k): [string, undefined, (s: number) => number] => [DECOR_DEF[k], undefined, (s) => WALK_DECOR[k].size * s]),
    ];
    const bad: string[] = [];
    for (const cw of [320, 375, 390, 412.5, 768, 1024]) {
      const v = walkView(plan, { x: 10, y: 10 }, cw, 693);
      for (const [id, state, was] of old) {
        const d = objectDef(id), a = artOf(d, state)!;
        const now = legacySize(v, d.visual.legacy, a), wd = was(v.scale, a), h2 = (wd * a.h) / a.w;
        if (!Object.is(now.wd, wd) || !Object.is(now.h2, h2)) bad.push(`${id} at ${cw}: ${now.wd}×${now.h2} vs ${wd}×${h2}`);
      }
      if (!Object.is(across(v, FOE_U), FOE_PX * v.scale) || !Object.is(across(v, NPC_U), NPC_PX * v.scale)) bad.push(`foe/npc at ${cw}`);
    }
    expect(bad).toEqual([]);
    // The art is the art the walk screen drew.
    expect(artOf(objectDef("chest"), "shut")!.src).toBe(artFor(TREASURE_CHEST)!.src);
    expect(artOf(objectDef("sack"), "shut")!.src).toBe(artFor(BURLAP_SACK)!.src);
    expect(artOf(objectDef("loot-chest"), "shut")!.src).toBe(artFor(RICKETY_CHEST)!.src);
    expect(artOf(objectDef("card-deck"))!.src).toBe(artFor(CARD_DECK)!.src);
    expect(artOf(objectDef("merchant"))!.src).toBe(artFor(MERCHANT)!.src);
    expect(artOf(objectDef("librarian"))!.src).toBe(artFor(LIBRARIAN)!.src);
    expect(artOf(objectDef("witch"))!.src).toBe(artFor(CARD_WITCH)!.src);
  });

  it("solid where the walk screen made them solid; the sort nudges as they were", () => {
    const solid = (id: string) => objectDef(id).collision === "solid";
    for (const id of ["chest", "sack", "rickety-chest", "card-deck", "pool", "cage", "merchant", "librarian", "campfire"]) expect(solid(id), id).toBe(true);
    for (const id of ["loot-sack", "loot-chest", "witch", "candle"]) expect(solid(id), id).toBe(false);
    for (const k of Object.keys(DECOR_DEF) as DecorKind[]) expect(solid(DECOR_DEF[k]), k).toBe(SOLID_DECOR.includes(k));
    expect(objectDef("sconce").visual.legacy.sortDy).toBe(-0.6);
    expect(objectDef("sconce-side").visual.legacy.sortDy).toBe(0.4);
    expect(objectDef("wall-south").visual.legacy.sortDy).toBe(-0.5);
    for (const k of ["skull", "nest", "pots"] as const) expect(objectDef(DECOR_DEF[k]).visual.legacy.sortDy, k).toBe(-0.6);
    for (const k of ["barrels", "crates", "pillar"] as const) expect(objectDef(DECOR_DEF[k]).visual.legacy.sortDy, k).toBeUndefined();
    // The pool sits 0.35 of its picture below its feet, a campfire 0.15, walked-over decor 0.3.
    expect(objectDef("pool").visual.legacy.lift).toBe(0.35);
    expect(objectDef("campfire").visual.legacy.lift).toBe(0.15);
    expect(objectDef("skull").visual.legacy.lift).toBe(0.3);
    // Only rock blocks sight and light today: the pillar (rock in the floorplan), the walls and rubble.
    const blocking = Object.values(OBJECTS).filter((d) => d.blocksSight || d.blocksLight).map((d) => d.id).sort();
    expect(blocking).toEqual(["pillar", "rubble", "wall-south"]);
  });

  it("bounds and anchor follow the art: the anchor at the feet, the picture round it", () => {
    const pool = objectDef("pool"), a = artOf(pool)!;
    const wide = pool.visual.legacy.width!;
    expect(pool.visual.bounds.left + pool.visual.bounds.right).toBeCloseTo(wide, 9);
    expect(pool.visual.bounds.up + pool.visual.bounds.down).toBeCloseTo((wide * a.h) / a.w, 9);
    expect(pool.visual.anchorPx.y).toBeCloseTo(a.h * 0.65, 9);
    expect(pool.visual.artPerU).toBeCloseTo(a.w / wide, 9);
  });
});

describe("creature size classes (world-spec §2)", () => {
  it("every species with art has a class or its own size, and the classes' footprints are as specified", () => {
    const missing = Object.keys(CREATURE_SPRITES).filter((id) => !id.startsWith("cyclops_") && !SPECIES_SIZE[id]);
    expect(missing).toEqual([]);
    expect(SIZE_CLASSES.large.footprint).toEqual({ w: 2, d: 2 });
    expect(SIZE_CLASSES.huge.footprint).toEqual({ w: 3, d: 3 });
    expect(creatureSize("cyclops")).toEqual({ w: 3, d: 3, height: 4 });
    expect(creatureSize("unknown_thing")).toEqual({ w: 1, d: 1, height: 1 });
  });
});
