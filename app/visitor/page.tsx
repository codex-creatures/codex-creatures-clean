"use client";
// app/visitor/page.tsx
// Whoever's visiting the tavern (lib/tavern.ts: a merchant, a librarian or the
// creature collector), opened by tapping them as they stroll round its room
// (components/TavernRoom.tsx). The merchant and librarian sell what they would
// in the Labyrinth, and the merchant buys from your Inventory too. The
// collector buys creatures and trades 3 of a rarity for a card one up
// (lib/collector.ts). Sending for one is at the tavern (app/tavern).

import Link from "next/link";
import MerchantCart from "@/components/MerchantCart";
import { Coin } from "@/components/GoldCount";
import DenFrame from "@/components/DenFrame";
import LibrarianShelf from "@/components/LibrarianShelf";
import { useGameState } from "@/hooks/useGameState";
import { useState } from "react";
import { MATERIAL_KEYS, countMaterial, materialDrop } from "@/lib/items/materials";
import ItemPicker, { type PickerTab } from "@/components/ItemPicker";
import type { CreatureOrItemDrop } from "@/lib/types";
import { codexPrice, loadDungeon, waresFor } from "@/lib/dungeon/run";
import TileGrid from "@/components/TileGrid";
import { gearMarks } from "@/components/CreatureMarks";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { Rarity } from "@/lib/items/budgets";
import { TRADE_UP_COUNT, creaturePrice, rarityAbove } from "@/lib/collector";
import { materialOffer, tavernVisitor, type Visitor } from "@/lib/tavern";

const MUTED = "rgba(255,255,255,0.5)";
const TITLE: Record<Visitor, { title: string; icon: string }> = {
  merchant: { title: "Travelling merchant", icon: "🛒" },
  librarian: { title: "Wandering librarian", icon: "📚" },
  collector: { title: "Creature collector", icon: "🫙" },
};

export default function VisitorPage() {
  const game = useGameState();
  const t = game.tavern;
  // Trading with the merchant: buying or selling, and the thing tapped once
  // to sell (a second tap sells it).
  const [trade, setTrade] = useState<"buy" | "sell">("buy");
  const [armed, setArmed] = useState<string | null>(null);
  const visitor = game.hydrated ? tavernVisitor(t) : undefined;
  if (!game.hydrated) return <DenFrame title="Visitor" icon="🍺"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;
  if (!visitor) {
    return (
      <DenFrame title="Visitor" icon="🍺">
        <p style={{ color: MUTED }}>Nobody&apos;s visiting. Travellers call when you&apos;re back from a run, or send for one at the tavern.</p>
        <Link href="/" className="pixel-btn">← Back to the Den</Link>
      </DenFrame>
    );
  }
  return (
    <DenFrame title={TITLE[visitor].title} icon={TITLE[visitor].icon}>
      <div className="stone-panel">
        {visitor === "merchant" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {(["buy", "sell"] as const).map((m) => (
                <button key={m} className="chip" onClick={() => { setTrade(m); setArmed(null); }}
                  style={{ minHeight: 44, flex: 1, background: trade === m ? "#5a3e22" : undefined }}>{m === "buy" ? "Buy" : "Sell"}</button>
              ))}
            </div>
            {trade === "buy" ? (
              <>
                <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 6px" }}>&ldquo;One of each, friend. It all goes in your Inventory.&rdquo;</p>
                <MerchantCart wares={waresFor(t.wares ?? [], loadDungeon().meta, game.heldStoragePlans(), game.klutz.packs ?? 0)} bought={t.bought} gold={game.gold} bagUsed={0} bagSlots={99} stacks={[]} onBuy={(ws) => ws.forEach(game.buyTavernWare)} />
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 13, color: "#d8d4c8", margin: 0 }}>&ldquo;Codexes,&rdquo; it whispers. &ldquo;Each teaches one creature a move — once.&rdquo;</p>
            <LibrarianShelf offers={t.offers ?? []} bought={t.bought} price={codexPrice} gold={game.gold} full={game.shelfFree <= 0 ? "Bookcase full" : undefined}
              room={`bookcase ${game.shelfFree > 0 ? `${game.shelfFree} free` : "full"}`} onBuy={game.buyTavernCodex} />
          </div>
        )}

        {visitor === "collector" && <CollectorDesk game={game} />}
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

// The creature collector: Sell (pick any number, then Sell; a second tap
// sells) or Trade up (pick TRADE_UP_COUNT of one rarity for a card one up).
// One rarity at a time, in tabs; a fixed frame: the grid scrolls in its own
// height, and the line under it keeps its place whatever's picked.
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
function CollectorDesk({ game }: { game: ReturnType<typeof useGameState> }) {
  const [mode, setMode] = useState<"sell" | "trade">("sell");
  const [rarity, setRarity] = useState<Rarity>("common");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [armed, setArmed] = useState(false); // Sell tapped once
  const [got, setGot] = useState<CreatureOrItemDrop | null>(null); // the last trade's card
  const offers = game.collectorOffers();
  const shown = offers.filter((d) => d.rarity === rarity);
  const chosen = shown.filter((d) => picked.has(d.id));
  const reset = () => { setPicked(new Set()); setArmed(false); };
  const up = rarityAbove(rarity);
  const canPick = (d: CreatureOrItemDrop) => mode === "sell" || (!!up && (picked.has(d.id) || chosen.length < TRADE_UP_COUNT));
  function toggle(d: CreatureOrItemDrop) {
    if (!canPick(d)) return;
    const next = new Set(picked);
    if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
    setPicked(next); setArmed(false);
  }
  const total = chosen.reduce((n, d) => n + creaturePrice(d), 0);
  function go() {
    if (mode === "sell") {
      if (!chosen.length) return;
      if (!armed) { setArmed(true); return; }
      chosen.forEach((d) => game.sellToCollector(d.id));
      setGot(null); reset();
      return;
    }
    const card = game.tradeUpWithCollector(chosen.map((d) => d.id));
    if (card) { setGot(card); reset(); }
  }
  const line = mode === "sell"
    ? (chosen.length ? <>{armed ? "Sell?" : `Sell ${chosen.length}`} <Coin /> {total}</> : "Pick creatures to sell")
    : !up ? "Legendaries can't be traded up"
    : <>Trade {chosen.length}/{TRADE_UP_COUNT} for <span style={{ color: RARITY_COLORS[up].text, textTransform: "capitalize" }}>{up}</span> card</>;
  const ready = mode === "sell" ? chosen.length > 0 : !!up && chosen.length === TRADE_UP_COUNT;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        {(["sell", "trade"] as const).map((m) => (
          <button key={m} className="chip" onClick={() => { setMode(m); reset(); setGot(null); }}
            style={{ minHeight: 44, flex: 1, background: mode === m ? "#5a3e22" : undefined }}>{m === "sell" ? "Sell" : "Trade up"}</button>
        ))}
      </div>
      <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 6px" }}>
        {mode === "sell" ? "“Creatures, friend. Good coin for good specimens.”" : `“${TRADE_UP_COUNT} of a kind and I'll part with something finer.”`}
      </p>
      <div role="tablist" style={{ display: "flex", border: "2px solid #2a2d38", borderRadius: 10, overflow: "hidden", background: "#101117" }}>
        {RARITIES.map((r, i) => {
          const on = r === rarity;
          return (
            <button key={r} role="tab" aria-selected={on} className="pixel-font" onClick={() => { setRarity(r); reset(); }}
              style={{ flex: 1, minWidth: 0, minHeight: 44, padding: "6px 2px", fontSize: 12, cursor: "pointer", border: "none", borderLeft: i ? "2px solid #2a2d38" : "none",
                background: on ? "#3a2c16" : "transparent", color: RARITY_COLORS[r].text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "capitalize" }}>
              {r.slice(0, 3)} <span style={{ opacity: 0.6 }}>{offers.filter((d) => d.rarity === r).length}</span>
            </button>
          );
        })}
      </div>
      <div style={{ height: "30cqh", overflowY: "auto" }}>
        {shown.length
          ? <TileGrid items={shown} favoriteIds={new Set()} groupBy="none" sellMode sellable={canPick} selected={picked} onOpen={toggle}
              badge={(d) => `🪙 ${creaturePrice(d)}`} gear={(d) => gearMarks(game.equipment[d.id]) || undefined} />
          : <p style={{ marginTop: 18, fontSize: 13, color: MUTED }}>No {rarity} creatures he can take.</p>}
      </div>
      <button className="pixel-btn" disabled={!ready} onClick={go}
        style={{ display: "block", width: "100%", minHeight: 44, marginTop: 8, background: armed ? "#6e1f18" : undefined }}>{line}</button>
      <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {got ? <>He hands you a card: <span style={{ color: RARITY_COLORS[got.rarity].text }}>{got.name}</span> (in your Inventory)</> : <>You have {game.gold} gold.</>}
      </p>
    </div>
  );
}
