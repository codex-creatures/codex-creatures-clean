"use client";
// components/EnchantLine.tsx
// An item's enchantment in one line: its name, and its effect behind a "?"
// (lib/items/enchantments.ts). mode: where you are (the Labyrinth: pve); one
// that doesn't work there shows greyed out. The line keeps its space when the
// item has none (visibility: hidden), so flicking between items moves nothing.

import Help from "./Help";
import { ENCHANTS, enchantOf, enchantText, enchantWorks, type EnchantMode } from "@/lib/items/enchantments";
import type { CreatureOrItemDrop } from "@/lib/types";

export default function EnchantLine({ item, mode, style }: { item?: CreatureOrItemDrop; mode?: EnchantMode; style?: React.CSSProperties }) {
  const k = enchantOf(item);
  const off = !!k && !!mode && !enchantWorks(k, mode);
  return (
    <div className="enchant-line" data-off={off || undefined}
      style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, height: 28, visibility: k ? "visible" : "hidden", ...style }}>
      <span style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        title={k ? enchantText(k, item!.rarity) : undefined}>
        ✦ {k ? ENCHANTS[k].name : "-"}{off ? " (off here)" : ""}
      </span>
      {k && (
        <Help title={ENCHANTS[k].name} label={`What ${ENCHANTS[k].name} does`}>
          <p>{enchantText(k, item!.rarity)}</p>
        </Help>
      )}
    </div>
  );
}
