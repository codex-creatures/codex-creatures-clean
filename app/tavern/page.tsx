"use client";
// app/tavern/page.tsx
// The tavern's room, behind the Den's rubble once Klutz's dynamite has blown
// it open (lib/tavern.ts). The tavern stands broken against the far wall; the
// first time you see it Klutz has his say. Repairing it takes REPAIR_COST in
// materials, once. Then it offers the Cyclops bounty (a ❗ over it in the
// room while there's a step to do here): take it, bring the head (any Cyclops win counts, even one
// from before), mount it on the wall, and the bookcase schematic is yours.
// Once it's repaired, a merchant or librarian sometimes calls (rolled on
// coming home from a run: lib/tavern.ts comeHome), selling what they would
// in the Labyrinth. The merchant buys from your Inventory too.
// The room itself is in the Den, through its doorway (components/TavernRoom.tsx);
// this is the tavern's window, opened by tapping it there.

import Link from "next/link";
import MerchantCart from "@/components/MerchantCart";
import { Coin } from "@/components/GoldCount";
import { MOVE_BY_NAME, RACE_INFO } from "@/lib/creatures/creatureData";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import PixelSprite, { MaterialIcon } from "@/components/PixelSprite";
import { useGameState } from "@/hooks/useGameState";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { useState } from "react";
import { MATERIALS, MATERIAL_KEYS, countMaterial } from "@/lib/items/materials";
import { codexPrice, loadDungeon, waresFor } from "@/lib/dungeon/run";
import { REPAIR_COST, VISITOR_STAY, canRepair, canTakeBounty, headToMount, materialOffer, repairNeeds, tavernVisitor } from "@/lib/tavern";

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
  return (
    <DenFrame title={t.repaired ? "Tavern" : "Broken tavern"} icon="🍺">
      <div className="stone-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 17, color: "#f1d9a0" }}>{t.repaired ? "The tavern" : "A tavern, in ruins"}</div>
          <Help title="The tavern">
            <ul>
              <li>It was hidden behind the rubble. Repair it with <b>{REPAIR_COST.metal_bars} metal bars, {REPAIR_COST.planks} planks and {REPAIR_COST.nails} nails</b>.</li>
              <li>Once it&apos;s repaired, it has a <b>bounty</b> on the Cyclops (a ❗ over the tavern when there&apos;s something to do here). Take the bounty, beat the Cyclops (a win from before counts) and <b>mount its head</b> on the wall. The reward: the <b>Crooked Bookcase Schematic</b>, the only way to get one.</li>
              <li>Once it&apos;s repaired, a <b>merchant</b> or a <b>librarian</b> sometimes calls when you come home from a run, and stays for {VISITOR_STAY} runs. The <b>merchant</b> also buys: gear for what the crate pays, the rest at half his price.</li>
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
        {!t.repaired ? (
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
                <MerchantCart wares={waresFor(t.wares ?? [], loadDungeon().meta, game.heldStoragePlans())} bought={t.bought} gold={game.gold} bagUsed={0} bagSlots={99} stacks={[]} onBuy={(ws) => ws.forEach(game.buyTavernWare)} />
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
                      <span style={{ flex: 1 }}><MaterialIcon k={k} /> 1 {MATERIALS[k].name.toLowerCase()} <span style={{ fontSize: 12, color: MUTED }}>(have {countMaterial(game.materials, k)})</span></span>
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
