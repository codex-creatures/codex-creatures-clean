// lib/uiText.ts
// How much text the game's fixed boxes hold. Every window is a fixed frame
// (docs/design.md → UI): a name gets a set number of lines, and the names we
// write are kept short enough to fit them. These are the line lengths, in
// letters, for the pixel font at the box's smallest size (Pixelify Sans
// averages about 0.62em a letter); tests/uiText.test.ts checks every name.

// A creature card's name: two lines (components/CardGallery.tsx CardBody).
export const CARD_NAME_LINE = 14;
// A move tablet's name on the full-size tablet: two lines (components/MoveTile.tsx).
export const MOVE_NAME_LINE = 12;

// ── Move tablets, wherever they're shown (the user, 2026-11-14: names were split on
// narrow tablets and descriptions didn't fit the tablet's back) ──
// Measured in a browser on the smallest phone we design for (/lab/movetext, which
// uses these same numbers), then checked for every move by tests/uiText.test.ts.
export const PHONE = { w: 360, h: 640 };
// The name box: the tablet less these sides (the i and the cost sit at the right).
// A narrow tablet (MoveTile's fill) lets the name run under their corners.
export const NAME_INSET = { tablet: { left: 24, right: 24 }, fill: { left: 6, right: 28 } };
// A letter of the tablet's name font, in em, at its widest (Pixelify Sans with the
// tablet's letter spacing; measured 0.682 on 2026-11-14): the name shrinks so its longest word fits.
export const NAME_EM = 0.69;
// …but never below this (px), or it's too small to read.
export const NAME_MIN_PX = 10;
// Each place tablets are shown, on PHONE: how wide a tablet is there (px), its
// usual name size (px), and whether it's a narrow (fill) tablet.
export type TabletPlace = { id: string; name: string; cols: number; width: number; cellH?: number; fill: boolean; tablet: number; font: number };
const FILL_FONT = Math.min(19, Math.max(12, 0.042 * PHONE.w)), TABLET_FONT = Math.min(22, Math.max(16, 0.05 * PHONE.w));
const across = (width: number, cols: number, gap: number) => (width - gap * (cols - 1)) / cols;
export const TABLET_PLACES: TabletPlace[] = [
  // Klutz's tour bubble (components/TourPicture.tsx: two a row, 64px tall).
  { id: "tour", name: "Klutz's tour (2 across)", cols: 2, width: 260, cellH: 64, fill: true, tablet: across(260, 2, 6), font: FILL_FONT },
  // The battle dock (.battle-dock, at its 200px floor): 3 across with 5–6 moves, else 2.
  { id: "dock3", name: "Battle dock, 5–6 moves (3 across)", cols: 3, width: PHONE.w - 16, cellH: 78, fill: true, tablet: across(PHONE.w - 16, 3, 6), font: FILL_FONT },
  { id: "dock2", name: "Battle dock, up to 4 moves (2 across)", cols: 2, width: PHONE.w - 16, cellH: 78, fill: true, tablet: across(PHONE.w - 16, 2, 6), font: FILL_FONT },
  // The creature window's .move-grid, inside the modal's padding; a codex's 150px tablet.
  { id: "grid", name: "Creature window (2 across)", cols: 2, width: PHONE.w - 68, fill: false, tablet: across(PHONE.w - 68, 2, 10), font: TABLET_FONT },
  { id: "codex", name: "A codex's tablet", cols: 1, width: 150, fill: false, tablet: 150, font: TABLET_FONT },
];
// The name's size on a tablet at `place`, and the letters a line holds there.
export function tabletName(name: string, place: TabletPlace): { font: number; line: number } {
  const inset = NAME_INSET[place.fill ? "fill" : "tablet"], box = place.tablet - inset.left - inset.right;
  const longest = Math.max(...name.split(" ").map((w) => w.length));
  const font = Math.min(place.font, box / (longest * NAME_EM));
  return { font, line: Math.floor(box / (font * NAME_EM) + 1e-9) };
}

// The details window behind a tablet's i (MoveTile's MoveDetails): one fixed box.
export const MOVE_DETAILS = { w: 320, h: 310, pad: 14, font: 14, lineHeight: 1.4 };
// A description: at most DESC_LINES lines of DESC_LINE letters (the body font at
// MOVE_DETAILS.font: a line really holds about 44, so this has room to spare), leaving EXTRA_LINES for a fight's effect lines.
export const DESC_LINE = 38;
export const DESC_LINES = 7;
export const EXTRA_LINES = 3;

// Text broken into lines of at most `max` letters, at spaces (a word longer
// than a line gets a line of its own, and is too long).
export function wrapLines(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

// Does it fit in `lines` lines of `max` letters?
export const fitsLines = (text: string, max: number, lines = 2) => {
  const l = wrapLines(text, max);
  return l.length <= lines && l.every((x) => x.length <= max);
};
