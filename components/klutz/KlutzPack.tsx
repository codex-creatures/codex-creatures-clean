"use client";
// components/klutz/KlutzPack.tsx
// Klutz's pack while he's out (the user, 2026-11-18): a slot for each it
// holds (packSize), filled with what he's picked up so far in the order he
// found it, the rest empty. Full, he's on his way home; nearly full, you might
// want to call him back before he heads off anyway. Creatures he catches go
// to the cage, not his pack.

import PixelSprite, { itemSprite } from "@/components/PixelSprite";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { KlutzFind } from "@/lib/klutz";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

export default function KlutzPack({ finds, size }: { finds: KlutzFind[]; size: number }) {
  const used = Math.min(size, finds.length), full = used >= size;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span className="pixel-font" style={{ fontSize: 14, color: GOLD }}>His pack</span>
        <span className="pixel-font" style={{ fontSize: 14, color: full ? "#ff8a80" : used >= size - 1 ? "#ffd66e" : MUTED }}>{used}/{size}</span>
        <span style={{ flex: 1, fontSize: 12, color: full ? "#ff8a80" : MUTED, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {full ? "Full: he's heading home" : used >= size - 1 ? "One slot left" : "Creatures go to the cage"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 5 }}>
        {Array.from({ length: size }, (_, i) => {
          const it = finds[i]?.drop as CreatureOrItemDrop | undefined;
          const sprite = it && itemSprite(it);
          const col = it ? RARITY_COLORS[it.rarity]?.border ?? "#3a3e4b" : "#2a2d38";
          return (
            <div key={i} title={it ? `${it.name}${it.material && (it.qty ?? 1) > 1 ? ` ×${it.qty}` : ""}` : "Empty"}
              style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", background: it ? "#12131a" : "transparent",
                border: `2px ${it ? "solid" : "dashed"} ${col}` }}>
              {it ? (sprite ? <PixelSprite sprite={sprite} scale={1.4} /> : <span style={{ fontSize: 16 }}>🎁</span>) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
