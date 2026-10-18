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
import { ABILITIES } from "@/lib/creatures/abilities";
import { spriteWidth } from "@/lib/sprites/pixels";
import PixelSprite, { creatureSprite } from "./PixelSprite";

const SERIF = "Georgia, 'Times New Roman', serif";

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
  const shown = sortCreatures(all.filter((s) => passes(filter, s.t.name, s.t.race, s.t.cls)), filter.sort,
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
  const ability = cards.find((c) => c.ability)?.ability;
  return (
    <CardFace t={t} creatureId={cards[0].creatureId ?? t.id} ability={ability} glow={ready} onClick={onOpen}
      label={`${t.name} card, ${cards.length} held`}
      badge={`×${cards.length}`}
      footer={<span style={{ color: ready ? "#7a4b00" : "#6b5a3e", fontWeight: ready ? 700 : 400 }}>{ready ? "✨ Ready to summon" : `${cards.length}/${CARDS_TO_SUMMON} to summon`}</span>} />
  );
}

// A creature card's face: name, art, race and class, any ability, flavour,
// and a footer line. Used in your binder, for cards you've just found, and
// for the card witch's prize. badge: a corner bubble (how many you hold).
export function CardFace({ t, creatureId, ability, footer, badge, glow, onClick, label }: {
  t: CreatureTemplate; creatureId: string; ability?: string; footer?: React.ReactNode; badge?: string; glow?: boolean;
  onClick?: () => void; label?: string;
}) {
  const rc = RARITY_COLORS[t.rarity];
  const race = t.race ? RACE_INFO[t.race] : undefined;
  const sprite = creatureSprite(creatureId);
  const spriteW = spriteWidth(sprite);
  const Tag = onClick ? "button" : "div";

  return (
    <Tag onClick={onClick} aria-label={label ?? `${t.name} card`}
      style={{
        position: "relative", aspectRatio: "5 / 7", padding: 6, cursor: onClick ? "pointer" : "default", textAlign: "left",
        borderRadius: 10, border: "none", display: "block", width: "100%",
        background: `linear-gradient(145deg, ${rc.text}, #2a2418 55%, ${rc.text})`,
        boxShadow: glow ? `0 0 14px ${rc.text}, 0 4px 10px rgba(0,0,0,0.6)` : "0 4px 10px rgba(0,0,0,0.6)",
      }}>
      <div style={{
        height: "100%", borderRadius: 6, display: "flex", flexDirection: "column", gap: 4, padding: 6,
        background: "linear-gradient(180deg, #f3e6c4, #e2cf9f)", color: "#2b1d10", fontFamily: SERIF,
      }}>
        {/* Name. */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, paddingRight: 16 }}>
          <span title={t.rarity} style={{ width: 8, height: 8, flexShrink: 0, transform: "rotate(45deg)", background: rc.text, border: "1px solid #2b1d10" }} />
          <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.1 }}>{t.name}</span>
        </div>

        {/* Art. */}
        <div style={{
          flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3,
          border: "2px solid #8a6a3a", boxShadow: "inset 0 0 12px rgba(0,0,0,0.35)",
          background: `radial-gradient(circle at 50% 40%, ${race?.color ?? "#999"}cc, #2b2235 85%)`,
        }}>
          <PixelSprite sprite={sprite} scale={Math.max(2, Math.floor(72 / spriteW))} />
        </div>

        {/* Race and class. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4, fontSize: 11, whiteSpace: "nowrap" }}>
          {race && (
            <span title={race.name} style={{ flexShrink: 0, padding: "1px 5px", borderRadius: 8, background: race.color, color: "#1a140c", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {race.icon} {race.name}
            </span>
          )}
          <span title={`Class: ${CLASS_INFO[t.cls].name}`} style={{ flexShrink: 0, fontWeight: 700, color: "#2b1d10" }}>
            {CLASS_INFO[t.cls].icon} {CLASS_INFO[t.cls].name}
          </span>
        </div>
        {ability && ABILITIES[ability as keyof typeof ABILITIES] && (
          <div style={{ fontSize: 11, color: "#7a4b00", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            ✦ {ABILITIES[ability as keyof typeof ABILITIES].name}
          </div>
        )}

        {/* Flavour. */}
        <div style={{
          fontSize: 11, fontStyle: "italic", lineHeight: 1.25, padding: "3px 5px", border: "1px solid #b49a64", background: "rgba(255,255,255,0.35)",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {t.flavour}
        </div>

        {footer && <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b5a3e" }}>{footer}</div>}
      </div>

      {badge && (
        <span className="pixel-font" style={{
          position: "absolute", top: -8, right: -8, minWidth: 28, height: 28, padding: "0 6px", borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          background: "#1a140c", color: "#f1d9a0", border: `2px solid ${rc.text}`,
        }}>
          {badge}
        </span>
      )}
    </Tag>
  );
}
