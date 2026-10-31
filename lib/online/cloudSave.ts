// lib/online/cloudSave.ts
// Cloud saves (docs/design.md §12): one save slot per account follows the
// player between devices.
//
// - Each device remembers, per account, which of its slots is the online one
//   and which cloud revision it last matched (CLOUD_KEY: per device, never in
//   save files). The slot being played when an account first signs in here
//   becomes its online slot.
// - On the title screen (syncAtStart): if the cloud has moved on since this
//   device last matched it, the cloud wins and is loaded into the online slot;
//   the device's copy becomes the backup (Settings → Restore backup). If not,
//   whatever this device played since goes up.
// - While playing (uploadPlaying): changes go up a few seconds later. Each
//   upload only writes over the revision this device last saw (the table
//   counts revisions itself: supabase/migrations), so a newer save from
//   another device is never overwritten: that's a "conflict", and the game
//   goes back to the title screen to load it.
// - What syncs: the save and the battle history. Not the barcode registry
//   (that's to become the global registry), so a slot keeps its own.
//
// Everything takes the store and the client as arguments, so tests can hand
// in stand-ins and nothing needs the internet.

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkSaveFile, exportSave, importSave, BACKUP_KEY, type KeyValueStore, type SaveFile } from "../saveFile";
import { newSlot, readSlots, slotGame, slotKey } from "../saveSlots";

export const CLOUD_KEY = "codex_creatures_cloud_v1";
export const CLOUD_TABLE = "cloud_saves";
// While playing: upload this long after the last change, and no more often
// than every MIN_GAP (the play clock alone saves every 10 s).
export const UPLOAD_DELAY_MS = 5_000;
export const UPLOAD_MIN_GAP_MS = 30_000;
// A sign-in on a device with no saves at all gets the cloud save as a new slot.
export const ONLINE_SLOT_NAME = "Online";
// Give up on a slow connection rather than keep the title screen waiting.
export const CLOUD_TIMEOUT_MS = 10_000;

// This device's online slot for one account. revision 0: never matched the
// cloud yet. dirty: played since the last upload.
export type CloudLink = { slot: string; revision: number; dirty: boolean };
type Links = Record<string, CloudLink>;

type CloudRow = { file: SaveFile; revision: number };

export type SyncOutcome =
  | { kind: "none" }                                // no saves here or in the cloud yet
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

// This account's online slot here, if it still exists.
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

const OFFLINE = "Couldn't reach the server, so your cloud save wasn't checked. Your game is safe on this device.";

// The account's cloud save (null: none yet).
export async function fetchCloud(client: SupabaseClient, userId: string): Promise<{ ok: true; row: CloudRow | null } | { ok: false; error: string }> {
  try {
    const { data, error } = await timeout(client.from(CLOUD_TABLE).select("save, revision").eq("user_id", userId).maybeSingle());
    if (error) return { ok: false, error: OFFLINE };
    if (!data) return { ok: true, row: null };
    const row = data as { save: unknown; revision: number };
    const check = checkSaveFile(JSON.stringify(row.save));
    if (!check.ok) return { ok: false, error: `Your cloud save couldn't be loaded: ${check.error}` };
    return { ok: true, row: { file: check.file, revision: row.revision } };
  } catch {
    return { ok: false, error: OFFLINE };
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
    if (known === 0) {
      const { data, error } = await timeout(client.from(CLOUD_TABLE).insert({ user_id: userId, save }).select("revision").single());
      if (error) return { ok: false, conflict: (error as { code?: string }).code === "23505" };
      return { ok: true, revision: (data as { revision: number }).revision };
    }
    const { data, error } = await timeout(client.from(CLOUD_TABLE).update({ save }).eq("user_id", userId).eq("revision", known).select("revision"));
    if (error) return { ok: false, conflict: false };
    const rows = (data ?? []) as { revision: number }[];
    return rows.length ? { ok: true, revision: rows[0].revision } : { ok: false, conflict: true };
  } catch {
    return { ok: false, conflict: false };
  }
}

// ── Loading the cloud save into a slot ────────────────────────────────
// The slot keeps its own barcode registry; its old game becomes the backup.
function loadInto(store: KeyValueStore, slot: string, cloud: SaveFile): { ok: boolean } {
  const list = readSlots(store);
  const current = slotGame(store, list, slot);
  const file: SaveFile = { ...cloud, data: { ...cloud.data, registry: current?.data.registry ?? null } };
  if (slot === list.active) return importSave(store, file); // (backs up the game in play)
  try {
    if (current) store.setItem(BACKUP_KEY, JSON.stringify(current));
    store.setItem(slotKey(slot), JSON.stringify(file));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ── On the title screen ───────────────────────────────────────────────
export async function syncAtStart(store: KeyValueStore, client: SupabaseClient, userId: string, retried = false): Promise<SyncOutcome> {
  const fetched = await fetchCloud(client, userId);
  if (!fetched.ok) return { kind: "failed", error: fetched.error };
  const cloud = fetched.row;
  let link = cloudLink(store, userId);

  if (!link) {
    const list = readSlots(store);
    if (list.active) {
      link = { slot: list.active, revision: 0, dirty: true };
    } else if (cloud) {
      const made = newSlot(store, ONLINE_SLOT_NAME, cloud.file);
      if (!made.ok || !made.list.active) return { kind: "failed", error: made.ok ? "Your cloud save couldn't be loaded." : made.error };
      writeLink(store, userId, { slot: made.list.active, revision: cloud.revision, dirty: false });
      return { kind: "loaded", slot: made.list.active, backedUp: false };
    } else {
      return { kind: "none" };
    }
  }

  // The cloud has moved on since this device last matched it: the cloud wins.
  if (cloud && cloud.revision !== link.revision) {
    const here = slotGame(store, readSlots(store), link.slot);
    const differs = !sameGame(here, cloud.file);
    if (differs && !loadInto(store, link.slot, cloud.file).ok) {
      return { kind: "failed", error: "There's no room in this browser to load your cloud save. Delete a save you don't need and try again." };
    }
    writeLink(store, userId, { slot: link.slot, revision: cloud.revision, dirty: false });
    return differs ? { kind: "loaded", slot: link.slot, backedUp: here !== null } : { kind: "same", slot: link.slot };
  }

  if (cloud && !link.dirty) { writeLink(store, userId, link); return { kind: "same", slot: link.slot }; }

  // This device is ahead (or the account has no cloud save yet): upload.
  const game = slotGame(store, readSlots(store), link.slot) ?? exportSave(store);
  const up = await uploadCloud(client, userId, game, cloud ? cloud.revision : 0);
  if (up.ok) {
    writeLink(store, userId, { slot: link.slot, revision: up.revision, dirty: false });
    return { kind: "uploaded", slot: link.slot };
  }
  if (up.conflict && !retried) { writeLink(store, userId, link); return syncAtStart(store, client, userId, true); }
  writeLink(store, userId, link);
  return { kind: "failed", error: "Your game couldn't be saved online just now. It's safe on this device and will go up next time." };
}

// ── While playing ─────────────────────────────────────────────────────
export async function uploadPlaying(store: KeyValueStore, client: SupabaseClient, userId: string): Promise<UploadOutcome> {
  const link = cloudLink(store, userId);
  // (Revision 0: the title screen hasn't matched this device with the cloud yet.)
  if (!link || link.revision === 0 || !link.dirty || link.slot !== readSlots(store).active) return "skipped";
  writeLink(store, userId, { ...link, dirty: false }); // (a save during the upload marks it again)
  const up = await uploadCloud(client, userId, exportSave(store), link.revision);
  const now = cloudLink(store, userId) ?? link;
  if (up.ok) { writeLink(store, userId, { ...now, revision: up.revision }); return "uploaded"; }
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
