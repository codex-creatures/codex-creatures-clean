// components/ClassBadge.tsx
// A creature's primary class (the combat triangle) as a small chip, plus a
// one-line label for a move's style and damage type.

import { CLASS_INFO, DAMAGE_TYPE_INFO, type CombatClass, type Skill } from "@/lib/creatures/creatureData";

const weakTo = (cls: CombatClass) => (Object.keys(CLASS_INFO) as CombatClass[]).find((k) => CLASS_INFO[k].beats === cls)!;

export default function ClassBadge({ cls }: { cls?: CombatClass }) {
  if (!cls) return null;
  const c = CLASS_INFO[cls];
  return (
    <span className="pixel-font" title={`${c.name} class: strong against ${CLASS_INFO[c.beats].name}, weak to ${CLASS_INFO[weakTo(cls)].name}`}
      style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color: c.color, border: `2px solid ${c.color}55` }}>
      {c.icon} {c.name}
    </span>
  );
}

// e.g. "🔮 Magic · ✨ Arcane"
export function moveKind(m: Skill): string {
  return `${CLASS_INFO[m.type].icon} ${CLASS_INFO[m.type].name} · ${DAMAGE_TYPE_INFO[m.dmgType].icon} ${DAMAGE_TYPE_INFO[m.dmgType].name}`;
}
