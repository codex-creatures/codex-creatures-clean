"use client";
// components/CardGallery.tsx
// Your creature cards as a binder of trading cards: one card per creature,
// with how many copies you hold. Grouped by rarity (rarest first), with a
// filter by race. Tap a card to see your copies and summon.

import { useState } from "react";
import type { CreatureOrItemDrop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CLASS_INFO, findCreatureTemplate, RACE_INFO, type CreatureTemplate } from "@/lib/creatures/creatureData";
import { CreatureToolbar, NO_INV_FILTER, passes, sortCreatures, type InventoryFilter } from "./CreatureMarks";
import { CARDS_TO_SUMMON } from "@/lib/creatures/summon";
import { SOUL_STONES, type SoulStoneKey } from "@/lib/creatures/soulStones";
import { SOUL_COLOR } from "./SoulStoneTag";
import { CreatureArt } from "./CreaturePortrait";


type Stack = { t: CreatureTemplate; cards: CreatureOrItemDrop[] };

export default function CardGallery({ cards, onOpen }: { cards: CreatureOrItemDrop[]; onOpen: (card: CreatureOrItemDrop) => void }) {
  const [filter, setFilter] = useState<InventoryFilter>(NO_INV_FILTER);

  // One stack per creature.
  const stacks = new Map<string, Stack>();
  for (const c of cards) {
    const t = findCreatureTemplate(c.creatureId, c.name);
    if (!t) continue;
    const s = stacks.get(t.id) ?? { t, cards: [] };
    s.cards.push(c);
    stacks.set(t.id, s);
  }
  const all = [...stacks.values()];
  const shown = sortCreatures(all.filter((s) => passes(filter, s.t.name, s.t.races ?? s.t.race, s.t.cls)), filter.sort,
    (s) => ({ name: s.t.name, rarity: s.t.rarity, race: s.t.race, cls: s.t.cls, createdAt: s.cards.map((c) => c.createdAt).sort().pop() }));

  return (
    <div style={{ marginTop: 2 }}>
      <CreatureToolbar value={filter} onChange={setFilter} shown={shown.length} total={all.length} noun="cards" />
      {shown.length === 0 && <p style={{ marginTop: 12, fontSize: 14, opacity: 0.5 }}>No cards match.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginTop: 14 }}>
        {shown.map((s) => <TradingCard key={s.t.id} stack={s} onOpen={() => onOpen(s.cards[0])} />)}
      </div>
    </div>
  );
}

function TradingCard({ stack, onOpen }: { stack: Stack; onOpen: () => void }) {
  const { t, cards } = stack;
  const ready = cards.length >= CARDS_TO_SUMMON;
  const stone = cards.find((c) => c.soulStone)?.soulStone;
  return (
    <CardFace t={t} creatureId={cards[0].creatureId ?? t.id} soulStone={stone} glow={ready} onClick={onOpen}
      label={`${t.name} card, ${cards.length} held`}
      badge={`×${cards.length}`}
      footer={<span style={{ color: ready ? "#ffcf6e" : undefined, fontWeight: ready ? 700 : 400 }}>{ready ? "✨ Ready to summon" : `${cards.length}/${CARDS_TO_SUMMON} to summon`}</span>} />
  );
}

// A creature's role, read off its stats (a rule of thumb — could become a field).
export function roleOf(t: CreatureTemplate): string {
  const p = t.proficiency;
  const off = t.cls === "melee" ? p.atk : t.cls === "ranged" ? p.rng : p.mag;
  const def = (p.mdef + p.rdef + p.magdef) / 3;
  if (def >= off * 1.3) return "Tank";
  if (p.agil >= off * 1.4) return "Skirmisher";
  if (off >= def * 2.5) return t.cls === "melee" ? "Brute" : t.cls === "ranged" ? "Sharpshooter" : "Glass cannon";
  return t.cls === "melee" ? "Fighter" : t.cls === "ranged" ? "Marksman" : "Spellcaster";
}

// Just the first sentence of the flavour, so it fits.
const shortFlavour = (s: string) => s.split(/(?<=[.!?])\s/)[0];

// Blend a #rrggbb colour toward white (amt > 0) or black (amt < 0).
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16), to = amt > 0 ? 255 : 0, a = Math.abs(amt);
  const ch = (v: number) => Math.round(v + (to - v) * a).toString(16).padStart(2, "0");
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

// Pixel bevels: raised (light top-left, dark bottom-right) and sunken (the reverse).
const raised = (base: string, px = 2) => `inset ${px}px ${px}px 0 ${shade(base, 0.3)}, inset -${px}px -${px}px 0 ${shade(base, -0.4)}`;
const sunken = (base: string, px = 2) => `inset ${px}px ${px}px 0 ${shade(base, -0.45)}, inset -${px}px -${px}px 0 ${shade(base, 0.15)}`;

const PIXEL = "var(--font-pixel), 'Courier New', monospace";
const YELLOW = "#f1d9a0";
const clamp2: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

// A sunken well for text at the bottom of a card.
export const CARD_WELL: React.CSSProperties = { padding: "2.5cqw 4cqw 3cqw", background: "#191b22", boxShadow: sunken("#2a2d36") };
export const CARD_YELLOW = YELLOW;
export const CARD_PIXEL = PIXEL;

// A card's stone and its bevelled trim in the rarity colour rc (glow: a halo too).
export const cardTrim = (rc: string, glow?: boolean): React.CSSProperties => ({
  background: "#23262f", border: `2px solid ${shade(rc, -0.55)}`,
  boxShadow: `inset 0 0 0 1px ${rc}, inset 2px 2px 0 ${shade(rc, 0.35)}, inset -2px -2px 0 ${shade(rc, -0.35)}, inset 4px 4px 0 #3a3e4b, inset -4px -4px 0 #181a21, 0 4px 0 rgba(0,0,0,0.5)${glow ? `, 0 0 14px ${rc}` : ""}`,
});
// The sunken box a card's sprite sits in, on a faded glow of its rarity colour.
export const cardWell = (rc: string): React.CSSProperties => ({ background: `radial-gradient(circle at 50% 50%, ${rc}66, ${rc}1a 70%), #15171d`, boxShadow: sunken("#2a2d36", 3) });

// The card itself, shared by every creature card: dark stone with a thin
// bevelled trim in the rarity colour; the name (and, with showRarity, its
// rarity under it); the sprite on a faded rarity glow (filling the box, 5%
// clear each side); its race(s), a square each in the race's colour (one
// race: one wide square); then children at the bottom.
// Text scales with the card's width (cqw), so it must sit inside a box with
// containerType "inline-size". fill: take the parent's height instead of
// the usual 5:7 shape. big: a larger name and races (a card shown on
// its own, like the fight cards). noName: leave the name off (it's written
// under the card already), so the sprite gets the room.
export function CardBody({ t, creatureId, glow, showRarity, fill, big, noName, children }: {
  t: CreatureTemplate; creatureId: string; glow?: boolean; showRarity?: boolean; fill?: boolean; big?: boolean; noName?: boolean; children?: React.ReactNode;
}) {
  const rc = RARITY_COLORS[t.rarity].text;
  // Its race(s), a plaque each (none, like a boss part: its style instead).
  const races = t.races ?? (t.race ? [t.race] : []);
  const plaques = races.length ? races.map((r) => RACE_INFO[r]) : [CLASS_INFO[t.cls]];
  const plaque: React.CSSProperties = { flex: 1, textAlign: "center", padding: "2cqw 1cqw", background: "#2e323d", boxShadow: raised("#2e323d"), overflow: "hidden", textOverflow: "ellipsis" };
  return (
    <div style={{
      ...(fill ? { height: "100%" } : { aspectRatio: "5 / 7" }), display: "flex", flexDirection: "column", gap: "3cqw", padding: "5.5cqw",
      ...cardTrim(rc, glow),
    }}>
      {!noName && <div style={{ textAlign: "center", padding: "2.5cqw 3cqw" }}>
        {/* Always two lines tall (a one-line name sits in the middle), so every
            card's picture is the same size. Names fit two lines: CARD_NAME_LINE (lib/uiText.ts). */}
        <div title={t.name} style={{ fontFamily: PIXEL, fontSize: big ? "clamp(13px, 9.5cqw, 22px)" : "clamp(9px, 7.5cqw, 15px)", lineHeight: 1.15, height: "2.3em",
          display: "flex", alignItems: "center", justifyContent: "center", color: YELLOW, textShadow: "1px 1px 0 #000" }}>
          <span style={clamp2}>{t.name}</span>
        </div>
        {showRarity && <div style={{ fontFamily: PIXEL, fontSize: big ? "clamp(9px, 6cqw, 14px)" : "clamp(7px, 5cqw, 11px)", marginTop: "1cqw", color: rc, textTransform: "capitalize" }}>{t.rarity}</div>}
      </div>}
      <div style={{ position: "relative", flex: 1, minHeight: 0, ...cardWell(rc) }}>
        <CreatureArt creatureId={creatureId} title={t.name} />
      </div>
      {noName ? (
        // Without the name: one race over the other, each a full-width plaque
        // in bigger letters (the second keeps its space when there's one race).
        <div style={{ display: "flex", flexDirection: "column", gap: "3cqw", fontFamily: PIXEL, fontSize: "clamp(8px, 12cqw, 16px)", lineHeight: 1.1, whiteSpace: "nowrap" }}>
          {[0, 1].map((i) => <span key={i} title={plaques[i]?.name} style={{ ...plaque, color: plaques[i]?.color, visibility: plaques[i] ? "visible" : "hidden" }}>{plaques[i]?.name ?? "—"}</span>)}
        </div>
      ) : (
        <div style={{ display: "flex", gap: "3cqw", fontFamily: PIXEL, fontSize: big ? "clamp(10px, 7cqw, 16px)" : "clamp(7px, 5.6cqw, 11px)", whiteSpace: "nowrap" }}>
          {plaques.map((p) => <span key={p.name} title={p.name} style={{ ...plaque, color: p.color }}>{p.name}</span>)}
        </div>
      )}
      {children}
    </div>
  );
}

// A creature card's face (CardBody with its role over a line of flavour, or
// its soul stone if the card has one). The Skull Raven is the benchmark. Used
// in your binder, for cards you've just found, and for the card witch's
// prize. badge: a corner bubble (how many you hold); footer: a line under the card.
// mini: the small card in a loot window, where the name is written under it —
// no name or role line, just the sprite as big as it'll go over its races.
export function CardFace({ t, creatureId, soulStone, footer, badge, glow, onClick, label, mini }: {
  t: CreatureTemplate; creatureId: string; soulStone?: SoulStoneKey | null; footer?: React.ReactNode; badge?: string; glow?: boolean;
  onClick?: () => void; label?: string; mini?: boolean;
}) {
  const rc = RARITY_COLORS[t.rarity].text;
  const stone = soulStone ? SOUL_STONES[soulStone] : undefined;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag onClick={onClick} aria-label={label ?? `${t.name} card`}
      style={{ position: "relative", display: "block", width: "100%", padding: 0, border: "none", background: "none", textAlign: "left", cursor: onClick ? "pointer" : "default", containerType: "inline-size" }}>
      <CardBody t={t} creatureId={creatureId} glow={glow} noName={mini}>
        {!mini && <div style={CARD_WELL}>
          <div style={{ fontFamily: PIXEL, fontSize: "clamp(8px, 6.4cqw, 12px)", color: YELLOW, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{roleOf(t)}</div>
          <div style={{ fontSize: "clamp(8px, 5.8cqw, 10px)", lineHeight: 1.2, height: "2.4em", marginTop: 1, color: stone ? SOUL_COLOR : "rgba(255,255,255,0.6)", ...clamp2 }}>
            {stone ? `${stone.icon} ${stone.name}` : shortFlavour(t.flavour)}
          </div>
        </div>}
      </CardBody>

      {footer && <div style={{ marginTop: 6, fontSize: 11, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.6)" }}>{footer}</div>}

      {badge && (
        <span className="pixel-font" style={{
          position: "absolute", top: -8, right: -8, minWidth: 28, height: 28, padding: "0 6px", borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          background: "#1a140c", color: YELLOW, border: `2px solid ${rc}`,
        }}>
          {badge}
        </span>
      )}
    </Tag>
  );
}
