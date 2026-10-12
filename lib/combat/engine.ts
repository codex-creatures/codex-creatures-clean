// lib/combat/engine.ts

import type { Skill } from "../creatures/creatureData";

// Type guard for brace skill
function isBraceSkill(skill: Skill): boolean {
  return (skill as any).isBrace === true;
}
export type Stance = "neutral" | "float" | "entrench";

export type CombatItem = {
  atk: number;
  rng: number;
  agil: number;
  mdef: number;
  rdef: number;
  hp: number;
};

export type Fighter = {
  name: string;
  hp: number;
  maxHp: number;
  energy: number;
  proficiency: { atk: number; rng: number; agil: number; mdef: number; rdef: number };
  skills: Skill[];
  weapon: CombatItem;
  armor: CombatItem;
  stance: Stance;
  elemental: "inferno" | "aqua" | "naturist" | null;
  braceActive?: boolean;
  braceConsecutiveCount?: number;
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

function stanceDamageDealt(stance: Stance, moveType: "melee" | "ranged"): number {
  if (stance === "entrench" && moveType === "melee")  return 1.10;
  if (stance === "float"    && moveType === "ranged") return 1.10;
  return 1.0;
}

function stanceDamageTaken(stance: Stance, moveType: "melee" | "ranged"): number {
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
  return stat * (1 + profPct / 100);
}

export function effectiveAgil(f: Fighter): number {
  return withProf(f.weapon.agil + f.armor.agil, f.proficiency.agil);
}

export function effectiveStats(f: Fighter) {
  return {
    atk:  withProf(f.weapon.atk,  f.proficiency.atk),
    rng:  withProf(f.weapon.rng,  f.proficiency.rng),
    agil: withProf(f.weapon.agil + f.armor.agil, f.proficiency.agil),
    mdef: withProf(f.armor.mdef,  f.proficiency.mdef),
    rdef: withProf(f.armor.rdef,  f.proficiency.rdef),
  };
}

export function calcDamage(
  skill: Skill,
  attacker: Fighter,
  defender: Fighter,
  precise: boolean,
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

  const weaponStat   = moveType === "melee" ? attacker.weapon.atk  : attacker.weapon.rng;
  const atkProf      = moveType === "melee" ? attacker.proficiency.atk : attacker.proficiency.rng;
  const effectiveAtk = withProf(weaponStat, atkProf);
  const raw          = skill.damage + effectiveAtk;

  const atkStance    = stanceDamageDealt(attacker.stance, moveType);
  const defStance    = stanceDamageTaken(defender.stance, moveType);
  const elemental    = elementalModifier(attacker.elemental, defender.elemental);

  const armorStat      = moveType === "melee" ? defender.armor.mdef  : defender.armor.rdef;
  const defProf        = moveType === "melee" ? defender.proficiency.mdef : defender.proficiency.rdef;
  const effectiveDef   = withProf(armorStat, defProf);
  const defenseApplied = precise ? effectiveDef * 0.75 : effectiveDef;

  let finalDmg = Math.max(1, Math.round(raw * atkStance * defStance * elemental - defenseApplied));
  if (braceBlocked) finalDmg = Math.max(1, Math.floor(finalDmg * 0.5));

  return { damage: finalDmg, braceBlocked, braceFailed };
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
      const skill = [...atk.skills].filter(s => !isBraceSkill(s) && s.energyCost <= atk.energy).sort((x, y) => y.damage - x.damage)[0];
      if (!skill) continue;

      const precise      = Math.random() < 0.05;
      const energyBefore = atk.energy;
      const { damage: dmg, braceBlocked, braceFailed } = calcDamage(skill, atk, def, precise);
      atk.energy -= skill.energyCost;

      const hpBefore = def.hp;
      def.hp = Math.max(0, def.hp - dmg);

      // Energy regen end of turn
      atk.energy = Math.min(100, atk.energy + 30);

      logs.push({ turn: round, attacker: atk.name, defender: def.name, skill, stance: atk.stance, defenderStance: def.stance, rawDamage: skill.damage, finalDamage: dmg, precise, braceBlocked, braceFailed, attackerEnergyBefore: energyBefore, attackerEnergyAfter: atk.energy, defenderHpBefore: hpBefore, defenderHpAfter: def.hp, stanceChosen: atk.stance });
    }
  }

  const winner = a.hp > 0 && b.hp <= 0 ? a.name : b.hp > 0 && a.hp <= 0 ? b.name : "Draw";
  return { winner, turns: logs, totalTurns: round };
}