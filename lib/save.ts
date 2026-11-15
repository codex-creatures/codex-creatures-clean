// lib/save.ts
// The one save: everything about a player lives under SAVE_KEY in
// localStorage. Most of it is written by useGameState (hooks/useGameState.ts);
// some parts have their own writers (the Labyrinth: lib/dungeon/run.ts) and
// are kept in their own field. Every writer reads the save, changes only its
// own part and writes it back, so they never overwrite each other.

import { ARMOR_V2, upgradeOldArmorStats } from "./items/armor";
import { TOOLS, type ToolKey } from "./items/materials";
import { CHEST_ENCHANT, canEnchant, enchanted } from "./items/enchantments";
import { seeded } from "./creatures/soulStones";
import type { Drop, ItemCategory, Rarity } from "./types";

type Gear = { itemCategory?: ItemCategory; rarity?: Rarity };

// v3: Combat V2 (2026-10-26) started everyone again. Saves from before it
// stay in the browser under the old key (codex_creatures_save_v2), unread.
export const SAVE_KEY = "codex_creatures_save_v3";

// Fields written by something other than useGameState.
export const OWN_FIELDS = ["labyrinth", "tavern", "playTime", "tour", "daily", "campaign"] as const; // (playTime: lib/playTime.ts; tour: lib/tour.ts; daily: lib/daily.ts; campaign: lib/campaign.ts)

export function readSave(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? upgradeOldArmor(refreshToolNames(dropOldGoldKeys(enchantOldGear(parsed)))) : {};
  } catch {
    return {};
  }
}

// Gear from before enchantments (the user, 2026-11-16): every Rare or better
// weapon and armour piece a player already had gets one roll, at a chest's odds
// (CHEST_ENCHANT), wherever it is in the save. Only gear made before
// ENCHANT_ROLL_BEFORE: what's found since (from foes, merchants, Klutz…) is left
// as it came. The roll is seeded by the item's id, so it comes out the same on
// every load until the save is next written with it.
export const ENCHANT_ROLL_BEFORE = "2026-11-15T18:45:00Z";
export function enchantOldGear<T>(save: T): T {
  const walk = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (o.dropType === "item" && o.enchant === undefined && typeof o.id === "string" && canEnchant(o as Gear)
      && !(typeof o.createdAt === "string" && o.createdAt >= ENCHANT_ROLL_BEFORE)) {
      const k = (enchanted(o as unknown as Drop, CHEST_ENCHANT, seeded(`enchant:${o.id}`)) as { enchant?: string }).enchant;
      if (k) o.enchant = k;
    }
    for (const k in o) walk(o[k]);
  };
  walk(save);
  return save;
}

// The Gold Key became Legendary (the user, 2026-11-16), and every key found
// before then was taken back. A key that isn't Legendary is one of those: it's
// removed wherever it is in the save (the Inventory, the chest, the Labyrinth's
// bag and loot, a room's chest or sack), with any bag slot that held it. Keys
// found since are Legendary, so this leaves them be.
const isOldGoldKey = (v: unknown): v is { id?: string } =>
  !!v && typeof v === "object" && (v as Record<string, unknown>).tool === "gold_key" && (v as Record<string, unknown>).rarity !== "legendary";
export function dropOldGoldKeys<T>(save: T): T {
  const gone = new Set<string>();
  // (A key on its own, or in a wrapper: a chest's { gear }, a run's { drop }.)
  const inner = (v: unknown) => (isOldGoldKey(v) ? v : v && typeof v === "object" ? [(v as Record<string, unknown>).gear, (v as Record<string, unknown>).drop].find(isOldGoldKey) : undefined);
  const strip = (v: unknown) => {
    if (Array.isArray(v)) {
      for (let i = v.length - 1; i >= 0; i--) {
        const key = inner(v[i]);
        if (!key) continue;
        if (key.id) gone.add(key.id);
        v.splice(i, 1);
      }
      v.forEach(strip);
      return;
    }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    for (const k in o) {
      if (isOldGoldKey(o[k])) { const id = (o[k] as { id?: string }).id; if (id) gone.add(id); delete o[k]; }
      else strip(o[k]);
    }
  };
  strip(save);
  if (!gone.size) return save;
  // Bag slots and the like that pointed at a key (e.g. "loot:<id>").
  const unlink = (v: unknown) => {
    if (Array.isArray(v)) {
      for (let i = v.length - 1; i >= 0; i--) if (typeof v[i] === "string" && gone.has(String(v[i]).replace(/^(loot|gear):/, ""))) v.splice(i, 1);
      v.forEach(unlink);
      return;
    }
    if (v && typeof v === "object") for (const k in v as Record<string, unknown>) unlink((v as Record<string, unknown>)[k]);
  };
  unlink(save);
  return save;
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
