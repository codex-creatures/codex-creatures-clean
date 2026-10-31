"use client";
// components/GameScreen.tsx
// The game's one screen: always the same size, like a handheld's display.
// On a phone it fills the screen; on a laptop it's a borderless portrait
// screen, the full height of the window, in the middle. Nothing
// makes the page taller: a long list scrolls inside its own panel, and
// sheets and modals open inside the screen (it's their containing block,
// and the size for cqw/cqh units). See .game-screen in globals.css.
// The dev tools (/lab, /simulator) skip it and use the whole window.
//
// Screen size (Settings, lib/uiScale.ts): everything inside is laid out on a
// smaller (or bigger) screen and then drawn scaled up to fill this one, so
// it all grows together and still fits.

import { usePathname } from "next/navigation";
import { useUiScale } from "@/hooks/useUiScale";
import PlayClock from "@/components/PlayClock";
import CloudSync from "@/components/CloudSync";

export default function GameScreen({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const scale = useUiScale();
  if (path.startsWith("/lab") || path.startsWith("/simulator")) return <>{children}</>;
  return (
    <div className="game-shell">
      <div className="game-screen">
        <div className="screen-scale" style={scale === 1 ? undefined
          : { width: `calc(100% / ${scale})`, height: `calc(100% / ${scale})`, transform: `scale(${scale})` }}>
          <div className="screen-body">{children}</div>
          <PlayClock />
          <CloudSync />
        </div>
      </div>
    </div>
  );
}
