// lib/sprites/bestiary.ts
// Creature sprites drawn in code on the fine grid (44×44; see draw.ts).
// Each race has a look:
// - Beast: fur and hide, claws, warm natural colours.
// - Under-dweller: stone, crystal and rust; eyes that glow in the dark.
// - Etherial: floating, glowing and see-through, with sparkles; no feet.
// - Undead: bone, rags and rot, with sickly green glowing eyes.
// - Elvish: leaf greens with gold trim, hoods, bows and blades.

import { draw, T, type Tone } from "./draw";
import type { Sprite } from "./pixels";

const STEEL: Tone = ["S", "s", "t"];
const RUST: Tone = ["A", "r", "x"];
const ORANGE: Tone = ["A", "a", "F"];
const HIDE: Tone = ["s", "t", "n"]; // elephant grey

export const BESTIARY: Record<string, Sprite> = {
  // ── Beasts ───────────────────────────────────────────────────────
  moss_wolf: draw((p) => {
    p.path([[36, 24], [40, 18], [41, 12]], 4, T.grey);                       // tail
    for (const x of [13, 18, 28, 33]) p.rect(x, 29, x + 2, 39, T.grey);       // legs
    for (const x of [12, 17, 27, 32]) p.rect(x, 39, x + 3, 40, "t");          // paws
    p.ellipse(24, 25, 13, 7.5, T.grey);                                       // body
    p.ellipse(12, 19, 7, 6, T.grey);                                          // head
    p.poly([[2, 21], [8, 17], [11, 25], [3, 24]], T.grey);                    // snout
    p.poly([[9, 14], [11, 6], [14, 13]], T.grey).poly([[10, 12], [11, 8], [12, 12]], "z");
    p.poly([[13, 13], [16, 7], [18, 14]], T.grey);
    p.dot(2, 21, "k").dot(3, 21, "k");                                        // nose
    p.line(4, 24, 9, 24, 1, "n");                                             // mouth
    p.dot(8, 18, "A").dot(9, 18, "k");                                        // eye
    p.poly([[6, 25], [9, 31], [12, 26], [14, 32], [16, 26]], T.grey);         // chest ruff
    p.ellipse(22, 19.5, 5, 2, T.leaf).ellipse(31, 22, 3.5, 2, T.leaf).ellipse(14, 15, 2.5, 1.5, T.leaf).ellipse(26, 28, 2, 1.2, "e");
    p.dot(21, 18, "N").dot(30, 21, "N");
  }),

  amber_wasp: draw((p) => {
    p.ellipse(23, 11, 8, 5, ["H", "C", "c"]).ellipse(30, 10, 6, 4, ["H", "C", "c"]);   // wings
    p.line(17, 13, 28, 9, 1, "c");
    for (const [x0, x1] of [[17, 13], [20, 18], [23, 24]]) p.line(x0, 25, x1, 32, 1, "K"); // legs
    p.ellipse(32, 23, 10, 6.5, ORANGE);                                       // abdomen
    for (let y = 0; y < 44; y++) for (let x = 26; x < 42; x++) {
      if ("AaF".includes(p.at(x, y)) && (x - 26) % 5 < 2) p.dot(x, y, "K");  // stripes
    }
    p.poly([[41, 21], [43, 24], [41, 26]], "K");                              // sting
    p.ellipse(19, 21, 5, 5, ORANGE);                                          // thorax
    p.circle(11, 19, 4.5, ORANGE);                                            // head
    p.ellipse(10, 18, 2.2, 2.6, "K").dot(9, 17, "h");                         // eye
    p.path([[11, 15], [9, 10], [6, 8]], 1, "K").path([[13, 15], [13, 9], [11, 6]], 1, "K");
    p.line(7, 22, 9, 22, 1, "F");                                             // jaws
  }),

  monkey_mage: draw((p) => {
    p.path([[30, 37], [38, 35], [41, 28], [38, 23], [35, 26]], 2.5, T.fur);  // curled tail
    p.ellipse(17, 41, 3.5, 1.6, T.fur).ellipse(28, 41, 3.5, 1.6, T.fur);       // feet
    p.poly([[16, 22], [30, 22], [34, 40], [12, 40]], T.purple);                 // robe
    p.rect(12, 38, 34, 39, T.gold);                                             // hem
    p.line(17, 23, 29, 33, 1, T.gold);                                          // sash
    for (const [x, y] of [[26, 26], [18, 33], [29, 36]] as const) p.dot(x, y, "G"); // stars on the robe
    p.circle(23, 17, 6.5, T.fur);                                               // head
    p.circle(15.5, 16, 2.6, T.fur).dot(15, 16, "I");                            // ears
    p.circle(30.5, 16, 2.6, T.fur).dot(31, 16, "I");
    p.ellipse(21, 18.5, 4.5, 4, T.sand);                                        // face
    p.dot(19, 17, "k").dot(23, 17, "k").dot(19, 16, "h").dot(23, 16, "h");      // eyes
    p.dot(20, 20, "m").dot(22, 20, "m");                                        // nostrils
    p.line(19, 22, 22, 22, 1, "m");                                             // mouth
    p.ellipse(23, 11.5, 10, 1.8, T.purple);                                     // hat brim
    p.poly([[15, 11], [31, 11], [28, 5], [34, 0], [22, 3]], T.purple);          // pointed hat, flopping back
    p.dot(22, 7, "G").dot(26, 5, "G").dot(25, 9, "y");                          // stars on the hat
    p.path([[18, 26], [13, 28], [10, 27]], 3, T.fur);                           // arm
    p.circle(10, 27, 2, T.sand);                                                // hand
    p.line(9, 8, 11, 42, 1.5, T.wood);                                          // staff
    p.circle(8.5, 5, 3.2, T.cyan).dot(7, 4, "H").dot(8, 3, "H");                // glowing orb
    for (const [x, y, c] of [[3, 2, "C"], [13, 1, "y"], [2, 9, "y"], [14, 7, "C"], [5, 13, "C"]] as const) p.dot(x, y, c);
  }),

  dire_wolf: draw((p) => {
    p.ellipse(21.5, 33, 14, 9, T.stone);                                      // shoulders
    for (const x of [11, 28]) p.rect(x, 36, x + 4, 42, T.stone);              // legs
    p.poly([[6, 24], [4, 33], [9, 30], [8, 37], [13, 32]], T.stone);          // fur ruff
    p.ellipse(21.5, 18, 9.5, 8.5, T.stone);                                   // head
    p.poly([[12, 14], [13, 2], [19, 10]], T.stone).poly([[14, 12], [14.5, 6], [17, 11]], "x");
    p.ellipse(21.5, 24.5, 5.5, 4.5, ["B", "b", "n"]);                          // snout
    p.ellipse(21.5, 21.5, 2.5, 1.6, "k");                                     // nose
    p.rect(17, 27, 25, 28, "x");                                              // mouth
    p.dot(18, 27, "h").dot(18, 28, "h").dot(20, 27, "h");                     // teeth
    p.ellipse(16.5, 16, 2.2, 1.5, "R").dot(16, 16, "y");                      // eyes
    p.line(13, 13, 19, 15, 1, "k");                                           // brow
    for (const x of [11, 13, 15]) p.dot(x, 42, "h");                          // claws
    p.mirror();
  }),

  ironhide: draw((p) => {
    p.line(41, 18, 43, 25, 1, "t");                                           // tail
    for (const x of [15, 22, 30, 36]) p.rect(x, 28, x + 4, 40, HIDE);         // legs
    for (const x of [15, 22, 30, 36]) p.rect(x, 40, x + 4, 41, "h");          // toenails
    p.ellipse(27, 22, 14, 10, HIDE);                                          // body
    p.rect(17, 14, 37, 25, T.red).rect(17, 25, 37, 26, T.gold);               // war blanket
    p.rect(17, 14, 37, 15, T.gold);
    for (const x of [20, 26, 32]) p.circle(x + 1, 20, 1.6, T.gold);           // studs
    p.ellipse(18, 19, 6, 8.5, ["t", "n", "K"]);                               // ear
    p.ellipse(11, 18, 7.5, 8, HIDE);                                          // head
    p.poly([[12, 9], [17, 11], [17, 25], [12, 26]], ["s", "t", "n"]).line(12, 10, 16, 12, 1, "g");   // armoured brow plate
    p.dot(9, 15, "k").dot(9, 14, "h");                                        // eye
    p.path([[8, 24], [4, 27], [3, 30]], 2, "h");                              // tusk
    p.path([[7, 24], [6, 31], [6, 41]], 2.2, T.wood);                         // the axe haft (its trunk)
    p.poly([[5, 30], [0, 26], [0, 38], [5, 35]], STEEL).poly([[8, 30], [13, 26], [13, 38], [8, 35]], STEEL);
    p.line(0, 27, 0, 37, 1, "S").line(13, 27, 13, 37, 1, "S");                // edges
  }),

  // ── Under-dwellers ───────────────────────────────────────────────
  cave_bat: draw((p) => {
    p.poly([[20, 18], [2, 9], [0, 25], [4, 22], [7, 28], [11, 23], [14, 29], [19, 25]], T.purple);  // wing
    p.path([[19, 19], [3, 10]], 1, "q").line(10, 14, 7, 27, 1, "q").line(14, 16, 14, 28, 1, "q");
    p.ellipse(21.5, 24, 5.5, 7.5, T.stone);                                   // body
    p.circle(21.5, 15, 5.5, T.stone);                                         // head
    p.poly([[16, 13], [15, 3], [20, 10]], T.stone).poly([[16.5, 11], [16, 6], [18.5, 10]], "z");
    p.rect(17, 14, 19, 15, "R").dot(17, 14, "y");                             // glowing eyes
    p.dot(20, 19, "h").dot(20, 20, "h");                                      // fangs
    p.line(19, 31, 18, 34, 1, "n");                                           // feet
    p.mirror();
  }),

  rust_beetle: draw((p) => {
    for (const [a, b, c] of [[[15, 24], [9, 21], [5, 25]], [[14, 29], [7, 30], [4, 35]], [[15, 34], [9, 38], [7, 42]]] as [number, number][][])
      p.path([a, b, c], 1.6, "K");                                            // legs
    p.ellipse(21.5, 29, 9.5, 11.5, RUST);                                     // shell
    p.line(21.5, 18, 21.5, 40, 1, "x");                                       // seam
    p.ellipse(17, 25, 2, 1.5, "a").ellipse(18, 33, 1.5, 1.2, "a").ellipse(15, 29, 1, 1, "F").ellipse(19, 37, 1, 0.8, "a");
    p.ellipse(16, 22, 2, 1, "R");                                             // shine
    p.ellipse(21.5, 15, 6.5, 4, T.dark);                                      // head
    p.path([[18, 12], [15, 7], [17, 4]], 1.6, "K");                           // mandibles
    p.dot(18, 14, "A").dot(17, 14, "A");                                      // eyes
    p.mirror();
  }),

  crystalback: draw((p) => {
    p.path([[37, 32], [42, 36]], 2.5, T.stone);                               // tail
    for (const x of [13, 29]) p.rect(x, 35, x + 3, 41, T.stone);              // legs
    p.ellipse(23, 30, 14, 8, T.stone);                                        // body
    p.poly([[13, 25], [15, 13], [19, 24]], T.cyan).poly([[19, 22], [22, 6], [26, 22]], T.cyan);
    p.poly([[25, 22], [29, 10], [31, 23]], T.purple).poly([[30, 24], [34, 15], [36, 26]], T.cyan);
    p.line(16, 15, 16, 21, 1, "H").line(22, 9, 22, 18, 1, "H").line(29, 13, 29, 19, 1, "H");
    for (const x of [16, 21, 26, 31]) p.line(x, 24, x, 35, 1, "n");           // shell bands
    p.ellipse(9, 31, 5.5, 4.5, T.stone);                                      // head
    p.dot(7, 30, "C").dot(6, 30, "c");                                        // eye
    p.dot(4, 32, "k");
  }),

  crystal_golem: draw((p) => {
    p.rect(13, 32, 19, 41, T.stone);                                          // legs
    p.poly([[9, 14], [34, 14], [30, 34], [13, 34]], T.stone);                 // torso
    p.rect(3, 14, 10, 29, T.stone).rect(2, 29, 11, 35, T.stone);              // arm, fist
    p.poly([[7, 14], [6, 3], [11, 13]], T.cyan).poly([[10, 13], [13, 6], [15, 13]], T.purple);
    p.line(7, 6, 7, 12, 1, "H");
    p.rect(16, 5, 27, 13, T.stone);                                           // head
    p.rect(17, 8, 19, 9, "C").dot(17, 8, "H");                                // eyes
    p.path([[13, 18], [16, 22], [14, 27]], 1, "n").path([[6, 18], [8, 23]], 1, "n");  // cracks
    p.circle(21.5, 23, 4, "c").circle(21.5, 23, 2.5, "C").circle(21.5, 23, 1, "H");    // core
    p.mirror();
  }),

  hollow_matriarch: draw((p) => {
    p.line(21.5, 0, 21.5, 9, 1, "S");                                         // her thread
    for (const leg of [[[17, 20], [9, 9], [2, 15]], [[16, 24], [6, 19], [0, 29]], [[16, 28], [7, 30], [3, 41]], [[17, 32], [11, 37], [9, 43]]] as [number, number][][])
      p.path(leg, 2.2, T.dark);
    p.ellipse(21.5, 31, 10, 10.5, T.void);                                    // abdomen
    p.poly([[18, 26], [21.5, 30], [18, 34]], "r").poly([[18, 26], [21.5, 30], [18, 34]], "R");  // hourglass
    p.ellipse(21.5, 18, 7, 5.5, T.dark);                                      // head
    p.poly([[15, 14], [16, 8], [18, 12], [20, 6], [21.5, 13]], T.gold);       // crown
    for (const [x, y] of [[19, 16], [20, 15], [17, 18], [19.5, 18.5]] as const) p.dot(x, y, "R");
    p.dot(19, 15, "y").dot(17, 17, "y");
    p.path([[20, 22], [19, 26]], 1.5, "h");                                   // fangs
    p.mirror();
  }),
  // ── Etherial ─────────────────────────────────────────────────────
  dust_sprite: draw((p) => {
    p.poly([[11, 14], [32, 14], [21.5, 36]], T.sand);                         // a funnel of dust
    p.ellipse(21.5, 15, 11, 5, T.sand);
    p.path([[13, 15], [21, 18], [29, 15]], 1, "j").path([[16, 22], [21, 24], [26, 22]], 1, "j").path([[18, 28], [21.5, 30], [24, 28]], 1, "j");
    p.ellipse(18, 18, 1.5, 2, "k").ellipse(25, 18, 1.5, 2, "k").dot(18, 17, "h").dot(25, 17, "h");   // eyes
    p.line(20, 22, 23, 22, 1, "j");                                           // mouth
    for (const [x, y, c] of [[6, 10, "H"], [37, 8, "y"], [8, 24, "I"], [35, 25, "H"], [12, 33, "I"], [30, 34, "y"], [4, 18, "I"], [40, 17, "I"]] as const) p.dot(x, y, c);
  }),

  flicker_wisp: draw((p) => {
    p.path([[21.5, 25], [18, 31], [23, 36], [19, 42]], 3, ["y", "A", "a"]);    // trailing light
    p.path([[24, 26], [27, 32], [25, 37]], 1.5, "A");
    p.circle(21.5, 17, 10, "a").circle(21.5, 17, 8.5, ["h", "y", "A"]);       // the glow
    p.circle(19, 14, 3, "h");
    p.ellipse(18.5, 18, 1.2, 1.8, "a").ellipse(24.5, 18, 1.2, 1.8, "a");      // a face, faintly
    for (const [x, y] of [[8, 8], [36, 9], [5, 22], [39, 24], [11, 31], [33, 33]] as const) p.dot(x, y, "y");
    for (const [x, y] of [[13, 4], [31, 3], [38, 15]] as const) p.dot(x, y, "H");
  }),

  veilstalker: draw((p) => {
    const body = (dx: number, fill: string | typeof T.purple) => {
      p.poly([[16 + dx, 9], [27 + dx, 9], [29 + dx, 25], [25 + dx, 41], [19 + dx, 41], [14 + dx, 25]], fill);  // a tall, thin shape
      p.path([[15 + dx, 14], [8 + dx, 24], [6 + dx, 33]], 2.5, fill);         // long arms
      p.path([[28 + dx, 14], [35 + dx, 23], [38 + dx, 32]], 2.5, fill);
    };
    body(-4, "J"); body(4, "c");                                              // out of phase
    body(0, T.purple);
    p.circle(21.5, 8, 5, T.purple);                                           // head
    p.ellipse(19.5, 8, 1.3, 0.8, "H").ellipse(23.5, 8, 1.3, 0.8, "H");        // eyes
    for (const [x0, y] of [[4, 33], [36, 32]] as const) for (let k = 0; k < 3; k++) p.line(x0 + k * 1.5, y, x0 + k * 1.5 - 1, y + 4, 1, "H");  // claws
    for (const y of [17, 29]) for (let x = 0; x < 44; x++) if (p.at(x, y) !== ".") p.dot(x + 2, y, p.at(x, y));  // glitches
  }),

  the_watcher: draw((p) => {
    for (const [x0, bend] of [[13, -6], [18, -3], [21.5, 0], [25, 3], [30, 6]] as const)   // tentacles
      for (let i = 0; i < 6; i++) p.circle(x0 + Math.sin(i * 0.9) * 2 + bend * i * 0.3, 27 + i * 3, 2.6 - i * 0.35, T.purple);
    p.circle(21.5, 17, 12, T.purple);                                         // the body
    p.ellipse(21.5, 17, 9, 6.5, ["h", "I", "i"]);                             // the eye
    p.circle(21.5, 17, 4.5, ["y", "A", "a"]);                                 // iris
    p.ellipse(21.5, 17, 1.2, 3.8, "k");                                       // slit
    p.dot(19, 14, "h").dot(20, 14, "h");
    p.path([[12.5, 13], [21.5, 10], [30.5, 13]], 1, "q").path([[12.5, 21], [21.5, 24], [30.5, 21]], 1, "q");   // lids
    for (const [x, y] of [[14, 7], [29, 6], [10, 17], [33, 18]] as const) p.dot(x, y, "R");  // veins
  }),

  void_serpent: draw((p) => {
    p.path([[8, 38], [30, 39], [37, 31], [31, 24], [14, 24], [7, 17], [13, 9], [25, 10]], 7, T.void);   // coils
    p.ellipse(31, 9, 6.5, 4.5, T.void);                                       // head
    for (let y = 0; y < 44; y++) for (let x = 0; x < 44; x++)
      if ("pqJ".includes(p.at(x, y)) && (x * 7 + y * 13) % 23 === 0) p.dot(x, y, (x + y) % 2 ? "H" : "C");  // stars inside
    p.dot(32, 7, "C").dot(33, 7, "C").dot(32, 8, "c");                        // eye
    p.poly([[37, 10], [39, 13], [36, 11]], "h");                              // fang
    p.path([[37, 9], [41, 7], [43, 8]], 1, "R").path([[41, 7], [42, 5]], 1, "R");   // tongue
    p.poly([[4, 37], [0, 35], [2, 40]], T.void);                              // tail tip
  }),

  // ── Undead ───────────────────────────────────────────────────────
  rattlebones: draw((p) => {
    p.line(21.5, 16, 21.5, 31, 2, "I");                                       // spine
    for (const y of [19, 22, 25]) p.path([[21.5, y], [16, y + 1], [15, y + 3]], 1.5, T.bone);   // ribs
    p.path([[15, 18], [12, 25], [10, 31]], 2, T.bone);                        // arm
    p.circle(10, 32, 1.6, "I");                                               // hand
    p.poly([[16, 30], [21.5, 29], [21.5, 34], [17, 34]], T.bone);             // hip
    p.path([[18, 34], [17, 40], [17, 42]], 2, T.bone);                        // leg
    p.rect(14, 42, 18, 43, "I");                                              // foot
    p.circle(21.5, 10, 7, T.bone);                                            // skull
    p.ellipse(18.5, 10, 2.2, 2.4, "K").dot(18, 10, "Q").dot(19, 10, "Q");     // eye socket, glowing
    p.poly([[21.5, 12], [20.5, 14.5], [21.5, 14.5]], "K");                    // nose
    p.rect(17, 16, 21, 17, "h");                                              // grin
    for (const x of [18, 20]) p.dot(x, 17, "K");
    p.mirror();
  }),

  shambler: draw((p) => {
    const SKIN: Tone = ["V", "e", "O"];
    p.rect(15, 33, 18, 42, T.fur).rect(23, 33, 26, 41, T.fur);                // trouser legs
    p.rect(14, 42, 19, 43, "K").rect(23, 41, 28, 42, "K");                    // shoes
    p.poly([[13, 17], [29, 17], [28, 35], [14, 35]], T.fur);                  // ragged shirt
    for (const [x, y] of [[17, 22], [25, 27], [19, 31]] as const) p.ellipse(x, y, 1.5, 1, SKIN);   // holes
    p.poly([[14, 35], [16, 37], [18, 35], [21, 38], [24, 35], [27, 37], [28, 35]], T.fur);          // tatters
    p.poly([[11, 17], [14, 17], [14, 21], [11, 22]], "x").dot(12, 19, "r");  // the missing arm
    p.path([[28, 19], [35, 22], [41, 21]], 3, SKIN);                         // the one it has
    p.path([[41, 21], [43, 20]], 1.5, SKIN).path([[41, 22], [43, 23]], 1.5, SKIN);
    p.ellipse(22, 10, 6.5, 7, SKIN);                                         // lolling head
    p.ellipse(19.5, 9, 1.8, 1.5, "Q").dot(19, 9, "k");                       // the good eye
    p.line(23, 8, 25, 10, 1, "k").line(25, 8, 23, 10, 1, "k");              // the other
    p.path([[19, 14], [22, 13], [25, 15]], 1, "O");                           // mouth
    p.dot(20, 3, "f").dot(24, 4, "f").dot(17, 5, "f");                       // a few hairs
  }),

  dustwraith: draw((p) => {
    for (let i = 0; i < 8; i++) p.ellipse(21.5 + Math.sin(i * 1.3) * 2, 14 + i * 3.6, 13 - i * 1.4, 2.8, T.sand);   // whirlwind
    for (let i = 0; i < 7; i++) p.line(10 + i * 0.8, 16 + i * 3.6, 30 - i * 0.6, 17 + i * 3.6, 1, "j");
    p.circle(21.5, 10, 6.5, T.bone);                                         // skull in the storm
    p.ellipse(19, 10, 1.8, 2.2, "K").ellipse(24, 10, 1.8, 2.2, "K");
    p.dot(19, 10, "Q").dot(24, 10, "Q");
    p.rect(19, 14, 24, 15, "K").dot(20, 14, "I").dot(22, 14, "I");
    for (const [x, y, c] of [[4, 12, "i"], [39, 10, "I"], [6, 26, "j"], [37, 24, "i"], [10, 38, "I"], [33, 39, "j"]] as const) p.dot(x, y, c);
  }),

  mr_shadows: draw((p) => {
    p.poly([[6, 30], [8, 10], [12, 2], [15, 9], [21.5, 6], [28, 9], [31, 2], [35, 10], [37, 30]], "J");   // the shadow on the wall
    p.path([[8, 18], [2, 26], [1, 34]], 3, "J").path([[35, 18], [41, 26], [42, 34]], 3, "J");           // its arms
    for (const x of [0, 2, 4]) p.line(x, 34, x - 1, 38, 1, "J");
    for (const x of [39, 41, 43]) p.line(x, 34, x + 1, 38, 1, "J");
    p.ellipse(15.5, 13, 2.2, 1.2, "R").ellipse(27.5, 13, 2.2, 1.2, "R");      // its eyes
    p.path([[13, 16], [17, 19], [21.5, 17], [26, 19], [30, 16]], 1, "R");    // its grin
    p.circle(21.5, 33, 7, T.fur);                                            // the teddy bear
    p.circle(15.5, 27, 2.5, T.fur).circle(27.5, 27, 2.5, T.fur);             // ears
    p.circle(21.5, 26, 6, T.fur);                                            // head
    p.ellipse(21.5, 28.5, 2.5, 1.8, "I").dot(21, 28, "k").dot(22, 28, "k");   // snout
    p.dot(19, 25, "k").dot(24, 25, "k");                                      // button eyes
    p.ellipse(15, 38, 3, 2.5, T.fur).ellipse(28, 38, 3, 2.5, T.fur);         // feet
    p.line(21.5, 32, 21.5, 37, 1, "m");                                      // stitches
  }),

  storm_phoenix: draw((p) => {
    p.poly([[21.5, 20], [3, 6], [0, 16], [5, 18], [2, 25], [9, 25], [8, 31], [21.5, 26]], T.cyan);     // wing
    p.path([[19, 20], [10, 12], [13, 18], [6, 19]], 1, "y");                  // lightning in the feathers
    p.path([[18, 24], [12, 23], [14, 27], [9, 28]], 1, "y");
    p.poly([[18, 33], [16, 42], [21.5, 38], [27, 42], [25, 33]], T.cyan);     // tail
    p.line(21.5, 33, 21.5, 41, 1, "y");
    p.ellipse(21.5, 26, 5, 8, ["b", "n", "K"]);                               // body
    for (const y of [23, 26, 29]) p.line(18, y, 25, y, 1, "C");               // glowing ribs
    p.circle(21.5, 13, 4.5, T.bone);                                         // bird skull
    p.poly([[20, 16], [21.5, 21], [23, 16]], "I");                            // beak
    p.dot(19, 12, "C").dot(20, 12, "c");                                      // eye
    p.poly([[18, 9], [16, 3], [20, 8]], "y");                                 // crest
    p.mirror();
  }),
  // ── Elvish ───────────────────────────────────────────────────────
  thicket_archer: draw((p) => {
    p.path([[33, 8], [37, 16], [37, 28], [33, 36]], 1.6, T.wood);             // bow
    p.line(33, 8, 33, 36, 1, "h");                                            // string
    p.rect(17, 36, 19, 41, T.fur).rect(23, 36, 25, 41, T.fur);                // boots
    p.poly([[13, 16], [30, 16], [32, 38], [11, 38]], T.leaf);                 // cloak
    p.line(21.5, 18, 21.5, 37, 1, "f");
    p.rect(13, 27, 30, 28, T.gold);                                           // belt
    p.path([[29, 21], [33, 22]], 2.5, T.leaf);                                // arm on the bow
    p.poly([[13, 15], [21.5, 2], [30, 15], [27, 19], [16, 19]], T.leaf);      // hood
    p.ellipse(21.5, 14, 5, 4, "O");                                           // shadowed face
    p.dot(19, 14, "N").dot(24, 14, "N");                                      // glinting eyes
    p.path([[8, 18], [10, 12]], 2, T.wood).dot(10, 11, "h").dot(9, 11, "e");  // quiver arrows
  }),

  leafblade_scout: draw((p) => {
    p.path([[8, 10], [5, 22], [9, 34]], 1.5, T.wood);                        // bow on its back
    p.rect(16, 34, 18, 41, T.fur).rect(24, 34, 26, 41, T.fur);                // legs
    p.poly([[14, 17], [29, 17], [28, 35], [15, 35]], T.leaf);                // tunic
    p.rect(14, 26, 29, 27, T.gold);
    p.path([[28, 19], [33, 25], [35, 22]], 2.5, ["N", "E", "e"]);            // arm
    p.poly([[35, 22], [41, 6], [43, 4], [39, 18]], ["N", "E", "f"]);         // the leaf blade
    p.line(36, 20, 41, 7, 1, "f");                                            // its vein
    p.path([[15, 19], [11, 26]], 2.5, ["N", "E", "e"]);                      // other arm
    p.circle(21.5, 11, 5.5, ["N", "E", "e"]);                                // face (elves are a bit green here)
    p.poly([[15, 10], [10, 6], [16, 13]], ["N", "E", "e"]).poly([[28, 10], [33, 6], [27, 13]], ["N", "E", "e"]);   // pointed ears
    p.poly([[16, 8], [21.5, 3], [27, 8], [27, 6], [21.5, 1], [16, 6]], T.gold);  // hair
    p.dot(19, 11, "k").dot(24, 11, "k");
  }),

  aurelius: draw((p) => {
    for (const x of [12, 17, 30, 35]) p.rect(x, 30, x + 2.5, 41, T.fur);      // horse legs
    for (const x of [12, 17, 30, 35]) p.rect(x, 41, x + 2.5, 42, "K");        // hooves
    p.ellipse(25, 26, 14, 7, T.fur);                                          // horse body
    p.path([[38, 24], [42, 30], [41, 36]], 3, "m");                           // tail
    p.poly([[9, 26], [11, 12], [21, 12], [20, 26]], T.gold);                  // armoured chest
    p.path([[11, 14], [5, 18], [6, 22]], 2.5, T.fur);                         // arm
    p.path([[3, 41], [8, 2]], 1.5, T.wood);                                   // spear
    p.poly([[7, 4], [9, 0], [10, 5]], T.grey);
    p.circle(15.5, 8, 4, ["I", "i", "j"]);                                    // face
    p.poly([[11, 7], [15.5, 2], [20, 7], [20, 5], [15.5, 1], [11, 5]], T.gold);   // helm
    p.path([[15.5, 1], [19, 0], [23, 3]], 2, T.red);                          // plume
    p.rect(11, 10, 12, 12, "g").rect(19, 10, 20, 12, "g");                    // cheek guards
    p.dot(13.5, 8, "k").dot(17.5, 8, "k");
    p.line(14, 11, 17, 11, 1, "j");                                           // a stern mouth
  }),

  swamp_witch: draw((p) => {
    p.ellipse(10, 40, 9, 3, "B").ellipse(32, 41, 10, 2.5, "B").ellipse(21, 42, 8, 2, "S");   // fog
    p.line(34, 8, 34, 41, 1.5, T.wood);                                       // staff
    p.circle(34, 6, 3.2, ["h", "Q", "e"]);                                    // its glowing orb
    p.poly([[13, 18], [30, 18], [34, 40], [9, 40]], ["e", "f", "O"]);         // robe
    for (const x of [11, 16, 21, 26, 31]) p.poly([[x, 38], [x + 2, 42], [x + 4, 38]], ["e", "f", "O"]);   // ragged hem
    p.path([[29, 20], [33, 24], [34, 22]], 2.5, ["N", "E", "e"]);             // hand on the staff
    p.ellipse(21.5, 14, 5, 5.5, ["N", "E", "e"]);                            // face
    p.poly([[16, 15], [12, 17], [16, 17]], ["N", "E", "e"]);                 // long nose
    p.dot(19, 13, "Q").dot(24, 13, "Q");                                      // eyes
    p.path([[19, 17], [24, 17]], 1, "f");
    p.poly([[9, 10], [34, 10], [27, 8], [24, 0], [19, 3], [16, 8]], ["f", "O", "K"]);   // hat
    p.rect(15, 8, 28, 9, "q");                                                // band
    p.path([[15, 11], [12, 22], [14, 28]], 1.5, "S").path([[28, 11], [31, 21]], 1.5, "S");   // grey hair
  }),

  sylvaran: draw((p) => {
    p.path([[34, 2], [40, 12], [41, 22], [40, 32], [34, 42]], 2, T.gold);    // tall bow
    p.line(34, 3, 34, 41, 1, "h");
    p.line(12, 21, 34, 21, 1, "y").poly([[9, 19], [12, 21], [9, 23]], "y");   // a glowing arrow, drawn
    p.poly([[13, 16], [30, 16], [33, 42], [10, 42]], ["h", "S", "s"]);       // white cloak
    p.line(21.5, 18, 21.5, 41, 1, "g");
    p.poly([[13, 16], [30, 16], [27, 24], [16, 24]], T.gold);                // gold mantle
    p.path([[29, 18], [34, 21]], 2.5, ["h", "I", "i"]);                      // drawing arm
    p.path([[14, 18], [12, 21]], 2.5, ["h", "I", "i"]);
    p.path([[15, 8], [11, 20], [13, 30]], 3, ["h", "S", "s"]);               // long silver hair
    p.path([[28, 8], [31, 18]], 3, ["h", "S", "s"]);
    p.circle(21.5, 10, 5.5, ["h", "I", "i"]);                                // face
    p.poly([[15, 9], [11, 5], [16, 12]], ["h", "I", "i"]).poly([[28, 9], [32, 5], [27, 12]], ["h", "I", "i"]);   // ears
    p.poly([[16, 7], [21.5, 2], [27, 7], [27, 5], [21.5, 0], [16, 5]], ["h", "S", "s"]);
    p.rect(17, 5, 26, 5, "G").dot(21, 5, "c");                                // circlet
    p.dot(19, 10, "c").dot(24, 10, "c");                                      // eyes
  }),

  // ── Retired creatures (no race; owners keep them) ────────────────
  // Each drawn in the look of the race it would suit, should it return.
  mantis_warden: draw((p) => {                                                // would be a Beast
    p.path([[19, 30], [15, 36], [14, 42]], 1.6, T.leaf).path([[24, 30], [28, 36], [29, 42]], 1.6, T.leaf);   // legs
    p.ellipse(21.5, 26, 4.5, 8, T.leaf);                                      // body
    p.path([[19, 17], [12, 13], [9, 22]], 2.5, T.leaf);                       // blade arm
    p.poly([[9, 22], [4, 6], [6, 5], [11, 20]], STEEL);                       // serrated blade
    for (const y of [9, 12, 15, 18]) p.dot(4 + (y - 6) * 0.3, y, "t");
    p.path([[24, 17], [31, 16], [33, 20]], 2.5, T.leaf);                      // buckler arm
    p.circle(35, 21, 6, ["A", "a", "l"]).circle(35, 21, 2, "g");              // chitin buckler
    p.poly([[16, 10], [27, 10], [21.5, 17]], T.leaf);                         // triangular head
    p.ellipse(16.5, 10, 2.2, 2.4, "y").ellipse(26.5, 10, 2.2, 2.4, "y").dot(16, 10, "k").dot(27, 10, "k");   // eyes
    p.path([[18, 8], [15, 2]], 1, "e").path([[25, 8], [28, 2]], 1, "e");      // antennae
  }),

  forest_slime: draw((p) => {                                                 // would be an Under-dweller
    p.ellipse(21.5, 33, 15, 9, T.green);                                      // the blob
    p.ellipse(21.5, 27, 11, 9, T.green);
    p.ellipse(15, 24, 3, 2, "N").dot(14, 23, "h");                            // shine
    p.ellipse(17.5, 30, 1.5, 2.2, "O").ellipse(25.5, 30, 1.5, 2.2, "O");      // eyes
    p.path([[19, 35], [21.5, 36.5], [24, 35]], 1, "O");                       // smile
    p.line(21.5, 18, 21.5, 14, 1.2, "w");                                     // a glowing cave mushroom
    p.ellipse(21.5, 13, 4.5, 2.5, ["C", "c", "u"]).dot(20, 12, "H");
    for (const [x, y] of [[11, 33], [31, 31], [27, 38], [14, 38]] as const) p.dot(x, y, "Q");   // glowing specks
  }),

  stone_toad: draw((p) => {                                                   // would be an Under-dweller
    p.ellipse(9, 38, 6, 3, T.stone).ellipse(34, 38, 6, 3, T.stone);           // feet
    p.ellipse(21.5, 30, 17, 10, T.stone);                                     // lumpy body
    p.ellipse(21.5, 33, 11, 5, ["I", "i", "j"]);                              // pale belly
    p.circle(13, 19, 5, T.stone).circle(30, 19, 5, T.stone);                  // eye bumps
    p.ellipse(13, 19, 2.5, 2.2, "A").ellipse(30, 19, 2.5, 2.2, "A");          // glowing eyes
    p.rect(12.5, 18, 13.5, 20, "k").rect(29.5, 18, 30.5, 20, "k");
    p.path([[10, 27], [21.5, 29], [33, 27]], 1, "n");                         // wide mouth
    for (const [x, y] of [[8, 26], [35, 25], [17, 23], [27, 24], [6, 31], [37, 32]] as const) p.circle(x, y, 1.3, "B");   // warts
    p.ellipse(29, 23, 3, 1.3, "e").ellipse(9, 29, 2, 1, "e");                 // moss
  }),

  thornmaw: draw((p) => {                                                     // would be Elvish
    p.path([[19, 30], [14, 36], [10, 42]], 2, T.leaf).path([[24, 30], [29, 36], [33, 42]], 2, T.leaf).path([[21.5, 30], [21.5, 42]], 2, T.leaf);   // root legs
    p.path([[21.5, 33], [21.5, 22]], 3, T.leaf);                              // stem
    p.ellipse(13, 30, 4, 2, T.leaf).ellipse(30, 29, 4, 2, T.leaf);            // leaves
    p.poly([[8, 14], [21.5, 6], [35, 14], [21.5, 17]], ["R", "r", "x"]);      // upper jaw
    p.poly([[8, 16], [21.5, 26], [35, 16], [21.5, 19]], ["R", "r", "x"]);     // lower jaw
    p.poly([[10, 15], [21.5, 9], [33, 15], [21.5, 18]], "x");                 // the dark inside
    for (let x = 10; x <= 33; x += 3) { p.dot(x, 14 - Math.abs(x - 21.5) * -0.05, "h"); p.dot(x + 1, 17, "h"); }   // teeth
    for (const [x, y] of [[6, 12], [37, 12], [15, 7], [28, 7], [12, 22], [31, 22]] as const) p.poly([[x, y], [x + 1.5, y - 2.5], [x + 2.5, y]], "e");   // thorns
    p.dot(21.5, 3, "Q").dot(18, 4, "N");                                      // a spore drifting
  }),

  ironjaw_hound: draw((p) => {                                                // would be a Beast
    p.path([[37, 22], [41, 16]], 3, T.fur);                                   // tail
    for (const x of [13, 18, 29, 34]) p.rect(x, 29, x + 2.5, 40, T.fur);      // legs
    for (const x of [12, 17, 28, 33]) p.rect(x, 40, x + 4, 41, "m");
    p.ellipse(25, 25, 13, 7, T.fur);                                          // body
    p.ellipse(12, 19, 7, 6.5, T.fur);                                         // head
    p.poly([[14, 13], [17, 7], [19, 15]], T.fur);                             // ear
    p.poly([[1, 18], [8, 16], [9, 21], [2, 21]], T.fur);                      // upper snout
    p.poly([[1, 22], [11, 22], [11, 27], [3, 26]], STEEL);                    // the iron jaw
    for (const x of [3, 5, 7, 9]) p.dot(x, 22, "h");                          // steel teeth
    p.dot(4, 25, "t").dot(8, 25, "t");                                        // rivets
    p.dot(1, 18, "k").dot(2, 18, "k");                                        // nose
    p.dot(9, 17, "y").dot(10, 17, "k");                                       // eye
    p.rect(15, 21, 20, 23, ["s", "t", "n"]).dot(17, 22, "g");                 // studded collar
  }),

  ashen_drifter: draw((p) => {                                                // would be Etherial
    p.ellipse(21.5, 22, 9, 10, ["B", "b", "n"]);                              // smoke core
    p.ellipse(16, 15, 4, 3, "B").ellipse(28, 29, 5, 3, "b").ellipse(14, 30, 3, 2, "B");   // drifting smoke
    p.ellipse(18.5, 21, 1.6, 1.2, "C").ellipse(24.5, 21, 1.6, 1.2, "C");      // cold eyes
    p.path([[8, 10], [20, 6], [34, 12]], 1, "S").path([[7, 34], [23, 38], [37, 31]], 1, "S");   // orbit trails
    p.circle(7, 11, 4, T.stone).circle(35, 12, 3.5, T.stone).circle(8, 34, 3, T.stone).circle(37, 31, 4, T.stone);   // orbiting rocks
    p.dot(6, 10, "B").dot(34, 11, "B").dot(36, 30, "B");
    for (const [x, y] of [[21, 3], [40, 22], [2, 22], [22, 41]] as const) p.dot(x, y, "H");
  }),
};
