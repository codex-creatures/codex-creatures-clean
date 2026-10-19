"use client";
// components/WitchWindow.tsx
// The card witch's game, in a window over her room. Her card is shaped like a
// creature card, but laid out like a playing card: the prize you'd win in the
// middle (trimmed in its rarity), the number in the top right and bottom left
// corners, the suit (an attack style) in the other two. Lower on its left,
// higher on its right, walk away underneath. The next prize lies face down
// behind it, so its rarity shows round the edge. Guess right and the card
// sparkles away into your winnings, and the one behind comes forward.
// The window keeps one shape the whole game: only the words and cards change.

import { useEffect, useRef, useState } from "react";
import PixelSprite from "./PixelSprite";
import Help from "./Help";
import { CreatureArt } from "./CreaturePortrait";
import { cardTrim, cardWell, CARD_PIXEL, CARD_YELLOW } from "./CardGallery";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";
import { CARD_WITCH } from "@/lib/sprites/props";
import { SUIT_INFO, MAX_CORRECT, type Guess, type WitchCard, type WitchGame } from "@/lib/dungeon/witch";
import { ILLNESS_ACTIONS, ILLNESS_DAMAGE } from "@/lib/dungeon/run";

const CARD_W = "min(170px, 44cqw)";
const STEP = 9;           // px the card behind peeks out, up and to the left
const PLAIN = "#8a8478";  // a card with no prize on it (the one you see when you walk away)
const rarityOf = (id?: string) => (id ? CREATURE_BY_ID[id]?.rarity : undefined);
const colourOf = (id?: string) => { const r = rarityOf(id); return r ? RARITY_COLORS[r].text : PLAIN; };

// One of her cards, with the prize on it (or its suit, if there's none).
function PlayingCard({ card, prize, className }: { card: WitchCard; prize?: string; className?: string }) {
  const s = SUIT_INFO[card.suit];
  const t = prize ? CREATURE_BY_ID[prize] : undefined;
  const rc = colourOf(prize);
  const num: React.CSSProperties = { fontFamily: CARD_PIXEL, fontSize: "15cqw", lineHeight: 1, color: CARD_YELLOW, textShadow: "1px 1px 0 #000" };
  const suit: React.CSSProperties = { fontSize: "11cqw", lineHeight: 1 };
  const corner = (pos: React.CSSProperties, flip: boolean, child: React.ReactNode) => (
    <span style={{ position: "absolute", ...pos, transform: flip ? "rotate(180deg)" : undefined }}>{child}</span>
  );
  return (
    <div className={className} aria-label={`${card.n} of ${s.name}${t ? `, for ${t.name}` : ""}`}
      style={{ position: "relative", aspectRatio: "5 / 7", containerType: "inline-size", ...cardTrim(rc, !!t) }}>
      <div style={{ position: "absolute", inset: "17cqw 9cqw", ...cardWell(rc) }}>
        {t ? <CreatureArt creatureId={prize} title={t.name} />
          : <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "34cqw" }}>{s.icon}</span>}
      </div>
      {corner({ top: "4cqw", left: "5cqw" }, false, <span style={suit} title={s.name}>{s.icon}</span>)}
      {corner({ top: "4cqw", right: "5cqw" }, false, <span style={num}>{card.n}</span>)}
      {corner({ bottom: "4cqw", left: "5cqw" }, true, <span style={num}>{card.n}</span>)}
      {corner({ bottom: "4cqw", right: "5cqw" }, true, <span style={suit} title={s.name}>{s.icon}</span>)}
    </div>
  );
}

export default function WitchWindow({ game: w, victim, onGuess, onLeave, onClose }: {
  game: WitchGame; victim?: string;
  onGuess: (g: Guess) => void; onLeave: () => void; onClose: () => void;
}) {
  const playing = w.state === "playing";
  const result = w.last?.result;

  // A right guess: the card you won sparkles away over the one coming forward.
  const before = useRef({ correct: w.correct, card: w.card, prize: w.prize });
  const [won, setWon] = useState<{ card: WitchCard; prize?: string; key: number } | null>(null);
  useEffect(() => {
    const b = before.current;
    before.current = { correct: w.correct, card: w.card, prize: w.prize };
    if (w.correct <= b.correct) return;
    setWon({ card: b.card, prize: b.prize, key: w.correct });
    const t = setTimeout(() => setWon(null), 800);
    return () => clearTimeout(t);
  }, [w.correct, w.card, w.prize]);

  // The card on the table: hers, or (once you've walked away) the one that would have come next.
  const shown = w.state === "left" && w.peek ? w.peek : w.card;
  const prize = playing || w.state === "lost" ? w.prize : undefined;
  const behind = playing ? w.nextPrize : undefined;

  const line = w.state === "lost" ? <b style={{ color: "#ff8a80" }}>Wrong! She stabs {victim ?? "your creature"}.</b>
    : w.state === "left" ? <>The next card would have been…</>
    : result === "right" ? <b style={{ color: "#5ee08a" }}>Right! It&apos;s yours.</b>
    : result === "stick" ? <b>Stick: the same. Again.</b>
    : <>&ldquo;Higher or lower, dearie?&rdquo;</>;
  const winnings = w.won ?? [];
  const side: React.CSSProperties = { width: "min(70px, 18cqw)", alignSelf: "stretch", minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 15, padding: 4 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 190, background: "rgba(4,5,9,0.72)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6cqh 10px 10px" }}>
      <div role="dialog" aria-label="The card witch" className="title-bar sheet-up"
        style={{ width: "100%", maxWidth: 440, padding: 10, display: "grid", gap: 10, userSelect: "none", WebkitUserSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PixelSprite sprite={CARD_WITCH} scale={1.4} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pixel-font" style={{ fontSize: 17, color: CARD_YELLOW }}>The card witch</div>
            <div style={{ fontSize: 13, color: "#d8d4c8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{line}</div>
          </div>
          <Help title="The card witch">
            <ul>
              <li>Her deck: <b>1 to 11</b> in each of Melee ⚔️, Ranged 🏹 and Magic 🔮 — 33 cards.</li>
              <li>Every card left in the deck is <b>equally likely</b>. Cards played are gone for good (they&apos;re along the top).</li>
              <li>Right: you win <b>the creature on her card</b>. The card behind it (you can see its rarity) comes forward. Same (&ldquo;stick&rdquo;): guess again.</li>
              <li>Wrong: she stabs the creature that was <b>last on the field</b> (or your first). It loses <b>{Math.round(ILLNESS_DAMAGE * 100)}% HP</b> each of the next <b>{ILLNESS_ACTIONS} actions</b> — rooms, or rounds of a fight.</li>
              <li>Walk away any time and keep your cards — she shows you <b>the card that would have come next</b>. Lose, and she takes them all back. Her prizes run out after {MAX_CORRECT}.</li>
            </ul>
          </Help>
        </div>

        {/* The cards played so far, newest last. */}
        <div style={{ display: "flex", gap: 3, height: 26, justifyContent: "center", overflow: "hidden" }}>
          {w.history.slice(-10).map((c, i) => (
            <span key={i} className="witch-card pixel-font" style={{ width: 22, height: 26, fontSize: 11, borderColor: SUIT_INFO[c.suit].color, color: SUIT_INFO[c.suit].color }}>{c.n}</span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <button className="pixel-btn" style={{ ...side, visibility: playing ? "visible" : "hidden" }} disabled={w.card.n <= 1} onClick={() => onGuess("lower")}>
            <span style={{ fontSize: 22 }}>⬇️</span>Lower
          </button>
          <div style={{ position: "relative", width: CARD_W, marginTop: STEP }}>
            {/* The next prize, face down behind. */}
            <div style={{ position: "absolute", inset: 0, transform: `translate(-${STEP}px, -${STEP}px)`, visibility: behind ? "visible" : "hidden",
              ...cardTrim(colourOf(behind)), background: "repeating-linear-gradient(45deg, #23262f 0 6px, #1c1e26 6px 12px)" }} />
            <PlayingCard key={`${shown.n}${shown.suit}${w.correct}`} card={shown} prize={prize} className={won ? "witch-forward" : undefined} />
            {won && <div key={won.key} className="witch-won" style={{ position: "absolute", inset: 0 }}><PlayingCard card={won.card} prize={won.prize} /></div>}
          </div>
          <button className="pixel-btn" style={{ ...side, visibility: playing ? "visible" : "hidden" }} disabled={w.card.n >= 11} onClick={() => onGuess("higher")}>
            <span style={{ fontSize: 22 }}>⬆️</span>Higher
          </button>
        </div>

        {/* What you've won (and keep if you walk away now). */}
        <div className="pixel-font" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, height: 18, fontSize: 14, color: CARD_YELLOW, opacity: w.state === "lost" ? 0.4 : 1 }}>
          🃏 {winnings.length || w.correct}
          {winnings.map((id, i) => <span key={i} title={CREATURE_BY_ID[id]?.name} style={{ width: 9, height: 13, background: colourOf(id), border: "1px solid #000" }} />)}
        </div>

        {playing
          ? <button className="card-btn" style={{ justifyContent: "center", minHeight: 44 }} onClick={onLeave}>{w.correct > 0 ? `🚶 Walk away with ${w.correct} card${w.correct === 1 ? "" : "s"}` : "🚶 Walk away"}</button>
          : <button className="pixel-btn" style={{ minHeight: 44 }} onClick={onClose}>Leave the table</button>}
      </div>
    </div>
  );
}
