"use client";
// components/klutz/KlutzKit.tsx
// Klutz's Den, the Kit tab: what he fights with, at a glance. His stats with
// his gear on (and his own % on each), his soul stone, his moves and each
// piece he's wearing, then the button to change them (KlutzGear). While he's
// out, his gear's with him: you can look, not swap.

import { KLUTZ_DROP_ID, type useGameState } from "@/hooks/useGameState";
import { combatSummary } from "@/lib/combat/loadout";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { SOUL_STONES } from "@/lib/creatures/soulStones";
import { StoneIcon } from "@/components/PixelSprite";
import { klutzStatus, pointsFree } from "@/lib/klutz";
import { STATS } from "@/components/CreatureDetailModal";
import Glyph from "@/components/Glyph";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const SLOTS: [string, "weaponId" | "helmetId" | "chestId" | "legsId"][] = [["Weapon", "weaponId"], ["Helmet", "helmetId"], ["Chest", "chestId"], ["Legs", "legsId"]];

export default function KlutzKit({ game, onEquip, nudge }: { game: ReturnType<typeof useGameState>; onEquip: () => void; nudge?: boolean }) {
  const f = game.klutzFighter;
  const s = combatSummary(f);
  const away = klutzStatus(game.klutz, f.maxHp).kind === "away";
  const free = pointsFree(game.klutz);
  const l = game.equipment[KLUTZ_DROP_ID];
  const byId = (id?: string) => (id ? (game.inventory.find((d) => d.id === id) as CreatureOrItemDrop | undefined) : undefined);
  const stone = game.klutz.soulStone ? SOUL_STONES[game.klutz.soulStone] : undefined;
  const learned = new Set(game.klutz.learned ?? []);
  const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, minHeight: 26, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden" };

  return (
    <div className="stone-panel" style={{ marginTop: 10, display: "grid", gap: 10 }}>
      {/* His stats, gear on: each its value, and his own % under it. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 5 }}>
        {STATS.map((st) => (
          <div key={st.key} title={st.key === "hp" ? `${st.label}: with gear` : `${st.label}: gear × his +${f.proficiency[st.key]}%`}
            style={{ textAlign: "center", padding: "6px 2px", background: "#12131a", borderTop: `3px solid ${st.color}` }}>
            <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Glyph icon={st.icon} art={st.art} size={11} /> {st.label}</div>
            <div className="pixel-font" style={{ fontSize: 17, color: st.color }}>{Math.round(s[st.key])}</div>
            <div style={{ fontSize: 11, color: MUTED, visibility: st.key === "hp" ? "hidden" : "visible" }}>+{st.key === "hp" ? 0 : f.proficiency[st.key]}%</div>
          </div>
        ))}
      </div>

      {/* What he's wearing, a row a slot. */}
      <div style={{ display: "grid", gap: 2 }}>
        {SLOTS.map(([label, key]) => {
          const it = byId(l?.[key]);
          return (
            <div key={key} style={row}>
              <span style={{ width: 58, flexShrink: 0, color: MUTED }}>{label}</span>
              {it ? <span style={{ color: RARITY_COLORS[it.rarity].text, overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</span> : <span style={{ color: MUTED }}>nothing</span>}
            </div>
          );
        })}
        <div style={row} title={stone ? `${stone.name}: ${stone.text}` : undefined}>
          <span style={{ width: 58, flexShrink: 0, color: MUTED }}>Stone</span>
          {stone ? <span style={{ color: "#b9e6ff", overflow: "hidden", textOverflow: "ellipsis" }}><StoneIcon k={game.klutz.soulStone!} /> {stone.name} <span style={{ color: MUTED }}>· {stone.text}</span></span> : <span style={{ color: MUTED }}>none</span>}
        </div>
        <div style={row} title={f.skills.map((m) => m.name).join(", ")}>
          <span style={{ width: 58, flexShrink: 0, color: MUTED }}>Moves</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {f.skills.map((m) => <span key={m.name} style={{ marginRight: 8, color: learned.has(m.name) ? "#ffd66e" : "#e8e2d0" }}>{learned.has(m.name) ? "📜" : ""}{m.name}</span>)}
          </span>
        </div>
      </div>

      <button className={`pixel-btn${nudge && !away ? " tutorial-pulse" : free > 0 ? " news-glow" : ""}`} onClick={onEquip} style={{ width: "100%", minHeight: 46 }}>
        ⚔️ {away ? "Look at his gear" : "Equip"}{free > 0 && <> · <b>{free}</b> points to spend</>}
      </button>
      <div style={{ fontSize: 12, color: MUTED, textAlign: "center", minHeight: 16 }}>
        {away ? "His gear's with him: swap it when he's home." : <>Gear from your Inventory. Each level gives him % points to spend.</>}
      </div>
    </div>
  );
}
