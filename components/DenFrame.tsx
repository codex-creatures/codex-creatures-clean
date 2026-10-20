"use client";
// components/DenFrame.tsx
// A screen opened from the Den (altar, chest, pit, the Labyrinth…), built to
// fill the game screen (components/GameScreen.tsx) exactly:
// - a header bar along the top: back, the title, your gold (`backLocked`
//   greys out the way back: e.g. mid-fight in the Labyrinth);
// - with `materials`, a strip under it: your gold and each material's count;
// - the content, scrolling inside itself (or, with `fill`, given the whole
//   space to lay out as it likes: a battle);
// - an optional dock along the bottom, built into the screen (`dock`).

import Link from "next/link";
import GoldCount from "./GoldCount";
import { MATERIALS, MATERIAL_KEYS, type Materials } from "@/lib/items/materials";

export default function DenFrame({
  title, icon, gold, materials, back = "/", backLabel = "Den", backLocked, onBack, fill, dock, children,
}: {
  title: string;
  icon?: string;
  gold?: number;
  materials?: Materials; // show the strip of gold and materials (the Inventory)
  back?: string;
  backLabel?: string;
  backLocked?: string; // why you can't go back right now (shown on tap/hover)
  onBack?: () => void; // going back needs a word first (leaving the Labyrinth ends the run)
  width?: number; // (no longer used: every screen is the game screen's width)
  fill?: boolean;
  dock?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="screen-page">
      <header className="screen-header">
        {backLocked
          ? <span className="pixel-font" title={backLocked} aria-disabled style={{ color: "#c9b48a", opacity: 0.35, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "not-allowed" }}>🔒 {backLabel}</span>
          : onBack
          ? <button onClick={onBack} className="pixel-font" style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "#c9b48a", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>← {backLabel}</button>
          : <Link href={back} className="pixel-font" style={{ color: "#c9b48a", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>← {backLabel}</Link>}
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 19, color: "#f1d9a0", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60cqw" }}>
          {icon ? `${icon} ` : ""}{title}
        </h1>
        <span style={{ textAlign: "right" }}>{gold !== undefined && !materials && <GoldCount gold={gold} />}</span>
      </header>
      {materials && (
        <div className="screen-wallet pixel-font">
          {gold !== undefined && <GoldCount gold={gold} />}
          {/* Every material, even at 0, so nothing shifts as counts change. */}
          {MATERIAL_KEYS.map((k) => (
            <span key={k} title={MATERIALS[k].name} style={{ opacity: materials[k] ? 1 : 0.4, whiteSpace: "nowrap" }}>
              {MATERIALS[k].icon} {materials[k] ?? 0}
            </span>
          ))}
        </div>
      )}
      <div className={fill ? "screen-fill" : "screen-scroll"}>{children}</div>
      {dock && <footer className="screen-dock">{dock}</footer>}
    </main>
  );
}
