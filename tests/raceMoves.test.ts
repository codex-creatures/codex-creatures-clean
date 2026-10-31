import { describe, it, expect, vi } from "vitest";
import { createBattle, resolveRound, affordableSkills, type BattleAction } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { BASIC_MOVES, STRONG_MOVES, CREATURE_BY_ID as LIVE_BY_ID, PRE_V2_SPECIES, RACE_MOVES, LEARNABLE_MOVES, MOVE_BY_NAME, movesAvailableTo, resolveMoves, canLearnFromCodex } from "../lib/creatures/creatureData";
// Battle mechanics tests use the older species, with the moves they were written with.
const CREATURE_BY_ID = { ...LIVE_BY_ID, ...PRE_V2_SPECIES };
import { codexDrop, dropFromOutcome, RACE_CODEX_MOVES } from "../lib/drops";
import { upgradeMoveSet } from "../lib/creatures/instance";
import { makeCreatureDrop } from "../lib/creatures/summon";
import { KLUTZ, renamedMove } from "../lib/creatures/creatureData";
import type { CreatureOrItemDrop } from "../lib/types";

const hit = (skillName: string): BattleAction => ({ kind: "attack", skillName });
const fighter = (id: string, moves: string[]) => buildFighter(CREATURE_BY_ID[id], { melee: 20, ranged: 20 }, { mDef: 5, rDef: 5 }, moves);

describe("what a creature can use and learn", () => {
  it("its own (rolled) moves and what it learned from codexes: the rest of its race kit needs codexes", () => {
    const wolf = LIVE_BY_ID.moss_wolf; // Beast, melee: the Beast melee kit
    const names = (own: string[], learned: string[] = []) => movesAvailableTo(wolf, learned, own).map((m) => m.name);
    expect(names([])).toEqual(["Strike", "Gore", "Rush"]);
    expect(names([LEARNABLE_MOVES[1].name])).toEqual([LEARNABLE_MOVES[1].name]);
    // Its kit's Maul and a learnable move, once learned; Pounce (Beast) too; Mirage isn't Beast.
    expect(names(["Strike", "Gore", "Rush"], ["Maul", LEARNABLE_MOVES[0].name, "Pounce", "Mirage"]))
      .toEqual(["Strike", "Gore", "Rush", "Maul", LEARNABLE_MOVES[0].name, "Pounce"]);
  });

  it("race-kit codexes: only a creature with that move in its kits (its race, in its style)", () => {
    expect(canLearnFromCodex(LIVE_BY_ID.moss_wolf, "Maul")).toBe(true);        // Beast melee
    expect(canLearnFromCodex(LIVE_BY_ID.moss_wolf, "Tunnel Rush")).toBe(false); // Underkin
    expect(canLearnFromCodex(LIVE_BY_ID.moss_wolf, "Horn Hurl")).toBe(false);   // Beast, but ranged
    const maul = codexDrop("Maul") as CreatureOrItemDrop, lunge = codexDrop("Lunge") as CreatureOrItemDrop;
    expect([maul.rarity, lunge.rarity]).toEqual(["rare", "common"]);            // heavy: Rare; light: Common
    expect(maul.desc).toContain("one Beast Melee creature");
    expect(RACE_CODEX_MOVES.map((m) => m.name)).toEqual(expect.arrayContaining(["Pounce", "Maul", "Lunge", "Gore"]));
    expect(RACE_CODEX_MOVES.map((m) => m.name)).not.toContain("Strike");
  });

  it("learnable codexes work on anyone; race codexes only on that race", () => {
    expect(canLearnFromCodex(CREATURE_BY_ID.cave_bat, LEARNABLE_MOVES[0].name)).toBe(true);
    expect(canLearnFromCodex(CREATURE_BY_ID.cave_bat, "Mirage")).toBe(false);
    expect(canLearnFromCodex(CREATURE_BY_ID.moss_wolf, "Pounce")).toBe(true);
  });

  it("race moves: their race plus the species the user named, minus any left out", () => {
    const can = (id: string, m: string) => canLearnFromCodex(CREATURE_BY_ID[id], m);
    for (const id of ["void_serpent", "deep_angler", "veilstalker", "cave_bat", "moss_wolf"]) expect(can(id, "Pounce")).toBe(true);
    for (const id of ["ironhide", "tunnel_wyrm", "rust_beetle"]) expect(can(id, "Pounce")).toBe(false);
    for (const id of ["flicker_wisp", "dust_sprite", "dustwraith", "swamp_witch", "mr_shadows", "dreadpox", "thunderhead", "pale_rider", "storm_phoenix"]) expect(can(id, "Mirage")).toBe(true);
    for (const id of ["rattlebones", "hollow_matriarch", "dreadpox", "plague_rat"]) expect(can(id, "Corpsify")).toBe(true);
    for (const id of ["rotgut_fly", "leafblade_scout", "aurelius", "the_watcher", "thunderhead", "sylvaran", "storm_phoenix", "hollow_matriarch"]) expect(can(id, "Barrage")).toBe(true);
    for (const id of ["dust_sprite", "tunnel_wyrm", "swamp_witch", "mr_shadows", "thunderhead", "ironhide"]) expect(can(id, "Erupt")).toBe(true);
    expect(can("moss_wolf", "Erupt")).toBe(false);
    expect(can("moss_wolf", "Mirage")).toBe(false);
  });

  it("Erupt: 25 magic damage, 70 energy, a 25% chance to cripple for 3-5 rounds", () => {
    expect(MOVE_BY_NAME.Erupt).toMatchObject({ damage: 25, energyCost: 70, type: "magic", race: "geo", effect: { kind: "cripple", chance: 0.25, minRounds: 3, maxRounds: 5 } });
    // Its cripple lasts 3 to 5 rounds after this one (+1: it ticks at the end of this round).
    const lengths = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const st = createBattle([fighter("thunderhead", ["Erupt"])], [fighter("moss_wolf", ["Slash"])]);
      resolveRound(st, { A: hit("Erupt"), B: hit("Slash") });
      const c = st.sides.B.team[0].statuses.find((x) => x.id === "cripple");
      if (c) lengths.add(c.rounds);
    }
    expect([...lengths].sort()).toEqual([3, 4, 5]);
  });

  it("consumables: Common a Lesser Potion or basic codex, Uncommon a learnable codex, Rare a Healing Potion or strong codex", () => {
    const random = vi.spyOn(Math, "random");
    random.mockReturnValue(0.99); // past the codex share: the potion
    const potion = dropFromOutcome({ outcome: "item", itemCategory: "consumable", rarity: "common" });
    const healing = dropFromOutcome({ outcome: "item", itemCategory: "consumable", rarity: "rare" });
    random.mockReturnValue(0);    // under it: a codex
    const basic = dropFromOutcome({ outcome: "item", itemCategory: "consumable", rarity: "common" });
    const strong = dropFromOutcome({ outcome: "item", itemCategory: "consumable", rarity: "rare" });
    random.mockRestore();
    expect(healing && "potion" in healing && healing.potion).toBe("potion");
    expect(healing && "rarity" in healing && healing.rarity).toBe("rare");
    expect(strong && "codexMove" in strong && STRONG_MOVES.some((m) => m.name === strong.codexMove)).toBe(true);
    expect(strong && "rarity" in strong && strong.rarity).toBe("rare");
    const codex = dropFromOutcome({ outcome: "item", itemCategory: "consumable", rarity: "uncommon" });
    expect(potion && "potion" in potion && potion.potion).toBe("lesser");
    expect(basic && "codexMove" in basic && BASIC_MOVES.some((m) => m.name === basic.codexMove)).toBe(true);
    expect(basic && "rarity" in basic && basic.rarity).toBe("common");
    expect(codex && "codexMove" in codex && LEARNABLE_MOVES.some((m) => m.name === codex.codexMove)).toBe(true);
  });

  it("basic codexes: the natural moves up to 20 damage, for creatures of that class", () => {
    expect(BASIC_MOVES).toHaveLength(15);
    expect(BASIC_MOVES.every((m) => m.damage <= 20 && !m.effect)).toBe(true);
    expect(BASIC_MOVES.map((m) => m.name)).not.toContain("Devastator");
    const wolf = CREATURE_BY_ID.moss_wolf; // melee
    expect(wolf.cls).toBe("melee");
    expect(canLearnFromCodex(wolf, "Heavy Blow")).toBe(true);
    expect(canLearnFromCodex(wolf, "Ice Lance")).toBe(false);  // magic
    // Once learned, it can go in a slot and is kept there.
    const usable = movesAvailableTo(wolf, ["Heavy Blow", "Ice Lance"], ["Slash"]).map((m) => m.name);
    expect(usable).toContain("Heavy Blow");
    expect(usable).not.toContain("Ice Lance");
    expect(resolveMoves(wolf, ["Slash", "Heavy Blow"]).map((m) => m.name)).toEqual(["Slash", "Heavy Blow"]);
  });

  it("strong codexes: the rest of the natural moves, also for creatures of that class", () => {
    expect(STRONG_MOVES).toHaveLength(9); // (the old melee Impale was retired, 2026-10-27)
    expect(STRONG_MOVES.every((m) => m.damage > 20)).toBe(true);
    const wolf = CREATURE_BY_ID.moss_wolf; // melee
    expect(canLearnFromCodex(wolf, "Devastator")).toBe(true);
    expect(canLearnFromCodex(wolf, "Starfall")).toBe(false); // magic
    expect(resolveMoves(wolf, ["Slash", "Devastator"]).map((m) => m.name)).toEqual(["Slash", "Devastator"]);
  });
});

describe("race moves", () => {
  it("each race has one, and only creatures of that race can learn it", () => {
    expect(new Set(RACE_MOVES.map((m) => m.race)).size).toBe(6);
    const wolf = CREATURE_BY_ID.moss_wolf; // beast
    expect(movesAvailableTo(wolf).map((m) => m.name)).not.toContain("Pounce"); // not until learned
    expect(movesAvailableTo(wolf, ["Pounce", "Mirage"]).map((m) => m.name)).toContain("Pounce");
    expect(movesAvailableTo(wolf, ["Pounce", "Mirage"]).map((m) => m.name)).not.toContain("Mirage");
    expect(resolveMoves(wolf, ["Pounce", "Mirage", "Slash"]).map((m) => m.name)).toEqual(["Pounce", "Slash"]);
  });

  it("Pounce strikes first even when slower, and hits the wounded harder", () => {
    const slow = fighter("crystalback", ["Pounce", "Slash"]);   // agility 4%
    const fast = fighter("monkey_mage", ["Slash", "Bolt"]);      // agility 30%
    const s = createBattle([slow], [fast]);
    resolveRound(s, { A: hit("Pounce"), B: hit("Slash") });
    const attacks = s.log.filter((e) => e.type === "attack");
    expect(attacks[0].type === "attack" && attacks[0].attacker).toBe("Crystalback");

    // Same hit on a healthy and a wounded target (no precise hits; the same damage roll).
    const fixed = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const dmg = (st: ReturnType<typeof createBattle>) => {
      resolveRound(st, { A: hit("Pounce"), B: hit("Slash") });
      const e = st.log.find((x) => x.type === "attack" && x.side === "A");
      return e && e.type === "attack" && !e.precise ? e.damage : null;
    };
    let a: number | null = null, b: number | null = null;
    for (let i = 0; i < 50 && (a === null || b === null); i++) {
      a ??= dmg(createBattle([slow], [fast]));
      b ??= dmg(createBattle([slow], [fast], { B: [Math.floor(fast.maxHp / 3)] }));
    }
    fixed.mockRestore();
    expect(b!).toBe(Math.round(a! * 1.5));
  });

  it("Rabid Bite's venom ticks 10% of max HP for 3–5 rounds, even on the bench", () => {
    for (let n = 0; n < 30; n++) {
      const biter = fighter("rust_beetle", ["Rabid Bite", "Jab"]);
      const victim = { ...fighter("crystal_golem", ["Jab"]), maxHp: 500, hp: 500 };
      const spare = fighter("crystal_golem", ["Jab"]);
      const s = createBattle([biter], [victim, spare]);
      resolveRound(s, { A: hit("Rabid Bite"), B: hit("Jab") });
      expect(s.sides.B.team[0].statuses.find((x) => x.id === "venom")?.dmg).toBe(50);
      resolveRound(s, { A: hit("Jab"), B: { kind: "swap", to: 1 } }); // to the bench — still bitten
      for (let r = 0; r < 6; r++) resolveRound(s, { A: hit("Jab"), B: hit("Jab") });
      const ticks = s.log.filter((e) => e.type === "effect" && e.kind === "venom" && e.side === "B" && e.index === 0).length;
      expect(ticks).toBeGreaterThanOrEqual(3);
      expect(ticks).toBeLessThanOrEqual(5);
    }
  });

  it("Mirage makes attacks shimmer away", () => {
    const sprite = fighter("flicker_wisp", ["Mirage", "Spark"]); // Divine
    const wolf = fighter("moss_wolf", ["Slash"]);
    let dodged = 0, swings = 0;
    for (let n = 0; n < 200; n++) {
      const s = createBattle([{ ...sprite, maxHp: 999, hp: 999 }], [wolf]);
      resolveRound(s, { A: hit("Mirage"), B: hit("Slash") });
      resolveRound(s, { A: hit("Spark"), B: hit("Slash") });
      for (const e of s.log) if (e.type === "attack" && e.side === "B" && s.log.indexOf(e) > s.log.findIndex((x) => x.type === "effect")) {
        swings++;
        if (e.evaded) dodged++;
      }
    }
    expect(dodged / swings).toBeGreaterThan(0.2);
    expect(dodged / swings).toBeLessThan(0.4);
  });

  it("Corpsify: knocked out next round → back with 55% HP; then a 3-round cooldown", () => {
    const bones = fighter("rattlebones", ["Corpsify", "Slash"]);
    const brute = { ...fighter("dire_wolf", ["Devastator"]), maxHp: 999, hp: 999 };
    // Cast while healthy (the wolf is faster, so it hits first this round)…
    const s = createBattle([{ ...bones, maxHp: 400, hp: 400 }], [brute]);
    resolveRound(s, { A: hit("Corpsify"), B: hit("Devastator") });
    const me = s.sides.A.team[0];
    // …then it's knocked out next round, and rises again.
    me.hp = 5;
    s.sides.B.team[0].energy = 100;
    resolveRound(s, { A: hit("Slash"), B: hit("Devastator") });
    expect(me.hp).toBe(Math.round(me.maxHp * 0.55));
    expect(s.log.some((e) => e.type === "effect" && e.kind === "revive")).toBe(true);
    expect(s.winner).toBeNull();
    // Recharging for 3 rounds after it was cast (one has passed), then usable again.
    for (let r = 0; r < 2; r++) {
      expect(affordableSkills(me).map((x) => x.name)).not.toContain("Corpsify");
      me.energy = 100; me.hp = me.maxHp; s.sides.B.team[0].energy = 0;
      resolveRound(s, { A: hit("Slash"), B: { kind: "pass" } });
    }
    me.energy = 100;
    expect(affordableSkills(me).map((x) => x.name)).toContain("Corpsify");
  });

  it("Corpsify wears off after next round", () => {
    const bones = fighter("rattlebones", ["Corpsify", "Slash"]);
    const s = createBattle([bones], [fighter("moss_wolf", ["Jab"])]);
    resolveRound(s, { A: hit("Corpsify"), B: hit("Jab") });
    expect(s.sides.A.team[0].statuses.some((x) => x.id === "corpsify")).toBe(true);
    resolveRound(s, { A: hit("Slash"), B: hit("Jab") });
    expect(s.sides.A.team[0].statuses.some((x) => x.id === "corpsify")).toBe(false);
  });

  it("Barrage hits every enemy on the field", () => {
    const archer = fighter("thicket_archer", ["Barrage"]);
    const s = createBattle([archer], [fighter("moss_wolf", ["Jab"]), fighter("cave_bat", ["Flick"])]);
    s.sides.B.partner = 1;
    const rand = vi.spyOn(Math, "random").mockReturnValue(0.5); // no precise hits or dodges: both live to act
    resolveRound(s, { A: hit("Barrage"), B: hit("Jab") });
    rand.mockRestore();
    const targets = s.log.filter((e) => e.type === "attack" && e.side === "A").map((e) => e.type === "attack" && e.targetIndex);
    expect(targets.sort()).toEqual([0, 1]);
    expect(MOVE_BY_NAME.Barrage.race).toBe("humanoid");
  });
});

describe("saves from before the 3 starting moves", () => {
  it("a creature goes back to its starting 3 once, keeping what it learned", () => {
    const t = LIVE_BY_ID.moss_wolf;
    const c = { id: "x", dropType: "creature", creatureId: t.id, moves: ["Strike", "Gore", "Maul", "Lunge"], learned: ["Pounce"] } as CreatureOrItemDrop;
    expect(upgradeMoveSet(c, t)).toBe(true);
    expect(c.moves).toEqual(["Strike", "Gore", "Rush"]);
    expect(c.learned).toEqual(["Pounce"]);
    c.moves = ["Strike", "Gore", "Rush", "Pounce"];
    expect(upgradeMoveSet(c, t)).toBe(false); // only once
    expect(c.moves).toHaveLength(4);
  });

  it("new creatures are already on it; Klutz and the old species are left alone", () => {
    const fresh = makeCreatureDrop(LIVE_BY_ID.moss_wolf, "creature", "");
    expect(upgradeMoveSet(fresh, LIVE_BY_ID.moss_wolf)).toBe(false);
    const klutz = { id: "k", dropType: "creature", moves: ["Slash"] } as CreatureOrItemDrop;
    expect(upgradeMoveSet(klutz, KLUTZ)).toBe(false);
  });
});

describe("renamed moves", () => {
  it("the old Blink is Quickcast; Blink is now the Neutral priority magic move", () => {
    expect(renamedMove("Blink")).toBe("Quickcast");
    expect(renamedMove("Gore")).toBe("Gore");
    expect(MOVE_BY_NAME.Quickcast.effect?.kind).toBe("dash");
    expect(MOVE_BY_NAME.Blink.effect?.kind).toBe("quick");
    expect(RACE_CODEX_MOVES.map((m) => m.name)).not.toContain("Blink"); // so a Blink codex is always the old one
  });
});
