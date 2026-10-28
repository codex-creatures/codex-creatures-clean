"use client";
// components/ItemPicker.tsx
// Picking one thing from your Inventory to do something with (sell it to the
// tavern's merchant, pack it in your bag): laid out like the Inventory, with
// its categories along the top and the sprites in a grid (grouped by rarity).
// Tap one for a closer look (the loot window's box), with its button there.
// A fixed frame: the grid scrolls inside its own height and the box below it
// stays put, empty until you tap something, so nothing moves.

import { useState } from "react";
import TileGrid from "./TileGrid";
import { ItemPeek } from "./LootWindow";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
// How tall the grid is (it scrolls inside this).
const GRID_HEIGHT = "30cqh";

export type PickerTab = { key: string; label: string; items: CreatureOrItemDrop[] };

export default function ItemPicker({ tabs, action, badge, emptyText = "Nothing of this kind." }: {
  tabs: PickerTab[];
  // The buttons for the one tapped (it's still in the list).
  action: (d: CreatureOrItemDrop) => React.ReactNode;
  badge?: (d: CreatureOrItemDrop) => string | undefined; // e.g. what the merchant pays
  emptyText?: string;
}) {
  // Open on the first category with something in it.
  const [tab, setTab] = useState(() => (tabs.find((t) => t.items.length) ?? tabs[0])?.key);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  // (Gone once sold or packed: the box empties.)
  const picked = current?.items.find((d) => d.id === pickedId);

  return (
    <div>
      {/* The categories: one segmented control, as in the Inventory. */}
      <div role="tablist" style={{ display: "flex", border: "2px solid #2a2d38", borderRadius: 10, overflow: "hidden", background: "#101117" }}>
        {tabs.map((t, i) => {
          const on = t.key === current?.key;
          return (
            <button key={t.key} role="tab" aria-selected={on} className="pixel-font" onClick={() => { setTab(t.key); setPickedId(null); }}
              style={{ flex: 1, minWidth: 0, minHeight: 44, padding: "6px 2px", fontSize: 13, cursor: "pointer", border: "none",
                borderLeft: i ? "2px solid #2a2d38" : "none", background: on ? "#3a2c16" : "transparent", color: on ? "#ffe9a8" : "rgba(255,255,255,0.6)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t.label} <span style={{ opacity: 0.6 }}>{t.items.length}</span>
            </button>
          );
        })}
      </div>

      <div style={{ height: GRID_HEIGHT, overflowY: "auto" }}>
        {current && current.items.length > 0
          ? <TileGrid items={current.items} favoriteIds={new Set()} badge={badge} picked={pickedId}
              onOpen={(d) => setPickedId(pickedId === d.id ? null : d.id)} />
          : <p style={{ marginTop: 18, fontSize: 13, color: MUTED }}>{emptyText}</p>}
      </div>

      <div style={{ marginTop: 8 }}>
        {picked
          ? <ItemPeek item={{ gear: picked }} action={action(picked)} />
          : <ItemPeek look={{ name: "Tap something for a closer look", color: MUTED }} />}
      </div>
    </div>
  );
}
