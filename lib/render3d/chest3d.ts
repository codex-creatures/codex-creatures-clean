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
