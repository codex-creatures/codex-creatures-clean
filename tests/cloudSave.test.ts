import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportSave, readBackup, SAVE_PARTS, type KeyValueStore, type SaveFile } from "../lib/saveFile";
import { newSlot, readSlots, slotGame } from "../lib/saveSlots";
import {
  cloudLink, cloudMovedOn, forgetLastAccount, markPlayed, offlineSave, readLastAccount, sameGame, syncAtStart, uploadPlaying,
  ONLINE_SLOT_NAME,
} from "../lib/online/cloudSave";

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
}

// A stand-in for the cloud_saves table, counting revisions like the real
// one's trigger, and storing the save with its keys reordered (as jsonb does).
type Row = { save: unknown; revision: number; stats?: unknown };
function fakeCloud(opts: { offline?: boolean } = {}) {
  const rows = new Map<string, Row>();
  const shuffle = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(shuffle);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, shuffle(x)]));
    return v;
  };
  const fail = () => { throw new TypeError("Failed to fetch"); };
  const client = {
    from: () => ({
      select: (cols: string) => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => {
            if (opts.offline) fail();
            const r = rows.get(id);
            return { data: r ? (cols === "revision" ? { revision: r.revision } : { ...r }) : null, error: null };
          },
        }),
      }),
      insert: (row: { user_id: string; save: unknown; stats?: unknown }) => ({
        select: () => ({
          single: async () => {
            if (opts.offline) fail();
            if (rows.has(row.user_id)) return { data: null, error: { code: "23505" } };
            rows.set(row.user_id, { save: shuffle(JSON.parse(JSON.stringify(row.save))), revision: 1, stats: row.stats });
            return { data: { revision: 1 }, error: null };
          },
        }),
      }),
      update: (patch: { save: unknown; stats?: unknown }) => ({
        eq: (_c: string, id: string) => ({
          eq: (_c2: string, known: number) => ({
            select: async () => {
              if (opts.offline) fail();
              const r = rows.get(id);
              if (!r || r.revision !== known) return { data: [], error: null };
              r.save = shuffle(JSON.parse(JSON.stringify(patch.save)));
              r.stats = patch.stats;
              r.revision += 1;
              return { data: [{ revision: r.revision }], error: null };
            },
          }),
        }),
      }),
    }),
  };
  return { client: client as unknown as SupabaseClient, rows, setOffline: (b: boolean) => { opts.offline = b; } };
}

const U = "user-1";
const game = (gold: number, extra: Record<string, unknown> = {}) => ({ gold, inventory: [], ...extra });
const setGold = (s: KeyValueStore, gold: number) => s.setItem(SAVE_PARTS.progress, JSON.stringify(game(gold)));
const goldOf = (f: SaveFile | null) => (f?.data.progress?.gold as number | undefined) ?? null;
const cloudGold = (rows: Map<string, Row>) => ((rows.get(U)?.save as SaveFile).data.progress?.gold as number);

// A device with one slot in play, holding `gold`.
function device(gold: number) {
  const s = memoryStore();
  newSlot(s, "Mine");
  setGold(s, gold);
  s.setItem(SAVE_PARTS.registry, JSON.stringify({ "111": { outcome: "gold" } }));
  return s;
}

describe("cloud saves: signing in", () => {
  it("an account with no cloud save uploads the slot in play, without the barcode registry", async () => {
    const s = device(50), { client, rows } = fakeCloud();
    const r = await syncAtStart(s, client, U);
    expect(r).toEqual({ kind: "uploaded", slot: "1" });
    expect(cloudGold(rows)).toBe(50);
    expect((rows.get(U)!.save as SaveFile).data.registry).toBeNull();
    expect(cloudLink(s, U)).toMatchObject({ slot: "1", revision: 1, dirty: false });
    expect(readLastAccount(s)).toBe(U);
  });

  it("the leaderboards' numbers go up with the save", async () => {
    const s = device(50), { client, rows } = fakeCloud();
    s.setItem(SAVE_PARTS.progress, JSON.stringify(game(50, { labyrinth: { meta: { runs: 4, clears: 1, injuries: {}, bag: [] } } })));
    await syncAtStart(s, client, U);
    expect(rows.get(U)!.stats).toMatchObject({ species: 0, runs: { 1: 4 }, wins: { 1: 1 } });
  });

  it("the cloud wins on a new device: its game is loaded, the device's kept as the backup, the registry kept", async () => {
    const { client, rows } = fakeCloud();
    await syncAtStart(device(50), client, U);
    const other = device(999);
    const r = await syncAtStart(other, client, U);
    expect(r).toEqual({ kind: "loaded", slot: "1", backedUp: true });
    expect(goldOf(exportSave(other))).toBe(50);
    expect(goldOf(readBackup(other))).toBe(999);
    expect(exportSave(other).data.registry).toEqual({ "111": { outcome: "gold" } });
    expect(rows.get(U)!.revision).toBe(1); // (nothing went up)
  });

  it("a device with no saves gets the cloud save as a new slot", async () => {
    const { client } = fakeCloud();
    await syncAtStart(device(50), client, U);
    const fresh = memoryStore();
    const r = await syncAtStart(fresh, client, U);
    expect(r.kind).toBe("loaded");
    const list = readSlots(fresh);
    expect(list.slots.map((x) => x.name)).toEqual([ONLINE_SLOT_NAME]);
    expect(goldOf(exportSave(fresh))).toBe(50);
  });

  it("a brand-new account on an empty device: a new game, saved online straight away", async () => {
    const s = memoryStore(), { client, rows } = fakeCloud();
    expect(await syncAtStart(s, client, U)).toEqual({ kind: "uploaded", slot: "1" });
    expect(readSlots(s).slots.map((x) => x.name)).toEqual([ONLINE_SLOT_NAME]);
    expect(rows.get(U)!.revision).toBe(1);
  });

  it("a second account on the same device gets its own save, not the first one's", async () => {
    const s = device(50), { client, rows } = fakeCloud();
    await syncAtStart(s, client, U);
    const r = await syncAtStart(s, client, "user-2");
    expect(r.kind).toBe("uploaded");
    expect(readSlots(s).active).not.toBe("1");
    expect(goldOf(slotGame(s, readSlots(s), "1"))).toBe(50);
    expect(((rows.get("user-2")!.save as SaveFile).data.progress)).toBeNull();
    // Back to the first account: its save is put in play again.
    expect((await syncAtStart(s, client, U)).kind).toBe("same");
    expect(readSlots(s).active).toBe("1");
    expect(goldOf(exportSave(s))).toBe(50);
  });

  it("play on this device since: it goes up; untouched: nothing changes", async () => {
    const s = device(50), { client, rows } = fakeCloud();
    await syncAtStart(s, client, U);
    expect((await syncAtStart(s, client, U)).kind).toBe("same");
    setGold(s, 60); markPlayed(s);
    expect((await syncAtStart(s, client, U)).kind).toBe("uploaded");
    expect(cloudGold(rows)).toBe(60);
    expect(rows.get(U)!.revision).toBe(2);
  });

  it("another device saved since: the cloud wins, even over this device's own unsent play", async () => {
    const a = device(50), b = memoryStore(), { client } = fakeCloud();
    await syncAtStart(a, client, U);
    await syncAtStart(b, client, U);
    setGold(b, 70); markPlayed(b);
    expect(await uploadPlaying(b, client, U)).toBe("uploaded");
    setGold(a, 55); markPlayed(a); // (a played too, offline)
    const r = await syncAtStart(a, client, U);
    expect(r.kind).toBe("loaded");
    expect(goldOf(exportSave(a))).toBe(70);
    expect(goldOf(readBackup(a))).toBe(55);
  });

  it("the same game in a different key order isn't a change", async () => {
    const s = device(50), { client } = fakeCloud();
    await syncAtStart(s, client, U);
    // A second device with exactly the same game: no backup, nothing loaded.
    const twin = device(50);
    expect((await syncAtStart(twin, client, U)).kind).toBe("same");
    expect(readBackup(twin)).toBeNull();
    expect(sameGame(exportSave(s), exportSave(twin))).toBe(true);
  });

  it("the account's save is put in play, with the cloud save loaded into it; other slots untouched", async () => {
    const a = device(50), { client } = fakeCloud();
    await syncAtStart(a, client, U);
    const b = device(10);
    await syncAtStart(b, client, U); // (b's slot 1 is now online: gold 50)
    newSlot(b, "Other"); setGold(b, 5);
    setGold(a, 80); markPlayed(a);
    await uploadPlaying(a, client, U);
    expect((await syncAtStart(b, client, U)).kind).toBe("loaded");
    expect(readSlots(b).active).toBe("1");
    expect(goldOf(exportSave(b))).toBe(80);
    expect(goldOf(readBackup(b))).toBe(50);
    expect(goldOf(slotGame(b, readSlots(b), "2"))).toBe(5);
  });

  it("offline: says so and changes nothing", async () => {
    const s = device(50), { client, rows } = fakeCloud({ offline: true });
    const r = await syncAtStart(s, client, U);
    expect(r.kind).toBe("failed");
    expect(rows.size).toBe(0);
    expect(goldOf(exportSave(s))).toBe(50);
    expect(cloudLink(s, U)).toBeNull();
  });
});

describe("cloud saves: offline", () => {
  it("a device that has synced can play its own copy, and says when it last synced", async () => {
    const s = device(50), { client } = fakeCloud();
    await syncAtStart(s, client, U);
    newSlot(s, "Other");
    const off = offlineSave(s);
    expect(off?.slot).toBe("1");
    expect(off?.syncedAt).toBeTruthy();
    expect(readSlots(s).active).toBe("1");
    expect(goldOf(exportSave(s))).toBe(50);
  });

  it("a device that has never synced has nothing to play offline", () => {
    const s = device(50);
    expect(offlineSave(s)).toBeNull();
    expect(offlineSave(s, U)).toBeNull();
  });

  it("after signing out, there's no playing offline as that account", async () => {
    const s = device(50), { client } = fakeCloud();
    await syncAtStart(s, client, U);
    forgetLastAccount(s);
    expect(offlineSave(s)).toBeNull();
  });

  it("offline play goes up once back online, if nothing newer is there", async () => {
    const s = device(50), { client, rows } = fakeCloud();
    await syncAtStart(s, client, U);
    offlineSave(s);
    setGold(s, 75); markPlayed(s);
    expect((await syncAtStart(s, client, U)).kind).toBe("uploaded");
    expect(cloudGold(rows)).toBe(75);
  });
});

describe("cloud saves: while playing", () => {
  it("uploads only after a save, only the online slot", async () => {
    const s = device(50), { client, rows } = fakeCloud();
    await syncAtStart(s, client, U);
    expect(await uploadPlaying(s, client, U)).toBe("skipped"); // (nothing new)
    setGold(s, 51); markPlayed(s);
    expect(await uploadPlaying(s, client, U)).toBe("uploaded");
    expect(cloudGold(rows)).toBe(51);
    newSlot(s, "Other"); setGold(s, 1); markPlayed(s);
    expect(await uploadPlaying(s, client, U)).toBe("skipped");
    expect(cloudGold(rows)).toBe(51);
  });

  it("never uploads before the title screen has matched this device with the cloud", async () => {
    const s = device(50), { client, rows } = fakeCloud();
    markPlayed(s);
    expect(await uploadPlaying(s, client, U)).toBe("skipped");
    expect(rows.size).toBe(0);
  });

  it("offline: waits, and goes up once back", async () => {
    const s = device(50), cloud = fakeCloud();
    await syncAtStart(s, cloud.client, U);
    setGold(s, 52); markPlayed(s);
    cloud.setOffline(true);
    expect(await uploadPlaying(s, cloud.client, U)).toBe("failed");
    cloud.setOffline(false);
    expect(await uploadPlaying(s, cloud.client, U)).toBe("uploaded");
    expect(cloudGold(cloud.rows)).toBe(52);
  });

  it("never overwrites a newer save from another device: that's a conflict", async () => {
    const a = device(50), b = memoryStore(), { client, rows } = fakeCloud();
    await syncAtStart(a, client, U);
    await syncAtStart(b, client, U);
    setGold(b, 90); markPlayed(b);
    await uploadPlaying(b, client, U);
    expect(await cloudMovedOn(a, client, U)).toBe(true);
    setGold(a, 1); markPlayed(a);
    expect(await uploadPlaying(a, client, U)).toBe("conflict");
    expect(cloudGold(rows)).toBe(90);
    expect(await cloudMovedOn(b, client, U)).toBe(false);
  });
});
