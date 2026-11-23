// lib/den3d/setting.ts
// The Den's options, kept per device like Screen size and Vibration (lib/uiScale.ts, lib/haptics.ts): not in
// the save, so they aren't carried in an exported file.
// (The switch between this Den and the old one, codex_creatures_den3d_v2 and v1 before it, went with the old
// Den on 2026-11-24: both keys are left unread in the browser, and everyone has this Den.)

type Store = Pick<Storage, "getItem" | "setItem">;

// 🧪 The Den's options (Settings → The Den; the user, 2026-11-19), per device:
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
