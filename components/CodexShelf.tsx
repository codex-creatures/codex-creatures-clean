"use client";
// components/CodexShelf.tsx
// Your codexes, on the bookcase's shelves (size: how many it holds). Shown in
// the Bookcase. Each is a book on the shelf;
// tap one to see it in a box on top: its title (and race, for a race
// codex), then the move it teaches (CodexMove). Nothing tapped, no box (the user, 2026-11-24). Teach shows your creatures,
// with their levels, greyed out where one can't learn it; tap one to teach it (if its move
// slots are full, you pick a move for it to forget). The codex is used up.
// Sell gets rid of one you don't want (after a Yes), for what a merchant pays, to free the shelf.
// The box keeps its size whichever codex is picked, so flicking between them moves nothing.

import { useState } from "react";
import CodexMove from "./CodexMove";
import { MoveTile } from "./MoveTile";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import { CODEX_SPRITE } from "@/lib/sprites/items";
import { MOVE_BY_NAME, MOVE_SLOTS, moveOf, canLearnFromCodex, findCreatureTemplate, isSpecialMove, hasSteadyMove, learnRacesOf, resolveMoves, STEADY_MAX_ENERGY } from "@/lib/creatures/creatureData";
import { RARITY_COLORS, rarityGlow } from "@/lib/items/gameHelpers";
import { sortByRarity } from "./TileGrid";
import { NAME } from "./ContainerLoot";
import type { CreatureOrItemDrop, Drop } from "@/lib/types";
import { codexSellPrice } from "@/lib/dungeon/run";
import { clampLevel } from "@/lib/creatures/levels";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

// Teaching from the shelf: the game's learnCodex and setMoves, and a
// creature's current move slots (its loadout's, if set).
type Teach = { onLearn: (creatureId: string, codexId: string) => void; onSetMoves: (creatureId: string, moves: string[]) => void; movesOf: (creatureId: string) => string[] | undefined };

// Shared with the Labyrinth's bag (components/dungeon/Bag.tsx), so a codex is taught the same way there.
// A creature's move slots (moves: its loadout's, if set).
export function codexSlots(x: CreatureOrItemDrop, moves?: string[]): string[] {
  const t = findCreatureTemplate(x.creatureId, x.name);
  return t ? resolveMoves(t, moves ?? x.moves).map((m) => m.name) : [];
}
// Why a creature can't learn a codex's move (undefined if it can).
export function codexBlock(x: CreatureOrItemDrop, move: string | undefined, slots: string[]): string | undefined {
  const t = findCreatureTemplate(x.creatureId, x.name);
  if (!t || !move) return "Can't learn it";
  const raceLocked = !!MOVE_BY_NAME[move] && learnRacesOf(MOVE_BY_NAME[move]).length > 0;
  if (!canLearnFromCodex(t, move)) return isSpecialMove(move) ? "Not on its list" : raceLocked ? "Wrong race" : "Can't learn it";
  if (x.learned?.includes(move) || slots.includes(move)) return "Knows it";
  return undefined;
}
// Its slots are full: pick a move for it to forget, then Confirm (reading the codex uses it up, so the swap waits).
export function ForgetMove({ creature, move, slots, onLearn, onBack }: {
  creature: CreatureOrItemDrop; move: string; slots: string[]; onLearn: (moves: string[]) => void; onBack: () => void;
}) {
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const t = findCreatureTemplate(creature.creatureId, creature.name);
  return (
    <>
      <div className="pixel-font" style={{ fontSize: 14, color: GOLD, marginBottom: 8 }}>{creature.name}&apos;s slots are full: forget which?</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {slots.map((n, i, all) => {
          // It must keep a move it can always afford (no resting).
          const keeps = hasSteadyMove(all.map((x, j) => MOVE_BY_NAME[j === i ? move : x]).filter(Boolean));
          return MOVE_BY_NAME[n] && (
            <MoveTile key={n} m={t ? moveOf(t, n) : MOVE_BY_NAME[n]} selected={dropSlot === i} disabled={!keeps}
              note={keeps ? undefined : { text: `its last ≤${STEADY_MAX_ENERGY}⚡ move`, color: "#ff8a80" }}
              onClick={() => setDropSlot(dropSlot === i ? null : i)} />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button className="chip" style={{ visibility: dropSlot === null ? "hidden" : "visible" }}
          onClick={() => { const next = [...slots]; next[dropSlot!] = move; onLearn(next); }}>
          ✓ Forget {dropSlot === null ? "" : slots[dropSlot]}
        </button>
        <button className="chip" onClick={onBack}>Back</button>
      </div>
    </>
  );
}

export default function CodexShelf({ inventory, size, teach, onSell }: { inventory: Drop[]; size: number; teach?: Teach; onSell?: (codexId: string) => void }) {
  const codexes = sortByRarity(inventory.filter((d) => d.dropType === "item" && d.codexMove) as CreatureOrItemDrop[]);
  const creatures = inventory.filter((d) => d.dropType === "creature") as CreatureOrItemDrop[];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [teaching, setTeaching] = useState(false);                   // choosing who to teach
  const [forgetting, setForgetting] = useState<string | null>(null); // that creature's slots are full: which move goes
  const [taught, setTaught] = useState<string | null>(null);         // "X learned Y!"
  const [discarding, setDiscarding] = useState(false);               // "Sell it?" awaiting Yes / No
  const picked = codexes.find((c) => c.id === pickedId);
  const move = picked?.codexMove;

  const pick = (id: string | null) => { setPickedId(id); setTeaching(false); setForgetting(null); setTaught(null); setDiscarding(false); };
  const slotsOf = (x: CreatureOrItemDrop) => codexSlots(x, teach?.movesOf(x.id));
  const why = (x: CreatureOrItemDrop) => codexBlock(x, move, slotsOf(x));
  const learn = (x: CreatureOrItemDrop, moves: string[]) => {
    teach!.onLearn(x.id, picked!.id);
    teach!.onSetMoves(x.id, moves);
    setTaught(`${x.name} learned ${move}!`);
    setPickedId(null); setTeaching(false); setForgetting(null);
  };
  const choose = (x: CreatureOrItemDrop) => {
    const slots = slotsOf(x);
    if (slots.length < MOVE_SLOTS) learn(x, [...slots, move!]);
    else setForgetting(x.id);
  };
  const forgetter = creatures.find((x) => x.id === forgetting);

  return (
    <>
      <div className="pixel-font" style={{ fontSize: 15, color: GOLD, margin: "4px 0 8px" }}>On the shelf ({codexes.length}/{size})</div>
      {codexes.length === 0 && !taught ? (
        <p style={{ fontSize: 13, color: MUTED }}>Nothing yet. Codexes come from scanning and Labyrinth chests; wandering librarians sell race codexes.</p>
      ) : (
        <>
          {/* The picked codex: its title, its move, and Teach (or what just happened). */}
          {(picked || taught) && <div className="stone-panel" style={{ padding: 10, marginBottom: 10, height: 176, boxSizing: "border-box", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 8 }}>
            {picked ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span className="pixel-font" title={picked.name} style={{ fontSize: 16, color: RARITY_COLORS[picked.rarity].text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    textDecoration: "underline", textUnderlineOffset: 4, textDecorationThickness: 1 }}>{picked.name}</span>
                </div>
                <CodexMove move={move!} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, visibility: teach || onSell ? "visible" : "hidden" }}>
                  {discarding ? (
                    <>
                      <span className="pixel-font" style={{ fontSize: 14, color: GOLD }}>Sell it for {codexSellPrice(move!)} gold?</span>
                      <button className="pixel-btn" style={{ fontSize: 14, padding: "6px 14px", minHeight: 40 }}
                        onClick={() => { const name = picked.name, price = codexSellPrice(move!); onSell!(picked.id); pick(null); setTaught(`Sold ${name} for ${price} gold.`); }}>Yes</button>
                      <button className="pixel-btn" style={{ fontSize: 14, padding: "6px 14px", minHeight: 40 }} onClick={() => setDiscarding(false)}>No</button>
                    </>
                  ) : (
                    <>
                      {teach && <button className="pixel-btn" style={{ fontSize: 14, padding: "6px 14px", minHeight: 40 }}
                        onClick={() => { setTeaching((v) => !v); setForgetting(null); }}>{teaching ? "Cancel" : "📖 Teach"}</button>}
                      {onSell && <button className="pixel-btn" style={{ fontSize: 14, padding: "6px 14px", minHeight: 40 }}
                        onClick={() => { setDiscarding(true); setTeaching(false); setForgetting(null); }}>🪙 Sell · {codexSellPrice(move!)}</button>}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ gridRow: "1 / -1", fontSize: 13, color: "#7CFC9A", alignSelf: "center", textAlign: "center" }}>{taught}</div>
            )}
          </div>}

          {picked && teaching ? (
            forgetter ? (
              <ForgetMove key={forgetter.id} creature={forgetter} move={move!} slots={slotsOf(forgetter)} onLearn={(next) => learn(forgetter, next)} onBack={() => setForgetting(null)} />
            ) : (
              <>
                <div className="pixel-font" style={{ fontSize: 14, color: GOLD, marginBottom: 8 }}>Teach it to:</div>
                {creatures.length === 0 && <p style={{ fontSize: 13, color: MUTED }}>You haven&apos;t got any creatures yet.</p>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 6 }}>
                  {creatures.map((x) => {
                    const no = why(x);
                    const rc = RARITY_COLORS[x.rarity];
                    return (
                      <button key={x.id} disabled={!!no} onClick={() => choose(x)} title={no ? `${x.name}: ${no}` : `Teach ${x.name}`}
                        style={{ minHeight: 92, padding: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", cursor: no ? "default" : "pointer",
                          background: `radial-gradient(circle, ${rarityGlow(x.rarity)}, #101117 75%)`, border: `2px solid ${rc.border}`, color: "white",
                          opacity: no ? 0.4 : 1, filter: no ? "grayscale(1)" : undefined }}>
                        <PixelSprite sprite={creatureSprite(x.creatureId)} scale={1.5} style={{ maxWidth: "100%", maxHeight: 48, width: "auto", height: "auto" }} />
                        <span style={{ ...NAME, color: rc.text }}>{x.name}</span>
                        {/* Its level (the user, 2026-11-21), or why it can't learn it. */}
                        <span style={{ fontSize: 10, color: no ? MUTED : GOLD }}>{no ?? `Lv ${clampLevel(x.level)}`}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 6 }}>
              {codexes.map((c) => {
                const rc = RARITY_COLORS[c.rarity];
                const on = c.id === pickedId;
                return (
                  <button key={c.id} onClick={() => pick(on ? null : c.id)} aria-pressed={on} title={c.name}
                    style={{ minHeight: 72, padding: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer",
                      background: `radial-gradient(circle, ${rarityGlow(c.rarity)}, #101117 75%)`, border: `2px solid ${on ? "#ffd66e" : rc.border}`,
                      boxShadow: on ? "0 0 10px rgba(255,214,110,0.55)" : "0 2px 0 rgba(0,0,0,0.5)", color: "white" }}>
                    <PixelSprite sprite={CODEX_SPRITE} scale={1.25} />
                    <span style={{ ...NAME, color: rc.text }}>{c.name.replace(/^Codex: /, "")}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
