"use client";
// components/klutz/KlutzHead.tsx
// Klutz's face as an icon (the user, 2026-11-24: his head, not the 👺 that stood for him): the top of his own
// sprite (public/sprites/creatures/klutz.png, 69×85), cropped to his head and drawn at `size` tall, inline with
// text. Used wherever something stands for him: his Den's title, "Back to Klutz", the cage's note.

const SRC = "/sprites/creatures/klutz.png";
const SHEET = { w: 69, h: 85 };
const HEAD = { x: 10, y: 0, w: 48, h: 44 }; // where his head is on the sprite

export default function KlutzHead({ size = 24, style }: { size?: number; style?: React.CSSProperties }) {
  const k = size / HEAD.h;
  return (
    <span aria-label="Klutz" role="img" style={{
      display: "inline-block", verticalAlign: "-0.2em", width: HEAD.w * k, height: size, flexShrink: 0,
      backgroundImage: `url(${SRC})`, backgroundRepeat: "no-repeat", imageRendering: "pixelated",
      backgroundSize: `${SHEET.w * k}px ${SHEET.h * k}px`, backgroundPosition: `${-HEAD.x * k}px ${-HEAD.y * k}px`,
      ...style,
    }} />
  );
}
