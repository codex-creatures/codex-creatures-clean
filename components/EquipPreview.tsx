"use client";
// components/EquipPreview.tsx
// Before a piece of gear goes on a creature: what it wears in that slot now
// next to the new piece, and how each of its stats would change. Your party
// sits along the top, each marked ▲ (better overall) or ▼ (worse): tap one
// (or ← →) to see what the piece would do for it. Equip or cancel.
// teach: the first time (Klutz's Club), it also explains where stats come
// from: gear, boosted by the creature's own %.

import { useEffect, useRef, useState } from "react";
import PixelSprite, { itemSprite } from "./PixelSprite";
import CreaturePortrait from "./CreaturePortrait";
import { GearStatLine } from "./GearCompare";
import { STATS, StatRow, gearValue, type StatKey } from "./CreatureDetailModal";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import { fighterFor } from "@/lib/creatures/instance";
import { clampLevel, hpAt } from "@/lib/creatures/levels";
import { combatSummary } from "@/lib/combat/loadout";
import { ARMOR_SLOTS } from "@/lib/items/armor";
import { armorPieces, type EquipSlot, type Loadout } from "@/hooks/useGameState";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.55)";
const pct = (p: number) => `${p >= 0 ? "+" : ""}${p}%`;

export type EquipCandidate = { creature: CreatureOrItemDrop; loadout?: Loadout };

// What the piece would do for one creature: its stats now and with it on.
function outcome({ creature, loadout }: EquipCandidate, item: CreatureOrItemDrop, slot: EquipSlot, find: (id: string) => CreatureOrItemDrop | undefined) {
  const template = findCreatureTemplate(creature.creatureId, creature.name);
  const weapon = loadout?.weaponId ? find(loadout.weaponId) : undefined;
  const worn = armorPieces(loadout, find);
  const old = slot === "weapon" ? weapon : worn[ARMOR_SLOTS.indexOf(slot)];
  if (!template) return { old, template };
  const sum = (w: CreatureOrItemDrop | undefined, pieces: (CreatureOrItemDrop | undefined)[]) => {
    const f = fighterFor(creature, template, w?.stats, pieces, loadout?.moves, w?.itemKey);
    return { f, s: combatSummary(f) };
  };
  const now = sum(weapon, worn);
  const next = slot === "weapon" ? sum(item, worn) : sum(weapon, worn.map((p, i) => (ARMOR_SLOTS[i] === slot ? item : p)));
  // Better or worse overall: every stat's change added up.
  const net = STATS.reduce((t, st) => t + Math.round(next.s[st.key]) - Math.round(now.s[st.key]), 0);
  return { old, template, now, next, net };
}

export default function EquipPreview({ team, start, find, item, slot, teach, onConfirm, onCancel }: {
  team: EquipCandidate[];                                // who could wear it (your creatures still standing)
  start: string;                                         // the one it was dropped on
  find: (id: string) => CreatureOrItemDrop | undefined;  // gear by id
  item: CreatureOrItemDrop;                              // the piece going on
  slot: EquipSlot;
  teach?: boolean;
  onConfirm: (creatureId: string) => void;
  onCancel: () => void;
}) {
  const [at, setAt] = useState(() => Math.max(0, team.findIndex((m) => m.creature.id === start)));
  const n = team.length;
  const step = (d: number) => setAt((i) => (i + d + n) % n);
  // Esc cancels this, and only this (it sits over the loot window, which closes on Esc too); ← → flick through the party.
  const keys = useRef({ onCancel, step });
  useEffect(() => { keys.current = { onCancel, step }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); keys.current.onCancel(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); keys.current.step(e.key === "ArrowLeft" ? -1 : 1); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const results = team.map((m) => outcome(m, item, slot, find));
  const me = team[at];
  const r = results[at];
  if (!me) return null;
  const { creature } = me;
  const level = clampLevel(creature.level);
  const now = r.now, next = r.next;
  const changed = now && next ? STATS.filter((st) => Math.round(next.s[st.key]) !== Math.round(now.s[st.key])) : [];
  // The lesson's example: of the stats that change, the one this creature boosts most.
  const prof = (k: StatKey) => (next && k !== "hp" ? next.f.proficiency[k] : 0);
  const best = changed.filter((st) => st.key !== "hp").sort((a, b) => prof(b.key) - prof(a.key))[0];

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(4,5,9,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
      <div role="dialog" aria-label={`Equip on ${creature.name}`} onClick={(e) => e.stopPropagation()} className="stone-panel sheet-up"
        style={{ width: "100%", maxWidth: 420, maxHeight: "92cqh", overflowY: "auto", display: "grid", gap: 8, padding: 10 }}>

        {/* Your party: who's it better for? */}
        {n > 1 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 6 }}>
            {team.map((m, i) => {
              const net = results[i].net ?? 0;
              return (
                <button key={m.creature.id} onClick={() => setAt(i)} aria-pressed={i === at} title={m.creature.name} className="inv-slot"
                  style={{ position: "relative", padding: 3, cursor: "pointer", minHeight: 44, ...(i === at ? { borderColor: "#ffd66e", boxShadow: "0 0 10px rgba(255,214,110,0.5)" } : { opacity: 0.75 }) }}>
                  <CreaturePortrait creatureId={m.creature.creatureId} title={m.creature.name} />
                  <span style={{ position: "absolute", top: 1, right: 3, fontSize: 12, fontWeight: 700, color: net > 0 ? "#7CFC9A" : net < 0 ? "#ff8a80" : MUTED }}>
                    {net > 0 ? "▲" : net < 0 ? "▼" : "="}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0" }}>Equip on {creature.name}?</div>

        {/* Worn now → the new piece */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 6 }}>
          <Piece label="Now" item={r.old} />
          <span style={{ fontSize: 18, color: MUTED }}>→</span>
          <Piece label="New" item={item} />
        </div>

        {teach && best && now && next && (
          <div className="tutorial-tip" style={{ fontSize: 12 }}>
            <b>Where stats come from.</b> A creature&apos;s stats come from its gear. Each point is boosted by the creature&apos;s own % for that stat,
            which grows as it levels up. {item.name} gives <b>{gearValue(next.f, best.key)} {best.label}</b>; {creature.name}&apos;s {best.label} is{" "}
            <b>{pct(prof(best.key))}</b>, so it gets <b>{Math.round(next.s[best.key])}</b>.
          </div>
        )}

        {now && next && r.template ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 36 }}>
            {changed.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No change to its stats.</div>}
            {changed.map((st) => {
              const detail = st.key === "hp" ? `${hpAt(r.template!, level)} at Lv ${level} + ${next.f.weapon.hp + next.f.armor.hp} gear`
                : `${gearValue(next.f, st.key)} gear × ${pct(next.f.proficiency[st.key])}`;
              return <StatRow key={st.key} icon={st.icon} label={st.label} color={st.color} max={st.max} compact
                total={Math.round(now.s[st.key])} after={Math.round(next.s[st.key])} detail={detail} diff={0} />;
            })}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: MUTED }}>This creature is from an older roster and has no combat data.</div>
        )}

        <div className="dock-tabs">
          <button className="dock-tab" onClick={onCancel}>Cancel</button>
          <button className={`dock-tab${teach ? " tutorial-pulse" : ""}`} data-active disabled={!r.template} onClick={() => onConfirm(creature.id)}>Equip</button>
        </div>
      </div>
    </div>
  );
}

function Piece({ label, item }: { label: string; item?: CreatureOrItemDrop }) {
  const rc = item ? RARITY_COLORS[item.rarity] : undefined;
  const sp = item && itemSprite(item);
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 3, textAlign: "center", minWidth: 0 }}>
      <span className="pixel-font" style={{ fontSize: 11, color: MUTED, textTransform: "uppercase" }}>{label}</span>
      <span style={{ width: 78, height: 78, display: "flex", alignItems: "center", justifyContent: "center",
        background: rc ? `radial-gradient(circle, ${rc.glow}, #101117 75%)` : "#101117", border: `3px solid ${rc ? rc.border : "#2f3340"}` }}>
        {sp ? <PixelSprite sprite={sp} scale={3.75} /> : <span style={{ fontSize: 30, color: "#3a3e4b" }}>{item ? "📦" : "∅"}</span>}
      </span>
      <b style={{ fontSize: 12, color: rc ? rc.text : MUTED, overflowWrap: "anywhere" }}>{item ? item.name : "Nothing"}</b>
      {item ? <GearStatLine item={item} /> : <div style={{ fontSize: 12, color: MUTED }}>No stats</div>}
    </div>
  );
}
