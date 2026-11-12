"use client";
// components/dungeon/Bag.tsx
// Your bag between rooms, as slots: tap or drag a thing to use it. Moved out of app/dungeon/page.tsx as it was.

import { useState } from "react";
import BagSlots, { slotLook } from "@/components/BagSlots";
import TeamDropRow from "@/components/TeamDropRow";
import { useDragDrop } from "@/hooks/useDragDrop";
import GearCompare, { GearStatLine } from "@/components/GearCompare";
import { type EquipSlot } from "@/hooks/useGameState";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { PotionIcon } from "@/components/PixelSprite";
import type { CreatureOrItemDrop } from "@/lib/types";
import { POTIONS, type PotionKey, isPotionEntry, lootIdOf, type BagEntry, type DungeonRun } from "@/lib/dungeon/run";
import { SectionTitle, MUTED, type OwnedCreature } from "@/components/BattleScreen";
import { TOOLS, isLocator } from "@/lib/items/materials";

const GOLD = "#f5c542";

// Between rooms: your battle bag as slots. Tap one for what you can do with it.
// tutorial: the entry to walk the player through equipping (Klutz's Club).
// sell: in a room where someone buys (buysHere), what they'd pay for each
// thing, and selling it. start: the slot to open with (from the merchant's Use).
export default function Bag({ run, bag, slots, name, itemOf, slotOf, byId, wornIn, onDrink, onEquip, onLeave, onTool, onRead, tutorial, sell, start }: {
  run: DungeonRun; bag: BagEntry[]; slots: number; name: string;
  itemOf: (e: BagEntry) => CreatureOrItemDrop | undefined; slotOf: (it: CreatureOrItemDrop) => EquipSlot | null;
  byId: (id: string) => OwnedCreature | undefined; onDrink: (k: PotionKey, id: string) => void;
  wornIn: (creatureId: string, slot: EquipSlot) => CreatureOrItemDrop | undefined; // what a creature wears in a slot
  onEquip: (e: BagEntry, creatureId: string) => void; onLeave: (e: BagEntry) => void; tutorial?: BagEntry;
  onTool?: (e: BagEntry, who?: string) => void; // a flare, a clairvoyance scroll, or a Revival Elixir (on who): use it
  onRead?: (e: BagEntry, who: string) => void;  // an XP scroll, read on who
  sell?: { offer: (e: BagEntry) => number; onSell: (bagIndex: number) => void };
  start?: number;
}) {
  const [sel, setSel] = useState<number | null>(start ?? null);
  const [comparing, setComparing] = useState(false);
  const standing = run.party.filter((id) => byId(id) && (run.hp[id] ?? 1) > 0);
  // Drag a weapon or armour piece onto one of your creatures to equip it.
  const wears = (i: number) => { const x = bag[i]; const w = x && !isPotionEntry(x) ? itemOf(x) : undefined; return !!w && !!slotOf(w); };
  // …or a potion onto a hurt one to heal it.
  const hurt = standing.filter((id) => (run.hp[id] ?? 1) < 1);
  const downed = run.party.filter((id) => byId(id) && (run.hp[id] ?? 1) <= 0); // (a Revival Elixir brings one back)
  const potionAt = (i: number) => { const x = bag[i]; return x && isPotionEntry(x) ? x : undefined; };
  // …an XP scroll onto anyone, or a Revival Elixir onto a knocked-out one.
  const usedOn = (i: number) => { const x = bag[i]; const w = x && !isPotionEntry(x) ? itemOf(x) : undefined;
    return w?.scroll && onRead ? "scroll" : w?.tool === "revival" && onTool ? "revival" : undefined; };
  // Who what's at i can go on.
  const goesOn = (i: number) => (wears(i) ? standing : potionAt(i) ? hurt : usedOn(i) === "revival" ? downed : usedOn(i) === "scroll" ? run.party : []);
  const { box: dragBox, ...dnd } = useDragDrop<number>({ onDrop: (i, t) => {
    const id = t?.startsWith("who:") ? t.slice(4) : undefined;
    const p = potionAt(i);
    if (!id || !goesOn(i).includes(id)) return;
    if (wears(i)) onEquip(bag[i], id);
    else if (p) onDrink(p, id);
    else if (usedOn(i) === "revival") onTool?.(bag[i], id);
    else onRead?.(bag[i], id);
    setSel(null);
  } });
  // Everyone in the party, with their HP (a downed one shows 0%).
  const party = run.party.flatMap((id) => { const c = byId(id); return c ? [{ id, name: c.name, creatureId: c.creatureId, hp: Math.max(0, run.hp[id] ?? 1) }] : []; });
  const e = sel !== null ? bag[sel] : undefined;
  const it = e && !isPotionEntry(e) ? itemOf(e) : undefined;
  const slot = it ? slotOf(it) : null;
  const tutorialAt = tutorial ? bag.indexOf(tutorial) : -1;
  const teaching = tutorialAt >= 0 && e === tutorial;
  const done = (fn: () => void) => () => { fn(); setSel(null); setComparing(false); };
  const chip = (key: string, label: string, onClick: () => void, extra: React.CSSProperties = {}, pulse = false) => (
    <button key={key} className={`chip${pulse ? " tutorial-pulse" : ""}`} style={{ padding: "5px 10px", ...extra }} onClick={onClick}>{label}</button>
  );
  const price = sell && e !== undefined ? sell.offer(e) : 0;
  const sellChip = sell && sel !== null && price > 0 ? chip("sell", `Sell 🪙 ${price}`, done(() => sell.onSell(sel)), { color: GOLD }) : null;

  return (
    <div ref={dragBox} style={{ position: "relative" }}>
      <SectionTitle>{name} ({bag.length}/{slots})</SectionTitle>
      {tutorialAt >= 0 && sel !== tutorialAt && (
        <div className="tutorial-tip" style={{ marginBottom: 8 }}>
          <span className="tutorial-arrow">👇</span> Drag <b>Klutz&apos;s Club</b> onto a creature, or tap it to see what you can do with it.
        </div>
      )}
      <BagSlots slots={slots} looks={bag.map((x) => slotLook(x, isPotionEntry(x) ? undefined : itemOf(x)))}
        grab={(i, l) => (wears(i) || potionAt(i) || usedOn(i) ? { onPointerDown: dnd.press(i, l), ...dnd.handlers } : {})}
        selected={sel} onSelect={(i) => { if (dnd.wasDrag()) return; setSel(i); setComparing(false); }} pulse={tutorialAt >= 0 && sel !== tutorialAt ? tutorialAt : undefined} />
      {/* Your creatures and their health: drag gear onto one to equip it, or a potion to heal it. */}
      {party.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <TeamDropRow team={party} over={dnd.over} pulse={tutorialAt >= 0}
            ready={dnd.lifted === undefined ? false : (c) => goesOn(dnd.lifted!).includes(c.id)} />
        </div>
      )}
      {bag.length === 0 && <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>Empty. Gold and creature cards take no space; gear, codexes, potions and materials take a slot each (materials stack).</p>}

      {e && (
        <div className="stone-panel" style={{ marginTop: 8, padding: "10px 12px" }}>
          {isPotionEntry(e) ? (
            <>
              <b><PotionIcon kind={e} />{POTIONS[e].name}</b> <span style={{ fontSize: 12, color: MUTED }}>restores {POTIONS[e].heal} HP to one creature</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {hurt.length === 0 && <span style={{ fontSize: 12, color: MUTED }}>Nobody needs it right now.</span>}
                {hurt.map((id) => chip(id, `Give ${byId(id)!.name}`, done(() => onDrink(e, id))))}
                {sellChip}
                {chip("leave", "Leave it here", done(() => onLeave(e)), { color: "#ff8a80" })}
              </div>
            </>
          ) : it ? (
            <>
              <b style={{ color: RARITY_COLORS[it.rarity].text }}>{it.name}</b>
              <span style={{ fontSize: 12, color: MUTED }}> · {it.rarity}{lootIdOf(e) ? " · found this run" : " · yours"}</span>
              {slot && <GearStatLine item={it} />}
              {it.tool && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{TOOLS[it.tool].desc}</div>}
              {teaching && (
                <div className="tutorial-tip" style={{ margin: "8px 0 0" }}>
                  <span className="tutorial-arrow">👇</span> Now choose who carries it. Gear you find down here works the same way: tap it in your bag, then equip it.
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {slot && standing.map((id) => chip(id, `Equip on ${byId(id)!.name}`, done(() => onEquip(e, id)), {}, teaching))}
                {it.tool && it.tool !== "revival" && it.tool !== "gold_key" && onTool && chip("use", it.tool === "flare" ? "🧨 Light it" : isLocator(it.tool) ? `${TOOLS[it.tool].icon} Use it` : "🔮 Read it", done(() => onTool(e)))}
                {it.tool === "revival" && onTool && downed.map((id) => chip(id, `💖 Revive ${byId(id)!.name}`, done(() => onTool(e, id))))}
                {it.tool === "revival" && downed.length === 0 && <span style={{ fontSize: 12, color: MUTED }}>Nobody&apos;s knocked out.</span>}
                {it.scroll && onRead && run.party.filter((id) => byId(id)).map((id) => chip(id, `📜 Read on ${byId(id)!.name}`, done(() => onRead(e, id))))}
                {slot && !teaching && !comparing && chip("compare", "⚖️ Compare", () => setComparing(true))}
                {!teaching && sellChip}
                {!teaching && chip("leave", "Leave it here", done(() => onLeave(e)), { color: "#ff8a80" })}
              </div>
              {slot && comparing && (
                <GearCompare item={it} slotName={slot}
                  creatures={run.party.flatMap((id) => { const c = byId(id); return c ? [{ id, name: c.name, creatureId: c.creatureId, worn: wornIn(id, slot) }] : []; })}
                  onEquip={(id) => { if ((run.hp[id] ?? 1) > 0) done(() => onEquip(e, id))(); }}
                  onClose={() => setComparing(false)} />
              )}
            </>
          ) : (
            <span style={{ color: MUTED }}>Something you no longer have.</span>
          )}
        </div>
      )}
      {dnd.ghost}
    </div>
  );
}
