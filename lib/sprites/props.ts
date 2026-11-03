// lib/sprites/props.ts
// Things lying about in Labyrinth rooms, and the people who wander them: all
// PixelLab art (public/sprites/props and npcs). Each sprite's grid is a single
// dot: there's no older drawing to fall back on.

import type { Sprite } from "./pixels";
import { withArt } from "./art";

const prop = (file: string, w: number, h: number, size: number): Sprite =>
  withArt(["."], { src: `/sprites/props/${file}.png`, w, h, size });

// A treasure chest: a crooked old chest lashed shut with rope (and the same
// chest opened), at three quarters of its size.
export const TREASURE_CHEST = prop("treasure_chest", 64, 64, 48);
export const TREASURE_CHEST_OPEN = prop("treasure_chest_open", 64, 64, 48);

// Klutz's box: the chest the Baby Cyclops carried on its back, dropped on the
// floor with his gear poking out (at about three quarters of its size, like the chest).
export const ARMOURY_BOX = prop("klutz_box", 69, 74, 50);

// The Labyrinth's wanderers (public/sprites/npcs), standing in their rooms:
// the merchant with his overstuffed pack, the librarian and his book cart, the
// card witch at her table. Drawn at the art's own pixel size.
// walk: where the still sits in each 96×96 frame of its walk (PixMiniMax, 8
// frames), for the merchant, librarian and collector strolling round the tavern's room.
const npc = (id: string, w: number, h: number, walk?: { x: number; y: number }): Sprite => withArt(["."], {
  src: `/sprites/npcs/${id}.png`, w, h,
  walk: walk && { src: `/sprites/npcs/${id}-walk.png`, frames: 8, w: 96, h: 96, ...walk },
});
export const MERCHANT = npc("merchant", 77, 91, { x: 9, y: 3 });
export const LIBRARIAN = npc("librarian", 90, 89, { x: 3, y: 5 });
export const COLLECTOR = npc("collector", 76, 92, { x: 7, y: 2 }); // the tavern's creature collector
export const CARD_WITCH = npc("witch", 78, 92);

// Loot lying about (drawn at about three quarters of its size): a fight's
// grubby sack and a boss's rickety chest, shut and opened; a treasure room's
// pile of gold; the deck of cards on its crate.
export const BURLAP_SACK = prop("burlap_sack", 54, 56, 42);
export const BURLAP_SACK_OPEN = prop("burlap_sack_open", 54, 50, 42);
export const RICKETY_CHEST = prop("rickety_chest", 56, 53, 46);
export const RICKETY_CHEST_OPEN = prop("rickety_chest_open", 56, 59, 46);
export const TREASURE_PILE = prop("treasure_pile", 58, 37, 44);
export const CARD_DECK = prop("card_deck", 55, 58, 42);
// The Warden's strongbox (the Deep Labyrinth's boss chest): blackened iron,
// chains and a teal-glowing lock — shut, and thrown open.
export const STRONGBOX = prop("warden_strongbox", 60, 60, 50);
export const STRONGBOX_OPEN = prop("warden_strongbox_open", 61, 62, 50);
// A healing pool's ring of stones round its glowing water (shown dimmed once used).
export const HEALING_POOL = prop("healing_pool", 68, 37, 110);
