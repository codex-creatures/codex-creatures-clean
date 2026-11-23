"use client";
// components/altar/SummonRite.tsx
// Spirit Summon for one creature (the user, 2026-11-20: tapping a ready stack,
// or "Summon" on a card anywhere, comes straight here): the 3 cards you'll use
// laid out on top, every card of the kind below to swap them, and the two
// ways to summon in the dock. Then the whirlwind (SummonShow) and what came out.

import { useState } from "react";
import type { CreatureOrItemDrop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { defaultMoveNames, findCreatureTemplate } from "@/lib/creatures/creatureData";
import { CARDS_TO_SUMMON } from "@/lib/creatures/summon";
import { CardFace } from "../CardGallery";
import { DiffLine, Moves, RollTable } from "../CardModal";
import SoulStoneTag from "../SoulStoneTag";
import SummonShow from "../SummonShow";

const MUTED = "rgba(255,255,255,0.6)";
const GOLD = "#ffd66e";

export default function SummonRite({ cards, onSummon, onDone, top }: {
  cards: CreatureOrItemDrop[]; // every card you hold of this creature
  onSummon: (cardIds: string[], keepId: string | null) => CreatureOrItemDrop;
  onDone: () => void;          // back to the cards
  top: React.ReactNode;        // the header row's back button, title and "?"
}) {
  const t = cards[0] && findCreatureTemplate(cards[0].creatureId, cards[0].name);
  const [picked, setPicked] = useState<string[]>(() => cards.slice(0, CARDS_TO_SUMMON).map((c) => c.id));
  const [keep, setKeep] = useState<string | undefined>(cards[0]?.id);
  const [used, setUsed] = useState<CreatureOrItemDrop[] | null>(null);  // while the whirlwind plays
  const [result, setResult] = useState<CreatureOrItemDrop | null>(null);

  if (!t) return null;
  const ready = picked.length === CARDS_TO_SUMMON;
  const keptOk = !!keep && picked.includes(keep);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < CARDS_TO_SUMMON ? [...p, id] : p));
  }
  function summon(mode: "choose" | "random") {
    setUsed(cards.filter((k) => picked.includes(k.id))); // (before they're gone from the inventory)
    setResult(onSummon(picked, mode === "choose" ? keep! : null));
  }

  if (result && used) return <SummonShow t={t} cards={used} result={result} onDone={() => setUsed(null)} />;
  if (result) {
    const c = RARITY_COLORS[result.rarity];
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 4px" }}>{top}</div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 12px 8px", textAlign: "center" }}>
          <div className="pixel-font" style={{ fontSize: 22, color: c.text, margin: "6px 0 2px" }}>{result.name} summoned!</div>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 10px" }}>It&apos;s in your Creatures: equip it in the Pit.</p>
          <SoulStoneTag stone={result.soulStone} />
          <RollTable p={result.proficiency ?? t.proficiency} base={t.proficiency} />
          <div style={{ marginTop: 8 }}><Moves names={result.moves ?? []} t={t} /></div>
        </div>
        <div className="screen-dock"><button className="pixel-btn" style={{ width: "100%", minHeight: 48 }} onClick={onDone}>Done</button></div>
      </>
    );
  }

  const chosen = picked.map((id) => cards.find((c) => c.id === id)!);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 4px" }}>{top}</div>

      {/* The cards going in: always 3 places, empty ones dashed. */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${CARDS_TO_SUMMON}, 1fr)`, gap: "4cqw", padding: "6px 10cqw 4px" }}>
        {Array.from({ length: CARDS_TO_SUMMON }, (_, i) => {
          const k = chosen[i];
          return (
            <div key={i} style={{ position: "relative", aspectRatio: "5 / 7" }}>
              {k ? (
                // The glow is a shadow on a box over the card, not a filter on the card: a filter on the drawn card
                // didn't always repaint when ★ moved, so the first card kept its gold top (the user, 2026-11-24).
                <div style={{ position: "relative" }}>
                  <CardFace t={t} creatureId={k.creatureId ?? t.id} soulStone={k.soulStone} mini />
                  <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 4,
                    boxShadow: k.id === keep ? `0 0 10px 3px ${GOLD}` : "0 0 8px 2px rgba(127,216,255,0.5)" }} />
                </div>
              ) : (
                <div style={{ position: "absolute", inset: 0, border: "2px dashed rgba(127,216,255,0.4)" }} />
              )}
              <span className="pixel-font" style={{ position: "absolute", left: 0, right: 0, bottom: -16, textAlign: "center", fontSize: 11, color: GOLD,
                visibility: k && k.id === keep ? "visible" : "hidden" }}>★ kept</span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: MUTED, margin: "20px 12px 6px", textAlign: "center" }}>
        {ready ? "Keep one card's creature as it is, or roll a new one." : `Pick ${CARDS_TO_SUMMON - picked.length} more.`} The cards are used up.
      </p>

      {/* Every card of the kind: tap to use it, ★ to keep its creature. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
        {cards.map((k) => {
          const on = picked.includes(k.id);
          return (
            <div key={k.id} className="card-btn" style={{ cursor: "default", borderColor: on ? "#8a6a3a" : undefined, padding: 0, alignItems: "stretch" }}>
              <button onClick={() => toggle(k.id)} aria-pressed={on} aria-label="Use this card"
                style={{ flex: 1, minWidth: 0, minHeight: 48, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "none", border: "none", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" }}>
                <span style={{ fontSize: 18, width: 20, color: on ? "#7fd8ff" : MUTED }}>{on ? "☑" : "☐"}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                  <DiffLine p={k.proficiency ?? t.proficiency} base={t.proficiency} />
                  <span style={{ display: "block", color: "#c9b48a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(k.moves ?? defaultMoveNames(t)).join(" · ")}</span>
                  <span style={{ display: "block", minHeight: 16 }}>{k.soulStone && <SoulStoneTag stone={k.soulStone} compact />}</span>
                </span>
              </button>
              <button onClick={() => setKeep(k.id)} aria-label="Keep this card's creature" aria-pressed={keep === k.id}
                style={{ width: 56, minHeight: 48, background: "none", border: "none", borderLeft: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
                  fontSize: 11, color: keep === k.id ? GOLD : MUTED, visibility: on ? "visible" : "hidden" }}>
                <span style={{ display: "block", fontSize: 18 }}>{keep === k.id ? "★" : "☆"}</span>keep
              </button>
            </div>
          );
        })}
      </div>

      <div className="screen-dock" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button className="pixel-btn" style={{ minHeight: 48 }} disabled={!ready || !keptOk} onClick={() => summon("choose")}>Summon the kept card</button>
        <button className="pixel-btn" style={{ minHeight: 48 }} disabled={!ready} onClick={() => summon("random")}>Summon a random {t.name}</button>
      </div>
    </>
  );
}
