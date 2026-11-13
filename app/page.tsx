"use client";
// app/page.tsx — home: the Den, where you live. Click objects to open each
// part of the game. Under the room, a dock with the same places as buttons
// (quicker on small screens and for keyboard users), the Labyrinth first.

import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import { TOTAL_CREATURES, TOTAL_ITEMS } from "@/lib/items/gameHelpers";
import DenRoom, { SPOTS } from "@/components/DenRoom";
import TavernRoom from "@/components/TavernRoom";
import { Coin } from "@/components/GoldCount";
import DailyPopup from "@/components/DailyPopup";
import { useEffect, useState } from "react";
import { klutzStatus, pointsFree } from "@/lib/klutz";
import { klutzHasNews, klutzHelping, needsFirstCreature, needsGearUp } from "@/lib/quest";
import { loadDungeon, bagSize, BINDLE } from "@/lib/dungeon/run";
import { OBJ } from "@/lib/den/scene";
import { bountyHasStep, canBlast, tavernVisitor } from "@/lib/tavern";
import { DAILY_ONLINE, canClaim, todayDaily } from "@/lib/daily";
import { useTour } from "@/hooks/useTour";
import { tourDenTarget } from "@/lib/tour";
import { hasPit, hydraStep } from "@/lib/trainingPit";
import { PLAYER_MAX_LEVEL, playerXpToNext } from "@/lib/creatures/levels";

// The places in the dock under the room: your creatures, your things, then help.
const PLACES = [OBJ.pit, OBJ.altar, OBJ.cage, OBJ.pool, OBJ.klutz, OBJ.chest, OBJ.bag, OBJ.bookcase, OBJ.crate, OBJ.scroll];

export default function Home() {
  const game = useGameState();
  // Klutz comes and goes with the clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(t); }, []);
  const k = klutzStatus(game.klutz, game.klutzFighter.maxHp, now).kind;
  // The bag by the archway: a bindle until you find the rugged backpack.
  // (And the Cyclops: how often you've beaten it, for the board's bounty, and the run you first did, for the tavern.)
  const [backpack, setBackpack] = useState(false);
  const [firstClearRun, setFirstClearRun] = useState<number | undefined>();
  const [clears, setClears] = useState(0);
  const [deepClears, setDeepClears] = useState(0); // (the Hydra: the board's Hydra quest)
  useEffect(() => { const meta = loadDungeon().meta; setBackpack(bagSize(meta) > BINDLE); setFirstClearRun(meta.firstClearRun); setClears(meta.clears); setDeepClears(meta.deepClears ?? 0); }, []);
  // Where Klutz has sent you: the cage for your first creature, then the Pit to
  // kit it out; later, with his dynamite, the rubble (lib/tavern.ts).
  const mine = game.inventory.filter((d) => d.dropType === "creature");
  const tour = useTour();
  const tourAt = tourDenTarget(tour); // (Klutz's tour, showing you a place)
  const highlight = !game.hydrated ? undefined
    : tourAt !== undefined ? tourAt
    : needsFirstCreature(game.quest, mine.length > 0) && game.caged.length > 0 ? OBJ.cage
    : needsGearUp(game.quest, mine.map((c) => game.equipment[c.id])) ? OBJ.pit
    : canBlast(game.tavern) ? OBJ.tavern : undefined;

  return (
    <main className="screen-page">
      <header className="screen-header" style={{ gridTemplateColumns: "1fr auto" }}>
        {/* Your explorer level where the title was; your counts stand with their icon over the
            number, so the bar fits a phone. On a very narrow one the XP bar shrinks, never the counts or ⚙️. */}
        <h1 style={{ margin: 0, minWidth: 0 }}><ExplorerBar level={game.player.level} xp={game.player.xp} /></h1>
        <div className="pixel-font" style={{ display: "flex", alignItems: "center", gap: "clamp(5px, 2cqw, 10px)", fontSize: 13 }}>
          <Stat icon={<Coin size={13} />} color="#f5c542" title="Gold">{game.gold.toLocaleString()}</Stat>
          <Stat icon="🐾" color="#8fc1ff" title="Creatures discovered">{game.discoveredCreatures}/{TOTAL_CREATURES}</Stat>
          <Stat icon="⚔️" color="#ffd98a" title="Items discovered">{game.discoveredItems}/{TOTAL_ITEMS}</Stat>
          <Link href="/settings" aria-label="Settings" title="Settings: export, import or back up your save" style={{ fontSize: 16, lineHeight: 1 }}>⚙️</Link>
        </div>
      </header>

      <div className="screen-fill">
        <DenRoom caged={(game.caged[0] as { creatureId?: string } | undefined)?.creatureId}
          klutz={!game.hydrated || k === "away" ? "away" : k === "healing" ? "pool" : "home"}
          klutzNews={game.hydrated && (klutzHasNews(game.quest) || game.tavernDue || (game.scanTipDue && !game.scanTipRead) || (klutzHelping(game.quest) && pointsFree(game.klutz) > 0))} backpack={backpack} highlight={highlight}
          rubble={game.tavern.blasted ? "open" : canBlast(game.tavern) ? "dynamite" : "shut"} onBlast={game.blastRubble}
          tavernNews={game.hydrated && !!tavernVisitor(game.tavern)} boardNews={game.hydrated && (bountyHasStep(game.tavern, clears) || hydraStep(game.tavern, clears, deepClears) === "claim" || [0, 1].some((i) => canClaim(todayDaily(DAILY_ONLINE), i)))} upgraded={game.bookcase >= 2}
          crateNews={game.hydrated && game.crate.length > 0} cageNews={game.hydrated && game.caged.length > 0 && highlight !== OBJ.cage}
          annex={<TavernRoom tavern={game.tavern} firstClearRun={firstClearRun} pit={hasPit(game.tavern) ? { ready: game.hydrated && !!game.trainingStatus(now)?.full } : undefined} />} />
      </div>

      {/* Today's quests, as you come in (not over Klutz's tour, nor before your first creature). */}
      <DailyPopup ready={game.hydrated && tour === null && mine.length > 0} now={now} />

      {/* The dock: the Labyrinth first and biggest, then every place in the Den. */}
      <nav className="screen-dock" data-tour="dock" style={{ display: "grid", gap: 6 }}>
        <Link href="/dungeon" className="pixel-btn" style={{ display: "block", textAlign: "center", fontSize: 18, padding: "8px 0" }}>
          🌀 Enter the Labyrinth
        </Link>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
          {PLACES.map((id) => {
            const s = SPOTS[id as keyof typeof SPOTS];
            return s?.href ? <Link key={id} href={s.href} className={`dock-tab${id === highlight ? " tutorial-pulse" : ""}`} style={{ fontSize: 11, whiteSpace: "normal", textAlign: "center", lineHeight: 1.1, minHeight: 40 }}>{s.label}</Link> : null;
          })}
        </div>
      </nav>
    </main>
  );
}

// One of your counts on the Den's bar: what it counts over the number.
function Stat({ icon, color, title, children }: { icon: React.ReactNode; color: string; title: string; children: React.ReactNode }) {
  return (
    <span title={title} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, lineHeight: 1, color, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", height: 13 }}>{icon}</span>
      {children}
    </span>
  );
}

// Your explorer level (from every fight's XP; it decides how rare a creature you can scan):
// this level, the bar with your XP over what the next needs, then the next level.
function ExplorerBar({ level, xp }: { level: number; xp: number }) {
  const max = level >= PLAYER_MAX_LEVEL, need = playerXpToNext(level);
  const lv = { fontSize: "clamp(11px, 3.2cqw, 14px)", color: "#f1d9a0", whiteSpace: "nowrap" as const, flexShrink: 0 };
  return (
    <div className="pixel-font" title="Explorer level: fights level you up, and it decides how rare a creature you can find" style={{ display: "flex", alignItems: "center", gap: "clamp(4px, 1.5cqw, 8px)", minWidth: 0, fontWeight: 400 }}>
      <span style={lv}>Lv {level}</span>
      <div style={{ position: "relative", flex: 1, minWidth: 40, height: 16, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(241,217,160,0.45)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: `${max ? 100 : Math.min(100, (100 * xp) / need)}%`, background: "linear-gradient(#e8c66a, #b98a2e)" }} />
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", textShadow: "0 0 2px #000, 0 0 2px #000", whiteSpace: "nowrap" }}>
          {max ? "MAX" : `${xp.toLocaleString()} / ${need.toLocaleString()}`}
        </span>
      </div>
      {!max && <span style={lv}>Lv {level + 1}</span>}
    </div>
  );
}
