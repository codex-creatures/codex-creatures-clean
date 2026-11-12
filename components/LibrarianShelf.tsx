"use client";
// components/LibrarianShelf.tsx
// A librarian's codexes (the tavern's and the Labyrinth's), as an inventory to look through (like the
// merchant's cart): each codex in a slot, in its rarity's colours, with its
// price under it. Tap one to see it in the box on top (its move as a tablet,
// a snapshot of it and who can read it) and Buy it from there; the snapshot's "?" shows the
// move in full. The box keeps its size whatever's picked, and empty slots
// keep the shelf the same size, so nothing moves.

import { useMemo, useState } from "react";
import { Coin } from "./GoldCount";
import CodexMove from "./CodexMove";
import PixelSprite from "./PixelSprite";
import { ICON } from "./ContainerLoot";
import { codexLearners, MOVE_BY_NAME } from "@/lib/creatures/creatureData";
import { codexDrop } from "@/lib/drops";
import { RARITY_COLORS, rarityGlow } from "@/lib/items/gameHelpers";
import { CODEX_SPRITE } from "@/lib/sprites/items";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.55)";
const GOLD = "#f1d9a0";
const SLOTS = 5; // a row of the shelf, however few he brings

export default function LibrarianShelf({ offers, bought = [], price, gold, full, room, onBuy }: {
  offers: string[]; bought?: string[];
  price: (move: string) => number;
  gold: number;
  full?: string;               // no room for it ("Bookcase full", "Bag full")
  room: React.ReactNode;       // what room you have, under the shelf
  onBuy: (move: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const rarity = useMemo(() => Object.fromEntries(offers.map((m) => [m, (codexDrop(m) as CreatureOrItemDrop).rarity])), [offers]);
  const move = picked ? MOVE_BY_NAME[picked] : undefined;
  const learners = picked ? codexLearners(picked) : undefined;
  const sold = !!picked && bought.includes(picked);
  const cost = picked ? price(picked) : 0;
  const why = !picked ? "" : sold ? "Bought" : full ? full : gold < cost ? "Not enough gold" : "";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {/* The codex picked: its move, who can read it, and Buy. */}
      <div className="stone-panel" style={{ padding: "8px 10px", height: 178, boxSizing: "border-box", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 6 }}>
        {picked && move ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <b className="pixel-font" title={`Codex: ${picked}`} style={{ flex: 1, minWidth: 0, fontSize: 15, color: RARITY_COLORS[rarity[picked]].text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{picked}</b>
              <span style={{ fontSize: 12, color: learners!.color, whiteSpace: "nowrap" }}>{learners!.text}</span>
            </div>
            <CodexMove move={picked} />
            <button className="pixel-btn" disabled={!!why} onClick={() => onBuy(picked)} style={{ width: "100%", minHeight: 44 }}>
              {why || <>Buy for <Coin /> {cost}</>}
            </button>
          </>
        ) : (
          <div style={{ gridRow: "1 / -1", alignSelf: "center", textAlign: "center", fontSize: 13, color: MUTED }}>Tap a codex to look at it.</div>
        )}
      </div>

      {/* The shelf */}
      <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: `repeat(${SLOTS}, 1fr)`, gap: 6, padding: 8 }}>
        {offers.map((m) => {
          const gone = bought.includes(m);
          const on = m === picked;
          return (
            <button key={m} onClick={() => setPicked(on ? null : m)} title={`Codex: ${m}`} aria-pressed={on}
              style={{ background: "none", border: "none", padding: 0, minWidth: 0, color: "white", cursor: "pointer", opacity: gone ? 0.35 : 1 }}>
              <span className="inv-slot" style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                background: `radial-gradient(circle, ${rarityGlow(rarity[m])} 0%, rgba(0,0,0,0.35) 65%)`, borderColor: on ? "#ffd66e" : RARITY_COLORS[rarity[m]].border,
                ...(on ? { boxShadow: "0 0 12px rgba(255,214,110,0.55)" } : {}) }}>
                <PixelSprite sprite={CODEX_SPRITE} scale={4} style={ICON} />
              </span>
              <span className="pixel-font" style={{ display: "block", marginTop: 3, fontSize: 11, textAlign: "center", color: gone ? MUTED : on ? "#ffd66e" : GOLD }}>{gone ? "sold" : <><Coin size={11} /> {price(m)}</>}</span>
            </button>
          );
        })}
        {Array.from({ length: Math.max(0, SLOTS - offers.length) }, (_, i) => (
          <span key={`empty${i}`} aria-hidden>
            <span className="inv-slot" style={{ aspectRatio: "1", display: "block", opacity: 0.4 }} />
            <span className="pixel-font" style={{ display: "block", marginTop: 3, fontSize: 11, visibility: "hidden" }}>·</span>
          </span>
        ))}
      </div>
      <p style={{ fontSize: 12, color: MUTED, margin: 0 }}><Coin size={12} /> {gold} · {room}</p>
    </div>
  );
}
