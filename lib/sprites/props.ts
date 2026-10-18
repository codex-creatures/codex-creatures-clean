// lib/sprites/props.ts
// Things lying about in Labyrinth rooms: a treasure chest
// (shut, and thrown open with gold inside) and Klutz's armoury box.
// Same text-grid format as the other sprites (lib/sprites/pixels.ts).

import type { Sprite } from "./pixels";
import { draw, T } from "./draw";
import { withArt } from "./art";

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

// A stash: a lumpy burlap sack tied at the neck…
export const BURLAP_SACK: Sprite = draw((p) => {
  p.ellipse(22, 31, 14, 11, T.sand);                                  // the sack
  p.ellipse(15, 34, 5, 5, T.sand).ellipse(29, 33, 6, 5, T.sand);      // lumps
  p.poly([[16, 21], [28, 21], [25, 14], [19, 14]], T.sand);           // neck
  p.poly([[18, 14], [26, 14], [28, 8], [22, 11], [16, 8]], T.sand);   // the gathered top
  p.line(17, 17, 27, 17, 2, T.wood);                                  // the tie
  p.path([[26, 17], [30, 20], [29, 24]], 1.4, T.wood);               // its loose end
  for (const [x, y] of [[12, 28], [18, 36], [27, 29], [32, 37], [21, 26], [24, 39]] as const) p.dot(x, y, "j"); // weave
  p.rect(26, 31, 30, 34, "l").dot(27, 32, "m").dot(29, 33, "m");      // a patch
});

// …and opened, its neck pulled wide.
export const BURLAP_SACK_OPEN: Sprite = draw((p) => {
  p.ellipse(22, 31, 14, 11, T.sand);
  p.ellipse(15, 34, 5, 5, T.sand).ellipse(29, 33, 6, 5, T.sand);
  p.ellipse(22, 21, 10, 4, T.sand);                                   // the rim, pulled open
  p.ellipse(22, 21, 7.5, 2.6, "K");                                   // dark inside
  p.path([[30, 22], [35, 25], [36, 30]], 1.4, T.wood);               // the untied cord
  for (const [x, y] of [[12, 28], [18, 36], [27, 29], [32, 37], [24, 39]] as const) p.dot(x, y, "j");
  p.rect(26, 31, 30, 34, "l").dot(27, 32, "m").dot(29, 33, "m");
});

// What a beaten boss leaves behind: a rickety old chest, its planks warped
// and one iron band snapped…
export const RICKETY_CHEST: Sprite = [
  "...dddddddddd...",
  "..dwWwdwwWwwdd..",
  ".dwwwwdwwwwwwwd.",
  ".dwwwwdwwwwwwwd.",
  "tssstddddddsssst",
  "dwwwwdwKKwwwwwwd",
  "dWwwwdwkKwwwwwWd",
  "dwwwwd.wwwwwdwwd",
  "dwwww.wwwwwwdwwd",
  "tsst..wwwwwssssd",
  "dwwwwwwwwwwwwwwd",
  "dddddddddddddddd",
];

// …and opened.
export const RICKETY_CHEST_OPEN: Sprite = [
  "...dddddddddd...",
  "..dwWwdwwWwwdd..",
  ".dwwwwdwwwwwwwd.",
  ".dddddddddddddd.",
  "tKKKKKKKKKKKKKKt",
  "dwwwwdwKKwwwwwwd",
  "dWwwwdwkKwwwwwWd",
  "dwwwwd.wwwwwdwwd",
  "dwwww.wwwwwwdwwd",
  "tsst..wwwwwssssd",
  "dwwwwwwwwwwwwwwd",
  "dddddddddddddddd",
];

// The treasure chest's PixelLab art: a crooked old chest lashed shut with
// rope (and the same chest opened). 64px art in the space of a 32px sprite.
withArt(TREASURE_CHEST, { src: "/sprites/props/treasure_chest.png", w: 64, h: 64, size: 32 });
withArt(TREASURE_CHEST_OPEN, { src: "/sprites/props/treasure_chest_open.png", w: 64, h: 64, size: 32 });

// Klutz's box: the chest the Baby Cyclops carried on its back, dropped on the
// floor with his gear poking out (one screen pixel an art pixel, like the chest).
withArt(ARMOURY_BOX, { src: "/sprites/props/klutz_box.png", w: 69, h: 74, size: 34.5 });
