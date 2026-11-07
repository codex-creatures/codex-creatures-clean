"use client";
// app/lab/baseline/page.tsx — fixed scenes of the walk view (components/WalkView.tsx),
// for the world architecture's visual baseline (docs/world-spec.md §8): the
// saved runs of tests/fixtures/walk, with you stood at a chosen spot, frozen
// (busy) so nothing moves. Screenshot each (?s=<scene>) before and after a
// phase to compare by eye. Dev tool: nothing is saved, nothing is played out.

import { use } from "react";
import WalkView from "@/components/WalkView";
import { walkRoom } from "@/lib/dungeon/walkRun";
import { dungeonOf, type DungeonRun } from "@/lib/dungeon/run";
import { layoutFloorplan, roomCentre } from "@/lib/dungeon/layout";
import { FLOOR, type Pt } from "@/lib/dungeon/floorplan";
import encampmentFresh from "../../../tests/fixtures/walk/encampment-fresh.json";
import encampmentMid from "../../../tests/fixtures/walk/encampment-mid.json";
import encampmentOld from "../../../tests/fixtures/walk/encampment-before-pillars.json";
import cyclopsFresh from "../../../tests/fixtures/walk/cyclops-fresh.json";
import cyclopsMid from "../../../tests/fixtures/walk/cyclops-mid.json";
import { walkSetup } from "../../../tests/walkBaseline"; // (where the walk view puts foes and the witch: the same calls)

const TEAM = [
  { id: "a", name: "Moss Wolf", rarity: "uncommon" as const, creatureId: "moss_wolf", maxHp: 60 },
  { id: "b", name: "Amber Wasp", rarity: "common" as const, creatureId: "amber_wasp", maxHp: 40 },
];

type Scene = { run: DungeonRun; at?: (run: DungeonRun) => Pt | null; all?: boolean; decor?: boolean; scroll?: boolean; note: string };
const fx = (j: unknown) => j as DungeonRun;

// Spots to stand at.
const plan = (run: DungeonRun) => layoutFloorplan(run.walk!.layout);
const floor = (run: DungeonRun, q: Pt) => { const p = plan(run); return p.tiles[q.y * p.w + q.x] === FLOOR; };
const centreOf = (run: DungeonRun, id: string) => roomCentre(run.walk!.layout.rooms[id]);
const byPillar = (run: DungeonRun) => {
  const r = Object.values(run.walk!.layout.rooms).find((q) => q.inner && q.id !== run.walk!.layout.boss);
  const q = r?.inner?.[0];
  if (!q) return null;
  return [{ x: q.x - 1, y: q.y + q.h }, { x: q.x + q.w, y: q.y + q.h }, { x: q.x - 1, y: q.y - 1 }].find((s) => floor(run, s)) ?? null;
};
// Just below someone: a room's foes (the first room with two or more), a waiting boss, the witch.
const below = (q: Pt | undefined, by = 2) => (q ? { x: Math.round(q.x), y: Math.round(q.y) + by } : null);
const inFight = (run: DungeonRun) => {
  const foes = walkSetup(run).foes.filter((f) => !f.waits);
  const room = foes.find((f) => foes.filter((g) => g.room === f.room).length >= 2)?.room;
  return below(foes.find((f) => f.room === room));
};
const byBoss = (run: DungeonRun) => below(walkSetup(run).foes.find((f) => f.waits), 3);
const byWitch = (run: DungeonRun) => below(walkSetup(run).npcs[0]);
const bySouthWall = (run: DungeonRun) => {
  const p = plan(run);
  const id = Object.values(run.walk!.layout.rooms).find((r) => r.shape === "big" || r.shape === "large")?.id;
  const f = id ? p.rooms[id][0] : null;
  return f ? { x: f.x + Math.floor(f.w / 2), y: f.y + f.h - 1 } : null;
};
const byFire = (run: DungeonRun) => { const f = run.walk!.fires?.[0]; return f ? { x: f.x, y: f.y + 2 } : null; };
const inKind = (kind: string) => (run: DungeonRun) => {
  const id = Object.keys(run.map.nodes).find((k) => run.map.nodes[k].kind === kind && run.walk!.layout.rooms[k]);
  return id ? { ...centreOf(run, id), y: centreOf(run, id).y + 2 } : null;
};

const SCENES: Record<string, Scene> = {
  "enc-entrance": { run: fx(encampmentFresh), note: "the Encampment's entrance at the start: wall torches, the dark" },
  "enc-midrun": { run: fx(encampmentMid), note: "part-way, as saved: rubble behind, torches lit, what you've seen" },
  "enc-midrun-decor": { run: fx(encampmentMid), decor: true, note: "the same, with the lab's decor" },
  "enc-scroll": { run: fx(encampmentMid), scroll: true, note: "the scroll part-way (red lines across fallen tunnels)" },
  "enc-pillar": { run: fx(encampmentFresh), at: byPillar, all: true, note: "beside a lone pillar" },
  "enc-foes": { run: fx(encampmentFresh), at: inFight, all: true, note: "in a room of foes, by torchlight" },
  "enc-south-wall": { run: fx(encampmentFresh), at: bySouthWall, all: true, note: "behind a south wall (it goes see-through)" },
  "enc-chief": { run: fx(encampmentFresh), at: byBoss, all: true, note: "the chief's camp: the chief, cages, pillars down the sides" },
  "enc-campfire": { run: fx(encampmentFresh), at: byFire, all: true, note: "by a campfire" },
  "enc-candle": { run: fx(encampmentMid), at: (run) => { const id = run.walk!.lit?.find((l) => l.startsWith("candle:")); return id ? centreOf(run, id.slice(7)) : null; }, all: true, note: "by a lit candle" },
  "enc-before-pillars": { run: fx(encampmentOld), note: "a run from before pillars (bigger rooms), as saved" },
  "cyc-midrun": { run: fx(cyclopsMid), note: "the Cyclops's dungeon part-way, as saved" },
  "cyc-boss": { run: fx(cyclopsFresh), at: byBoss, all: true, note: "the Cyclops waiting at the top" },
  "cyc-witch": { run: fx(cyclopsFresh), at: byWitch, all: true, note: "the card witch's room" },
  "cyc-pool": { run: fx(cyclopsFresh), at: inKind("pool"), all: true, note: "a healing pool" },
  "cyc-large": { run: fx(cyclopsFresh), at: (run) => { const r = Object.values(run.walk!.layout.rooms).find((q) => q.shape === "large"); return r ? roomCentre(r) : null; }, all: true, note: "the large room" },
};

export default function BaselineLab({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const id = use(searchParams).s ?? "enc-entrance";
  const scene = SCENES[id];
  if (!scene) return <main style={{ color: "#eee", padding: 16 }}>Scenes: {Object.keys(SCENES).join(", ")}</main>;
  const base = scene.run, walk = base.walk!;
  const at = scene.at?.(base) ?? walk.at;
  const p = plan(base);
  const run: DungeonRun = { ...base, walk: { ...walk, at, ...(scene.all ? { known: [0, p.w * p.h] } : {}) } };
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", margin: 0 }}>
      <div className="game-screen" style={{ width: 390, height: 693 }}>
        <div className="screen-scale">
          <WalkView walk={run.walk!} map={run.map} dungeon={dungeonOf(run)} decor={!!scene.decor} here={run.path[run.path.length - 1]} room={(k) => walkRoom(run, k)} busy
            been={run.path} cleared={run.cleared} scroll={!!scene.scroll} onScrollClose={() => {}} onEnter={() => {}} onSpotted={() => {}} onObject={() => {}}
            team={TEAM} hp={run.hp} onHeal={() => {}} onKeep={() => {}} />
        </div>
      </div>
    </main>
  );
}
