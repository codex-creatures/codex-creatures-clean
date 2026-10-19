// lib/combat/engine.ts

import type { CombatClass, CreatureProficiency, DamageType, Skill } from "../creatures/creatureData";

// Type guard for brace skill
function isBraceSkill(skill: Skill): boolean {
  return (skill as { isBrace?: boolean }).isBrace === true;
}
export type Stance = "neutral" | "float" | "entrench";

export type CombatItem = {
  atk: number;    // melee
  rng: number;    // ranged
  mag: number;    // magic
  agil: number;
  mdef: number;   // melee defence
  rdef: number;   // ranged defence
  magdef: number; // magic defence
  hp: number;
  affinity?: DamageType; // weapons: moves of this damage type hit harder with it
};

export type Fighter = {
  name: string;
  hp: number;
  maxHp: number;
  energy: number;
  proficiency: CreatureProficiency;
  cls: CombatClass; // primary class (the triangle)
  skills: Skill[];
  weapon: CombatItem;
  armor: CombatItem;
  stance: Stance;
  elemental: "inferno" | "aqua" | "naturist" | null;
  braceActive?: boolean;
  braceConsecutiveCount?: number;
  armorSet?: import("../items/armor").ArmorKey; // wearing a full set: its mechanic applies
  ability?: import("../creatures/abilities").AbilityKey; // a rare passive it was born with
  level?: number; // its level (lib/creatures/levels.ts)
  hpMult?: number; // its HP was multiplied (an encampment's potion-drunk foes): arcane's cap grows with it
};

export type TurnLog = {
  turn: number;
  attacker: string;
  defender: string;
  skill: Skill;
  stance: Stance;
  defenderStance: Stance;
  rawDamage: number;
  finalDamage: number;
  precise: boolean;
  braceBlocked: boolean;
  braceFailed: boolean;
  attackerEnergyBefore: number;
  attackerEnergyAfter: number;
  defenderHpBefore: number;
  defenderHpAfter: number;
  stanceChosen: Stance;
};

export type BattleResult = {
  winner: string;
  turns: TurnLog[];
  totalTurns: number;
};

function stanceDamageDealt(stance: Stance, moveType: CombatClass): number {
  if (stance === "entrench" && moveType === "melee")  return 1.10;
  if (stance === "float"    && moveType === "ranged") return 1.10;
  return 1.0;
}

function stanceDamageTaken(stance: Stance, moveType: CombatClass): number {
  if (stance === "float"    && moveType === "melee")  return 0.90;
  if (stance === "entrench" && moveType === "ranged") return 0.90;
  if (stance === "float"    && moveType === "ranged") return 1.10;
  if (stance === "entrench" && moveType === "melee")  return 1.10;
  return 1.0;
}

function elementalModifier(atk: Fighter["elemental"], def: Fighter["elemental"]): number {
  if (!atk || !def || atk === def) return 1.0;
  if (atk === "inferno"  && def === "naturist") return 1.05;
  if (atk === "naturist" && def === "aqua")     return 1.05;
  if (atk === "aqua"     && def === "inferno")  return 1.05;
  if (atk === "naturist" && def === "inferno")  return 0.95;
  if (atk === "aqua"     && def === "naturist") return 0.95;
  if (atk === "inferno"  && def === "aqua")     return 0.95;
  return 1.0;
}

function withProf(stat: number, profPct: number): number {
  return stat * (1 + (profPct ?? 0) / 100);
}

// ── The combat triangle ─────────────────────────────────
// Melee beats ranged, ranged beats magic, magic beats melee. A move's style
// against the target's primary class.
export const TRIANGLE = { strong: 1.5, weak: 0.5 }; // +50% / −50% damage
export const BEATS: Record<CombatClass, CombatClass> = { melee: "ranged", ranged: "magic", magic: "melee" };

export function triangleModifier(moveStyle: CombatClass, targetClass: CombatClass): number {
  if (BEATS[moveStyle] === targetClass) return TRIANGLE.strong;
  if (BEATS[targetClass] === moveStyle) return TRIANGLE.weak;
  return 1;
}

// ── Damage types ────────────────────────────────────────
// mult: the hit after armour; pen: share of armour it ignores;
// maxHp: arcane moves also take this share of the target's max HP per
// ARCANE_REF_POWER of move power (capped at ARCANE_CAP per hit, times the
// target's hpMult: arcane is the answer to a foe with swollen HP).
export const DAMAGE_TYPES: Record<DamageType, { mult: number; pen: number; maxHp: number }> = {
  force:  { mult: 1.1,  pen: 0,    maxHp: 0 },
  pierce: { mult: 0.95, pen: 0.5,  maxHp: 0 },
  arcane: { mult: 0.9,  pen: 0.2,  maxHp: 0.04 },
};
export const ARCANE_REF_POWER = 25; // a 25-power arcane move takes 4% of max HP
export const ARCANE_CAP = 15;
export const AFFINITY_BONUS = 0.15; // weapon affinity matches the move's damage type

// Which stats a move uses.
export const ATTACK_STAT: Record<CombatClass, "atk" | "rng" | "mag"> = { melee: "atk", ranged: "rng", magic: "mag" };
export const DEFENCE_STAT: Record<CombatClass, "mdef" | "rdef" | "magdef"> = { melee: "mdef", ranged: "rdef", magic: "magdef" };

export function effectiveAgil(f: Fighter): number {
  return withProf(f.weapon.agil + f.armor.agil, f.proficiency.agil);
}

export function effectiveStats(f: Fighter) {
  return {
    atk:    withProf(f.weapon.atk,  f.proficiency.atk),
    rng:    withProf(f.weapon.rng,  f.proficiency.rng),
    mag:    withProf(f.weapon.mag ?? 0, f.proficiency.mag),
    agil:   withProf(f.weapon.agil + f.armor.agil, f.proficiency.agil),
    mdef:   withProf(f.armor.mdef,  f.proficiency.mdef),
    rdef:   withProf(f.armor.rdef,  f.proficiency.rdef),
    magdef: withProf(f.armor.magdef ?? 0, f.proficiency.magdef),
  };
}

// roll: the hit's damage roll before armour (rollDamage()); 1 = the
// average, used for previews and the AI.
export function calcDamage(
  skill: Skill,
  attacker: Fighter,
  defender: Fighter,
  precise: boolean,
  preciseIgnore = PRECISE_IGNORE, // share of defence a precise hit ignores
  roll = 1,
): { damage: number; braceBlocked: boolean; braceFailed: boolean } {
  if (isBraceSkill(skill)) {
    return { damage: 0, braceBlocked: false, braceFailed: false };
  }

  const moveType = skill.type;

  let braceBlocked = false;
  let braceFailed  = false;

  if (defender.braceActive && !precise) {
    const consecutive = (defender.braceConsecutiveCount ?? 0) > 1;
    if (consecutive && Math.random() < 0.5) {
      braceFailed = true;
    } else {
      braceBlocked = true;
    }
  }

  const dmgType = DAMAGE_TYPES[skill.dmgType ?? "force"];
  const atkKey = ATTACK_STAT[moveType], defKey = DEFENCE_STAT[moveType];
  const effectiveAtk = withProf(attacker.weapon[atkKey] ?? 0, attacker.proficiency[atkKey]);
  const affinity     = attacker.weapon.affinity && attacker.weapon.affinity === skill.dmgType ? 1 + AFFINITY_BONUS : 1;
  const raw          = (skill.damage + effectiveAtk) * roll;

  const atkStance    = stanceDamageDealt(attacker.stance, moveType);
  const defStance    = stanceDamageTaken(defender.stance, moveType);
  const elemental    = elementalModifier(attacker.elemental, defender.elemental);
  const triangle     = triangleModifier(moveType, defender.cls);

  // Armour defence counts at ARMOR_DEFENCE_WEIGHT. Penetration and precise
  // hits each ignore a share of what's left.
  const effectiveDef   = withProf(defender.armor[defKey] ?? 0, defender.proficiency[defKey]) * ARMOR_DEFENCE_WEIGHT;
  const defenseApplied = effectiveDef * (1 - dmgType.pen) * (precise ? 1 - preciseIgnore : 1);

  // Attack against defence as a ratio: defence always cuts damage, but a hit
  // never drops to nothing (a hit as big as the counted defence does half).
  const afterArmor = raw > 0 ? (raw * raw) / (raw + defenseApplied) : 0;
  const arcane = Math.min(ARCANE_CAP * (defender.hpMult ?? 1), defender.maxHp * dmgType.maxHp * (skill.damage / ARCANE_REF_POWER));

  let finalDmg = Math.max(1, Math.round((afterArmor * dmgType.mult * affinity + arcane) * atkStance * defStance * elemental * triangle));
  if (braceBlocked) finalDmg = Math.max(1, Math.floor(finalDmg * 0.5));

  return { damage: finalDmg, braceBlocked, braceFailed };
}

// ── Energy & precise hits ───────────────────────────────
export const MAX_ENERGY = 100;
export const ENERGY_REGEN = 30;     // after each attack
export const PRECISE_CHANCE = 0.05; // chance of a precise hit…
export const PRECISE_IGNORE = 0.25; // …which ignores 25% of defence

// Armour pieces each roll a whole budget, so a full set shows about three
// times the defence one roll used to; it counts at a third, blocking what it
// always did (lib/items/armor.ts).
export const ARMOR_DEFENCE_WEIGHT = 1 / 3;

// Every hit rolls its damage (before armour) within ±DAMAGE_VARIANCE of the
// average, so fights don't settle into the same numbers every round.
export const DAMAGE_VARIANCE = 0.05;
export const rollDamage = (rng: () => number = Math.random) => 1 - DAMAGE_VARIANCE + rng() * 2 * DAMAGE_VARIANCE;

// ── Auto-battle move choice ─────────────────────────────
export type CombatStyle = CombatClass;

export function combatStyle(f: Fighter): CombatStyle {
  return f.cls;
}

// The class a set of %s points to: its best attack multiplier (for gear
// suggestions; a creature's real class is set on its template).
export function styleFromProficiency(p: { atk: number; rng: number; mag?: number }): CombatStyle {
  const mag = p.mag ?? 0;
  if (mag > p.atk && mag > p.rng) return "magic";
  return p.atk >= p.rng ? "melee" : "ranged";
}

// Auto-battle: the affordable move that hurts this opponent most (its
// damage already accounts for the triangle, armour and damage types).
export function chooseSkill(atk: Fighter, def: Fighter): Skill | undefined {
  const affordable = atk.skills.filter(s => !isBraceSkill(s) && !s.self && s.energyCost <= atk.energy);
  if (affordable.length === 0) return undefined;
  const dmg = (s: Skill) => calcDamage(s, atk, def, false).damage;
  return affordable.reduce((best, s) => (dmg(s) > dmg(best) ? s : best));
}

export function runBattle(fighterA: Fighter, fighterB: Fighter, maxTurns = 60): BattleResult {
  const a: Fighter = { ...fighterA, hp: fighterA.maxHp, energy: 100, braceActive: false, braceConsecutiveCount: 0 };
  const b: Fighter = { ...fighterB, hp: fighterB.maxHp, energy: 100, braceActive: false, braceConsecutiveCount: 0 };
  const logs: TurnLog[] = [];
  let round = 0;

  const aAgil = effectiveAgil(fighterA);
  const bAgil = effectiveAgil(fighterB);

  while (a.hp > 0 && b.hp > 0 && round < maxTurns) {
    round++;
    a.braceActive = false;
    b.braceActive = false;

    const [first, second] = aAgil >= bAgil ? [a, b] : [b, a];
    for (const [atk, def] of [[first, second], [second, first]] as [Fighter, Fighter][]) {
      if (atk.hp <= 0) continue;
      const skill = chooseSkill(atk, def);
      if (!skill) continue;

      const precise      = Math.random() < PRECISE_CHANCE;
      const energyBefore = atk.energy;
      const { damage: dmg, braceBlocked, braceFailed } = calcDamage(skill, atk, def, precise, PRECISE_IGNORE, rollDamage());
      atk.energy -= skill.energyCost;

      const hpBefore = def.hp;
      def.hp = Math.max(0, def.hp - dmg);

      // Energy regen end of turn
      atk.energy = Math.min(MAX_ENERGY, atk.energy + ENERGY_REGEN);

      logs.push({ turn: round, attacker: atk.name, defender: def.name, skill, stance: atk.stance, defenderStance: def.stance, rawDamage: skill.damage, finalDamage: dmg, precise, braceBlocked, braceFailed, attackerEnergyBefore: energyBefore, attackerEnergyAfter: atk.energy, defenderHpBefore: hpBefore, defenderHpAfter: def.hp, stanceChosen: atk.stance });
    }
  }

  const winner = a.hp > 0 && b.hp <= 0 ? a.name : b.hp > 0 && a.hp <= 0 ? b.name : "Draw";
  return { winner, turns: logs, totalTurns: round };
}