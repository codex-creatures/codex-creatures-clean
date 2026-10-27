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
// - So can gear (if there's room in your bag: it's taken, then equipped).
// - teach: Klutz's Club, the first loot you pick up, walks you through
//   all of this (take it, then equip it).
// Take all grabs what takes no room, then the rarest things first, and says
// so if your bag fills up before the chest is empty.
// Gold, the backpack and creature cards take no room. Whatever's left in the
// chest stays on the floor when you move on.

import { useState } from "react";
import { useEscape } from "@/hooks/useEscape";
import { useDragDrop } from "@/hooks/useDragDrop";
import { doubleTapper } from "@/lib/doubleTap";
import PixelSprite from "./PixelSprite";
import TeamDropRow, { type TeamMember } from "./TeamDropRow";
import { ICON, NAME, lookOf } from "./ContainerLoot";
import { StackCount, type SlotLook } from "./BagSlots";
import { POTIONS, type SackItem } from "@/lib/dungeon/run";
import { GEAR_STATS } from "./GearCompare";
import { getBarColor } from "./ItemDetailModal";
import { ARMOR_SLOT_INFO } from "@/lib/items/armor";
import CodexMove from "./CodexMove";
import { codexLearners } from "@/lib/creatures/creatureData";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Sprite } from "@/lib/sprites/pixels";

const MUTED = "rgba(255,255,255,0.55)";
// The gear stats in two rows of four: each defence under the attack it guards.
const STAT_GRID = ["melee", "ranged", "magic", "agility", "mDef", "rDef", "magDef", "hp"];
type From = { kind: "loot" | "bag"; i: number };
// The club tutorial's step: take it (item i of the loot), equip it (bag slot i), or done.
export type LootTeach = { step: "take" | "equip" | "done"; i: number };
// Can it go on a creature? (a weapon, or an armour piece)
const wearableItem = (x?: SackItem) => {
  const g = x && "gear" in x ? (x.gear as CreatureOrItemDrop) : undefined;
  return !!g && (g.itemCategory === "weapon" || (g.itemCategory === "armor" && !!g.armorSlot));
};
export const wearable = (l?: SlotLook) => wearableItem(l?.peek);
// Is it a potion? (in the bag a potion is just its kind: see slotLook)
const potionOf = (l?: SlotLook) => (l?.peek && "potion" in l.peek ? l.peek.potion : undefined);
// Is this thing in the chest a potion? (loose, or one found as an item)
const sackPotion = (x?: SackItem) => (!x ? undefined : "potion" in x ? x.potion : "gear" in x ? (x.gear as CreatureOrItemDrop).potion : undefined);
// Can a potion help them? (not at full health)
const hurt = (c: TeamMember) => (c.hp ?? 0) < 1;

export default function LootWindow({ name, sprite, items, bag, slots, bagName, onTake, onTakeAll, onSwap, onPutBack, onClose, party = [], onEquip, onDrink, onDrinkLoot, onEquipLoot, teach, putLabel = "Put in the chest" }: {
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
  onEquipLoot?: (lootIndex: number, creatureId: string) => void; // gear straight from the chest (into the bag, then asks)
  teach?: LootTeach;
  putLabel?: string;                                     // "Put in the chest", "Drop it"…
}) {
  const full = bag.length >= slots;
  const [picked, setPicked] = useState<number | null>(null); // a bag slot tapped (to see it, or put it back)
  const [seen, setSeen] = useState<number | null>(null);     // a loot item tapped (to see it before taking it)
  const [was, setWas] = useState(items); // things moved: the indexes are stale
  const [triedAll, setTriedAll] = useState(false); // Take all was tapped (and nothing else since)
  // The chest's rows of 5: as many as it opened with (or has grown to), never
  // fewer, so taking things never pulls everything below it up.
  const [openRows] = useState(() => Math.max(1, Math.ceil(items.length / 5)));
  const cells = Math.max(openRows, Math.ceil(items.length / 5)) * 5;
  // Take all left things behind for want of room: say so.
  const noRoom = triedAll && full && items.some((x) => !lookOf(x).free);
  // Esc puts away a closer look first, then closes the window.
  useEscape(() => (seen !== null ? setSeen(null) : picked !== null ? setPicked(null) : onClose()));
  if (was !== items && (was.length || items.length)) { setWas(items); setSeen(null); setPicked(null); } // (a fresh [] each render is no change)

  const [doubleTap] = useState(doubleTapper); // a quick second tap on loot takes it
  const { box: dragBox, ...dnd } = useDragDrop<From>({
    onTap: (d) => {
      setTriedAll(false);
      if (d.kind === "loot") {
        if (lookOf(items[d.i]).free) onTake(d.i);
        else if (doubleTap(`loot:${d.i}`) && !full) { onTake(d.i); setSeen(null); }
        else { setSeen((s) => (s === d.i ? null : d.i)); setPicked(null); }
      } else { setPicked((p) => (p === d.i ? null : d.i)); setSeen(null); }
    },
    onDrop: (d, t) => {
      setTriedAll(false);
      if (d.kind === "loot" && t?.startsWith("bag:")) onSwap(d.i, Number(t.slice(4)));
      else if (d.kind === "loot" && t?.startsWith("who:") && onEquipLoot && !full && wearableItem(items[d.i])) { onEquipLoot(d.i, t.slice(4)); setSeen(null); }
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
            {teach.step === "take" ? <><b>Looting.</b> Drag Klutz&apos;s Club onto a creature, or into your bag. <span className="tutorial-arrow">👇</span></>
              : teach.step === "equip" ? <><b>Equipping.</b> Now drag it from your bag onto a creature, or tap it and pick who. <span className="tutorial-arrow">👇</span></>
              : <><b>That&apos;s it.</b> Gear you find down here works the same way. Tap Done.</>}
          </div>
        )}
        <div data-drop="loot" className="inv-panel"
          style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, outline: over === "loot" ? "2px solid #ffd66e" : undefined }}>
          {items.length === 0 && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: MUTED }}>Empty</div>}
          {Array.from({ length: cells - items.length }, (_, k) => (
            // Empty places keep the grid's shape (shown after the things in it).
            <div key={`empty${k}`} aria-hidden style={{ order: 1, visibility: "hidden" }}>
              <span style={{ display: "block", aspectRatio: "1" }} /><span style={{ ...NAME, fontSize: 13 }}>-</span>
            </div>
          ))}
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
            {noRoom ? `Your ${bagName.toLowerCase()} is full` : `Tap to look · double-tap or drag to take${full ? " (your bag is full)" : ""}`}
          </div>
          <button className="dock-tab" style={{ flex: "none", minHeight: 44, padding: "4px 12px" }} onClick={() => { onTakeAll(); setTriedAll(true); }} disabled={items.length === 0}>Take all</button>
        </div>
        {/* A closer look: one fixed box for whatever you tapped in the chest or
            in your bag. Nothing tapped: no box (the hint above says to tap), so it all fits. */}
        {seen !== null && items[seen] ? (
          <ItemPeek item={items[seen]} action={<>
            {onDrinkLoot && sackPotion(items[seen]) && party.filter(hurt).map((c) => (
              <button key={c.id} className="chip" onClick={() => { onDrinkLoot(seen, c.id); setSeen(null); }}>Give {c.name}</button>
            ))}
            <button className={`chip${teach?.step === "take" && teach.i === seen && !full ? " tutorial-pulse" : ""}`} disabled={full} onClick={() => { onTake(seen); setSeen(null); }}>{full ? "Bag full: drag to swap" : "Take"}</button>
          </>} />
        ) : picked !== null && bag[picked] ? (() => {
          const l = bag[picked];
          const teaching = teach?.step === "equip" && teach.i === picked;
          return (
            <ItemPeek item={l.peek} look={l} action={<>
              {onEquip && wearable(l) && party.map((c) => (
                <button key={c.id} className={`chip${teaching ? " tutorial-pulse" : ""}`} onClick={() => { onEquip(picked, c.id); setPicked(null); }}>Equip on {c.name}</button>
              ))}
              {onDrink && potionOf(l) && party.filter(hurt).map((c) => (
                <button key={c.id} className="chip" onClick={() => { onDrink(picked, c.id); setPicked(null); }}>Give {c.name}</button>
              ))}
              {!teaching && <button className="chip" onClick={() => { onPutBack(picked); setPicked(null); }}>{putLabel}</button>}
            </>} />
          );
        })() : null}

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
        {/* Your creatures: drop a weapon or armour piece on one to equip it, or a potion to heal it. */}
        {(onEquip || onDrink || onDrinkLoot) && (
          <TeamDropRow team={party} over={over} pulse={teach?.step === "equip"}
            ready={dnd.lifted?.kind === "loot" ? (!!onEquipLoot && !full && wearableItem(items[dnd.lifted.i])) || (!!onDrinkLoot && !!sackPotion(items[dnd.lifted.i]) && hurt)
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

// A closer look at one thing: what it is and its stats, with its buttons.
// A fixed frame (PEEK_BODY tall), whatever it shows: a name line and a kind
// line, beside one row of buttons (it scrolls sideways if there are many);
// then the body, cut to fit.
const PEEK_BODY = 84;
const textBody = (t?: string) => <div style={{ fontSize: 14, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={t}>{t}</div>;
function ItemPeek({ item, look, action }: { item?: SackItem; look?: SlotLook; action?: React.ReactNode }) {
  const l = look ?? lookOf(item!);
  let kind = "", body: React.ReactNode = null;
  if (!item) { /* (just its name: a bag slot with no closer look) */ }
  else if ("potion" in item) { kind = "potion"; body = textBody(`Heals one creature ${POTIONS[item.potion].heal} HP`); }
  else if ("gear" in item) {
    const g = item.gear as CreatureOrItemDrop;
    // Only weapons and armour have stats: a potion found as an item (left on a
    // floor, say) says what it heals.
    if (g.potion) { kind = "potion"; body = textBody(`Heals one creature ${POTIONS[g.potion].heal} HP`); }
    else if (g.material || g.tool || g.schematic) {
      kind = g.material ? "material" : g.tool ? `${g.rarity} tool` : `${g.rarity} schematic`;
      body = textBody(g.desc);
    } else if (g.stone) {
      kind = "soul stone";
      body = textBody(g.desc);
    } else if (g.scroll) {
      kind = "xp scroll";
      body = textBody(g.desc);
    } else if (g.codexMove) {
      kind = `${g.rarity} codex · ${codexLearners(g.codexMove).text}`;
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
    <div className="stone-panel" style={{ padding: "8px 10px", display: "grid", gridTemplateRows: `44px ${PEEK_BODY}px`, gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
          <div title={l.name} style={{ color: l.color, fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</div>
          <div title={kind} style={{ fontSize: 13, color: MUTED, textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kind || "-"}</div>
        </div>
        <div style={{ display: "flex", gap: 6, maxWidth: "62%", overflowX: "auto", flexShrink: 0, whiteSpace: "nowrap" }}>{action}</div>
      </div>
      <div style={{ fontSize: 15, minHeight: 0, overflow: "hidden" }}>{body}</div>
    </div>
  );
}
