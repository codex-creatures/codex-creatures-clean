// lib/uiText.ts
// How much text the game's fixed boxes hold. Every window is a fixed frame
// (docs/design.md → UI): a name gets a set number of lines, and the names we
// write are kept short enough to fit them. These are the line lengths, in
// letters, for the pixel font at the box's smallest size (Pixelify Sans
// averages about 0.62em a letter); tests/uiText.test.ts checks every name.

// A creature card's name: two lines (components/CardGallery.tsx CardBody).
export const CARD_NAME_LINE = 14;
// A move tablet's name: two lines (components/MoveTile.tsx).
export const MOVE_NAME_LINE = 12;

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
