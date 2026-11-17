"use client";
// app/altar/page.tsx — the Soul Altar (the user, 2026-11-18; scanning moved
// to app/scan): where creatures are made.
// - Summon: your creature cards, a binder of them; 3 of a creature summon it
//   (components/CardModal.tsx, the whirlwind: SummonShow).
// - Ascend: give up creatures of a kind to raise one of them a rarity
//   (components/AscendRitual.tsx, lib/creatures/ascend.ts).

import { useState } from "react";
import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import DenFrame from "@/components/DenFrame";
import CardGallery from "@/components/CardGallery";
import CardModal from "@/components/CardModal";
import AscendRitual from "@/components/AscendRitual";
import Help, { HelpSection } from "@/components/Help";
import { isCardDrop, type CreatureOrItemDrop } from "@/lib/types";
import { CARDS_TO_SUMMON } from "@/lib/creatures/summon";
import { ASCEND_AFTER, ASCEND_FIRST, ASCEND_MIN_LEVEL } from "@/lib/creatures/ascend";

type Part = "summon" | "ascend";

export default function AltarPage() {
  const game = useGameState();
  const [part, setPart] = useState<Part>("summon");
  const [openCard, setOpenCard] = useState<CreatureOrItemDrop | null>(null);
  const cards = game.inventory.filter(isCardDrop) as CreatureOrItemDrop[];

  return (
    <DenFrame title="Soul Altar" icon="🔮" gold={game.gold} fill>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="dock-tabs" style={{ flex: 1 }}>
            <button className="dock-tab" data-active={part === "summon"} onClick={() => setPart("summon")}>🃏 Summon</button>
            <button className="dock-tab" data-active={part === "ascend"} onClick={() => setPart("ascend")}>✨ Ascend</button>
          </div>
          <Help title="The Soul Altar">
            <HelpSection title="Summon">
              <p>{CARDS_TO_SUMMON} cards of a creature summon it. Keep one card&apos;s creature exactly as it is, or roll a new one. The cards are used up.</p>
            </HelpSection>
            <HelpSection title="Ascend">
              <ul>
                <li>Raise a creature a rarity by giving up others of its kind: {ASCEND_FIRST} in all for the first step, {ASCEND_AFTER} for each step after, up to Legendary.</li>
                <li>They must all be the same rarity at the time (so an Uncommon Moss Wolf needs Uncommon Moss Wolves), and Lv {ASCEND_MIN_LEVEL} or more. An XP scroll gets one there.</li>
                <li>It keeps its level, rolls, moves and soul stone, and grows towards its new rarity&apos;s stats as it levels: a little now, much more by Lv 30.</li>
                <li>The ones given up are gone, with their soul stones and codex moves. Their gear comes back to you.</li>
                <li>Its new rarity counts everywhere, PvP brackets included. ★ marks each step it has climbed.</li>
              </ul>
            </HelpSection>
          </Help>
        </div>

        {part === "summon" ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {cards.length === 0
              ? <p style={{ margin: "8px 2px", fontSize: 14, color: "rgba(255,255,255,0.55)" }}>No creature cards yet. <Link href="/scan" style={{ color: "white", textDecoration: "underline" }}>Scan</Link> barcodes for them.</p>
              : <CardGallery cards={cards} onOpen={setOpenCard} />}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            {game.hydrated && <AscendRitual game={game} />}
          </div>
        )}
      </div>

      {openCard && (
        <CardModal key={openCard.id} card={openCard}
          sameKind={cards.filter((d) => d.creatureId === openCard.creatureId)}
          onSummon={game.summon} onClose={() => setOpenCard(null)} />
      )}
    </DenFrame>
  );
}
