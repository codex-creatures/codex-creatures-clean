"use client";
// components/AscendRitual.tsx
// The Soul Altar's ascension (lib/creatures/ascend.ts; the user, 2026-11-18):
// the creature to raise goes in the big slot at the top, the ones to give up
// in the 4 (first step) or 2 (each after) slots under it. Tap a creature to
// send it to the next free slot, or hold it and drag it onto one; tap a slot
// to empty it. Once a creature's in the top slot, only its own kind is listed.
// Between them: its stats now and after (and at Lv 30), so you see what rises.
// Fixed structure: the slots, the stat boxes and the list stay put; only
// what's in them changes.

import { useEffect, useMemo, useRef, useState } from "react";
import type { CreatureOrItemDrop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { findCreatureTemplate, type CreatureProficiency } from "@/lib/creatures/creatureData";
import { clampLevel, hpAt, MAX_LEVEL, proficiencyAt } from "@/lib/creatures/levels";
import { giveProblem, keepProblem, lossesOf, othersNeeded, ritualProblem, rarityOfCreature, stepsOfCreature, ASCEND_AFTER, ASCEND_FIRST, ASCEND_MIN_LEVEL } from "@/lib/creatures/ascend";
import { rarityAfter } from "@/lib/creatures/ascendStats";
import { SOUL_STONES, type SoulStoneKey } from "@/lib/creatures/soulStones";
import { CreatureArt } from "./CreaturePortrait";
import { STATS } from "./CreatureDetailModal";
import SummonShow from "./SummonShow";
import Glyph from "./Glyph";

const MUTED = "rgba(255,255,255,0.55)";
const GOLD = "#f1d9a0";
const SLOTS = ASCEND_FIRST - 1; // the most slots below (the first step's)
const HOLD_MS = 260;            // hold a creature this long to pick it up and drag it

// A creature's ascension mark: a star per rarity climbed.
export const stars = (c: CreatureOrItemDrop) => "★".repeat(stepsOfCreature(c));

type Game = {
  inventory: CreatureOrItemDrop[] | unknown[];
  ascendCreature: (keptId: string, otherIds: string[]) => CreatureOrItemDrop | null;
  ascendAway: () => Set<string>;
  ascendBusy: () => Set<string>;
};

export default function AscendRitual({ game }: { game: Game }) {
  const creatures = useMemo(() => (game.inventory as CreatureOrItemDrop[]).filter((d) => d.dropType === "creature"), [game.inventory]);
  const byId = useMemo(() => new Map(creatures.map((c) => [c.id, c])), [creatures]);
  // (Read with the inventory: a run or the pit can change between visits.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const away = useMemo(() => game.ascendAway(), [creatures]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const busy = useMemo(() => game.ascendBusy(), [creatures]);

  const [keptId, setKeptId] = useState<string | null>(null);
  const [given, setGiven] = useState<(string | null)[]>(Array(SLOTS).fill(null));
  const [confirming, setConfirming] = useState(false);
  const [show, setShow] = useState<{ used: CreatureOrItemDrop[]; result: CreatureOrItemDrop } | null>(null);

  const kept = keptId ? byId.get(keptId) : undefined;
  const need = kept ? othersNeeded(kept) : SLOTS;
  const others = given.slice(0, need).flatMap((id) => (id && byId.get(id) ? [byId.get(id)!] : []));
  const problem = kept ? ritualProblem(kept, others, away, busy) : "Pick a creature";

  // A creature gone (given up elsewhere, or sold): out of its slot.
  useEffect(() => {
    if (keptId && !byId.has(keptId)) setKeptId(null);
    setGiven((g) => (g.some((id) => id && !byId.has(id)) ? g.map((id) => (id && byId.has(id) ? id : null)) : g));
  }, [byId, keptId]);

  // Why one can't go where it would go next (null: it can).
  const reasonFor = (c: CreatureOrItemDrop) => (kept ? (c.id === kept.id ? null : giveProblem(kept, c, busy)) : keepProblem(c, away));

  // Put a creature in a slot: "kept", or a slot below (index).
  function place(id: string, slot: "kept" | number) {
    const c = byId.get(id);
    if (!c) return;
    if (slot === "kept") {
      if (keepProblem(c, away)) return;
      // A new kind up top: the slots below empty (they'd no longer fit).
      const fits = (o: string | null) => o && o !== id && byId.get(o) && !giveProblem(c, byId.get(o)!, busy);
      setGiven((g) => g.map((o) => (fits(o) ? o : null)));
      setKeptId(id);
      return;
    }
    if (!kept || slot >= need || giveProblem(kept, c, busy)) return;
    setGiven((g) => g.map((o, i) => (i === slot ? id : o === id ? null : o)));
  }
  // A tap: the top slot if it's empty, else the next free slot below; again, and it comes out.
  function tapCreature(id: string) {
    if (id === keptId) return clearAll();
    const at = given.indexOf(id);
    if (at >= 0) return setGiven((g) => g.map((o, i) => (i === at ? null : o)));
    if (!kept) return place(id, "kept");
    const free = given.slice(0, need).indexOf(null);
    if (free >= 0) place(id, free);
  }
  function clearAll() {
    setKeptId(null);
    setGiven(Array(SLOTS).fill(null));
  }

  function perform() {
    if (!kept || problem) return;
    const used = [kept, ...others];
    const result = game.ascendCreature(kept.id, others.map((o) => o.id));
    setConfirming(false);
    if (!result) return;
    setGiven(Array(SLOTS).fill(null));
    setShow({ used, result });
  }

  // Dragging: hold a creature, then move it onto a slot.
  const drag = useDrag((id, slot) => place(id, slot));

  // The list: before a pick, everyone (those that can be raised first); after, its own kind.
  const listed = useMemo(() => {
    const pool = kept ? creatures.filter((c) => c.creatureId === kept.creatureId) : creatures;
    const rank = (c: CreatureOrItemDrop) => (reasonFor(c) ? 1 : 0);
    return [...pool].sort((a, b) => rank(a) - rank(b) || RANK.indexOf(rarityOfCreature(b)) - RANK.indexOf(rarityOfCreature(a)) || a.name.localeCompare(b.name) || clampLevel(b.level) - clampLevel(a.level));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatures, kept, busy, away]);

  if (show) {
    const t = findCreatureTemplate(show.result.creatureId, show.result.name)!;
    return <SummonShow t={t} cards={show.used} result={show.result} onDone={() => setShow(null)}
      words={{ laying: "The creatures gather…", stirring: "Their souls stir…", done: `${show.result.name} ascends!` }} />;
  }

  const losses = lossesOf(others);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%", minHeight: 0 }}>
      {/* The top slot and what it'll become. */}
      <div style={{ display: "grid", gridTemplateColumns: "clamp(84px, 26cqw, 120px) 1fr", gap: 10, alignItems: "stretch" }}>
        <Slot c={kept} slot="kept" big onTap={clearAll} hint="Raise" drag={drag} />
        <Preview kept={kept} />
      </div>

      {/* The slots below: 4 for the first step, 2 after (the rest keep their room). */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${SLOTS}, minmax(0, 1fr))`, gap: 8 }}>
        {given.map((id, i) => (
          <div key={i} style={{ visibility: i < need ? "visible" : "hidden" }}>
            <Slot c={id ? byId.get(id) : undefined} slot={i} onTap={() => setGiven((g) => g.map((o, k) => (k === i ? null : o)))} hint="Give up" drag={drag} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: MUTED, minHeight: 16, lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {kept ? `${others.length}/${need} ${rarityOfCreature(kept)} ${kept.name}s, Lv ${ASCEND_MIN_LEVEL}+ · their gear comes back` : `Tap or drag a creature up to raise it a rarity`}
      </div>

      {/* Your creatures. */}
      <div className="inv-panel" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 8 }}>
        {listed.length === 0 && <p style={{ margin: 8, fontSize: 14, color: MUTED }}>No creatures yet.</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))", gap: 8 }}>
          {listed.map((c) => {
            const placed = c.id === keptId || given.includes(c.id);
            const why = placed ? null : reasonFor(c);
            return <Tile key={c.id} c={c} placed={placed} why={why} onTap={() => (why ? undefined : tapCreature(c.id))} drag={why || placed ? undefined : drag} />;
          })}
        </div>
      </div>

      {/* The dock: the ritual. */}
      <div style={{ display: "flex", gap: 6 }}>
        <button className="dock-tab" onClick={clearAll} disabled={!kept} style={{ padding: "0 14px" }}>Clear</button>
        <button className="pixel-btn" disabled={!!problem} onClick={() => (losses.length ? setConfirming(true) : perform())}
          style={{ flex: 1, minHeight: 46, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {!problem && kept ? `✨ Ascend to ${rarityAfter(findCreatureTemplate(kept.creatureId, kept.name)!, stepsOfCreature(kept) + 1)}` : problem}
        </button>
      </div>

      {drag.ghost}

      {confirming && kept && (
        <div onClick={() => setConfirming(false)} style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "14cqh 16px 16px" }}>
          <div role="dialog" aria-label="Give these up?" onClick={(e) => e.stopPropagation()} className="stone-panel" style={{ width: "100%", maxWidth: 420 }}>
            <h2 className="pixel-font" style={{ margin: "0 0 8px", fontSize: 18, color: GOLD }}>These are lost with them</h2>
            <div style={{ display: "grid", gap: 6, maxHeight: "40cqh", overflowY: "auto" }}>
              {losses.map((l) => (
                <div key={l.id} style={{ fontSize: 14, background: "#12131a", padding: "6px 8px" }}>
                  <b>{l.name}</b>{" "}
                  {l.soulStone && <span style={{ color: "#b9e6ff" }}>{SOUL_STONES[l.soulStone as SoulStoneKey]?.icon} {SOUL_STONES[l.soulStone as SoulStoneKey]?.name ?? l.soulStone} </span>}
                  {l.codexes.length > 0 && <span style={{ color: "#ffd66e" }}>📜 {l.codexes.join(", ")}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="dock-tab" style={{ flex: 1 }} onClick={() => setConfirming(false)}>Keep them</button>
              <button className="pixel-btn" style={{ flex: 1 }} onClick={perform}>Give them up</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const RANK = ["common", "uncommon", "rare", "epic", "legendary"];

// Its stats with no gear: now, after the step, and both at Lv 30.
function Preview({ kept }: { kept?: CreatureOrItemDrop }) {
  const t = kept && findCreatureTemplate(kept.creatureId, kept.name);
  const box: React.CSSProperties = { background: "#12131a", border: "2px solid #2a2d38", padding: "6px 8px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 };
  if (!kept || !t) {
    return (
      <div style={{ ...box, justifyContent: "center", color: MUTED, fontSize: 13, lineHeight: 1.35 }}>
        Raise a creature a rarity: {ASCEND_FIRST} of a kind for the first step, {ASCEND_AFTER} for each after. All Lv {ASCEND_MIN_LEVEL}+.
      </div>
    );
  }
  const s = stepsOfCreature(kept), lv = clampLevel(kept.level), up = Math.min(s + 1, 4);
  const maxed = !!keepProblem(kept) && keepProblem(kept) === "Already Legendary";
  const p = (L: number, k: number) => proficiencyAt(t, kept.proficiency, L, k);
  const now = p(lv, s), after = p(lv, maxed ? s : up);
  const total = (x: CreatureProficiency) => Object.values(x).reduce((a, b) => a + b, 0);
  const from = rarityOfCreature(kept), to = maxed ? from : rarityAfter(t, s + 1);
  return (
    <div style={box}>
      <div className="pixel-font" style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <span style={{ color: RARITY_COLORS[from].text, textTransform: "capitalize" }}>{from}</span>
        <span style={{ color: MUTED }}>{" → "}</span>
        <span style={{ color: RARITY_COLORS[to].text, textTransform: "capitalize", visibility: maxed ? "hidden" : "visible" }}>{to}</span>
        <span style={{ color: MUTED, fontSize: 12 }}> · Lv {lv}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 3 }}>
        {STATS.map((st) => {
          const a = st.key === "hp" ? hpAt(t, lv, s) : now[st.key], b = st.key === "hp" ? hpAt(t, lv, maxed ? s : up) : after[st.key];
          return (
            <div key={st.key} title={st.label} style={{ fontSize: 11, lineHeight: 1.2, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" }}>
              <Glyph icon={st.icon} art={st.art} size={11} /> <span style={{ color: b > a ? "#7CFC9A" : "#e8e2d0" }}>{b}</span>
              <span style={{ display: "block", fontSize: 10, color: MUTED, visibility: b > a ? "visible" : "hidden" }}>+{b - a}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        At Lv {MAX_LEVEL}: ❤️ {hpAt(t, MAX_LEVEL, s)}{maxed ? "" : ` → ${hpAt(t, MAX_LEVEL, up)}`} · % {total(p(MAX_LEVEL, s))}{maxed ? "" : ` → ${total(p(MAX_LEVEL, up))}`}
      </div>
    </div>
  );
}

type Drag = ReturnType<typeof useDrag>;

// A slot: a creature, or an empty frame saying what goes there.
function Slot({ c, slot, big, onTap, hint, drag }: { c?: CreatureOrItemDrop; slot: "kept" | number; big?: boolean; onTap: () => void; hint: string; drag: Drag }) {
  const col = c ? RARITY_COLORS[rarityOfCreature(c)].text : "#5a5040";
  const hot = drag.over === String(slot);
  return (
    <button data-slot={String(slot)} onClick={c ? onTap : undefined} aria-label={c ? `${c.name}: tap to take out` : `${hint} slot`}
      style={{ position: "relative", width: "100%", aspectRatio: "1", padding: 0, background: "#0f1016", cursor: c ? "pointer" : "default",
        border: `${big ? 3 : 2}px ${c ? "solid" : "dashed"} ${hot ? "#ffd66e" : col}`, boxShadow: c ? `0 0 ${big ? 14 : 8}px ${col}55` : undefined, color: MUTED, overflow: "hidden" }}>
      {c ? <>
        <CreatureArt creatureId={c.creatureId} title={c.name} />
        <span style={{ position: "absolute", left: 3, bottom: 2, fontSize: big ? 12 : 10, color: "#fff", textShadow: "0 0 2px #000, 0 0 2px #000" }}>Lv {clampLevel(c.level)}</span>
        <span style={{ position: "absolute", right: 3, top: 1, fontSize: big ? 12 : 10, color: "#ffd66e", textShadow: "0 0 2px #000" }}>{stars(c)}</span>
      </> : <span className="pixel-font" style={{ fontSize: big ? 13 : 10 }}>{hint}</span>}
    </button>
  );
}

// One of your creatures in the list: its picture, name, level and stars; a
// reason it can't go (a fixed line, kept when there's none).
function Tile({ c, placed, why, onTap, drag }: { c: CreatureOrItemDrop; placed: boolean; why: string | null; onTap: () => void; drag?: Drag }) {
  const col = RARITY_COLORS[rarityOfCreature(c)].text;
  return (
    <button onClick={onTap} {...(drag ? drag.handlers(c) : {})} aria-label={`${c.name}, Lv ${clampLevel(c.level)}${why ? `: ${why}` : ""}`}
      style={{ display: "block", minWidth: 0, padding: 4, background: placed ? "#2a2414" : "#16171e", border: `2px solid ${placed ? "#ffd66e" : col + "88"}`, color: "inherit", font: "inherit",
        cursor: why ? "not-allowed" : "pointer", opacity: why ? 0.45 : 1, textAlign: "center", userSelect: "none", WebkitUserSelect: "none" }}>
      <span style={{ position: "relative", display: "block", width: "100%", aspectRatio: "1" }}>
        <CreatureArt creatureId={c.creatureId} title={c.name} />
        <span style={{ position: "absolute", right: 0, top: 0, fontSize: 10, color: "#ffd66e", textShadow: "0 0 2px #000" }}>{stars(c)}</span>
      </span>
      <span style={{ display: "block", fontSize: 11, color: col, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
      <span style={{ display: "block", fontSize: 10, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{why ?? (placed ? "In a slot" : `Lv ${clampLevel(c.level)}`)}</span>
    </button>
  );
}

// Hold a creature (HOLD_MS) to pick it up; it follows your finger (or the
// mouse) until you let go over a slot. While held, the page doesn't scroll.
function useDrag(onDrop: (id: string, slot: "kept" | number) => void) {
  const [held, setHeld] = useState<{ c: CreatureOrItemDrop; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const pending = useRef<{ timer: number; c: CreatureOrItemDrop; x: number; y: number } | null>(null);
  const live = useRef(false);
  const dropped = useRef(false); // a drag just ended: the click that follows isn't a tap
  const dropRef = useRef(onDrop);
  useEffect(() => { dropRef.current = onDrop; });

  useEffect(() => {
    const slotAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-slot]") as HTMLElement | null)?.dataset.slot ?? null;
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (p && !live.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) { clearTimeout(p.timer); pending.current = null; } // a scroll, not a hold
      if (!live.current) return;
      setHeld((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h));
      setOver(slotAt(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      if (pending.current) { clearTimeout(pending.current.timer); pending.current = null; }
      if (!live.current) return;
      live.current = false;
      dropped.current = true;
      window.setTimeout(() => { dropped.current = false; }, 0);
      const slot = slotAt(e.clientX, e.clientY);
      setHeld((h) => { if (h && slot) dropRef.current(h.c.id, slot === "kept" ? "kept" : Number(slot)); return null; });
      setOver(null);
    };
    // While a creature's held, a finger moving mustn't scroll the list.
    const noScroll = (e: TouchEvent) => { if (live.current) e.preventDefault(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", noScroll, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", noScroll);
    };
  }, []);

  return {
    over,
    handlers: (c: CreatureOrItemDrop) => ({
      onPointerDown: (e: React.PointerEvent) => {
        const x = e.clientX, y = e.clientY;
        const start = () => { pending.current = null; live.current = true; setHeld({ c, x, y }); };
        pending.current = { timer: window.setTimeout(start, e.pointerType === "mouse" ? 120 : HOLD_MS), c, x, y };
      },
      // A drag that ends on its own tile mustn't count as a tap too.
      onClickCapture: (e: React.MouseEvent) => { if (dropped.current) { e.stopPropagation(); e.preventDefault(); } },
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    }),
    ghost: held ? (
      <div aria-hidden style={{ position: "fixed", left: held.x - 36, top: held.y - 36, width: 72, height: 72, zIndex: 240, pointerEvents: "none",
        border: `2px solid ${RARITY_COLORS[rarityOfCreature(held.c)].text}`, background: "#0f1016cc", boxShadow: "0 6px 18px #000a" }}>
        <CreatureArt creatureId={held.c.creatureId} title={held.c.name} />
      </div>
    ) : null,
  };
}
