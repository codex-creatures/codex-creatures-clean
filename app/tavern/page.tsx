"use client";
// app/tavern/page.tsx
// The tavern's room, behind the Den's rubble once Klutz's dynamite has blown
// it open (lib/tavern.ts). The tavern stands broken against the far wall; the
// first time you see it Klutz has his say. Repairing it takes REPAIR_COST in
// materials, once. That puts the Cyclops bounty on the quest board
// (app/board); once paid, the head hangs over the door.
// Once it's repaired, a merchant or librarian sometimes calls (rolled on
// coming home from a run: lib/tavern.ts comeHome), selling what they would
// in the Labyrinth. The merchant buys from your Inventory too.
// The room itself is in the Den, through its doorway (components/TavernRoom.tsx);
// this is the tavern's window, opened by tapping it there.

import Link from "next/link";
import MerchantCart from "@/components/MerchantCart";
import { Coin } from "@/components/GoldCount";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import LibrarianShelf from "@/components/LibrarianShelf";
import PixelSprite, { MaterialIcon } from "@/components/PixelSprite";
import { useGameState } from "@/hooks/useGameState";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { useState } from "react";
import { MATERIALS, MATERIAL_KEYS, countMaterial, materialDrop } from "@/lib/items/materials";
import ItemPicker, { type PickerTab } from "@/components/ItemPicker";
import type { CreatureOrItemDrop } from "@/lib/types";
import { codexPrice, loadDungeon, waresFor } from "@/lib/dungeon/run";
import { hasPitPlan } from "@/lib/trainingPit";
import { REPAIR_COST, SUMMON_PRICE, VISITOR_STAY, canRepair, materialOffer, repairNeeds, tavernVisitor, type Visitor } from "@/lib/tavern";

const MUTED = "rgba(255,255,255,0.5)";

export default function TavernPage() {
  const game = useGameState();
  const t = game.tavern;
  // Trading with the merchant: buying or selling, and the thing tapped once
  // to sell (a second tap sells it).
  const [trade, setTrade] = useState<"buy" | "sell">("buy");
  const [armed, setArmed] = useState<string | null>(null);
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
  // A wanderer calling, standing as they do in the Labyrinth's tunnels.
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
              <li>Once it&apos;s repaired, a <b>merchant</b> or a <b>librarian</b> sometimes calls when you come home from a run, and stays for {VISITOR_STAY} runs. The <b>merchant</b> also buys: gear for what the crate pays, the rest at half his price.</li>
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

        {t.repaired && !visitor && <p style={{ fontSize: 13, color: MUTED, margin: "10px 0 0" }}>Nobody&apos;s in. Travellers call when you&apos;re back from a run.</p>}

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
                <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 6px" }}>&ldquo;Let&apos;s see what you&apos;ve got.&rdquo;</p>
                <TavernSell game={game} armed={armed} setArmed={setArmed} />
                <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>You have {game.gold} gold.</p>
              </>
            )}
          </div>
        )}
        {visitor === "librarian" && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 13, color: "#d8d4c8", margin: 0 }}>&ldquo;Codexes,&rdquo; it whispers. &ldquo;Each teaches one creature a move — once.&rdquo;</p>
            <LibrarianShelf offers={t.offers ?? []} bought={t.bought} price={codexPrice} gold={game.gold} full={game.shelfFree <= 0 ? "Bookcase full" : undefined}
              room={`bookcase ${game.shelfFree > 0 ? `${game.shelfFree} free` : "full"}`} onBuy={game.buyTavernCodex} />
          </div>
        )}

        {/* The Training Pit (its own window), once you've the Hydra's plans. */}
        {(t.pit || hasPitPlan(loadDungeon().meta.deepClears ?? 0)) && (
          <Link href="/training" className="pixel-btn" style={{ display: "block", textAlign: "center", marginTop: 10, minHeight: 44 }}>
            🏋️ {t.pit ? "Training Pit" : "Plans: a Training Pit"}{game.trainingStatus()?.full ? " ❗" : ""}
          </Link>
        )}

        {/* Sending for someone: a second tap pays (and sends whoever's in on their way). */}
        {t.repaired && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: MUTED }}>Send for:</span>
            {(["merchant", "librarian"] as const).map((who) => {
              const on = summoning === who;
              return (
                <button key={who} className="chip" disabled={game.gold < SUMMON_PRICE}
                  onClick={() => { if (!on) { setSummoning(who); return; } setSummoning(null); setArmed(null); setTrade("buy"); game.summonTavernVisitor(who); }}
                  style={{ minHeight: 44, flex: 1, background: on ? "#6e1f18" : undefined }}>
                  {on ? <>Pay <Coin /> {SUMMON_PRICE}?</> : <>{visitor === who ? `A new ${who}` : who === "merchant" ? "Merchant" : "Librarian"} <Coin /> {SUMMON_PRICE}</>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DenFrame>
  );
}

// Selling to the merchant: your Inventory (not what's worn, packed or
// favourited) laid out as in the chest, by category; tap a thing to see it,
// then Sell (twice: the second tap sells). Materials go one at a time.
function TavernSell({ game, armed, setArmed }: { game: ReturnType<typeof useGameState>; armed: string | null; setArmed: (id: string | null) => void }) {
  const offers = game.tavernSells();
  const price = new Map(offers.map((x) => [x.drop.id, x.price]));
  const of = (f: (d: CreatureOrItemDrop) => boolean) => offers.map((x) => x.drop).filter(f);
  const kind = (d: CreatureOrItemDrop) => d.itemCategory === "weapon" ? "weapons" : d.itemCategory === "armor" ? "armor" : d.codexMove ? "codexes" : "other";
  // Materials are a tally: one stack each, with a stable id.
  const materials = MATERIAL_KEYS.filter((k) => countMaterial(game.materials, k) > 0 && materialOffer(k) > 0) // (he won't take essence stones)
    .map((k) => ({ ...materialDrop(k, countMaterial(game.materials, k)), id: `material:${k}` }) as CreatureOrItemDrop);
  const tabs: PickerTab[] = [
    { key: "weapons", label: "Weapons", items: of((d) => kind(d) === "weapons") },
    { key: "armor", label: "Armour", items: of((d) => kind(d) === "armor") },
    { key: "other", label: "Items", items: of((d) => kind(d) === "other") },
    { key: "codexes", label: "Codexes", items: of((d) => kind(d) === "codexes") },
    { key: "materials", label: "Materials", items: materials },
  ];
  return (
    <ItemPicker tabs={tabs} emptyText="Nothing of this kind he'd buy."
      badge={(d) => (price.has(d.id) ? `🪙 ${price.get(d.id)}` : undefined)}
      action={(d) => {
        const mat = d.material;
        const gold = mat ? materialOffer(mat) : price.get(d.id) ?? 0;
        const on = armed === d.id;
        return (
          <button className="chip" style={{ minHeight: 44, background: on ? "#6e1f18" : undefined }}
            onClick={() => {
              if (!on) { setArmed(d.id); return; }
              if (mat) game.sellMaterialToTavern(mat);
              else { setArmed(null); game.sellToTavern(d.id); }
            }}>
            {on ? "Sell?" : mat ? "Sell 1" : "Sell"} <Coin /> {gold}
          </button>
        );
      }} />
  );
}
