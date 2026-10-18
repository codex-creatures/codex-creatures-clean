"use client";
// components/LootGrid.tsx
// A haul of loot laid out in an inventory panel (sprites loose inside):
// gear and codexes by rarity, potions, gold — and creature cards shown as
// the cards themselves. Used for what a room just gave you, and at the end
// of a run for what you got and what you left behind. Creature cards go in
// one stack you can tap to look through (CardStack); gold shows as one total.

import { goodsIcon } from "@/lib/items/materials";
import PixelSprite, { itemSprite, creatureSprite } from "./PixelSprite";
import { GOLD_SPRITE, POTION_SPRITES, GOLD_RARITY, POTION_RARITY } from "@/lib/sprites/items";
import { RARITY_COLORS, rarityGlow } from "@/lib/items/gameHelpers";
import { POTIONS, type GotItem } from "@/lib/dungeon/run";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Sprite } from "@/lib/sprites/pixels";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import CardStack, { type CardPile } from "./CardStack";
import { ICON, NAME } from "./ContainerLoot";

const MUTED = "rgba(255,255,255,0.5)";

type Look = { name: string; sprite?: Sprite; icon?: string; color: string; glow: string };

function lookOf(g: GotItem): Look {
  if ("potion" in g) return { name: POTIONS[g.potion].name, sprite: POTION_SPRITES[g.potion], icon: POTIONS[g.potion].icon, color: RARITY_COLORS[POTION_RARITY[g.potion]].text, glow: rarityGlow(POTION_RARITY[g.potion]) };
  const d = g.drop;
  if (d.dropType === "reward") return { name: `${d.amount} gold`, sprite: GOLD_SPRITE, icon: "🪙", color: RARITY_COLORS[GOLD_RARITY].text, glow: rarityGlow(GOLD_RARITY) };
  const x = d as CreatureOrItemDrop;
  const rc = RARITY_COLORS[x.rarity];
  if (x.dropType === "card" || x.dropType === "creature") return { name: `${x.name} card`, sprite: creatureSprite(x.creatureId), color: rc.text, glow: rarityGlow(x.rarity) };
  return { name: x.name, sprite: itemSprite(x), icon: goodsIcon(x) ?? (x.codexMove ? "📖" : x.scroll ? "📜" : x.potion ? POTIONS[x.potion].icon : "📦"), color: rc.text, glow: rarityGlow(x.rarity) };
}

// A creature card in the haul (its template, if we know the creature).
const cardOf = (g: GotItem) => {
  if ("potion" in g) return null;
  const x = g.drop as CreatureOrItemDrop;
  if (x.dropType !== "card" && x.dropType !== "creature") return null;
  const t = findCreatureTemplate(x.creatureId, x.name);
  return t ? { x, t } : null;
};

// Copies of the same creature's card stack into one, with a count.
function stackCards(items: GotItem[]) {
  const stacks = new Map<string, CardPile>();
  for (const g of items) {
    const c = cardOf(g);
    if (!c) continue;
    const s = stacks.get(c.t.id);
    if (s) s.n++; else stacks.set(c.t.id, { ...c, n: 1 });
  }
  return [...stacks.values()];
}

const goldOf = (g: GotItem) => ("potion" in g || g.drop.dropType !== "reward" ? 0 : g.drop.amount);
const isGold = (g: GotItem) => !("potion" in g) && g.drop.dropType === "reward";

function Heading({ children }: { children: React.ReactNode }) {
  return <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", margin: "12px 0 6px", letterSpacing: "0.04em" }}>{children}</div>;
}

// grouped: split into Items, Cards and Gold under headings (the end-of-run summary).
// onGear: tapping a weapon or armour piece opens it (to compare and swap).
export default function LootGrid({ items, faded, grouped, onGear }: { items: GotItem[]; faded?: boolean; grouped?: boolean; onGear?: (item: CreatureOrItemDrop) => void }) {
  if (items.length === 0) return <p style={{ fontSize: 13, color: MUTED, margin: "4px 0" }}>Nothing.</p>;
  const cards = stackCards(items);
  const gold = items.reduce((n, g) => n + goldOf(g), 0);
  const tiles = items.filter((g) => !cardOf(g) && !isGold(g));

  const cardGrid = cards.length > 0 && <CardStack piles={cards} faded={faded} />;
  const tileGrid = tiles.length > 0 && (
    <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 8, opacity: faded ? 0.55 : 1 }}>
      {tiles.map((g, i) => <Tile key={i} g={g} faded={faded} onGear={onGear} />)}
    </div>
  );
  const goldLine = gold > 0 && (
    <div className="pixel-font" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, color: "#f5c542", opacity: faded ? 0.55 : 1 }}>
      <PixelSprite sprite={GOLD_SPRITE} scale={1.6} style={{ filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.6))" }} />{gold} gold
    </div>
  );

  if (grouped) return (
    <>
      {tileGrid && <><Heading>Items</Heading>{tileGrid}</>}
      {cardGrid && <><Heading>Cards</Heading>{cardGrid}</>}
      {goldLine && <><Heading>Gold</Heading>{goldLine}</>}
    </>
  );
  return (
    <>
      {cardGrid}
      {tileGrid}
      {goldLine && <div style={{ marginTop: 8 }}>{goldLine}</div>}
    </>
  );
}

// Weapons and armour, which can be opened up.
const gearOf = (g: GotItem) => {
  if ("potion" in g) return null;
  const x = g.drop as CreatureOrItemDrop;
  return x.dropType === "item" && (x.itemCategory === "weapon" || x.itemCategory === "armor") ? x : null;
};

function Tile({ g, faded, onGear }: { g: GotItem; faded?: boolean; onGear?: (item: CreatureOrItemDrop) => void }) {
  const l = lookOf(g);
  const gear = gearOf(g);
  const Tag = gear && onGear ? "button" : "div";
  return (
    <Tag title={l.name} onClick={gear && onGear ? () => onGear(gear) : undefined}
      style={{ display: "block", width: "100%", minWidth: 0, textAlign: "center", padding: 0, border: "none", background: "none", color: "inherit", font: "inherit", cursor: gear && onGear ? "pointer" : "default" }}>
      <div style={{
        aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(circle, ${l.glow} 0%, transparent 62%)`,
        filter: faded ? "grayscale(0.6)" : undefined,
      }}>
        {l.sprite ? <PixelSprite sprite={l.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: 24 }}>{l.icon}</span>}
      </div>
      <div style={{ ...NAME, color: l.color }}>{l.name}</div>
    </Tag>
  );
}
