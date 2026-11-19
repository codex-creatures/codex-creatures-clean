// lib/props/recipes/load.ts
// The game's way to a prop recipe (world/art-pipeline.md §6.6): each read once (readRecipe) and kept; null when it
// won't read, so whoever draws it falls back to the drawing it had before and a bad file can't break a room.

import { readRecipe, type Recipe } from "../recipe";
import { RECIPE_FILES } from "./index";

const READ = new Map<string, Recipe | null>();
export function recipeOf(id: string): Recipe | null {
  if (!READ.has(id)) {
    const r = RECIPE_FILES[id] === undefined ? null : readRecipe(RECIPE_FILES[id]);
    READ.set(id, r && r.ok ? r.recipe : null);
  }
  return READ.get(id)!;
}
