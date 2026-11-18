// lib/props/recipe.ts
// 🧪 A prop's recipe (the user, 2026-11-19: /lab/propbuilder, "build Den and dungeon props in 3D from PixelLab
// drawings"): a small JSON file of simple parts (boxes, cylinders, flat panels, upright sprites), each face
// painted with a crop of a picture in public/sprites, at the game's art density (decision 37: 48 art pixels a
// unit, square on screen). No baked meshes: the game builds the shapes from the recipe. Pure: reading and
// checking a recipe, snapping, and each face's shape and texture placement (components/PropRecipe3D.tsx draws
// them). Recipes live in lib/props/recipes/; format in world/art-pipeline.md §6.6.
//
// Units are the world's (u), x east, y up, z south (towards the camera). A part's `at` is the middle of its
// foot (its bottom face), `turn` its rotation in degrees about x, y and z, applied about its foot.

export const RECIPE_FORMAT = 1;
export const DENSITY = 48;              // art pixels a unit (decision 37)
export const ART_STEP = 1 / DENSITY;    // the finest snap: one art pixel
export const SNAP_STEPS = [ART_STEP, 1 / 8, 1 / 4, 1 / 2];
export const TURN_STEP = 15;            // degrees
export const MAX_SIDES = 32;
// Toon's light: from the upper left, in front (the art spec's "light from the upper left at most for form"),
// stepped into three bands. Fixed, so it needs no lights in the scene (the game's scenes have none).
export const TOON_LIGHT: Vec3 = [-1, 1.3, 1];
export const TOON_BANDS = [0.62, 0.81, 1];
// The outline (a box's or cylinder's `outline`): a shell an art pixel bigger all round, drawn inside out in the
// darkest stone, so a dark pixel shows round the part's edges (as the Labyrinth's 3D things have: Props3D's hull).
export const OUTLINE_U = ART_STEP;
export const OUTLINE_COLOUR = "#0e0f0c";

export type Vec3 = [number, number, number];
export type Crop = [number, number, number, number]; // x, y (from the picture's top left), width, height: pixels
export type PartKind = "box" | "cylinder" | "panel" | "sprite";
export const FACES: Record<PartKind, string[]> = {
  box: ["front", "back", "left", "right", "top", "bottom"],
  cylinder: ["side", "top", "bottom", "inner"],
  panel: ["front", "back"],
  sprite: ["front"],
};

// A face as written: a crop of a picture (`fit` "tile": repeated at the art density, the default; "fill": the
// crop stretched over the face once), a flat colour, or the same as another face. `tint` multiplies either.
// "*" in a part's faces is every face not listed; a face neither listed nor covered by "*" isn't drawn.
// `anim` "swirl" (the user, 2026-11-19: the altar's soup): the face drawn as slowly swirling liquid in the teal
// ramp (SWIRL), at the art density, with the odd bubble; the renderer draws it, as the game draws its flames.
// `anim` "ripple" (the healing pool): calm rings spreading from the middle in the water's ramp (RIPPLE), the odd glint.
export type Anim = "swirl" | "ripple";
export const ANIMS: Anim[] = ["swirl", "ripple"];
export type FaceSpec = { src?: string; crop?: Crop; fit?: "tile" | "fill"; colour?: string; tint?: string; same?: string; anim?: Anim };
export type PartSpec = {
  id: string; kind: PartKind; at: Vec3; size: number[]; turn?: Vec3; sides?: number; taper?: number; hole?: number;
  light?: "unlit" | "toon"; glow?: boolean; outline?: boolean; four?: boolean; inside?: boolean; faces: Record<string, FaceSpec>;
};
// `halo`: a soft coloured glow on the floor round the prop (as the Den's altar and pool have: Props3D's Glow).
export type Halo = { colour: string; radius: number; strength: number };
export type RecipeSpec = { format: number; id: string; name: string; setting: "den" | "dungeon"; ref?: { src: string; foot: [number, number] }; halo?: Halo; parts: PartSpec[] };

// As read: every default filled in, every face resolved.
export type Face = ({ kind: "art"; src: string; crop: Crop; fit: "tile" | "fill"; tint: string } | { kind: "colour"; colour: string; tint: string }) & { anim?: Anim };
// The swirl's colours, deep to bright (the altar's teal ramp, lib/props/palette.ts TEAL): its edge, three bands, its crests.
export const SWIRL = ["#125658", "#0e7f75", "#17b69c", "#35e8c1", "#b3ece1"];
// The pool's water, deep to bright (its picture's blue-teal, den3d/pool-top.png).
export const RIPPLE = ["#0b3f4f", "#10606f", "#16808f", "#2aa3ad", "#9fe2e4"];
export type Part = {
  id: string; kind: PartKind; at: Vec3; size: Vec3; turn: Vec3; sides: number; taper: number; hole: number;
  light: "unlit" | "toon"; glow: boolean; outline: boolean; four: boolean; inside: boolean; faces: Record<string, Face>;
};
export type Recipe = { format: number; id: string; name: string; setting: "den" | "dungeon"; ref?: { src: string; foot: [number, number] }; halo?: Halo; parts: Part[] };
export type Read = { ok: true; recipe: Recipe } | { ok: false; errors: string[] };

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const vec = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length === n && v.every(num);

// Read a recipe: everything checked, defaults filled in. A recipe of a later format isn't read (it may mean
// something this code doesn't know). `cache`: parts already read, by the part as written; a part that's the same
// object as before comes back the same (so an edit to one part leaves the others' drawing alone).
export function readRecipe(json: unknown, cache?: WeakMap<object, Part>): Read {
  const errors: string[] = [];
  const r = json as Partial<RecipeSpec> | null;
  if (!r || typeof r !== "object") return { ok: false, errors: ["not a recipe"] };
  if (r.format !== RECIPE_FORMAT) errors.push(`format ${String(r.format)}: this code reads format ${RECIPE_FORMAT}`);
  if (typeof r.id !== "string" || !/^[a-z0-9-]+$/.test(r.id)) errors.push("id: lower-case letters, digits and dashes");
  if (typeof r.name !== "string" || !r.name) errors.push("name missing");
  if (r.setting !== "den" && r.setting !== "dungeon") errors.push("setting: den or dungeon");
  if (r.ref !== undefined && !(typeof r.ref?.src === "string" && vec(r.ref.foot, 2))) errors.push("ref: { src, foot: [x, y] }");
  if (r.halo !== undefined && !(HEX.test(String(r.halo?.colour)) && num(r.halo.radius) && r.halo.radius > 0 && num(r.halo.strength) && r.halo.strength >= 0 && r.halo.strength <= 1)) errors.push("halo: { colour: #rrggbb, radius above 0, strength 0 to 1 }");
  if (!Array.isArray(r.parts) || !r.parts.length) errors.push("parts: at least one");
  const parts: Part[] = [], seen = new Set<string>();
  for (const [i, p] of (Array.isArray(r.parts) ? r.parts : []).entries()) {
    const where = `part ${typeof p?.id === "string" ? p.id : i}`;
    const out = (p && typeof p === "object" && cache?.get(p)) || readPart(p, where, errors);
    if (!out) continue;
    if (p && typeof p === "object") cache?.set(p, out);
    if (seen.has(out.id)) errors.push(`${where}: id used twice`);
    seen.add(out.id);
    parts.push(out);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, recipe: { format: RECIPE_FORMAT, id: r.id!, name: r.name!, setting: r.setting!, ...(r.ref ? { ref: r.ref } : {}), ...(r.halo ? { halo: r.halo } : {}), parts } };
}

function readPart(p: PartSpec, where: string, errors: string[]): Part | null {
  const before = errors.length;
  if (!p || typeof p !== "object") { errors.push(`${where}: not a part`); return null; }
  if (typeof p.id !== "string" || !p.id) errors.push(`${where}: id missing`);
  if (!(p.kind in FACES)) { errors.push(`${where}: kind ${String(p.kind)} (box, cylinder, panel or sprite)`); return null; }
  const flat = p.kind === "panel" || p.kind === "sprite";
  if (!vec(p.at, 3)) errors.push(`${where}: at [x, y, z]`);
  if (!vec(p.size, flat ? 2 : 3) || p.size.some((v) => v <= 0)) errors.push(`${where}: size ${flat ? "[w, h]" : "[w, h, d]"}, each above 0`);
  if (p.turn !== undefined && !vec(p.turn, 3)) errors.push(`${where}: turn [x, y, z] degrees`);
  if (p.sides !== undefined && !(Number.isInteger(p.sides) && p.sides >= 3 && p.sides <= MAX_SIDES)) errors.push(`${where}: sides 3 to ${MAX_SIDES}`);
  if (p.taper !== undefined && !(num(p.taper) && p.taper >= 0)) errors.push(`${where}: taper 0 or more`);
  if (p.hole !== undefined && !(p.kind === "cylinder" && num(p.hole) && p.hole >= 0 && p.hole <= 0.95)) errors.push(`${where}: hole 0 to 0.95, on a cylinder only`);
  if (p.light !== undefined && p.light !== "unlit" && p.light !== "toon") errors.push(`${where}: light unlit or toon`);
  if (p.glow !== undefined && typeof p.glow !== "boolean") errors.push(`${where}: glow true or false`);
  if (p.four !== undefined && typeof p.four !== "boolean") errors.push(`${where}: four true or false`);
  if (p.inside !== undefined && (typeof p.inside !== "boolean" || (p.inside && flat))) errors.push(`${where}: inside true or false, on a box or cylinder only`);
  if (p.outline !== undefined && (typeof p.outline !== "boolean" || (p.outline && flat))) errors.push(`${where}: outline true or false, on a box or cylinder only`);
  if (!p.faces || typeof p.faces !== "object") { errors.push(`${where}: faces missing`); return null; }
  const names = FACES[p.kind];
  for (const k of Object.keys(p.faces)) if (k !== "*" && !names.includes(k)) errors.push(`${where}: no face ${k} on a ${p.kind} (${names.join(", ")})`);
  const faces: Record<string, Face> = {};
  for (const name of names) {
    const f = resolveFace(p.faces, name, `${where} ${name}`, errors);
    if (f) faces[name] = f;
  }
  if (errors.length > before) return null;
  const size: Vec3 = flat ? [p.size[0], p.size[1], 0] : [p.size[0], p.size[1], p.size[2]];
  return { id: p.id, kind: p.kind, at: [...p.at] as Vec3, size, turn: (p.turn ? [...p.turn] : [0, 0, 0]) as Vec3, sides: p.sides ?? 12, taper: p.taper ?? 1, hole: p.hole ?? 0,
    light: p.light ?? "unlit", glow: p.glow ?? false, outline: p.outline ?? false, four: p.four ?? false, inside: p.inside ?? false, faces };
}

// A face, following `same` (to another face of the part, never round in a loop) and "*".
function resolveFace(faces: Record<string, FaceSpec>, name: string, where: string, errors: string[], chain: string[] = []): Face | null {
  const f = faces[name] ?? (name !== "*" && !chain.length ? faces["*"] : undefined);
  if (!f) return null;
  if (f.same !== undefined) {
    if (chain.includes(f.same) || f.same === name) { errors.push(`${where}: same goes round in a loop`); return null; }
    if (!(f.same in faces)) { errors.push(`${where}: same ${f.same}, which isn't given`); return null; }
    return resolveFace(faces, f.same, where, errors, [...chain, name]);
  }
  const tint = f.tint ?? "#ffffff";
  if (!HEX.test(tint)) errors.push(`${where}: tint ${tint} (#rrggbb)`);
  if (f.anim !== undefined && !ANIMS.includes(f.anim)) errors.push(`${where}: anim ${ANIMS.join(" or ")}`);
  const anim = f.anim ? { anim: f.anim } : {};
  if (f.colour !== undefined) {
    if (!HEX.test(f.colour)) { errors.push(`${where}: colour ${f.colour} (#rrggbb)`); return null; }
    return { kind: "colour", colour: f.colour, tint, ...anim };
  }
  if (typeof f.src !== "string" || !f.src.startsWith("/sprites/")) { errors.push(`${where}: src (a picture under /sprites/), colour or same`); return null; }
  if (!vec(f.crop, 4) || f.crop.some((v) => !Number.isInteger(v) || v < 0) || f.crop[2] < 1 || f.crop[3] < 1) { errors.push(`${where}: crop [x, y, w, h] in whole pixels`); return null; }
  if (f.fit !== undefined && f.fit !== "tile" && f.fit !== "fill") errors.push(`${where}: fit tile or fill`);
  return { kind: "art", src: f.src, crop: [...f.crop] as Crop, fit: f.fit ?? "tile", tint, ...anim };
}

// A recipe as saved: two spaces in, each list of numbers on one line (so a part reads at a glance).
export function formatRecipe(r: RecipeSpec): string {
  return JSON.stringify(r, null, 2).replace(/\[\s*(-?[\d.e+-]+(?:,\s*-?[\d.e+-]+)*)\s*\]/g, (_, nums: string) => `[${nums.split(/,\s*/).join(", ")}]`) + "\n";
}

// Every picture a recipe uses.
export const recipePictures = (r: Recipe) => [...new Set(r.parts.flatMap((p) => Object.values(p.faces).flatMap((f) => (f.kind === "art" ? [f.src] : []))))];

// ── Snapping ──
export const snap = (v: number, step: number) => Math.round(v / step) * step;
// A part on the grid: where it stands and its size to `step` (a size never below one step), its turn to TURN_STEP.
export function snapPart<P extends { at: number[]; size: number[]; turn?: number[] }>(p: P, step: number): P {
  const r = (v: number) => Math.round(v * 1e6) / 1e6 + 0; // (no 0.30000000000000004, no −0)
  return { ...p, at: p.at.map((v) => r(snap(v, step))), size: p.size.map((v) => r(Math.max(step, snap(v, step)))), ...(p.turn ? { turn: p.turn.map((v) => snap(v, TURN_STEP) + 0) } : {}) }; // (+ 0: no −0)
}

// ── Shapes ──
// Each face of a part, ready to draw: its outline as a flat polygon in the prop's own space (the part's turn
// and place applied), its texture coordinates (in crops: whole numbers are crop edges, so "tile" repeats),
// its normal, and its toon band (1 when unlit). Sprites stand facing the camera, stretched up by `stretch`
// (as the game's flat things are: uprightStretch), unturned.
// `screen`: how big the face shows, across and up its picture, in units on screen (for faceDensity).
// `hull`: the part's outline shell (drawn inside out, untinted, never tapped). `inside`: a hollow part's (a pot's
// inner wall: `inside`), its faces seen from within (drawn inside out, their normals turned in for the lights).
export type FacePoly = { key: string; part: string; face: string; art: Face; points: Vec3[]; uv: [number, number][]; normal: Vec3; shade: number; glow: boolean; twoSided: boolean; screen: [number, number]; hull?: boolean; inside?: boolean };
export type View = { pitch: number; stretch: number };

// `four` (the user, 2026-11-19: "build 1 corner, then repeat that design 4 times"): the part as it's set, and three
// more, each a quarter turn further round the prop's middle (its turn turned with it), so one corner's design is
// on all four corners. (A sprite, which always faces the camera, is only moved round.)
export function partFaces(p: Part, view: View): FacePoly[] {
  if (!p.four) return oneFaces(p, view);
  return [0, 90, 180, 270].flatMap((deg) => {
    const at = rotate(p.at, [0, deg, 0]), turn: Vec3 = [p.turn[0], p.turn[1] + deg, p.turn[2]];
    return oneFaces({ ...p, at, turn, four: false }, view).map((f) => ({ ...f, key: `${deg}:${f.key}` }));
  });
}
function oneFaces(p: Part, view: View): FacePoly[] {
  if (p.inside) return shapeFaces(p, view).map((f) => ({ ...f, inside: true, normal: [-f.normal[0], -f.normal[1], -f.normal[2]] as Vec3 }));
  return p.outline ? [...shapeFaces(p, view), ...shapeFaces(hullOf(p), view).map((f) => ({ ...f, key: `hull:${f.key}`, hull: true }))] : shapeFaces(p, view);
}
// The outline's shell: the part an art pixel bigger all round (its foot that much lower), one dark colour.
function hullOf(p: Part): Part {
  const [w, h, d] = p.size, o = OUTLINE_U, dark: Face = { kind: "colour", colour: OUTLINE_COLOUR, tint: "#ffffff" };
  const faces = Object.fromEntries(FACES[p.kind].map((n) => [n, dark]));
  const taper = p.kind === "cylinder" ? (w * p.taper + 2 * o) / (w + 2 * o) : p.taper;
  return { ...p, at: [p.at[0], p.at[1] - o, p.at[2]], size: [w + 2 * o, h + 2 * o, d + 2 * o], taper, light: "unlit", glow: false, outline: false, faces };
}
function shapeFaces(p: Part, view: View): FacePoly[] {
  const [w, h, d] = p.size, out: FacePoly[] = [];
  const polys: { face: string; points: Vec3[]; around?: number[] }[] = [];
  if (p.kind === "box") {
    const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
    polys.push(
      { face: "front", points: [[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]] },
      { face: "back", points: [[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0]] },
      { face: "left", points: [[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]] },
      { face: "right", points: [[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1]] },
      { face: "top", points: [[x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0]] },
      { face: "bottom", points: [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]] },
    );
  } else if (p.kind === "cylinder") {
    const n = p.sides, rim = (y: number, k: number) => Array.from({ length: n }, (_, i) => {
      const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2; // (one facet faces the camera square on; the texture's seam is at the back)
      return [Math.cos(a) * (w / 2) * k, y, Math.sin(a) * (d / 2) * k] as Vec3;
    });
    const lo = rim(0, 1), hi = rim(h, p.taper);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, len = Math.hypot(lo[j][0] - lo[i][0], lo[j][2] - lo[i][2]);
      polys.push({ face: "side", points: [lo[j], lo[i], hi[i], hi[j]], around: [-(s + len), -s] }); // (counted backwards: left to right as you look at it)
      s += len;
    }
    if (p.hole > 0) {
      // A tube (`hole`: its hollow's size to its own): a ring for its top and bottom, and an inner wall facing in.
      const lo2 = rim(0, p.hole), hi2 = rim(h, p.taper * p.hole);
      let t = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, len = Math.hypot(lo2[j][0] - lo2[i][0], lo2[j][2] - lo2[i][2]);
        polys.push({ face: "top", points: [hi[i], hi2[i], hi2[j], hi[j]] }, { face: "bottom", points: [lo[j], lo2[j], lo2[i], lo[i]] },
          { face: "inner", points: [lo2[i], lo2[j], hi2[j], hi2[i]], around: [t, t + len] });
        t += len;
      }
    } else polys.push({ face: "top", points: [...hi].reverse() }, { face: "bottom", points: lo });
  } else {
    const y1 = p.kind === "sprite" ? h * view.stretch : h;
    polys.push({ face: "front", points: [[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, y1, 0], [-w / 2, y1, 0]] });
    if (p.kind === "panel") polys.push({ face: "back", points: [[w / 2, 0, 0], [-w / 2, 0, 0], [-w / 2, y1, 0], [w / 2, y1, 0]] });
  }
  const turn = p.kind === "sprite" ? [0, 0, 0] : p.turn, place = (q: Vec3) => add(rotate(q, turn), p.at);
  for (const poly of polys) {
    const art = p.faces[poly.face];
    if (!art || poly.points.length < 3) continue;
    const local = poly.points, pts = local.map(place), normal = normalOf(pts);
    if (!normal) continue; // (a cylinder tapered to a point has no top)
    const { uv, screen } = faceUV(pts, normal, art, view, poly.around ? { around: poly.around, local } : undefined, rotate([1, 0, 0], turn));
    out.push({ key: `${p.id}:${poly.face}:${out.length}`, part: p.id, face: poly.face, art, points: pts, uv, screen,
      normal, shade: p.light === "toon" ? toonBand(normal) : 1, glow: p.glow, twoSided: p.kind === "panel" || p.kind === "sprite" });
  }
  return out;
}

// How many texels a unit along a world direction gets: square on screen (decision 37), the camera `pitch`
// down from the south: across the screen in full, up a standing face cos(pitch), along the floor sin(pitch).
export function texelsAlong(t: Vec3, pitch: number): number {
  const l = Math.hypot(...t) || 1, x = t[0] / l, up = (t[1] * Math.cos(pitch) - t[2] * Math.sin(pitch)) / l;
  return DENSITY * Math.max(1e-3, Math.hypot(x, up));
}

// A face's texture coordinates. Its across (u) runs along the part's turned x where the face lies flat, else
// level across the face as you look at it from outside; its up (v) runs up the face (north on a top), from its
// bottom left corner. "tile": texels laid square on screen, a crop's width a whole number; "fill": 0 to 1.
// A cylinder's sides run on round it (`around`: the distance round at each end of the facet) so it doesn't seam.
function faceUV(pts: Vec3[], n: Vec3, art: Face, view: View, side: { around: number[]; local: Vec3[] } | undefined, partX: Vec3): { uv: [number, number][]; screen: [number, number] } {
  const flat = Math.abs(n[1]) > 0.9;
  let u = flat ? sub(partX, scale(n, dot(partX, n))) : cross([0, 1, 0], n);
  if (Math.hypot(...u) < 1e-6) u = cross([0, 0, -1], n);
  u = norm(u);
  const v = norm(cross(n, u));
  const us = pts.map((q) => dot(q, u)), vs = pts.map((q) => dot(q, v));
  const u0 = Math.min(...us), v0 = Math.min(...vs), du = Math.max(...us) - u0 || 1, dv = Math.max(...vs) - v0 || 1;
  const tu = texelsAlong(u, view.pitch), tv = texelsAlong(v, view.pitch), screen: [number, number] = [(du * tu) / DENSITY, (dv * tv) / DENSITY];
  if (art.kind === "colour" || art.fit === "fill") return { uv: pts.map((_, i) => [(us[i] - u0) / du, (vs[i] - v0) / dv]), screen };
  const [cw, ch] = [art.crop[2], art.crop[3]];
  if (side) {
    // (Round a cylinder: across at the art density along its rim; up its side as it shows on screen, so a sloping
    // side, which shows taller than it stands, keeps its pixels square: up the slant from its foot to its top.)
    const mid = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5), slant = sub(mid(pts[2], pts[3]), mid(pts[0], pts[1]));
    const top = (Math.hypot(...slant) * texelsAlong(slant, view.pitch)) / ch;
    return { uv: [[side.around[0] * DENSITY / cw, 0], [side.around[1] * DENSITY / cw, 0], [side.around[1] * DENSITY / cw, top], [side.around[0] * DENSITY / cw, top]], screen };
  }
  return { uv: pts.map((_, i) => [((us[i] - u0) * tu) / cw, ((vs[i] - v0) * tv) / ch]), screen };
}

// A face's picture's pixels a unit on screen, across and up (decision 37 wants 48 both ways): always 48 for
// "tile"; for "fill", the crop over how big the face shows. Null for a flat colour.
export function faceDensity(f: FacePoly): [number, number] | null {
  if (f.art.kind !== "art") return null;
  if (f.art.fit === "tile") return [DENSITY, DENSITY];
  return [f.art.crop[2] / f.screen[0], f.art.crop[3] / f.screen[1]];
}

// Toon: the face's band of light from TOON_LIGHT.
export function toonBand(n: Vec3): number {
  const k = Math.max(0, dot(n, norm(TOON_LIGHT)));
  return TOON_BANDS[k < 0.33 ? 0 : k < 0.66 ? 1 : 2];
}

// ── Little vector sums ──
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function normalOf(pts: Vec3[]): Vec3 | null {
  let n: Vec3 = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) n = add(n, cross(pts[i], pts[(i + 1) % pts.length])); // (Newell's: any flat polygon)
  const l = Math.hypot(...n);
  return l < 1e-9 ? null : scale(n, 1 / l);
}
// Turned by `deg` about x, then y, then z (three.js's default order, XYZ, as an Euler).
export function rotate(q: Vec3, deg: number[]): Vec3 {
  const [ax, ay, az] = deg.map((d) => (d * Math.PI) / 180);
  let [x, y, z] = q;
  // (XYZ order: the matrix is Rx·Ry·Rz, so z first, then y, then x.)
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  return [x, y, z];
}

// How far a prop reaches from its origin, east-west and north-south (u): its parts' feet, turned and repeated as
// drawn (for walking round it).
export function recipeReach(r: Recipe, view: View): [number, number] {
  let x = 0.2, z = 0.2;
  for (const p of r.parts) for (const f of partFaces(p, view)) for (const q of f.points) { x = Math.max(x, Math.abs(q[0])); z = Math.max(z, Math.abs(q[2])); }
  return [x, z];
}
