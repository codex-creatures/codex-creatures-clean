import { describe } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { stressIt } from "./slow";
import { seeded } from "./walkBaseline";
import { rollLayout, routeProblems, WALK_SPEC, WALK_LABYRINTH, acrossW, type RoomOpts } from "../lib/dungeon/layout";

// The layout generator's test bench (2026-11-09, the user: "make sure the generator could be
// expanded… 5 wide and 15 long"): each setting rolled over many seeds, how often it makes a sound
// layout and how long it takes. Only `npm run test:stress` runs it; it writes its table to
// BENCH_OUT (a file) as well as the console.

type Spec = { rooms: number; minRoute: number; large?: number; block?: number } & RoomOpts;
const SEEDS = Number(process.env.BENCH_SEEDS ?? 20);
const ONLY = process.env.BENCH_ONLY; // run only the settings whose name has this in it
const SETTINGS: [string, Spec][] = [
  ["Encampment unguided (before 2026-11-09)", { ...WALK_SPEC, guided: false }],
  ["Encampment (guided: the default since 2026-11-09)", WALK_SPEC],
  ["Cyclops unguided, 3-tile (before 2026-11-09)", { ...WALK_LABYRINTH, block: 3, guided: false }],
  ["Cyclops guided, 3-tile", { ...WALK_LABYRINTH, block: 3 }],
  ["Cyclops unguided, 2-tile", { ...WALK_LABYRINTH, guided: false }],
  ["Cyclops (2-tile, guided: the default since 2026-11-09)", WALK_LABYRINTH],
  ["4 wide x 10 long, 30 rooms, 2-tile, guided", { rooms: 30, minRoute: 10, large: 1, block: 2, across: 4, guided: true }],
  ["5 wide x 15 long, 50 rooms, 2-tile, guided", { rooms: 50, minRoute: 15, large: 2, block: 2, across: 5, guided: true }],
  ["5 wide x 15 long, 55 rooms, 2-tile, guided", { rooms: 55, minRoute: 15, large: 2, block: 2, across: 5, guided: true }],
];
// BENCH_SIZES=1: bigger dungeons, for the rule (rooms across, route length, rooms).
if (process.env.BENCH_SIZES === "1") {
  SETTINGS.length = 0;
  for (const [across, route, rooms] of [[3, 8, 24], [3, 10, 24], [4, 10, 30], [4, 12, 30], [4, 12, 36], [4, 14, 42], [5, 12, 45], [5, 15, 50], [5, 15, 55], [5, 15, 65], [6, 15, 70], [6, 18, 80]] as const) {
    SETTINGS.push([`${across} wide, route ${route}, ${rooms} rooms (route x across / rooms ${((route * across) / rooms).toFixed(2)})`, { rooms, minRoute: route, large: Math.round(rooms / 25), block: 2, across, guided: true }]);
  }
}
// BENCH_SWEEP=1: the guided tuning, on the Cyclops at 2-tile blocks.
if (process.env.BENCH_SWEEP === "1") {
  SETTINGS.length = 0;
  for (const finalCheck of [true]) for (const slack of [1]) for (const backStep of [5, 7, 9, 12]) for (const sideWay of [1]) {
    SETTINGS.push([`sweep final ${finalCheck ? "on" : "off"} slack ${slack} back ${backStep} side ${sideWay}`, { ...WALK_LABYRINTH, finalCheck, slack, backStep, sideWay }]);
  }
}

describe("the layout generator's bench", () => {
  stressIt("every setting, over many seeds", async () => {
    const lines: string[] = [`${SEEDS} seeds each. ${new Date().toISOString()}`];
    for (const [name, spec] of SETTINGS) {
      if (ONLY && !name.includes(ONLY)) continue;
      let ok = 0, ms = 0, worst = 0, rows = 0;
      for (let s = 1; s <= SEEDS; s++) {
        await new Promise((r) => setTimeout(r, 0));
        const t = Date.now();
        try {
          const l = rollLayout(spec, seeded(s * 131 + 17));
          ok++;
          if (routeProblems(l, spec.minRoute).length) throw new Error(`unsound layout from ${name}`);
          // (Rows: distinct room bottoms, roughly.)
          rows += new Set(Object.values(l.rooms).map((r) => r.y + r.h)).size;
        } catch (e) { if (e instanceof Error && e.message.startsWith("unsound")) throw e; }
        const d = Date.now() - t; ms += d; worst = Math.max(worst, d);
      }
      const w = spec.w ?? (spec.across ? acrossW(spec.across, spec.shapes) : 38);
      lines.push(`${name.padEnd(48)} ${String(ok).padStart(3)}/${SEEDS} made, ${String(Math.round(ms / SEEDS)).padStart(6)} ms avg, ${String(worst).padStart(6)} ms worst; ${w} blocks across${ok ? `, ~${Math.round(rows / ok)} rows` : ""}`);
      console.log(lines[lines.length - 1]);
    }
    if (process.env.BENCH_OUT) fs.writeFileSync(path.resolve(process.env.BENCH_OUT), lines.join("\n") + "\n");
  }, 24 * 3600_000);
});
