"use client";
// app/training/page.tsx
// The Training Pit, in the tavern's room (lib/trainingPit.ts): built from the
// Hydra's plans, then one creature at a time trains in it, a level at a time.
// Its bar fills in real time and waits, full, until you tap Level up.

import Link from "next/link";
import { useEffect, useState } from "react";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import CreaturePortrait from "@/components/CreaturePortrait";
import { LevelBar } from "@/components/CreatureDetailModal";
import { MaterialIcon } from "@/components/PixelSprite";
import { useGameState } from "@/hooks/useGameState";
import { MATERIALS } from "@/lib/items/materials";
import { MAX_LEVEL } from "@/lib/creatures/levels";
import { loadDungeon } from "@/lib/dungeon/run";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { isCreatureDrop, type CreatureOrItemDrop } from "@/lib/types";
import { TRAINING_XP_PER_HOUR, canBuildPit, hasPitPlan, pitNeeds } from "@/lib/trainingPit";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

// "3h 20m", "45m", or "under a minute".
function wait(hours: number) {
  const m = Math.ceil(hours * 60);
  return m < 1 ? "under a minute" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function TrainingPage() {
  const game = useGameState();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(t); }, []);
  // The Hydra beaten (its plans), and who's out on a run (they can't train).
  // (Read once; the page shows nothing but "Loading…" until the save's in.)
  const [lab] = useState(() => loadDungeon());
  const deepClears = lab.meta.deepClears ?? 0;
  const onRun = lab.run?.party ?? [];

  const t = game.tavern;
  if (!game.hydrated) return <DenFrame title="Training Pit" icon="🏋️"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;
  if (!t.blasted || (!t.pit && !hasPitPlan(deepClears))) {
    return (
      <DenFrame title="Training Pit" icon="🏋️">
        <p style={{ color: MUTED }}>Nothing here yet.</p>
        <Link href="/" className="pixel-btn">← Back to the Den</Link>
      </DenFrame>
    );
  }

  const status = game.trainingStatus(now);
  const needs = pitNeeds(game.materials);
  const pickable = (game.inventory.filter(isCreatureDrop) as CreatureOrItemDrop[])
    .filter((c) => (c.level ?? 1) < MAX_LEVEL && !onRun.includes(c.id))
    .sort((a, b) => (b.level ?? 1) - (a.level ?? 1) || a.name.localeCompare(b.name));

  return (
    <DenFrame title="Training Pit" icon="🏋️" materials={t.pit ? undefined : game.materials} gold={t.pit ? undefined : game.gold}>
      <div className="stone-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 17, color: GOLD }}>{t.pit ? "The Training Pit" : "Plans for a Training Pit"}</div>
          <Help title="The Training Pit">
            <ul>
              <li>The plans came from the <b>Hydra</b>. Build it once, here in the tavern&apos;s room.</li>
              <li>Leave <b>one creature</b> in it and it trains on its own: <b>{TRAINING_XP_PER_HOUR} XP an hour</b>, even with the game shut.</li>
              <li>It stops when its XP bar is full. Come back and tap <b>Level up</b> to bank the level, and it trains on to the next.</li>
              <li>While it&apos;s in the pit it&apos;s <b>away training</b>: it can&apos;t go in the Labyrinth or duel. Take it out any time; it keeps the XP it&apos;s earned.</li>
            </ul>
          </Help>
        </div>

        {/* Not built yet: have / need, then Build. */}
        {!t.pit && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>Torn from the Hydra&apos;s lair: a pit where a creature trains while you&apos;re away.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              {needs.map(({ key, have, need }) => (
                <span key={key} className="pixel-font" style={{ fontSize: 13, color: have >= need ? "#5ee08a" : "#ff8a80" }}>
                  <MaterialIcon k={key} /> {have}/{need} {MATERIALS[key].name.toLowerCase()}
                </span>
              ))}
            </div>
            <button className="pixel-btn" disabled={!canBuildPit(t, game.materials, deepClears)} onClick={game.buildTrainingPit}>🔨 Build the Training Pit</button>
          </div>
        )}

        {/* Someone's training: their bar, how long to go, Level up and Take out. */}
        {t.pit && status && (() => {
          const c = status.creature;
          return (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <CreaturePortrait creatureId={c.creatureId} title={c.name} frame={{ width: 72, flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pixel-font" style={{ fontSize: 16, color: RARITY_COLORS[c.rarity].text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                  <LevelBar level={status.level} xp={status.xp + status.earned} />
                  <div style={{ fontSize: 12, color: status.full ? "#5ee08a" : MUTED, marginTop: 4 }}>
                    {status.full ? "Ready to level up!" : status.room === 0 ? "At the top level." : `Full in ${wait((status.room - status.earned) / TRAINING_XP_PER_HOUR)}`}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button className={`pixel-btn${status.full ? " tutorial-pulse" : ""}`} style={{ flex: 1, minHeight: 44 }} disabled={!status.full} onClick={game.levelUpTraining}>⬆️ Level up</button>
                <button className="pixel-btn" style={{ flex: 1, minHeight: 44 }} onClick={game.takeOutOfTraining}>Take out</button>
              </div>
            </div>
          );
        })()}

        {/* Empty: pick who trains. */}
        {t.pit && !status && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>The pit&apos;s empty. Who trains?</p>
            {pickable.length === 0 ? <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Nobody can train right now.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {pickable.map((c) => (
                  <button key={c.id} className="card-btn" style={{ minHeight: 44 }} onClick={() => game.trainCreature(c.id)}>
                    <b style={{ color: RARITY_COLORS[c.rarity].text, flex: 1, textAlign: "left" }}>{c.name}</b>
                    <span className="pixel-font" style={{ fontSize: 13, color: GOLD }}>Lv {c.level ?? 1}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DenFrame>
  );
}
