import { describe, expect, it } from "vitest";
import { walkView, tapCell, artPxAcross, artPxDown, legacyPx, legacyU, across, WALK_ACROSS, FEET_U } from "../lib/render/projection";
import { cameraAt } from "../lib/dungeon/walk";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { KIT_PX, KIT_ROW, KIT_SIDE, KIT_NORTH } from "../lib/sprites/walk";
import { seeded } from "./walkBaseline";
import fs from "node:fs";
import path from "node:path";

// The projection (docs/world-spec.md §4) reproduces the walk screen's sums as
// they were written in components/WalkView.tsx on 2026-11-07, to the bit: these
// are those lines, copied, against the module.
const plan = layoutFloorplan(JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "walk", "encampment-mid.json"), "utf8")).walk.layout);

function before(cw: number, ch: number, me: { x: number; y: number }, jx: number, jy: number) {
  const T = cw / WALK_ACROSS, scale = T / 16;
  const cam = cameraAt(plan, me, { w: cw / T, h: ch / T });
  return {
    T, scale, cam,
    sx: (x: number) => Math.round((x - cam.x) * T + jx), sy: (y: number) => Math.round((y - cam.y) * T + jy),
    x0: Math.floor(cam.x) - 1, x1: Math.ceil(cam.x + cw / T) + 1, y0: Math.floor(cam.y) - 1, y1: Math.ceil(cam.y + ch / T) + 1,
    midX: (v: number) => (v - cam.x + 0.5) * T + jx, midY: (v: number) => (v - cam.y + 0.5) * T + jy,
    footX: (x: number) => (x - cam.x + 0.5) * T + jx, footY: (y: number) => (y - cam.y + 0.5) * T + 4 * scale + jy,
    vy: T / KIT_ROW, side: Math.round((KIT_SIDE * T) / KIT_PX), heroPx: T / KIT_PX,
    tap: (px: number, py: number) => ({ x: Math.floor(cam.x + px / T), y: Math.floor(cam.y + py / T) }),
  };
}

describe("the projection: today's walk screen, exactly (world-spec §4.3)", () => {
  it("every sum matches the walk screen's own, over many sizes, spots and shakes", () => {
    const rng = seeded(7);
    const bad: string[] = [];
    for (let k = 0; k < 400; k++) {
      const cw = 200 + Math.floor(rng() * 900) + (k % 3) * 0.37, ch = 300 + Math.floor(rng() * 900) + (k % 5) * 0.21;
      const me = { x: rng() * plan.w, y: rng() * plan.h };
      const shake = k % 2 ? (rng() * 2 - 1) * 4 : 0, jx = shake, jy = shake ? (rng() * 2 - 1) * 4 : 0;
      const a = before(cw, ch, me, jx, jy), b = walkView(plan, me, cw, ch, { x: jx, y: jy });
      const same = (what: string, x: number, y: number) => { if (!Object.is(x, y)) bad.push(`${k} ${what}: ${x} vs ${y}`); };
      same("T", a.T, b.T); same("scale", a.scale, b.scale); same("cam.x", a.cam.x, b.cam.x); same("cam.y", a.cam.y, b.cam.y);
      same("x0", a.x0, b.x0); same("x1", a.x1, b.x1); same("y0", a.y0, b.y0); same("y1", a.y1, b.y1);
      for (let q = 0; q < 20; q++) {
        const x = Math.floor(rng() * plan.w) + (q % 4) * 0.25, y = Math.floor(rng() * plan.h) + (q % 3) * 0.4;
        same("sx", a.sx(x), b.sx(x)); same("sy", a.sy(y), b.sy(y));
        same("midX", a.midX(x), b.midX(x)); same("midY", a.midY(y), b.midY(y));
        same("footX", a.footX(x), b.footX(x)); same("footY", a.footY(y), b.footY(y));
        const px = rng() * cw, py = rng() * ch, still = walkView(plan, me, cw, ch);
        expect(tapCell(still, px, py)).toEqual(before(cw, ch, me, 0, 0).tap(px, py));
      }
      same("kit row", a.vy, artPxDown(b, { perU: KIT_PX, rowsPerU: KIT_ROW }));
      same("kit side", a.side, Math.round(KIT_SIDE * artPxAcross(b, { perU: KIT_PX, rowsPerU: KIT_ROW })));
      same("kit north", Math.round(KIT_NORTH * a.vy), Math.round(KIT_NORTH * artPxDown(b, { perU: KIT_PX, rowsPerU: KIT_ROW })));
      same("hero px", a.heroPx, artPxAcross(b, { perU: KIT_PX }));
      for (const n of [7, 11, 14, 16, 22, 24, 26, 28, 40]) same(`legacy ${n}`, n * a.scale, legacyPx(b, n));
      for (const n of [7, 11, 14, 16, 22, 24, 26, 28, 40]) same(`legacy ${n} in u`, n * a.scale, across(b, legacyU(n)));
    }
    expect(bad).toEqual([]);
  });

  it("square floor cells, the feet a quarter of a cell below the middle", () => {
    const v = walkView(plan, { x: 20, y: 20 }, 390, 693);
    expect(v.T).toBe(26);
    expect(v.sy(11) - v.sy(10)).toBe(v.sx(11) - v.sx(10));
    expect(v.footY(10) - v.midY(10)).toBeCloseTo(FEET_U * v.T, 9);
  });
});
