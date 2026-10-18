"use client";
// components/CardStack.tsx
// The creature cards you got, as one neat stack: the rarest card on top and
// the rest peeking out behind it, up and to the left, each edged in its own
// rarity colour. Tap the stack to flick through the cards (CardFan).

import { useState } from "react";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { CreatureTemplate } from "@/lib/creatures/creatureData";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CardFace } from "./CardGallery";
import { CardFan } from "./EncounterCards";

export type CardPile = { x: CreatureOrItemDrop; t: CreatureTemplate; n: number }; // n copies of one creature's card

const RANK = ["legendary", "epic", "rare", "uncommon", "common"];
const BEHIND = 4;   // at most this many cards peek out
const STEP = 9;     // px each one is offset

export default function CardStack({ piles, faded }: { piles: CardPile[]; faded?: boolean }) {
  const [open, setOpen] = useState(false);
  const sorted = [...piles].sort((a, b) => RANK.indexOf(a.t.rarity) - RANK.indexOf(b.t.rarity));
  // Every copy, in order — the ones behind the top card show their own colours.
  const copies = sorted.flatMap((p) => Array.from({ length: p.n }, () => p.t.rarity));
  const total = copies.length;
  const behind = copies.slice(1, 1 + BEHIND);
  const top = sorted[0];

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={`${total} creature card${total === 1 ? "" : "s"} — tap to look through them`}
        style={{
          position: "relative", display: "block", width: 150, padding: 0, border: "none", background: "none", cursor: "pointer",
          margin: `${behind.length * STEP + 4}px 0 10px ${behind.length * STEP}px`, opacity: faded ? 0.55 : 1,
        }}>
        {/* Furthest back first, so nearer cards cover them. */}
        {behind.map((r, i) => i).reverse().map((i) => {
          const rc = RARITY_COLORS[behind[i] as keyof typeof RARITY_COLORS].text;
          const off = (i + 1) * STEP;
          return (
            <div key={i} style={{
              position: "absolute", inset: 0, transform: `translate(-${off}px, -${off}px)`,
              background: "#23262f", border: "2px solid #12131a",
              boxShadow: `inset 0 0 0 2px ${rc}, inset 4px 4px 0 #3a3e4b, inset -4px -4px 0 #181a21, 0 2px 6px rgba(0,0,0,0.5)`,
            }} />
          );
        })}
        <div style={{ position: "relative" }}>
          <CardFace t={top.t} creatureId={top.x.creatureId ?? top.t.id} ability={top.x.ability} badge={total > 1 ? `×${total}` : undefined} />
        </div>
      </button>

      {open && (
        <CardFan count={sorted.length} label="The cards you got" onClose={() => setOpen(false)}
          title={total === 1 ? "1 card" : `${total} cards`}
          size={{ width: "min(300px, 78cqw, 47cqh)", height: "min(420px, 109.2cqw, 65.8cqh)" }}
          render={(i) => {
            const p = sorted[i];
            return <CardFace t={p.t} creatureId={p.x.creatureId ?? p.t.id} ability={p.x.ability} badge={p.n > 1 ? `×${p.n}` : undefined} />;
          }} />
      )}
    </>
  );
}
