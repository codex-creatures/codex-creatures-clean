"use client";
// components/ItemDetailModal.tsx
// One item up close: its stats against the most it could roll, its sell
// value (and a Sell button, asking first), and ← → or a swipe to flick
// through the rest. Every part has a fixed height (names and notes are
// clamped to their lines), so flicking between items only changes what's
// written: nothing moves.

import { useEffect, useRef, useState } from "react";
import { isSellableItem } from "@/lib/types";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS, getStatCapForDrop } from "@/lib/items/gameHelpers";
import { ARMOR_META, ARMOR_SLOT_INFO, SET_BONUS } from "@/lib/items/armor";
import { computeSellGold } from "@/lib/items/economy/sell";
import { WEAPON_AFFINITY } from "@/lib/items/ceilings";
import { DAMAGE_TYPE_INFO } from "@/lib/creatures/creatureData";
import { AFFINITY_BONUS, damageTypesOn } from "@/lib/combat/engine";

type Props = {
  item: CreatureOrItemDrop;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  items: CreatureOrItemDrop[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  // Selling from here (the Inventory). Without it, only the price shows.
  onSell?: (id: string) => void;
  locked?: boolean; // favourited, worn or packed: not for sale
};

// How far a finger must travel sideways to flick to the next item.
const SWIPE_PX = 40;

const WEAPON_STATS = [
  { label: "Melee",   key: "melee"   },
  { label: "Ranged",  key: "ranged"  },
  { label: "Magic",   key: "magic"   },
  { label: "Agility", key: "agility" },
  { label: "Health",  key: "hp"      },
];

// Text cut to a number of lines (with …), in a box always that tall.
const clamp = (lines: number, lineHeight: number): React.CSSProperties => ({
  display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight, minHeight: `${lines * lineHeight}em`,
});

const ARMOR_STATS = [
  { label: "Melee Def",  key: "mDef"    },
  { label: "Ranged Def", key: "rDef"    },
  { label: "Magic Def",  key: "magDef"  },
  { label: "Agility",    key: "agility" },
  { label: "Health",     key: "hp"      },
];

export function getBarColor(value: number): string {
  if (value >= 90) return "#f5c542";               // gold
  if (value >= 70) return "#a855f7";               // purple
  if (value >= 50) return "#4ea1ff";               // blue
  if (value >= 30) return "#22c55e";               // green
  return "rgba(255,255,255,0.25)";                 // grey
}

function StatBar({ label, value, cap }: { label: string; value: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((value / cap) * 100)) : 0;
  const barColor = getBarColor(value);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4, opacity: 0.9 }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          <b style={{ color: value >= 70 ? barColor : "white" }}>{value}</b>
          <span style={{ opacity: 0.45 }}> / {cap}</span>
        </span>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 999, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

const sellBox: React.CSSProperties = {
  flex: 1, display: "flex", alignItems: "center", background: "rgba(245,197,66,0.07)", border: "1px solid rgba(245,197,66,0.2)", borderRadius: 10,
};
const sellBtn: React.CSSProperties = {
  borderRadius: 10, border: "1px solid rgba(245,197,66,0.4)", background: "rgba(245,197,66,0.07)", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer",
};

function RarityBadge({ rarity }: { rarity: Rarity }) {
  const c = RARITY_COLORS[rarity];
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: c.text, border: `1px solid ${c.border}`, background: c.glow }}>
      {rarity}
    </span>
  );
}

export default function ItemDetailModal({ item, isFavorite, onToggleFavorite, onClose, items, currentIndex, onNavigate, onSell, locked }: Props) {
  // "Sell for …?" waiting for a yes. Flicking to another item cancels it.
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const confirming = confirmFor === item.id;
  const setConfirming = (on: boolean) => setConfirmFor(on ? item.id : null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const stats = item.stats ?? {};
  const statDefs = item.itemCategory === "armor" ? ARMOR_STATS : WEAPON_STATS;
  const sellValue = item.itemCategory !== "material"
    ? computeSellGold({ drop: item as any, getStatCapForDrop: (d: any, k: string) => getStatCapForDrop(d, k) ?? 0 })
    : 0;
  const rarityColor = RARITY_COLORS[item.rarity]?.text ?? "white";
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(currentIndex + 1);
      if (e.key === "Escape") { e.preventDefault(); onClose(); } // (so it doesn't also go back a page)
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, hasPrev, hasNext, onNavigate, onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      {/* A fixed frame (the stone panel, like the creature window): the same
          size for every item, so flicking through them changes only what's inside. */}
      <div onClick={(e) => e.stopPropagation()} className="modal-panel stone-panel"
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
          // Sideways only (the panel scrolls up and down).
          if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          if (dx < 0 && hasNext) onNavigate(currentIndex + 1);
          if (dx > 0 && hasPrev) onNavigate(currentIndex - 1);
        }} style={{ borderColor: "#12131a", boxShadow: `inset 3px 3px 0 #3a3e4b, inset -3px -3px 0 #181a21, 0 0 0 2px ${RARITY_COLORS[item.rarity].border}, 0 0 40px ${RARITY_COLORS[item.rarity].glow}`, padding: 20, width: "100%", maxWidth: 440, height: "92cqh", boxSizing: "border-box", overflowY: "auto", position: "relative" }}>

        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>

        <div style={{ marginBottom: 20, paddingRight: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <RarityBadge rarity={item.rarity} />
            <span style={{ fontSize: 12, opacity: 0.45, textTransform: "capitalize" }}>{item.itemCategory === "armor" && item.armorSlot ? `armour · ${ARMOR_SLOT_INFO[item.armorSlot].name}` : item.itemCategory}</span>
          </div>
          <h2 className="pixel-font" title={item.name} style={{ margin: 0, fontSize: 24, fontWeight: 600, color: rarityColor, ...clamp(2, 1.2) }}>{item.name}</h2>
          {/* Its note, two lines (empty or not). */}
          <p title={item.desc} style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.55, fontStyle: "italic", ...clamp(2, 1.4) }}>{item.desc}</p>
          {/* What it's good for: a weapon's damage type, or an armour piece's set
              bonus. The same height either way (and when there's neither). */}
          <div style={{ marginTop: 10, height: 70 }}>
            {damageTypesOn() && item.itemCategory === "weapon" && item.itemKey && WEAPON_AFFINITY[item.itemKey] ? (
              <p style={{ margin: 0, fontSize: 13, color: DAMAGE_TYPE_INFO[WEAPON_AFFINITY[item.itemKey]].color, ...clamp(3, 1.4) }}>
                {DAMAGE_TYPE_INFO[WEAPON_AFFINITY[item.itemKey]].icon} Strong in {DAMAGE_TYPE_INFO[WEAPON_AFFINITY[item.itemKey]].name}: {DAMAGE_TYPE_INFO[WEAPON_AFFINITY[item.itemKey]].name} moves do +{Math.round(AFFINITY_BONUS * 100)}% damage with it.
              </p>
            ) : item.armorKey ? (
              <div title={`Wear the ${ARMOR_META[item.armorKey].name} helmet, chest and legs`}
                style={{ height: "100%", boxSizing: "border-box", padding: "6px 10px", fontSize: 12, background: "rgba(255,214,110,0.06)", border: "1px solid rgba(241,217,160,0.25)", borderRadius: 8, color: "#f1d9a0" }}>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>
                  <b>Set bonus — {SET_BONUS[item.armorKey].name}</b> <span style={{ opacity: 0.6 }}>(full {ARMOR_META[item.armorKey].name} set)</span>
                </div>
                <div style={{ opacity: 0.85, ...clamp(2, 1.4) }}>{SET_BONUS[item.armorKey].text}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 20 }} />

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, opacity: 0.4, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Stats</div>
          {statDefs.map(({ label, key }) => {
            const value = (stats as any)[key] ?? 0;
            const cap   = getStatCapForDrop(item as any, key) ?? 0;
            return <StatBar key={key} label={label} value={value} cap={cap} />;
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "0–29",  color: "rgba(255,255,255,0.25)" },
            { label: "30–49", color: "#22c55e" },
            { label: "50–69", color: "#4ea1ff" },
            { label: "70–89", color: "#a855f7" },
            { label: "90+",   color: "#f5c542" },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, opacity: 0.6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              {label}
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 20 }} />

        {/* (Kept in place, hidden, for things that don't sell: so nothing below moves.) */}
        {/* Sell: tap, then Yes. The box is the same height whichever it shows. */}
        <div style={{ display: "flex", gap: 8, alignItems: "stretch", height: 48, marginBottom: 20,
          visibility: isSellableItem(item) ? "visible" : "hidden" }}>
          {!onSell ? (
            <div style={{ ...sellBox, justifyContent: "space-between", padding: "0 14px" }}>
              <span style={{ fontSize: 14, opacity: 0.7 }}>Sell value</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#f5c542" }}>{sellValue.toLocaleString()}g</span>
            </div>
          ) : confirming ? <>
            <div style={{ ...sellBox, flex: 2, justifyContent: "center", fontSize: 14, color: "#f5c542", fontWeight: 700 }}>
              Sell for {sellValue.toLocaleString()}g?
            </div>
            <button onClick={() => setConfirming(false)} style={{ ...sellBtn, flex: 1 }}>No</button>
            <button onClick={() => { setConfirming(false); onSell(item.id); }}
              style={{ ...sellBtn, flex: 1, background: "#f5c542", color: "#1a1a1a", border: "none" }}>Yes</button>
          </> : (
            <button onClick={() => setConfirming(true)} disabled={locked}
              title={locked ? "Favourited, worn or packed pieces can't be sold" : undefined}
              style={{ ...sellBtn, flex: 1, opacity: locked ? 0.4 : 1, cursor: locked ? "not-allowed" : "pointer" }}>
              {locked ? "🔒 Can't sell" : <>Sell · <span style={{ color: "#f5c542" }}>{sellValue.toLocaleString()}g</span></>}
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => onToggleFavorite(item.id)} style={{ padding: "11px 0", borderRadius: 10, border: isFavorite ? "1px solid rgba(245,197,66,0.6)" : "1px solid rgba(255,255,255,0.15)", background: isFavorite ? "rgba(245,197,66,0.12)" : "transparent", color: isFavorite ? "#f5c542" : "rgba(255,255,255,0.7)", cursor: "pointer", fontWeight: 600, fontSize: 14, transition: "all 0.15s" }}>
            {isFavorite ? "★ Favorited — protected from selling" : "☆ Add to Favourites"}
          </button>
        </div>

        {/* Kept in place (hidden) with only one item, so nothing above it moves. */}
        {(
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)", visibility: items.length > 1 ? "visible" : "hidden" }}>
            <button onClick={() => hasPrev && onNavigate(currentIndex - 1)} disabled={!hasPrev} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: hasPrev ? "white" : "rgba(255,255,255,0.2)", cursor: hasPrev ? "pointer" : "not-allowed", fontSize: 18, lineHeight: 1 }}>←</button>
            <span style={{ fontSize: 12, opacity: 0.4 }}>{currentIndex + 1} / {items.length}</span>
            <button onClick={() => hasNext && onNavigate(currentIndex + 1)} disabled={!hasNext} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: hasNext ? "white" : "rgba(255,255,255,0.2)", cursor: hasNext ? "pointer" : "not-allowed", fontSize: 18, lineHeight: 1 }}>→</button>
          </div>
        )}

      </div>
    </div>
  );
}