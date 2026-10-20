"use client";
// app/tavern/page.tsx
// The tavern's room, behind the Den's rubble once Klutz's dynamite has blown
// it open (lib/tavern.ts). The tavern stands broken against the far wall, a
// Cyclops wanted poster already up; the first time you see it Klutz has his
// say. Repairing it takes REPAIR_COST in materials, once. Then the poster's
// Cyclops bounty: take it, bring the head (any Cyclops win counts, even one
// from before), mount it on the wall, and the bookcase schematic is yours.
// Once it's repaired, a merchant or librarian sometimes calls (rolled on
// coming home from a run: lib/tavern.ts comeHome), selling what they would
// in the Labyrinth. The merchant buys from your Inventory too.
// (Placeholder art until the PixelLab pass.)

import Link from "next/link";
import MerchantCart from "@/components/MerchantCart";
import { Coin } from "@/components/GoldCount";
import { MOVE_BY_NAME, RACE_INFO } from "@/lib/creatures/creatureData";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import PixelSprite from "@/components/PixelSprite";
import { useGameState } from "@/hooks/useGameState";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { useState } from "react";
import { MATERIALS, MATERIAL_KEYS, countMaterial } from "@/lib/items/materials";
import { LIBRARIAN, MERCHANT } from "@/lib/sprites/props";
import { codexPrice, loadDungeon, waresFor } from "@/lib/dungeon/run";
import { canRepair, canTakeBounty, headToMount, materialOffer, repairNeeds, tavernVisitor } from "@/lib/tavern";

const MUTED = "rgba(255,255,255,0.5)";

export default function TavernPage() {
  const game = useGameState();
  const t = game.tavern;
  // Trading with the merchant: buying or selling, and the thing tapped once
  // to sell (a second tap sells it).
  const [trade, setTrade] = useState<"buy" | "sell">("buy");
  const [armed, setArmed] = useState<string | null>(null);
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
  // A wanderer calling, standing as they do in the Labyrinth's tunnels.
  const visitor = tavernVisitor(t);
  // The Cyclops: how often you've beaten it, and the run you first did.
  const { clears, firstClearRun } = loadDungeon().meta;
  const head = CREATURE_SPRITES.cyclops;
  return (
    <DenFrame title={t.repaired ? "Tavern" : "Broken tavern"} icon="🍺">
      <div className="stone-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 17, color: "#f1d9a0" }}>{t.repaired ? "The tavern" : "A tavern, in ruins"}</div>
          <Help title="The tavern">
            <ul>
              <li>It was hidden behind the rubble. Repair it with <b>5 metal bars, 20 planks and 5 nails</b>.</li>
              <li>The <b>wanted poster</b> is for the Cyclops. Once it&apos;s repaired, take the bounty, beat the Cyclops (a win from before counts) and <b>mount its head</b> on the wall. The reward: the <b>Crooked Bookcase Schematic</b>, the only way to get one.</li>
              <li>Once it&apos;s repaired, a <b>merchant</b> or a <b>librarian</b> sometimes calls when you come home from a run, and stays for 2 runs. The <b>merchant</b> also buys: gear for what the crate pays, the rest at half his price.</li>
            </ul>
          </Help>
        </div>

        {/* The room: the tavern against the far wall, the poster beside its door. */}
        <div style={{ position: "relative", height: 170, marginTop: 10, background: "linear-gradient(#0b0a09, #241c15 70%, #3a2d20)", border: "2px solid #2a2118", overflow: "hidden" }}>
          <div aria-label={t.repaired ? "The tavern, repaired" : "The tavern, broken"} role="img"
            style={{ position: "absolute", left: "8%", bottom: 6, fontSize: 104, lineHeight: 1, filter: t.repaired ? "none" : "grayscale(0.6) brightness(0.75)" }}>
            {t.repaired ? "🏠" : "🏚️"}
          </div>
          {visitor && (
            <div style={{ position: "absolute", left: "50%", bottom: 4, transform: "translateX(-50%)", textAlign: "center" }}>
              <PixelSprite sprite={visitor === "merchant" ? MERCHANT : LIBRARIAN} scale={1.4} title={visitor === "merchant" ? "A travelling merchant" : "A wandering librarian"} />
            </div>
          )}
          {/* The Cyclops Head, mounted over the door, with the run you first beat it on. */}
          {t.mounted && head && (
            <div style={{ position: "absolute", left: "14%", top: 4, textAlign: "center", background: "#5a3e22", border: "2px solid #2a1c10", padding: "2px 4px" }}>
              <PixelSprite sprite={head} scale={0.7} title="The Cyclops Head" style={{ display: "block", margin: "0 auto" }} />
              <div className="pixel-font" style={{ fontSize: 10, color: "#f1d9a0" }}>{firstClearRun ? `Run ${firstClearRun}` : "Cyclops"}</div>
            </div>
          )}
          <div style={{ position: "absolute", right: "8%", top: 20, width: 92, padding: "4px 4px 6px", background: "#e8d6a8", border: "2px solid #8a6a3a", boxShadow: "0 3px 0 rgba(0,0,0,0.6)", transform: "rotate(3deg)", textAlign: "center" }}>
            <div className="pixel-font" style={{ fontSize: 13, color: "#7a1e14", letterSpacing: 1 }}>WANTED</div>
            {CREATURE_SPRITES.cyclops && <PixelSprite sprite={CREATURE_SPRITES.cyclops} scale={1.1} style={{ display: "block", margin: "2px auto" }} />}
            <div className="pixel-font" style={{ fontSize: 11, color: "#3a2a14" }}>{t.mounted ? "PAID" : "The Cyclops"}</div>
          </div>
        </div>

        {/* Klutz, the first time you see it. */}
        {!t.seen && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, background: "#12131a", padding: 8 }}>
            {CREATURE_SPRITES.klutz && <PixelSprite sprite={CREATURE_SPRITES.klutz} scale={1} />}
            <div style={{ fontSize: 13, lineHeight: 1.45, color: "#d6f0a8" }}>
              &ldquo;A tavern! Down here! It&apos;s a wreck… we&apos;ll need <b>metal bars, planks and nails</b> to fix it.
              And look at that poster — someone wants the <b>Cyclops</b>!&rdquo;
              <div style={{ marginTop: 6 }}><button className="pixel-btn" onClick={game.seeTavern}>&ldquo;Let&apos;s fix it up.&rdquo;</button></div>
            </div>
          </div>
        )}

        {/* The repair: have / need, then the button. */}
        {!t.repaired ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              {needs.map(({ key, have, need }) => (
                <span key={key} className="pixel-font" style={{ fontSize: 13, color: have >= need ? "#5ee08a" : "#ff8a80" }}>
                  {MATERIALS[key].icon} {have}/{need} {MATERIALS[key].name.toLowerCase()}
                </span>
              ))}
            </div>
            <button className="pixel-btn" disabled={!canRepair(t, game.materials)} onClick={game.repairTavern}>🔨 Repair the tavern</button>
          </div>
        ) : (
          // The bounty, step by step.
          <div style={{ marginTop: 10, minHeight: 64 }}>
            {canTakeBounty(t) ? (
              <button className="pixel-btn" onClick={game.takeBounty}>📜 Take the Cyclops bounty</button>
            ) : headToMount(t, clears) ? (
              <>
                <div style={{ fontSize: 13, color: "#d8d4c8", marginBottom: 6 }}>🗿 You have the <b>Cyclops Head</b>{firstClearRun ? ` (run ${firstClearRun})` : ""}.</div>
                <button className="pixel-btn" onClick={game.mountCyclopsHead}>🔨 Mount it on the wall</button>
              </>
            ) : t.mounted ? (
              <div style={{ fontSize: 13, color: "#5ee08a" }}>Bounty paid: the <b>Crooked Bookcase Schematic</b>. {game.bookcase < 2 ? "Build it at the bookcase." : ""}</div>
            ) : (
              <div style={{ fontSize: 13, color: "#d8d4c8" }}>📜 Bounty taken. Beat the <b>Cyclops</b> and bring back its head.</div>
            )}
          </div>
        )}

        {/* Whoever's calling, and what they sell. */}
        {visitor === "merchant" && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {(["buy", "sell"] as const).map((m) => (
                <button key={m} className="chip" onClick={() => { setTrade(m); setArmed(null); }}
                  style={{ minHeight: 44, flex: 1, background: trade === m ? "#5a3e22" : undefined }}>{m === "buy" ? "Buy" : "Sell"}</button>
              ))}
            </div>
            {trade === "buy" ? (
              <>
                <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 6px" }}>&ldquo;One of each, friend. It all goes in your Inventory.&rdquo;</p>
                <MerchantCart wares={waresFor(t.wares ?? [], loadDungeon().meta)} bought={t.bought} gold={game.gold} bagUsed={0} bagSlots={99} stacks={[]} onBuy={(ws) => ws.forEach(game.buyTavernWare)} />
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 6px" }}>&ldquo;Let&apos;s see what you&apos;ve got.&rdquo; Tap twice to sell.</p>
                {/* Your Inventory (not what's worn, packed or favourited), then your materials one at a time. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "40cqh", overflowY: "auto" }}>
                  {game.tavernSells().map(({ drop, price }) => (
                    <button key={drop.id} className="card-btn" style={{ minHeight: 44, justifyContent: "space-between", gap: 8, background: armed === drop.id ? "#6e1f18" : undefined }}
                      onClick={() => { if (armed !== drop.id) { setArmed(drop.id); return; } setArmed(null); game.sellToTavern(drop.id); }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={drop.name}>{drop.name}</span>
                      <span className="pixel-font" style={{ color: "#f1d9a0", flexShrink: 0 }}>{armed === drop.id ? "Sell?" : ""} <Coin /> {price}</span>
                    </button>
                  ))}
                  {MATERIAL_KEYS.filter((k) => countMaterial(game.materials, k) > 0).map((k) => (
                    <button key={k} className="card-btn" style={{ minHeight: 44, justifyContent: "space-between", gap: 8, background: armed === k ? "#6e1f18" : undefined }}
                      onClick={() => { if (armed !== k) { setArmed(k); return; } game.sellMaterialToTavern(k); }}>
                      <span style={{ flex: 1 }}>{MATERIALS[k].icon} 1 {MATERIALS[k].name.toLowerCase()} <span style={{ fontSize: 12, color: MUTED }}>(have {countMaterial(game.materials, k)})</span></span>
                      <span className="pixel-font" style={{ color: "#f1d9a0", flexShrink: 0 }}>{armed === k ? "Sell?" : ""} <Coin /> {materialOffer(k)}</span>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>You have {game.gold} gold.</p>
              </>
            )}
          </div>
        )}
        {visitor === "librarian" && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 13, color: "#d8d4c8", margin: 0 }}>&ldquo;Codexes,&rdquo; it whispers. &ldquo;Each teaches one creature a move — once.&rdquo;</p>
            {(t.offers ?? []).map((name) => {
              const move = MOVE_BY_NAME[name];
              const sold = t.bought?.includes(name);
              const price = codexPrice(name);
              const off = sold || game.gold < price || game.shelfFree <= 0;
              return (
                <button key={name} className="card-btn" disabled={off} onClick={() => game.buyTavernCodex(name)} style={{ opacity: off ? 0.5 : 1 }}>
                  <span style={{ flex: 1 }}>
                    <b style={{ color: "#c7b8ff" }}>📖 Codex: {name}</b>
                    <span style={{ fontSize: 12, color: move?.race ? RACE_INFO[move.race].color : MUTED }}> · {move?.race ? `${RACE_INFO[move.race].name} only` : "any creature"}</span>
                    <span style={{ display: "block", fontSize: 12, color: MUTED }}>{move?.desc}</span>
                  </span>
                  <span className="pixel-font" style={{ color: "#f1d9a0", flexShrink: 0 }}>{sold ? "bought" : <><Coin /> {price}</>}</span>
                </button>
              );
            })}
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>You have {game.gold} gold.{game.shelfFree <= 0 ? " The bookcase is full." : ""}</p>
          </div>
        )}
      </div>
    </DenFrame>
  );
}
