// lib/online/config.ts
// Which Supabase project the game may talk to (docs/design.md §12).
//
// The game only ever connects to its own Codex Creatures project. The address
// and public key come from the build's environment (.env.local, or Vercel's
// settings), but the project's ID is written here in the repo, so a stray or
// leftover environment variable can't point the game at any other project:
// anything that doesn't match is refused, and the game simply plays offline.
//
// The key must be the public one (the "publishable" or "anon" key). A secret
// or service-role key is refused outright: it must never reach a browser.

// The Codex Creatures project's ID (Supabase dashboard → Project Settings →
// General → Project ID). Empty would mean "not set up": online stays off.
export const CODEX_PROJECT_REF = "wcrgriijyyvqrijbaowq";

export type OnlineConfig = { ok: true; url: string; key: string } | { ok: false; reason: string };

const REF_PATTERN = /^[a-z0-9]{20}$/;

// The project ID inside an old-style (JWT) key, and the role it grants.
function jwtClaims(key: string): { ref?: unknown; role?: unknown } | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function checkKey(key: string, ref: string): string | null {
  if (key.startsWith("sb_secret_")) return "That's a secret key: only the publishable key may go in the game";
  if (key.startsWith("sb_publishable_")) return null;
  const claims = jwtClaims(key);
  if (!claims) return "The key isn't a Supabase key";
  if (claims.role !== "anon") return "Only the public (anon) key may go in the game";
  if (claims.ref !== ref) return "The key belongs to a different project";
  return null;
}

export function readOnlineConfig(
  url: string | undefined,
  key: string | undefined,
  ref: string = CODEX_PROJECT_REF,
): OnlineConfig {
  if (!ref) return { ok: false, reason: "Online isn't set up yet" };
  if (!REF_PATTERN.test(ref)) return { ok: false, reason: "The project ID looks wrong" };
  if (!url || !key) return { ok: false, reason: "No Supabase address or key in this build" };
  const cleanUrl = url.trim().replace(/\/+$/, "");
  if (cleanUrl !== `https://${ref}.supabase.co`) {
    return { ok: false, reason: "The Supabase address isn't the Codex Creatures project" };
  }
  const keyProblem = checkKey(key.trim(), ref);
  if (keyProblem) return { ok: false, reason: keyProblem };
  return { ok: true, url: cleanUrl, key: key.trim() };
}
