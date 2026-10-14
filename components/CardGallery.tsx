"use client";
// components/CardGallery.tsx
// Your creature cards as a binder of trading cards: one card per creature,
// with how many copies you hold. Grouped by rarity (rarest first), with a
// filter by race. Tap a card to see your copies and summon.

import { useState } from "react";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { findCreatureTemplate, RACE_INFO, type CreatureTemplate, type Race } from "@/lib/creatures/creatureData";
import { CARDS_TO_SUMMON } from "@/lib/creatures/summon";
import { ABILITIES } from "@/lib/creatures/abilities";
import PixelSprite, { creatureSprite } from "./PixelSprite";

const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];
const RACES = Object.keys(RACE_INFO) as Race[];
const SERIF = "Georgia, 'Times New Roman', serif";

type Stack = { t: CreatureTemplate; cards: CreatureOrItemDrop[] };

export default function CardGallery({ cards, onOpen }: { cards: CreatureOrItemDrop[]; onOpen: (card: CreatureOrItemDrop) => void }) {
  const [race, setRace] = useState<Race | "all">("all");

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
  const shown = all.filter((s) => race === "all" || s.t.race === race);
  const countFor = (r: Race | "all") => all.filter((s) => r === "all" || s.t.race === r).reduce((n, s) => n + s.cards.length, 0);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["all", ...RACES] as const).map((r) => (
          <button key={r} className="chip" data-active={race === r} onClick={() => setRace(r)}
            style={r === "all" ? undefined : { color: RACE_INFO[r].color }}>
            {r === "all" ? "All races" : RACE_INFO[r].name} ({countFor(r)})
          </button>
        ))}
      </div>

      {shown.length === 0 && <p style={{ marginTop: 12, fontSize: 14, opacity: 0.5 }}>No cards of that race yet.</p>}

      {RARITY_ORDER.map((rarity) => {
        const group = shown.filter((s) => s.t.rarity === rarity).sort((a, b) => a.t.name.localeCompare(b.t.name));
        if (group.length === 0) return null;
        return (
          <section key={rarity} style={{ marginTop: 16 }}>
            <div className="pixel-font" style={{ fontSize: 15, color: RARITY_COLORS[rarity].text, textTransform: "capitalize", marginBottom: 8 }}>
              {rarity} <span style={{ opacity: 0.5 }}>· {group.reduce((n, s) => n + s.cards.length, 0)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {group.map((s) => <TradingCard key={s.t.id} stack={s} onOpen={() => onOpen(s.cards[0])} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TradingCard({ stack, onOpen }: { stack: Stack; onOpen: () => void }) {
  const { t, cards } = stack;
  const rc = RARITY_COLORS[t.rarity];
  const race = t.race ? RACE_INFO[t.race] : undefined;
  const sprite = creatureSprite(cards[0].creatureId);
  const ready = cards.length >= CARDS_TO_SUMMON;
  const spriteW = sprite[0]?.length ?? 16;

  return (
    <button onClick={onOpen} aria-label={`${t.name} card, ${cards.length} held`}
      style={{
        position: "relative", aspectRatio: "5 / 7", padding: 6, cursor: "pointer", textAlign: "left",
        borderRadius: 10, border: "none",
        background: `linear-gradient(145deg, ${rc.text}, #2a2418 55%, ${rc.text})`,
        boxShadow: ready ? `0 0 14px ${rc.text}, 0 4px 10px rgba(0,0,0,0.6)` : "0 4px 10px rgba(0,0,0,0.6)",
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

        {/* Race (and class, one day). */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4, fontSize: 11, whiteSpace: "nowrap" }}>
          {race && (
            <span style={{ flexShrink: 0, padding: "1px 5px", borderRadius: 8, background: race.color, color: "#1a140c", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {race.name}
            </span>
          )}
          {cards.some((c) => c.ability)
            ? <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", color: "#7a4b00", fontWeight: 700 }}>✦ {ABILITIES[cards.find((c) => c.ability)!.ability!].name}</span>
            : <span style={{ opacity: 0.45, fontStyle: "italic", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>Class —</span>}
        </div>

        {/* Flavour. */}
        <div style={{
          fontSize: 11, fontStyle: "italic", lineHeight: 1.25, padding: "3px 5px", border: "1px solid #b49a64", background: "rgba(255,255,255,0.35)",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {t.flavour}
        </div>

        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: ready ? "#7a4b00" : "#6b5a3e", fontWeight: ready ? 700 : 400 }}>
          {ready ? "✨ Ready to summon" : `${cards.length}/${CARDS_TO_SUMMON} to summon`}
        </div>
      </div>

      {/* How many you hold. */}
      <span className="pixel-font" style={{
        position: "absolute", top: -8, right: -8, minWidth: 28, height: 28, padding: "0 6px", borderRadius: 14,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
        background: "#1a140c", color: "#f1d9a0", border: `2px solid ${rc.text}`,
      }}>
        ×{cards.length}
      </span>
    </button>
  );
}
