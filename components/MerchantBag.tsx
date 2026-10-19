"use client";
// components/MerchantBag.tsx
// Your bag at the merchant's cart: every slot, so you can see the room you
// have left, and a way to sell him something to make more. Tap a slot, then
// Sell. The box on top always keeps its size (it just says what's picked).

import { useState } from "react";
import BagSlots, { type SlotLook } from "./BagSlots";
import { Coin } from "./GoldCount";

const MUTED = "rgba(255,255,255,0.55)";

export default function MerchantBag({ slots, looks, offers, onSell }: {
  slots: number;
  looks: (SlotLook | null)[];   // one per filled slot, in order
  offers: number[];             // what he'll pay for each (0: he won't take it)
  onSell: (i: number) => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const look = sel !== null ? looks[sel] : null;
  const offer = sel !== null ? offers[sel] ?? 0 : 0;
  const sell = () => { if (sel !== null && offer > 0) { onSell(sel); setSel(null); } };

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
      <div className="stone-panel" style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: look ? look.color : MUTED, fontWeight: look ? 700 : 400, fontSize: 13 }} title={look?.name}>
          {look ? look.name : `Your bag · ${looks.filter(Boolean).length}/${slots}`}
        </span>
        <button className="pixel-btn" disabled={!look || offer <= 0} onClick={sell} style={{ flexShrink: 0, minHeight: 44 }}>
          {!look ? "Sell" : offer > 0 ? <>Sell <Coin size={13} /> {offer}</> : "Not wanted"}
        </button>
      </div>
      <BagSlots slots={slots} looks={looks} selected={sel} onSelect={setSel} size={44} />
    </div>
  );
}
