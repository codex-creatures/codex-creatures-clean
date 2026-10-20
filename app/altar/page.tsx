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
import { ICON, lookOf } from "@/components/ContainerLoot";
import { playerXpToNext, SCAN_UNLOCK } from "@/lib/creatures/levels";
import type { Rarity } from "@/lib/types";

const WINDOW_COLS = 3;  // the loot window: 3 wide…
const WINDOW_ROWS = 3;  // …and 3 deep once anything's in it (1 row while empty)
const SLOT = 60;        // the same slot size as your bag

// The Soul Altar: scan a barcode for a Code Cache. Looting: it opens at once,
// what's inside goes straight to your things, and the window shows your
// latest finds until you leave. Storage: the cache waits in the window (up
// to nine) for you to open later. Typing a barcode in is a testing tool, at
// the bottom.
export default function AltarPage() {
  const game = useGameState();

  const [barcode, setBarcode]       = useState("");
  const [rollMode, setRollMode]     = useState<"random" | "deterministic">("deterministic");
  const [scannerOn, setScannerOn]   = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [startArmed, setStartArmed] = useState(false); // "Start new" asks for a second tap
  const [startedNew, setStartedNew] = useState(false);
  const [shown, setShown]           = useState<Drop[]>([]); // this visit's finds, newest first (Looting)
  const [picked, setPicked]         = useState<string | null>(null); // the find you tapped
  const [note, setNote]             = useState<React.ReactNode>(null); // sealed, storage full…
  const [opening, setOpening]       = useState<Drop[] | null>(null); // stored caches being opened

  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);
  const scanHandledRef  = useRef(false);

  const storing = game.scanMode === "store";

  const { generateDrop } = useDropGeneration({
    rollMode,
    scanCounts: game.scanCounts,
    onDrop:            game.addScan,
    onScan:            (drops) => {
      setNote(null);
      if (!storing) { setShown((s) => [...drops, ...s].slice(0, WINDOW_COLS * WINDOW_ROWS)); setPicked(drops[0]?.id ?? null); }
    },
    onScanCountUpdate: game.updateScanCount,
    playerLevel:       game.player.level,
    onSealed:          (rarity, need) => setNote(<>🔒 Something <b style={{ color: RARITY_COLORS[rarity]?.text, textTransform: "capitalize" }}>{rarity}</b> stirs in it. Come back at explorer level <b>{need}</b>.</>),
  });

  // Every scan, camera or typed: Storage can't take a tenth cache.
  function scan(code: string) {
    if (storing && game.caches.length >= CACHE_LIMIT) { setNote(<>📦 Storage is full. Open a cache first.</>); return; }
    generateDrop(code);
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

  // What the window holds: this visit's finds, or the caches in storage.
  const slots = storing ? game.caches.slice(0, CACHE_LIMIT) : shown;
  const rows = slots.length ? WINDOW_ROWS : 1;
  const pickedDrop = storing ? undefined : shown.find((d) => d.id === picked);
  const pickedLook = pickedDrop ? lookOf({ gear: pickedDrop }) : null;

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
          <p style={{ fontSize: 13, color: "#d8d4c8", margin: "4px 0 0" }}>Everything&apos;s wiped, every barcode included. Scan your first one below — then head back to the Den: there&apos;s something rattling in the cage.</p>
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
                <li><b>Storage:</b> the cache waits in the window to open later. It holds <b>{CACHE_LIMIT}</b>; when it&apos;s full, open some before you scan again.</li>
                <li>Tap a cache to open it, or open them all.</li>
              </ul>
            </HelpSection>
          </Help>
        </div>

        {/* The loot window: a fixed 3-wide panel, one row while empty. */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: `repeat(${WINDOW_COLS}, ${SLOT}px)`, gap: 8, padding: 10 }}>
            {Array.from({ length: rows * WINDOW_COLS }, (_, i) => {
              const d = slots[i];
              if (!d) return <div key={i} className="inv-slot" style={{ width: SLOT, height: SLOT }} />;
              if (storing) return (
                <button key={d.id} className="inv-slot cache-sealed" onClick={() => setOpening([d])} title="Open this Code Cache" aria-label="Open this Code Cache"
                  style={{ width: SLOT, height: SLOT, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "#23262f" }}>
                  <span className="pixel-font" style={{ fontSize: 24, color: "#8fc1ff", textShadow: "0 0 8px rgba(143,193,255,0.8)" }}>?</span>
                </button>
              );
              const l = lookOf({ gear: d });
              const active = picked === d.id;
              return (
                <button key={d.id} className="inv-slot" onClick={() => setPicked(d.id)} title={l.name} aria-label={l.name} aria-pressed={active}
                  style={{ width: SLOT, height: SLOT, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    background: `radial-gradient(circle, ${l.glow} 0%, rgba(0,0,0,0.35) 65%)`,
                    ...(active ? { borderColor: "#ffd66e", boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.6), 0 0 12px rgba(255,214,110,0.5)" } : {}) }}>
                  {l.sprite ? <PixelSprite sprite={l.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: SLOT * 0.42 }}>{l.icon}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Two lines under the window: what you tapped, a warning, or how full storage is. */}
        <div className="pixel-font" style={{ minHeight: "2.6em", marginTop: 8, fontSize: 14, textAlign: "center", color: "#c9b48a", lineHeight: 1.3,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {note ?? (storing ? `📦 ${game.caches.length}/${CACHE_LIMIT} Code Caches stored`
            : pickedLook ? <span style={{ color: pickedLook.color }}>{pickedLook.name}</span>
            : "Scan a barcode to see what's inside")}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 4, visibility: storing && game.caches.length > 0 ? "visible" : "hidden" }}>
          <button className="pixel-btn" onClick={() => setOpening(game.caches.slice(0, CACHE_LIMIT))}>📦 Open all</button>
        </div>
      </div>

      {opening && (
        <CodeCache title={opening.length === 1 ? "Code Cache" : "Code Caches"} items={opening} revealAllLabel="Extract all" doneLabel="Take it all"
          intro={opening.length === 1 ? "Tap it to crack it open." : "Tap a cache to crack it open, or extract them all at once."}
          onDone={() => { game.openCaches(opening.map((d) => d.id)); setOpening(null); setNote(null); }} />
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
        <button onClick={game.resetAll} title="Wipe your progress (inventory, gold, labyrinth) but keep registered barcodes — test as a new player" style={dangerBtn}>Reset Player</button>
        <button onClick={game.globalReset} title="Wipe the barcode registry — every barcode rolls fresh on its next scan. Inventory is kept." style={dangerBtn}>Global Reset</button>
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
