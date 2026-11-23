import { describe, expect, it } from "vitest";
import { facingOf, walkFrame, smoothHeading, turnTo, facing8, type Facing } from "../lib/dungeon/tileArt";

describe("walking pictures", () => {
  it("faces the way you mostly go", () => {
    expect(facingOf(1, 0)).toBe("east");
    expect(facingOf(-1, 0.2)).toBe("west");
    expect(facingOf(1, 1)).toBe("south");
    expect(facingOf(0, -1)).toBe("north");
    expect(facingOf(0, 0, "west")).toBe("west");
  });

  it("steps through the walk cycle, and stands still when stopped", () => {
    expect(walkFrame(0, true, 6)).toBe(0);
    expect(walkFrame(0.75, true, 6)).toBe(3);
    expect(walkFrame(1.5, true, 6)).toBe(0);
    expect(walkFrame(3, false, 6)).toBe(-1);
  });
});

describe("turning as you walk", () => {
  // A diagonal walked in little steps that lean one way, then the other (as the frames' steps do).
  const walk = (steps: [number, number][], start: Facing = "south") => {
    let h = { x: 0, y: 1 }, f = start;
    const seen: Facing[] = [];
    for (const [dx, dy] of steps) { h = smoothHeading(h, dx, dy); f = turnTo(h.x, h.y, f); seen.push(f); }
    return seen;
  };
  it("walking diagonally settles on one view, instead of flickering between two", () => {
    const steps = Array.from({ length: 60 }, (_, i): [number, number] => (i % 2 ? [0.06, 0.05] : [0.05, 0.06]));
    const seen = walk(steps);
    const swaps = seen.filter((f, i) => i > 0 && f !== seen[i - 1]).length;
    expect(swaps).toBeLessThanOrEqual(1);
    // Even on a staircase of straight steps (across, then down, ...).
    const stairs = Array.from({ length: 60 }, (_, i): [number, number] => (i % 2 ? [0.06, 0] : [0, 0.06]));
    const s2 = walk(stairs);
    expect(s2.filter((f, i) => i > 0 && f !== s2[i - 1]).length).toBeLessThanOrEqual(1);
  });
  it("still turns to a side view once you're clearly walking that way, and right round at once", () => {
    expect(walk(Array.from({ length: 20 }, (): [number, number] => [0.06, 0])).at(-1)).toBe("east");
    expect(turnTo(0, -1, "south")).toBe("north");
    expect(turnTo(1, 0.9, "south")).toBe("south"); // (near the diagonal: stays)
    expect(turnTo(1, 0.5, "south")).toBe("east");
  });
});

describe("eight ways (the 8-direction hero draft)", () => {
  it("picks the nearest of the eight, and holds it a little past the halfway", () => {
    expect(facing8(0, 1)).toBe("south");
    expect(facing8(1, 1)).toBe("south-east");
    expect(facing8(1, 0)).toBe("east");
    expect(facing8(1, -1)).toBe("north-east");
    expect(facing8(0, -1)).toBe("north");
    expect(facing8(-1, -1)).toBe("north-west");
    expect(facing8(-1, 0)).toBe("west");
    expect(facing8(-1, 1)).toBe("south-west");
    // Just past the halfway between south and south-east (22.5°): still south; well past it: south-east.
    const at = (deg: number) => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)] as const;
    expect(facing8(...at(25), "south")).toBe("south");
    expect(facing8(...at(35), "south")).toBe("south-east");
    expect(facing8(0, 0, "west")).toBe("west");
  });
});
