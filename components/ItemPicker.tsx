"use client";
// components/ItemPicker.tsx
// Picking one thing from your Inventory to do something with (sell it to the
// tavern's merchant, pack it in your bag): laid out like the Inventory, with
// its categories along the top and the sprites in a grid (grouped by rarity).
// Tap one for a closer look (the loot window's box), with its button there.
// A fixed frame: the grid scrolls inside its own height and the box below it
// stays put, empty until you tap something, so nothing moves.
// The bag packer also lays it out like the bag (cols), and lets you drag a
// thing out (grab) or double-tap it (onDouble) to pack it straight away.

import { useState } from "react";
import TileGrid from "./TileGrid";
import { doubleTapper } from "@/lib/doubleTap";
import { ItemPeek } from "./LootWindow";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
// How tall the grid is (it scrolls inside this).
const GRID_HEIGHT = "30cqh";

export type PickerTab = { key: string; label: string; items: CreatureOrItemDrop[] };

export default function ItemPicker({ tabs, action, badge, emptyText = "Nothing of this kind.", start, small, hint = "Tap something for a closer look.", cols, grab, onDouble, wasDrag }: {
  tabs: PickerTab[];
  start?: string;   // the tab to open on (otherwise the first with something in it)
  small?: boolean;  // the empty box is one line, not the full closer look's height (the bag packer: it's last on the page)
  // The buttons for the one tapped (it's still in the list).
  action: (d: CreatureOrItemDrop) => React.ReactNode;
  badge?: (d: CreatureOrItemDrop) => string | undefined; // e.g. what the merchant pays
  emptyText?: string;
  hint?: string;    // the empty box's line (small)
  cols?: number;    // tiles a row, slot-sized (TileGrid)
  grab?: (d: CreatureOrItemDrop) => React.HTMLAttributes<HTMLElement>; // drag it (hooks/useDragDrop)
  onDouble?: (d: CreatureOrItemDrop) => void; // a double tap on it
  wasDrag?: () => boolean; // the tap was the end of a drag (ignore it)
}) {
  // Open on start, or the first category with something in it.
  const [tab, setTab] = useState(() => start ?? (tabs.find((t) => t.items.length) ?? tabs[0])?.key);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  // (Gone once sold or packed: the box empties.)
  const picked = current?.items.find((d) => d.id === pickedId);
  const [doubleTap] = useState(doubleTapper);
  function open(d: CreatureOrItemDrop) {
    if (wasDrag?.()) return;
    if (onDouble && doubleTap(d.id)) { onDouble(d); setPickedId(null); return; }
    setPickedId(pickedId === d.id ? null : d.id);
  }

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
          ? <TileGrid items={current.items} favoriteIds={new Set()} badge={badge} picked={pickedId} cols={cols} grab={grab}
              onOpen={open} />
          : <p style={{ marginTop: 18, fontSize: 13, color: MUTED }}>{emptyText}</p>}
      </div>

      <div style={{ marginTop: 8 }}>
        {picked
          ? <ItemPeek item={{ gear: picked }} action={action(picked)} />
          : small ? <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{hint}</p>
          : <ItemPeek look={{ name: "Tap something for a closer look", color: MUTED }} />}
      </div>
    </div>
  );
}
