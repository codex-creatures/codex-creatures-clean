"use client";
// components/TileGrid.tsx
// Creatures, weapons and armour as framed squares with their sprite, the
// same look as the slots in the creature window. Grouped by rarity (rarest
// first), A–Z within. Tap one to open it (or, in sell mode, to select it).

import type { CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import PixelSprite, { creatureSprite, itemSprite } from "./PixelSprite";

export const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];
const MUTED = "rgba(255,255,255,0.45)";

// Rarest first, then by name.
export function sortByRarity<T extends { rarity: Rarity; name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
}

type Props = {
  items: CreatureOrItemDrop[];          // already sorted
  favoriteIds: Set<string>;
  badge?: (d: CreatureOrItemDrop) => string | undefined; // e.g. ⚔️🛡️ worn gear, or "on Klutz"
  sellMode?: boolean;
  sellable?: (d: CreatureOrItemDrop) => boolean;
  selected?: Set<string>;
  onOpen: (d: CreatureOrItemDrop) => void;
};

export default function TileGrid({ items, favoriteIds, badge, sellMode, sellable, selected, onOpen }: Props) {
  return (
    <div>
      {RARITY_ORDER.map((rarity) => {
        const group = items.filter((d) => d.rarity === rarity);
        if (group.length === 0) return null;
        return (
          <section key={rarity} style={{ marginTop: 14 }}>
            <div className="pixel-font" style={{ fontSize: 14, color: RARITY_COLORS[rarity].text, textTransform: "capitalize", marginBottom: 8 }}>
              {rarity} <span style={{ opacity: 0.5 }}>· {group.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 10 }}>
              {group.map((d) => (
                <Tile key={d.id} d={d} fav={favoriteIds.has(d.id)} badge={badge?.(d)} onClick={() => onOpen(d)}
                  sell={sellMode ? { can: sellable?.(d) ?? false, on: selected?.has(d.id) ?? false } : undefined} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Tile({ d, fav, badge, sell, onClick }: {
  d: CreatureOrItemDrop; fav: boolean; badge?: string; sell?: { can: boolean; on: boolean }; onClick: () => void;
}) {
  const col = RARITY_COLORS[d.rarity];
  const sprite = d.dropType === "item" ? itemSprite(d) : creatureSprite(d.creatureId);
  const w = sprite?.[0]?.length ?? 16;
  const dim = sell && !sell.can;
  return (
    <button onClick={onClick} title={d.name} disabled={dim}
      style={{ background: "none", border: "none", padding: 0, cursor: dim ? "default" : "pointer", color: "white", minWidth: 0, opacity: dim ? 0.35 : 1 }}>
      <span style={{
        position: "relative", aspectRatio: "1", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(circle, ${col.glow}, #101117 75%)`,
        border: `3px solid ${sell?.on ? "#f5c542" : col.border}`,
        boxShadow: `inset 2px 2px 0 rgba(255,255,255,0.06), 0 3px 0 rgba(0,0,0,0.5)${sell?.on ? ", 0 0 12px rgba(245,197,66,0.5)" : ""}`,
      }}>
        {sprite ? <PixelSprite sprite={sprite} scale={Math.max(2, Math.floor(56 / w))} /> : <span style={{ fontSize: 26 }}>{d.codexMove ? "📖" : "📦"}</span>}
        {fav && <span style={{ position: "absolute", top: 2, left: 4, fontSize: 13, color: "#f5c542" }}>★</span>}
        {sell && sell.can && <span style={{ position: "absolute", top: 2, left: 4, fontSize: 14, color: sell.on ? "#f5c542" : MUTED }}>{sell.on ? "☑" : "☐"}</span>}
        {badge && <span style={{ position: "absolute", bottom: 2, right: 4, fontSize: 10, color: "#f5c542", maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{badge}</span>}
      </span>
      <span style={{ display: "block", marginTop: 4, fontSize: 11, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
        {d.name}
      </span>
    </button>
  );
}
