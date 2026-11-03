// lib/trainingPit.ts
// The Training Pit (the user, 2026-11-03), in the tavern's room. Beating the
// Hydra (the Deep Labyrinth's boss) the first time gives you its plans: like
// the bookcase's, they aren't an item, the room just offers to build it, for
// PIT_COST in materials, once.
// Leave one creature in it and it trains: TRAINING_XP_PER_HOUR in real time,
// until its XP bar is full. Then it waits for you to come and tap Level up
// (one level, and training starts again from an empty bar), so it never
// climbs more than one level while you're away. A creature in the pit is
// away training: it can't fight until you take it out, and it keeps what it's
// earned (a full bar levels it up as it leaves).
// Saved with the tavern (lib/tavern.ts: pit, training).

import { MAX_LEVEL, addXp, clampLevel, xpToNext, type Progress } from "./creatures/levels";
import { addMaterials, canAfford, countMaterial, type MaterialKey, type Materials } from "./items/materials";
import type { TavernQuest } from "./tavern";

// essence_stones is Stone; essence is the epic essence stone (lib/items/materials.ts).
export const PIT_COST: Materials = { essence_stones: 10, metal_bars: 10, planks: 5, nails: 5, essence: 3 };
export const TRAINING_XP_PER_HOUR = 100;

// You've the plans once you've beaten the Hydra (deepClears: the Deep Labyrinth's wins).
export const hasPitPlan = (deepClears: number) => deepClears > 0;
export const pitNeeds = (have: Materials) =>
  (Object.entries(PIT_COST) as [MaterialKey, number][]).map(([key, need]) => ({ key, have: countMaterial(have, key), need }));
export const canBuildPit = (t: TavernQuest, have: Materials, deepClears: number) =>
  !!t.blasted && !t.pit && hasPitPlan(deepClears) && canAfford(have, PIT_COST);
// Build it: the pit up and your materials less the cost, or null if you can't.
export function buildPit(t: TavernQuest, have: Materials, deepClears: number): { tavern: TavernQuest; materials: Materials } | null {
  if (!canBuildPit(t, have, deepClears)) return null;
  const cost = Object.fromEntries(Object.entries(PIT_COST).map(([k, n]) => [k, -n!]));
  return { tavern: { ...t, pit: true }, materials: addMaterials(have, cost) };
}

// How a creature in the pit is getting on: XP earned since it last started
// (never more than its bar has room for), the room it had, and whether the bar's full.
export function training(p: Progress, since: string, now = Date.now()): { earned: number; room: number; full: boolean } {
  const level = clampLevel(p.level);
  const room = level >= MAX_LEVEL ? 0 : Math.max(0, xpToNext(level) - Math.max(0, p.xp));
  const hours = Math.max(0, (now - Date.parse(since)) / 3_600_000);
  const earned = Math.min(room, Math.floor(hours * TRAINING_XP_PER_HOUR));
  return { earned, room, full: room > 0 && earned >= room };
}
// Its level and XP with what it's earned so far (a full bar: up a level).
export function trained(p: Progress, since: string, now = Date.now()): Progress {
  const { earned } = training(p, since, now);
  const out = addXp(p, earned);
  return { level: out.level, xp: out.xp };
}
// How long until the bar's full (hours; 0 once it is).
export function hoursToLevel(p: Progress, since: string, now = Date.now()): number {
  const { earned, room } = training(p, since, now);
  return Math.max(0, (room - earned) / TRAINING_XP_PER_HOUR);
}

// Putting a creature in (the pit's built and empty), Level up (the bar's full:
// the level's banked and training starts over) and taking it out.
export const canTrain = (t: TavernQuest) => !!t.pit && !t.training;
export const startTraining = (t: TavernQuest, id: string, now = Date.now()): TavernQuest =>
  (canTrain(t) ? { ...t, training: { id, since: new Date(now).toISOString() } } : t);
export const restartTraining = (t: TavernQuest, now = Date.now()): TavernQuest =>
  (t.training ? { ...t, training: { ...t.training, since: new Date(now).toISOString() } } : t);
export const stopTraining = (t: TavernQuest): TavernQuest => ({ ...t, training: undefined });

// Who's in the pit (to keep it out of fights).
export const trainingId = (t: TavernQuest | undefined) => (t?.pit ? t.training?.id : undefined);
