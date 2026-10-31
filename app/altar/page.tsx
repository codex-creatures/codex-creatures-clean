"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { useGameState, CACHE_LIMIT } from "@/hooks/useGameState";
import { useDropGeneration } from "@/hooks/useDropGeneration";
import { TOTAL_CREATURES, TOTAL_ITEMS, RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { Drop } from "@/lib/types";
import Link from "next/link";
import DenFrame from "@/components/DenFrame";
import CodeCache from "@/components/CodeCache";
import Help, { HelpSection } from "@/components/Help";
import PixelSprite from "@/components/PixelSprite";
import { ICON, NAME, lookOf } from "@/components/ContainerLoot";
import { CardFace } from "@/components/CardGallery";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import { CreatureArt } from "@/components/CreaturePortrait";
import { playerXpToNext, SCAN_UNLOCK } from "@/lib/creatures/levels";
import type { Rarity } from "@/lib/types";
import { BOX_CAP, BIG_BOX_CAP, BOX_NAMES, fitInBoxes, type CappedBox } from "@/lib/items/storage";
import { onlineConfig } from "@/lib/online/client";

const WINDOW_COLS = 3;  // the loot window: 3 wide…
const WINDOW_ROWS = 3;  // …and 3 deep once anything's in it (1 row while empty)

// A square for each find, with two lines for its name under it (as in your Inventory).
const TILE: React.CSSProperties = { aspectRatio: "1", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" };
const TILE_BTN: React.CSSProperties = { display: "block", minWidth: 0, padding: 0, background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer" };

// The Soul Altar: scan a barcode for a Code Cache. Looting: it opens at once,
// what's inside goes straight to your things, and the window shows your
// latest finds until you leave. Storage: the cache waits in the window (up
// to nine) for you to open later. A new barcode scanned with the global
// registry out of reach waits sealed (🔒), and becomes an ordinary cache once
// back online. Typing a barcode in is a testing tool, at the bottom.
export default function AltarPage() {
  const game = useGameState();

  const [barcode, setBarcode]       = useState("");
  const [rollMode, setRollMode]     = useState<"random" | "deterministic">("deterministic");
  const [scannerOn, setScannerOn]   = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [startArmed, setStartArmed] = useState(false); // "Start new" asks for a second tap
  const [resetArmed, setResetArmed] = useState<"player" | "global" | null>(null); // …and so do the resets
  const armedReset = (which: "player" | "global", run: () => void) => {
    if (resetArmed !== which) { setResetArmed(which); window.setTimeout(() => setResetArmed(null), 4000); return; }
    setResetArmed(null);
    run();
  };
  const [startedNew, setStartedNew] = useState(false);
  const [shown, setShown]           = useState<Drop[]>([]); // this visit's finds, newest first (Looting)
  const [note, setNote]             = useState<React.ReactNode>(null); // sealed, storage full…
  const [opening, setOpening]       = useState<Drop[] | null>(null); // stored caches being opened

  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);
  const scanHandledRef  = useRef(false);

  const storing = game.scanMode === "store";
  const kept = useRef(new Set<string>()); // this scan's finds kept as Code Caches (Looting, full box)
  const cacheIds = new Set(game.caches.map((d) => d.id));
  const boxesFull = (full: CappedBox[]) => <>🧰 Your {full.map((b) => BOX_NAMES[b]).join(" and ")} box{full.length > 1 ? "es are" : " is"} full. Sell some to open {full.length > 1 ? "these" : "it"}.</>;

  const { generateDrop, openSealed } = useDropGeneration({
    rollMode,
    scanCounts: game.scanCounts,
    onDrop:            (d) => { if (game.addScan(d)) kept.current.add(d.id); },
    onScan:            (drops, found) => {
      const opened = drops.filter((d) => !kept.current.has(d.id));
      // The first ever to scan this barcode, or one you've scanned before.
      const tag = found === "first" ? <b style={{ color: "#ffd66e" }}>✨ First to find this Code Cache!</b>
        : found === "looted" ? <>You&apos;ve already looted this Code Cache</> : null;
      // Looting, but a find for a full box: it waits as a Code Cache.
      const full = !storing && opened.length < drops.length ? <>📦 No room in your chest: kept as a Code Cache.</> : null;
      setNote(tag && full ? <>{tag}<br />{full}</> : tag ?? full);
      kept.current.clear();
      if (!storing) setShown((s) => [...opened, ...s].slice(0, WINDOW_COLS * WINDOW_ROWS));
    },
    onScanCountUpdate: game.updateScanCount,
    playerLevel:       game.player.level,
    onOffline:         (code) => { game.sealScan(code); setNote(<>📡 No connection: kept as a sealed Code Cache.<br />It opens once you&apos;re online.</>); },
    onSealed:          (rarity, need) => setNote(<>🔒 Something <b style={{ color: RARITY_COLORS[rarity]?.text, textTransform: "capitalize" }}>{rarity}</b> stirs in it. Come back at explorer level <b>{need}</b>.</>),
  });

  // Every scan, camera or typed: with CACHE_LIMIT Code Caches waiting
  // (sealed ones too), it fails. One at a time: the registry may take a moment.
  const cacheCount = game.caches.length + game.sealed.length;
  const scanning = useRef(false);
  async function scan(code: string) {
    if (scanning.current) return;
    if (cacheCount >= CACHE_LIMIT) {
      setNote(<><b style={{ color: "#ff8a80" }}>Scan Failed</b><br />Code Cache Full</>);
      return;
    }
    if (game.sealed.includes(code)) {
      setNote(<>🔒 That barcode is already waiting as a sealed Code Cache.</>);
      return;
    }
    scanning.current = true;
    try { await generateDrop(code); } finally { scanning.current = false; }
  }

  // Sealed Code Caches (scanned offline): once the registry answers, each
  // becomes an ordinary cache. Tried on arriving and on coming back online.
  // (One pass at a time: asking twice could open a cache twice.)
  const unsealing = useRef(false);
  const sealedKey = game.sealed.join(",");
  useEffect(() => {
    if (!game.hydrated || !game.sealed.length) return;
    const tryOpen = async () => {
      if (unsealing.current) return;
      unsealing.current = true;
      let opened = 0;
      for (const code of game.sealed) {
        const r = await openSealed(code);
        if (!r) break;
        if (r.kind === "too_rare") {
          game.unsealScan(code, null);
          setNote(<>🔒 A sealed cache held something <b style={{ color: RARITY_COLORS[r.rarity]?.text, textTransform: "capitalize" }}>{r.rarity}</b>. Scan it again at explorer level <b>{r.need}</b>.</>);
        } else {
          game.unsealScan(code, r.drops);
          opened++;
        }
      }
      if (opened) setNote(<>🔓 Back online: {opened === 1 ? "a sealed cache is" : `${opened} sealed caches are`} ready to open.</>);
      unsealing.current = false;
    };
    tryOpen();
    window.addEventListener("online", tryOpen);
    return () => window.removeEventListener("online", tryOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.hydrated, sealedKey]);

  // Open Code Caches: only those there's room in your chest for.
  function open(list: Drop[]) {
    const { fit, full } = fitInBoxes(game.inventory, list, game.storage);
    setNote(full.length ? boxesFull(full) : null);
    if (fit.length) setOpening(fit);
  }

  const isValidBarcode = useMemo(() => /^[0-9]{6,20}$/.test(barcode.trim()), [barcode]);
  const creaturePct = TOTAL_CREATURES === 0 ? 0 : Math.round((game.discoveredCreatures / TOTAL_CREATURES) * 100);
  const itemPct     = Math.round((game.discoveredItems / TOTAL_ITEMS) * 100);

  useEffect(() => {
    if (!scannerOn || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    setScanStatus("Starting camera...");
    let stopped = false;
    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result: any) => {
            if (!result || stopped || scanHandledRef.current) return;
            scanHandledRef.current = true;
            const digits = result.getText().replace(/\D/g, "");
            if (digits.length >= 6 && digits.length <= 20) {
              setScanStatus(`Scanned: ${digits}`);
              setBarcode(digits);
              controls.stop();
              setScannerOn(false);
              setTimeout(() => scan(digits), 0);
            } else {
              scanHandledRef.current = false;
            }
          }
        );
        scanControlsRef.current = controls;
        setScanStatus("Point camera at barcode...");
      } catch {
        setScanStatus("Camera error (check permissions).");
        setScannerOn(false);
      }
    })();
    return () => {
      stopped = true;
      scanControlsRef.current?.stop();
      scanControlsRef.current = null;
    };
  }, [scannerOn]);

  // What the window holds: the caches waiting, the sealed ones, then
  // (Looting) this visit's finds.
  const sealedTiles = game.sealed.map((code) => ({ sealedCode: code }));
  const slots = [...game.caches, ...sealedTiles, ...(storing ? [] : shown)].slice(0, WINDOW_COLS * WINDOW_ROWS);
  const rows = slots.length ? WINDOW_ROWS : 1;

  return (
    <DenFrame title="Soul Altar" icon="🔮" gold={game.gold}>

      <div style={{ marginBottom: 16, maxWidth: 520 }}>
        <ProgressBar label="Creatures discovered" current={game.discoveredCreatures} total={TOTAL_CREATURES} pct={creaturePct} color="rgba(78,161,255,0.9)" />
        <ProgressBar label="Items discovered" current={game.discoveredItems} total={TOTAL_ITEMS} pct={itemPct} color="rgba(255,204,77,0.9)" />
        <div className="pixel-font" style={{ fontSize: 14, color: "#c9b48a", marginTop: 4 }}>📊 Total scans: <b style={{ color: "#f1d9a0" }}>{game.totalScans.toLocaleString()}</b></div>
        <ExplorerLevel level={game.player.level} xp={game.player.xp} />
      </div>

      {startedNew && (
        <div className="stone-panel" style={{ marginBottom: 10, borderColor: "#c9a24a" }}>
          <div className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0" }}>✨ A fresh start</div>
          <p style={{ fontSize: 13, color: "#d8d4c8", margin: "4px 0 0" }}>Everything&apos;s wiped, {onlineConfig.ok ? "your scanned barcodes" : "every barcode"} included. Scan your first one below — then head back to the Den: there&apos;s something rattling in the cage.</p>
        </div>
      )}

      <div style={{ maxWidth: 520 }}>
        <button className="scan-btn pixel-font" data-on={scannerOn}
          onClick={() => { scanHandledRef.current = false; if (!scannerOn) setScanStatus("Starting camera..."); setScannerOn((s) => !s); }}>
          {scannerOn ? "✖ Stop scanning" : "🔮 Scan Barcode"}
        </button>
        {scannerOn && <div style={{ fontSize: 13, opacity: 0.6, marginTop: 6, textAlign: "center" }}>{scanStatus}</div>}
        {scannerOn && <video ref={videoRef} muted playsInline style={{ marginTop: 8, width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)" }} />}

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          {([["loot", "🎁 Looting"], ["store", "📦 Storage"]] as const).map(([mode, label]) => (
            <button key={mode} className="chip" data-active={game.scanMode === mode} onClick={() => { game.setScanMode(mode); setNote(null); }} style={{ flex: 1 }}>{label}</button>
          ))}
          <Help title="Code Caches">
            <HelpSection title="Every scan is a Code Cache">
              <ul>
                <li><b>Looting:</b> it opens straight away. What&apos;s inside goes to your things, and the window shows your latest {WINDOW_COLS * WINDOW_ROWS} finds until you leave the altar.</li>
                <li><b>Storage:</b> the cache waits in the window to open later.</li>
                <li>A find with no room in your Inventory (a box of weapons, armour or consumables at {BOX_CAP}, or {BIG_BOX_CAP} once built bigger) waits as a cache too, until you make room.</li>
                <li>The altar holds <b>{CACHE_LIMIT}</b> caches. With {CACHE_LIMIT} waiting, scans fail: open some first.</li>
                {onlineConfig.ok && <li>No connection? A barcode new to you waits <b>sealed</b> 🔒 (it takes a space), and opens once you&apos;re back online: what every barcode holds is kept online, the same for every player.</li>}
                <li>Tap a cache to open it, or open them all.</li>
              </ul>
            </HelpSection>
          </Help>
        </div>

        {/* The loot window: laid out like your Inventory (each find loose on its
            rarity glow, its name under it), 3 wide, one row while empty. */}
        <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: `repeat(${WINDOW_COLS}, minmax(0, 1fr))`, gap: 10, marginTop: 14 }}>
          {Array.from({ length: rows * WINDOW_COLS }, (_, i) => {
            const d = slots[i];
            if (!d) return (
              <div key={i}>
                <div style={{ ...TILE, borderRadius: 8, background: "rgba(0,0,0,0.25)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.5)" }} />
                <div style={NAME} />
              </div>
            );
            if ("sealedCode" in d) return (
              <button key={`sealed-${d.sealedCode}`} onClick={() => setNote(<>🔒 A sealed Code Cache: it opens once you&apos;re online.</>)}
                title="Scanned offline: it opens once you're online" aria-label="Sealed Code Cache" style={TILE_BTN}>
                <span style={{ ...TILE, borderRadius: 8, background: "radial-gradient(circle, rgba(160,160,170,0.25) 0%, transparent 62%)" }}>
                  <span style={{ fontSize: 30, filter: "grayscale(0.4)" }}>🔒</span>
                </span>
                <span style={{ ...NAME, color: "#a8a8b4" }}>Sealed</span>
              </button>
            );
            if (cacheIds.has(d.id)) return (
              <button key={d.id} onClick={() => open([d])} title="Open this Code Cache" aria-label="Open this Code Cache" style={TILE_BTN}>
                <span className="cache-sealed" style={{ ...TILE, borderRadius: 8, background: "radial-gradient(circle, rgba(143,193,255,0.35) 0%, transparent 62%)" }}>
                  <span className="pixel-font" style={{ fontSize: 30, color: "#8fc1ff", textShadow: "0 0 8px rgba(143,193,255,0.8)" }}>?</span>
                </span>
                <span style={{ ...NAME, color: "#8fc1ff" }}>Code Cache</span>
              </button>
            );
            return <Find key={d.id} d={d} />;
          })}
        </div>

        {/* Two lines under the window: a warning, or how full storage is. */}
        <div className="pixel-font" style={{ minHeight: "2.6em", marginTop: 8, fontSize: 14, textAlign: "center", color: "#c9b48a", lineHeight: 1.3,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {note ?? (storing || cacheCount ? `📦 ${cacheCount}/${CACHE_LIMIT} Code Caches stored`
            : shown.length ? "" : "Scan a barcode to see what's inside")}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 4, visibility: game.caches.length > 0 ? "visible" : "hidden" }}>
          <button className="pixel-btn" onClick={() => open(game.caches.slice(0, CACHE_LIMIT))}>📦 Open all</button>
        </div>
      </div>

      {opening && (
        <CodeCache title={opening.length === 1 ? "Code Cache" : "Code Caches"} items={opening} revealAllLabel="Extract all" doneLabel="Take it all"
          intro={opening.length === 1 ? "Tap it to crack it open." : "Tap a cache to crack it open, or extract them all at once."}
          onDone={() => { game.openCaches(opening.map((d) => d.id)); setOpening(null); }} />
      )}

      {/* Straight to what you've found, without going back through the Den. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16, maxWidth: 520 }}>
        <Link href="/pit" className="card-btn" style={{ justifyContent: "center" }}>
          <span className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>🐾 Creatures</span>
        </Link>
        <Link href="/chest" className="card-btn" style={{ justifyContent: "center" }}>
          <span className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>🧰 Items</span>
        </Link>
      </div>

      <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.45, marginRight: "auto" }}>Testing tools · <Link href="/settings" style={{ color: "inherit", textDecoration: "underline" }}>export your save first</Link></span>
        <button onClick={() => {
          if (!startArmed) { setStartArmed(true); window.setTimeout(() => setStartArmed(false), 4000); return; }
          setStartArmed(false);
          game.startNew();
          setShown([]);
          setStartedNew(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }} title="A brand-new game: progress, Labyrinth, Klutz, the quest, battle history and every barcode wiped"
          style={{ ...dangerBtn, color: startArmed ? "#1a1a1a" : "#f5c542", background: startArmed ? "#f5c542" : "transparent", borderColor: "rgba(245,197,66,0.6)" }}>
          {startArmed ? "Tap again to wipe everything" : "✨ Start new"}
        </button>
        {!game.tavern.blasted && (
          <button onClick={game.openRubbleForTesting} title="Open the rubble in the Den now, as if you'd done Klutz's quest and fetched the dynamite" style={dangerBtn}>
            🧨 Open the rubble
          </button>
        )}
        <button onClick={game.callVisitorForTesting} title="Have the merchant (or, if he's already there, the librarian) call at the tavern now. Opens and repairs the tavern if it isn't yet." style={dangerBtn}>
          🍺 Call a visitor
        </button>
        <button onClick={() => armedReset("player", game.resetAll)} title="Wipe your progress (inventory, gold, labyrinth) but keep registered barcodes — test as a new player" style={dangerBtn}>
          {resetArmed === "player" ? "Tap again to reset" : "Reset Player"}
        </button>
        {/* (Online, the registry is everyone's: it can't be reset from here.) */}
        {!onlineConfig.ok && (
          <button onClick={() => armedReset("global", game.globalReset)} title="Wipe the barcode registry — every barcode rolls fresh on its next scan. Inventory is kept." style={dangerBtn}>
            {resetArmed === "global" ? "Tap again to reset" : "Global Reset"}
          </button>
        )}
      </div>

      {/* Typing a barcode in: Repeatable (the real rules) or Random (a fresh roll every time). */}
      <div style={{ marginTop: 14, maxWidth: 520 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {([["deterministic", "🔒 Repeatable"], ["random", "🎲 Random"]] as const).map(([mode, label]) => (
            <button key={mode} className="chip" data-active={rollMode === mode} onClick={() => setRollMode(mode)} style={{ flex: 1 }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && isValidBarcode && scan(barcode.trim())}
            placeholder="Enter barcode"
            inputMode="numeric"
            className="pixel-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button onClick={() => scan(barcode.trim())} disabled={!isValidBarcode} className="pixel-btn">🔮 Generate Drop</button>
        </div>
      </div>

    </DenFrame>
  );
}

// One find in the window: on a soft glow of its rarity, its name under it.
// A creature card shows as the card itself, sized to fit the square; a real
// creature as the creature, filling the square like any other find.
function Find({ d }: { d: Drop }) {
  const l = lookOf({ gear: d });
  const t = (d.dropType === "card" || d.dropType === "creature") ? findCreatureTemplate(d.creatureId, d.name) : undefined;
  return (
    <div title={l.name} style={{ minWidth: 0, textAlign: "center" }}>
      <div style={{ ...TILE, position: "relative", borderRadius: 8, background: `radial-gradient(circle, ${l.glow} 0%, transparent 62%)` }}>
        {t && d.dropType === "creature" ? (
          <CreatureArt creatureId={d.creatureId ?? t.id} title={t.name} />
        ) : t && d.dropType === "card" ? (
          <div style={{ width: "71%" }}><CardFace t={t} creatureId={d.creatureId ?? t.id} soulStone={d.soulStone} mini /></div>
        ) : l.sprite ? <PixelSprite sprite={l.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: 30 }}>{l.icon}</span>}
      </div>
      <div style={{ ...NAME, color: l.color }}>{l.name}</div>
    </div>
  );
}

// Your explorer level: fights level you up, and it decides how rare a creature you can find.
function ExplorerLevel({ level, xp }: { level: number; xp: number }) {
  const need = playerXpToNext(level);
  const next = (Object.entries(SCAN_UNLOCK) as [Rarity, number][]).find(([, l]) => l > level);
  return (
    <div style={{ marginTop: 10 }}>
      <div className="pixel-font" style={{ fontSize: 14, color: "#c9b48a" }}>
        🌟 Explorer level <b style={{ color: "#f1d9a0" }}>{level}</b>
        {next && <span style={{ opacity: 0.75 }}> · <span style={{ color: RARITY_COLORS[next[0]].text, textTransform: "capitalize" }}>{next[0]}</span> creatures at {next[1]}</span>}
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 999, overflow: "hidden", marginTop: 4 }}>
        <div style={{ height: "100%", width: `${Math.min(100, (100 * xp) / need)}%`, background: "rgba(241,217,160,0.85)", borderRadius: 999 }} />
      </div>
    </div>
  );
}

function ProgressBar({ label, current, total, pct, color }: { label: string; current: number; total: number; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.8, marginBottom: 4 }}>
        <span>{label}</span><span>{current}/{total} ({pct}%)</span>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}
const dangerBtn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.3)",
  background: "transparent", color: "#ff5050", cursor: "pointer", fontWeight: 600, fontSize: 13,
};
