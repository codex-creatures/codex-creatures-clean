// lib/sprites/hdSamples.ts
// Samples of the new detailed art (for approval before everything moves
// over): three creatures and three items. Creatures face left, side-on and
// turned a little toward you (mirrored for your side in battle).

import { paint, type Ramp } from "./hd";

// ── Shared colour ramps (darkest → lightest) ──────────────────────
const FUR_GREY: Ramp = ["#1d2024", "#30343a", "#474c54", "#626872", "#838a94"];
const FUR_PALE: Ramp = ["#2a2d32", "#454a51", "#676d76", "#8c939c", "#b3b9c1"];
const MOSS: Ramp = ["#182a14", "#294520", "#3d612b", "#56813a", "#78a84b"];
const BONE: Ramp = ["#5e5244", "#9a8c75", "#d6cab2", "#f6efe0"];
const MOUTH: Ramp = ["#12080b", "#2a1015", "#4a1a20"];
const BROWN: Ramp = ["#2a170c", "#4a2a15", "#6d4022", "#92582f", "#b8773f"];
const TAN: Ramp = ["#5a3d25", "#8a6440", "#b48b5c", "#d9b483"];
const ROBE: Ramp = ["#1d0f33", "#33195a", "#4c2585", "#6a39b0", "#8d5fd6"];
const GOLD: Ramp = ["#5a3a0c", "#9a6a16", "#d49c26", "#f2c94c", "#fff0a0"];
const WOOD: Ramp = ["#2a1a0d", "#4a2e16", "#6e4522", "#946033"];
const CHITIN: Ramp = ["#0e0b14", "#1d1729", "#2f2541", "#45375e", "#5f4c80"];
const ABDOMEN: Ramp = ["#2a0b2b", "#4c1550", "#76207a", "#9e34a3", "#c45bc9"];
const STEEL: Ramp = ["#2a2f38", "#4a525e", "#717b88", "#a3adb9", "#d6dde5", "#ffffff"];
const BRONZE: Ramp = ["#4a2608", "#80460f", "#c06a1a", "#ee9a2e", "#ffd27a"];
const TEAL_GLOW = "#5cf0e0";
const LEATHER: Ramp = ["#2a170c", "#4f2d16", "#76461f", "#9c6531"];

// ── Moss Wolf (Common · Beast · Melee) ─────────────────────────────
// A grey wolf grown over with moss, crouched to pounce, fangs bared.
export const MOSS_WOLF_HD = paint((p) => {
  p.limb([[50, 38], [57, 31], [61, 22], [60, 15]], 8, 3, FUR_GREY, { bias: -0.3 });           // tail, raised
  p.limb([[50, 44], [56, 49], [52, 57], [55, 59]], 7, 4, FUR_GREY, { bias: -1.2 });             // far hind leg, coiled
  p.limb([[24, 46], [16, 51], [10, 57]], 6, 4, FUR_GREY, { bias: -1.2 });                        // far front leg, reaching
  // Hackles up: a ridge of dark fur along the back.
  for (const [x, y, hgt] of [[28, 32, 7], [33, 30, 8], [38, 30, 8], [43, 31, 7], [48, 33, 6]] as const) p.poly([[x - 3, y + 3], [x, y - hgt], [x + 3, y + 3]], FUR_GREY, { bias: -1.5 });
  p.ellipse(38, 40, 16, 9.5, FUR_GREY, { spots: { color: "#262a2f", density: 0.06 } });        // body
  p.ellipse(38, 46, 12, 3.5, FUR_PALE, { bias: -0.8, outline: false });                          // belly
  p.limb([[45, 44], [52, 50], [46, 58], [49, 59]], 8, 5, FUR_GREY);                              // hind leg, coiled
  p.ellipse(25, 41, 8.5, 9, FUR_PALE);                                                            // chest ruff
  p.limb([[29, 46], [22, 52], [16, 58]], 7, 5, FUR_GREY);                                         // front leg, reaching
  for (const [x, y] of [[10, 58.5], [16, 59], [49, 59.5], [55, 59.5]] as const) {
    p.ellipse(x, y, 3.5, 2, FUR_GREY, { bias: -0.5 });
    p.dot(x - 3, y + 1, BONE[3]).dot(x - 1.5, y + 1.5, BONE[2]);                                  // claws
  }
  p.ellipse(37, 34, 9, 3.2, MOSS, { spots: { color: "#a8d46a", density: 0.08 } });               // moss on the back
  p.ellipse(48, 37, 4.5, 2.2, MOSS);
  p.ellipse(18, 35, 9.5, 8.5, FUR_GREY);                                                          // head, low and forward
  p.poly([[17, 30], [23, 18], [26, 31]], FUR_GREY, { bias: -1 });                                 // far ear, pinned back
  p.poly([[11, 31], [15, 18], [20, 29]], FUR_GREY);                                               // ear
  p.poly([[12.5, 29], [15, 22], [17.5, 28]], ["#5a2f36", "#8a4a52"]);                            // inner ear
  p.ellipse(8, 38, 8, 4.5, FUR_PALE);                                                              // snout
  p.ellipse(8, 43, 6.5, 2.6, MOUTH, { outline: false });                                           // open jaw
  for (const x of [3, 6, 9, 12]) p.dot(x, 41.5, BONE[3]).dot(x, 42.5, BONE[2]);                   // fangs
  p.dot(4, 44.5, BONE[3]).dot(8, 44.5, BONE[3]).dot(11, 44.5, BONE[3]);
  p.ellipse(1.8, 36.5, 1.8, 1.4, ["#0a0608", "#2a1f22"], { outline: false });                      // nose
  p.dot(5, 35, FUR_GREY[0]).dot(7, 34.5, FUR_GREY[0]).dot(9, 35, FUR_GREY[0]);                    // snarl creases
  p.eye(13.5, 33.5, 2, "#ffb21e", "#fff6b0");                                                      // eye
  p.dot(11, 31, FUR_GREY[0]).dot(12, 30.6, FUR_GREY[0]).dot(14, 30.4, FUR_GREY[0]).dot(15.5, 30.8, FUR_GREY[0]); // brow
  p.ellipse(19, 28, 3, 1.5, MOSS);                                                                  // moss on the head
});

// ── Monkey Mage (Rare · Beast · Magic) ─────────────────────────────
// A monkey in a stolen wizard's robe and hat, casting from a glowing staff.
export const MONKEY_MAGE_HD = paint((p) => {
  p.limb([[42, 50], [52, 52], [58, 44], [55, 36], [50, 38]], 4, 3, BROWN, { bias: -0.3 });       // tail
  p.limb([[36, 50], [38, 58]], 6, 5, BROWN, { bias: -1 });                                         // far leg
  p.poly([[24, 34], [40, 34], [45, 58], [19, 58]], ROBE, { spots: { color: "#f2c94c", density: 0.015 } }); // robe
  p.poly([[19, 55], [45, 55], [45.5, 58], [18.5, 58]], GOLD, { outline: false });                 // hem
  p.limb([[24, 36], [36, 48]], 3, 3, GOLD);                                                         // sash
  p.ellipse(26, 60, 4, 1.8, BROWN, { bias: -0.6 }).ellipse(38, 60, 4, 1.8, BROWN, { bias: -0.6 }); // feet
  p.limb([[38, 38], [44, 44], [46, 38]], 5, 4, ROBE, { bias: -0.8 });                              // far arm, sleeve
  p.ellipse(31, 26, 10, 9, BROWN);                                                                  // head
  p.circle(41, 26, 4, BROWN, { bias: -0.6 }).circle(41.5, 26, 2, TAN, { outline: false });       // ear
  p.ellipse(26, 29, 7, 6, TAN);                                                                     // face
  p.ellipse(21, 31, 4, 3, TAN, { bias: 0.4 });                                                      // muzzle
  p.dot(18.5, 30.5, BROWN[0]).dot(20, 30.6, BROWN[0]);                                              // nostrils
  p.limb([[18, 33.5], [23, 34]], 1.2, 1.2, [BROWN[0]], { outline: false });                         // grin
  p.eye(25, 26.5, 1.8, "#8ef0ff", "#ffffff");                                                       // eyes (lit by the spell)
  p.eye(30, 26.5, 1.6, "#8ef0ff", "#ffffff");
  p.ellipse(31, 18, 13, 2.6, ROBE, { bias: -0.4 });                                                 // hat brim
  p.poly([[21, 18], [41, 18], [37, 8], [44, 2], [30, 5]], ROBE, { spots: { color: "#f2c94c", density: 0.03 } }); // pointed hat
  p.dot(31, 10, GOLD[4]).dot(35, 13, GOLD[4]).dot(28, 15, GOLD[3]);
  p.limb([[12, 6], [15, 60]], 2.6, 2.6, WOOD);                                                      // staff
  p.limb([[26, 38], [19, 42], [14, 40]], 5, 4, ROBE);                                              // arm, sleeve
  p.circle(14, 40, 2.6, TAN);                                                                       // hand on the staff
  p.circle(11, 5, 4.2, ["#1d6f99"], { emissive: "#7fe8ff" });                                       // the orb
  p.circle(11, 5, 2.4, ["#d8fbff"], { emissive: "#d8fbff" });
  for (const [x, y, c] of [[4, 2, "#b8f6ff"], [17, 1, "#fff0a0"], [3, 10, "#7fe8ff"], [18, 9, "#b8f6ff"], [6, 15, "#7fe8ff"]] as const) p.dot(x, y, c);
});

// ── Hollow Matriarch (Legendary · Under-dweller · Ranged) ──────────
// A cave-spider queen the size of a cart: a crowned head, a huge glowing
// abdomen, spines she flings from it.
export const HOLLOW_MATRIARCH_HD = paint((p) => {
  // Far legs (darker).
  for (const leg of [[[36, 34], [44, 20], [56, 30], [60, 50]], [[32, 36], [38, 22], [48, 26], [54, 52]]] as [number, number][][]) p.limb(leg, 4, 2, CHITIN, { bias: -1.2 });
  p.ellipse(44, 38, 15, 12, ABDOMEN, { spots: { color: "#e080e6", density: 0.04 } });             // abdomen
  for (let i = 0; i < 4; i++) p.limb([[38 + i * 5, 28 + (i % 2)], [36 + i * 5.5, 20 - (i % 2) * 2]], 3, 0.8, BONE); // spines
  p.ellipse(46, 40, 6, 3, ["#ffd2ff"], { emissive: "#ff9cf5" });                                 // its glowing mark
  p.ellipse(46, 40, 3, 1.5, ["#ffffff"], { emissive: "#ffffff" });
  p.ellipse(27, 40, 9, 7.5, CHITIN);                                                                // thorax
  // Near legs.
  for (const leg of [[[28, 42], [20, 30], [10, 34], [6, 56]], [[30, 44], [26, 34], [18, 44], [16, 58]], [[34, 44], [36, 36], [40, 50], [38, 60]], [[32, 46], [30, 52], [26, 56], [28, 61]]] as [number, number][][]) p.limb(leg, 4.5, 2, CHITIN);
  p.ellipse(16, 36, 8, 7, CHITIN, { bias: 0.3 });                                                   // head
  p.poly([[10, 30], [12, 22], [15, 27], [17, 20], [20, 27], [23, 22], [23, 31]], GOLD);           // crown
  p.dot(17, 24, "#ff5f7a").dot(12.5, 26, "#7fe8ff").dot(22, 26, "#7fe8ff");                        // its gems
  for (const [x, y, r] of [[12, 35, 1.8], [17, 34, 1.8], [14, 38.5, 1.2], [19.5, 37.5, 1.2]] as const) p.eye(x, y, r, "#ff3b5c", "#ffd0d8"); // eyes
  p.limb([[10, 41], [6, 46]], 2.4, 1.2, BONE).limb([[15, 42], [13, 48]], 2.4, 1.2, BONE);        // fangs
});

// ── Items (32×32), bold and bright ────────────────────────────────
// Temporal Maul: a heavy two-handed hammer, its head bound in bronze with
// an hourglass set into it.
export const TEMPORAL_MAUL_HD = paint((p) => {
  p.limb([[5, 29], [20, 12]], 3, 3, LEATHER);                                                        // haft
  for (const t of [0.2, 0.4, 0.6]) p.dot(5 + 15 * t, 29 - 17 * t, LEATHER[3]);                     // grip wraps
  p.poly([[13, 4], [27, 11], [22, 22], [8, 15]], STEEL);                                             // the head
  p.poly([[13, 4], [16, 5.5], [11, 16.5], [8, 15]], BRONZE, { outline: false });                     // bronze bands
  p.poly([[24, 9.5], [27, 11], [22, 22], [19, 20.5]], BRONZE, { outline: false });
  p.poly([[15.5, 10], [20, 12], [17.5, 17.5], [13, 15.5]], ["#14313a"], { emissive: "#1c4a55" });   // hourglass window
  p.dot(16.5, 12.5, TEAL_GLOW).dot(17.2, 13.6, TEAL_GLOW).dot(16.2, 15.2, TEAL_GLOW).dot(15.6, 14.4, "#c8fff8");
}, 32, 32, 2);

// Weeping Great-Bow: a tall recurve of pale wood, a tear-shaped jewel at its grip.
export const WEEPING_GREATBOW_HD = paint((p) => {
  p.limb([[22, 2], [12, 7], [8, 16], [12, 25], [22, 30]], 3.4, 3.4, ["#3a2a1a", "#6a5236", "#a08460", "#cdb48a", "#efdcb5"]); // the bow
  p.limb([[22, 2], [22, 30]], 1.2, 1.2, ["#eef6ff"], { emissive: "#eef6ff" });                     // string
  p.limb([[6, 16], [27, 16]], 1.6, 1.6, WOOD);                                                         // arrow
  p.poly([[27, 13.5], [31, 16], [27, 18.5]], STEEL);                                                   // arrowhead
  p.poly([[4, 13], [7, 16], [4, 19], [5.5, 16]], ["#7a1f2a", "#b8333f", "#e05a62"]);                 // fletching
  p.ellipse(8.5, 16, 2.2, 3, ["#1e4fa0", "#3a7fe0", "#8fc4ff", "#e2f2ff"]);                         // the tear jewel
  p.dot(9, 21, "#8fc4ff").dot(9, 22.5, "#3a7fe0");                                                    // a falling drop
}, 32, 32, 2);

// Frontier's Mail: a sturdy chain shirt with leather shoulders and a belt.
export const FRONTIERS_MAIL_HD = paint((p) => {
  p.poly([[8, 8], [24, 8], [27, 28], [5, 28]], STEEL, { spots: { color: "#4a525e", density: 0.1, seed: 4 } }); // chain body
  p.ellipse(8, 9, 5, 3.6, LEATHER).ellipse(24, 9, 5, 3.6, LEATHER);                                   // shoulders
  p.poly([[13, 7], [19, 7], [16, 12]], ["#120d14"], { flat: true, outline: false });                 // neck
  p.poly([[5, 21], [27, 21], [27.5, 24], [4.5, 24]], LEATHER);                                         // belt
  p.poly([[14, 20.5], [18, 20.5], [18, 24.5], [14, 24.5]], BRONZE);                                    // buckle
  p.dot(16, 22.5, BRONZE[0]);
}, 32, 32, 2);
