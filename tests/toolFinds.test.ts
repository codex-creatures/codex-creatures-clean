import { describe, it, expect } from "vitest";
import { makeRoom, toolFinds, STASH_TOOLS, CHEST_TOOLS, type SackItem } from "../lib/dungeon/run";

const tool = (x: SackItem) => ("gear" in x && "tool" in x.gear ? x.gear.tool : undefined);
const share = (sacks: SackItem[][], t: string) => sacks.filter((s) => s.some((x) => tool(x) === t)).length / sacks.length;

describe("flares and clairvoyance scrolls in stashes and chests", () => {
  const N = 4000;
  it("turn up in stashes at their odds", () => {
    const sacks = Array.from({ length: N }, () => makeRoom("stash").sack ?? []);
    expect(share(sacks, "flare")).toBeCloseTo(STASH_TOOLS.flare, 1);
    expect(share(sacks, "clairvoyance")).toBeCloseTo(STASH_TOOLS.clairvoyance, 1);
  });
  it("turn up in chests at their odds", () => {
    const sacks = Array.from({ length: N }, () => toolFinds(CHEST_TOOLS));
    expect(share(sacks, "flare")).toBeCloseTo(CHEST_TOOLS.flare, 1);
    expect(share(sacks, "clairvoyance")).toBeCloseTo(CHEST_TOOLS.clairvoyance, 1);
  });
  it("never on a bad roll", () => {
    expect(toolFinds(CHEST_TOOLS, () => 0.99)).toEqual([]);
    expect(toolFinds(STASH_TOOLS, () => 0).length).toBe(2);
  });
});
