"use client";
// components/SellConfirmModal.tsx

import type { Drop } from "@/lib/types";
import { isCreatureOrItemDrop, isItemDrop } from "@/lib/types";
import { RARITY_COLORS, getStatCapForDrop } from "@/lib/items/gameHelpers";
import { computeSellGold } from "@/lib/items/economy/sell";

type Props = {
  items: Drop[];
  totalGold: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function SellConfirmModal({ items, totalGold, onConfirm, onCancel }: Props) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
      <div style={{ background: "#1a1a2e", border: "1px solid rgba(255,80,80,0.4)", borderRadius: 12, padding: 24, maxWidth: 420, width: "100%" }}>
        <h3 style={{ margin: "0 0 12px", color: "#ff5050" }}>Confirm Sale</h3>
        <p style={{ margin: "0 0 16px", opacity: 0.85, fontSize: 14 }}>
          Selling <strong>{items.length}</strong> {items.length === 1 ? "item" : "items"} for{" "}
          <strong style={{ color: "#f5c542" }}>+{totalGold.toLocaleString()}g</strong>.
        </p>
        <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 20, fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((d) => {
            if (!isCreatureOrItemDrop(d)) return null;
            const sellVal = computeSellGold({ drop: d as any, getStatCapForDrop: (drop: any, statKey: string) => getStatCapForDrop(drop, statKey) ?? 0 });
            const rarityColor = isItemDrop(d) ? RARITY_COLORS[d.rarity]?.text ?? "white" : "white";
            return (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 6 }}>
                <span style={{ color: rarityColor }}>{d.name}</span>
                <span style={{ color: "#f5c542" }}>+{sellVal.toLocaleString()}g</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onConfirm} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#ff5050", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Sell & Collect {totalGold.toLocaleString()}g
          </button>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}