"use client";
// components/LootWindow.tsx
// An opened chest or sack, in a window over the room, with your bag right
// under it: the swap is all on one screen.
// - Tap something in the chest for a closer look (its stats), with a Take
//   button. Gold and creature cards have nothing to see: a tap takes them.
// - Tap something in your bag to see it too (to compare), or put it back.
// - Drag it onto a bag slot to take it there; a slot that's full swaps:
//   what was in it goes into the chest.
// - Drag something from your bag into the chest to leave it there.
// Gold, the backpack and creature cards take no room. Whatever's left in the
// chest stays on the floor when you move on.

import { useRef, useState } from "react";
import PixelSprite from "./PixelSprite";
import { ICON, NAME, lookOf } from "./ContainerLoot";
import { StackCount, type SlotLook } from "./BagSlots";
import { POTIONS, type SackItem } from "@/lib/dungeon/run";
import { GEAR_STATS } from "./GearCompare";
import { getBarColor } from "./ItemDetailModal";
import { ARMOR_SLOT_INFO } from "@/lib/items/armor";
import { MOVE_BY_NAME } from "@/lib/creatures/creatureData";
import { moveKind } from "./ClassBadge";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Sprite } from "@/lib/sprites/pixels";

const MUTED = "rgba(255,255,255,0.55)";
// Where each gear stat sits in a 6-column grid (each box 2 wide): [stat, start column].
const STAT_GRID: [string, number][] = [
  ["melee", 1], ["ranged", 3], ["magic", 5],
  ["mDef", 1], ["rDef", 3], ["magDef", 5],
  ["agility", 2], ["hp", 4],
];
type From = { kind: "loot" | "bag"; i: number };
type Drag = From & { x: number; y: number; sprite?: Sprite; icon?: string; on: boolean; sx: number; sy: number; ox: number; oy: number };

export default function LootWindow({ name, sprite, items, bag, slots, bagName, onTake, onTakeAll, onSwap, onPutBack, onClose }: {
  name: string; sprite: Sprite;
  items: SackItem[];
  bag: SlotLook[];          // what's in each filled slot, in order
  slots: number; bagName: string;
  onTake: (lootIndex: number) => void;
  onTakeAll: () => void;
  onSwap: (lootIndex: number, bagIndex: number) => void; // into that slot (swapping if it's full)
  onPutBack: (bagIndex: number) => void;                 // from the bag into the chest
  onClose: () => void;
}) {
  const full = bag.length >= slots;
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null); // the drop target under the finger
  const [picked, setPicked] = useState<number | null>(null); // a bag slot tapped (to see it, or put it back)
  const [seen, setSeen] = useState<number | null>(null);     // a chest item tapped (to see it before taking it)
  const [was, setWas] = useState(items); // things moved: the indexes are stale
  if (was !== items && (was.length || items.length)) { setWas(items); setSeen(null); setPicked(null); } // (a fresh [] each render is no change)
  const dragRef = useRef<Drag | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null); // the window's backdrop: the ghost is placed within it

  // What's under a point: "bag:<i>" or "loot" (the ghost doesn't catch the pointer).
  const targetAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-drop]") as HTMLElement | null)?.dataset.drop ?? null;

  const press = (from: From, look: { sprite?: Sprite; icon?: string }) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const r = boxRef.current?.getBoundingClientRect();
    const d = { ...from, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, ox: r?.left ?? 0, oy: r?.top ?? 0, sprite: look.sprite, icon: look.icon, on: false };
    dragRef.current = d; setDrag(d);
  };
  const move = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const on = d.on || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8;
    const next = { ...d, x: e.clientX, y: e.clientY, on };
    dragRef.current = next; setDrag(next);
    if (on) setOver(targetAt(e.clientX, e.clientY));
  };
  const release = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null; setDrag(null); setOver(null);
    if (!d) return;
    if (!d.on) { // a tap
      if (d.kind === "loot") {
        if (lookOf(items[d.i]).free) onTake(d.i);
        else { setSeen((s) => (s === d.i ? null : d.i)); setPicked(null); }
      } else { setPicked((p) => (p === d.i ? null : d.i)); setSeen(null); }
      return;
    }
    const t = targetAt(e.clientX, e.clientY);
    if (d.kind === "loot" && t?.startsWith("bag:")) onSwap(d.i, Number(t.slice(4)));
    else if (d.kind === "bag" && t === "loot") { onPutBack(d.i); setPicked(null); }
  };
  const cancel = () => { dragRef.current = null; setDrag(null); setOver(null); };
  const handlers = { onPointerMove: move, onPointerUp: release, onPointerCancel: cancel };

  const glowBg = (glow?: string) => `radial-gradient(circle, ${glow ?? "rgba(255,255,255,0.05)"} 0%, transparent 62%)`;

  return (
    <div ref={boxRef} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 190, background: "rgba(4,5,9,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
      <div role="dialog" aria-label={name} onClick={(e) => e.stopPropagation()} className="title-bar sheet-up"
        style={{ width: "100%", maxWidth: 440, maxHeight: "92cqh", overflowY: "auto", padding: 12, display: "grid", gap: 10, userSelect: "none", WebkitUserSelect: "none" }}>
        {/* The chest */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PixelSprite sprite={sprite} scale={1.4} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
          <div className="pixel-font" style={{ fontSize: 17, color: "#f1d9a0", flex: 1 }}>{name}</div>
          <button className="chip" aria-label="Close" onClick={onClose} style={{ minHeight: 34, padding: "2px 12px" }}>✕</button>
        </div>
        <div data-drop="loot" className="inv-panel"
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, minHeight: 96, outline: over === "loot" ? "2px solid #ffd66e" : undefined }}>
          {items.length === 0 && <div style={{ gridColumn: "1 / -1", alignSelf: "center", textAlign: "center", fontSize: 13, color: MUTED }}>Empty</div>}
          {items.map((x, i) => {
            const l = lookOf(x);
            const blocked = full && !l.free;
            const lifted = drag?.on && drag.kind === "loot" && drag.i === i;
            return (
              <div key={i} onPointerDown={press({ kind: "loot", i }, l)} {...handlers} title={l.name}
                style={{ minWidth: 0, cursor: "grab", touchAction: "none", opacity: lifted ? 0.3 : blocked ? 0.75 : 1 }}>
                <span style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: glowBg(l.glow),
                  ...(seen === i ? { outline: "2px solid #ffd66e", boxShadow: "0 0 12px rgba(255,214,110,0.55)" } : {}) }}>
                  {l.sprite ? <PixelSprite sprite={l.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: 28 }}>{l.icon}</span>}
                </span>
                <span style={{ ...NAME, color: l.color }}>{l.name}</span>
              </div>
            );
          })}
        </div>

        {seen !== null && items[seen] ? (
          <ItemPeek item={items[seen]} action={
            <button className="chip" disabled={full} onClick={() => { onTake(seen); setSeen(null); }}>{full ? "Bag full: drag to swap" : "Take"}</button>
          } />
        ) : (
          <div style={{ fontSize: 12, color: MUTED, textAlign: "center" }}>
            Tap to look · drag onto your bag to take{full ? " (your bag is full)" : ""}
          </div>
        )}

        {/* Your bag */}
        <div className="pixel-font" style={{ fontSize: 14, color: full ? "#ff8a80" : "#c9b48a" }}>🎒 {bagName} {bag.length}/{slots}</div>
        <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(slots, 5)}, 1fr)`, gap: 6, padding: 8 }}>
          {Array.from({ length: slots }, (_, i) => {
            const l = bag[i];
            const lifted = drag?.on && drag.kind === "bag" && drag.i === i;
            const hot = over === `bag:${i}`;
            return (
              <div key={i} data-drop={`bag:${i}`} className="inv-slot" title={l ? l.name : "Empty"}
                onPointerDown={l ? press({ kind: "bag", i }, l) : undefined} {...(l ? handlers : {})}
                style={{
                  position: "relative", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", cursor: l ? "grab" : "default",
                  ...(l ? { background: `radial-gradient(circle, ${l.glow ?? "rgba(255,255,255,0.05)"} 0%, rgba(0,0,0,0.35) 65%)` } : {}),
                  ...(hot || picked === i ? { borderColor: "#ffd66e", boxShadow: "0 0 12px rgba(255,214,110,0.55)" } : {}),
                  opacity: lifted ? 0.3 : 1,
                }}>
                {l && (l.sprite ? <PixelSprite sprite={l.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: 26 }}>{l.icon}</span>)}
                {l?.count && <StackCount n={l.count} />}
              </div>
            );
          })}
        </div>
        {picked !== null && bag[picked] && (() => {
          const put = <button className="chip" onClick={() => { onPutBack(picked); setPicked(null); }}>Put in the chest</button>;
          const l = bag[picked];
          return l.peek ? <ItemPeek item={l.peek} action={put} /> : (
            <div className="card-btn" style={{ cursor: "default", justifyContent: "space-between", gap: 8 }}>
              <b style={{ color: l.color, minWidth: 0 }}>{l.name}</b>{put}
            </div>
          );
        })()}

        <div className="dock-tabs">
          <button className="dock-tab" onClick={onTakeAll} disabled={items.length === 0}>Take all</button>
          <button className="dock-tab" data-active onClick={onClose}>Done</button>
        </div>
      </div>

      {/* What you're dragging, under your finger. */}
      {drag?.on && (
        <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 64, height: 64, pointerEvents: "none", zIndex: 300,
          transform: `translate(${drag.x - drag.ox - 32}px, ${drag.y - drag.oy - 44}px) scale(1.15)`, filter: "drop-shadow(0 6px 6px rgba(0,0,0,0.6))",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          {drag.sprite ? <PixelSprite sprite={drag.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: 32 }}>{drag.icon}</span>}
        </div>
      )}
    </div>
  );
}

// A closer look at one thing: what it is and its stats, with a button.
function ItemPeek({ item, action }: { item: SackItem; action: React.ReactNode }) {
  const l = lookOf(item);
  let kind = "", body: React.ReactNode = null;
  if ("potion" in item) { kind = "potion"; body = <>Heals one creature {POTIONS[item.potion].heal} HP</>; }
  else if ("gear" in item) {
    const g = item.gear as CreatureOrItemDrop;
    if (g.material || g.tool || g.schematic) {
      kind = g.material ? "material" : g.tool ? `${g.rarity} tool` : `${g.rarity} schematic`;
      body = <>{g.desc}</>;
    } else if (g.scroll) {
      kind = "xp scroll";
      body = <>{g.desc}</>;
    } else if (g.codexMove) {
      const m = MOVE_BY_NAME[g.codexMove];
      kind = `${g.rarity} codex`;
      body = m ? <>Teaches <b>{m.name}</b> · {m.self ? "utility" : moveKind(m)}<div style={{ color: MUTED, marginTop: 2 }}>{m.desc}</div></> : <>Teaches {g.codexMove}</>;
    } else {
      kind = `${g.rarity} ${g.itemCategory === "armor" && g.armorSlot ? ARMOR_SLOT_INFO[g.armorSlot].name.toLowerCase() : g.itemCategory ?? "item"}`;
      const stats = g.stats as Record<string, number> | undefined;
      // Every stat in a fixed box (0 where it has none), so flicking between
      // pieces of gear only changes the numbers: each defence sits under the
      // attack it guards, Agility and HP centred below. Each box is coloured
      // like that stat's bar in the Items tab.
      const label = Object.fromEntries(GEAR_STATS);
      body = (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {STAT_GRID.map(([k, col]) => {
            const v = stats?.[k] ?? 0;
            const c = getBarColor(v);
            return (
              <span key={k} style={{ gridColumn: `${col} / span 2`, display: "flex", flexDirection: "column", alignItems: "center", padding: "3px 0",
                background: v >= 30 ? `color-mix(in srgb, ${c} 18%, rgba(0,0,0,0.4))` : "rgba(0,0,0,0.35)", border: `2px solid ${v >= 30 ? c : "#3a3326"}` }}>
                <span style={{ fontSize: 11, color: MUTED }}>{label[k]}</span>
                <b style={{ fontSize: 15, fontVariantNumeric: "tabular-nums", color: v >= 30 ? c : v ? "white" : MUTED }}>{v}</b>
              </span>
            );
          })}
        </div>
      );
    }
  }
  return (
    <div className="stone-panel" style={{ padding: "8px 10px", display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <b style={{ color: l.color }}>{l.name}</b>
          {kind && <div style={{ fontSize: 11, color: MUTED, textTransform: "capitalize" }}>{kind}</div>}
        </div>
        {action}
      </div>
      {body && <div style={{ fontSize: 13 }}>{body}</div>}
    </div>
  );
}
