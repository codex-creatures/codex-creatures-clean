"use client";
// components/ContainerLoot.tsx
// What's inside an opened chest or sack: the container itself, and its
// contents laid out loose in an inventory panel. Tap a thing to take it;
// "Take all" takes everything that fits. Gold (and the backpack) take no room
// in your bag; anything else needs a free slot, and is greyed out when your
// bag is full. Whatever you leave stays on the floor.

import { goodsIcon } from "@/lib/items/materials";
import PixelSprite, { itemSprite } from "./PixelSprite";
import { RARITY_COLORS, rarityGlow } from "@/lib/items/gameHelpers";
import { POTIONS, type SackItem } from "@/lib/dungeon/run";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Sprite } from "@/lib/sprites/pixels";
import { GOLD_SPRITE, POTION_SPRITES, BACKPACK_SPRITE, GOLD_RARITY, BACKPACK_RARITY, POTION_RARITY } from "@/lib/sprites/items";
import type { Rarity } from "@/lib/items/budgets";

const MUTED = "rgba(255,255,255,0.55)";
// An icon filling most of its square, and a name of up to two lines under it.
export const ICON: React.CSSProperties = { width: "84%", height: "auto", imageRendering: "pixelated", filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" };
export const NAME: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 2, fontSize: 11, lineHeight: 1.2, minHeight: "2.4em", textAlign: "center" };

type Look = { name: string; sprite?: Sprite; icon?: string; color: string; glow: string; free: boolean };
export function lookOf(x: SackItem): Look {
  // Everything glows in its rarity: gold and the backpack are legendary.
  const by = (r: Rarity) => ({ color: RARITY_COLORS[r].text, glow: rarityGlow(r) });
  if ("backpack" in x) return { name: "Rugged backpack", sprite: BACKPACK_SPRITE, ...by(BACKPACK_RARITY), free: true };
  if ("gold" in x) return { name: `${x.gold} gold`, sprite: GOLD_SPRITE, ...by(GOLD_RARITY), free: true };
  if ("potion" in x) return { name: POTIONS[x.potion].name, sprite: POTION_SPRITES[x.potion], ...by(POTION_RARITY[x.potion]), free: false };
  // A creature card or a pouch of gold, from a treasure chest: no room needed.
  if (x.gear.dropType === "reward") return { name: `${x.gear.amount} gold`, sprite: GOLD_SPRITE, ...by(GOLD_RARITY), free: true };
  if (x.gear.dropType === "card" || x.gear.dropType === "creature") return { name: `${x.gear.name} card`, icon: "🃏", ...by(x.gear.rarity), free: true };
  const g = x.gear as CreatureOrItemDrop;
  const rc = RARITY_COLORS[g.rarity];
  return { name: g.qty ? `${g.name} ×${g.qty}` : g.name, sprite: itemSprite(g), icon: goodsIcon(g) ?? (g.codexMove ? "📖" : g.scroll ? "📜" : "📦"), color: rc.text, glow: rarityGlow(g.rarity), free: false }; // (materials take a slot now: they come home in your bag)
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
                  {l.sprite ? <PixelSprite sprite={l.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: 30 }}>{l.icon}</span>}
                </span>
                <span style={{ ...NAME, color: l.color }}>{l.name}</span>
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
