import { describe, it, expect } from "vitest";
import { texelsPerU, pixelScale, lightField, lightAt, lightCurve, seenField, shadeAt, SUB, CORE } from "../lib/render3d/stone";
import { ROCK, FLOOR, type Floorplan } from "../lib/dungeon/floorplan";

// The Stone experiment's rules (lib/render3d/stone.ts).
const plan = (rows: string[]): Floorplan => ({
  w: rows[0].length, h: rows.length, rooms: {}, doors: [], tunnels: {},
  tiles: Uint8Array.from(rows.join("").split("").map((c) => (c === "." ? FLOOR : ROCK))),
});
const all = (fp: Floorplan) => new Uint8Array(fp.w * fp.h).fill(1);
// The sample nearest a point, from a field.
const sample = (f: ReturnType<typeof lightField>, which: "torch" | "other", x: number, y: number) => {
  const n = f.size * SUB;
  return f[which][Math.floor((y - f.y0 + 0.5) * SUB) * n + Math.floor((x - f.x0 + 0.5) * SUB)];
};

describe("texelsPerU", () => {
  const p = Math.PI / 3;
  it("screen: floors laid sin(pitch) tighter up the screen, faces cos(pitch), so art pixels show square", () => {
    expect(texelsPerU("up", 32, p, "screen")).toEqual([32, 32 * Math.sin(p)]);
    expect(texelsPerU("face", 48, p, "screen")).toEqual([48, 48 * Math.cos(p)]);
  });
  it("world: square on the surface, whatever the camera", () => {
    expect(texelsPerU("face", 32, p, "world")).toEqual([32, 32]);
  });
});

describe("pixelScale", () => {
  it("art: density × across canvas pixels, blown up by however much fills the screen", () => {
    expect(pixelScale("art", 32, 15, 390, 3)).toEqual({ dpr: 480 / 390, across: 15, scale: 3 / (480 / 390) });
  });
  it("whole: blown up a whole number of times, the units across moving to fit (a 1170-pixel phone)", () => {
    const p = pixelScale("whole", 32, 15, 390, 3);
    expect(p.scale).toBe(2);
    expect(p.across).toBeCloseTo(1170 / 64);
    expect(pixelScale("whole", 48, 15, 390, 3)).toMatchObject({ scale: 2, dpr: 1.5 });
    expect(pixelScale("whole", 48, 15, 300, 1).scale).toBe(1); // (never less than one)
  });
  it("device: the screen's own pixels", () => {
    expect(pixelScale("device", 32, 15, 390, 3)).toEqual({ dpr: 3, across: 15, scale: 1 });
  });
});

describe("lightField", () => {
  // Two rooms with a wall of rock between them.
  const fp = plan([
    "#########",
    "#...#...#",
    "#...#...#",
    "#...#...#",
    "#########",
  ]);
  const torch = { x: 2, y: 2, r: 6, power: 1 };
  it("no light through solid rock, even where the sim says it's lit", () => {
    const f = lightField(fp, all(fp), torch, [], 2, 2, 16);
    expect(sample(f, "torch", 2, 2)).toBe(1);
    for (const [x, y] of [[5, 1], [6, 2], [7, 3]]) expect(sample(f, "torch", x, y)).toBe(0);
    expect(sample(f, "torch", 4, 2)).toBeGreaterThan(0); // (the wall itself, lit where the light hits it)
  });
  it("never lit where the sim says it isn't", () => {
    const lightNow = all(fp); lightNow[2 * fp.w + 3] = 0;
    const f = lightField(fp, lightNow, torch, [], 2, 2, 16);
    expect(sample(f, "torch", 3, 2)).toBe(0);
    expect(sample(f, "torch", 2, 3)).toBeGreaterThan(0);
  });
  it("keeps your torch apart from the other lights, and lights together never pass 1", () => {
    const f = lightField(fp, all(fp), null, [{ x: 6, y: 2, r: 3, power: 1 }, { x: 6, y: 2, r: 3, power: 0.6 }], 6, 2, 16);
    expect(f.torch.every((v) => v === 0)).toBe(true);
    expect(sample(f, "other", 6, 2)).toBe(1);
    expect(Math.max(...f.other)).toBeLessThanOrEqual(1);
    expect(lightAt(f, 6, 2)).toBe(1);
    expect(lightAt(f, 2, 2)).toBe(0);
  });
  it("tints a thing as the rock's shader lights the floor under it", () => {
    const S = { remember: 0.2, gain: 1.25, warm: [1, 0.8, 0.6] as const, flame: [1, 0.5, 0.25] as const };
    const mine = lightField(fp, all(fp), torch, [], 2, 2, 16), fire = lightField(fp, all(fp), null, [{ x: 6, y: 2, r: 3, power: 1 }], 6, 2, 16);
    // Full light is brighter than the art (gain, uncapped, as the floor), in the light's own colour.
    expect(shadeAt(mine, null, fp.w, 2, 2, S)).toEqual([1.45, 0.2 + 1.25 * 0.8, 0.2 + 1.25 * 0.6]);
    expect(shadeAt(fire, null, fp.w, 6, 2, S)[2]).toBeCloseTo(0.2 + 1.25 * 0.25);
    // Unlit, the plain dim you remember by; and dimmed with the floor where what you've seen fades out.
    expect(shadeAt(null, null, fp.w, 2, 2, S)).toEqual([0.2, 0.2, 0.2]);
    const fade = new Float32Array(fp.w * fp.h).fill(1); fade[2 * fp.w + 2] = 0.5;
    expect(shadeAt(null, fade, fp.w, 2.2, 1.8, S)).toEqual([0.1, 0.1, 0.1]);
  });
  it("the other lights can fall where you remember (othersOn), your torch only where the sim lights now", () => {
    const none = new Uint8Array(fp.w * fp.h), fire = { x: 6, y: 2, r: 3, power: 1 };
    const f = lightField(fp, none, { x: 6, y: 2, r: 3, power: 1 }, [fire], 6, 2, 16, undefined, all(fp));
    expect(sample(f, "other", 6, 2)).toBe(1);
    expect(sample(f, "torch", 6, 2)).toBe(0);
    expect(sample(f, "other", 2, 2)).toBe(0); // (still never through rock)
    expect(sample(lightField(fp, none, null, [fire], 6, 2, 16), "other", 6, 2)).toBe(0); // (without it, as the sim lights now)
  });
  it("reuses last frame's grid, cleared", () => {
    const a = lightField(fp, all(fp), torch, [], 2, 2, 16);
    const b = lightField(fp, all(fp), null, [], 6, 2, 16, a);
    expect(b).toBe(a);
    expect(b.torch.every((v) => v === 0)).toBe(true);
    expect(b.x0).toBe(6 - 8);
  });
  it("a lit core, then falling off to nothing at its reach", () => {
    expect(lightCurve(0, 5)).toBe(1);
    expect(lightCurve(5 * CORE, 5)).toBe(1);
    expect(lightCurve(4, 5)).toBeLessThan(lightCurve(3, 5));
    expect(lightCurve(5, 5)).toBe(0);
  });
});

describe("seenField", () => {
  const fp = plan(["#######", "#.....#", "#######"]);
  const known = new Uint8Array(fp.w * fp.h);
  for (const x of [1, 2, 3]) known[fp.w + x] = 1; // seen the room's west half
  it("black stays black: the fade dims only what shows", () => {
    const { shown, fade } = seenField(fp, known, "black");
    for (let i = 0; i < shown.length; i++) if (!shown[i]) expect(fade[i]).toBe(0);
    expect(shown[fp.w + 5]).toBe(0);
    expect(fade[fp.w + 3]).toBeGreaterThan(0);
  });
  it("fades towards the unexplored", () => {
    const wide = plan(["#########", "#.......#", "#.......#", "#.......#", "#########"]);
    const k = new Uint8Array(wide.w * wide.h);
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 5; x++) k[y * wide.w + x] = 1;
    const { fade } = seenField(wide, k, "black");
    expect(fade[2 * wide.w + 5]).toBeLessThan(fade[2 * wide.w + 4]);
    expect(fade[2 * wide.w + 3]).toBe(1);
  });
  it("no fade: what shows, shows fully", () => {
    const { shown, fade } = seenField(fp, known, "black", 0);
    expect(Array.from(fade)).toEqual(Array.from(shown));
  });
  it("as rock: floor you haven't found shows beside floor you have, as rock would", () => {
    const black = seenField(fp, known, "black", 0), rock = seenField(fp, known, "rock", 0);
    expect(black.shown[fp.w + 4]).toBe(0);
    expect(rock.shown[fp.w + 4]).toBe(1);
    expect(rock.shown[fp.w + 5]).toBe(0);
  });
});
