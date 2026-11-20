"use client";
// app/altar/page.tsx — the Soul Altar (the user, 2026-11-18; scanning moved
// to app/scan): where creatures are made. You stand over the altar's soul fire
// (AltarBackdrop) and choose, from two floating panels side by side:
// - Spirit Summon: your creature cards, a binder of them; 3 of a creature
//   summon it (components/altar/SummonRite.tsx, the whirlwind: SummonShow).
//   A ready stack opens its summoning straight away, as does /altar?summon=<id>
//   (a card's Summon button elsewhere); the others open the card (CardModal).
// - Ascend: give up creatures of a kind to raise one of them a rarity
//   (components/AscendRitual.tsx, lib/creatures/ascend.ts).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import DenFrame from "@/components/DenFrame";
import CardGallery, { CardFace } from "@/components/CardGallery";
import CardModal from "@/components/CardModal";
import AscendRitual from "@/components/AscendRitual";
import AltarBackdrop from "@/components/altar/AltarBackdrop";
import SummonRite from "@/components/altar/SummonRite";
import { CreatureArt } from "@/components/CreaturePortrait";
import Help, { HelpSection } from "@/components/Help";
import { isCardDrop, type CreatureOrItemDrop } from "@/lib/types";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import { CARDS_TO_SUMMON } from "@/lib/creatures/summon";
import { ASCEND_AFTER, ASCEND_FIRST, ASCEND_MIN_LEVEL, giveProblem, keepProblem, othersNeeded } from "@/lib/creatures/ascend";
import { altarMended, loadDungeon } from "@/lib/dungeon/run";

type Part = "summon" | "ascend";
const MUTED = "rgba(255,255,255,0.6)";
const GOLD = "#f1d9a0";

export default function AltarPage() {
  const game = useGameState();
  const [part, setPart] = useState<Part | null>(null);
  // Broken till the Encampment's chief drops its gem (lib/dungeon/run.ts altarMended).
  const mended = !game.hydrated || altarMended(loadDungeon().meta);
  const [openCard, setOpenCard] = useState<CreatureOrItemDrop | null>(null);
  const [rite, setRite] = useState<string | null>(null); // the creature being summoned (SummonRite)
  const cards = useMemo(() => game.inventory.filter(isCardDrop) as CreatureOrItemDrop[], [game.inventory]);
  const kindOf = (id: string) => cards.filter((d) => d.creatureId === id);
  // Its cards, fixed as the rite opens (summoning takes them out of the inventory mid-show).
  const [riteCards, setRiteCards] = useState<CreatureOrItemDrop[]>([]);
  function summonKind(id: string) { setOpenCard(null); setRiteCards(kindOf(id)); setRite(id); setPart("summon"); }

  // Sent here to summon a creature's cards (?summon=<id>, CardModal elsewhere).
  useEffect(() => {
    if (!game.hydrated || !mended) return;
    const id = new URLSearchParams(window.location.search).get("summon");
    if (id && kindOf(id).length >= CARDS_TO_SUMMON) summonKind(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.hydrated]);
  const creatures = useMemo(() => game.inventory.filter((d) => d.dropType === "creature") as CreatureOrItemDrop[], [game.inventory]);

  // What the panels say: summons you could do now, and creatures you could raise now.
  const stacks = useMemo(() => {
    const m = new Map<string, CreatureOrItemDrop[]>();
    for (const c of cards) m.set(c.creatureId ?? c.name, [...(m.get(c.creatureId ?? c.name) ?? []), c]);
    return [...m.values()].sort((a, b) => b.length - a.length);
  }, [cards]);
  const summonsReady = stacks.filter((s) => s.length >= CARDS_TO_SUMMON).length;
  const ascendReady = useMemo(() => {
    if (!game.hydrated) return [];
    const away = game.ascendAway(), busy = game.ascendBusy();
    return creatures.filter((k) => !keepProblem(k, away) && creatures.filter((o) => !giveProblem(k, o, busy)).length >= othersNeeded(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatures, game.hydrated]);

  const ascendKinds = new Set(ascendReady.map((c) => c.creatureId)).size;
  const back = part ? (
    <button className="chip pixel-font" onClick={() => setPart(null)} style={{ minHeight: 40, fontSize: 13, textTransform: "none", background: "rgba(10,14,18,0.7)" }}>← The altar</button>
  ) : null;

  return (
    <DenFrame title="Soul Altar" icon="🔮" gold={game.gold} fill>
      <div style={{ position: "relative", height: "100%", minHeight: 0, containerType: "size" }}>
        <AltarBackdrop size={part === "ascend" ? "58cqw" : "92cqw"} lift={part === "ascend" ? "31%" : "-8%"} dim={part === "summon" ? 0.55 : part === "ascend" ? 0.15 : 0} />

        <div style={{ position: "relative", zIndex: 1, height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
          {part === null && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 8px 0" }}>
                <AltarHelp />
              </div>
              <div className="pixel-font" style={{ textAlign: "center", color: "#9fe9d8", fontSize: "clamp(12px, 3.6cqw, 15px)", margin: "4cqh 16px 3cqh", textShadow: "0 0 10px rgba(80,230,200,0.6)" }}>
                {mended ? "The soul fire stirs. What will you make?" : "The altar is cracked and cold. The Encampment's chief has the gem that mends it."}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4cqw", padding: "0 4cqw" }}>
                <Choice title="Spirit Summon" sub="from cards" color="#7fd8ff" onClick={() => setPart("summon")} off={!mended}
                  note={summonsReady ? `${summonsReady} ready to summon` : `${CARDS_TO_SUMMON} cards make a creature`} lit={summonsReady > 0}
                  emblem={<CardFan cards={stacks[0] ?? []} />} />
                <Choice title="Ascend" sub="from creatures" color="#ffd66e" onClick={() => setPart("ascend")} delay={-2.5} off={!mended}
                  note={ascendKinds === 1 ? `${ascendReady[0].name} can ascend` : ascendKinds ? `${ascendKinds} kinds can ascend` : `${ASCEND_FIRST} of a kind, Lv ${ASCEND_MIN_LEVEL}+`} lit={ascendReady.length > 0}
                  emblem={<Rising creature={ascendReady[0] ?? creatures[0]} />} />
              </div>
            </>
          )}

          {part === "summon" && rite && (
            <SummonRite key={rite} cards={riteCards} onSummon={game.summon} onDone={() => setRite(null)}
              top={<><button className="chip pixel-font" onClick={() => setRite(null)} style={{ minHeight: 40, fontSize: 13, textTransform: "none", background: "rgba(10,14,18,0.7)" }}>← Cards</button>
                <span className="pixel-font" style={{ flex: 1, textAlign: "center", color: "#7fd8ff", fontSize: 15, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Summon {riteCards[0]?.name}</span><AltarHelp /></>} />
          )}

          {part === "summon" && !rite && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 4px" }}>
                {back}
                <span className="pixel-font" style={{ flex: 1, textAlign: "center", color: "#7fd8ff", fontSize: 15 }}>Spirit Summon</span>
                <AltarHelp />
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "0 8px 8px" }}>
                {cards.length === 0
                  ? <p style={{ margin: "8px 2px", fontSize: 14, color: MUTED }}>No creature cards yet. <Link href="/scan" style={{ color: "white", textDecoration: "underline" }}>Scan</Link> barcodes for them.</p>
                  : <CardGallery cards={cards} onOpen={(c) => (c.creatureId && kindOf(c.creatureId).length >= CARDS_TO_SUMMON ? summonKind(c.creatureId) : setOpenCard(c))} />}
              </div>
            </>
          )}

          {part === "ascend" && game.hydrated && <AscendRitual game={game} top={<>{back}<span className="pixel-font" style={{ flex: 1, textAlign: "center", color: "#ffd66e", fontSize: 15 }}>Ascend</span><AltarHelp /></>} />}
        </div>
      </div>

      {openCard && (
        <CardModal key={openCard.id} card={openCard}
          sameKind={cards.filter((d) => d.creatureId === openCard.creatureId)}
          onSummon={openCard.creatureId ? () => summonKind(openCard.creatureId!) : undefined} onClose={() => setOpenCard(null)} />
      )}
    </DenFrame>
  );
}

// One of the two choices: no frame, just light. A soft glow of its colour
// behind its emblem, its name, and a line on what you could do now.
function Choice({ title, sub, note, color, emblem, onClick, lit, delay = 0, off = false }: {
  title: string; sub: string; note: string; color: string; emblem: React.ReactNode; onClick: () => void; lit: boolean; delay?: number; off?: boolean; // off: the altar's broken
}) {
  return (
    <button className="altar-choice" onClick={onClick} disabled={off} aria-label={`${title}: ${note}`}
      style={{ opacity: off ? 0.35 : 1, filter: off ? "grayscale(1)" : undefined, animationDelay: `${delay}s`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 6px 12px", minWidth: 0,
        border: "none", color: "inherit", font: "inherit", cursor: "pointer",
        background: `radial-gradient(ellipse 70% 60% at 50% 42%, ${color}33 0%, ${color}12 45%, transparent 75%)` }}>
      <div style={{ position: "relative", width: "100%", height: "clamp(110px, 26cqh, 190px)", display: "flex", alignItems: "center", justifyContent: "center",
        filter: `drop-shadow(0 0 14px ${color}88)` }}>
        {emblem}
      </div>
      <div className="pixel-font" style={{ fontSize: "clamp(15px, 5cqw, 21px)", color, textShadow: `0 0 12px ${color}aa`, whiteSpace: "nowrap" }}>{title}</div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: -4 }}>{sub}</div>
      <div className="pixel-font" style={{ fontSize: 12, color: lit ? GOLD : MUTED, minHeight: 30, lineHeight: "15px", textAlign: "center" }}>{note}</div>
    </button>
  );
}

// Spirit Summon's emblem: your biggest stack of cards, fanned (a card back if you've none).
function CardFan({ cards }: { cards: CreatureOrItemDrop[] }) {
  const t = cards[0] && findCreatureTemplate(cards[0].creatureId, cards[0].name);
  const angles = [-16, 0, 16];
  return (
    <div style={{ position: "relative", width: "52%", aspectRatio: "5 / 7" }}>
      {angles.map((a, i) => (
        <div key={i} style={{ position: "absolute", inset: 0, transform: `rotate(${a}deg) translateY(${i === 1 ? -6 : 0}px)`, transformOrigin: "50% 100%", zIndex: i === 1 ? 2 : 1 }}>
          {t ? <CardFace t={t} creatureId={t.id} soulStone={cards[Math.min(i, cards.length - 1)].soulStone} mini />
            : <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, #1c3440, #0c1820)", border: "2px solid #7fd8ff66", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🃏</div>}
        </div>
      ))}
    </div>
  );
}

// Ascend's emblem: one of your creatures, lifted on a column of light.
function Rising({ creature }: { creature?: CreatureOrItemDrop }) {
  return (
    <div style={{ position: "relative", width: "78%", height: "100%" }}>
      <div style={{ position: "absolute", left: "30%", right: "30%", top: "6%", bottom: 0, background: "linear-gradient(to top, rgba(255,214,110,0.45), transparent)", filter: "blur(6px)" }} />
      <div style={{ position: "absolute", left: "10%", right: "10%", top: "4%", height: "74%" }}>
        {creature ? <CreatureArt creatureId={creature.creatureId} title={creature.name} /> : <span style={{ fontSize: 40 }}>✨</span>}
      </div>
      <div style={{ position: "absolute", left: "24%", right: "24%", bottom: "4%", height: 10, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,214,110,0.7), transparent 70%)" }} />
    </div>
  );
}

function AltarHelp() {
  return (
    <Help title="The Soul Altar">
      <HelpSection title="Spirit Summon">
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
  );
}
