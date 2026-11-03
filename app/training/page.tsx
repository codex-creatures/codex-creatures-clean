"use client";
// app/training/page.tsx
// The pit in the tavern's room (lib/trainingPit.ts): the Sparring Pit, there
// once the rubble's open, then the Training Pit built over it from the Hydra
// quest's plans. One creature at a time trains in it, a level at a time: its
// bar fills in real time and waits, full, until you tap Level up.

import Link from "next/link";
import { useEffect, useState } from "react";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import CreaturePortrait from "@/components/CreaturePortrait";
import { LevelBar } from "@/components/CreatureDetailModal";
import { MaterialIcon } from "@/components/PixelSprite";
import { useGameState } from "@/hooks/useGameState";
import { MAX_LEVEL } from "@/lib/creatures/levels";
import { loadDungeon } from "@/lib/dungeon/run";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { isCreatureDrop, type CreatureOrItemDrop } from "@/lib/types";
import { SPARRING_XP_PER_HOUR, TRAINING_XP_PER_HOUR, canBuildPit, hasPit, lifetimeXp, pitNeeds, pitRate } from "@/lib/trainingPit";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";
const GREEN = "#5ee08a";
const RED = "#ff8a80";
// The pits' pictures (the same art as in the tavern's room, components/TavernRoom.tsx).
const PIT_ART = { sparring: "/sprites/den/sparring-pit-3.png", training: "/sprites/den/training-pit.png" };
const pixelated = { display: "block", width: "100%", height: "auto", imageRendering: "pixelated" } as const;

// "3h 20m", "45m", or "under a minute".
function wait(hours: number) {
  const m = Math.ceil(hours * 60);
  return m < 1 ? "under a minute" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function TrainingPage() {
  const game = useGameState();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(t); }, []);
  // Who's out on a run (they can't train). (Read once; the page shows nothing
  // but "Loading…" until the save's in.)
  const [onRun] = useState(() => loadDungeon().run?.party ?? []);

  const t = game.tavern;
  const name = t.pit ? "Training Pit" : "Sparring Pit";
  if (!game.hydrated) return <DenFrame title="Pit" icon="🏋️"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;
  if (!hasPit(t)) {
    return (
      <DenFrame title="Pit" icon="🏋️">
        <p style={{ color: MUTED }}>Nothing here yet.</p>
        <Link href="/" className="pixel-btn">← Back to the Den</Link>
      </DenFrame>
    );
  }

  const status = game.trainingStatus(now);
  const rate = pitRate(t);
  const needs = pitNeeds(game.materials);
  const pickable = (game.inventory.filter(isCreatureDrop) as CreatureOrItemDrop[])
    .filter((c) => (c.level ?? 1) < MAX_LEVEL && !onRun.includes(c.id))
    .sort((a, b) => (b.level ?? 1) - (a.level ?? 1) || a.name.localeCompare(b.name));

  return (
    <DenFrame title={name} icon="🏋️">
      <div className="stone-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 17, color: GOLD }}>{name}</div>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD, marginLeft: "auto" }}>{rate} XP/h</div>
          <Help title={name}>
            <ul>
              <li>Leave <b>one creature</b> here and it trains on its own: <b>{SPARRING_XP_PER_HOUR} XP an hour</b> in the Sparring Pit, <b>{TRAINING_XP_PER_HOUR}</b> in the Training Pit, even with the game shut.</li>
              <li>It stops when its XP bar is full. Come back and tap <b>Level up</b> to bank the level, and it trains on to the next.</li>
              <li>While it&apos;s here it&apos;s <b>away training</b>: it can&apos;t go in the Labyrinth or duel. Take it out any time; it keeps the XP it&apos;s earned.</li>
              <li><b>Lifetime</b>: all the XP the pit has trained into your creatures.</li>
              <li>The <b>Training Pit</b>&apos;s plans come from the <b>Hydra quest</b> on the quest board, once you&apos;ve beaten the Cyclops.</li>
            </ul>
          </Help>
        </div>

        {/* The pit itself, and everything it's trained. */}
        <div style={{ width: "62%", margin: "8px auto 0" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.pit ? PIT_ART.training : PIT_ART.sparring} alt={`The ${name}`} draggable={false} style={pixelated} />
        </div>
        <div className="pixel-font" style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: GOLD, padding: "6px 8px", marginTop: 6, background: "rgba(0,0,0,0.25)" }}>
          <span style={{ color: MUTED }}>Lifetime</span>
          <span>{(lifetimeXp(t) + (status?.earned ?? 0)).toLocaleString()} XP</span>
        </div>

        {/* Someone's training: their bar, how long to go, Level up and Take out. */}
        {status && (() => {
          const c = status.creature;
          return (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <CreaturePortrait creatureId={c.creatureId} title={c.name} frame={{ width: 72, flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pixel-font" style={{ fontSize: 16, color: RARITY_COLORS[c.rarity].text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                  <LevelBar level={status.level} xp={status.xp + status.earned} />
                  <div style={{ fontSize: 12, color: status.full ? GREEN : MUTED, marginTop: 4 }}>
                    {status.full ? "Ready to level up!" : status.room === 0 ? "At the top level." : `Full in ${wait((status.room - status.earned) / rate)}`}
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
        {!status && (
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

      {/* With the Hydra quest's plans: build the Training Pit over it. */}
      {t.plans && !t.pit && (
        <div className="stone-panel" style={{ marginTop: 10 }}>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD }}>📐 Training Pit Schematic</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
            <div style={{ flex: "1 1 55%", minWidth: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PIT_ART.training} alt="The Training Pit" draggable={false} style={pixelated} />
            </div>
            <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {needs.map(({ key, have, need }) => (
                <span key={key} className="pixel-font" style={{ fontSize: 14, color: have >= need ? GREEN : RED, whiteSpace: "nowrap" }}>
                  <MaterialIcon k={key} /> {have}/{need}
                </span>
              ))}
            </div>
          </div>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD, textAlign: "center", margin: "8px 0" }}>
            {SPARRING_XP_PER_HOUR} → <span style={{ color: GREEN }}>{TRAINING_XP_PER_HOUR} XP/h</span>
          </div>
          <button className="pixel-btn" style={{ width: "100%", minHeight: 44 }} disabled={!canBuildPit(t, game.materials)} onClick={game.buildTrainingPit}>🔨 Build it</button>
        </div>
      )}
    </DenFrame>
  );
}
