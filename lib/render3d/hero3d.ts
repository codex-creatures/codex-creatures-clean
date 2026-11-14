// lib/render3d/hero3d.ts — 🧪 a draft 3D you (the user, 2026-11-14: "ideally it would be the first 3D
// model"; the sprite flickered between views walking diagonally, and only has four). For /lab/hero
// only: the game still draws the sprite (WALK_HERO). Boxes, as the 3D chest and bookcase are, in the
// Cloaked torchbearer's own colours (public/sprites/walk/hero-e.png): a green hood and cloak, a pale
// face with blue eyes, pale breeches, brown boots, a torch in the left hand. It turns smoothly to
// any way you walk, and swings its legs and arms as you go.
// Units: x across, y up, z towards the camera (facing south: +z), standing on y = 0. Built HERO_TALL
// high as the sprite's figure is (48 px at 32 a unit); the scene stretches it up by uprightStretch,
// as the sprites are, so it stands as tall on screen.

export const HERO_TALL = 1.5;             // u, hood tip to boot soles (the sprite's figure)
export const SWING = { leg: 0.55, arm: 0.45, torchArm: 0.15, bob: 0.03 }; // radians, and u of bob 🧪
export const TORCH_RAISE = -0.6;          // radians: the torch arm held forward
export const TURN_RATE = 10;              // of the way round to where you're walking, a second (eased) 🧪
export const STRIDE_U = 1.5;              // u walked a full cycle (two steps), as the sprite's STRIDE

// The colours, picked from the sprite sheet.
export const HERO_COLOURS = {
  hood: "#5b784b", hoodShade: "#516f3f", cloak: "#476237", tunic: "#597e46", sleeve: "#577943",
  skin: "#f6cbb9", eyes: "#4674b7", breeches: "#e3b1a2", boots: "#6a4437", belt: "#886045",
  stick: "#6a4437", flame: "#f6c873", core: "#fbfbf6",
} as const;
export type HeroColour = keyof typeof HERO_COLOURS;

// A box: its size and middle (in its limb's own space, from the limb's pivot), and its colour.
// `glow`: drawn full bright, unlit (the torch's flame).
export type HeroBox = { size: [number, number, number]; at: [number, number, number]; colour: HeroColour; glow?: true };
export type Limb = "body" | "legL" | "legR" | "armL" | "armR";
// Where each limb turns from (hip, shoulder), in the body's space; the body's own is its feet.
export const PIVOTS: Record<Limb, [number, number, number]> = {
  body: [0, 0, 0], legL: [0.09, 0.44, 0], legR: [-0.09, 0.44, 0], armL: [0.27, 0.84, 0], armR: [-0.27, 0.84, 0],
};
// (Left and right are yours: facing the camera, your left is on screen right, with the torch.)
export const HERO_PARTS: Record<Limb, HeroBox[]> = {
  body: [
    { size: [0.44, 0.42, 0.26], at: [0, 0.65, 0], colour: "tunic" },
    { size: [0.46, 0.05, 0.28], at: [0, 0.47, 0], colour: "belt" },
    { size: [0.52, 0.72, 0.05], at: [0, 0.68, -0.16], colour: "cloak" },
    { size: [0.42, 0.4, 0.4], at: [0, 1.06, -0.01], colour: "hood" },
    { size: [0.3, 0.22, 0.02], at: [0, 1.02, 0.2], colour: "skin" },
    { size: [0.05, 0.05, 0.01], at: [0.07, 1.05, 0.215], colour: "eyes" },
    { size: [0.05, 0.05, 0.01], at: [-0.07, 1.05, 0.215], colour: "eyes" },
    { size: [0.44, 0.06, 0.06], at: [0, 1.15, 0.19], colour: "hoodShade" },
    { size: [0.16, 0.16, 0.16], at: [0, 1.32, -0.1], colour: "hoodShade" },
  ],
  legL: [{ size: [0.15, 0.3, 0.16], at: [0, -0.15, 0], colour: "breeches" }, { size: [0.16, 0.14, 0.2], at: [0, -0.37, 0.02], colour: "boots" }],
  legR: [{ size: [0.15, 0.3, 0.16], at: [0, -0.15, 0], colour: "breeches" }, { size: [0.16, 0.14, 0.2], at: [0, -0.37, 0.02], colour: "boots" }],
  armL: [
    { size: [0.12, 0.34, 0.14], at: [0, -0.17, 0], colour: "sleeve" },
    { size: [0.11, 0.09, 0.12], at: [0, -0.38, 0], colour: "skin" },
    { size: [0.05, 0.36, 0.05], at: [0, -0.3, 0.1], colour: "stick" },
    { size: [0.13, 0.15, 0.13], at: [0, -0.06, 0.1], colour: "flame", glow: true },
    { size: [0.06, 0.09, 0.06], at: [0, -0.07, 0.17], colour: "core", glow: true },
  ],
  armR: [{ size: [0.12, 0.34, 0.14], at: [0, -0.17, 0], colour: "sleeve" }, { size: [0.11, 0.09, 0.12], at: [0, -0.38, 0], colour: "skin" }],
};
// The torch's flame, in the left arm's space: where its light comes from.
export const FLAME_AT: [number, number, number] = [0, -0.06, 0.1];

// The pose `walked` u into a walk (moving) or standing: each limb's swing (radians about x, forward
// positive... legs and the free arm opposite, the torch arm held forward and barely swinging) and the bob.
export function heroPose(walked: number, moving: boolean): { swing: Record<Limb, number>; bob: number } {
  const s = moving ? Math.sin((walked / STRIDE_U) * Math.PI * 2) : 0;
  return {
    swing: { body: 0, legL: s * SWING.leg, legR: -s * SWING.leg, armR: s * SWING.arm, armL: TORCH_RAISE - s * SWING.torchArm },
    bob: moving ? Math.abs(s) * SWING.bob : 0,
  };
}

// Turning towards the way you walk: `from` eased round to `to` (radians about y, 0 facing the
// camera), the short way, TURN_RATE of the way a second.
export function turnToward(from: number, to: number, dt: number): number {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + d * Math.min(1, dt * TURN_RATE);
}
// Which way about y faces a walk of (dx, dz): 0 is towards the camera (+z).
export const yawOf = (dx: number, dz: number) => Math.atan2(dx, dz);
