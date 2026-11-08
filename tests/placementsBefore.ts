// tests/placementsBefore.ts
// What the walk screen placed before phase 2a saved it in the run
// (lib/world/walkWorld.ts at 9eb6e57: placeLights, the witch's half of
// placePeople, and thingsOf), verbatim apart from the names and imports:
// tests/placements.test.ts builds rooms both ways and they must match.
import { roomCentre, type Layout } from "../lib/dungeon/layout";
import { type Sconce, type Candle } from "../lib/dungeon/torch";
import { parentOf, type Foe } from "../lib/dungeon/foes";
import { hasFight, type Room } from "../lib/dungeon/run";
import { type WalkRun } from "../lib/dungeon/walkRun";
import type { DungeonMap } from "../lib/dungeon/map";
import type { Floorplan } from "../lib/dungeon/floorplan";
import { seeded, roomIds, centresOf, type Thing } from "../lib/world/walkWorld";
import { objectDef } from "../lib/world/objects";
import { placeSconces, placeCandles, placeFoes, cageSpots } from "../lib/world/compat/v0Placers";

const thingOf = (t: Omit<Thing, "solid" | "npc">): Thing => {
  const d = objectDef(t.def);
  return { ...t, solid: d.collision === "solid", ...(d.kind === "npc" ? { npc: true } : {}) };
};
const shut = (opened: boolean | undefined) => (opened ? "open" : "shut");

// The wall torches (lit as saved), and the odd candle near a room's middle, never on a campfire.
export function placeLightsBefore(walk: WalkRun, plan: Floorplan): { sconces: Sconce[]; candles: Candle[] } {
  const layout = walk.layout, lit = new Set(walk.lit ?? []);
  const sconces = placeSconces(plan, layout.start, seeded(walk.seed + 505), true).map((c) => (lit.has(c.id) ? { ...c, lit: true } : c));
  const candles = placeCandles(plan, centresOf(layout), [layout.start, layout.boss], seeded(walk.seed + 606))
    .filter((c) => !(walk.fires ?? []).some((f) => Math.hypot(f.x - c.x, f.y - c.y) < 2))
    .map((c) => (lit.has(c.id) ? { ...c, lit: true } : c));
  return { sconces, candles };
}

// (placePeople's witch half.)
export function placeWitchesBefore(walk: WalkRun, plan: Floorplan, map: DungeonMap, room: (id: string) => Room | undefined): Foe[] {
  const ids = roomIds(walk.layout, map);
  const npcRng = seeded(walk.seed + 404);
  return ids.flatMap((id) => (room(id)?.kind === "witch" ? placeFoes(plan, id, 1, npcRng).map((f) => ({ ...f, walks: true, wait: 1 })) : []));
}

export function thingsOfBefore(layout: Layout, plan: Floorplan, ids: string[], room: (id: string) => Room | undefined, npcs: Foe[], spots: WalkRun["spots"]): Thing[] {
  return ids.flatMap((id): Thing[] => {
    const r = room(id);
    if (!r) return [];
    const c = roomCentre(layout.rooms[parentOf(id)]);
    const out: Thing[] = [];
    const add = (t: Omit<Thing, "key" | "room" | "solid" | "npc">) => out.push(thingOf({ key: id, room: id, ...t }));
    if (r.kind === "chest" || r.kind === "treasure") add({ ...c, def: "chest", state: shut(r.done), open: r.done });
    else if (r.kind === "stash") add({ ...c, def: "sack", state: shut(r.opened), open: !!r.opened });
    else if (r.kind === "pool") add({ ...c, def: "pool", open: r.done, glow: !r.done });
    else if (r.kind === "cards") add({ ...c, def: "card-deck", open: r.done });
    else if (r.kind === "merchant") add({ ...c, def: "merchant", open: false });
    else if (r.kind === "librarian" || (r.kind === "library" && r.librarian)) add({ ...c, def: "librarian", open: false });
    else if (r.kind === "witch") for (const n of npcs.filter((f) => f.room === id)) {
      // (Her game played out, she wanders on, with nothing more for you: the user, 2026-11-06.)
      const over = r.done || (!!r.witch && r.witch.state !== "playing");
      add({ x: Math.round(n.x), y: Math.round(n.y), def: "witch", open: false, inert: over });
    }
    // A large room's stores (a library's codexes lying about, a storehouse's crates), till a guard's beaten.
    if ((r.kind === "library" || r.kind === "storehouse") && r.sack && !hasFight(r) && !r.container) {
      add({ ...c, def: r.kind === "library" ? "sack" : "rickety-chest", state: shut(r.opened), open: !!r.opened });
    }
    if (r.container && r.done && (!r.opened || (r.sack?.length ?? 0) > 0)) {
      const at = spots?.[id] ?? c;
      add({ ...at, def: r.container !== "sack" ? "loot-chest" : "loot-sack", state: shut(r.opened), open: !!r.opened });
    }
    // A camp's cages, along its top: "!" over each you can open (its guards beaten, or none to see).
    if (r.cages?.length) cageSpots(plan, parentOf(id), r.cages.length).forEach((q, i) => {
      const cage = r.cages![i];
      out.push(thingOf({ key: `${id}#${i}`, room: id, ...q, def: "cage", state: shut(cage.opened), cage: i, open: !!cage.opened, flag: !cage.opened && (!hasFight(r) || r.done) }));
    });
    return out;
  });
}
