"use client";
// components/PartySlots.tsx
// Your party in the Labyrinth, drawn like the Pit's creature cards: three
// team slots (the first one leads) and, at the map, two waiting in the Den. Each card has its
// health bar across the top. Drag a creature onto another creature (or an
// empty slot) to swap them round.

import { CreatureArt, PORTRAIT_RATIO } from "./CreaturePortrait";
import { creatureSprite } from "./PixelSprite";
import { useDragDrop } from "@/hooks/useDragDrop";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { Rarity } from "@/lib/items/budgets";

const MUTED = "rgba(255,255,255,0.5)";
const HOT = "#ffd66e";
export const TEAM_SLOTS = 3;
export const BENCH_SLOTS = 2;

export type PartyMember = { id: string; name: string; rarity: Rarity; creatureId?: string; maxHp: number; hp: number }; // hp: share 0–1

export default function PartySlots({ team, bench, benchLabel = "Bench", onTeam }: {
  team: PartyMember[];   // fighting, in order
  bench?: PartyMember[]; // the rest of the party (none: just the team, to change who leads)
  benchLabel?: string;
  onTeam: (ids: string[]) => void;
}) {
  const slots: (PartyMember | null)[] = [
    ...Array.from({ length: TEAM_SLOTS }, (_, i) => team[i] ?? null),
    ...(bench ? Array.from({ length: BENCH_SLOTS }, (_, i) => bench[i] ?? null) : []),
  ];

  function swap(a: number, b: number) {
    const next = [...slots];
    [next[a], next[b]] = [next[b], next[a]];
    // Only creatures still standing can fight.
    onTeam(next.slice(0, TEAM_SLOTS).filter((m): m is PartyMember => !!m && m.hp > 0).map((m) => m.id));
  }

  const { box: dragBox, ...dnd } = useDragDrop<number>({
    onDrop: (from, t) => {
      const to = t?.startsWith("slot:") ? Number(t.slice(5)) : -1;
      if (to >= 0 && to !== from) swap(from, to);
    },
  });
  const moving = dnd.lifted !== undefined;

  const card = (m: PartyMember | null, i: number) => {
    const leads = i === 0;
    const hot = dnd.over === `slot:${i}` && dnd.lifted !== i;
    if (!m) {
      return (
        <div key={i} data-drop={`slot:${i}`} aria-label={`Empty ${i < TEAM_SLOTS ? "team" : "bench"} slot`}
          style={{ aspectRatio: PORTRAIT_RATIO, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#101117", border: `3px dashed ${hot ? HOT : moving ? "#8a6a3a" : "#2a2d38"}`, borderRadius: 10, color: MUTED, fontSize: 12 }}>
          {moving ? "Move here" : "Empty"}
        </div>
      );
    }
    const col = RARITY_COLORS[m.rarity];
    const ko = m.hp <= 0;
    const up = dnd.lifted === i;
    return (
      <div key={m.id} data-drop={`slot:${i}`} onPointerDown={dnd.press(i, { sprite: creatureSprite(m.creatureId) })} {...dnd.handlers}
        title={`${m.name}: ${Math.round(m.hp * m.maxHp)}/${m.maxHp} HP`}
        style={{ cursor: "grab", touchAction: "none", color: "white", minWidth: 0, display: "flex", flexDirection: "column", opacity: up ? 0.3 : 1 }}>
        <span style={{
          position: "relative", aspectRatio: PORTRAIT_RATIO, display: "flex", alignItems: "center", justifyContent: "center",
          background: `radial-gradient(ellipse at 50% 60%, ${col.glow}, #101117 72%)`,
          border: `3px solid ${hot ? HOT : col.border}`, borderRadius: 10, overflow: "hidden",
          boxShadow: `inset 0 0 18px rgba(0,0,0,0.6), 0 4px 0 rgba(0,0,0,0.5)${hot ? ", 0 0 14px rgba(255,214,110,0.55)" : ""}`,
        }}>
          {/* Health, across the top. */}
          <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 7, background: "rgba(0,0,0,0.7)" }}>
            <span style={{ display: "block", height: "100%", width: `${Math.max(0, m.hp) * 100}%`, background: m.hp > 0.5 ? "#22c55e" : m.hp > 0.25 ? "#f5c542" : "#ef4444", transition: "width 0.3s" }} />
          </span>
          <CreatureArt creatureId={m.creatureId} title={m.name} style={{ opacity: ko ? 0.35 : 1, filter: ko ? "grayscale(1)" : undefined }} />
          {leads && !ko && <span className="pixel-font" style={{ position: "absolute", bottom: 3, left: 5, fontSize: 10, color: HOT }}>leads</span>}
          {ko && <span className="pixel-font" style={{ position: "absolute", bottom: 3, left: 0, right: 0, fontSize: 10, color: "#ff8a80", textAlign: "center" }}>knocked out</span>}
        </span>
        <span style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: col.text, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", lineHeight: 1.15 }}>{m.name}</span>
      </div>
    );
  };

  return (
    <div ref={dragBox} style={{ position: "relative", userSelect: "none", WebkitUserSelect: "none" }}>
      <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", margin: "14px 0 6px" }}>Team</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${TEAM_SLOTS}, minmax(0, 120px))`, gap: 10 }}>
        {slots.slice(0, TEAM_SLOTS).map((m, i) => card(m, i))}
      </div>
      {bench && (
        <>
          <div className="pixel-font" style={{ fontSize: 13, color: MUTED, margin: "12px 0 6px" }}>{benchLabel}</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${TEAM_SLOTS}, minmax(0, 120px))`, gap: 10 }}>
            {slots.slice(TEAM_SLOTS).map((m, i) => card(m, TEAM_SLOTS + i))}
          </div>
        </>
      )}
      <p style={{ fontSize: 12, color: MUTED, margin: "8px 0 0" }}>Drag a creature onto another, or an empty slot, to swap them round.</p>
      {/* Who you're dragging, under your finger. */}
      {dnd.ghost}
    </div>
  );
}
