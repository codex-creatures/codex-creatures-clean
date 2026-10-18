"use client";
// components/LootGrid.tsx
// A haul of loot as a grid of framed tiles with sprites: gear and codexes
// by rarity, potions, gold — and creature cards shown as the cards
// themselves. Used for what a room just gave you, and at the end of a run
// for what you got and what you left behind. Creature cards go in one
// stack you can tap to look through (CardStack); gold shows as one total.

import PixelSprite, { itemSprite, creatureSprite } from "./PixelSprite";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { POTIONS, type GotItem } from "@/lib/dungeon/run";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Sprite } from "@/lib/sprites/pixels";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import CardStack, { type CardPile } from "./CardStack";

const MUTED = "rgba(255,255,255,0.5)";

type Look = { name: string; sprite?: Sprite; icon?: string; color: string; glow: string };

function lookOf(g: GotItem): Look {
  if ("potion" in g) return { name: POTIONS[g.potion].name, icon: POTIONS[g.potion].icon, color: "#ff9fb0", glow: "rgba(255,120,150,0.18)" };
  const d = g.drop;
  if (d.dropType === "reward") return { name: `${d.amount} gold`, icon: "🪙", color: "#f5c542", glow: "rgba(245,197,66,0.2)" };
  const x = d as CreatureOrItemDrop;
  const rc = RARITY_COLORS[x.rarity];
  if (x.dropType === "card" || x.dropType === "creature") return { name: `${x.name} card`, sprite: creatureSprite(x.creatureId), color: rc.text, glow: rc.glow };
  return { name: x.name, sprite: itemSprite(x), icon: x.codexMove ? "📖" : x.potion ? POTIONS[x.potion].icon : "📦", color: rc.text, glow: rc.glow };
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
export default function LootGrid({ items, faded, grouped }: { items: GotItem[]; faded?: boolean; grouped?: boolean }) {
  if (items.length === 0) return <p style={{ fontSize: 13, color: MUTED, margin: "4px 0" }}>Nothing.</p>;
  const cards = stackCards(items);
  const gold = items.reduce((n, g) => n + goldOf(g), 0);
  const tiles = items.filter((g) => !cardOf(g) && !isGold(g));

  const cardGrid = cards.length > 0 && <CardStack piles={cards} faded={faded} />;
  const tileGrid = tiles.length > 0 && (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 8, opacity: faded ? 0.55 : 1 }}>
      {tiles.map((g, i) => <Tile key={i} g={g} faded={faded} />)}
    </div>
  );
  const goldLine = gold > 0 && (
    <div className="pixel-font" style={{ fontSize: 18, color: "#f5c542", opacity: faded ? 0.55 : 1 }}>🪙 {gold} gold</div>
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

function Tile({ g, faded }: { g: GotItem; faded?: boolean }) {
  const l = lookOf(g);
  return (
    <div title={l.name} style={{ minWidth: 0, textAlign: "center" }}>
      <div style={{
        aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(circle, ${l.glow}, #101117 75%)`, border: `3px solid ${l.color}`,
        boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.06), 0 3px 0 rgba(0,0,0,0.5)",
        filter: faded ? "grayscale(0.6)" : undefined,
      }}>
        {l.sprite ? <PixelSprite sprite={l.sprite} scale={2.2} /> : <span style={{ fontSize: 24 }}>{l.icon}</span>}
      </div>
      <div style={{ fontSize: 10, color: l.color, marginTop: 3, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
    </div>
  );
}
