import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { TOUR, TOUR_FIELD, tourStep, startTour, nextTourStep, endTour, tourDenTarget } from "../lib/tour";
import { OBJ } from "../lib/den/scene";
import { OWN_FIELDS, writeMainSave, readSave } from "../lib/save";

// Minimal in-memory stand-in for the browser's localStorage.
const store: Record<string, string> = {};
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
};

// Every data-tour="…" mark in the screens' source.
function marks(dir: string, found = new Set<string>()): Set<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) marks(p, found);
    else if (p.endsWith(".tsx")) for (const m of readFileSync(p, "utf8").matchAll(/data-tour="([^"]+)"/g)) found.add(m[1]);
  }
  return found;
}

// The Den place you're shown before going into each screen.
const PLACE_OF: Record<string, number> = { "/altar": OBJ.altar, "/pit": OBJ.pit, "/bag": OBJ.bag, "/klutz": OBJ.klutz, "/chest": OBJ.chest };

describe("Klutz's tour", () => {
  it("starts in the Den and ends in the Inventory, with the box's gear", () => {
    expect(TOUR[0].path).toBe("/");
    expect(TOUR[TOUR.length - 1].path).toBe("/chest");
  });

  it("shows you each place in the Den before taking you into it", () => {
    const bad: string[] = [];
    TOUR.forEach((s, i) => {
      if (i === 0 || s.path === "/" || s.path === TOUR[i - 1].path) return;
      if (!(s.path in PLACE_OF)) bad.push(`step ${i}: no Den place for ${s.path}`);
      else if (tourDenTarget(i - 1) !== PLACE_OF[s.path]) bad.push(`step ${i}: ${s.path} without its place lit up first`);
    });
    expect(bad).toEqual([]);
  });

  it("only lights up things the screens mark, and Den places that exist", () => {
    const have = new Set([...marks(join(__dirname, "../app")), ...marks(join(__dirname, "../components"))]);
    const places = new Set<number>(Object.values(OBJ));
    const bad = TOUR.flatMap((s, i) => {
      if (!s.target) return [];
      if (s.target.startsWith("den-")) return places.has(Number(s.target.slice(4))) && s.path === "/" ? [] : [`step ${i}: ${s.target}`];
      return have.has(s.target) ? [] : [`step ${i}: no data-tour="${s.target}"`];
    });
    expect(bad).toEqual([]);
  });

  it("keeps Klutz's lines short", () => {
    expect(TOUR.filter((s) => s.say.length > 180).map((s) => s.say)).toEqual([]);
  });

  it("goes a step at a time, ends after the last, and survives the main save being written", () => {
    startTour();
    expect(tourStep()).toBe(0);
    nextTourStep();
    expect(tourStep()).toBe(1);
    expect(OWN_FIELDS).toContain(TOUR_FIELD);
    writeMainSave({ gold: 5 });
    expect(tourStep()).toBe(1);
    for (let i = 1; i < TOUR.length; i++) nextTourStep();
    expect(tourStep()).toBeNull();
    expect(TOUR_FIELD in readSave()).toBe(false);
    startTour();
    endTour();
    expect(tourStep()).toBeNull();
    expect(tourStep({ [TOUR_FIELD]: { step: 999 } })).toBeNull();
  });
});
