"use client";
// components/CardModal.tsx
// A creature card: its rolled %s and moves. Summoning (3 of a kind) is at the
// Soul Altar (components/altar/SummonRite.tsx): with 3 or more, its Summon
// button goes straight there (the user, 2026-11-20).

import { useEffect } from "react";
import Link from "next/link";
import type { CreatureOrItemDrop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { defaultMoveNames, findCreatureTemplate, moveOf, type CreatureProficiency, type CreatureTemplate } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { CARDS_TO_SUMMON } from "@/lib/creatures/summon";
import { MoveInfo } from "./MoveSlots";
import SoulStoneTag from "./SoulStoneTag";
import RaceTag from "./RaceTag";

const MUTED = "rgba(255,255,255,0.5)";
const STATS: [keyof CreatureProficiency, string][] = [["atk", "Melee"], ["rng", "Ranged"], ["mag", "Magic"], ["agil", "Agility"], ["mdef", "Melee Def"], ["rdef", "Ranged Def"], ["magdef", "Magic Def"], ["hp", "Health"]];

// Where summoning a creature's cards happens: the altar, opened on them.
export const summonHref = (creatureId: string) => `/altar?summon=${encodeURIComponent(creatureId)}`;

type Props = {
  card: CreatureOrItemDrop;
  sameKind: CreatureOrItemDrop[]; // all your cards of this creature (including this one)
  onSummon?: () => void; // at the altar: open its summoning on these cards (elsewhere: a link there)
  onClose: () => void;
};

export default function CardModal({ card, sameKind, onSummon, onClose }: Props) {
  const t = findCreatureTemplate(card.creatureId, card.name);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }; // (preventDefault: don't also go back a page)
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!t) return null;
  const c = RARITY_COLORS[t.rarity];
  const canSummon = sameKind.length >= CARDS_TO_SUMMON;
  const go = `✨ Summon ${t.name} (${sameKind.length} cards)`;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-panel" style={{ background: "#191b22", border: `3px solid ${c.border}`, boxShadow: `0 0 40px ${c.glow}`, padding: 20, width: "100%", maxWidth: 480, maxHeight: "90cqh", overflowY: "auto", overscrollBehavior: "contain", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}>✕</button>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ padding: "2px 10px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: c.text, border: `1px solid ${c.border}` }}>{t.rarity}</span>
          <RaceTag race={t.race} races={t.races} />
          <span style={{ fontSize: 12, color: MUTED }}>🃏 Creature card · {creatureTypeLabel(card.proficiency ?? t.proficiency)}</span>
        </div>
        <h2 className="pixel-font" style={{ margin: 0, fontSize: 26, fontWeight: 600, color: c.text }}>{t.name}</h2>

        {canSummon && (onSummon
          ? <button className="pixel-btn" style={{ width: "100%", minHeight: 48, marginTop: 12 }} onClick={onSummon}>{go}</button>
          : <Link href={summonHref(t.id)} className="pixel-btn" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 48, marginTop: 12 }}>{go}</Link>)}

        <Section>Creature % on this card</Section>
        <SoulStoneTag stone={card.soulStone} />
        <RollTable p={card.proficiency ?? t.proficiency} base={t.proficiency} />
        <Section>Moves on this card</Section>
        <Moves names={card.moves ?? defaultMoveNames(t)} t={t} />

        {!canSummon && (
          <p style={{ fontSize: 13, color: MUTED, margin: "14px 0 0" }}>
            You have {sameKind.length} {t.name} card{sameKind.length === 1 ? "" : "s"}. Collect {CARDS_TO_SUMMON} to summon a {t.name} at the Soul Altar.
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="pixel-font" style={{ fontSize: 14, color: "#c9b48a", margin: "14px 0 6px" }}>{children}</div>;
}

export function RollTable({ p, base }: { p: CreatureProficiency; base: CreatureProficiency }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, textAlign: "center" }}>
      {STATS.map(([k, label]) => {
        const d = (p[k] ?? base[k] ?? 0) - (base[k] ?? 0); // (a stat its card predates: its species')
        return (
          <div key={k} style={{ background: "#12131a", padding: "6px 2px" }}>
            <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
            <div style={{ fontWeight: 700 }}>+{p[k] ?? base[k]}%</div>
            <div style={{ fontSize: 11, color: d > 0 ? "#7CFC9A" : d < 0 ? "#ff8a80" : MUTED }}>{d > 0 ? `+${d}` : d < 0 ? d : "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

export function DiffLine({ p, base }: { p: CreatureProficiency; base: CreatureProficiency }) {
  const parts = STATS.filter(([k]) => (p[k] ?? base[k]) !== base[k]).map(([k, label]) => {
    const d = (p[k] ?? base[k]) - base[k];
    return <span key={k} style={{ color: d > 0 ? "#7CFC9A" : "#ff8a80", marginRight: 6 }}>{label} {d > 0 ? `+${d}` : d}</span>;
  });
  return <span>{parts.length > 0 ? parts : <span style={{ color: MUTED }}>standard %s</span>}</span>;
}

export function Moves({ names, t }: { names: string[]; t: CreatureTemplate }) {
  const own = t.skills.map((s) => s.name);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
      {names.map((n) => moveOf(t, n) && (
        <div key={n} style={{ fontSize: 13, padding: "5px 8px", background: "#12131a", borderLeft: own.includes(n) ? "3px solid #3a3e4b" : "3px solid #ffd66e" }}>
          <MoveInfo m={moveOf(t, n)} />
          {!own.includes(n) && <span style={{ fontSize: 11, color: "#ffd66e", marginLeft: 6 }}>RARE</span>}
        </div>
      ))}
    </div>
  );
}
