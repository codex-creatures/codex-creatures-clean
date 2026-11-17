import { describe, it, expect, vi, afterEach } from "vitest";
import {
  CAMPAIGN, CHAPTERS, SUPPLIES, campaignCtx, rewardModel, canClaimNext, claimNext, claimedCount, currentChapter, nextQuest, noteCampaign, onlyEffective,
  questDone, rewardBlocked, noteDrank, drankOn, loadCampaign, rewardText, rollCampaignReward, type CampaignCtx, type CampaignState,
} from "../lib/campaign";
import { weaponDrop, armorDrop, codexDrop, randomCodexMove } from "../lib/drops";
import { ARMOR_KEYS } from "../lib/items/armor";
import { ITEM_KEYS } from "../lib/items/ceilings";
import { enchantOf } from "../lib/items/enchantments";
import { CALIBRATION_SCANS } from "../lib/firstScans";
import { BINDLE } from "../lib/dungeon/run";
import { SKILL_KEYS } from "../lib/klutz";
import type { BattleEvent } from "../lib/combat/battle";
import type { Rarity } from "../lib/items/budgets";

const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const rank = (r: Rarity) => ORDER.indexOf(r);
const creature = (id: string, level = 1, extra: object = {}) => ({ id, dropType: "creature", creatureId: "x", rarity: "common", level, ...extra });
// A brand-new player's save, and the context it gives.
const NEW = campaignCtx({});
const ctx = (over: Partial<CampaignCtx>): CampaignCtx => ({ ...NEW, ...over });

describe("the campaign's quests", () => {
  it("five chapters, every quest with its own id and a goal; the first four end with their dungeon's boss", () => {
    expect(CHAPTERS.map((c) => c.name)).toEqual(["The Encampment", "The Cyclops", "The Hydra", "The Abyss", "Legend"]);
    expect(new Set(CAMPAIGN.map((q) => q.id)).size).toBe(CAMPAIGN.length);
    expect(CAMPAIGN.every((q) => q.goal >= 1 && q.task.length > 0)).toBe(true);
    expect(CHAPTERS.slice(0, 4).map((c) => c.quests.at(-1)!.id)).toEqual(["camp", "cyclops", "hydra", "abyss"]);
  });

  it("a quest's place in its chapter lines up with its place in the whole list (the board finds the one to claim by it)", () => {
    // (The bug, 2026-11-16: the board compared quests to CAMPAIGN's copies of them, never equal, so nothing could be claimed.)
    let at = 0;
    for (const ch of CHAPTERS) for (const q of ch.quests) {
      expect(CAMPAIGN[at].id).toBe(q.id);
      expect(nextQuest({ claimed: at })?.id).toBe(q.id);
      at++;
    }
  });

  it("a new player has done none of them", () => {
    expect(CAMPAIGN.filter((q) => questDone(q, NEW)).map((q) => q.id)).toEqual(["calibrate"]); // (a save with no first scans: calibrated already)
    expect(campaignCtx({ firstScans: { used: 0, codes: [] } }).calibrated).toBe(false);
    expect(campaignCtx({ firstScans: { used: CALIBRATION_SCANS, codes: [] } }).calibrated).toBe(true);
  });

  it("the scaled quests climb with each chapter (scans, fights, levels, gold, Klutz)", () => {
    for (const kind of ["scan", "fights", "level", "klutz", "explorer", "gold", "bestiary", "spar"]) {
      const goals = CAMPAIGN.filter((q) => new RegExp(`^${kind}\\d+$`).test(q.id)).map((q) => q.goal);
      expect(goals.length, kind).toBeGreaterThan(0);
      expect(goals, kind).toEqual([...goals].sort((a, b) => a - b));
    }
  });

  it("the user's rewards: the tavern pays a Gold Key, the Cyclops an enchanted Epic weapon, the rubble the bookcase schematic", () => {
    const reward = (id: string) => CAMPAIGN.find((q) => q.id === id)!.reward;
    expect(reward("tavern")).toEqual({ goldKey: true });
    expect(reward("cyclops")).toEqual({ enchanted: "weapon", rarity: "epic" });
    expect(reward("rubble")).toEqual({ bookcasePlans: true });
    expect(rewardText(reward("cyclops"))).toBe("An enchanted Epic weapon");
  });
});

describe("what the save says", () => {
  it("gear worn: fully kitted, a set bonus, the rarest weapon and item, enchantments (Klutz's gear doesn't count)", () => {
    const key = ARMOR_KEYS[0];
    const w = { ...weaponDrop(ITEM_KEYS[0], "rare"), id: "w" };
    const h = { ...armorDrop(key, "common", "", undefined, "helmet"), id: "h" };
    const c = { ...armorDrop(key, "epic", "", undefined, "chest"), id: "c", enchant: "ironbound" };
    const l = { ...armorDrop(key, "common", "", undefined, "legs"), id: "l" };
    const kw = { ...weaponDrop(ITEM_KEYS[0], "legendary"), id: "kw", enchant: "keen" };
    const save = {
      inventory: [creature("a", 4), w, h, c, l, kw],
      equipment: { a: { weaponId: "w", helmetId: "h", chestId: "c", legsId: "l" }, "klutz-companion": { weaponId: "kw" } },
    };
    const x = campaignCtx(save);
    expect(x).toMatchObject({ fullyEquipped: true, setBonus: true, weapon: "rare", worn: "epic", enchantedWeapon: false, enchantedArmour: true, creatureLevel: 4 });
    const bare = campaignCtx({ ...save, equipment: { a: { weaponId: "w", helmetId: "h" } } });
    expect(bare).toMatchObject({ fullyEquipped: false, setBonus: false, worn: "rare" });
  });

  it("bosses, the tavern, schematics built, the bag, Klutz and the Bestiary", () => {
    const x = campaignCtx({
      labyrinth: { meta: { runs: 9, clears: 2, campClears: 3, deepClears: 0, bagSize: BINDLE + 1 } },
      tavern: { blasted: true, repaired: true, pit: true },
      bookcase: 3, cage: 2, storage: ["weapon"],
      klutz: { level: 6, skills: Object.fromEntries(SKILL_KEYS.map((s) => [s, 1])) },
      seen: ["a", "b"], inventory: [{ id: "k", dropType: "card", creatureId: "c" }, creature("d", 1, { creatureId: "a" })],
      scanCounts: { "1": 1, "2": 3 }, player: { level: 7 }, gold: 1234,
    });
    expect(x).toMatchObject({
      wins: { camp: 3, cyclops: 2, hydra: 0, abyss: 0 }, blasted: true, repaired: true, blueprints: 4, bagUpgraded: true,
      klutzLevel: 6, klutzSent: true, klutzSkills: SKILL_KEYS.length, bestiary: 3, cards: 1, scans: 2, explorer: 7, gold: 1234,
    });
    expect(campaignCtx({ labyrinth: { meta: { bagSize: BINDLE } } }).bagUpgraded).toBe(false);
  });

  it("a learned codex move counts", () => {
    expect(campaignCtx({ inventory: [creature("a", 1, { learned: ["Smite"] })] }).learned).toBe(true);
    expect(campaignCtx({ inventory: [creature("a")] }).learned).toBe(false);
  });
});

describe("progress and claiming", () => {
  it("rewards are claimed in order: a quest done further on waits for the ones before it", () => {
    const first = CAMPAIGN[0], second = CAMPAIGN[1];
    const done2 = ctx({ bestiary: second.goal }); // the second's done, the first isn't
    expect(questDone(second, done2) && !questDone(first, done2)).toBe(true);
    expect(canClaimNext({}, done2)).toBe(false);
    expect(claimNext({}, done2)).toEqual({});
    const both = ctx({ bestiary: second.goal, scans: first.goal });
    const s1 = claimNext({}, both);
    expect(claimedCount(s1)).toBe(1);
    expect(nextQuest(s1)).toBe(CAMPAIGN[1]);
    expect(canClaimNext(s1, both)).toBe(true);
  });

  it("the chapter you're on is the next quest's; with everything claimed, the last", () => {
    expect(currentChapter({})).toBe(0);
    expect(currentChapter({ claimed: CHAPTERS[0].quests.length })).toBe(1);
    const all: CampaignState = { claimed: CAMPAIGN.length };
    expect(nextQuest(all)).toBeUndefined();
    expect(currentChapter(all)).toBe(CHAPTERS.length - 1);
    expect(canClaimNext(all, NEW)).toBe(false);
  });

  it("events are counted; a summon counts only for its own rarity (the user, 2026-11-16), Klutz's finds for theirs and below", () => {
    let s: CampaignState = {};
    s = noteCampaign(s, "battle", 3);
    s = noteCampaign(s, "summon:rare");
    s = noteCampaign(s, "battle", 0);
    expect(s.tally).toEqual({ battle: 3, "summon:rare": 1 });
    const c = ctx({ tally: s.tally! });
    const summon = (r: Rarity) => CAMPAIGN.find((q) => q.id === `summon-${r}`)!;
    expect(questDone(summon("rare"), c)).toBe(true);
    expect([summon("common"), summon("uncommon"), summon("epic")].some((q) => questDone(q, c))).toBe(false);
    const kfind = (r: Rarity) => CAMPAIGN.find((q) => q.id === `kfind-${r}`)!;
    const k = ctx({ tally: { "kfind:epic": 1 } });
    expect(questDone(kfind("rare"), k) && questDone(kfind("epic"), k) && !questDone(kfind("legendary"), k)).toBe(true);
    expect(CAMPAIGN.find((q) => q.id === "fights5")!.progress(c)).toBe(3);
  });

  it("scans and cards count what the save already shows, or what's been counted, whichever is more", () => {
    const scan = CAMPAIGN.find((q) => q.id === "scan3")!;
    expect(scan.progress(ctx({ scans: 2, tally: { scan: 1 } }))).toBe(2);
    expect(scan.progress(ctx({ scans: 0, tally: { scan: 3 } }))).toBe(3);
  });
});

describe("the rewards", () => {
  it("crates hold their count, each within the crate's rarities", () => {
    for (let i = 0; i < 30; i++) {
      const gear = rollCampaignReward({ crate: "gear", lo: "rare", hi: "epic", n: 3 });
      expect(gear).toHaveLength(3);
      for (const d of gear) {
        expect(d.dropType === "item" && (d.itemCategory === "weapon" || d.itemCategory === "armor")).toBe(true);
        expect(rank((d as { rarity: Rarity }).rarity)).toBeGreaterThanOrEqual(rank("rare"));
        expect(rank((d as { rarity: Rarity }).rarity)).toBeLessThanOrEqual(rank("epic"));
      }
      expect(rollCampaignReward({ crate: "materials", lo: "common", hi: "uncommon", n: 3 }).every((d) => d.dropType === "item" && !!d.material)).toBe(true);
      expect(rollCampaignReward({ crate: "codex", lo: "uncommon", hi: "rare", n: 2 }).every((d) => d.dropType === "item" && !!d.codexMove)).toBe(true);
    }
    expect(rollCampaignReward({ crate: "supplies", lo: "common", hi: "rare", n: SUPPLIES })).toHaveLength(SUPPLIES);
  });

  it("an enchanted reward is always enchanted, at its rarity; the Gold Key is the Legendary one; gold gives no things", () => {
    for (let i = 0; i < 20; i++) {
      const [w] = rollCampaignReward({ enchanted: "weapon", rarity: "epic" });
      expect(w).toMatchObject({ itemCategory: "weapon", rarity: "epic" });
      expect(enchantOf(w as never)).toBeTruthy();
      const [a] = rollCampaignReward({ enchanted: "armour", rarity: "legendary" });
      expect(a).toMatchObject({ itemCategory: "armor", rarity: "legendary" });
      expect(enchantOf(a as never)).toBeTruthy();
    }
    expect(rollCampaignReward({ goldKey: true })).toMatchObject([{ tool: "gold_key", rarity: "legendary" }]);
    expect(rollCampaignReward({ gold: 100 })).toEqual([]);
    expect(rollCampaignReward({ bookcasePlans: true })).toEqual([]);
    expect(rollCampaignReward({ scrolls: 2 })).toHaveLength(2);
  });
});

describe("the 3D reveal (the user, 2026-11-16)", () => {
  it("each crate reward shows as its 3D model first: the crates, the gear barrel, the codex bookcase; other rewards don't", () => {
    expect(rewardModel({ crate: "materials", lo: "common", hi: "rare", n: 3 })).toBe("crate-materials");
    expect(rewardModel({ crate: "supplies", lo: "common", hi: "rare", n: SUPPLIES })).toBe("crate-supplies");
    expect(rewardModel({ crate: "gear", lo: "rare", hi: "epic", n: 3 })).toBe("barrel");
    expect(rewardModel({ crate: "codex", lo: "rare", hi: "epic", n: 2 })).toBe("bookcase");
    expect(rewardModel({ gold: 100 })).toBeUndefined();
    expect(rewardModel({ enchanted: "weapon", rarity: "epic" })).toBeUndefined();
    expect(rewardText({ crate: "gear", lo: "rare", hi: "epic", n: 3 })).toBe("Gear Barrel (Rare–Epic)");
    expect(rewardText({ crate: "codex", lo: "rare", hi: "epic", n: 2 })).toBe("Codex Bookcase (Rare–Epic)");
  });
});

describe("a win with only effective moves", () => {
  const hit = (name: string, targetIndex = 0, side: "A" | "B" = "A") =>
    ({ type: "attack", side, skill: { name }, targetIndex } as unknown as BattleEvent);
  it("every hit your side made has to land well on what it hit; style moves and the other side's hits don't help", async () => {
    const { raceOfMove, raceVsAll } = await import("../lib/combat/raceChart");
    const { MOVE_RACES } = await import("../lib/creatures/racesV2");
    // A race move, and a race it's effective on (and one it isn't).
    const races = ["undead", "divine", "beast", "underkin", "geo", "humanoid", "toxic"] as const;
    const name = Object.keys(MOVE_RACES)[0];
    const good = races.find((x) => raceVsAll(raceOfMove({ name })!, [x]) > 1)!;
    const bad = races.find((x) => raceVsAll(raceOfMove({ name })!, [x]) <= 1)!;
    expect(onlyEffective([hit(name)], [[good]])).toBe(true);
    expect(onlyEffective([hit(name), hit("Not A Race Move")], [[good]])).toBe(false);
    expect(onlyEffective([hit(name, 1)], [[good], [bad]])).toBe(false);
    expect(onlyEffective([hit(name), hit("Not A Race Move", 0, "B")], [[good]])).toBe(true);
    expect(onlyEffective([], [[good]])).toBe(false);
  });
});

describe("claiming a reward", () => {
  it("a full box never holds one back (an XP scroll into 65 consumables, a crate of materials); only a full bookcase holds back a codex", () => {
    expect(rewardBlocked(rollCampaignReward({ scrolls: 1 }), 0)).toBeNull();
    expect(rewardBlocked(rollCampaignReward({ crate: "materials", lo: "rare", hi: "epic", n: 3 }), 0)).toBeNull();
    expect(rewardBlocked(rollCampaignReward({ crate: "gear", lo: "rare", hi: "epic", n: 3 }), 0)).toBeNull();
    const codexes = [codexDrop(randomCodexMove()), codexDrop(randomCodexMove())];
    expect(rewardBlocked(codexes, 2)).toBeNull();
    expect(rewardBlocked(codexes, 1)).toMatch(/bookcase is full: make room for 2 codexes/);
    expect(rewardBlocked(codexes.slice(0, 1), 0)).toMatch(/room for the codex/);
    // An overfull bookcase (more codexes than it holds) never holds back a reward with no codex in it.
    expect(rewardBlocked(rollCampaignReward({ scrolls: 1 }), -3)).toBeNull();
    expect(rewardBlocked(rollCampaignReward({ crate: "materials", lo: "rare", hi: "epic", n: 3 }), -3)).toBeNull();
  });
});

describe("a potion drunk", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it("marks only the run it was drunk on, whichever dungeon (Encampment runs never moved meta.runs on)", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } } });
    noteDrank("camp-run-a");
    expect(drankOn("camp-run-a")).toBe(true);
    expect(drankOn("camp-run-b")).toBe(false); // the next Encampment run starts clean
    // An old save's mark (a run number, meta.runs) never matches a run's id.
    const key = Object.keys(store)[0];
    store[key] = JSON.stringify({ ...JSON.parse(store[key]), campaign: { ...loadCampaign(), drank: 4 } });
    expect(drankOn("camp-run-b")).toBe(false);
  });
});
