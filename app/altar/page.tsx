"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { useGameState } from "@/hooks/useGameState";
import { useDropGeneration } from "@/hooks/useDropGeneration";
import { TOTAL_CREATURES, TOTAL_ITEMS, RARITY_COLORS } from "@/lib/items/gameHelpers";
import { isRewardDrop, isItemDrop, type Drop } from "@/lib/types";
import Link from "next/link";
import DenFrame from "@/components/DenFrame";
import InventoryList from "@/components/InventoryList";
import { RECENT_SCANS } from "@/hooks/useGameState";
import CodeCache from "@/components/CodeCache";
import { playerXpToNext, SCAN_UNLOCK } from "@/lib/creatures/levels";
import type { Rarity } from "@/lib/types";

const CACHES_AT_ONCE = 10; // caches opened together (the 2×5 grid)

// The Soul Altar: scan or type a barcode to get a Code Cache. In
// Looting mode it opens straight away; in Storage mode it's kept here, to
// open (ten at a time) whenever you like.
export default function AltarPage() {
  const game = useGameState();

  const [barcode, setBarcode]       = useState("");
  const [rollMode, setRollMode]     = useState<"random" | "deterministic">("random");
  const [scannerOn, setScannerOn]   = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [startArmed, setStartArmed] = useState(false); // "Start new" asks for a second tap
  const [startedNew, setStartedNew] = useState(false);
  const [lastScan, setLastScan]     = useState<Drop[]>([]); // what the latest scan gave
  const [lastStored, setLastStored] = useState(false);      // …or was it stored as a Code Cache?
  const [opening, setOpening]       = useState<Drop[] | null>(null); // stored caches being opened
  const [sealed, setSealed]         = useState<{ rarity: Rarity; need: number } | null>(null); // a creature too rare for you yet

  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);
  const scanHandledRef  = useRef(false);

  const { generateDrop } = useDropGeneration({
    rollMode,
    scanCounts: game.scanCounts,
    onDrop:            game.addScan,
    onScan:            (drops) => { setLastScan(drops); setLastStored(game.scanMode === "store"); setSealed(null); },
    onScanCountUpdate: game.updateScanCount,
    playerLevel:       game.player.level,
    onSealed:          (rarity, need) => { setSealed({ rarity, need }); setLastScan([]); },
  });

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
              setTimeout(() => generateDrop(digits), 0);
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


  return (
    <DenFrame title="Soul Altar" icon="🔮" gold={game.gold}>

      <div style={{ marginBottom: 20, maxWidth: 520 }}>
        <ProgressBar label="Creatures discovered" current={game.discoveredCreatures} total={TOTAL_CREATURES} pct={creaturePct} color="rgba(78,161,255,0.9)" />
        <ProgressBar label="Items discovered" current={game.discoveredItems} total={TOTAL_ITEMS} pct={itemPct} color="rgba(255,204,77,0.9)" />
        <div className="pixel-font" style={{ fontSize: 14, color: "#c9b48a", marginTop: 4 }}>📊 Total scans: <b style={{ color: "#f1d9a0" }}>{game.totalScans.toLocaleString()}</b></div>
        <ExplorerLevel level={game.player.level} xp={game.player.xp} />
      </div>

      {/* Straight to what you've found, without going back through the Den. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20, maxWidth: 520 }}>
        <Link href="/pit" className="card-btn" style={{ justifyContent: "center" }}>
          <span className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>🐾 Creatures</span>
        </Link>
        <Link href="/chest" className="card-btn" style={{ justifyContent: "center" }}>
          <span className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>🧰 Items</span>
        </Link>
      </div>

      {startedNew && (
        <div className="stone-panel" style={{ marginBottom: 10, borderColor: "#c9a24a" }}>
          <div className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0" }}>✨ A fresh start</div>
          <p style={{ fontSize: 13, color: "#d8d4c8", margin: "4px 0 0" }}>Everything&apos;s wiped, every barcode included. Scan your first one below — then head back to the Den: there&apos;s something rattling in the cage.</p>
        </div>
      )}

      <input
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && isValidBarcode && generateDrop(barcode.trim())}
        placeholder="Enter barcode"
        className="pixel-input"
      />

      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => { scanHandledRef.current = false; if (!scannerOn) setScanStatus("Starting camera..."); setScannerOn((s) => !s); }}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: scannerOn ? "white" : "transparent", color: scannerOn ? "black" : "white", cursor: "pointer", fontWeight: 600 }}
        >
          {scannerOn ? "Stop Scanner" : "📷 Scan Barcode"}
        </button>
        {scanStatus && <span style={{ fontSize: 13, opacity: 0.6 }}>{scanStatus}</span>}
      </div>

      {scannerOn && <video ref={videoRef} muted playsInline style={{ marginTop: 12, width: "100%", maxWidth: 520, borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)" }} />}

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => generateDrop(barcode.trim())}
          disabled={!isValidBarcode}
          className="pixel-btn"
        >
          🔮 Generate Drop
        </button>
        {(["random", "deterministic"] as const).map((mode) => (
          <button key={mode} onClick={() => setRollMode(mode)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: rollMode === mode ? "rgba(255,255,255,0.15)" : "transparent", color: "white", cursor: "pointer", fontWeight: rollMode === mode ? 700 : 400, fontSize: 13 }}>
            {mode === "random" ? "🎲 Random" : "🔒 Repeatable"}
          </button>
        ))}
      </div>

      {/* Looting or Storage */}
      <div className="stone-panel" style={{ marginTop: 18, maxWidth: 520 }}>
        <div className="pixel-font" style={{ fontSize: 14, color: "#f1d9a0", marginBottom: 8 }}>Every scan is a Code Cache</div>
        <div style={{ display: "flex", gap: 8 }}>
          {([["loot", "🎁 Looting", "Open each cache as you scan it."], ["store", "📦 Storage", "Keep them here and open them later."]] as const).map(([mode, label, hint]) => (
            <button key={mode} className="chip" data-active={game.scanMode === mode} onClick={() => game.setScanMode(mode)} title={hint} style={{ flex: 1 }}>{label}</button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: "8px 0 0" }}>
          {game.scanMode === "loot" ? "Looting: each scan's cache opens straight away and goes where it belongs." : "Storage: caches wait here. Open them whenever you like — one by one, or extract them all."}
        </p>
        {game.caches.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {game.caches.slice(0, CACHES_AT_ONCE).map((c) => (
                <div key={c.id} className="cache-sealed" style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", background: "#23262f", border: "3px solid #12131a", boxShadow: "inset 3px 3px 0 #3a3e4b, inset -3px -3px 0 #181a21" }}>
                  <span className="pixel-font" style={{ fontSize: 20, color: "#8fc1ff", textShadow: "0 0 8px rgba(143,193,255,0.8)" }}>?</span>
                </div>
              ))}
            </div>
            <button className="pixel-btn" style={{ marginTop: 10 }} onClick={() => setOpening(game.caches.slice(0, CACHES_AT_ONCE))}>
              📦 Open {Math.min(CACHES_AT_ONCE, game.caches.length)} Code Cache{game.caches.length === 1 ? "" : "s"}{game.caches.length > CACHES_AT_ONCE ? ` (of ${game.caches.length})` : ""}
            </button>
          </div>
        )}
      </div>
      {opening && (
        <CodeCache title="Code Caches" items={opening} revealAllLabel="Extract all" doneLabel="Take it all"
          intro="Tap a cache to crack it open, or extract them all at once."
          onDone={() => { game.openCaches(opening.map((d) => d.id)); setOpening(null); }} />
      )}

      {sealed && (
        <div style={{ marginTop: 18, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 15 }}>
          🔒 Something <b style={{ color: RARITY_COLORS[sealed.rarity]?.text, textTransform: "capitalize" }}>{sealed.rarity}</b> stirs in this barcode — too strong for you yet.
          Come back at explorer level <b>{sealed.need}</b>.
        </div>
      )}

      {lastScan.length > 0 && lastStored && (
        <div style={{ marginTop: 18, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 15 }}>
          📦 A Code Cache — stored. You have <b>{game.caches.length}</b> waiting.
        </div>
      )}

      {lastScan.length > 0 && !lastStored && (
        <div style={{ marginTop: 18, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}>
          <div style={{ fontSize: 11, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            That scan gave{lastScan.length > 1 ? ` ${lastScan.length} things` : ""}:
          </div>
          {lastScan.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0" }}>
              {isRewardDrop(d) ? (
                <span style={{ fontSize: 16, color: "#f5c542", fontWeight: 600 }}>🪙 +{d.amount}g</span>
              ) : (
                <>
                  <span style={{ fontSize: 16, fontWeight: 600, color: RARITY_COLORS[d.rarity]?.text ?? "white" }}>
                    {d.dropType === "card" ? "🃏 " : d.dropType === "creature" ? "🐾 " : ""}{d.name}{d.dropType === "card" ? " card" : ""}
                  </span>
                  <button
                    onClick={() => game.toggleFavorite(d.id)}
                    style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", lineHeight: 1, color: game.favoriteIds.has(d.id) ? "#f5c542" : "rgba(255,255,255,0.25)" }}
                    title={game.favoriteIds.has(d.id) ? "Unfavorite" : "Favourite"}
                  >
                    {game.favoriteIds.has(d.id) ? "★" : "☆"}
                  </button>
                  <Link href={isItemDrop(d) ? "/chest" : "/pit"} className="pixel-font" style={{ fontSize: 13, color: "#c9b48a", marginLeft: "auto", whiteSpace: "nowrap" }}>
                    {isItemDrop(d) ? "→ Chest" : "→ The Pit"}
                  </Link>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Your last scans — tap one to see it in full again. */}
      <InventoryList
        title="Recent scans"
        tabs={[]}
        showSell={false}
        emptyText="Nothing scanned yet."
        inventory={game.inventory}
        filteredInventory={game.recentScans}
        equipment={game.equipment}
        equippedOn={game.equippedOn}
        lockedIds={game.lockedIds}
        onEquip={game.equipItem}
        onSetMoves={game.setMoves}
        onSummon={game.summon}
        tabCounts={game.tabCounts}
        activeTab={game.activeTab}
        onTabChange={game.setActiveTab}
        favoriteIds={game.favoriteIds}
        onToggleFavorite={game.toggleFavorite}
        sellMode={false}
        selectedForSale={game.selectedForSale}
        onToggleSelectItem={game.toggleSelectItem}
        onSelectAll={game.selectAllInView}
        onDeselectAll={game.deselectAll}
        sellTotal={0}
        onOpenSellConfirm={() => {}}
        onToggleSellMode={() => {}}
      />
      <p style={{ fontSize: 11, opacity: 0.35, margin: "6px 0 0" }}>Your last {RECENT_SCANS} finds, newest first. Sold items and summoned cards drop off the list.</p>

      <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.45, marginRight: "auto" }}>Testing tools</span>
        <button onClick={() => {
          if (!startArmed) { setStartArmed(true); window.setTimeout(() => setStartArmed(false), 4000); return; }
          setStartArmed(false);
          game.startNew();
          setStartedNew(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }} title="A brand-new game: progress, Labyrinth, Klutz, the quest, battle history and every barcode wiped"
          style={{ ...dangerBtn, color: startArmed ? "#1a1a1a" : "#f5c542", background: startArmed ? "#f5c542" : "transparent", borderColor: "rgba(245,197,66,0.6)" }}>
          {startArmed ? "Tap again to wipe everything" : "✨ Start new"}
        </button>
        <button onClick={game.resetAll} title="Wipe your progress (inventory, gold, labyrinth) but keep registered barcodes — test as a new player" style={dangerBtn}>Reset Player</button>
        <button onClick={game.globalReset} title="Wipe the barcode registry — every barcode rolls fresh on its next scan. Inventory is kept." style={dangerBtn}>Global Reset</button>
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
