"use client";
// components/BattleScreen.tsx
// Playing a battle by hand against the AI: the arena, move buttons, swaps,
// the step-by-step replay of each round, and the battle log. Used by the
// Fight Pit (app/battle) and the dungeon (app/dungeon).

import { useEffect, useMemo, useRef, useState } from "react";
import { loadSave, armorPieces } from "@/hooks/useGameState";
import { ARMOR_META, wornArmor } from "@/lib/items/armor";
import { isCreatureDrop, isItemDrop, type CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { findCreatureTemplate, type CreatureTemplate, type Skill } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { fighterFor } from "@/lib/creatures/instance";
import { combatSummary } from "@/lib/combat/loadout";
import { calcDamage, type CombatItem, type Fighter } from "@/lib/combat/engine";
import { CLASS_INFO } from "@/lib/creatures/creatureData";
import { CRIPPLE } from "@/lib/combat/battle";
import { MoveTile } from "./MoveTile";
import { useEscape } from "@/hooks/useEscape";
import { createChamber, CW, CH } from "@/lib/dungeon/chamber";
import {
  createBattle, resolveRound, sendInReplacement, cloneBattle,
  activeOf, affordableSkills, swapTargets, currentAgility, changeActive, attackTargets, fieldOf, aliveCount,
  CRIPPLE_ROUNDS, CRIPPLE_AGILITY_LOSS, STREAK_START, streakEffects,
  type BattleAction, type BattleEvent, type BattleState, type Combatant, type SideKey,
} from "@/lib/combat/battle";
import type { BossKind } from "@/lib/combat/bossAi";
import { ILLNESS_DAMAGE } from "@/lib/dungeon/run";
import { REF_LEVEL } from "@/lib/creatures/levels";
import { chooseAiAction, chooseAiReplacement, AI_LEVEL_LABELS, type AiLevel } from "@/lib/combat/thinkingAi";
import { RARITIES } from "@/lib/balance/simulate";
import { saveBattle, type BattleMember } from "@/lib/battleHistory";
import BattleLog, { YOU, FOE } from "@/components/BattleLog";
import BossStage from "@/components/BossStage";
import PixelSprite, { PotionIcon } from "@/components/PixelSprite";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { spriteWidth, type Sprite } from "@/lib/sprites/pixels";
import { artFor, flipToFace, fineWidth, fineHeight } from "@/lib/sprites/art";

// Fighters face each other: yours (on the left) look right, theirs look left.
// Most art faces left, so yours is mirrored; art drawn facing right is the other way round.
const faceFoe = (sprite: Sprite, side: "A" | "B") => flipToFace(sprite, side === "A"); // yours on the left face right; theirs face left

export const MUTED = "rgba(255,255,255,0.5)";

// The first quest's guided fight (your creature against the thief): Klutz
// watches from the side and talks you through the triangle and damage
// types, one move at a time. It opens on a Fight! button (step -1); each
// step after that: what he says, and which move you can pick — it glows
// (null = any, and you can swap and use the bag again).
export const TUTORIAL_STEPS: { say: string; allow: ((s: Skill) => boolean) | null }[] = [
  { say: "Right — that's a big melee lump in a thick hide. Let's see what works. Poke it from a distance first: use 🏹 Stone Throw.",
    allow: (s) => s.type === "ranged" },
  { say: "Barely a scratch! It's a melee fighter, and melee is strong against ranged — ranged moves only do half. Get in close: use ⚔️ Heavy Blow.",
    allow: (s) => s.name === "Heavy Blow" },
  { say: "Better, but not much. Heavy Blow is a 🔨 Force move: it hits hard, but that hide is thick, and Force can't do much against strong defence. Use 🗡️ Impale — Pierce goes straight through armour.",
    allow: (s) => s.name === "Impale" },
  { say: "THERE we go! Pierce ignores half its armour. Remember: melee beats ranged, ranged beats magic, magic beats melee. Force for soft targets, Pierce for armoured ones. Now finish it off — your call!",
    allow: null },
];
const tutorialLocked = (m: Match) => m.tutorial !== undefined && (m.tutorial < 0 || (m.tutorial < TUTORIAL_STEPS.length && TUTORIAL_STEPS[m.tutorial].allow !== null));
const STEP_MS = { attack: 950, other: 650, phase: 4200 }; // phase: a boss's phase-change scene

// What the screen shows about each team member (gear names etc.).
// creatureId: for its sprite (fights saved before sprites show initials).
export type MemberInfo = { rarity: Rarity; label: string; weaponName?: string; armorName?: string; creatureId?: string };
export type OwnedCreature = MemberInfo & {
  id: string; name: string; template: CreatureTemplate; roster: boolean;
  weaponRarity?: Rarity; armorRarity?: Rarity; fighter: Fighter;
};

export type Match = {
  state: BattleState;                 // the real battle
  info: Record<SideKey, MemberInfo[]>;
  teams: Record<SideKey, Fighter[]>;  // for rematches and the history
  level: AiLevel;                     // how well the opponent plays
  title?: string;                     // e.g. "Dungeon room 3", shown in the history
  tutorial?: number;                  // the guided first fight: which step you're on (TUTORIAL_STEPS; -1 = not started)
};

// The animation currently playing. Indexes say which creature (team index)
// when a side has two on the field.
export type Fx =
  | { id: number; kind: "attack"; side: SideKey; damage: number; precise: boolean; missed: boolean; crippled: boolean; gap: boolean;
      attackerIndex?: number; targetIndex?: number; evaded?: boolean }
  | { id: number; kind: "swap" | "sendIn" | "faint"; side: SideKey }
  | { id: number; kind: "effect"; side: SideKey; index: number; text: string; color: string }
  | { id: number; kind: "lineup"; side: SideKey; text?: string };

export function rarityColor(r?: Rarity) {
  return r ? RARITY_COLORS[r].text : "white";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Your creatures as they fight: gear, moves and rolled %s from the save.
// Roster (★) first, then rarest.
export function loadOwnedCreatures(): OwnedCreature[] {
  const save = loadSave();
  const inv = save?.inventory ?? [];
  const favs = new Set(save?.favoriteIds ?? []);
  const equipment = save?.equipment ?? {};
  const items = new Map(inv.filter(isItemDrop).map((d) => [d.id, d as CreatureOrItemDrop]));

  const list: OwnedCreature[] = [];
  for (const d of inv.filter(isCreatureDrop)) {
    const t = findCreatureTemplate(d.creatureId, d.name);
    if (!t) continue;
    const w = items.get(equipment[d.id]?.weaponId ?? "");
    const pieces = armorPieces(equipment[d.id], (id) => items.get(id));
    const worn = pieces.filter((p): p is CreatureOrItemDrop => !!p);
    const set = wornArmor(pieces).set;
    // The chest says most about the armour (it carries the most defence).
    const a = pieces[1] ?? worn[0];
    list.push({
      id: d.id, name: t.name, template: t, roster: favs.has(d.id),
      rarity: t.rarity, label: creatureTypeLabel(d.proficiency ?? t.proficiency), creatureId: t.id,
      weaponName: w?.name,
      armorName: set ? `${ARMOR_META[set].name} (full set)` : worn.length > 0 ? worn.map((p) => p.name).join(", ") : undefined,
      weaponRarity: w?.rarity, armorRarity: a?.rarity,
      fighter: fighterFor(d, t, w?.stats, pieces, equipment[d.id]?.moves, w?.itemKey),
    });
  }
  return list.sort((x, y) =>
    Number(y.roster) - Number(x.roster) ||
    RARITIES.indexOf(y.rarity) - RARITIES.indexOf(x.rarity) ||
    x.name.localeCompare(y.name)
  );
}

// Replays one event onto the on-screen copy of the battle.
function applyEvent(view: BattleState, e: BattleEvent) {
  switch (e.type) {
    case "swap": {
      const s = view.sides[e.side];
      const leaving = activeOf(s);
      leaving.energy = Math.min(100, leaving.energy + e.energyRestored);
      changeActive(view, e.side, e.toIndex);
      break;
    }
    case "attack": {
      const mine = view.sides[e.side], theirs = view.sides[e.side === "A" ? "B" : "A"];
      const attacker = mine.team[e.attackerIndex ?? mine.active];
      const target = theirs.team[e.targetIndex ?? theirs.active];
      attacker.energy = e.attackerEnergyAfter;
      attacker.streak = { ...e.streak };
      target.hp = e.targetHpAfter;
      if (e.crippled) target.statuses = [...target.statuses.filter((s) => s.id !== "cripple"), { id: "cripple", rounds: CRIPPLE_ROUNDS, loss: e.crippleLoss }];
      if (e.venom) target.statuses = [...target.statuses.filter((s) => s.id !== "venom"), { ...e.venom }];
      break;
    }
    case "effect": {
      const f = view.sides[e.side].team[e.index];
      f.hp = e.hp;
      f.statuses = e.statuses.map((s) => ({ ...s }));
      break;
    }
    case "lineup": {
      const s = view.sides[e.side];
      for (const i of e.reveal ?? []) s.team[i].hidden = false;
      for (const i of e.gone ?? []) s.team[i].hp = 0;
      s.active = e.active;
      s.partner = e.partner;
      break;
    }
    case "sendIn":
      changeActive(view, e.side, e.index);
      break;
  }
}

function historyMembers(m: Match, k: SideKey): BattleMember[] {
  return m.teams[k].map((f, i) => {
    const s = combatSummary(f);
    return {
      name: f.name, rarity: m.info[k][i].rarity, label: m.info[k][i].label,
      weapon: m.info[k][i].weaponName, armor: m.info[k][i].armorName,
      moves: f.skills.map((sk) => sk.name),
      stats: { hp: s.hp, atk: Math.round(s.atk), rng: Math.round(s.rng), mag: Math.round(s.mag), agil: Math.round(s.agil), mdef: Math.round(s.mdef), rdef: Math.round(s.rdef), magdef: Math.round(s.magdef) },
    };
  });
}

// ── Playing a battle ──────────────────────────────────────────────
// onUpdate is called with every settled state (after each round and each
// replacement), so a screen can save a battle in progress.
export function usePlayableBattle(onUpdate?: (m: Match) => void) {
  const [match, setMatchState] = useState<Match | null>(null);
  const [view, setView] = useState<BattleState | null>(null); // on-screen copy while a round plays
  const [fx, setFx] = useState<Fx | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  function setMatch(m: Match | null) {
    setMatchState(m);
    if (m) onUpdate?.(m);
  }

  // startHp: your creatures' HP if they start hurt.
  // boss: the opponent is that dungeon boss (played by its script).
  // illness: one of your creatures is sick (the witch's curse) for this many rounds.
  // tutorial: the first quest's guided fight (see TUTORIAL_STEPS).
  // pair: their first two are both on the field (an ambush). turnLimit: the
  // room blows after this many rounds (see BattleState.turnLimit).
  function start(teams: Match["teams"], info: Match["info"], level: AiLevel,
    opts: { startHp?: number[]; title?: string; boss?: BossKind; illness?: { index: number; rounds: number }; tutorial?: boolean; pair?: boolean; turnLimit?: number } = {}) {
    setView(null);
    setFx(null);
    const state = createBattle(teams.A, teams.B, { A: opts.startHp }, opts.boss, { pairB: opts.pair, turnLimit: opts.turnLimit });
    const sick = opts.illness && state.sides.A.team[opts.illness.index];
    if (sick && opts.illness!.rounds > 0) sick.statuses.push({ id: "illness", rounds: opts.illness!.rounds, dmg: Math.max(1, Math.round(sick.maxHp * ILLNESS_DAMAGE)) });
    setMatch({ state, info, teams, level, title: opts.title, ...(opts.tutorial ? { tutorial: -1 } : {}) });
  }

  // Continue a saved battle.
  function resume(m: Match) {
    setView(null);
    setFx(null);
    setMatchState(m);
  }

  async function act(action: BattleAction) {
    if (!match || view) return;
    const before = match.state;
    const after = cloneBattle(before);
    resolveRound(after, { A: action, B: chooseAiAction(after, "B", match.level) });
    if (after.needsReplacement.includes("B")) sendInReplacement(after, "B", chooseAiReplacement(after, "B", match.level));
    // The guided fight moves on a step with each move your first creature makes.
    const step = match.tutorial !== undefined && match.tutorial >= 0 && action.kind === "attack" && before.sides.A.active === 0 ? { tutorial: match.tutorial + 1 } : {};
    const done: Match = { ...match, state: after, ...step };
    if (after.winner) {
      saveBattle({
        id: crypto.randomUUID(), date: new Date().toISOString(), winner: after.winner, rounds: after.round, title: match.title,
        teams: { A: historyMembers(done, "A"), B: historyMembers(done, "B") }, log: after.log,
      });
    }
    onUpdate?.(done); // saved straight away, so leaving mid-replay doesn't undo the round

    // Play the round's events one at a time.
    let shown = cloneBattle(before);
    setView(shown);
    let n = 0;
    for (const e of after.log.slice(before.log.length)) {
      if (e.type === "round" || e.type === "end" || e.type === "pass") continue;
      shown = cloneBattle(shown);
      applyEvent(shown, e);
      setView(shown);
      setFx(e.type === "attack"
        ? { id: ++n, kind: "attack", side: e.side, damage: e.damage, precise: e.precise, missed: e.missed, crippled: e.crippled, gap: e.defenceIgnored > 0.25,
            attackerIndex: e.attackerIndex, targetIndex: e.targetIndex, evaded: e.evaded }
        : e.type === "lineup" ? { id: ++n, kind: "lineup", side: e.side, text: e.text }
        : e.type === "effect" ? { id: ++n, kind: "effect", side: e.side, index: e.index,
            text: e.kind === "illness" ? `-${e.damage} ILLNESS` : e.kind === "venom" ? `-${e.damage} VENOM` : e.kind === "revive" ? "RISES AGAIN!" : e.kind === "item" ? `+${e.damage} HP` : e.kind === "stumble" ? "STUMBLES!" : `${e.text.split(" — ")[0].replace(/^uses /, "").toUpperCase()}!`,
            color: e.kind === "illness" ? "#b06cff" : e.kind === "venom" ? "#9be15d" : e.kind === "revive" ? "#9fd3a8" : e.kind === "item" ? "#5ee08a" : e.kind === "stumble" ? "#d7a6ff" : "#c7b8ff" }
        : { id: ++n, kind: e.type, side: e.side });
      await sleep(e.type === "attack" ? STEP_MS.attack : e.type === "lineup" && e.text ? STEP_MS.phase : STEP_MS.other);
      if (!alive.current) return;
    }
    setFx(null);
    setView(null);
    setMatchState(done);
  }

  function replace(index: number) {
    if (!match || view) return;
    const s = cloneBattle(match.state);
    sendInReplacement(s, "A", index);
    setFx({ id: Date.now(), kind: "sendIn", side: "A" });
    setMatch({ ...match, state: s });
  }

  // The guided fight: Fight! pressed, Klutz starts talking.
  function beginTutorial() {
    if (match?.tutorial === -1) setMatch({ ...match, tutorial: 0 });
  }

  return { match, view, fx, start, resume, act, replace, beginTutorial, clear: () => setMatchState(null) };
}

// ── Battle screen ─────────────────────────────────────────────────
// ── Battle screen ─────────────────────────────────────────────────
// finishedActions: the buttons shown when the battle is over.
// bag: battle-bag items you can use, one entry per kind (count = how many);
// onUseItem(key, activeIndex) takes it out of the bag when you use it
// (activeIndex: your creature on the field, by team order).
// A potion has heal; a weapon has weapon (its combat stats) and detail.
export type BagItem = { key: string; name: string; icon: string; potion?: "potion" | "lesser"; count: number; heal?: number; weapon?: CombatItem; detail?: string };

// showEstimates: the "hits for ~X, takes ~Y" swap hints (until your first
// Cyclops; after that you're on your own).
export function BattleView({ battle, finishedActions, bag = [], onUseItem, showEstimates = true }: {
  battle: ReturnType<typeof usePlayableBattle>; finishedActions: React.ReactNode;
  bag?: BagItem[]; onUseItem?: (key: string, activeIndex: number) => void; showEstimates?: boolean;
}) {
  const [targetPick, setTargetPick] = useState<number | null>(null);
  // What's opened over the stage (from the dock's tabs): the bag, a swap, the log, details.
  const [open, setOpen] = useState<"bag" | "swap" | "log" | "details" | null>(null);
  const toggle = (k: NonNullable<typeof open>) => setOpen((o) => (o === k ? null : k));
  useEscape(open ? () => setOpen(null) : null);
  const match = battle.match!;
  const { info } = match;
  const playing = battle.view !== null;
  const fx = battle.fx;
  const onAct = battle.act, onReplace = battle.replace;
  const state = battle.view ?? match.state;
  const you = state.sides.A, foe = state.sides.B;
  const me = activeOf(you);
  // Two enemies on the field? You pick which one to hit (tap its card).
  const targets = attackTargets(state, "A");
  const multi = targets.length > 1;
  const target = targetPick !== null && targets.includes(targetPick) ? targetPick : (targets[0] ?? foe.active);
  const them = foe.team[target];
  const finished = !playing && match.state.winner;
  const mustReplace = !playing && match.state.needsReplacement.includes("A");
  const phaseText = fx?.kind === "lineup" ? fx.text : undefined;

  const myAgil = currentAgility(me), theirAgil = currentAgility(them);
  // The guided fight: Klutz's tip, and which moves you can pick right now.
  const tip = match.tutorial !== undefined && match.tutorial >= 0 && match.tutorial < TUTORIAL_STEPS.length && you.active === 0 ? TUTORIAL_STEPS[match.tutorial] : undefined;
  const notStarted = match.tutorial === -1;
  const locked = tutorialLocked(match) && you.active === 0;
  // The witch's illness biting: the screen shakes.
  const ill = fx?.kind === "effect" && fx.text.includes("ILLNESS");
  const act = (a: Parameters<typeof onAct>[0]) => { setOpen(null); onAct(a); };
  const canSwap = swapTargets(you).length > 0 && !locked;
  const bagCount = bag.reduce((n, it) => n + it.count, 0);
  const resting = affordableSkills(me).length === 0;
  const cols = me.skills.length > 4 ? 3 : 2;

  // A panel opened over the stage, from the dock.
  const over = (title: string, body: React.ReactNode) => (
    <div className="stone-panel battle-over">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>{title}</span>
        <button className="chip" aria-label="Close" onClick={() => setOpen(null)} style={{ minHeight: 30, padding: "2px 10px" }}>✕</button>
      </div>
      {body}
    </div>
  );

  // One-on-one in a room: the room fills the whole stage, banners float over it.
  const roomStage = !foe.boss && !multi;

  return (
    <div className={`battle-layout${ill ? " screen-shake" : ""}`}>
      {/* ── The stage: everything above the dock ── */}
      <div className={`battle-stage${roomStage ? " battle-stage-room" : ""}`}>
        {ill && (
          <div className="stone-panel pixel-font battle-banner" style={{ color: "#d7a6ff", borderColor: "#b06cff" }}>
            🤢 Your {you.team[fx.index]?.name ?? "creature"} suffers an illness
          </div>
        )}
        {phaseText && !foe.boss && (
          <div className="stone-panel pixel-font battle-banner" style={{ color: "#ffd66e", borderColor: "#ffd66e" }}>⚠️ {phaseText}</div>
        )}
        {tip && !playing && <KlutzSays key={match.tutorial} say={tip.say} />}
        {state.turnLimit && !match.state.winner && (
          <div className="stone-panel pixel-font battle-banner" style={{ color: "#ff8a5c", borderColor: "#ff8a5c" }}>
            🧨 {Math.max(0, state.turnLimit - state.round)} round{state.turnLimit - state.round === 1 ? "" : "s"} until the room blows
          </div>
        )}
        {foe.boss && <BossStage side={foe} fx={fx} infos={info.B}
          you={<Fighter f={me} side="A" slot={you.active} mi={info.A[you.active]} fx={fx} at={{ left: "20%", width: "36%", bottom: 14 }} maxW="30cqw" />} />}

        {/* The fight, staged in a dungeon room (two enemies use the arena). */}
        {foe.boss ? null : !multi ? (
          <Stage me={me} mySlot={you.active} myInfo={info.A[you.active]} them={them} theirSlot={target} theirInfo={info.B[target]} fx={fx} />
        ) : (
          <div className="arena">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "start" }}>
              <FighterCard side="A" f={me} foe={them} info={info.A[you.active]} fx={fx} slot={you.active} details={open === "details"} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {fieldOf(foe).map((i) => (
                  <div key={i} onClick={!playing ? () => setTargetPick(i) : undefined}
                    style={{ cursor: !playing ? "pointer" : undefined, outline: i === target ? "2px solid #ffd66e" : undefined, outlineOffset: 2 }}>
                    {i === target && <div className="pixel-font" style={{ fontSize: 11, color: "#ffd66e", marginBottom: 2 }}>🎯 Target</div>}
                    <FighterCard side="B" f={foe.team[i]} foe={me} info={info.B[i]} fx={fx} slot={i} compact details={open === "details"} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {open === "details" && over(me.name, (
          <>
            <div style={{ fontSize: 12, color: MUTED }}>⚔️ {info.A[you.active].weaponName ?? "no weapon"} · 🛡️ {info.A[you.active].armorName ?? "no armour"} · {info.A[you.active].label}</div>
            <StatsLine stats={combatSummary(me)} />
          </>
        ))}
        {open === "log" && over("Battle log", <BattleLog log={match.state.log} />)}
        {open === "bag" && bag.length > 0 && onUseItem && over("Battle Bag", (
          <>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Uses your turn, on your {me.name}.</div>
            <div style={{ display: "grid", gap: 6 }}>
              {bag.map((it) => it.weapon ? (
                <button key={it.key} className="card-btn" disabled={playing}
                  onClick={() => { onUseItem(it.key, you.active); act({ kind: "weapon", name: it.name, weapon: it.weapon! }); }}>
                  {it.icon} Swap to {it.name} <span style={{ fontSize: 12, color: MUTED }}>{it.detail}</span>
                </button>
              ) : (
                <button key={it.key} className="card-btn" disabled={playing || me.hp >= me.maxHp}
                  onClick={() => { onUseItem(it.key, you.active); act({ kind: "item", item: it.name, heal: it.heal ?? 0 }); }}>
                  {it.potion ? <PotionIcon kind={it.potion} /> : it.icon} {it.name} ×{it.count} <span style={{ fontSize: 12, color: MUTED }}>{me.hp >= me.maxHp ? "full HP" : `+${Math.min(it.heal ?? 0, me.maxHp - me.hp)} HP`}</span>
                </button>
              ))}
            </div>
          </>
        ))}
        {/* Swap: just the creatures to pick from, each its picture over its HP. */}
        {open === "swap" && canSwap && over("Swap", (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {swapTargets(you).map((i) => {
              const f = you.team[i];
              const pct = (f.hp / f.maxHp) * 100;
              return (
                <button key={i} onClick={() => act({ kind: "swap", to: i })} disabled={playing} className="card-btn"
                  aria-label={`Swap to ${f.name}`} title={f.name} style={{ flexDirection: "column", alignItems: "stretch", gap: 0 }}>
                  <span style={{ display: "flex", justifyContent: "center" }}><Token name={f.name} rarity={info.A[i].rarity} creatureId={info.A[i].creatureId} /></span>
                  <Bar label="HP" value={`${f.hp}/${f.maxHp}`} pct={pct} color={pct > 50 ? "#22c55e" : pct > 25 ? "#f5c542" : "#ef4444"} />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── The dock: the bottom of the screen, where you act ── */}
      <div className="screen-dock battle-dock" data-over={finished}>
        {finished ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 10 }}>
            <div className="pixel-font" style={{ fontSize: 48, color: match.state.winner === "A" ? "#5ee08a" : match.state.winner === "B" ? FOE : "white" }}>
              {match.state.winner === "A" ? "Victory!" : match.state.winner === "B" ? "Defeat" : "Draw"}
            </div>
            <div style={{ fontSize: 14, color: MUTED }}>
              {match.state.winner === "B" && match.state.turnLimit && match.state.round >= match.state.turnLimit && aliveCount(you) > 0 ? "💥 The room collapses on you. " : ""}
              {match.state.round} rounds · {AI_LEVEL_LABELS[match.level]} AI
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 4 }}>{finishedActions}</div>
            <button className="chip" onClick={() => toggle("log")} style={{ minHeight: 44, padding: "2px 16px", fontSize: 15 }}>📜 Log</button>
          </div>
        ) : notStarted ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button className="pixel-btn tutorial-pulse" style={{ fontSize: 22, padding: "12px 34px" }} onClick={battle.beginTutorial}>⚔️ Fight!</button>
          </div>
        ) : mustReplace ? (
          <>
            <div className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>{me.name} fainted. Who&apos;s next?</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gap: 6, alignContent: "start" }}>
              {you.team.map((f, i) => f.hp > 0 && (
                <button key={i} onClick={() => onReplace(i)} className="card-btn">
                  <span>
                    <b style={{ color: rarityColor(info.A[i].rarity) }}>{f.name}</b>
                    <span style={{ color: MUTED, fontSize: 12 }}> · {f.hp}/{f.maxHp} HP · {Math.round(f.energy)}⚡</span>
                    {showEstimates && <span style={{ display: "block", fontSize: 12, color: MUTED }}>vs {them.name}: {matchupHint(f, them)}</span>}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Energy, thin, across the top of the dock. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: playing ? 0.6 : 1 }}>
              <span className="pixel-font" style={{ fontSize: 12, color: "#9cc8ff", whiteSpace: "nowrap" }}>⚡ {Math.round(me.energy)}</span>
              <div style={{ flex: 1, height: 7, background: "#0d0e12", border: "1px solid #000" }}>
                <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, me.energy))}%`, background: "#4EA1FF", transition: "width 0.45s ease-out" }} />
              </div>
              {multi && <span style={{ fontSize: 11, color: "#ffd66e", whiteSpace: "nowrap" }}>🎯 {them.name}</span>}
            </div>
            <div className="battle-moves" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, opacity: playing ? 0.6 : 1 }}>
              {me.skills.map((sk) => (
                <MoveButton key={sk.name} sk={sk} me={me} them={them} myAgil={myAgil} theirAgil={theirAgil}
                  glow={!playing && !!tip?.allow && tip.allow(sk)}
                  disabled={playing || !affordableSkills(me).includes(sk) || (locked && !!tip?.allow && !tip.allow(sk))} onClick={() => act({ kind: "attack", skillName: sk.name, target: multi ? target : undefined })} />
              ))}
            </div>
            <div className="dock-tabs">
              {resting && <button className="dock-tab" data-active onClick={() => act({ kind: "pass" })} disabled={playing}>💤 Rest</button>}
              <button className="dock-tab" data-active={open === "swap"} disabled={!canSwap} onClick={() => toggle("swap")}>⇄ Swap</button>
              {onUseItem && <button className="dock-tab" data-active={open === "bag"} disabled={bag.length === 0 || locked} onClick={() => toggle("bag")}>🎒 Bag{bagCount ? <span className="count">{bagCount}</span> : null}</button>}
              <button className="dock-tab" data-active={open === "log"} onClick={() => toggle("log")}>📜 Log</button>
              <button className="dock-tab" data-active={open === "details"} onClick={() => toggle("details")} aria-label="Details">ⓘ</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Damage a move would do (a precise move's damage when it lands).
function moveDamage(s: Skill, a: Fighter, d: Fighter): number {
  return calcDamage(s, a, d, s.effect?.kind === "precise").damage;
}

// Rough read of a matchup, for swap / replacement choices: best hit each way.
function matchupHint(mine: Combatant, them: Combatant): string {
  const best = (a: Combatant, d: Combatant) => Math.max(...a.skills.map((s) => moveDamage(s, a, d)));
  return `hits for ~${best(mine, them)}, takes ~${best(them, mine)}`;
}

// glow: the move Klutz wants you to use (the guided fight).
function MoveButton({ sk, me, them, myAgil, theirAgil, disabled, glow, onClick }: {
  sk: Skill; me: Combatant; them: Combatant; myAgil: number; theirAgil: number; disabled: boolean; glow?: boolean; onClick: () => void;
}) {
  const fx = sk.effect;
  // (No "strong against" hints: the class icons and the triangle are the clue.)
  const tags: string[] = ["Each hit varies ±5%."];
  const run = me.streak?.move === sk.name ? me.streak.hits + 1 : 1; // this use's place in the run
  if (run > STREAK_START) tags.push(`run ×${run}: ${Math.round(streakEffects({ ...me.streak!, hits: run }).preciseChance * 100)}% precise`);
  else if (run > 2) tags.push(`run ×${run} (armour gap from ×${STREAK_START + 1})`);
  if (fx?.kind === "precise") tags.push(`${Math.round(fx.hitChance * 100)}% to hit · always precise`);
  if (fx?.kind === "cripple") tags.push(`${Math.round(fx.chance * 100)}% to cripple: slower, ${Math.round(CRIPPLE.stumble * 100)}% to lose each attack`);
  if (fx?.kind === "dash") {
    tags.push(myAgil * (1 + fx.agilityBonus) > theirAgil ? "First Strike!" : "too slow to strike first");
  }
  if (fx?.kind === "pounce") tags.push(`strikes first${them.hp < them.maxHp / 2 ? ` · +${Math.round(fx.lowHpBonus * 100)}% vs wounded!` : ""}`);
  if (fx?.kind === "venom") tags.push(`venom: −${Math.round(fx.tick * 100)}% HP a round for ${fx.minRounds}–${fx.maxRounds} rounds`);
  if (fx?.kind === "mirage") tags.push(`${Math.round(fx.evade * 100)}% dodge for ${fx.rounds} rounds`);
  if (fx?.kind === "corpsify") tags.push(`rise again with ${Math.round(fx.reviveHp * 100)}% HP if knocked out`);
  if (fx?.kind === "barrage") tags.push("hits every enemy on the field");
  const cooling = me.cooldowns?.[sk.name] ?? 0;
  if (cooling > 0) tags.push(`recharging: ${cooling} round${cooling === 1 ? "" : "s"}`);
  const note = cooling > 0 ? { text: `recharging: ${cooling} round${cooling === 1 ? "" : "s"}`, color: "#ff8a80" }
    : sk.energyCost > me.energy ? { text: "not enough energy", color: "#ff8a80" }
    : undefined;
  const tile = <MoveTile m={sk} note={note} extra={tags} disabled={disabled} onClick={onClick} fill />;
  return glow ? <div className="move-glow">{tile}</div> : tile;
}

// A fighter's level, before its name ("Lv 8"). (No level: a level-15 creature, as everything used to be.)
function LevelTag({ level }: { level?: number }) {
  return <span style={{ color: "#f1d9a0", fontSize: "0.85em" }}>Lv {level ?? REF_LEVEL}</span>;
}

// Klutz, at the side of the guided fight, telling you what to do (pops up with each new tip).
function KlutzSays({ say }: { say: string }) {
  return (
    <div className="klutz-say" style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
      {CREATURE_SPRITES.klutz && <div style={{ flexShrink: 0 }}><PixelSprite sprite={CREATURE_SPRITES.klutz} scale={1.4} title="Klutz" /></div>}
      <div className="tutorial-tip speech" style={{ fontSize: 15, flex: 1 }}>
        <b>Klutz:</b> &ldquo;{say}&rdquo;
      </div>
    </div>
  );
}

// compact: a smaller card, when two share a column.
function FighterCard({ side, f, foe, info, fx, slot, compact, details = true }: {
  side: SideKey; f: Combatant; foe: Combatant; info: MemberInfo; fx: Fx | null; slot: number; compact?: boolean; details?: boolean;
}) {
  const color = side === "A" ? YOU : FOE;
  const hpPct = (f.hp / f.maxHp) * 100;
  const cripple = f.statuses.find((s) => s.id === "cripple");
  const haste = f.statuses.find((s) => s.id === "haste");
  const { anim, float } = fighterFx(side, slot, fx);
  return <FighterCardBody side={side} f={f} foe={foe} info={info} fx={fx} slot={slot} compact={compact} details={details} anim={anim} float={float}
    color={color} hpPct={hpPct} cripple={cripple} haste={haste} />;
}

// Which animation a creature plays for the current step, and any floating text.
export function fighterFx(side: SideKey, slot: number, fx: Fx | null): { anim: string; float: { text: string; color: string } | null } {
  const isMe = (i?: number) => i === undefined || i === slot;
  let anim = "";
  let float: { text: string; color: string } | null = null;
  if (fx) {
    if (fx.kind === "attack" && fx.side === side && isMe(fx.attackerIndex)) anim = side === "A" ? "anim-lunge-right" : "anim-lunge-left";
    if (fx.kind === "attack" && fx.side !== side && isMe(fx.targetIndex)) {
      anim = fx.missed ? "anim-dodge" : "anim-hit";
      float = fx.missed ? { text: "MISS", color: "#bbb" }
        : { text: `-${fx.damage}${fx.gap ? " ARMOUR GAP!" : fx.precise ? " PRECISE!" : ""}${fx.crippled ? " CRIPPLED!" : ""}`, color: fx.gap ? "#ff9f43" : fx.precise ? "#ffd84a" : fx.crippled ? "#d7a6ff" : "#ff7a6b" };
    }
    if ((fx.kind === "swap" || fx.kind === "sendIn" || fx.kind === "lineup") && fx.side === side) anim = "anim-swapin";
    if (fx.kind === "faint" && fx.side === side) anim = "anim-faint";
    if (fx.kind === "effect" && fx.side === side && isMe(fx.index)) {
      anim = fx.text === "RISES AGAIN!" ? "anim-swapin" : fx.text.includes("VENOM") ? "anim-hit" : "";
      float = { text: fx.text, color: fx.color };
    }
    if (fx.kind === "attack" && fx.side !== side && isMe(fx.targetIndex) && fx.missed && fx.evaded) float = { text: "MIRAGE!", color: "#c7b8ff" };
  }
  return { anim, float };
}

function FighterCardBody({ side, f, foe, info, fx, slot, compact, details, anim, float, color, hpPct, cripple, haste }: {
  side: SideKey; f: Combatant; foe: Combatant; info: MemberInfo; fx: Fx | null; slot: number; compact?: boolean; details: boolean;
  anim: string; float: { text: string; color: string } | null; color: string; hpPct: number;
  cripple?: Combatant["statuses"][number]; haste?: Combatant["statuses"][number];
}) {
  return (
    <div style={{ position: "relative" }}>
      <div key={`${fx?.id ?? 0}-${slot}`} className={`fighter-card ${anim}`} style={{ borderColor: `${color}88`, opacity: f.hp <= 0 ? 0.4 : 1, filter: f.hp <= 0 ? "grayscale(1)" : undefined }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Token name={f.name} rarity={info.rarity} creatureId={info.creatureId} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{side === "A" ? "You" : "Opponent"}</div>
            <div className="pixel-font" style={{ fontSize: "clamp(14px, 4cqw, 17px)", lineHeight: 1.1, overflowWrap: "anywhere" }}>
              <LevelTag level={f.level} /> <span style={{ color: rarityColor(info.rarity) }}>{f.name}</span> <span style={{ color: CLASS_INFO[f.cls].color }}>{CLASS_INFO[f.cls].icon}</span>
            </div>
            <div style={{ fontSize: 11, color: MUTED }}><span style={{ color: CLASS_INFO[f.cls].color }}>{CLASS_INFO[f.cls].icon} {CLASS_INFO[f.cls].name}</span>{details && side === "A" && <> · {info.label}</>}</div>
          </div>
        </div>
        {/* Opponents: just a health bar that goes down (no numbers, no energy). */}
        <Bar label="HP" value={side === "A" ? `${f.hp}/${f.maxHp}` : `${Math.max(0, Math.ceil(hpPct))}%`} pct={hpPct} color={hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f5c542" : "#ef4444"} />
        {side === "A" && <Bar label="Energy" value={`${Math.round(f.energy)}`} pct={f.energy} color="#4EA1FF" />}
        {cripple && <div style={{ fontSize: 11, color: "#d7a6ff", marginTop: 6 }}>🐌 Crippled (−{Math.round((cripple.loss ?? CRIPPLE_AGILITY_LOSS) * 100)}% agility) · {cripple.rounds} round{cripple.rounds === 1 ? "" : "s"} left</div>}
        {haste && <div style={{ fontSize: 11, color: "#7fe0ff", marginTop: 6 }}>⚡ Hasted (+{Math.round((haste.gain ?? 0) * 100)}% agility) · {haste.rounds} round{haste.rounds === 1 ? "" : "s"} left</div>}
        {f.statuses.filter((s) => s.id === "mirage" || s.id === "venom" || s.id === "corpsify").map((s) => (
          <div key={s.id} style={{ fontSize: 11, marginTop: 6, color: s.id === "venom" ? "#9be15d" : s.id === "mirage" ? "#c7b8ff" : "#9fd3a8" }}>
            {s.id === "venom" && <>🧪 Envenomed (−{s.dmg} HP a round) · {s.rounds} round{s.rounds === 1 ? "" : "s"} left</>}
            {s.id === "mirage" && <>✨ Mirage ({Math.round((s.chance ?? 0) * 100)}% to dodge) · {s.rounds} round{s.rounds === 1 ? "" : "s"} left</>}
            {s.id === "corpsify" && <>⚰️ Corpsified — rises again if knocked out</>}
          </div>
        ))}
        {f.stance !== "neutral" && <StanceBadge stance={f.stance} />}
        <StreakBadges f={f} foe={foe} slot={slot} />
        {details && side === "A" && !compact && (
          <div style={{ fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>
            ⚔️ {info.weaponName ?? "no weapon"}<br />🛡️ {info.armorName ?? "no armour"}
          </div>
        )}
        {details && side === "A" && <StatsLine stats={combatSummary(f)} />}
      </div>
      {float && <div key={`f${fx!.id}`} className="float-text pixel-font" style={{ color: float.color }}>{float.text}</div>}
    </div>
  );
}

// The armour-gap run: shown on the attacker ("Focus") and on the creature
// whose armour is being worn down.
// Stances change the damage a creature takes (and deals): see engine.ts.
function StanceBadge({ stance }: { stance: Fighter["stance"] }) {
  const text = stance === "float"
    ? "🪶 Floating — takes +10% damage from ranged attacks and −10% from melee"
    : "⛰️ Entrenched — takes +10% damage from melee attacks and −10% from ranged";
  return <div style={{ fontSize: 11, color: "#8fd3ff", marginTop: 6 }}>{text}</div>;
}

function StreakBadges({ f, foe, slot }: { f: Combatant; foe: Combatant; slot: number }) {
  const mine = f.streak && f.streak.hits >= 2 ? f.streak : null;
  const theirs = foe.streak && foe.streak.cracks > 0 && foe.streak.targetIdx === slot ? foe.streak : null;
  return (
    <>
      {mine && (
        <div style={{ fontSize: 11, color: "#ffb86b", marginTop: 6 }}>
          🎯 {mine.move} ×{mine.hits}
          {mine.hits >= STREAK_START
            ? ` · next: ${Math.round(streakEffects({ ...mine, hits: mine.hits + 1 }).preciseChance * 100)}% precise`
            : ` · gap opens after ×${STREAK_START}`}
        </div>
      )}
      {theirs && (
        <div style={{ fontSize: 11, color: "#ff9f43", marginTop: 4 }}>
          🛡️ Armour cracked: next precise hit ignores {Math.round(streakEffects(theirs).ignore * 100)}% of defence
        </div>
      )}
    </>
  );
}

// A creature's portrait in a rarity frame: its sprite, or its initials if
// it hasn't been drawn yet.
export function Token({ name, rarity, creatureId }: { name: string; rarity: Rarity; creatureId?: string }) {
  const c = RARITY_COLORS[rarity];
  const sprite = creatureId ? CREATURE_SPRITES[creatureId] : undefined;
  const initials = name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2);
  return (
    <span className="pixel-font" style={{
      width: "var(--token, 52px)", height: "var(--token, 52px)", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 18, color: c.text, background: `radial-gradient(circle, ${c.glow}, #15161c 75%)`, border: `3px solid ${c.border}`, boxShadow: `0 0 12px ${c.glow}`,
    }}>
      {sprite ? <PixelSprite sprite={sprite} scale={Math.max(1.5, 40 / spriteWidth(sprite))} title={name} /> : initials}
    </span>
  );
}

// ── Small pieces ──────────────────────────────────────────────────
export function StatsLine({ stats }: { stats: ReturnType<typeof combatSummary> }) {
  const r = Math.round;
  return (
    <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
      HP {stats.hp} · Atk {r(stats.atk)} · Rng {r(stats.rng)} · Mag {r(stats.mag)} · Agi {r(stats.agil)} · MDef {r(stats.mdef)} · RDef {r(stats.rdef)} · MgDef {r(stats.magdef)}
    </span>
  );
}

export function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 2 }}>
        <span>{label}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ height: 8, background: "#0d0e12", border: "1px solid #000" }}>
        <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: color, transition: "width 0.45s ease-out" }} />
      </div>
    </div>
  );
}

export function ActionBox({ title, children, dim }: { title: string; children: React.ReactNode; dim?: boolean }) {
  return (
    <div className="stone-panel" style={{ marginTop: 16, opacity: dim ? 0.6 : 1, transition: "opacity 0.2s" }}>
      <div className="pixel-font" style={{ fontSize: 17, color: "#f1d9a0", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="pixel-font" style={{ fontSize: 15, color: "#c9b48a", margin: "20px 0 8px" }}>{children}</div>;
}

export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className="chip" data-active={value === v}>{label}</button>
      ))}
    </div>
  );
}

// The fight in a dungeon room: your creature on the left, theirs on the right,
// each with a small health bar floating above. (Opponents: a percentage only.)
// The room fills the whole stage: the usual picture sits in the middle (the
// fighters stand on it, where they always have) and the ceiling and floor
// carry on above and below it, as far as the stage goes.
function Stage({ me, mySlot, myInfo, them, theirSlot, theirInfo, fx }: {
  me: Combatant; mySlot: number; myInfo: MemberInfo; them: Combatant; theirSlot: number; theirInfo: MemberInfo; fx: Fx | null;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // How much room to add on each side, in the room's layout units (rounded
  // up to steps of STAGE_EXTEND_STEP, so resizing doesn't redraw it each pixel).
  const unit = box.w ? box.w / (CW / 2) : 1; // screen px per layout unit
  const extra = box.w ? Math.max(0, (box.h - box.w * (CH / CW)) / 2 / unit) : 0;
  const ext = Math.ceil(extra / STAGE_EXTEND_STEP) * STAGE_EXTEND_STEP;
  const chamber = useMemo(() => createChamber({ tunnels: ["unknown"], seed: 7, extend: { above: ext, below: ext } }), [ext]);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const start = performance.now();
    const draw = () => ctx.putImageData(chamber.render((performance.now() - start) / 1000, 0, false), 0, 0);
    draw();
    const timer = window.setInterval(draw, 1000 / 10);
    return () => window.clearInterval(timer);
  }, [chamber]);

  // The usual picture, centred in the stage: the fighters stand on it.
  const picH = box.w * (CH / CW);
  const picTop = (box.h - picH) / 2;
  return (
    <div ref={boxRef} className="battle-room">
      <canvas ref={canvasRef} width={CW} height={chamber.height} aria-hidden
        style={{ position: "absolute", left: 0, width: "100%", top: picTop - ext * unit, height: picH + 2 * ext * unit, imageRendering: "pixelated", display: "block" }} />
      <div style={{ position: "absolute", left: 0, width: "100%", top: picTop, height: picH }}>
        <Fighter f={me} side="A" slot={mySlot} mi={myInfo} fx={fx} />
        <Fighter f={them} side="B" slot={theirSlot} mi={theirInfo} fx={fx} />
      </div>
    </div>
  );
}

// How big a fighter stands on the stage: STAGE_SCALE of the stage's own
// pixels, but never taller than STAGE_TALL of it (the big art, Aurelius or
// the Void Serpent, would fill the room). FIGHTER_W: its column's share.
const STAGE_SCALE = 2.2;
const STAGE_EXTEND_STEP = 8;
const STAGE_TALL = 0.4;
const FIGHTER_W = 0.4;
const stageWidth = (sprite: Sprite) => {
  const fit = Math.min(STAGE_SCALE, (STAGE_TALL * CH) / fineHeight(sprite));
  return `${Math.min(100, ((fineWidth(sprite) * fit) / CW / FIGHTER_W) * 100)}%`;
};

// A fighter's floating label: level, name and class, a small health bar
// (yours shows HP, theirs a percentage only) and any statuses.
export function FighterLabel({ f, side, mi }: { f: Combatant; side: SideKey; mi?: MemberInfo }) {
  const hpPct = Math.max(0, (f.hp / f.maxHp) * 100);
  const icons = [
    f.statuses.some((s) => s.id === "cripple") && "🐌", f.statuses.some((s) => s.id === "haste") && "⚡",
    f.statuses.some((s) => s.id === "venom") && "🧪", f.statuses.some((s) => s.id === "mirage") && "✨",
    f.statuses.some((s) => s.id === "corpsify") && "⚰️",
  ].filter(Boolean).join(" ");
  return (
    <>
      <div className="pixel-font" style={{ display: "flex", alignItems: "baseline", gap: 5, maxWidth: "100%", fontSize: "clamp(10px, 2.4cqw, 13px)", textShadow: "0 2px 0 #000", whiteSpace: "nowrap" }}>
        <LevelTag level={f.level} />
        <span style={{ color: mi ? rarityColor(mi.rarity) : "#fff", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{f.name}</span>
        <span style={{ color: CLASS_INFO[f.cls].color }} title={CLASS_INFO[f.cls].name}>{CLASS_INFO[f.cls].icon}</span>
      </div>
      <div style={{ width: "70%", minWidth: 70, height: 7, marginTop: 3, background: "rgba(0,0,0,0.75)", border: "1px solid #000", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, width: `${hpPct}%`, background: hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f5c542" : "#ef4444", transition: "width 0.35s" }} />
      </div>
      <div style={{ fontSize: 11, color: "#d8d4c8", textShadow: "0 1px 0 #000", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
        {side === "A" ? `${f.hp}/${f.maxHp}` : `${Math.ceil(hpPct)}%`}{icons && <span style={{ marginLeft: 4 }}>{icons}</span>}
      </div>
    </>
  );
}

// One fighter standing on the stage: its floating label over its sprite,
// reacting to this step. `at` places it (by default your side left of
// centre, theirs right); `maxW` caps the sprite's width (the boss's lair is
// crowded).
export function Fighter({ f, side, slot, mi, fx, at, maxW }: {
  f: Combatant; side: SideKey; slot: number; mi: MemberInfo; fx: Fx | null; at?: React.CSSProperties; maxW?: string;
}) {
    const { anim, float } = fighterFx(side, slot, fx);
    const sprite = mi.creatureId ? CREATURE_SPRITES[mi.creatureId] : undefined;
    const floats = !!sprite && !!artFor(sprite)?.floats && f.hp > 0;
    return (
      <div style={{ position: "absolute", bottom: "13%", left: side === "A" ? "27%" : "73%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", width: `${FIGHTER_W * 100}%`, ...at }}>
        <FighterLabel f={f} side={side} mi={mi} />
        <div key={`${fx?.id ?? 0}-${side}`} className={anim} style={{ position: "relative", marginTop: 4, ...(sprite && !maxW ? { width: stageWidth(sprite) } : {}), opacity: f.hp <= 0 ? 0.35 : 1, filter: f.hp <= 0 ? "grayscale(1)" : undefined }}>
          {/* One that floats hangs above its shadow, bobbing (while it's still up). */}
          <div className={floats ? "float-bob" : undefined}>
            {sprite
              ? <PixelSprite sprite={sprite} scale={3.6} title={f.name} style={{ ...(faceFoe(sprite, side) ? { transform: "scaleX(-1)" } : {}), ...(maxW ? { maxWidth: maxW, height: "auto" } : { width: "100%", height: "auto" }) }} />
              : <Token name={f.name} rarity={mi.rarity} creatureId={mi.creatureId} />}
          </div>
          {floats
            ? <div className="float-shadow" style={{ width: "60%", height: 8, margin: "34px auto 0" }} />
            : <div style={{ width: "80%", height: 8, margin: "-4px auto 0", background: "radial-gradient(ellipse, rgba(0,0,0,0.6), transparent 70%)" }} />}
          {float && <div key={`f${fx!.id}`} className="float-text pixel-font" style={{ color: float.color, top: 0 }}>{float.text}</div>}
        </div>
      </div>
    );
}
