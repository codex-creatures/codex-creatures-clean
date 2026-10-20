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
// - Drag a weapon or armour piece from your bag onto one of your creatures
//   (the row under the bag, with each one's HP %) to equip it, or tap it and
//   pick who. A potion goes on a hurt creature the same way, to heal it.
// - A potion in the chest can go straight onto a hurt creature too (drag it,
//   or tap it and Give): no need to make room in your bag for it first.
// - teach: Klutz's Club, the first loot you pick up, walks you through
//   all of this (take it, then equip it).
// Take all grabs what takes no room, then the rarest things first, and says
// so if your bag fills up before the chest is empty.
// Gold, the backpack and creature cards take no room. Whatever's left in the
// chest stays on the floor when you move on.

import { useState } from "react";
import { useEscape } from "@/hooks/useEscape";
import { useDragDrop } from "@/hooks/useDragDrop";
import PixelSprite from "./PixelSprite";
import TeamDropRow, { type TeamMember } from "./TeamDropRow";
import { ICON, NAME, lookOf } from "./ContainerLoot";
import { StackCount, type SlotLook } from "./BagSlots";
import { POTIONS, type SackItem } from "@/lib/dungeon/run";
import { GEAR_STATS } from "./GearCompare";
import { getBarColor } from "./ItemDetailModal";
import { ARMOR_SLOT_INFO } from "@/lib/items/armor";
import CodexMove from "./CodexMove";
import { MOVE_BY_NAME, RACE_INFO } from "@/lib/creatures/creatureData";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Sprite } from "@/lib/sprites/pixels";

const MUTED = "rgba(255,255,255,0.55)";
// The gear stats in two rows of four: each defence under the attack it guards.
const STAT_GRID = ["melee", "ranged", "magic", "agility", "mDef", "rDef", "magDef", "hp"];
type From = { kind: "loot" | "bag"; i: number };
// The club tutorial's step: take it (item i of the loot), equip it (bag slot i), or done.
export type LootTeach = { step: "take" | "equip" | "done"; i: number };
// Can it go on a creature? (a weapon, or an armour piece)
export const wearable = (l?: SlotLook) => {
  const g = l?.peek && "gear" in l.peek ? (l.peek.gear as CreatureOrItemDrop) : undefined;
  return !!g && (g.itemCategory === "weapon" || (g.itemCategory === "armor" && !!g.armorSlot));
};
// Is it a potion? (in the bag a potion is just its kind: see slotLook)
const potionOf = (l?: SlotLook) => (l?.peek && "potion" in l.peek ? l.peek.potion : undefined);
// Is this thing in the chest a potion? (loose, or one found as an item)
const sackPotion = (x?: SackItem) => (!x ? undefined : "potion" in x ? x.potion : "gear" in x ? (x.gear as CreatureOrItemDrop).potion : undefined);
// Can a potion help them? (not at full health)
const hurt = (c: TeamMember) => (c.hp ?? 0) < 1;

export default function LootWindow({ name, sprite, items, bag, slots, bagName, onTake, onTakeAll, onSwap, onPutBack, onClose, party = [], onEquip, onDrink, onDrinkLoot, teach, putLabel = "Put in the chest" }: {
  name: string; sprite: Sprite;
  items: SackItem[];
  bag: SlotLook[];          // what's in each filled slot, in order
  slots: number; bagName: string;
  onTake: (lootIndex: number) => void;
  onTakeAll: () => void;
  onSwap: (lootIndex: number, bagIndex: number) => void; // into that slot (swapping if it's full)
  onPutBack: (bagIndex: number) => void;                 // from the bag into the chest
  onClose: () => void;
  party?: TeamMember[];                                  // your creatures still standing: drop gear on them
  onEquip?: (bagIndex: number, creatureId: string) => void; // (asks first: see EquipPreview)
  onDrink?: (bagIndex: number, creatureId: string) => void; // a potion from the bag, on a hurt creature
  onDrinkLoot?: (lootIndex: number, creatureId: string) => void; // a potion straight from the chest (no bag slot needed)
  teach?: LootTeach;
  putLabel?: string;                                     // "Put in the chest", "Drop it"…
}) {
  const full = bag.length >= slots;
  const [picked, setPicked] = useState<number | null>(null); // a bag slot tapped (to see it, or put it back)
  const [seen, setSeen] = useState<number | null>(null);     // a loot item tapped (to see it before taking it)
  const [was, setWas] = useState(items); // things moved: the indexes are stale
  const [triedAll, setTriedAll] = useState(false); // Take all was tapped (and nothing else since)
  // Take all left things behind for want of room: say so.
  const noRoom = triedAll && full && items.some((x) => !lookOf(x).free);
  // Esc puts away a closer look first, then closes the window.
  useEscape(() => (seen !== null ? setSeen(null) : picked !== null ? setPicked(null) : onClose()));
  if (was !== items && (was.length || items.length)) { setWas(items); setSeen(null); setPicked(null); } // (a fresh [] each render is no change)

  const { box: dragBox, ...dnd } = useDragDrop<From>({
    onTap: (d) => {
      setTriedAll(false);
      if (d.kind === "loot") {
        if (lookOf(items[d.i]).free) onTake(d.i);
        else { setSeen((s) => (s === d.i ? null : d.i)); setPicked(null); }
      } else { setPicked((p) => (p === d.i ? null : d.i)); setSeen(null); }
    },
    onDrop: (d, t) => {
      setTriedAll(false);
      if (d.kind === "loot" && t?.startsWith("bag:")) onSwap(d.i, Number(t.slice(4)));
      else if (d.kind === "loot" && t?.startsWith("who:") && onDrinkLoot && sackPotion(items[d.i])) {
        const c = party.find((m) => m.id === t.slice(4));
        if (c && hurt(c)) { onDrinkLoot(d.i, c.id); setSeen(null); }
      }
      else if (d.kind === "bag" && t === "loot") { onPutBack(d.i); setPicked(null); }
      else if (d.kind === "bag" && t?.startsWith("who:") && onEquip && wearable(bag[d.i])) { onEquip(d.i, t.slice(4)); setPicked(null); }
      else if (d.kind === "bag" && t?.startsWith("who:") && onDrink && potionOf(bag[d.i])) {
        const c = party.find((m) => m.id === t.slice(4));
        if (c && hurt(c)) { onDrink(d.i, c.id); setPicked(null); }
      }
    },
  });
  const { over, press, handlers } = dnd;
  const lifted = (kind: From["kind"], i: number) => dnd.lifted?.kind === kind && dnd.lifted.i === i;

  const glowBg = (glow?: string) => `radial-gradient(circle, ${glow ?? "rgba(255,255,255,0.05)"} 0%, transparent 62%)`;

  return (
    <div ref={dragBox} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 190, background: "rgba(4,5,9,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}>
      <div role="dialog" aria-label={name} onClick={(e) => e.stopPropagation()} className="title-bar sheet-up"
        style={{ width: "100%", maxHeight: "97cqh", overflowY: "auto", overflowX: "hidden", padding: 10, display: "grid", gap: 8, userSelect: "none", WebkitUserSelect: "none" }}>
        {/* The chest */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PixelSprite sprite={sprite} scale={1.8} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
          <div className="pixel-font" style={{ fontSize: 21, color: "#f1d9a0", flex: 1 }}>{name}</div>
          <button className="chip" aria-label="Close" onClick={onClose} style={{ minHeight: 44, padding: "2px 14px" }}>✕</button>
        </div>
        {teach && (
          <div className="tutorial-tip" style={{ fontSize: 13 }}>
            {teach.step === "take" ? <><b>Looting.</b> Drag Klutz&apos;s Club down into your bag, or tap it, then Take. <span className="tutorial-arrow">👇</span></>
              : teach.step === "equip" ? <><b>Equipping.</b> Now drag it from your bag onto a creature, or tap it and pick who. <span className="tutorial-arrow">👇</span></>
              : <><b>That&apos;s it.</b> Gear you find down here works the same way. Tap Done.</>}
          </div>
        )}
        <div data-drop="loot" className="inv-panel"
          style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, minHeight: 72, outline: over === "loot" ? "2px solid #ffd66e" : undefined }}>
          {items.length === 0 && <div style={{ gridColumn: "1 / -1", alignSelf: "center", textAlign: "center", fontSize: 13, color: MUTED }}>Empty</div>}
          {items.map((x, i) => {
            const l = lookOf(x);
            const blocked = full && !l.free;
            const up = lifted("loot", i);
            return (
              <div key={i} onPointerDown={press({ kind: "loot", i }, l)} {...handlers} title={l.name}
                className={teach?.step === "take" && teach.i === i && !up ? "tutorial-pulse" : undefined}
                style={{ minWidth: 0, cursor: "grab", touchAction: "none", opacity: up ? 0.3 : blocked ? 0.75 : 1 }}>
                <span style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: glowBg(l.glow),
                  ...(seen === i ? { outline: "2px solid #ffd66e", boxShadow: "0 0 12px rgba(255,214,110,0.55)" } : {}) }}>
                  {l.sprite ? <PixelSprite sprite={l.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: 28 }}>{l.icon}</span>}
                </span>
                <span style={{ ...NAME, fontSize: 13, color: l.color }}>{l.name}</span>
              </div>
            );
          })}
        </div>

        {/* Under the chest: the hint, with Take all at the right (it stays put while you look at things). */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: noRoom ? "#ff8a80" : MUTED }}>
            {noRoom ? `Your ${bagName.toLowerCase()} is full` : `Tap to look · drag onto your bag to take${full ? " (your bag is full)" : ""}`}
          </div>
          <button className="dock-tab" style={{ flex: "none", minHeight: 44, padding: "4px 12px" }} onClick={() => { onTakeAll(); setTriedAll(true); }} disabled={items.length === 0}>Take all</button>
        </div>
        {seen !== null && items[seen] && (
          <ItemPeek item={items[seen]} action={
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {onDrinkLoot && sackPotion(items[seen]) && party.filter(hurt).map((c) => (
                <button key={c.id} className="chip" onClick={() => { onDrinkLoot(seen, c.id); setSeen(null); }}>Give {c.name}</button>
              ))}
              <button className={`chip${teach?.step === "take" && teach.i === seen && !full ? " tutorial-pulse" : ""}`} disabled={full} onClick={() => { onTake(seen); setSeen(null); }}>{full ? "Bag full: drag to swap" : "Take"}</button>
            </span>
          } />
        )}

        {/* Your bag */}
        <div className="pixel-font" style={{ fontSize: 17, color: full ? "#ff8a80" : "#c9b48a" }}>🎒 {bagName} {bag.length}/{slots}</div>
        <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(slots, 5)}, 1fr)`, gap: 6, padding: 8 }}>
          {Array.from({ length: slots }, (_, i) => {
            const l = bag[i];
            const up = lifted("bag", i);
            const hot = over === `bag:${i}`;
            return (
              <div key={i} data-drop={`bag:${i}`} className="inv-slot" title={l ? l.name : "Empty"}
                onPointerDown={l ? press({ kind: "bag", i }, l) : undefined} {...(l ? handlers : {})}
                style={{
                  position: "relative", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", cursor: l ? "grab" : "default",
                  ...(l ? { background: `radial-gradient(circle, ${l.glow ?? "rgba(255,255,255,0.05)"} 0%, rgba(0,0,0,0.35) 65%)` } : {}),
                  ...(hot || picked === i ? { borderColor: "#ffd66e", boxShadow: "0 0 12px rgba(255,214,110,0.55)" } : {}),
                  ...(teach?.step === "equip" && teach.i === i && picked !== i && !up ? { animation: "tutorial-pulse 1s ease-in-out infinite" } : {}),
                  opacity: up ? 0.3 : 1,
                }}>
                {l && (l.sprite ? <PixelSprite sprite={l.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: 26 }}>{l.icon}</span>)}
                {l?.count && <StackCount n={l.count} />}
              </div>
            );
          })}
        </div>
        {picked !== null && bag[picked] && (() => {
          const l = bag[picked];
          const teaching = teach?.step === "equip" && teach.i === picked;
          const put = (
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {onEquip && wearable(l) && party.map((c) => (
                <button key={c.id} className={`chip${teaching ? " tutorial-pulse" : ""}`} onClick={() => { onEquip(picked, c.id); setPicked(null); }}>Equip on {c.name}</button>
              ))}
              {onDrink && potionOf(l) && party.filter(hurt).map((c) => (
                <button key={c.id} className="chip" onClick={() => { onDrink(picked, c.id); setPicked(null); }}>Give {c.name}</button>
              ))}
              {!teaching && <button className="chip" onClick={() => { onPutBack(picked); setPicked(null); }}>{putLabel}</button>}
            </span>
          );
          return l.peek ? <ItemPeek item={l.peek} action={put} /> : (
            <div className="card-btn" style={{ cursor: "default", justifyContent: "space-between", gap: 8 }}>
              <b style={{ color: l.color, minWidth: 0 }}>{l.name}</b>{put}
            </div>
          );
        })()}

        {/* Your creatures: drop a weapon or armour piece on one to equip it, or a potion to heal it. */}
        {(onEquip || onDrink || onDrinkLoot) && (
          <TeamDropRow team={party} over={over} pulse={teach?.step === "equip"}
            ready={dnd.lifted?.kind === "loot" ? !!onDrinkLoot && !!sackPotion(items[dnd.lifted.i]) && hurt
              : dnd.lifted?.kind !== "bag" ? false : wearable(bag[dnd.lifted.i]) || (!!onDrink && !!potionOf(bag[dnd.lifted.i]) && hurt)} />
        )}

        <div className="dock-tabs">
          <button className={`dock-tab${teach?.step === "done" ? " tutorial-pulse" : ""}`} data-active onClick={onClose}>Done</button>
        </div>
      </div>

      {/* What you're dragging, under your finger. */}
      {dnd.ghost}
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
    // Only weapons and armour have stats: a potion found as an item (left on a
    // floor, say) says what it heals.
    if (g.potion) { kind = "potion"; body = <>Heals one creature {POTIONS[g.potion].heal} HP</>; }
    else if (g.material || g.tool || g.schematic) {
      kind = g.material ? "material" : g.tool ? `${g.rarity} tool` : `${g.rarity} schematic`;
      body = <>{g.desc}</>;
    } else if (g.scroll) {
      kind = "xp scroll";
      body = <>{g.desc}</>;
    } else if (g.codexMove) {
      const race = MOVE_BY_NAME[g.codexMove]?.race;
      kind = `${g.rarity} ${race ? `${RACE_INFO[race].name} ` : ""}codex`;
      body = <CodexMove move={g.codexMove} />;
    } else {
      kind = `${g.rarity} ${g.itemCategory === "armor" && g.armorSlot ? ARMOR_SLOT_INFO[g.armorSlot].name.toLowerCase() : g.itemCategory ?? "item"}`;
      const stats = g.stats as Record<string, number> | undefined;
      // Every stat in a fixed box (0 where it has none), so flicking between
      // pieces of gear only changes the numbers: each defence sits under the
      // attack it guards (Agility, then HP, at the ends). Each box is coloured
      // like that stat's bar in the Items tab.
      const label = Object.fromEntries(GEAR_STATS);
      body = (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
          {STAT_GRID.map((k) => {
            const v = stats?.[k] ?? 0;
            const c = getBarColor(v);
            return (
              <span key={k} style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "1px 0",
                background: v >= 30 ? `color-mix(in srgb, ${c} 18%, rgba(0,0,0,0.4))` : "rgba(0,0,0,0.35)", border: `2px solid ${v >= 30 ? c : "#3a3326"}` }}>
                <span style={{ fontSize: 12, color: MUTED }}>{label[k]}</span>
                <b style={{ fontSize: 16, fontVariantNumeric: "tabular-nums", color: v >= 30 ? c : v ? "white" : MUTED }}>{v}</b>
              </span>
            );
          })}
        </div>
      );
    }
  }
  return (
    <div className="stone-panel" style={{ padding: "8px 10px", display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <b style={{ color: l.color, fontSize: 17 }}>{l.name}</b>
          {kind && <div style={{ fontSize: 13, color: MUTED, textTransform: "capitalize" }}>{kind}</div>}
        </div>
        {action}
      </div>
      {body && <div style={{ fontSize: 15 }}>{body}</div>}
    </div>
  );
}
