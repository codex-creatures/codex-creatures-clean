"use client";
// app/settings/page.tsx
// Settings: your save. Export it to a file (a backup, or to carry to another
// computer), import one, or go back to the backup made before your last
// import. The rules (checking a file, the automatic backup, putting things
// back if writing fails) live in lib/saveFile.ts. Also: Screen size (this
// device only: lib/uiScale.ts).
//
// This screen doesn't load the game itself (no useGameState), so nothing
// here saves the game behind your back while you swap saves.

import { Coin } from "@/components/GoldCount";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import { lockSaves, readSave, unlockSaves } from "@/lib/save";
import { formatPlayTime, readPlayTime, PLAY_TIME_EVENT } from "@/lib/playTime";
import {
  checkSaveFile, exportSave, importSave, readBackup, restoreBackup, saveFileName, summarise,
  type SaveFile, type SaveSummary,
} from "@/lib/saveFile";
import { writeUiScale, UI_SCALES, UI_SCALE_EVENT } from "@/lib/uiScale";
import { useUiScale } from "@/hooks/useUiScale";
import { canVibrate, readHaptics, writeHaptics, buzz } from "@/lib/haptics";

const MUTED = "rgba(255,255,255,0.55)";
const GOOD = "#5ee08a", BAD = "#ff8a80";

type Message = { kind: "good" | "bad"; text: string };
// Waiting for a yes: a file you picked to import, or the backup to restore.
type Pending = { kind: "import"; file: SaveFile; summary: SaveSummary; name: string } | { kind: "restore"; summary: SaveSummary };

function when(iso: string) {
  const d = new Date(iso);
  return iso && !Number.isNaN(d.getTime()) ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "an unknown date";
}

function SummaryLine({ s }: { s: SaveSummary }) {
  if (s.empty) return <span style={{ color: MUTED }}>An empty save (a brand-new game).</span>;
  return <span><Coin /> {s.gold} gold · 🐾 {s.creatures} creature{s.creatures === 1 ? "" : "s"} · 🎒 {s.items} item{s.items === 1 ? "" : "s"} · 🔍 {s.scans} scan{s.scans === 1 ? "" : "s"}</span>;
}

export default function SettingsPage() {
  const [current, setCurrent] = useState<SaveSummary | null>(null);
  const [backup, setBackup] = useState<SaveFile | null>(null);
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false); // loading a save: the game restarts with it
  const [played, setPlayed] = useState<number | null>(null); // time played, in seconds
  const fileInput = useRef<HTMLInputElement>(null);
  const scale = useUiScale();
  function resize(step: number) {
    const i = Math.min(UI_SCALES.length - 1, Math.max(0, UI_SCALES.indexOf(scale) + step));
    writeUiScale(window.localStorage, UI_SCALES[i]);
    window.dispatchEvent(new Event(UI_SCALE_EVENT));
  }

  // Vibration: null until loaded, and stays null where the browser can't vibrate (the panel's hidden).
  const [haptics, setHaptics] = useState<boolean | null>(null);
  useEffect(() => { if (canVibrate()) setHaptics(readHaptics(window.localStorage)); }, []);
  function toggleHaptics() {
    setHaptics(writeHaptics(window.localStorage, !haptics));
    buzz("hit"); // a taste of it, when turned on
  }

  function refresh() {
    setCurrent(summarise(exportSave(window.localStorage)));
    setBackup(readBackup(window.localStorage));
    setAddress(window.location.host);
    setPlayed(readPlayTime(readSave()));
  }
  useEffect(refresh, []);

  // Time played, ticking live (components/PlayClock.tsx counts it).
  useEffect(() => {
    const live = (e: Event) => setPlayed((e as CustomEvent<number>).detail);
    window.addEventListener(PLAY_TIME_EVENT, live);
    return () => window.removeEventListener(PLAY_TIME_EVENT, live);
  }, []);

  function doExport() {
    try {
      const file = exportSave(window.localStorage);
      const name = saveFileName();
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage({ kind: "good", text: `Exported ${name}. It's in your Downloads — keep a copy somewhere safe.` });
    } catch {
      setMessage({ kind: "bad", text: "The save couldn't be exported. Your game is unchanged." });
    }
  }

  async function picked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // (so picking the same file again still works)
    if (!f) return;
    setPending(null);
    let text: string;
    try {
      text = await f.text();
    } catch {
      setMessage({ kind: "bad", text: "That file couldn't be opened. Nothing was changed." });
      return;
    }
    const check = checkSaveFile(text);
    if (!check.ok) { setMessage({ kind: "bad", text: `${check.error} Nothing was changed.` }); return; }
    setMessage(null);
    setPending({ kind: "import", file: check.file, summary: check.summary, name: f.name });
  }

  // Yes: load it (or the backup). The page then restarts the game with it.
  function confirm() {
    if (!pending) return;
    lockSaves(); // (from here, nothing still running may save the old game)
    const r = pending.kind === "import" ? importSave(window.localStorage, pending.file) : restoreBackup(window.localStorage);
    if (!r.ok) {
      unlockSaves();
      setPending(null);
      setMessage({ kind: "bad", text: r.error });
      return;
    }
    setBusy(true);
    setPending(null);
    setMessage({ kind: "good", text: pending.kind === "import"
      ? "Save loaded. Your old save is kept as the backup. Restarting the game…"
      : "Backup restored. The save it replaced is the backup now. Restarting the game…" });
    window.setTimeout(() => window.location.assign("/"), 1200);
  }

  const panel = { marginTop: 12 } as const;
  return (
    <DenFrame title="Settings" icon="⚙️">
      <div className="stone-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0" }}>💾 Your save</div>
          <Help title="Saves">
            <ul>
              <li>Your game is saved <b>in this browser</b>, for this address{address ? <> (<b>{address}</b>)</> : null}. Another browser, another computer, or another address (the offline copy runs at <b>localhost:8123</b>) has a save of its own.</li>
              <li><b>Export</b> puts your whole game — progress, scanned barcodes and battle history — in one file.</li>
              <li><b>Import</b> that file anywhere to carry on from where you were.</li>
              <li><b>Time played</b> counts while the game is on screen. It pauses when you switch away, or after 2 minutes without a tap. Each save has its own.</li>
              <li>Clearing your browsing data deletes your save. Export first!</li>
              <li>Before an import, your current save is <b>backed up</b> automatically; <b>Restore backup</b> brings it back.</li>
            </ul>
          </Help>
        </div>
        <p style={{ fontSize: 13, color: "#d8d4c8", margin: "6px 0 8px" }}>
          {current ? <SummaryLine s={current} /> : "…"}
        </p>
        <p className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0", margin: "0 0 8px" }}>
          ⏱️ Time played: {played === null ? "…" : formatPlayTime(played)}
        </p>
        <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>
          Saved in this browser{address ? ` at ${address}` : ""}. Export it to back it up or play on another computer.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="pixel-btn" disabled={busy} onClick={doExport}>⬇️ Export save</button>
          <button className="pixel-btn" disabled={busy} onClick={() => fileInput.current?.click()}>⬆️ Import save</button>
        </div>
        <input ref={fileInput} type="file" accept=".json,application/json" onChange={picked} style={{ display: "none" }} />
        <Link href="/start" className="pixel-btn" style={{ display: "block", textAlign: "center", marginTop: 8 }}>🗂️ Switch save / New game</Link>
      </div>

      <div className="stone-panel" style={panel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0" }}>🔍 Screen size</div>
          <Help title="Screen size">
            <ul>
              <li>Makes <b>everything</b> in the game bigger or smaller, if it looks too small (or too big) on this screen.</li>
              <li>A laptop starts at <b>175%</b>, a phone at <b>100%</b>.</li>
              <li>It&apos;s for <b>this device only</b>: your phone and laptop each keep their own, and it isn&apos;t in exported saves.</li>
            </ul>
          </Help>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginTop: 8 }}>
          <button className="pixel-btn" onClick={() => resize(-1)} disabled={scale <= UI_SCALES[0]}>➖ Smaller</button>
          <span className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0", minWidth: 64, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
          <button className="pixel-btn" onClick={() => resize(1)} disabled={scale >= UI_SCALES[UI_SCALES.length - 1]}>➕ Bigger</button>
        </div>
      </div>

      {haptics !== null && (
        <div className="stone-panel" style={panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0" }}>📳 Vibration</div>
            <Help title="Vibration">
              <ul>
                <li>A tiny buzz when a hit lands, a bigger one on <b>precise hits</b> and <b>level-ups</b>.</li>
                <li>Only on phones that allow it (not iPhones).</li>
                <li>It&apos;s for <b>this device only</b>, and isn&apos;t in exported saves.</li>
              </ul>
            </Help>
          </div>
          <button className="pixel-btn" onClick={toggleHaptics} style={{ display: "block", width: "100%", marginTop: 8 }}>
            {haptics ? "📳 On" : "📴 Off"}
          </button>
        </div>
      )}

      {message && (
        <div className="stone-panel" role="status" style={{ ...panel, borderColor: message.kind === "good" ? GOOD : BAD }}>
          <span style={{ fontSize: 14, color: message.kind === "good" ? GOOD : BAD }}>{message.kind === "good" ? "✅ " : "⚠️ "}{message.text}</span>
        </div>
      )}

      {pending && (
        <div className="stone-panel" style={{ ...panel, borderColor: "#f5c542" }}>
          <div className="pixel-font" style={{ fontSize: 16, color: "#f5c542" }}>
            {pending.kind === "import" ? "Load this save?" : "Restore the backup?"}
          </div>
          <p style={{ fontSize: 13, color: "#d8d4c8", margin: "6px 0" }}>
            {pending.kind === "import" ? <>{pending.name}, exported {when(pending.summary.exportedAt)}:</> : <>The backup, from {when(pending.summary.exportedAt)}:</>}
            <br /><SummaryLine s={pending.summary} />
          </p>
          <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>
            It replaces the save you have now. Your current save is backed up first, so you can come back to it with Restore backup.
          </p>
          <div className="dock-tabs">
            <button className="dock-tab" onClick={() => setPending(null)}>Cancel</button>
            <button className="dock-tab" data-active onClick={confirm}>{pending.kind === "import" ? "Replace my save" : "Restore it"}</button>
          </div>
        </div>
      )}

      <div className="stone-panel" style={panel}>
        <div className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0" }}>🛟 Backup</div>
        {backup ? (
          <>
            <p style={{ fontSize: 13, color: "#d8d4c8", margin: "6px 0" }}>
              From {when(backup.exportedAt)}, before your last import, restore or online save loaded:<br /><SummaryLine s={summarise(backup)} />
            </p>
            <button className="pixel-btn" disabled={busy} onClick={() => { setMessage(null); setPending({ kind: "restore", summary: summarise(backup) }); }}>↩️ Restore backup</button>
          </>
        ) : (
          <p style={{ fontSize: 13, color: MUTED, margin: "6px 0 0" }}>No backup yet. One is made automatically whenever you import a save, or your online save replaces this one.</p>
        )}
      </div>
    </DenFrame>
  );
}
