"use client";
// components/ScrollTargetPicker.tsx
// Who reads the XP scroll (the user, 2026-11-20: from the Inventory, not only
// from a creature's window): Klutz first (once he's helping), then your
// creatures, highest level first, as the Pit shows them (their cards, three a row: the user,
// 2026-11-27). Tap one and it's read.

import { useEscape } from "@/hooks/useEscape";
import { CreatureCard } from "./TileGrid";
import { SCROLL_XP } from "@/lib/creatures/levels";
import type { CreatureOrItemDrop } from "@/lib/types";

export type ScrollReader = { id: string; name: string; level: number; creatureId: string; rarity: CreatureOrItemDrop["rarity"]; ascended?: number; gear?: string };

export default function ScrollTargetPicker({ readers, onPick, onClose }: { readers: ScrollReader[]; onPick: (id: string) => void; onClose: () => void }) {
  useEscape(onClose);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10cqh 16px" }}>
      <div className="inv-panel" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, maxHeight: "75cqh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pixel-font" style={{ flex: 1, fontSize: 18, color: "#f1d9a0" }}>📜 Who reads it? <span style={{ fontSize: 13, opacity: 0.7 }}>+{SCROLL_XP} XP</span></div>
          <button className="chip" onClick={onClose} aria-label="Close" style={{ minWidth: 44, minHeight: 44 }}>✕</button>
        </div>
        <div data-readers style={{ overflowY: "auto", marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px 6px", alignContent: "start" }}>
          {readers.map((r) => (
            <CreatureCard key={r.id} d={r} gear={r.gear} onClick={() => onPick(r.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
