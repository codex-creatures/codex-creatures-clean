"use client";
// components/PartySlots.tsx
// Your party in the Labyrinth, drawn like the Pit's creature cards: three
// team slots (the first one leads) and two on the bench. Each card has its
// health bar across the top. Tap a creature, then tap another creature (or
// an empty slot) to swap them round.

import { useState } from "react";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { spriteWidth } from "@/lib/sprites/pixels";
import type { Rarity } from "@/lib/items/budgets";

const MUTED = "rgba(255,255,255,0.5)";
export const TEAM_SLOTS = 3;
export const BENCH_SLOTS = 2;

export type PartyMember = { id: string; name: string; rarity: Rarity; creatureId?: string; maxHp: number; hp: number }; // hp: share 0–1

export default function PartySlots({ team, bench, onTeam }: {
  team: PartyMember[];   // fighting, in order
  bench: PartyMember[];  // the rest of the party
  onTeam: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const slots: (PartyMember | null)[] = [
    ...Array.from({ length: TEAM_SLOTS }, (_, i) => team[i] ?? null),
    ...Array.from({ length: BENCH_SLOTS }, (_, i) => bench[i] ?? null),
  ];

  function tap(i: number) {
    if (picked === null) { if (slots[i]) setPicked(i); return; }
    if (picked === i) { setPicked(null); return; }
    const next = [...slots];
    [next[picked], next[i]] = [next[i], next[picked]];
    setPicked(null);
    // Only creatures still standing can fight.
    onTeam(next.slice(0, TEAM_SLOTS).filter((m): m is PartyMember => !!m && m.hp > 0).map((m) => m.id));
  }

  const card = (m: PartyMember | null, i: number) => {
    const leads = i === 0;
    if (!m) {
      return (
        <button key={i} onClick={() => tap(i)} aria-label={`Empty ${i < TEAM_SLOTS ? "team" : "bench"} slot`}
          style={{ aspectRatio: "1", width: "100%", background: "#101117", border: `3px dashed ${picked !== null ? "#8a6a3a" : "#2a2d38"}`, borderRadius: 10, cursor: picked !== null ? "pointer" : "default", color: MUTED, fontSize: 12 }}>
          {picked !== null ? "Move here" : "Empty"}
        </button>
      );
    }
    const col = RARITY_COLORS[m.rarity];
    const ko = m.hp <= 0;
    const sprite = creatureSprite(m.creatureId);
    const sel = picked === i;
    return (
      <button key={m.id} onClick={() => tap(i)} title={`${m.name}: ${Math.round(m.hp * m.maxHp)}/${m.maxHp} HP`}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "white", minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{
          position: "relative", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
          background: `radial-gradient(ellipse at 50% 60%, ${col.glow}, #101117 72%)`,
          border: `3px solid ${sel ? "#ffd66e" : col.border}`, borderRadius: 10, overflow: "hidden",
          boxShadow: `inset 0 0 18px rgba(0,0,0,0.6), 0 4px 0 rgba(0,0,0,0.5)${sel ? ", 0 0 14px rgba(255,214,110,0.55)" : ""}`,
        }}>
          {/* Health, across the top. */}
          <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 7, background: "rgba(0,0,0,0.7)" }}>
            <span style={{ display: "block", height: "100%", width: `${Math.max(0, m.hp) * 100}%`, background: m.hp > 0.5 ? "#22c55e" : m.hp > 0.25 ? "#f5c542" : "#ef4444", transition: "width 0.3s" }} />
          </span>
          <PixelSprite sprite={sprite} scale={Math.max(2.4, Math.min(3.4, 60 / spriteWidth(sprite)))}
            style={{ opacity: ko ? 0.35 : 1, filter: ko ? "grayscale(1)" : undefined }} />
          {leads && !ko && <span className="pixel-font" style={{ position: "absolute", bottom: 3, left: 5, fontSize: 10, color: "#ffd66e" }}>leads</span>}
          {ko && <span className="pixel-font" style={{ position: "absolute", bottom: 3, left: 0, right: 0, fontSize: 10, color: "#ff8a80", textAlign: "center" }}>knocked out</span>}
        </span>
        <span style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{m.name}</span>
      </button>
    );
  };

  return (
    <div>
      <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", margin: "14px 0 6px" }}>Team</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${TEAM_SLOTS}, minmax(0, 120px))`, gap: 10 }}>
        {slots.slice(0, TEAM_SLOTS).map((m, i) => card(m, i))}
      </div>
      <div className="pixel-font" style={{ fontSize: 13, color: MUTED, margin: "12px 0 6px" }}>Bench</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${TEAM_SLOTS}, minmax(0, 120px))`, gap: 10 }}>
        {slots.slice(TEAM_SLOTS).map((m, i) => card(m, TEAM_SLOTS + i))}
      </div>
      <p style={{ fontSize: 12, color: MUTED, margin: "8px 0 0" }}>
        {picked === null ? "Tap a creature, then another creature or slot, to swap them round." : `Now tap where ${slots[picked]?.name} should go.`}
      </p>
    </div>
  );
}
