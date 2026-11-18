// tests/propRecipe.test.ts: props built from recipes (lib/props/recipe.ts, lib/props/recipes/).
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { readRecipe, partFaces, recipePictures, snapPart, texelsAlong, toonBand, rotate, ART_STEP, DENSITY, TOON_BANDS, type RecipeSpec, type Part, type Vec3 } from "@/lib/props/recipe";
import { RECIPE_FILES } from "@/lib/props/recipes";

const PITCH = Math.PI / 3, VIEW = { pitch: PITCH, stretch: 2 };
const STONE = { src: "/sprites/den3d/parts/pit-stone.png", crop: [0, 0, 48, 24] as [number, number, number, number] };
const recipe = (parts: unknown[]): RecipeSpec => ({ format: 1, id: "test", name: "Test", setting: "den", parts: parts as RecipeSpec["parts"] });
const one = (part: Record<string, unknown>): Part => {
  const r = readRecipe(recipe([{ id: "p", at: [0, 0, 0], faces: { "*": STONE }, ...part }]));
  if (!r.ok) throw new Error(r.errors.join("; "));
  return r.recipe.parts[0];
};
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 5));

describe("reading a recipe", () => {
  it("fills in the defaults", () => {
    const p = one({ kind: "box", size: [1, 1, 1] });
    expect(p).toMatchObject({ turn: [0, 0, 0], light: "unlit", glow: false, sides: 12, taper: 1 });
    expect(p.faces.front).toEqual({ kind: "art", ...STONE, fit: "tile", tint: "#ffffff" });
  });
  it("gives every face not listed the '*' face, follows `same`, and leaves out faces neither covers", () => {
    const p = one({ kind: "box", size: [1, 1, 1], faces: { front: STONE, top: { colour: "#112233" }, back: { same: "top" } } });
    expect(Object.keys(p.faces).sort()).toEqual(["back", "front", "top"]);
    expect(p.faces.back).toEqual({ kind: "colour", colour: "#112233", tint: "#ffffff" });
    expect(Object.keys(one({ kind: "box", size: [1, 1, 1] }).faces)).toHaveLength(6);
  });
  it("turns down what it can't draw, saying why", () => {
    const bad = (parts: unknown[], why: RegExp, extra: Partial<RecipeSpec> = {}) => {
      const r = readRecipe({ ...recipe(parts), ...extra });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.join("\n")).toMatch(why);
    };
    const box = { id: "b", kind: "box", at: [0, 0, 0], size: [1, 1, 1], faces: { "*": STONE } };
    bad([box], /format 2/, { format: 2 });
    bad([{ ...box, kind: "sphere" }], /kind sphere/);
    bad([{ ...box, size: [1, 0, 1] }], /size/);
    bad([{ ...box, size: [1, 1] }], /size/);
    bad([{ ...box, sides: 2, kind: "cylinder" }], /sides/);
    bad([{ ...box, faces: { side: STONE } }], /no face side on a box/);
    bad([{ ...box, faces: { front: { same: "back" }, back: { same: "front" } } }], /loop/);
    bad([{ ...box, faces: { front: { same: "top" } } }], /isn't given/);
    bad([{ ...box, faces: { front: { src: "/elsewhere/x.png", crop: [0, 0, 1, 1] } } }], /src/);
    bad([{ ...box, faces: { front: { ...STONE, crop: [0, 0, 0, 4] } } }], /crop/);
    bad([{ ...box, faces: { front: { colour: "red" } } }], /colour/);
    bad([box, { ...box }], /id used twice/);
    bad([], /parts/);
    expect(readRecipe(null).ok).toBe(false);
  });
  it("lists the pictures it uses, once each", () => {
    const r = readRecipe(recipe([{ id: "a", kind: "box", at: [0, 0, 0], size: [1, 1, 1], faces: { "*": STONE } }, { id: "b", kind: "panel", at: [0, 0, 0], size: [1, 1], faces: { front: STONE } }]));
    expect(r.ok && recipePictures(r.recipe)).toEqual([STONE.src]);
  });
});

describe("the recipes in the repo", () => {
  for (const [id, json] of Object.entries(RECIPE_FILES)) {
    it(`${id} reads, is named after its file, and every picture it uses is in public/`, () => {
      const r = readRecipe(json);
      if (!r.ok) throw new Error(r.errors.join("; "));
      expect(r.recipe.id).toBe(id);
      const missing = [...recipePictures(r.recipe), ...(r.recipe.ref ? [r.recipe.ref.src] : [])].filter((src) => !existsSync(path.join("public", src)));
      expect(missing).toEqual([]);
    });
  }
});

describe("snapping", () => {
  it("puts a part on the grid, its size never below one step, its turn to 15°", () => {
    const p = snapPart({ at: [0.3, 0.011, -1.26], size: [0.001, 0.5, 2.04], turn: [0, 22, -8] }, 1 / 4);
    expect(p).toEqual({ at: [0.25, 0, -1.25], size: [0.25, 0.5, 2], turn: [0, 15, -15] }); // (−8° is nearer −15° than 0°)
    expect(snapPart({ at: [1 / 96 + 0.001, 0, 0], size: [1, 1] }, ART_STEP).at[0]).toBeCloseTo(1 / 48);
  });
});

describe("the shapes", () => {
  it("a box has six faces, each facing out, standing on its foot", () => {
    const fs = partFaces(one({ kind: "box", at: [1, 0, 2], size: [2, 1, 3] }), VIEW);
    const n: Record<string, number[]> = Object.fromEntries(fs.map((f) => [f.face, f.normal]));
    close(n.front, [0, 0, 1]); close(n.back, [0, 0, -1]); close(n.left, [-1, 0, 0]); close(n.right, [1, 0, 0]); close(n.top, [0, 1, 0]); close(n.bottom, [0, -1, 0]);
    const ys = fs.flatMap((f) => f.points.map((q) => q[1])), xs = fs.flatMap((f) => f.points.map((q) => q[0]));
    expect([Math.min(...ys), Math.max(...ys), Math.min(...xs), Math.max(...xs)]).toEqual([0, 1, 0, 2]);
  });
  it("a cylinder's sides face out, one facet square to the camera, and a top and bottom", () => {
    const fs = partFaces(one({ kind: "cylinder", size: [2, 1, 2], sides: 8 }), VIEW), sides = fs.filter((f) => f.face === "side");
    expect(sides).toHaveLength(8);
    for (const f of sides) { const c = f.points.reduce((s, q) => [s[0] + q[0], s[1] + q[2]], [0, 0]); expect(f.normal[0] * c[0] + f.normal[2] * c[1]).toBeGreaterThan(0); }
    expect(sides.some((f) => Math.abs(f.normal[2] - 1) < 1e-9)).toBe(true);
    close(fs.find((f) => f.face === "top")!.normal, [0, 1, 0]);
    close(fs.find((f) => f.face === "bottom")!.normal, [0, -1, 0]);
  });
  it("a cylinder tapered to a point has no top", () => {
    expect(partFaces(one({ kind: "cylinder", size: [1, 1, 1], taper: 0 }), VIEW).some((f) => f.face === "top")).toBe(false);
  });
  it("a sprite stands facing the camera, stretched as the game's flat things are, never turned", () => {
    const [f] = partFaces(one({ kind: "sprite", size: [1, 0.5], turn: [0, 90, 0], faces: { front: STONE } }), VIEW);
    close(f.normal, [0, 0, 1]);
    expect(Math.max(...f.points.map((q) => q[1]))).toBeCloseTo(1);
    expect(f.twoSided).toBe(true);
  });
  it("a turn turns the part about its foot", () => {
    const [front] = partFaces(one({ kind: "box", size: [1, 1, 1], turn: [0, 90, 0], faces: { front: STONE } }), VIEW);
    close(front.normal, [1, 0, 0]);
    close(rotate([0, 0, 1], [0, 90, 0]), [1, 0, 0]);
  });
});

describe("the texture on a face (decision 37: 48 art pixels a unit, square on screen)", () => {
  const uvSpan = (f: { uv: [number, number][] }) => [Math.max(...f.uv.map((q) => q[0])) - Math.min(...f.uv.map((q) => q[0])), Math.max(...f.uv.map((q) => q[1])) - Math.min(...f.uv.map((q) => q[1]))];
  it("lays a standing face at 48 across and 48·cos(pitch) up, as the Den's faces are", () => {
    const front = partFaces(one({ kind: "box", size: [2, 0.45, 1.8] }), VIEW).find((f) => f.face === "front")!;
    close(uvSpan(front), [(2 * DENSITY) / 48, (0.45 * DENSITY * Math.cos(PITCH)) / 24]); // 2 crops across, 0.45 up
  });
  it("lays a top at 48·sin(pitch) along it, its picture's top row at the back", () => {
    const top = partFaces(one({ kind: "box", size: [1, 1, 1] }), VIEW).find((f) => f.face === "top")!;
    close(uvSpan(top), [1, (DENSITY * Math.sin(PITCH)) / 24]);
    const back = top.points.findIndex((q) => q[2] < 0 && q[0] < 0), front = top.points.findIndex((q) => q[2] > 0 && q[0] < 0);
    expect(top.uv[back][1]).toBeGreaterThan(top.uv[front][1]);
  });
  it("keeps pixels square on screen on a turned face, and the same size", () => {
    expect(texelsAlong([1, 0, 0], PITCH)).toBeCloseTo(DENSITY);
    expect(texelsAlong([0, 1, 0], PITCH)).toBeCloseTo(DENSITY * Math.cos(PITCH));
    expect(texelsAlong([0, 0, -1], PITCH)).toBeCloseTo(DENSITY * Math.sin(PITCH));
    // (A box turned 90°: its front now runs north-south, so it shows sin(pitch) as wide as it is.)
    const turned = partFaces(one({ kind: "box", size: [1, 1, 1], turn: [0, 90, 0], faces: { front: STONE } }), VIEW)[0];
    close(uvSpan(turned), [(DENSITY * Math.sin(PITCH)) / 48, (DENSITY * Math.cos(PITCH)) / 24]);
  });
  it("runs a cylinder's sides on round it, left to right as you look, with no seam at the front", () => {
    const sides = partFaces(one({ kind: "cylinder", size: [2, 1, 2], sides: 8 }), VIEW).filter((f) => f.face === "side");
    const front = sides.find((f) => Math.abs(f.normal[2] - 1) < 1e-9)!, left = front.points.findIndex((q) => q[0] < 0 && q[1] === 0), right = front.points.findIndex((q) => q[0] > 0 && q[1] === 0);
    expect(front.uv[right][0] - front.uv[left][0]).toBeCloseTo((2 * Math.sin(Math.PI / 8) * DENSITY) / 48); // (one facet's width, at 48 a unit)
    // Each facet's left edge meets the next facet's right edge, all the way round but at the back.
    const at = (f: typeof front, x: number, z: number) => f.uv[f.points.findIndex((q) => Math.abs(q[0] - x) < 1e-9 && Math.abs(q[2] - z) < 1e-9 && q[1] === 0)]?.[0];
    let joins = 0;
    for (const a of sides) for (const b of sides) if (a !== b) for (const q of a.points.filter((q) => q[1] === 0)) {
      const ua = at(a, q[0], q[2]), ub = at(b, q[0], q[2]);
      if (ub !== undefined && Math.abs(ua - ub) < 1e-9) joins++;
    }
    expect(joins).toBe(2 * 7); // (8 joins round, less the seam, each found from both sides)
  });
  it("fills a face once with a crop when it's 'fill'", () => {
    const [f] = partFaces(one({ kind: "panel", size: [3, 1], faces: { front: { ...STONE, fit: "fill" } } }), VIEW);
    close(uvSpan(f), [1, 1]);
  });
});

describe("toon light", () => {
  it("lights tops most and the side away from the light least, in three bands; unlit faces are all full", () => {
    expect(toonBand([0, 1, 0])).toBe(TOON_BANDS[2]);
    expect(toonBand([1, 0, 0])).toBe(TOON_BANDS[0]);
    const unlit = partFaces(one({ kind: "box", size: [1, 1, 1] }), VIEW), toon = partFaces(one({ kind: "box", size: [1, 1, 1], light: "toon" }), VIEW);
    expect(unlit.every((f) => f.shade === 1)).toBe(true);
    expect(new Set(toon.map((f) => f.shade)).size).toBeGreaterThan(1);
  });
});

describe("changing one part leaves the rest as they were", () => {
  it("shares every other part, unchanged, with the recipe it came from", async () => {
    const r = readRecipe((await import("./fixtures/props/altar-first.json")).default);
    if (!r.ok) throw new Error(r.errors.join());
    const parts = r.recipe.parts, changed = parts.map((p) => (p.id === "skull" ? { ...p, at: [0, 0.9, 0.62] as Vec3 } : p));
    expect(changed.filter((p, i) => p !== parts[i]).map((p) => p.id)).toEqual(["skull"]);
  });
});

describe("a recipe as saved", () => {
  it("reads back the same, each list of numbers on one line", async () => {
    const { formatRecipe } = await import("@/lib/props/recipe");
    const first = (await import("./fixtures/props/altar-first.json")).default as unknown as RecipeSpec;
    const text = formatRecipe(first);
    expect(JSON.parse(text)).toEqual(first);
    expect(text).toContain('"size": [2, 0.45, 1.8]');
    expect(text).toContain('"crop": [0, 0, 48, 24]');
  });
});

describe("a face's pixel size on screen (the builder's warning)", () => {
  it("is 48 a unit for 'tile'; for 'fill', the crop over how big the face shows", async () => {
    const { faceDensity } = await import("@/lib/props/recipe");
    const [tile] = partFaces(one({ kind: "panel", size: [1, 1], faces: { front: STONE } }), VIEW);
    expect(faceDensity(tile)).toEqual([DENSITY, DENSITY]);
    // A standing panel 34 px wide and 26 px up as it shows (26 / (48·cos 60°) u tall): exactly 48 a unit.
    const [right] = partFaces(one({ kind: "panel", size: [34 / 48, 26 / (48 * Math.cos(PITCH))], faces: { front: { ...STONE, crop: [0, 0, 34, 26], fit: "fill" } } }), VIEW);
    close(faceDensity(right)!, [DENSITY, DENSITY]);
    // Twice as wide: half the pixels a unit across.
    const [wide] = partFaces(one({ kind: "panel", size: [68 / 48, 26 / (48 * Math.cos(PITCH))], faces: { front: { ...STONE, crop: [0, 0, 34, 26], fit: "fill" } } }), VIEW);
    close(faceDensity(wide)!, [DENSITY / 2, DENSITY]);
    expect(faceDensity(partFaces(one({ kind: "panel", size: [1, 1], faces: { front: { colour: "#000000" } } }), VIEW)[0])).toBeNull();
  });
});

describe("the outline", () => {
  it("adds a shell an art pixel bigger all round, dark, drawn inside out; never on a flat part", async () => {
    const { OUTLINE_COLOUR, OUTLINE_U } = await import("@/lib/props/recipe");
    const plain = partFaces(one({ kind: "box", size: [1, 1, 1] }), VIEW), lined = partFaces(one({ kind: "box", size: [1, 1, 1], outline: true }), VIEW);
    const hull = lined.filter((f) => f.hull);
    expect(lined.length).toBe(plain.length * 2);
    expect(hull.every((f) => f.art.kind === "colour" && f.art.colour === OUTLINE_COLOUR)).toBe(true);
    const xs = hull.flatMap((f) => f.points.map((q) => q[0])), ys = hull.flatMap((f) => f.points.map((q) => q[1]));
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys)]).toEqual([-0.5 - OUTLINE_U, 0.5 + OUTLINE_U, -OUTLINE_U].map((v) => expect.closeTo(v, 9)));
    expect(readRecipe(recipe([{ id: "p", kind: "panel", at: [0, 0, 0], size: [1, 1], outline: true, faces: { front: STONE } }])).ok).toBe(false);
  });
});

describe("a sloping side (a tapered cylinder: a frustum)", () => {
  it("keeps its pixels square on screen: up the slant as it shows, not just as high as it stands", () => {
    // A four-sided frustum, its front leaning back: as tall on screen as h·cos(pitch) + how far it leans back·sin(pitch).
    const p = one({ kind: "cylinder", size: [2, 0.5, 2], sides: 4, taper: 0.5 }), [front] = partFaces(p, VIEW).filter((f) => f.face === "side" && f.normal[2] > 0.5);
    const lean = front.points[0][2] - front.points[2][2], shows = 0.5 * Math.cos(PITCH) + lean * Math.sin(PITCH);
    expect(Math.max(...front.uv.map((q) => q[1]))).toBeCloseTo((shows * DENSITY) / 24);
  });
  it("reads a halo, and turns down a bad one", () => {
    const halo = { colour: "#5fe0d0", radius: 2, strength: 0.3 };
    const ok = readRecipe({ ...recipe([{ id: "b", kind: "box", at: [0, 0, 0], size: [1, 1, 1], faces: { "*": STONE } }]), halo });
    expect(ok.ok && ok.recipe.halo).toEqual(halo);
    expect(readRecipe({ ...recipe([{ id: "b", kind: "box", at: [0, 0, 0], size: [1, 1, 1], faces: { "*": STONE } }]), halo: { ...halo, strength: 2 } }).ok).toBe(false);
  });
});

describe("×4 round (one corner's design on all four)", () => {
  it("repeats a part a quarter turn apart round the middle, turned with it", () => {
    const p = one({ kind: "box", at: [1, 0, 0.5], size: [0.2, 0.4, 0.2], four: true });
    const faces = partFaces(p, VIEW), fronts = faces.filter((f) => f.face === "front");
    expect(faces).toHaveLength(6 * 4);
    const centres = fronts.map((f) => [f.points.reduce((s, q) => s + q[0], 0) / 4, f.points.reduce((s, q) => s + q[2], 0) / 4]);
    expect(centres.map(([x, z]) => [Math.sign(x), Math.sign(z)]).sort()).toEqual([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    expect(new Set(fronts.map((f) => f.normal.map((v) => Math.round(v)).join())).size).toBe(4); // (each turned its own way)
    expect(new Set(faces.map((f) => f.key)).size).toBe(faces.length);
  });
});

describe("a swirling face (anim)", () => {
  it("reads 'swirl' on a colour or picture face, turns down anything else", () => {
    const p = one({ kind: "cylinder", size: [1, 0.05, 1], faces: { top: { colour: "#3fe0bf", anim: "swirl" } } });
    expect(p.faces.top).toMatchObject({ kind: "colour", anim: "swirl" });
    expect(readRecipe(recipe([{ id: "s", kind: "box", at: [0, 0, 0], size: [1, 1, 1], faces: { top: { colour: "#000000", anim: "spin" } } }])).ok).toBe(false);
  });
});

describe("how far a prop reaches (for walking round it)", () => {
  it("is its widest part's edges, repeats and turns included", async () => {
    const { recipeReach } = await import("@/lib/props/recipe");
    const r = readRecipe(recipe([{ id: "b", kind: "box", at: [0, 0, 0], size: [2, 1, 1], faces: { "*": STONE } }, { id: "p", kind: "box", at: [1.5, 0, 1.5], size: [0.2, 0.2, 0.2], four: true, faces: { "*": STONE } }]));
    if (!r.ok) throw new Error();
    const [x, z] = recipeReach(r.recipe, VIEW);
    expect(x).toBeCloseTo(1.6); expect(z).toBeCloseTo(1.6);
  });
});

describe("a hollow part (inside)", () => {
  it("draws its faces from within: normals turned in", () => {
    const out = partFaces(one({ kind: "cylinder", size: [1, 0.2, 1], sides: 8 }), VIEW), hollow = partFaces(one({ kind: "cylinder", size: [1, 0.2, 1], sides: 8, inside: true }), VIEW);
    expect(hollow.every((f) => f.inside)).toBe(true);
    hollow.forEach((f, i) => close(f.normal, out[i].normal.map((v) => -v)));
  });
});

describe("a tube (a cylinder with a hole)", () => {
  it("has a ring for its top and bottom and an inner wall facing in", () => {
    const fs = partFaces(one({ kind: "cylinder", size: [2, 0.5, 2], sides: 8, hole: 0.8 }), VIEW);
    const by = (n: string) => fs.filter((f) => f.face === n);
    expect(by("top")).toHaveLength(8); expect(by("bottom")).toHaveLength(8); expect(by("inner")).toHaveLength(8);
    for (const f of by("top")) expect(f.normal[1]).toBeCloseTo(1);
    for (const f of by("bottom")) expect(f.normal[1]).toBeCloseTo(-1);
    for (const f of by("inner")) { const c = f.points.reduce((s, q) => [s[0] + q[0], s[1] + q[2]], [0, 0]); expect(f.normal[0] * c[0] + f.normal[2] * c[1]).toBeLessThan(0); }
    // The top ring leaves the middle open: no top point nearer the middle than the hole.
    for (const f of by("top")) for (const q of f.points) expect(Math.hypot(q[0], q[2])).toBeGreaterThan(0.7);
    expect(readRecipe(recipe([{ id: "b", kind: "box", at: [0, 0, 0], size: [1, 1, 1], hole: 0.5, faces: { "*": STONE } }])).ok).toBe(false);
  });
});
