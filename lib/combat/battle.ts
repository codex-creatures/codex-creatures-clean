// lib/combat/battle.ts
// Turn-by-turn team battle engine (3v3 by default). It is used both for
// playing by hand (each round's actions are supplied one round at a time) and
// by the auto-battler / Balance Lab (lib/combat/teamBattle.ts), so the rules
// live in one place.
//
// Rules (confirmed by design):
// - One active creature per side, and each round both sides pick ONE action.
//   (Bosses can have a second creature on the field, its "partner"; then you
//   choose which of the two to attack; the Hydra has all three heads out.
//   A boss side is played by bossAi.ts.
//   An ordinary side can have a partner too — an ambush, two on one — and
//   the partner simply uses its hardest-hitting move: partnerAction.)
// - A fight can have a turn limit (a room rigged to blow): if side B still
//   has someone standing when the last round ends, side B wins.
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
  calcDamage, effectiveAgil, effectiveStats, poisonImmune, rollDamage,
  MAX_ENERGY, ENERGY_REGEN, PRECISE_CHANCE, PRECISE_IGNORE,
  type Fighter,
  type CombatItem,
} from "./engine";
import type { CombatClass, Skill } from "../creatures/creatureData";
import { raceOfMove, raceVsAll } from "./raceChart";
import { bossActions, bossEndOfRound, bossMinHp, bossSelfMove, bossSetup, type BossKind, type BossState } from "./bossAi";
import { DEFLECT_CHANCE, NULLIFY_REFLECT, SET_BONUS, type ArmorKey } from "../items/armor";
import { HAUNT_CHANCE, PERFECTIONIST_STEP, REVITALISE_HEAL, SOUL_STONES, TOXIC_SKIN, type SoulStoneKey } from "../creatures/soulStones";

export const SWAP_ENERGY_RESTORE = 0.5; // share of MISSING energy restored on swap-out
export const MAX_ROUNDS = 100;

// Cripple (from Cripple / Crippling Shot / Hobble Hex): the target loses
// agility for the next few rounds, and each time it tries to attack it may
// stumble and lose that attack. Re-crippling refreshes the duration; it
// doesn't stack. It keeps counting down while the creature is on the bench.
export const CRIPPLE_AGILITY_LOSS = 0.5;
// The user, 2026-11-13: 3–5 rounds and a 50% stumble (were 3 rounds and 25%).
export const CRIPPLE_ROUNDS = 3;     // (the fewest; the shortest a cripple shows)
export const CRIPPLE_ROUNDS_MAX = 5;
// How long a cripple lasts: CRIPPLE_ROUNDS–CRIPPLE_ROUNDS_MAX, or a roll in the move's own range (Enfeeble: 3).
const crippleRounds = (fx: { minRounds?: number; maxRounds?: number }) => {
  const min = fx.minRounds ?? CRIPPLE_ROUNDS, max = fx.maxRounds ?? CRIPPLE_ROUNDS_MAX;
  return min + Math.floor(Math.random() * (max - min + 1));
};
export const CRIPPLE = { stumble: 0.5 }; // chance a crippled creature loses its attack (no energy spent)

// Haste (from Dash Lash / Quick Bolt / Quickcast): extra agility for this
// round's turn order only, so it can strike first. Nothing carries over.

// Race moves (numbers on the moves themselves, in creatureData.ts):
// - Mirage: a chance to dodge each attack for a few rounds.
// - Corpsify: lasts the rest of this round and the next; a knockout in that
//   time brings the creature back with part of its HP instead.
// - Venom: ticks at the end of every round, on the field or the bench.
//   A new bite refreshes it; it doesn't stack.
// - Pounce: acts before everyone else this round.
export const CORPSIFY_ROUNDS = 2;

// Special moves (numbers on the moves, in creatureData.ts SPECIAL_MOVES):
// - Seal (Dark Seal, Impale, Pin Down): the target can't swap out for a few
//   rounds ("seal"). It's on the creature, so it holds even if the attacker
//   swaps. A knocked-out creature is still replaced.
// - Meditate: extra energy back, on top of the usual.
// - Healing Blessing: next round, after everyone has attacked, whoever is
//   on the blesser's side of the field heals (if it's still standing).
// - Corrosive Soak: the target's defences drop (defenceCut) until it leaves
//   the field. A new soak replaces the old: it doesn't stack.
// - Brace: goes first; the next attack that lands on it this round does
//   less ("brace", used up by the hit).
// - Divine Strength, Arcane Channel, Sureshot Blessing: its attack in one
//   style is higher (Fighter.boost) until it leaves the field. Doesn't stack.
// - Blood Sacrifice: costs HP, and leaves a blood pool under the foes (see
//   ground effects, below).
export const SOAK_ROUNDS = MAX_ROUNDS + 1; // (it ends when the creature leaves the field, not with time)
export const isSealed = (f: Combatant) => f.statuses.some((s) => s.id === "seal");

// Ground effects (the user, 2026-11-03: the first of several, e.g. poison
// clouds to ignite): something lying under a side's field (BattleSide.ground).
// - Blood (Blood Sacrifice): at the end of each round, whoever is on that
//   side's field loses tick of its max HP; each creature that comes in (a
//   swap, or a replacement as the next round starts) loses entry; the
//   entries'th comer sets it off: a burst-power magic hit from the caster
//   (by: its team index, on the other side), and the pool is gone. Undead
//   are untouched, and an Undead coming in doesn't count. Whoever the caster's
//   side has on the field heals leech of all of it.
//   Casting it again replaces the pool (the count starts over).
// - Cloud (Choking Smog, Implode, the Hydra's breath): for some rounds,
//   whoever is on that side's field is poisoned (tick of its max HP a
//   round), and keeps it tailMin–tailMax rounds after it leaves or the
//   cloud clears (onEntry: only as it comes in, the Hydra's). Toxic creatures and warded ones (Crystal Armour) aren't
//   poisoned. Clouds don't stack: a new one replaces the old. Blood (a pool
//   or Haemorrhage's) under a cloud is soaked up: the blood goes and the
//   cloud's poison is CLOUD_BLOOD_BOOST stronger.
// - Caltrops: each creature that comes in loses entry of its max HP.
// - Gore (Haemorrhage): for some rounds, toxic damage on that side (toxic
//   moves, venom, poison) is amp higher; Undead are untouched.
export type GroundEffect =
  | { kind: "blood"; move: string; by: number; count: number; tick: number; entry: number; entries: number; burst: number; leech: number }
  | { kind: "cloud"; move: string; rounds: number; tick: number; tailMin: number; tailMax: number; boost?: number; onEntry?: boolean }
  | { kind: "caltrops"; move: string; entry: number }
  | { kind: "gore"; move: string; rounds: number; amp: number };
export const CLOUD_BLOOD_BOOST = 0.5;
type BloodPool = Extract<GroundEffect, { kind: "blood" }>;
type GroundKind = GroundEffect["kind"];
const groundOf = <K extends GroundKind>(s: BattleSide, kind: K) => s.ground?.find((g): g is Extract<GroundEffect, { kind: K }> => g.kind === kind);
const clearGround = (s: BattleSide, kinds: GroundKind[]) => { s.ground = (s.ground ?? []).filter((g) => !kinds.includes(g.kind)); };
function layGround(state: BattleState, key: SideKey, g: GroundEffect) {
  const s = state.sides[key];
  clearGround(s, [g.kind]);
  s.ground = [...(s.ground ?? []), g];
  // Blood under a cloud is soaked up, and the cloud grows stronger.
  const cloud = groundOf(s, "cloud");
  if (cloud && (groundOf(s, "blood") || groundOf(s, "gore"))) {
    clearGround(s, ["blood", "gore"]);
    cloud.boost = 1 + CLOUD_BLOOD_BOOST;
  }
  state.log.push({ type: "ground", side: key, ground: s.ground.map((x) => ({ ...x })) });
}
export function clearGroundLogged(state: BattleState, key: SideKey, kinds: GroundKind[]) {
  const s = state.sides[key];
  if (!s.ground?.some((g) => kinds.includes(g.kind))) return;
  clearGround(s, kinds);
  state.log.push({ type: "ground", side: key, ground: s.ground!.map((x) => ({ ...x })) });
}
// Poison doesn't stack: a new one replaces the old only if it has more to give (the user, 2026-11-12).
export function poisonWith(f: Combatant, dmg: number, rounds: number): boolean {
  const old = f.statuses.find((s) => s.id === "poison");
  if (old && (old.dmg ?? 0) * old.rounds >= dmg * rounds) return false;
  f.statuses = [...f.statuses.filter((s) => s.id !== "poison"), { id: "poison", rounds, dmg }];
  return true;
}
// Warded (Crystal Armour): no new status effects, and clouds don't touch it.
export const WARD_BLOCKS = ["cripple", "venom", "poison", "bleed", "seal", "weaken", "soak", "fear"];
export const isWarded = (f: Combatant) => f.statuses.some((s) => s.id === "ward");
const cannotBleed = (f: Fighter) => !!f.races?.includes("undead");
const roll = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
// A cloud under side key poisons creature index (not Toxic, not warded).
function cloudPoison(state: BattleState, key: SideKey, index: number) {
  const s = state.sides[key];
  const cloud = groundOf(s, "cloud");
  const f = s.team[index];
  if (!cloud || !f || f.hp <= 0 || f.hidden || poisonImmune(f) || isWarded(f)) return;
  // +1: the round it's applied in ticks too.
  if (poisonWith(f, Math.max(1, Math.round(f.maxHp * cloud.tick * (cloud.boost ?? 1))), roll(cloud.tailMin, cloud.tailMax) + 1))
    state.log.push({ type: "effect", side: key, index, name: f.name, text: "breathes in the poison cloud", hp: f.hp, statuses: f.statuses.map((x) => ({ ...x })), kind: "poisoned" });
}
// Smoke Bomb: the teammate it swaps to (the best matchup, then the most HP).
function smokeSwapTo(state: BattleState, key: SideKey): number | undefined {
  const s = state.sides[key];
  const them = activeOf(state.sides[other(key)]);
  const options = swapTargets(s);
  if (options.length === 0) return undefined;
  const edge = (f: Combatant) => (f.races?.[0] && them?.races?.length ? raceVsAll(f.races[0], them.races) : 1) / (them?.races?.[0] && f.races?.length ? raceVsAll(them.races[0], f.races) : 1);
  const score = (i: number) => edge(s.team[i]) + 0.5 * (s.team[i].hp / s.team[i].maxHp);
  return options.reduce((a, b) => (score(b) > score(a) ? b : a));
}
const untouchedByBlood = (f: Fighter) => !!f.races?.includes("undead");

// Armour set mechanics (a full helmet + chest + legs of one armour; see
// SET_BONUS in lib/items/armor.ts). The once-a-fight ones mark setUsed.
// - Hard Shell: the first hit it takes is halved.
// - Quickscale: its first attack goes before everyone (like a pounce).
// - Nullify: reflects some of the magic damage it takes.
// - Deflect: a chance for ranged attacks against it to miss.
// - Steadfast: can't be crippled.
// - Unstoppable: once, a knockout blow leaves it on 1 HP.
// (Second Wind heals between dungeon fights, so it lives in the dungeon.)
const hasSet = (f: Fighter, key: ArmorKey) => f.armorSet === key;

// A run: the same move used again and again in a row (on anyone). It ends
// when the creature uses a different move, rests, stumbles, uses an item or
// leaves the field. Only the Perfectionist soul stone cares: each use in the
// run hits PERFECTIONIST_STEP harder than the last (×1.1, ×1.21…).
// (The armour gap, which used runs to break stalls, was removed 2026-10-25.)
export type Streak = { move: string; hits: number };
export const perfectionistBonus = (f: Fighter, s?: Streak) =>
  f.soulStone === "perfectionist" && s ? (1 + PERFECTIONIST_STEP) ** (s.hits - 1) : 1;

// Soul stones (lib/creatures/soulStones.ts):
// - Toxic Skin: a melee hit on it may poison the attacker ("poison": ticks
//   like venom, on the bench too; a new poisoning replaces the old, with a
//   fresh 3–5 turns).
// - Haunting Presence: coming in (the start of the fight, a swap or a
//   replacement), the foe on the field may be struck with fear: it loses its
//   next attack this round (or next, if this round's attacks are over),
//   spending no energy.
// - Unstoppable Force: can't be crippled.
// - Perfectionist: see above.
// - Trickster: its utility moves (used on itself) go before everyone.
// - Revitalise: swapped out, it heals REVITALISE_HEAL of its max HP.
const hasStone = (f: Fighter, key: SoulStoneKey) => f.soulStone === key;

export type SideKey = "A" | "B";

// target: which enemy to hit when they have two on the field (team index);
// missing = their main creature.
// item: something from the battle bag used on your creature on the field
// (the screen takes it out of the bag); heal = HP it restores. revive: a
// Revival Elixir instead, on a knocked-out teammate (team index), bringing it
// back with share of its HP (it can then be swapped in).
export type BattleAction =
  | { kind: "attack"; skillName: string; target?: number }
  | { kind: "swap"; to: number }
  | { kind: "item"; item: string; heal: number; revive?: { index: number; share: number } }
  | { kind: "weapon"; name: string; weapon: CombatItem } // swap a weapon in from the bag (uses your turn)
  | { kind: "pass" }; // rest: only when no move is affordable; recovers energy

// Status effects (cripple; later fear, blind, vampirism…).
// `rounds` counts down at the end of each round; at 0 the status ends.
// loss: a cripple's agility loss (missing = CRIPPLE_AGILITY_LOSS).
// gain: a haste's agility gain.
// chance: a mirage's dodge chance. dmg: a venom's (or poison's) damage per round.
// fear (Haunting Presence): loses its next attack.
// hp: corpsify's share of HP to come back with.
// seal: can't swap out. soak: loss = its share of defences lost.
// brace: loss = the share the next hit loses. boost: gain = its attack's share up, in style.
// bleed: dmg a round until it leaves the field. weaken: loss of its attack (one style, or all).
// ward: no new statuses (Crystal Armour). flame: melee attackers take loss of their hit (Flame Body).
// charged: wound up for move (Mega Smash).
export type StatusEffect = { id: string; rounds: number; loss?: number; gain?: number; chance?: number; dmg?: number; hp?: number; style?: CombatClass; move?: string };

// hidden: a boss creature that hasn't appeared yet (not shown on screen).
// cooldowns: move name → rounds until it can be used again.
// setUsed: its armour set's once-a-fight mechanic has been used.
export type Combatant = Fighter & { statuses: StatusEffect[]; streak?: Streak; hidden?: boolean; cooldowns?: Record<string, number>; setUsed?: boolean };

export type BattleSide = {
  key: SideKey;
  team: Combatant[];
  active: number;
  partner?: number | null; // a second creature on the field (bosses, or an ambush)
  field?: number[];        // a boss with more than two on the field (the Hydra's heads, down or not)
  swaps: number;
  lastSwapRound: number;
  boss?: BossState;        // set when this side is a scripted boss
  blessing?: { round: number; heal: number; by: string }; // Healing Blessing: heals whoever is on the field in that round
  ground?: GroundEffect[]; // lying under this side's field (a blood pool)
  arrived?: number;        // sent in between rounds: the ground greets it as the next round starts
};

export type BattleEvent =
  | { type: "round"; round: number }
  | { type: "swap"; side: SideKey; from: string; to: string; toIndex: number; energyRestored: number }
  | { type: "attack"; side: SideKey; attacker: string; target: string; skill: Skill; damage: number; precise: boolean; missed: boolean;
      crippled: boolean; targetHpAfter: number; attackerEnergyAfter: number;
      streak: Streak; defenceIgnored: number; // defenceIgnored: share ignored by this hit (0 if not precise)
      poisoned?: StatusEffect; // Toxic Skin poisoned the attacker
      attackerIndex?: number; targetIndex?: number; crippleLoss?: number; crippleRounds?: number; hasted?: number;
      evaded?: boolean; venom?: StatusEffect; pounced?: boolean;
      sealed?: number; soaked?: number; // rounds it can't swap out; share of defences it lost
      braced?: boolean; // the target's Brace took most of it (and is used up)
      armorFx?: string } // an armour set mechanic that kicked in on this hit
  // Anything else that changes a creature: a self move, a venom tick, a
  // corpse rising. hp and statuses are the creature's values afterwards.
  | { type: "effect"; side: SideKey; index: number; name: string; text: string; hp: number; statuses: StatusEffect[];
      kind: "self" | "venom" | "poison" | "illness" | "revive" | "item" | "set" | "ability" | "stumble" | "fear" | "heal" | "poisoned" | "regrow" | "blood" | "burst" | "bleed"; damage?: number }
  // What lies under a side's field now (after a change).
  | { type: "ground"; side: SideKey; ground: GroundEffect[] }
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
  turnLimit?: number; // after this many rounds, if B still stands, B wins (side A is caught in the blast)
  // Running totals for the Balance Lab.
  hits: number;
  minDamageHits: number;
};

export const other = (k: SideKey): SideKey => (k === "A" ? "B" : "A");
export const activeOf = (s: BattleSide) => s.team[s.active];
// Team indexes of the creatures on the field (one, or two or three for some bosses).
export const fieldOf = (s: BattleSide): number[] => s.field ?? (s.partner != null ? [s.active, s.partner] : [s.active]);
export const aliveCount = (s: BattleSide) => s.team.filter((f) => f.hp > 0).length;

// startHp: creatures that start hurt (e.g. HP carried between dungeon
// rooms); missing = full health. Everyone starts with full energy.
// bossB: side B is that boss, played by its script.
// opts.pairB: side B's first two creatures are both on the field (an ambush).
// opts.turnLimit: see BattleState.
export function createBattle(teamA: Fighter[], teamB: Fighter[], startHp: Partial<Record<SideKey, number[]>> = {}, bossB?: BossKind,
  opts: { pairB?: boolean; turnLimit?: number } = {}): BattleState {
  const fresh = (t: Fighter[], hp?: number[]): Combatant[] =>
    t.map((f, i) => ({ ...f, hp: Math.max(1, Math.min(f.maxHp, hp?.[i] ?? f.maxHp)), energy: MAX_ENERGY, statuses: [] }));
  const side = (key: SideKey, team: Fighter[]): BattleSide =>
    ({ key, team: fresh(team, startHp[key]), active: 0, swaps: 0, lastSwapRound: -99 });
  const B = side("B", teamB);
  if (bossB) bossSetup(B, bossB);
  else if (opts.pairB && B.team.length > 1) B.partner = 1;
  const state: BattleState = {
    ...(opts.turnLimit ? { turnLimit: opts.turnLimit } : {}),
    round: 0,
    sides: { A: side("A", teamA), B },
    needsReplacement: [],
    winner: null,
    log: [],
    hits: 0,
    minDamageHits: 0,
  };
  // The first creatures out: a Haunting Presence can strike fear straight away.
  haunt(state, "A");
  haunt(state, "B");
  return state;
}

// Haunting Presence: side `key`'s creature has just come onto the field. The
// foe's main creature may be struck with fear until the end of this round
// (between rounds: through the next one), losing its attack. It's silent: no
// log line, and the screen doesn't show it, until the creature tries to attack
// (seeing it up front would make it too easy to play around).
export function haunt(state: BattleState, key: SideKey) {
  const me = activeOf(state.sides[key]);
  if (!me || me.hp <= 0 || me.hidden || !hasStone(me, "haunting_presence")) return;
  const foe = state.sides[other(key)];
  const target = activeOf(foe);
  if (!target || target.hp <= 0 || target.hidden || Math.random() >= HAUNT_CHANCE) return;
  target.statuses = [...target.statuses.filter((s) => s.id !== "fear"), { id: "fear", rounds: 1 }];
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
  const wound = f.statuses.find((s) => s.id === "charged");
  if (wound) return f.skills.filter((s) => s.name === wound.move);
  return f.skills.filter((s) => s.energyCost <= f.energy && (f.cooldowns?.[s.name] ?? 0) <= 0);
}

// Bench creatures this side could swap to (none while its creature is sealed).
export function swapTargets(s: BattleSide): number[] {
  if (s.boss || (activeOf(s) && isSealed(activeOf(s)))) return [];
  return s.team.map((f, i) => i).filter((i) => i !== s.active && i !== s.partner && s.team[i].hp > 0);
}

// Enemy creatures this side can attack right now (team indexes).
export function attackTargets(state: BattleState, key: SideKey): number[] {
  const foe = state.sides[other(key)];
  return fieldOf(foe).filter((i) => foe.team[i].hp > 0);
}

// A Revival Elixir can go on any knocked-out teammate (the one on the field
// never is: a knock-out there is replaced before you choose).
export const canRevive = (s: BattleSide, index: number) => !s.boss && !!s.team[index] && s.team[index].hp <= 0;
export const revivable = (s: BattleSide) => s.team.flatMap((_, i) => (canRevive(s, i) ? [i] : []));

export function isValidAction(state: BattleState, key: SideKey, a: BattleAction): boolean {
  const s = state.sides[key];
  const me = activeOf(s);
  switch (a.kind) {
    case "attack": return affordableSkills(me).some((sk) => sk.name === a.skillName)
      && (a.target === undefined || attackTargets(state, key).includes(a.target));
    case "swap":   return swapTargets(s).includes(a.to);
    case "item":   return !s.boss && me.hp > 0 && (a.revive ? canRevive(s, a.revive.index) && a.revive.share > 0 : me.hp < me.maxHp && a.heal > 0);
    case "weapon": return !s.boss && me.hp > 0;
    case "pass":   return affordableSkills(me).length === 0;
  }
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

  // 0. A creature sent in between rounds meets whatever lies under its side.
  for (const k of ["A", "B"] as SideKey[]) {
    const s = state.sides[k];
    const i = s.arrived;
    s.arrived = undefined;
    if (i !== undefined && i === s.active) groundOnEntry(state, k, i);
  }

  // 1. Swaps resolve first.
  const cameIn: SideKey[] = []; // (a Haunting Presence strikes once both sides have swapped)
  for (const k of ["A", "B"] as SideKey[]) {
    const a = actions[k];
    if (a.kind !== "swap" || state.sides[k].boss) continue;
    const s = state.sides[k];
    const leaving = activeOf(s);
    if (leaving.hp <= 0) continue; // the ground knocked it out as the round began: it's replaced instead
    const leavingIdx = s.active;
    const restored = Math.round((MAX_ENERGY - leaving.energy) * SWAP_ENERGY_RESTORE);
    leaving.energy = Math.min(MAX_ENERGY, leaving.energy + restored);
    changeActive(state, k, a.to);
    s.swaps++;
    s.lastSwapRound = state.round;
    state.log.push({ type: "swap", side: k, from: leaving.name, to: activeOf(s).name, toIndex: a.to, energyRestored: restored });
    groundOnEntry(state, k, a.to); // into a blood pool?
    cameIn.push(k);
    // Revitalise: swapping out restores some HP.
    if (hasStone(leaving, "revitalise") && leaving.hp > 0 && leaving.hp < leaving.maxHp) {
      const healed = Math.min(leaving.maxHp - leaving.hp, Math.round(leaving.maxHp * REVITALISE_HEAL));
      leaving.hp += healed;
      state.log.push({ type: "effect", side: k, index: leavingIdx, name: leaving.name, text: `is restored by ${SOUL_STONES.revitalise.name} (+${healed} HP)`,
        hp: leaving.hp, statuses: leaving.statuses.map((x) => ({ ...x })), kind: "ability", damage: healed });
    }
  }
  for (const k of cameIn) haunt(state, k);

  // 1b. Items (from the battle bag) are used before anyone attacks.
  for (const k of ["A", "B"] as SideKey[]) {
    const a = actions[k];
    if (a.kind === "weapon" && !state.sides[k].boss) {
      // A new weapon: its attack stats and damage-type affinity apply from
      // now on (its HP bonus waits until after the fight).
      const s = state.sides[k];
      const me = activeOf(s);
      me.weapon = { ...a.weapon, hp: me.weapon.hp };
      me.streak = undefined;
      state.log.push({ type: "effect", side: k, index: s.active, name: me.name, text: `switches to the ${a.name}`, hp: me.hp,
        statuses: me.statuses.map((x) => ({ ...x })), kind: "item" });
      continue;
    }
    if (a.kind !== "item" || state.sides[k].boss) continue;
    const s = state.sides[k];
    if (a.revive) {
      const f = s.team[a.revive.index];
      f.hp = Math.max(1, Math.round(f.maxHp * a.revive.share));
      f.statuses = [];
      state.log.push({ type: "effect", side: k, index: a.revive.index, name: f.name, text: `is brought back by a ${a.item} (${f.hp} HP)`, hp: f.hp,
        statuses: [], kind: "revive" });
      continue;
    }
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
    else if (actions[k].kind !== "swap" && actions[k].kind !== "item" && actions[k].kind !== "weapon") turns.push({ key: k, index: s.active, action: actions[k] });
    if (!s.boss && s.partner != null && s.team[s.partner].hp > 0) turns.push({ key: k, index: s.partner, action: partnerAction(state, k) });
  }
  // A Trickster's utility move goes first of all; then a pounce (and a
  // Quickscale set's first attack); otherwise fastest first.
  const quick = (f: Combatant, a: BattleAction) => a.kind === "attack" && hasSet(f, "dragonscale_tunic") && !f.setUsed;
  const pounces = (f: Combatant, a: BattleAction) => {
    const sk = a.kind === "attack" ? f.skills.find((s) => s.name === a.skillName) : undefined;
    if (sk?.self && hasStone(f, "trickster")) return 2;
    const k = sk?.effect?.kind;
    if (k === "implode") return -1; // Implode goes last
    return k === "pounce" || k === "quick" || k === "brace" || k === "smoke" || k === "ambush" || quick(f, a) ? 1 : 0;
  };
  const attackers = turns
    .map((t) => {
      const actor = state.sides[t.key].team[t.index];
      return { ...t, actor, agil: turnAgility(actor, t.action), first: pounces(actor, t.action) };
    })
    .sort((x, y) => (y.first - x.first) || (y.agil - x.agil) || (Math.random() - 0.5));

  const leader = attackers.find((t) => t.action.kind === "attack")?.actor; // for First Strike!
  for (const { key, index: actorIdx, actor, action } of attackers) {
    if (actor.hp <= 0) continue; // fainted before acting
    if (!state.sides[key].boss && !fieldOf(state.sides[key]).includes(actorIdx)) continue; // driven off the field this round (Haunting Scream)
    if (action.kind === "pass") {
      // Resting recovers the usual energy, so a creature whose cheapest move
      // costs more than it has can't get stuck.
      actor.energy = Math.min(MAX_ENERGY, actor.energy + ENERGY_REGEN);
      actor.streak = undefined;
      state.log.push({ type: "pass", side: key, name: actor.name });
      continue;
    }
    if (action.kind !== "attack") continue;
    // Struck with fear (Haunting Presence): it loses this attack (no energy spent).
    if (actor.statuses.some((s) => s.id === "fear")) {
      actor.statuses = actor.statuses.filter((s) => s.id !== "fear");
      actor.streak = undefined;
      state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text: `is crippled with fear (${SOUL_STONES.haunting_presence.name}) — it can't attack this round`,
        hp: actor.hp, statuses: actor.statuses.map((s) => ({ ...s })), kind: "fear" });
      continue;
    }
    // Crippled: it may stumble and lose this attack (no energy spent).
    if (isCrippled(actor) && Math.random() < CRIPPLE.stumble) {
      actor.streak = undefined;
      state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text: "is crippled and stumbles — it can't attack this round",
        hp: actor.hp, statuses: actor.statuses.map((s) => ({ ...s })), kind: "stumble" });
      continue;
    }
    const quickscale = quick(actor, action);
    if (quickscale) actor.setUsed = true;
    const skill = actor.skills.find((sk) => sk.name === action.skillName)!;
    const fx = skill.effect;
    const woundUp = fx?.kind === "charge" && actor.statuses.some((s) => s.id === "charged");
    actor.energy = Math.min(MAX_ENERGY, actor.energy - (woundUp ? 0 : skill.energyCost) + ENERGY_REGEN);
    // Mega Smash: the first use winds up (and pays); the next strikes.
    if (fx?.kind === "charge" && !woundUp) {
      actor.streak = undefined;
      actor.statuses = [...actor.statuses, { id: "charged", rounds: 3, move: skill.name }];
      state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text: `winds up ${skill.name}`, hp: actor.hp, statuses: actor.statuses.map((s) => ({ ...s })), kind: "self" });
      continue;
    }
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
      if (fx?.kind === "meditate") {
        const gained = Math.min(MAX_ENERGY - actor.energy, fx.energy);
        actor.energy += gained;
        text += ` — +${gained} energy`;
      }
      if (fx?.kind === "blessing") {
        state.sides[key].blessing = { round: state.round + 1, heal: fx.heal, by: actor.name };
        text += ` — next round, after the attacks, whoever is on the field heals ${Math.round(fx.heal * 100)}% HP`;
      }
      if (fx?.kind === "brace") {
        actor.statuses = [...actor.statuses.filter((s) => s.id !== "brace"), { id: "brace", rounds: 1, loss: fx.cut }];
        text += ` — the next attack on it this round does ${Math.round(fx.cut * 100)}% less`;
      }
      if (fx?.kind === "empower") {
        actor.boost = { ...actor.boost, [fx.style]: fx.boost };
        actor.statuses = [...actor.statuses.filter((s) => !(s.id === "boost" && s.style === fx.style)), { id: "boost", rounds: SOAK_ROUNDS, gain: fx.boost, style: fx.style }];
        text += ` — +${Math.round(fx.boost * 100)}% ${fx.style} attack while it stays on the field`;
      }
      if (fx?.kind === "ward") {
        actor.statuses = [...actor.statuses.filter((s) => !WARD_BLOCKS.includes(s.id) && s.id !== "ward"), { id: "ward", rounds: fx.rounds + 1 }];
        actor.defenceCut = undefined;
        text += ` — no status effects for ${fx.rounds} rounds`;
      }
      if (fx?.kind === "cleanse") {
        state.sides[key].team.forEach((f, i) => {
          if (!f.statuses.some((s) => s.id === "venom" || s.id === "poison" || s.id === "bleed")) return;
          f.statuses = f.statuses.filter((s) => s.id !== "venom" && s.id !== "poison" && s.id !== "bleed");
          if (i !== actorIdx) state.log.push({ type: "effect", side: key, index: i, name: f.name, text: "is washed clean", hp: f.hp, statuses: f.statuses.map((s) => ({ ...s })), kind: "heal" });
        });
        clearGroundLogged(state, key, ["cloud", "blood", "gore"]);
        text += " — your team is washed clean";
      }
      if (fx?.kind === "flamebody") {
        actor.statuses = [...actor.statuses.filter((s) => s.id !== "flame"), { id: "flame", rounds: fx.rounds + 1, loss: fx.reflect }];
        clearGroundLogged(state, key, ["cloud"]); // only the cloud under its own team (the user, 2026-11-12)
        text += ` — melee attackers get burned for ${fx.rounds} rounds`;
      }
      const bossMove = state.sides[key].boss ? bossSelfMove(state, key, skill.name) : undefined; // the Hydra's breath
      text += bossMove?.text ?? "";
      state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text, hp: actor.hp, statuses: actor.statuses.map((s) => ({ ...s })), kind: "self" });
      state.log.push(...(bossMove?.events ?? []));
      if (bossMove?.cloud) { layGround(state, other(key), bossMove.cloud); cloudPoison(state, other(key), state.sides[other(key)].active); }
      continue;
    }

    // Blood Sacrifice: pay the HP (it can knock the caster out), and the pool
    // spreads under the foes, replacing any there.
    if (fx?.kind === "blood") {
      actor.streak = undefined;
      const paid = Math.min(actor.hp, Math.round(actor.maxHp * fx.cost));
      actor.hp -= paid;
      state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text: `uses ${skill.name} — gives ${paid} HP, and blood pools under the foes`,
        hp: actor.hp, statuses: actor.statuses.map((x) => ({ ...x })), kind: "self", damage: paid });
      layGround(state, other(key), { kind: "blood", move: skill.name, by: actorIdx, count: 0, tick: fx.tick, entry: fx.entry, entries: fx.entries, burst: fx.burst, leech: fx.leech }); // (into a cloud: soaked up)
      if (actor.hp <= 0) knockedOut(state, key, actorIdx);
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

    // The same move again? Then the run continues (for a Perfectionist).
    const prev = actor.streak;
    const streak: Streak = prev && prev.move === skill.name ? { ...prev, hits: prev.hits + 1 } : { move: skill.name, hits: 1 };
    actor.streak = streak;
    const perfect = perfectionistBonus(actor, streak);

    // Haste only sped up this round's turn order (turnAgility); logged as First Strike! when it went first.
    const hasted = fx?.kind === "dash" && actor === leader ? fx.agilityBonus : undefined;

    for (const targetIdx of targets) {
      const target = foe.team[targetIdx];
      // Precise moves can miss, but every hit is precise; other moves have
      // the normal (or armour-gap boosted) chance of a precise hit. A
      // mirage can make any attack miss.
      const mirage = target.statuses.find((s) => s.id === "mirage");
      const evaded = !!mirage && Math.random() < (mirage.chance ?? 0);
      const deflected = !evaded && skill.type === "ranged" && hasSet(target, "arrowward_mantle") && Math.random() < DEFLECT_CHANCE;
      const missed = evaded || deflected || (fx?.kind === "precise" && Math.random() >= fx.hitChance);
      const armorFx: string[] = []; // armour sets (and soul stones) that kicked in
      if (quickscale) armorFx.push(`${SET_BONUS.dragonscale_tunic.name}: strikes first`);
      if (deflected) armorFx.push(`${SET_BONUS.arrowward_mantle.name}: their armour turns it aside`);
      const precise = !missed && (fx?.kind === "precise" || Math.random() < PRECISE_CHANCE);
      const pounced = fx?.kind === "pounce" && target.hp < target.maxHp / 2;
      let damage = missed ? 0 : calcDamage(skill, actor, target, precise, PRECISE_IGNORE, rollDamage()).damage;
      if (pounced && fx?.kind === "pounce") damage = Math.round(damage * (1 + fx.lowHpBonus));
      let burnt: Extract<GroundEffect, { kind: "cloud" }> | undefined; // Emulate: the cloud it set alight
      if (!missed && damage > 0) {
        let m = 1;
        if (fx?.kind === "execute" && target.hp < target.maxHp * fx.below) m *= 1 + fx.bonus;
        if (fx?.kind === "ambush" && target.hp >= target.maxHp) m *= 1 + fx.bonus;
        if (fx?.kind === "septic" && (target.statuses.some((s) => s.id === "bleed") || groundOf(foe, "blood") || groundOf(foe, "gore"))) m *= fx.mult;
        if (fx?.kind === "ignite" && groundOf(foe, "cloud")) { m *= fx.mult; burnt = groundOf(foe, "cloud"); clearGroundLogged(state, foeKey, ["cloud"]); }
        if (fx?.kind === "chain") m *= 1 + Math.min(fx.cap, fx.step * (streak.hits - 1));
        const gore = groundOf(foe, "gore");
        if (gore && !cannotBleed(target) && raceOfMove(skill) === "toxic") m *= 1 + gore.amp;
        damage = Math.round(damage * m);
      }
      if (woundUp) actor.statuses = actor.statuses.filter((s) => s.id !== "charged");
      if (!missed && perfect > 1) {
        damage = Math.round(damage * perfect);
        armorFx.push(`${SOUL_STONES.perfectionist.name}: +${Math.round((perfect - 1) * 100)}%`);
      }
      // Braced: this hit loses most of its damage, and the brace is spent.
      const brace = !missed && damage > 0 ? target.statuses.find((s) => s.id === "brace") : undefined;
      if (brace) {
        damage = Math.max(1, Math.round(damage * (1 - (brace.loss ?? 0))));
        target.statuses = target.statuses.filter((s) => s !== brace);
        armorFx.push(`Brace: −${Math.round((brace.loss ?? 0) * 100)}%`);
      }
      if (!missed && damage > 0 && hasSet(target, "colossal_shellarmor") && !target.setUsed) {
        target.setUsed = true;
        damage = Math.ceil(damage / 2);
        armorFx.push(`${SET_BONUS.colossal_shellarmor.name} halves it`);
      }
      if (actor.gentle && damage >= target.hp) damage = Math.max(0, target.hp - 1);
      if (damage >= target.hp && target.hp > 1 && hasSet(target, "juggernaut_platemail") && !target.setUsed) {
        target.setUsed = true;
        damage = target.hp - 1;
        armorFx.push(`${SET_BONUS.juggernaut_platemail.name}: hangs on with 1 HP`);
      }
      if (!missed && skill.damage > 0) {
        state.hits++;
        if (damage <= 1) state.minDamageHits++;
      }
      target.hp = Math.max(bossMinHp(state, foeKey, targetIdx), target.hp - damage);

      const statusesBefore = new Set(target.statuses), cutBefore = target.defenceCut;
      // Cripple lasts for the next CRIPPLE_ROUNDS rounds (+1: it ticks at the end of this one).
      const unstoppable = fx?.kind === "cripple" && !missed && hasStone(target, "unstoppable_force");
      const steadfast = fx?.kind === "cripple" && !missed && (unstoppable || hasSet(target, "polished_chainbolster"));
      if (steadfast) armorFx.push(`${unstoppable ? SOUL_STONES.unstoppable_force.name : SET_BONUS.polished_chainbolster.name}: can't be crippled`);
      const crippled = fx?.kind === "cripple" && !missed && !steadfast && target.hp > 0 && Math.random() < fx.chance;
      const crippleLoss = fx?.kind === "cripple" ? fx.agilityLoss : undefined;
      const crippledFor = crippled && fx?.kind === "cripple" ? crippleRounds(fx) : undefined;
      if (crippledFor) {
        target.statuses = [...target.statuses.filter((s) => s.id !== "cripple"), { id: "cripple", rounds: crippledFor + 1, loss: crippleLoss }];
      }
      // Venom ticks at the end of this round and the next few (3–5 ticks in all).
      let venom: StatusEffect | undefined;
      if (fx?.kind === "venom" && !missed && target.hp > 0 && !poisonImmune(target)) {
        const rounds = fx.minRounds + Math.floor(Math.random() * (fx.maxRounds - fx.minRounds + 1));
        venom = { id: "venom", rounds, dmg: Math.max(1, Math.round(target.maxHp * fx.tick)) };
        target.statuses = [...target.statuses.filter((s) => s.id !== "venom"), venom];
      }
      // Seal: the target can't swap out for the next few rounds (+1: it ticks at the end of this one).
      let sealed: number | undefined;
      if (fx?.kind === "seal" && !missed && target.hp > 0 && Math.random() < fx.chance) {
        sealed = fx.rounds + (fx.extraChance && Math.random() < fx.extraChance ? 1 : 0);
        target.statuses = [...target.statuses.filter((s) => s.id !== "seal"), { id: "seal", rounds: sealed + 1 }];
      }
      // Soak: defences down until it leaves the field (a new one replaces the old).
      const soaked = fx?.kind === "soak" && !missed && target.hp > 0 ? fx.cut : undefined;
      if (soaked) {
        target.defenceCut = soaked;
        target.statuses = [...target.statuses.filter((s) => s.id !== "soak"), { id: "soak", rounds: SOAK_ROUNDS, loss: soaked }];
      }
      // The hit itself is logged now, so it plays before what it sets off
      // (a drain, a status, a burst, recoil…). Later parts are filled in below.
      const hit: Extract<BattleEvent, { type: "attack" }> = { type: "attack", side: key, attacker: actor.name, target: target.name, skill, damage, precise, missed, crippled, targetHpAfter: target.hp, attackerEnergyAfter: actor.energy,
        streak: { ...streak }, defenceIgnored: precise ? PRECISE_IGNORE : 0, attackerIndex: actorIdx, targetIndex: targetIdx, crippleLoss, crippleRounds: crippledFor, hasted,
        evaded: evaded || undefined, venom, pounced: pounced || undefined, sealed, soaked, braced: brace ? true : undefined };
      const hitAt = state.log.length;
      state.log.push(hit);
      let burntOut = false; // (the burst below already knocked it out)
      // Emulate: the cloud goes up in flames, one more tick of it as fire (so Toxic too).
      if (burnt && target.hp > 0) {
        const fire = Math.min(target.hp - bossMinHp(state, foeKey, targetIdx), Math.max(1, Math.round(target.maxHp * burnt.tick * (burnt.boost ?? 1))));
        if (fire > 0) {
          target.hp -= fire;
          state.log.push({ type: "effect", side: foeKey, index: targetIdx, name: target.name, text: `is caught as the cloud goes up in flames (${fire} damage)`, hp: target.hp, statuses: target.statuses.map((s) => ({ ...s })), kind: "burst", damage: fire });
          if (target.hp <= 0) { knockedOut(state, foeKey, targetIdx); burntOut = true; }
        }
      }
      // The 2026-11 codex moves (numbers on the moves: lib/creatures/codexMoves.ts).
      const changed: string[] = [];
      if (!missed) {
        if (fx?.kind === "lifesteal" && damage > 0 && actor.hp > 0) {
          const healed = Math.min(actor.maxHp - actor.hp, Math.round(damage * fx.share));
          if (healed > 0) { actor.hp += healed; state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text: `drains ${healed} HP`, hp: actor.hp, statuses: actor.statuses.map((s) => ({ ...s })), kind: "heal", damage: healed }); }
        }
        if (fx?.kind === "agility") actor.agilityUp = Math.max(actor.agilityUp ?? 0, fx.gain);
        if (fx?.kind === "surge") actor.surge = Math.max(actor.surge ?? 0, fx.gain);
        if (target.hp > 0) {
          if (fx?.kind === "weaken" && fx.forceSwap !== undefined && !isWarded(target) && !foe.boss && !isSealed(target) && swapTargets(foe).length > 0 && Math.random() < fx.forceSwap) {
            // Haunting Scream: it flees for a random teammate (who doesn't act this round).
            const bench = swapTargets(foe), to = bench[Math.floor(Math.random() * bench.length)];
            changeActive(state, foeKey, to);
            state.log.push({ type: "swap", side: foeKey, from: target.name, to: activeOf(foe).name, toIndex: to, energyRestored: 0 });
            groundOnEntry(state, foeKey, to);
          } else if (fx?.kind === "weaken" && (fx.chance === undefined || Math.random() < fx.chance)) {
            target.statuses = [...target.statuses.filter((s) => !(s.id === "weaken" && s.style === fx.style)), { id: "weaken", rounds: fx.rounds ? fx.rounds + 1 : SOAK_ROUNDS, loss: fx.loss, style: fx.style }];
            changed.push("WEAKENED");
          }
          if (fx?.kind === "bleed" && !cannotBleed(target) && Math.random() < fx.chance) {
            target.statuses = [...target.statuses.filter((s) => s.id !== "bleed"), { id: "bleed", rounds: SOAK_ROUNDS, dmg: Math.max(1, Math.round(target.maxHp * fx.tick)) }];
            changed.push("BLEEDING");
          }
          if (fx?.kind === "poison" && !poisonImmune(target) && Math.random() < fx.chance && poisonWith(target, Math.max(1, Math.round(target.maxHp * fx.tick)), roll(fx.minRounds, fx.maxRounds))) changed.push("POISONED");
          if (fx?.kind === "slap" && Math.random() < fx.chance) {
            target.boost = undefined; target.defenceCut = undefined; target.agilityUp = undefined; target.surge = undefined;
            target.statuses = target.statuses.filter((s) => !["soak", "boost", "weaken", "haste"].includes(s.id));
            changed.push("SLAPPED CLEAN");
          }
        }
        if (fx?.kind === "caltrops") layGround(state, foeKey, { kind: "caltrops", move: skill.name, entry: fx.entry });
        if (fx?.kind === "gore") layGround(state, foeKey, { kind: "gore", move: skill.name, rounds: fx.rounds + 1, amp: fx.amp });
        if (fx?.kind === "cloud") layGround(state, foeKey, { kind: "cloud", move: skill.name, rounds: roll(fx.minRounds, fx.maxRounds) + 1, tick: fx.tick, tailMin: fx.tailMin, tailMax: fx.tailMax });
        if (fx?.kind === "cloud") cloudPoison(state, foeKey, foe.active);
      }
      // Warded: none of this hit's status effects stick.
      if (isWarded(target)) {
        target.statuses = target.statuses.filter((s) => statusesBefore.has(s) || !WARD_BLOCKS.includes(s.id));
        target.defenceCut = cutBefore;
        changed.length = 0;
      }
      if (changed.length) state.log.push({ type: "effect", side: foeKey, index: targetIdx, name: target.name, text: changed.join(" · ").toLowerCase(), hp: target.hp, statuses: target.statuses.map((s) => ({ ...s })), kind: "ability" });
      // Flame Body: a melee attacker takes a share of its hit (before armour).
      const flame = target.statuses.find((s) => s.id === "flame");
      if (flame && !missed && skill.type === "melee" && skill.damage > 0 && actor.hp > 0) {
        const raw = (skill.damage + effectiveStats(actor).atk) * (skill.mult ?? 1);
        const back = Math.min(actor.hp - bossMinHp(state, key, actorIdx), Math.max(1, Math.round(raw * (flame.loss ?? 0))));
        if (back > 0) {
          actor.hp -= back;
          state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text: `is burned by ${target.name}'s flames (${back} damage)`, hp: actor.hp, statuses: actor.statuses.map((s) => ({ ...s })), kind: "ability", damage: back });
          if (actor.hp <= 0) knockedOut(state, key, actorIdx);
        }
      }
      // Headbutt: the user takes a share of the damage.
      if (fx?.kind === "recoil" && !missed && damage > 0 && actor.hp > 0) {
        const back = Math.min(actor.hp, Math.max(1, Math.round(damage * fx.share)));
        actor.hp -= back;
        state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text: `takes ${back} recoil damage`, hp: actor.hp, statuses: actor.statuses.map((s) => ({ ...s })), kind: "ability", damage: back });
        if (actor.hp <= 0) knockedOut(state, key, actorIdx);
      }
      // Toxic Skin: a melee hit may poison the attacker (a fresh 3–5 turns, replacing any poison it had).
      let poisoned: StatusEffect | undefined;
      if (!missed && skill.type === "melee" && hasStone(target, "toxic_skin") && actor.hp > 0 && !poisonImmune(actor) && Math.random() < TOXIC_SKIN.chance) {
        const rounds = TOXIC_SKIN.minRounds + Math.floor(Math.random() * (TOXIC_SKIN.maxRounds - TOXIC_SKIN.minRounds + 1));
        poisoned = { id: "poison", rounds, dmg: Math.max(1, Math.round(actor.maxHp * TOXIC_SKIN.tick)) };
        if (!poisonWith(actor, poisoned.dmg!, rounds)) poisoned = undefined;
        if (poisoned) armorFx.push(`${SOUL_STONES.toxic_skin.name}: poisoned for ${rounds} turns`);
      }
      if (poisoned) {
        hit.poisoned = poisoned;
        // The attacker's later snapshots in this hit (burned, recoil) carry the poison too, so it doesn't flicker off.
        for (const e of state.log.slice(hitAt + 1)) if (e.type === "effect" && e.side === key && e.index === actorIdx) e.statuses = actor.statuses.map((x) => ({ ...x }));
      }
      if (armorFx.length) hit.armorFx = armorFx.join(" · ");
      if (target.hp <= 0 && !burntOut) knockedOut(state, foeKey, targetIdx);

      // Nullify: some of a magic hit bounces back at the attacker.
      if (!missed && damage > 0 && skill.type === "magic" && hasSet(target, "arcane_nullifier") && actor.hp > 0) {
        const back = Math.min(actor.hp - bossMinHp(state, key, actorIdx), Math.max(1, Math.round(damage * NULLIFY_REFLECT)));
        if (back > 0) {
          actor.hp -= back;
          state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text: `takes ${back} damage reflected by ${SET_BONUS.arcane_nullifier.name}`,
            hp: actor.hp, statuses: actor.statuses.map((s) => ({ ...s })), kind: "set", damage: back });
          if (actor.hp <= 0) { knockedOut(state, key, actorIdx); break; }
        }
      }
    }
    // Implode: the user falls, and a cloud lies under the foes.
    if (fx?.kind === "implode" && actor.hp > 0) {
      actor.hp = 0;
      state.log.push({ type: "effect", side: key, index: actorIdx, name: actor.name, text: "bursts", hp: 0, statuses: actor.statuses.map((s) => ({ ...s })), kind: "ability" });
      knockedOut(state, key, actorIdx);
      layGround(state, foeKey, { kind: "cloud", move: skill.name, rounds: roll(fx.minRounds, fx.maxRounds) + 1, tick: fx.tick, tailMin: fx.tailMin, tailMax: fx.tailMax });
      cloudPoison(state, foeKey, foe.active);
    }
    // Smoke Bomb: then it swaps out (as a swap: its energy back, and the one coming in takes their hit).
    if (fx?.kind === "smoke" && actor.hp > 0) {
      const to = smokeSwapTo(state, key);
      if (to !== undefined) {
        const s = state.sides[key];
        const restored = Math.round((MAX_ENERGY - actor.energy) * SWAP_ENERGY_RESTORE);
        actor.energy = Math.min(MAX_ENERGY, actor.energy + restored);
        changeActive(state, key, to);
        s.swaps++;
        s.lastSwapRound = state.round;
        state.log.push({ type: "swap", side: key, from: actor.name, to: activeOf(s).name, toIndex: to, energyRestored: restored });
        groundOnEntry(state, key, to);
        haunt(state, key);
      }
    }
  }

  // 2a. A Healing Blessing from last round heals whoever is on the field
  //     now, once this round's attacks are done (so it mends the hit just taken).
  for (const k of ["A", "B"] as SideKey[]) {
    const s = state.sides[k];
    const b = s.blessing;
    if (!b || b.round > state.round) continue;
    s.blessing = undefined;
    const me = activeOf(s);
    if (b.round < state.round || me.hp <= 0) continue;
    const healed = Math.min(me.maxHp - me.hp, Math.round(me.maxHp * b.heal));
    me.hp += healed;
    state.log.push({ type: "effect", side: k, index: s.active, name: me.name, text: `is healed by ${b.by}'s Healing Blessing (+${healed} HP)`,
      hp: me.hp, statuses: me.statuses.map((x) => ({ ...x })), kind: "heal", damage: healed });
  }

  // 3. End of round: the ground bites whoever stands on it, venom bites
  //    (field and bench), then status effects and cooldowns tick down.
  //    The witch's illness works the same way (lib/dungeon/run.ts: curse), each
  //    one a creature has biting on its own (they stack: decision 39).
  for (const k of ["A", "B"] as SideKey[]) {
    const pool = groundOf(state.sides[k], "blood");
    if (!pool) continue;
    for (const i of fieldOf(state.sides[k])) bloodHit(state, k, i, pool, pool.tick);
  }
  for (const k of ["A", "B"] as SideKey[]) if (!groundOf(state.sides[k], "cloud")?.onEntry) for (const i of fieldOf(state.sides[k])) cloudPoison(state, k, i);
  for (const k of ["A", "B"] as SideKey[]) {
    const gore = groundOf(state.sides[k], "gore");
    state.sides[k].team.forEach((f, i) => {
      const biting = (["venom", "poison", "illness", "bleed"] as const).flatMap((id) => {
        const all = f.statuses.filter((s) => s.id === id);
        return (id === "illness" ? all : all.slice(0, 1)).map((st) => ({ id, st }));
      });
      for (const { id, st } of biting) {
        if (f.hp <= 0 || f.hidden) continue;
        const toxic = gore && (id === "venom" || id === "poison") && !cannotBleed(f) ? 1 + gore.amp : 1;
        const damage = Math.min(f.hp - bossMinHp(state, k, i), Math.round((st.dmg ?? 0) * toxic));
        if (damage <= 0) continue;
        f.hp -= damage;
        state.log.push({ type: "effect", side: k, index: i, name: f.name, text: id === "illness" ? `suffers an illness (${damage} damage)` : `takes ${damage} ${id} damage`,
          hp: f.hp, statuses: f.statuses.map((s) => ({ ...s })), kind: id, damage });
        if (f.hp <= 0) knockedOut(state, k, i);
      }
    });
  }
  for (const k of ["A", "B"] as SideKey[]) {
    for (const f of state.sides[k].team) {
      f.statuses = f.statuses.map((st) => ({ ...st, rounds: st.rounds - 1 })).filter((st) => st.rounds > 0);
      if (f.cooldowns) f.cooldowns = Object.fromEntries(Object.entries(f.cooldowns).map(([m, r]) => [m, r - 1]).filter(([, r]) => (r as number) > 0));
    }
    // Clouds and gore last a few rounds.
    const s = state.sides[k];
    if (s.ground?.some((g) => "rounds" in g)) {
      const before = s.ground.length;
      s.ground = s.ground.map((g) => ("rounds" in g ? { ...g, rounds: g.rounds - 1 } : g)).filter((g) => !("rounds" in g) || g.rounds > 0);
      if (s.ground.length !== before) state.log.push({ type: "ground", side: k, ground: s.ground.map((x) => ({ ...x })) });
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

// The blood under side `key` takes share of creature `index`'s max HP (not
// an Undead's), and the caster's side heals some of it. Returns the damage.
function bloodHit(state: BattleState, key: SideKey, index: number, pool: BloodPool, share: number, text = "bleeds in the blood pool"): number {
  const f = state.sides[key].team[index];
  if (!f || f.hp <= 0 || f.hidden || untouchedByBlood(f)) return 0;
  const damage = Math.min(f.hp - bossMinHp(state, key, index), Math.max(1, Math.round(f.maxHp * share)));
  if (damage <= 0) return 0;
  f.hp -= damage;
  state.log.push({ type: "effect", side: key, index, name: f.name, text: `${text} (${damage} damage)`, hp: f.hp, statuses: f.statuses.map((s) => ({ ...s })), kind: "blood", damage });
  if (f.hp <= 0) knockedOut(state, key, index);
  bloodLeech(state, other(key), pool, damage);
  return damage;
}
// Whoever the caster's side has on the field heals pool.leech of the damage.
function bloodLeech(state: BattleState, key: SideKey, pool: BloodPool, damage: number) {
  const s = state.sides[key];
  const me = activeOf(s);
  const healed = Math.min(me.maxHp - me.hp, Math.round(damage * pool.leech));
  if (me.hp <= 0 || me.hidden || healed <= 0) return;
  me.hp += healed;
  state.log.push({ type: "effect", side: key, index: s.active, name: me.name, text: `drinks from the blood (+${healed} HP)`, hp: me.hp, statuses: me.statuses.map((x) => ({ ...x })), kind: "heal", damage: healed });
}

// Creature `index` has just come onto side `key`'s field: whatever lies
// there greets it. Blood: entry damage (an Undead walks through untouched,
// and doesn't count); the last comer sets off the burst, and the pool's gone.
function groundOnEntry(state: BattleState, key: SideKey, index: number) {
  const s = state.sides[key];
  const f = s.team[index];
  const trops = groundOf(s, "caltrops");
  if (trops && f && f.hp > 0 && !f.hidden) {
    const damage = Math.min(f.hp - bossMinHp(state, key, index), Math.max(1, Math.round(f.maxHp * trops.entry)));
    if (damage > 0) {
      f.hp -= damage;
      state.log.push({ type: "effect", side: key, index, name: f.name, text: `steps on the caltrops (${damage} damage)`, hp: f.hp, statuses: f.statuses.map((x) => ({ ...x })), kind: "blood", damage });
      if (f.hp <= 0) knockedOut(state, key, index);
    }
  }
  cloudPoison(state, key, index);
  const pool = groundOf(s, "blood");
  if (!pool || !f || f.hp <= 0 || untouchedByBlood(f)) return;
  bloodHit(state, key, index, pool, pool.entry, "steps into the blood pool");
  const count = pool.count + 1;
  const last = count >= pool.entries;
  s.ground = (s.ground ?? []).flatMap((g) => (g !== pool ? [g] : last ? [] : [{ ...g, count }]));
  if (last && f.hp > 0) {
    // The burst: a magic hit with the caster's own stats.
    const caster = state.sides[other(key)].team[pool.by];
    const move = { name: pool.move, damage: pool.burst, energyCost: 0, type: "magic" as const, dmgType: "force" as const, race: "undead" as const };
    const damage = Math.min(f.hp - bossMinHp(state, key, index), calcDamage(move, caster, f, false, PRECISE_IGNORE, rollDamage()).damage);
    if (damage > 0) {
      f.hp -= damage;
      state.log.push({ type: "effect", side: key, index, name: f.name, text: `is caught as the blood pool bursts (${damage} damage)`, hp: f.hp, statuses: f.statuses.map((x) => ({ ...x })), kind: "burst", damage });
      if (f.hp <= 0) knockedOut(state, key, index);
      bloodLeech(state, other(key), pool, damage);
    }
  }
  state.log.push({ type: "ground", side: key, ground: (s.ground ?? []).map((g) => ({ ...g })) });
}

// A new creature steps in (swap or replacement). The one leaving loses its
// run (a Perfectionist starts again), any soak and any boost; the newcomer starts fresh.
export function changeActive(state: BattleState, key: SideKey, index: number) {
  const s = state.sides[key];
  const leaving = activeOf(s);
  leaving.streak = undefined;
  leaving.defenceCut = undefined;
  leaving.boost = undefined;
  leaving.statuses = leaving.statuses.filter((st) => !["soak", "boost", "bleed", "weaken", "charged"].includes(st.id));
  s.active = index;
  activeOf(s).streak = undefined;
}

export function sendInReplacement(state: BattleState, key: SideKey, index: number): BattleState {
  const s = state.sides[key];
  if (!state.needsReplacement.includes(key)) return state;
  if (index === s.active || !s.team[index] || s.team[index].hp <= 0) throw new Error(`Invalid replacement ${index} for side ${key}`);
  changeActive(state, key, index);
  s.arrived = index; // (a blood pool or caltrops greet it as the next round starts)
  cloudPoison(state, key, index); // (a cloud, at once)
  state.needsReplacement = state.needsReplacement.filter((k) => k !== key);
  state.log.push({ type: "sendIn", side: key, name: activeOf(s).name, index });
  return state;
}

function checkWinner(state: BattleState) {
  const a = aliveCount(state.sides.A), b = aliveCount(state.sides.B);
  const timeUp = !!state.turnLimit && state.round >= state.turnLimit;
  if (a > 0 && b > 0 && state.round < MAX_ROUNDS && !timeUp) return;
  state.winner = a > 0 && b === 0 ? "A" : b > 0 && (a === 0 || timeUp) ? "B" : "draw";
  state.log.push({ type: "end", winner: state.winner });
}

// An ambush partner's turn (an ordinary side with two on the field): its
// hardest-hitting affordable move on the foe's main creature, or a rest.
export function partnerAction(state: BattleState, key: SideKey): BattleAction {
  const s = state.sides[key];
  const me = s.team[s.partner!];
  const them = activeOf(state.sides[other(key)]);
  const best = affordableSkills(me)
    .map((sk) => ({ sk, dmg: calcDamage(sk, me, them, false).damage }))
    .sort((x, y) => y.dmg - x.dmg)[0];
  return best ? { kind: "attack", skillName: best.sk.name } : { kind: "pass" };
}

// Deep-enough copy for React state updates.
export function cloneBattle(state: BattleState): BattleState {
  const side = (s: BattleSide): BattleSide => ({
    ...s,
    team: s.team.map((f) => ({ ...f, statuses: f.statuses.map((st) => ({ ...st })), streak: f.streak && { ...f.streak }, cooldowns: f.cooldowns && { ...f.cooldowns } })),
    boss: s.boss && { ...s.boss, ...(s.boss.down ? { down: [...s.boss.down] } : {}) },
    ...(s.field ? { field: [...s.field] } : {}),
    blessing: s.blessing && { ...s.blessing },
    ground: s.ground && s.ground.map((g) => ({ ...g })),
  });
  return {
    ...state,
    sides: { A: side(state.sides.A), B: side(state.sides.B) },
    needsReplacement: [...state.needsReplacement],
    log: [...state.log],
  };
}
