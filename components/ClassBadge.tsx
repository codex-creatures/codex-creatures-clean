// components/ClassBadge.tsx
// A creature's primary class (its main fighting style) as a small chip, plus
// a one-line label for a move's style and race (Combat V2; under the old
// rules, its damage type).

import { BALANCED_INFO, CLASS_INFO, DAMAGE_TYPE_INFO, RACE_INFO, type CombatClass, type Skill } from "@/lib/creatures/creatureData";
import { damageTypesOn } from "@/lib/combat/engine";
import { raceOfMove } from "@/lib/combat/raceChart";
import Glyph from "./Glyph";

const NEUTRAL_GREY = "#a9a9b8";

// neutral: Klutz, who can learn moves of any style, shown as a grey "Neutral".
export default function ClassBadge({ cls, neutral }: { cls?: CombatClass; neutral?: boolean }) {
  if (neutral) {
    return (
      <span className="pixel-font" title="Neutral: he can learn moves of any style."
        style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color: NEUTRAL_GREY, border: `2px solid ${NEUTRAL_GREY}55` }}>
        <Glyph icon={BALANCED_INFO.icon} art={BALANCED_INFO.art} /> Neutral
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
export function moveTag(m: Skill): { icon: string; name: string; color: string; art?: string } {
  if (damageTypesOn()) return DAMAGE_TYPE_INFO[m.dmgType];
  const r = raceOfMove(m);
  return r ? RACE_INFO[r] : BALANCED_INFO;
}

// e.g. "🔮 Magic · 💀 Undead" (plain text, for tooltips; MoveKind draws the race icon).
export function moveKind(m: Skill): string {
  const tag = moveTag(m);
  return `${CLASS_INFO[m.type].icon} ${CLASS_INFO[m.type].name} · ${tag.icon} ${tag.name}`;
}
export function MoveKind({ m }: { m: Skill }) {
  const tag = moveTag(m);
  return <>{CLASS_INFO[m.type].icon} {CLASS_INFO[m.type].name} · <Glyph icon={tag.icon} art={tag.art} /> {tag.name}</>;
}
