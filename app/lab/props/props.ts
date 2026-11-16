// app/lab/props/props.ts — /lab/props's list of the Labyrinth's 3D things and where each stands, and what you
// do to walk (kept apart from PropsScene.tsx, so the page lists them without loading Three.js).

export const COLS = 5, GAP_X = 2.6, GAP_Z = 2.6;
export type PropEntry = { id: string; name: string; where: string };
// Every one, in the order they're laid out (row by row, COLS a row).
export const PROPS: PropEntry[] = [
  { id: "chest", name: "Treasure chest", where: "Chest rooms, mini bosses, the boss" },
  { id: "golden", name: "Golden chest", where: "1 in 10 mini bosses (a Gold Key opens it)" },
  { id: "stash", name: "Stash (sack)", where: "Stashes, by campfires" },
  { id: "store-crate", name: "Storehouse crate", where: "A storehouse's stores (searched)" },
  { id: "corner-crates", name: "Corner crates", where: "Rooms' corners (v17: searchable)" },
  { id: "barrels", name: "Barrels", where: "Rooms' corners, a storehouse" },
  { id: "pots", name: "Pots", where: "Rooms' corners (scenery)" },
  { id: "bookcase", name: "Bookcase", where: "Against rooms' walls, libraries" },
  { id: "broken", name: "Broken bookcase", where: "Libraries" },
  { id: "lectern", name: "Lectern", where: "Libraries" },
  { id: "table", name: "Table", where: "Rooms, now and then" },
  { id: "deck", name: "Deck of cards", where: "On a table, now and then" },
  { id: "cage", name: "Cage", where: "The Encampment's camp, encampment rooms" },
  { id: "dynamite", name: "Dynamite", where: "A storehouse's floor (glows till taken)" },
  { id: "campfire", name: "Campfire", where: "Campfire rooms" },
  { id: "gem", name: "Healing gem", where: "Pool rooms" },
  { id: "torch", name: "Standing torch", where: "The way to the boss" },
];
export const ROWS = Math.ceil(PROPS.length / COLS);
export const spotOf = (i: number) => ({ x: (i % COLS - (COLS - 1) / 2) * GAP_X, z: Math.floor(i / COLS) * GAP_Z });

// Walking: the stick's push, a tapped spot to walk to, a prop to stand by; and where you are now, for the
// camera to follow. (Plain shared objects: the page and the scene both write them, outside React's state.)
export type WalkInput = { push: { x: number; y: number } | null; target: { x: number; z: number } | null; jump: number | null };
export const WALK_INPUT: WalkInput = { push: null, target: null, jump: null };
export const FOLLOW = { x: 0, z: 0, set: false };
