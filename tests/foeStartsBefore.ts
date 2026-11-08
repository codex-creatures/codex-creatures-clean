// tests/foeStartsBefore.ts
// Where the walk screen put foes before the foe fix saved them in the run
// (lib/world/walkWorld.ts placeFoeStarts at 25b5d65), verbatim apart from the
// name and imports: worked out again each time from the rooms still to beat.
// tests/foeStarts.test.ts checks the saved starts are exactly these at the
// moment they're made, and that this is what used to move them.
import { spawnOf, parentOf, type Foe } from "../lib/dungeon/foes";
import { hasFight, type DungeonId, type Room } from "../lib/dungeon/run";
import { waitsHere, type WalkRun } from "../lib/dungeon/walkRun";
import type { DungeonMap } from "../lib/dungeon/map";
import type { Floorplan } from "../lib/dungeon/floorplan";
import { seeded, roomIds } from "../lib/world/walkWorld";
import { placeFoes, placeWaiter } from "../lib/world/compat/v0Placers";

export function placeFoeStartsBefore(walk: WalkRun, plan: Floorplan, map: DungeonMap, dungeon: DungeonId, room: (id: string) => Room | undefined): Foe[] {
  const ids = roomIds(walk.layout, map);
  const rng = seeded(walk.seed + 303);
  const foes = ids.flatMap((id) => {
    const r = room(id);
    if (!r || !hasFight(r) || r.done) return [];
    if (waitsHere(r, dungeon)) return [placeWaiter(plan, id)];
    const end = map.nodes[spawnOf(parentOf(id))] ? (id === parentOf(id) ? 0 : 1) : undefined;
    return r.enemies ? placeFoes(plan, id, r.enemies.length, rng, end) : [];
  });
  return foes;
}
