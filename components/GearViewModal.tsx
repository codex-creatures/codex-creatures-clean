"use client";
// components/GearViewModal.tsx
// A weapon or armour piece you've just found, up close: its sprite, name and
// stats. "Compare" lines it up against what one of your creatures wears in
// that slot (flick through them with ◀ ▶), and "Swap" puts it on them —
// what they wore goes into the bag in its place.

import { useEffect, useState } from "react";
import PixelSprite, { itemSprite } from "./PixelSprite";
import GearCompare, { GearStatLine, type CompareWith } from "./GearCompare";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.55)";

export default function GearViewModal({ item, slotName, creatures, onSwap, why, onClose }: {
  item: CreatureOrItemDrop;
  slotName: string;                        // "weapon", "helmet"…
  creatures: CompareWith[];                // your creatures, with what each wears in that slot
  onSwap?: (creatureId: string) => void;   // missing when it can't be equipped right now…
  why?: string;                            // …and why not
  onClose: () => void;
}) {
  const [comparing, setComparing] = useState(false);
  const rc = RARITY_COLORS[item.rarity];
  const sprite = itemSprite(item);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-label={item.name} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,5,9,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="stone-panel" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto", boxShadow: `inset 3px 3px 0 #3a3e4b, inset -3px -3px 0 #181a21, 0 0 0 2px ${rc.border}, 0 0 30px ${rc.glow}` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 96, height: 96, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle, ${rc.glow}, #101117 75%)`, border: `3px solid ${rc.text}` }}>
            {sprite ? <PixelSprite sprite={sprite} scale={4} /> : <span style={{ fontSize: 36 }}>📦</span>}
          </div>
          <div className="pixel-font" style={{ fontSize: 18, color: rc.text, marginTop: 10 }}>{item.name}</div>
          <div className="pixel-font" style={{ fontSize: 12, color: MUTED, textTransform: "capitalize", marginTop: 2 }}>{item.rarity} {slotName}</div>
          <GearStatLine item={item} />
        </div>

        {comparing && creatures.length > 0 ? (
          <GearCompare item={item} slotName={slotName} creatures={creatures}
            onEquip={onSwap} equipLabel={(name) => `🔁 Swap onto ${name}`} onClose={() => setComparing(false)} />
        ) : (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
            {creatures.length > 0 && <button className="pixel-btn" onClick={() => setComparing(true)}>⚖️ Compare</button>}
            <button className="chip" onClick={onClose}>Close</button>
          </div>
        )}
        {!onSwap && why && <p style={{ fontSize: 12, color: MUTED, textAlign: "center", margin: "10px 0 0" }}>{why}</p>}
      </div>
    </div>
  );
}
