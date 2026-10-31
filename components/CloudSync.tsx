"use client";
// components/CloudSync.tsx
// Cloud saves while playing (lib/online/cloudSave.ts): a few seconds after
// the game saves, the online slot goes up; also on leaving the page and on
// coming back online. If another device has saved since, the game goes back
// to the title screen, which loads the newer save (the cloud wins).
// Nothing to see: like PlayClock, it only listens. The title screen does its
// own syncing, so this stays off there.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { onlineClient } from "@/lib/online/client";
import { cloudMovedOn, markPlayed, uploadPlaying, UPLOAD_DELAY_MS, UPLOAD_MIN_GAP_MS } from "@/lib/online/cloudSave";
import { lockSaves, onSaveWritten } from "@/lib/save";
import { STARTED_KEY } from "@/lib/saveSlots";

// sessionStorage: the title screen says why the player was sent back.
export const CLOUD_RETURN_KEY = "codex_creatures_cloud_return";

export default function CloudSync() {
  const path = usePathname();
  const off = path === "/start" || path === "/privacy";

  useEffect(() => {
    const client = onlineClient();
    if (off || !client) return;
    const store = window.localStorage;
    let timer: number | undefined, last = 0, running = false, gone = false;

    const userId = async () => {
      try { return (await client.auth.getSession()).data.session?.user.id ?? null; } catch { return null; }
    };
    // Another device has the newer save: back to the title screen to load it.
    const toStart = () => {
      if (gone) return;
      gone = true;
      lockSaves(); // (nothing more of this game is saved over it)
      try { window.sessionStorage.removeItem(STARTED_KEY); window.sessionStorage.setItem(CLOUD_RETURN_KEY, "1"); } catch {}
      window.location.assign("/start");
    };
    const upload = async () => {
      window.clearTimeout(timer);
      if (gone) return;
      if (running) { timer = window.setTimeout(upload, UPLOAD_DELAY_MS); return; }
      running = true;
      const id = await userId();
      const r = id ? await uploadPlaying(store, client, id) : "skipped";
      if (r === "uploaded") last = Date.now();
      running = false;
      if (r === "conflict") toStart();
    };
    const changed = () => {
      markPlayed(store);
      window.clearTimeout(timer);
      timer = window.setTimeout(upload, Math.max(UPLOAD_DELAY_MS, last + UPLOAD_MIN_GAP_MS - Date.now()));
    };
    const check = async () => {
      const id = await userId();
      if (id && await cloudMovedOn(store, client, id)) toStart();
    };
    const shown = () => { if (document.visibilityState === "visible") check(); else upload(); };

    const stop = onSaveWritten(changed);
    window.addEventListener("online", upload);
    window.addEventListener("pagehide", upload);
    document.addEventListener("visibilitychange", shown);
    check(); // (a tab left open while another device played)
    upload(); // (anything left from last time)
    return () => {
      stop();
      window.clearTimeout(timer);
      window.removeEventListener("online", upload);
      window.removeEventListener("pagehide", upload);
      document.removeEventListener("visibilitychange", shown);
    };
  }, [off]);

  return null;
}
