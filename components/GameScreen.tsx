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

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUiScale } from "@/hooks/useUiScale";
import PlayClock from "@/components/PlayClock";
import CloudSync from "@/components/CloudSync";
import { needsTitle, STARTED_KEY } from "@/lib/saveSlots";

export default function GameScreen({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const scale = useUiScale();
  // The title screen first (lib/saveSlots.ts needsTitle). The page stays
  // blank until that's checked, so it can't load (and save) a game before
  // the title screen has picked one.
  // (Once a save is picked, that holds for the rest of the visit.)
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (started) return;
    let picked = true;
    try { picked = window.sessionStorage.getItem(STARTED_KEY) !== null; } catch {}
    if (picked) setStarted(true);
    else if (needsTitle(path, false)) router.replace("/start");
  }, [path, router, started]);
  if (path.startsWith("/lab") || path.startsWith("/simulator")) return <>{children}</>;
  const show = started || !needsTitle(path, false);
  return (
    <div className="game-shell">
      <div className="game-screen">
        <div className="screen-scale" style={scale === 1 ? undefined
          : { width: `calc(100% / ${scale})`, height: `calc(100% / ${scale})`, transform: `scale(${scale})` }}>
          <div className="screen-body">{show ? children : null}</div>
          <PlayClock />
          <CloudSync />
        </div>
      </div>
    </div>
  );
}
