"use client";
// app/tavern/page.tsx
// The tavern's room, behind the Den's rubble once Klutz's dynamite has blown
// it open (lib/tavern.ts). The tavern stands broken against the far wall; the
// first time you see it Klutz has his say. Repairing it takes REPAIR_COST in
// materials, once. That puts the Cyclops bounty on the quest board
// (app/board); once paid, the head hangs over the door.
// Once it's repaired, a merchant, a librarian or the creature collector
// sometimes calls (rolled on coming home from a run: lib/tavern.ts comeHome),
// or you send for one here. They stroll round the room and trade in their own
// window, tapped there (app/visitor). The pit has its own window too (app/training).
// The room itself is in the Den, through its doorway (components/TavernRoom.tsx);
// this is the tavern's window, opened by tapping it there.

import Link from "next/link";
import { Coin } from "@/components/GoldCount";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import PixelSprite, { MaterialIcon } from "@/components/PixelSprite";
import { useGameState } from "@/hooks/useGameState";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { useState } from "react";
import { MATERIALS } from "@/lib/items/materials";
import { COLLECTOR_PRICES, TRADE_UP_COUNT } from "@/lib/collector";
import { REPAIR_COST, SUMMON_PRICE, VISITOR_STAY, canRepair, repairNeeds, tavernVisitor, type Visitor } from "@/lib/tavern";

const MUTED = "rgba(255,255,255,0.5)";
const VISITOR_NAME: Record<Visitor, string> = { merchant: "merchant", librarian: "librarian", collector: "creature collector" };

export default function TavernPage() {
  const game = useGameState();
  const t = game.tavern;
  const [summoning, setSummoning] = useState<Visitor | null>(null); // tapped once: a second tap pays
  if (!game.hydrated) return <DenFrame title="Tavern" icon="🍺"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;
  if (!t.blasted) {
    return (
      <DenFrame title="Tavern" icon="🍺">
        <p style={{ color: MUTED }}>The way&apos;s still blocked with rubble.</p>
        <Link href="/" className="pixel-btn">← Back to the Den</Link>
      </DenFrame>
    );
  }

  const needs = repairNeeds(game.materials);
  // A wanderer calling (they trade in their own window, tapped in the room: app/visitor).
  const visitor = tavernVisitor(t);
  return (
    <DenFrame title={t.repaired ? "Tavern" : "Broken tavern"} icon="🍺">
      <div className="stone-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 17, color: "#f1d9a0" }}>{t.repaired ? "The tavern" : "A tavern, in ruins"}</div>
          <Help title="The tavern">
            <ul>
              <li>It was hidden behind the rubble. Repair it with <b>{REPAIR_COST.metal_bars} metal bars, {REPAIR_COST.planks} planks and {REPAIR_COST.nails} nails</b>.</li>
              <li>Repairing it puts a <b>bounty</b> on the Cyclops up on the <b>quest board</b>.</li>
              <li>Once it&apos;s repaired, a <b>merchant</b>, a <b>librarian</b> or the <b>creature collector</b> sometimes calls when you come home from a run, and stays for {VISITOR_STAY} runs. Tap them in the room to trade. The <b>merchant</b> also buys: gear for what the crate pays, the rest at half his price.</li>
              <li>The <b>creature collector</b> buys creatures (Common {COLLECTOR_PRICES.common}, Uncommon {COLLECTOR_PRICES.uncommon}, Rare {COLLECTOR_PRICES.rare}, Epic {COLLECTOR_PRICES.epic}, Legendary {COLLECTOR_PRICES.legendary} gold), or trades <b>{TRADE_UP_COUNT} creatures of one rarity</b> for a card of a random creature one rarity up. Not cards, and not a creature in a team, the pit or on a run.</li>
              <li>Or send for one: <b>{SUMMON_PRICE} gold</b> and they come now, for {VISITOR_STAY} runs. Whoever&apos;s in leaves, so you can send for a fresh one too.</li>
            </ul>
          </Help>
        </div>


        {/* Klutz, the first time you see it. */}
        {!t.seen && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, background: "#12131a", padding: 8 }}>
            {CREATURE_SPRITES.klutz && <PixelSprite sprite={CREATURE_SPRITES.klutz} scale={1} />}
            <div style={{ fontSize: 13, lineHeight: 1.45, color: "#d6f0a8" }}>
              &ldquo;A tavern! Down here! It&apos;s a wreck… we&apos;ll need <b>metal bars, planks and nails</b> to fix it.
              I bet whoever ran it knows a thing or two about the <b>Cyclops</b>!&rdquo;
              <div style={{ marginTop: 6 }}><button className="pixel-btn" onClick={game.seeTavern}>&ldquo;Let&apos;s fix it up.&rdquo;</button></div>
            </div>
          </div>
        )}

        {/* The repair: have / need, then the button. */}
        {!t.repaired && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              {needs.map(({ key, have, need }) => (
                <span key={key} className="pixel-font" style={{ fontSize: 13, color: have >= need ? "#5ee08a" : "#ff8a80" }}>
                  <MaterialIcon k={key} /> {have}/{need} {MATERIALS[key].name.toLowerCase()}
                </span>
              ))}
            </div>
            <button className="pixel-btn" disabled={!canRepair(t, game.materials)} onClick={game.repairTavern}>🔨 Repair the tavern</button>
          </div>
        )}

        {t.repaired && <p style={{ fontSize: 13, color: MUTED, margin: "10px 0 0" }}>{visitor
          ? <>The {VISITOR_NAME[visitor]}&apos;s in the room. Tap them there to trade.</>
          : <>Nobody&apos;s in. Travellers call when you&apos;re back from a run.</>}</p>}

        {/* Sending for someone: a second tap pays (and sends whoever's in on their way). */}
        {t.repaired && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: MUTED }}>Send for:</span>
            {(["merchant", "librarian", "collector"] as const).map((who) => {
              const on = summoning === who;
              return (
                <button key={who} className="chip" disabled={game.gold < SUMMON_PRICE}
                  onClick={() => { if (!on) { setSummoning(who); return; } setSummoning(null); game.summonTavernVisitor(who); }}
                  style={{ minHeight: 44, flex: 1, background: on ? "#6e1f18" : undefined }}>
                  {on ? <>Pay <Coin /> {SUMMON_PRICE}?</> : <>{visitor === who ? `A new ${who}` : who[0].toUpperCase() + who.slice(1)} <Coin /> {SUMMON_PRICE}</>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DenFrame>
  );
}
