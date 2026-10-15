// lib/sprites/props.ts
// Things lying about in Labyrinth rooms: a pirate-style treasure chest
// (shut, and thrown open with gold inside) and Klutz's armoury box.
// Same text-grid format as the other sprites (lib/sprites/pixels.ts).

import type { Sprite } from "./pixels";

// A domed wooden chest with gold bands and a lock.
export const TREASURE_CHEST: Sprite = [
  "..dddddddddddd..",
  ".dWWWWgWWgWWWWd.",
  "dWwwwwgwwgwwwwWd",
  "dwwwwwgwwgwwwwwd",
  "gGgggggggggggGgg",
  "dwwwwwgGGgwwwwwd",
  "dWwwwwgkkgwwwwWd",
  "dwwwwwgGkgwwwwwd",
  "dwwwwwwggwwwwwwd",
  "dWwwwwwwwwwwwwWd",
  "gGggggggggggggGg",
  "dddddddddddddddd",
];

// …and opened: the lid thrown back, gold heaped inside.
export const TREASURE_CHEST_OPEN: Sprite = [
  "..dddddddddddd..",
  ".dWWWWgWWgWWWWd.",
  "dwwwwwgwwgwwwwwd",
  "dddddddddddddddd",
  ".GgGyGgGGgGyGgG.",
  "gGgggGgggggGgggg",
  "dwwwwwgGGgwwwwwd",
  "dWwwwwgkkgwwwwWd",
  "dwwwwwwggwwwwwwd",
  "dWwwwwwwwwwwwwWd",
  "gGggggggggggggGg",
  "dddddddddddddddd",
];

// Klutz's battered armoury box: a crate with iron bands, a sword hilt
// sticking out of the lid.
export const ARMOURY_BOX: Sprite = [
  ".........S....",
  "........gsg...",
  ".........s....",
  "dddddddddsdddd",
  "dWwwwwwwwwwwWd",
  "tsssssssssssst",
  "dwwwwwwwwwwwwd",
  "dwwwwwKKwwwwwd",
  "dwwwwwwwwwwwwd",
  "tsssssssssssst",
  "dWwwwwwwwwwwWd",
  "dddddddddddddd",
];
