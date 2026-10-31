// lib/save.ts
// The one save: everything about a player lives under SAVE_KEY in
// localStorage. Most of it is written by useGameState (hooks/useGameState.ts);
// some parts have their own writers (the Labyrinth: lib/dungeon/run.ts) and
// are kept in their own field. Every writer reads the save, changes only its
// own part and writes it back, so they never overwrite each other.

import { ARMOR_V2, upgradeOldArmorStats } from "./items/armor";
import { TOOLS, type ToolKey } from "./items/materials";

// v3: Combat V2 (2026-10-26) started everyone again. Saves from before it
// stay in the browser under the old key (codex_creatures_save_v2), unread.
export const SAVE_KEY = "codex_creatures_save_v3";

// Fields written by something other than useGameState.
export const OWN_FIELDS = ["labyrinth", "tavern", "playTime"] as const; // (playTime: lib/playTime.ts)

export function readSave(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? upgradeOldArmor(refreshToolNames(parsed)) : {};
  } catch {
    return {};
  }
}

// Armour from before every piece rolled in full (lib/items/armor.ts), wherever
// it is in the save (the chest, a creature, the Labyrinth's bag, an enemy's
// gear): its defence goes up to the new scale so it blocks what it did. Each
// is marked, so it happens once; the save keeps it the next time it's written.
export function upgradeOldArmor<T>(save: T): T {
  const walk = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const isArmour = o.itemCategory === "armor" || (o.slot === "armor" && "drops" in o);
    if (isArmour && o.armorV !== ARMOR_V2 && o.stats && typeof o.stats === "object") {
      o.stats = upgradeOldArmorStats(o.stats as Record<string, number>);
      o.armorV = ARMOR_V2;
    }
    for (const k in o) walk(o[k]);
  };
  walk(save);
  return save;
}

// A tool keeps the name and description it had when it dropped, so a renamed
// tool (the Flare became the Torch, 2026-10-30) is brought up to date on load,
// wherever it is in the save (the chest, the Labyrinth's bag, a loot window).
export function refreshToolNames<T>(save: T): T {
  const walk = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const t = typeof o.tool === "string" && o.dropType === "item" ? TOOLS[o.tool as ToolKey] : undefined;
    if (t) { o.name = t.name; o.desc = t.desc; }
    for (const k in o) walk(o[k]);
  };
  walk(save);
  return save;
}

// Locked while a save file is being loaded (lib/saveFile.ts): the page is
// about to reload with it, and nothing still running may write the old
// game over it in the meantime.
let locked = false;
export const lockSaves = () => { locked = true; };
export const unlockSaves = () => { locked = false; }; // (a load that failed: nothing changed)
export const savesLocked = () => locked;

// Told whenever the game is saved (the save or the battle history), so cloud
// saves (components/CloudSync.tsx) know there is something new to upload.
const listeners = new Set<() => void>();
export function onSaveWritten(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function notifySaveWritten() {
  for (const fn of listeners) { try { fn(); } catch {} }
}

function write(save: Record<string, unknown>) {
  if (locked) return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    notifySaveWritten();
  } catch {}
}

// Set (or, with undefined, remove) one field of the save.
export function writeSaveField(field: string, value: unknown) {
  const save = readSave();
  if (value === undefined) delete save[field];
  else save[field] = value;
  write(save);
}

// Write the main game state, keeping the fields other writers own.
export function writeMainSave(state: object) {
  const prev = readSave();
  const kept = Object.fromEntries(OWN_FIELDS.filter((f) => f in prev).map((f) => [f, prev[f]]));
  write({ ...state, ...kept });
}
