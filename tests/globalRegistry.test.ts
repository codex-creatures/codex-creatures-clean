// tests/globalRegistry.test.ts
// The global registry (docs/design.md §12): the server's answer is checked
// before it's trusted, no answer means the scan waits sealed, and a scan
// opens the same way whichever registry answered.

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLookup, lookupOnline } from "../lib/online/registry";
import { openBarcode, scanKeys, SCAN_DROPS } from "../lib/scanning";
import { REGISTRY_RULES, rollFromRules, type BarcodeOutcome, type Lookup } from "../lib/barcodeRegistry";
import { SCAN_UNLOCK } from "../lib/creatures/levels";

const look = (entry: BarcodeOutcome, first: boolean): Lookup => ({ entry: { ...entry, registeredAt: "" }, first });

// A stand-in for the Supabase client: rpc answers with `reply`, or throws.
const stub = (reply: { data?: unknown; error?: unknown } | Error) =>
  ({ rpc: async () => { if (reply instanceof Error) throw reply; return reply; } }) as unknown as SupabaseClient;

describe("the server's answer", () => {
  it("accepts every outcome shape the rules can roll", () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const bad: unknown[] = [];
    for (let i = 0; i < 2000; i++) {
      const entry = rollFromRules(REGISTRY_RULES, rng);
      if (!parseLookup({ entry, first: true, registeredAt: "2026-10-31T00:00:00Z" })) bad.push(entry);
    }
    expect(bad).toEqual([]);
  });

  it("refuses anything malformed", () => {
    expect(parseLookup(null)).toBeNull();
    expect(parseLookup({ entry: { outcome: "gold", amount: 5 } })).toBeNull(); // no first
    expect(parseLookup({ entry: { outcome: "creature", rarity: "mythic", creatureId: "x" }, first: true })).toBeNull();
    expect(parseLookup({ entry: { outcome: "item", itemCategory: "weapon", rarity: "rare" }, first: true })).toBeNull(); // no weapon
    expect(parseLookup({ entry: { outcome: "item", itemCategory: "hat", rarity: "rare" }, first: true })).toBeNull();
    expect(parseLookup({ entry: { outcome: "jackpot" }, first: false })).toBeNull();
  });

  it("no answer (an error, no connection) is null: the scan waits sealed", async () => {
    expect(await lookupOnline(stub({ error: { message: "Sign in to scan" } }), "123456")).toBeNull();
    expect(await lookupOnline(stub(new Error("Failed to fetch")), "123456")).toBeNull();
    const ok = await lookupOnline(stub({ data: { entry: { outcome: "gold", amount: 70 }, first: true, registeredAt: "t" } }), "123456");
    expect(ok).toEqual({ entry: { outcome: "gold", amount: 70, registeredAt: "t" }, first: true });
  });
});

describe("opening a barcode", () => {
  const legendary: BarcodeOutcome = { outcome: "creature", rarity: "legendary", creatureId: "storm_phoenix" };

  it("asks the registry for one key per drop", () => {
    expect(scanKeys("123456")).toHaveLength(SCAN_DROPS);
    expect(scanKeys("123456")[0]).toBe("123456");
  });

  it("the first ever to scan it gets whatever it holds, at any level", () => {
    const r = openBarcode("123456", [look(legendary, true)], 1);
    expect(r).toMatchObject({ kind: "found", first: true });
    expect(r.kind === "found" && r.drops).toHaveLength(1);
  });

  it("someone else's find too rare for you stays sealed until your level can find it", () => {
    expect(openBarcode("123456", [look(legendary, false)], 1)).toEqual({ kind: "too_rare", rarity: "legendary", need: SCAN_UNLOCK.legendary });
    expect(openBarcode("123456", [look(legendary, false)], SCAN_UNLOCK.legendary)).toMatchObject({ kind: "found", first: false });
  });

  it("a soul stone is only for the first to scan it: anyone after gets gold", () => {
    const stone: BarcodeOutcome = { outcome: "soul_stone", stone: "toxic_skin" };
    const mine = openBarcode("123456", [look(stone, true)], 1);
    const theirs = openBarcode("123456", [look(stone, false)], 1);
    expect(mine.kind === "found" && mine.drops[0].dropType).not.toBe("reward");
    expect(theirs.kind === "found" && theirs.drops[0].dropType).toBe("reward");
  });

  it("a species no longer in the game is skipped, not a crash", () => {
    const r = openBarcode("123456", [look({ outcome: "creature", rarity: "common", creatureId: "long_gone" }, true)], 1);
    expect(r).toEqual({ kind: "found", drops: [], first: true });
  });
});
