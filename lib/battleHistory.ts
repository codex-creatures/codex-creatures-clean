// lib/battleHistory.ts
// Your most recent battles, kept so they can be reviewed afterwards
// (in the Fight Pit, or by Claude when reviewing balance).
// Stored separately from the main save so it never affects progress.

import type { BattleEvent, SideKey } from "./combat/battle";
import type { Rarity } from "./items/budgets";
import { savesLocked } from "./save";

export const STORAGE_KEY = "codex_creatures_battles_v1";
export const MAX_SAVED_BATTLES = 10;

export type BattleMember = {
  name: string;
  rarity: Rarity;
  label: string;        // creature type label
  weapon?: string;
  armor?: string;
  moves: string[];
  stats: { hp: number; atk: number; rng: number; mag?: number; agil: number; mdef: number; rdef: number; magdef?: number };
};

export type BattleRecord = {
  id: string;
  date: string;          // ISO
  winner: SideKey | "draw";
  rounds: number;
  title?: string;        // where it was fought, e.g. "Dungeon · room 3"
  teams: Record<SideKey, BattleMember[]>; // A = you, B = the AI
  log: BattleEvent[];
};

// Forget every saved battle (a brand-new game).
export function clearBattles() {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function loadBattles(): BattleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBattle(record: BattleRecord) {
  if (savesLocked()) return;
  try {
    const all = [record, ...loadBattles()].slice(0, MAX_SAVED_BATTLES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}
