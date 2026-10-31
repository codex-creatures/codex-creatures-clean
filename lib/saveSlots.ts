// lib/saveSlots.ts
// Save slots: more than one game in the same browser (two people sharing a
// phone, or a test game next to your real one). The title screen
// (app/start/page.tsx) picks one: Continue, New Game, or Load a save file.
//
// The game itself only ever sees one save: the slot you're playing lives in
// the usual keys (SAVE_PARTS in lib/saveFile.ts), so nothing else needs to
// know slots exist. Every other slot is parked under its own key as a save
// file (slotKey). Switching parks the game you're in and unparks the other.
//
// A browser from before slots has its game turned into the first slot
// ("Save 1") the first time this runs; nothing in it changes.
//
// Like importSave, a switch is careful: everything is turned into text
// before anything is written, and if writing fails part-way it's all put
// back as it was.

import { exportSave, checkSaveFile, SAVE_PARTS, type KeyValueStore, type SaveFile, type SavePart } from "./saveFile";

// v2: Combat V2 started everyone again; the old slots (codex_creatures_slots_v1,
// codex_creatures_slot_<id>) stay in the browser, unread.
export const SLOTS_KEY = "codex_creatures_slots_v2";
// sessionStorage, for this visit only: a save has been picked on the title
// screen, so the Den doesn't send you back to it.
export const STARTED_KEY = "codex_creatures_started";

// Opening the game on any page (a phone's home-screen icon can keep the page
// it was added from) goes to the title screen first, once per visit. Except
// the title screen itself, the privacy page it links to, and the dev tools.
const NO_TITLE = ["/start", "/privacy", "/lab", "/simulator"];
export function needsTitle(path: string, started: boolean): boolean {
  return !started && !NO_TITLE.some((p) => path === p || path.startsWith(p + "/"));
}
export const MAX_SLOTS = 4; // (each is a whole save; browsers allow ~5 MB in all)
export const MAX_NAME = 16;

export type Slot = { id: string; name: string; createdAt: string; lastPlayed: string };
export type SlotList = { active: string | null; slots: Slot[] };
export type SlotResult = { ok: true; list: SlotList } | { ok: false; error: string };

// Where a parked slot's game is kept.
export const slotKey = (id: string) => `codex_creatures_slot2_${id}`;

const PARTS = Object.keys(SAVE_PARTS) as SavePart[];
const hasGame = (store: KeyValueStore) => PARTS.some((p) => store.getItem(SAVE_PARTS[p]) !== null);

export function cleanName(name: string, fallback: string): string {
  const n = name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
  return n || fallback;
}

// The first free "Save N".
function defaultName(list: SlotList): string {
  for (let n = 1; ; n++) if (!list.slots.some((s) => s.name === `Save ${n}`)) return `Save ${n}`;
}

function newId(list: SlotList): string {
  for (let n = 1; ; n++) if (!list.slots.some((s) => s.id === String(n))) return String(n);
}

// The slots, as saved. A browser from before slots with a game in it gets
// that game as "Save 1" (written, so it stays that way). Never throws.
export function readSlots(store: KeyValueStore, now = new Date()): SlotList {
  try {
    const raw = store.getItem(SLOTS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as SlotList;
      if (parsed && Array.isArray(parsed.slots)) return { active: parsed.active ?? null, slots: parsed.slots };
    }
  } catch {}
  if (!hasGame(store)) return { active: null, slots: [] };
  const t = now.toISOString();
  const list: SlotList = { active: "1", slots: [{ id: "1", name: "Save 1", createdAt: t, lastPlayed: t }] };
  try { store.setItem(SLOTS_KEY, JSON.stringify(list)); } catch {}
  return list;
}

// A parked slot's game (null: nothing in it yet, or it can't be read).
export function readParked(store: KeyValueStore, id: string): SaveFile | null {
  try {
    const raw = store.getItem(slotKey(id));
    if (raw === null) return null;
    const check = checkSaveFile(raw);
    return check.ok ? check.file : null;
  } catch {
    return null;
  }
}

// Any slot's game: the one you're in is read from the game itself.
export function slotGame(store: KeyValueStore, list: SlotList, id: string): SaveFile | null {
  return id === list.active ? exportSave(store) : readParked(store, id);
}

// Mark the slot you're in as played just now (shown on the title screen).
export function touchActive(store: KeyValueStore, now = new Date()) {
  const list = readSlots(store, now);
  const s = list.slots.find((x) => x.id === list.active);
  if (!s) return;
  s.lastPlayed = now.toISOString();
  try { store.setItem(SLOTS_KEY, JSON.stringify(list)); } catch {}
}

// Swap the game in play for `incoming` (null parts: a brand-new game) and
// park what was there under its slot. All or nothing.
function swap(store: KeyValueStore, list: SlotList, next: SlotList, incoming: SaveFile["data"] | null, unpark: string | null): SlotResult {
  let writes: [string, string | null][];
  try {
    writes = PARTS.map((p) => [SAVE_PARTS[p], incoming?.[p] == null ? null : JSON.stringify(incoming[p])]);
    if (list.active !== null) writes.push([slotKey(list.active), JSON.stringify(exportSave(store))]);
    if (unpark !== null) writes.push([slotKey(unpark), null]);
    writes.push([SLOTS_KEY, JSON.stringify(next)]);
  } catch {
    return { ok: false, error: "Your saves couldn't be read, so nothing was changed." };
  }
  const before = writes.map(([k]) => [k, store.getItem(k)] as const);
  try {
    for (const [k, v] of writes) { if (v === null) store.removeItem(k); else store.setItem(k, v); }
  } catch {
    for (const [k, v] of before) { try { if (v === null) store.removeItem(k); else store.setItem(k, v); } catch {} }
    return { ok: false, error: "The browser is out of space, so nothing was changed. Delete a save you don't need and try again." };
  }
  return { ok: true, list: next };
}

// Play another slot.
export function switchSlot(store: KeyValueStore, id: string, now = new Date()): SlotResult {
  const list = readSlots(store, now);
  if (id === list.active) return { ok: true, list };
  const target = list.slots.find((s) => s.id === id);
  if (!target) return { ok: false, error: "That save isn't there any more." };
  const raw = store.getItem(slotKey(id));
  const game = readParked(store, id);
  if (raw !== null && !game) return { ok: false, error: "That save is damaged and can't be loaded." };
  const next: SlotList = { active: id, slots: list.slots.map((s) => (s.id === id ? { ...s, lastPlayed: now.toISOString() } : s)) };
  return swap(store, list, next, game?.data ?? null, id);
}

// Start a new slot: a brand-new game, or (from) a save file.
export function newSlot(store: KeyValueStore, name: string, from: SaveFile | null = null, now = new Date()): SlotResult {
  const list = readSlots(store, now);
  if (list.slots.length >= MAX_SLOTS) return { ok: false, error: `You can have ${MAX_SLOTS} saves. Delete one first.` };
  const t = now.toISOString();
  const slot: Slot = { id: newId(list), name: cleanName(name, defaultName(list)), createdAt: t, lastPlayed: t };
  return swap(store, list, { active: slot.id, slots: [...list.slots, slot] }, from?.data ?? null, null);
}

// Rename a slot.
export function renameSlot(store: KeyValueStore, id: string, name: string): SlotResult {
  const list = readSlots(store);
  const s = list.slots.find((x) => x.id === id);
  if (!s) return { ok: false, error: "That save isn't there any more." };
  s.name = cleanName(name, s.name);
  try { store.setItem(SLOTS_KEY, JSON.stringify(list)); } catch { return { ok: false, error: "The name couldn't be saved." }; }
  return { ok: true, list };
}

// Delete a slot you aren't playing (switch away from a game to delete it).
export function deleteSlot(store: KeyValueStore, id: string): SlotResult {
  const list = readSlots(store);
  if (id === list.active) return { ok: false, error: "You can't delete the save you're playing." };
  const next: SlotList = { active: list.active, slots: list.slots.filter((s) => s.id !== id) };
  try {
    store.setItem(SLOTS_KEY, JSON.stringify(next));
    store.removeItem(slotKey(id));
  } catch {
    return { ok: false, error: "That save couldn't be deleted." };
  }
  return { ok: true, list: next };
}
