// lib/den3d/objects.ts
// The Den's places, by id: what the Den (components/Den3D.tsx, lib/den3d/layout.ts) and Klutz's tour
// (lib/tour.ts) point at. The ids are the old Den's (lib/den/scene.ts, removed 2026-11-24), kept as
// they were so nothing that names one changes.

export const OBJ = {
  none: 0, pit: 1, chest: 2, altar: 3, merchant: 4, quests: 5, bag: 6, arch: 7, scroll: 8, cage: 9, pool: 10, tavern: 11, klutz: 12, bookcase: 13, crate: 14,
} as const;
export type ObjId = (typeof OBJ)[keyof typeof OBJ];

// Where Klutz is: wandering the Den, soaking in the pool, or away exploring.
export type KlutzMode = "home" | "pool" | "away";

// The rubble between the Den and the tavern: still shut; shut, and you've the dynamite; blown open.
export type Rubble = "shut" | "dynamite" | "open";
// Whoever's visiting the tavern: their window (tapped in its room).
export const VISITOR_HREF = "/visitor";
