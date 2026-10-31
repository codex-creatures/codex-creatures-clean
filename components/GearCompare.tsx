"use client";
// components/GearCompare.tsx
// A piece of gear's stats, and a side-by-side comparison with what one of
// your creatures wears in the same slot. Cycle through your creatures with
// ◀ ▶; each stat shows the difference (green better, red worse).

import { useState } from "react";
import PixelSprite, { itemSprite, creatureSprite } from "./PixelSprite";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { CreatureOrItemDrop } from "@/lib/types";
import Glyph from "./Glyph";
import { STATS, type StatKey } from "./CreatureDetailModal";

const MUTED = "rgba(255,255,255,0.5)";
const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

// Stats in a fixed order, with short names.
export const GEAR_STATS: [string, string][] = [
  ["melee", "Atk"], ["ranged", "Rng"], ["magic", "Mag"], ["agility", "Agi"], ["hp", "HP"], ["mDef", "MDef"], ["rDef", "RDef"], ["magDef", "MgDef"],
];
// A gear stat's icon: the creature window's (STATS), so the new art shows here too.
const GEAR_STAT_KEYS: Record<string, StatKey> = { melee: "atk", ranged: "rng", magic: "mag", agility: "agil", hp: "hp", mDef: "mdef", rDef: "rdef", magDef: "magdef" };
export function GearStatIcon({ stat: k }: { stat: string }) {
  const st = STATS.find((s) => s.key === GEAR_STAT_KEYS[k]);
  return st ? <Glyph icon={st.icon} art={st.art} title={st.label} size="1.1em" /> : null;
}
const stat = (it: CreatureOrItemDrop | undefined, k: string) => (it?.stats as Record<string, number> | undefined)?.[k] ?? 0;

// "Atk 14 · Agi 6"
export function GearStatLine({ item }: { item: CreatureOrItemDrop }) {
  const parts = GEAR_STATS.filter(([k]) => stat(item, k)).map(([k, l]) => `${l} ${stat(item, k)}`);
  return <div style={{ fontSize: 12, color: "#c9b48a", marginTop: 3 }}>{parts.length ? parts.join(" · ") : "No stats"}</div>;
}

export type CompareWith = { id: string; name: string; creatureId?: string; worn?: CreatureOrItemDrop };

export default function GearCompare({ item, slotName, creatures, onEquip, equipLabel, onClose }: {
  item: CreatureOrItemDrop;
  slotName: string;                 // "weapon", "helmet"…
  creatures: CompareWith[];         // who to compare against, with what they wear in that slot
  onEquip?: (creatureId: string) => void;
  equipLabel?: (name: string) => string; // the equip button's text (default "Equip on …")
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  if (creatures.length === 0) return null;
  const c = creatures[((i % creatures.length) + creatures.length) % creatures.length];
  const worn = c.worn;
  const rows = GEAR_STATS.filter(([k]) => stat(item, k) || stat(worn, k));
  const tile = (it: CreatureOrItemDrop | undefined) => {
    const rc = it ? RARITY_COLORS[it.rarity] : undefined;
    const sp = it && itemSprite(it);
    return (
      <div style={{ textAlign: "center", minWidth: 0 }}>
        <div style={{ width: 81, height: 81, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
          background: rc ? `radial-gradient(circle, ${rc.glow}, #101117 75%)` : "#101117", border: `3px solid ${rc ? rc.border : "#2f3340"}` }}>
          {sp ? <PixelSprite sprite={sp} scale={3.3} /> : <span style={{ color: MUTED, fontSize: 11 }}>{it ? "📦" : "empty"}</span>}
        </div>
        <div style={{ fontSize: 11, marginTop: 3, color: rc ? rc.text : MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it ? it.name : `No ${slotName}`}</div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 10, padding: 10, background: "#12131a", border: "2px solid #2a2d38" }}>
      {/* Whose gear to compare with. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <button className="chip" aria-label="Previous creature" onClick={() => setI((n) => n - 1)} disabled={creatures.length < 2}>◀</button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <PixelSprite sprite={creatureSprite(c.creatureId)} scale={1.4} />
          <span className="pixel-font" style={{ fontSize: 14, color: "#f1d9a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
        </div>
        <button className="chip" aria-label="Next creature" onClick={() => setI((n) => n + 1)} disabled={creatures.length < 2}>▶</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
        <div>{tile(worn)}<div style={{ fontSize: 10, color: MUTED, textAlign: "center" }}>wearing now</div></div>
        <span style={{ color: MUTED }}>→</span>
        <div>{tile(item)}<div style={{ fontSize: 10, color: MUTED, textAlign: "center" }}>this one</div></div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 3 }}>
        {rows.length === 0 && <div style={{ fontSize: 12, color: MUTED }}>Neither has any stats.</div>}
        {rows.map(([k, label]) => {
          const a = stat(worn, k), b = stat(item, k), d = b - a;
          return (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr 56px", alignItems: "center", fontSize: 13 }}>
              <span style={{ color: MUTED, whiteSpace: "nowrap" }}><GearStatIcon stat={k} /> {label}</span>
              <span style={{ ...NUM, textAlign: "center" }}>{a}</span>
              <span style={{ ...NUM, textAlign: "center" }}>{b}</span>
              <span style={{ ...NUM, textAlign: "right", color: d > 0 ? "#7CFC9A" : d < 0 ? "#ff8a80" : MUTED }}>{d > 0 ? `+${d}` : d < 0 ? `${d}` : "="}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {onEquip && <button className="chip" onClick={() => onEquip(c.id)}>{equipLabel ? equipLabel(c.name) : `Equip on ${c.name}`}</button>}
        <button className="chip" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
