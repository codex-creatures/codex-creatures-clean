// components/CreaturePortrait.tsx
// The standard way to show a creature in a frame, taken from the creature
// card (the Skull Raven is the benchmark): the art fitted whole inside its
// box, 5% clear of each edge. Every creature fills its box the same way, so
// a tall one and a wide one look alike from screen to screen.
// - CreatureArt: fills whatever box it's put in (the card's own window).
// - CreaturePortrait: a box in the card window's shape (4:3) with the art in.

import PixelSprite, { creatureSprite } from "./PixelSprite";

// The card's art window: about 4 wide to 3 tall.
export const PORTRAIT_RATIO = "4 / 3";

// style: extra for the sprite itself (a filter: a shadow, greyed out when knocked out).
export function CreatureArt({ creatureId, title, style }: { creatureId?: string; title?: string; style?: React.CSSProperties }) {
  return (
    <span style={{ position: "absolute", inset: "5%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <PixelSprite sprite={creatureSprite(creatureId)} scale={4} title={title}
        style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", ...style }} />
    </span>
  );
}

export default function CreaturePortrait({ creatureId, title, style, frame }: {
  creatureId?: string; title?: string; style?: React.CSSProperties; frame?: React.CSSProperties;
}) {
  return (
    <span style={{ position: "relative", display: "block", width: "100%", aspectRatio: PORTRAIT_RATIO, ...frame }}>
      <CreatureArt creatureId={creatureId} title={title} style={style} />
    </span>
  );
}
