// components/Glyph.tsx
// A small icon that sits in a line of text: its PixelLab art (public/sprites/icons,
// 32×32) when it has some, otherwise the emoji it had before. Sized in em, so it
// follows the text around it.

import type { ReactNode } from "react";
import { BALANCED_INFO, RACE_INFO, type Race } from "@/lib/creatures/creatureData";

export default function Glyph({ icon, art, title, size = "1.25em" }: {
  icon: ReactNode; art?: string; title?: string; size?: string | number;
}) {
  if (!art) return <>{icon}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/sprites/icons/${art}.png`} alt={title ?? ""} title={title} draggable={false}
      style={{ width: size, height: size, display: "inline-block", verticalAlign: "-0.3em", imageRendering: "pixelated" }} />
  );
}

// A race's icon (none: a Neutral move's).
export const RaceIcon = ({ r, size }: { r?: Race; size?: string | number }) => {
  const info = r ? RACE_INFO[r] : BALANCED_INFO;
  return <Glyph icon={info.icon} art={info.art} size={size} />;
};
