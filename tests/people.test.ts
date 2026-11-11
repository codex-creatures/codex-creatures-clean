import { describe, expect, it } from "vitest";
import { slowIt } from "./slow";
import { seeded } from "./walkBaseline";
import { startWalkRun, walkRoom, bookcasesIn } from "../lib/dungeon/walkRun";
import { WALK_ROOM_MIX, WALK_MYSTERY_MIX, rollBookcases, hasFight, BOOKCASE_SCROLLS, dungeonOf, type DungeonRun } from "../lib/dungeon/run";
import { layoutFloorplan, startProgress, EMPTY_SHAPES } from "../lib/dungeon/layout";
import { shutPlan } from "../lib/dungeon/torch";
import { roomAt } from "../lib/dungeon/walk";
import { codexRarityOf } from "../lib/drops";
import { PEOPLE, LOCATOR_PRICE, isPerson, hostile, locate, cutOff, stepWanderer, wandererOf, personLit, type Wanderer } from "../lib/dungeon/people";
import { newWalkRun } from "../lib/world/migrate";
import { placeWalk, BOOKCASE_DOOR_GAP } from "../lib/world/place";
import { placementsOfWalk } from "../lib/world/migrate";
import { roomIds, thingsOf } from "../lib/world/walkWorld";
import { WALK_V } from "../lib/world/version";
import { isLocator } from "../lib/items/materials";
import { createBattle, resolveRound } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { CREATURE_BY_ID as LIVE_BY_ID, PRE_V2_SPECIES } from "../lib/creatures/creatureData";

// People who wander (decision 39, the user, 2026-11-10; world version 9; the Cyclops first).

const cyclops = (seed: number): DungeonRun => newWalkRun(startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 1 }, 4, [], false, seeded(seed), 1));
const RUN = cyclops(7);
const room = (id: string) => walkRoom(RUN, id);

describe("people who wander", () => {
  it("the mixes: no witch, merchant or librarian rooms; each adds up to 100", () => {
    for (const mix of [WALK_ROOM_MIX, WALK_MYSTERY_MIX]) {
      expect(mix.reduce((s, [, n]) => s + n, 0)).toBe(100);
      expect(mix.some(([k]) => k === "witch" || k === "merchant" || k === "librarian")).toBe(false);
    }
  });

  it("a new Cyclops run: world version 9, 2 witches, a merchant and a librarian, each a room of their own off the scroll", () => {
    expect(RUN.walk!.v).toBe(WALK_V);
    const walk = RUN.walk!;
    expect(walk.people!.map((p) => p.kind).sort()).toEqual([...PEOPLE].sort());
    for (const id of Object.keys(walk.layout.rooms)) expect(["witch", "merchant", "librarian"]).not.toContain(RUN.map.nodes[id].kind);
    const plan = layoutFloorplan(walk.layout);
    const library = Object.keys(walk.layout.rooms).find((id) => RUN.map.nodes[id].kind === "library");
    for (const p of walk.people!) {
      expect(isPerson(p.id)).toBe(true);
      expect(RUN.map.nodes[p.id]).toMatchObject({ kind: p.kind, hidden: true, links: [] });
      expect(room(p.id)?.kind).toBe(p.kind);
      // Starting in a room with no creatures in it, never the lair (the librarian in the library, if there is one).
      expect(roomAt(plan, p.at)).toBe(p.room);
      expect(p.room).not.toBe(walk.layout.boss);
      expect(hostile(p.room, room)).toBe(false);
      if (p.kind === "librarian" && library) expect(p.room).toBe(library);
    }
    // The merchant has a locator on his cart, at 200 gold.
    const wares = room(walk.people!.find((p) => p.kind === "merchant")!.id)!.wares!;
    expect(wares.filter((w) => "tool" in w && isLocator(w.tool)).map((w) => w.price)).toEqual([LOCATOR_PRICE]);
  });

  it("they wander off through the dungeon, never into a room with creatures, and stop when cut off", () => {
    const walk = RUN.walk!, layout = walk.layout, plan = layoutFloorplan(layout), p = startProgress(layout);
    const live = shutPlan(plan, layout, p), rng = seeded(3);
    let people: Wanderer[] = walk.people!.map(wandererOf);
    const bad: string[] = [], rooms = new Map<string, Set<string>>();
    for (let t = 0; t < 1200; t++) {        // two minutes, a tenth of a second at a time
      people = people.map((w) => stepWanderer(plan, live, layout, p, w, 0.1, room, rng));
      for (const w of people) {
        const r = roomAt(plan, { x: w.x, y: w.y });
        if (r && hostile(r, room)) bad.push(`${w.id} in ${r} at ${t}`);
        if (r) rooms.set(w.id, (rooms.get(w.id) ?? new Set()).add(r));
      }
    }
    expect(bad).toEqual([]);
    // Each has been in more than one room.
    expect([...rooms.values()].filter((s) => s.size > 1).length).toBeGreaterThanOrEqual(3);
    // Cut off: their room behind you (a progress line below the whole map), they stop for good.
    const behind = { room: layout.boss, line: -1 };
    const w = stepWanderer(plan, live, layout, behind, people[0], 0.1, room, rng);
    expect(w.stopped).toBe(true);
    expect(stepWanderer(plan, live, layout, p, w, 5, room, rng)).toEqual(w);
  });

  it("locators find the merchant, the librarian, or the closest witch you can reach and haven't played; none if they're cut off", () => {
    const walk = RUN.walk!, layout = walk.layout, plan = layoutFloorplan(layout), p = startProgress(layout), live = shutPlan(plan, layout, p);
    const people = walk.people!, witches = people.filter((q) => q.kind === "witch");
    expect(locate("merchant_map", people, walk.at, layout, live, p, room)?.kind).toBe("merchant");
    expect(locate("librarian_locator", people, walk.at, layout, live, p, room)?.kind).toBe("librarian");
    const near = (q: { at: { x: number; y: number } }) => Math.hypot(q.at.x - walk.at.x, q.at.y - walk.at.y);
    expect(locate("crystal_ball", people, walk.at, layout, live, p, room)?.id).toBe([...witches].sort((a, b) => near(a) - near(b))[0].id);
    // The closer one cut off: the other.
    const [close, far] = [...witches].sort((a, b) => near(a) - near(b));
    expect(locate("crystal_ball", people.map((q) => (q.id === close.id ? { ...q, stopped: true as const } : q)), walk.at, layout, live, p, room)?.id).toBe(far.id);
    // The closer one played (won, lost or walked away from): the other; both played, none.
    const played = (ids: string[]) => (id: string) => { const r = room(id); return r && ids.includes(id) ? { ...r, done: true } : r; };
    expect(locate("crystal_ball", people, walk.at, layout, live, p, played([close.id]))?.id).toBe(far.id);
    expect(locate("crystal_ball", people, walk.at, layout, live, p, played([close.id, far.id]))).toBeNull();
    const gone = people.map((q) => ({ ...q, stopped: true as const }));
    expect(locate("merchant_map", gone, walk.at, layout, live, p, room)).toBeNull();
    expect(cutOff(layout, live, p, gone[0])).toBe(true);
  });

  it("a witch's candle goes out once she's been played", () => {
    const id = RUN.walk!.people!.find((q) => q.kind === "witch")!.id, r = room(id)!;
    expect(personLit("witch", r)).toBe(true);
    expect(personLit("witch", { ...r, done: true })).toBe(false);
    expect(personLit("witch", { ...r, witch: { ...r.witch!, state: "lost" } })).toBe(false);
    expect(personLit("merchant", undefined)).toBe(true);
  });

  it("they're things to tap, where they stand; a library's lectern and bookcases, and a campfire's stash, are placed", () => {
    const walk = RUN.walk!, map = RUN.map;
    const placed = placementsOfWalk(walk, map, 1, room);
    const things = thingsOf(walk.layout, placed, roomIds(walk.layout, map), room, placed.witches, walk.spots, 1, walk.people!.map(wandererOf));
    for (const q of walk.people!) expect(things.find((t) => t.key === q.id)).toMatchObject({ x: q.at.x, y: q.at.y, npc: true, def: q.kind === "witch" ? "witch" : `${q.kind}-walk` });
    for (const id of Object.keys(walk.layout.rooms)) {
      const r = room(id);
      if (!r) continue; // (the entrance holds nothing)
      if (r.kind === "library") {
        expect(r).toMatchObject({ lectern: true });
        expect(r.sack).toBeUndefined();
        expect(things.some((t) => t.room === id && t.def === "lectern")).toBe(true);
        const cases = bookcasesIn(map, id);
        expect(cases.length).toBeGreaterThanOrEqual(3);
        for (const b of cases) expect(things.find((t) => t.key === b)).toMatchObject({ def: "bookcase", room: b });
      }
      if (r.kind === "campfire" && r.sack) expect(things.some((t) => t.room === id && t.def === "sack")).toBe(true);
      if (EMPTY_SHAPES.includes(walk.layout.rooms[id].shape) && r.kind === "empty") expect(r.done).toBe(true);
    }
  });

  // (A dozen Cyclops layouts take seconds: test:all runs it.)
  slowIt("over many runs: about half the campfires have a stash, and a fifth of the small rooms are empty", () => {
    let fires = 0, stashes = 0, small = 0, empty = 0, libraries = 0, librarianThere = 0;
    for (let s = 1; s <= 12; s++) {
      const run = startWalkRun(["a"], ["a"], { a: 1 }, 4, [], false, seeded(s * 31), 1);
      const walk = run.walk!;
      for (const id of Object.keys(walk.layout.rooms)) {
        const r = walk.rooms[id] ?? run.current;
        if (r?.kind === "campfire") { fires++; if (r.sack) stashes++; }
        if (EMPTY_SHAPES.includes(walk.layout.rooms[id].shape) && id !== walk.layout.start) { small++; if (r?.kind === "empty") empty++; }
        if (r?.kind === "library") { libraries++; if (walk.people!.find((q) => q.kind === "librarian")!.room === id) librarianThere++; }
      }
      // Nobody starts where there are creatures.
      for (const q of walk.people!) expect(hostile(q.room, (k) => walk.rooms[k]), `seed ${s} ${q.id}`).toBe(false);
      for (const q of walk.people!) expect(hasFight(walk.rooms[q.id])).toBe(false);
    }
    expect(stashes / fires).toBeGreaterThan(0.25);
    expect(stashes / fires).toBeLessThan(0.75);
    expect(empty / small).toBeGreaterThan(0.08);
    expect(empty / small).toBeLessThan(0.35);
    expect(librarianThere).toBe(libraries);
  }, 180_000); // (the Cyclops's 60-room layouts, 2026-11-11: about 3 s each to roll)
});

describe("a library's broken bookcases", () => {
  // (World version 10, the user's play-test, 2026-11-11: one stood in front of a tunnel. Seed 4's library has a door in its top wall.)
  it("stand clear of the library's doorways", () => {
    const run = cyclops(4), walk = run.walk!;
    expect(walk.v).toBeGreaterThanOrEqual(10);
    const plan = layoutFloorplan(walk.layout);
    const { placed } = placeWalk(walk, run.map, dungeonOf(run), (id) => walkRoom(run, id));
    const libraries = Object.keys(walk.layout.rooms).filter((id) => walkRoom(run, id)?.kind === "library");
    expect(libraries.length).toBeGreaterThan(0);
    for (const id of libraries) {
      const rects = plan.rooms[id];
      const inside = (x: number, y: number) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
      const doors = plan.doors.filter((d) => d.room === id).flatMap((d) => [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: d.x + dx, y: d.y + dy })).filter((q) => inside(q.x, q.y)));
      const cases = placed.filter((q) => q.def === "bookcase" && q.room.startsWith(`${id}~b`));
      expect(cases.length).toBe(bookcasesIn(run.map, id).length);
      for (const c of cases) {
        const at = { x: Math.floor(c.sx / 3), y: Math.floor(c.sy / 3) };
        for (const d of doors) expect(Math.max(Math.abs(at.x - d.x), Math.abs(at.y - d.y)), `${c.id} by the door at ${d.x},${d.y}`).toBeGreaterThan(BOOKCASE_DOOR_GAP);
      }
    }
  });

  it("3–5 a library; only codexes (never Legendary) and clairvoyance scrolls, at most 2 scrolls; about 30% hold no codex", () => {
    const rng = seeded(11);
    let cases = 0, noCodex = 0, codexes = 0, epic = 0;
    for (let i = 0; i < 2000; i++) {
      const lib = rollBookcases(rng);
      expect(lib.length).toBeGreaterThanOrEqual(3);
      expect(lib.length).toBeLessThanOrEqual(5);
      let scrolls = 0;
      for (const b of lib) {
        cases++;
        expect(b.kind).toBe("bookcase");
        const items = (b.sack ?? []).map((x) => ("gear" in x ? (x.gear as { codexMove?: string; tool?: string; rarity?: string }) : null));
        const books = items.filter((d) => d?.codexMove);
        scrolls += items.filter((d) => d?.tool === "clairvoyance").length;
        expect(items.every((d) => d && (d.codexMove || d.tool === "clairvoyance"))).toBe(true);
        expect(books.length).toBeLessThanOrEqual(2);
        if (books.length === 0) noCodex++;
        codexes += books.length;
        for (const d of books) { expect(d!.rarity).not.toBe("legendary"); expect(codexRarityOf(d!.codexMove!)).toBe(d!.rarity); if (d!.rarity === "epic") epic++; }
      }
      expect(scrolls).toBeLessThanOrEqual(BOOKCASE_SCROLLS);
    }
    expect(noCodex / cases).toBeGreaterThan(0.26);
    expect(noCodex / cases).toBeLessThan(0.34);
    // Epic is 9 + 1 (Legendary's) in 100 of the codexes.
    expect(epic / codexes).toBeGreaterThan(0.08);
    expect(epic / codexes).toBeLessThan(0.12);
  });
});

describe("stacked illnesses in a fight (decision 39)", () => {
  it("each illness on a creature bites every round on its own, and wears off on its own", () => {
    const CREATURES = { ...LIVE_BY_ID, ...PRE_V2_SPECIES };
    const me = buildFighter(CREATURES.moss_wolf, {}, {}, ["Slash"]);
    const foe = buildFighter(CREATURES.cave_bat, {}, {}, ["Flick"]);
    const s = createBattle([me], [foe]);
    const f = s.sides.A.team[0];
    f.statuses.push({ id: "illness", rounds: 1, dmg: 7 }, { id: "illness", rounds: 2, dmg: 7 });
    const round = () => {
      const from = s.log.length;
      resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: { kind: "attack", skillName: "Flick" } });
      return s.log.slice(from).filter((e) => e.type === "effect" && e.kind === "illness" && e.side === "A").map((e) => (e as { damage?: number }).damage);
    };
    expect(round()).toEqual([7, 7]);
    expect(f.statuses.filter((x) => x.id === "illness").map((x) => x.rounds)).toEqual([1]);
    expect(round()).toEqual([7]);
    expect(f.statuses.some((x) => x.id === "illness")).toBe(false);
  });
});
