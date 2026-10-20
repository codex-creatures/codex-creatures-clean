"use client";
// components/MerchantCart.tsx
// The wandering merchant's cart, as an inventory to rummage through: each
// thing in a slot with its price under it. Tap things to pick them (tap again
// to put one back); the box on top says what the last one picked does, and
// what everything picked costs together. Buy takes them all at once.

import { Coin } from "./GoldCount";
import { useMemo, useState } from "react";
import PixelSprite from "./PixelSprite";
import { ICON, lookOf } from "./ContainerLoot";
import { POTIONS, BACKPACK, BINDLE, priceUp, wareName, type SackItem, type Ware } from "@/lib/dungeon/run";
import { TOOLS, MATERIALS, materialDrop, toolDrop } from "@/lib/items/materials";
import { scrollDrop } from "@/lib/drops";
import { SCROLL_XP } from "@/lib/creatures/levels";

const MUTED = "rgba(255,255,255,0.55)";
const GOLD = "#f1d9a0";
// Text cut to n lines (with …) in a box always that tall.
const lines = (n: number, lineHeight: number): React.CSSProperties => ({
  display: "-webkit-box", WebkitLineClamp: n, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight, height: `${n * lineHeight}em`,
});

const detailOf = (w: Ware) => ("backpack" in w ? `Room for ${BACKPACK} things in your bag, from now on (your bindle holds ${BINDLE}).`
  : "potion" in w ? `Restores ${POTIONS[w.potion].heal} HP to one creature. In a fight it uses your turn.`
  : "scroll" in w ? `${SCROLL_XP} XP for one creature, or Klutz.`
  : "tool" in w ? TOOLS[w.tool].desc : `${MATERIALS[w.material].desc} Takes a slot (it stacks); it's yours once you're home.`);

export default function MerchantCart({ wares, bought = [], gold, bagUsed, bagSlots, stacks, onBuy }: {
  wares: Ware[]; bought?: string[];
  gold: number; bagUsed: number; bagSlots: number;
  stacks: string[];                 // materials already in your bag (more of one joins its stack)
  onBuy: (wares: Ware[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  // Each ware as the thing it is, for its picture and colour.
  const looks = useMemo(() => wares.map((w) => lookOf(("backpack" in w ? { backpack: true } : "potion" in w ? { potion: w.potion }
    : { gear: "scroll" in w ? scrollDrop() : "tool" in w ? toolDrop(w.tool) : materialDrop(w.material, w.qty) }) as SackItem)), [wares]);
  const { chosen, total, short } = priceUp(wares, picked, gold, bagSlots - bagUsed, stacks);
  const focus = wares.find((w) => w.key === picked[picked.length - 1]);
  const toggle = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  const buy = () => { if (chosen.length && !short) { onBuy(chosen); setPicked([]); } };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {/* What the last thing picked does, and the total */}
      <div className="stone-panel" style={{ padding: "8px 10px", display: "grid", gap: 4 }}>
        <b style={{ color: focus ? looks[wares.indexOf(focus)].color : MUTED, ...lines(1, 1.3) }}>{focus ? wareName(focus) : "Tap something to look at it"}</b>
        <span title={focus ? detailOf(focus) : undefined} style={{ fontSize: 12, color: MUTED, ...lines(2, 1.35) }}>{focus ? detailOf(focus) : "Tap again to put it back."}</span>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
          <span className="pixel-font" style={{ color: short === "gold" ? "#ff8a80" : GOLD }}>Total <Coin size={13} /> {total}</span>
          <span style={{ color: MUTED }}><Coin size={13} /> {gold} · 🎒 {bagUsed}/{bagSlots}</span>
        </div>
      </div>

      {/* The cart */}
      <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, padding: 8 }}>
        {wares.map((w, i) => {
          const l = looks[i];
          const sold = bought.includes(w.key);
          const on = picked.includes(w.key);
          return (
            <button key={w.key} disabled={sold} onClick={() => toggle(w.key)} title={wareName(w)} aria-pressed={on}
              style={{ background: "none", border: "none", padding: 0, minWidth: 0, color: "white", cursor: sold ? "default" : "pointer", opacity: sold ? 0.35 : 1 }}>
              <span className="inv-slot" style={{ position: "relative", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                background: `radial-gradient(circle, ${l.glow} 0%, rgba(0,0,0,0.35) 65%)`,
                ...(on ? { borderColor: "#ffd66e", boxShadow: "0 0 12px rgba(255,214,110,0.55)" } : {}) }}>
                {l.sprite ? <PixelSprite sprite={l.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: 26 }}>{l.icon}</span>}
                {"qty" in w && <span style={{ position: "absolute", right: 3, bottom: 1, fontSize: 11, fontWeight: 700, textShadow: "0 1px 0 #000" }}>×{w.qty}</span>}
              </span>
              <span className="pixel-font" style={{ display: "block", marginTop: 3, fontSize: 11, textAlign: "center", color: sold ? MUTED : on ? "#ffd66e" : GOLD }}>{sold ? "sold" : <><Coin size={11} /> {w.price}</>}</span>
            </button>
          );
        })}
      </div>

      <button className="pixel-btn" disabled={!chosen.length || !!short} onClick={buy} style={{ width: "100%" }}>
        {short === "gold" ? "Not enough gold" : short === "room" ? "No room in your bag" : chosen.length ? <>Buy {chosen.length} for <Coin /> {total}</> : "Buy"}
      </button>
    </div>
  );
}
