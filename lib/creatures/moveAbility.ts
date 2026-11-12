// lib/creatures/moveAbility.ts
// A move's ability in a word or two, for the codex snapshot (components/CodexMove.tsx;
// the user, 2026-11-13: a basic visual snapshot, the details behind its "?").
// Every effect kind needs a name here (the type checks it).

import type { MoveEffect, Skill } from "./creatureData";

const ABILITY: Record<MoveEffect["kind"], string> = {
  cripple: "Cripple", dash: "Haste", precise: "Precise", quick: "Strikes first",
  pounce: "Pounce", venom: "Venom", mirage: "Dodge", corpsify: "Rise again", barrage: "Hits every foe",
  seal: "No escape", meditate: "Energy", blessing: "Heal", soak: "Defence down", brace: "Block",
  empower: "Attack up", blood: "Blood pool",
  agility: "Agility up", weaken: "Attack down", smoke: "Hit and swap", lifesteal: "Life steal",
  chain: "Builds up", ward: "Status immunity", bleed: "Bleed", caltrops: "Caltrops", cleanse: "Cleanse",
  septic: "Bleed combo", execute: "Finisher", cloud: "Poison cloud", ignite: "Ignite cloud",
  ambush: "Ambush", surge: "Magic up", poison: "Poison", implode: "Self-destruct", flamebody: "Burn attackers",
  gore: "Toxic weakness", recoil: "Recoil", slap: "Wipe buffs", charge: "Wind-up",
};

// Its ability (a few kinds read differently by what they do), or none for a plain hit.
export function abilityOf(m: Skill): string | undefined {
  const fx = m.effect;
  if (!fx) return m.mult && m.mult > 1 ? "Big hit" : undefined;
  if (fx.kind === "weaken" && fx.forceSwap) return "Scare off";
  return ABILITY[fx.kind];
}
