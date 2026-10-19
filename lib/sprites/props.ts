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
// rope (and the same chest opened), at three quarters of its size.
withArt(TREASURE_CHEST, { src: "/sprites/props/treasure_chest.png", w: 64, h: 64, size: 48 });
withArt(TREASURE_CHEST_OPEN, { src: "/sprites/props/treasure_chest_open.png", w: 64, h: 64, size: 48 });

// Klutz's box: the chest the Baby Cyclops carried on its back, dropped on the
// floor with his gear poking out (at about three quarters of its size, like the chest).
withArt(ARMOURY_BOX, { src: "/sprites/props/klutz_box.png", w: 69, h: 74, size: 50 });

// The Labyrinth's wanderers (PixelLab art, public/sprites/npcs), standing in
// their rooms: the merchant with his overstuffed pack, the librarian and his
// book cart, the card witch at her table. Drawn at the art's own pixel size.
// (Their grid is a single dot: there's no older drawing to fall back on.)
const npc = (id: string, w: number, h: number): Sprite => withArt(["."], { src: `/sprites/npcs/${id}.png`, w, h });
export const MERCHANT = npc("merchant", 77, 91);
export const LIBRARIAN = npc("librarian", 90, 89);
export const CARD_WITCH = npc("witch", 78, 92);

// Loot lying about (PixelLab art, drawn at about three quarters of its size):
// a fight's grubby sack and a boss's rickety chest, shut and opened;
// a treasure room's pile of gold; the deck of cards on its crate.
withArt(BURLAP_SACK, { src: "/sprites/props/burlap_sack.png", w: 54, h: 56, size: 42 });
withArt(BURLAP_SACK_OPEN, { src: "/sprites/props/burlap_sack_open.png", w: 54, h: 50, size: 42 });
withArt(RICKETY_CHEST, { src: "/sprites/props/rickety_chest.png", w: 56, h: 53, size: 46 });
withArt(RICKETY_CHEST_OPEN, { src: "/sprites/props/rickety_chest_open.png", w: 56, h: 59, size: 46 });
// The Warden's strongbox (the Deep Labyrinth's boss chest): blackened iron,
// chains and a teal-glowing lock — shut, and thrown open.
export const STRONGBOX: Sprite = withArt(["."], { src: "/sprites/props/warden_strongbox.png", w: 60, h: 60, size: 50 });
export const STRONGBOX_OPEN: Sprite = withArt(["."], { src: "/sprites/props/warden_strongbox_open.png", w: 61, h: 62, size: 50 });
export const TREASURE_PILE: Sprite = withArt(["."], { src: "/sprites/props/treasure_pile.png", w: 58, h: 37, size: 44 });
export const CARD_DECK: Sprite = withArt(["."], { src: "/sprites/props/card_deck.png", w: 55, h: 58, size: 42 });
// A healing pool's ring of stones round its glowing water (shown dimmed once used).
export const HEALING_POOL: Sprite = withArt(["."], { src: "/sprites/props/healing_pool.png", w: 68, h: 37, size: 110 });
