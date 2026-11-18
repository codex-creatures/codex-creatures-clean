// tests/propEdit.test.ts: editing a recipe in /lab/propbuilder (lib/props/edit.ts).
import { describe, expect, it } from "vitest";
import { addPart, duplicatePart, deletePart, changePart, renamePart, reorderPart, freeId, startHistory, edit, undo, redo, HISTORY } from "@/lib/props/edit";
import { readRecipe, ART_STEP, type Part, type RecipeSpec } from "@/lib/props/recipe";
import FIRST from "./fixtures/props/altar-first.json";

// The altar's first recipe, kept as a fixture (the real one changes as it's built; these test the editing).
const ALTAR = FIRST as unknown as RecipeSpec;
const ids = (r: RecipeSpec) => r.parts.map((p) => p.id);
const reads = (r: RecipeSpec) => { const x = readRecipe(r); if (!x.ok) throw new Error(x.errors.join("; ")); return x.recipe; };

describe("editing parts", () => {
  it("adds a part of each kind that reads, with a free id", () => {
    let r = ALTAR;
    for (const k of ["box", "cylinder", "panel", "sprite", "box"] as const) r = addPart(r, k).recipe;
    expect(ids(r).slice(-5)).toEqual(["box", "cylinder", "panel", "sprite", "box-2"]);
    expect(addPart(ALTAR, "box").recipe.parts.at(-1)!.at).toEqual([0, 0, 1.5]); // (in front of the altar's 0.9 deep plinth and lanterns, not hidden in it)
    reads(r);
  });
  it("duplicates a part beside it, after it in the list, with a new id", () => {
    const { recipe, id } = duplicatePart(ALTAR, "skull", 0.25);
    expect(id).toBe("skull-2");
    expect(ids(recipe).indexOf("skull-2")).toBe(ids(recipe).indexOf("skull") + 1);
    const a = recipe.parts.find((p) => p.id === "skull")!, b = recipe.parts.find((p) => p.id === "skull-2")!;
    expect(b.at[0]).toBeCloseTo(a.at[0] + 0.25);
    expect(b.faces).toEqual(a.faces);
    expect(b.faces).not.toBe(a.faces); // (its own copy: painting one leaves the other)
    expect(freeId(recipe, "skull-2")).toBe("skull-3");
  });
  it("deletes a part, but never the last one", () => {
    expect(ids(deletePart(ALTAR, "fire"))).not.toContain("fire");
    const lone = { ...ALTAR, parts: [ALTAR.parts[0]] };
    expect(deletePart(lone, lone.parts[0].id)).toBe(lone);
  });
  it("changes a part on the grid, or as typed with snapping off", () => {
    const moved = changePart(ALTAR, "plinth", { at: [0.3, 0, 0] }, 1 / 4).parts[0];
    expect(moved.at).toEqual([0.25, 0, 0]);
    expect(changePart(ALTAR, "plinth", { at: [0.3, 0, 0] }, 1 / 4, false).parts[0].at).toEqual([0.3, 0, 0]);
    expect(changePart(ALTAR, "plinth", { size: [2.01, 0.45, 1.8] }, ART_STEP).parts[0].size[0]).toBeCloseTo(2);
  });
  it("renames a part only to a free, well-formed id", () => {
    expect(ids(renamePart(ALTAR, "fire", "soul-fire"))).toContain("soul-fire");
    expect(renamePart(ALTAR, "fire", "skull")).toBe(ALTAR);
    expect(renamePart(ALTAR, "fire", "Soul Fire")).toBe(ALTAR);
  });
  it("moves a part up or down the list, not past either end", () => {
    expect(ids(reorderPart(ALTAR, "tier", -1)).slice(0, 2)).toEqual(["tier", "plinth"]);
    expect(reorderPart(ALTAR, "plinth", -1)).toBe(ALTAR);
  });
});

describe("changing one part leaves everything else untouched", () => {
  it("every other part is the same object, in the recipe as written and as read", () => {
    const next = changePart(ALTAR, "skull", { at: [0, 0.9, 0.62] }, ART_STEP);
    expect(next.parts.filter((p, i) => p !== ALTAR.parts[i]).map((p) => p.id)).toEqual(["skull"]);
    const cache = new WeakMap<object, Part>(), before = reads(ALTAR), a = readRecipe(ALTAR, cache), b = readRecipe(next, cache);
    if (!a.ok || !b.ok) throw new Error("didn't read");
    expect(b.recipe.parts.filter((p, i) => p !== a.recipe.parts[i]).map((p) => p.id)).toEqual(["skull"]);
    expect(a.recipe.parts).toEqual(before.parts); // (the cache changes nothing about what's read)
  });
  it("a cached part still counts for duplicate ids", () => {
    const cache = new WeakMap<object, Part>();
    readRecipe(ALTAR, cache);
    expect(readRecipe({ ...ALTAR, parts: [...ALTAR.parts, ALTAR.parts[0]] }, cache).ok).toBe(false);
  });
});

describe("undo", () => {
  it("undoes and redoes edits in order; a new edit forgets what was undone", () => {
    const a = ALTAR, b = deletePart(a, "fire"), c = deletePart(b, "skull"), d = deletePart(a, "tier");
    let h = edit(edit(startHistory(a), b), c);
    h = undo(h); expect(h.now).toBe(b);
    h = undo(h); expect(h.now).toBe(a);
    h = undo(h); expect(h.now).toBe(a);
    h = redo(h); expect(h.now).toBe(b);
    h = edit(h, d); expect(h.future).toEqual([]); expect(redo(h)).toBe(h);
  });
  it("keeps nothing for an edit that changed nothing, and only the last HISTORY edits", () => {
    const h0 = startHistory(ALTAR);
    expect(edit(h0, ALTAR)).toBe(h0);
    let h = h0;
    for (let i = 0; i < HISTORY + 20; i++) h = edit(h, changePart(h.now, "plinth", { at: [i * ART_STEP, 0, 0] }, ART_STEP));
    expect(h.past).toHaveLength(HISTORY);
  });
});

describe("painting a face", () => {
  it("changes that face alone, of that part alone, and clears one with null", async () => {
    const { changeFace } = await import("@/lib/props/edit");
    const next = changeFace(ALTAR, "plinth", "top", { colour: "#445566" });
    const before = ALTAR.parts[0], after = next.parts[0];
    expect(after.faces.top).toEqual({ colour: "#445566" });
    expect(after.faces["*"]).toBe(before.faces["*"]);
    expect(next.parts.slice(1).every((p, i) => p === ALTAR.parts[i + 1])).toBe(true);
    expect("top" in changeFace(ALTAR, "plinth", "top", null).parts[0].faces).toBe(false);
    reads(next);
  });
});
