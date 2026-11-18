"use client";
// app/klutz/page.tsx
// Klutz's Den (the user, 2026-11-18): his home, a den within the Den, open
// whether he's in or out (the Den's crate leads here: his things are kept in
// it). His card says where he is (home, resting, or out exploring and when
// he's back), then five tabs, so it never gets long:
// - Hunt: where he can go (each dungeon's best rarity and cost; locked ones
//   say what opens them), then one button; while he's out, his HP, his pack
//   and what he's found so far.
// - Kit: his stats with his gear on, what he's wearing, his soul stone and
//   moves, and Equip (components/klutz/KlutzKit.tsx).
// - Skills: his skill points (Trapping, Armourer, Scavenger, Scholar), his
//   traits (Bigger Pack, Selective, the cage filter: one picked at each of
//   Lv 5, 10 and 15, in any order) and pack upgrades.
// - Crate: what he's brought home, to keep or sell, against its size, and
//   its upgrade (components/klutz/KlutzCrate.tsx).
// - Trips: his last trips, each with what he set off with, his fights and
//   finds (components/klutz/KlutzTrips.tsx, lib/klutz.ts tripLog).
// ?tab=<one of them> opens on it (the Den's crate: ?tab=crate).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEscape } from "@/hooks/useEscape";
import { startTour, TOUR_CHOICES } from "@/lib/tour";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";
import { LevelBar } from "@/components/CreatureDetailModal";
import CodeCache from "@/components/CodeCache";
import KlutzGear from "@/components/KlutzGear";
import KlutzKit from "@/components/klutz/KlutzKit";
import KlutzCrate from "@/components/klutz/KlutzCrate";
import KlutzTrips from "@/components/klutz/KlutzTrips";
import KlutzStory from "@/components/klutz/KlutzStory";
import KlutzPack from "@/components/klutz/KlutzPack";
import Help, { HelpSection } from "@/components/Help";
import UpArrow from "@/components/UpArrow";
import { TOOL_SPRITES } from "@/lib/sprites/items";
import { Coin } from "@/components/GoldCount";
import { useGameState } from "@/hooks/useGameState";
import { KLUTZ } from "@/lib/creatures/creatureData";
import { klutzHelping, needsFirstCreature, needsGearUp } from "@/lib/quest";
import { clampLevel, SCAN_UNLOCK } from "@/lib/creatures/levels";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { Rarity } from "@/lib/items/budgets";
import {
  klutzStatus, pointsFree, HEAL_MS_PER_HP, CAPTURE_XP, FIND_XP, XP_SHARE, HUNT_BELOW, HUNT_ABOVE, FIND_EVERY_MS, FIND_MIX, GEAR_DROP_CHANCE, HOME_AT, SEND_AT,
  KLUTZ_DESTS, destCost, destOpen, bestRarity, packSize, chestSize, chestUpgradePrice, skillPointsFree, skillLevel, skillChance, catchChance, readyAt,
  SKILL_KEYS, SKILL_MAX, PACK_TRAIT, PACK_MAX, TRAIT_LEVELS, traitsPicked, traitPicks, nextTraitLevel, canPickTrait,
  type Expedition, type KlutzDest, type SkillKey, type SendBlock, type TraitKey,
} from "@/lib/klutz";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const DEST_ICON: Record<KlutzDest, string> = { 0: "⛺", 1: "👁️", 2: "🐍", 3: "🕳️" };
const DEST_OPENS: Record<KlutzDest, string> = { 0: "", 1: "Beat the Cyclops", 2: "Beat the Hydra", 3: "Beat the Warden" };
// What a skill does now (or, untrained, what a point gives).
const pct = (s: SkillKey, lv: number) => Math.round(skillChance(s, lv) * 100);
const SKILL_INFO: Record<SkillKey, { name: string; icon: string; what: (lv: number) => string }> = {
  trapping: { name: "Trapping", icon: "🪤", what: (lv) => (lv ? `+${pct("trapping", lv)}% catch chance` : `+${pct("trapping", 1)}% catch chance a point`) },
  armourer: { name: "Armourer", icon: "⚔️", what: (lv) => `${pct("armourer", lv || 1)}%${lv ? "" : " a point"}: an extra weapon or armour` },
  scavenger: { name: "Scavenger", icon: "🧪", what: (lv) => `${pct("scavenger", lv || 1)}%${lv ? "" : " a point"}: an extra material or potion` },
  scholar: { name: "Scholar", icon: "📜", what: (lv) => `${pct("scholar", lv || 1)}%${lv ? "" : " a point"}: an extra codex` },
};
const BLOCK_TEXT: Record<SendBlock, string> = { away: "He's out exploring.", hurt: "", chest: "His chest is full: empty it first.", closed: "Locked.", gold: "Not enough gold." };

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(sec).padStart(2, "0")}`;
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
type Tab = "send" | "kit" | "skills" | "chest" | "trips";
const TABS: Tab[] = ["send", "kit", "skills", "chest", "trips"];

export default function KlutzPage() {
  const game = useGameState();
  const [now, setNow] = useState(() => Date.now());
  const [gearOpen, setGearOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [recallArmed, setRecallArmed] = useState(false);
  const [tab, setTab] = useState<Tab>("send");
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  // ?tab=crate (the Den's crate) and the like: open on that tab.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("tab");
    const t = want === "crate" ? "chest" : want === "hunt" ? "send" : want;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t && (TABS as string[]).includes(t)) setTab(t as Tab);
  }, []);

  if (!game.hydrated) return <DenFrame title="Klutz's Den" icon="👺"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const f = game.klutzFighter;
  const status = klutzStatus(game.klutz, f.maxHp, now);
  const rc = RARITY_COLORS[KLUTZ.rarity];
  // His gear, moves and hunting only open up once you've got his box back to
  // him, looked through it, and agreed to lend him some.
  const helping = klutzHelping(game.quest);
  const klutzLv = clampLevel(game.klutz.level);
  const skillsFree = skillPointsFree(game.klutz);
  const toursOpen = game.quest.stage === "lend" || game.quest.stage === "done";

  return (
    <DenFrame title="Klutz's Den" icon="👺" gold={game.gold}>
      <div className="stone-panel" style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {/* Out, his bedroll's empty: just his shadow where he'd be. */}
        <div style={{ flexShrink: 0, opacity: status.kind === "away" ? 0.3 : 1, filter: status.kind === "away" ? "grayscale(1) brightness(0.4)" : undefined }}>
          <PixelSprite sprite={creatureSprite("klutz")} scale={3} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pixel-font" style={{ fontSize: 22, color: GOLD }}>Klutz</div>
          <div style={{ fontSize: 13, color: MUTED }}>Your helper · <b style={{ color: GOLD }}>Lv {klutzLv}</b> · <span style={{ color: rc.text, textTransform: "capitalize" }}>{KLUTZ.rarity}</span></div>
          <p style={{ fontSize: 14, color: "#c8c4b8", margin: "6px 0 0", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {!helping ? "Your dopey goblin helper."
              : status.kind === "away" ? <>Out · back in {clock(status.expedition.endsAt - now)}</>
              : status.kind === "healing" ? <>💤 Resting · ❤️ {status.hp}/{status.maxHp}</>
              : <>Home · ❤️ {f.maxHp}/{f.maxHp}</>}
          </p>
        </div>
        {/* His tours (lib/tour.ts), again: once the box is open and he's offered them. */}
        {toursOpen && <button className="chip" onClick={() => setTutorialOpen(true)} title="Klutz's tours" aria-label="Klutz's tours" style={{ minHeight: 44, minWidth: 44, flexShrink: 0 }}>🗺️</button>}
      </div>
      {helping && <LevelBar level={klutzLv} xp={game.klutz.xp ?? 0} />}

      <QuestTalk game={game} />
      <ScanTip game={game} />

      {helping && (
        <>
          <div className="dock-tabs" style={{ marginTop: 12 }}>
            <button className="dock-tab" data-active={tab === "send"} onClick={() => setTab("send")} title={status.kind === "away" ? "His trip" : "Send him hunting"}>🌀 {status.kind === "away" ? "Out" : "Hunt"}</button>
            <button className={`dock-tab${pointsFree(game.klutz) > 0 ? " news-glow" : ""}`} data-active={tab === "kit"} onClick={() => setTab("kit")} title="His stats and gear">⚔️ Kit</button>
            <button className={`dock-tab${skillsFree > 0 ? " news-glow" : ""}`} data-active={tab === "skills"} onClick={() => setTab("skills")} title="His skills" aria-label="Skills">⭐{skillsFree > 0 ? ` ${skillsFree}` : ""}</button>
            <button className="dock-tab" data-active={tab === "chest"} onClick={() => setTab("chest")} title="His crate" aria-label="Crate">📦 {game.crate.length}</button>
            <button className="dock-tab" data-active={tab === "trips"} onClick={() => setTab("trips")} title="His trips" aria-label="Trips">📜</button>
          </div>
          {tab === "send" && <SendTab game={game} now={now} status={status} recallArmed={recallArmed} setRecallArmed={setRecallArmed} />}
          {tab === "kit" && <KlutzKit game={game} onEquip={() => setGearOpen(true)} />}
          {tab === "skills" && <SkillsTab game={game} />}
          {tab === "chest" && <ChestTab game={game} />}
          {tab === "trips" && <KlutzTrips klutz={game.klutz} />}
        </>
      )}

      {gearOpen && <KlutzGear game={game} onClose={() => setGearOpen(false)} />}
      {tutorialOpen && <TutorialWindow onClose={() => setTutorialOpen(false)} />}
    </DenFrame>
  );
}

type Game = ReturnType<typeof useGameState>;

// ── Send: where he goes, and the trip under way ──
function SendTab({ game, now, status, recallArmed, setRecallArmed }: { game: Game; now: number; status: ReturnType<typeof klutzStatus>; recallArmed: boolean; setRecallArmed: (v: boolean) => void }) {
  const f = game.klutzFighter, k = game.klutz, klutzLv = clampLevel(k.level), explorer = clampLevel(game.player.level);
  const clears = game.klutzClears();
  const dests = ([0, 1, 2, 3] as KlutzDest[]);
  const lastOpen = [...dests].reverse().find((d) => destOpen(d, clears)) ?? 0;
  const [picked, setPicked] = useState<KlutzDest>(k.dest !== undefined && destOpen(k.dest, clears) ? k.dest : lastOpen);
  const [why, setWhy] = useState<SendBlock | null>(null);
  const ex = k.expedition;

  if (status.kind === "away") {
    const e = status.expedition;
    return (
      <div className="stone-panel" style={{ marginTop: 10 }}>
        <div className="pixel-font" style={{ fontSize: 16, color: GOLD }}>{e.dest !== undefined ? `${DEST_ICON[e.dest]} Exploring ${KLUTZ_DESTS[e.dest].name}…` : "Hunting in the Labyrinth…"}</div>
        <div style={{ height: 8, background: "#0e0f14", margin: "8px 0 4px" }}>
          <div style={{ height: "100%", width: `${(status.hp / e.maxHp) * 100}%`, background: "#22c55e" }} />
        </div>
        <div style={{ fontSize: 13, color: MUTED, margin: "0 0 8px" }}>
          {status.hp}/{e.maxHp} HP · out for {clock(now - e.startedAt)}
        </div>
        <KlutzStory ex={e} upTo={now} seenIds={game.seenIds} live />
        {e.v === 2 && <KlutzPack finds={(e.finds ?? []).filter((x) => x.at <= now)} size={packSize(k)} />}
        <button className="pixel-btn" style={{ width: "100%", marginTop: 10, minHeight: 46, background: recallArmed ? "#6e1f18" : undefined }} onClick={() => {
          if (!recallArmed) { setRecallArmed(true); window.setTimeout(() => setRecallArmed(false), 4000); return; }
          setRecallArmed(false);
          game.callKlutzBack();
        }}>{recallArmed ? "Tap again: call him home" : "📯 Call Klutz back"}</button>
      </div>
    );
  }

  const block = game.klutzSendBlock(picked, now);
  const hp = status.kind === "healing" ? status.hp : f.maxHp;
  const cost = destCost(picked);
  return (
    <>
      <div className="stone-panel" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 18, color: GOLD, flex: 1 }}>Where to?</div>
          <Help title="Klutz's trips">
            <HelpSection title="The trip">
              <ul>
                <li>Every <b>{FIND_EVERY_MS / 60000} minutes</b> he finds something: a <b>creature</b> ({Math.round(FIND_MIX.creature * 100)}%), a <b>codex</b> ({Math.round(FIND_MIX.codex * 100)}%), a <b>material or potion</b> ({Math.round(FIND_MIX.goods * 100)}%), or a <b>weapon or armour</b> ({Math.round(FIND_MIX.gear * 100)}%).</li>
                <li>He comes home when his <b>pack is full</b> ({packSize(k)} slots), when he&apos;s down to <b>{Math.round(HOME_AT * 100)}% HP</b>, or when something beats him. He keeps everything.</li>
                <li>He can set off from <b>{Math.round(SEND_AT * 100)}% HP</b> (the pool heals 1 HP every {HEAL_MS_PER_HP / 1000}s). Lower HP, shorter trip.</li>
                <li>You can <b>call him back</b> any time.</li>
              </ul>
            </HelpSection>
            <HelpSection title="Rarity">
              <ul>
                <li>Rolled as usual, but never past the <b>dungeon&apos;s best</b>, what <b>his level</b> has opened, or your <b>explorer level</b> (Rare / Epic / Legendary at Lv {SCAN_UNLOCK.rare} / {SCAN_UNLOCK.epic} / {SCAN_UNLOCK.legendary}).</li>
                <li>Creatures are around his level ({Math.max(1, klutzLv - HUNT_BELOW)}–{klutzLv + HUNT_ABOVE}), tougher in later dungeons, and more of them <b>strike first</b>.</li>
              </ul>
            </HelpSection>
            <HelpSection title="Creatures">
              <ul>
                <li>Beaten, one&apos;s caught: {RARITIES.map((r) => `${cap(r)} ${Math.round(catchChance(r, skillLevel(k, "trapping")) * 100)}%`).join(", ")}{skillLevel(k, "trapping") ? " (with Trapping)" : ""}. Caught ones go to the <b>cage</b> ({game.cageSize}); spares he lets go.</li>
                <li>{Math.round(GEAR_DROP_CHANCE * 100)}% of the time it drops a piece of its gear too.</li>
              </ul>
            </HelpSection>
            <HelpSection title="XP">
              <p>A catch: the fight&apos;s XP + {CAPTURE_XP}, halved. Each thing he brings home: +{Math.round(FIND_XP * XP_SHARE)}. <b>XP scrolls</b> work on him too.</p>
            </HelpSection>
          </Help>
        </div>
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {dests.map((d) => {
            const open = destOpen(d, clears), best = bestRarity(d, klutzLv, explorer), c = destCost(d);
            return (
              <button key={d} className="card-btn" disabled={!open} data-active={picked === d}
                onClick={() => { setPicked(d); setWhy(null); }}
                style={{ gap: 10, minHeight: 52, opacity: open ? 1 : 0.45, outline: picked === d && open ? `2px solid ${GOLD}` : undefined }}>
                <span style={{ fontSize: 22, width: 30, textAlign: "center" }}>{DEST_ICON[d]}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <b style={{ color: GOLD }}>{KLUTZ_DESTS[d].name}</b>
                  <span style={{ display: "block", fontSize: 12, color: open ? RARITY_COLORS[best].text : MUTED }}>{open ? `Up to ${cap(best)}` : DEST_OPENS[d]}</span>
                </span>
                <span style={{ fontSize: 13, color: GOLD }}>{open ? (c === 0 ? "Free" : <><Coin /> {c}</>) : "🔒"}</span>
              </button>
            );
          })}
        </div>
        {status.kind === "healing" && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 6, background: "#0e0f14" }}><div style={{ height: "100%", width: `${(hp / f.maxHp) * 100}%`, background: "#22c55e" }} /></div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>💤 {hp}/{f.maxHp} HP in the pool · full in {clock(status.fullAt - now)}</div>
          </div>
        )}
        <button className="pixel-btn" style={{ marginTop: 10, width: "100%" }} disabled={!!block} onClick={() => setWhy(game.sendKlutzOff(picked))}>
          🌀 Send him{cost > 0 && <> · <Coin /> {cost}</>}
        </button>
        <div style={{ fontSize: 12, color: "#ff8a80", minHeight: 16, marginTop: 4 }}>
          {block === "hurt" ? `Ready at ${Math.round(SEND_AT * 100)}% HP in ${clock(readyAt(k, f.maxHp, now) - now)}.` : block ? BLOCK_TEXT[block] : why ? BLOCK_TEXT[why] : " "}
        </div>
      </div>

      {/* The last trip */}
      {ex && (
        <div className="stone-panel" style={{ marginTop: 10 }}>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD }}>Last trip{ex.dest !== undefined && <> · {KLUTZ_DESTS[ex.dest].name}</>}</div>
          <TripSummary ex={ex} />
          <KlutzStory ex={ex} upTo={ex.endsAt} seenIds={game.seenIds} />
        </div>
      )}
    </>
  );
}

// One line: why he came home, and what he brought.
function TripSummary({ ex }: { ex: Expedition }) {
  if (ex.v !== 2) return null;
  const caught = ex.encounters.filter((e) => e.caught).length, found = ex.finds?.length ?? 0;
  const why = ex.recalled ? "you called him back" : ex.home === "pack" ? "his pack was full" : ex.home === "hurt" ? "he was hurt" : ex.home === "ko" ? "something beat him" : "he'd been out long enough";
  return (
    <p style={{ fontSize: 13, color: "#c8c4b8", margin: "4px 0 8px" }}>
      Home because {why}: <b>{caught}</b> caught, <b>{found}</b> found{ex.left ? <>, {ex.left} left behind</> : null}. Creatures go to the <Link href="/cage" style={{ textDecoration: "underline" }}>cage</Link>, materials to your tally, the rest to his crate.
    </p>
  );
}

// ── Skills: points, traits, pack ──
const TRAIT_KEYS_UI: { t: TraitKey; icon: string; name: string; what: string; cost: number }[] = [
  { t: "pack", icon: "🎒", name: "Bigger Pack", what: `+${PACK_TRAIT.slots} pack slots`, cost: PACK_TRAIT.cost },
  { t: "selective", icon: "🧐", name: "Selective", what: "leaves things below a rarity", cost: 0 },
  { t: "cageFilter", icon: "🔒", name: "Cage filter", what: "only cages a rarity or better", cost: 0 },
];
function SkillsTab({ game }: { game: Game }) {
  const k = game.klutz, free = skillPointsFree(k);
  const picked = traitsPicked(k), picksFree = traitPicks(k) - picked.length, next = nextTraitLevel(k);
  const packs = game.packUpgradesHeld().length;
  const rarityChips = (value: Rarity | null | undefined, set: (r: Rarity | null) => void, options: (Rarity | null)[], label: (r: Rarity | null) => string) => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {options.map((r) => (
        <button key={r ?? "off"} className="chip" data-active={(value ?? null) === r} onClick={() => set(r)}
          style={{ minHeight: 44, color: r ? RARITY_COLORS[r].text : undefined, outline: (value ?? null) === r ? `2px solid ${GOLD}` : undefined }}>{label(r)}</button>
      ))}
    </div>
  );
  return (
    <>
      <div className="stone-panel" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 18, color: GOLD, flex: 1 }}>Skills</div>
          <span style={{ fontSize: 13, color: free > 0 ? "#7CFC9A" : MUTED }}>{free} point{free === 1 ? "" : "s"}</span>
          <Help title="Klutz's skills">
            <p>He gets a skill point each level. Each skill goes up to {SKILL_MAX}. Trapping makes his catches likelier; the others give him a chance of an <b>extra find</b> every {FIND_EVERY_MS / 60000} minutes. A re-spec (in his Equip window) hands these back too.</p>
          </Help>
        </div>
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {SKILL_KEYS.map((s) => {
            const n = skillLevel(k, s), info = SKILL_INFO[s];
            return (
              <div key={s} className="card-btn" style={{ cursor: "default", gap: 10, minHeight: 52 }}>
                <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{info.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ color: GOLD }}>{info.name}</b>
                  <span style={{ display: "block", fontSize: 12, color: "#c9b48a" }}>{info.what(n)}</span>
                </span>
                {/* His level in it, big; the +1 only with a point to spend (its space kept, so nothing moves). */}
                <span className="pixel-font" style={{ fontSize: 20, color: n >= SKILL_MAX ? "#7CFC9A" : GOLD, whiteSpace: "nowrap" }}>{n}<span style={{ fontSize: 14, color: MUTED }}>/{SKILL_MAX}</span></span>
                <button className="chip" style={{ minWidth: 44, minHeight: 44, visibility: free > 0 && n < SKILL_MAX ? "visible" : "hidden" }} disabled={free <= 0 || n >= SKILL_MAX} onClick={() => game.spendKlutzSkill(s)}>+1</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stone-panel" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 18, color: GOLD, flex: 1 }}>Traits</div>
          <span style={{ fontSize: 13, color: picksFree > 0 ? "#7CFC9A" : MUTED }}>{picksFree > 0 ? `${picksFree} to pick` : next ? `Next pick at Lv ${next}` : "All picked"}</span>
          <Help title="Klutz's traits"><p>He picks a trait at <b>Lv {TRAIT_LEVELS.join(", ")}</b>: any one he hasn&apos;t got, in any order. Till his next pick, the rest stay locked.</p></Help>
        </div>
        {TRAIT_KEYS_UI.map(({ t, icon, name, what }) => (
          <div key={t} style={{ marginTop: 10, opacity: picked.includes(t) || picksFree > 0 ? 1 : 0.55 }}>
            <b style={{ color: GOLD }}>{icon} {name}</b> <span style={{ fontSize: 12, color: MUTED }}>{what}</span>
            {picked.includes(t)
              ? t === "pack" ? <div style={{ fontSize: 13, color: "#7CFC9A", marginTop: 4 }}>Picked.</div>
                : t === "selective" ? rarityChips(k.traits?.selective, game.setKlutzSelective, [null, "uncommon", "rare", "epic"], (r) => (r ? `${cap(r)}+` : "Take all"))
                : rarityChips(k.traits?.cageFilter, game.setKlutzCageFilter, [null, "uncommon", "rare", "epic"], (r) => (r ? `${cap(r)}+` : "Cage all"))
              : picksFree > 0
                ? <div style={{ marginTop: 6 }}>
                    <button className="chip" style={{ minHeight: 44 }} disabled={!canPickTrait(k, t)} onClick={() => game.pickKlutzTrait(t)}>Pick it</button>
                  </div>
                : <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>🔒 Locked{next ? <> · next pick at Lv {next}</> : null}</div>}
          </div>
        ))}
      </div>

      <PackPanel game={game} packs={packs} />
    </>
  );
}

// His pack: its slots, all PACK_MAX of them (the ones he has, then the ones still to sew on), and the
// Pack Upgrades you hold. Use one and a new slot pops into the row (the user, 2026-11-14: it used to be
// a button and a number going up).
function PackPanel({ game, packs }: { game: Game; packs: number }) {
  const k = game.klutz, size = packSize(k), full = size >= PACK_MAX;
  const [added, setAdded] = useState<number | null>(null); // the slot just sewn on (it pops in)
  const sew = () => { if (packs > 0 && !full && game.sewKlutzPack()) setAdded(size); };
  return (
    <div className="stone-panel" style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="pixel-font" style={{ fontSize: 18, color: GOLD, flex: 1 }}>Pack · {size}/{PACK_MAX}</div>
        <Help title="His pack"><p>What he finds fills his pack; creatures go to the cage instead. Each <b>Pack Upgrade</b> sews on one more slot, up to {PACK_MAX}: they turn up in chests and on merchants&apos; carts. The Bigger Pack trait gives {PACK_TRAIT.slots}.</p></Help>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4, marginTop: 8 }}>
        {Array.from({ length: PACK_MAX }, (_, i) => (
          <span key={i} className={`inv-slot${i === added ? " anim-swapin" : ""}`} aria-label={i < size ? "slot" : "not yet sewn on"}
            style={{ aspectRatio: "1", display: "block", ...(i < size ? (i === added ? { borderColor: "#7CFC9A", boxShadow: "0 0 8px rgba(124,252,154,0.6)" } : {}) : { opacity: 0.25, borderStyle: "dashed" }) }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button onClick={sew} disabled={packs === 0 || full} aria-label="Use a Pack Upgrade" className="inv-slot"
          style={{ position: "relative", width: 56, height: 56, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: packs && !full ? "pointer" : "default", opacity: packs ? 1 : 0.4 }}>
          <PixelSprite sprite={TOOL_SPRITES.klutz_pack} scale={4} style={{ width: "64%", height: "auto", imageRendering: "pixelated" }} />
          <UpArrow />
          <span style={{ position: "absolute", right: 3, bottom: 1, fontSize: 11, fontWeight: 700, textShadow: "0 1px 0 #000" }}>×{packs}</span>
        </button>
        <span style={{ fontSize: 13, color: MUTED, flex: 1 }}>
          {full ? "His pack can't get any bigger." : packs > 0 ? <>Tap a <b style={{ color: GOLD }}>Pack Upgrade</b> to sew on a slot.</> : "No Pack Upgrades. Find them in chests or on merchants' carts."}
        </span>
      </div>
    </div>
  );
}

// ── Crate: its size, its upgrade, and what's in it ──
function ChestTab({ game }: { game: Game }) {
  const k = game.klutz, size = chestSize(k), price = chestUpgradePrice(k), n = game.crate.length;
  return (
    <div className="stone-panel" style={{ marginTop: 10 }}>
      <div className="pixel-font" style={{ fontSize: 18, color: GOLD }}>His crate · {n}/{size}</div>
      <div style={{ height: 8, background: "#0e0f14", margin: "8px 0 4px" }}>
        <div style={{ height: "100%", width: `${Math.min(100, (n / size) * 100)}%`, background: n >= size ? "#e05a4a" : "#c9a24a" }} />
      </div>
      <p style={{ fontSize: 13, color: "#c8c4b8", margin: "4px 0 10px" }}>
        {n >= size ? "Full: he won't set off until there's room. A trip can fill it past the top." : "Codexes, potions and gear he brings home wait here. Materials go straight to your tally."}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {price !== undefined
          ? <button className="pixel-btn" disabled={game.gold < price} onClick={game.upgradeKlutzChest}>Bigger crate · <Coin /> {price}</button>
          : <span style={{ fontSize: 13, color: MUTED, alignSelf: "center" }}>Fully built.</span>}
      </div>
      <div style={{ marginTop: 12 }}><KlutzCrate game={game} intro={false} /></div>
    </div>
  );
}

// After SCAN_TIP_DEATHS Labyrinth deaths in a row without a scan: go and scan.
function ScanTip({ game }: { game: ReturnType<typeof useGameState> }) {
  const { scanTipDue, scanTipRead, readScanTip } = game;
  // Seeing it here clears his ❗ (the tip stays until you scan something).
  useEffect(() => { if (scanTipDue && !scanTipRead) readScanTip(); }, [scanTipDue, scanTipRead, readScanTip]);
  if (!scanTipDue) return null;
  return (
    <div className="stone-panel" style={{ marginTop: 12, borderColor: "#8a6a3a" }}>
      <div className="pixel-font" style={{ fontSize: 14, color: "#d6f0a8", marginBottom: 6 }}>Klutz says:</div>
      <div style={{ fontSize: 16, color: "#e8e2d0", lineHeight: 1.5, fontStyle: "italic" }}>
        &ldquo;Three times I&apos;ve dragged you out of there! Go scan some barcodes — each one&apos;s a <b>Code Cache</b> full of gear,
        potions and creatures. Stock up, then try again.&rdquo;
      </div>
      <Link href="/scan" className="pixel-btn" style={{ marginTop: 10, display: "inline-block" }}>🔍 To the scanner</Link>
    </div>
  );
}

// Klutz's lines for the first quest (his stolen box): short, with the
// action you take next.
// Klutz's tours to choose from (lib/tour.ts), two by two: the full one
// glowing for a new player; no glow once you've had one.
function TourChoices({ again }: { again?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {TOUR_CHOICES.map((c) => (
        <button key={c.id} className={`pixel-btn${!again && c.id === "full" ? " tutorial-pulse" : ""}`}
          onClick={() => startTour(c.id)}>{c.label}</button>
      ))}
    </div>
  );
}

// The tours again, in a window from the Tutorial button by Equip.
function TutorialWindow({ onClose }: { onClose: () => void }) {
  useEscape(onClose);
  return (
    <div role="dialog" aria-label="Tutorial" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,5,9,0.78)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, paddingTop: "15cqh" }}>
      <div className="stone-panel" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div className="pixel-font" style={{ fontSize: 18, color: GOLD, flex: 1 }}>🗺️ Show me round</div>
          <button className="chip" style={{ minWidth: 44, minHeight: 44 }} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <TourChoices again />
      </div>
    </div>
  );
}

function QuestTalk({ game }: { game: ReturnType<typeof useGameState> }) {
  const q = game.quest;
  const [opening, setOpening] = useState(false);
  const say = (lines: React.ReactNode, action?: React.ReactNode) => (
    <div className="stone-panel" style={{ marginTop: 12, borderColor: "#8a6a3a" }}>
      <div className="pixel-font" style={{ fontSize: 14, color: "#d6f0a8", marginBottom: 6 }}>Klutz says:</div>
      <div style={{ fontSize: 16, color: "#e8e2d0", lineHeight: 1.5, fontStyle: "italic" }}>{lines}</div>
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
  const mine = game.inventory.filter((d) => d.dropType === "creature");
  if (needsFirstCreature(q, mine.length > 0)) {
    return say(
      <>&ldquo;Oi, you&apos;re awake! I dragged you in out of the Labyrinth. You was kind to me once, so now I&apos;ll help you.
        I caught an <b>evil creature</b> when I was exploring. It&apos;s in the <b>cage</b> — you can recruit it, if you want.&rdquo;</>,
      <Link href="/cage" className="pixel-btn tutorial-pulse">🔒 To the cage</Link>,
    );
  }
  if (q.stage === "start") {
    return say(
      <>&ldquo;Oi, you&apos;re up! A <b>Baby Cyclops</b> ran into the Labyrinth with my box of weapons and armour. Get it back for me?&rdquo;</>,
      <button className="pixel-btn" onClick={game.acceptQuest}>&ldquo;I&apos;ll find it.&rdquo;</button>,
    );
  }
  if (q.stage === "hunt") {
    return say(
      <>&ldquo;{q.clubFound ? "You found my club! Good — bonk it with that." : "It went through the archway, dropping my old club as it ran. Keep an eye out."}&rdquo;</>,
      <Link href="/dungeon" className="pixel-btn">🌀 To the Labyrinth</Link>,
    );
  }
  if (q.stage === "boxFound") {
    return say(
      <>&ldquo;MY BOX! You got it back! Keep what&apos;s inside — go on, open it.&rdquo;</>,
      <>
        <button className="pixel-btn" onClick={() => setOpening(true)}>📦 Open the box</button>
        {opening && (
          <CodeCache title="Klutz's armoury box" items={q.box ?? []}
            intro="Ten bundles of rusty weapons and dented armour. Tap one to unwrap it."
            doneLabel="Put it all in your Inventory"
            onDone={() => { setOpening(false); game.handOverBox(); }} />
        )}
      </>,
    );
  }
  if (q.stage === "stash") {
    return say(
      <>&ldquo;There — it&apos;s all in your Inventory. Want me to show you round? The basics, how fights work, how gear works, or the lot?&rdquo;</>,
      <div style={{ display: "grid", gap: 8 }}>
        <TourChoices />
        <button className="pixel-btn" onClick={game.questSkipTutorial}>Skip the tutorial</button>
      </div>,
    );
  }
  if (needsGearUp(q, mine.map((c) => game.equipment[c.id]))) {
    return say(
      <>&ldquo;Before I take any, kit out your creature! Put some of that <b>armour</b> on it in the Pit.&rdquo;</>,
      <Link href="/pit" className="pixel-btn tutorial-pulse">🐾 To the Pit</Link>,
    );
  }
  if (q.stage === "lend") {
    return say(
      <>&ldquo;Now we&apos;ve got some weapons and armour… I&apos;ll explore the Labyrinth for loot, if you lend me some?&rdquo;</>,
      <button className="pixel-btn" onClick={game.questLend}>&ldquo;Deal.&rdquo;</button>,
    );
  }
  // The tavern questline (lib/tavern.ts): Klutz wants the Labyrinth Stone for the wall (the dynamite, till 2026-11-19).
  if (game.tavernDue) {
    return say(
      <>&ldquo;You&apos;re getting tough! See the Den&apos;s right-hand wall? I reckon there&apos;s a whole room behind it.
        Find me a <b>Labyrinth Stone</b>: old magic that makes the walls down there move. Try a <b>storehouse</b>.&rdquo;</>,
      <button className="pixel-btn" onClick={game.acceptTavernQuest}>&ldquo;I&apos;ll find one.&rdquo;</button>,
    );
  }
  if (game.tavern.accepted && !game.tavern.dynamite) {
    return say(
      <>&ldquo;The <b>storehouse</b>&apos;s marked on your scroll. The Labyrinth Stone&apos;s in there somewhere!&rdquo;</>,
      <Link href="/dungeon" className="pixel-btn">🌀 To the Labyrinth</Link>,
    );
  }
  if (game.tavern.dynamite && !game.tavern.blasted) {
    return say(<>&ldquo;The Labyrinth Stone! Take it to the Den&apos;s right-hand wall and I&apos;ll set it in. Stand back: it moves!&rdquo;</>,
      <Link href="/" className="pixel-btn">🏠 To the Den</Link>);
  }
  if (game.tavern.blasted && !game.tavern.repaired) {
    return say(<>&ldquo;That tavern won&apos;t fix itself. <b>Metal bars, planks and nails</b>, and plenty of them!&rdquo;</>,
      <Link href="/tavern" className="pixel-btn">🍺 To the tavern</Link>);
  }
  return null;
}
