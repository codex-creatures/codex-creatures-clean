"use client";
// components/CreatureMarks.tsx
// A creature's race and class as two small symbols (for tiles and cards),
// and the filter bar for creature lists: by race, by class, and how to group.

import { useState, type ReactNode } from "react";
import { RaceIcon } from "./Glyph";
import { CLASS_INFO, COMBAT_CLASSES, RACES, RACE_INFO, type CombatClass, type Race } from "@/lib/creatures/creatureData";

// races: both of a two-race creature (otherwise race).
export function CreatureMarks({ race, races, cls, size = 13 }: { race?: Race; races?: Race[]; cls?: CombatClass; size?: number }) {
  const chip = (icon: ReactNode, color: string, title: string) => (
    <span title={title} style={{
      width: size + 7, height: size + 7, display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size, lineHeight: 1, background: "rgba(10,10,14,0.85)", border: `2px solid ${color}`,
    }}>{icon}</span>
  );
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {(races?.length ? races : race ? [race] : []).map((r) => <span key={r} style={{ display: "inline-flex" }}>{chip(<RaceIcon r={r} size="1.15em" />, RACE_INFO[r].color, `Race: ${RACE_INFO[r].name}`)}</span>)}
      {cls && chip(CLASS_INFO[cls].icon, CLASS_INFO[cls].color, `Class: ${CLASS_INFO[cls].name}`)}
    </span>
  );
}

export type GroupBy = "rarity" | "class" | "race";
export type CreatureFilter = { race: Race | "all"; cls: CombatClass | "all"; groupBy: GroupBy };
export const NO_FILTER: CreatureFilter = { race: "all", cls: "all", groupBy: "rarity" };

// race: a creature's races (either one matches), or just one.
const hasRace = (race: Race | Race[] | undefined, r: Race) => (Array.isArray(race) ? race.includes(r) : race === r);

export function matchesFilter(f: CreatureFilter, race?: Race | Race[], cls?: CombatClass): boolean {
  return (f.race === "all" || hasRace(race, f.race)) && (f.cls === "all" || cls === f.cls);
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
            <RaceIcon r={r} /> {RACE_INFO[r].name}{raceCount ? ` (${raceCount(r)})` : ""}
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

// ── The inventory toolbar ─────────────────────────────────────────
// One tidy row: search, a Filter button (race and class, as icon toggles
// that only show when you open it) and a sort. Active filters show as small
// chips you can tap off.
export type SortBy = "rarity" | "class" | "race" | "name" | "newest";
export type InventoryFilter = { race: Race | "all"; cls: CombatClass | "all"; sort: SortBy; query: string };
export const NO_INV_FILTER: InventoryFilter = { race: "all", cls: "all", sort: "rarity", query: "" };

const RARITY_RANK: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
const CLASS_RANK: Record<CombatClass, number> = { melee: 0, ranged: 1, magic: 2 };

// Does a creature pass the filter? (name: what the search matches)
export function passes(f: InventoryFilter, name: string, race?: Race | Race[], cls?: CombatClass): boolean {
  return (f.race === "all" || hasRace(race, f.race)) && (f.cls === "all" || cls === f.cls)
    && (!f.query.trim() || name.toLowerCase().includes(f.query.trim().toLowerCase()));
}

// Sort creatures. info(x) gives what's needed to sort one.
export function sortCreatures<T>(list: T[], sort: SortBy, info: (x: T) => { name: string; rarity: string; race?: Race; cls?: CombatClass; createdAt?: string }): T[] {
  const byRarity = (a: T, b: T) => (RARITY_RANK[info(a).rarity] ?? 9) - (RARITY_RANK[info(b).rarity] ?? 9) || info(a).name.localeCompare(info(b).name);
  return [...list].sort((a, b) => {
    const A = info(a), B = info(b);
    switch (sort) {
      case "name":   return A.name.localeCompare(B.name);
      case "newest": return (B.createdAt ?? "").localeCompare(A.createdAt ?? "");
      case "class":  return (CLASS_RANK[A.cls ?? "melee"] - CLASS_RANK[B.cls ?? "melee"]) || byRarity(a, b);
      case "race":   return (RACES.indexOf(A.race ?? "beast") - RACES.indexOf(B.race ?? "beast")) || byRarity(a, b);
      default:       return byRarity(a, b);
    }
  });
}

export function CreatureToolbar({ value, onChange, shown, total, noun = "creatures" }: {
  value: InventoryFilter; onChange: (f: InventoryFilter) => void; shown: number; total: number; noun?: string;
}) {
  const [open, setOpen] = useState(false);
  const set = (p: Partial<InventoryFilter>) => onChange({ ...value, ...p });
  const active = (value.race !== "all" ? 1 : 0) + (value.cls !== "all" ? 1 : 0);
  const iconBtn = (on: boolean, color: string): React.CSSProperties => ({
    width: 44, height: 44, fontSize: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    background: on ? "rgba(245,197,66,0.16)" : "#14151c", border: `2px solid ${on ? color : "#2a2d38"}`, borderRadius: 8,
  });
  const removable = (label: ReactNode, color: string, clear: () => void) => (
    <button onClick={clear} className="chip" style={{ color, padding: "4px 10px", minHeight: 0 }} title="Remove filter">{label} ✕</button>
  );
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <input value={value.query} onChange={(e) => set({ query: e.target.value })} placeholder={`Search ${noun}…`}
          className="pixel-input" style={{ flex: 1, minWidth: 0, margin: 0 }} />
        <button onClick={() => setOpen((o) => !o)} className="chip" data-active={open || active > 0} style={{ whiteSpace: "nowrap" }}>
          ⚙ Filter{active > 0 ? ` · ${active}` : ""}
        </button>
        <select value={value.sort} onChange={(e) => set({ sort: e.target.value as SortBy })} aria-label="Sort"
          style={{ background: "#14151c", color: "white", border: "2px solid #2a2d38", borderRadius: 8, padding: "0 8px", fontSize: 13 }}>
          <option value="rarity">Rarity</option>
          <option value="class">Class</option>
          <option value="race">Race</option>
          <option value="name">Name</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {open && (
        <div style={{ marginTop: 8, padding: 10, background: "#101117", border: "2px solid #2a2d38", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", width: 40 }}>Race</span>
            {RACES.map((r) => (
              <button key={r} title={RACE_INFO[r].name} aria-label={RACE_INFO[r].name} aria-pressed={value.race === r}
                onClick={() => set({ race: value.race === r ? "all" : r })} style={iconBtn(value.race === r, RACE_INFO[r].color)}>
                <RaceIcon r={r} />
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", width: 40 }}>Class</span>
            {COMBAT_CLASSES.map((c) => (
              <button key={c} title={CLASS_INFO[c].name} aria-label={CLASS_INFO[c].name} aria-pressed={value.cls === c}
                onClick={() => set({ cls: value.cls === c ? "all" : c })} style={iconBtn(value.cls === c, CLASS_INFO[c].color)}>
                {CLASS_INFO[c].icon}
              </button>
            ))}
            {active > 0 && <button className="chip" style={{ marginLeft: "auto" }} onClick={() => set({ race: "all", cls: "all" })}>Clear</button>}
          </div>
        </div>
      )}

      {(active > 0 || value.query.trim()) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          {value.race !== "all" && removable(<><RaceIcon r={value.race} /> {RACE_INFO[value.race].name}</>, RACE_INFO[value.race].color, () => set({ race: "all" }))}
          {value.cls !== "all" && removable(`${CLASS_INFO[value.cls].icon} ${CLASS_INFO[value.cls].name}`, CLASS_INFO[value.cls].color, () => set({ cls: "all" }))}
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{shown} of {total}</span>
        </div>
      )}
    </div>
  );
}
