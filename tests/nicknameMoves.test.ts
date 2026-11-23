// The user's 2026-11-24 list: a creature's own name, moves cut to its slots, selling worn gear of Rare or less,
// Klutz's trips keeping what each fight cost, and schematics all Epic or better.
import { describe, it, expect } from "vitest";
import { cleanNick, NICK_MAX } from "../lib/creatures/nickname";
import { fighterFor, pruneMoves } from "../lib/creatures/instance";
import { CREATURE_BY_ID, defaultMoveNames, MOVE_SLOTS } from "../lib/creatures/creatureData";
import { canSellWorn, WORN_SELL_MAX } from "../lib/items/economy/sell";
import { SCHEMATICS } from "../lib/items/materials";
import { tripOf, type Expedition } from "../lib/klutz";
import { makeCreatureDrop } from "../lib/creatures/summon";
import type { CreatureOrItemDrop } from "../lib/types";

const scout = CREATURE_BY_ID.leafblade_scout;

describe("a creature's own name (lib/creatures/nickname.ts)", () => {
  it("is trimmed, single-spaced and cut to NICK_MAX (the longest species name); nothing left means none", () => {
    expect(NICK_MAX).toBe("The Pale Rider".length);
    expect(cleanNick("  Biscuit   Jones ")).toBe("Biscuit Jones");
    expect(cleanNick("A very long name indeed")).toBe("A very long na".trim());
    expect(cleanNick("A very long name indeed")!.length).toBeLessThanOrEqual(NICK_MAX);
    expect(cleanNick("   ")).toBeNull();
    expect(cleanNick("")).toBeNull();
    expect(cleanNick("Sir Bob!")).toBe("Sir Bob!");
  });

  it("the fighter built from a named creature fights under that name", () => {
    const c = { ...makeCreatureDrop(scout, "creature", "0"), nick: "Biscuit", name: "Biscuit" } as CreatureOrItemDrop;
    expect(fighterFor(c, scout).name).toBe("Biscuit");
    expect(fighterFor({ ...c, nick: undefined }, scout).name).toBe("Leafblade Scout");
  });
});

describe("a creature knows only the moves in its slots (pruneMoves)", () => {
  it("an old save's spare moves are cut away: its list becomes its slots, and learned the slot moves from codexes", () => {
    const born = defaultMoveNames(scout);
    const c = { moves: [...born], learned: ["Pounce", "Barrage"] };
    const slots = [born[0], "Pounce", born[2]];
    expect(pruneMoves(c, slots, scout)).toBe(true);
    expect(c.moves).toEqual(slots);
    expect(c.learned).toEqual(["Pounce"]);
    // Again: nothing to do.
    expect(pruneMoves(c, slots, scout)).toBe(false);
  });

  it("with no slots chosen, its own list stands (a fresh creature is left alone)", () => {
    const c = { moves: defaultMoveNames(scout) };
    expect(pruneMoves(c, undefined, scout)).toBe(false);
    expect(c.moves).toEqual(defaultMoveNames(scout));
    expect("learned" in c).toBe(false);
  });

  it("a full set of four is kept whole", () => {
    const born = defaultMoveNames(scout);
    const slots = [...born, "Barrage"].slice(0, MOVE_SLOTS);
    const c = { moves: [...born], learned: ["Barrage", "Pounce"] };
    pruneMoves(c, slots, scout);
    expect(c.moves).toEqual(slots);
    expect(c.learned).toEqual(["Barrage"]);
  });
});

describe("selling what a creature wears", () => {
  it("Rare or less can be sold worn (behind a second confirmation); Epic and Legendary can't", () => {
    expect(WORN_SELL_MAX).toBe("rare");
    expect(canSellWorn("common")).toBe(true);
    expect(canSellWorn("rare")).toBe(true);
    expect(canSellWorn("epic")).toBe(false);
    expect(canSellWorn("legendary")).toBe(false);
  });
});

describe("schematics", () => {
  it("are all Epic or Legendary (the user, 2026-11-24)", () => {
    for (const [k, s] of Object.entries(SCHEMATICS)) expect(["epic", "legendary"], k).toContain(s.rarity);
  });
});

describe("Klutz's trip record", () => {
  it("keeps what each fight cost him, and each find's look for its picture", () => {
    const ex: Expedition = {
      v: 2, startedAt: 0, endsAt: 1000, maxHp: 100, startHp: 90, collected: false,
      encounters: [
        { at: 100, creatureId: "moss_wolf", rarity: "common", gearRarity: "common", won: true, rounds: 3, hpAfter: 70, loot: [] },
        { at: 200, creatureId: "cave_bat", rarity: "uncommon", gearRarity: "common", won: false, rounds: 2, hpAfter: 10, loot: [] },
      ],
    };
    const potion = { id: "p", barcode: "", dropType: "item", itemCategory: "consumable", rarity: "common", roll: 0, name: "Lesser Potion", potion: "lesser", createdAt: "" } as CreatureOrItemDrop;
    const t = tripOf(ex, 12, [potion]);
    expect(t.fights.map((f) => f.hpLost)).toEqual([20, 60]);
    expect(t.finds).toEqual([{ name: "Lesser Potion", rarity: "common", potion: "lesser" }]);
  });
});
