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
// The room itself is in the Den, through its doorway (components/Den3D.tsx);
// this is the tavern's window, opened by tapping it there.

import Link from "next/link";
import { Coin } from "@/components/GoldCount";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import PixelSprite, { MaterialIcon } from "@/components/PixelSprite";
import { useGameState } from "@/hooks/useGameState";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { COLLECTOR, ENCHANTRESS, LIBRARIAN, MERCHANT } from "@/lib/sprites/props";
import type { Sprite } from "@/lib/sprites/pixels";
import { useState } from "react";
import { MATERIALS } from "@/lib/items/materials";
import { MAX_UPGRADE, REPAIR_COST, SUMMON_PRICE, UPGRADE_COSTS, VISITORS, canRepair, canUpgrade, guestOf, repairNeeds, tavernVisitors, upgradeCost, upgradeLevel, visitorChance, type Visitor } from "@/lib/tavern";
import { countMaterial, type MaterialKey } from "@/lib/items/materials";
import { REROLL_GOLD } from "@/lib/enchantress";

const MUTED = "rgba(255,255,255,0.5)";
const VISITOR_NAME: Record<Visitor, string> = { merchant: "merchant", librarian: "librarian", collector: "creature collector", enchantress: "Enchantress" };
const VISITOR_LABEL: Record<Visitor, string> = { merchant: "Merchant", librarian: "Librarian", collector: "Collector", enchantress: "Enchantress" };
const VISITOR_SPRITE: Record<Visitor, Sprite> = { merchant: MERCHANT, librarian: LIBRARIAN, collector: COLLECTOR, enchantress: ENCHANTRESS };
const PIC: React.CSSProperties = { width: 64, height: 80, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden" };
const LINE: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const BTN: React.CSSProperties = { minHeight: 40, height: 40, width: "100%", minWidth: 0, padding: "0 4px", whiteSpace: "nowrap", overflow: "hidden", fontSize: 13 };
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
          ? <>In the room: {visitors.map((v) => VISITOR_NAME[v]).join(", ")}. Tap them to trade.</>
          : <>Nobody&apos;s in. Travellers drop in now and then.</>}</p>}

        {/* A card per visitor (the user, 2026-11-21: pictures, not plain rows), each the same fixed frame:
            their picture (tap it to trade while they're in), name, upgrade level and chance, the next
            level's materials (have/need), and two buttons of a fixed size, Send for and Upgrade, each
            paying on a second tap (only the words change, so nothing moves). */}
        {t.repaired && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {VISITORS.map((who) => {
              const level = upgradeLevel(t, who), cost = upgradeCost(t, who), here = !!guestOf(t, who);
              const sending = summoning === who, raising = upgrading === who;
              const pic = <PixelSprite sprite={VISITOR_SPRITE[who]} scale={1} style={{ maxWidth: "100%", maxHeight: 60, width: "auto", height: "auto" }} />;
              return (
                <div key={who} style={{ display: "grid", gridTemplateColumns: "64px minmax(0, 1fr) 100px", alignItems: "center", gap: 8, background: "#12131a",
                  border: `1px solid ${here ? "#3f9a5a" : "#2a2b36"}`, padding: 6, height: 96, boxSizing: "border-box" }}>
                  {here ? <Link href={`/visitor?v=${who}`} aria-label={`Trade with the ${VISITOR_NAME[who]}`} style={PIC}>{pic}</Link> : <div style={{ ...PIC, opacity: 0.45, filter: "grayscale(1)" }}>{pic}</div>}
                  <div style={{ minWidth: 0, display: "grid", gap: 3 }}>
                    <div className="pixel-font" style={{ ...LINE, fontSize: 14, color: "#f1d9a0" }}>{VISITOR_LABEL[who]}</div>
                    <div style={{ ...LINE, fontSize: 12 }}><span style={{ color: "#f1d9a0" }}>Lv {level}/{MAX_UPGRADE}</span><span style={{ color: MUTED }}> · {pct(visitorChance(t, who))} · </span><span style={{ color: here ? "#7CFC9A" : MUTED }}>{here ? "In now" : "Away"}</span></div>
                    {/* (Each icon and its have/need kept on one line.) */}
                    <div style={{ ...LINE, fontSize: 12, height: 22, display: "flex", alignItems: "center", gap: 6 }}>
                      {cost ? (Object.entries(cost) as [MaterialKey, number][]).map(([k, need]) => {
                        const have = countMaterial(game.materials, k);
                        return <span key={k} title={`${MATERIALS[k].name}: you have ${have}, it takes ${need}`} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, color: have >= need ? "#5ee08a" : "#ff8a80" }}><MaterialIcon k={k} />{have}/{need}</span>;
                      }) : <span style={{ color: MUTED }}>Fully upgraded</span>}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <button className="chip" disabled={game.gold < SUMMON_PRICE} title={here ? `Send this ${VISITOR_NAME[who]} away for a new one` : `Send for the ${VISITOR_NAME[who]}`}
                      onClick={() => { setUpgrading(null); if (!sending) { setSummoning(who); return; } setSummoning(null); game.summonTavernVisitor(who); }}
                      style={{ ...BTN, background: sending ? "#6e1f18" : undefined }}>
                      {sending ? <>Pay <Coin /> {SUMMON_PRICE}?</> : <>{here ? "New" : "Send"} <Coin /> {SUMMON_PRICE}</>}
                    </button>
                    <button className="chip" disabled={!canUpgrade(t, who, game.materials)}
                      onClick={() => { setSummoning(null); if (!raising) { setUpgrading(who); return; } setUpgrading(null); game.upgradeTavernVisitor(who); }}
                      style={{ ...BTN, background: raising ? "#6e1f18" : undefined, opacity: cost && !canUpgrade(t, who, game.materials) ? 0.45 : 1 }}>
                      {!cost ? "Max" : raising ? "Upgrade?" : "⬆️ +1%"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DenFrame>
  );
}
