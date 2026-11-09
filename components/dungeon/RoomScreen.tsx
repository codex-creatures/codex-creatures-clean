"use client";
// components/dungeon/RoomScreen.tsx
// The room you're in (the scroll-map runs, and a walkable room's window): what's there and what you can do. Moved out of app/dungeon/page.tsx as it was.

import { type SlotLook } from "@/components/BagSlots";
import MerchantCart from "@/components/MerchantCart";
import MerchantBag from "@/components/MerchantBag";
import { CREATURE_BY_ID, raceNames } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import type { CreatureOrItemDrop } from "@/lib/types";
import { isClub } from "@/lib/quest";
import { type Guess } from "@/lib/dungeon/witch";
import { AI_LEVEL_LABELS } from "@/lib/combat/thinkingAi";
import { squadsOf, CHEST_DROPS, DECK_CARDS, ROOM_INFO, hasFight, codexPrice, type Ware, waresFor, type BagEntry, fightingTeam, gearName, type DungeonRun, type Room, dungeonOf, bossLevel, dynamiteHere } from "@/lib/dungeon/run";
import { rarityColor, MUTED, type OwnedCreature } from "@/components/BattleScreen";
import { combatSummary } from "@/lib/combat/loadout";
import { BOSS_PARTS_OF, bossTeam } from "@/lib/creatures/bosses";
import { RoomIcon } from "@/components/DungeonMapView";
import LibrarianShelf from "@/components/LibrarianShelf";
import { type StoragePlan } from "@/lib/items/materials";
import EncampmentPanel from "./EncampmentPanel";
import WitchTable from "./WitchTable";

function combatLine(f: Parameters<typeof combatSummary>[0]): string {
  const s = combatSummary(f);
  return `${s.hp} HP · Atk ${Math.round(s.atk)} · Rng ${Math.round(s.rng)} · Mag ${Math.round(s.mag)} · Agi ${Math.round(s.agil)} · MDef ${Math.round(s.mdef)} · RDef ${Math.round(s.rdef)} · MgDef ${Math.round(s.magdef)}`;
}

export default function RoomScreen({ run, room, notes, byId, gold, bagUsed, bagSlots, stacks, onLook, onTreasure, onClub, clubEntry, onTakeBox, onTakeBoxHome, onChest, onDeck, onOpenSack, onBuyWares, plans, onCage, onHeal, onBuy, onNext, onWitch, onWitchSit, onWitchLeave, bagLooks, bagOffers, onSell, onUseBag, onDynamite }: {
  plans: StoragePlan[]; // storage schematics you have or built (the merchant won't offer them)
  onWitch: (g: Guess) => void; onWitchSit: () => void; onWitchLeave: () => void; onLook: () => void; onDynamite: () => void;
  bagLooks: (SlotLook | null)[]; bagOffers: number[]; onSell: (bagIndex: number) => void; onUseBag: (bagIndex: number) => void;
  run: DungeonRun; room: Room; notes: string[]; byId: (id: string) => OwnedCreature | undefined; gold: number;
  onTreasure: (r: Room) => void; onClub: () => void; clubEntry?: BagEntry;
  onTakeBox: () => void; onTakeBoxHome: () => void; onChest: () => void; onDeck: () => void; onOpenSack: () => void; onBuyWares: (ws: Ware[]) => void; onCage: (i: number) => void; bagUsed: number; bagSlots: number; stacks: string[]; onHeal: (id: string) => void; onBuy: (move: string) => void; onNext: () => void;
}) {
  const info = room.quest === "club" ? { name: "A dropped club", icon: "🏏" } : room.quest === "thief" ? { name: "The thief", icon: "💀" } : ROOM_INFO[room.kind];
  // What's in a sack or chest (a stash, or a beaten fight's loot): tap to take.
  const sackPanel = (room.sack?.length ?? 0) > 0
    ? <button className="pixel-btn" style={{ marginTop: 8 }} onClick={onLook}>🔍 Look inside ({room.sack!.length})</button>
    : <p style={{ fontSize: 13, color: "#d8d4c8", margin: "8px 0 0" }}>Empty now.</p>;
  // A beaten fight's loot: the container, then what's in it once opened.
  const fightLoot = room.container && (room.opened ? sackPanel : (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>
        {room.container === "strongbox" ? `${room.boss === "hydra" ? "Under the Hydra's coils lies" : "Behind the Warden's throne sits"} a strongbox: black iron, chains, and a lock that glows cold.` : room.container === "chest" ? "It leaves a rickety old chest behind, its lid hanging loose." : "It leaves a grubby sack behind."}
      </p>
      <button className="pixel-btn" onClick={onOpenSack}>{room.container === "strongbox" ? "🗝️ Open the strongbox" : room.container === "chest" ? "🧰 Loot the chest" : "💰 Loot the sack"}</button>
    </div>
  ));
  // The club on the floor: not looked at yet, or still lying there.
  const clubShut = room.quest === "club" && !!room.sack && !room.opened;
  const clubLeft = room.quest === "club" && !!room.opened && (room.sack ?? []).some((x) => "gear" in x && isClub(x.gear as CreatureOrItemDrop));
  const onward = <p className="pixel-font" style={{ fontSize: 13, color: "#c9b48a", margin: "12px 0 0" }}>{run.walk ? "Close this and walk on." : "↑ Take a tunnel to move on."}</p>;
  const top = room.kind === "boss" || (dungeonOf(run) === 0 && room.kind === "encampment");
  const next = top ? <button className="pixel-btn" style={{ marginTop: 12 }} onClick={onNext}>Finish →</button>
    : room.quest === "thief" ? (room.boxTaken ? (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 14, color: "#f1d9a0", fontStyle: "italic", margin: "0 0 10px" }}>
          &ldquo;This looks like the box Klutz was talking about. Let&apos;s take it to him.&rdquo;
        </p>
        <button className="pixel-btn" onClick={onTakeBoxHome}>Continue</button>
      </div>
    ) : (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>
          The Baby Cyclops howls, drops what it was carrying and scampers off into the dark. A battered box thuds onto the floor, a sword hilt poking out of the lid.
        </p>
        <button className="pixel-btn" onClick={onTakeBox}>📦 Pick up the box</button>
      </div>
    )) : onward;

  return (
    <div className="stone-panel">
      <div className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}><RoomIcon kind={room.kind} icon={info.icon} /> {info.name}</div>

      {notes.map((n) => <div key={n} style={{ fontSize: 13, color: "#f1d9a0", marginTop: 4 }}>{n}</div>)}

      {clubShut ? (
        <>
          <p style={{ fontSize: 15, color: "#d8d4c8" }}>
            A battered old club with <i>KLUTZ</i> scratched into it. The thief dropped it — you can hear it clattering on ahead.
          </p>
          <button className="pixel-btn tutorial-pulse" onClick={onOpenSack}>Pick up the club</button>
        </>
      ) : clubLeft ? (
        <>
          <div className="tutorial-tip" style={{ marginTop: 10 }}>
            <b>Looting.</b> Klutz&apos;s Club is still on the floor. Pick it up, and give it to one of your creatures before you go on.
          </div>
          <button className="pixel-btn tutorial-pulse" style={{ marginTop: 8 }} onClick={onLook}>Pick up the club</button>
        </>
      ) : room.quest === "club" && (room.done ? (
        <>
          {clubEntry ? (
            <div className="tutorial-tip" style={{ marginTop: 10 }}>
              <b>Equipping gear.</b> Klutz&apos;s Club is in your bindle now. It&apos;s not much, but it&apos;s better than bare claws —
              give it to one of your creatures before you go on. Drag it onto one below, or tap it.
              <div style={{ textAlign: "center", fontSize: 22, marginTop: 4 }}><span className="tutorial-arrow">👇</span></div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#d8d4c8", marginTop: 8 }}>Club in hand. Somewhere ahead, bones are rattling…</p>
              {onward}
            </>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, color: "#d8d4c8" }}>
            A battered old club with <i>KLUTZ</i> scratched into it. The thief dropped it — you can hear it clattering on ahead.
          </p>
          <button className="pixel-btn" onClick={onClub}>Pick up the club</button>
        </>
      ))}

      {room.kind === "treasure" && !room.quest && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>A battered chest sits in the middle of the room, coins spilling from the lid.</p>
          <button className="pixel-btn" onClick={() => onTreasure(room)}>Take the gold</button>
        </>
      ))}

      {room.kind === "chest" && (room.done ? <>{sackPanel}{next}</> : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>An old chest, humming faintly — like the barcodes do. {CHEST_DROPS} things rattle inside.</p>
          <button className="pixel-btn" onClick={onChest}>Open it</button>
        </>
      ))}

      {room.kind === "witch" && room.witch && <WitchTable key={run.path.length} room={room} victim={byId(run.illness?.id ?? "")?.name} onSit={onWitchSit} onGuess={onWitch} onLeave={onWitchLeave} next={next} />}

      {room.kind === "cards" && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>A deck of cards lies face down on a stone table, each one faintly warm. {DECK_CARDS} creature cards — whatever they turn out to be.</p>
          <button className="pixel-btn" onClick={onDeck}>Turn them over</button>
        </>
      ))}

      {room.kind === "campfire" && (
        <><p style={{ fontSize: 13, color: "#d8d4c8" }}>A campfire crackles. Stand by it and your team warms up while it lasts.</p>{onward}</>
      )}
      {room.kind === "pool" && (room.done ? (
        <><p style={{ fontSize: 13, color: "#d8d4c8" }}>The water goes still.</p>{next}</>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>Glowing water. It can fully restore <b>one</b> creature — even one that was knocked out.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {run.party.map((id) => {
              const c = byId(id);
              const hp = run.hp[id] ?? 1;
              return c && (
                <button key={id} className="card-btn" disabled={hp >= 1} onClick={() => onHeal(id)} style={{ opacity: hp >= 1 ? 0.45 : 1 }}>
                  <b style={{ color: rarityColor(c.rarity) }}>{c.name}</b>
                  <span style={{ fontSize: 12, color: MUTED }}>{hp <= 0 ? "knocked out" : `${Math.round(hp * 100)}% HP`}{hp >= 1 ? " · already full" : ""}</span>
                </button>
              );
            })}
          </div>
          {onward}
        </>
      ))}

      {room.kind === "stash" && (!room.opened ? (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>A burlap sack slumps against the wall, tied at the neck. Something inside clinks.</p>
          <button className="pixel-btn" onClick={onOpenSack}>Open the sack</button>
          {onward}
        </>
      ) : <>{sackPanel}{onward}</>)}


      {room.kind === "merchant" && (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            A cart piled with odds and ends, and a merchant who smiles too much. &ldquo;One of each, friend. Everything takes a slot in your bag — the timber stacks, mind.&rdquo;
          </p>
          <MerchantCart key={run.path.length} wares={waresFor(room.wares ?? [], { bagSize: bagSlots }, plans)} bought={room.bought} gold={gold} bagUsed={bagUsed} bagSlots={bagSlots} stacks={stacks} onBuy={onBuyWares} />
          <MerchantBag key={`bag${run.path.length}`} slots={bagSlots} looks={bagLooks} offers={bagOffers} onSell={onSell} onUse={onUseBag} />
          {next}
        </>
      )}

      {(room.kind === "librarian" || (room.kind === "library" && room.librarian)) && (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            {room.kind === "library" ? "Between the toppled shelves, a hooded figure is sorting what's left. " : "A hooded figure sits among towers of crumbling books. "}
            &ldquo;Codexes,&rdquo; it whispers. &ldquo;Each teaches one creature a move — once.&rdquo;
          </p>
          <LibrarianShelf key={run.path.length} offers={room.offers ?? []} bought={room.bought} price={codexPrice} gold={gold} onBuy={onBuy}
            full={bagUsed >= bagSlots ? "Bag full" : undefined}
            room={<>🎒 {bagUsed}/{bagSlots}{bagUsed >= bagSlots && <span style={{ color: "#ff8a80" }}> full: sell something to make room</span>}</>} />
          {room.kind === "library" ? onward : next}
        </>
      )}

      {room.kind === "library" && !room.librarian && (!room.opened ? (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>Shelves to the ceiling, most of them toppled. Something bound in leather is still in there somewhere.</p>
          <button className="pixel-btn" onClick={onOpenSack}>🔍 Search the shelves</button>
          {onward}
        </>
      ) : <>{sackPanel}{onward}</>)}

      {room.kind === "storehouse" && !room.guarded && (!room.opened ? (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>Crates, sacks and barrels, stacked to the rafters. Someone was stocking up.</p>
          <button className="pixel-btn" onClick={onOpenSack}>🔍 Search the stores</button>
          {onward}
        </>
      ) : <>{sackPanel}{onward}</>)}

      {/* Klutz's dynamite (lib/tavern.ts): among the crates, once any guard is beaten. */}
      {dynamiteHere(room) && (
        <>
          <p style={{ fontSize: 13, color: "#ffb38a", margin: "8px 0 0" }}>Behind the barrels: a crate stamped <b>DANGER</b>. Dynamite!</p>
          <button className="pixel-btn tutorial-pulse" style={{ marginTop: 6 }} onClick={onDynamite}>🧨 Take the dynamite</button>
        </>
      )}
      {room.dynamite === false && <p style={{ fontSize: 13, color: "#7CFC9A", margin: "8px 0 0" }}>🧨 Klutz&apos;s dynamite is yours.</p>}

      {room.kind === "encampment" && (
        <EncampmentPanel room={room} fuse={squadsOf(dungeonOf(run)).fuse} onCage={onCage} />
      )}

      {hasFight(room) && room.done && fightLoot}
      {hasFight(room) && (room.done ? (room.kind === "encampment" && !top ? onward : next) : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8", margin: "6px 0 10px" }}>
            {room.quest === "thief" && "There it is: a Baby Cyclops, hunched over a battered box, picking through Klutz's weapons. Klutz ducks behind you: “Oi! That's mine! Go on — you fight, I'll tell you what to do.”"}
            {room.kind === "easy" && !room.quest && "A few creatures look up from their scraps. They don't look tough."}
            {room.kind === "hard" && "One creature, alone. Well fed. Well armed."}
            {room.kind === "miniboss" && "Something big has made this room its lair. One creature — but a Rare one, well armed, and it fights smart. Its chest is worth it."}
            {room.kind === "storehouse" && "Crates and barrels to the rafters — and something big has made its lair among them. Beat it and the stores are yours."}
            {room.kind === "encampment" && room.variant === "ambush" && "They were hiding behind the cages! Two of them come at you at once."}
            {room.kind === "encampment" && top && "The camp at the top: bedrolls, a cookfire, cages along the wall — and its chief, who doesn't want visitors. Beat it, and the cages are yours to open."}
            {room.kind === "encampment" && !top && room.variant !== "ambush" && "A camp: bedrolls, a cookfire, cages along the wall — and the creatures who live here."}
            {room.kind === "boss" && !room.boss && `The Warden of the Deep waits at the top of the climb, with two guards at its side. A Legendary and two Epics, all Lv ${bossLevel(run.dungeon ?? 2) - 1}+ — and they fight smart.`}
            {room.boss === "hydra" && "A Hydra fills the lair: three heads, each fighting its own way, taking turns from left to right. Tap a head to aim at it. A head that's cut down grows back unless you finish the others quickly, and sooner or later it breathes poison."}
            {room.boss === "cyclops" && "A Cyclops fills the chamber — a mountain of muscle with one huge, rolling eye. It's a melee brute: tough to hurt up close (magic hits it hardest), and its Stomp can cripple you badly (swapping out shakes it off… eventually). Something tells you this won't be the whole fight."}
            {!room.boss && <> They play like the {AI_LEVEL_LABELS[room.level ?? "normal"]} AI.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {room.boss && (room.boss === "hydra" ? BOSS_PARTS_OF.hydra : BOSS_PARTS_OF.cyclops.slice(0, 1)).map((p, i) => (
              <div key={p.id} style={{ fontSize: 13, padding: "6px 8px", background: "#12131a" }}>
                <b style={{ color: rarityColor("legendary") }}>{room.boss === "cyclops" ? "Cyclops" : p.name}</b>
                <span style={{ color: MUTED }}> · {p.label} · {combatLine(bossTeam(room.boss!, bossLevel(dungeonOf(run)))[i])}</span>
              </div>
            ))}
            {(room.enemies ?? []).map((e, i) => {
              const t = CREATURE_BY_ID[e.creatureId];
              return (
                <div key={i} style={{ fontSize: 13, padding: "6px 8px", background: "#12131a" }}>
                  <b style={{ color: rarityColor(t.rarity) }}>{t.name}</b>
                  <span className="pixel-font" style={{ color: "#f1d9a0" }}> Lv {e.level ?? 15}</span>
                  <span style={{ color: MUTED }}> · {raceNames(t) ? `${raceNames(t)} · ` : ""}{creatureTypeLabel(e.proficiency)} · {e.gear.length ? e.gear.map(gearName).join(", ") : "no gear"}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: MUTED }}>
            Win: {room.quest === "thief" ? "Klutz's box" : <>{room.gold} gold</>}.
            Your team: {fightingTeam(run).map((id) => byId(id)?.name).join(", ")}. Press <b>Fight!</b> on the room when you&apos;re ready.
          </p>
        </>
      ))}
    </div>
  );
}
