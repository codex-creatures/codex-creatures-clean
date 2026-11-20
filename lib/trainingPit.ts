// lib/trainingPit.ts
// The pit in the tavern's room (the user, 2026-11-03), where a creature
// trains while you're away. Two levels:
// - the Sparring Pit, a patch of sand and a dummy: yours as soon as the
//   rubble's blown open, training at SPARRING_XP_PER_HOUR;
// - the Training Pit, built over it (a stone rim and spears) from the Hydra
//   quest's plans for PIT_COST in materials, once: TRAINING_XP_PER_HOUR.
// The Hydra quest goes up on the quest board once you've beaten the Cyclops:
// beat the Hydra (the Deep Labyrinth's boss), then claim the plans there.
// Like the bookcase's, the plans aren't an item: the pit just offers to build.
// Leave one creature in the pit and it trains in real time until its XP bar
// is full. Then it waits for you to come and tap Level up (one level, and
// training starts again from an empty bar), so it never climbs more than one
// level while you're away. A creature in the pit is away training: it can't
// fight until you take it out, and it keeps what it's earned (a full bar
// levels it up as it leaves).
// The Training Pit grows to PIT_SLOTS creatures at once (the user, 2026-11-20), a schematic a slot
// (lib/items/plans.ts: pit_slot_2, pit_slot_3), each training on its own clock.
// Saved with the tavern (lib/tavern.ts: pit, plans, training, more, slots, trainedXp).

import { MAX_LEVEL, addXp, clampLevel, xpToNext, type Progress } from "./creatures/levels";
import { addMaterials, canAfford, countMaterial, type MaterialKey, type Materials } from "./items/materials";
import type { TavernQuest } from "./tavern";

// essence_stones is Stone; essence is the epic essence stone (lib/items/materials.ts).
export const PIT_COST: Materials = { essence_stones: 10, metal_bars: 10, planks: 5, nails: 5, essence: 3 };
export const SPARRING_XP_PER_HOUR = 50;
export const TRAINING_XP_PER_HOUR = 100;

// The Sparring Pit's there once the tavern's room is open; built up, it's the Training Pit.
export const hasPit = (t: TavernQuest) => !!t.blasted || !!t.pit;
export const pitRate = (t: TavernQuest) => (t.pit ? TRAINING_XP_PER_HOUR : SPARRING_XP_PER_HOUR);

// The Hydra quest: not up yet (the Cyclops still stands), beat the Hydra, claim the plans, or claimed.
// clears: the Cyclops beaten; deepClears: the Hydra beaten (lib/dungeon/run.ts meta).
export type HydraStep = "closed" | "hunt" | "claim" | "paid";
export function hydraStep(t: TavernQuest, clears: number, deepClears: number): HydraStep {
  return t.plans ? "paid" : clears <= 0 ? "closed" : deepClears <= 0 ? "hunt" : "claim";
}
export const claimPlans = (t: TavernQuest, clears: number, deepClears: number): TavernQuest =>
  (hydraStep(t, clears, deepClears) === "claim" ? { ...t, plans: true } : t);

export const pitNeeds = (have: Materials) =>
  (Object.entries(PIT_COST) as [MaterialKey, number][]).map(([key, need]) => ({ key, have: countMaterial(have, key), need }));
export const canBuildPit = (t: TavernQuest, have: Materials) => !!t.blasted && !t.pit && !!t.plans && canAfford(have, PIT_COST);
// Build it: the Training Pit up and your materials less the cost, or null if you can't.
export function buildPit(t: TavernQuest, have: Materials): { tavern: TavernQuest; materials: Materials } | null {
  if (!canBuildPit(t, have)) return null;
  const cost = Object.fromEntries(Object.entries(PIT_COST).map(([k, n]) => [k, -n!]));
  return { tavern: { ...t, pit: true }, materials: addMaterials(have, cost) };
}

// How a creature in the pit is getting on, at rate XP an hour: XP earned since
// it last started (never more than its bar has room for), the room it had,
// and whether the bar's full.
export function training(p: Progress, since: string, now = Date.now(), rate = TRAINING_XP_PER_HOUR): { earned: number; room: number; full: boolean } {
  const level = clampLevel(p.level);
  const room = level >= MAX_LEVEL ? 0 : Math.max(0, xpToNext(level) - Math.max(0, p.xp));
  const hours = Math.max(0, (now - Date.parse(since)) / 3_600_000);
  const earned = Math.min(room, Math.floor(hours * rate));
  return { earned, room, full: room > 0 && earned >= room };
}
// Its level and XP with what it's earned so far (a full bar: up a level).
export function trained(p: Progress, since: string, now = Date.now(), rate = TRAINING_XP_PER_HOUR): Progress {
  const { earned } = training(p, since, now, rate);
  const out = addXp(p, earned);
  return { level: out.level, xp: out.xp };
}
// How long until the bar's full (hours; 0 once it is).
export function hoursToLevel(p: Progress, since: string, now = Date.now(), rate = TRAINING_XP_PER_HOUR): number {
  const { earned, room } = training(p, since, now, rate);
  return Math.max(0, (room - earned) / rate);
}

// Who's in it: the first in `training` (as saves always had it), the others in `more`.
export type Trainee = { id: string; since: string };
export const PIT_SLOTS = 3;
export const pitSlots = (t: TavernQuest) => (t.pit ? Math.min(PIT_SLOTS, Math.max(1, t.slots ?? 1)) : 1);
export const trainees = (t: TavernQuest): Trainee[] => [...(t.training ? [t.training] : []), ...(t.more ?? [])];
const withTrainees = (t: TavernQuest, list: Trainee[]): TavernQuest => {
  const out: TavernQuest = { ...t, training: list[0], more: list.length > 1 ? list.slice(1) : undefined };
  if (!out.training) delete out.training;
  if (!out.more) delete out.more;
  return out;
};
export const traineeOf = (t: TavernQuest, id: string) => trainees(t).find((x) => x.id === id);
// A schematic's slots built (none past PIT_SLOTS, and only on the Training Pit).
export const buildSlots = (t: TavernQuest, slots: number): TavernQuest => (t.pit ? { ...t, slots: Math.min(PIT_SLOTS, Math.max(pitSlots(t), slots)) } : t);

// Putting a creature in (a slot's free), Level up (its bar's full: the
// level's banked and training starts over) and taking it out.
export const canTrain = (t: TavernQuest) => hasPit(t) && trainees(t).length < pitSlots(t);
export const startTraining = (t: TavernQuest, id: string, now = Date.now()): TavernQuest =>
  (canTrain(t) && !traineeOf(t, id) ? withTrainees(t, [...trainees(t), { id, since: new Date(now).toISOString() }]) : t);
// Started again from now: the one named, or (no id) everyone in it.
export const restartTraining = (t: TavernQuest, now = Date.now(), id?: string): TavernQuest =>
  withTrainees(t, trainees(t).map((x) => (id === undefined || x.id === id ? { ...x, since: new Date(now).toISOString() } : x)));
// Out: the one named (no id: the first, as when the pit held one).
export const stopTraining = (t: TavernQuest, id?: string): TavernQuest => {
  const out = id ?? trainees(t)[0]?.id;
  return withTrainees(t, trainees(t).filter((x) => x.id !== out));
};
// The pit's lifetime tally: XP banked out of it (levelled up, taken out, or before a scroll).
export const logTrained = (t: TavernQuest, xp: number): TavernQuest => (xp > 0 ? { ...t, trainedXp: (t.trainedXp ?? 0) + xp } : t);
export const lifetimeXp = (t: TavernQuest) => t.trainedXp ?? 0;

// Who's in the pit (to keep them out of fights).
export const trainingIds = (t: TavernQuest | undefined): string[] => (t && hasPit(t) ? trainees(t).map((x) => x.id) : []);
