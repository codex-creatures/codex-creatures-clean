"use client";
// components/AscendRitual.tsx
// The Soul Altar's ascension (lib/creatures/ascend.ts; the user, 2026-11-18),
// made to feel like the commitment it is. Over the altar's soul fire:
// - the ritual circle: rune rings, the creature to raise in the middle, the
//   offerings round it (4 for the first step, 2 for each after), each joined
//   to it by a thread of light once it's in;
// - what it becomes: rarity now → next, and its stats now → after (and at Lv 30);
// - the inspect panel: whichever creature you tapped, in full: its soul stone,
//   its birth rolls, its moves (codex ones marked), its gear, and the button
//   to raise it, offer it or take it out;
// - the tray: your creatures in a row you swipe sideways; drag one up into the
//   circle (onto a slot, or anywhere in it for the next free one).
// Fixed structure: the circle, the strip, the panel and the tray stay put;
// only what's in them changes.

import { useEffect, useMemo, useRef, useState } from "react";
import type { CreatureOrItemDrop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { findCreatureTemplate, moveOf, type CreatureProficiency } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { clampLevel, hpAt, MAX_LEVEL, proficiencyAt, rollsOf } from "@/lib/creatures/levels";
import { giveProblem, keepProblem, lossesOf, othersNeeded, ritualProblem, rarityOfCreature, stepsOfCreature, ASCEND_FIRST } from "@/lib/creatures/ascend";
import { rarityAfter } from "@/lib/creatures/ascendStats";
import { codexRarityOf } from "@/lib/drops";
import { SOUL_STONES, type SoulStoneKey } from "@/lib/creatures/soulStones";
import { StoneIcon } from "./PixelSprite";
import { CreatureArt } from "./CreaturePortrait";
import { STATS } from "./CreatureDetailModal";
import SummonShow from "./SummonShow";
import Glyph from "./Glyph";

const MUTED = "rgba(255,255,255,0.55)";
const GOLD = "#f1d9a0";
const SOUL = "#9fe9d8";
const SLOTS = ASCEND_FIRST - 1; // the most offerings (the first step's)
// Where the offerings sit round the middle (degrees; 0 = right, 90 = down).
const RING: Record<number, number[]> = { 4: [225, 315, 135, 45], 2: [180, 0] };
const SHORT: Record<string, string> = { atk: "Mel", rng: "Rng", mag: "Mag", agil: "Agi", mdef: "MDef", rdef: "RDef", magdef: "MgDef" };
const RANK = ["common", "uncommon", "rare", "epic", "legendary"];

// A creature's ascension mark: a star per rarity climbed.
export const stars = (c: CreatureOrItemDrop) => "★".repeat(stepsOfCreature(c));

type Loadout = { weaponId?: string; helmetId?: string; chestId?: string; legsId?: string };
type Game = {
  inventory: CreatureOrItemDrop[] | unknown[];
  equipment: Record<string, Loadout>;
  ascendCreature: (keptId: string, otherIds: string[]) => CreatureOrItemDrop | null;
  ascendAway: () => Set<string>;
  ascendBusy: () => Set<string>;
};

export default function AscendRitual({ game, top }: { game: Game; top?: React.ReactNode }) {
  const all = game.inventory as CreatureOrItemDrop[];
  const creatures = useMemo(() => all.filter((d) => d.dropType === "creature"), [all]);
  const byId = useMemo(() => new Map(creatures.map((c) => [c.id, c])), [creatures]);
  const items = useMemo(() => new Map(all.map((d) => [d.id, d])), [all]);
  // (Read with the inventory: a run or the pit can change between visits.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const away = useMemo(() => game.ascendAway(), [creatures]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const busy = useMemo(() => game.ascendBusy(), [creatures]);

  const [keptId, setKeptId] = useState<string | null>(null);
  const [given, setGiven] = useState<(string | null)[]>(Array(SLOTS).fill(null));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [show, setShow] = useState<{ used: CreatureOrItemDrop[]; result: CreatureOrItemDrop; before: CreatureOrItemDrop } | null>(null);

  const kept = keptId ? byId.get(keptId) : undefined;
  const need = kept ? othersNeeded(kept) : SLOTS;
  const others = given.slice(0, need).flatMap((id) => (id && byId.get(id) ? [byId.get(id)!] : []));
  const problem = kept ? ritualProblem(kept, others, away, busy) : "Choose one to raise";
  const focus = (focusId && byId.get(focusId)) || kept;

  // A creature gone (given up, or sold elsewhere): out of its slot.
  useEffect(() => {
    if (keptId && !byId.has(keptId)) setKeptId(null);
    setGiven((g) => (g.some((id) => id && !byId.has(id)) ? g.map((id) => (id && byId.has(id) ? id : null)) : g));
  }, [byId, keptId]);

  const slotOf = (id: string) => (id === keptId ? "kept" : given.indexOf(id) >= 0 ? given.indexOf(id) : null);
  // Why one can't go where it would go next (null: it can).
  const reasonFor = (c: CreatureOrItemDrop) => (kept ? (c.id === kept.id ? null : giveProblem(kept, c, busy)) : keepProblem(c, away));

  function place(id: string, slot: "kept" | number | "auto", fromRaise = false) {
    const c = byId.get(id);
    if (!c) return;
    // (Dropped on the middle with one already there, it's an offering: the one to raise
    // changes only by its Raise button, never by a stray drop.)
    if (slot === "auto" || (slot === "kept" && kept && kept.id !== id && !fromRaise)) slot = !kept ? "kept" : given.slice(0, need).indexOf(null);
    if (slot === "kept") {
      if (keepProblem(c, away)) return;
      // A new kind in the middle: offerings that no longer fit come out.
      const fits = (o: string | null) => o && o !== id && byId.get(o) && !giveProblem(c, byId.get(o)!, busy);
      setGiven((g) => g.map((o) => (fits(o) ? o : null)));
      setKeptId(id);
      setFocusId(id);
      return;
    }
    if (slot < 0 || !kept || slot >= need || giveProblem(kept, c, busy)) return;
    setGiven((g) => g.map((o, i) => (i === slot ? id : o === id ? null : o)));
    setFocusId(id);
  }
  function takeOut(id: string) {
    if (id === keptId) return clearAll();
    setGiven((g) => g.map((o) => (o === id ? null : o)));
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
    setShow({ used, result, before: kept });
  }

  const drag = useDrag((id, slot) => place(id, slot));

  // The tray: before a pick, everyone (those that can be raised first); after, its own kind first.
  const tray = useMemo(() => {
    const rank = (c: CreatureOrItemDrop) => (kept && c.creatureId !== kept.creatureId ? 2 : reasonFor(c) ? 1 : 0);
    return [...creatures].sort((a, b) => rank(a) - rank(b) || RANK.indexOf(rarityOfCreature(b)) - RANK.indexOf(rarityOfCreature(a))
      || a.name.localeCompare(b.name) || clampLevel(b.level) - clampLevel(a.level));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatures, kept, busy, away]);

  if (show) {
    const t = findCreatureTemplate(show.result.creatureId, show.result.name)!;
    return <SummonShow t={t} cards={show.used} result={show.result} onDone={() => setShow(null)}
      words={{ laying: "The offerings are laid in the fire…", stirring: "Their souls pour into it…", done: `${show.result.name} ascends!` }}
      extra={<Gains before={show.before} after={show.result} />} />;
  }

  const t = kept && findCreatureTemplate(kept.creatureId, kept.name);
  const from = kept ? rarityOfCreature(kept) : undefined;
  const to = kept && t && !keepProblem(kept) ? rarityAfter(t, stepsOfCreature(kept) + 1) : undefined;
  const glow = to ? RARITY_COLORS[to].text : SOUL;
  const losses = lossesOf(others);
  const ready = !problem;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 2px" }}>{top}</div>

      {/* The ritual circle. */}
      <div data-circle style={{ position: "relative", flex: "1 1 0", minHeight: 150, display: "flex", alignItems: "center", justifyContent: "center",
        outline: drag.held ? `2px dashed ${glow}66` : "none", outlineOffset: -4, borderRadius: 12 }}>
        <div style={{ position: "relative", height: "min(100%, 82cqw)", aspectRatio: "1" }}>
          <Runes color={glow} lit={ready} />
          <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
            {RING[need].map((a, i) => given[i] && (
              <line key={i} x1="50" y1="50" x2={50 + 34 * Math.cos((a * Math.PI) / 180)} y2={50 + 34 * Math.sin((a * Math.PI) / 180)}
                stroke={glow} strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.8" style={{ filter: `drop-shadow(0 0 2px ${glow})` }} />
            ))}
          </svg>
          <Slot c={kept} slot="kept" size={36} x={50} y={50} glow={glow} label="Raise" focused={!!kept && focus?.id === kept.id} onTap={() => kept && setFocusId(kept.id)} over={drag.over} />
          {RING[need].map((a, i) => (
            <Slot key={i} c={given[i] ? byId.get(given[i]!) : undefined} slot={i} size={21} glow={glow} label="Offer"
              x={50 + 34 * Math.cos((a * Math.PI) / 180)} y={50 + 34 * Math.sin((a * Math.PI) / 180)}
              focused={!!given[i] && focus?.id === given[i]} onTap={() => given[i] && setFocusId(given[i])} over={drag.over} />
          ))}
        </div>
      </div>

      {/* What it becomes. */}
      <Becomes kept={kept} from={from} to={to} />

      {/* The one you tapped, in full. */}
      <Inspect c={focus} kept={kept} items={items} loadout={focus ? game.equipment[focus.id] : undefined}
        role={focus ? (focus.id === keptId ? "kept" : given.includes(focus.id) ? "offered" : "loose") : "loose"}
        reason={focus && slotOf(focus.id) === null ? reasonFor(focus) : null}
        onRaise={() => focus && place(focus.id, "kept", true)} onOffer={() => focus && place(focus.id, "auto")} onTakeOut={() => focus && takeOut(focus.id)} />

      {/* Your creatures: swipe along, drag one up. */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", overflowY: "hidden", padding: "8px 8px 6px", touchAction: "pan-x", flexShrink: 0,
        background: "linear-gradient(to bottom, rgba(4,5,9,0.2), rgba(4,5,9,0.85))" }}>
        {tray.length === 0 && <p style={{ margin: 8, fontSize: 14, color: MUTED }}>No creatures yet.</p>}
        {tray.map((c) => {
          const at = slotOf(c.id);
          const why = at !== null ? null : reasonFor(c);
          return <TrayCard key={c.id} c={c} placed={at !== null} why={why} focused={focus?.id === c.id}
            onTap={() => setFocusId(c.id)} handlers={why || at !== null ? undefined : drag.handlers(c)} />;
        })}
      </div>

      {/* The ritual. */}
      <div style={{ display: "flex", gap: 6, padding: "6px 8px 8px", flexShrink: 0, background: "rgba(4,5,9,0.85)" }}>
        <button className="dock-tab" onClick={clearAll} disabled={!kept} style={{ padding: "0 14px" }}>Clear</button>
        <button className="pixel-btn" disabled={!ready} onClick={() => (losses.length ? setConfirming(true) : perform())}
          style={{ flex: 1, minHeight: 48, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            boxShadow: ready ? `0 0 18px ${glow}aa` : undefined }}>
          {ready && to ? `✨ Ascend to ${to}` : problem}
        </button>
      </div>

      {drag.ghost}

      {confirming && kept && (
        <div onClick={() => setConfirming(false)} style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "14cqh 16px 16px" }}>
          <div role="dialog" aria-label="Give these up?" onClick={(e) => e.stopPropagation()} className="stone-panel" style={{ width: "100%", maxWidth: 420 }}>
            <h2 className="pixel-font" style={{ margin: "0 0 8px", fontSize: 18, color: GOLD }}>These are lost with them</h2>
            <div style={{ display: "grid", gap: 6, maxHeight: "40cqh", overflowY: "auto" }}>
              {losses.map((l) => (
                <div key={l.id} style={{ fontSize: 14, background: "#12131a", padding: "6px 8px" }}>
                  <b>{l.name}</b>{" "}
                  {l.soulStone && <span style={{ color: "#b9e6ff" }}>{SOUL_STONES[l.soulStone as SoulStoneKey] && <StoneIcon k={l.soulStone as SoulStoneKey} />} {SOUL_STONES[l.soulStone as SoulStoneKey]?.name ?? l.soulStone} </span>}
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

// The circle's runes: two rings turning opposite ways, a ring of marks, and a
// glow that brightens once the ritual's ready.
function Runes({ color, lit }: { color: string; lit: boolean }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: "4%", borderRadius: "50%", background: `radial-gradient(circle, ${color}${lit ? "33" : "1a"} 0%, transparent 62%)`, transition: "background 0.4s" }} />
      <div className="rune-ring" style={{ position: "absolute", inset: "2%", borderRadius: "50%", border: `2px dashed ${color}77` }}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return <span key={i} style={{ position: "absolute", left: `${50 + 50 * Math.cos(a)}%`, top: `${50 + 50 * Math.sin(a)}%`, width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5,
            background: color, opacity: 0.85, transform: "rotate(45deg)", boxShadow: `0 0 6px ${color}` }} />;
        })}
      </div>
      <div className="rune-ring back" style={{ position: "absolute", inset: "17%", borderRadius: "50%", border: `1px solid ${color}55`, boxShadow: `inset 0 0 18px ${color}22` }} />
    </div>
  );
}

// A place in the circle: a creature, or a breathing empty ring saying what goes there.
function Slot({ c, slot, size, x, y, glow, label, focused, onTap, over }: {
  c?: CreatureOrItemDrop; slot: "kept" | number; size: number; x: number; y: number; glow: string; label: string; focused: boolean; onTap: () => void; over: string | null;
}) {
  const col = c ? RARITY_COLORS[rarityOfCreature(c)].text : glow;
  const hot = over === String(slot);
  return (
    <button data-slot={String(slot)} onClick={onTap} aria-label={c ? `${c.name} (${label === "Raise" ? "to raise" : "offered"})` : `${label} slot`}
      style={{ position: "absolute", left: `${x - size / 2}%`, top: `${y - size / 2}%`, width: `${size}%`, height: `${size}%`, padding: 0, borderRadius: "50%",
        background: c ? `radial-gradient(circle, ${col}33, #0b0e14ee 70%)` : "rgba(6,10,14,0.6)", color: MUTED, cursor: "pointer", overflow: "visible",
        border: `${slot === "kept" ? 3 : 2}px ${c ? "solid" : "dashed"} ${hot ? "#fff" : focused ? GOLD : col}`,
        boxShadow: c || hot ? `0 0 ${slot === "kept" ? 22 : 12}px ${hot ? "#fff" : col}aa` : undefined, transition: "box-shadow 0.2s" }}
      className={c ? undefined : "ritual-slot-empty"}>
      {c ? <>
        <span style={{ position: "absolute", inset: "8%" }}><CreatureArt creatureId={c.creatureId} title={c.name} /></span>
        <span className="pixel-font" style={{ position: "absolute", left: "50%", bottom: -9, transform: "translateX(-50%)", fontSize: slot === "kept" ? 12 : 10, color: GOLD,
          whiteSpace: "nowrap", padding: "1px 6px", background: "#0b0e14", border: `1px solid ${col}99`, borderRadius: 8 }}>Lv {clampLevel(c.level)}{stars(c) ? ` ${stars(c)}` : ""}</span>
      </> : <span className="pixel-font" style={{ fontSize: slot === "kept" ? 13 : 10, color: glow }}>{label}</span>}
    </button>
  );
}

// Rarity now → next, and the stats it'd have (no gear) at its level and at Lv 30. Always two lines.
function Becomes({ kept, from, to }: { kept?: CreatureOrItemDrop; from?: string; to?: string }) {
  const t = kept && findCreatureTemplate(kept.creatureId, kept.name);
  const line: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center", height: 18, lineHeight: "18px" };
  if (!kept || !t || !from) {
    return (
      <div style={{ padding: "4px 10px", margin: "0 8px", flexShrink: 0, position: "relative", zIndex: 1, background: "linear-gradient(to bottom, rgba(4,5,9,0.55), rgba(4,5,9,0.88))" }}>
        <div className="pixel-font" style={{ ...line, color: SOUL, fontSize: 13 }}>Drag a creature into the circle</div>
        <div style={{ ...line, color: MUTED, fontSize: 12 }}>or tap one below, then Raise</div>
      </div>
    );
  }
  const s = stepsOfCreature(kept), lv = clampLevel(kept.level), up = to ? s + 1 : s;
  const total = (L: number, k: number) => Object.values(proficiencyAt(t, kept.proficiency, L, k)).reduce((a, b) => a + b, 0);
  const rc = (r: string) => RARITY_COLORS[r as keyof typeof RARITY_COLORS].text;
  return (
    <div style={{ padding: "4px 10px", margin: "0 8px", flexShrink: 0, position: "relative", zIndex: 1, background: "linear-gradient(to bottom, rgba(4,5,9,0.55), rgba(4,5,9,0.88))" }}>
      <div className="pixel-font" style={{ ...line, fontSize: 15 }}>
        <span style={{ color: rc(from), textTransform: "capitalize" }}>{from}</span>
        {to ? <><span style={{ color: MUTED }}>{"  →  "}</span><span style={{ color: rc(to), textTransform: "capitalize", textShadow: `0 0 10px ${rc(to)}` }}>{to}</span></>
          : <span style={{ color: MUTED }}> · as high as it goes</span>}
      </div>
      <div style={{ ...line, fontSize: 12, color: MUTED, visibility: to ? "visible" : "hidden" }}>
        Lv {lv}: ❤️ {hpAt(t, lv, s)}<Up a={hpAt(t, lv, s)} b={hpAt(t, lv, up)} /> · % {total(lv, s)}<Up a={total(lv, s)} b={total(lv, up)} />
        {"   "}Lv {MAX_LEVEL}: ❤️ {hpAt(t, MAX_LEVEL, s)}<Up a={hpAt(t, MAX_LEVEL, s)} b={hpAt(t, MAX_LEVEL, up)} /> · % {total(MAX_LEVEL, s)}<Up a={total(MAX_LEVEL, s)} b={total(MAX_LEVEL, up)} />
      </div>
    </div>
  );
}
const Up = ({ a, b }: { a: number; b: number }) => <span style={{ color: "#7CFC9A" }}>{b > a ? ` +${b - a}` : ""}</span>;

// One creature in full: who it is, its soul stone, its birth rolls, its moves
// and its gear, and what you can do with it. Fixed rows, each one line.
function Inspect({ c, kept, items, loadout, role, reason, onRaise, onOffer, onTakeOut }: {
  c?: CreatureOrItemDrop; kept?: CreatureOrItemDrop; items: Map<string, CreatureOrItemDrop>; loadout?: Loadout;
  role: "kept" | "offered" | "loose"; reason: string | null; onRaise: () => void; onOffer: () => void; onTakeOut: () => void;
}) {
  const box: React.CSSProperties = { margin: "2px 8px 0", padding: "8px 10px", background: "rgba(10,13,18,0.88)", border: "1px solid #2a3a3a", flexShrink: 0,
    display: "grid", gridTemplateRows: "auto repeat(4, 17px)", rowGap: 3, fontSize: 12, height: 138, boxSizing: "border-box" };
  const row: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "17px" };
  const t = c && findCreatureTemplate(c.creatureId, c.name);
  if (!c || !t) {
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, textAlign: "center", fontSize: 13 }}>
        Tap a creature to see its soul stone, birth rolls, moves and gear.
      </div>
    );
  }
  const rarity = rarityOfCreature(c), col = RARITY_COLORS[rarity].text;
  const stone = c.soulStone ? SOUL_STONES[c.soulStone] : undefined;
  const rolls = rollsOf(t, c.proficiency);
  const rolled = (Object.keys(SHORT) as (keyof CreatureProficiency)[]).filter((k) => rolls[k] !== 0);
  const learned = c.learned ?? [];
  const gear = loadout ? [loadout.weaponId, loadout.helmetId, loadout.chestId, loadout.legsId].flatMap((id) => (id && items.get(id) ? [items.get(id)!] : [])) : [];
  const action = role === "kept" || role === "offered"
    ? { label: "Take out", on: onTakeOut, ok: true }
    : !kept ? { label: "Raise", on: onRaise, ok: !reason } : { label: "Offer", on: onOffer, ok: !reason };
  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ position: "relative", width: 40, height: 40, flexShrink: 0, border: `1px solid ${col}88`, background: "#0b0e14" }}><CreatureArt creatureId={c.creatureId} title={c.name} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pixel-font" style={{ ...row, fontSize: 14, color: col }}>{c.name} <span style={{ color: "#ffd66e" }}>{stars(c)}</span></div>
          <div style={{ ...row, color: MUTED }}><span style={{ textTransform: "capitalize" }}>{rarity}</span> · Lv {clampLevel(c.level)} · {creatureTypeLabel(c.proficiency ?? t.proficiency)}</div>
        </div>
        <button className="chip" disabled={!action.ok} onClick={action.on} title={reason ?? undefined}
          style={{ minHeight: 40, minWidth: 84, flexShrink: 0, opacity: action.ok ? 1 : 0.45, textTransform: "none", fontSize: 12 }}>
          {action.ok ? action.label : reason}
        </button>
      </div>
      <div style={row} title={stone ? `${stone.name}: ${stone.text}` : undefined}>
        <span style={{ color: MUTED }}>Soul stone </span>
        {stone ? <span style={{ color: "#b9e6ff" }}><StoneIcon k={c.soulStone!} /> {stone.name} <span style={{ color: MUTED }}>· {stone.text}</span></span> : <span style={{ color: MUTED }}>none</span>}
      </div>
      <div style={row}>
        <span style={{ color: MUTED }}>Birth rolls </span>
        {rolled.length ? rolled.map((k) => <span key={k} style={{ color: rolls[k] > 0 ? "#7CFC9A" : "#ff8a80", marginRight: 6 }}>{SHORT[k]} {rolls[k] > 0 ? "+" : ""}{rolls[k]}</span>)
          : <span style={{ color: MUTED }}>standard</span>}
      </div>
      <div style={row} title={[...(c.moves ?? []), ...learned].join(", ")}>
        <span style={{ color: MUTED }}>Moves </span>
        {(c.moves ?? []).filter((n) => moveOf(t, n)).map((n) => <span key={n} style={{ marginRight: 6 }}>{n}</span>)}
        {learned.map((n) => <span key={n} style={{ marginRight: 6, color: RARITY_COLORS[codexRarityOf(n)].text }}>📜{n}</span>)}
      </div>
      <div style={row}>
        <span style={{ color: MUTED }}>Gear </span>
        {gear.length ? <>{gear.map((g) => <span key={g.id} style={{ color: RARITY_COLORS[g.rarity].text, marginRight: 6 }}>{g.name}</span>)}{role === "offered" && <span style={{ color: MUTED }}>· comes back to you</span>}</>
          : <span style={{ color: MUTED }}>none</span>}
      </div>
    </div>
  );
}

// One of your creatures in the tray: its picture, name, level and stars, and
// marks for what it carries (a soul stone, codex moves, its rolls' net). A
// reason it can't go, in the level's place.
function TrayCard({ c, placed, why, focused, onTap, handlers }: {
  c: CreatureOrItemDrop; placed: boolean; why: string | null; focused: boolean; onTap: () => void; handlers?: DragHandlers;
}) {
  const t = findCreatureTemplate(c.creatureId, c.name);
  const col = RARITY_COLORS[rarityOfCreature(c)].text;
  const net = t ? Object.values(rollsOf(t, c.proficiency)).reduce((a, b) => a + Math.max(0, b), 0) : 0;
  const stone = c.soulStone ? SOUL_STONES[c.soulStone] : undefined;
  return (
    <button onClick={onTap} {...(handlers ?? {})} aria-label={`${c.name}, Lv ${clampLevel(c.level)}${why ? `: ${why}` : ""}`}
      style={{ flex: "0 0 86px", position: "relative", padding: 4, background: focused ? "#1f2a2a" : "#12151c", color: "inherit", font: "inherit", cursor: "pointer",
        border: `2px solid ${placed ? GOLD : focused ? SOUL : col + "77"}`, opacity: why ? 0.42 : placed ? 0.6 : 1, textAlign: "center",
        userSelect: "none", WebkitUserSelect: "none", touchAction: "pan-x" }}>
      <span style={{ position: "relative", display: "block", width: "100%", aspectRatio: "1" }}>
        <CreatureArt creatureId={c.creatureId} title={c.name} />
        {stone && <span title={stone.name} style={{ position: "absolute", left: 0, top: 0, fontSize: 12 }}><StoneIcon k={c.soulStone!} scale={0.6} /></span>}
        {(c.learned?.length ?? 0) > 0 && <span title={`${c.learned!.length} codex move(s)`} style={{ position: "absolute", right: 0, top: 0, fontSize: 11 }}>📜{c.learned!.length}</span>}
        <span style={{ position: "absolute", right: 0, bottom: 0, fontSize: 10, color: "#ffd66e", textShadow: "0 0 2px #000" }}>{stars(c)}</span>
      </span>
      <span style={{ display: "block", fontSize: 11, color: col, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
      <span style={{ display: "block", fontSize: 10, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {why ?? (placed ? "In the circle" : <>Lv {clampLevel(c.level)}{net ? <span style={{ color: "#7CFC9A" }}> · +{net}</span> : null}</>)}
      </span>
    </button>
  );
}

// What it gained, for the end of the show: each stat at its level now, what
// it rose by, and what it'll have risen by at Lv 30.
function Gains({ before, after }: { before: CreatureOrItemDrop; after: CreatureOrItemDrop }) {
  const t = findCreatureTemplate(after.creatureId, after.name);
  if (!t) return null;
  const lv = clampLevel(after.level), a = stepsOfCreature(before), b = stepsOfCreature(after);
  const p = (L: number, s: number) => proficiencyAt(t, after.proficiency, L, s);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4, width: "100%", maxWidth: 360 }}>
      {STATS.map((st) => {
        const x = st.key === "hp" ? hpAt(t, lv, a) : p(lv, a)[st.key], y = st.key === "hp" ? hpAt(t, lv, b) : p(lv, b)[st.key];
        const z = st.key === "hp" ? hpAt(t, MAX_LEVEL, b) - hpAt(t, MAX_LEVEL, a) : p(MAX_LEVEL, b)[st.key] - p(MAX_LEVEL, a)[st.key];
        return (
          <div key={st.key} title={`${st.label}: +${y - x} now, +${z} by Lv ${MAX_LEVEL}`} style={{ background: "rgba(18,19,26,0.9)", padding: "4px 2px", fontSize: 12, lineHeight: 1.25 }}>
            <Glyph icon={st.icon} art={st.art} size={12} /> {y}
            <span style={{ display: "block", fontSize: 11, color: y > x ? "#7CFC9A" : MUTED }}>{y > x ? `+${y - x}` : "—"}<span style={{ color: MUTED }}> · Lv{MAX_LEVEL} +{z}</span></span>
          </div>
        );
      })}
    </div>
  );
}

type DragHandlers = { onPointerDown: (e: React.PointerEvent) => void; onClickCapture: (e: React.MouseEvent) => void; onContextMenu: (e: React.MouseEvent) => void };

// Dragging from the tray: a finger moving up (or the mouse moving) picks the
// creature up; sideways is the tray scrolling. It follows you until you let
// go: on a slot, it goes there; anywhere else in the circle, the next free one.
function useDrag(onDrop: (id: string, slot: "kept" | number | "auto") => void) {
  const [held, setHeld] = useState<{ c: CreatureOrItemDrop; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const start = useRef<{ c: CreatureOrItemDrop; x: number; y: number; mouse: boolean } | null>(null);
  const live = useRef(false);
  const dropped = useRef(false); // a drag just ended: the click that follows isn't a tap
  const dropRef = useRef(onDrop);
  useEffect(() => { dropRef.current = onDrop; });

  useEffect(() => {
    const target = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const slot = (el?.closest("[data-slot]") as HTMLElement | null)?.dataset.slot;
      return slot ?? (el?.closest("[data-circle]") ? "auto" : null);
    };
    const move = (e: PointerEvent) => {
      const s = start.current;
      if (s && !live.current) {
        const dx = e.clientX - s.x, dy = e.clientY - s.y;
        if (s.mouse ? Math.hypot(dx, dy) > 6 : -dy > 8 && Math.abs(dy) > Math.abs(dx)) { live.current = true; setHeld({ c: s.c, x: e.clientX, y: e.clientY }); }
        else if (!s.mouse && (Math.abs(dx) > 10 || dy > 10)) start.current = null; // the tray scrolling
      }
      if (!live.current) return;
      setHeld((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h));
      setOver(target(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      start.current = null;
      if (!live.current) return;
      live.current = false;
      dropped.current = true;
      window.setTimeout(() => { dropped.current = false; }, 0);
      const to = target(e.clientX, e.clientY);
      setHeld((h) => { if (h && to) dropRef.current(h.c.id, to === "kept" || to === "auto" ? to : Number(to)); return null; });
      setOver(null);
    };
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

  const handlers = (c: CreatureOrItemDrop): DragHandlers => ({
    onPointerDown: (e) => { start.current = { c, x: e.clientX, y: e.clientY, mouse: e.pointerType === "mouse" }; },
    onClickCapture: (e) => { if (dropped.current) { e.stopPropagation(); e.preventDefault(); } },
    onContextMenu: (e) => e.preventDefault(),
  });
  const col = held ? RARITY_COLORS[rarityOfCreature(held.c)].text : SOUL;
  return {
    held: !!held,
    over,
    handlers,
    ghost: held ? (
      <div aria-hidden style={{ position: "fixed", left: held.x - 40, top: held.y - 56, width: 80, height: 80, zIndex: 240, pointerEvents: "none", borderRadius: "50%",
        border: `2px solid ${col}`, background: "radial-gradient(circle, #1a2a2acc, #0b0e14cc)", boxShadow: `0 0 22px ${col}` }}>
        <CreatureArt creatureId={held.c.creatureId} title={held.c.name} />
      </div>
    ) : null,
  };
}
