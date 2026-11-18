// lib/den3d/art.ts
// 🧪 The new Den's pictures (public/sprites/den3d/, PixelLab: public/sprites/PIXELLAB.md), samples till the
// user approves them. Drawn as the Labyrinth's 3D things are (world/rendering.md §4.8): square on screen at
// 48 art pixels a unit, so every size here comes from its picture, never rescaled. A face standing up shows
// cos 60° of its height on screen, so an upright face is 24 art pixels a unit tall (FACE_PX); a top seen from
// above, sin 60° of its depth (TOP_PX).

export const ART_PX = 48;                              // across, every surface
export const FACE_PX = ART_PX * Math.cos(Math.PI / 3); // up a standing face
export const TOP_PX = ART_PX * Math.sin(Math.PI / 3);  // along a top, north to south
const V = 1; // (a new address when a picture changes: browsers keep sprites up to an hour)
export type Pic = { src: string; w: number; h: number };
const pic = (name: string, w: number, h: number): Pic => ({ src: `/sprites/den3d/${name}.png?v=${V}`, w, h });

// The buildings: a front (the wall, its door and windows; as wide as the building, as tall as its walls) and
// a roof (the slope facing you, eave at the bottom, ridge at the top), the roof `rise` u high.
export type BuildingArt = { front: Pic; broken?: Pic; roof: Pic; rise: number };
export const BUILDINGS: Record<"shack" | "storehouse" | "tavern", BuildingArt> = {
  shack: { front: pic("shack-front", 156, 48), roof: pic("shack-roof", 156, 80), rise: 1 },
  storehouse: { front: pic("storehouse-front", 164, 48), roof: pic("storehouse-roof", 164, 84), rise: 1 },
  tavern: { front: pic("tavern-front", 232, 48), broken: pic("tavern-broken-front", 232, 48), roof: pic("tavern-roof", 232, 96), rise: 1.1 },
};
// A building's size from its front: its width, and its walls' height.
export const buildingWide = (b: BuildingArt) => b.front.w / ART_PX;
export const buildingWalls = (b: BuildingArt) => b.front.h / FACE_PX;

// Standing pictures (the altar), flat tops (the pool, the pits, seen from above, their dummy and spikes in the
// picture) and pictures on the north wall (the passage's arch, the portal, the board's notes).
export const ALTAR = pic("altar", 105, 122);
export const POOL_TOP = pic("pool-top", 95, 63);
export const PIT_TOP = pic("pit-top", 125, 115);
export const SPARRING_TOP = pic("sparring-top", 125, 129);
export const ARCH = pic("arch", 138, 73);
export const PORTAL = pic("portal", 76, 81);
export const NOTES = pic("board", 53, 39);
export const PORTAL_ARCH = pic("portal-arch", 138, 73); // (the arch, mirrored and turned green: scripts/den-parts.mjs)
// The holes under the arches, dark into the rock (each arch's open middle: scripts/den-parts.mjs).
export const ARCH_HOLE = pic("arch-hole", 138, 73);
export const PORTAL_HOLE = pic("portal-hole", 138, 73);

// The 3D models' parts (the user, 2026-11-19: "the Soul Altar, the pool and the sparring pits need 3D models"),
// cut from their approved pictures (scripts/den-parts.mjs) so the models keep those designs.
const part = (name: string, w: number, h: number): Pic => ({ src: `/sprites/den3d/parts/${name}.png?v=${V}`, w, h });
export const PARTS = {
  fire: part("altar-fire", 72, 50),       // the altar's soul fire, its spirits rising
  skull: part("altar-skull", 34, 26),     // the horned skull on the cauldron
  lantern: part("altar-lantern", 13, 28), // a teal lantern at the plinth's corners
  water: part("pool-water", 48, 34),      // the pool's water, its lily pads
  sand: part("sand", 40, 40),             // the sparring pit's sand
  stone: part("pit-stone", 48, 24),       // the pits' low walls (the Labyrinth's grey stone)
  dummy: part("dummy", 30, 56),           // the sparring pit's dummy (PixelLab, styled on the old one)
};
