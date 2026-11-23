"use client";
// components/klutz/KlutzCrate.tsx
// Klutz's crate (his chest), beside the cage: what he brings home from his
// trips that isn't a creature or a material: codexes, potions, weapons and
// armour. Keep a thing (it goes into your Inventory) or sell it for gold. It
// holds chestSize (lib/klutz.ts): full, he won't set off (a trip can overfill it).
// Shown in Klutz's Den (app/klutz, its Crate tab).

import { Coin } from "@/components/GoldCount";
import { useState } from "react";
import Link from "next/link";
import PixelSprite, { itemSprite } from "@/components/PixelSprite";
import type { useGameState } from "@/hooks/useGameState";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { ARMOR_SLOT_INFO } from "@/lib/items/armor";
import type { CreatureOrItemDrop } from "@/lib/types";
import { chestSize } from "@/lib/klutz";
import { BOX_NAMES, roomFor } from "@/lib/items/storage";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f5c542";

// An item's stats, short: "Atk 14 · Agi 6".
const LABELS: Record<string, string> = { melee: "Atk", ranged: "Rng", magic: "Mag", agility: "Agi", hp: "HP", mDef: "MDef", rDef: "RDef", magDef: "MgDef" };
const statLine = (it: CreatureOrItemDrop) =>
  Object.entries(it.stats ?? {}).filter(([, v]) => v).map(([k, v]) => `${LABELS[k] ?? k} ${v}`).join(" · ");

// intro: the paragraph on what the crate is (left out in Klutz's Den, whose tab says it).
export default function KlutzCrate({ game, intro = true }: { game: ReturnType<typeof useGameState>; intro?: boolean }) {
  const [sellAllArmed, setSellAllArmed] = useState(false);
  const [left, setLeft] = useState<string | null>(null); // why things stayed in the crate on the last Keep

  const items = game.crate as CreatureOrItemDrop[];
  const total = items.reduce((s, d) => s + game.crateSellValue(d), 0);
  // Keep (all or one): only what has room comes out; say what held the rest back.
  function keep(ids: string[]) {
    const room = game.keepFromCrate(ids);
    const stayed = ids.length - room.fit.length;
    const why = [...room.full.map((b) => `your ${BOX_NAMES[b]} box is full`), ...(room.shelfFull ? ["your bookcase is full"] : [])];
    setLeft(stayed > 0 ? `${stayed === ids.length ? "Nothing came out" : `${stayed} stayed in the crate`}: ${why.join(" and ")}. Sell some to make room.` : null);
  }

  return (
    <>
      {intro && <div className="stone-panel">
        <p style={{ fontSize: 13, color: "#c8c4b8", lineHeight: 1.5, margin: 0 }}>
          What <Link href="/klutz" style={{ textDecoration: "underline" }}>Klutz</Link> drags home waits in here: codexes, potions, weapons and armour.
          Keep what you want (it goes into your Inventory) and sell the rest. <b style={{ color: items.length >= chestSize(game.klutz) ? "#ff8a80" : GOLD }}>{items.length}/{chestSize(game.klutz)}</b>{items.length >= chestSize(game.klutz) ? ": full, so he won't set off." : ""}
        </p>
      </div>}

      {items.length === 0 ? (
        <p style={{ color: MUTED, marginTop: 14 }}>Empty. Send Klutz hunting and he&apos;ll fill it up.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 10px" }}>
            <button className="pixel-btn" onClick={() => keep(items.map((d) => d.id))}>Keep all</button>
            <button className="pixel-btn" style={{ background: sellAllArmed ? "#6e1f18" : undefined }} onClick={() => {
              if (!sellAllArmed) { setSellAllArmed(true); window.setTimeout(() => setSellAllArmed(false), 4000); return; }
              setSellAllArmed(false);
              game.sellFromCrate(items.map((d) => d.id));
            }}>{sellAllArmed ? <>Tap again: sell all for <Coin /> {total}</> : <>Sell all · <Coin /> {total}</>}</button>
          </div>
          {left && <p style={{ fontSize: 13, color: "#ff8a80", margin: "0 0 10px" }}>{left} <Link href="/chest" style={{ color: "white", textDecoration: "underline" }}>Storehouse</Link></p>}
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((it) => {
              const fits = roomFor(game.inventory, [it], game.storage, game.shelfFree).fit.length > 0;
              const rc = RARITY_COLORS[it.rarity];
              const sprite = itemSprite(it);
              const value = game.crateSellValue(it);
              return (
                <div key={it.id} className="card-btn" style={{ cursor: "default", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ width: 52, height: 52, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `radial-gradient(circle, ${rc.glow}, #101117 75%)`, border: `3px solid ${rc.border}` }}>
                    {sprite ? <PixelSprite sprite={sprite} scale={2.2} /> : <span style={{ fontSize: 22 }}>📦</span>}
                  </span>
                  <span style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <b style={{ color: rc.text }}>{it.name}</b>
                    <span style={{ display: "block", fontSize: 12, color: MUTED, textTransform: "capitalize" }}>
                      {it.rarity} {it.itemCategory === "weapon" ? "weapon" : it.armorSlot ? ARMOR_SLOT_INFO[it.armorSlot].name.toLowerCase() : it.codexMove ? "codex" : it.potion ? "potion" : "item"}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#c9b48a" }}>{statLine(it)}</span>
                  </span>
                  <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="chip" onClick={() => keep([it.id])} disabled={!fits} title={fits ? undefined : "No room for it: sell some to make room"}>{fits ? "Keep" : it.codexMove ? "Shelf full" : "Box full"}</button>
                    <button className="chip" onClick={() => game.sellFromCrate([it.id])} style={{ color: GOLD }}>Sell · <Coin /> {value}</button>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
