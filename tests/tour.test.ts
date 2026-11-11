import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { TOURS, TOUR_CHOICES, TOUR_FIELD, tourAt, startTour, nextTourStep, endTour, tourDenTarget, type TourId } from "../lib/tour";
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
const PLACE_OF: Record<string, number> = { "/altar": OBJ.altar, "/pit": OBJ.pit, "/bag": OBJ.bag, "/klutz": OBJ.klutz, "/chest": OBJ.chest, "/guide": OBJ.scroll };
const IDS = Object.keys(TOURS) as TourId[];

describe("Klutz's tours", () => {
  it("are all on offer, and each starts in the Den", () => {
    expect(TOUR_CHOICES.map((c) => c.id).sort()).toEqual([...IDS].sort());
    for (const id of IDS) expect(TOURS[id][0].path).toBe("/");
  });

  it("the full tour is the other three's steps, and ends in the Inventory with the box's gear", () => {
    const full = TOURS.full;
    expect(full[full.length - 1].path).toBe("/chest");
    const parts = new Set([...TOURS.basics, ...TOURS.combat, ...TOURS.items]);
    expect(full.filter((s) => !parts.has(s))).toEqual([]);
    expect(full.length).toBeGreaterThan(TOURS.combat.length + TOURS.items.length);
  });

  it("shows you each place in the Den before taking you into it", () => {
    const bad: string[] = [];
    for (const id of IDS) TOURS[id].forEach((s, i, steps) => {
      if (i === 0 || s.path === "/" || s.path === steps[i - 1].path) return;
      if (!(s.path in PLACE_OF)) bad.push(`${id} ${i}: no Den place for ${s.path}`);
      else if (tourDenTarget({ id, step: i - 1 }) !== PLACE_OF[s.path]) bad.push(`${id} ${i}: ${s.path} without its place lit up first`);
    });
    expect(bad).toEqual([]);
  });

  it("only lights up things the screens mark, and Den places that exist", () => {
    const have = new Set([...marks(join(__dirname, "../app")), ...marks(join(__dirname, "../components"))]);
    const places = new Set<number>(Object.values(OBJ));
    const bad = IDS.flatMap((id) => TOURS[id].flatMap((s, i) => {
      if (!s.target) return [];
      if (s.target.startsWith("den-")) return places.has(Number(s.target.slice(4))) && s.path === "/" ? [] : [`${id} ${i}: ${s.target}`];
      return have.has(s.target) ? [] : [`${id} ${i}: no data-tour="${s.target}"`];
    }));
    expect(bad).toEqual([]);
  });

  it("keeps Klutz's lines short", () => {
    expect(IDS.flatMap((id) => TOURS[id].filter((s) => s.say.length > 180).map((s) => s.say))).toEqual([]);
  });

  it("goes a step at a time, ends after the last, and survives the main save being written", () => {
    startTour("combat");
    expect(tourAt()).toEqual({ id: "combat", step: 0 });
    nextTourStep();
    expect(tourAt()).toEqual({ id: "combat", step: 1 });
    expect(OWN_FIELDS).toContain(TOUR_FIELD);
    writeMainSave({ gold: 5 });
    expect(tourAt()).toEqual({ id: "combat", step: 1 });
    for (let i = 1; i < TOURS.combat.length; i++) nextTourStep();
    expect(tourAt()).toBeNull();
    expect(TOUR_FIELD in readSave()).toBe(false);
    startTour();
    expect(tourAt()?.id).toBe("full");
    endTour();
    expect(tourAt()).toBeNull();
    expect(tourAt({ [TOUR_FIELD]: { step: 999 } })).toBeNull();
    // A tour saved before there were several: the full one.
    expect(tourAt({ [TOUR_FIELD]: { step: 3 } })).toEqual({ id: "full", step: 3 });
  });
});
