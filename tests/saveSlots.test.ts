import { describe, it, expect } from "vitest";
import { exportSave, SAVE_PARTS, type KeyValueStore } from "../lib/saveFile";
import { readSlots, switchSlot, newSlot, renameSlot, deleteSlot, slotGame, slotKey, needsTitle, SLOTS_KEY, MAX_SLOTS } from "../lib/saveSlots";

describe("the title screen first", () => {
  it("sends a new visit there from any game page, not just the Den", () => {
    for (const p of ["/", "/altar", "/dungeon", "/settings", "/board"]) expect(needsTitle(p, false)).toBe(true);
  });
  it("leaves the title screen, privacy page and dev tools alone", () => {
    for (const p of ["/start", "/privacy", "/lab", "/lab/rooms", "/simulator"]) expect(needsTitle(p, false)).toBe(false);
    expect(needsTitle("/starter", false)).toBe(true); // (only whole path parts match)
  });
  it("doesn't send you back once a save is picked", () => {
    expect(needsTitle("/altar", true)).toBe(false);
  });
});

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

const progress = { gold: 120, inventory: [{ id: "c1", dropType: "creature" }], scanCounts: { "123456": 2 } };
const registry = { "123456": { outcome: "gold", amount: 60 } };
const battles = [{ id: "b1" }];
const oldBrowser = () => memoryStore({
  [SAVE_PARTS.progress]: JSON.stringify(progress),
  [SAVE_PARTS.registry]: JSON.stringify(registry),
  [SAVE_PARTS.battles]: JSON.stringify(battles),
});
const gold = (s: KeyValueStore) => exportSave(s).data.progress?.gold ?? null;

describe("save slots", () => {
  it("a browser from before slots keeps its game, as Save 1", () => {
    const s = oldBrowser();
    const list = readSlots(s);
    expect(list.active).toBe("1");
    expect(list.slots.map((x) => x.name)).toEqual(["Save 1"]);
    expect(exportSave(s).data).toEqual({ progress, registry, battles }); // untouched
    expect(s.map.has(SLOTS_KEY)).toBe(true);
  });

  it("a brand-new browser has no slots", () => {
    expect(readSlots(memoryStore())).toEqual({ active: null, slots: [] });
  });

  it("New Game parks your game and starts an empty one; switching back brings it all back", () => {
    const s = oldBrowser();
    const r = newSlot(s, "  Sam  ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.list.slots.map((x) => x.name)).toEqual(["Save 1", "Sam"]);
    expect(r.list.active).toBe("2");
    expect(exportSave(s).data).toEqual({ progress: null, registry: null, battles: null });
    // The new game plays and saves…
    s.setItem(SAVE_PARTS.progress, JSON.stringify({ gold: 7 }));
    // …then back to the first: exactly as it was, and the new one is parked.
    expect(switchSlot(s, "1").ok).toBe(true);
    expect(exportSave(s).data).toEqual({ progress, registry, battles });
    expect(s.map.has(slotKey("1"))).toBe(false);
    expect(slotGame(s, readSlots(s), "2")?.data.progress).toEqual({ gold: 7 });
    expect(switchSlot(s, "2").ok).toBe(true);
    expect(gold(s)).toBe(7);
  });

  it("a nameless new game gets the next free Save N", () => {
    const s = oldBrowser();
    newSlot(s, "");
    const r = newSlot(s, "   ");
    expect(r.ok && r.list.slots.map((x) => x.name)).toEqual(["Save 1", "Save 2", "Save 3"]);
  });

  it("a new slot can start from a save file", () => {
    const s = oldBrowser();
    const file = exportSave(memoryStore({ [SAVE_PARTS.progress]: JSON.stringify({ gold: 999 }) }));
    expect(newSlot(s, "Loaded", file).ok).toBe(true);
    expect(gold(s)).toBe(999);
    expect(slotGame(s, readSlots(s), "1")?.data.progress).toEqual(progress);
  });

  it(`stops at ${MAX_SLOTS} slots`, () => {
    const s = oldBrowser();
    for (let i = 1; i < MAX_SLOTS; i++) expect(newSlot(s, "").ok).toBe(true);
    expect(newSlot(s, "").ok).toBe(false);
  });

  it("only a slot you aren't playing can be deleted, and its game goes with it", () => {
    const s = oldBrowser();
    newSlot(s, "Sam");
    expect(deleteSlot(s, "2").ok).toBe(false);
    const r = deleteSlot(s, "1");
    expect(r.ok && r.list.slots.map((x) => x.name)).toEqual(["Sam"]);
    expect(s.map.has(slotKey("1"))).toBe(false);
  });

  it("renames, keeping the old name if the new one is blank", () => {
    const s = oldBrowser();
    readSlots(s);
    expect(renameSlot(s, "1", "Adam").ok).toBe(true);
    expect(readSlots(s).slots[0].name).toBe("Adam");
    renameSlot(s, "1", " ");
    expect(readSlots(s).slots[0].name).toBe("Adam");
  });

  it("out of space part-way: nothing changes", () => {
    const s = oldBrowser();
    readSlots(s);
    const before = new Map(s.map);
    const full = memoryStore(Object.fromEntries(before), SLOTS_KEY); // fails on the last write
    expect(newSlot(full, "Sam").ok).toBe(false);
    expect(full.map).toEqual(before);
  });

  it("a damaged parked save isn't loaded over your game", () => {
    const s = oldBrowser();
    newSlot(s, "Sam");
    s.setItem(slotKey("1"), "{not json");
    expect(switchSlot(s, "1").ok).toBe(false);
    expect(readSlots(s).active).toBe("2");
  });
});
