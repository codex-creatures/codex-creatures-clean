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
import { findCreatureTemplate, RACE_INFO, type CreatureTemplate, type Skill } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { fighterFor } from "@/lib/creatures/instance";
import { combatSummary } from "@/lib/combat/loadout";
import { calcDamage, combatRules, type CombatItem, type Fighter } from "@/lib/combat/engine";
import { raceOfMove, raceVsAll } from "@/lib/combat/raceChart";
import { CRIPPLE, revivable } from "@/lib/combat/battle";
import { duelLevel } from "@/lib/pvp/formats";
import { MoveTile } from "./MoveTile";
import { RaceNames } from "./RaceTag";
import RaceChart from "./RaceChart";
import { attackHaptic, buzz } from "@/lib/haptics";
import { useEscape } from "@/hooks/useEscape";
import { createChamber, CW, CH } from "@/lib/dungeon/chamber";
import {
  createBattle, resolveRound, sendInReplacement, cloneBattle,
  activeOf, affordableSkills, swapTargets, currentAgility, changeActive, attackTargets, fieldOf, aliveCount,
  CRIPPLE_ROUNDS, SOAK_ROUNDS, perfectionistBonus,
  type BattleAction, type BattleEvent, type BattleState, type Combatant, type GroundEffect, type SideKey,
} from "@/lib/combat/battle";
import { cloudLeft, type BossKind } from "@/lib/combat/bossAi";
import GroundEffects from "./GroundEffects";
import { ILLNESS_DAMAGE } from "@/lib/dungeon/run";
import { effectiveOn } from "@/lib/quest";
import { REF_LEVEL } from "@/lib/creatures/levels";
import { chooseAiAction, chooseAiReplacement, AI_LEVEL_LABELS, type AiLevel } from "@/lib/combat/thinkingAi";
import { RARITIES } from "@/lib/items/gear";
import { saveBattle, type BattleMember } from "@/lib/battleHistory";
import BattleLog, { FOE } from "@/components/BattleLog";
import BossStage from "@/components/BossStage";
import { hasTeams, readTeams } from "@/lib/teams";
import PixelSprite, { PotionIcon } from "@/components/PixelSprite";
import { CREATURE_SPRITES, fightSprite } from "@/lib/sprites/creatures";
import { spriteWidth, type Sprite } from "@/lib/sprites/pixels";
import { artFor, flipToFace, fineWidth, fineHeight } from "@/lib/sprites/art";
import Glyph from "./Glyph";
import { loadTavern } from "@/lib/tavern";
import { trainingId } from "@/lib/trainingPit";

// Fighters face each other: yours (on the left) look right, theirs look left.
// Most art faces left, so yours is mirrored; art drawn facing right is the other way round.
const faceFoe = (sprite: Sprite, side: "A" | "B") => flipToFace(sprite, side === "A"); // yours on the left face right; theirs face left

export const MUTED = "rgba(255,255,255,0.5)";

// The first quest's guided fight (your creature against the thief): Klutz
// watches from the side and talks you through races. It opens on a Fight! button (step -1); each
// step after that: what he says, and which moves you can pick — they glow
// (null = any, and you can swap and use the bag again). chart: the race
// chart's button glows. The thief's race is one your creature's moves beat
// (thiefRace, lib/quest.ts), so the first step always has a move to glow.
type TutorialStep = { say: string; allow: ((s: Skill) => boolean) | null; chart?: boolean };
export function tutorialSteps(me: Combatant, them: Combatant): TutorialStep[] {
  const races = them.races ?? [];
  const theirs = races.map((r) => RACE_INFO[r].name).join(" / ");
  const good = me.skills.find((s) => effectiveOn(s, races));
  const goodRace = good && raceOfMove(good);
  return [
    { say: good && goodRace
        ? `Right: that thief's a ${theirs}, and ${RACE_INFO[goodRace].name} moves are effective against ${theirs}s. Your ${me.name} knows one: hit it with ${good.name}!`
        : "Right: that's a big lump of a thief. Hit it!",
      allow: good ? (s) => effectiveOn(s, races) : null },
    { say: good
        ? `EFFECTIVE! Every creature has a race or two, and so does every codex move: pick ones its races are weak to. Not sure what beats what? Tap ▲▼ below for the race chart. Now finish it off — your call!`
        : `Every creature has a race or two. Your own moves are neutral: they land the same on everyone. Moves from codexes carry a race, and that's where the race chart (▲▼ below) comes in. Now finish it off — your call!`,
      allow: null, chart: true },
  ];
}
const tutorialLocked = (m: Match) => m.tutorial !== undefined && (m.tutorial < 0 || (m.tutorial === 0 && tutorialSteps(activeOf(m.state.sides.A), activeOf(m.state.sides.B))[0].allow !== null));
const STEP_MS = { attack: 950, other: 650, phase: 4200 }; // phase: a boss's phase-change scene

// What the screen shows about each team member (gear names etc.).
// creatureId: for its sprite (fights saved before sprites show initials).
export type MemberInfo = { rarity: Rarity; label: string; weaponName?: string; armorName?: string; creatureId?: string };
// gear: everything it wears (weapon and armour pieces), for the duel formats' rarity screen.
export type OwnedCreature = MemberInfo & {
  id: string; name: string; template: CreatureTemplate; roster: boolean;
  weaponRarity?: Rarity; armorRarity?: Rarity; fighter: Fighter; gear: { name: string; rarity: Rarity }[];
  away?: boolean; // in the Training Pit (only listed with withAway)
};

export type Match = {
  state: BattleState;                 // the real battle
  info: Record<SideKey, MemberInfo[]>;
  teams: Record<SideKey, Fighter[]>;  // for rematches and the history
  level: AiLevel;                     // how well the opponent plays
  title?: string;                     // e.g. "Dungeon room 3", shown in the history
  tutorial?: number;                  // the guided first fight: which step you're on (tutorialSteps; -1 = not started)
  opponent?: string;                  // a duel: the other player's name (no AI)
};

// The animation currently playing. Indexes say which creature (team index)
// when a side has two on the field.
export type Fx =
  | { id: number; kind: "attack"; side: SideKey; damage: number; precise: boolean; missed: boolean; crippled: boolean;
      attackerIndex?: number; targetIndex?: number; evaded?: boolean; landed?: Landed;
      caption: string; move: string; style: Skill["type"] } // caption: who used it ("Foe's Moss Wolf used"); move: what, in its style's colour
  | { id: number; kind: "swap" | "sendIn" | "faint"; side: SideKey }
  | { id: number; kind: "effect"; side: SideKey; index: number; text: string; color: string; caption?: string }
  | { id: number; kind: "lineup"; side: SideKey; text?: string };

export function rarityColor(r?: Rarity) {
  return r ? RARITY_COLORS[r].text : "white";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Your creatures as they fight: gear, moves and rolled %s from the save.
// Roster first (creatures in a team; until you've made a team, the old ★
// roster), then rarest. atLevel: build them at that level instead
// of their own (a duel's format level: lib/pvp/formats.ts).
// atLevel: a duel's level (lib/pvp/formats.ts duelLevel): everyone at it
// (scaleUp), or those above it brought down to it. A creature in the
// Training Pit is away training (lib/trainingPit.ts), so it isn't listed
// (withAway: it is, marked away, for a picker to show greyed out).
export function loadOwnedCreatures(atLevel?: number, scaleUp = true, withAway = false): OwnedCreature[] {
  const save = loadSave();
  const away = trainingId(loadTavern());
  const inv = save?.inventory ?? [];
  const teams = readTeams(save?.teams);
  const favs = new Set(hasTeams(teams) ? teams.flat() : save?.favoriteIds ?? []);
  const equipment = save?.equipment ?? {};
  const items = new Map(inv.filter(isItemDrop).map((d) => [d.id, d as CreatureOrItemDrop]));

  const list: OwnedCreature[] = [];
  for (const d of inv.filter(isCreatureDrop)) {
    const t = findCreatureTemplate(d.creatureId, d.name);
    if (!t || (d.id === away && !withAway)) continue;
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
      fighter: fighterFor(atLevel ? { ...d, level: duelLevel(d.level ?? 1, { level: atLevel, scaleUp }) } : d, t, w?.stats, pieces, equipment[d.id]?.moves, w?.itemKey),
      gear: [w, ...worn].filter((g): g is CreatureOrItemDrop => !!g).map((g) => ({ name: g.name, rarity: g.rarity })),
      ...(d.id === away ? { away: true } : {}),
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
      if (e.crippled) target.statuses = [...target.statuses.filter((s) => s.id !== "cripple"), { id: "cripple", rounds: e.crippleRounds ?? CRIPPLE_ROUNDS, loss: e.crippleLoss }];
      if (e.venom) target.statuses = [...target.statuses.filter((s) => s.id !== "venom"), { ...e.venom }];
      if (e.sealed) target.statuses = [...target.statuses.filter((s) => s.id !== "seal"), { id: "seal", rounds: e.sealed }];
      if (e.soaked) target.statuses = [...target.statuses.filter((s) => s.id !== "soak"), { id: "soak", rounds: SOAK_ROUNDS, loss: e.soaked }];
      if (e.poisoned) attacker.statuses = [...attacker.statuses.filter((s) => s.id !== "poison"), { ...e.poisoned }];
      if (e.braced) target.statuses = target.statuses.filter((s) => s.id !== "brace");
      break;
    }
    case "ground":
      view.sides[e.side].ground = e.ground.map((g) => ({ ...g }));
      break;
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

export function historyMembers(m: Match, k: SideKey): BattleMember[] {
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
// history: false keeps finished fights out of the battle history (the /lab pages).
export function usePlayableBattle(onUpdate?: (m: Match) => void, { history = true }: { history?: boolean } = {}) {
  const [match, setMatchStateRaw] = useState<Match | null>(null);
  const [view, setView] = useState<BattleState | null>(null); // on-screen copy while a round plays
  const [fx, setFx] = useState<Fx | null>(null);
  const alive = useRef(true);
  // The latest settled match, and the rounds waiting to be shown (show(): a duel's rounds come from the host).
  const latest = useRef<Match | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  function setMatchState(m: Match | null) {
    latest.current = m;
    setMatchStateRaw(m);
  }
  function setMatch(m: Match | null) {
    setMatchState(m);
    if (m) onUpdate?.(m);
  }

  // startHp: your creatures' HP if they start hurt.
  // boss: the opponent is that dungeon boss (played by its script).
  // illnesses: your creatures that are sick (the witch's curse), each for this many rounds (they stack: decision 39).
  // tutorial: the first quest's guided fight (see tutorialSteps).
  // pair: their first two are both on the field (an ambush). turnLimit: the
  // room blows after this many rounds (see BattleState.turnLimit).
  function start(teams: Match["teams"], info: Match["info"], level: AiLevel,
    opts: { startHp?: number[]; title?: string; boss?: BossKind; illnesses?: { index: number; rounds: number }[]; tutorial?: boolean; pair?: boolean; turnLimit?: number } = {}) {
    setView(null);
    setFx(null);
    const state = createBattle(teams.A, teams.B, { A: opts.startHp }, opts.boss, { pairB: opts.pair, turnLimit: opts.turnLimit });
    for (const ill of opts.illnesses ?? []) {
      const sick = state.sides.A.team[ill.index];
      if (sick && ill.rounds > 0) sick.statuses.push({ id: "illness", rounds: ill.rounds, dmg: Math.max(1, Math.round(sick.maxHp * ILLNESS_DAMAGE)) });
    }
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
    if (after.winner && history) {
      saveBattle({
        id: crypto.randomUUID(), date: new Date().toISOString(), winner: after.winner, rounds: after.round, title: match.title,
        teams: { A: historyMembers(done, "A"), B: historyMembers(done, "B") }, log: after.log,
      });
    }
    onUpdate?.(done); // saved straight away, so leaving mid-replay doesn't undo the round
    await playOut(before, done);
  }

  // A new state worked out elsewhere (a duel's host): played out after
  // anything still showing, like a round against the AI.
  function show(next: BattleState) {
    queue.current = queue.current.then(() => {
      const m = latest.current;
      if (!m || !alive.current) return;
      if (next.log.length < m.state.log.length) { setMatchState({ ...m, state: next }); return; } // (a fresh copy: nothing to replay)
      return playOut(m.state, { ...m, state: next });
    });
  }

  // Play the events between two states one at a time, then settle on the second.
  async function playOut(before: BattleState, done: Match) {
    const after = done.state;
    let shown = cloneBattle(before);
    setView(shown);
    let n = 0;
    for (const e of after.log.slice(before.log.length)) {
      if (e.type === "round" || e.type === "end" || e.type === "pass") continue;
      if (e.type === "ground") { shown = cloneBattle(shown); applyEvent(shown, e); setView(shown); continue; } // (the pool shows as it changes)
      shown = cloneBattle(shown);
      applyEvent(shown, e);
      setView(shown);
      setFx(e.type === "attack"
        ? { id: ++n, kind: "attack", side: e.side, damage: e.damage, precise: e.precise, missed: e.missed, crippled: e.crippled,
            attackerIndex: e.attackerIndex, targetIndex: e.targetIndex, evaded: e.evaded, caption: `${e.side === "B" ? "Foe's " : ""}${e.attacker} used`,
            move: e.skill.name, style: e.skill.type,
            landed: hitLanding(e.skill, shown.sides[e.side === "A" ? "B" : "A"].team[e.targetIndex ?? shown.sides[e.side === "A" ? "B" : "A"].active]) }
        : e.type === "lineup" ? { id: ++n, kind: "lineup", side: e.side, text: e.text }
        : e.type === "effect" ? { id: ++n, kind: "effect", side: e.side, index: e.index,
            ...(e.kind === "self" ? { caption: `${e.side === "B" ? "Foe's " : ""}${e.name} used ${e.text.split(" — ")[0].replace(/^uses /, "")}` } : {}),
            text: e.kind === "illness" ? `-${e.damage} ILLNESS` : e.kind === "venom" ? `-${e.damage} VENOM` : e.kind === "poison" ? `-${e.damage} POISON` : e.kind === "fear" ? "FEAR!" : e.kind === "revive" ? "RISES AGAIN!" : e.kind === "item" || e.kind === "heal" ? `+${e.damage} HP` : e.kind === "stumble" ? "STUMBLES!" : e.kind === "poisoned" ? "POISONED!" : e.kind === "regrow" ? "GROWS BACK!" : e.kind === "blood" ? `-${e.damage} BLOOD` : e.kind === "burst" ? `-${e.damage} BURST!` : `${e.text.split(" — ")[0].replace(/^uses /, "").toUpperCase()}!`,
            color: e.kind === "illness" ? "#b06cff" : e.kind === "blood" || e.kind === "burst" ? "#ff4d5e" : e.kind === "venom" || e.kind === "poison" || e.kind === "poisoned" ? "#9be15d" : e.kind === "fear" ? "#b9e6ff" : e.kind === "revive" || e.kind === "regrow" ? "#9fd3a8" : e.kind === "item" || e.kind === "heal" ? "#5ee08a" : e.kind === "stumble" ? "#d7a6ff" : "#c7b8ff" }
        : { id: ++n, kind: e.type, side: e.side });
      if (e.type === "attack") buzz(attackHaptic(e)); // (Settings → Vibration; off unless switched on)
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

  return { match, view, fx, start, resume, act, replace, beginTutorial, show, clear: () => setMatchState(null) };
}

// ── Battle screen ─────────────────────────────────────────────────
// ── Battle screen ─────────────────────────────────────────────────
// finishedActions: the buttons shown when the battle is over.
// bag: battle-bag items you can use, one entry per kind (count = how many);
// onUseItem(key, activeIndex) takes it out of the bag when you use it
// (activeIndex: your creature on the field, by team order).
// A potion has heal; a weapon has weapon (its combat stats) and detail; a
// Revival Elixir has revive (the share of HP it brings a knocked-out teammate
// back with: onUseItem gets that teammate's index).
export type BagItem = { key: string; name: string; icon: string; potion?: "potion" | "lesser"; count: number; heal?: number; weapon?: CombatItem; detail?: string; revive?: number };

// showEstimates: the "hits for ~X, takes ~Y" swap hints (until your first
// Cyclops; after that you're on your own).
// raceChart: a dock button for the race chart (Labyrinth runs, while you learn the races).
// A duel: waiting (your choice is in, the other player's isn't), and clock
// (seconds left to choose, shown at the end of the energy line).
export function BattleView({ battle, finishedActions, bag = [], onUseItem, showEstimates = true, raceChart, waiting, clock }: {
  battle: ReturnType<typeof usePlayableBattle>; finishedActions: React.ReactNode;
  bag?: BagItem[]; onUseItem?: (key: string, activeIndex: number) => void; showEstimates?: boolean; raceChart?: boolean;
  waiting?: boolean; clock?: number;
}) {
  const [targetPick, setTargetPick] = useState<number | null>(null);
  // What's opened over the stage (from the dock's tabs): the bag, a swap, the log, details, the race chart.
  const [open, setOpen] = useState<"bag" | "swap" | "log" | "details" | "races" | null>(null);
  const toggle = (k: NonNullable<typeof open>) => setOpen((o) => (o === k ? null : k));
  useEscape(open ? () => setOpen(null) : null);
  const match = battle.match!;
  const { info } = match;
  const replaying = battle.view !== null;
  const playing = replaying || !!waiting; // (moves and swaps are off either way)
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
  const rival = match.opponent ?? "the other player";
  const waitText = waiting && !replaying ? `Waiting for ${rival}…` : undefined;
  const phaseText = fx?.kind === "lineup" ? fx.text : undefined;

  const myAgil = currentAgility(me), theirAgil = currentAgility(them);
  // The guided fight: Klutz's tip, and which moves you can pick right now.
  const steps = match.tutorial !== undefined ? tutorialSteps(me, them) : [];
  const tip = match.tutorial !== undefined && match.tutorial >= 0 && match.tutorial < steps.length && you.active === 0 ? steps[match.tutorial] : undefined;
  const notStarted = match.tutorial === -1;
  const locked = tutorialLocked(match) && you.active === 0;
  // The witch's illness biting: the screen shakes.
  const ill = fx?.kind === "effect" && fx.text.includes("ILLNESS");
  const act = (a: Parameters<typeof onAct>[0]) => { setOpen(null); onAct(a); };
  const canSwap = swapTargets(you).length > 0 && !locked;
  const bagCount = bag.reduce((n, it) => n + it.count, 0);
  const cols = me.skills.length > 4 ? 3 : 2;
  // There's no Rest button: every set of moves keeps one it can always afford
  // (isSteadyMove). Should a creature still find nothing affordable, it rests by itself.
  const stuck = affordableSkills(me).length === 0 && !playing && !finished && !mustReplace && !notStarted;
  useEffect(() => { if (stuck) onAct({ kind: "pass" }); }, [stuck]); // eslint-disable-line react-hooks/exhaustive-deps
  // What's happening now, in words ("Moss Wolf used Gore"), while a round plays out.
  const caption = (replaying && fx && "caption" in fx ? fx.caption : undefined) ?? waitText;
  const captionMove = replaying && fx?.kind === "attack" ? fx : undefined; // the move, in its style's colour

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

  // In a room (one foe, or an ambush's two): the room fills the whole stage, banners float over it.
  const roomStage = !foe.boss;

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
        {foe.boss && <BossStage side={foe} fx={fx} infos={info.B} target={target} onTarget={!playing ? setTargetPick : undefined} cloud={cloudLeft(state, "B")} ground={foe.ground}
          you={<Fighter f={me} side="A" slot={you.active} mi={info.A[you.active]} fx={fx} at={{ left: "20%", width: "36%", bottom: 4 }} maxW="30cqw" />} />}

        {/* The fight, staged in a dungeon room. Two foes (an ambush) stand side by side: tap the one to hit, like the boss's hands. */}
        {!foe.boss && (
          <Stage me={me} mySlot={you.active} myInfo={info.A[you.active]} fx={fx}
            foes={multi ? fieldOf(foe) : [target]} theirInfo={info.B} foeTeam={foe.team}
            target={multi ? target : undefined} onTarget={multi && !playing ? setTargetPick : undefined} myGround={you.ground} foeGround={foe.ground} />
        )}

        {open === "details" && over(me.name, (
          <>
            <div style={{ fontSize: 12, color: MUTED }}>⚔️ {info.A[you.active].weaponName ?? "no weapon"} · 🛡️ {info.A[you.active].armorName ?? "no armour"} · {info.A[you.active].label}</div>
            <StatsLine stats={combatSummary(me)} />
          </>
        ))}
        {open === "log" && over("Battle log", <BattleLog log={match.state.log} />)}
        {open === "races" && over("Race chart", <RaceChart />)}
        {open === "bag" && bag.length > 0 && onUseItem && over("Battle Bag", (
          <>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Uses your turn, on your {me.name}.</div>
            <div style={{ display: "grid", gap: 6 }}>
              {bag.map((it) => it.revive ? (
                // A Revival Elixir: one button per knocked-out teammate (none down: greyed).
                revivable(you).length === 0
                  ? <button key={it.key} className="card-btn" disabled>{it.icon} {it.name} <span style={{ fontSize: 12, color: MUTED }}>nobody&apos;s knocked out</span></button>
                  : revivable(you).map((i) => (
                    <button key={`${it.key}-${i}`} className="card-btn" disabled={playing}
                      onClick={() => { onUseItem(it.key, i); act({ kind: "item", item: it.name, heal: 0, revive: { index: i, share: it.revive! } }); }}>
                      {it.icon} {it.name} on {you.team[i].name} <span style={{ fontSize: 12, color: MUTED }}>back with {Math.max(1, Math.round(you.team[i].maxHp * it.revive!))} HP</span>
                    </button>
                  ))
              ) : it.weapon ? (
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
              {match.state.round} rounds · {match.opponent ? `vs ${match.opponent}` : `${AI_LEVEL_LABELS[match.level]} AI`}
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
            {/* Energy, thin, across the top of the dock. While a round plays
                out, the same line says who used what. (A fixed height either way.) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 20 }}>
              {caption ? (
                <span className="pixel-font" title={captionMove ? `${caption} ${captionMove.move}` : caption} style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 14, color: "#f1d9a0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {caption}{captionMove && <> <span style={{ color: STYLE_COLOR[captionMove.style] }}>{captionMove.move}</span></>}
                </span>
              ) : (
                <>
                  <span className="pixel-font" style={{ fontSize: 12, color: "#9cc8ff", whiteSpace: "nowrap", opacity: playing ? 0.6 : 1 }}>⚡ {Math.round(me.energy)}</span>
                  <div style={{ flex: 1, height: 7, background: "#0d0e12", border: "1px solid #000", opacity: playing ? 0.6 : 1 }}>
                    <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, me.energy))}%`, background: "#4EA1FF", transition: "width 0.45s ease-out" }} />
                  </div>
                  {multi && <span style={{ fontSize: 11, color: "#ffd66e", whiteSpace: "nowrap", maxWidth: "40%", overflow: "hidden", textOverflow: "ellipsis" }}>🎯 {them.name}</span>}
                </>
              )}
              {clock !== undefined && <DuelClock seconds={clock} />}
            </div>
            <div className="battle-moves" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, opacity: playing ? 0.6 : 1 }}>
              {me.skills.map((sk) => (
                <MoveButton key={sk.name} sk={sk} me={me} them={them} myAgil={myAgil} theirAgil={theirAgil}
                  glow={!playing && !!tip?.allow && tip.allow(sk)}
                  disabled={playing || !affordableSkills(me).includes(sk) || (locked && !!tip?.allow && !tip.allow(sk))} onClick={() => act({ kind: "attack", skillName: sk.name, target: multi ? target : undefined })} />
              ))}
            </div>
            <div className="dock-tabs">
              <button className="dock-tab" data-active={open === "swap"} disabled={!canSwap} onClick={() => toggle("swap")}>⇄ Swap</button>
              {onUseItem && <button className="dock-tab" data-active={open === "bag"} disabled={bag.length === 0 || locked} onClick={() => toggle("bag")}>🎒 Bag{bagCount ? <span className="count">{bagCount}</span> : null}</button>}
              <button className="dock-tab" data-active={open === "log"} onClick={() => toggle("log")}>📜 Log</button>
              {raceChart && <button className={`dock-tab${tip?.chart && open !== "races" ? " tutorial-pulse" : ""}`} data-active={open === "races"} onClick={() => toggle("races")} aria-label="Race chart">▲▼</button>}
              <button className="dock-tab" data-active={open === "details"} onClick={() => toggle("details")} aria-label="Details">ⓘ</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// A duel's time left to choose (red near the end).
export function DuelClock({ seconds }: { seconds: number }) {
  const s = Math.max(0, Math.ceil(seconds));
  return <span className="pixel-font" style={{ fontSize: 13, color: s <= 5 ? "#ff8a80" : "#f1d9a0", whiteSpace: "nowrap", minWidth: "3.2em", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>⏱ {s}s</span>;
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

// How this move's race lands on the target's races (Combat V2): undefined
// when neutral (or races are off, or the target has none).
type Landed = "effective" | "resisted" | "weak";
// How a hit lands: on a boss part's weak spot, or how its race lands.
function hitLanding(sk: Skill, them?: Combatant): Landed | undefined {
  return them?.weakTo && them.weakTo === sk.type ? "weak" : raceLanding(sk, them);
}
function raceLanding(sk: Skill, them?: Combatant): Landed | undefined {
  const r = combatRules().races && !sk.self ? raceOfMove(sk) : undefined;
  const m = r && them?.races?.length ? raceVsAll(r, them.races) : 1;
  return m > 1 ? "effective" : m < 1 ? "resisted" : undefined;
}

// The same, in words, for a move's details.
function raceMatchup(sk: Skill, them: Combatant): string | undefined {
  const r = combatRules().races && !sk.self ? raceOfMove(sk) : undefined;
  if (!r || !them.races?.length) return undefined;
  const m = raceVsAll(r, them.races);
  const how = raceLanding(sk, them) ?? "neutral";
  return `${RACE_INFO[r].name} vs ${them.races.map((x) => RACE_INFO[x].name).join(" / ")}: ${how}${m !== 1 ? ` (×${m.toFixed(2)})` : ""}`;
}

// glow: the move Klutz wants you to use (the guided fight).
function MoveButton({ sk, me, them, myAgil, theirAgil, disabled, glow, onClick }: {
  sk: Skill; me: Combatant; them: Combatant; myAgil: number; theirAgil: number; disabled: boolean; glow?: boolean; onClick: () => void;
}) {
  const fx = sk.effect;
  // (No "strong against" hints on the tile itself: the races are the clue. The
  // matchup is on its details side, behind the (i).)
  const tags: string[] = ["Each hit varies ±5%."];
  const vs = raceMatchup(sk, them);
  if (vs) tags.push(vs);
  const run = me.streak?.move === sk.name ? me.streak.hits + 1 : 1; // this use's place in the run
  const perfect = perfectionistBonus(me, { move: sk.name, hits: run });
  if (perfect > 1) tags.push(`Perfectionist: +${Math.round((perfect - 1) * 100)}% (×${run} in a row)`);
  if (fx?.kind === "precise") tags.push(`${Math.round(fx.hitChance * 100)}% to hit · always precise`);
  if (fx?.kind === "cripple") tags.push(`${Math.round(fx.chance * 100)}% to cripple: slower, ${Math.round(CRIPPLE.stumble * 100)}% to lose each attack`);
  if (fx?.kind === "dash") {
    tags.push(myAgil * (1 + fx.agilityBonus) > theirAgil ? "First Strike!" : "too slow to strike first");
  }
  if (fx?.kind === "pounce") tags.push(`strikes first${them.hp < them.maxHp / 2 ? ` · +${Math.round(fx.lowHpBonus * 100)}% vs wounded!` : ""}`);
  if (fx?.kind === "quick") tags.push("strikes first");
  if (fx?.kind === "venom") tags.push(`venom: −${Math.round(fx.tick * 100)}% HP a round for ${fx.minRounds}–${fx.maxRounds} rounds`);
  if (fx?.kind === "mirage") tags.push(`${Math.round(fx.evade * 100)}% dodge for ${fx.rounds} rounds`);
  if (fx?.kind === "corpsify") tags.push(`rise again with ${Math.round(fx.reviveHp * 100)}% HP if knocked out`);
  if (fx?.kind === "barrage") tags.push("hits every enemy on the field");
  if (fx?.kind === "seal") tags.push(`${fx.chance < 1 ? `${Math.round(fx.chance * 100)}% chance: ` : ""}no swapping out for ${fx.rounds}${fx.extraChance ? `–${fx.rounds + 1}` : ""} rounds`);
  if (fx?.kind === "meditate") tags.push(`+${fx.energy} energy`);
  if (fx?.kind === "blessing") tags.push(`next round: heals ${Math.round(fx.heal * 100)}% HP`);
  if (fx?.kind === "soak") tags.push(`defences −${Math.round(fx.cut * 100)}% until it swaps out`);
  if (fx?.kind === "brace") tags.push(`goes first · next hit −${Math.round(fx.cut * 100)}%`);
  if (fx?.kind === "empower") tags.push(me.boost?.[fx.style] ? "already blessed" : `+${Math.round(fx.boost * 100)}% ${fx.style} attack while it stays out`);
  if (fx?.kind === "blood") tags.push(`costs ${Math.round(fx.cost * 100)}% HP · blood under the foes`);
  // The 2026-11 codex moves.
  const pc = (x: number) => `${Math.round(x * 100)}%`;
  if (sk.mult && sk.mult !== 1) tags.push(`${sk.mult}× damage`);
  if (fx?.kind === "agility") tags.push(`then +${pc(fx.gain)} agility for the fight`);
  if (fx?.kind === "weaken") tags.push(fx.forceSwap ? `${pc(fx.forceSwap)}: they flee · else attacks −${pc(fx.loss)}` : `their ${fx.style ?? "attacks"} −${pc(fx.loss)} while out`);
  if (fx?.kind === "smoke") tags.push("strikes first, then swaps out");
  if (fx?.kind === "lifesteal") tags.push(`heals ${pc(fx.share)} of the damage`);
  if (fx?.kind === "chain") tags.push(`+${pc(fx.step)} each time in a row${run > 1 ? ` (now +${pc(Math.min(fx.cap, fx.step * (run - 1)))})` : ""}`);
  if (fx?.kind === "ward") tags.push(`no status effects for ${fx.rounds} rounds`);
  if (fx?.kind === "bleed") tags.push(`${fx.chance < 1 ? `${pc(fx.chance)}: ` : ""}bleeds ${pc(fx.tick)} a round while out`);
  if (fx?.kind === "caltrops") tags.push(`each comer loses ${pc(fx.entry)} HP`);
  if (fx?.kind === "cleanse") tags.push("washes your team clean");
  if (fx?.kind === "septic") tags.push(`×${fx.mult} if they bleed or stand in blood`);
  if (fx?.kind === "execute") tags.push(`+${pc(fx.bonus)} below ${pc(fx.below)} HP${them.hp < them.maxHp * fx.below ? "!" : ""}`);
  if (fx?.kind === "cloud") tags.push(`poison cloud: ${pc(fx.tick)} a round, ${fx.minRounds}–${fx.maxRounds} rounds`);
  if (fx?.kind === "ignite") tags.push(`×${fx.mult} on a cloud, and burns it`);
  if (fx?.kind === "ambush") tags.push(`strikes first · +${pc(fx.bonus)} at full HP${them.hp >= them.maxHp ? "!" : ""}`);
  if (fx?.kind === "surge") tags.push(me.surge ? "already surging" : `then +${pc(fx.gain)} magic damage for the fight`);
  if (fx?.kind === "poison") tags.push(`${pc(fx.chance)}: poison ${pc(fx.tick)} a round`);
  if (fx?.kind === "implode") tags.push("goes last · it falls · poison cloud");
  if (fx?.kind === "flamebody") tags.push(`melee attackers take ${pc(fx.reflect)} for ${fx.rounds} rounds`);
  if (fx?.kind === "gore") tags.push(`blood: toxic damage +${pc(fx.amp)} on them`);
  if (fx?.kind === "recoil") tags.push(`it takes ${pc(fx.share)} of the damage`);
  if (fx?.kind === "slap") tags.push(`${pc(fx.chance)}: wipes their stat changes`);
  if (fx?.kind === "charge") tags.push(me.statuses.some((s) => s.id === "charged") ? "wound up: strike now!" : "winds up, strikes next turn");
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

// Floating text over a creature: a hit's damage, in its style's colour, with
// how it landed (its race, or a boss's weak spot) on a smaller line under it.
type Float = { text: string; color: string; sub?: { text: string; color: string } };
const LANDED_TEXT: Record<Landed, { text: string; color: string }> = {
  effective: { text: "EFFECTIVE!", color: "#ff9a3c" },
  resisted:  { text: "RESISTED",   color: "#a8b0b8" },
  weak:      { text: "WEAK SPOT!", color: "#ff9a3c" },
};
// Each attack style's colour in a fight (the user, 2026-10-30): a move's name
// as it's used, and the damage it does.
export const STYLE_COLOR: Record<Skill["type"], string> = { melee: "#ff6b5e", ranged: "#6ee07a", magic: "#6fb4ff" };
export function FloatText({ float, top }: { float: Float; top?: number }) {
  return (
    <div className="float-text pixel-font" style={{ color: float.color, top, textAlign: "center" }}>
      {float.text}
      {float.sub && <div style={{ fontSize: "0.6em", color: float.sub.color }}>{float.sub.text}</div>}
    </div>
  );
}
// How long floating text stays up (.float-text in globals.css). Longer than a
// step, so it stays after the battle has moved on to the next thing.
const FLOAT_MS = 1900;
// A creature's floating text, kept on screen for FLOAT_MS after its step
// (a newer one on the same creature replaces it). id: the step's fx id.
export function LingeringFloat({ float, id, top }: { float: Float | null; id?: number; top?: number }) {
  const key = float && id !== undefined ? `${id}:${float.text}` : null;
  const [last, setLast] = useState<string | null>(null);
  const [shown, setShown] = useState<{ float: Float; n: number } | null>(null);
  if (key !== last) {
    setLast(key);
    if (float && key) setShown({ float, n: (shown?.n ?? 0) + 1 });
  }
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown((s) => (s === shown ? null : s)), FLOAT_MS);
    return () => clearTimeout(t);
  }, [shown]);
  return shown ? <FloatText key={shown.n} float={shown.float} top={top} /> : null;
}

// Which animation a creature plays for the current step, and any floating text.
export function fighterFx(side: SideKey, slot: number, fx: Fx | null): { anim: string; float: Float | null } {
  const isMe = (i?: number) => i === undefined || i === slot;
  let anim = "";
  let float: Float | null = null;
  if (fx) {
    if (fx.kind === "attack" && fx.side === side && isMe(fx.attackerIndex)) anim = side === "A" ? "anim-lunge-right" : "anim-lunge-left";
    if (fx.kind === "attack" && fx.side !== side && isMe(fx.targetIndex)) {
      anim = fx.missed ? "anim-dodge" : "anim-hit";
      float = fx.missed ? { text: "MISS", color: "#bbb" }
        : { text: `-${fx.damage}${fx.precise ? " PRECISE!" : ""}${fx.crippled ? " CRIPPLED!" : ""}`, color: fx.precise ? "#ffd84a" : fx.crippled ? "#d7a6ff" : STYLE_COLOR[fx.style],
            sub: fx.landed && LANDED_TEXT[fx.landed] };
    }
    if ((fx.kind === "swap" || fx.kind === "sendIn" || fx.kind === "lineup") && fx.side === side) anim = "anim-swapin";
    if (fx.kind === "faint" && fx.side === side) anim = "anim-faint";
    if (fx.kind === "effect" && fx.side === side && isMe(fx.index)) {
      anim = fx.text === "RISES AGAIN!" ? "anim-swapin" : fx.text.includes("VENOM") || fx.text.includes("POISON") ? "anim-hit" : "";
      float = { text: fx.text, color: fx.color };
    }
    if (fx.kind === "attack" && fx.side !== side && isMe(fx.targetIndex) && fx.missed && fx.evaded) float = { text: "MIRAGE!", color: "#c7b8ff" };
  }
  return { anim, float };
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

// trail: an HP bar, which drains with a pale strip behind it (HpFill).
export function Bar({ label, value, pct, color, trail }: { label: string; value: string; pct: number; color: string; trail?: boolean }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 2 }}>
        <span>{label}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ height: 8, background: "#0d0e12", border: "1px solid #000", position: "relative" }}>
        {trail ? <HpFill pct={pct} color={color} />
          : <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: color, transition: "width 0.45s ease-out" }} />}
      </div>
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
// foes: the foe slots standing in the room (two in an ambush). target /
// onTarget: with two, the one you're aiming at, and tapping the other.
function Stage({ me, mySlot, myInfo, foes, foeTeam, theirInfo, fx, target, onTarget, myGround, foeGround }: {
  me: Combatant; mySlot: number; myInfo: MemberInfo; foes: number[]; foeTeam: Combatant[]; theirInfo: MemberInfo[]; fx: Fx | null;
  myGround?: GroundEffect[]; foeGround?: GroundEffect[]; // what lies under each side (a blood pool)
  target?: number; onTarget?: (index: number) => void;
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
        <GroundEffects ground={myGround} at={{ left: MY_SPOT.left, bottom: `calc(${MY_SPOT.bottom} - 4%)` }} />
        <GroundEffects ground={foeGround} at={{ left: FOE_SPOT.left, bottom: `calc(${FOE_SPOT.bottom} - 4%)`, width: foes.length > 1 ? "56%" : `${34 * FOE_DEPTH}%` }} />
        {/* Theirs first, so yours (nearer) stands in front where they overlap. */}
        {foes.length === 1
          ? <Fighter f={foeTeam[foes[0]]} side="B" slot={foes[0]} mi={theirInfo[foes[0]]} fx={fx} at={FOE_SPOT} shrink={FOE_DEPTH} />
          : foes.map((i, n) => {
            const up = foeTeam[i].hp > 0;
            return <Fighter key={i} f={foeTeam[i]} side="B" slot={i} mi={theirInfo[i]} fx={fx} maxW={PAIR_W}
              at={{ left: PAIR_AT[n] ?? FOE_SPOT.left, bottom: FOE_SPOT.bottom, width: "28%" }} aimed={up && i === target} onTap={up && onTarget ? () => onTarget(i) : undefined} />;
          })}
        <Fighter f={me} side="A" slot={mySlot} mi={myInfo} fx={fx} at={MY_SPOT} />
      </div>
    </div>
  );
}

// How big a fighter stands on the stage: STAGE_SCALE of the stage's own
// pixels, but never taller than STAGE_TALL of it (the big art, Aurelius or
// the Void Serpent, would fill the room). FIGHTER_W: its column's share.
const STAGE_SCALE = 2.2;
// Standing on a diagonal (the user, 2026-11-04): yours near and low on the
// left, seen from behind; theirs further back in the room, higher up and
// smaller (FOE_DEPTH of its usual size).
const MY_SPOT = { left: "30%", bottom: "6%" };
const FOE_SPOT = { left: "70%", bottom: "27%" };
const FOE_DEPTH = 0.75;
// An ambush's two foes: where each stands, and how wide its sprite may be.
const PAIR_AT = ["58%", "84%"];
const PAIR_W = "18cqw";
const STAGE_EXTEND_STEP = 8;
const STAGE_TALL = 0.4;
const FIGHTER_W = 0.4;
const stageWidth = (sprite: Sprite, shrink = 1) => {
  const fit = Math.min(STAGE_SCALE, (STAGE_TALL * CH) / fineHeight(sprite));
  return `${Math.min(100, ((fineWidth(sprite) * fit * shrink) / CW / FIGHTER_W) * 100)}%`;
};

// A fighter's floating label: level and name, its races, a small health bar
// (yours shows HP, theirs a percentage only) and any statuses.
export function FighterLabel({ f, side, mi }: { f: Combatant; side: SideKey; mi?: MemberInfo }) {
  const hpPct = Math.max(0, (f.hp / f.maxHp) * 100);
  // Venom (Rabid Bite) and poison share the poison icon, shown once.
  const has = (...ids: string[]) => f.statuses.some((s) => ids.includes(s.id));
  const marks: [boolean, React.ReactNode][] = [
    [has("cripple"), <Glyph key="cripple" icon="🐌" art="status_cripple" />], [has("haste"), "⚡"],
    [has("venom", "poison"), <Glyph key="poison" icon="☣️" art="status_poison" />], [has("mirage"), "✨"],
    [has("corpsify"), "⚰️"],
    [has("seal"), "⛓️"], // (fear stays hidden until it strikes)
    [has("soak"), "🫧"],
    [has("brace"), "🧱"],
    [f.statuses.some((s) => s.id === "boost"), "💪"],
    [has("bleed"), "🩸"],
    [has("weaken"), "🔻"],
    [has("ward"), "💎"],
    [has("flame"), "🔥"],
    [has("charged"), "💢"],
  ];
  const shown = marks.filter(([on]) => on).map(([, m]) => m);
  const icons = shown.length ? <>{shown.map((m, i) => <span key={i}>{i > 0 && " "}{m}</span>)}</> : null;
  return (
    <>
      <div className="pixel-font" style={{ display: "flex", alignItems: "baseline", gap: 5, maxWidth: "100%", fontSize: "clamp(10px, 2.4cqw, 13px)", textShadow: "0 2px 0 #000", whiteSpace: "nowrap" }}>
        <LevelTag level={f.level} />
        <span style={{ color: mi ? rarityColor(mi.rarity) : "#fff", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{f.name}</span>
      </div>
      {/* Races spelled out under the name (until they get their own icons); the line keeps its space when there are none. */}
      <div style={{ fontSize: 11, textShadow: "0 1px 0 #000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", visibility: f.races?.length ? "visible" : "hidden" }}>
        {f.races?.length ? <RaceNames races={f.races} /> : " "}
      </div>
      <div style={{ width: "70%", minWidth: 70, height: 7, marginTop: 3, background: "rgba(0,0,0,0.75)", border: "1px solid #000", position: "relative" }}>
        <HpFill pct={hpPct} color={hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f5c542" : "#ef4444"} />
      </div>
      <div style={{ fontSize: 11, color: "#d8d4c8", textShadow: "0 1px 0 #000", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
        {side === "A" ? `${f.hp}/${f.maxHp}` : `${Math.ceil(hpPct)}%`}{icons && <span style={{ marginLeft: 4 }}>{icons}</span>}
      </div>
    </>
  );
}

// The inside of a health bar (in a position: relative box): the HP left, and
// behind it the pale strip of HP just lost, draining a moment later.
function HpFill({ pct, color }: { pct: number; color: string }) {
  const w = `${Math.max(0, Math.min(100, pct))}%`;
  return (
    <>
      <div className="hp-trail" style={{ width: w }} />
      <div className="hp-fill" style={{ width: w, background: color }} />
    </>
  );
}

// One fighter standing on the stage: its floating label over its sprite,
// reacting to this step. `at` places it (by default your side left of
// centre, theirs right); `maxW` caps the sprite's width (the boss's lair is
// crowded). aimed / onTap: one of two foes, aimed at or tapped to aim at
// (aimed given at all keeps a line for the 🎯 over its label). shrink: drawn
// smaller, further back in the room.
export function Fighter({ f, side, slot, mi, fx, at, maxW, aimed, onTap, shrink }: {
  f: Combatant; side: SideKey; slot: number; mi: MemberInfo; fx: Fx | null; at?: React.CSSProperties; maxW?: string;
  aimed?: boolean; onTap?: () => void; shrink?: number;
}) {
    const { anim, float } = fighterFx(side, slot, fx);
    const sprite = mi.creatureId ? fightSprite(mi.creatureId, side === "A") : undefined; // yours from behind, where drawn
    const floats = !!sprite && !!artFor(sprite)?.floats && f.hp > 0;
    return (
      <div onClick={onTap} role={onTap ? "button" : undefined} aria-label={onTap ? `Aim at the ${f.name}` : undefined}
        style={{ position: "absolute", bottom: "13%", left: side === "A" ? "27%" : "73%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", width: `${FIGHTER_W * 100}%`, minWidth: 44, cursor: onTap ? "pointer" : undefined, ...at }}>
        {aimed !== undefined && <div className="pixel-font" style={{ fontSize: 11, height: 14, color: "#ffd66e", visibility: aimed ? "visible" : "hidden" }}>🎯</div>}
        <FighterLabel f={f} side={side} mi={mi} />
        {/* (The floating text sits outside the part rebuilt each step, so it can outlast the step.) */}
        <div style={{ position: "relative", marginTop: 4, ...(sprite && !maxW ? { width: stageWidth(sprite, shrink) } : {}) }}>
          <div key={`${fx?.id ?? 0}-${side}`} className={anim} style={{ opacity: f.hp <= 0 ? 0.35 : 1, filter: f.hp <= 0 ? "grayscale(1)" : undefined }}>
            {/* One that floats hangs above its shadow, bobbing (while it's still up). */}
            <div className={floats ? "float-bob" : undefined} style={aimed ? { filter: "drop-shadow(0 0 6px #ffd66e)" } : undefined}>
              {sprite
                ? <PixelSprite sprite={sprite} scale={3.6} title={f.name} style={{ ...(faceFoe(sprite, side) ? { transform: "scaleX(-1)" } : {}), ...(maxW ? { maxWidth: maxW, height: "auto" } : { width: "100%", height: "auto" }) }} />
                : <Token name={f.name} rarity={mi.rarity} creatureId={mi.creatureId} />}
            </div>
            {floats
              ? <div className="float-shadow" style={{ width: "60%", height: 8, margin: "34px auto 0" }} />
              : <div style={{ width: "80%", height: 8, margin: "-4px auto 0", background: "radial-gradient(ellipse, rgba(0,0,0,0.6), transparent 70%)" }} />}
          </div>
          <LingeringFloat float={float} id={fx?.id} top={0} />
        </div>
      </div>
    );
}
