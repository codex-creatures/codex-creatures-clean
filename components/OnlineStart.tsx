"use client";
// components/OnlineStart.tsx
// The title screen online (app/start/page.tsx picks it): you sign in to
// play, and your account's one save loads (docs/design.md §12, rules in
// lib/online/cloudSave.ts). With no connection, a device that has played
// before can play offline, warned that it may be behind another device.
//
// Like Settings, this screen doesn't load the game (no useGameState), so the
// save can be synced and swapped here before any game is running.

import { useCallback, useRef, useState } from "react";

import AccountPanel from "@/components/AccountPanel";
import { CLOUD_RETURN_KEY } from "@/components/CloudSync";
import Help from "@/components/Help";
import { Coin } from "@/components/GoldCount";
import type { Account } from "@/lib/online/account";
import { onlineClient } from "@/lib/online/client";
import { cloudLink, offlineSave, readLastAccount, syncAtStart, OFFLINE_ERROR } from "@/lib/online/cloudSave";
import { summarise, type SaveSummary } from "@/lib/saveFile";
import { readSlots, slotGame, touchActive, STARTED_KEY } from "@/lib/saveSlots";

const MUTED = "rgba(255,255,255,0.55)", BAD = "#ff8a80", GOOD = "#5ee08a", WARN = "#f5c542";
const one = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;

function when(iso: string | null | undefined) {
  const d = new Date(iso ?? "");
  return Number.isNaN(d.getTime()) ? "a while ago" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// The account's save on this device, for the summary line.
function summaryOf(slot: string | null): SaveSummary | null {
  if (!slot) return null;
  const store = window.localStorage;
  const g = slotGame(store, readSlots(store), slot);
  return g ? summarise(g) : null;
}

// Where things stand: checking; signed out; synced and ready; offline but
// this device can play its copy; or stuck (offline with nothing here yet).
type Phase =
  | { kind: "checking" }
  | { kind: "out"; offlineAs: string | null }        // (offlineAs: the account this device can play offline)
  | { kind: "ready"; slot: string }
  | { kind: "offline"; userId: string; syncedAt: string | null }
  | { kind: "stuck"; why: string };

export default function OnlineStart() {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [needsName, setNeedsName] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const synced = useRef<string | null>(null); // (the account already synced this visit)

  // A device that has played for this account before, and could play offline.
  const playable = (userId: string | null) => {
    const link = userId ? cloudLink(window.localStorage, userId) : null;
    return link && link.revision > 0 ? link : null;
  };

  const onAccount = useCallback((a: Account) => {
    const client = onlineClient();
    if (!client || a.status === "off") return;
    if (a.status === "loading") { setPhase({ kind: "checking" }); return; }
    if (a.status === "out") {
      synced.current = null; setNeedsName(false);
      const last = readLastAccount(window.localStorage);
      setPhase({ kind: "out", offlineAs: playable(last) ? last : null });
      return;
    }
    if (a.status !== "in") return;
    setNeedsName(!a.name && !a.offline);
    if (synced.current === a.id) return;
    synced.current = a.id;
    setPhase({ kind: "checking" });
    let returned = false;
    try { returned = window.sessionStorage.getItem(CLOUD_RETURN_KEY) !== null; window.sessionStorage.removeItem(CLOUD_RETURN_KEY); } catch {}
    syncAtStart(window.localStorage, client, a.id).then((r) => {
      if (r.kind === "failed") {
        const link = playable(a.id);
        if (link) { setPhase({ kind: "offline", userId: a.id, syncedAt: link.syncedAt ?? null }); if (r.error !== OFFLINE_ERROR) setNotice(r.error); }
        else setPhase({ kind: "stuck", why: r.error === OFFLINE_ERROR ? "Connect to the internet to load your save on this device. After that, it can play offline too." : r.error });
        return;
      }
      setPhase({ kind: "ready", slot: r.slot });
      if (r.kind === "loaded") {
        setNotice((returned ? "You played on another device, so that newer save was loaded." : "Your save was loaded.")
          + (r.backedUp ? " This device's old copy is kept as the backup (⚙️ Settings)." : ""));
      }
    });
  }, []);

  function play(userId?: string) {
    if (busy) return;
    const store = window.localStorage;
    if (userId && !offlineSave(store, userId)) { setPhase({ kind: "stuck", why: "This device's save couldn't be opened." }); return; }
    setBusy(true);
    touchActive(store);
    try { window.sessionStorage.setItem(STARTED_KEY, "1"); } catch {}
    window.location.assign("/"); // (a fresh page, so the game loads this save)
  }

  const offlineId = phase.kind === "offline" ? phase.userId : phase.kind === "out" ? phase.offlineAs : null;
  const slot = phase.kind === "ready" ? phase.slot : offlineId ? playable(offlineId)?.slot ?? null : null;
  const sum = typeof window === "undefined" ? null : summaryOf(slot);
  const canPlay = phase.kind === "ready" && !needsName;

  const note = phase.kind === "checking" ? "Checking your save…" : phase.kind === "offline" ? "Offline" : "";
  const message =
    phase.kind === "checking" ? { color: MUTED, text: "Checking your save…" }
    : phase.kind === "out" && phase.offlineAs ? { color: WARN, text: `⚠️ Can't sign in without the internet? You can play the save on this device offline, last synced ${when(playable(phase.offlineAs)?.syncedAt)}. If you've played on another device since, that progress isn't here. Once you're back online the newer save wins (this one is kept as the backup).` }
    : phase.kind === "out" ? { color: MUTED, text: "Sign in to play. Your game is saved to your account, so it's there on any device you sign in on." }
    : phase.kind === "ready" ? (needsName ? { color: MUTED, text: "Pick your name to start." } : notice ? { color: GOOD, text: `☁️ ${notice}` } : { color: GOOD, text: "☁️ Your save is up to date." })
    : phase.kind === "offline" ? { color: WARN, text: `⚠️ You're offline. This is the save on this device, last synced ${when(phase.syncedAt)}. If you've played on another device since, that progress isn't here. Once you're back online the newer save wins (this one is kept as the backup).${notice ? ` ${notice}` : ""}` }
    : { color: BAD, text: `⚠️ ${phase.why}` };

  return (
    <main className="screen-page">
      <header className="screen-header" style={{ gridTemplateColumns: "1fr auto" }}>
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 18, color: "#f1d9a0", fontWeight: 600, whiteSpace: "nowrap" }}>Codex Creatures</h1>
        <Help title="Your save">
          <ul>
            <li>Sign in to play. Your game is saved to your <b>account</b> as you play: there&apos;s no save button.</li>
            <li>Sign in on another device and your game is there. The newest save always wins; the copy it replaces is kept as the backup (⚙️ Settings → Restore backup).</li>
            <li>No internet? A device you&apos;ve played on before can play <b>offline</b>. It might be behind another device, and once it&apos;s back online the newer save wins.</li>
            <li>Sharing a device? Sign out, and the other player signs in with their own account.</li>
          </ul>
        </Help>
      </header>

      <div className="screen-scroll" style={{ display: "grid", alignContent: "start", gap: 8 }}>
        <AccountPanel onAccount={onAccount} note={note} />
        <div className="stone-panel" style={{ display: "grid", gap: 2, padding: 8 }}>
          <div className="pixel-font" style={{ ...one, fontSize: 16, color: "#f1d9a0" }}>☁️ Your save</div>
          <div style={{ ...one, fontSize: 12, color: MUTED }}>
            {sum && !sum.empty ? <><Coin /> {sum.gold} · 🐾 {sum.creatures} · {sum.scans} scans</> : slot ? "New game" : "—"}
          </div>
        </div>
        <div className="stone-panel" role="status" style={{ fontSize: 14, color: message.color, borderColor: message.color === MUTED ? undefined : message.color }}>
          {message.text}
        </div>
      </div>

      <nav className="screen-dock" style={{ display: "grid", gap: 6 }}>
        {offlineId && phase.kind !== "ready" ? (
          <button className="pixel-btn" disabled={busy} onClick={() => play(offlineId)} style={{ ...one, fontSize: 18, padding: "8px 0" }}>▶ Play offline</button>
        ) : (
          <button className="pixel-btn" disabled={!canPlay || busy} onClick={() => play()} style={{ ...one, fontSize: 18, padding: "8px 0" }}>
            {phase.kind === "out" ? "Sign in to play" : "▶ Play"}
          </button>
        )}
      </nav>
    </main>
  );
}
