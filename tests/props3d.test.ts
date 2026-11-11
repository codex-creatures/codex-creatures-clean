import { describe, it, expect } from "vitest";
import { bookcaseArt, BOOKCASE_FACES, sackOutline, SACK_TALL, SACK_NECK } from "../lib/render3d/props3d";
import { ART_PER_U } from "../lib/render3d/chest3d";

describe("the 3D bookcase and sack drafts", () => {
  it("the bookcase's box comes from its pictures, about 2 units tall (as tall as you look on screen)", () => {
    const b = bookcaseArt();
    expect(b.width * ART_PER_U).toBeCloseTo(BOOKCASE_FACES.front.w, 6);
    expect(Math.abs(b.depth * ART_PER_U - BOOKCASE_FACES.side.w)).toBeLessThan(0.5); // (its sides as deep as its top)
    expect(BOOKCASE_FACES.side.h).toBe(BOOKCASE_FACES.front.h);
    expect(b.height).toBeCloseTo(2, 6);
    expect(b.width * ART_PER_U).toBeCloseTo(BOOKCASE_FACES.top.w, 6);
  });
  it("the sack is closed top and bottom, as tall as the object, narrowest at the tie", () => {
    const o = sackOutline();
    expect(o[0][0]).toBe(0);
    expect(o[o.length - 1][0]).toBe(0);
    expect(Math.max(...o.map(([, y]) => y))).toBeCloseTo(SACK_TALL, 6);
    expect(o.every(([, y]) => y >= 0)).toBe(true);
    const tie = o.find(([, y]) => y === SACK_NECK.y)!;
    expect(tie[0]).toBeLessThan(Math.max(...o.map(([r]) => r)) / 3);
  });
});

describe("the 3D props in the dungeon", () => {
  it("every chest (the rickety and loot ones too), the sacks and the bookcases go 3D", async () => {
    const { prop3dOf } = await import("../lib/render3d/props3d");
    expect(["chest", "rickety-chest", "loot-chest", "sack", "loot-sack", "bookcase"].map(prop3dOf)).toEqual(["chest", "chest", "chest", "stash", "stash", "bookcase"]);
    expect(["pool", "cage"].map(prop3dOf)).toEqual([undefined, undefined]);
  });
  it("each stands where its thing stands: already its footprint's middle (the 3D view draws it there, unmoved)", async () => {
    const { placementsFrom } = await import("../lib/world/placements");
    const { objectDef } = await import("../lib/world/objects");
    const { footprintCells, subcellCentre } = await import("../lib/world/grid");
    for (const def of ["chest", "sack", "bookcase", "table"]) {
      const f = objectDef(def).footprint, i = { id: "r:x", def, room: "r", sx: 12, sy: 22, size: f };
      const s = placementsFrom([i], { layout: { rooms: {} } as never, v: 12 }).spot("r:x")!;
      const cells = footprintCells(i, f);
      const mid = (k: "sx" | "sy") => cells.reduce((n, c) => n + subcellCentre(c[k]), 0) / cells.length;
      expect(s.x).toBeCloseTo(mid("sx"), 6);
      expect(s.y).toBeCloseTo(mid("sy"), 6);
    }
  });
  it("an opened sack is untied: open at the top, no higher than the tie's tuft", async () => {
    const { sackOpenOutline } = await import("../lib/render3d/props3d");
    const o = sackOpenOutline();
    expect(o[0][0]).toBe(0);
    expect(o[o.length - 1][0]).toBeGreaterThan(SACK_NECK.r);
    expect(Math.max(...o.map(([, y]) => y))).toBeLessThan(SACK_TALL);
  });
});

describe("the 3D table (world version 12)", () => {
  it("is as big as the chest (room for a candle and the deck), as high as the object says (a candle on it stands there), and a cards room's deck is drawn on one", async () => {
    const { tableArt, prop3dOf } = await import("../lib/render3d/props3d");
    const { objectDef, TABLE_TOP } = await import("../lib/world/objects");
    const { chestArt } = await import("../lib/render3d/chest3d");
    const t = tableArt(), c = chestArt();
    expect(t.top).toBeCloseTo(TABLE_TOP, 2);
    expect(objectDef("table").height).toBe(TABLE_TOP);
    expect(objectDef("table").footprint).toEqual(objectDef("chest").footprint);
    expect(t.width).toBeCloseTo(c.width, 6);
    expect(t.depth).toBeCloseTo(c.depth, 6);
    // The deck to one side, a candle to the other, both on the top.
    const { DECK_AT, CANDLE_AT } = await import("../lib/render3d/props3d");
    expect(DECK_AT + t.deck.width / 2).toBeLessThan(t.width / 2);
    expect(t.deck.depth).toBeLessThan(t.depth);
    expect(Math.sign(CANDLE_AT)).toBe(-Math.sign(DECK_AT));
    expect(Math.abs(CANDLE_AT)).toBeLessThan(t.width / 2 - 0.1);
    expect(["table", "card-deck"].map(prop3dOf)).toEqual(["table", "table"]);
  });
});

describe("a library's bookcases (the user, 2026-11-11: some broken, for variety)", () => {
  it("about half are broken, each the same every time (by its id)", async () => {
    const { bookcaseBroken } = await import("../lib/render3d/props3d");
    const { bookcaseOf } = await import("../lib/dungeon/walkRun");
    const ids = Array.from({ length: 40 }, (_, r) => Array.from({ length: 5 }, (_, i) => bookcaseOf(`n${r}`, i))).flat();
    const broken = ids.filter(bookcaseBroken).length;
    expect(broken).toBeGreaterThan(ids.length * 0.3);
    expect(broken).toBeLessThan(ids.length * 0.7);
    expect(ids.map(bookcaseBroken)).toEqual(ids.map(bookcaseBroken));
  });
});
