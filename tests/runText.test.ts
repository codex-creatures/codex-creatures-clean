import { describe, it, expect } from "vitest";
import { beatenTitle, chestName, clearedLine, combatLine, dropLabel } from "../lib/dungeon/runText";
import { bagItems, POTIONS, type DungeonRun, type DungeonSave, type Room } from "../lib/dungeon/run";
import { bossTeam } from "../lib/creatures/bosses";
import { combatSummary } from "../lib/combat/loadout";
import type { Drop } from "../lib/types";

// The Labyrinth screen's words and the battle bag's potions, moved out of app/dungeon/page.tsx
// (2026-11-09): pinned to what the screen showed before the move.
const run = (dungeon: number | undefined, runNumber = 4) => ({ dungeon, runNumber }) as unknown as DungeonRun;
const lab = (meta: Partial<DungeonSave["meta"]>) => ({ meta }) as unknown as DungeonSave;

describe("beatenTitle", () => {
  it("names each dungeon's boss, the Cyclops's for a run with no dungeon", () => {
    expect([0, 1, 2, 3, undefined].map((d) => beatenTitle(run(d)))).toEqual([
      "The Encampment is yours!", "The Cyclops falls!", "The Hydra falls!", "The Warden falls!", "The Cyclops falls!",
    ]);
  });
});

describe("clearedLine", () => {
  it("the Encampment: says the Cyclops opens only on the first camp clear", () => {
    expect(clearedLine(run(0, 3), lab({}))).toBe("The chief goes down, and the camp is yours. You beat the Encampment on run 3! The Cyclops's way in is open now.");
    expect(clearedLine(run(0, 3), lab({ campClears: 2 }))).toBe("The chief goes down, and the camp is yours. You beat the Encampment on run 3!");
  });
  it("the Hydra and the Warden", () => {
    expect(clearedLine(run(2, 7), lab({}))).toBe("The last head falls, and the deep goes quiet. You beat the Hydra on run 7!");
    expect(clearedLine(run(3, 9), lab({}))).toMatch(/^The Warden falls, and the deep goes quiet\. You beat the .+ on run 9!$/);
  });
  it("the Cyclops: 'your first clear' only before the first one", () => {
    const first = clearedLine(run(1, 5), lab({}));
    expect(first).toBe("The Eye bursts in a shower of sparks. You beat the Cyclops on run 5 — your first clear! Its head comes home with you: a trophy, and a bounty if anyone's offering one.");
    expect(clearedLine(run(undefined, 5), lab({ firstClearRun: 2 }))).toBe(first.replace(" — your first clear", ""));
  });
});

describe("chestName", () => {
  it("strongbox, the chief's chest, else the Cyclops'", () => {
    const room = (r: Partial<Room>) => r as Room;
    expect(chestName(room({ container: "strongbox", kind: "boss" }))).toBe("The strongbox");
    expect(chestName(room({ container: "chest", kind: "encampment" }))).toBe("The chief's chest");
    expect(chestName(room({ container: "chest", kind: "boss" }))).toBe("The Cyclops' chest");
  });
});

describe("dropLabel", () => {
  const drop = (d: object) => d as Drop;
  it("labels materials, gold, cards, items and creatures", () => {
    expect(dropLabel(drop({ dropType: "item", material: "planks", name: "Planks", qty: 5 }))).toBe("Planks ×5");
    expect(dropLabel(drop({ dropType: "item", material: "nails", name: "Nails" }))).toBe("Nails ×1");
    expect(dropLabel(drop({ dropType: "reward", amount: 120 }))).toBe("120 gold");
    expect(dropLabel(drop({ dropType: "card", name: "Moss Wolf" }))).toBe("Moss Wolf card");
    expect(dropLabel(drop({ dropType: "item", name: "Void Scythe", rarity: "epic" }))).toBe("Void Scythe (epic)");
    expect(dropLabel(drop({ dropType: "creature", name: "Moss Wolf" }))).toBe("Moss Wolf");
  });
});

describe("combatLine", () => {
  it("a boss part's numbers in one line, rounded", () => {
    const f = bossTeam("cyclops", 6)[0], s = combatSummary(f);
    const line = combatLine(f);
    expect(line).toMatch(/^\d+(\.\d+)? HP · Atk -?\d+ · Rng -?\d+ · Mag -?\d+ · Agi -?\d+ · MDef -?\d+ · RDef -?\d+ · MgDef -?\d+$/);
    expect(line.startsWith(`${s.hp} HP · Atk ${Math.round(s.atk)} ·`)).toBe(true);
  });
});

describe("bagItems", () => {
  it("one entry per potion kind in the bag, in POTIONS order, with its count", () => {
    expect(bagItems(["lesser", "potion", "lesser"])).toEqual([
      { key: "potion", ...POTIONS.potion, potion: "potion", count: 1 },
      { key: "lesser", ...POTIONS.lesser, potion: "lesser", count: 2 },
    ]);
  });
  it("leaves out kinds you have none of", () => {
    expect(bagItems(["lesser"]).map((b) => b.key)).toEqual(["lesser"]);
    expect(bagItems([])).toEqual([]);
  });
});
