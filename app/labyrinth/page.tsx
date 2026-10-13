"use client";
// app/labyrinth/page.tsx
// A run through labyrinth 1: pick a party of 5, walk through 8 rooms by
// choosing between hidden doors, fight, heal and loot, and face the boss.
// The rules live in lib/labyrinth/run.ts; the run is saved after every step,
// so leaving the page (or refreshing) never loses it.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import type { Drop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { rollBarcodeOutcome } from "@/lib/barcodeRegistry";
import { dropFromOutcome, weaponDrop, armorDrop } from "@/lib/drops";
import type { ItemKey } from "@/lib/items/ceilings";
import type { ArmorKey } from "@/lib/items/armor";
import { AI_LEVEL_LABELS } from "@/lib/combat/thinkingAi";
import {
  LAB_ROOMS, PARTY_SIZE, TEAM_SIZE, ENTRY_FEE, CHEST_DROPS, ROOM_INFO,
  startRun, enterDoor, leaveRoom, setTeam, fightingTeam, isAlive, isFight, enemyFighter, gearName, endRun,
  loadLab, saveLab, type LabSave, type LabRun, type Room,
} from "@/lib/labyrinth/run";
import DungeonFrame from "@/components/DungeonFrame";
import { YOU } from "@/components/BattleLog";
import {
  BattleView, Bar, SectionTitle, StatsLine, loadOwnedCreatures, rarityColor, usePlayableBattle, MUTED,
  type Match, type MemberInfo, type OwnedCreature,
} from "@/components/BattleScreen";
import { combatSummary } from "@/lib/combat/loadout";

const GOLD = "#f5c542";

function dropLabel(d: Drop): string {
  if (d.dropType === "reward") return `${d.amount} gold`;
  if (d.dropType === "card") return `${d.name} card`;
  return d.dropType === "item" ? `${d.name} (${d.rarity})` : d.name;
}

export default function LabyrinthPage() {
  const game = useGameState();
  const [lab, setLab] = useState<LabSave | null>(null);
  const [owned, setOwned] = useState<OwnedCreature[]>([]);
  const [found, setFound] = useState<Drop[] | null>(null); // what the current room just gave you

  // Every change to the run is saved straight away.
  function update(next: LabSave) {
    saveLab(next);
    setLab(next);
  }
  function updateRun(fn: (r: LabRun) => LabRun) {
    const cur = loadLab();
    if (cur.run) update({ ...cur, run: fn(cur.run) });
  }

  const battle = usePlayableBattle((m) => updateRun((r) => ({ ...r, battle: m })));

  useEffect(() => {
    const saved = loadLab();
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
    update(endRun(loadLab()));
    battle.clear();
    setFound(null);
  }

  function healAll() {
    if (lab) update({ ...lab, meta: { ...lab.meta, injuries: {} } });
  }

  // ── Room rewards ──────────────────────────────────────────────────
  function give(drops: Drop[], also: (r: LabRun) => LabRun = (r) => r) {
    for (const d of drops) {
      if (d.dropType === "reward") game.addGold(d.amount);
      else game.addDrop(d);
    }
    setFound(drops);
    updateRun((r) => also({ ...r, loot: [...r.loot, ...drops.map(dropLabel)] }));
  }

  const goldOnly = (amount: number): Drop => ({ id: crypto.randomUUID(), barcode: "", dropType: "reward", rewardKind: "resource", amount, createdAt: new Date().toISOString() });
  const markDone = (r: LabRun): LabRun => (r.current ? { ...r, current: { ...r.current, done: true } } : r);

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
    give(drops, markDone);
  }

  function healOne(id: string) {
    updateRun((r) => markDone({ ...r, hp: { ...r.hp, [id]: 1 } }));
  }

  function nextRoom() {
    setFound(null);
    battle.clear();
    updateRun(leaveRoom);
  }

  // ── Fights ────────────────────────────────────────────────────────
  function startFight(r: LabRun) {
    const room = r.current!;
    const ids = fightingTeam(r).filter((id) => byId(id));
    const mine = ids.map((id) => byId(id)!);
    const info: MemberInfo[] = room.enemies!.map((e) => ({
      rarity: CREATURE_BY_ID[e.creatureId].rarity,
      label: creatureTypeLabel(e.proficiency),
      weaponName: gearName(e.gear[0]),
      armorName: gearName(e.gear[1]),
    }));
    updateRun((x) => ({ ...x, current: { ...x.current!, fighters: ids } }));
    battle.start(
      { A: mine.map((c) => c.fighter), B: room.enemies!.map(enemyFighter) },
      { A: mine, B: info },
      room.level ?? "normal",
      { startHp: mine.map((c, i) => Math.round((r.hp[ids[i]] ?? 1) * c.fighter.maxHp)), title: `Labyrinth · room ${r.room}` },
    );
  }

  // The fight is over: HP comes back to the party, and the winner's rewards.
  function finishFight(r: LabRun, m: Match) {
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
    return <DungeonFrame title="The Labyrinth" icon="🌀"><p style={{ color: MUTED }}>Loading…</p></DungeonFrame>;
  }

  const frame = (children: React.ReactNode) => (
    <DungeonFrame title="The Labyrinth" icon="🌀" gold={game.gold}>{children}</DungeonFrame>
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
      {run.current
        ? <RoomScreen
            run={run} room={run.current} found={found} byId={byId}
            onTreasure={takeTreasure} onChest={openChest} onHeal={healOne} onFight={() => startFight(run)} onNext={nextRoom}
          />
        : <Doors run={run} onDoor={(d) => updateRun((r) => enterDoor(r, d))} />}

      <Party run={run} byId={byId} onTeam={run.current ? undefined : (team) => updateRun((r) => setTeam(r, team))} />

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <button className="card-btn" style={{ width: "auto", display: "inline-flex", color: "#ff8a80" }}
          onClick={() => updateRun((r) => ({ ...r, status: "retreated", battle: undefined }))}
          disabled={battle.match !== null && !battle.match.state.winner}>
          🏃 Retreat — leave the labyrinth and keep your loot
        </button>
      </div>
    </>
  );
}

// ── The entrance: choose your party ─────────────────────────────────
function Entrance({ lab, owned, gold, onBegin, onHeal }: {
  lab: LabSave; owned: OwnedCreature[]; gold: number; onBegin: (party: string[]) => void; onHeal: () => void;
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
          {LAB_ROOMS} rooms, a boss in the last. Each room has two doors, and you can&apos;t see what&apos;s behind them.
          Take {PARTY_SIZE} creatures: {TEAM_SIZE} fight, {PARTY_SIZE - TEAM_SIZE} wait in reserve (swap them between rooms).
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

      <SectionTitle>Your party — pick {PARTY_SIZE} ({party.length}/{PARTY_SIZE})</SectionTitle>
      <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>
        The first {TEAM_SIZE} you pick fight; the rest are reserves. ★ = roster.
      </p>
      {owned.length < PARTY_SIZE ? (
        <p style={{ color: MUTED, lineHeight: 1.5 }}>
          You need {PARTY_SIZE} creatures for the labyrinth — you have {owned.length}.{" "}
          <Link href="/altar" style={{ color: "white", textDecoration: "underline" }}>Scan</Link> or summon a few more first.
        </p>
      ) : (
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

      <button onClick={() => onBegin(party)} disabled={party.length !== PARTY_SIZE || !canPay} className="pixel-btn" style={{ marginTop: 22, width: "100%", fontSize: 20, padding: "12px 0" }}>
        🌀 Enter the labyrinth {free ? "(first time free)" : `(${ENTRY_FEE} gold)`}
      </button>
      {!canPay && <p style={{ fontSize: 12, color: "#ff8a80", textAlign: "center" }}>Entering costs {ENTRY_FEE} gold — you have {gold}.</p>}
    </>
  );
}

// ── In the labyrinth ────────────────────────────────────────────────
function RoomHeader({ run }: { run: LabRun }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 14 }} aria-label={`Room ${run.room} of ${LAB_ROOMS}`}>
      {Array.from({ length: LAB_ROOMS }, (_, i) => {
        const n = i + 1;
        const state = n < run.room || (n === run.room && run.current?.done) ? "done" : n === run.room ? "here" : "ahead";
        return (
          <div key={n} className="pixel-font" style={{
            flex: 1, textAlign: "center", fontSize: 12, padding: "4px 0",
            background: state === "done" ? "#2d4a2f" : state === "here" ? "#5a3b1c" : "#15161c",
            border: `2px solid ${state === "here" ? "#ffd66e" : "#000"}`,
            color: state === "ahead" ? "#666" : "#f1d9a0",
          }}>
            {n === LAB_ROOMS ? "👁️" : n}
          </div>
        );
      })}
    </div>
  );
}

function Doors({ run, onDoor }: { run: LabRun; onDoor: (d: 0 | 1) => void }) {
  const canFight = fightingTeam(run).length > 0;
  const boss = run.room === LAB_ROOMS;
  return (
    <div className="stone-panel">
      <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0" }}>
        {boss ? "The last door" : `Room ${run.room} — choose a door`}
      </div>
      <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 12px" }}>
        {boss ? "Something huge breathes behind it. Make sure the right creatures are on your team."
          : "You can't tell what's behind either one. Set your team below before you go in."}
      </p>
      {!canFight && <p style={{ fontSize: 13, color: "#ff8a80" }}>Pick at least one creature that can still fight.</p>}
      <div style={{ display: "grid", gridTemplateColumns: boss ? "1fr" : "1fr 1fr", gap: 10 }}>
        {(boss ? [0] : [0, 1]).map((d) => (
          <button key={d} className="card-btn" disabled={!canFight} onClick={() => onDoor(d as 0 | 1)}
            style={{ display: "block", textAlign: "center", padding: "22px 8px" }}>
            <div style={{ fontSize: 34 }}>{boss ? "👁️" : "🚪"}</div>
            <div className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>{boss ? "Enter the lair" : d === 0 ? "Left door" : "Right door"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RoomScreen({ run, room, found, byId, onTreasure, onChest, onHeal, onFight, onNext }: {
  run: LabRun; room: Room; found: Drop[] | null; byId: (id: string) => OwnedCreature | undefined;
  onTreasure: (r: Room) => void; onChest: () => void; onHeal: (id: string) => void; onFight: () => void; onNext: () => void;
}) {
  const info = ROOM_INFO[room.kind];
  const nextLabel = room.kind === "boss" ? "Finish" : run.room === LAB_ROOMS - 1 ? "On to the last door" : "On to the next room";
  const next = <button className="pixel-btn" style={{ marginTop: 12 }} onClick={onNext}>{nextLabel} →</button>;

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
          <button className="card-btn" style={{ marginTop: 6, width: "auto" }} onClick={onNext}>Leave it — nobody needs it</button>
        </>
      ))}

      {(room.kind === "stash" || room.kind === "librarian" || room.kind === "merchant") && (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            {room.kind === "stash" && "A forgotten pack, its potions long gone. (Stashes fill your battle bag once it exists.)"}
            {room.kind === "librarian" && "A hooded figure shelving books that aren't there. \"Come back when I've unpacked,\" it mutters. (Librarians — moves and codexes — are coming.)"}
            {room.kind === "merchant" && "A cart, a lantern, and a sign: BACK SOON. (Wandering merchants are coming.)"}
          </p>
          {next}
        </>
      )}

      {isFight(room.kind) && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8", margin: "6px 0 10px" }}>
            {room.kind === "easy" && "A few creatures look up from their scraps. They don't look tough."}
            {room.kind === "hard" && "One creature, alone. Well fed. Well armed."}
            {room.kind === "boss" && "The boss of the labyrinth. (A stand-in for now — the Cyclops is coming next.)"}
            {" "}They play like the {AI_LEVEL_LABELS[room.level ?? "normal"]} AI.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {room.enemies!.map((e, i) => {
              const t = CREATURE_BY_ID[e.creatureId];
              return (
                <div key={i} style={{ fontSize: 13, padding: "6px 8px", background: "#12131a" }}>
                  <b style={{ color: rarityColor(t.rarity) }}>{t.name}</b>
                  <span style={{ color: MUTED }}> · {creatureTypeLabel(e.proficiency)} · {e.gear.map(gearName).join(", ")}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: MUTED }}>
            Win: {room.gold} gold{room.enemies!.some((e) => e.gear.some((p) => p.drops)) ? " and something shiny one of them is carrying" : ""}.
            Your team: {fightingTeam(run).map((id) => byId(id)?.name).join(", ")}.
          </p>
          <button className="pixel-btn" onClick={onFight}>⚔️ Fight</button>
        </>
      ))}
    </div>
  );
}

// Your 5: HP, and (between rooms) who fights.
function Party({ run, byId, onTeam }: { run: LabRun; byId: (id: string) => OwnedCreature | undefined; onTeam?: (team: string[]) => void }) {
  function toggle(id: string) {
    if (!onTeam) return;
    onTeam(run.team.includes(id) ? run.team.filter((x) => x !== id) : [...run.team, id]);
  }
  return (
    <>
      <SectionTitle>Your party {onTeam ? `— tap to choose who fights (${fightingTeam(run).length}/${TEAM_SIZE})` : ""}</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>
        {run.party.map((id) => {
          const c = byId(id);
          if (!c) return null;
          const hp = run.hp[id] ?? 1;
          const fights = run.team.includes(id) && isAlive(run, id);
          const full = !run.team.includes(id) && fightingTeam(run).length >= TEAM_SIZE;
          return (
            <button key={id} className="card-btn" onClick={() => toggle(id)} disabled={!onTeam || hp <= 0 || full}
              style={{ display: "block", borderColor: fights ? YOU : undefined, opacity: hp <= 0 ? 0.45 : 1, cursor: onTeam ? "pointer" : "default" }}>
              <span style={{ fontWeight: 600, color: rarityColor(c.rarity) }}>{c.name}</span>
              <span style={{ fontSize: 11, color: fights ? YOU : MUTED }}> · {hp <= 0 ? "knocked out" : fights ? "fights" : "reserve"}</span>
              <Bar label="HP" value={`${Math.round(hp * c.fighter.maxHp)}/${c.fighter.maxHp}`} pct={hp * 100}
                color={hp > 0.5 ? "#22c55e" : hp > 0.25 ? "#f5c542" : "#ef4444"} />
            </button>
          );
        })}
      </div>
    </>
  );
}

function RunOver({ run, lab, onHome }: { run: LabRun; lab: LabSave; onHome: () => void }) {
  const title = run.status === "cleared" ? "The labyrinth is beaten!" : run.status === "dead" ? "Everything goes dark…" : "You slip back out";
  const text = run.status === "cleared"
    ? `You beat the boss on run ${run.runNumber}${lab.meta.firstClearRun ? "" : " — your first clear"}. (Boss rewards — the codex, the Tavern and the trophy — are coming with the Cyclops.)`
    : run.status === "dead"
      ? `…and you wake up in your dungeon, Klutz standing over you looking pleased with himself. He dragged you out of room ${run.room}. Your creatures are hurt — rest them at the healing pool.`
      : `You leave the way you came, from room ${run.room}.`;
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
