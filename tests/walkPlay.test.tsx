// @vitest-environment happy-dom
// The walk going on for the walk screen (hooks/useWalkPlay.ts, what the 3D view plays the game
// with, decision 38), in a pretend browser on the saved runs (tests/fixtures/walk): the sim's
// events reach the screen's callbacks (onEnter, onSpotted, onObject, onCage, onHeal, onKeep) as
// WalkView hands them on, a window over the walk (busy) holds you, and a flare lights afresh.
// The sim itself is pinned frame by frame in walkSim.test.ts; this is only the wiring.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "node:fs";
import path from "node:path";
import { useWalkPlay, type WalkPlay, type WalkPlayProps } from "@/hooks/useWalkPlay";
import { migrateWalkRun } from "@/lib/world/migrate";
import { walkRoom } from "@/lib/dungeon/walkRun";
import { dungeonOf, runPosition, type DungeonRun } from "@/lib/dungeon/run";
import { roomCentre, waysOn } from "@/lib/dungeon/layout";
import { FLARE_WALK } from "@/lib/dungeon/torch";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const fixture = (name: string): DungeonRun => migrateWalkRun(JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "walk", `${name}.json`), "utf8"))).run;

let clock = 0;
let root: Root | null = null, host: HTMLElement | null = null, W: WalkPlay | null = null;
function Probe(p: WalkPlayProps) { const w = useWalkPlay(p); useEffect(() => { W = w; }); return null; }
const calls = () => ({ onEnter: vi.fn(), onSpotted: vi.fn(), onObject: vi.fn(), onCage: vi.fn(), onHeal: vi.fn(), onKeep: vi.fn() });
function propsOf(run: DungeonRun, cb: ReturnType<typeof calls>, more: Partial<WalkPlayProps> = {}): WalkPlayProps {
  return { walk: run.walk!, map: run.map, dungeon: dungeonOf(run), here: runPosition(run), room: (id) => walkRoom(run, id), busy: false, scroll: false,
    team: [{ id: "a", name: "A", rarity: "common", creatureId: "x", maxHp: 10 }], hp: { a: 0.3 }, ...cb, ...more };
}
async function mount(p: WalkPlayProps) {
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<Probe {...p} />); });
  clock = performance.now(); // (the loop starts on the real clock: lib/world/walkSim.ts restartLoop)
}
const again = async (p: WalkPlayProps) => act(async () => { root!.render(<Probe {...p} />); });
afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); root = null; W = null; });
// Frames 16 ms apart until `done` (or `most` frames), as the screen's loop calls step.
async function frames(most: number, done: () => boolean = () => false) {
  for (let k = 0; k < most && !done(); k++) await act(async () => { W!.step((clock += 16)); });
}

describe("the walk going on, for the walk screen (hooks/useWalkPlay.ts)", () => {
  it("walking into a room ahead hands the screen onEnter, and leaving saves your walk (onKeep)", async () => {
    const run = fixture("encampment-fresh"), cb = calls();
    await mount(propsOf(run, cb));
    const way = waysOn(run.walk!.layout, { room: run.walk!.room, line: run.walk!.line ?? Infinity })[0];
    expect(way).toBeDefined();
    const c = roomCentre(run.walk!.layout.rooms[way.to.room]);
    W!.sim.known.fill(1); // (you only walk where you've seen)
    W!.tapAt({ x: Math.round(c.x), y: Math.round(c.y) });
    await frames(1500, () => cb.onEnter.mock.calls.length > 0 || cb.onSpotted.mock.calls.length > 0);
    const [id, st] = (cb.onEnter.mock.calls[0] ?? cb.onSpotted.mock.calls[0]) as [string, { at: { x: number; y: number } }];
    expect(id).toBe(way.to.room);
    expect(st.at).toBeDefined();
    await act(async () => root!.unmount()); root = null;
    expect(cb.onKeep).toHaveBeenCalled();
  });

  it("a window over the walk (busy) holds you: taps don't walk you", async () => {
    const run = fixture("encampment-mid"), cb = calls();
    await mount(propsOf(run, cb, { busy: true }));
    const at = { ...W!.sim.me };
    W!.tapAt({ x: Math.round(at.x) + 3, y: Math.round(at.y) });
    await frames(30);
    expect(W!.sim.me.path).toEqual([]);
    expect(W!.sim.goal).toBeNull();
    expect(cb.onEnter).not.toHaveBeenCalled();
  });

  it("standing by a campfire heals the team through onHeal", async () => {
    const run = fixture("encampment-mid"), cb = calls();
    const f = (run.walk!.fires ?? []).find((q) => q.left > 0);
    expect(f).toBeDefined();
    await mount(propsOf(run, cb));
    W!.sim.me = { x: f!.x, y: f!.y + 1, path: [] };
    await frames(200, () => cb.onHeal.mock.calls.length > 0);
    const [gains] = cb.onHeal.mock.calls[0] as [Record<string, number>];
    expect(gains.a).toBeGreaterThan(0);
  });

  it("a thing walked up to opens through the screen: a cage by onCage, a guarded one sets its guards on you, the rest by onObject", async () => {
    const seen = { cage: false, guarded: false, other: false };
    for (const name of ["encampment-fresh", "encampment-mid", "encampment-top", "cyclops-fresh", "cyclops-mid"]) {
      const run = fixture(name);
      for (const kind of ["cage", "guarded", "other"] as const) {
        if (seen[kind]) continue;
        const cb = calls();
        await mount(propsOf(run, cb));
        const t = W!.things().find((q) => !q.inert && !q.npc && (kind === "guarded" ? q.guarded : !q.guarded && (kind === "cage") === (q.cage !== undefined)));
        if (t) {
          // (Stood beside it, with it seen, then tapped.)
          W!.sim.known.fill(1);
          W!.sim.me = { x: t.x, y: t.y + 1, path: [] };
          W!.tapAt({ x: t.x, y: t.y });
          await frames(400, () => cb.onCage.mock.calls.length + cb.onObject.mock.calls.length > 0 || W!.sim.alarm !== null);
          if (kind === "guarded") { expect(W!.sim.alarm?.room, name).toBe(t.room); expect(cb.onObject).not.toHaveBeenCalled(); }
          else if (kind === "cage") expect(cb.onCage.mock.calls[0]?.slice(0, 2), name).toEqual([t.room, t.cage]);
          else expect(cb.onObject.mock.calls[0]?.[0], name).toBe(t.room);
          seen[kind] = true;
        }
        await act(async () => root!.unmount()); root = null; host?.remove();
      }
    }
    expect(seen).toEqual({ cage: true, guarded: true, other: true });
  });

  it("a new flare lights afresh", async () => {
    const run = fixture("encampment-mid"), cb = calls();
    await mount(propsOf(run, cb));
    W!.sim.flareLeft = 0;
    await again(propsOf({ ...run, walk: { ...run.walk!, flares: (run.walk!.flares ?? 0) + 1 } }, cb));
    expect(W!.sim.flareLeft).toBe(FLARE_WALK);
  });
});
