"use client";
// app/dungeon/page.tsx
// A run through dungeon 1: pick a party of up to 5, study the map scroll at
// the entrance, then step inside — from there you see only the room you're
// in and the tunnels leading on. Fight, heal and loot, and face the boss.
// The rules live in lib/dungeon/run.ts; the run is saved after every step,
// so leaving the page (or refreshing) never loses it.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import type { Drop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CREATURE_BY_ID, MOVE_BY_NAME, RACE_INFO } from "@/lib/creatures/creatureData";
import { makeCreatureDrop } from "@/lib/creatures/summon";
import { pickCreatureId, pickRarity } from "@/lib/items/gameHelpers";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { rollBarcodeOutcome } from "@/lib/barcodeRegistry";
import { dropFromOutcome, weaponDrop, armorDrop, codexDrop, randomCodexMove } from "@/lib/drops";
import type { ItemKey } from "@/lib/items/ceilings";
import type { ArmorKey } from "@/lib/items/armor";
import { AI_LEVEL_LABELS } from "@/lib/combat/thinkingAi";
import {
  PARTY_SIZE, TEAM_SIZE, ENTRY_FEE, CHEST_DROPS, CHEST_CODEX_CHANCE, CODEX_PRICE, DECK_CARDS, MINIBOSS_REVIVE_HP, ROOM_INFO, BAG_SIZE, POTIONS, addToBag, type PotionKey,
  startRun, stepInside, canMoveOn, moveOn, runPosition, leaveRoom, setTeam, fightingTeam, isAlive, isFight, enemyFighter, gearName, endRun,
  loadDungeon, saveDungeon, type DungeonSave, type DungeonRun, type Room,
} from "@/lib/dungeon/run";
import DenFrame from "@/components/DenFrame";
import { YOU } from "@/components/BattleLog";
import {
  BattleView, Bar, SectionTitle, StatsLine, loadOwnedCreatures, rarityColor, usePlayableBattle, MUTED,
  type Match, type MemberInfo, type OwnedCreature, type BagItem,
} from "@/components/BattleScreen";
import { combatSummary } from "@/lib/combat/loadout";
import { CYCLOPS_PARTS, cyclopsTeam } from "@/lib/creatures/bosses";
import DungeonMapView from "@/components/DungeonMapView";
import DungeonRoomView from "@/components/DungeonRoomView";

const GOLD = "#f5c542";

function combatLine(f: Parameters<typeof combatSummary>[0]): string {
  const s = combatSummary(f);
  return `${s.hp} HP · Atk ${Math.round(s.atk)} · Agi ${Math.round(s.agil)} · MDef ${Math.round(s.mdef)} · RDef ${Math.round(s.rdef)}`;
}

function dropLabel(d: Drop): string {
  if (d.dropType === "reward") return `${d.amount} gold`;
  if (d.dropType === "card") return `${d.name} card`;
  return d.dropType === "item" ? `${d.name} (${d.rarity})` : d.name;
}

export default function DungeonPage() {
  const game = useGameState();
  const [lab, setLab] = useState<DungeonSave | null>(null);
  const [owned, setOwned] = useState<OwnedCreature[]>([]);
  const [found, setFound] = useState<Drop[] | null>(null); // what the current room just gave you

  // Every change to the run is saved straight away.
  function update(next: DungeonSave) {
    saveDungeon(next);
    setLab(next);
  }
  function updateRun(fn: (r: DungeonRun) => DungeonRun) {
    const cur = loadDungeon();
    if (cur.run) update({ ...cur, run: fn(cur.run) });
  }
  function updateBag(fn: (bag: PotionKey[]) => PotionKey[]) {
    const cur = loadDungeon();
    update({ ...cur, meta: { ...cur.meta, bag: fn(cur.meta.bag ?? []) } });
  }
  const takeOne = (key: PotionKey) => updateBag((bag) => {
    const i = bag.indexOf(key);
    return i < 0 ? bag : [...bag.slice(0, i), ...bag.slice(i + 1)];
  });

  const battle = usePlayableBattle((m) => updateRun((r) => ({ ...r, battle: m })));

  useEffect(() => {
    const saved = loadDungeon();
    setLab(saved);
    setOwned(loadOwnedCreatures());
    // Back in the middle of a fight? Carry on where you left off.
    if (saved.run?.battle && saved.run.current && !saved.run.current.done) battle.resume(saved.run.battle as Match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = (id: string) => owned.find((c) => c.id === id);
  const run = lab?.run ?? null;

  // ── Starting and ending runs ──────────────────────────────────────
  function begin(party: string[]) {
    if (!lab) return;
    const free = lab.meta.runs === 0;
    if (!free && !game.spendGold(ENTRY_FEE)) return;
    const hp = Object.fromEntries(party.map((id) => [id, lab.meta.injuries[id] ?? 1]));
    const r = startRun(party, party.slice(0, TEAM_SIZE).filter((id) => hp[id] > 0), hp, lab.meta.runs + 1);
    update({ meta: { ...lab.meta, runs: lab.meta.runs + 1 }, run: r });
  }

  function goHome() {
    update(endRun(loadDungeon()));
    battle.clear();
    setFound(null);
  }

  function healAll() {
    if (lab) update({ ...lab, meta: { ...lab.meta, injuries: {} } });
  }

  // ── Room rewards ──────────────────────────────────────────────────
  function give(drops: Drop[], also: (r: DungeonRun) => DungeonRun = (r) => r) {
    for (const d of drops) {
      if (d.dropType === "reward") game.addGold(d.amount);
      else game.addDrop(d);
    }
    setFound(drops);
    updateRun((r) => also({ ...r, loot: [...r.loot, ...drops.map(dropLabel)] }));
  }

  const goldOnly = (amount: number): Drop => ({ id: crypto.randomUUID(), barcode: "", dropType: "reward", rewardKind: "resource", amount, createdAt: new Date().toISOString() });
  const markDone = (r: DungeonRun): DungeonRun => (r.current ? { ...r, current: { ...r.current, done: true } } : r);

  function takeTreasure(room: Room) {
    give([goldOnly(room.gold ?? 0)], markDone);
  }

  function openChest() {
    // Barcode-style drops. (When the barcode merchant outcome arrives, it must be left out here.)
    const drops: Drop[] = [];
    while (drops.length < CHEST_DROPS) {
      const d = dropFromOutcome(rollBarcodeOutcome());
      if (d) drops.push(d);
    }
    if (Math.random() < CHEST_CODEX_CHANCE) drops[drops.length - 1] = codexDrop(randomCodexMove());
    give(drops, markDone);
  }

  function buyCodex(move: string) {
    const room = lab?.run?.current;
    if (!room?.offers?.includes(move) || room.bought?.includes(move) || !game.spendGold(CODEX_PRICE)) return;
    const d = codexDrop(move);
    game.addDrop(d);
    updateRun((r) => (r.current ? { ...r, loot: [...r.loot, `Codex: ${move}`], current: { ...r.current, bought: [...(r.current.bought ?? []), move] } } : r));
  }

  function healOne(id: string) {
    updateRun((r) => markDone({ ...r, hp: { ...r.hp, [id]: 1 } }));
  }

  // Beating a mini boss: heal one creature to full, or revive one that was knocked out.
  function bless(id: string) {
    updateRun((r) => {
      if (!r.current) return r;
      const team = fightingTeam(r);
      // A revived creature steps back into the team if there's room.
      const back = (r.hp[id] ?? 1) <= 0 && team.length < TEAM_SIZE ? [...team, id] : team;
      return { ...r, team: back, hp: { ...r.hp, [id]: (r.hp[id] ?? 1) <= 0 ? MINIBOSS_REVIVE_HP : 1 }, current: { ...r.current, blessed: true } };
    });
  }

  // ── The battle bag ──────────────────────────────────────────────
  // A merchant has one of each potion.
  function buyPotion(key: PotionKey) {
    const cur = loadDungeon();
    if (cur.run?.current?.bought?.includes(key) || (cur.meta.bag ?? []).length >= BAG_SIZE || !game.spendGold(POTIONS[key].price)) return;
    updateBag((bag) => addToBag(bag, [key]));
    updateRun((r) => (r.current
      ? { ...r, loot: [...r.loot, POTIONS[key].name], current: { ...r.current, bought: [...(r.current.bought ?? []), key] } }
      : r));
  }

  function takeStash() {
    const items = loadDungeon().run?.current?.stash ?? [];
    updateBag((bag) => addToBag(bag, items));
    updateRun((r) => markDone({ ...r, loot: [...r.loot, ...items.map((k) => POTIONS[k].name)] }));
  }

  // Between rooms: drink a potion on anyone still standing.
  function drink(key: PotionKey, id: string) {
    const c = byId(id);
    const hp = run?.hp[id] ?? 1;
    if (!c || hp <= 0 || hp >= 1 || !(lab?.meta.bag ?? []).includes(key)) return;
    takeOne(key);
    updateRun((r) => ({ ...r, hp: { ...r.hp, [id]: Math.min(1, hp + POTIONS[key].heal / c.fighter.maxHp) } }));
  }

  // A deck of cards: DECK_CARDS creature cards, each rolled like a scan.
  function openDeck() {
    const drops = Array.from({ length: DECK_CARDS }, () =>
      makeCreatureDrop(CREATURE_BY_ID[pickCreatureId(pickRarity("", "random"))], "card", ""));
    give(drops, markDone);
  }

  // The boss is beaten: the run is over.
  function nextRoom() {
    setFound(null);
    battle.clear();
    updateRun(leaveRoom);
  }

  // Down a tunnel into the next room.
  function goTo(nodeId: string) {
    setFound(null);
    battle.clear();
    updateRun((r) => moveOn(r, nodeId));
  }

  // ── Fights ────────────────────────────────────────────────────────
  function startFight(r: DungeonRun) {
    const room = r.current!;
    const ids = fightingTeam(r).filter((id) => byId(id));
    const mine = ids.map((id) => byId(id)!);
    const info: MemberInfo[] = room.boss
      ? CYCLOPS_PARTS.map((p) => ({ rarity: CREATURE_BY_ID[p.id].rarity, label: p.label, weaponName: p.weaponName, armorName: p.armorName }))
      : room.enemies!.map((e) => ({
          rarity: CREATURE_BY_ID[e.creatureId].rarity,
          label: creatureTypeLabel(e.proficiency),
          weaponName: gearName(e.gear[0]),
          armorName: gearName(e.gear[1]),
        }));
    updateRun((x) => ({ ...x, current: { ...x.current!, fighters: ids } }));
    battle.start(
      { A: mine.map((c) => c.fighter), B: room.boss ? cyclopsTeam() : room.enemies!.map(enemyFighter) },
      { A: mine, B: info },
      room.level ?? "hard",
      {
        startHp: mine.map((c, i) => Math.round((r.hp[ids[i]] ?? 1) * c.fighter.maxHp)),
        title: room.boss ? "Dungeon · the Cyclops" : `Dungeon · room ${r.room}`,
        boss: room.boss,
      },
    );
  }

  // The fight is over: HP comes back to the party, and the winner's rewards.
  function finishFight(r: DungeonRun, m: Match) {
    const ids = r.current?.fighters ?? [];
    const hp = { ...r.hp };
    m.state.sides.A.team.forEach((f, i) => { if (ids[i]) hp[ids[i]] = f.hp / f.maxHp; });
    if (m.state.winner !== "A") {
      updateRun((x) => ({ ...x, hp, status: "dead", battle: undefined }));
      battle.clear();
      return;
    }
    const room = r.current!;
    const drops: Drop[] = [goldOnly(room.gold ?? 0)];
    for (const e of room.enemies ?? []) {
      for (const p of e.gear) {
        if (!p.drops) continue;
        drops.push(p.slot === "weapon" ? weaponDrop(p.key as ItemKey, p.rarity, "", p.stats) : armorDrop(p.key as ArmorKey, p.rarity, "", p.stats));
      }
    }
    give(drops, (x) => markDone({ ...x, hp, battle: undefined }));
  }

  // ── Screens ───────────────────────────────────────────────────────
  if (!lab || !game.hydrated) {
    return <DenFrame title="The Dungeon" icon="🌀"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;
  }

  const frame = (children: React.ReactNode) => (
    <DenFrame title="The Dungeon" icon="🌀" gold={game.gold}>{children}</DenFrame>
  );

  if (!run) {
    return frame(<Entrance lab={lab} owned={owned} gold={game.gold} onBegin={begin} onHeal={healAll} />);
  }

  // A fight in progress (or just finished).
  if (battle.match && run.current && isFight(run.current.kind) && !run.current.done && run.status === "exploring") {
    const m = battle.match;
    const over = !battle.view && m.state.winner;
    return frame(
      <>
        <RoomHeader run={run} />
        <BattleView
          battle={battle}
          bag={bagItems(lab.meta.bag ?? [])}
          onUseItem={(key) => takeOne(key as PotionKey)}
          finishedActions={over && (
            <button className="pixel-btn" onClick={() => finishFight(run, m)}>
              {m.state.winner === "A" ? "Collect your reward" : "Everything goes dark…"}
            </button>
          )}
        />
      </>
    );
  }

  if (run.status !== "exploring") {
    return frame(<RunOver run={run} lab={lab} onHome={goHome} />);
  }

  return frame(
    <>
      <RoomHeader run={run} />
      {!run.inside ? (
        <MapFirst run={run} onStep={() => updateRun(stepInside)} />
      ) : (
        <>
          <DungeonRoomView run={run} open={canMoveOn(run) && fightingTeam(run).length > 0} onGo={goTo} />
          {canMoveOn(run) && fightingTeam(run).length === 0 && (
            <p style={{ fontSize: 13, color: "#ff8a80", textAlign: "center" }}>Pick at least one creature that can still fight before you go on.</p>
          )}
          <div style={{ marginTop: 12 }}>
            {run.current
              ? <RoomScreen
                  run={run} room={run.current} found={found} byId={byId}
                  gold={game.gold} onTreasure={takeTreasure} onChest={openChest} onDeck={openDeck} onStash={takeStash} onBuyPotion={buyPotion} bag={lab.meta.bag ?? []} onHeal={healOne} onBless={bless} onBuy={buyCodex} onFight={() => startFight(run)} onNext={nextRoom}
                />
              : <AtEntrance run={run} />}
          </div>
        </>
      )}

      <Party run={run} byId={byId} onTeam={(team) => updateRun((r) => setTeam(r, team))} />
      <Bag run={run} bag={lab.meta.bag ?? []} byId={byId} onDrink={drink} />

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <button className="card-btn" style={{ width: "auto", display: "inline-flex", color: "#ff8a80" }}
          onClick={() => updateRun((r) => ({ ...r, status: "retreated", battle: undefined }))}
          disabled={battle.match !== null && !battle.match.state.winner}>
          🏃 Retreat — leave the dungeon and keep your loot
        </button>
      </div>
    </>
  );
}

// ── The entrance: choose your party ─────────────────────────────────
function Entrance({ lab, owned, gold, onBegin, onHeal }: {
  lab: DungeonSave; owned: OwnedCreature[]; gold: number; onBegin: (party: string[]) => void; onHeal: () => void;
}) {
  const [party, setParty] = useState<string[]>(() =>
    owned.filter((c) => c.roster && (lab.meta.injuries[c.id] ?? 1) > 0).slice(0, PARTY_SIZE).map((c) => c.id));
  const free = lab.meta.runs === 0;
  const injured = owned.filter((c) => lab.meta.injuries[c.id] !== undefined);
  const canPay = free || gold >= ENTRY_FEE;

  function toggle(id: string) {
    setParty((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < PARTY_SIZE ? [...p, id] : p));
  }

  return (
    <>
      <div className="stone-panel">
        <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0" }}>Beyond the archway</div>
        <p style={{ fontSize: 13, color: "#d8d4c8", lineHeight: 1.5, margin: "6px 0 0" }}>
          A labyrinth of rooms and winding tunnels, with the boss&apos;s lair somewhere at the top. You get one look at your map at the entrance — once you step inside it&apos;s too dark to read, so you find your way tunnel by tunnel. Some rooms are a mystery until you walk in, and there&apos;s no going back the way you came.
          Take up to {PARTY_SIZE} creatures: {TEAM_SIZE} fight, the rest wait in reserve (swap them between rooms).
          Wounds carry from room to room. If your team falls you wake up back here — <b>you keep everything you found</b>.
        </p>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
          Runs: {lab.meta.runs} · Boss defeated: {lab.meta.clears}×
          {lab.meta.firstClearRun ? ` (first on run ${lab.meta.firstClearRun})` : ""}
        </div>
      </div>

      {injured.length > 0 && (
        <div className="stone-panel" style={{ marginTop: 12 }}>
          <div className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>⛲ Healing pool</div>
          <div style={{ fontSize: 13, color: MUTED, margin: "4px 0 8px" }}>
            Hurt from your last run: {injured.map((c) => `${c.name} ${Math.round(lab.meta.injuries[c.id] * 100)}%`).join(", ")}.
            Knocked-out creatures can&apos;t join a party until healed.
          </div>
          <button className="pixel-btn" onClick={onHeal}>Rest in the pool — heal everyone (free for now)</button>
        </div>
      )}

      <SectionTitle>Your party — pick up to {PARTY_SIZE} ({party.length}/{PARTY_SIZE})</SectionTitle>
      <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>
        The first {TEAM_SIZE} you pick fight; the rest are reserves. ★ = roster.
      </p>
      {owned.length < PARTY_SIZE && (
        <p style={{ color: MUTED, lineHeight: 1.5, fontSize: 13 }}>
          You have {owned.length} creature{owned.length === 1 ? "" : "s"}. You can go in with fewer than {PARTY_SIZE}, but it&apos;s much harder —{" "}
          <Link href="/altar" style={{ color: "white", textDecoration: "underline" }}>scan</Link> or summon more to grow your party.
        </p>
      )}
      {owned.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {owned.map((c) => {
            const slot = party.indexOf(c.id);
            const hp = lab.meta.injuries[c.id] ?? 1;
            return (
              <button key={c.id} onClick={() => toggle(c.id)} disabled={hp <= 0} className="card-btn"
                style={{ borderColor: slot >= 0 ? YOU : undefined, background: slot >= 0 ? "rgba(78,161,255,0.12)" : undefined, opacity: hp <= 0 ? 0.4 : 1 }}>
                <span className="pixel-font" style={{ width: 24, height: 24, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: slot >= 0 ? YOU : "rgba(255,255,255,0.08)", color: slot >= 0 ? "black" : MUTED }}>
                  {slot >= 0 ? slot + 1 : ""}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 600, color: rarityColor(c.rarity) }}>{c.roster ? "★ " : ""}{c.name}</span>
                  <span style={{ fontSize: 12, color: MUTED }}> · {c.label}{slot >= 0 ? (slot < TEAM_SIZE ? " · fights" : " · reserve") : ""}</span>
                  {hp < 1 && <span style={{ fontSize: 12, color: "#ff8a80" }}> · {hp <= 0 ? "knocked out" : `${Math.round(hp * 100)}% HP`}</span>}
                  <StatsLine stats={combatSummary(c.fighter)} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button onClick={() => onBegin(party)} disabled={party.length === 0 || !canPay} className="pixel-btn" style={{ marginTop: 22, width: "100%", fontSize: 20, padding: "12px 0" }}>
        🌀 Enter the dungeon {free ? "(first time free)" : `(${ENTRY_FEE} gold)`}
      </button>
      {!canPay && <p style={{ fontSize: 12, color: "#ff8a80", textAlign: "center" }}>Entering costs {ENTRY_FEE} gold — you have {gold}.</p>}
    </>
  );
}

// ── In the dungeon ────────────────────────────────────────────────
function RoomHeader({ run }: { run: DungeonRun }) {
  const where = run.map.nodes[runPosition(run)];
  return (
    <div className="pixel-font" style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 14, fontSize: 13, color: "#c9b48a" }}>
      <span>🗺️ Rooms explored: {run.room}</span>
      {where.kind === "boss" && <span>👁️ The lair</span>}
    </div>
  );
}

// At the entrance: one good look at the map before you go in.
function MapFirst({ run, onStep }: { run: DungeonRun; onStep: () => void }) {
  return (
    <div className="stone-panel">
      <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0" }}>Your map of the dungeon</div>
      <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 12px", lineHeight: 1.5 }}>
        Study it while you can. Once you step inside it&apos;s too dark to read — you&apos;ll only see the room you&apos;re in and the tunnels leading out of it,
        so remember which way the lair lies. The rooms you know are marked; the rest are a &ldquo;?&rdquo;. Every tunnel leads onward, never back.
      </p>
      <DungeonMapView run={run} />
      <button className="pixel-btn" onClick={onStep} style={{ marginTop: 14, width: "100%", fontSize: 18, padding: "10px 0" }}>
        🔥 Put the map away and step inside
      </button>
    </div>
  );
}

function AtEntrance({ run }: { run: DungeonRun }) {
  const ways = run.map.nodes[runPosition(run)].links.length;
  return (
    <div className="stone-panel">
      <p style={{ fontSize: 13, color: "#d8d4c8", margin: 0, lineHeight: 1.5 }}>
        Water drips somewhere in the dark. {ways > 1 ? "Tunnels lead off" : "A tunnel leads off"} into the gloom — the left-most heads furthest west.
        Tap one to go on. You can change your team below first.
      </p>
    </div>
  );
}

function RoomScreen({ run, room, found, byId, gold, bag, onTreasure, onChest, onDeck, onStash, onBuyPotion, onHeal, onBless, onBuy, onFight, onNext }: {
  run: DungeonRun; room: Room; found: Drop[] | null; byId: (id: string) => OwnedCreature | undefined; gold: number;
  onTreasure: (r: Room) => void; onChest: () => void; onDeck: () => void; onStash: () => void; onBuyPotion: (k: PotionKey) => void; bag: PotionKey[]; onHeal: (id: string) => void; onBless: (id: string) => void; onBuy: (move: string) => void; onFight: () => void; onNext: () => void;
}) {
  const info = ROOM_INFO[room.kind];
  const onward = <p className="pixel-font" style={{ fontSize: 13, color: "#c9b48a", margin: "12px 0 0" }}>↑ Take a tunnel to move on.</p>;
  const next = room.kind === "boss" ? <button className="pixel-btn" style={{ marginTop: 12 }} onClick={onNext}>Finish →</button> : onward;

  return (
    <div className="stone-panel">
      <div className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>{info.icon} {info.name}</div>

      {found && (
        <div style={{ margin: "10px 0 0", fontSize: 14 }}>
          <div style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>You found:</div>
          {found.map((d) => (
            <div key={d.id} style={{ color: d.dropType === "reward" ? GOLD : d.dropType === "item" ? RARITY_COLORS[d.rarity].text : "white" }}>
              {d.dropType === "reward" ? "🪙" : d.dropType === "card" ? "🃏" : d.dropType === "creature" ? "🐾" : "📦"} {dropLabel(d)}
            </div>
          ))}
        </div>
      )}

      {room.kind === "treasure" && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>A battered chest sits in the middle of the room, coins spilling from the lid.</p>
          <button className="pixel-btn" onClick={() => onTreasure(room)}>Take the gold</button>
        </>
      ))}

      {room.kind === "chest" && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>An old chest, humming faintly — like the barcodes do. {CHEST_DROPS} things rattle inside.</p>
          <button className="pixel-btn" onClick={onChest}>Open it</button>
        </>
      ))}

      {room.kind === "cards" && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>A deck of cards lies face down on a stone table, each one faintly warm. {DECK_CARDS} creature cards — whatever they turn out to be.</p>
          <button className="pixel-btn" onClick={onDeck}>Turn them over</button>
        </>
      ))}

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

      {room.kind === "stash" && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            A forgotten pack, half rotted through. Inside: {(room.stash ?? []).map((k) => `${POTIONS[k].icon} ${POTIONS[k].name}`).join(", ")}.
          </p>
          <p style={{ fontSize: 12, color: MUTED }}>Your battle bag: {bag.length}/{BAG_SIZE}{bag.length + (room.stash?.length ?? 0) > BAG_SIZE ? " — not everything will fit" : ""}.</p>
          <button className="pixel-btn" onClick={onStash} disabled={bag.length >= BAG_SIZE}>Pack them in your bag</button>
          {onward}
        </>
      ))}

      {room.kind === "merchant" && (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            A cart with two dusty bottles, and a merchant who smiles too much. &ldquo;One of each, friend — that&apos;s all I&apos;ve got. One per slot in your bag, mind; they don&apos;t stack.&rdquo;
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(Object.keys(POTIONS) as PotionKey[]).map((k) => {
              const p = POTIONS[k];
              const sold = room.bought?.includes(k);
              const can = !sold && gold >= p.price && bag.length < BAG_SIZE;
              return (
                <button key={k} className="card-btn" disabled={!can} onClick={() => onBuyPotion(k)} style={{ opacity: can ? 1 : 0.5 }}>
                  <span style={{ flex: 1 }}>
                    <b>{p.icon} {p.name}</b>
                    <span style={{ display: "block", fontSize: 12, color: MUTED }}>Restores {p.heal} HP to one creature. In a fight it uses your turn.</span>
                  </span>
                  <span className="pixel-font" style={{ color: GOLD, flexShrink: 0 }}>{sold ? "sold" : `🪙 ${p.price}`}</span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: MUTED }}>Your battle bag: {bag.length}/{BAG_SIZE} · {gold} gold.</p>
          {next}
        </>
      )}

      {room.kind === "librarian" && (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            A hooded figure sits among towers of crumbling books. &ldquo;Codexes,&rdquo; it whispers. &ldquo;Each teaches one creature a move of its blood — once. {CODEX_PRICE} gold apiece.&rdquo;
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(room.offers ?? []).map((name) => {
              const move = MOVE_BY_NAME[name];
              const sold = room.bought?.includes(name);
              return (
                <button key={name} className="card-btn" disabled={sold || gold < CODEX_PRICE} onClick={() => onBuy(name)}
                  style={{ opacity: sold || gold < CODEX_PRICE ? 0.5 : 1 }}>
                  <span style={{ flex: 1 }}>
                    <b style={{ color: "#c7b8ff" }}>📖 Codex: {name}</b>
                    <span style={{ fontSize: 12, color: move?.race ? RACE_INFO[move.race].color : MUTED }}> · {move?.race ? RACE_INFO[move.race].name : ""} only</span>
                    <span style={{ display: "block", fontSize: 12, color: MUTED }}>{move?.desc}</span>
                  </span>
                  <span className="pixel-font" style={{ color: GOLD, flexShrink: 0 }}>{sold ? "bought" : `🪙 ${CODEX_PRICE}`}</span>
                </button>
              );
            })}
          </div>
          {gold < CODEX_PRICE && <p style={{ fontSize: 12, color: MUTED }}>You have {gold} gold.</p>}
          {next}
        </>
      )}

      {isFight(room.kind) && (room.done ? (room.kind === "miniboss" && !room.blessed ? (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            As it falls, something warm washes over your party. Choose one creature: heal it to full, or bring a knocked-out one back with {Math.round(MINIBOSS_REVIVE_HP * 100)}% HP.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {run.party.map((id) => {
              const c = byId(id);
              const hp = run.hp[id] ?? 1;
              return c && (
                <button key={id} className="card-btn" disabled={hp >= 1} onClick={() => onBless(id)} style={{ opacity: hp >= 1 ? 0.45 : 1 }}>
                  <b style={{ color: rarityColor(c.rarity) }}>{c.name}</b>
                  <span style={{ fontSize: 12, color: MUTED }}>
                    {hp <= 0 ? `knocked out → revive to ${Math.round(MINIBOSS_REVIVE_HP * 100)}%` : hp < 1 ? `${Math.round(hp * 100)}% HP → heal to full` : "already full"}
                  </span>
                </button>
              );
            })}
          </div>
          {onward}
        </>
      ) : next) : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8", margin: "6px 0 10px" }}>
            {room.kind === "easy" && "A few creatures look up from their scraps. They don't look tough."}
            {room.kind === "hard" && "One creature, alone. Well fed. Well armed."}
            {room.kind === "miniboss" && "Something big has made this room its lair. One creature — but an Epic one, well armed, and it fights smart. Beat it and you can heal or revive one of your party."}
            {room.boss && "A Cyclops fills the chamber — a mountain of muscle with one huge, rolling eye. It's a melee brute: tough to hurt up close, and its Stomp can cripple you badly (swapping out shakes it off… eventually). Something tells you this won't be the whole fight."}
            {!room.boss && <> They play like the {AI_LEVEL_LABELS[room.level ?? "normal"]} AI.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {room.boss && (
              <div style={{ fontSize: 13, padding: "6px 8px", background: "#12131a" }}>
                <b style={{ color: rarityColor("legendary") }}>Cyclops</b>
                <span style={{ color: MUTED }}> · {CYCLOPS_PARTS[0].label} · {combatLine(cyclopsTeam()[0])}</span>
              </div>
            )}
            {(room.enemies ?? []).map((e, i) => {
              const t = CREATURE_BY_ID[e.creatureId];
              return (
                <div key={i} style={{ fontSize: 13, padding: "6px 8px", background: "#12131a" }}>
                  <b style={{ color: rarityColor(t.rarity) }}>{t.name}</b>
                  <span style={{ color: MUTED }}> · {t.race ? `${RACE_INFO[t.race].name} · ` : ""}{creatureTypeLabel(e.proficiency)} · {e.gear.map(gearName).join(", ")}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: MUTED }}>
            Win: {room.gold} gold{(room.enemies ?? []).some((e) => e.gear.some((p) => p.drops)) ? " and something shiny one of them is carrying" : ""}.
            Your team: {fightingTeam(run).map((id) => byId(id)?.name).join(", ")}.
          </p>
          <button className="pixel-btn" onClick={onFight}>⚔️ Fight</button>
        </>
      ))}
    </div>
  );
}

// Your party: who fights (in order — the first one leads) and who waits.
function Party({ run, byId, onTeam }: { run: DungeonRun; byId: (id: string) => OwnedCreature | undefined; onTeam: (team: string[]) => void }) {
  const team = fightingTeam(run);
  const reserves = run.party.filter((id) => !team.includes(id));
  const move = (i: number, by: number) => {
    const next = [...team];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onTeam(next);
  };
  const card = (id: string, extra: React.ReactNode, fights: boolean) => {
    const c = byId(id);
    if (!c) return null;
    const hp = run.hp[id] ?? 1;
    return (
      <div key={id} className="card-btn" style={{ cursor: "default", borderColor: fights ? YOU : undefined, opacity: hp <= 0 ? 0.45 : 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: rarityColor(c.rarity) }}>{c.name}</span>
          {hp <= 0 && <span style={{ fontSize: 11, color: MUTED }}> · knocked out</span>}
          <Bar label="HP" value={`${Math.round(hp * c.fighter.maxHp)}/${c.fighter.maxHp}`} pct={hp * 100}
            color={hp > 0.5 ? "#22c55e" : hp > 0.25 ? "#f5c542" : "#ef4444"} />
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>{extra}</div>
      </div>
    );
  };
  const btn = (label: string, title: string, onClick: () => void, disabled = false) => (
    <button className="chip" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      style={{ padding: "4px 9px", opacity: disabled ? 0.3 : 1, cursor: disabled ? "default" : "pointer" }}>{label}</button>
  );
  return (
    <>
      <SectionTitle>Fighting — in order ({team.length}/{TEAM_SIZE})</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {team.map((id, i) => card(id, <>
          <span className="pixel-font" style={{ fontSize: 13, color: i === 0 ? "#ffd66e" : MUTED, alignSelf: "center", marginRight: 4 }}>{i === 0 ? "leads" : `#${i + 1}`}</span>
          {btn("▲", "Move up", () => move(i, -1), i === 0)}
          {btn("▼", "Move down", () => move(i, 1), i === team.length - 1)}
          {btn("✕", "Send to reserve", () => onTeam(team.filter((x) => x !== id)))}
        </>, true))}
        {team.length === 0 && <p style={{ fontSize: 13, color: "#ff8a80", margin: 0 }}>Nobody is set to fight — add someone from your reserves.</p>}
      </div>
      {reserves.length > 0 && (
        <>
          <SectionTitle>Reserves</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reserves.map((id) => card(id,
              btn("＋ Fight", team.length >= TEAM_SIZE ? "Your team is full — send someone to reserve first" : "Add to the fighting team",
                () => onTeam([...team, id]), team.length >= TEAM_SIZE || !isAlive(run, id)), false))}
          </div>
        </>
      )}
    </>
  );
}

function RunOver({ run, lab, onHome }: { run: DungeonRun; lab: DungeonSave; onHome: () => void }) {
  const title = run.status === "cleared" ? "The dungeon is beaten!" : run.status === "dead" ? "Everything goes dark…" : "You slip back out";
  const text = run.status === "cleared"
    ? `The Eye bursts in a shower of sparks. You beat the Cyclops on run ${run.runNumber}${lab.meta.firstClearRun ? "" : " — your first clear"}! (Its rewards — the Codex of Stances, the Tavern and your trophy — come in the next update.)`
    : run.status === "dead"
      ? `…and you wake up in the Den, Klutz standing over you looking pleased with himself. He dragged you out after ${run.room} room${run.room === 1 ? "" : "s"}. Your creatures are hurt — rest them at the healing pool.`
      : `You find your way back out, ${run.room} room${run.room === 1 ? "" : "s"} explored.`;
  return (
    <div className="stone-panel" style={{ textAlign: "center" }}>
      <div className="pixel-font" style={{ fontSize: 26, color: run.status === "cleared" ? "#5ee08a" : run.status === "dead" ? "#ff8a80" : "#f1d9a0" }}>{title}</div>
      <p style={{ fontSize: 14, color: "#d8d4c8", lineHeight: 1.5 }}>{text}</p>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>You keep everything you found:</div>
      <div style={{ fontSize: 14, marginBottom: 14 }}>{run.loot.length > 0 ? run.loot.join(" · ") : "nothing this time"}</div>
      <button className="pixel-btn" onClick={onHome}>Continue</button>
    </div>
  );
}

// The bag, one entry per kind of potion (for the battle screen).
function bagItems(bag: PotionKey[]): BagItem[] {
  return (Object.keys(POTIONS) as PotionKey[])
    .map((k) => ({ key: k, ...POTIONS[k], count: bag.filter((b) => b === k).length }))
    .filter((it) => it.count > 0);
}

// Between rooms: your battle bag, and who could use a potion.
function Bag({ run, bag, byId, onDrink }: {
  run: DungeonRun; bag: PotionKey[]; byId: (id: string) => OwnedCreature | undefined; onDrink: (k: PotionKey, id: string) => void;
}) {
  const hurt = run.party.filter((id) => byId(id) && (run.hp[id] ?? 1) > 0 && (run.hp[id] ?? 1) < 1);
  return (
    <>
      <SectionTitle>Battle bag ({bag.length}/{BAG_SIZE})</SectionTitle>
      {bag.length === 0 ? (
        <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Empty. Merchants sell potions, and stashes sometimes hold a few.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {bagItems(bag).map((it) => (
            <div key={it.key} className="card-btn" style={{ cursor: "default", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 140 }}><b>{it.icon} {it.name} ×{it.count}</b> <span style={{ fontSize: 12, color: MUTED }}>+{it.heal} HP</span></span>
              <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {hurt.map((id) => (
                  <button key={id} className="chip" style={{ padding: "4px 9px" }} onClick={() => onDrink(it.key as PotionKey, id)}>
                    Give {byId(id)!.name}
                  </button>
                ))}
                {hurt.length === 0 && <span style={{ fontSize: 11, color: MUTED }}>nobody is hurt</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
