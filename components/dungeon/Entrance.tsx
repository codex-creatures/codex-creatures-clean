"use client";
// components/dungeon/Entrance.tsx
// The Labyrinth's entrance: pick the dungeon, the party and the bag, then go in. Moved out of app/dungeon/page.tsx as it was.

import { useMemo, useState } from "react";
import Link from "next/link";
import { RaceNames } from "@/components/RaceTag";
import { useGameState } from "@/hooks/useGameState";
import { TEAM_SLOTS, teamMembers } from "@/lib/teams";
import BagPacker from "@/components/BagPacker";
import CreaturePortrait from "@/components/CreaturePortrait";
import { PARTY_SIZE, squadsOf, entryFee, freeRunsLeft, bagSize, bagName, type DungeonSave, DUNGEONS, DEEP_ROUTE, type DungeonId, labyrinthOpen, LABYRINTH_SCANS, CAMP_ROUTE, CRAWLABLE, scrollOpen, bossLevel, CAMP_CHIEF_LEVEL } from "@/lib/dungeon/run";
import { SectionTitle, loadOwnedCreatures, rarityColor, MUTED, type OwnedCreature } from "@/components/BattleScreen";
import Help from "@/components/Help";
import { gearMarks } from "@/components/CreatureMarks";
import { BOX_NAMES, type CappedBox } from "@/lib/items/storage";

const DUNGEON_ICONS: Record<DungeonId, string> = { 0: "⛺", 1: "🌀", 2: "🕳️", 3: "🌑" };
// The picker's rows (the user, 2026-11-13): the dungeons in order, with the Minotaur to come.
const ROWS: (DungeonId | "minotaur")[] = [0, 1, 2, "minotaur", 3];
const BOSS: Record<DungeonId, string> = { 0: "the camp's chief", 1: "the Cyclops", 2: "the Hydra", 3: "the Warden and his guards" };
const roomsTo = (d: DungeonId) => (d === 0 ? CAMP_ROUTE : d === 1 ? DUNGEONS[1].spec.minRoute : DEEP_ROUTE);

// Each dungeon's showcase (the UI overhaul, the user, 2026-11-17): its boss's art (the camp's chief and
// the Warden are different every time, so a shadow), where a medallion crops it, and the backdrop's light.
// glow: the boss's light; sky: the cave above; motes: what drifts in the air.
const SHOW: Record<DungeonId, { art: string; crop: string; shadow?: boolean; glow: string; sky: string; ground: string; motes: string; sub: string }> = {
  0: { art: "/sprites/creatures/dire_wolf.png", crop: "40% 20%", shadow: true, glow: "rgba(255,150,60,0.45)", sky: "#24170c", ground: "#120b06", motes: "#ffb45e", sub: "The goblin camp" },
  1: { art: "/sprites/creatures/cyclops.png", crop: "50% 10%", glow: "rgba(150,180,235,0.35)", sky: "#141a24", ground: "#0b0e14", motes: "#d8e2f0", sub: "The Labyrinth" },
  2: { art: "/sprites/creatures/hydra/hydra-000.png", crop: "50% 15%", glow: "rgba(120,230,150,0.42)", sky: "#14261d", ground: "#0a1410", motes: "#c9ffd8", sub: "The Deep Labyrinth" },
  3: { art: "/sprites/creatures/aurelius.png", crop: "50% 15%", shadow: true, glow: "rgba(170,70,255,0.42)", sky: "#150d1e", ground: "#0b0710", motes: "#e0b8ff", sub: "The Abyss" },
};
// Where the motes drift, as shares of the showcase (fixed, so it looks the same every time).
const MOTES: [number, number, number][] = [[12, 30, 3], [22, 62, 2], [31, 18, 2], [68, 24, 3], [79, 52, 2], [88, 34, 3], [44, 12, 2], [58, 66, 2], [7, 56, 2]];

// The dungeon picked: its boss standing in its light, on a cave backdrop, with its name, how far
// to the top, the foes' levels and the team size; its price (or why it's shut) and the (i) on it.
function Showcase({ d, n, status, info }: { d: DungeonId; n: number; status: string; info: React.ReactNode }) {
  const s = SHOW[d], name = DUNGEONS[d].name.replace(/^The /, "the ");
  const level = d === 0 ? CAMP_CHIEF_LEVEL : bossLevel(d);
  const shut = status === "locked" || status === "Speed Scroll only" || status === "Crawl it first";
  return (
    <div className="showcase" style={{ background: `radial-gradient(ellipse 60% 55% at 50% 50%, ${s.glow}, transparent 75%), radial-gradient(ellipse at 50% 0%, ${s.sky}, #07090a 70%)` }}>
      <div className="showcase-rays" />
      <div className="showcase-rocks" style={{ background: s.ground }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.art} alt={BOSS[d]} draggable={false} className="showcase-boss"
        style={{ filter: s.shadow ? `brightness(0) drop-shadow(0 0 2px ${s.motes}) drop-shadow(0 0 14px ${s.glow})` : `drop-shadow(0 0 1px ${s.motes}) drop-shadow(0 0 14px ${s.glow})` }} />
      <div className="showcase-fog" />
      {MOTES.map(([x, y, z], i) => <span key={i} className="showcase-mote" style={{ left: `${x}%`, top: `${y}%`, width: z, height: z, background: s.motes, boxShadow: `0 0 6px 2px ${s.motes}88` }} />)}
      <div className="showcase-shade" />
      <div style={{ position: "absolute", left: 10, top: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span className="pixel-font showcase-boss-tag">BOSS · LV {level}</span>
        <span className="pixel-font" style={{ fontSize: 10, color: "#a9a49a" }}>DUNGEON {n} OF {ROWS.length}</span>
      </div>
      <div style={{ position: "absolute", right: 8, top: 6 }}>{info}</div>
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span className="pixel-font" style={{ fontSize: 24, fontWeight: 700, color: "#ffe7a8", textShadow: "0 3px 0 #2a1a08, 0 0 14px rgba(255,170,80,0.35)", textTransform: "capitalize", whiteSpace: "nowrap" }}>{name}</span>
          <span className="pixel-font" style={{ fontSize: 13, color: shut ? "#a9a49a" : status === "FREE" ? "#7CFC9A" : "#f5c542", whiteSpace: "nowrap" }}>{status}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5 }}>
          {[`${roomsTo(d)} rooms`, `Foes Lv ${DUNGEONS[d].levels[0][1]}–${DUNGEONS[d].maxLevel}`, `Team of ${squadsOf(d).team}`].map((t) => (
            <span key={t} className="pixel-font showcase-stat">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── The entrance: choose your party ─────────────────────────────────
// quest: Klutz's box is still to fetch (the quest's short run, walked: lib/dungeon/tutorialRun.ts). scans: barcodes scanned.
// Two tabs: the party (picked freely, or one of your teams: lib/teams.ts) and the bag to pack.
export default function Entrance({ lab, owned, game, full, quest, scans, onBegin, onHeal, onSave }: {
  lab: DungeonSave; owned: OwnedCreature[]; game: ReturnType<typeof useGameState>; full: CappedBox[]; quest: boolean; scans: number;
  onBegin: (party: string[], dungeon: DungeonId, walk?: boolean) => void; onHeal: () => void; onSave: (next: DungeonSave) => void;
}) {
  const gold = game.gold;
  const healthy = (id: string) => (lab.meta.injuries[id] ?? 1) > 0;
  // The creature training in the pit (lib/trainingPit.ts) can't go in: shown greyed, last.
  const away = useMemo(() => loadOwnedCreatures(undefined, true, true).filter((c) => c.away), [game.inventory, game.tavern]); // eslint-disable-line react-hooks/exhaustive-deps
  const awayIds = new Set(away.map((c) => c.id));
  const ownedIds = new Set([...owned, ...away].map((c) => c.id));
  // Free pick starts empty every time: you choose who goes in.
  const [free, setFree] = useState<string[]>([]);
  const [tab, setTab] = useState<"party" | "bag">("party");
  // Tapped Enter with nobody picked: say so (until someone is).
  const [askPick, setAskPick] = useState(false);
  // null: free pick (the default); else the team in use (remembered for next time).
  const pick = lab.meta.teamPick !== undefined && lab.meta.teamPick < TEAM_SLOTS ? lab.meta.teamPick : null;
  const choose = (p: number | null) => {
    const meta = { ...lab.meta };
    if (p === null) delete meta.teamPick; else meta.teamPick = p;
    onSave({ ...lab, meta });
  };
  const team = pick === null ? null : teamMembers(game.teams, pick, ownedIds);
  // The Hydra opens once you've beaten the Cyclops.
  const deepOpen = lab.meta.clears > 0;
  // The Labyrinth opens once you've beaten the Encampment (or scanned plenty: labyrinthOpen);
  // until then it's shown, locked. The Abyss opens once you've beaten the Hydra.
  const labOpen = labyrinthOpen(lab.meta, scans);
  const [picked, setDungeon] = useState<DungeonId>(labOpen && (lab.meta.campClears ?? 0) > 0 ? 1 : 0);
  // Dungeon Crawling (the default) or Speed Scroll. (The quest's run is always walked: lib/dungeon/tutorialRun.ts.)
  const [mode, setMode] = useState<"crawl" | "scroll">("crawl");
  const unlocked = (d: DungeonId) => d === 0 || (d === 1 ? labOpen : d === 2 ? deepOpen : (lab.meta.deepClears ?? 0) > 0);
  const dungeon: DungeonId = quest ? 1 : unlocked(picked) ? picked : 0;
  const walking = quest || mode === "crawl";
  const notBuilt = walking && !CRAWLABLE.includes(dungeon); // Dungeon Crawling isn't there yet
  // Speed Scroll opens once you've beaten the dungeon crawling (run.ts scrollOpen).
  const crawlFirst = (d: DungeonId) => mode === "scroll" && !scrollOpen(d, lab.meta);
  const scrollShut = !quest && crawlFirst(dungeon);
  const beaten = (d: DungeonId) => (d === 0 ? lab.meta.campClears : d === 1 ? lab.meta.clears : d === 2 ? lab.meta.deepClears : lab.meta.abyssClears) ?? 0;
  const lockedWhy = (d: DungeonId) => (d === 1 ? `Beat the Encampment first (or scan ${LABYRINTH_SCANS} barcodes)` : d === 2 ? "Beat the Cyclops first" : "Beat the Hydra first");
  const priceOf = (d: DungeonId) => { const f = entryFee(d, lab.meta, false); return d === 0 && freeRunsLeft(lab.meta) > 0 ? "FREE" : f === 0 ? "FREE" : `${f} gold`; };
  // Who goes in: the dungeon's team size (3; 5 in the Abyss), picked here. A
  // bigger team sends its first ones (the rest are shown waiting).
  const cap = squadsOf(dungeon).team;
  const listed = team ?? free; // who's numbered on the grid (a team's knocked-out creatures too)
  const party = listed.filter((id) => healthy(id) && !awayIds.has(id)).slice(0, cap);
  const fee = entryFee(dungeon, lab.meta, quest);
  const freeLeft = dungeon === 0 ? freeRunsLeft(lab.meta) : 0;
  const injured = owned.filter((c) => lab.meta.injuries[c.id] !== undefined);
  const canPay = gold >= fee;
  const bag = lab.meta.bag ?? [];

  // Tapping a creature: in or out of the party (free pick), or of the team (saved straight away).
  function toggle(id: string) {
    if (pick !== null) { game.toggleTeam(pick, id); return; }
    setFree((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < cap ? [...p, id] : p));
  }
  function enter() {
    if (party.length === 0) { setAskPick(true); setTab("party"); return; }
    onBegin(party, dungeon, walking);
  }

  return (
    // The whole screen, its parts stacked; your creatures' panel takes whatever height is left (never under
    // about two rows: on a short phone the screen scrolls instead), so it isn't squeezed or left floating.
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "10px 12px", overflowY: "auto", overscrollBehavior: "contain" }}>
      {!quest && (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {/* Dungeon Crawling (the default) or Speed Scroll. */}
          <div role="tablist" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {([["crawl", "🔥 Dungeon Crawling"], ["scroll", "📜 Speed Scroll"]] as const).map(([m, label]) => (
              <button key={m} role="tab" aria-selected={mode === m} className="chip" data-active={mode === m} onClick={() => setMode(m)}
                style={{ minHeight: 44, textTransform: "none", fontSize: 14 }}>{label}</button>
            ))}
          </div>
          {/* The dungeon picked, as a showcase: its boss on its own lit backdrop (the UI overhaul, 2026-11-17). */}
          <Showcase d={dungeon} n={ROWS.indexOf(dungeon) + 1}
            status={!unlocked(dungeon) ? "locked" : mode === "crawl" && !CRAWLABLE.includes(dungeon) ? "Speed Scroll only" : crawlFirst(dungeon) ? "Crawl it first" : priceOf(dungeon)}
            info={(() => { const name = DUNGEONS[dungeon].name.replace(/^The /, ""), d = dungeon; return (
              <Help title={name} label={`About ${name}`} icon="i">
                <ul>
                  <li><b>{roomsTo(d)} rooms</b> to {BOSS[d]} at the top.</li>
                  <li>Foes <b>Lv {DUNGEONS[d].levels[0][1]}–{DUNGEONS[d].maxLevel}</b>.</li>
                  <li>Take <b>{squadsOf(d).team} creatures</b> in.</li>
                  <li>Entry: <b>{priceOf(d)}</b>{d === 0 && freeRunsLeft(lab.meta) > 0 ? ` (${freeRunsLeft(lab.meta)} free run${freeRunsLeft(lab.meta) === 1 ? "" : "s"} left)` : ""}.</li>
                  {d > 0 && <li>Foes carry codex moves of their race (up to {d === 1 ? "Uncommon" : d === 2 ? "Rare" : "Epic"}).</li>}
                  <li>Beaten <b>{beaten(d)}×</b>.</li>
                  <li>{CRAWLABLE.includes(d) ? `Dungeon Crawling: walk it yourself by torchlight. Speed Scroll: pick your way room by room on the map${scrollOpen(d, lab.meta) ? "" : ", once you've beaten it crawling"}.` : "Speed Scroll only for now: pick your way room by room on the map."}</li>
                </ul>
              </Help>
            ); })()} />
          {/* Every dungeon as a medallion: tap one to show it above (a locked one says why). */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${ROWS.length}, minmax(0, 1fr))`, gap: 4 }}>
            {ROWS.map((row) => {
              const locked = row === "minotaur" || !unlocked(row), on = row === dungeon;
              const name = row === "minotaur" ? "Minotaur" : DUNGEONS[row].name.replace(/^The /, "");
              return (
                <button key={row} onClick={() => row !== "minotaur" && setDungeon(row)} disabled={locked} aria-pressed={on} aria-label={name}
                  title={row === "minotaur" ? "The Minotaur: to come" : locked ? lockedWhy(row) : name}
                  style={{ background: "none", border: "none", padding: 0, cursor: locked ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0 }}>
                  <span className="medallion" data-on={on} data-locked={locked}><span className="medallion-in">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {row !== "minotaur" && !locked && <img src={SHOW[row].art} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: SHOW[row].crop, imageRendering: "pixelated", filter: SHOW[row].shadow ? "brightness(0.25) sepia(1) hue-rotate(-20deg)" : undefined }} />}
                    {locked && <span style={{ fontSize: 18, opacity: 0.6 }}>{row === "minotaur" ? "🐂" : "🔒"}</span>}
                  </span></span>
                  <span className="pixel-font" style={{ fontSize: 10, color: on ? "#ffe7a8" : locked ? "#6f6b62" : "#a9a49a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{row === 0 ? "Camp" : name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {injured.length > 0 && (
        <div className="stone-panel" style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: MUTED }}>⛲ {injured.length} hurt — healing in the Den&apos;s pool.</span>
          <button className="chip" onClick={onHeal} title="A shortcut for playtesting">Testing: heal now</button>
        </div>
      )}

      {/* Party or bag: two tabs, the same size whichever is open. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <button className="chip" data-active={tab === "party"} onClick={() => setTab("party")} style={{ minHeight: 44, textTransform: "none" }}>🐾 Party {party.length}/{cap}</button>
        <button className="chip" data-active={tab === "bag"} onClick={() => setTab("bag")} style={{ minHeight: 44, textTransform: "none" }}>🎒 {bagName(lab.meta)} {bag.length}/{bagSize(lab.meta)}</button>
      </div>

      {tab === "bag" ? <BagPacker game={game} lab={lab} onSave={onSave} /> : <>
        {/* Free pick, or one of the teams. */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${TEAM_SLOTS + 1}, 1fr)`, gap: 6, marginTop: 8 }}>
          {[null, ...Array.from({ length: TEAM_SLOTS }, (_, i) => i)].map((p) => (
            <button key={p ?? "free"} className="chip" data-active={pick === p} onClick={() => choose(p)}
              style={{ minHeight: 44, padding: "2px 4px", textTransform: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {p === null ? "Free pick" : `Team ${p + 1}`}
              <span style={{ display: "block", fontSize: 11, opacity: 0.7, visibility: p === null ? "hidden" : "visible" }}>
                {p === null ? "-" : `${teamMembers(game.teams, p, ownedIds).length}/${PARTY_SIZE}`}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <SectionTitle>{pick === null ? "Your party" : `Team ${pick + 1}`} ({pick === null ? `${listed.length}/${cap}` : `${listed.length}/${PARTY_SIZE}`})</SectionTitle>
          <span style={{ fontSize: 12, color: askPick && party.length === 0 ? "#ff8a80" : MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {askPick && party.length === 0 ? "Pick who goes in" : pick === null ? `Tap up to ${cap}` : "Tap to add or take out"}
          </span>
        </div>
        {owned.length < PARTY_SIZE && (
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 8px" }}>
            More creatures make it easier — <Link href="/scan" style={{ color: "white", textDecoration: "underline" }}>scan</Link> or <Link href="/altar" style={{ color: "white", textDecoration: "underline" }}>summon</Link> more.
          </p>
        )}
        {owned.length > 0 && (
          <div className="inv-panel" style={{ flex: "1 1 0", minHeight: 180, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", alignContent: "start", gap: 10, overflowY: "auto", overscrollBehavior: "contain" }}>
            {[...owned, ...away].map((c) => {
              const slot = listed.indexOf(c.id);
              const hp = lab.meta.injuries[c.id] ?? 1;
              const picked = slot >= 0;
              const out = hp <= 0 || !!c.away;
              const waits = picked && !out && !party.includes(c.id); // in the team, past the first {cap}
              // A knocked-out creature can still leave a team, but can't join anything.
              const locked = out && !(pick !== null && picked);
              const what = pick === null ? "party" : "team";
              return (
                <button key={c.id} onClick={() => toggle(c.id)} disabled={locked} aria-pressed={picked}
                  title={c.away ? `${c.name} is training in the pit` : out ? `${c.name} is knocked out` : picked ? `Take ${c.name} out of the ${what}` : `Add ${c.name} to the ${what}`}
                  style={{
                    position: "relative", minWidth: 0, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    background: picked ? "rgba(241,217,160,0.1)" : "none", border: "none", borderRadius: 8,
                    boxShadow: picked ? `inset 0 0 0 2px ${out || waits ? "#6b6350" : "#f1d9a0"}` : undefined,
                    color: "white", cursor: locked ? "default" : "pointer", opacity: out ? 0.35 : 1,
                  }}>
                  <span className="pixel-font" style={{ maxWidth: "100%", fontSize: 12, color: rarityColor(c.rarity), textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", lineHeight: 1.15 }}>
                    <span style={{ color: "#f1d9a0" }}>Lv {c.fighter.level ?? 1}</span> {c.name}
                  </span>
                  <CreaturePortrait creatureId={c.creatureId} title={c.name} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
                  <span className="pixel-font" style={{ fontSize: 11 }}>{c.away ? "🏋️ In the pit" : <RaceNames races={c.template.races} />}</span>
                  {gearMarks(game.equipment[c.id]) && <span title="Wearing gear" style={{ position: "absolute", top: 20, right: 4, fontSize: 11 }}>{gearMarks(game.equipment[c.id])}</span>}
                  {hp < 1 && (
                    <span style={{ width: "80%", height: 4, background: "#1a0e0e", border: "1px solid #000" }}>
                      <span style={{ display: "block", height: "100%", width: `${Math.max(0, hp) * 100}%`, background: hp > 0.5 ? "#5ee08a" : hp > 0.25 ? "#f5c542" : "#ff6b5e" }} />
                    </span>
                  )}
                  {picked && (
                    <span className="pixel-font" style={{ position: "absolute", top: 20, left: 4, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, borderRadius: 10, background: out || waits ? "#6b6350" : "#f1d9a0", color: "#1a140c" }}>
                      {slot + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </>}

    </div>
    {/* Enter, in a dock along the bottom: always in reach, whatever the panel above is doing. */}
    <footer className="screen-dock" style={{ display: "grid", gap: 4 }}>
        {/* Enter, with what's inside behind the "?". */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={enter} disabled={!canPay || full.length > 0 || notBuilt || scrollShut} className="pixel-btn" style={{ flex: 1, minWidth: 0, fontSize: freeLeft > 0 ? 15 : 19, padding: "10px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{/* (smaller with the free runs left in it, so it stays one line) */}
            {notBuilt ? "Speed Scroll only for now" : scrollShut ? "Beat it crawling first" : <>{walking ? "🔥" : DUNGEON_ICONS[dungeon]} Enter {DUNGEONS[dungeon].name.replace("The", "the")} {freeLeft > 0 ? `(free · ${freeLeft} left)` : fee === 0 ? "(free)" : `(${fee} gold)`}</>}
          </button>
          <Help title="The labyrinth">
            <ul>
              <li>Rooms and winding tunnels, with the <b>boss&apos;s lair</b> somewhere at the top.</li>
              <li>You get <b>one look at the map</b> at the entrance. Inside it&apos;s too dark to read: you pick your way tunnel by tunnel, and there&apos;s no going back.</li>
              <li>Some rooms are a <b>mystery</b> until you walk in.</li>
              <li>Take <b>{cap} creatures</b> in. They can swap places in a fight, but <b>nobody new joins</b> once you&apos;re inside.</li>
              <li><b>Free pick</b>: choose from all your creatures each time. Or save up to <b>{TEAM_SLOTS} teams</b>: pick a team, then tap creatures to add or take them out (or use <b>Add to team</b> in a creature&apos;s window). A team of more than {cap} sends its first {cap}.</li>
              <li>Pack your <b>bag</b> here too: spare gear, potions and tools.</li>
              <li><b>Wounds carry</b> from room to room. If your team falls you wake up in the Den — <b>you keep everything you found</b>.</li>
            </ul>
          </Help>
        </div>
        {full.length > 0 && <p style={{ fontSize: 12, color: "#ff8a80", textAlign: "center", margin: 0 }}>
          Your {full.map((b) => BOX_NAMES[b]).join(" and ")} box{full.length > 1 ? "es are" : " is"} full. <Link href="/chest" style={{ color: "white", textDecoration: "underline" }}>Sell some</Link> to go back in.
        </p>}
        {!canPay && <p style={{ fontSize: 12, color: "#ff8a80", textAlign: "center", margin: 0 }}>Entering costs {fee} gold — you have {gold}.</p>}
        {askPick && party.length === 0 && <p style={{ fontSize: 13, color: "#ff8a80", textAlign: "center", margin: 0 }}>Pick at least one creature to take in{pick === null ? "" : ` (Team ${pick + 1} has nobody who can go)`}.</p>}
    </footer>
    </div>
  );
}
