// lib/online/cloudSave.ts
// Cloud saves (docs/design.md §12): each account has one save, and it
// follows the player between devices. Online, you sign in to play.
//
// - Each device remembers, per account, which of its save slots holds that
//   account's save and which cloud revision it last matched (CLOUD_KEY: per
//   device, never in save files). Slots are hidden in online builds: the
//   account's slot is simply the one in play. The slot being played when an
//   account first signs in here becomes its slot (unless another account has
//   it); otherwise it gets a new one.
// - On the title screen (syncAtStart): if the cloud has moved on since this
//   device last matched it, the cloud wins and is loaded into the account's
//   slot; the device's copy becomes the backup (Settings → Restore backup).
//   If not, whatever this device played since goes up.
// - While playing (uploadPlaying): changes go up a few seconds later. Each
//   upload only writes over the revision this device last saw (the table
//   counts revisions itself: supabase/migrations), so a newer save from
//   another device is never overwritten: that's a "conflict", and the game
//   goes back to the title screen to load it.
// - Offline (offlineSave): a device that has synced before may play its own
//   copy, warned it may be behind another device. It goes up once back online
//   (or, if another device saved meanwhile, the cloud wins as above).
// - What syncs: the save and the battle history. Not the barcode registry
//   (online builds use the global one: lib/online/registry.ts), so a slot keeps its own.
//
// Everything takes the store and the client as arguments, so tests can hand
// in stand-ins and nothing needs the internet.

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkSaveFile, exportSave, importSave, type KeyValueStore, type SaveFile } from "../saveFile";
import { newSlot, readSlots, switchSlot } from "../saveSlots";
import { leaderboardStats } from "../leaderboard";

export const CLOUD_KEY = "codex_creatures_cloud_v1";
// The account last signed in on this device (cleared on signing out), so it
// can still play offline when the sign-in can't be checked.
export const LAST_ACCOUNT_KEY = "codex_creatures_cloud_last_v1";
export const CLOUD_TABLE = "cloud_saves";
// While playing: upload this long after the last change, and no more often
// than every MIN_GAP (the play clock alone saves every 10 s).
export const UPLOAD_DELAY_MS = 5_000;
export const UPLOAD_MIN_GAP_MS = 30_000;
// An account new to this device gets a slot of its own, named this.
export const ONLINE_SLOT_NAME = "Online";
// Give up on a slow connection rather than keep the title screen waiting.
export const CLOUD_TIMEOUT_MS = 10_000;

// This device's slot for one account. revision 0: never matched the cloud
// yet. dirty: played since the last upload. syncedAt: when it last matched
// the cloud (ISO), shown when playing offline.
export type CloudLink = { slot: string; revision: number; dirty: boolean; syncedAt?: string };
type Links = Record<string, CloudLink>;

type CloudRow = { file: SaveFile; revision: number };

export type SyncOutcome =
  | { kind: "same"; slot: string }                  // already matching
  | { kind: "uploaded"; slot: string }
  | { kind: "loaded"; slot: string; backedUp: boolean }
  | { kind: "failed"; error: string };

export type UploadOutcome = "skipped" | "uploaded" | "conflict" | "failed";

// ── This device's links ───────────────────────────────────────────────
export function readLinks(store: KeyValueStore): Links {
  try {
    const parsed = JSON.parse(store.getItem(CLOUD_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeLink(store: KeyValueStore, userId: string, link: CloudLink) {
  const links = readLinks(store);
  links[userId] = link;
  try { store.setItem(CLOUD_KEY, JSON.stringify(links)); } catch {}
}

export function readLastAccount(store: KeyValueStore): string | null {
  try { return store.getItem(LAST_ACCOUNT_KEY); } catch { return null; }
}
export function forgetLastAccount(store: KeyValueStore) {
  try { store.removeItem(LAST_ACCOUNT_KEY); } catch {}
}

// This account's slot here, if it still exists.
export function cloudLink(store: KeyValueStore, userId: string): CloudLink | null {
  const link = readLinks(store)[userId];
  if (!link || typeof link.slot !== "string") return null;
  return readSlots(store).slots.some((s) => s.id === link.slot) ? link : null;
}

// The game was just saved: whichever links point at the slot in play have
// something new to upload.
export function markPlayed(store: KeyValueStore) {
  const active = readSlots(store).active;
  const links = readLinks(store);
  let changed = false;
  for (const l of Object.values(links)) if (l.slot === active && !l.dirty) { l.dirty = true; changed = true; }
  if (changed) try { store.setItem(CLOUD_KEY, JSON.stringify(links)); } catch {}
}

// ── Comparing games ───────────────────────────────────────────────────
// The database stores the save with its keys in its own order, so games
// are compared as text with every object's keys sorted.
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export function sameGame(a: SaveFile | null, b: SaveFile | null): boolean {
  const part = (f: SaveFile | null) => canonical({ progress: f?.data.progress ?? null, battles: f?.data.battles ?? null });
  return part(a) === part(b);
}

// What goes up: the save without the barcode registry.
export function cloudFile(file: SaveFile): SaveFile {
  return { ...file, data: { ...file.data, registry: null } };
}

// ── Talking to the table ──────────────────────────────────────────────
function timeout<T>(p: PromiseLike<T>, ms = CLOUD_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export const OFFLINE_ERROR = "Couldn't reach the server.";

// The account's cloud save (null: none yet).
export async function fetchCloud(client: SupabaseClient, userId: string): Promise<{ ok: true; row: CloudRow | null } | { ok: false; error: string; offline: boolean }> {
  try {
    const { data, error } = await timeout(client.from(CLOUD_TABLE).select("save, revision").eq("user_id", userId).maybeSingle());
    if (error) return { ok: false, error: OFFLINE_ERROR, offline: true };
    if (!data) return { ok: true, row: null };
    const row = data as { save: unknown; revision: number };
    const check = checkSaveFile(JSON.stringify(row.save));
    if (!check.ok) return { ok: false, error: `Your online save couldn't be loaded: ${check.error}`, offline: false };
    return { ok: true, row: { file: check.file, revision: row.revision } };
  } catch {
    return { ok: false, error: OFFLINE_ERROR, offline: true };
  }
}

// Just the cloud's revision (a cheap check while playing).
export async function fetchRevision(client: SupabaseClient, userId: string): Promise<number | null> {
  try {
    const { data, error } = await timeout(client.from(CLOUD_TABLE).select("revision").eq("user_id", userId).maybeSingle());
    if (error) return null;
    return (data as { revision?: number } | null)?.revision ?? 0;
  } catch {
    return null;
  }
}

// Write over `known` (0: there's no cloud save yet). "conflict": another
// device got there first.
export async function uploadCloud(client: SupabaseClient, userId: string, file: SaveFile, known: number):
  Promise<{ ok: true; revision: number } | { ok: false; conflict: boolean }> {
  try {
    const save = cloudFile(file);
    const stats = leaderboardStats(file.data.progress); // (the leaderboards' numbers go up with it)
    if (known === 0) {
      const { data, error } = await timeout(client.from(CLOUD_TABLE).insert({ user_id: userId, save, stats }).select("revision").single());
      if (error) return { ok: false, conflict: (error as { code?: string }).code === "23505" };
      return { ok: true, revision: (data as { revision: number }).revision };
    }
    const { data, error } = await timeout(client.from(CLOUD_TABLE).update({ save, stats }).eq("user_id", userId).eq("revision", known).select("revision"));
    if (error) return { ok: false, conflict: false };
    const rows = (data ?? []) as { revision: number }[];
    return rows.length ? { ok: true, revision: rows[0].revision } : { ok: false, conflict: true };
  } catch {
    return { ok: false, conflict: false };
  }
}

// ── The account's slot ────────────────────────────────────────────────
// Put the account's slot in play, making one if it has none here yet.
function takeSlot(store: KeyValueStore, userId: string, cloud: CloudRow | null): CloudLink | { error: string } {
  const link = cloudLink(store, userId);
  const list = readSlots(store);
  if (link) {
    if (link.slot === list.active) return link;
    const r = switchSlot(store, link.slot);
    return r.ok ? link : { error: r.error };
  }
  const others = Object.entries(readLinks(store)).filter(([id]) => id !== userId).map(([, l]) => l.slot);
  if (list.active && !others.includes(list.active)) return { slot: list.active, revision: 0, dirty: true };
  const made = newSlot(store, ONLINE_SLOT_NAME, cloud?.file ?? null);
  if (!made.ok || !made.list.active) return { error: made.ok ? "A save couldn't be made on this device." : made.error };
  return cloud ? { slot: made.list.active, revision: cloud.revision, dirty: false } : { slot: made.list.active, revision: 0, dirty: true };
}

// Done matching: remember it, and that this account played here last.
function matched(store: KeyValueStore, userId: string, slot: string, revision: number) {
  writeLink(store, userId, { slot, revision, dirty: false, syncedAt: new Date().toISOString() });
  try { store.setItem(LAST_ACCOUNT_KEY, userId); } catch {}
}

// ── On the title screen ───────────────────────────────────────────────
export async function syncAtStart(store: KeyValueStore, client: SupabaseClient, userId: string, retried = false): Promise<SyncOutcome> {
  const fetched = await fetchCloud(client, userId);
  if (!fetched.ok) return { kind: "failed", error: fetched.error };
  const cloud = fetched.row;
  const fresh = !cloudLink(store, userId);
  const link = takeSlot(store, userId, cloud);
  if ("error" in link) return { kind: "failed", error: link.error };
  if (fresh && cloud && link.revision === cloud.revision) { // (a new slot, made from the cloud save)
    matched(store, userId, link.slot, cloud.revision);
    return { kind: "loaded", slot: link.slot, backedUp: false };
  }

  // The cloud has moved on since this device last matched it: the cloud wins.
  // The slot keeps its own barcode registry; its old game becomes the backup.
  if (cloud && cloud.revision !== link.revision) {
    const here = exportSave(store);
    const differs = !sameGame(here, cloud.file);
    if (differs && !importSave(store, { ...cloud.file, data: { ...cloud.file.data, registry: here.data.registry } }).ok) {
      return { kind: "failed", error: "There's no room in this browser to load your online save." };
    }
    matched(store, userId, link.slot, cloud.revision);
    const hadGame = !!(here.data.progress || here.data.battles);
    return differs ? { kind: "loaded", slot: link.slot, backedUp: hadGame } : { kind: "same", slot: link.slot };
  }

  if (cloud && !link.dirty) { matched(store, userId, link.slot, link.revision); return { kind: "same", slot: link.slot }; }

  // This device is ahead (or the account has no cloud save yet): upload.
  const up = await uploadCloud(client, userId, exportSave(store), cloud ? cloud.revision : 0);
  if (up.ok) {
    matched(store, userId, link.slot, up.revision);
    return { kind: "uploaded", slot: link.slot };
  }
  if (up.conflict && !retried) { writeLink(store, userId, link); return syncAtStart(store, client, userId, true); }
  writeLink(store, userId, link);
  return { kind: "failed", error: "Your game couldn't be saved online just now. It's safe on this device and will go up next time." };
}

// No connection: the save this device last played for the account (the
// last one signed in here, if none is given), put in play, and when it last
// matched the cloud. Null: nothing here to play (a first sign-in needs the
// internet).
export function offlineSave(store: KeyValueStore, userId: string | null = readLastAccount(store)): { slot: string; syncedAt: string | null } | null {
  if (!userId) return null;
  const link = cloudLink(store, userId);
  if (!link || link.revision === 0) return null;
  if (link.slot !== readSlots(store).active && !switchSlot(store, link.slot).ok) return null;
  return { slot: link.slot, syncedAt: link.syncedAt ?? null };
}

// ── While playing ─────────────────────────────────────────────────────
export async function uploadPlaying(store: KeyValueStore, client: SupabaseClient, userId: string): Promise<UploadOutcome> {
  const link = cloudLink(store, userId);
  // (Revision 0: the title screen hasn't matched this device with the cloud yet.)
  if (!link || link.revision === 0 || !link.dirty || link.slot !== readSlots(store).active) return "skipped";
  writeLink(store, userId, { ...link, dirty: false }); // (a save during the upload marks it again)
  const up = await uploadCloud(client, userId, exportSave(store), link.revision);
  const now = cloudLink(store, userId) ?? link;
  if (up.ok) { writeLink(store, userId, { ...now, revision: up.revision, syncedAt: new Date().toISOString() }); return "uploaded"; }
  writeLink(store, userId, { ...now, dirty: true });
  return up.conflict ? "conflict" : "failed";
}

// Has another device saved since this one last matched the cloud?
export async function cloudMovedOn(store: KeyValueStore, client: SupabaseClient, userId: string): Promise<boolean> {
  const link = cloudLink(store, userId);
  if (!link || link.revision === 0 || link.slot !== readSlots(store).active) return false;
  const rev = await fetchRevision(client, userId);
  return rev !== null && rev !== 0 && rev !== link.revision;
}
