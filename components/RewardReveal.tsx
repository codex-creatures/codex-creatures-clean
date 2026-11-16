"use client";
// components/RewardReveal.tsx: a campaign reward that comes in a container (lib/campaign.ts: the Materials
// or Supplies Crate, the Gear Barrel, the Codex Bookcase) shown in 3D before its loot (the user,
// 2026-11-16). Tap it and it opens; a moment later `onOpen` hands over to the loot window. A fixed frame
// over the screen: the name, the 3D view, one line under it.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { RewardModel } from "@/lib/campaign";

const RewardScene3D = dynamic(() => import("./RewardScene3D"), { ssr: false });
const OPEN_MS = 700; // from the tap to the loot window: long enough to see it open

export default function RewardReveal({ title, model, onOpen }: { title: string; model: RewardModel; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const done = useRef(onOpen); // (the latest: the board re-rendering mustn't restart the wait)
  useEffect(() => { done.current = onOpen; }, [onOpen]);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => done.current(), OPEN_MS);
    return () => window.clearTimeout(t);
  }, [open]);
  return (
    <div role="dialog" aria-label={title} onClick={() => setOpen(true)}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: "12cqh", gap: 10, cursor: "pointer" }}>
      <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "90%" }}>{title}</div>
      <div style={{ width: "80cqw", aspectRatio: "4 / 3", borderRadius: 10, overflow: "hidden", border: "2px solid #6b5a40" }}>
        <RewardScene3D model={model} open={open} />
      </div>
      <div className="pixel-font" style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", minHeight: 20 }}>{open ? "…" : "Tap to open"}</div>
    </div>
  );
}
