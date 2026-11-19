// lib/props/recipes/load.ts
// The game's way to a prop recipe (world/art-pipeline.md §6.6): each read once (readRecipe) and kept; null when it
// won't read, so whoever draws it falls back to the drawing it had before and a bad file can't break a room.

import { readRecipe, rotate, type Recipe, type Vec3 } from "../recipe";
import { RECIPE_FILES } from "./index";

const READ = new Map<string, Recipe | null>();
export function recipeOf(id: string): Recipe | null {
  if (!READ.has(id)) {
    const r = RECIPE_FILES[id] === undefined ? null : readRecipe(RECIPE_FILES[id]);
    READ.set(id, r && r.ok ? r.recipe : null);
  }
  return READ.get(id)!;
}

// The cage opened (a camp's, once you've let its creature out: the user, 2026-11-20): its front, the bars, lock and
// hinges on its south side, gone; the bars built once and repeated round (`four`) kept on the other three sides.
const FRONT = /^(bar-\d+|lock|hinge(-\d+)?)$/;
let opened: Recipe | null | undefined;
export function openCage(): Recipe | null {
  if (opened !== undefined) return opened;
  const r = recipeOf("cage");
  opened = r && { ...r, parts: r.parts.flatMap((p) => !FRONT.test(p.id) ? [p] : !p.four ? []
    : [90, 180, 270].map((deg) => ({ ...p, id: `${p.id}@${deg}`, four: false, at: rotate(p.at, [0, deg, 0]), turn: [p.turn[0], p.turn[1] + deg, p.turn[2]] as Vec3 }))) };
  return opened;
}
