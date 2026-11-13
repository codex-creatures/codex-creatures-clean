"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useGameState, CACHE_LIMIT } from "@/hooks/useGameState";
import { useDropGeneration } from "@/hooks/useDropGeneration";
import { TOTAL_CREATURES, TOTAL_ITEMS, RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { Drop } from "@/lib/types";
import Link from "next/link";
import DenFrame from "@/components/DenFrame";
import CodeCache from "@/components/CodeCache";
import BarcodeScanner from "@/components/BarcodeScanner";
import ScanReveal from "@/components/ScanReveal";
import Help, { HelpSection } from "@/components/Help";
import PixelSprite from "@/components/PixelSprite";
import { ICON, NAME, lookOf } from "@/components/ContainerLoot";
import { CardFace } from "@/components/CardGallery";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import { CreatureArt } from "@/components/CreaturePortrait";
import { playerXpToNext, SCAN_UNLOCK } from "@/lib/creatures/levels";
import type { Rarity } from "@/lib/types";
import { BOX_CAP, BIG_BOX_CAP, BIGGER_BOX_CAP, BOX_NAMES, fitInBoxes, type CappedBox } from "@/lib/items/storage";
import { onlineClient, onlineConfig } from "@/lib/online/client";
import { testingToolsAllowed } from "@/lib/online/admin";
import { backupSave } from "@/lib/saveFile";
import { findLine, newFinds, type NewFind } from "@/lib/scanReveal";
import { countDaily } from "@/lib/daily";
import { SCAN_MAX, SCAN_REGEN_MS, clockText, nextScanIn } from "@/lib/scanCharges";
import { CALIBRATION_SCANS, FIRST_SCANS, calibrationLeft } from "@/lib/firstScans";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";

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
// back online. Typing a barcode in is a testing tool, at the bottom (online,
// only for the owner's account: lib/online/admin.ts).
export default function AltarPage() {
  const game = useGameState();

  const [barcode, setBarcode]       = useState("");
  const [rollMode, setRollMode]     = useState<"random" | "deterministic">("deterministic");
  const [scannerOn, setScannerOn]   = useState(false);
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
  const [opening, setOpening]       = useState<Drop[] | null>(null); // stored caches being opened (Open all)
  const [revealing, setRevealing]   = useState<Drop[]>([]); // finds being unveiled, one at a time
  const [tools, setTools]           = useState(false); // the testing tools, once we know they're allowed
  useEffect(() => { testingToolsAllowed(onlineClient(), window.localStorage).then(setTools); }, []);

  const storing = game.scanMode === "store";
  const kept = useRef(new Set<string>()); // this scan's finds kept as Code Caches (Looting, full box)
  const [lines, setLines]           = useState<Record<string, string>>({}); // finds to be unveiled: who got there first (findLine)
  const [fresh, setFresh]           = useState<Map<string, NewFind>>(new Map()); // finds new to you, worked out before they join your things
  const noteNew = (drops: Drop[]) => { const m = newFinds(drops, game.speciesOwned, game.itemKinds); setFresh((f) => new Map([...f, ...m])); };
  const cacheIds = new Set(game.caches.map((d) => d.id));
  const boxesFull = (full: CappedBox[]) => <>🧰 Your {full.map((b) => BOX_NAMES[b]).join(" and ")} box{full.length > 1 ? "es are" : " is"} full. Sell some to open {full.length > 1 ? "these" : "it"}.</>;

  const { generateDrop, openSealed } = useDropGeneration({
    rollMode,
    scanCounts: game.scanCounts,
    onDrop:            (d) => { if (game.addScan(d)) kept.current.add(d.id); },
    onScan:            (drops, found, place) => {
      const opened = drops.filter((d) => !kept.current.has(d.id));
      noteNew(opened); // (game is still as it was before this scan)
      if (found !== "looted") countDaily("scan"); // a new barcode (the daily quest: lib/daily.ts)
      // The first ever to scan this barcode, how many found it before you, or
      // one you've scanned before: in the unveiling (Looting), else under the window.
      const line = findLine(found, place);
      const unveiling = !storing && opened.length > 0;
      if (line && unveiling) setLines((m) => ({ ...m, [opened[0].id]: line }));
      const tag = !line || unveiling ? null : line.startsWith("✨") ? <b style={{ color: "#ffd66e" }}>{line}</b> : <>{line}</>;
      // Looting, but a find for a full box: it waits as a Code Cache.
      const full = !storing && opened.length < drops.length ? <>📦 No room in your chest: kept as a Code Cache.</> : null;
      setNote(tag && full ? <>{tag}<br />{full}</> : tag ?? full);
      kept.current.clear();
      if (!storing) {
        setShown((s) => [...opened, ...s].slice(0, WINDOW_COLS * WINDOW_ROWS));
        setRevealing((r) => [...r, ...opened]);
      }
    },
    onScanCountUpdate: game.updateScanCount,
    playerLevel:       game.player.level,
    onOffline:         (code) => { game.sealScan(code); countDaily("scan"); setNote(<>📡 No connection: kept as a sealed Code Cache.<br />It opens once you&apos;re online.</>); },
    canScanNew:        () => rollMode !== "random" && game.canScanNew(),
    onScanUsed:        (code) => { game.takeScanCharge(code); },
    calibrating:       rollMode !== "random" && game.calibrating,
    calibrated:        game.firstScans?.codes,
    onCalibratedAgain: () => setNote(<>🔧 That one&apos;s calibrated already. Try another barcode.</>),
    onNoScans:         () => setNote(<><b style={{ color: "#ff8a80" }}>No scans left</b><br />The next one comes in {clockText(nextScanIn(game.scanCharges, Date.now()) ?? 0)}.</>),
    onSealed:          (rarity, need) => setNote(<>🔒 Something <b style={{ color: RARITY_COLORS[rarity]?.text, textTransform: "capitalize" }}>{rarity}</b> stirs in it. Come back at explorer level <b>{need}</b>.</>),
  });

  // Every scan, camera or typed: with CACHE_LIMIT Code Caches waiting
  // (sealed ones too), it fails. One at a time: the registry may take a moment.
  const cacheCount = game.caches.length + game.sealed.length;
  // Scans stored, and a clock ticking once a second while you're below full.
  const [now, setNow] = useState(() => Date.now());
  const charges = game.scansNow(now);
  const nextIn = nextScanIn(game.scanCharges, now);
  const ticking = nextIn !== null;
  useEffect(() => {
    if (!ticking) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [ticking]);
  useEffect(() => setNow(Date.now()), [game.scanCharges]); // (a scan just used one: show it now)
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

  // Open Code Caches: only those there's room in your chest for. One cache
  // is unveiled (ScanReveal); several open together, with no show.
  function open(list: Drop[]) {
    const { fit, full } = fitInBoxes(game.inventory, list, game.storage);
    setNote(full.length ? boxesFull(full) : null);
    if (fit.length) noteNew(fit);
    if (list.length === 1 && fit.length === 1) { game.openCaches([fit[0].id]); setRevealing([fit[0]]); }
    else if (fit.length) setOpening(fit);
  }

  // The find being unveiled: keep it, or sell or release it (gone from the window too).
  const unveiled = revealing[0];
  function doneRevealing(letGo?: (id: string) => void) {
    if (letGo && unveiled) { letGo(unveiled.id); setShown((s) => s.filter((d) => d.id !== unveiled.id)); }
    setRevealing((r) => r.slice(1));
  }

  const isValidBarcode = useMemo(() => /^[0-9]{6,20}$/.test(barcode.trim()), [barcode]);
  const creaturePct = TOTAL_CREATURES === 0 ? 0 : Math.round((game.discoveredCreatures / TOTAL_CREATURES) * 100);
  const itemPct     = Math.round((game.discoveredItems / TOTAL_ITEMS) * 100);

  // The camera read a barcode: stop it and scan.
  function onCameraCode(digits: string) {
    setBarcode(digits);
    setScannerOn(false);
    scan(digits);
  }

  // What the window holds: the caches waiting, the sealed ones, then
  // (Looting) this visit's finds.
  const sealedTiles = game.sealed.map((code) => ({ sealedCode: code }));
  const slots = [...game.caches, ...sealedTiles, ...(storing ? [] : shown)].slice(0, WINDOW_COLS * WINDOW_ROWS);
  const rows = slots.length ? WINDOW_ROWS : 1;

  return (
    <DenFrame title="Soul Altar" icon="🔮" gold={game.gold}>

      <div data-tour="altar-progress" style={{ marginBottom: 16, maxWidth: 520 }}>
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

      {/* A new game's first scans (lib/firstScans.ts): Klutz on calibrating the altar, then on what it means. */}
      {game.hydrated && game.firstLeft > 0 && (
        <div className="stone-panel" style={{ marginBottom: 10, maxWidth: 520, display: "flex", gap: 10, alignItems: "center" }}>
          {CREATURE_SPRITES.klutz && <div style={{ flexShrink: 0 }}><PixelSprite sprite={CREATURE_SPRITES.klutz} scale={1.2} title="Klutz" /></div>}
          <div style={{ minWidth: 0 }}>
            <div className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0" }}>{game.calibrating ? <>🔧 Calibrating: {CALIBRATION_SCANS - calibrationLeft(game.firstScans)}/{CALIBRATION_SCANS}</> : <>✅ Calibrated!</>}</div>
            <p style={{ fontSize: 13, color: "#d8d4c8", margin: "4px 0 0" }}>{game.calibrating
              ? <>&ldquo;Here, have my scanner! It needs calibrating, so it&apos;s got {CALIBRATION_SCANS} free scans on it. Until then it finds nothing past Rare.&rdquo;</>
              : <>&ldquo;Oh wow, it&apos;s calibrated! You&apos;ve still got {game.firstLeft} free scans: use them while you can. Those barcodes open for real now.&rdquo;</>}</p>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 520 }}>
        <button className="scan-btn pixel-font" data-tour="scan" data-on={scannerOn}
          onClick={() => setScannerOn((s) => !s)}>
          {scannerOn ? "✖ Stop scanning" : "🔮 Scan Barcode"}
        </button>
        {/* Scans stored (lib/scanCharges.ts): one line, the countdown in it while below full. */}
        <div className="pixel-font" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, fontSize: 14, color: "#c9b48a", minHeight: 22 }}>
          {game.firstLeft > 0
            ? <span>Scans <b style={{ color: "#f1d9a0" }}>{game.firstLeft}/{FIRST_SCANS}</b></span>
            : <span>Scans <b style={{ color: charges.left ? "#f1d9a0" : "#ff8a80" }}>{charges.left}/{SCAN_MAX}</b>{nextIn !== null && <> · next in <b style={{ color: "#f1d9a0", fontVariantNumeric: "tabular-nums" }}>{clockText(nextIn)}</b></>}</span>}
          <Help title="Scans">
            <ul>
              {game.firstLeft > 0 && <li>Klutz&apos;s scanner comes with <b>{FIRST_SCANS}</b> free scans and no clock. The first <b>{CALIBRATION_SCANS}</b> calibrate it: they find nothing past Rare and aren&apos;t recorded, so once it&apos;s calibrated you can scan the same barcodes again for what they really hold. When the free scans are gone, stored scans start from 0.</li>}
              <li>You can store up to <b>{SCAN_MAX}</b> scans. Each barcode new to you uses one.</li>
              <li>Below {SCAN_MAX}, you get one back every <b>{SCAN_REGEN_MS / 60000} minutes</b>: {SCAN_MAX} every {SCAN_MAX * SCAN_REGEN_MS / 3600000} hours. Full, you get no more, so come back and scan while you can.</li>
              <li>Rescanning a barcode you&apos;ve already opened is free, and so is one that&apos;s too rare for you yet.</li>
            </ul>
          </Help>
        </div>
        {scannerOn && <BarcodeScanner onCode={onCameraCode} />}

        <div data-tour="scan-mode" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          {([["loot", "🎁 Looting"], ["store", "📦 Storage"]] as const).map(([mode, label]) => (
            <button key={mode} className="chip" data-active={game.scanMode === mode} onClick={() => { game.setScanMode(mode); setNote(null); }} style={{ flex: 1 }}>{label}</button>
          ))}
          <Help title="Code Caches">
            <HelpSection title="Every scan is a Code Cache">
              <ul>
                <li><b>Looting:</b> it opens straight away. What&apos;s inside goes to your things, and the window shows your latest {WINDOW_COLS * WINDOW_ROWS} finds until you leave the altar.</li>
                <li><b>Storage:</b> the cache waits in the window to open later.</li>
                <li>A find with no room in your Inventory (a box of weapons, armour or consumables at {BOX_CAP}, or {BIG_BOX_CAP} and then {BIGGER_BOX_CAP} once built bigger) waits as a cache too, until you make room.</li>
                <li>The altar holds <b>{CACHE_LIMIT}</b> caches. With {CACHE_LIMIT} waiting, scans fail: open some first.</li>
                {onlineConfig.ok && <li>No connection? A barcode new to you waits <b>sealed</b> 🔒 (it takes a space), and opens once you&apos;re back online: what every barcode holds is kept online, the same for every player.</li>}
                <li>Tap a cache to open it, or open them all.</li>
              </ul>
            </HelpSection>
          </Help>
        </div>

        {/* The loot window: laid out like your Inventory (each find loose on its
            rarity glow, its name under it), 3 wide, one row while empty. */}
        <div className="inv-panel" data-tour="altar-window" style={{ display: "grid", gridTemplateColumns: `repeat(${WINDOW_COLS}, minmax(0, 1fr))`, gap: 10, marginTop: 14 }}>
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

      {unveiled && (
        <ScanReveal key={unveiled.id} drop={unveiled} line={lines[unveiled.id]} isNew={fresh.get(unveiled.id)} sellValue={game.findValue(unveiled)}
          onKeep={() => doneRevealing()} onSell={() => doneRevealing(game.sellFind)} onRelease={() => doneRevealing(game.removeDrop)} />
      )}

      {opening && (
        <CodeCache title={opening.length === 1 ? "Code Cache" : "Code Caches"} items={opening} fresh={fresh} revealAllLabel="Extract all" doneLabel="Take it all"
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

      {/* Starting over is for everyone (your save is kept as the backup); the
          rest are testing tools, online only for the owner's account. */}
      <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.45, marginRight: "auto" }}>{tools ? "Testing tools · " : ""}<Link href="/settings" style={{ color: "inherit", textDecoration: "underline" }}>{tools ? "export your save first" : "Undo with Settings → Restore backup"}</Link></span>
        <button onClick={() => {
          if (!startArmed) { setStartArmed(true); window.setTimeout(() => setStartArmed(false), 4000); return; }
          setStartArmed(false);
          backupSave(window.localStorage);
          game.startNew();
          setShown([]);
          setStartedNew(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }} title="A brand-new game: progress, Labyrinth, Klutz, the quest, battle history and every barcode wiped"
          style={{ ...dangerBtn, color: startArmed ? "#1a1a1a" : "#f5c542", background: startArmed ? "#f5c542" : "transparent", borderColor: "rgba(245,197,66,0.6)" }}>
          {startArmed ? "Tap again to wipe everything" : "✨ Start new"}
        </button>
        {tools && <>
        {!game.tavern.blasted && (
          <button onClick={game.openRubbleForTesting} title="Open the rubble in the Den now, as if you'd done Klutz's quest and fetched the dynamite" style={dangerBtn}>
            🧨 Open the rubble
          </button>
        )}
        <button onClick={game.callVisitorForTesting} title="Have a visitor call at the tavern now: the merchant, librarian and collector in turn. Opens and repairs the tavern if it isn't yet." style={dangerBtn}>
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
        </>}
      </div>

      {tools && <>

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
      </>}

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
