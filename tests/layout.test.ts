import { describe, expect, it } from "vitest";
import { checkFloorplan, ROCK, TUNNEL, type Floorplan } from "../lib/dungeon/floorplan";
import {
  rollLayout, WALK_SPEC, routesToBoss, ROUTES, layoutFloorplan, layoutMap, campMap, scrollMarks, foreseen, cutOffY, SCROLL_MARKS, type ScrollMark, routeProblems, waysOn, enter, startProgress, isOpen, stepRule, floorsOf, roomCentre, fewChoices,
  SHAPES, START_SHAPE, BOSS_SHAPE, LAYOUT_W, EDGE, TUNNEL_W, TWIN_PILLAR, BOSS_WAYS, BOSS_DRIFT, type Layout, type Tunnel,
} from "../lib/dungeon/layout";
import { findPath } from "../lib/dungeon/walk";
import { CAMP_STASH_MARKS } from "../lib/dungeon/map";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// (Cached: a layout takes a few hundred ms to roll. Tests that change one copy it first.)
const rolled = new Map<number, Layout>();
const encampment = (seed: number) => rolled.get(seed) ?? rolled.set(seed, rollLayout(WALK_SPEC, seeded(seed))).get(seed)!;
const middle = (l: Layout, id: string) => roomCentre(l.rooms[id]);

// A made-up layout (blocks): the entrance, a room above it, a room beside
// that, and the boss on top. Tunnel rects don't matter to the route rules.
function tiny(tunnels: [string, string, boolean][]): Layout {
  const room = (id: string, x: number, y: number, w: number, h: number) => ({ id, shape: id, x, y, w, h });
  const t = ([a, b, up]: [string, string, boolean]): Tunnel => ({ key: `${a}|${b}`, a, b, up, rect: { x: 0, y: 0, w: 1, h: 1 } });
  return {
    w: 20, h: 20, start: "start", boss: "boss",
    rooms: { start: room("start", 0, 15, 12, 3), a: room("a", 0, 9, 5, 5), b: room("b", 7, 9, 5, 5), boss: room("boss", 0, 2, 10, 5) },
    tunnels: tunnels.map(t),
  };
}

describe("labyrinth layout (gen 1 and 2)", () => {
  it("rolls sound Encampments: the rooms fit, the tunnels join the right rooms, no traps, a long enough route", () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const l = encampment(seed);
      const tag = (p: string) => `seed ${seed}: ${p}`;
      problems.push(...routeProblems(l, WALK_SPEC.minRoute).map(tag));
      problems.push(...checkFloorplan(layoutFloorplan(l), layoutMap(l)).map(tag));
      if (Object.keys(l.rooms).length !== WALK_SPEC.rooms + 2) problems.push(tag(`${Object.keys(l.rooms).length} rooms`));
      const sizes = [...SHAPES, START_SHAPE, BOSS_SHAPE];
      for (const r of Object.values(l.rooms)) {
        if (!sizes.some((s) => s.name === r.shape && s.w === r.w && s.h === r.h)) problems.push(tag(`${r.id} is ${r.w}×${r.h}`));
        if (r.x < EDGE || r.x + r.w > EDGE + LAYOUT_W) problems.push(tag(`${r.id} sticks out`));
      }
      for (const t of l.tunnels) if ((t.up ? t.rect.w : t.rect.h) !== TUNNEL_W) problems.push(tag(`${t.key} isn't ${TUNNEL_W} wide`));
    }
    expect(problems).toEqual([]);
  });

  // The tile check itself must catch a broken plan.
  it("the tile check catches a hole in a wall and a blocked tunnel", () => {
    const l = encampment(2);
    const sound = layoutFloorplan(l), map = layoutMap(l);
    const copy = (): Floorplan => ({ ...sound, tiles: sound.tiles.slice() });
    // A hole in the rock beside a tunnel's door: the tunnel opens into the room off its door.
    const holed = copy();
    const t = l.tunnels.find((t) => t.up)!;
    holed.tiles[(t.rect.y + 1) * holed.w + t.rect.x - 1] = TUNNEL; // just outside the tunnel, below the top door
    holed.tiles[t.rect.y * holed.w + t.rect.x - 1] = TUNNEL;       // …and through the upper room's wall
    expect(checkFloorplan(holed, map)).not.toEqual([]);
    // A rockfall across the middle of a tunnel: it no longer joins its two rooms.
    const blocked = copy();
    const midY = t.rect.y + Math.floor(t.rect.h / 2);
    for (let x = t.rect.x; x < t.rect.x + t.rect.w; x++) blocked.tiles[midY * blocked.w + x] = ROCK;
    expect(checkFloorplan(blocked, map)).not.toEqual([]);
    expect(checkFloorplan(sound, map)).toEqual([]);
  });

  it("is the same layout for the same roll", () => {
    expect(rollLayout(WALK_SPEC, seeded(5))).toEqual(encampment(5));
  });

  it("only goes up an up tunnel, and closes what's behind", () => {
    const l = tiny([["start", "a", true], ["a", "b", false], ["b", "boss", true]]);
    // (Sound but for its single ways out, in and on: a real layout needs 2.)
    expect(routeProblems(l, 3).filter((p) => !p.includes(" ways ") && !p.includes("one way on"))).toEqual([]);
    const p = startProgress(l);
    expect(waysOn(l, p).map((w) => w.to.room)).toEqual(["a"]);
    const inA = enter(l, p, "a");
    expect(inA.line).toBe(14); // a's bottom
    expect(isOpen(l, inA, "start")).toBe(false);
    // Sideways both ways, but never back down.
    expect(waysOn(l, inA).map((w) => w.to.room)).toEqual(["b"]);
    const inB = enter(l, inA, "b");
    expect(inB.line).toBe(14); // sideways doesn't move the line
    expect(waysOn(l, inB).map((w) => w.to.room).sort()).toEqual(["a", "boss"]);
    expect(enter(l, inB, "start")).toEqual(inB); // no way back
  });

  it("the check catches a trap and a room you can't reach", () => {
    // Up into a with nowhere on from it.
    const trap = tiny([["start", "a", true], ["start", "b", true], ["b", "boss", true]]);
    expect(routeProblems(trap, 0).some((p) => p.startsWith("stuck in a"))).toBe(true);
    // b only joins the boss: you never get into it.
    const lost = tiny([["start", "a", true], ["a", "boss", true], ["b", "boss", false]]);
    expect(routeProblems(lost, 0)).toContain("b can't be reached");
  });

  it("walking: through an up tunnel, then no way back down", () => {
    const l = encampment(3);
    const fp = layoutFloorplan(l);
    const up = l.tunnels.find((t) => t.up && t.a === l.start)!;
    const there = middle(l, up.b);
    const start = middle(l, l.start);
    const path = findPath(fp, start, there, stepRule(l, fp, startProgress(l)));
    expect(path).not.toBeNull();
    const after = enter(l, startProgress(l), up.b);
    expect(findPath(fp, there, start, stepRule(l, fp, after))).toBeNull();
    // Not even into the tunnel's top door from the room above.
    const door = { x: up.rect.x + 1, y: up.rect.y };
    expect(stepRule(l, fp, after)({ x: door.x, y: door.y - 1 }, door)).toBe(false);
  });
});

describe("labyrinth layout (gen 3: what's in each room)", () => {
  it("fills an Encampment like the live one: dens and stashes, never two stashes side by side, one chest, the camp on top", () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const l = encampment(seed);
      const map = campMap(l, seed % 3 === 0, seeded(seed + 100));
      const tag = (p: string) => `seed ${seed}: ${p}`;
      const nodes = Object.values(map.nodes);
      if (map.nodes[l.start].kind !== (seed % 3 === 0 ? "treasure" : "entrance")) problems.push(tag(`start is ${map.nodes[l.start].kind}`));
      if (map.nodes[l.boss].kind !== "encampment" || !map.nodes[l.boss].large) problems.push(tag("no camp on top"));
      const rest = nodes.filter((n) => n.id !== l.start && n.id !== l.boss);
      const odd = rest.filter((n) => !["easy", "stash", "chest"].includes(n.kind));
      if (odd.length > 0) problems.push(tag(`odd rooms: ${odd.map((n) => n.kind).join(", ")}`));
      const chests = rest.filter((n) => n.kind === "chest");
      if (chests.length !== 1 || !chests[0].hidden) problems.push(tag(`${chests.length} chests`));
      const stashes = rest.filter((n) => n.kind === "stash");
      if (stashes.length === 0) problems.push(tag("no stash"));
      if (stashes.filter((n) => n.known && n.pinned).length !== Math.min(stashes.length, CAMP_STASH_MARKS)) problems.push(tag("stash marks"));
      for (const n of stashes) if (n.links.some((o) => map.nodes[o].kind === "stash")) problems.push(tag(`stashes side by side at ${n.id}`));
    }
    expect(problems).toEqual([]);
  });

  it("is the same fill for the same roll", () => {
    expect(campMap(encampment(4), false, seeded(9))).toEqual(campMap(encampment(4), false, seeded(9)));
  });
});

describe("labyrinth layout: the scroll", () => {
  it("shows a mark per room: icons for what you know, ? for the rest, the hidden ones only once you've been in", () => {
    const l = encampment(6);
    const map = campMap(l, false, seeded(11));
    const fresh = scrollMarks(map, l, [l.start], l.start);
    expect(fresh.length).toBe(Object.keys(l.rooms).length);
    expect(fresh.every((m) => m.x > 0 && m.x < 1 && m.y > 0 && m.y < 1)).toBe(true);
    expect(fresh.filter((m) => m.here).map((m) => m.id)).toEqual([l.start]);
    const shown = (marks: ScrollMark[], id: string) => marks.find((m) => m.id === id)!.kind;
    expect(shown(fresh, l.start)).toBe("entrance");
    expect(shown(fresh, l.boss)).toBe("encampment");
    for (const n of Object.values(map.nodes)) if (n.id !== l.start && n.id !== l.boss) {
      expect(shown(fresh, n.id)).toBe(n.known && !n.hidden ? n.kind : null);
    }
    const chest = Object.values(map.nodes).find((n) => n.kind === "chest")!;
    expect(shown(fresh, chest.id)).toBeNull();
    expect(shown(scrollMarks(map, l, [l.start, chest.id], chest.id), chest.id)).toBe("chest");
    // Some rooms are still a "?" (it's a guide, not the answer).
    expect(fresh.some((m) => m.kind === null)).toBe(true);
  });

  it("marks what a clairvoyance scroll looked into (even the hidden chest) and the rooms joined to it, but no mysteries or hidden ones beside it", () => {
    const l = encampment(6);
    const map = campMap(l, false, seeded(11));
    const chest = Object.values(map.nodes).find((n) => n.kind === "chest")!;
    const near = (id: string) => l.tunnels.flatMap((t) => (t.a === id ? [t.b] : t.b === id ? [t.a] : []));
    const shown = foreseen(map, l, [chest.id], [chest.id]);
    expect(shown.has(chest.id)).toBe(true);
    for (const id of near(chest.id)) expect(shown.has(id)).toBe(!map.nodes[id].mystery && !map.nodes[id].hidden);
    expect([...shown].every((id) => id === chest.id || near(chest.id).includes(id))).toBe(true);
    const marks = scrollMarks(map, l, [l.start], l.start, shown);
    expect(marks.find((m) => m.id === chest.id)!.kind).toBe("chest");
    // A flare (lit, not seen) shows only the rooms joined to where you stand.
    expect(foreseen(map, l, [l.start]).has(l.start)).toBe(false);
  });
});

describe("labyrinth layout: the scroll's marks and cut-offs", () => {
  it("marks only 3–4 rooms from the start (the marked stashes counted in)", () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const map = campMap(encampment(seed), false, seeded(seed + 300));
      counts.add(Object.values(map.nodes).filter((n) => n.known).length);
    }
    expect([...counts].every((n) => SCROLL_MARKS[0] <= n && n <= SCROLL_MARKS[1])).toBe(true);
  });

  it("draws a cut-off along the bottom of the room you came up into", () => {
    const l = encampment(3);
    const up = l.tunnels.find((t) => t.up && t.a === l.start)!;
    const above = l.rooms[up.b];
    const y = cutOffY(enter(l, startProgress(l), up.b));
    expect(y).toBe((above.y + above.h) * 3);
    // …below the room's floor, above the room you left.
    expect(Math.max(...floorsOf(above).map((f) => f.y + f.h))).toBeLessThan(y + 1);
    expect(y).toBeLessThanOrEqual(Math.min(...floorsOf(l.rooms[l.start]).map((f) => f.y)));
  });
});

describe("labyrinth layout: variety (the user, 2026-11-05)", () => {
  it("never leaves you just one way on: two tunnels up, or sideways to a room that leads on", () => {
    // tiny(): start → a (up), a ↔ b (sideways), b → boss (up).
    const l = tiny([["start", "a", true], ["a", "b", false], ["b", "boss", true]]);
    expect(fewChoices(l)).toEqual(["start", "a"]); // one way on from each (b opens into the boss: its last step is choice enough)
    // A way up from a too: a and b each have two ways on, but the entrance's
    // twin tunnels both lead to a, which is one choice (the user, 2026-11-05).
    const twin = tiny([["start", "a", true], ["start", "a", true], ["a", "b", false], ["a", "boss", true], ["b", "boss", true]]);
    twin.tunnels[1].key += "#2";
    expect(fewChoices(twin)).toEqual(["start"]);
    // Sideways into a dead end isn't a way on: b leads only back to a.
    const dead = tiny([["start", "a", true], ["start", "a", true], ["a", "b", false], ["a", "boss", true]]);
    dead.tunnels[1].key += "#2";
    expect(fewChoices(dead)).toEqual(["start", "b"]);
  });

  it("no choke points: 3 ways to the boss that share no room (the user, 2026-11-05)", () => {
    // tiny(): start → a → boss and start → b → boss: two ways, but nothing a third could take.
    const two = tiny([["start", "a", true], ["start", "b", true], ["a", "boss", true], ["b", "boss", true]]);
    expect(routesToBoss(two)).toBe(2);
    // Both through a: one way, however many tunnels.
    const one = tiny([["start", "a", true], ["start", "a", true], ["a", "b", false], ["a", "boss", true], ["b", "boss", true]]);
    one.tunnels[1].key += "#2";
    expect(routesToBoss(one)).toBe(1);
    // Every rolled one: no room, or pair of rooms, cuts every way.
    for (let seed = 1; seed <= 12; seed++) expect(routesToBoss(encampment(seed))).toBe(ROUTES);
    expect(ROUTES).toBeGreaterThanOrEqual(3);
  });

  it("rolls rooms about 4 across the middle, more tunnels up than sideways, 3 ways into the boss, long tunnels, twins far apart, dog-legs", () => {
    let across = 0, long = 0, twins = 0, legs = 0, sideways = 0, ups = 0;
    const problems: string[] = [];
    const N = 20;
    for (let seed = 1; seed <= N; seed++) {
      const l = encampment(seed);
      const rooms = Object.values(l.rooms).filter((r) => r.id !== l.start && r.id !== l.boss);
      const mid = (Math.min(...rooms.map((r) => r.y)) + Math.max(...rooms.map((r) => r.y + r.h))) / 2;
      across += rooms.filter((r) => r.y <= mid + 3 && r.y + r.h >= mid - 3).length; // (a band a room tall: they're staggered)
      long += l.tunnels.filter((t) => (t.up ? t.rect.h : t.rect.w) - 2 > 3 * 3).length; // past the old 3 blocks
      legs += rooms.filter((r) => r.cut).length;
      sideways += l.tunnels.filter((t) => !t.up).length;
      ups += l.tunnels.filter((t) => t.up).length;
      // Twins: only up, never side by side.
      for (const t of l.tunnels.filter((t) => t.key.endsWith("#2"))) {
        twins++;
        const first = l.tunnels.find((f) => f.key === t.key.slice(0, -2)); // (gone if it was dropped)
        if (!t.up) problems.push(`seed ${seed}: a sideways twin`);
        if (first && Math.abs(t.rect.x - first.rect.x) < TUNNEL_W + TWIN_PILLAR) problems.push(`seed ${seed}: twins side by side`);
      }
      const into = new Set(l.tunnels.flatMap((t) => (t.a === l.boss ? [t.b] : t.b === l.boss ? [t.a] : [])));
      if (into.size < BOSS_WAYS) problems.push(`seed ${seed}: ${into.size} rooms into the boss`);
      // The boss's room in the middle (the user, 2026-11-05).
      const boss = l.rooms[l.boss];
      if (Math.abs(boss.x + boss.w / 2 - l.w / 2) > BOSS_DRIFT + 1) problems.push(`seed ${seed}: the boss is off to one side`);
    }
    expect(problems).toEqual([]);
    expect(BOSS_WAYS).toBeGreaterThanOrEqual(3);
    expect(across / N).toBeGreaterThanOrEqual(4);
    expect(ups).toBeGreaterThan(sideways);
    expect(long).toBeGreaterThan(0);
    expect(twins).toBeGreaterThan(0);
    expect(legs / N).toBeGreaterThanOrEqual(0.5);
    expect(sideways / N).toBeGreaterThanOrEqual(6);
  });

  it("a dog-leg is an L: two arms meeting at its middle, rock in the missing corner", () => {
    let seed = 1, l = encampment(seed);
    while (!Object.values(l.rooms).some((r) => r.cut)) l = encampment(++seed);
    const r = Object.values(l.rooms).find((r) => r.cut)!;
    const fp = layoutFloorplan(l);
    const arms = floorsOf(r);
    expect(arms.length).toBe(2);
    const c = roomCentre(r);
    for (const f of arms) expect(c.x >= f.x && c.x < f.x + f.w && c.y >= f.y && c.y < f.y + f.h).toBe(true);
    // The missing corner's middle (well inside the box, away from the arms) is rock.
    const corner = { x: (r.cut![1] === "e" ? r.x + r.w - 2 : r.x + 2) * 3, y: (r.cut![0] === "n" ? r.y + 2 : r.y + r.h - 2) * 3 };
    expect(fp.tiles[corner.y * fp.w + corner.x]).toBe(ROCK);
  });
});
