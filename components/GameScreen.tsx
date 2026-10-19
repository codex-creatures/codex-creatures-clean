"use client";
// components/GameScreen.tsx
// The game's one screen: always the same size, like a handheld's display.
// On a phone it fills the screen; on a laptop it's a borderless portrait
// screen, the full height of the window, in the middle. Nothing
// makes the page taller: a long list scrolls inside its own panel, and
// sheets and modals open inside the screen (it's their containing block,
// and the size for cqw/cqh units). See .game-screen in globals.css.
// The dev tools (/lab, /simulator) skip it and use the whole window.

import { usePathname } from "next/navigation";

export default function GameScreen({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/lab") || path.startsWith("/simulator")) return <>{children}</>;
  return (
    <div className="game-shell">
      <div className="game-screen">
        <div className="screen-body">{children}</div>
      </div>
    </div>
  );
}
