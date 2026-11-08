// lib/world/policy.ts
// The temporary rules that come from movement being on panels (docs/world-
// spec.md §5.1, §8 2b-2 stage A), kept apart from the occupancy map
// (occupancy.ts), which holds things as they physically are. When movement
// goes finer, these change and the map doesn't.
//
// - navBlocked: walking reads a panel as blocked if any subcell in it is
//   stone or blocking (or it's rock);
// - canStand: a creature starts with its feet on a panel's centre;
// - oneSolidPerPanel: the generator puts a solid thing inside one panel, and
//   one in a panel (world version 4 on);
// - PanelClaims: world version 3's rule, every floor thing taking its whole
//   panel (kept so a v3 run is placed and mended exactly as it was).

import type { Pt } from "../dungeon/floorplan";
import { footprintCells, footprintPanels, subcellOfPanel, type Size } from "./grid";
import { isFloor, panelCells, panelKey, occupant, subKey, layerOf, type Occupancy } from "./occupancy";
import type { ObjectDef } from "./objects";

type Sub = { sx: number; sy: number };

// 🕒 While walking is on panels: blocked if rock, or anything stone or blocking in it.
export function navBlocked(o: Occupancy, p: Pt): boolean {
  const t = p.x < 0 || p.y < 0 || p.x >= o.fp.w || p.y >= o.fp.h ? 0 : o.fp.tiles[p.y * o.fp.w + p.x];
  return t === 0 || panelCells(p).some((c) => !!occupant(o, "structure", c) || !!occupant(o, "blocking", c));
}

// 🕒 World version 3: every floor thing claims its whole panel.
export type PanelClaims = Map<string, string>;
export const claimedBy = (claims: PanelClaims | null, panels: Pt[]) => {
  if (!claims) return null;
  for (const p of panels) if (claims.has(panelKey(p))) return `on ${claims.get(panelKey(p))}'s panel`;
  return null;
};
export const claim = (claims: PanelClaims | null, panels: Pt[], owner: string) => { if (claims) for (const p of panels) claims.set(panelKey(p), owner); };

// 🕒 World version 4 on, while walking is on panels: a solid thing stays inside
// one panel, and a panel holds one solid thing (the user, 2026-11-08).
export function oneSolidPerPanel(o: Occupancy, def: ObjectDef, at: Sub, size: Size): string | null {
  if (layerOf(def) !== "blocking") return null;
  const panels = footprintPanels(at, size);
  if (panels.length > 1) return "a solid thing across a panel's edge (policy)";
  const mine = new Set(footprintCells(at, size).map((c) => subKey(c.sx, c.sy)));
  for (const c of panelCells(panels[0])) if (!mine.has(subKey(c.sx, c.sy)) && occupant(o, "blocking", c)) return "a second solid thing in its panel (policy)";
  return null;
}

// 🕒 Why someone (a foe, the witch) can't start on this panel, feet on its
// centre, or null: on the floor, not blocked, nothing lying on its centre, not
// in a doorway or on a spot kept for another (owner: the spot kept for them).
export function canStand(o: Occupancy, p: Pt, owner?: string, claims: PanelClaims | null = null): string | null {
  if (!isFloor(o, p)) return "off the floor";
  if (navBlocked(o, p)) return "on something solid";
  const claimed = claimedBy(claims, [p]);
  if (claimed) return claimed;
  const mid = { sx: subcellOfPanel(p.x), sy: subcellOfPanel(p.y) };
  const on = occupant(o, "walk-over", mid);
  if (on) return `on ${on}`;
  const r = o.reserved.get(panelKey(p));
  if (r && r.owner !== owner && r.why !== "path") return r.why === "door" ? "in a doorway" : `on the spot kept for ${r.owner}`;
  return null;
}
