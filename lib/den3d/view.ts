// lib/den3d/view.ts
// Where the new Den's view was left (components/Den3D.tsx), for this visit to the site: coming back from a place
// opens where you were, as you left it; a run in the Labyrinth forgets it, so you're back in the middle of the
// Den after one (the user, 2026-11-18: "centre when you first visit / come back from a run, but not every
// time you interact with something"). Per tab, never saved.

import type { Pt } from "../dungeon/floorplan";

export type DenView = { at: Pt; across: number; opened: boolean };
let last: DenView | null = null;
export const denView = () => last;
export const keepDenView = (v: DenView) => { last = v; };
export const forgetDenView = () => { last = null; };
