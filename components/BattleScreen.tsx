"use client";
// components/BattleScreen.tsx
// Playing a battle by hand against the AI: the arena, move buttons, swaps,
// the step-by-step replay of each round, and the battle log. Used by the
// Fight Pit (app/battle) and the labyrinth (app/labyrinth).

import { useEffect, useRef, useState } from "react";
import { loadSave } from "@/hooks/useGameState";
import { isCreatureDrop, isItemDrop, type CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { findCreatureTemplate, type CreatureTemplate, type Skill } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { fighterFor } from "@/lib/creatures/instance";
import { combatSummary } from "@/lib/combat/loadout";
import { calcDamage, type Fighter } from "@/lib/combat/engine";
import {
  createBattle, resolveRound, sendInReplacement, cloneBattle,
  activeOf, affordableSkills, swapTargets, currentAgility, changeActive, attackTargets, fieldOf,
  CRIPPLE_ROUNDS, CRIPPLE_AGILITY_LOSS, HASTE_ROUNDS, STREAK_START, streakEffects,
  type BattleAction, type BattleEvent, type BattleState, type Combatant, type SideKey,
} from "@/lib/combat/battle";
import type { BossKind } from "@/lib/combat/bossAi";
import { chooseAiAction, chooseAiReplacement, AI_LEVEL_LABELS, type AiLevel } from "@/lib/combat/thinkingAi";
import { RARITIES } from "@/lib/balance/simulate";
import { saveBattle, type BattleMember } from "@/lib/battleHistory";
import BattleLog, { YOU, FOE } from "@/components/BattleLog";

export const MUTED = "rgba(255,255,255,0.5)";
const STEP_MS = { attack: 950, other: 650, phase: 2600 };

// What the screen shows about each team member (gear names etc.).
export type MemberInfo = { rarity: Rarity; label: string; weaponName?: string; armorName?: string };
export type OwnedCreature = MemberInfo & {
  id: string; name: string; template: CreatureTemplate; roster: boolean;
  weaponRarity?: Rarity; armorRarity?: Rarity; fighter: Fighter;
};

export type Match = {
  state: BattleState;                 // the real battle
  info: Record<SideKey, MemberInfo[]>;
  teams: Record<SideKey, Fighter[]>;  // for rematches and the history
  level: AiLevel;                     // how well the opponent plays
  title?: string;                     // e.g. "Labyrinth room 3", shown in the history
};

// The animation currently playing. Indexes say which creature (team index)
// when a side has two on the field.
type Fx =
  | { id: number; kind: "attack"; side: SideKey; damage: number; precise: boolean; missed: boolean; crippled: boolean; gap: boolean;
      attackerIndex?: number; targetIndex?: number }
  | { id: number; kind: "swap" | "sendIn" | "faint"; side: SideKey }
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
    const a = items.get(equipment[d.id]?.armorId ?? "");
    list.push({
      id: d.id, name: t.name, template: t, roster: favs.has(d.id),
      rarity: t.rarity, label: creatureTypeLabel(d.proficiency ?? t.proficiency),
      weaponName: w?.name, armorName: a?.name,
      weaponRarity: w?.rarity, armorRarity: a?.rarity,
      fighter: fighterFor(d, t, w?.stats, a?.stats, equipment[d.id]?.moves),
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
      if (e.hasted) attacker.statuses = [...attacker.statuses.filter((s) => s.id !== "haste"), { id: "haste", rounds: HASTE_ROUNDS, gain: e.hasted }];
      if (e.crippled) target.statuses = [...target.statuses.filter((s) => s.id !== "cripple"), { id: "cripple", rounds: CRIPPLE_ROUNDS, loss: e.crippleLoss }];
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
      stats: { hp: s.hp, atk: Math.round(s.atk), rng: Math.round(s.rng), agil: Math.round(s.agil), mdef: Math.round(s.mdef), rdef: Math.round(s.rdef) },
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
  // boss: the opponent is that labyrinth boss (played by its script).
  function start(teams: Match["teams"], info: Match["info"], level: AiLevel, opts: { startHp?: number[]; title?: string; boss?: BossKind } = {}) {
    setView(null);
    setFx(null);
    setMatch({ state: createBattle(teams.A, teams.B, { A: opts.startHp }, opts.boss), info, teams, level, title: opts.title });
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
    const done: Match = { ...match, state: after };
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
            attackerIndex: e.attackerIndex, targetIndex: e.targetIndex }
        : e.type === "lineup" ? { id: ++n, kind: "lineup", side: e.side, text: e.text }
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

  return { match, view, fx, start, resume, act, replace, clear: () => setMatchState(null) };
}

// ── Battle screen ─────────────────────────────────────────────────
// ── Battle screen ─────────────────────────────────────────────────
// finishedActions: the buttons shown when the battle is over.
export function BattleView({ battle, finishedActions }: {
  battle: ReturnType<typeof usePlayableBattle>; finishedActions: React.ReactNode;
}) {
  const [targetPick, setTargetPick] = useState<number | null>(null);
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

  return (
    <>
      {phaseText && (
        <div className="stone-panel pixel-font" style={{ marginBottom: 10, textAlign: "center", fontSize: 17, color: "#ffd66e", borderColor: "#ffd66e" }}>
          ⚠️ {phaseText}
        </div>
      )}

      {/* The arena */}
      <div className="arena">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
          <FighterCard side="A" f={me} foe={them} info={info.A[you.active]} fx={fx} slot={you.active} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fieldOf(foe).map((i) => (
              <div key={i} onClick={multi && !playing ? () => setTargetPick(i) : undefined}
                style={{ cursor: multi && !playing ? "pointer" : undefined, outline: multi && i === target ? "2px solid #ffd66e" : undefined, outlineOffset: 2 }}>
                {multi && i === target && <div className="pixel-font" style={{ fontSize: 12, color: "#ffd66e", marginBottom: 2 }}>🎯 Your target</div>}
                <FighterCard side="B" f={foe.team[i]} foe={me} info={info.B[i]} fx={fx} slot={i} compact={multi} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10, alignItems: "start" }}>
          <Bench team={you.team} active={[you.active]} color={YOU} />
          <Bench team={foe.team} active={fieldOf(foe)} color={FOE} />
        </div>
      </div>

      {finished ? (
        <div className="stone-panel" style={{ marginTop: 16, textAlign: "center" }}>
          <div className="pixel-font" style={{ fontSize: 30, color: match.state.winner === "A" ? "#5ee08a" : match.state.winner === "B" ? FOE : "white" }}>
            {match.state.winner === "A" ? "Victory!" : match.state.winner === "B" ? "Defeat" : "Draw"}
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
            {AI_LEVEL_LABELS[match.level]} AI · {match.state.round} rounds · you swapped {match.state.sides.A.swaps}×, the AI swapped {match.state.sides.B.swaps}× · saved to your battle history
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
            {finishedActions}
          </div>
        </div>
      ) : mustReplace ? (
        <ActionBox title={`${me.name} fainted — who goes in next?`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {you.team.map((f, i) => f.hp > 0 && (
              <button key={i} onClick={() => onReplace(i)} className="card-btn">
                <span>
                  <b style={{ color: rarityColor(info.A[i].rarity) }}>{f.name}</b>
                  <span style={{ color: MUTED, fontSize: 12 }}> · {f.hp}/{f.maxHp} HP · {Math.round(f.energy)}⚡ · {info.A[i].label}</span>
                  <span style={{ display: "block", fontSize: 12, color: MUTED }}>vs their {them.name}: {matchupHint(f, them)}</span>
                </span>
              </button>
            ))}
          </div>
        </ActionBox>
      ) : (
        <ActionBox title={playing ? "…" : `Round ${state.round + 1} — what will ${me.name} do?`} dim={playing}>
          {multi && (
            <div style={{ fontSize: 12, color: "#ffd66e", marginBottom: 6 }}>
              Two enemies on the field — both attack every round. Tap one to target it: now hitting the {them.name}.
            </div>
          )}
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
            {myAgil === theirAgil ? "Equal agility — a coin flip decides who strikes first."
              : myAgil > theirAgil ? `Your ${me.name} is faster (${Math.round(myAgil)} vs ${Math.round(theirAgil)} agility) and strikes first.`
              : `Their ${them.name} is faster (${Math.round(theirAgil)} vs ${Math.round(myAgil)} agility) and strikes first.`}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
            {me.skills.map((sk) => (
              <MoveButton key={sk.name} sk={sk} me={me} them={them} myAgil={myAgil} theirAgil={theirAgil}
                disabled={playing || sk.energyCost > me.energy} onClick={() => onAct({ kind: "attack", skillName: sk.name, target: multi ? target : undefined })} />
            ))}
          </div>
          {affordableSkills(me).length === 0 && (
            <button onClick={() => onAct({ kind: "pass" })} disabled={playing} className="card-btn" style={{ marginTop: 6 }}>Not enough energy — rest (+30⚡)</button>
          )}
          {swapTargets(you).length > 0 && (
            <>
              <div style={{ fontSize: 12, color: MUTED, margin: "12px 0 6px" }}>
                Swap — uses your turn: {multi ? "both their creatures get" : `their ${them.name} gets`} a free hit on the incoming creature, and your {me.name} recovers 50% of its missing energy.
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {swapTargets(you).map((i) => (
                  <button key={i} onClick={() => onAct({ kind: "swap", to: i })} disabled={playing} className="card-btn" style={{ width: "auto" }}>
                    ⇄ {you.team[i].name}
                    <span style={{ fontSize: 12, color: MUTED }}> · {you.team[i].hp}/{you.team[i].maxHp} HP · {matchupHint(you.team[i], them)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </ActionBox>
      )}

      <SectionTitle>Battle log</SectionTitle>
      <BattleLog log={match.state.log} />
    </>
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

function MoveButton({ sk, me, them, myAgil, theirAgil, disabled, onClick }: {
  sk: Skill; me: Combatant; them: Combatant; myAgil: number; theirAgil: number; disabled: boolean; onClick: () => void;
}) {
  const fx = sk.effect;
  const dmg = moveDamage(sk, me, them);
  const tags: string[] = [];
  const run = me.streak?.move === sk.name ? me.streak.hits + 1 : 1; // this use's place in the run
  if (run > STREAK_START) tags.push(`run ×${run}: ${Math.round(streakEffects({ ...me.streak!, hits: run }).preciseChance * 100)}% precise`);
  else if (run > 2) tags.push(`run ×${run} (armour gap from ×${STREAK_START + 1})`);
  if (fx?.kind === "precise") tags.push(`${Math.round(fx.hitChance * 100)}% to hit · always precise`);
  if (fx?.kind === "cripple") tags.push(`${Math.round(fx.chance * 100)}% to cripple`);
  if (fx?.kind === "dash") {
    const flips = theirAgil >= myAgil && myAgil * (1 + fx.agilityBonus) > theirAgil;
    tags.push(`haste +${Math.round(fx.agilityBonus * 100)}% agility for ${HASTE_ROUNDS + 1} rounds${flips ? " → strike first!" : ""}`);
  }
  return (
    <button disabled={disabled} onClick={onClick} className="card-btn" style={{ display: "block", opacity: sk.energyCost > me.energy ? 0.35 : 1 }}>
      <b style={{ color: fx ? "#ffd98a" : "white" }}>{sk.name}</b> <span style={{ fontSize: 11, color: MUTED }}>{sk.type}</span>
      <span style={{ display: "block", fontSize: 12, color: MUTED }}>~{dmg} dmg · {sk.energyCost}⚡</span>
      {tags.map((t) => <span key={t} style={{ display: "block", fontSize: 11, color: "#c9b48a" }}>{t}</span>)}
    </button>
  );
}

// compact: a smaller card, when two share a column.
function FighterCard({ side, f, foe, info, fx, slot, compact }: {
  side: SideKey; f: Combatant; foe: Combatant; info: MemberInfo; fx: Fx | null; slot: number; compact?: boolean;
}) {
  const color = side === "A" ? YOU : FOE;
  const hpPct = (f.hp / f.maxHp) * 100;
  const cripple = f.statuses.find((s) => s.id === "cripple");
  const haste = f.statuses.find((s) => s.id === "haste");
  const isMe = (i?: number) => i === undefined || i === slot;

  // Which animation this card plays for the current step.
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
  }

  return (
    <div style={{ position: "relative" }}>
      <div key={`${fx?.id ?? 0}-${slot}`} className={`fighter-card ${anim}`} style={{ borderColor: `${color}88`, opacity: f.hp <= 0 ? 0.4 : 1, filter: f.hp <= 0 ? "grayscale(1)" : undefined }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Token name={f.name} rarity={info.rarity} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{side === "A" ? "You" : "Opponent"}</div>
            <div className="pixel-font" style={{ fontSize: 17, color: rarityColor(info.rarity), lineHeight: 1.1 }}>{f.name}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{info.label}</div>
          </div>
        </div>
        <Bar label="HP" value={`${f.hp}/${f.maxHp}`} pct={hpPct} color={hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f5c542" : "#ef4444"} />
        <Bar label="Energy" value={`${Math.round(f.energy)}`} pct={f.energy} color="#4EA1FF" />
        {cripple && <div style={{ fontSize: 11, color: "#d7a6ff", marginTop: 6 }}>🐌 Crippled (−{Math.round((cripple.loss ?? CRIPPLE_AGILITY_LOSS) * 100)}% agility) · {cripple.rounds} round{cripple.rounds === 1 ? "" : "s"} left</div>}
        {haste && <div style={{ fontSize: 11, color: "#7fe0ff", marginTop: 6 }}>⚡ Hasted (+{Math.round((haste.gain ?? 0) * 100)}% agility) · {haste.rounds} round{haste.rounds === 1 ? "" : "s"} left</div>}
        {f.stance !== "neutral" && <StanceBadge stance={f.stance} />}
        <StreakBadges f={f} foe={foe} slot={slot} />
        {!compact && (
          <div style={{ fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>
            ⚔️ {info.weaponName ?? "no weapon"}<br />🛡️ {info.armorName ?? "no armour"}
          </div>
        )}
        <StatsLine stats={combatSummary(f)} />
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

// Stand-in portrait until creatures have art: initials in a rarity frame.
export function Token({ name, rarity }: { name: string; rarity: Rarity }) {
  const c = RARITY_COLORS[rarity];
  const initials = name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2);
  return (
    <span className="pixel-font" style={{
      width: 44, height: 44, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 18, color: c.text, background: "#15161c", border: `3px solid ${c.border}`, boxShadow: `0 0 12px ${c.glow}, inset 0 0 8px ${c.glow}`,
    }}>{initials}</span>
  );
}

// active: who's on the field. Hidden boss creatures aren't shown.
export function Bench({ team, active, color }: { team: Combatant[]; active: number[]; color: string }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {team.map((f, i) => !f.hidden && (
        <span key={i} style={{
          fontSize: 11, padding: "3px 6px", background: "rgba(10,10,14,0.7)",
          border: active.includes(i) ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.12)",
          opacity: f.hp <= 0 ? 0.4 : 1, textDecoration: f.hp <= 0 ? "line-through" : "none",
        }}>
          {f.name} <span style={{ color: MUTED }}>{f.hp > 0 ? `${Math.round((f.hp / f.maxHp) * 100)}%` : "KO"}</span>
        </span>
      ))}
    </div>
  );
}

// ── Small pieces ──────────────────────────────────────────────────
export function StatsLine({ stats }: { stats: ReturnType<typeof combatSummary> }) {
  const r = Math.round;
  return (
    <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
      HP {stats.hp} · Atk {r(stats.atk)} · Rng {r(stats.rng)} · Agi {r(stats.agil)} · MDef {r(stats.mdef)} · RDef {r(stats.rdef)}
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
