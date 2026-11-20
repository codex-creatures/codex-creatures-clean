"use client";
// app/cage/page.tsx
// The cage in the Den (it holds cageSize creatures: 1, or 3 once the iron
// cage is built). A new
// player's first creature is waiting in it, and
// creatures Klutz beats in the Labyrinth end up here. For each one: capture
// it (it's yours) or release it (gone for good — tap twice). You can't
// release your only creature.

import { useEffect, useState } from "react";
import { klutzStatus } from "@/lib/klutz";
import Link from "next/link";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";
import RaceTag from "@/components/RaceTag";
import SoulStoneTag from "@/components/SoulStoneTag";
import { useGameState } from "@/hooks/useGameState";
import { findCreatureTemplate, resolveMoves, type CreatureTemplate } from "@/lib/creatures/creatureData";
import { STATS, type StatKey } from "@/components/CreatureDetailModal";
import { MoveTile } from "@/components/MoveTile";
import Glyph from "@/components/Glyph";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { CreatureOrItemDrop } from "@/lib/types";
import Help from "@/components/Help";
import { CAGE_LEVELS } from "@/lib/items/materials";
import PlanBuild, { heldOf } from "@/components/PlanBuild";

const MUTED = "rgba(255,255,255,0.5)";

export default function CagePage() {
  const game = useGameState();
  const [freed, setFreed] = useState<CreatureOrItemDrop | null>(null);
  const [released, setReleased] = useState<CreatureOrItemDrop | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // release asks twice
  const [viewing, setViewing] = useState<string | null>(null);       // a creature's stats, shown
  const caged = game.caged as CreatureOrItemDrop[];
  const ownsAny = game.inventory.some((d) => d.dropType === "creature");

  const capture = (d: CreatureOrItemDrop) => { game.captureCaged(d.id); setFreed(d); setReleased(null); setConfirming(null); };
  const release = (d: CreatureOrItemDrop) => {
    if (confirming !== d.id) { setConfirming(d.id); return; }
    game.releaseCaged(d.id);
    setConfirming(null);
    setReleased(d);
    setFreed(null);
  };
  // While others are still caged, the last capture or release is just a line
  // above them, so you can deal with the whole cage without leaving it. The
  // big panels below are for when the cage is empty.
  const last = freed ?? released;
  const others = caged.length > 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  return (
    <DenFrame title="Cage" icon="🔒">
      {game.hydrated && <KlutzWhere game={game} now={now} />}
      {game.hydrated && <CageUpgrade game={game} />}
      {!game.hydrated ? (
        <p style={{ color: MUTED }}>Loading…</p>
      ) : freed && !others ? (
        <div className="stone-panel" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}><PixelSprite sprite={creatureSprite(freed.creatureId)} scale={4} /></div>
          <div className="pixel-font" style={{ fontSize: 22, color: RARITY_COLORS[freed.rarity].text, marginTop: 8 }}>{freed.name} is yours!</div>
          <p style={{ color: "#c8c4b8", fontSize: 14 }}>It&apos;s in your Creatures. Open it to add it to a Labyrinth team, and give it some gear in the Pit.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {game.quest.stage === "start"
              ? <Link href="/klutz" className="pixel-btn tutorial-pulse">👺 Back to Klutz</Link>
              : <Link href="/pit" className="pixel-btn">To the Pit</Link>}
            <Link href="/" className="pixel-btn">Back to the Den</Link>
          </div>
        </div>
      ) : released && !others ? (
        <div className="stone-panel" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", opacity: 0.45 }}><PixelSprite sprite={creatureSprite(released.creatureId)} scale={4} /></div>
          <div className="pixel-font" style={{ fontSize: 20, color: "#d8d4c8", marginTop: 8 }}>{released.name} scurries off into the dark.</div>
          <p style={{ color: "#c8c4b8", fontSize: 14 }}>It&apos;s back in the Labyrinth where it belongs.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/" className="pixel-btn">Back to the Den</Link>
          </div>
        </div>
      ) : caged.length === 0 ? (
        <p style={{ color: MUTED }}>The cage is empty. Creatures Klutz beats in the Labyrinth are brought back here.</p>
      ) : (
        <>
        {last && (
          <div className="stone-panel" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ opacity: freed ? 1 : 0.45 }}><PixelSprite sprite={creatureSprite(last.creatureId)} scale={2} /></div>
            <div style={{ fontSize: 14, color: freed ? RARITY_COLORS[last.rarity].text : "#d8d4c8" }}>
              {freed ? <><b>{last.name}</b> is yours! It&apos;s in your Creatures.</> : <><b>{last.name}</b> scurries off into the dark.</>}
            </div>
          </div>
        )}
        {caged.map((d) => {
          const t = findCreatureTemplate(d.creatureId, d.name);
          return (
            <div key={d.id} className="stone-panel" style={{ textAlign: "center" }}>
              <p style={{ color: "#c8c4b8", fontSize: 14, margin: "0 0 10px" }}>Something is rattling the bars…</p>
              <div style={{ display: "flex", justifyContent: "center" }}><PixelSprite sprite={creatureSprite(d.creatureId)} scale={4} /></div>
              <div className="pixel-font" style={{ fontSize: 22, color: RARITY_COLORS[d.rarity].text, marginTop: 8 }}>{d.name}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 6 }}>
                <span className="pixel-font" style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color: RARITY_COLORS[d.rarity].text, border: `2px solid ${RARITY_COLORS[d.rarity].border}` }}>{d.rarity}</span>
                <RaceTag race={t?.race} races={t?.races} />
              </div>
              <SoulStoneTag stone={d.soulStone} />
              <button className="chip" onClick={() => setViewing(viewing === d.id ? null : d.id)} style={{ marginBottom: 8 }}>
                {viewing === d.id ? "Hide its stats" : "📜 View its stats"}
              </button>
              {viewing === d.id && t && <CagedStats d={d} t={t} />}
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
        })}
        </>
      )}
    </DenFrame>
  );
}

// How many the cage holds, and building it up from a schematic you've found: the iron cage (a mini boss's
// chest), then the reinforced one (the Hydra's chests and deeper, or a merchant: lib/items/plans.ts).
const CAGE_NAMES = ["Old cell", "Iron cage", "Reinforced cage"];
function CageUpgrade({ game }: { game: ReturnType<typeof useGameState> }) {
  const plan = heldOf(game.inventory, game.cage < 2 ? ["iron_cage", "reinforced_cage"] : game.cage < 3 ? ["reinforced_cage"] : [])[0];
  return (
    <div className="stone-panel" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>
          {CAGE_NAMES[Math.min(CAGE_NAMES.length, game.cage) - 1]} · {game.caged.length}/{game.cageSize}
        </div>
        <Help title="The cage">
          <ul>
            <li>Klutz&apos;s catches wait here. If it&apos;s full, he <b>lets them go</b> (and keeps their gear).</li>
            <li>The <b>Iron Cage Schematic</b> (sometimes in a <b>mini boss&apos;s chest</b>) builds it up to <b>{CAGE_LEVELS[1]}</b>.</li>
            <li>Then the <b>Reinforced Cage Schematic</b> (chests from the <b>Hydra</b> on, or a merchant) builds it up to <b>{CAGE_LEVELS[2]}</b>.</li>
          </ul>
        </Help>
      </div>
      {plan && <PlanBuild plan={plan.key} materials={game.materials} gold={game.gold} onBuild={() => game.buildSchematic(plan.id)} />}
    </div>
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

// A caged creature's stats, to help you decide: its health, its rolled %s
// (what it adds to its gear, and how its roll compares with its species),
// and the moves it was born with.
function CagedStats({ d, t }: { d: CreatureOrItemDrop; t: CreatureTemplate }) {
  const prof = d.proficiency ?? t.proficiency;
  const moves = resolveMoves(t, d.moves);
  return (
    <div style={{ textAlign: "left", background: "#15161d", border: "2px solid #0e0f14", padding: 10, margin: "0 0 10px" }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}><Glyph icon="❤️" art="stat_hp" /> <b>{t.baseHp}</b> <span style={{ color: MUTED }}>health, before armour</span></div>
      <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", marginBottom: 6 }}>Gear multipliers</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))", gap: 5 }}>
        {STATS.filter((st) => st.key !== "hp").map((st) => {
          const k = st.key as Exclude<StatKey, "hp">;
          const diff = (prof[k] ?? 0) - (t.proficiency[k] ?? 0);
          return (
            <div key={k} style={{ textAlign: "center", padding: "5px 2px", background: "#12131a", border: "2px solid #2a2d38", borderTop: `3px solid ${st.color}` }}>
              <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Glyph icon={st.icon} art={st.art} /> {st.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: st.color }}>+{prof[k]}%</div>
              <div style={{ fontSize: 10, color: diff > 0 ? "#7CFC9A" : diff < 0 ? "#ff8a80" : MUTED }}>{diff > 0 ? `+${diff} roll` : diff < 0 ? `${diff} roll` : "standard"}</div>
            </div>
          );
        })}
      </div>
      <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", margin: "10px 0 6px" }}>Its moves</div>
      <div className="move-grid">
        {moves.map((m) => <MoveTile key={m.name} m={m} />)}
      </div>
    </div>
  );
}
