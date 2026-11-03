"use client";
// components/CloudSync.tsx
// Cloud saves while playing (lib/online/cloudSave.ts): a few seconds after
// the game saves, the online slot goes up; also on leaving the page and on
// coming back online. If another device has saved since, the game goes back
// to the title screen, which loads the newer save (the cloud wins). So does
// starting to play on another device (lib/online/playSession.ts): one game at
// a time per account.
// Nothing to see: like PlayClock, it only listens. The title screen does its
// own syncing, so this stays off there.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { onlineClient } from "@/lib/online/client";
import { cloudMovedOn, markPlayed, uploadPlaying, UPLOAD_DELAY_MS, UPLOAD_MIN_GAP_MS } from "@/lib/online/cloudSave";
import { checkPlay, watchPlay } from "@/lib/online/playSession";
import { lockSaves, onSaveWritten } from "@/lib/save";
import { STARTED_KEY } from "@/lib/saveSlots";

// sessionStorage: the title screen says why the player was sent back
// ("1": another device saved; ELSEWHERE: another device started playing).
export const CLOUD_RETURN_KEY = "codex_creatures_cloud_return";
export const ELSEWHERE = "elsewhere";

export default function CloudSync() {
  const path = usePathname();
  const off = path === "/start" || path === "/privacy";

  useEffect(() => {
    const client = onlineClient();
    if (off || !client) return;
    const store = window.localStorage;
    const tab = window.sessionStorage;
    let timer: number | undefined, last = 0, running = false, gone = false, closed = false, unwatch = () => {};

    const userId = async () => {
      try { return (await client.auth.getSession()).data.session?.user.id ?? null; } catch { return null; }
    };
    // Another device has the newer save, or is playing now: back to the title screen.
    const toStart = (why = "1") => {
      if (gone) return;
      gone = true;
      lockSaves(); // (nothing more of this game is saved over it)
      try { tab.removeItem(STARTED_KEY); tab.setItem(CLOUD_RETURN_KEY, why); } catch {}
      window.location.assign("/start");
    };
    const upload = async () => {
      window.clearTimeout(timer);
      if (gone) return;
      if (running) { timer = window.setTimeout(upload, UPLOAD_DELAY_MS); return; }
      running = true;
      const id = await userId();
      // (Never over a game another device has started since: it stops here instead.)
      if (id && await checkPlay(client, tab, id)) { running = false; elsewhere(); return; }
      const r = id ? await uploadPlaying(store, client, id) : "skipped";
      if (r === "uploaded") last = Date.now();
      running = false;
      if (r === "conflict") toStart();
    };
    const elsewhere = () => toStart(ELSEWHERE);
    const watch = async () => {
      const id = await userId();
      if (id && !gone && !closed) unwatch = watchPlay(client, tab, id, elsewhere);
    };
    const changed = () => {
      markPlayed(store);
      window.clearTimeout(timer);
      timer = window.setTimeout(upload, Math.max(UPLOAD_DELAY_MS, last + UPLOAD_MIN_GAP_MS - Date.now()));
    };
    const check = async () => {
      const id = await userId();
      if (!id) return;
      if (await checkPlay(client, tab, id)) elsewhere();
      else if (await cloudMovedOn(store, client, id)) toStart();
    };
    const shown = () => { if (document.visibilityState === "visible") check(); else upload(); };

    const stop = onSaveWritten(changed);
    const back = () => { check(); upload(); };
    window.addEventListener("online", back);
    window.addEventListener("pagehide", upload);
    document.addEventListener("visibilitychange", shown);
    check(); // (a tab left open while another device played)
    watch();
    upload(); // (anything left from last time)
    return () => {
      closed = true;
      stop();
      window.clearTimeout(timer);
      unwatch();
      window.removeEventListener("online", back);
      window.removeEventListener("pagehide", upload);
      document.removeEventListener("visibilitychange", shown);
    };
  }, [off]);

  return null;
}
