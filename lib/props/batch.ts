// lib/props/batch.ts
// A prop's faces gathered into as few drawings as can be (components/PropRecipe3D.tsx draws them). A recipe's
// faces (./recipe.ts partFaces) were each drawn on their own: the Den's props came to some 3,500 drawings a
// frame, each with its own buffers and its own material, which a phone can't keep up with, and which took
// seconds to make each time you came home (docs/polish-audit-2026-11.md). Faces that share a picture and are
// drawn the same way go in one drawing here; what differed from face to face (its crop of the picture, whether
// the crop repeats, its own colour and band of light) rides on its corners. Pure: plain arrays, no Three.js.

import type { FacePoly } from "./recipe";

// Which way a face is seen: outlines and a hollow part's insides are drawn inside out, flat parts from both sides.
export type Side = "front" | "back" | "double";
export const sideOf = (f: FacePoly): Side => (f.hull || f.inside ? "back" : f.twoSided ? "double" : "front");
// Glowing faces and outlines: never lit, never tinted by the light where the prop stands.
export const isPlain = (f: FacePoly) => f.glow || !!f.hull;

// One drawing: every corner of its faces' triangles (each face a fan: it's flat and convex), three to a triangle.
export type FaceBatch = {
  key: string;
  src: string | null;     // the picture its faces are cut from (null: flat colours)
  side: Side;
  plain: boolean;
  faces: number;
  position: Float32Array; // 3 a corner
  normal: Float32Array;   // 3
  uv: Float32Array;       // 2: in crops (whole numbers are a crop's edges)
  colour: Float32Array;   // 3: the face's own colour, times its band of light when it's drawn flat
  crop: Float32Array;     // 4: the face's crop of the picture (pixels); a flat colour's is the whole of nothing
  tile: Float32Array;     // 1: 1 where the crop repeats, 0 where it's shown once
};

// The props the new Den stands (components/Den3DPlaces.tsx Place): what the test of how many drawings they come to counts.
export const DEN_RECIPES = ["shack", "storehouse", "tavern", "board", "altar", "pool", "pit", "training", "cage", "arch", "portal"];

// `lit`: the scene's lights shade the faces, so their own bands of light are left out (as when each was drawn alone).
// `colourOf`: a face's own colour (its flat colour, or white under a picture, times its tint), as the renderer counts colour.
// `alone`: the faces that move (a swirl, a ripple), each still drawn on its own.
export function batchFaces(faces: FacePoly[], o: { lit: boolean; colourOf: (f: FacePoly) => [number, number, number] }): { batches: FaceBatch[]; alone: FacePoly[] } {
  const groups = new Map<string, { src: string | null; side: Side; plain: boolean; faces: FacePoly[] }>(), alone: FacePoly[] = [];
  for (const f of faces) {
    if (f.art.anim) { alone.push(f); continue; }
    const src = f.art.kind === "art" ? f.art.src : null, side = sideOf(f), plain = isPlain(f), key = `${src ?? ""}|${side}|${plain ? "plain" : "lit"}`;
    const g = groups.get(key) ?? { src, side, plain, faces: [] };
    g.faces.push(f);
    groups.set(key, g);
  }
  const batches = [...groups.entries()].map(([key, g]): FaceBatch => {
    const n = g.faces.reduce((sum, f) => sum + (f.points.length - 2) * 3, 0);
    const b: FaceBatch = { key, src: g.src, side: g.side, plain: g.plain, faces: g.faces.length, position: new Float32Array(n * 3), normal: new Float32Array(n * 3),
      uv: new Float32Array(n * 2), colour: new Float32Array(n * 3), crop: new Float32Array(n * 4), tile: new Float32Array(n) };
    let at = 0;
    for (const f of g.faces) {
      const s = o.lit ? 1 : f.shade, [r, gr, bl] = o.colourOf(f);
      const crop = f.art.kind === "art" ? f.art.crop : [0, 0, 1, 1], tile = f.art.kind === "art" && f.art.fit === "tile" ? 1 : 0;
      for (let i = 1; i < f.points.length - 1; i++) for (const k of [0, i, i + 1]) {
        b.position.set(f.points[k], at * 3); b.normal.set(f.normal, at * 3); b.uv.set(f.uv[k], at * 2);
        b.colour.set([r * s, gr * s, bl * s], at * 3); b.crop.set(crop, at * 4); b.tile[at] = tile;
        at++;
      }
    }
    return b;
  });
  return { batches, alone };
}
