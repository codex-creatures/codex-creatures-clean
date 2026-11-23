// lib/creatures/nickname.ts
// A creature's own name (the user, 2026-11-24): tap its name in its window
// and type one, and that name stands in for its species' name everywhere
// (lists, battles, Klutz, PvP), so you can tell who's who. Kept on the drop
// as `nick`; its `name` is set to it (or back to the species' name) so every
// screen shows it without knowing. As long as the longest species name.

export const NICK_MAX = 14; // "The Pale Rider"

// The name as it's kept: trimmed, single spaces, cut to NICK_MAX; null for
// nothing (back to the species' name). Only letters, digits, spaces and a few
// marks: no control characters or emoji wider than the pixel font knows.
export function cleanNick(raw: string): string | null {
  const s = raw.replace(/[^\p{L}\p{N} '\-.!?]/gu, "").replace(/\s+/g, " ").trim().slice(0, NICK_MAX).trim();
  return s.length ? s : null;
}

// What to show for a creature: its own name if it has one, else the species'.
export const shownName = (c: { name: string; nick?: string }, species?: string) => c.nick ?? species ?? c.name;
