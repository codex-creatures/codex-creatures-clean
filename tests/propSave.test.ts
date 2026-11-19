// tests/propSave.test.ts: what the prop builder saves (app/lab/propbuilder/save: lib/props/recipes/indexFile.ts,
// formatRecipe) and checks against (lib/props/palette.ts).
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { recipeIndex } from "@/lib/props/recipes/indexFile";
import { formatRecipe, type RecipeSpec } from "@/lib/props/recipe";
import { RECIPE_FILES } from "@/lib/props/recipes";
import { palette, PALETTE_KEYS, TEAL, MAX_PALETTE } from "@/lib/props/palette";
import SPRITES from "@/lib/props/sprites.json";
import { existsSync } from "node:fs";
import path from "node:path";

const DIR = "lib/props/recipes";
const lf = (s: string) => s.replace(/\r\n/g, "\n");

describe("the recipe files", () => {
  it("the index lists every recipe file, as Save would write it", () => {
    const ids = readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
    expect(lf(readFileSync(path.join(DIR, "index.ts"), "utf8"))).toBe(recipeIndex(ids));
    expect(Object.keys(RECIPE_FILES).sort()).toEqual([...ids].sort());
  });
  it("each recipe file is laid out as Save writes it", () => {
    for (const [id, json] of Object.entries(RECIPE_FILES)) expect(lf(readFileSync(path.join(DIR, `${id}.json`), "utf8")), id).toBe(formatRecipe(json as RecipeSpec));
  });
  it("names a recipe with dashes in its id by a name the code can use", () => {
    expect(recipeIndex(["healing-pool", "altar"])).toContain('import healingPool from "./healing-pool.json";');
    expect(recipeIndex(["healing-pool", "altar"])).toContain('{ altar, "healing-pool": healingPool }');
  });
});

describe("the picture list (npm run props:sprites)", () => {
  it("lists pictures that are there, with their sizes", () => {
    const list = SPRITES as [string, number, number][];
    expect(list.length).toBeGreaterThan(0);
    const missing = list.filter(([p, w, h]) => !existsSync(path.join("public", p)) || !(w > 0 && h > 0)).map(([p]) => p);
    expect(missing).toEqual([]);
  });
});

describe("the palette check", () => {
  it("offers each palette within what the shader holds, the dungeon's with the altar's teal", () => {
    for (const k of PALETTE_KEYS) { expect(palette(k).length).toBeGreaterThan(10); expect(palette(k).length).toBeLessThanOrEqual(MAX_PALETTE); }
    expect(palette("dungeon+teal")).toEqual([...palette("dungeon"), ...TEAL]);
  });
});

describe("the game's way to a recipe", () => {
  it("reads each one the game draws, and gives null for one that isn't there", async () => {
    const { recipeOf } = await import("@/lib/props/recipes/load");
    for (const id of ["altar", "pool", "pit", "sparring", "training", "board", "shack", "storehouse", "tavern"]) expect(recipeOf(id), id).not.toBeNull();
    expect(recipeOf("no-such-prop")).toBeNull();
    expect(recipeOf("altar")).toBe(recipeOf("altar")); // (read once, kept)
  });
});
