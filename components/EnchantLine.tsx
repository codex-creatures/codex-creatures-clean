"use client";
// components/EnchantLine.tsx
// An item's enchantment in one line: its name, and its effect behind a "?"
// (lib/items/enchantments.ts). The line keeps its space when the item has none
// (visibility: hidden), so flicking between items moves nothing.

import Help from "./Help";
import { ENCHANTS, enchantOf, enchantText } from "@/lib/items/enchantments";
import type { CreatureOrItemDrop } from "@/lib/types";

export default function EnchantLine({ item, style }: { item?: CreatureOrItemDrop; style?: React.CSSProperties }) {
  const k = enchantOf(item);
  return (
    <div className="enchant-line"
      style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, height: 28, visibility: k ? "visible" : "hidden", ...style }}>
      <span style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        title={k ? enchantText(k, item!.rarity) : undefined}>
        ✦ {k ? ENCHANTS[k].name : "-"}
      </span>
      {k && (
        <Help title={ENCHANTS[k].name} label={`What ${ENCHANTS[k].name} does`}>
          <p>{enchantText(k, item!.rarity)}</p>
        </Help>
      )}
    </div>
  );
}
