// tests/saveRead.test.ts: reading the save (lib/save.ts readSave). Every read used to parse the whole save and
// then walk all of it four times for the upgrades old saves need; the Den's page alone read it 26 times coming
// home and 18 times every 5 seconds standing there (docs/polish-audit-2026-11.md). A save that needed none of
// them last time, and hasn't changed since, is now just parsed.
import { describe, it, expect, beforeEach } from "vitest";
import { SAVE_KEY, readSave, saveWalks, writeMainSave, writeSaveField, enchantOldGear, dropTakenBack, refreshToolNames, upgradeOldArmor } from "../lib/save";
import { ARMOR_V2 } from "../lib/items/armor";
import { TOOLS } from "../lib/items/materials";

const store: Record<string, string> = {};
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
};
const put = (save: unknown) => { store[SAVE_KEY] = JSON.stringify(save); };
const byHand = () => upgradeOldArmor(refreshToolNames(dropTakenBack(enchantOldGear(JSON.parse(store[SAVE_KEY])))));

const sword = { id: "w1", dropType: "item", itemCategory: "weapon", rarity: "common", name: "Sword", stats: { melee: 5 }, createdAt: "2026-11-20T00:00:00Z" };
const helm = { id: "a1", dropType: "item", itemCategory: "armor", rarity: "common", name: "Helm", stats: { mDef: 9 }, armorV: ARMOR_V2, createdAt: "2026-11-20T00:00:00Z" };
const settled = () => ({ gold: 12, inventory: [sword, helm], labyrinth: { meta: { bag: ["gear:w1"], loot: {} } }, tavern: { blasted: true } });
// Saves from before each upgrade.
const oldArmour = () => ({ ...settled(), inventory: [sword, { ...helm, armorV: undefined }] });
const oldTool = () => ({ ...settled(), inventory: [sword, { id: "t1", dropType: "item", itemCategory: "consumable", rarity: "uncommon", tool: "flare", name: "Flare", desc: "An old name." }] });
const oldKey = () => ({ ...settled(), inventory: [sword, { id: "k1", dropType: "item", itemCategory: "consumable", rarity: "epic", tool: "gold_key", name: "Gold Key" }], labyrinth: { meta: { bag: ["gear:w1", "gear:k1"], loot: {} } } });
// (An old Rare weapon whose own roll gives it an enchantment: the first id that does.)
const oldRare = () => {
  for (let i = 0; i < 500; i++) {
    const w = { ...sword, id: `old${i}`, rarity: "rare", createdAt: "2026-11-01T00:00:00Z" };
    if ((enchantOldGear({ w: { ...w } }).w as { enchant?: string }).enchant) return { ...settled(), inventory: [w] };
  }
  throw new Error("no id rolled an enchantment");
};

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

describe("reading the save", () => {
  it("walks a save that needs no upgrade once, then only parses it, a fresh copy each time", () => {
    put(settled());
    const before = saveWalks();
    const a = readSave(), b = readSave(), c = readSave();
    expect(saveWalks() - before).toBe(1);
    expect(a).toEqual(settled());
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(b).not.toBe(a); // (callers change what they're given: never the same object twice)
    (a.inventory as unknown[]).push("mine");
    expect(readSave()).toEqual(settled());
  });

  it("walks it again once it has changed, whoever changed it", () => {
    put(settled());
    readSave();
    const before = saveWalks();
    put({ ...settled(), gold: 13 }); // (another tab, a loaded save file, a cloud save)
    expect(readSave().gold).toBe(13);
    expect(saveWalks() - before).toBe(1);
    writeSaveField("tour", { step: 2 });
    expect(readSave().tour).toEqual({ step: 2 });
    readSave();
    expect(saveWalks() - before).toBe(2); // (one more, after writeSaveField's write; its own read before it, and the last, were only parsed)
  });

  for (const [what, make, check] of [
    ["armour from before every piece rolled in full", oldArmour, (s: Record<string, unknown>) => expect((s.inventory as { armorV?: number }[])[1].armorV).toBe(ARMOR_V2)],
    ["a tool under its old name", oldTool, (s: Record<string, unknown>) => expect((s.inventory as { name: string }[])[1].name).toBe(TOOLS.flare.name)],
    ["a Gold Key from before it was Legendary", oldKey, (s: Record<string, unknown>) => { expect(s.inventory).toHaveLength(1); expect((s.labyrinth as { meta: { bag: string[] } }).meta.bag).toEqual(["gear:w1"]); }],
    ["an old Rare weapon due its enchantment roll", oldRare, (s: Record<string, unknown>) => expect((s.inventory as { enchant?: string }[])[0].enchant).toBeTruthy()],
  ] as const) {
    it(`upgrades ${what} at every read, the same each time, till the save is written back`, () => {
      put(make());
      const want = byHand();
      const before = saveWalks();
      const a = readSave(), b = readSave();
      expect(saveWalks() - before).toBe(2); // (still needing its upgrade: never just parsed)
      check(a);
      expect(a).toEqual(want);
      expect(b).toEqual(want);
      // Written back upgraded (as the game does on loading), it settles.
      writeMainSave(a);
      const then = saveWalks();
      const c = readSave(), d = readSave();
      expect(saveWalks() - then).toBe(1);
      expect(c).toEqual(d);
      check(c);
    });
  }

  it("gives what walking it by hand gives, first read and later ones, for a save of every kind of thing", () => {
    const all = { ...settled(), inventory: [...settled().inventory, ...oldArmour().inventory, ...oldTool().inventory, ...oldKey().inventory, ...oldRare().inventory],
      crate: oldTool().inventory, labyrinth: { meta: { bag: ["gear:k1", "loot:x"], loot: { x: oldArmour().inventory[1] } }, run: { got: [{ drop: oldKey().inventory[1] }] } } };
    put(all);
    const want = byHand();
    expect(readSave()).toEqual(want);
    expect(readSave()).toEqual(want);
    writeMainSave(readSave());
    const after = byHand();
    expect(readSave()).toEqual(after);
    expect(readSave()).toEqual(after);
  });

  it("an empty or broken save reads as empty, as before", () => {
    expect(readSave()).toEqual({});
    store[SAVE_KEY] = "not json";
    expect(readSave()).toEqual({});
    store[SAVE_KEY] = "null";
    expect(readSave()).toEqual({});
    store[SAVE_KEY] = "7";
    expect(readSave()).toEqual({});
  });
});
