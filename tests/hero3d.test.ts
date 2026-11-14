import { describe, expect, it } from "vitest";
import { heroPose, turnToward, yawOf, HERO_PARTS, PIVOTS, HERO_TALL, TORCH_RAISE } from "../lib/render3d/hero3d";

describe("the draft 3D hero (/lab/hero)", () => {
  it("turns the short way round to where it walks, and gets there", () => {
    let yaw = yawOf(0, 1); // facing the camera
    expect(yaw).toBe(0);
    const west = yawOf(-1, 0);
    const first = turnToward(yaw, west, 1 / 60);
    expect(first).toBeLessThan(0); // (the short way: not round through east)
    for (let i = 0; i < 120; i++) yaw = turnToward(yaw, west, 1 / 60);
    expect(yaw).toBeCloseTo(west);
    // Across ±π: from just past west to just past east... the short way, through north.
    expect(Math.abs(turnToward(Math.PI - 0.1, -Math.PI + 0.1, 1))).toBeGreaterThan(Math.PI - 0.1);
  });
  it("swings legs against each other while walking, and stands still otherwise, torch held up", () => {
    const p = heroPose(0.375, true);
    expect(p.swing.legL).toBeCloseTo(-p.swing.legR);
    expect(p.swing.legL).not.toBe(0);
    const still = heroPose(0.375, false);
    expect([still.swing.legL, still.swing.legR, still.swing.armR, still.bob]).toEqual([0, -0, 0, 0]);
    expect(still.swing.armL).toBe(TORCH_RAISE);
  });
  it("stands about as tall as the sprite's figure, feet on the floor", () => {
    let top = 0, bottom = Infinity;
    for (const l of Object.keys(PIVOTS) as (keyof typeof PIVOTS)[]) for (const b of HERO_PARTS[l]) {
      top = Math.max(top, PIVOTS[l][1] + b.at[1] + b.size[1] / 2);
      bottom = Math.min(bottom, PIVOTS[l][1] + b.at[1] - b.size[1] / 2);
    }
    expect(bottom).toBeCloseTo(0, 1);
    expect(top).toBeGreaterThan(HERO_TALL * 0.85);
    expect(top).toBeLessThanOrEqual(HERO_TALL);
  });
});
