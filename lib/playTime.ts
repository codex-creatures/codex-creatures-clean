// lib/playTime.ts
// Time played: how long this save has actually been on screen, not how long
// ago it was started. It's a field of the save (lib/save.ts: OWN_FIELDS), so
// each slot keeps its own and it travels in exported files. Counted by
// components/PlayClock.tsx; shown in Settings.

export const PLAY_TIME_FIELD = "playTime"; // whole seconds (missing in old saves: 0)
export const PLAY_TIME_EVENT = "codex-play-time"; // the clock's live total, for Settings

// No tap, click or key for this long and you've walked off: the clock stops
// until you're back.
export const IDLE_LIMIT_MS = 2 * 60_000;
// One tick never counts for more than this: a laptop waking from sleep
// (timers stopped) mustn't add the hours it was shut.
export const MAX_TICK_MS = 5_000;

// How much of the time since the last tick counts as playing.
export function countedMs(elapsedMs: number, sinceInputMs: number, visible: boolean): number {
  if (!visible || sinceInputMs >= IDLE_LIMIT_MS || !(elapsedMs > 0)) return 0;
  return Math.min(elapsedMs, MAX_TICK_MS);
}

// The saved total, whatever's there (an old save, or junk): whole seconds.
export function readPlayTime(save: Record<string, unknown>): number {
  const v = save[PLAY_TIME_FIELD];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

// 45s · 12m 05s · 3h 07m 05s
export function formatPlayTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${p(m)}m ${p(sec)}s`;
  if (m > 0) return `${m}m ${p(sec)}s`;
  return `${sec}s`;
}
