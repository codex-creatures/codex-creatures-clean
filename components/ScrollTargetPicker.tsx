"use client";
// components/ScrollTargetPicker.tsx
// Who reads the XP scroll (the user, 2026-11-20: from the Inventory, not only
// from a creature's window): Klutz first (once he's helping), then your
// creatures, highest level first. Tap one and it's read.

import { useEscape } from "@/hooks/useEscape";
import CreaturePortrait from "./CreaturePortrait";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { SCROLL_XP } from "@/lib/creatures/levels";
import type { CreatureOrItemDrop } from "@/lib/types";

export type ScrollReader = { id: string; name: string; level: number; creatureId: string; rarity: CreatureOrItemDrop["rarity"] };

export default function ScrollTargetPicker({ readers, onPick, onClose }: { readers: ScrollReader[]; onPick: (id: string) => void; onClose: () => void }) {
  useEscape(onClose);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10cqh 16px" }}>
      <div className="inv-panel" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, maxHeight: "75cqh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pixel-font" style={{ flex: 1, fontSize: 18, color: "#f1d9a0" }}>📜 Who reads it? <span style={{ fontSize: 13, opacity: 0.7 }}>+{SCROLL_XP} XP</span></div>
          <button className="chip" onClick={onClose} aria-label="Close" style={{ minWidth: 44, minHeight: 44 }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {readers.map((r) => (
            <button key={r.id} className="card-btn" onClick={() => onPick(r.id)} title={r.name}
              style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: "4px 10px", textAlign: "left" }}>
              <span style={{ width: 44, flexShrink: 0 }}><CreaturePortrait creatureId={r.creatureId} title={r.name} /></span>
              <span className="pixel-font" style={{ flex: 1, minWidth: 0, fontSize: 15, color: RARITY_COLORS[r.rarity]?.text ?? "#f1d9a0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
              <span className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0" }}>Lv {r.level}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
