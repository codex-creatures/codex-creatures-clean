"use client";
// components/TileGrid.tsx
// Creatures, weapons and armour laid out in an inventory panel (.inv-panel):
// each sprite sits loose inside, on a soft glow of its rarity. Grouped by
// rarity (rarest first), A–Z within. Tap one to open it (or, in sell mode,
// to select it).

import type { CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS, rarityGlow } from "@/lib/items/gameHelpers";
import { spriteWidth } from "@/lib/sprites/pixels";
import PixelSprite, { creatureSprite, itemSprite } from "./PixelSprite";
import CreaturePortrait from "./CreaturePortrait";
import { CLASS_INFO, COMBAT_CLASSES, RACES, RACE_INFO, findCreatureTemplate } from "@/lib/creatures/creatureData";
import { CreatureMarks, type GroupBy } from "./CreatureMarks";
import { ICON, NAME } from "./ContainerLoot";

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
        <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${large ? 132 : 84}px, 1fr))`, gap: large ? 16 : 10, marginTop: 14 }}>
          {items.map((d) => large && d.dropType !== "item" ? (
            <CreatureCard key={d.id} d={d} fav={favoriteIds.has(d.id)} badge={badge?.(d)} onClick={() => onOpen(d)} />
          ) : (
            <Tile key={d.id} d={d} fav={favoriteIds.has(d.id)} badge={badge?.(d)} onClick={() => onOpen(d)}
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 10 }}>
                {group.map((d) => (
                  <Tile key={d.id} d={d} fav={favoriteIds.has(d.id)} badge={badge?.(d)} onClick={() => onOpen(d)}
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
      {/* Loose in the panel: a soft glow of its rarity under it, no frame (a gold ring when picked to sell). */}
      <span style={{
        position: "relative", aspectRatio: "1", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(circle, ${rarityGlow(d.rarity)} 0%, transparent 62%)`, borderRadius: 8,
        boxShadow: sell?.on ? "inset 0 0 0 2px #f5c542, 0 0 12px rgba(245,197,66,0.5)" : undefined,
      }}>
        {sprite ? <PixelSprite sprite={sprite} scale={Math.max(2, Math.floor(56 / w))} style={ICON} /> : <span style={{ fontSize: 26 }}>{d.codexMove ? "📖" : d.potion ? "🧴" : "📦"}</span>}
        {fav && <span style={{ position: "absolute", top: 2, left: 4, fontSize: 13, color: "#f5c542" }}>★</span>}
        {sell && sell.can && <span style={{ position: "absolute", top: 2, left: 4, fontSize: 14, color: sell.on ? "#f5c542" : MUTED }}>{sell.on ? "☑" : "☐"}</span>}
        {tpl && <span style={{ position: "absolute", top: 2, right: 2 }}><CreatureMarks race={tpl.race} cls={tpl.cls} size={10} /></span>}
        {badge && <span style={{ position: "absolute", bottom: 2, right: 4, fontSize: 11, color: "#f5c542", maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{badge}</span>}
      </span>
      <span style={{ ...NAME, display: "-webkit-box", color: col.text }}>
        {d.name}
      </span>
    </button>
  );
}

// A creature in your collection: "Lv 3 Rust Beetle" on top, the creature
// itself below (just the sprite, no frame), then its attack style and race.
function CreatureCard({ d, fav, badge, onClick }: { d: CreatureOrItemDrop; fav: boolean; badge?: string; onClick: () => void }) {
  const col = RARITY_COLORS[d.rarity];
  const tpl = templateOf(d);
  return (
    <button onClick={onClick} title={d.name}
      style={{ position: "relative", background: "none", border: "none", padding: "4px 2px", cursor: "pointer", color: "white", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span className="pixel-font" style={{ maxWidth: "100%", fontSize: 14, color: col.text, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", lineHeight: 1.15 }}>
        <span style={{ color: "#f1d9a0" }}>Lv {d.level ?? 1}</span> {d.name}
      </span>
      <CreaturePortrait creatureId={d.creatureId} title={d.name} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
      {tpl && (
        <span className="pixel-font" style={{ fontSize: 12, textAlign: "center" }}>
          <span style={{ color: CLASS_INFO[tpl.cls].color }}>{CLASS_INFO[tpl.cls].name}</span>
          {tpl.race && <span style={{ color: "#f1d9a0" }}> · {RACE_INFO[tpl.race].name}</span>}
        </span>
      )}
      {fav && <span style={{ position: "absolute", top: 26, left: 4, fontSize: 15, color: "#f5c542" }}>★</span>}
      {badge && <span style={{ position: "absolute", top: 26, right: 4, fontSize: 13 }}>{badge}</span>}
    </button>
  );
}
