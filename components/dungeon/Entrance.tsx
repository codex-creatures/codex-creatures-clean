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
import { PARTY_SIZE, squadsOf, entryFee, freeRunsLeft, bagSize, bagName, type DungeonSave, DUNGEONS, DEEP_ROUTE, type DungeonId, labyrinthOpen, LABYRINTH_SCANS, CAMP_ROUTE, CRAWLABLE, scrollOpen } from "@/lib/dungeon/run";
import { SectionTitle, loadOwnedCreatures, rarityColor, MUTED, type OwnedCreature } from "@/components/BattleScreen";
import Help from "@/components/Help";
import { gearMarks } from "@/components/CreatureMarks";
import { BOX_NAMES, type CappedBox } from "@/lib/items/storage";

const DUNGEON_ICONS: Record<DungeonId, string> = { 0: "⛺", 1: "🌀", 2: "🕳️", 3: "🌑" };
// The picker's rows (the user, 2026-11-13): the dungeons in order, with the Minotaur to come.
const ROWS: (DungeonId | "minotaur")[] = [0, 1, 2, "minotaur", 3];
const BOSS: Record<DungeonId, string> = { 0: "the camp's chief", 1: "the Cyclops", 2: "the Hydra", 3: "the Warden and his guards" };

// ── The entrance: choose your party ─────────────────────────────────
// quest: Klutz's box is still to fetch (the quest's short run, in the Labyrinth). scans: barcodes scanned.
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
  // Dungeon Crawling (the default) or Speed Scroll. (The quest's run is the old Labyrinth's.)
  const [mode, setMode] = useState<"crawl" | "scroll">("crawl");
  const unlocked = (d: DungeonId) => d === 0 || (d === 1 ? labOpen : d === 2 ? deepOpen : (lab.meta.deepClears ?? 0) > 0);
  const dungeon: DungeonId = quest ? 1 : unlocked(picked) ? picked : 0;
  const walking = !quest && mode === "crawl";
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
    <>
      {!quest && (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {/* Dungeon Crawling (the default) or Speed Scroll. */}
          <div role="tablist" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {([["crawl", "🔥 Dungeon Crawling"], ["scroll", "📜 Speed Scroll"]] as const).map(([m, label]) => (
              <button key={m} role="tab" aria-selected={mode === m} className="chip" data-active={mode === m} onClick={() => setMode(m)}
                style={{ minHeight: 44, textTransform: "none", fontSize: 14 }}>{label}</button>
            ))}
          </div>
          {ROWS.map((row) => {
            if (row === "minotaur") return (
              <div key="minotaur" className="card-btn" aria-disabled style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, opacity: 0.45 }}>
                <b className="pixel-font" style={{ flex: 1, fontSize: 16, color: "#f1d9a0" }}>🐂 Minotaur</b>
                <span style={{ fontSize: 12, color: MUTED }}>to come</span>
              </div>
            );
            const d = row, locked = !unlocked(d), on = dungeon === d && !locked;
            const soon = mode === "crawl" && !CRAWLABLE.includes(d), shut = crawlFirst(d);
            const name = DUNGEONS[d].name.replace(/^The /, "");
            return (
              <div key={d} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button className="card-btn" onClick={() => setDungeon(d)} disabled={locked} title={locked ? lockedWhy(d) : undefined} aria-pressed={on}
                  style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, minHeight: 48, textAlign: "left",
                    opacity: locked || soon || shut ? 0.5 : 1, borderColor: on ? "#f1d9a0" : undefined, background: on ? "rgba(241,217,160,0.1)" : undefined }}>
                  <b className="pixel-font" style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#f1d9a0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{locked ? "🔒" : DUNGEON_ICONS[d]} {name}</b>
                  <span className="pixel-font" style={{ fontSize: 13, color: locked || soon || shut ? MUTED : priceOf(d) === "FREE" ? "#7CFC9A" : "#f1d9a0", whiteSpace: "nowrap" }}>
                    {locked ? "locked" : soon ? "Speed Scroll only" : shut ? "Crawl it first" : priceOf(d)}
                  </span>
                </button>
                <Help title={name} label={`About ${name}`} icon="i">
                  <ul>
                    {locked && <li><b>{lockedWhy(d)}.</b></li>}
                    <li><b>{d === 0 ? CAMP_ROUTE : d === 1 ? DUNGEONS[1].spec.minRoute : DEEP_ROUTE} rooms</b> to {BOSS[d]} at the top.</li>
                    <li>Foes <b>Lv {DUNGEONS[d].levels[0][1]}–{DUNGEONS[d].maxLevel}</b>.</li>
                    <li>Take <b>{squadsOf(d).team} creatures</b> in.</li>
                    <li>Entry: <b>{priceOf(d)}</b>{d === 0 && freeRunsLeft(lab.meta) > 0 ? ` (${freeRunsLeft(lab.meta)} free run${freeRunsLeft(lab.meta) === 1 ? "" : "s"} left)` : ""}.</li>
                    {d > 0 && <li>Foes carry codex moves of their race (up to {d === 1 ? "Uncommon" : d === 2 ? "Rare" : "Epic"}).</li>}
                    <li>Beaten <b>{beaten(d)}×</b>.</li>
                    <li>{CRAWLABLE.includes(d) ? `Dungeon Crawling: walk it yourself by torchlight. Speed Scroll: pick your way room by room on the map${scrollOpen(d, lab.meta) ? "" : ", once you've beaten it crawling"}.` : "Speed Scroll only for now: pick your way room by room on the map."}</li>
                  </ul>
                </Help>
              </div>
            );
          })}
        </div>
      )}
      {/* Enter, with what's inside behind the "?". */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={enter} disabled={!canPay || full.length > 0 || notBuilt || scrollShut} className="pixel-btn" style={{ flex: 1, minWidth: 0, fontSize: 20, padding: "12px 0" }}>
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
      {full.length > 0 && <p style={{ fontSize: 12, color: "#ff8a80", textAlign: "center" }}>
        Your {full.map((b) => BOX_NAMES[b]).join(" and ")} box{full.length > 1 ? "es are" : " is"} full. <Link href="/chest" style={{ color: "white", textDecoration: "underline" }}>Sell some</Link> to go back in.
      </p>}
      {!canPay && <p style={{ fontSize: 12, color: "#ff8a80", textAlign: "center" }}>Entering costs {fee} gold — you have {gold}.</p>}
      {askPick && party.length === 0 && <p style={{ fontSize: 13, color: "#ff8a80", textAlign: "center" }}>Pick at least one creature to take in{pick === null ? "" : ` (Team ${pick + 1} has nobody who can go)`}.</p>}

      {injured.length > 0 && (
        <div className="stone-panel" style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: MUTED }}>⛲ {injured.length} hurt — healing in the Den&apos;s pool.</span>
          <button className="chip" onClick={onHeal} title="A shortcut for playtesting">Testing: heal now</button>
        </div>
      )}

      {/* Party or bag: two tabs, the same size whichever is open. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        <button className="chip" data-active={tab === "party"} onClick={() => setTab("party")} style={{ minHeight: 44, textTransform: "none" }}>🐾 Party {party.length}/{cap}</button>
        <button className="chip" data-active={tab === "bag"} onClick={() => setTab("bag")} style={{ minHeight: 44, textTransform: "none" }}>🎒 {bagName(lab.meta)} {bag.length}/{bagSize(lab.meta)}</button>
      </div>

      {tab === "bag" ? <BagPacker game={game} lab={lab} onSave={onSave} /> : <>
        {/* Free pick, or one of the teams. */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${TEAM_SLOTS + 1}, 1fr)`, gap: 6, marginTop: 10 }}>
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
            More creatures make it easier — <Link href="/altar" style={{ color: "white", textDecoration: "underline" }}>scan</Link> or summon more.
          </p>
        )}
        {owned.length > 0 && (
          <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 10 }}>
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

    </>
  );
}
