// lib/combat/bossAi.ts
// Dungeon bosses: how they fight and how they change between phases.
// A boss side is played by this script, never by the normal AI, and it
// never swaps. The battle engine (battle.ts) asks it for the boss's actions
// each round and lets it change the line-up at the end of each round.
//
// The Cyclops (dungeon 1) — team order: body, hand, hand, eye.
// 1. The body: a big melee tank. Stomp can cripple you hard (swap out!).
// 2. At half health the body falls apart into two Crawling Hands: very fast,
//    strong melee, both on the field at once (a melee tank's moment).
// 3. When both hands are down, the Eye tears free: ranged lasers, and it
//    floats (Float stance: takes more from ranged, less from melee).
//
// The Hydra (dungeon 2, the Deep Labyrinth; the user, 2026-10-30) — team
// order: the Fang Head (melee), the Spitter Head (ranged), the Hex Head
// (magic), left to right, all three on the field from the start (you pick
// which to hit). No race, like every boss.
// - One head acts each round, left to right, starting from a random head;
//   a head that's down is skipped.
// - Toxic Breath: once, at a random round from 3 to 5, the head whose turn
//   it is breathes instead of attacking. The cloud hangs for the next
//   CLOUD_ROUNDS rounds: your creature on the field is poisoned, and so is
//   any creature that comes in while it hangs there (a swap or a
//   replacement). A creature that's already poisoned isn't poisoned again.
//   Once a cloud has cleared, each turn has a REBREATH chance of another.
// - Heads grow back: REGROW_ROUNDS rounds after a head goes down, unless
//   another goes down first (that starts the count again). Then every head
//   that's down comes back: one with 75% of its HP, two with 50% each.
//   Beat all three before that and the Hydra is dead.

import type { BattleAction, BattleEvent, BattleSide, BattleState, Combatant, SideKey } from "./battle";

export type BossKind = "cyclops" | "hydra";
// The Hydra's: next: the head whose turn is next. breathAt: the round of its
// first breath. cloudUntil: the last round its cloud hangs. regrow: rounds
// until the heads that are down grow back. down: the heads that were down at
// the end of last round.
export type BossState = { kind: BossKind; phase: number; next?: number; breathAt?: number; cloudUntil?: number; regrow?: number; down?: number[] };

export const CYCLOPS = {
  BODY: 0, HANDS: [1, 2], EYE: 3,
  SPLIT_AT: 0.5,       // the body falls apart at this share of its HP
  LASER_CHANCE: 0.15,  // the body's occasional (expensive) eye laser
  STOMP_CHANCE: 0.33,  // how often the body stomps (when the target isn't already crippled)
  GRIP_CHANCE: 0.4,    // hands: the big squeeze vs the quick claw
  BEAM_CHANCE: 0.5,    // eye: the big beam vs the quick laser
};

export const HYDRA = {
  HEADS: [0, 1, 2],
  BREATH_FROM: 3, BREATH_TO: 5, // the first breath comes in one of these rounds
  CLOUD_ROUNDS: 3,     // the cloud hangs for this many rounds after the breath
  POISON_TICK: 0.025,  // the cloud's poison: this share of max HP a round…
  POISON_ROUNDS: 20,   // …for this many rounds
  REBREATH: 0.2,       // once a cloud has cleared, the chance each turn of another
  REGROW_ROUNDS: 5,    // rounds after a head goes down until it grows back
  REGROW_HP: [0.75, 0.5], // the HP heads grow back with: one head, or two
  HEAVY_CHANCE: 0.5,   // a head's heavy move vs its quick one
};
const HEAD_MOVES: Record<string, [quick: string, heavy: string]> = {
  "Fang Head": ["Snap", "Rending Bite"],
  "Spitter Head": ["Acid Spit", "Acid Torrent"],
  "Hex Head": ["Hex Bolt", "Withering Curse"],
};

// Who is hidden at the start (revealed as the phases arrive).
export function bossHiddenAtStart(kind: BossKind): number[] {
  return kind === "cyclops" ? [...CYCLOPS.HANDS, CYCLOPS.EYE] : [];
}

// A new boss fight: its starting line-up and anything it rolls up front.
export function bossSetup(side: BattleSide, kind: BossKind) {
  side.boss = { kind, phase: 1 };
  side.partner = null;
  for (const i of bossHiddenAtStart(kind)) side.team[i].hidden = true;
  if (kind === "hydra") {
    side.field = [...HYDRA.HEADS];
    side.boss.next = Math.floor(Math.random() * HYDRA.HEADS.length);
    side.boss.breathAt = HYDRA.BREATH_FROM + Math.floor(Math.random() * (HYDRA.BREATH_TO - HYDRA.BREATH_FROM + 1));
    side.boss.down = [];
  }
}

const crippled = (f: Combatant) => f.statuses.some((s) => s.id === "cripple");
const canUse = (f: Combatant, name: string) => f.skills.some((s) => s.name === name && s.energyCost <= f.energy);
const attack = (name: string): BattleAction => ({ kind: "attack", skillName: name });

// First of the named moves it can afford, or rest.
function firstAffordable(f: Combatant, ...names: string[]): BattleAction {
  const name = names.find((n) => canUse(f, n));
  return name ? attack(name) : { kind: "pass" };
}

// The boss's actions this round: one per creature it has on the field (the
// Hydra: one head a round).
export function bossActions(state: BattleState, key: SideKey): { index: number; action: BattleAction }[] {
  const side = state.sides[key];
  if (side.boss?.kind === "hydra") return hydraTurn(state, side);
  const foe = state.sides[key === "A" ? "B" : "A"];
  const target = foe.team[foe.active];
  const out: { index: number; action: BattleAction }[] = [];
  for (const index of [side.active, side.partner].filter((i): i is number => i != null)) {
    const me = side.team[index];
    if (me.hp <= 0) continue;
    const r = Math.random();
    let action: BattleAction;
    switch (me.name) {
      case "Cyclops":
        if (r < CYCLOPS.LASER_CHANCE && canUse(me, "Eye Laser")) action = attack("Eye Laser");
        else if (r < CYCLOPS.LASER_CHANCE + CYCLOPS.STOMP_CHANCE && !crippled(target) && canUse(me, "Stomp")) action = attack("Stomp");
        else action = firstAffordable(me, "Club Smash", "Backhand");
        break;
      case "Left Hand":
      case "Right Hand":
        action = r < CYCLOPS.GRIP_CHANCE ? firstAffordable(me, "Crushing Grip", "Claw Rake") : firstAffordable(me, "Claw Rake");
        break;
      default: // The Eye
        action = r < CYCLOPS.BEAM_CHANCE ? firstAffordable(me, "Searing Beam", "Laser") : firstAffordable(me, "Laser");
    }
    out.push({ index, action });
  }
  return out;
}

// The Hydra's turn: the next head standing, left to right, breathes or bites.
function hydraTurn(state: BattleState, side: BattleSide): { index: number; action: BattleAction }[] {
  const boss = side.boss!;
  const n = HYDRA.HEADS.length;
  const from = boss.next ?? 0;
  const head = HYDRA.HEADS.map((_, k) => (from + k) % n).find((i) => side.team[i].hp > 0);
  if (head === undefined) return [];
  boss.next = (head + 1) % n;
  const me = side.team[head];
  if (breathes(state, boss)) return [{ index: head, action: attack("Toxic Breath") }];
  const [quick, heavy] = HEAD_MOVES[me.name] ?? [me.skills[0].name, me.skills[0].name];
  return [{ index: head, action: Math.random() < HYDRA.HEAVY_CHANCE ? firstAffordable(me, heavy, quick) : firstAffordable(me, quick) }];
}

// Does the Hydra breathe this round? Its first breath at breathAt; after
// that, now and then once the last cloud has cleared.
function breathes(state: BattleState, boss: BossState): boolean {
  if (boss.cloudUntil === undefined) return state.round >= (boss.breathAt ?? HYDRA.BREATH_FROM);
  return state.round > boss.cloudUntil && Math.random() < HYDRA.REBREATH;
}

// A boss's move used on itself (the Hydra's breath): the end of the move's
// log line, and anything it causes.
export function bossSelfMove(state: BattleState, key: SideKey, skillName: string): { text: string; events: BattleEvent[] } {
  const boss = state.sides[key].boss;
  if (boss?.kind !== "hydra" || skillName !== "Toxic Breath") return { text: "", events: [] };
  boss.cloudUntil = state.round + HYDRA.CLOUD_ROUNDS;
  const foeKey: SideKey = key === "A" ? "B" : "A";
  const foe = state.sides[foeKey];
  const ev = poisonByCloud(foe, foeKey, foe.active);
  return { text: ` — a poison cloud fills the lair for ${HYDRA.CLOUD_ROUNDS} rounds`, events: ev ? [ev] : [] };
}

// Side `key`'s creature at `index` has just come in to fight in `round`: if
// the other side is a Hydra whose cloud hangs then, it's poisoned.
export function bossCloudOnEntry(state: BattleState, key: SideKey, index: number, round: number): BattleEvent[] {
  const boss = state.sides[key === "A" ? "B" : "A"].boss;
  if (boss?.kind !== "hydra" || boss.cloudUntil === undefined || round > boss.cloudUntil) return [];
  const ev = poisonByCloud(state.sides[key], key, index);
  return ev ? [ev] : [];
}

// The cloud's poison, unless it's already poisoned.
function poisonByCloud(side: BattleSide, key: SideKey, index: number): BattleEvent | undefined {
  const f = side.team[index];
  if (!f || f.hp <= 0 || f.statuses.some((s) => s.id === "poison")) return undefined;
  f.statuses = [...f.statuses, { id: "poison", rounds: HYDRA.POISON_ROUNDS, dmg: Math.max(1, Math.round(f.maxHp * HYDRA.POISON_TICK)) }];
  return { type: "effect", side: key, index, name: f.name, text: `breathes in the poison cloud — poisoned for ${HYDRA.POISON_ROUNDS} rounds`,
    hp: f.hp, statuses: f.statuses.map((s) => ({ ...s })), kind: "poisoned" };
}

// How many more rounds the Hydra's cloud hangs over (0: none).
export function cloudLeft(state: BattleState, key: SideKey): number {
  const boss = state.sides[key].boss;
  return boss?.cloudUntil === undefined ? 0 : Math.max(0, boss.cloudUntil - state.round);
}

// The lowest HP a hit can leave this boss creature on (the body can't be
// knocked out — it falls apart instead).
export function bossMinHp(state: BattleState, key: SideKey, index: number): number {
  const boss = state.sides[key].boss;
  return boss?.kind === "cyclops" && boss.phase === 1 && index === CYCLOPS.BODY ? 1 : 0;
}

// End of round: change phase if it's time. Returns the events to log.
export function bossEndOfRound(state: BattleState, key: SideKey): BattleEvent[] {
  const side = state.sides[key];
  const boss = side.boss;
  if (boss?.kind === "hydra") return hydraEndOfRound(side, key);
  if (boss?.kind !== "cyclops") return [];
  const t = side.team;

  if (boss.phase === 1 && t[CYCLOPS.BODY].hp <= t[CYCLOPS.BODY].maxHp * CYCLOPS.SPLIT_AT) {
    boss.phase = 2;
    t[CYCLOPS.BODY].hp = 0;
    for (const i of CYCLOPS.HANDS) t[i].hidden = false;
    side.active = CYCLOPS.HANDS[0];
    side.partner = CYCLOPS.HANDS[1];
    return [{ type: "lineup", side: key, active: side.active, partner: side.partner, reveal: CYCLOPS.HANDS, gone: [CYCLOPS.BODY],
      text: "The Cyclops falls to the ground… then suddenly both hands tear free of its arms and run at you!" }];
  }
  if (boss.phase === 2 && CYCLOPS.HANDS.every((i) => t[i].hp <= 0)) {
    boss.phase = 3;
    t[CYCLOPS.EYE].hidden = false;
    side.active = CYCLOPS.EYE;
    side.partner = null;
    return [{ type: "lineup", side: key, active: side.active, partner: null, reveal: [CYCLOPS.EYE],
      text: "The last hand twitches and lies still. Then the Cyclops's skull splits open — the Eye tears itself free and rises into the air, crackling with light!" }];
  }
  return [];
}

// The Hydra's heads: a head just down starts (or restarts) the count; when
// it runs out, every head that's down grows back.
function hydraEndOfRound(side: BattleSide, key: SideKey): BattleEvent[] {
  const boss = side.boss!;
  const t = side.team;
  let down = HYDRA.HEADS.filter((i) => t[i].hp <= 0);
  const fresh = down.some((i) => !(boss.down ?? []).includes(i));
  const events: BattleEvent[] = [];
  if (down.length === 0 || down.length === HYDRA.HEADS.length) {
    boss.regrow = undefined; // (all three down: it's dead)
  } else if (fresh) {
    boss.regrow = HYDRA.REGROW_ROUNDS;
  } else if (boss.regrow !== undefined && --boss.regrow <= 0) {
    boss.regrow = undefined;
    const share = HYDRA.REGROW_HP[Math.min(down.length, HYDRA.REGROW_HP.length) - 1];
    for (const i of down) {
      const f = t[i];
      f.hp = Math.max(1, Math.round(f.maxHp * share));
      f.statuses = [];
      f.cooldowns = undefined;
      f.streak = undefined;
      events.push({ type: "effect", side: key, index: i, name: f.name, text: `grows back with ${f.hp} HP!`, hp: f.hp, statuses: [], kind: "regrow" });
    }
    down = [];
  }
  boss.down = down;
  // Its main head is the first one standing (what an untargeted attack hits).
  const standing = HYDRA.HEADS.find((i) => t[i].hp > 0);
  if (standing !== undefined) side.active = standing;
  return events;
}
