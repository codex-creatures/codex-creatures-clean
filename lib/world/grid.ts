// lib/world/grid.ts
// Panels and subcells (docs/world-spec.md §2, "Coordinates": the one
// definition). A panel is the floor tile rooms are laid out in, 1 u across
// (units.ts CELL_U), its centre the whole number, as walk.ts has it. A
// subcell is a third of a panel each way: physical sizes, placement and
// occupancy use them (phase 2b; phase 2a saves anchors in them). Nothing else
// does these sums, and the renderer never sees subcells: it gets positions in
// u, which the projection turns into pixels.
//
// Every edge belongs to the panel or subcell east (south) of it, and floor is
// used throughout, never truncation or %, so negative coordinates work the
// same as positive ones.

export const SUBCELLS = 3; // subcells across a panel (and down it)

// Panel px holds subcells 3px − 1, 3px and 3px + 1; the middle one is its centre.
export const subcellOfPanel = (p: number) => p * SUBCELLS;
export const panelOfSubcell = (s: number) => Math.floor((s + 1) / SUBCELLS);
// Where a subcell sits in its panel: −1, 0 or +1 (west, middle, east; north, middle, south).
export const placeInPanel = (s: number) => s - panelOfSubcell(s) * SUBCELLS;

// A subcell's centre in u, and the subcell (or panel) a position in u is in.
export const subcellCentre = (s: number) => s / SUBCELLS;
export const subcellAt = (x: number) => Math.floor(x * SUBCELLS + 0.5);
export const panelAt = (x: number) => Math.floor(x + 0.5);

// A point's anchor subcell, when it stands at a whole panel's centre (as
// everything today's game places does). Null if it doesn't: no rounding.
export function panelAnchor(p: { x: number; y: number }): { sx: number; sy: number } | null {
  return Number.isInteger(p.x) && Number.isInteger(p.y) ? { sx: subcellOfPanel(p.x), sy: subcellOfPanel(p.y) } : null;
}
// …and back: the position in u of an anchor subcell's centre.
export const anchorPoint = (a: { sx: number; sy: number }) => ({ x: subcellCentre(a.sx), y: subcellCentre(a.sy) });

// A footprint's subcells (phase 2b): w × d, centred on its anchor subcell (an
// even size has no middle one, so its anchor is the subcell just south-east of
// the middle: §3), a quarter turn swapping w and d. Listed row by row, from
// the north-west corner.
export type Size = { w: number; d: number };
export const turned = (s: Size, rot: number = 0): Size => (rot % 2 ? { w: s.d, d: s.w } : s);
export function footprintCells(a: { sx: number; sy: number }, size: Size, rot: number = 0): { sx: number; sy: number }[] {
  const { w, d } = turned(size, rot);
  const x0 = a.sx - Math.floor(w / 2), y0 = a.sy - Math.floor(d / 2);
  const out: { sx: number; sy: number }[] = [];
  for (let y = y0; y < y0 + d; y++) for (let x = x0; x < x0 + w; x++) out.push({ sx: x, sy: y });
  return out;
}
// …and the panels it touches (one, unless it crosses a panel's edge).
export function footprintPanels(a: { sx: number; sy: number }, size: Size, rot: number = 0): { x: number; y: number }[] {
  const seen = new Map<string, { x: number; y: number }>();
  for (const c of footprintCells(a, size, rot)) {
    const p = { x: panelOfSubcell(c.sx), y: panelOfSubcell(c.sy) };
    seen.set(`${p.x},${p.y}`, p);
  }
  return [...seen.values()];
}
