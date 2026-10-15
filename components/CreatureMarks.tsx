"use client";
// components/CreatureMarks.tsx
// A creature's race and class as two small symbols (for tiles and cards),
// and the filter bar for creature lists: by race, by class, and how to group.

import { CLASS_INFO, COMBAT_CLASSES, RACES, RACE_INFO, type CombatClass, type Race } from "@/lib/creatures/creatureData";

export function CreatureMarks({ race, cls, size = 13 }: { race?: Race; cls?: CombatClass; size?: number }) {
  const chip = (icon: string, color: string, title: string) => (
    <span title={title} style={{
      width: size + 7, height: size + 7, display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size, lineHeight: 1, background: "rgba(10,10,14,0.85)", border: `2px solid ${color}`,
    }}>{icon}</span>
  );
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {race && chip(RACE_INFO[race].icon, RACE_INFO[race].color, `Race: ${RACE_INFO[race].name}`)}
      {cls && chip(CLASS_INFO[cls].icon, CLASS_INFO[cls].color, `Class: ${CLASS_INFO[cls].name}`)}
    </span>
  );
}

export type GroupBy = "rarity" | "class" | "race";
export type CreatureFilter = { race: Race | "all"; cls: CombatClass | "all"; groupBy: GroupBy };
export const NO_FILTER: CreatureFilter = { race: "all", cls: "all", groupBy: "rarity" };

export function matchesFilter(f: CreatureFilter, race?: Race, cls?: CombatClass): boolean {
  return (f.race === "all" || race === f.race) && (f.cls === "all" || cls === f.cls);
}

// counts: how many creatures each option would show (before the other filter).
export function CreatureFilterBar({ value, onChange, raceCount, classCount, showGroup = true }: {
  value: CreatureFilter; onChange: (f: CreatureFilter) => void;
  raceCount?: (r: Race) => number; classCount?: (c: CombatClass) => number; showGroup?: boolean;
}) {
  const set = (p: Partial<CreatureFilter>) => onChange({ ...value, ...p });
  const row = { display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" };
  const label = { fontSize: 11, color: "rgba(255,255,255,0.45)", minWidth: 44 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
      <div style={row}>
        <span style={label}>Race</span>
        <button className="chip" data-active={value.race === "all"} onClick={() => set({ race: "all" })}>All</button>
        {RACES.map((r) => (
          <button key={r} className="chip" data-active={value.race === r} onClick={() => set({ race: value.race === r ? "all" : r })}
            title={RACE_INFO[r].name} style={{ color: RACE_INFO[r].color }}>
            {RACE_INFO[r].icon} {RACE_INFO[r].name}{raceCount ? ` (${raceCount(r)})` : ""}
          </button>
        ))}
      </div>
      <div style={row}>
        <span style={label}>Class</span>
        <button className="chip" data-active={value.cls === "all"} onClick={() => set({ cls: "all" })}>All</button>
        {COMBAT_CLASSES.map((c) => (
          <button key={c} className="chip" data-active={value.cls === c} onClick={() => set({ cls: value.cls === c ? "all" : c })}
            style={{ color: CLASS_INFO[c].color }}>
            {CLASS_INFO[c].icon} {CLASS_INFO[c].name}{classCount ? ` (${classCount(c)})` : ""}
          </button>
        ))}
      </div>
      {showGroup && (
        <div style={row}>
          <span style={label}>Group</span>
          {(["rarity", "class", "race"] as GroupBy[]).map((g) => (
            <button key={g} className="chip" data-active={value.groupBy === g} onClick={() => set({ groupBy: g })}>
              By {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
