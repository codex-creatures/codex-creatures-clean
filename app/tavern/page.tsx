"use client";
// app/tavern/page.tsx
// The tavern's room, behind the Den's rubble once Klutz's dynamite has blown
// it open (lib/tavern.ts). The tavern stands broken against the far wall; the
// first time you see it Klutz has his say. Repairing it takes REPAIR_COST in
// materials, once. That puts the Cyclops bounty on the quest board
// (app/board); once paid, the head hangs over the door.
// Once it's repaired, the merchant, the librarian (the collector, away for now) and
// the Enchantress each may call every half hour (lib/tavern.ts onTheClock), or
// you send for one here; the upgrades here make each more likely. They stroll
// round the room and trade in their own window, tapped there (app/visitor).
// The pit has its own window too (app/training).
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
import { MAX_UPGRADE, REPAIR_COST, SUMMON_PRICE, UPGRADE_COSTS, VISITORS, canRepair, canUpgrade, guestOf, repairNeeds, tavernVisitors, upgradeCost, upgradeLevel, visitorChance, type Visitor } from "@/lib/tavern";
import { countMaterial, type MaterialKey } from "@/lib/items/materials";
import { REROLL_GOLD } from "@/lib/enchantress";

const MUTED = "rgba(255,255,255,0.5)";
const VISITOR_NAME: Record<Visitor, string> = { merchant: "merchant", librarian: "librarian", collector: "creature collector", enchantress: "Enchantress" };
const VISITOR_LABEL: Record<Visitor, string> = { merchant: "Merchant", librarian: "Librarian", collector: "Collector", enchantress: "Enchantress" };
const pct = (p: number) => `${Math.round(p * 100)}%`;
// What every level of a visitor's upgrade comes to (for the "?").
const UPGRADE_TOTAL = UPGRADE_COSTS.reduce<Record<string, number>>((n, c) => { for (const [k, v] of Object.entries(c)) n[k] = (n[k] ?? 0) + (v ?? 0); return n; }, {});

export default function TavernPage() {
  const game = useGameState();
  const t = game.tavern;
  const [summoning, setSummoning] = useState<Visitor | null>(null); // tapped once: a second tap pays
  const [upgrading, setUpgrading] = useState<Visitor | null>(null);  // …and the same for an upgrade
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
  // Who's calling (they trade in their own window, tapped in the room: app/visitor).
  const visitors = tavernVisitors(t);
  return (
    <DenFrame title={t.repaired ? "Tavern" : "Broken tavern"} icon="🍺">
      <div className="stone-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 17, color: "#f1d9a0" }}>{t.repaired ? "The tavern" : "A tavern, in ruins"}</div>
          <Help title="The tavern">
            <ul>
              <li>It was hidden behind the rubble. Repair it with <b>{REPAIR_COST.metal_bars} metal bars, {REPAIR_COST.planks} planks and {REPAIR_COST.nails} nails</b>.</li>
              <li>Beat the Cyclops and its <b>head</b> goes up over the door.</li>
              <li>Once it&apos;s repaired, the <b>merchant</b>, the <b>librarian</b> and the <b>Enchantress</b> may each call <b>every half hour</b>, on their own chance, so several can be in at once. One who comes stays that half hour. Tap them in the room to trade. The <b>merchant</b> also buys: gear for what the crate pays, the rest at half his price.</li>
              <li>The <b>Enchantress</b> rerolls an item&apos;s enchantment for <b>1 essence crystal</b> and gold by its rarity (Rare {REROLL_GOLD.rare!.toLocaleString()}, Epic {REROLL_GOLD.epic!.toLocaleString()}, Legendary {REROLL_GOLD.legendary!.toLocaleString()}).</li>
              <li>Or send for one: <b>{SUMMON_PRICE} gold</b> and they come now, for half an hour. One of the same kind who&apos;s in leaves, so you can send for a fresh one too.</li>
              <li><b>Upgrades</b>: each visitor starts at a <b>{pct(visitorChance({}, "merchant"))}</b> chance a half hour, and each level adds 1%, up to {MAX_UPGRADE} levels. Paid in materials, dearer each level: all {MAX_UPGRADE} come to {UPGRADE_TOTAL.planks} planks, {UPGRADE_TOTAL.nails} nails, {UPGRADE_TOTAL.metal_bars} metal bars, {UPGRADE_TOTAL.essence_stones} stone and {UPGRADE_TOTAL.essence} essence crystals a visitor.</li>
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

        {/* Who's in: one line, cut to fit. */}
        {t.repaired && <p style={{ fontSize: 13, color: MUTED, margin: "10px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{visitors.length
          ? <>In the room: {visitors.map((v) => VISITOR_NAME[v]).join(", ")}. Tap them there.</>
          : <>Nobody&apos;s in. Travellers drop in now and then.</>}</p>}

        {/* Sending for someone: a second tap pays (and sends one of the same kind who's in on their way).
            Two a row, under their label, so they fit a phone. */}
        {t.repaired && <div style={{ marginTop: 10, fontSize: 12, color: MUTED }}>Send for:</div>}
        {t.repaired && (
          <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
            {VISITORS.map((who) => {
              const on = summoning === who;
              return (
                <button key={who} className="chip" disabled={game.gold < SUMMON_PRICE}
                  onClick={() => { if (!on) { setSummoning(who); return; } setSummoning(null); game.summonTavernVisitor(who); }}
                  style={{ minHeight: 44, minWidth: 0, background: on ? "#6e1f18" : undefined }}>
                  {on ? <>Pay <Coin /> {SUMMON_PRICE}?</> : <>{guestOf(t, who) ? `A new ${who}` : VISITOR_LABEL[who]} <Coin /> {SUMMON_PRICE}</>}
                </button>
              );
            })}
          </div>
        )}

        {/* Upgrades: a fixed row per visitor (name, level and chance; the next
            level's materials, have/need; the button). A second tap pays. */}
        {t.repaired && <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>Upgrades (each visitor&apos;s chance every half hour):</div>}
        {t.repaired && (
          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
            {VISITORS.map((who) => {
              const level = upgradeLevel(t, who), cost = upgradeCost(t, who), on = upgrading === who;
              return (
                <div key={who} style={{ display: "flex", alignItems: "center", gap: 8, background: "#12131a", padding: "4px 8px", minHeight: 52 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {VISITOR_LABEL[who]} <span style={{ color: MUTED }}>Lv {level}/{MAX_UPGRADE} · {pct(visitorChance(t, who))}</span>
                    </div>
                    {/* (Each icon and its have/need kept on one line: they used to wrap, and the
                        numbers fell out of sight below the row.) */}
                    <div style={{ fontSize: 12, height: 22, display: "flex", alignItems: "center", gap: 8, overflow: "hidden", whiteSpace: "nowrap" }}>
                      {cost ? (Object.entries(cost) as [MaterialKey, number][]).map(([k, need]) => {
                        const have = countMaterial(game.materials, k);
                        return <span key={k} title={`${MATERIALS[k].name}: you have ${have}, it takes ${need}`} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, color: have >= need ? "#5ee08a" : "#ff8a80" }}><MaterialIcon k={k} />{have}/{need}</span>;
                      }) : <span style={{ color: MUTED }}>Fully upgraded</span>}
                    </div>
                  </div>
                  <button className="chip" disabled={!canUpgrade(t, who, game.materials)}
                    onClick={() => { if (!on) { setUpgrading(who); return; } setUpgrading(null); game.upgradeTavernVisitor(who); }}
                    style={{ minHeight: 44, flexShrink: 0, width: 92, background: on ? "#6e1f18" : undefined, opacity: cost && !canUpgrade(t, who, game.materials) ? 0.45 : 1 }}>
                    {!cost ? "Max" : on ? "Upgrade?" : `+1% · Lv ${level + 1}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DenFrame>
  );
}
