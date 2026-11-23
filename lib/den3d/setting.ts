// lib/den3d/setting.ts
// The new Den (Settings → "New Den"): on for everyone since 2026-11-20 (the user: "flip the Den to the new view for
// everyone, leave the old in a toggle"); it was off till you turned it on (2026-11-18, to test it live). Kept per device like Screen size and Vibration
// (lib/uiScale.ts, lib/haptics.ts): not in the save, so it isn't carried in an exported file.
// It switches the Den's picture (components/Den3D.tsx) and the battle bag's going home with it
// (lib/den3d/bag.ts: the bag empties into storage after a run).

// (v2 since 2026-11-20, when it came on for everyone: what anyone had set in v1 is left unread, so everyone starts on
// it once. Missing: on; "0": you turned it off, the old Den.)
export const NEW_DEN_KEY = "codex_creatures_den3d_v2";

type Store = Pick<Storage, "getItem" | "setItem">;

export function readNewDen(store: Store): boolean {
  try { return store.getItem(NEW_DEN_KEY) !== "0"; } catch { return true; }
}

export function writeNewDen(store: Store, on: boolean): boolean {
  try { store.setItem(NEW_DEN_KEY, on ? "1" : "0"); } catch { /* storage full or blocked */ }
  return on;
}

// In the browser (false on the server; on wherever storage is blocked).
export const newDenOn = () => typeof window !== "undefined" && readNewDen(window.localStorage);

// 🧪 The new Den's options (Settings, under New Den; the user, 2026-11-19), per device as the switch is:
// the places' names shown or not (a name with a ❗ on it, or the one Klutz's tour is showing, still shows),
// and the camera's angle down from the horizon
// (the Labyrinth's is 60°; the art is drawn for 60°, so other angles are to try).
export const DEN_OPTIONS_KEY = "codex_creatures_den3d_opts_v1";
export const DEN_ANGLES = [45, 50, 55, 60, 65, 70, 75] as const;
// (A "rubble" option, the stones left where the wall came down, went on 2026-11-19: the wall sinks away now.)
export type DenOptions = { names: boolean; angle: number };
export const DEN_DEFAULTS: DenOptions = { names: true, angle: 60 };

// Anything missing or odd falls back to its default, so a damaged value never breaks the Den.
export function parseDenOptions(raw: string | null): DenOptions {
  try {
    const o = raw ? (JSON.parse(raw) as Partial<DenOptions>) : {};
    return {
      names: typeof o.names === "boolean" ? o.names : DEN_DEFAULTS.names,
      angle: DEN_ANGLES.includes(o.angle as (typeof DEN_ANGLES)[number]) ? (o.angle as number) : DEN_DEFAULTS.angle,
    };
  } catch { return { ...DEN_DEFAULTS }; }
}
export function writeDenOptions(store: Store, o: DenOptions): DenOptions {
  try { store.setItem(DEN_OPTIONS_KEY, JSON.stringify(o)); } catch { /* storage full or blocked */ }
  return o;
}
// The next angle up or down the list (staying at its ends).
export function stepAngle(angle: number, step: number): number {
  const i = DEN_ANGLES.indexOf(angle as (typeof DEN_ANGLES)[number]);
  return DEN_ANGLES[Math.min(DEN_ANGLES.length - 1, Math.max(0, (i < 0 ? DEN_ANGLES.indexOf(60) : i) + step))];
}
