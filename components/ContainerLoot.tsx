"use client";
// components/ContainerLoot.tsx
// What's inside an opened chest or sack: the container itself, and its
// contents laid out loose in an inventory panel. Tap a thing to take it;
// "Take all" takes everything that fits. Gold (and the backpack) take no room
// in your bag; anything else needs a free slot, and is greyed out when your
// bag is full. Whatever you leave stays on the floor.

import PixelSprite, { itemSprite } from "./PixelSprite";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { POTIONS, type SackItem } from "@/lib/dungeon/run";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Sprite } from "@/lib/sprites/pixels";
import { GOLD_SPRITE, POTION_SPRITES, BACKPACK_SPRITE } from "@/lib/sprites/items";

const GOLD = "#f5c542";
const MUTED = "rgba(255,255,255,0.55)";

type Look = { name: string; sprite?: Sprite; icon?: string; color: string; glow: string; free: boolean };
function lookOf(x: SackItem): Look {
  if ("backpack" in x) return { name: "Rugged backpack", sprite: BACKPACK_SPRITE, icon: "🎒", color: GOLD, glow: "rgba(245,197,66,0.3)", free: true };
  if ("gold" in x) return { name: `${x.gold} gold`, sprite: GOLD_SPRITE, icon: "🪙", color: GOLD, glow: "rgba(245,197,66,0.22)", free: true };
  if ("potion" in x) return { name: POTIONS[x.potion].name, sprite: POTION_SPRITES[x.potion], icon: POTIONS[x.potion].icon, color: "#ff9fb0", glow: "rgba(255,120,150,0.2)", free: false };
  const g = x.gear as CreatureOrItemDrop;
  const rc = RARITY_COLORS[g.rarity];
  return { name: g.name, sprite: itemSprite(g), icon: g.codexMove ? "📖" : "📦", color: rc.text, glow: rc.glow, free: false };
}

export default function ContainerLoot({ name, sprite, items, bagUsed, bagSlots, onTake, onTakeAll }: {
  name: string;          // "The rickety chest"
  sprite: Sprite;        // the container, opened
  items: SackItem[];
  bagUsed: number; bagSlots: number;
  onTake: (index: number) => void;
  onTakeAll: () => void;
}) {
  const full = bagUsed >= bagSlots;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <PixelSprite sprite={sprite} scale={1.6} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
        <div style={{ minWidth: 0 }}>
          <div className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0" }}>{name}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{items.length ? "Tap to take" : "Empty"}</div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
          {items.map((x, i) => {
            const l = lookOf(x);
            const blocked = full && !l.free;
            return (
              <button key={i} onClick={() => onTake(i)} disabled={blocked} title={blocked ? `${l.name} — your bag is full` : `Take ${l.name}`}
                style={{ minWidth: 0, padding: 0, background: "none", border: "none", color: "inherit", font: "inherit", cursor: blocked ? "default" : "pointer", opacity: blocked ? 0.4 : 1 }}>
                <span style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: `radial-gradient(circle, ${l.glow} 0%, transparent 62%)` }}>
                  {l.sprite ? <PixelSprite sprite={l.sprite} scale={2.4} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} /> : <span style={{ fontSize: 30 }}>{l.icon}</span>}
                </span>
                <span style={{ display: "block", marginTop: 2, fontSize: 11, color: l.color, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <span className="pixel-font" style={{ fontSize: 13, color: full ? "#ff8a80" : MUTED }}>🎒 Bag {bagUsed}/{bagSlots}{full ? " — full" : ""}</span>
          <button className="pixel-btn" onClick={onTakeAll}>Take all</button>
        </div>
      )}
    </div>
  );
}
