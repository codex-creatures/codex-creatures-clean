// components/ClassBadge.tsx
// A creature's primary class (its main fighting style) as a small chip, plus
// a one-line label for a move's style and race (Combat V2; under the old
// rules, its damage type).

import { BALANCED_INFO, CLASS_INFO, DAMAGE_TYPE_INFO, RACE_INFO, type CombatClass, type Skill } from "@/lib/creatures/creatureData";
import { damageTypesOn } from "@/lib/combat/engine";
import { raceOfMove } from "@/lib/combat/raceChart";

const NEUTRAL_GREY = "#a9a9b8";

// neutral: Klutz, who can learn moves of any style, shown as a grey "Balanced".
export default function ClassBadge({ cls, neutral }: { cls?: CombatClass; neutral?: boolean }) {
  if (neutral) {
    return (
      <span className="pixel-font" title="Balanced: he can learn moves of any style."
        style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color: NEUTRAL_GREY, border: `2px solid ${NEUTRAL_GREY}55` }}>
        ⚖️ Balanced
      </span>
    );
  }
  if (!cls) return null;
  const c = CLASS_INFO[cls];
  return (
    <span className="pixel-font" title={`${c.name}: its main fighting style`}
      style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color: c.color, border: `2px solid ${c.color}55` }}>
      {c.icon} {c.name}
    </span>
  );
}

// A move's second tag: its race (Combat V2; none: Balanced), or its damage
// type under the old rules.
export function moveTag(m: Skill): { icon: string; name: string; color: string } {
  if (damageTypesOn()) return DAMAGE_TYPE_INFO[m.dmgType];
  const r = raceOfMove(m);
  return r ? RACE_INFO[r] : BALANCED_INFO;
}

// e.g. "🔮 Magic · 💀 Undead"
export function moveKind(m: Skill): string {
  const tag = moveTag(m);
  return `${CLASS_INFO[m.type].icon} ${CLASS_INFO[m.type].name} · ${tag.icon} ${tag.name}`;
}
