// lib/render3d/chest3d.ts — 🧪 a draft of a chest built in 3D (the user, 2026-11-11), for
// /lab/chest: plain boxes for the shape, with the detail to come from flat art laid on them
// (48 art pixels a unit, decision 37). Nothing in the game uses it yet.
// Units are world units; x across, y up, z towards you (south). The chest stands on y = 0,
// centred on x = 0 and z = 0, its back at z = -depth / 2. The lid's boxes are given from the
// hinge (along its back top edge), so opening it is one turn about x.

export type ChestMat = "wood" | "iron" | "gold" | "inside";
export type Box = { x: number; y: number; z: number; w: number; h: number; d: number; mat: ChestMat };
export type Chest = { body: Box[]; lid: Box[]; hinge: { y: number; z: number }; width: number; depth: number; height: number };

export const CHEST_W = 1.25;      // 🧪 units across (the objects' def is 0.8 u tall; the old picture is drawn 1.75 u wide)
export const DEPTH_OF_W = 0.64;   // depth for its width
export const BODY_OF_H = 0.66;    // share of the height that's the body (the rest the lid)
export const HEIGHT_OF_W = 0.64;  // height for its width (0.8 u at CHEST_W)
export const BAND = 0.035;        // how far the iron bands and corners stand proud of the wood
export const OPEN_ANGLE = 1.9;    // radians the lid turns back, open (a little past upright)

// ── The painted chest: two boxes, the body and the lid, with PixelLab's flat faces on them ──
// The faces are drawn square on screen at 48 art pixels a unit (decision 37): across, 48 a unit;
// up an upright face, 48 × cos(pitch) a unit; front to back on a top, 48 × sin(pitch). So the boxes'
// sizes come from the pictures. The front picture is the lid's front edge (its top `lid` rows) over
// the body's front; the side picture is the same, for the chest's ends.
export const ART_PER_U = 48;
export const ART_PITCH = Math.PI / 3;
// (`?v=`: a new address when a picture changes, as browsers keep sprites up to an hour: next.config.ts.)
export const ART_V = 4;
export const ART_FACES = {
  front: { src: `/sprites/props/chest3d/front.png?v=${ART_V}`, w: 60, h: 19, lid: 6 },
  side: { src: `/sprites/props/chest3d/side.png?v=${ART_V}`, w: 38, h: 19 },
  inside: { src: `/sprites/props/chest3d/inside.png?v=${ART_V}`, w: 60, h: 33 }, // looking down into it, open: the body's top
  top: { src: `/sprites/props/chest3d/top.png?v=${ART_V}`, w: 60, h: 33 },
};

export type ChestFaces = { front: { src: string; w: number; h: number; lid: number }; side: { src: string; w: number; h: number }; inside: { src: string; w: number; h: number }; top: { src: string; w: number; h: number } };
export function chestArt(F: ChestFaces = ART_FACES) {
  const up = ART_PER_U * Math.cos(ART_PITCH), flat = ART_PER_U * Math.sin(ART_PITCH);
  return { width: F.front.w / ART_PER_U, depth: F.top.h / flat, lid: F.front.lid / up, body: (F.front.h - F.front.lid) / up };
}

// How far the lid reaches behind the chest's back, open at `angle` (its far top corner, turned past
// upright): about 0.5 u, further back than the floor behind the chest's own panel starts.
export function lidReachBack(angle = OPEN_ANGLE): number {
  const a = chestArt();
  return Math.max(0, a.lid * Math.sin(angle) - a.depth * Math.cos(angle), a.lid * Math.sin(angle), -a.depth * Math.cos(angle));
}
// So you, standing on the panel behind an open chest, are drawn behind its lid, not over its top
// edge (the user, 2026-11-11: you were "on top of the lid"): the chest is drawn this much nearer the
// camera (u along the view) than it stands. Only its depth: it's drawn where it was. Enough for the
// lid's reach past you, there (tests/chest3d.test.ts), and far short of a panel, so you in front of
// it or beside it still are.
export const CHEST_NUDGE = 0.35;

export function chestParts(width = CHEST_W): Chest {
  const W = width, D = W * DEPTH_OF_W, H = W * HEIGHT_OF_W, hb = H * BODY_OF_H, hl = H - hb;
  const b = BAND, bandW = W * 0.07, bandX = W * 0.3, wall = W * 0.06;
  const body: Box[] = [
    // The wood, left open at the top so the inside shows when the lid's up.
    { x: 0, y: wall / 2, z: 0, w: W, h: wall, d: D, mat: "wood" },               // floor
    { x: 0, y: hb / 2, z: D / 2 - wall / 2, w: W, h: hb, d: wall, mat: "wood" },  // front
    { x: 0, y: hb / 2, z: -D / 2 + wall / 2, w: W, h: hb, d: wall, mat: "wood" }, // back
    { x: -W / 2 + wall / 2, y: hb / 2, z: 0, w: wall, h: hb, d: D - 2 * wall, mat: "wood" },
    { x: W / 2 - wall / 2, y: hb / 2, z: 0, w: wall, h: hb, d: D - 2 * wall, mat: "wood" },
    { x: 0, y: wall + 0.001, z: 0, w: W - 2 * wall, h: 0.002, d: D - 2 * wall, mat: "inside" },
    // A heap of gold inside, under the rim.
    { x: 0, y: hb * 0.6, z: 0, w: W - 2 * wall - 0.02, h: 0.04, d: D - 2 * wall - 0.02, mat: "gold" },
    // Iron: two bands round it, and the four upright corners.
    ...[-bandX, bandX].map((x) => ({ x, y: hb / 2 + 0.001, z: 0, w: bandW, h: hb + 0.002, d: D + 2 * b, mat: "iron" as const })),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: sx * (W / 2 - bandW / 2 + b / 2), y: hb / 2, z: sz * (D / 2 - bandW / 2 + b / 2), w: bandW + b, h: hb, d: bandW + b, mat: "iron" as const }))),
    // The lock plate on the front, under the lid.
    { x: 0, y: hb - W * 0.07, z: D / 2 + b, w: W * 0.13, h: W * 0.14, d: b * 2, mat: "gold" },
  ];
  // The lid, from the hinge: it reaches forward (z +) over the body.
  const lid: Box[] = [
    { x: 0, y: hl / 2, z: D / 2, w: W, h: hl, d: D, mat: "wood" },
    ...[-bandX, bandX].map((x) => ({ x, y: hl / 2 + b / 2, z: D / 2, w: bandW, h: hl + b, d: D + 2 * b, mat: "iron" as const })),
    { x: 0, y: W * 0.02, z: D + b, w: W * 0.09, h: W * 0.1, d: b * 2, mat: "gold" }, // the hasp
  ];
  return { body, lid, hinge: { y: hb, z: -D / 2 }, width: W, depth: D, height: H };
}
