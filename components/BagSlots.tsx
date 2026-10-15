"use client";
// components/BagSlots.tsx
// Your bindle / backpack as an inventory: a row of framed slots (like the
// equip screen's, but with no "+" — an empty slot is just empty). Each
// holds one thing, drawn as its sprite. Tap a slot to see what's in it and
// what you can do with it.

import PixelSprite from "./PixelSprite";
import { itemSprite } from "./PixelSprite";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { isPotionEntry, POTIONS, type BagEntry } from "@/lib/dungeon/run";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Sprite } from "@/lib/sprites/pixels";

const MUTED = "rgba(255,255,255,0.5)";

export type SlotLook = { name: string; sprite?: Sprite; icon?: string; color: string; glow?: string };

// What a bag entry looks like in its slot.
export function slotLook(e: BagEntry, item?: CreatureOrItemDrop): SlotLook {
  if (isPotionEntry(e)) return { name: POTIONS[e].name, icon: POTIONS[e].icon, color: "#ff9fb0", glow: "rgba(255,120,150,0.18)" };
  if (!item) return { name: "Something you no longer have", icon: "❔", color: MUTED };
  const rc = RARITY_COLORS[item.rarity];
  return { name: item.name, sprite: itemSprite(item), icon: item.codexMove ? "📖" : "📦", color: rc.text, glow: rc.glow };
}

export default function BagSlots({ slots, looks, selected, onSelect, pulse, size = 60 }: {
  slots: number;
  looks: (SlotLook | null)[];      // one per filled slot, in order
  selected: number | null;
  onSelect: (i: number | null) => void;
  pulse?: number;                  // a slot to draw attention to (tutorials)
  size?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 10, background: "radial-gradient(ellipse at 50% 40%, rgba(170,120,60,0.12), transparent 70%), #15161d", border: "2px solid #0e0f14", boxShadow: "inset 0 0 20px rgba(0,0,0,0.6)" }}>
      {Array.from({ length: slots }, (_, i) => {
        const l = looks[i] ?? null;
        const active = selected === i && !!l;
        return (
          <button key={i} onClick={() => onSelect(l ? (selected === i ? null : i) : null)} disabled={!l}
            className={pulse === i ? "tutorial-pulse" : undefined}
            title={l ? l.name : "Empty"} aria-label={l ? l.name : `Empty slot ${i + 1}`} aria-pressed={active}
            style={{
              width: size, height: size, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: l ? "pointer" : "default",
              background: l ? `radial-gradient(circle, ${l.glow ?? "rgba(255,255,255,0.05)"}, #101117 75%)` : "#101117",
              border: `3px solid ${active ? "#ffd66e" : l ? l.color : "#2f3340"}`,
              boxShadow: `inset 2px 2px 0 rgba(255,255,255,0.06), 0 3px 0 rgba(0,0,0,0.5)${active ? ", 0 0 12px rgba(255,214,110,0.5)" : ""}`,
            }}>
            {l && (l.sprite ? <PixelSprite sprite={l.sprite} scale={size >= 60 ? 2.6 : 2.2} /> : <span style={{ fontSize: size * 0.42 }}>{l.icon}</span>)}
          </button>
        );
      })}
    </div>
  );
}
