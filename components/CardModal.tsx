"use client";
// components/CardModal.tsx
// A creature card: its rolled %s and moves, and summoning (3 of a kind).

import { useEffect, useState } from "react";
import type { CreatureOrItemDrop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { findCreatureTemplate, MOVE_BY_NAME, type CreatureProficiency } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { CARDS_TO_SUMMON } from "@/lib/creatures/summon";
import { MoveInfo } from "./MoveSlots";

const MUTED = "rgba(255,255,255,0.5)";
const STATS: [keyof CreatureProficiency, string][] = [["atk", "Melee"], ["rng", "Ranged"], ["agil", "Agility"], ["mdef", "Melee Def"], ["rdef", "Ranged Def"]];

type Props = {
  card: CreatureOrItemDrop;
  sameKind: CreatureOrItemDrop[]; // all your cards of this creature (including this one)
  onSummon: (cardIds: string[], keepId: string | null) => CreatureOrItemDrop;
  onClose: () => void;
};

export default function CardModal({ card, sameKind, onSummon, onClose }: Props) {
  const t = findCreatureTemplate(card.creatureId, card.name);
  const [picked, setPicked] = useState<string[]>(() => [card.id, ...sameKind.filter((c) => c.id !== card.id).map((c) => c.id)].slice(0, CARDS_TO_SUMMON));
  const [keep, setKeep] = useState<string>(card.id);
  const [result, setResult] = useState<CreatureOrItemDrop | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!t) return null;
  const c = RARITY_COLORS[t.rarity];
  const canSummon = sameKind.length >= CARDS_TO_SUMMON;
  const ready = picked.length === CARDS_TO_SUMMON;

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < CARDS_TO_SUMMON ? [...p, id] : p));
  }

  function summon(mode: "choose" | "random") {
    const keepId = mode === "choose" ? (picked.includes(keep) ? keep : picked[0]) : null;
    setResult(onSummon(picked, keepId));
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-panel" style={{ background: "#191b22", border: `3px solid ${c.border}`, boxShadow: `0 0 40px ${c.glow}`, padding: 20, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}>✕</button>

        {result ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 40 }}>✨</div>
            <div className="pixel-font" style={{ fontSize: 26, color: c.text }}>{result.name} summoned!</div>
            <p style={{ color: MUTED, fontSize: 13, margin: "6px 0 14px" }}>It&apos;s now in your Creatures — equip it in the Fight Pit.</p>
            <RollTable p={result.proficiency ?? t.proficiency} base={t.proficiency} />
            <Moves names={result.moves ?? []} own={t.skills.map((s) => s.name)} />
            <button className="pixel-btn" style={{ marginTop: 14 }} onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ padding: "2px 10px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: c.text, border: `1px solid ${c.border}` }}>{t.rarity}</span>
              <span style={{ fontSize: 12, color: MUTED }}>🃏 Creature card · {creatureTypeLabel(card.proficiency ?? t.proficiency)}</span>
            </div>
            <h2 className="pixel-font" style={{ margin: 0, fontSize: 26, fontWeight: 600, color: c.text }}>{t.name}</h2>
            <p style={{ margin: "6px 0 12px", fontSize: 13, color: MUTED, fontStyle: "italic" }}>{t.flavour}</p>

            <Section>Creature % on this card</Section>
            <RollTable p={card.proficiency ?? t.proficiency} base={t.proficiency} />
            <Section>Moves on this card</Section>
            <Moves names={card.moves ?? t.skills.map((s) => s.name)} own={t.skills.map((s) => s.name)} />

            <Section>Summon</Section>
            {!canSummon ? (
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
                You have {sameKind.length} {t.name} card{sameKind.length === 1 ? "" : "s"}. Collect {CARDS_TO_SUMMON} to summon a {t.name}.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 12, color: MUTED, margin: "0 0 8px" }}>
                  Pick {CARDS_TO_SUMMON} cards ({picked.length}/{CARDS_TO_SUMMON}) — they&apos;re used up. Then either bring one of them to life exactly as it is,
                  or summon a random new {t.name}.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {sameKind.map((k) => {
                    const on = picked.includes(k.id);
                    return (
                      <div key={k.id} className="card-btn" style={{ cursor: "default", borderColor: on ? "#8a6a3a" : undefined, padding: "6px 10px" }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(k.id)} aria-label="Use this card" />
                        <span style={{ flex: 1, fontSize: 12 }}>
                          <DiffLine p={k.proficiency ?? t.proficiency} base={t.proficiency} />
                          <span style={{ display: "block", color: "#c9b48a" }}>{(k.moves ?? []).join(" · ")}</span>
                        </span>
                        {on && (
                          <label style={{ fontSize: 11, color: keep === k.id ? "#ffd66e" : MUTED, whiteSpace: "nowrap", cursor: "pointer" }}>
                            <input type="radio" name="keep" checked={keep === k.id} onChange={() => setKeep(k.id)} /> keep
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="pixel-btn" disabled={!ready || !picked.includes(keep)} onClick={() => summon("choose")}>Summon the kept card</button>
                  <button className="pixel-btn" disabled={!ready} onClick={() => summon("random")}>Summon a random {t.name}</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="pixel-font" style={{ fontSize: 14, color: "#c9b48a", margin: "14px 0 6px" }}>{children}</div>;
}

function RollTable({ p, base }: { p: CreatureProficiency; base: CreatureProficiency }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, textAlign: "center" }}>
      {STATS.map(([k, label]) => {
        const d = p[k] - base[k];
        return (
          <div key={k} style={{ background: "#12131a", padding: "6px 2px" }}>
            <div style={{ fontSize: 10, color: MUTED }}>{label}</div>
            <div style={{ fontWeight: 700 }}>+{p[k]}%</div>
            <div style={{ fontSize: 11, color: d > 0 ? "#7CFC9A" : d < 0 ? "#ff8a80" : MUTED }}>{d > 0 ? `+${d}` : d < 0 ? d : "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

function DiffLine({ p, base }: { p: CreatureProficiency; base: CreatureProficiency }) {
  const parts = STATS.filter(([k]) => p[k] !== base[k]).map(([k, label]) => {
    const d = p[k] - base[k];
    return <span key={k} style={{ color: d > 0 ? "#7CFC9A" : "#ff8a80", marginRight: 6 }}>{label} {d > 0 ? `+${d}` : d}</span>;
  });
  return <span>{parts.length > 0 ? parts : <span style={{ color: MUTED }}>standard %s</span>}</span>;
}

function Moves({ names, own }: { names: string[]; own: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
      {names.map((n) => MOVE_BY_NAME[n] && (
        <div key={n} style={{ fontSize: 13, padding: "5px 8px", background: "#12131a", borderLeft: own.includes(n) ? "3px solid #3a3e4b" : "3px solid #ffd66e" }}>
          <MoveInfo m={MOVE_BY_NAME[n]} />
          {!own.includes(n) && <span style={{ fontSize: 10, color: "#ffd66e", marginLeft: 6 }}>RARE</span>}
        </div>
      ))}
    </div>
  );
}
