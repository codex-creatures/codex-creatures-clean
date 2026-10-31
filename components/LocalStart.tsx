"use client";
// components/LocalStart.tsx
// The title screen in a copy of the game without online (the offline
// Windows build, app/start/page.tsx picks it): Continue, New Game, or Load
// a save file. Online, you sign in instead (components/OnlineStart.tsx). Shown when the
// game is opened (the Den sends you here once per visit: STARTED_KEY in lib/saveSlots.ts), and
// from Settings. Each save is a slot (lib/saveSlots.ts); this screen only
// picks one, then restarts the game with it.
//
// Like Settings, this screen doesn't load the game (no useGameState), so
// nothing saves the old game over a slot while you switch.

import { useEffect, useRef, useState } from "react";

import Help from "@/components/Help";
import { Coin } from "@/components/GoldCount";
import { checkSaveFile, summarise } from "@/lib/saveFile";
import {
  readSlots, slotGame, switchSlot, newSlot, renameSlot, deleteSlot, touchActive, MAX_SLOTS, MAX_NAME, STARTED_KEY,
  type SlotList, type SlotResult,
} from "@/lib/saveSlots";


const MUTED = "rgba(255,255,255,0.55)", BAD = "#ff8a80";
const one = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;

function ago(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// What a slot is asking for: a name (new game or rename) or a yes to delete.
type Asking = { kind: "new" } | { kind: "rename"; id: string } | { kind: "delete"; id: string } | null;

export default function LocalStart() {
  const [list, setList] = useState<SlotList>({ active: null, slots: [] });
  const [ready, setReady] = useState(false);
  const [asking, setAsking] = useState<Asking>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setList(readSlots(window.localStorage)); setReady(true); }, []);

  // Into the Den with the slot that's now in play.
  function play() {
    setBusy(true);
    touchActive(window.localStorage);
    try { window.sessionStorage.setItem(STARTED_KEY, "1"); } catch {}
    window.location.assign("/"); // (a fresh page, so the game loads this slot)
  }
  function done(r: SlotResult, thenPlay: boolean) {
    if (!r.ok) { setError(r.error); return; }
    setError(""); setAsking(null); setList(r.list);
    if (thenPlay) play();
  }
  function pick(id: string) {
    if (busy) return;
    if (id === list.active) { play(); return; }
    done(switchSlot(window.localStorage, id), true);
  }
  function ask(a: Asking, startName = "") { setAsking(a); setName(startName); setError(""); }

  async function picked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    let text = "";
    try { text = await f.text(); } catch {}
    const check = checkSaveFile(text);
    if (!check.ok) { setError(check.error); return; }
    done(newSlot(window.localStorage, "", check.file), true);
  }

  const full = list.slots.length >= MAX_SLOTS;
  const active = list.slots.find((s) => s.id === list.active);

  return (
    <main className="screen-page">
      <header className="screen-header" style={{ gridTemplateColumns: "1fr auto" }}>
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 18, color: "#f1d9a0", fontWeight: 600, whiteSpace: "nowrap" }}>Codex Creatures</h1>
        <Help title="Saves">
          <ul>
            <li>The game saves by itself, all the time. There&apos;s no save button.</li>
            <li>Saves live <b>in this browser on this device</b>. Another phone or browser has its own.</li>
            <li>Keep up to {MAX_SLOTS} games here: tap one to play it.</li>
            <li><b>Load file</b> starts a new slot from a save you exported (⚙️ Settings → Export).</li>
            <li>Clearing your browsing data deletes your saves. Export to keep a copy.</li>
          </ul>
        </Help>
      </header>

      <div className="screen-scroll" style={{ display: "grid", alignContent: "start", gap: 8 }}>
        {ready && list.slots.length === 0 && (
          <p style={{ fontSize: 14, color: MUTED, margin: "4px 0", textAlign: "center" }}>No saves yet. Start a new game!</p>
        )}
        {list.slots.map((s) => {
          const g = slotGame(window.localStorage, list, s.id);
          const sum = g ? summarise(g) : null;
          const here = s.id === list.active;
          return (
            <div key={s.id} className="stone-panel" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 6, padding: 8, borderColor: here ? "#f5c542" : undefined }}>
              <button onClick={() => pick(s.id)} disabled={busy} style={{ background: "none", border: "none", padding: 0, textAlign: "left", color: "inherit", cursor: "pointer", minHeight: 44, minWidth: 0 }}>
                <div className="pixel-font" style={{ ...one, fontSize: 16, color: "#f1d9a0" }}>{here ? "▶ " : ""}{s.name}</div>
                <div style={{ ...one, fontSize: 12, color: MUTED }}>
                  {sum && !sum.empty ? <><Coin /> {sum.gold} · 🐾 {sum.creatures} · {ago(s.lastPlayed)}</> : <>New game · {ago(s.lastPlayed)}</>}
                </div>
              </button>
              <button className="dock-tab" aria-label={`Rename ${s.name}`} onClick={() => ask({ kind: "rename", id: s.id }, s.name)} style={{ minWidth: 44, minHeight: 44 }}>✏️</button>
              <button className="dock-tab" aria-label={`Delete ${s.name}`} disabled={here} title={here ? "You're playing this one" : undefined}
                onClick={() => ask({ kind: "delete", id: s.id })} style={{ minWidth: 44, minHeight: 44 }}>🗑️</button>
            </div>
          );
        })}

        {asking && (
          <div className="stone-panel" style={{ borderColor: "#f5c542", display: "grid", gap: 8 }}>
            {asking.kind === "delete" ? (
              <div style={{ fontSize: 14 }}>Delete <b>{list.slots.find((s) => s.id === asking.id)?.name}</b> for good?</div>
            ) : (
              <input autoFocus value={name} maxLength={MAX_NAME} placeholder="Name (optional)" onChange={(e) => setName(e.target.value)}
                style={{ fontSize: 16, padding: 8, minHeight: 44, background: "#1a1610", color: "#f1d9a0", border: "2px solid #5a3e1e", borderRadius: 4 }} />
            )}
            <div className="dock-tabs">
              <button className="dock-tab" onClick={() => setAsking(null)}>Cancel</button>
              <button className="dock-tab" data-active="true" disabled={busy} onClick={() =>
                asking.kind === "new" ? done(newSlot(window.localStorage, name), true)
                : asking.kind === "rename" ? done(renameSlot(window.localStorage, asking.id, name), false)
                : done(deleteSlot(window.localStorage, asking.id), false)}>
                {asking.kind === "new" ? "Start" : asking.kind === "rename" ? "Save" : "Delete"}
              </button>
            </div>
          </div>
        )}

        {error && <div className="stone-panel" role="status" style={{ borderColor: BAD, color: BAD, fontSize: 14 }}>⚠️ {error}</div>}
      </div>

      <nav className="screen-dock" style={{ display: "grid", gap: 6 }}>
        <button className="pixel-btn" disabled={!active || busy} onClick={() => active && pick(active.id)} style={{ ...one, fontSize: 18, padding: "8px 0", visibility: ready && !active ? "hidden" : undefined }}>
          ▶ Continue{active ? `: ${active.name}` : ""}
        </button>
        <div className="dock-tabs">
          <button className="dock-tab" disabled={full || busy} title={full ? `${MAX_SLOTS} saves at most: delete one first` : undefined} onClick={() => ask({ kind: "new" })}>✨ New Game</button>
          <button className="dock-tab" disabled={full || busy} onClick={() => fileInput.current?.click()}>📂 Load file</button>
        </div>
        <input ref={fileInput} type="file" accept=".json,application/json" onChange={picked} style={{ display: "none" }} />
      </nav>
    </main>
  );
}
