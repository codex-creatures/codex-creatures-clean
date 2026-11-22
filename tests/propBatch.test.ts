// tests/propBatch.test.ts: a recipe prop's faces gathered into a few drawings (lib/props/batch.ts), so the Den,
// which is made of them, isn't thousands of separate drawings a frame (docs/polish-audit-2026-11.md).
import { describe, expect, it } from "vitest";
import { readRecipe, partFaces, type FacePoly, type Recipe, type RecipeSpec } from "@/lib/props/recipe";
import { batchFaces, DEN_RECIPES } from "@/lib/props/batch";
import { RECIPE_FILES } from "@/lib/props/recipes";

const VIEW = { pitch: Math.PI / 3, stretch: 2 };
const STONE = { src: "/sprites/den3d/parts/pit-stone.png", crop: [0, 0, 48, 24] };
const WOOD = { src: "/sprites/den3d/parts/stone-blocks.png", crop: [8, 4, 16, 12], fit: "fill" };
const read = (parts: unknown[]): Recipe => {
  const r = readRecipe({ format: 1, id: "test", name: "Test", setting: "den", parts } as RecipeSpec);
  if (!r.ok) throw new Error(r.errors.join("; "));
  return r.recipe;
};
const facesOf = (r: Recipe): FacePoly[] => r.parts.flatMap((p) => partFaces(p, VIEW));
const grey = (): [number, number, number] => [0.5, 0.25, 1];
const corners = (f: FacePoly) => (f.points.length - 2) * 3; // (a fan of triangles)

describe("a prop's faces, gathered", () => {
  it("draws every still face once: the same triangles, in as many drawings as there are pictures and kinds", () => {
    const faces = facesOf(read([
      { id: "a", kind: "box", at: [0, 0, 0], size: [1, 1, 1], faces: { "*": STONE } },
      { id: "b", kind: "box", at: [2, 0, 0], size: [1, 1, 1], faces: { "*": STONE, top: WOOD } },
      { id: "c", kind: "cylinder", at: [4, 0, 0], size: [1, 1, 1], sides: 8, faces: { "*": { colour: "#804020" } } },
    ]));
    const { batches, alone } = batchFaces(faces, { lit: true, colourOf: grey });
    expect(alone).toEqual([]);
    expect(batches.map((b) => b.src)).toEqual([STONE.src, WOOD.src, null]); // (in the order they're first met)
    expect(batches.reduce((n, b) => n + b.faces, 0)).toBe(faces.length);
    for (const b of batches) {
      const n = b.position.length / 3;
      expect([b.normal.length / 3, b.uv.length / 2, b.colour.length / 3, b.crop.length / 4, b.tile.length]).toEqual([n, n, n, n, n]);
    }
    expect(batches.reduce((n, b) => n + b.position.length / 3, 0)).toBe(faces.reduce((n, f) => n + corners(f), 0));
  });

  it("carries each face's own crop, and whether it repeats, on its corners", () => {
    const faces = facesOf(read([{ id: "b", kind: "panel", at: [0, 0, 0], size: [1, 1], faces: { front: STONE, back: { ...STONE, crop: [8, 4, 16, 12], fit: "fill" } } }]));
    const { batches: [b] } = batchFaces(faces, { lit: false, colourOf: grey });
    expect(b.faces).toBe(2);
    expect([...b.crop.slice(0, 4)]).toEqual([0, 0, 48, 24]);
    expect([...b.crop.slice(-4)]).toEqual([8, 4, 16, 12]);
    expect([b.tile[0], b.tile[b.tile.length - 1]]).toEqual([1, 0]);
  });

  it("gives each corner its face's own colour: times its band of light when it's drawn flat, as it is when lights shade it", () => {
    const faces = facesOf(read([{ id: "a", kind: "box", at: [0, 0, 0], size: [1, 1, 1], light: "toon", faces: { "*": STONE } }]));
    const dark = faces.find((f) => f.shade < 1)!, at = faces.slice(0, faces.indexOf(dark)).reduce((n, f) => n + corners(f), 0) * 3;
    const flat = batchFaces(faces, { lit: false, colourOf: grey }).batches[0], lit = batchFaces(faces, { lit: true, colourOf: grey }).batches[0];
    expect(flat.colour[at]).toBeCloseTo(0.5 * dark.shade, 6);
    expect(flat.colour[at + 2]).toBeCloseTo(dark.shade, 6);
    expect([...lit.colour.slice(at, at + 3)]).toEqual([0.5, 0.25, 1]);
  });

  it("keeps apart what can't be drawn as one: outlines and insides (inside out), flat panels (both sides), glowing parts (never lit)", () => {
    const faces = facesOf(read([
      { id: "a", kind: "box", at: [0, 0, 0], size: [1, 1, 1], outline: true, faces: { "*": STONE } },
      { id: "p", kind: "panel", at: [2, 0, 0], size: [1, 1], faces: { "*": STONE } },
      { id: "g", kind: "box", at: [4, 0, 0], size: [1, 1, 1], glow: true, faces: { "*": STONE } },
      { id: "i", kind: "cylinder", at: [6, 0, 0], size: [1, 1, 1], inside: true, faces: { side: STONE } },
    ]));
    const { batches } = batchFaces(faces, { lit: true, colourOf: grey });
    expect(batches.map((b) => `${b.src ? "stone" : "colour"}/${b.side}/${b.plain ? "plain" : "lit"}`)).toEqual(
      ["stone/front/lit", "colour/back/plain", "stone/double/lit", "stone/front/plain", "stone/back/lit"]);
  });

  it("leaves a face that moves (a swirl, a ripple) to be drawn on its own", () => {
    const faces = facesOf(read([{ id: "a", kind: "box", at: [0, 0, 0], size: [1, 1, 1], faces: { "*": STONE, top: { colour: "#17b69c", anim: "swirl" } } }]));
    const { batches, alone } = batchFaces(faces, { lit: true, colourOf: grey });
    expect(alone.map((f) => f.face)).toEqual(["top"]);
    expect(batches.reduce((n, b) => n + b.faces, 0)).toBe(faces.length - 1);
  });
});

describe("the Den's props", () => {
  it("are a few drawings each, not one a face (thousands, every frame, on a phone)", () => {
    let faces = 0, drawings = 0;
    for (const id of DEN_RECIPES) {
      const r = readRecipe(RECIPE_FILES[id]);
      if (!r.ok) throw new Error(`${id}: ${r.errors.join("; ")}`);
      const all = facesOf(r.recipe), { batches, alone } = batchFaces(all, { lit: true, colourOf: grey });
      faces += all.length; drawings += batches.length + alone.length;
      expect(batches.length + alone.length, id).toBeLessThanOrEqual(16);
    }
    expect(faces).toBeGreaterThan(2000); // (what was drawn one by one)
    expect(drawings).toBeLessThanOrEqual(150);
  });
});
