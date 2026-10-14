// lib/combat/battle.ts
// Turn-by-turn team battle engine (3v3 by default). It is used both for
// playing by hand (each round's actions are supplied one round at a time) and
// by the auto-battler / Balance Lab (lib/combat/teamBattle.ts), so the rules
// live in one place.
//
// Rules (confirmed by design):
// - One active creature per side, and each round both sides pick ONE action.
//   (Bosses can have a second creature on the field, its "partner"; then you
//   choose which of the two to attack. A boss side is played by bossAi.ts.)
// - Swaps resolve first, then attacks in Agility order (ties random). A side
//   that swaps gives the opponent a free hit on the creature coming in.
// - The creature swapped out restores 50% of its missing energy.
// - Attacking costs the move's energy, then +30 energy (max 100).
// - A fainted creature is replaced at the end of the round (free). The
//   replacement doesn't act until next round.
// - A side loses when all its creatures have fainted.
//
// Built to grow: new kinds of action (e.g. a battle-bag item or weapon
// swap) are added to BattleAction, and per-creature status effects
// (cripple, fear, blind, …) live in Combatant.statuses with a duration.

import {
  calcDamage, effectiveAgil,
  MAX_ENERGY, ENERGY_REGEN, PRECISE_CHANCE, PRECISE_IGNORE,
  type Fighter,
} from "./engine";
import type { Skill } from "../creatures/creatureData";
import { bossActions, bossEndOfRound, bossHiddenAtStart, bossMinHp, type BossKind, type BossState } from "./bossAi";
import { DEFLECT_CHANCE, NULLIFY_REFLECT, SET_BONUS, type ArmorKey } from "../items/armor";

export const SWAP_ENERGY_RESTORE = 0.5; // share of MISSING energy restored on swap-out
export const MAX_ROUNDS = 100;

// Cripple (from Cripple / Crippling Shot): the target loses agility for the
// next few rounds. Re-crippling refreshes the duration; it doesn't stack.
// It keeps counting down while the creature is on the bench.
export const CRIPPLE_AGILITY_LOSS = 0.5;
export const CRIPPLE_ROUNDS = 3;

// Haste (from Dash Lash / Quick Bolt): the user gains agility this round
// (so it can strike first) and for the next HASTE_ROUNDS rounds.
// Re-dashing refreshes it; it doesn't stack.
export const HASTE_ROUNDS = 2;

// Race moves (numbers on the moves themselves, in creatureData.ts):
// - Mirage: a chance to dodge each attack for a few rounds.
// - Corpsify: lasts the rest of this round and the next; a knockout in that
//   time brings the creature back with part of its HP instead.
// - Venom: ticks at the end of every round, on the field or the bench.
//   A new bite refreshes it; it doesn't stack.
// - Pounce: acts before everyone else this round.
export const CORPSIFY_ROUNDS = 2;

// Armour set mechanics (a full helmet + chest + legs of one armour; see
// SET_BONUS in lib/items/armor.ts). The once-a-fight ones mark setUsed.
// - Hard Shell: the first hit it takes is halved.
// - Quickscale: its first attack goes before everyone (like a pounce).
// - Nullify: reflects some of the ranged damage it takes.
// - Deflect: a chance for ranged attacks against it to miss.
// - Steadfast: can't be crippled.
// - Unstoppable: once, a knockout blow leaves it on 1 HP.
// (Second Wind heals between dungeon fights, so it lives in the dungeon.)
const hasSet = (f: Fighter, key: ArmorKey) => f.armorSet === key;

// Armour gap: hammering the same creature with the same move finds the gaps
// in its armour, so stalled fights (tank vs tank) eventually end.
// - From the 6th use in a row, each use adds +10% precise-hit chance
//   (15%, 25%, 35%…).
// - Each precise hit in that run opens the armour further: precise hits
//   ignore 25% → 50% → 75% → 100% of defence.
// - The run resets when the attacker uses a different move or passes, or
//   when either creature swaps out (that's the defender's counterplay).
export const STREAK_START = 5;
export const STREAK_PRECISE_STEP = 0.1;
export const ARMOUR_GAP = { enabled: true }; // switch for balance experiments

export type Streak = { move: string; targetIdx: number; hits: number; cracks: number };

// Precise chance and defence ignored for the attacker's current run.
export function streakEffects(s?: Streak) {
  const gap = ARMOUR_GAP.enabled && !!s && s.hits > STREAK_START;
  return {
    preciseChance: PRECISE_CHANCE + (gap ? STREAK_PRECISE_STEP * (s!.hits - STREAK_START) : 0),
    ignore: gap ? Math.min(1, PRECISE_IGNORE * (1 + s!.cracks)) : PRECISE_IGNORE,
    gap,
  };
}

export type SideKey = "A" | "B";

// target: which enemy to hit when they have two on the field (team index);
// missing = their main creature.
// item: something from the battle bag used on your creature on the field
// (the screen takes it out of the bag); heal = HP it restores.
export type BattleAction =
  | { kind: "attack"; skillName: string; target?: number }
  | { kind: "swap"; to: number }
  | { kind: "item"; item: string; heal: number }
  | { kind: "pass" }; // rest: only when no move is affordable; recovers energy

// Status effects (cripple; later fear, blind, vampirism…).
// `rounds` counts down at the end of each round; at 0 the status ends.
// loss: a cripple's agility loss (missing = CRIPPLE_AGILITY_LOSS).
// gain: a haste's agility gain.
// chance: a mirage's dodge chance. dmg: a venom's damage per round.
// hp: corpsify's share of HP to come back with.
export type StatusEffect = { id: string; rounds: number; loss?: number; gain?: number; chance?: number; dmg?: number; hp?: number };

// hidden: a boss creature that hasn't appeared yet (not shown on screen).
// cooldowns: move name → rounds until it can be used again.
// setUsed: its armour set's once-a-fight mechanic has been used.
export type Combatant = Fighter & { statuses: StatusEffect[]; streak?: Streak; hidden?: boolean; cooldowns?: Record<string, number>; setUsed?: boolean };

export type BattleSide = {
  key: SideKey;
  team: Combatant[];
  active: number;
  partner?: number | null; // a second creature on the field (bosses only)
  swaps: number;
  lastSwapRound: number;
  boss?: BossState;        // set when this side is a scripted boss
};

export type BattleEvent =
  | { type: "round"; round: number }
  | { type: "swap"; side: SideKey; from: string; to: string; toIndex: number; energyRestored: number }
  | { type: "attack"; side: SideKey; attacker: string; target: string; skill: Skill; damage: number; precise: boolean; missed: boolean;
      crippled: boolean; targetHpAfter: number; attackerEnergyAfter: number;
      streak: Streak; defenceIgnored: number; // defenceIgnored: share ignored by this hit (0 if not precise)
      attackerIndex?: number; targetIndex?: number; crippleLoss?: number; hasted?: number;
      evaded?: boolean; venom?: StatusEffect; pounced?: boolean;
      armorFx?: string } // an armour set mechanic that kicked in on this hit
  // Anything else that changes a creature: a self move, a venom tick, a
  // corpse rising. hp and statuses are the creature's values afterwards.
  | { type: "effect"; side: SideKey; index: number; name: string; text: string; hp: number; statuses: StatusEffect[];
      kind: "self" | "venom" | "revive" | "item" | "set"; damage?: number }
  // A boss changes who's on the field (new phase), or a partner takes over.
  | { type: "lineup"; side: SideKey; active: number; partner: number | null; reveal?: number[]; gone?: number[]; text?: string }
  | { type: "pass"; side: SideKey; name: string }
  | { type: "faint"; side: SideKey; name: string }
  | { type: "sendIn"; side: SideKey; name: string; index: number }
  | { type: "end"; winner: SideKey | "draw" };

export type BattleState = {
  round: number;
  sides: Record<SideKey, BattleSide>;
  // Sides whose active creature fainted and must send in a replacement
  // before the next round.
  needsReplacement: SideKey[];
  winner: SideKey | "draw" | null;
  log: BattleEvent[];
  // Running totals for the Balance Lab.
  hits: number;
  minDamageHits: number;
};

export const other = (k: SideKey): SideKey => (k === "A" ? "B" : "A");
export const activeOf = (s: BattleSide) => s.team[s.active];
// Team indexes of the creatures on the field (one, or two for some bosses).
export const fieldOf = (s: BattleSide): number[] => (s.partner != null ? [s.active, s.partner] : [s.active]);
export const aliveCount = (s: BattleSide) => s.team.filter((f) => f.hp > 0).length;

// startHp: creatures that start hurt (e.g. HP carried between dungeon
// rooms); missing = full health. Everyone starts with full energy.
// bossB: side B is that boss, played by its script.
export function createBattle(teamA: Fighter[], teamB: Fighter[], startHp: Partial<Record<SideKey, number[]>> = {}, bossB?: BossKind): BattleState {
  const fresh = (t: Fighter[], hp?: number[]): Combatant[] =>
    t.map((f, i) => ({ ...f, hp: Math.max(1, Math.min(f.maxHp, hp?.[i] ?? f.maxHp)), energy: MAX_ENERGY, statuses: [] }));
  const side = (key: SideKey, team: Fighter[]): BattleSide =>
    ({ key, team: fresh(team, startHp[key]), active: 0, swaps: 0, lastSwapRound: -99 });
  const B = side("B", teamB);
  if (bossB) {
    B.boss = { kind: bossB, phase: 1 };
    B.partner = null;
    for (const i of bossHiddenAtStart(bossB)) B.team[i].hidden = true;
  }
  return {
    round: 0,
    sides: { A: side("A", teamA), B },
    needsReplacement: [],
    winner: null,
    log: [],
    hits: 0,
    minDamageHits: 0,
  };
}

// ── Status effects ─────────────────────────────────────────────────
export const isCrippled = (f: Combatant) => f.statuses.some((s) => s.id === "cripple");

// Agility right now (cripple and haste included).
export function currentAgility(f: Combatant): number {
  const cripple = f.statuses.find((s) => s.id === "cripple");
  const haste = f.statuses.find((s) => s.id === "haste");
  return effectiveAgil(f) * (cripple ? 1 - (cripple.loss ?? CRIPPLE_AGILITY_LOSS) : 1) * (1 + (haste?.gain ?? 0));
}

// Agility used for this round's turn order: a dash move hastes you before
// anyone moves (replacing any haste you already had).
export function turnAgility(f: Combatant, action: BattleAction): number {
  const skill = action.kind === "attack" ? f.skills.find((s) => s.name === action.skillName) : undefined;
  if (skill?.effect?.kind !== "dash") return currentAgility(f);
  return currentAgility({ ...f, statuses: [...f.statuses.filter((s) => s.id !== "haste"), { id: "haste", rounds: 1, gain: skill.effect.agilityBonus }] });
}

// ── What a side is allowed to do right now ─────────────────────────
export function affordableSkills(f: Combatant): Skill[] {
  return f.skills.filter((s) => s.energyCost <= f.energy && (f.cooldowns?.[s.name] ?? 0) <= 0);
}

// Bench creatures this side could swap to. (Future: fear blocks this.)
export function swapTargets(s: BattleSide): number[] {
  if (s.boss) return [];
  return s.team.map((f, i) => i).filter((i) => i !== s.active && s.team[i].hp > 0);
}

// Enemy creatures this side can attack right now (team indexes).
export function attackTargets(state: BattleState, key: SideKey): number[] {
  const foe = state.sides[other(key)];
  return fieldOf(foe).filter((i) => foe.team[i].hp > 0);
}

export function isValidAction(state: BattleState, key: SideKey, a: BattleAction): boolean {
  const s = state.sides[key];
  const me = activeOf(s);
  switch (a.kind) {
    case "attack": return affordableSkills(me).some((sk) => sk.name === a.skillName)
      && (a.target === undefined || attackTargets(state, key).includes(a.target));
    case "swap":   return swapTargets(s).includes(a.to);
    case "item":   return !s.boss && me.hp > 0 && me.hp < me.maxHp && a.heal > 0;
    case "pass":   return affordableSkills(me).length === 0;
  }
}

// Damage this move would do to the opponent's current creature (no precise hit).
export function previewDamage(state: BattleState, key: SideKey, skill: Skill): number {
  const me = activeOf(state.sides[key]);
  const them = activeOf(state.sides[other(key)]);
  return calcDamage(skill, me, them, false).damage;
}

// ── Resolving a round ──────────────────────────────────────────────
// Mutates and returns `state` (clone first if you need the old one).
export function resolveRound(state: BattleState, actions: Record<SideKey, BattleAction>): BattleState {
  if (state.winner || state.needsReplacement.length > 0) return state;
  for (const k of ["A", "B"] as SideKey[]) {
    if (state.sides[k].boss) continue; // its script picks its actions
    if (!isValidAction(state, k, actions[k])) throw new Error(`Invalid action for side ${k}: ${JSON.stringify(actions[k])}`);
  }

  state.round++;
  state.log.push({ type: "round", round: state.round });

  // 1. Swaps resolve first.
  for (const k of ["A", "B"] as SideKey[]) {
    const a = actions[k];
    if (a.kind !== "swap" || state.sides[k].boss) continue;
    const s = state.sides[k];
    const leaving = activeOf(s);
    const restored = Math.round((MAX_ENERGY - leaving.energy) * SWAP_ENERGY_RESTORE);
    leaving.energy = Math.min(MAX_ENERGY, leaving.energy + restored);
    changeActive(state, k, a.to);
    s.swaps++;
    s.lastSwapRound = state.round;
    state.log.push({ type: "swap", side: k, from: leaving.name, to: activeOf(s).name, toIndex: a.to, energyRestored: restored });
  }

  // 1b. Items (from the battle bag) are used before anyone attacks.
  for (const k of ["A", "B"] as SideKey[]) {
    const a = actions[k];
    if (a.kind !== "item" || state.sides[k].boss) continue;
    const s = state.sides[k];
    const me = activeOf(s);
    const healed = Math.min(a.heal, me.maxHp - me.hp);
    me.hp += healed;
    me.streak = undefined;
    state.log.push({ type: "effect", side: k, index: s.active, name: me.name, text: `drinks a ${a.item} (+${healed} HP)`, hp: me.hp,
      statuses: me.statuses.map((x) => ({ ...x })), kind: "item", damage: healed });
  }

  // 2. Attacks in Agility order (ties random). Dash moves add agility for
  //    this round; a crippled creature is slower. A boss acts with every
  //    creature it has on the field.
  const turns: { key: SideKey; index: number; action: BattleAction }[] = [];
  for (const k of ["A", "B"] as SideKey[]) {
    const s = state.sides[k];
    if (s.boss) turns.push(...bossActions(state, k).map((t) => ({ key: k, ...t })));
    else if (actions[k].kind !== "swap" && actions[k].kind !== "item") turns.push({ key: k, index: s.active, action: actions[k] });
  }
  // Pounce (and a Quickscale set's first attack) goes before everyone; otherwise fastest first.
  const quick = (f: Combatant, a: BattleAction) => a.kind === "attack" && hasSet(f, "dragonscale_tunic") && !f.setUsed;
  const pounces = (f: Combatant, a: BattleAction) =>
    a.kind === "attack" && (f.skills.find((s) => s.name === a.skillName)?.effect?.kind === "pounce" || quick(f, a)) ? 1 : 0;
  const attackers = turns
    .map((t) => {
      const actor = state.sides[t.key].team[t.index];
      return { ...t, actor, agil: turnAgility(actor, t.action), first: pounces(actor, t.action) };
    })
    .sort((x, y) => (y.first - x.first) || (y.agil - x.agil) || (Math.random() - 0.5));

  for (const { key, index: actorIdx, actor, action } of attackers) {
    if (actor.hp <= 0) continue; // fainted before acting
    if (action.kind === "pass") {
      // Resting recovers the usual energy, so a creature whose cheapest move
      // costs more than it has can't get stuck.
      actor.energy = Math.min(MAX_ENERGY, actor.energy + ENERGY_REGEN);
      actor.streak = undefined;
      state.log.push({ type: "pass", side: key, name: actor.name });
      continue;
    }
    if (action.kind !== "attack") continue;
    const quickscale = quick(actor, action);
    if (quickscale) actor.setUsed = true;
    const skill = actor.skills.find((sk) => sk.name === action.skillName)!;
    const fx = skill.effect;
    actor.energy = Math.min(MAX_ENERGY, actor.energy - skill.energyCost + ENERGY_REGEN);
    if (skill.cooldown) actor.cooldowns = { ...actor.cooldowns, [skill.name]: skill.cooldown + 1 }; // +1: ticks at the end of this round

    // Utility moves used on yourself.
    if (skill.self) {
      actor.streak = undefined;
      let text = `uses ${skill.name}`;
      if (fx?.kind === "mirage") {
        actor.statuses = [...actor.statuses.filter((s) => s.id !== "mirage"), { id: "mirage", rounds: fx.rounds + 1, chance: fx.evade }];
        text += ` — ${Math.round(fx.evade * 100)}% to dodge each attack for ${fx.rounds} rounds`;
      }
      if (fx?.kind === "corpsify") {
        actor.statuses = [...actor.statuses.filter((s) => s.id !== "corpsify"), { id: "corpsify", rounds: CORPSIFY_ROUNDS, hp: fx.reviveHp }];
        text += ` — if it falls before the end of next round, it rises again`;
      }
      state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text, hp: actor.hp, statuses: actor.statuses.map((s) => ({ ...s })), kind: "self" });
      continue;
    }

    // The chosen target, or whoever is still standing if it's gone. A
    // barrage hits everyone on the field.
    const foeKey = other(key);
    const foe = state.sides[foeKey];
    const standing = fieldOf(foe).filter((i) => foe.team[i].hp > 0);
    const chosen = action.target !== undefined && standing.includes(action.target) ? action.target : standing[0];
    if (chosen === undefined) continue;
    const targets = fx?.kind === "barrage" ? standing : [chosen];

    // Same move on the same creature again? Then the run continues.
    const prev = actor.streak;
    const streak: Streak = prev && prev.move === skill.name && prev.targetIdx === chosen
      ? { ...prev, hits: prev.hits + 1 }
      : { move: skill.name, targetIdx: chosen, hits: 1, cracks: 0 };
    actor.streak = streak;
    const gapFx = streakEffects(streak);

    // Haste lasts this round and the next HASTE_ROUNDS (+1: it ticks at the end of this one).
    const hasted = fx?.kind === "dash" ? fx.agilityBonus : undefined;
    if (hasted) actor.statuses = [...actor.statuses.filter((s) => s.id !== "haste"), { id: "haste", rounds: HASTE_ROUNDS + 1, gain: hasted }];

    for (const targetIdx of targets) {
      const target = foe.team[targetIdx];
      // Precise moves can miss, but every hit is precise; other moves have
      // the normal (or armour-gap boosted) chance of a precise hit. A
      // mirage can make any attack miss.
      const mirage = target.statuses.find((s) => s.id === "mirage");
      const evaded = !!mirage && Math.random() < (mirage.chance ?? 0);
      const deflected = !evaded && skill.type === "ranged" && hasSet(target, "arrowward_mantle") && Math.random() < DEFLECT_CHANCE;
      const missed = evaded || deflected || (fx?.kind === "precise" && Math.random() >= fx.hitChance);
      const armorFx: string[] = [];
      if (quickscale) armorFx.push(`${SET_BONUS.dragonscale_tunic.name}: strikes first`);
      if (deflected) armorFx.push(`${SET_BONUS.arrowward_mantle.name}: their armour turns it aside`);
      const precise = !missed && (fx?.kind === "precise" || Math.random() < gapFx.preciseChance);
      const pounced = fx?.kind === "pounce" && target.hp < target.maxHp / 2;
      let damage = missed ? 0 : calcDamage(skill, actor, target, precise, gapFx.ignore).damage;
      if (pounced && fx?.kind === "pounce") damage = Math.round(damage * (1 + fx.lowHpBonus));
      if (!missed && damage > 0 && hasSet(target, "colossal_shellarmor") && !target.setUsed) {
        target.setUsed = true;
        damage = Math.ceil(damage / 2);
        armorFx.push(`${SET_BONUS.colossal_shellarmor.name} halves it`);
      }
      if (damage >= target.hp && target.hp > 1 && hasSet(target, "juggernaut_platemail") && !target.setUsed) {
        target.setUsed = true;
        damage = target.hp - 1;
        armorFx.push(`${SET_BONUS.juggernaut_platemail.name}: hangs on with 1 HP`);
      }
      if (precise && gapFx.gap && targetIdx === chosen) streak.cracks++;
      if (!missed) {
        state.hits++;
        if (damage <= 1) state.minDamageHits++;
      }
      target.hp = Math.max(bossMinHp(state, foeKey, targetIdx), target.hp - damage);

      // Cripple lasts for the next CRIPPLE_ROUNDS rounds (+1: it ticks at the end of this one).
      const steadfast = fx?.kind === "cripple" && !missed && hasSet(target, "polished_chainbolster");
      if (steadfast) armorFx.push(`${SET_BONUS.polished_chainbolster.name}: can't be crippled`);
      const crippled = fx?.kind === "cripple" && !missed && !steadfast && target.hp > 0 && Math.random() < fx.chance;
      const crippleLoss = fx?.kind === "cripple" ? fx.agilityLoss : undefined;
      if (crippled) {
        target.statuses = [...target.statuses.filter((s) => s.id !== "cripple"), { id: "cripple", rounds: CRIPPLE_ROUNDS + 1, loss: crippleLoss }];
      }
      // Venom ticks at the end of this round and the next few (3–5 ticks in all).
      let venom: StatusEffect | undefined;
      if (fx?.kind === "venom" && !missed && target.hp > 0) {
        const rounds = fx.minRounds + Math.floor(Math.random() * (fx.maxRounds - fx.minRounds + 1));
        venom = { id: "venom", rounds, dmg: Math.max(1, Math.round(target.maxHp * fx.tick)) };
        target.statuses = [...target.statuses.filter((s) => s.id !== "venom"), venom];
      }
      state.log.push({ type: "attack", side: key, attacker: actor.name, target: target.name, skill, damage, precise, missed, crippled, targetHpAfter: target.hp, attackerEnergyAfter: actor.energy,
        streak: { ...streak }, defenceIgnored: precise ? gapFx.ignore : 0, attackerIndex: actorIdx, targetIndex: targetIdx, crippleLoss, hasted,
        evaded: evaded || undefined, venom, pounced: pounced || undefined, armorFx: armorFx.length ? armorFx.join(" · ") : undefined });
      if (target.hp <= 0) knockedOut(state, foeKey, targetIdx);

      // Nullify: some of a ranged hit bounces back at the attacker.
      if (!missed && damage > 0 && skill.type === "ranged" && hasSet(target, "arcane_nullifier") && actor.hp > 0) {
        const back = Math.min(actor.hp - bossMinHp(state, key, actorIdx), Math.max(1, Math.round(damage * NULLIFY_REFLECT)));
        if (back > 0) {
          actor.hp -= back;
          state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text: `takes ${back} damage reflected by ${SET_BONUS.arcane_nullifier.name}`,
            hp: actor.hp, statuses: actor.statuses.map((s) => ({ ...s })), kind: "set", damage: back });
          if (actor.hp <= 0) { knockedOut(state, key, actorIdx); break; }
        }
      }
    }
  }

  // 3. End of round: venom bites (field and bench), then status effects
  //    and cooldowns tick down.
  for (const k of ["A", "B"] as SideKey[]) {
    state.sides[k].team.forEach((f, i) => {
      const venom = f.statuses.find((s) => s.id === "venom");
      if (!venom || f.hp <= 0 || f.hidden) return;
      const damage = Math.min(f.hp - bossMinHp(state, k, i), venom.dmg ?? 0);
      if (damage <= 0) return;
      f.hp -= damage;
      state.log.push({ type: "effect", side: k, index: i, name: f.name, text: `takes ${damage} venom damage`, hp: f.hp, statuses: f.statuses.map((s) => ({ ...s })), kind: "venom", damage });
      if (f.hp <= 0) knockedOut(state, k, i);
    });
  }
  for (const k of ["A", "B"] as SideKey[]) {
    for (const f of state.sides[k].team) {
      f.statuses = f.statuses.map((st) => ({ ...st, rounds: st.rounds - 1 })).filter((st) => st.rounds > 0);
      if (f.cooldowns) f.cooldowns = Object.fromEntries(Object.entries(f.cooldowns).map(([m, r]) => [m, r - 1]).filter(([, r]) => (r as number) > 0));
    }
  }

  // 4. Bosses change phase; a fallen partner leaves the field (or, if the
  //    main creature fell, the partner takes its place).
  for (const k of ["A", "B"] as SideKey[]) {
    const s = state.sides[k];
    if (s.boss) state.log.push(...bossEndOfRound(state, k));
    if (s.partner == null) continue;
    if (s.team[s.partner].hp <= 0) s.partner = null;
    else if (activeOf(s).hp <= 0) { s.active = s.partner; s.partner = null; }
    else continue;
    state.log.push({ type: "lineup", side: k, active: s.active, partner: s.partner ?? null });
  }

  // 5. Win check, then who must send in a replacement.
  checkWinner(state);
  if (!state.winner) {
    state.needsReplacement = (["A", "B"] as SideKey[]).filter((k) => !state.sides[k].boss && activeOf(state.sides[k]).hp <= 0);
  }
  return state;
}

// A creature has just hit 0 HP: it faints, unless Corpsify brings it back.
function knockedOut(state: BattleState, key: SideKey, index: number) {
  const f = state.sides[key].team[index];
  const corpse = f.statuses.find((s) => s.id === "corpsify");
  if (!corpse) {
    state.log.push({ type: "faint", side: key, name: f.name });
    return;
  }
  f.hp = Math.max(1, Math.round(f.maxHp * (corpse.hp ?? 0.5)));
  f.statuses = f.statuses.filter((s) => s !== corpse);
  state.log.push({ type: "effect", side: key, index, name: f.name, text: `rises again with ${f.hp} HP!`, hp: f.hp, statuses: f.statuses.map((s) => ({ ...s })), kind: "revive" });
}

// A new creature steps in (swap or replacement). Armour-gap runs end on
// both sides: the creature leaving loses its run, and the opponent's run
// was against the creature that just left.
export function changeActive(state: BattleState, key: SideKey, index: number) {
  const s = state.sides[key];
  activeOf(s).streak = undefined;
  s.active = index;
  activeOf(s).streak = undefined;
  const foe = state.sides[other(key)];
  for (const i of fieldOf(foe)) foe.team[i].streak = undefined;
}

export function sendInReplacement(state: BattleState, key: SideKey, index: number): BattleState {
  const s = state.sides[key];
  if (!state.needsReplacement.includes(key)) return state;
  if (index === s.active || !s.team[index] || s.team[index].hp <= 0) throw new Error(`Invalid replacement ${index} for side ${key}`);
  changeActive(state, key, index);
  state.needsReplacement = state.needsReplacement.filter((k) => k !== key);
  state.log.push({ type: "sendIn", side: key, name: activeOf(s).name, index });
  return state;
}

function checkWinner(state: BattleState) {
  const a = aliveCount(state.sides.A), b = aliveCount(state.sides.B);
  if (a > 0 && b > 0 && state.round < MAX_ROUNDS) return;
  state.winner = a > 0 && b === 0 ? "A" : b > 0 && a === 0 ? "B" : "draw";
  state.log.push({ type: "end", winner: state.winner });
}

// Deep-enough copy for React state updates.
export function cloneBattle(state: BattleState): BattleState {
  const side = (s: BattleSide): BattleSide => ({
    ...s,
    team: s.team.map((f) => ({ ...f, statuses: f.statuses.map((st) => ({ ...st })), streak: f.streak && { ...f.streak }, cooldowns: f.cooldowns && { ...f.cooldowns } })),
    boss: s.boss && { ...s.boss },
  });
  return {
    ...state,
    sides: { A: side(state.sides.A), B: side(state.sides.B) },
    needsReplacement: [...state.needsReplacement],
    log: [...state.log],
  };
}
