// lib/online/registry.ts
// The global barcode registry (docs/design.md §12): the first scan of a
// barcode anywhere is rolled on the server and stored, and everyone after
// gets that outcome. The roll is the database function scan_barcode
// (supabase/migrations), from a copy of REGISTRY_RULES (lib/barcodeRegistry.ts).
//
// No answer (offline, signed out, a slow connection): lookupOnline gives
// null, and the scan waits as a sealed Code Cache until it can ask again.
// Takes the client as an argument, so tests can hand in a stand-in.

import type { SupabaseClient } from "@supabase/supabase-js";
import { REGISTRY_RULES, type BarcodeEntry, type Lookup } from "../barcodeRegistry";
import { RARITY_WEIGHTS } from "../items/budgets";

export const REGISTRY_TIMEOUT_MS = 8_000;

function timeout<T>(p: PromiseLike<T>, ms = REGISTRY_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

const isRarity = (r: unknown) => typeof r === "string" && r in RARITY_WEIGHTS;
const isText = (x: unknown) => typeof x === "string" && x.length > 0;

// The server's answer, checked: anything malformed counts as no answer.
// (A species or item since removed from the game still passes: the drop
// for it is simply skipped, as with the local registry.)
export function parseLookup(data: unknown): Lookup | null {
  if (!data || typeof data !== "object") return null;
  const { entry, first, registeredAt } = data as Record<string, unknown>;
  if (typeof first !== "boolean" || !entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const ok =
    e.outcome === "gold" ? typeof e.amount === "number" :
    e.outcome === "soul_stone" ? isText(e.stone) :
    e.outcome === "creature" ? isRarity(e.rarity) && isText(e.creatureId) :
    e.outcome === "item" ? isRarity(e.rarity) && Object.keys(REGISTRY_RULES.odds).includes(e.itemCategory as string)
      && (e.itemCategory !== "weapon" || isText(e.itemKey))
      && (e.itemCategory !== "armor" || (isText(e.armorKey) && isText(e.armorSlot))) :
    false;
  if (!ok) return null;
  return { entry: { ...(e as BarcodeEntry), registeredAt: typeof registeredAt === "string" ? registeredAt : "" }, first };
}

// Ask the global registry about a barcode (registering it if it's new).
export async function lookupOnline(client: SupabaseClient, code: string): Promise<Lookup | null> {
  try {
    const { data, error } = await timeout(client.rpc("scan_barcode", { barcode: code }));
    return error ? null : parseLookup(data);
  } catch {
    return null;
  }
}
