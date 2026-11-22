// app/lab/props/props.ts — /lab/props's list of the Labyrinth's 3D things and where each stands, and what you
// do to walk (kept apart from PropsScene.tsx, so the page lists them without loading Three.js).

export const COLS = 5, GAP_X = 2.6, GAP_Z = 2.6;
export type PropEntry = { id: string; name: string; where: string };
// Every one, in the order they're laid out (row by row, COLS a row).
export const PROPS: PropEntry[] = [
  { id: "chest", name: "Treasure chest", where: "Chest rooms, mini bosses, the boss" },
  { id: "golden", name: "Golden chest", where: "1 in 10 mini bosses (a Gold Key opens it)" },
  { id: "stash", name: "Stash (sack)", where: "Stashes, by campfires" },
  { id: "money", name: "Money stash", where: "1 stash in 4: its gold grows with the dungeon" },
  { id: "store-crate", name: "Storehouse crate", where: "A storehouse's stores (searched)" },
  { id: "corner-crates", name: "Corner crates", where: "Rooms' corners (v17: searchable)" },
  { id: "stacked-crates", name: "Stacked crates", where: "A stockroom's stores (v18: searched)" },
  { id: "barrel", name: "Barrel", where: "Rooms' corners, a storehouse (searched)" },
  { id: "barrels", name: "Barrels (two)", where: "Rooms' corners" },
  { id: "pots", name: "Pots", where: "Rooms' corners (scenery)" },
  { id: "bookcase", name: "Bookcase", where: "Against rooms' walls, libraries" },
  { id: "broken", name: "Broken bookcase", where: "Libraries" },
  { id: "lectern", name: "Lectern", where: "Libraries" },
  { id: "table", name: "Table", where: "Rooms, now and then" },
  { id: "deck", name: "Deck of cards", where: "On a table, now and then" },
  { id: "cage", name: "Cage", where: "The Encampment's camp, encampment rooms" },
  { id: "dynamite", name: "Labyrinth Stone", where: "A storehouse's floor (glows till taken; the dynamite till 2026-11-19)" },
  { id: "campfire", name: "Campfire", where: "Campfire rooms" },
  { id: "gem", name: "Healing gem", where: "Pool rooms" },
  { id: "torch", name: "Standing torch", where: "The way to the boss" },
];
export const ROWS = Math.ceil(PROPS.length / COLS);
// How far each one reaches from its middle, across and front to back (u), for walking round it.
export const REACH: Record<string, [number, number]> = {
  chest: [0.7, 0.5], golden: [0.7, 0.5], stash: [0.4, 0.4], money: [0.45, 0.45], "store-crate": [0.7, 0.5], "corner-crates": [0.75, 0.55], "stacked-crates": [0.75, 0.55],
  barrel: [0.4, 0.4], barrels: [0.85, 0.45], pots: [0.5, 0.45], bookcase: [0.8, 0.35], broken: [0.8, 0.35], lectern: [0.35, 0.3],
  table: [0.8, 0.45], deck: [0.8, 0.45], cage: [0.6, 0.6], dynamite: [0.25, 0.25], campfire: [0.5, 0.5], gem: [0.5, 0.5], torch: [0.15, 0.15],
};
export const spotOf = (i: number) => ({ x: (i % COLS - (COLS - 1) / 2) * GAP_X, z: Math.floor(i / COLS) * GAP_Z });

// Walking: the stick's push, a tapped spot to walk to, a prop to stand by; and where you are now, for the
// camera to follow. (Plain shared objects: the page and the scene both write them, outside React's state.)
export type WalkInput = { push: { x: number; y: number } | null; target: { x: number; z: number } | null; jump: number | null };
export const WALK_INPUT: WalkInput = { push: null, target: null, jump: null };
export const FOLLOW = { x: 0, z: 0, set: false };
