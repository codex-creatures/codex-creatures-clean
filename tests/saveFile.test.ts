import { describe, it, expect } from "vitest";
import {
  exportSave, checkSaveFile, importSave, readBackup, restoreBackup, saveFileName,
  SAVE_FILE_FORMAT, SAVE_FILE_VERSION, SAVE_PARTS, BACKUP_KEY, type KeyValueStore,
} from "../lib/saveFile";

// A stand-in for the browser's localStorage. failOn: setItem throws for that key (out of space).
function memoryStore(init: Record<string, string> = {}, failOn?: string): KeyValueStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(init));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { if (k === failOn) throw new Error("QuotaExceededError"); map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

const progress = { gold: 120, inventory: [{ id: "c1", dropType: "creature" }, { id: "i1", dropType: "item" }], scanCounts: { "123456": 2 }, labyrinth: { meta: { runs: 3 }, run: null } };
const registry = { "123456": { outcome: "gold", amount: 60, registeredAt: "2026-10-01T00:00:00.000Z" } };
const battles = [{ id: "b1", winner: "A" }];
const filled = () => memoryStore({
  [SAVE_PARTS.progress]: JSON.stringify(progress),
  [SAVE_PARTS.registry]: JSON.stringify(registry),
  [SAVE_PARTS.battles]: JSON.stringify(battles),
});
const other = { gold: 5, inventory: [], scanCounts: {} };
const otherFile = () => JSON.stringify({ format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION, exportedAt: "2026-10-18T10:00:00.000Z", data: { progress: other, registry: {}, battles: [] } });

describe("exporting a save", () => {
  it("takes all three parts, versioned, and checks back in as the same thing", () => {
    const file = exportSave(filled(), new Date("2026-10-19T09:42:00Z"));
    expect(file).toMatchObject({ format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION, exportedAt: "2026-10-19T09:42:00.000Z" });
    expect(file.data).toEqual({ progress, registry, battles });
    const check = checkSaveFile(JSON.stringify(file));
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.summary).toMatchObject({ gold: 120, creatures: 1, items: 1, scans: 2, battles: 1, empty: false });
  });

  it("a fresh game exports as empty (and an unreadable part is left out, not fatal)", () => {
    expect(exportSave(memoryStore()).data).toEqual({ progress: null, registry: null, battles: null });
    expect(exportSave(memoryStore({ [SAVE_PARTS.battles]: "{not json" })).data.battles).toBeNull();
  });

  it("names the file by date", () => {
    expect(saveFileName(new Date(2026, 9, 19, 9, 5))).toBe("codex-creatures-save-2026-10-19-0905.json");
  });
});

describe("checking a save file", () => {
  const bad = (text: string) => { const r = checkSaveFile(text); expect(r.ok).toBe(false); return r.ok ? "" : r.error; };
  it("turns away anything that isn't a good save, with a reason", () => {
    expect(bad("hello")).toMatch(/valid JSON/);
    expect(bad("[]")).toMatch(/isn't a Codex Creatures save/);
    expect(bad(JSON.stringify({ format: "something-else", version: SAVE_FILE_VERSION, data: {} }))).toMatch(/isn't a Codex Creatures save/);
    expect(bad(JSON.stringify({ format: SAVE_FILE_FORMAT, data: {} }))).toMatch(/no version/);
    expect(bad(JSON.stringify({ format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION + 1, data: {} }))).toMatch(/newer version/);
    expect(bad(JSON.stringify({ format: SAVE_FILE_FORMAT, version: 1, data: { progress: {}, registry: {}, battles: [] } }))).toMatch(/before Combat V2/);
    expect(bad(JSON.stringify({ format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION }))).toMatch(/missing its data/);
    expect(bad(JSON.stringify({ format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION, data: { progress: [], registry: null, battles: null } }))).toMatch(/progress/);
    expect(bad(JSON.stringify({ format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION, data: { progress: { inventory: "x" }, registry: null, battles: null } }))).toMatch(/inventory/);
    expect(bad(JSON.stringify({ format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION, data: { progress: { gold: "lots" }, registry: null, battles: null } }))).toMatch(/gold/);
    expect(bad(JSON.stringify({ format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION, data: { progress: null, registry: [], battles: null } }))).toMatch(/registry/);
    expect(bad(JSON.stringify({ format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION, data: { progress: null, registry: null, battles: {} } }))).toMatch(/battle/);
    expect(bad("x".repeat(5_000_001))).toMatch(/too big/);
  });
});

describe("importing a save", () => {
  it("backs up what you had, then replaces all three parts", () => {
    const store = filled();
    const check = checkSaveFile(otherFile());
    if (!check.ok) throw new Error(check.error);
    const r = importSave(store, check.file);
    expect(r.ok).toBe(true);
    expect(JSON.parse(store.getItem(SAVE_PARTS.progress)!)).toEqual(other);
    expect(JSON.parse(store.getItem(SAVE_PARTS.registry)!)).toEqual({});
    expect(readBackup(store)!.data).toEqual({ progress, registry, battles });
  });

  it("restoring the backup brings it back — and can itself be undone", () => {
    const store = filled();
    const check = checkSaveFile(otherFile());
    if (!check.ok) throw new Error(check.error);
    importSave(store, check.file);
    expect(restoreBackup(store).ok).toBe(true);
    expect(JSON.parse(store.getItem(SAVE_PARTS.progress)!)).toEqual(progress);
    expect(readBackup(store)!.data.progress).toEqual(other); // (the save it replaced)
  });

  it("an invalid file is caught before anything is touched", () => {
    const store = filled();
    const before = new Map(store.map);
    expect(checkSaveFile("{\"format\":\"codex-creatures-save\"").ok).toBe(false);
    expect(store.map).toEqual(before);
    expect(store.getItem(BACKUP_KEY)).toBeNull();
  });

  it("if writing fails part-way, your save is put back exactly as it was", () => {
    const store = memoryStore({
      [SAVE_PARTS.progress]: JSON.stringify(progress),
      [SAVE_PARTS.registry]: JSON.stringify(registry),
      [SAVE_PARTS.battles]: JSON.stringify(battles),
    }, SAVE_PARTS.battles); // the last part to be written fails
    const check = checkSaveFile(otherFile());
    if (!check.ok) throw new Error(check.error);
    const r = importSave(store, check.file);
    expect(r.ok).toBe(false);
    expect(JSON.parse(store.getItem(SAVE_PARTS.progress)!)).toEqual(progress);
    expect(JSON.parse(store.getItem(SAVE_PARTS.registry)!)).toEqual(registry);
  });

  it("if there's no room even for the backup, nothing is changed", () => {
    const store = memoryStore({ [SAVE_PARTS.progress]: JSON.stringify(progress) }, BACKUP_KEY);
    const check = checkSaveFile(otherFile());
    if (!check.ok) throw new Error(check.error);
    const r = importSave(store, check.file);
    expect(r.ok).toBe(false);
    expect(JSON.parse(store.getItem(SAVE_PARTS.progress)!)).toEqual(progress);
  });

  it("no backup yet: nothing to restore", () => {
    expect(restoreBackup(filled())).toEqual({ ok: false, error: "There's no backup to restore." });
  });

  it("saves made before save files existed still export and import unchanged (no conversion)", () => {
    const old = { gold: 3, inventory: [{ id: "x", dropType: "card", name: "Old Card" }], favoriteIds: ["x"] }; // (no newer fields)
    const store = memoryStore({ [SAVE_PARTS.progress]: JSON.stringify(old) });
    const text = JSON.stringify(exportSave(store));
    const target = memoryStore();
    const check = checkSaveFile(text);
    if (!check.ok) throw new Error(check.error);
    importSave(target, check.file);
    expect(JSON.parse(target.getItem(SAVE_PARTS.progress)!)).toEqual(old);
    expect(target.getItem(SAVE_PARTS.registry)).toBeNull();
  });
});
