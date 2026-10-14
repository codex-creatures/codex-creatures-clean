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

import type { BattleAction, BattleEvent, BattleState, Combatant, SideKey } from "./battle";

export type BossKind = "cyclops";
export type BossState = { kind: BossKind; phase: number };

export const CYCLOPS = {
  BODY: 0, HANDS: [1, 2], EYE: 3,
  SPLIT_AT: 0.5,       // the body falls apart at this share of its HP
  LASER_CHANCE: 0.15,  // the body's occasional (expensive) eye laser
  STOMP_CHANCE: 0.33,  // how often the body stomps (when the target isn't already crippled)
  GRIP_CHANCE: 0.4,    // hands: the big squeeze vs the quick claw
  BEAM_CHANCE: 0.5,    // eye: the big beam vs the quick laser
};

// Who is hidden at the start (revealed as the phases arrive).
export function bossHiddenAtStart(kind: BossKind): number[] {
  return kind === "cyclops" ? [...CYCLOPS.HANDS, CYCLOPS.EYE] : [];
}

const crippled = (f: Combatant) => f.statuses.some((s) => s.id === "cripple");
const canUse = (f: Combatant, name: string) => f.skills.some((s) => s.name === name && s.energyCost <= f.energy);
const attack = (name: string): BattleAction => ({ kind: "attack", skillName: name });

// First of the named moves it can afford, or rest.
function firstAffordable(f: Combatant, ...names: string[]): BattleAction {
  const name = names.find((n) => canUse(f, n));
  return name ? attack(name) : { kind: "pass" };
}

// The boss's actions this round: one per creature it has on the field.
export function bossActions(state: BattleState, key: SideKey): { index: number; action: BattleAction }[] {
  const side = state.sides[key];
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
  if (boss?.kind !== "cyclops") return [];
  const t = side.team;

  if (boss.phase === 1 && t[CYCLOPS.BODY].hp <= t[CYCLOPS.BODY].maxHp * CYCLOPS.SPLIT_AT) {
    boss.phase = 2;
    t[CYCLOPS.BODY].hp = 0;
    for (const i of CYCLOPS.HANDS) t[i].hidden = false;
    side.active = CYCLOPS.HANDS[0];
    side.partner = CYCLOPS.HANDS[1];
    return [{ type: "lineup", side: key, active: side.active, partner: side.partner, reveal: CYCLOPS.HANDS, gone: [CYCLOPS.BODY],
      text: "The Cyclops staggers… and falls apart! Its two hands drop to the floor and come scuttling at you." }];
  }
  if (boss.phase === 2 && CYCLOPS.HANDS.every((i) => t[i].hp <= 0)) {
    boss.phase = 3;
    t[CYCLOPS.EYE].hidden = false;
    side.active = CYCLOPS.EYE;
    side.partner = null;
    return [{ type: "lineup", side: key, active: side.active, partner: null, reveal: [CYCLOPS.EYE],
      text: "The skull cracks open. The Eye tears free and floats into the air, crackling with light!" }];
  }
  return [];
}
