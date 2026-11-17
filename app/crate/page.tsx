"use client";
// app/crate/page.tsx
// Klutz's crate on its own (the old way in; it lives in Klutz's Den now:
// app/klutz, its Crate tab). The list itself: components/klutz/KlutzCrate.tsx.

import DenFrame from "@/components/DenFrame";
import KlutzCrate from "@/components/klutz/KlutzCrate";
import { useGameState } from "@/hooks/useGameState";

export default function CratePage() {
  const game = useGameState();
  return (
    <DenFrame title="Klutz's Crate" icon="📦" gold={game.gold} back="/klutz" backLabel="Klutz's Den">
      {game.hydrated ? <KlutzCrate game={game} /> : <p style={{ color: "rgba(255,255,255,0.5)" }}>Loading…</p>}
    </DenFrame>
  );
}
