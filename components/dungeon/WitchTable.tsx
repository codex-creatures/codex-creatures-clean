"use client";
// components/dungeon/WitchTable.tsx
// The card witch's table in her room. Moved out of app/dungeon/page.tsx as it was.

import { useState } from "react";
import { isSeated, type Guess } from "@/lib/dungeon/witch";
import WitchWindow from "@/components/WitchWindow";
import { type Room, ILLNESS_DAMAGE, ILLNESS_ACTIONS } from "@/lib/dungeon/run";

// The card witch: she offers a game of higher or lower, played in a window
// over her room (components/WitchWindow.tsx). Once it's over, the room says how it went.
export default function WitchTable({ room, victim, onSit, onGuess, onLeave, next }: {
  room: Room; victim?: string; onSit: () => void; onGuess: (g: Guess) => void; onLeave: () => void; next: React.ReactNode;
}) {
  const w = room.witch!;
  // The window stays up when the game ends, until you leave her table.
  const [shut, setShut] = useState(() => w.state !== "playing");
  const won = w.won?.length ?? w.correct;
  return (
    <div style={{ marginTop: 6 }}>
      <p style={{ fontSize: 14, color: "#d8d4c8", margin: "0 0 10px" }}>
        {w.state === "playing" && <>A hunched witch shuffles a deck of bone cards. &ldquo;Fancy a game, dearie? Guess right and the creature&apos;s yours…&rdquo;</>}
        {w.state === "lost" && <b style={{ color: "#ff8a80" }}>🗡️ She stabbed {victim ?? "your creature"}{won > 0 ? " and took your cards back" : ""}. 🤢 −{Math.round(ILLNESS_DAMAGE * 100)}% HP for {ILLNESS_ACTIONS} actions.</b>}
        {w.state === "left" && <b style={{ color: "#f1d9a0" }}>You walked away with {w.correct} card{w.correct === 1 ? "" : "s"}.</b>}
      </p>
      {w.state === "playing" && !isSeated(w) ? <button className="pixel-btn" onClick={onSit}>🃏 Play her game</button>
        : w.state === "playing" ? null : next}
      {isSeated(w) && !shut && <WitchWindow game={w} victim={victim} onGuess={onGuess} onLeave={onLeave} onClose={() => setShut(true)} />}
    </div>
  );
}
