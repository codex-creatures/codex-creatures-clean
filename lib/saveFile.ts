// lib/saveFile.ts
// Save files: your whole game in one .json file, to back it up or to carry
// it to another computer (or browser, or from the dev server to the offline
// copy: each address keeps its own save).
//
// A save file holds all three things the game keeps in the browser:
// - progress: everything about you (lib/save.ts: SAVE_KEY, the Labyrinth included);
// - registry: what each barcode you've scanned gives (lib/barcodeRegistry.ts);
// - battles: your recent battles (lib/battleHistory.ts).
//
// The file is versioned (SAVE_FILE_VERSION): a later game can read older
// files, and this one refuses a file from a newer game rather than guess.
// (Except: files from before Combat V2 are refused too, FIRST_READABLE_VERSION.)
//
// Importing is careful:
// 1. the file is checked first (checkSaveFile); a bad file changes nothing;
// 2. what you have now is backed up (BACKUP_KEY) before anything is written;
// 3. if writing fails part-way, everything is put back as it was.
// Restoring the backup is an import of it, so the save it replaces becomes
// the new backup: restoring can always be undone.

import { SAVE_KEY } from "./save";
import { REGISTRY_KEY } from "./barcodeRegistry";
import { STORAGE_KEY as BATTLES_KEY } from "./battleHistory";

export const SAVE_FILE_FORMAT = "codex-creatures-save";
// 2: Combat V2 (2026-10-26). Saves from before it (1) can't be loaded: the
// user chose a fresh start for everyone (FIRST_READABLE_VERSION).
export const SAVE_FILE_VERSION = 2;
export const FIRST_READABLE_VERSION = 2;
export const BACKUP_KEY = "codex_creatures_backup_v1";
export const MAX_SAVE_FILE_BYTES = 5_000_000; // far more than any real save

// What's kept in the browser, by its part of the save file.
export const SAVE_PARTS = { progress: SAVE_KEY, registry: REGISTRY_KEY, battles: BATTLES_KEY } as const;
export type SavePart = keyof typeof SAVE_PARTS;

export type SaveFile = {
  format: typeof SAVE_FILE_FORMAT;
  version: number;
  exportedAt: string; // ISO time
  // Each part as the game keeps it (parsed JSON); null = nothing saved yet.
  data: { progress: Record<string, unknown> | null; registry: Record<string, unknown> | null; battles: unknown[] | null };
};

// The bits of localStorage this needs (so tests can pass in a stand-in).
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// ── Export ────────────────────────────────────────────────────────────
// Everything saved right now, as a save file. (A part that can't be read is
// left out as null rather than stopping the export.)
export function exportSave(store: KeyValueStore, now = new Date()): SaveFile {
  const read = (key: string): unknown => {
    try {
      const raw = store.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const progress = read(SAVE_PARTS.progress), registry = read(SAVE_PARTS.registry), battles = read(SAVE_PARTS.battles);
  return {
    format: SAVE_FILE_FORMAT,
    version: SAVE_FILE_VERSION,
    exportedAt: now.toISOString(),
    data: {
      progress: isObject(progress) ? progress : null,
      registry: isObject(registry) ? registry : null,
      battles: Array.isArray(battles) ? battles : null,
    },
  };
}

// A file name for an export: codex-creatures-save-2026-10-19-0942.json
export function saveFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `codex-creatures-save-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

// ── Checking a file ───────────────────────────────────────────────────
export type SaveSummary = { exportedAt: string; gold: number; creatures: number; items: number; scans: number; battles: number; empty: boolean };
export type CheckResult = { ok: true; file: SaveFile; summary: SaveSummary } | { ok: false; error: string };

// Is this text a save file this game can load? Never throws.
export function checkSaveFile(text: string): CheckResult {
  if (text.length > MAX_SAVE_FILE_BYTES) return { ok: false, error: "That file is too big to be a Codex Creatures save." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't a save file (it isn't valid JSON)." };
  }
  if (!isObject(parsed) || parsed.format !== SAVE_FILE_FORMAT) return { ok: false, error: "That file isn't a Codex Creatures save." };
  if (typeof parsed.version !== "number" || !Number.isInteger(parsed.version) || parsed.version < 1) {
    return { ok: false, error: "That save file has no version number, so it can't be read safely." };
  }
  if (parsed.version < FIRST_READABLE_VERSION) {
    return { ok: false, error: "That save is from before Combat V2 (races replaced the triangle), so it can't be loaded. Start a new game instead." };
  }
  if (parsed.version > SAVE_FILE_VERSION) {
    return { ok: false, error: `That save was made by a newer version of the game (save format ${parsed.version}). Update the game on this computer first, then import it.` };
  }
  if (!isObject(parsed.data)) return { ok: false, error: "That save file is missing its data." };
  const { progress, registry, battles } = parsed.data;
  if (progress !== null && !isObject(progress)) return { ok: false, error: "The progress in that save file is damaged." };
  if (registry !== null && !isObject(registry)) return { ok: false, error: "The barcode registry in that save file is damaged." };
  if (battles !== null && !Array.isArray(battles)) return { ok: false, error: "The battle history in that save file is damaged." };
  // The fields the game relies on, where they're present.
  if (progress) {
    if ("inventory" in progress && !Array.isArray(progress.inventory)) return { ok: false, error: "The inventory in that save file is damaged." };
    if ("gold" in progress && typeof progress.gold !== "number") return { ok: false, error: "The gold in that save file is damaged." };
    if ("labyrinth" in progress && progress.labyrinth !== undefined && !isObject(progress.labyrinth)) return { ok: false, error: "The Labyrinth progress in that save file is damaged." };
  }
  const file: SaveFile = {
    format: SAVE_FILE_FORMAT,
    version: parsed.version,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : "",
    data: { progress: (progress as SaveFile["data"]["progress"]) ?? null, registry: (registry as SaveFile["data"]["registry"]) ?? null, battles: (battles as unknown[]) ?? null },
  };
  return { ok: true, file, summary: summarise(file) };
}

// What a save holds, in a line or two (to show before you replace yours with it).
export function summarise(file: SaveFile): SaveSummary {
  const p = file.data.progress ?? {};
  const inv = Array.isArray(p.inventory) ? (p.inventory as { dropType?: string }[]) : [];
  const counts = isObject(p.scanCounts) ? Object.values(p.scanCounts) : [];
  return {
    exportedAt: file.exportedAt,
    gold: typeof p.gold === "number" ? p.gold : 0,
    creatures: inv.filter((d) => d?.dropType === "creature").length,
    items: inv.filter((d) => d?.dropType === "item").length,
    scans: counts.reduce((n: number, c) => n + (typeof c === "number" ? c : 0), 0),
    battles: file.data.battles?.length ?? 0,
    empty: !file.data.progress && !file.data.registry && !file.data.battles,
  };
}

// ── Import ────────────────────────────────────────────────────────────
export type ImportResult = { ok: true; backup: SaveFile } | { ok: false; error: string };

// Replace the save with this file's (check it with checkSaveFile first).
// What you had is kept as the backup first; if anything goes wrong while
// writing, it's all put back and nothing changes.
export function importSave(store: KeyValueStore, file: SaveFile, now = new Date()): ImportResult {
  // Everything to write, turned into text before a single thing is touched.
  let texts: Record<SavePart, string | null>;
  try {
    texts = {
      progress: file.data.progress === null ? null : JSON.stringify(file.data.progress),
      registry: file.data.registry === null ? null : JSON.stringify(file.data.registry),
      battles: file.data.battles === null ? null : JSON.stringify(file.data.battles),
    };
  } catch {
    return { ok: false, error: "That save file couldn't be read. Nothing was changed." };
  }
  // The save as it is now: exactly, to put back if need be, and as a backup file.
  const before = {} as Record<SavePart, string | null>;
  try {
    for (const part of Object.keys(SAVE_PARTS) as SavePart[]) before[part] = store.getItem(SAVE_PARTS[part]);
  } catch {
    return { ok: false, error: "Your current save couldn't be read, so nothing was changed." };
  }
  const backup = exportSave(store, now);
  try {
    store.setItem(BACKUP_KEY, JSON.stringify(backup));
  } catch {
    return { ok: false, error: "There's no room to back up your current save, so nothing was changed." };
  }
  try {
    for (const part of Object.keys(SAVE_PARTS) as SavePart[]) {
      const t = texts[part];
      if (t === null) store.removeItem(SAVE_PARTS[part]);
      else store.setItem(SAVE_PARTS[part], t);
    }
  } catch {
    // Put everything back as it was.
    for (const part of Object.keys(SAVE_PARTS) as SavePart[]) {
      try {
        const t = before[part];
        if (t === null) store.removeItem(SAVE_PARTS[part]);
        else store.setItem(SAVE_PARTS[part], t);
      } catch {}
    }
    return { ok: false, error: "The save couldn't be written (the browser may be out of space). Your save is unchanged." };
  }
  return { ok: true, backup };
}

// ── The backup ────────────────────────────────────────────────────────
// The save you had before your last import (or restore), if there is one.
export function readBackup(store: KeyValueStore): SaveFile | null {
  try {
    const raw = store.getItem(BACKUP_KEY);
    if (raw === null) return null;
    const check = checkSaveFile(raw);
    return check.ok ? check.file : null;
  } catch {
    return null;
  }
}

// Go back to the backup. The save it replaces becomes the backup, so this
// can be undone the same way.
export function restoreBackup(store: KeyValueStore, now = new Date()): ImportResult {
  const backup = readBackup(store);
  if (!backup) return { ok: false, error: "There's no backup to restore." };
  return importSave(store, backup, now);
}
