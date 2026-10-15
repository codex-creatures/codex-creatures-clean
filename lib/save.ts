// lib/save.ts
// The one save: everything about a player lives under SAVE_KEY in
// localStorage. Most of it is written by useGameState (hooks/useGameState.ts);
// some parts have their own writers (the Labyrinth: lib/dungeon/run.ts) and
// are kept in their own field. Every writer reads the save, changes only its
// own part and writes it back, so they never overwrite each other.

export const SAVE_KEY = "codex_creatures_save_v2";

// Fields written by something other than useGameState.
export const OWN_FIELDS = ["labyrinth"] as const;

export function readSave(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(save: Record<string, unknown>) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {}
}

// Set (or, with undefined, remove) one field of the save.
export function writeSaveField(field: string, value: unknown) {
  const save = readSave();
  if (value === undefined) delete save[field];
  else save[field] = value;
  write(save);
}

// Write the main game state, keeping the fields other writers own.
export function writeMainSave(state: object) {
  const prev = readSave();
  const kept = Object.fromEntries(OWN_FIELDS.filter((f) => f in prev).map((f) => [f, prev[f]]));
  write({ ...state, ...kept });
}
