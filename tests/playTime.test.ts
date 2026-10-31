import { describe, it, expect } from "vitest";
import { clearPlayTime, countedMs, formatPlayTime, readPlayTime, IDLE_LIMIT_MS, MAX_TICK_MS, PLAY_TIME_FIELD } from "../lib/playTime";
import { OWN_FIELDS, readSave, writeSaveField } from "../lib/save";

// Minimal in-memory stand-in for the browser's localStorage.
const store: Record<string, string> = {};
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
};

describe("time played", () => {
  it("counts while the game is on screen and you're active", () => {
    expect(countedMs(1000, 5_000, true)).toBe(1000);
  });

  it("stops when the game is hidden, or after 2 minutes without input", () => {
    expect(IDLE_LIMIT_MS).toBe(120_000);
    expect(countedMs(1000, 5_000, false)).toBe(0);
    expect(countedMs(1000, IDLE_LIMIT_MS, true)).toBe(0);
    expect(countedMs(1000, IDLE_LIMIT_MS - 1, true)).toBe(1000);
  });

  it("never counts a long gap (a laptop waking from sleep) or a clock going backwards", () => {
    expect(countedMs(3 * 3600_000, 0, true)).toBe(MAX_TICK_MS);
    expect(countedMs(-500, 0, true)).toBe(0);
  });

  it("is 0 for old saves and junk", () => {
    expect(readPlayTime({})).toBe(0);
    expect(readPlayTime({ [PLAY_TIME_FIELD]: "lots" })).toBe(0);
    expect(readPlayTime({ [PLAY_TIME_FIELD]: -5 })).toBe(0);
    expect(readPlayTime({ [PLAY_TIME_FIELD]: 61.9 })).toBe(61);
  });

  it("is kept when the main game state is saved", () => {
    expect(OWN_FIELDS).toContain(PLAY_TIME_FIELD);
  });

  it("goes back to 0 for a new game, leaving the rest of the save", () => {
    writeSaveField(PLAY_TIME_FIELD, 19_625);
    writeSaveField("gold", 40);
    clearPlayTime();
    expect(readPlayTime(readSave())).toBe(0);
    expect(readSave().gold).toBe(40);
  });

  it("reads as seconds, minutes, then hours", () => {
    expect(formatPlayTime(45)).toBe("45s");
    expect(formatPlayTime(725)).toBe("12m 05s");
    expect(formatPlayTime(3 * 3600 + 7 * 60 + 5)).toBe("3h 07m 05s");
    expect(formatPlayTime(250 * 3600)).toBe("250h 00m 00s");
  });
});
