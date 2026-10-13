"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { useGameState } from "@/hooks/useGameState";
import { useDropGeneration } from "@/hooks/useDropGeneration";
import { TOTAL_CREATURES, TOTAL_ITEMS, RARITY_COLORS } from "@/lib/items/gameHelpers";
import { isRewardDrop, isItemDrop } from "@/lib/types";
import SellConfirmModal from "@/components/SellConfirmModal";
import InventoryList from "@/components/InventoryList";

export default function Home() {
  const game = useGameState();

  const [barcode, setBarcode]       = useState("");
  const [rollMode, setRollMode]     = useState<"random" | "deterministic">("random");
  const [scannerOn, setScannerOn]   = useState(false);
  const [scanStatus, setScanStatus] = useState("");

  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);
  const scanHandledRef  = useRef(false);

  const { generateDrop } = useDropGeneration({
    rollMode,
    scanCounts: game.scanCounts,
    onDrop:            game.addDrop,
    onScanCountUpdate: game.updateScanCount,
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

  const lastDrop = game.lastDrop;

  return (
    <main style={{ padding: 24, color: "white", maxWidth: 600, margin: "0 auto" }}>

      {game.showSellConfirm && (
        <SellConfirmModal
          items={game.selectedItemsForModal}
          totalGold={game.sellTotal}
          onConfirm={game.confirmSell}
          onCancel={() => game.setShowSellConfirm(false)}
        />
      )}

      <h1 style={{ marginBottom: 20 }}>Codex Creatures</h1>

      <div style={{ marginBottom: 20, maxWidth: 520 }}>
        <ProgressBar label="Creatures discovered" current={game.discoveredCreatures} total={TOTAL_CREATURES} pct={creaturePct} color="rgba(78,161,255,0.9)" />
        <ProgressBar label="Items discovered" current={game.discoveredItems} total={TOTAL_ITEMS} pct={itemPct} color="rgba(255,204,77,0.9)" />
      </div>

      <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 20 }}>
        💰 {game.gold.toLocaleString()}g
      </div>

      <input
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && isValidBarcode && generateDrop(barcode.trim())}
        placeholder="Enter barcode"
        style={{ padding: 10, width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 15, boxSizing: "border-box" }}
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
          style={{ padding: "10px 20px", borderRadius: 8, fontWeight: 700, fontSize: 15, border: "none", background: isValidBarcode ? "white" : "rgba(255,255,255,0.1)", color: isValidBarcode ? "black" : "rgba(255,255,255,0.3)", cursor: isValidBarcode ? "pointer" : "not-allowed" }}
        >
          Generate Drop
        </button>
        {(["random", "deterministic"] as const).map((mode) => (
          <button key={mode} onClick={() => setRollMode(mode)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: rollMode === mode ? "rgba(255,255,255,0.15)" : "transparent", color: "white", cursor: "pointer", fontWeight: rollMode === mode ? 700 : 400, fontSize: 13 }}>
            {mode === "random" ? "🎲 Random" : "🔒 Repeatable"}
          </button>
        ))}
      </div>

      {lastDrop && (
        <div style={{ marginTop: 18, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Last Drop:</span>
          {isRewardDrop(lastDrop) ? (
            <span style={{ fontSize: 16, color: "#f5c542", fontWeight: 600 }}>🪙 +{lastDrop.amount}g</span>
          ) : (
            <>
              <span style={{ fontSize: 16, fontWeight: 600, color: isItemDrop(lastDrop) ? RARITY_COLORS[lastDrop.rarity]?.text ?? "white" : "white" }}>
                {lastDrop.name}
              </span>
              <button
                onClick={() => game.toggleFavorite(lastDrop.id)}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", lineHeight: 1, color: game.favoriteIds.has(lastDrop.id) ? "#f5c542" : "rgba(255,255,255,0.25)" }}
                title={game.favoriteIds.has(lastDrop.id) ? "Unfavorite" : "Favourite"}
              >
                {game.favoriteIds.has(lastDrop.id) ? "★" : "☆"}
              </button>
              {isItemDrop(lastDrop) && (
                <span style={{ fontSize: 11, opacity: 0.35, marginLeft: "auto" }}>tap in inventory for details</span>
              )}
            </>
          )}
        </div>
      )}

      <InventoryList
        inventory={game.inventory}
        filteredInventory={game.filteredInventory}
        equipment={game.equipment}
        equippedOn={game.equippedOn}
        lockedIds={game.lockedIds}
        onEquip={game.equipItem}
        tabCounts={game.tabCounts}
        activeTab={game.activeTab}
        onTabChange={game.setActiveTab}
        favoriteIds={game.favoriteIds}
        onToggleFavorite={game.toggleFavorite}
        sellMode={game.sellMode}
        selectedForSale={game.selectedForSale}
        onToggleSelectItem={game.toggleSelectItem}
        onSelectAll={game.selectAllInView}
        onDeselectAll={game.deselectAll}
        sellTotal={game.sellTotal}
        onOpenSellConfirm={() => game.setShowSellConfirm(true)}
        onToggleSellMode={game.toggleSellMode}
        onResetAll={game.resetAll}
        onGlobalReset={game.globalReset}
      />

    </main>
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