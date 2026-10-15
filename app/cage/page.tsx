"use client";
// app/cage/page.tsx
// The cage in the Den. A new player's first creature is waiting in it, and
// creatures Klutz beats in the Labyrinth end up here. For each one: capture
// it (it's yours) or release it (gone for good — tap twice). You can't
// release your only creature.

import { useEffect, useState } from "react";
import { klutzStatus } from "@/lib/klutz";
import Link from "next/link";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";
import RaceTag from "@/components/RaceTag";
import ClassBadge from "@/components/ClassBadge";
import AbilityTag from "@/components/AbilityTag";
import { useGameState } from "@/hooks/useGameState";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";

export default function CagePage() {
  const game = useGameState();
  const [freed, setFreed] = useState<CreatureOrItemDrop | null>(null);
  const [released, setReleased] = useState<CreatureOrItemDrop | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // release asks twice
  const caged = game.caged as CreatureOrItemDrop[];
  const ownsAny = game.inventory.some((d) => d.dropType === "creature");

  const capture = (d: CreatureOrItemDrop) => { game.captureCaged(d.id); setFreed(d); };
  const release = (d: CreatureOrItemDrop) => {
    if (confirming !== d.id) { setConfirming(d.id); return; }
    game.releaseCaged(d.id);
    setConfirming(null);
    setReleased(d);
  };
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  return (
    <DenFrame title="Cage" icon="🔒">
      {game.hydrated && <KlutzWhere game={game} now={now} />}
      {!game.hydrated ? (
        <p style={{ color: MUTED }}>Loading…</p>
      ) : freed ? (
        <div className="stone-panel" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}><PixelSprite sprite={creatureSprite(freed.creatureId)} scale={4} /></div>
          <div className="pixel-font" style={{ fontSize: 22, color: RARITY_COLORS[freed.rarity].text, marginTop: 8 }}>{freed.name} is yours!</div>
          <p style={{ color: "#c8c4b8", fontSize: 14 }}>It&apos;s in your Creatures and on your roster. Give it some gear in the Pit.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/pit" className="pixel-btn">To the Pit</Link>
            <Link href="/" className="pixel-btn">Back to the Den</Link>
          </div>
        </div>
      ) : released ? (
        <div className="stone-panel" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", opacity: 0.45 }}><PixelSprite sprite={creatureSprite(released.creatureId)} scale={4} /></div>
          <div className="pixel-font" style={{ fontSize: 20, color: "#d8d4c8", marginTop: 8 }}>{released.name} scurries off into the dark.</div>
          <p style={{ color: "#c8c4b8", fontSize: 14 }}>It&apos;s back in the Labyrinth where it belongs.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {caged.length > 0 && <button className="pixel-btn" onClick={() => setReleased(null)}>Back to the cage</button>}
            <Link href="/" className="pixel-btn">Back to the Den</Link>
          </div>
        </div>
      ) : caged.length === 0 ? (
        <p style={{ color: MUTED }}>The cage is empty. Creatures Klutz beats in the Labyrinth are brought back here.</p>
      ) : (
        caged.map((d) => {
          const t = findCreatureTemplate(d.creatureId, d.name);
          return (
            <div key={d.id} className="stone-panel" style={{ textAlign: "center" }}>
              <p style={{ color: "#c8c4b8", fontSize: 14, margin: "0 0 10px" }}>Something is rattling the bars…</p>
              <div style={{ display: "flex", justifyContent: "center" }}><PixelSprite sprite={creatureSprite(d.creatureId)} scale={4} /></div>
              <div className="pixel-font" style={{ fontSize: 22, color: RARITY_COLORS[d.rarity].text, marginTop: 8 }}>{d.name}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 6 }}>
                <span className="pixel-font" style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color: RARITY_COLORS[d.rarity].text, border: `2px solid ${RARITY_COLORS[d.rarity].border}` }}>{d.rarity}</span>
                <RaceTag race={t?.race} />
                <ClassBadge cls={t?.cls} />
              </div>
              <AbilityTag ability={d.ability} />
              {t && <p style={{ color: "#a9a59a", fontSize: 13, fontStyle: "italic" }}>{t.flavour}</p>}
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 6 }}>
                <button className="pixel-btn" onClick={() => capture(d)}>🪢 Capture</button>
                <button className="pixel-btn" onClick={() => release(d)} disabled={!ownsAny}
                  title={ownsAny ? "Let it go back to the wild — it's gone for good" : "It's your only creature — you can't let it go"}
                  style={{ background: confirming === d.id ? "#6e1f18" : undefined, opacity: ownsAny ? 1 : 0.45 }}>
                  {confirming === d.id ? "Tap again to release" : "🔓 Release"}
                </button>
              </div>
              {!ownsAny && <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>It&apos;s your only creature — you can&apos;t let this one go.</p>}
              {confirming === d.id && <p style={{ fontSize: 12, color: "#ff8a80", margin: "6px 0 0" }}>Released creatures are gone for good.</p>}
            </div>
          );
        })
      )}
    </DenFrame>
  );
}

// Where Klutz is: he fills the cage with whatever he catches in the Labyrinth.
function KlutzWhere({ game, now }: { game: ReturnType<typeof useGameState>; now: number }) {
  const s = klutzStatus(game.klutz, game.klutzFighter.maxHp, now);
  const mins = (ms: number) => `${Math.max(1, Math.round(ms / 60000))} min`;
  const line = s.kind === "away"
    ? <>🌀 <b>Klutz is out hunting in the Labyrinth</b> — {mins(now - s.expedition.startedAt)} so far. Whatever he catches ends up in here.</>
    : s.kind === "healing"
      ? <>💤 <b>Klutz is soaking in the pool</b> — back on his feet in {mins(s.fullAt - now)}.</>
      : <>👺 <b>Klutz is wandering the Den.</b> Send him hunting and he&apos;ll bring what he catches back to this cage.</>;
  return (
    <div className="stone-panel" style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
      <span style={{ fontSize: 14, color: "#d8d4c8", lineHeight: 1.45, flex: "1 1 240px" }}>{line}</span>
      <Link href="/klutz" className="chip">{s.kind === "home" ? "Talk to Klutz" : "Check on Klutz"}</Link>
    </div>
  );
}
