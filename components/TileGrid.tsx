"use client";
// components/TileGrid.tsx
// Creatures, weapons and armour as framed squares with their sprite, the
// same look as the slots in the creature window. Grouped by rarity (rarest
// first), A–Z within. Tap one to open it (or, in sell mode, to select it).

import type { CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { spriteWidth } from "@/lib/sprites/pixels";
import PixelSprite, { creatureSprite, itemSprite } from "./PixelSprite";
import { CLASS_INFO, COMBAT_CLASSES, RACES, RACE_INFO, findCreatureTemplate } from "@/lib/creatures/creatureData";
import { CreatureMarks, type GroupBy } from "./CreatureMarks";

export const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];
const MUTED = "rgba(255,255,255,0.45)";

// Rarest first, then by name.
export function sortByRarity<T extends { rarity: Rarity; name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
}

const templateOf = (d: CreatureOrItemDrop) => (d.dropType === "item" ? undefined : findCreatureTemplate(d.creatureId, d.name));

// The sections a grid shows, in order: [key, title, colour, items].
export function groupTiles(items: CreatureOrItemDrop[], by: GroupBy = "rarity"): [string, string, string, CreatureOrItemDrop[]][] {
  const sorted = sortByRarity(items);
  if (by === "class") {
    return COMBAT_CLASSES.map((c) => [c, `${CLASS_INFO[c].icon} ${CLASS_INFO[c].name}`, CLASS_INFO[c].color, sorted.filter((d) => templateOf(d)?.cls === c)]);
  }
  if (by === "race") {
    return RACES.map((r) => [r, `${RACE_INFO[r].icon} ${RACE_INFO[r].name}`, RACE_INFO[r].color, sorted.filter((d) => templateOf(d)?.race === r)]);
  }
  return RARITY_ORDER.map((r) => [r, r, RARITY_COLORS[r].text, sorted.filter((d) => d.rarity === r)]);
}

type Props = {
  items: CreatureOrItemDrop[];          // already sorted
  favoriteIds: Set<string>;
  badge?: (d: CreatureOrItemDrop) => string | undefined; // e.g. ⚔️🛡️ worn gear, or "on Klutz"
  sellMode?: boolean;
  sellable?: (d: CreatureOrItemDrop) => boolean;
  selected?: Set<string>;
  onOpen: (d: CreatureOrItemDrop) => void;
  groupBy?: GroupBy | "none"; // "none": one grid, in the order given
  large?: boolean;            // big creature cards (the Pit)
};

export default function TileGrid({ items, favoriteIds, badge, sellMode, sellable, selected, onOpen, groupBy = "rarity", large }: Props) {
  return (
    <div>
      {groupBy === "none" && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${large ? 132 : 84}px, 1fr))`, gap: large ? 16 : 10, marginTop: 14 }}>
          {items.map((d) => large && d.dropType !== "item" ? (
            <CreatureCard key={d.id} d={d} fav={favoriteIds.has(d.id)} badge={badge?.(d)} onClick={() => onOpen(d)} />
          ) : (
            <Tile key={d.id} d={d} fav={favoriteIds.has(d.id)} badge={badge?.(d)} onClick={() => onOpen(d)}
              sell={sellMode ? { can: sellable?.(d) ?? false, on: selected?.has(d.id) ?? false } : undefined} />
          ))}
        </div>
      )}
      {groupBy !== "none" && groupTiles(items, groupBy).map(([key, title, color, group]) => {
        if (group.length === 0) return null;
        return (
          <section key={key} style={{ marginTop: 14 }}>
            <div className="pixel-font" style={{ fontSize: 14, color, textTransform: "capitalize", marginBottom: 8 }}>
              {title} <span style={{ opacity: 0.5 }}>· {group.length}</span>
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
  const w = sprite ? spriteWidth(sprite) : 16;
  const dim = sell && !sell.can;
  const tpl = templateOf(d);
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
        {tpl && <span style={{ position: "absolute", top: 2, right: 2 }}><CreatureMarks race={tpl.race} cls={tpl.cls} size={10} /></span>}
        {badge && <span style={{ position: "absolute", bottom: 2, right: 4, fontSize: 11, color: "#f5c542", maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{badge}</span>}
      </span>
      <span style={{ display: "block", marginTop: 4, fontSize: 11, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
        {d.name}
      </span>
    </button>
  );
}

// A creature as a big framed card, drawn like the equip window: glowing on
// its pedestal. Its class sits on the frame's bottom-left corner, its race on
// the bottom-right, clear of the sprite.
function CreatureCard({ d, fav, badge, onClick }: { d: CreatureOrItemDrop; fav: boolean; badge?: string; onClick: () => void }) {
  const col = RARITY_COLORS[d.rarity];
  const tpl = templateOf(d);
  const chip = (icon: string, color: string, title: string, side: "left" | "right") => (
    <span title={title} style={{
      position: "absolute", bottom: -13, [side]: 8, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, background: "#101117", border: `2px solid ${color}`, borderRadius: 6, boxShadow: "0 2px 0 rgba(0,0,0,0.6)",
    }}>{icon}</span>
  );
  return (
    <button onClick={onClick} title={d.name}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "white", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <span style={{
        position: "relative", aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(ellipse at 50% 55%, ${col.glow}, #101117 72%)`,
        border: `3px solid ${col.border}`, borderRadius: 10,
        boxShadow: "inset 0 0 18px rgba(0,0,0,0.6), 0 4px 0 rgba(0,0,0,0.5)",
      }}>
        <PixelSprite sprite={creatureSprite(d.creatureId)} scale={3.4} style={{ position: "relative", zIndex: 1 }} />
        <span style={{ width: "62%", height: 10, marginTop: -4, background: "#3a3f4c", borderTop: `2px solid ${col.border}`, borderRadius: "50% / 40%", boxShadow: "inset 0 -2px 0 #23262f" }} />
        {fav && <span style={{ position: "absolute", top: 4, left: 7, fontSize: 15, color: "#f5c542" }}>★</span>}
        {badge && <span style={{ position: "absolute", top: 4, right: 7, fontSize: 13 }}>{badge}</span>}
        {tpl && chip(CLASS_INFO[tpl.cls].icon, CLASS_INFO[tpl.cls].color, `Class: ${CLASS_INFO[tpl.cls].name}`, "left")}
        {tpl?.race && chip(RACE_INFO[tpl.race].icon, RACE_INFO[tpl.race].color, `Race: ${RACE_INFO[tpl.race].name}`, "right")}
      </span>
      <span style={{ display: "block", marginTop: 18, fontSize: 14, fontWeight: 600, color: col.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
        {d.name}
      </span>
    </button>
  );
}
