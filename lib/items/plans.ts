// lib/items/plans.ts
// The Den's upgrades as ladders of schematics (the user, 2026-11-20: Den progression, roadmap.md): each ladder is
// one thing's stages in order, a schematic for each. Only the next one you need turns up: in a chest in the
// Labyrinth (PLAN_FINDS, from the dungeon named on), or on a wandering merchant's cart (PLAN_PRICES; none for a
// plan not sold). A plan you're holding (at home or in your bag) doesn't turn up again till it's built.
// What the plans build is in lib/items/materials.ts (SCHEMATICS) and lib/items/storage.ts.

import { schematicDrop, type SchematicKey } from "./materials";
import type { DungeonId, SackItem } from "../dungeon/run";

export type Ladder = "weapon" | "armor" | "cage" | "bookcase" | "pit";
export const LADDERS: Record<Ladder, SchematicKey[]> = {
  weapon: ["weapon_storage_1", "weapon_storage", "weapon_storage_3", "weapon_storage_2"],
  armor: ["armor_storage_1", "armor_storage", "armor_storage_3", "armor_storage_2"],
  cage: ["iron_cage", "reinforced_cage"],
  bookcase: ["crooked_bookcase", "carved_bookcase"], // (the sturdy bookcase's plan, then the carved one's)
  pit: ["pit_slot_2", "pit_slot_3"],
};
export const ladderOf = (k: SchematicKey): Ladder => (Object.keys(LADDERS) as Ladder[]).find((l) => LADDERS[l].includes(k))!;

// A merchant's price (🧪 Claude's, 2026-11-20, but the cage's: the user's 3,000). The iron cage's isn't sold.
export const PLAN_PRICES: Partial<Record<SchematicKey, number>> = {
  weapon_storage_1: 1000, weapon_storage: 2000, weapon_storage_3: 3000, weapon_storage_2: 4000,
  armor_storage_1: 1000, armor_storage: 2000, armor_storage_3: 3000, armor_storage_2: 4000,
  reinforced_cage: 3000, crooked_bookcase: 2000, carved_bookcase: 5000, pit_slot_2: 4000, pit_slot_3: 8000,
};
// Where one's found: from which dungeon on (0 the Encampment, 1 the Cyclops, 2 the Hydra, 3 the Abyss), and how
// often in a chest room's chest, a mini boss's chest, or a boss's. (The Encampment holds none: its chief never
// carried the cage's plan either.) 🧪 Claude's, 2026-11-20; the reinforced cage's Hydra+ is the user's.
export type PlanSource = "chest" | "miniboss" | "boss";
export const PLAN_FINDS: Record<SchematicKey, { from: DungeonId } & Partial<Record<PlanSource, number>>> = {
  iron_cage:        { from: 1, miniboss: 0.2 },
  reinforced_cage:  { from: 2, miniboss: 0.2, boss: 0.2 },
  weapon_storage_1: { from: 1, chest: 0.05, miniboss: 0.1 },
  armor_storage_1:  { from: 1, chest: 0.05, miniboss: 0.1 },
  weapon_storage:   { from: 1, chest: 0.03, miniboss: 0.1 },
  armor_storage:    { from: 1, chest: 0.03, miniboss: 0.1 },
  weapon_storage_3: { from: 1, miniboss: 0.1, boss: 0.1 },
  armor_storage_3:  { from: 1, miniboss: 0.1, boss: 0.1 },
  weapon_storage_2: { from: 2, miniboss: 0.1, boss: 0.15 },
  armor_storage_2:  { from: 2, miniboss: 0.1, boss: 0.15 },
  crooked_bookcase: { from: 1, chest: 0.05, miniboss: 0.1 },
  carved_bookcase:  { from: 1, miniboss: 0.1, boss: 0.15 },
  pit_slot_2:       { from: 2, miniboss: 0.1, boss: 0.2 },
  pit_slot_3:       { from: 3, miniboss: 0.1, boss: 0.2 },
};

// Where you are on each ladder: how many of its plans are built (the weapon and armour boxes' tiers, the cage's
// level less 1, the bookcase's stage less 2 (the crooked one takes no plan), the pit's slots less 1), and which
// ladders can't take a plan yet (the bookcase before the crooked one's built, the pit before the Training Pit).
export type Built = Record<Ladder, number> & { open: Record<Ladder, boolean> };
export function builtFrom(s: { boxes: Record<"weapon" | "armor", number>; cage: number; shelf: number; pit: boolean; pitSlots: number }): Built {
  return {
    weapon: s.boxes.weapon, armor: s.boxes.armor, cage: Math.max(0, s.cage - 1), bookcase: Math.max(0, s.shelf - 2), pit: Math.max(0, s.pitSlots - 1),
    open: { weapon: true, armor: true, cage: true, bookcase: s.shelf >= 2, pit: s.pit },
  };
}
// The plans you'd want next: one a ladder, unless it's done, not open yet, or you're holding its next plan.
export function wantedPlans(built: Built, held: readonly SchematicKey[]): SchematicKey[] {
  return (Object.keys(LADDERS) as Ladder[]).flatMap((l) => {
    const next = LADDERS[l][built[l]];
    return next && built.open[l] && !held.some((h) => ladderOf(h) === l) ? [next] : [];
  });
}

// The plans in a chest: each one wanted and found there rolls on its own (no roll at all for the rest, so a
// chest with nothing wanted rolls as it did).
export function planFinds(source: PlanSource, dungeon: DungeonId, wanted: readonly SchematicKey[], rng: () => number = Math.random): SackItem[] {
  return wanted.flatMap((k) => {
    const f = PLAN_FINDS[k], odds = f[source];
    return odds && dungeon >= f.from && rng() < odds ? [{ gear: schematicDrop(k) }] : [];
  });
}
