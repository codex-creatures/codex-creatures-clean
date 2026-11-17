"use client";
// app/lab/den/page.tsx — 🧪 the new Den (components/Den3D.tsx; the user, 2026-11-18) in a phone-sized
// box, with switches for what the game would hand it: the rubble (shut, the dynamite in hand, blown),
// Klutz home, resting or away, visitors in the tavern, the tavern repaired and its pit. Taps go where
// the game's would. Nothing is saved; the game doesn't use it.

import { useState } from "react";
import dynamic from "next/dynamic";
import type { TavernQuest } from "@/lib/tavern";
import type { KlutzMode } from "@/lib/den/scene";
import type { Rubble } from "@/components/DenRoom";

const Den3D = dynamic(() => import("@/components/Den3D"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });

export default function DenLab() {
  const [rubble, setRubble] = useState<Rubble>("dynamite");
  const [klutz, setKlutz] = useState<KlutzMode>("home");
  const [repaired, setRepaired] = useState(true);
  const [visitors, setVisitors] = useState(true);
  const [pit, setPit] = useState(true);
  const [key, setKey] = useState(0);
  const btn = (on: boolean) => ({ minHeight: 44, padding: "0 10px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
  // A tavern as the game keeps it, with a merchant and a librarian calling (lib/tavern.ts tavernVisitors).
  const [now] = useState(() => Date.now());
  const tavern: TavernQuest = { accepted: true, dynamite: true, blasted: rubble === "open", repaired, pit,
    guests: visitors ? { merchant: { until: now + 3_600_000 }, librarian: { until: now + 3_600_000 } } : undefined };
  return (
    <div style={{ background: "#111", color: "#f1d9a0", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>The new Den</h1>
      <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 8px", maxWidth: 400 }}>Drag to look round; tap a place (it goes there, as in the game). Stand-ins where the art isn&apos;t made yet.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, maxWidth: 400 }}>
        {(["shut", "dynamite", "open"] as Rubble[]).map((r) => <button key={r} style={btn(rubble === r)} onClick={() => { setRubble(r); setKey((n) => n + 1); }}>Rubble: {r}</button>)}
        {(["home", "pool", "away"] as KlutzMode[]).map((m) => <button key={m} style={btn(klutz === m)} onClick={() => setKlutz(m)}>Klutz: {m}</button>)}
        <button style={btn(repaired)} onClick={() => setRepaired(!repaired)}>Tavern repaired</button>
        <button style={btn(visitors)} onClick={() => setVisitors(!visitors)}>Visitors</button>
        <button style={btn(pit)} onClick={() => setPit(!pit)}>Pit + portal</button>
      </div>
      <div style={{ position: "relative", width: 390, height: 560, maxWidth: "100%", borderRadius: 8, overflow: "hidden", containerType: "size" }}>
        <Den3D key={key} rubble={rubble} onBlast={() => setRubble("open")} klutz={klutz} klutzNews={false} tavern={tavern} pit={pit ? { ready: true } : undefined}
          tavernNews={visitors} boardNews crateNews={false} cageNews caged="dire_wolf" />
      </div>
    </div>
  );
}
