"use client";
// components/CodexShelf.tsx
// Your codexes, on the bookcase's shelves (size: how many it holds). Shown in
// the Bookcase and the Inventory's Codex tab. Each is a book on the shelf;
// tap one to see it in the box on top: its title (and race, for a race
// codex), then the move it teaches (CodexMove). Teach shows your creatures,
// greyed out where one can't learn it; tap one to teach it (if its move
// slots are full, you pick a move for it to forget). The codex is used up.
// Throw out gets rid of one you don't want (after a Yes), to free the shelf.
// The box on top keeps its size whatever's picked, so nothing moves.

import { useState } from "react";
import CodexMove from "./CodexMove";
import { MoveTile } from "./MoveTile";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import { MOVE_BY_NAME, MOVE_SLOTS, canLearnFromCodex, codexLearners, findCreatureTemplate, isSpecialMove, hasSteadyMove, learnRacesOf, resolveMoves, STEADY_MAX_ENERGY } from "@/lib/creatures/creatureData";
import { KIT_MOVE_RACE } from "@/lib/creatures/raceKitsV2";
import { RARITY_COLORS, rarityGlow } from "@/lib/items/gameHelpers";
import { sortByRarity } from "./TileGrid";
import { NAME } from "./ContainerLoot";
import type { CreatureOrItemDrop, Drop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

// Teaching from the shelf: the game's learnCodex and setMoves, and a
// creature's current move slots (its loadout's, if set).
type Teach = { onLearn: (creatureId: string, codexId: string) => void; onSetMoves: (creatureId: string, moves: string[]) => void; movesOf: (creatureId: string) => string[] | undefined };

export default function CodexShelf({ inventory, size, teach, onDiscard }: { inventory: Drop[]; size: number; teach?: Teach; onDiscard?: (codexId: string) => void }) {
  const codexes = sortByRarity(inventory.filter((d) => d.dropType === "item" && d.codexMove) as CreatureOrItemDrop[]);
  const creatures = inventory.filter((d) => d.dropType === "creature") as CreatureOrItemDrop[];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [teaching, setTeaching] = useState(false);                   // choosing who to teach
  const [forgetting, setForgetting] = useState<string | null>(null); // that creature's slots are full: which move goes
  const [taught, setTaught] = useState<string | null>(null);         // "X learned Y!"
  const [dropSlot, setDropSlot] = useState<number | null>(null);     // the move picked to forget, awaiting Confirm
  const [discarding, setDiscarding] = useState(false);               // "Throw it out?" awaiting Yes / No
  const picked = codexes.find((c) => c.id === pickedId);
  const move = picked?.codexMove;
  const raceLocked = !!move && !!MOVE_BY_NAME[move] && learnRacesOf(MOVE_BY_NAME[move]).length > 0;
  const learners = move ? codexLearners(move) : undefined;

  const pick = (id: string | null) => { setPickedId(id); setTeaching(false); setForgetting(null); setDropSlot(null); setTaught(null); setDiscarding(false); };
  const slotsOf = (x: CreatureOrItemDrop) => {
    const t = findCreatureTemplate(x.creatureId, x.name);
    return t ? resolveMoves(t, teach?.movesOf(x.id) ?? x.moves).map((m) => m.name) : [];
  };
  // Why a creature can't learn it (undefined if it can).
  const why = (x: CreatureOrItemDrop) => {
    const t = findCreatureTemplate(x.creatureId, x.name);
    if (!t || !move) return "Can't learn it";
    if (!canLearnFromCodex(t, move)) return isSpecialMove(move) ? "Not on its list" : raceLocked ? "Wrong race" : KIT_MOVE_RACE[move] ? "Not its kit" : "Wrong style";
    if (x.learned?.includes(move) || slotsOf(x).includes(move)) return "Knows it";
    return undefined;
  };
  const learn = (x: CreatureOrItemDrop, moves: string[]) => {
    teach!.onLearn(x.id, picked!.id);
    teach!.onSetMoves(x.id, moves);
    setTaught(`${x.name} learned ${move}!`);
    setPickedId(null); setTeaching(false); setForgetting(null); setDropSlot(null);
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
          {/* The picked codex: its title, its move, and Teach. */}
          <div className="stone-panel" style={{ padding: 10, marginBottom: 10, height: 176, boxSizing: "border-box", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 8 }}>
            {picked ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span className="pixel-font" title={picked.name} style={{ fontSize: 16, color: RARITY_COLORS[picked.rarity].text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    textDecoration: "underline", textUnderlineOffset: 4, textDecorationThickness: 1 }}>{picked.name}</span>
                  {learners && <span className="pixel-font" style={{ flexShrink: 0, fontSize: 12, textTransform: "uppercase", whiteSpace: "nowrap", color: learners.color, border: `2px solid ${learners.color}55`, padding: "1px 8px" }}>{learners.text}</span>}
                </div>
                <CodexMove move={move!} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, visibility: teach || onDiscard ? "visible" : "hidden" }}>
                  {discarding ? (
                    <>
                      <span className="pixel-font" style={{ fontSize: 14, color: GOLD }}>Throw it out?</span>
                      <button className="pixel-btn" style={{ fontSize: 14, padding: "6px 14px", minHeight: 40 }}
                        onClick={() => { const name = picked.name; onDiscard!(picked.id); pick(null); setTaught(`Threw out ${name}.`); }}>Yes</button>
                      <button className="pixel-btn" style={{ fontSize: 14, padding: "6px 14px", minHeight: 40 }} onClick={() => setDiscarding(false)}>No</button>
                    </>
                  ) : (
                    <>
                      {teach && <button className="pixel-btn" style={{ fontSize: 14, padding: "6px 14px", minHeight: 40 }}
                        onClick={() => { setTeaching((v) => !v); setForgetting(null); setDropSlot(null); }}>{teaching ? "Cancel" : "📖 Teach"}</button>}
                      {onDiscard && <button className="pixel-btn" style={{ fontSize: 14, padding: "6px 14px", minHeight: 40 }}
                        onClick={() => { setDiscarding(true); setTeaching(false); setForgetting(null); setDropSlot(null); }}>🗑 Throw out</button>}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ gridRow: "1 / -1", fontSize: 13, color: taught ? "#7CFC9A" : MUTED, alignSelf: "center", textAlign: "center" }}>{taught ?? "Tap a codex to see its move."}</div>
            )}
          </div>

          {picked && teaching ? (
            forgetter ? (
              <>
                <div className="pixel-font" style={{ fontSize: 14, color: GOLD, marginBottom: 8 }}>{forgetter.name}&apos;s slots are full: forget which?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {slotsOf(forgetter).map((n, i, all) => {
                    // It must keep a move it can always afford (no resting).
                    const keeps = hasSteadyMove(all.map((x, j) => MOVE_BY_NAME[j === i ? move! : x]).filter(Boolean));
                    return MOVE_BY_NAME[n] && (
                      <MoveTile key={n} m={MOVE_BY_NAME[n]} selected={dropSlot === i} disabled={!keeps}
                        note={keeps ? undefined : { text: `its last ≤${STEADY_MAX_ENERGY}⚡ move`, color: "#ff8a80" }}
                        onClick={() => setDropSlot(dropSlot === i ? null : i)} />
                    );
                  })}
                </div>
                {/* Reading the codex uses it up, so the swap waits for a Confirm. */}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button className="chip" style={{ visibility: dropSlot === null ? "hidden" : "visible" }}
                    onClick={() => { const next = slotsOf(forgetter); next[dropSlot!] = move!; learn(forgetter, next); }}>
                    ✓ Forget {dropSlot === null ? "" : slotsOf(forgetter)[dropSlot]}
                  </button>
                  <button className="chip" onClick={() => { setForgetting(null); setDropSlot(null); }}>Back</button>
                </div>
              </>
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
                        <span style={{ fontSize: 10, color: MUTED, visibility: no ? "visible" : "hidden" }}>{no ?? "-"}</span>
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
                    <span style={{ fontSize: 26, lineHeight: 1 }}>📖</span>
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
