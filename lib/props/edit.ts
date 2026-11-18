// lib/props/edit.ts
// 🧪 Editing a recipe in /lab/propbuilder (lib/props/recipe.ts; world/art-pipeline.md §6.6): adding, duplicating,
// deleting and changing parts, and undo. Pure, on the recipe as written (RecipeSpec, what's saved), and every
// change makes a new recipe in which every part it didn't touch is the very same object, so the drawing rebuilds
// only what changed (components/PropRecipe3D.tsx).

import { snapPart, type FaceSpec, type PartKind, type PartSpec, type RecipeSpec, type Vec3 } from "./recipe";

export const HISTORY = 100; // edits kept to undo

// A new part's shape, standing in the middle, in a plain colour till it's painted.
export const NEW_FACE: FaceSpec = { colour: "#8a7a66" };
const NEW_SIZE: Record<PartKind, number[]> = { box: [0.5, 0.5, 0.5], cylinder: [0.5, 0.5, 0.5], panel: [0.5, 0.5], sprite: [0.5, 0.5] };

// An id not yet used: `base`, or base-2, base-3…
export function freeId(r: RecipeSpec, base: string): string {
  const used = new Set(r.parts.map((p) => p.id));
  if (!used.has(base)) return base;
  const stem = base.replace(/-\d+$/, "");
  for (let n = 2; ; n++) if (!used.has(`${stem}-${n}`)) return `${stem}-${n}`;
}

// Where a new part goes: on the floor half a unit in front of everything (inside the prop, it'd be hidden).
export function inFront(r: RecipeSpec): Vec3 {
  const z = Math.max(0, ...r.parts.map((p) => p.at[2] + (p.size[2] ?? 0) / 2));
  return [0, 0, Math.round((z + 0.5) * 4) / 4];
}

export function addPart(r: RecipeSpec, kind: PartKind, at: Vec3 = inFront(r)): { recipe: RecipeSpec; id: string } {
  const id = freeId(r, kind);
  const part: PartSpec = { id, kind, at, size: [...NEW_SIZE[kind]], ...(kind === "cylinder" ? { sides: 12 } : {}), faces: { "*": { ...NEW_FACE } } };
  return { recipe: { ...r, parts: [...r.parts, part] }, id };
}

// A copy beside it (one `step` to the east), with a new id, after it in the list.
export function duplicatePart(r: RecipeSpec, id: string, step: number): { recipe: RecipeSpec; id: string } {
  const i = r.parts.findIndex((p) => p.id === id);
  if (i < 0) return { recipe: r, id };
  const p = r.parts[i], copy: PartSpec = { ...structuredClone(p), id: freeId(r, p.id), at: [p.at[0] + step, p.at[1], p.at[2]] };
  return { recipe: { ...r, parts: [...r.parts.slice(0, i + 1), copy, ...r.parts.slice(i + 1)] }, id: copy.id };
}

// (Never the last part: a recipe has at least one.)
export function deletePart(r: RecipeSpec, id: string): RecipeSpec {
  return r.parts.length > 1 ? { ...r, parts: r.parts.filter((p) => p.id !== id) } : r;
}

// A change to one part: `patch` merged into it, put back on the grid (`step`) unless `snap` is off.
export function changePart(r: RecipeSpec, id: string, patch: Partial<PartSpec>, step: number, snap = true): RecipeSpec {
  return { ...r, parts: r.parts.map((p) => {
    if (p.id !== id) return p;
    const next = { ...p, ...patch };
    return snap ? snapPart(next, step) : next;
  }) };
}

// One face of a part painted (`spec`), or cleared (null): every other face, and every other part, as it was.
export function changeFace(r: RecipeSpec, id: string, face: string, spec: FaceSpec | null): RecipeSpec {
  return { ...r, parts: r.parts.map((p) => {
    if (p.id !== id) return p;
    const faces = { ...p.faces };
    if (spec) faces[face] = spec; else delete faces[face];
    return { ...p, faces };
  }) };
}

// A part renamed (a name already used, or not lower-case letters, digits and dashes, leaves it as it was).
export function renamePart(r: RecipeSpec, id: string, to: string): RecipeSpec {
  if (to === id || !/^[a-z0-9-]+$/.test(to) || r.parts.some((p) => p.id === to)) return r;
  return { ...r, parts: r.parts.map((p) => (p.id === id ? { ...p, id: to } : p)) };
}

// Moved one place up or down the list (drawn in that order).
export function reorderPart(r: RecipeSpec, id: string, by: -1 | 1): RecipeSpec {
  const i = r.parts.findIndex((p) => p.id === id), j = i + by;
  if (i < 0 || j < 0 || j >= r.parts.length) return r;
  const parts = [...r.parts];
  [parts[i], parts[j]] = [parts[j], parts[i]];
  return { ...r, parts };
}

// ── Undo ──
export type History = { past: RecipeSpec[]; now: RecipeSpec; future: RecipeSpec[] };
export const startHistory = (r: RecipeSpec): History => ({ past: [], now: r, future: [] });
// An edit (nothing kept if it changed nothing); redo's forgotten, and only the last HISTORY edits are kept.
export function edit(h: History, next: RecipeSpec): History {
  if (next === h.now) return h;
  return { past: [...h.past, h.now].slice(-HISTORY), now: next, future: [] };
}
export function undo(h: History): History {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future] };
}
export function redo(h: History): History {
  if (!h.future.length) return h;
  return { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) };
}
