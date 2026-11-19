"use client";
// components/TileGrid.tsx
// Creatures, weapons, armour, materials and consumables laid out in an inventory panel (.inv-panel):
// each sprite sits loose inside, on a soft glow of its rarity. Grouped by
// rarity (rarest first), A–Z within. Tap one to open it (or, in sell mode,
// to select it). A creature shows its level, and what it's wearing (gear), so
// you can tell a trained one from a fresh one at a glance (Kay sold her Lv 17
// Rattlebones to the collector, 2026-11-05: the tiles looked the same).
// cols: a fixed number of slot-sized tiles a row, no names
// (the bag packer: the same size as the bag's slots, to drag across).

import { goodsIcon } from "@/lib/items/materials";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS, rarityGlow } from "@/lib/items/gameHelpers";
import { spriteWidth } from "@/lib/sprites/pixels";
import PixelSprite, { creatureSprite, itemSprite } from "./PixelSprite";
import CreaturePortrait from "./CreaturePortrait";
import { CLASS_INFO, COMBAT_CLASSES, RACES, RACE_INFO, findCreatureTemplate } from "@/lib/creatures/creatureData";
import { CreatureMarks, type GroupBy } from "./CreatureMarks";
import { ICON, NAME } from "./ContainerLoot";
import { RaceIcon } from "./Glyph";
import { RaceNames } from "./RaceTag";

export const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];
const MUTED = "rgba(255,255,255,0.45)";
const SLOT = 60; // a compact tile: BagSlots' slot size

// Rarest first, then by name.
export function sortByRarity<T extends { rarity: Rarity; name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
}

const templateOf = (d: CreatureOrItemDrop) => (d.dropType === "item" ? undefined : findCreatureTemplate(d.creatureId, d.name));

// The sections a grid shows, in order: [key, title, colour, items].
export function groupTiles(items: CreatureOrItemDrop[], by: GroupBy = "rarity"): [string, React.ReactNode, string, CreatureOrItemDrop[]][] {
  const sorted = sortByRarity(items);
  if (by === "class") {
    return COMBAT_CLASSES.map((c) => [c, `${CLASS_INFO[c].icon} ${CLASS_INFO[c].name}`, CLASS_INFO[c].color, sorted.filter((d) => templateOf(d)?.cls === c)]);
  }
  if (by === "race") {
    return RACES.map((r) => [r, <><RaceIcon r={r} /> {RACE_INFO[r].name}</>, RACE_INFO[r].color, sorted.filter((d) => templateOf(d)?.race === r)]);
  }
  return RARITY_ORDER.map((r) => [r, r, RARITY_COLORS[r].text, sorted.filter((d) => d.rarity === r)]);
}

type Props = {
  items: CreatureOrItemDrop[];          // already sorted
  favoriteIds: Set<string>;
  badge?: (d: CreatureOrItemDrop) => string | undefined; // e.g. "on Klutz", or a price
  gear?: (d: CreatureOrItemDrop) => string | undefined;  // a creature's worn gear (gearMarks)
  sellMode?: boolean;
  sellable?: (d: CreatureOrItemDrop) => boolean;
  selected?: Set<string>;
  onOpen: (d: CreatureOrItemDrop) => void;
  groupBy?: GroupBy | "none"; // "none": one grid, in the order given
  large?: boolean;            // big creature cards (the Pit)
  picked?: string | null;     // the one tapped for a closer look (components/ItemPicker)
  pulse?: string;             // a creature card the tutorial wants you to tap (it glows)
  cols?: number;              // that many slot-sized tiles a row, no names (BagSlots' size)
  perRow?: number;            // that many a row, sharing the width (the Inventory: 4, the user, 2026-11-20)
  grab?: (d: CreatureOrItemDrop) => React.HTMLAttributes<HTMLElement>; // drag it (hooks/useDragDrop)
};

export default function TileGrid({ items, favoriteIds, badge, gear, sellMode, sellable, selected, onOpen, groupBy = "rarity", large, picked, pulse, cols, perRow, grab }: Props) {
  const columns = cols ? `repeat(${cols}, minmax(0, ${SLOT}px))` : perRow ? `repeat(${perRow}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(${large ? 96 : 84}px, 1fr))`; // (creature cards: three a row on a phone)
  return (
    <div>
      {groupBy === "none" && (
        <div className={large ? undefined : "inv-panel"} style={{ display: "grid", gridTemplateColumns: columns, justifyContent: "center", gap: large ? "14px 6px" : cols ? 8 : 10, marginTop: 14 }}>{/* (creature cards: no panel round them, the user, 2026-11-17: the rows need the width) */}
          {items.map((d) => large && d.dropType !== "item" ? (
            <CreatureCard key={d.id} d={d} fav={favoriteIds.has(d.id)} badge={badge?.(d)} gear={gear?.(d)} onClick={() => onOpen(d)} glow={pulse === d.id} />
          ) : (
            <Tile key={d.id} d={d} fav={favoriteIds.has(d.id)} badge={badge?.(d)} gear={gear?.(d)} onClick={() => onOpen(d)} picked={picked === d.id} compact={!!cols} grab={grab?.(d)}
              sell={sellMode ? { can: sellable?.(d) ?? false, on: selected?.has(d.id) ?? false } : undefined} />
          ))}
        </div>
      )}
      {groupBy !== "none" && (
        <div className="inv-panel" style={{ marginTop: 14 }}>
          {groupTiles(items, groupBy).filter(([, , , g]) => g.length > 0).map(([key, title, color, group], n) => (
            <section key={key} style={{ marginTop: n ? 16 : 0 }}>
              <div className="pixel-font" style={{ fontSize: 14, color, textTransform: "capitalize", marginBottom: 8 }}>
                {title} <span style={{ opacity: 0.5 }}>· {group.length}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: columns, justifyContent: cols ? "center" : undefined, gap: cols ? 8 : 10 }}>
                {group.map((d) => (
                  <Tile key={d.id} d={d} fav={favoriteIds.has(d.id)} badge={badge?.(d)} gear={gear?.(d)} onClick={() => onOpen(d)} picked={picked === d.id} compact={!!cols} grab={grab?.(d)}
                    sell={sellMode ? { can: sellable?.(d) ?? false, on: selected?.has(d.id) ?? false } : undefined} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ d, fav, badge, gear, sell, picked, onClick, compact, grab }: {
  d: CreatureOrItemDrop; fav: boolean; badge?: string; gear?: string; sell?: { can: boolean; on: boolean }; picked?: boolean; onClick: () => void;
  compact?: boolean; grab?: React.HTMLAttributes<HTMLElement>;
}) {
  const col = RARITY_COLORS[d.rarity];
  const sprite = d.dropType === "item" ? itemSprite(d) : creatureSprite(d.creatureId);
  const w = sprite ? spriteWidth(sprite) : 16;
  const dim = sell && !sell.can;
  const tpl = templateOf(d);
  const creature = d.dropType === "creature";
  return (
    <button onClick={onClick} title={creature ? `Lv ${d.level ?? 1} ${d.name}${gear ? " (wearing gear)" : ""}` : d.name} disabled={dim} {...grab}
      style={{ background: "none", border: "none", padding: 0, cursor: dim ? "default" : grab ? "grab" : "pointer", color: "white", minWidth: 0, opacity: dim ? 0.35 : 1, ...(grab ? { touchAction: "none" } : {}) }}>
      {/* Loose in the panel: a soft glow of its rarity under it, no frame (a gold ring when picked to sell). */}
      <span style={{
        position: "relative", aspectRatio: "1", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(circle, ${rarityGlow(d.rarity)} 0%, transparent 62%)`, borderRadius: 8,
        boxShadow: sell?.on || picked ?"inset 0 0 0 2px #f5c542, 0 0 12px rgba(245,197,66,0.5)" : undefined,
      }}>
        {sprite ? <PixelSprite sprite={sprite} scale={compact ? 4 : Math.max(2, Math.floor(56 / w))} style={ICON} /> : <span style={{ fontSize: 26 }}>{goodsIcon(d) ?? (d.codexMove ? "📖" : d.scroll ? "📜" : d.potion ? "🧴" : "📦")}</span>}
        {fav && <span style={{ position: "absolute", top: 2, left: 4, fontSize: 13, color: "#f5c542" }}>★</span>}
        {sell && sell.can && <span style={{ position: "absolute", top: 2, left: 4, fontSize: 14, color: sell.on ? "#f5c542" : MUTED }}>{sell.on ? "☑" : "☐"}</span>}
        {tpl && <span style={{ position: "absolute", top: 2, right: 2 }}><CreatureMarks race={tpl.race} races={tpl.races} cls={tpl.cls} size={10} /></span>}
        {/* A creature: its level, bottom left, with what it's wearing above. */}
        {creature && (
          <span style={{ position: "absolute", bottom: 1, left: 4, display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
            {gear && <span style={{ fontSize: 10 }}>{gear}</span>}
            <span className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", textShadow: "0 2px 0 #000, 0 0 3px #000" }}>Lv {d.level ?? 1}{d.ascended ? <span style={{ color: "#ffd66e" }}> {"★".repeat(d.ascended)}</span> : null}</span>
          </span>
        )}
        {badge && <span style={{ position: "absolute", bottom: 2, right: 4, fontSize: 11, color: "#f5c542", maxWidth: creature ? "50%" : "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{badge}</span>}
        {/* A stack (materials): how many, in the corner, like a count on a game icon. */}
        {!badge && d.qty ? <span className="pixel-font" style={{ position: "absolute", bottom: 0, right: 4, fontSize: 16, color: "#f1d9a0", textShadow: "0 2px 0 #000, 0 0 3px #000" }}>{d.qty}</span> : null}
      </span>
      {!compact && <span style={{ ...NAME, display: "-webkit-box", color: col.text }}>
        {d.name}
      </span>}
    </button>
  );
}

// A creature in your collection (the user, 2026-11-17: no boxes, so the words have room): its level
// top left, the creature on a glow of its rarity, then its name in the rarity's colour (always two
// lines tall, so every card is the same size) and its attack style and its race(s), each race's
// name in the race's colour (two lines at most, never cut off mid-word on a phone).
function CreatureCard({ d, fav, badge, gear, onClick, glow }: { d: CreatureOrItemDrop; fav: boolean; badge?: string; gear?: string; onClick: () => void; glow?: boolean }) {
  const col = RARITY_COLORS[d.rarity];
  const tpl = templateOf(d);
  const SHADOW = "0 2px 0 #000, 0 0 3px #000";
  return (
    <button onClick={onClick} title={d.name} className={glow ? "tutorial-pulse" : undefined}
      style={{ position: "relative", background: "none", border: "none", borderRadius: 8, padding: "2px 0", cursor: "pointer", color: "white", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <span className="pixel-font" style={{ position: "absolute", top: 2, left: 2, zIndex: 1, fontSize: 12, lineHeight: 1, color: "#f1d9a0", textShadow: SHADOW }}>Lv {d.level ?? 1}{d.ascended ? <span style={{ color: "#ffd66e" }}> {"★".repeat(d.ascended)}</span> : null}</span>
      <CreaturePortrait creatureId={d.creatureId} title={d.name} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }}
        frame={{ marginTop: 12, background: `radial-gradient(ellipse at 50% 80%, ${col.text}55, transparent 62%)` }} />
      <span className="pixel-font" style={{ width: "100%", height: "2.3em", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, lineHeight: 1.15, textAlign: "center", color: col.text, textShadow: "0 2px 0 #000" }}>
        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.name}</span>
      </span>
      {tpl && (
        <span className="pixel-font" style={{ width: "100%", height: "2.3em", fontSize: 11, lineHeight: 1.15, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          <span style={{ color: CLASS_INFO[tpl.cls].color }}>{CLASS_INFO[tpl.cls].name}</span>
          {tpl.race && <> · <RaceNames races={tpl.races?.length ? tpl.races : [tpl.race]} /></>}
        </span>
      )}
      {fav && <span style={{ position: "absolute", top: 18, left: 2, fontSize: 14, color: "#f5c542", textShadow: SHADOW }}>★</span>}
      {(gear || badge) && <span style={{ position: "absolute", top: 0, right: 0, fontSize: 12 }}>{gear}{badge}</span>}
    </button>
  );
}
