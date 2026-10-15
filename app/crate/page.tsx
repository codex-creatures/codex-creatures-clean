"use client";
// app/crate/page.tsx
// Klutz's crate, beside the cage: the weapons and armour he brings home from
// his trips (what his catches were wearing, and anything he picks up on the
// way). Keep a piece (it goes into your storage) or sell it for gold.

import { useState } from "react";
import Link from "next/link";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { itemSprite } from "@/components/PixelSprite";
import { useGameState } from "@/hooks/useGameState";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { ARMOR_SLOT_INFO } from "@/lib/items/armor";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f5c542";

// An item's stats, short: "Atk 14 · Agi 6".
const LABELS: Record<string, string> = { melee: "Atk", ranged: "Rng", magic: "Mag", agility: "Agi", hp: "HP", mDef: "MDef", rDef: "RDef", magDef: "MgDef" };
const statLine = (it: CreatureOrItemDrop) =>
  Object.entries(it.stats ?? {}).filter(([, v]) => v).map(([k, v]) => `${LABELS[k] ?? k} ${v}`).join(" · ");

export default function CratePage() {
  const game = useGameState();
  const [sellAllArmed, setSellAllArmed] = useState(false);
  if (!game.hydrated) return <DenFrame title="Klutz's Crate" icon="📦"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const items = game.crate as CreatureOrItemDrop[];
  const total = items.reduce((s, d) => s + game.crateSellValue(d), 0);

  return (
    <DenFrame title="Klutz's Crate" icon="📦" gold={game.gold}>
      <div className="stone-panel">
        <p style={{ fontSize: 13, color: "#c8c4b8", lineHeight: 1.5, margin: 0 }}>
          Whatever <Link href="/klutz" style={{ textDecoration: "underline" }}>Klutz</Link> drags home goes in here: the gear his catches were
          wearing, and anything he picks up along the way. Keep what you want — it goes into your storage — and sell the rest.
        </p>
      </div>

      {items.length === 0 ? (
        <p style={{ color: MUTED, marginTop: 14 }}>Empty. Send Klutz hunting and he&apos;ll fill it up.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 10px" }}>
            <button className="pixel-btn" onClick={() => game.keepFromCrate(items.map((d) => d.id))}>Keep all</button>
            <button className="pixel-btn" style={{ background: sellAllArmed ? "#6e1f18" : undefined }} onClick={() => {
              if (!sellAllArmed) { setSellAllArmed(true); window.setTimeout(() => setSellAllArmed(false), 4000); return; }
              setSellAllArmed(false);
              game.sellFromCrate(items.map((d) => d.id));
            }}>{sellAllArmed ? `Tap again: sell all for 🪙 ${total}` : `Sell all · 🪙 ${total}`}</button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((it) => {
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
                      {it.rarity} {it.itemCategory === "weapon" ? "weapon" : it.armorSlot ? ARMOR_SLOT_INFO[it.armorSlot].name.toLowerCase() : "item"}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#c9b48a" }}>{statLine(it)}</span>
                  </span>
                  <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="chip" onClick={() => game.keepFromCrate([it.id])}>Keep</button>
                    <button className="chip" onClick={() => game.sellFromCrate([it.id])} style={{ color: GOLD }}>Sell · 🪙 {value}</button>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </DenFrame>
  );
}
