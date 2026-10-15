// lib/sprites/icons.ts
// Small pixel icons for moves: the style of attack (a sword, a bow, a staff)
// and how it hurts (a blunt impact, an arrowhead, an arcane spark). Same
// text-grid format as the other sprites (lib/sprites/pixels.ts).

import type { Sprite } from "./pixels";
import type { CombatClass, DamageType } from "../creatures/creatureData";

export const STYLE_ICONS: Record<CombatClass, Sprite> = {
  // A sword, point up and to the right.
  melee: [
    ".......SS",
    "......SSs",
    ".....SSs.",
    "....SSs..",
    ".g.SSs...",
    "..gSs....",
    "..lg.....",
    ".l..g....",
    "l........",
  ],
  // A bow with an arrow nocked.
  ranged: [
    "..W......",
    ".Wdh.....",
    ".W..h....",
    "W....h...",
    "W.ttttSSS",
    "W....h...",
    ".W..h....",
    ".Wdh.....",
    "..W......",
  ],
  // A staff topped with a glowing orb.
  magic: [
    ".....uCu.",
    ".....ChC.",
    ".....uCu.",
    "....w....",
    "...w.....",
    "..w......",
    ".w.......",
    "w........",
  ],
};

export const DAMAGE_ICONS: Record<DamageType, Sprite> = {
  // Force: a blunt impact.
  force: [
    "...a...",
    ".a.A.a.",
    "..AyA..",
    "aAyyyAa",
    "..AyA..",
    ".a.A.a.",
    "...a...",
  ],
  // Pierce: an arrowhead.
  pierce: [
    "....S...",
    "....SS..",
    "ttttSSS.",
    "WWWWSSSS",
    "ttttSSS.",
    "....SS..",
    "....S...",
  ],
  // Arcane: a magic spark.
  arcane: [
    "....P....",
    "....P....",
    "...pHp...",
    "PPpHHHpPP",
    "...pHp...",
    "....P....",
    "....P....",
  ],
};
