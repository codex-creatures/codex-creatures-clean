// lib/render3d/props3d.ts — 🧪 drafts of more things built in 3D, after the chest (chest3d.ts), for
// /lab/chest (the user, 2026-11-11): a library's bookcase and a stash's sack. Nothing in the game
// uses them yet. Units as chest3d.ts: x across, y up, z towards you; standing on y = 0, centred.

import { ART_PER_U, ART_PITCH } from "./chest3d";

// ── The bookcase: one box with PixelLab's flat faces, drawn square on screen at 48 a unit (as the
// chest's), so its size comes from the pictures: 1.25 wide, 2 tall, 0.5 deep. As tall as you look (the
// user, 2026-11-11: "at least our character high"): your sprite is drawn stretched to stand up, so on
// screen you're as tall as a thing about 2 units high, nearly a wall (the object's 1.4 is shorter).
export const BOOKCASE_V = 2; // (a new address when a picture changes: browsers keep sprites up to an hour)
export const BOOKCASE_FACES = {
  front: { src: `/sprites/props/bookcase3d/front.png?v=${BOOKCASE_V}`, w: 60, h: 48 },
  side: { src: `/sprites/props/bookcase3d/side.png?v=${BOOKCASE_V}`, w: 24, h: 48 },
  top: { src: `/sprites/props/bookcase3d/top.png?v=${BOOKCASE_V}`, w: 60, h: 21 },
};
export function bookcaseArt() {
  const F = BOOKCASE_FACES, up = ART_PER_U * Math.cos(ART_PITCH), flat = ART_PER_U * Math.sin(ART_PITCH);
  return { width: F.front.w / ART_PER_U, height: F.front.h / up, depth: F.top.h / flat };
}

// ── The sack: a bag's outline (radius, height) turned round its middle, with few sides so it stays
// chunky, like pixel art; a rope tied round its neck. 0.6 tall, as the object is.
export const SACK_SIDES = 8;       // 🧪 faces round it
export const SACK_TALL = 0.6;
export const SACK_V = 1;
export const SACK_CLOTH = { src: `/sprites/props/sack3d/burlap.png?v=${SACK_V}`, w: 48, h: 48 };
// From the bottom up: the base, the belly, in to the neck where it's tied, and the tuft above the tie.
const SACK_OUTLINE: [number, number][] = [
  [0, 0], [0.2, 0.005], [0.3, 0.08], [0.33, 0.2], [0.31, 0.31], [0.24, 0.4], [0.13, 0.46],
  [0.07, 0.49], [0.08, 0.52], [0.13, 0.57], [0.1, 0.6], [0, 0.59],
];
export const SACK_NECK = { y: 0.49, r: 0.075, rope: 0.022 }; // where the rope's tied, and its thickness
export const sackOutline = (): [number, number][] => SACK_OUTLINE.map(([r, y]) => [r, y]);
