// tests/enchantments.test.ts
// Enchantments (decision 46, lib/items/enchantments.ts): which items carry
// them, where they come from, and what each does in a fight.

import { describe, it, expect, vi, afterEach } from "vitest";
import { createBattle, resolveRound, type BattleAction, type BattleEvent } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage, type Fighter } from "../lib/combat/engine";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { cyclopsTeam } from "../lib/creatures/bosses";
import { fighterFor } from "../lib/creatures/instance";
import { wornArmor } from "../lib/items/armor";
import { dropFromOutcome, weaponDrop, armorDrop } from "../lib/drops";
import { openBarcode } from "../lib/scanning";
import { goldenDrops } from "../lib/dungeon/walkRooms";
import { REGISTRY_RULES } from "../lib/barcodeRegistry";
import {
  ENCHANTS, ENCHANT_KEYS, SCAN_ENCHANT, CHEST_ENCHANT, GOLDEN_ENCHANT, bountiful, scholarly, canEnchant, enchantOf, enchanted,
  enchantPool, enchantsFor, enchantText, enchantValue, fighterEnchants, rollEnchant, type EnchantKey,
} from "../lib/items/enchantments";
import type { CreatureOrItemDrop, Drop } from "../lib/types";

afterEach(() => vi.restoreAllMocks());
const asItem = (d: Drop) => d as CreatureOrItemDrop;
const fighter = (enchant?: Fighter["enchant"]): Fighter => ({
  ...buildFighter(CREATURE_BY_ID.moss_wolf, { melee: 30, ranged: 30, magic: 30 }, { mDef: 30, rDef: 30, magDef: 30 }),
  ...(enchant ? { enchant } : {}),
});
const attack: BattleAction = { kind: "attack", skillName: fighter().skills[0].name };
const hitsBy = (log: BattleEvent[], side: "A" | "B") => log.filter((e): e is Extract<BattleEvent, { type: "attack" }> => e.type === "attack" && e.side === side);
const effects = (log: BattleEvent[], text: string) => log.filter((e) => e.type === "effect" && e.text.includes(text));

describe("which items carry one", () => {
  it("Rare, Epic and Legendary weapons and armour only, one each, from the pool for their kind", () => {
    for (const r of ["common", "uncommon"] as const) expect(canEnchant({ itemCategory: "weapon", rarity: r })).toBe(false);
    for (const r of ["rare", "epic", "legendary"] as const) {
      expect(canEnchant({ itemCategory: "weapon", rarity: r })).toBe(true);
      expect(canEnchant({ itemCategory: "armor", rarity: r })).toBe(true);
    }
    expect(canEnchant({ itemCategory: "consumable", rarity: "legendary" })).toBe(false);
    expect(enchantPool({ itemCategory: "weapon" })).toEqual(["bounty", "scholars", "bossbane", "leeching", "keen", "piercing", "vampiric"]);
    expect(enchantPool({ itemCategory: "armor" })).toEqual(["ironbound", "shielded", "runed", "stalwart", "fleet", "cleansing", "victorious"]);
    expect(ENCHANT_KEYS).toHaveLength(14);
  });
  it("the numbers are the spec's, Rare / Epic / Legendary", () => {
    const v = (k: EnchantKey) => (["rare", "epic", "legendary"] as const).map((r) => enchantValue(k, r));
    expect(v("bounty")).toEqual([0.1, 0.15, 0.2]);
    expect(v("scholars")).toEqual([0.1, 0.15, 0.2]);
    expect(v("bossbane")).toEqual([0.04, 0.06, 0.08]);
    expect(v("leeching")).toEqual([0.03, 0.04, 0.05]);
    expect(v("keen")).toEqual([0.06, 0.08, 0.1]);
    expect(v("piercing")).toEqual([0.06, 0.08, 0.1]);
    expect(v("vampiric")).toEqual([0.02, 0.03, 0.05]);
    for (const k of ["ironbound", "shielded", "runed", "stalwart", "fleet"] as const) expect(v(k)).toEqual([5, 10, 20]);
    expect(v("cleansing")).toEqual([0.02, 0.03, 0.05]);
    expect(v("victorious")).toEqual([0.02, 0.03, 0.05]);
    expect(enchantText("bounty", "epic")).toContain("15%");
    for (const k of ENCHANT_KEYS) expect(ENCHANTS[k].text(enchantValue(k, "rare")).length, k).toBeLessThanOrEqual(80);
  });
  it("an old save's items have none, and anything that doesn't fit counts as none", () => {
    const old = asItem(weaponDrop("void_scythe", "epic"));
    expect(old.enchant).toBeUndefined();
    expect(enchantOf(old)).toBeUndefined();
    expect(enchantOf({ ...old, enchant: "nonsense" as EnchantKey })).toBeUndefined();
    expect(enchantOf({ ...old, enchant: "ironbound" })).toBeUndefined(); // (an armour one on a weapon)
    expect(enchantOf({ ...old, rarity: "common", enchant: "bounty" })).toBeUndefined();
    expect(enchantOf({ ...old, enchant: "bounty" })).toBe("bounty");
  });
  it("a reroll never gives the same one back", () => {
    for (let i = 0; i < 50; i++) expect(rollEnchant({ itemCategory: "armor" }, Math.random, "fleet")).not.toBe("fleet");
  });
});

describe("where they come from", () => {
  it("the odds: scans 25% (in the registry's rules), chests 10%, golden chests always", () => {
    expect([SCAN_ENCHANT, CHEST_ENCHANT, GOLDEN_ENCHANT]).toEqual([0.25, 0.1, 1]);
    expect(REGISTRY_RULES.enchant).toBe(SCAN_ENCHANT);
  });
  it("enchanted() leaves the RNG alone for anything that can't carry one", () => {
    const rng = vi.fn(() => 0);
    const common = weaponDrop("void_scythe", "common");
    expect(enchanted(common, 1, rng)).toBe(common);
    expect(rng).not.toHaveBeenCalled();
    const rare = weaponDrop("void_scythe", "rare");
    expect(asItem(enchanted(rare, 0.25, () => 0.3)).enchant).toBeUndefined();
    expect(asItem(enchanted(rare, 0.25, () => 0.2)).enchant).toBeDefined();
  });
  it("a scan's Rare weapon is enchanted on a roll under 25%; a plain drop (daily quests, Klutz) never", () => {
    const entry = { outcome: "item" as const, itemCategory: "weapon" as const, rarity: "rare" as const, itemKey: "void_scythe" as const, registeredAt: "" };
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const opened = openBarcode("12345678", [{ entry, first: true }], 1);
    expect(opened.kind === "found" && asItem(opened.drops[0]).enchant).toBeTruthy();
    expect(asItem(dropFromOutcome(entry)!).enchant).toBeUndefined();
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    const again = openBarcode("12345678", [{ entry, first: true }], 1);
    expect(again.kind === "found" && asItem(again.drops[0]).enchant).toBeUndefined();
  });
  it("every golden chest find is enchanted", () => {
    for (let i = 0; i < 20; i++) for (const d of goldenDrops(2)) expect(enchantOf(asItem(d)), d.id).toBeDefined();
  });
});

describe("in a fight", () => {
  it("armour's stat enchantments add to its stats; the rest add up into the fighter", () => {
    const piece = (enchant: EnchantKey, slot: "helmet" | "chest" | "legs") => ({ ...asItem(armorDrop("frontiers_mail", "legendary", "", { hp: 10 }, slot)), enchant });
    expect(wornArmor([piece("stalwart", "helmet"), piece("fleet", "chest"), piece("cleansing", "legs")]).stats).toEqual({ hp: 50, agility: 20 });
    const vic = [piece("victorious", "helmet"), piece("victorious", "chest"), { ...piece("victorious", "legs"), rarity: "rare" as const }];
    expect(fighterEnchants(undefined, vic)!.victorious).toBeCloseTo(0.12);
    const w = { ...asItem(weaponDrop("void_scythe", "epic")), enchant: "keen" as const };
    const f = fighterFor(asItem(weaponDrop("void_scythe", "epic")), CREATURE_BY_ID.moss_wolf, w.stats, vic, undefined, "void_scythe", w);
    expect(f.enchant).toEqual({ keen: 0.08, victorious: expect.closeTo(0.12) });
    expect(fighterFor(asItem(weaponDrop("void_scythe", "epic")), CREATURE_BY_ID.moss_wolf, w.stats, [], undefined, "void_scythe").enchant).toBeUndefined();
  });
  it("only those that work where the fight is are kept (Labyrinth PvE, a duel PvP, anywhere else armour only)", () => {
    const all = { bounty: 0.1, leeching: 0.03, keen: 0.06, piercing: 0.06, vampiric: 0.02, cleansing: 0.02, victorious: 0.02 };
    expect(Object.keys(enchantsFor(all, "pve")!)).toEqual(["bounty", "leeching", "cleansing", "victorious"]);
    expect(Object.keys(enchantsFor(all, "pvp")!)).toEqual(["keen", "piercing", "vampiric", "cleansing", "victorious"]);
    expect(Object.keys(enchantsFor(all)!)).toEqual(["cleansing", "victorious"]);
    expect(enchantsFor({ keen: 0.1 }, "pve")).toBeUndefined();
    const s = createBattle([fighter({ keen: 0.1, leeching: 0.05 })], [fighter()], {}, undefined, { mode: "pvp" });
    expect(s.sides.A.team[0].enchant).toEqual({ keen: 0.1 });
  });
  it("Keen: its own precise chance, in PvP only", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.07);
    for (const [mode, precise] of [["pvp", true], ["pve", false]] as const) {
      const s = createBattle([fighter({ keen: 0.08 })], [fighter()], {}, undefined, { mode });
      resolveRound(s, { A: attack, B: attack });
      expect(hitsBy(s.log, "A")[0].precise, mode).toBe(precise);
      expect(hitsBy(s.log, "B")[0].precise).toBe(false);
    }
  });
  it("Piercing: ignores a share of the target's defence", () => {
    const move = fighter().skills[0];
    const plain = calcDamage(move, fighter(), fighter(), false).damage;
    expect(calcDamage(move, fighter({ piercing: 0.5 }), fighter(), false).damage).toBeGreaterThan(plain);
  });
  it("Bossbane: more damage to a boss in the Labyrinth", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const first = (enchant?: Fighter["enchant"]) => {
      const s = createBattle([fighter(enchant), fighter(), fighter()], cyclopsTeam(), {}, "cyclops", { mode: "pve" });
      resolveRound(s, { A: attack, B: attack });
      return hitsBy(s.log, "A")[0].damage;
    };
    const plain = first(), bane = first({ bossbane: 0.08 });
    expect(bane / plain).toBeCloseTo(1.08, 1);
  });
  it("Leeching (Labyrinth) and Vampiric (PvP) heal a share of the damage dealt; each only in its own mode", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const big = (f: Fighter) => ({ ...f, maxHp: 999, hp: 999 });
    for (const [enchant, mode, heals] of [[{ leeching: 0.5 }, "pve", true], [{ leeching: 0.5 }, "pvp", false], [{ vampiric: 0.5 }, "pvp", true], [{ vampiric: 0.5 }, "pve", false]] as const) {
      const s = createBattle([big(fighter({ ...enchant }))], [big(fighter())], { A: [500] }, undefined, { mode });
      resolveRound(s, { A: attack, B: attack });
      expect(effects(s.log, "drinks").length > 0, `${Object.keys(enchant)} in ${mode}`).toBe(heals);
    }
  });
  it("Victorious: a knockout heals a share of max HP, everywhere", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const me = { ...fighter({ victorious: 0.15 }), maxHp: 999, hp: 999 };
    const s = createBattle([me], [fighter(), fighter()], { A: [100], B: [1] });
    resolveRound(s, { A: attack, B: attack });
    const healed = effects(s.log, "heartened");
    expect(healed).toHaveLength(1);
    expect(healed[0].type === "effect" && healed[0].damage).toBe(Math.round(me.maxHp * 0.15));
  });
  it("Cleansing: at the end of a round, shakes off the latest harmful effect (no roll with none)", () => {
    const rng = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const s = createBattle([fighter({ cleansing: 0.6 })], [fighter()]);
    const mine = s.sides.A.team[0];
    mine.statuses.push({ id: "poison", rounds: 5, dmg: 1 }, { id: "cripple", rounds: 5, loss: 0.5 }, { id: "brace", rounds: 5 });
    resolveRound(s, { A: attack, B: attack });
    expect(mine.statuses.some((x) => x.id === "poison")).toBe(true); // (only the latest goes)
    expect(mine.statuses.some((x) => x.id === "cripple")).toBe(false);
    expect(effects(s.log, "shakes off its cripple")).toHaveLength(1);
    // With a roll over its chance, nothing goes.
    rng.mockReturnValue(0.7);
    const t = createBattle([fighter({ cleansing: 0.6 })], [fighter()]);
    t.sides.A.team[0].statuses.push({ id: "poison", rounds: 5, dmg: 1 });
    resolveRound(t, { A: attack, B: attack });
    expect(t.sides.A.team[0].statuses.some((x) => x.id === "poison")).toBe(true);
  });
  it("Bounty and Scholar's: more gold and XP after a Labyrinth fight", () => {
    expect(bountiful(100, [{ enchant: { bounty: 0.2 } }, { enchant: { bounty: 0.1 } }, {}])).toBe(130);
    expect(bountiful(100, [{}])).toBe(100);
    expect(scholarly(40, { enchant: { scholars: 0.15 } })).toBe(46);
    expect(scholarly(50, undefined)).toBe(50);
  });
});
