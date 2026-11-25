"use client";
// app/lab/pvp/page.tsx — 🧪 the PvP balance lab (the user, 2026-11-24): pick creatures by their stats, roll a
// pile of Rare-or-better gear, build two teams and fight them against each other by hand, both sides yours, under
// today's rules or a two-style package from docs/two-styles-sim-2026-11.md (./rules.ts). Every hit is logged as
// damage and a share of the target's HP. On the live site since 2026-11-25 so the user can play-test there (like /lab/models): it writes no saves, and it puts the game's combat rules back when you leave it.

import { useEffect, useMemo, useState } from "react";
import { setCombatRules, LIVE_RULES } from "@/lib/combat/engine";
import { CREATURE_BY_ID, CREATURE_TEMPLATES, CLASS_INFO, RACE_MOVES, SPECIAL_MOVES, LEARNABLE_MOVES, canLearnFromCodex, type Skill } from "@/lib/creatures/creatureData";
import { hpAt } from "@/lib/creatures/levels";
import { combatSummary } from "@/lib/combat/loadout";
import { calcDamage, chooseSkill, type Fighter } from "@/lib/combat/engine";
import {
  activeOf, affordableSkills, attackTargets, cloneBattle, createBattle, isValidAction, resolveRound, sendInReplacement, swapTargets,
  type BattleAction, type BattleEvent, type BattleState, type Combatant, type SideKey,
} from "@/lib/combat/battle";
import { ITEM_KEYS, type ItemKey } from "@/lib/items/ceilings";
import { ITEM_META } from "@/lib/items/metadata";
import { ARMOR_KEYS, ARMOR_META, ARMOR_SLOTS, ARMOR_SLOT_INFO, type ArmorKey, type ArmorSlot } from "@/lib/items/armor";
import type { Rarity } from "@/lib/items/budgets";
import { RULES, type RulesKey, templateUnder, hpPctAt, restyle, inSwings, rollWeaponUnder, rollPieceUnder, fighterUnder, moveNameUnder, roleOf, fittedGear, weaponCeilings, armorCeilings, engineRulesFor } from "./rules";

const TEAM = 3;
const PILE = 50;
const RARITY_ODDS: [Rarity, number][] = [["rare", 60], ["epic", 30], ["legendary", 10]];
const RARITY_COLOR: Record<Rarity, string> = { common: "#bbb", uncommon: "#7fd97f", rare: "#5aa9ff", epic: "#c77dff", legendary: "#ffb347" };

type Item = { id: number; kind: "weapon"; key: ItemKey; rarity: Rarity; stats: Record<string, number> }
  | { id: number; kind: "armor"; key: ArmorKey; slot: ArmorSlot; rarity: Rarity; stats: Record<string, number> };
type Loadout = { weapon?: number; helmet?: number; chest?: number; legs?: number; moves: string[] };
type Teams = Record<SideKey, string[]>;
type Loadouts = Record<string, Loadout>; // by "A:0" and the like

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
function rollRarity(): Rarity {
  let r = Math.random() * RARITY_ODDS.reduce((t, [, w]) => t + w, 0);
  for (const [k, w] of RARITY_ODDS) { r -= w; if (r <= 0) return k; }
  return "rare";
}
const itemName = (it: Item) => it.kind === "weapon" ? ITEM_META[it.key].name : `${ARMOR_META[it.key].name} ${ARMOR_SLOT_INFO[it.slot].piece}`;
const statsText = (s: Record<string, number>) => Object.entries(s).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(" · ");
const slotKey = (side: SideKey, i: number) => `${side}:${i}`;

// Every move this species could carry: its own kit plus every codex it can read.
function movePool(id: string, rules: RulesKey): Skill[] {
  const t = templateUnder(id, rules);
  const codex = [...RACE_MOVES, ...SPECIAL_MOVES, ...LEARNABLE_MOVES].filter((m) => canLearnFromCodex(templateUnder(id, "today"), m.name));
  const all = [...t.skills, ...codex].map((m) => (RULES[rules].two ? restyle(m) : m)).map((m) => (RULES[rules].multiply ? inSwings(m) : m));
  return [...new Map(all.map((m) => [m.name, m])).values()];
}

function buildTeam(side: SideKey, teams: Teams, loadouts: Loadouts, items: Item[], rules: RulesKey, level: number): Fighter[] {
  return teams[side].map((id, i) => {
    const l = loadouts[slotKey(side, i)] ?? { moves: [] };
    const w = items.find((it) => it.id === l.weapon);
    const pieces = ARMOR_SLOTS.map((s) => items.find((it) => it.id === l[s])).filter(Boolean) as Item[];
    const armor: Record<string, number> = {};
    for (const p of pieces) for (const [k, v] of Object.entries(p.stats)) armor[k] = (armor[k] ?? 0) + v;
    return fighterUnder(id, rules, level, w?.stats, pieces.length ? armor : undefined, l.moves.length ? l.moves : undefined, w?.key as ItemKey | undefined);
  });
}

export default function PvpLab() {
  const [rules, setRules] = useState<RulesKey>("T2");
  const [level, setLevel] = useState(16);
  const [teams, setTeams] = useState<Teams>({ A: [], B: [] });
  const [items, setItems] = useState<Item[]>([]);
  const [loadouts, setLoadouts] = useState<Loadouts>({});
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [chosen, setChosen] = useState<Partial<Record<SideKey, BattleAction>>>({});
  const [shownFrom, setShownFrom] = useState(0); // the log line the last round started at

  const fighters = useMemo(() => ({ A: buildTeam("A", teams, loadouts, items, rules, level), B: buildTeam("B", teams, loadouts, items, rules, level) }), [teams, loadouts, items, rules, level]);
  // The engine's power model follows the package while the lab is open; the game's own rules come back when it closes.
  useEffect(() => { setCombatRules(engineRulesFor(rules)); return () => setCombatRules(LIVE_RULES); }, [rules]);

  function rollPile() {
    const out: Item[] = [];
    for (let i = 0; i < PILE; i++) {
      const rarity = rollRarity();
      if (i % 2 === 0) { const key = pick(ITEM_KEYS); out.push({ id: i + 1, kind: "weapon", key, rarity, stats: rollWeaponUnder(key, rarity, rules) }); }
      else { const key = pick(ARMOR_KEYS), slot = pick(ARMOR_SLOTS); out.push({ id: i + 1, kind: "armor", key, slot, rarity, stats: rollPieceUnder(key, rarity, rules) }); }
    }
    out.sort((a, b) => (a.kind === b.kind ? itemName(a).localeCompare(itemName(b)) : a.kind === "weapon" ? -1 : 1));
    setItems(out);
    setLoadouts({});
  }
  function add(side: SideKey, id: string) {
    setTeams((t) => (t[side].length >= TEAM ? t : { ...t, [side]: [...t[side], id] }));
  }
  function drop(side: SideKey, i: number) {
    setTeams((t) => ({ ...t, [side]: t[side].filter((_, k) => k !== i) }));
    setLoadouts((l) => { const out: Loadouts = {}; for (const [k, v] of Object.entries(l)) { const [s, n] = k.split(":"); if (s !== side) out[k] = v; else if (+n < i) out[k] = v; else if (+n > i) out[slotKey(side, +n - 1)] = v; } return out; });
  }
  const setLoad = (k: string, patch: Partial<Loadout>) => setLoadouts((l) => ({ ...l, [k]: { ...(l[k] ?? { moves: [] }), ...patch } }));

  // Team B made to match team A: the same creatures (mirror) or others of the same rarities and roles (rival), each
  // in freshly rolled gear that fits it, at the rarities A's slots carry (Rare where a slot is empty). A mirror keeps
  // A's moves; a rival fights with its starting three. The new items join the pile.
  function generateB(mode: "mirror" | "rival") {
    const used = new Set<string>(), newItems: Item[] = [], ids: string[] = [], loads: Loadouts = {};
    let nextId = items.reduce((m, it) => Math.max(m, it.id), 0) + 1;
    teams.A.forEach((id, i) => {
      const l = loadouts[slotKey("A", i)] ?? { moves: [] };
      let pickId = id;
      if (mode === "rival") {
        const role = roleOf(templateUnder(id, rules)), rarity = CREATURE_BY_ID[id].rarity;
        const same = CREATURE_TEMPLATES.filter((c) => c.rarity === rarity && c.id !== id && !used.has(c.id) && !teams.A.includes(c.id));
        const alike = same.filter((c) => roleOf(templateUnder(c.id, rules)) === role);
        pickId = pick((alike.length ? alike : same.length ? same : [CREATURE_BY_ID[id]]).map((c) => c.id));
      }
      used.add(pickId);
      const g = fittedGear(pickId, rules);
      const wr = items.find((it) => it.id === l.weapon)?.rarity ?? "rare";
      const w: Item = { id: nextId++, kind: "weapon", key: g.weapon, rarity: wr, stats: rollWeaponUnder(g.weapon, wr, rules) };
      newItems.push(w);
      const load: Loadout = { weapon: w.id, moves: mode === "mirror" ? [...l.moves] : [] };
      for (const slot of ARMOR_SLOTS) {
        const r = items.find((it) => it.id === l[slot])?.rarity ?? "rare";
        const p: Item = { id: nextId++, kind: "armor", key: g.armor, slot, rarity: r, stats: rollPieceUnder(g.armor, r, rules) };
        newItems.push(p);
        load[slot] = p.id;
      }
      ids.push(pickId);
      loads[slotKey("B", i)] = load;
    });
    setItems([...items, ...newItems]);
    setTeams((t) => ({ ...t, B: ids }));
    setLoadouts((l) => ({ ...Object.fromEntries(Object.entries(l).filter(([k]) => !k.startsWith("B:"))), ...loads }));
  }

  function start() {
    const s = createBattle(fighters.A, fighters.B);
    setBattle(s); setChosen({}); setShownFrom(0);
  }
  function resolve() {
    if (!battle || !chosen.A || !chosen.B) return;
    const from = battle.log.length;
    const next = resolveRound(cloneBattle(battle), { A: chosen.A, B: chosen.B });
    setBattle(next); setChosen({}); setShownFrom(from);
  }
  function replace(side: SideKey, index: number) {
    if (!battle) return;
    setBattle(sendInReplacement(cloneBattle(battle), side, index));
  }

  // One to three a side: a 1v1 is the cleanest matchup check.
  const ready = teams.A.length > 0 && teams.B.length > 0;

  return (
    <main style={{ background: "#111", color: "#ddd", minHeight: "100vh", padding: 16, fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>🧪 PvP balance lab</h1>
      <p style={{ color: "#888", margin: "0 0 12px" }}>Pick two teams of three, roll a pile of gear, kit them out, then fight both sides yourself. Nothing is saved.</p>

      <section style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        {(Object.keys(RULES) as RulesKey[]).map((k) => (
          <button key={k} onClick={() => { setRules(k); setBattle(null); setItems([]); setLoadouts({}); }} style={btn(k === rules)}>{RULES[k].name}</button>
        ))}
        <span style={{ color: "#888" }}>{RULES[rules].blurb}</span>
        <label style={{ marginLeft: "auto" }}>Level <input type="number" min={1} max={50} value={level} onChange={(e) => setLevel(Math.max(1, Math.min(50, +e.target.value || 1)))} style={{ width: 56, background: "#222", color: "#ddd", border: "1px solid #444", padding: 4 }} /></label>
      </section>

      {!battle && <Ceilings rules={rules} />}

      {battle ? (
        <Fight state={battle} chosen={chosen} onChoose={(side, a) => setChosen((c) => ({ ...c, [side]: a }))} onResolve={resolve} onReplace={replace} shownFrom={shownFrom}
          onRematch={start} onBack={() => setBattle(null)} />
      ) : (
        <>
          <Creatures rules={rules} level={level} teams={teams} onAdd={add} />
          <section style={{ margin: "16px 0" }}>
            <h2 style={h2}>Gear pile <button onClick={rollPile} style={btn(false)}>Roll {PILE} Rare-or-better items</button> <span style={{ color: "#888" }}>({items.length} rolled; rare 60 / epic 30 / legendary 10; half weapons, half armour pieces; an item can be given to more than one creature here)</span></h2>
            {items.length > 0 && (
              <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #333", padding: 6, columns: 2, columnGap: 16 }}>
                {items.map((it) => <div key={it.id} style={{ breakInside: "avoid", padding: "2px 0" }}><span style={{ color: RARITY_COLOR[it.rarity] }}>#{it.id} {itemName(it)}</span> <span style={{ color: "#999" }}>{statsText(it.stats)}</span></div>)}
              </div>
            )}
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {(["A", "B"] as SideKey[]).map((side) => (
              <div key={side}>
                <h2 style={h2}>Team {side} <span style={{ color: "#888" }}>({teams[side].length}/{TEAM})</span>
                  {side === "B" && teams.A.length > 0 && <>
                    {" "}<button onClick={() => generateB("mirror")} style={btn(false)} title="The same creatures as A, in fresh fitted gear of the same rarities, with A's moves">Mirror A</button>
                    {" "}<button onClick={() => generateB("rival")} style={btn(false)} title="Other creatures of the same rarities and roles as A, in fresh fitted gear of the same rarities">Rival like A</button>
                  </>}
                </h2>
                {teams[side].map((id, i) => (
                  <Slot key={slotKey(side, i)} id={id} rules={rules} items={items} load={loadouts[slotKey(side, i)] ?? { moves: [] }} fighter={fighters[side][i]}
                    onChange={(p) => setLoad(slotKey(side, i), p)} onDrop={() => drop(side, i)} />
                ))}
              </div>
            ))}
          </section>
          {ready && <Matchups fighters={fighters} />}
          <button onClick={start} disabled={!ready} style={{ ...btn(ready), fontSize: 16, padding: "10px 24px", marginTop: 16 }}>⚔️ Fight</button>
          {!ready && <span style={{ color: "#888", marginLeft: 10 }}>Both teams need at least one creature (up to {TEAM} each).</span>}
        </>
      )}
    </main>
  );
}

// ── Setup pieces ─────────────────────────────────────────────────────────────────
// What each item can roll under the rules (the most a stat can take; a roll spends the rarity's budget across them).
function Ceilings({ rules }: { rules: RulesKey }) {
  const two = RULES[rules].two;
  const rarities: Rarity[] = ["rare", "epic", "legendary"];
  return (
    <details style={{ margin: "0 0 12px", border: "1px solid #333", padding: "6px 10px" }}>
      <summary style={{ cursor: "pointer", color: "#aaa" }}>Item ceilings under these rules (the most each stat can roll; budgets: rare 100, epic 120, legendary 150)</summary>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
        <table style={{ borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>Weapon</th>{rarities.map((r) => <th key={r} style={th}>{r}: melee / ranged{two ? "" : " / magic"} / agil / HP</th>)}</tr></thead>
          <tbody>{ITEM_KEYS.map((k) => <tr key={k} style={{ borderTop: "1px solid #222" }}><td style={{ ...td, textAlign: "left" }}>{ITEM_META[k].name}</td>{rarities.map((r) => { const c = weaponCeilings(k, r, rules); return <td key={r} style={td}>{c.melee} / {c.ranged}{two ? "" : ` / ${c.magic}`} / {c.agility} / <span style={{ color: "#5ee08a" }}>{c.hp}</span></td>; })}</tr>)}</tbody>
        </table>
        <table style={{ borderCollapse: "collapse", alignSelf: "start" }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>Armour (a piece; a set is three)</th>{rarities.map((r) => <th key={r} style={th}>{r}: m def / r def{two ? "" : " / mag def"} / agil / HP a piece</th>)}</tr></thead>
          <tbody>{ARMOR_KEYS.map((k) => <tr key={k} style={{ borderTop: "1px solid #222" }}><td style={{ ...td, textAlign: "left" }}>{ARMOR_META[k].name}</td>{rarities.map((r) => { const c = armorCeilings(k, r, rules); return <td key={r} style={td}>{c.mDef} / {c.rDef}{two ? "" : ` / ${c.magDef}`} / {c.agility} / <span style={{ color: "#5ee08a" }}>{Math.round(c.hp / 3)}</span></td>; })}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

function Creatures({ rules, level, teams, onAdd }: { rules: RulesKey; level: number; teams: Teams; onAdd: (side: SideKey, id: string) => void }) {
  const two = RULES[rules].two, hp = RULES[rules].hp, M = RULES[rules].M;
  return (
    <section>
      <h2 style={h2}>Creatures <span style={{ color: "#888" }}>(%s under these rules; HP at Lv {level} before gear{hp ? ", with its HP %" : ""}{M !== 1 ? `, ÷${M}` : ""})</span></h2>
      <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #333" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr style={{ color: "#888", textAlign: "left" }}><th style={th}>Creature</th><th style={th}>Role</th><th style={th}>Style</th><th style={th}>Melee</th><th style={th}>Ranged</th>{!two && <th style={th}>Magic</th>}<th style={th}>Agil</th><th style={th}>M def</th><th style={th}>R def</th>{!two && <th style={th}>Mag def</th>}{hp && <th style={th}>HP %</th>}<th style={th}>HP</th><th style={th}></th></tr></thead>
          <tbody>
            {CREATURE_TEMPLATES.map((c) => {
              const t = templateUnder(c.id, rules), p = t.proficiency;
              const hpv = Math.round((hpAt(t, level, 0) * (1 + hpPctAt(c.id, rules, level) / 100)) / M);
              const inA = teams.A.includes(c.id), inB = teams.B.includes(c.id);
              return (
                <tr key={c.id} style={{ borderTop: "1px solid #222" }}>
                  <td style={td}><span style={{ color: RARITY_COLOR[c.rarity] }}>{c.name}</span></td>
                  <td style={{ ...td, color: "#aaa" }}>{roleOf(t)}</td>
                  <td style={td}>{CLASS_INFO[t.cls].name}</td>
                  <td style={td}>{p.atk}</td><td style={td}>{p.rng}</td>{!two && <td style={td}>{p.mag}</td>}<td style={td}>{p.agil}</td>
                  <td style={td}>{p.mdef}</td><td style={td}>{p.rdef}</td>{!two && <td style={td}>{p.magdef}</td>}{hp && <td style={td}>{hpPctAt(c.id, rules, level)}</td>}<td style={td}>{hpv}</td>
                  <td style={td}>
                    <button onClick={() => onAdd("A", c.id)} disabled={inA || teams.A.length >= TEAM} style={btn(inA)}>A</button>{" "}
                    <button onClick={() => onAdd("B", c.id)} disabled={inB || teams.B.length >= TEAM} style={btn(inB)}>B</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Slot({ id, rules, items, load, fighter, onChange, onDrop }: { id: string; rules: RulesKey; items: Item[]; load: Loadout; fighter: Fighter; onChange: (p: Partial<Loadout>) => void; onDrop: () => void }) {
  const pool = useMemo(() => movePool(id, rules), [id, rules]);
  const s = combatSummary(fighter);
  const two = RULES[rules].two;
  const sel = (value: number | undefined, list: Item[], set: (v: number | undefined) => void) => (
    <select value={value ?? ""} onChange={(e) => set(e.target.value ? +e.target.value : undefined)} style={input}>
      <option value="">—</option>
      {list.map((it) => <option key={it.id} value={it.id}>#{it.id} {itemName(it)} ({it.rarity}) · {statsText(it.stats)}</option>)}
    </select>
  );
  const toggleMove = (name: string) => {
    const has = load.moves.includes(name);
    onChange({ moves: has ? load.moves.filter((m) => m !== name) : load.moves.length < 4 ? [...load.moves, name] : load.moves });
  };
  return (
    <div style={{ border: "1px solid #333", padding: 8, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span><strong>{fighter.name}</strong> <span style={{ color: "#aaa" }}>· {roleOf(fighter)}</span></span>
        <button onClick={onDrop} style={btn(false)}>remove</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 4, margin: "6px 0", alignItems: "center" }}>
        <span style={{ color: "#888" }}>Weapon</span>{sel(load.weapon, items.filter((it) => it.kind === "weapon"), (v) => onChange({ weapon: v }))}
        {ARMOR_SLOTS.map((slot) => <SlotRow key={slot} label={ARMOR_SLOT_INFO[slot].name}>{sel(load[slot], items.filter((it) => it.kind === "armor" && it.slot === slot), (v) => onChange({ [slot]: v }))}</SlotRow>)}
      </div>
      <div style={{ color: "#888", margin: "4px 0" }}>Moves ({(load.moves.length || fighter.skills.length)}/4; none ticked = its starting three)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {pool.map((m) => {
          const on = load.moves.includes(m.name);
          return <button key={m.name} onClick={() => toggleMove(m.name)} style={{ ...btn(on), padding: "2px 6px", fontSize: 11 }} title={m.desc ?? ""}>{moveNameUnder(m.name, rules)} <span style={{ color: on ? "#111" : STYLE[m.type] }}>{m.damage}/{m.energyCost}</span></button>;
        })}
      </div>
      <div style={{ color: "#aaa", marginTop: 6 }}>
        HP {s.hp} · melee {Math.round(s.atk)} · ranged {Math.round(s.rng)}{!two && ` · magic ${Math.round(s.mag)}`} · agil {Math.round(s.agil)} · m def {Math.round(s.mdef)} · r def {Math.round(s.rdef)}{!two && ` · mag def ${Math.round(s.magdef)}`}
        <span style={{ color: "#666" }}> (defences as they count in the fight)</span>
      </div>
    </div>
  );
}
const SlotRow = ({ label, children }: { label: string; children: React.ReactNode }) => <><span style={{ color: "#888" }}>{label}</span>{children}</>;

// Each creature's best move against each of the other team, as the engine works it out at full health.
function Matchups({ fighters }: { fighters: Record<SideKey, Fighter[]> }) {
  const cell = (a: Fighter, d: Fighter) => {
    const sk = chooseSkill(a, d);
    if (!sk) return "—";
    const dmg = calcDamage(sk, a, d, false).damage;
    return `${sk.name} ${dmg} (${Math.round((100 * dmg) / d.maxHp)}%)`;
  };
  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={h2}>Best hit at full health <span style={{ color: "#888" }}>(row hits column: damage and share of the target&apos;s HP)</span></h2>
      <table style={{ borderCollapse: "collapse" }}>
        <thead><tr><th style={th}></th>{fighters.B.map((f, i) => <th key={i} style={th}>B: {f.name}</th>)}</tr></thead>
        <tbody>{fighters.A.map((a, i) => <tr key={i}><th style={{ ...th, textAlign: "left" }}>A: {a.name}</th>{fighters.B.map((d, j) => <td key={j} style={td}>{cell(a, d)}</td>)}</tr>)}</tbody>
      </table>
      <table style={{ borderCollapse: "collapse", marginTop: 8 }}>
        <thead><tr><th style={th}></th>{fighters.A.map((f, i) => <th key={i} style={th}>A: {f.name}</th>)}</tr></thead>
        <tbody>{fighters.B.map((a, i) => <tr key={i}><th style={{ ...th, textAlign: "left" }}>B: {a.name}</th>{fighters.A.map((d, j) => <td key={j} style={td}>{cell(a, d)}</td>)}</tr>)}</tbody>
      </table>
    </section>
  );
}

// ── The fight, both sides by hand ────────────────────────────────────────────────
function Fight({ state, chosen, onChoose, onResolve, onReplace, shownFrom, onRematch, onBack }: {
  state: BattleState; chosen: Partial<Record<SideKey, BattleAction>>; onChoose: (side: SideKey, a: BattleAction) => void; onResolve: () => void;
  onReplace: (side: SideKey, index: number) => void; shownFrom: number; onRematch: () => void; onBack: () => void;
}) {
  const over = !!state.winner;
  const needs = state.needsReplacement;
  return (
    <section>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <strong>Round {state.round + 1}</strong>
        {over && <span style={{ color: "#ffb347" }}>{state.winner === "draw" ? "A draw." : `Team ${state.winner} wins.`}</span>}
        <button onClick={onRematch} style={btn(false)}>Rematch</button>
        <button onClick={onBack} style={btn(false)}>Back to setup</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {(["A", "B"] as SideKey[]).map((side) => <Side key={side} side={side} state={state} chosen={chosen[side]} onChoose={(a) => onChoose(side, a)} mustReplace={needs.includes(side)} onReplace={(i) => onReplace(side, i)} over={over} />)}
      </div>
      {!over && needs.length === 0 && (
        <button onClick={onResolve} disabled={!chosen.A || !chosen.B} style={{ ...btn(!!chosen.A && !!chosen.B), fontSize: 16, padding: "10px 24px", margin: "12px 0" }}>
          Resolve round {state.round + 1}{!chosen.A || !chosen.B ? ` (waiting for ${!chosen.A ? "A" : ""}${!chosen.A && !chosen.B ? " and " : ""}${!chosen.B ? "B" : ""})` : ""}
        </button>
      )}
      <Log state={state} from={shownFrom} />
    </section>
  );
}

function Side({ side, state, chosen, onChoose, mustReplace, onReplace, over }: {
  side: SideKey; state: BattleState; chosen?: BattleAction; onChoose: (a: BattleAction) => void; mustReplace: boolean; onReplace: (i: number) => void; over: boolean;
}) {
  const s = state.sides[side], me = activeOf(s);
  const targets = attackTargets(state, side);
  const swaps = swapTargets(s);
  const moves = affordableSkills(me);
  const label = (a: BattleAction) => a.kind === "attack" ? a.skillName : a.kind === "swap" ? `swap to ${s.team[a.to].name}` : a.kind;
  return (
    <div style={{ border: "1px solid #333", padding: 8 }}>
      <h2 style={{ ...h2, marginTop: 0 }}>Team {side}</h2>
      {s.team.map((f, i) => <Card key={i} f={f} active={i === s.active} />)}
      {over ? null : mustReplace ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: "#ffb347" }}>{me.name} is down. Send in:</div>
          {s.team.map((f, i) => f.hp > 0 && i !== s.active ? <button key={i} onClick={() => onReplace(i)} style={btn(false)}>{f.name}</button> : null)}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: "#888", marginBottom: 4 }}>Chosen: <strong style={{ color: "#ddd" }}>{chosen ? label(chosen) : "—"}</strong></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {me.skills.map((sk) => {
              const ok = moves.some((m) => m.name === sk.name);
              const a: BattleAction = { kind: "attack", skillName: sk.name, ...(targets.length > 1 ? { target: targets[0] } : {}) };
              return <button key={sk.name} onClick={() => onChoose(a)} disabled={!ok} style={btn(chosen?.kind === "attack" && chosen.skillName === sk.name)} title={sk.desc ?? ""}>{sk.name} <span style={{ color: STYLE[sk.type] }}>{sk.damage}/{sk.energyCost}</span></button>;
            })}
            {swaps.map((i) => <button key={`swap${i}`} onClick={() => onChoose({ kind: "swap", to: i })} style={btn(chosen?.kind === "swap" && chosen.to === i)}>↔ {s.team[i].name}</button>)}
            {moves.length === 0 && isValidAction(state, side, { kind: "pass" }) && <button onClick={() => onChoose({ kind: "pass" })} style={btn(chosen?.kind === "pass")}>rest</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ f, active }: { f: Combatant; active: boolean }) {
  const pct = Math.max(0, Math.round((100 * f.hp) / f.maxHp));
  const s = combatSummary(f);
  const two = f.proficiency.mag === 0 && f.proficiency.magdef === 0;
  return (
    <div style={{ padding: "4px 6px", margin: "2px 0", background: active ? "#1d2633" : "transparent", border: active ? "1px solid #4a7" : "1px solid #222", opacity: f.hp <= 0 ? 0.4 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span><strong>{f.name}</strong> <span style={{ color: "#aaa" }}>· {roleOf(f)}</span>{active ? " (out)" : ""}</span>
        <span>HP {Math.max(0, f.hp)}/{f.maxHp} ({pct}%) · energy {f.energy}</span>
      </div>
      <div style={{ color: "#888", fontSize: 11 }}>
        melee {Math.round(s.atk)} · ranged {Math.round(s.rng)}{!two && ` · magic ${Math.round(s.mag)}`} · agil {Math.round(s.agil)} · m def {Math.round(s.mdef)} · r def {Math.round(s.rdef)}{!two && ` · mag def ${Math.round(s.magdef)}`}
      </div>
      <div style={{ height: 6, background: "#333", margin: "3px 0" }}><div style={{ height: 6, width: `${pct}%`, background: pct > 50 ? "#5ee08a" : pct > 25 ? "#ffb347" : "#ff5e5e" }} /></div>
      {f.statuses.length > 0 && <div style={{ color: "#c7b8ff", fontSize: 11 }}>{f.statuses.map((st) => `${st.id} ${st.rounds}`).join(" · ")}</div>}
    </div>
  );
}

function Log({ state, from }: { state: BattleState; from: number }) {
  const line = (e: BattleEvent, i: number) => {
    const fresh = i >= from;
    const style = { color: fresh ? "#ddd" : "#666", padding: "1px 0" };
    if (e.type === "round") return <div key={i} style={{ ...style, color: fresh ? "#888" : "#444", marginTop: 4 }}>— round {e.round} —</div>;
    if (e.type === "attack") {
      const foe = state.sides[e.side === "A" ? "B" : "A"];
      const t = foe.team[e.targetIndex ?? foe.active];
      const share = t ? Math.round((100 * e.damage) / t.maxHp) : 0;
      return <div key={i} style={style}>{e.side} <strong>{e.attacker}</strong> {e.skill.name} → {e.target}: {e.missed ? "missed" : e.evaded ? "dodged" : <><strong>{e.damage}</strong> ({share}% of its HP){e.precise ? " precise" : ""}{e.crippled ? " · crippled" : ""}{e.braced ? " · braced" : ""}</>}</div>;
    }
    if (e.type === "effect") return <div key={i} style={{ ...style, color: fresh ? "#c7b8ff" : "#555" }}>{e.side} {e.name}: {e.text}{e.damage ? ` (${e.damage})` : ""}</div>;
    if (e.type === "faint") return <div key={i} style={{ ...style, color: fresh ? "#ff5e5e" : "#633" }}>{e.side} {e.name} is knocked out.</div>;
    if (e.type === "swap") return <div key={i} style={style}>{e.side} swaps {e.from} for {e.to}.</div>;
    if (e.type === "sendIn") return <div key={i} style={style}>{e.side} sends in {e.name}.</div>;
    if (e.type === "pass") return <div key={i} style={style}>{e.side} {e.name} rests.</div>;
    if (e.type === "end") return <div key={i} style={{ ...style, color: "#ffb347" }}>{e.winner === "draw" ? "A draw." : `Team ${e.winner} wins.`}</div>;
    return null;
  };
  return (
    <div style={{ border: "1px solid #333", padding: 8, marginTop: 8, maxHeight: 320, overflow: "auto", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
      {[...state.log].map((e, i) => line(e, i)).reverse()}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────────
const STYLE: Record<Skill["type"], string> = { melee: "#ff6b5e", ranged: "#6ee07a", magic: "#6fb4ff" };
const h2: React.CSSProperties = { fontSize: 14, margin: "12px 0 6px" };
const th: React.CSSProperties = { padding: "4px 8px", fontWeight: 500, color: "#888", textAlign: "right" };
const td: React.CSSProperties = { padding: "3px 8px", textAlign: "right", whiteSpace: "nowrap" };
const input: React.CSSProperties = { background: "#222", color: "#ddd", border: "1px solid #444", padding: 3, maxWidth: "100%" };
const btn = (on: boolean): React.CSSProperties => ({ background: on ? "#f1d9a0" : "#2a2a2a", color: on ? "#111" : "#ddd", border: "1px solid #555", padding: "4px 10px", cursor: "pointer", borderRadius: 3 });
