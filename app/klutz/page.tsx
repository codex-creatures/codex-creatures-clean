"use client";
// app/klutz/page.tsx
// Klutz, your helper: gear him up and send him exploring the dungeons you've
// beaten (lib/klutz.ts). Three tabs under his card, so it never gets long:
// - Send: where he can go (each dungeon's best rarity and cost; locked ones
//   say what opens them), then one button; while he's out, his HP, his pack
//   and what he's found so far.
// - Skills: his skill points (Trapping, Armourer, Scavenger, Scholar), his
//   traits (Bigger Pack, Selective, the cage filter) and pack upgrades.
// - Chest: what he's brought home, against its size, and its upgrade.

import { useEffect, useState } from "react";
import Link from "next/link";
import { startTour, TOUR_CHOICES } from "@/lib/tour";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { creatureSprite, itemSprite } from "@/components/PixelSprite";
import { LevelBar } from "@/components/CreatureDetailModal";
import CodeCache from "@/components/CodeCache";
import KlutzGear from "@/components/KlutzGear";
import Help, { HelpSection } from "@/components/Help";
import { Coin } from "@/components/GoldCount";
import { useGameState } from "@/hooks/useGameState";
import { CREATURE_BY_ID, KLUTZ } from "@/lib/creatures/creatureData";
import { klutzHelping, needsFirstCreature, needsGearUp } from "@/lib/quest";
import { clampLevel, SCAN_UNLOCK } from "@/lib/creatures/levels";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { Rarity } from "@/lib/items/budgets";
import type { CreatureOrItemDrop } from "@/lib/types";
import {
  klutzStatus, pointsFree, HEAL_MS_PER_HP, CAPTURE_XP, FIND_XP, XP_SHARE, HUNT_BELOW, HUNT_ABOVE, FIND_EVERY_MS, FIND_MIX, GEAR_DROP_CHANCE, HOME_AT, SEND_AT,
  KLUTZ_DESTS, destCost, destOpen, bestRarity, packSize, chestSize, chestUpgradePrice, skillPointsFree, skillLevel, skillChance, catchChance, readyAt,
  SKILL_KEYS, SKILL_MAX, PACK_TRAIT, PACK_MAX, SELECTIVE_LEVEL, CAGE_FILTER_LEVEL, canBuyPackTrait, selectiveOpen, cageFilterOpen,
  type Expedition, type KlutzEncounter, type KlutzDest, type KlutzFind, type SkillKey, type SendBlock,
} from "@/lib/klutz";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const DEST_ICON: Record<KlutzDest, string> = { 0: "⛺", 1: "👁️", 2: "🐍", 3: "🕳️" };
const DEST_OPENS: Record<KlutzDest, string> = { 0: "", 1: "Beat the Cyclops", 2: "Beat the Hydra", 3: "Beat the Warden" };
const SKILL_INFO: Record<SkillKey, { name: string; icon: string; what: (lv: number) => string }> = {
  trapping: { name: "Trapping", icon: "🪤", what: (lv) => `+${Math.round(skillChance("trapping", lv) * 100)}% catch chance` },
  armourer: { name: "Armourer", icon: "⚔️", what: (lv) => `${Math.round(skillChance("armourer", lv) * 100)}% an extra weapon or armour` },
  scavenger: { name: "Scavenger", icon: "🧪", what: (lv) => `${Math.round(skillChance("scavenger", lv) * 100)}% an extra material or potion` },
  scholar: { name: "Scholar", icon: "📜", what: (lv) => `${Math.round(skillChance("scholar", lv) * 100)}% an extra codex` },
};
const BLOCK_TEXT: Record<SendBlock, string> = { away: "He's out exploring.", hurt: "", chest: "His chest is full: empty it first.", closed: "Locked.", gold: "Not enough gold." };

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(sec).padStart(2, "0")}`;
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
type Tab = "send" | "skills" | "chest";

export default function KlutzPage() {
  const game = useGameState();
  const [now, setNow] = useState(() => Date.now());
  const [gearOpen, setGearOpen] = useState(false);
  const [recallArmed, setRecallArmed] = useState(false);
  const [tab, setTab] = useState<Tab>("send");
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  if (!game.hydrated) return <DenFrame title="Klutz" icon="👺"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const f = game.klutzFighter;
  const status = klutzStatus(game.klutz, f.maxHp, now);
  const rc = RARITY_COLORS[KLUTZ.rarity];
  // His gear, moves and hunting only open up once you've got his box back to
  // him, looked through it, and agreed to lend him some.
  const helping = klutzHelping(game.quest);
  const klutzLv = clampLevel(game.klutz.level);
  const skillsFree = skillPointsFree(game.klutz);

  return (
    <DenFrame title="Klutz" icon="👺" gold={game.gold}>
      <div className="stone-panel" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <PixelSprite sprite={creatureSprite("klutz")} scale={3} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="pixel-font" style={{ fontSize: 22, color: GOLD }}>Klutz</div>
          <div style={{ fontSize: 13, color: MUTED }}>Your helper · <b style={{ color: GOLD }}>Lv {klutzLv}</b> · <span style={{ color: rc.text, textTransform: "capitalize" }}>{KLUTZ.rarity}</span></div>
          <p style={{ fontSize: 15, color: "#c8c4b8", margin: "6px 0 0", lineHeight: 1.45 }}>
            {helping ? "Gear him up and send him exploring the dungeons you've beaten." : "Your dopey goblin helper."}
          </p>
        </div>
      </div>
      {helping && <LevelBar level={klutzLv} xp={game.klutz.xp ?? 0} />}

      <QuestTalk game={game} />
      <ScanTip game={game} />
      {/* His tours (lib/tour.ts), again: once the box is open and he's offered them. */}
      {(game.quest.stage === "lend" || game.quest.stage === "done") && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 6 }}>🗺️ Show me round again:</div>
          <TourChoices chip />
        </div>
      )}

      {helping && (
        <>
          {/* (Open while he's away too, to look: his gear's with him, so no swapping.) */}
          <button className={`pixel-btn${pointsFree(game.klutz) > 0 ? " news-glow" : ""}`} style={{ marginTop: 12 }} onClick={() => setGearOpen(true)}>
            ⚔️ Equip{pointsFree(game.klutz) > 0 && <> · <b>{pointsFree(game.klutz)}</b> points to spend</>}
          </button>
          <div className="dock-tabs" style={{ marginTop: 12 }}>
            <button className="dock-tab" data-active={tab === "send"} onClick={() => setTab("send")}>🌀 {status.kind === "away" ? "Out" : "Send"}</button>
            <button className={`dock-tab${skillsFree > 0 ? " news-glow" : ""}`} data-active={tab === "skills"} onClick={() => setTab("skills")}>⭐ Skills{skillsFree > 0 && <> · {skillsFree}</>}</button>
            <button className="dock-tab" data-active={tab === "chest"} onClick={() => setTab("chest")}>📦 {game.crate.length}/{chestSize(game.klutz)}</button>
          </div>
          {tab === "send" && <SendTab game={game} now={now} status={status} recallArmed={recallArmed} setRecallArmed={setRecallArmed} />}
          {tab === "skills" && <SkillsTab game={game} />}
          {tab === "chest" && <ChestTab game={game} />}
        </>
      )}

      {gearOpen && <KlutzGear game={game} onClose={() => setGearOpen(false)} />}
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
    const used = (e.finds ?? []).filter((x) => x.at <= now).length;
    return (
      <div className="stone-panel" style={{ marginTop: 10 }}>
        <div className="pixel-font" style={{ fontSize: 16, color: GOLD }}>{e.dest !== undefined ? `${DEST_ICON[e.dest]} Exploring ${KLUTZ_DESTS[e.dest].name}…` : "Hunting in the Labyrinth…"}</div>
        <div style={{ height: 8, background: "#0e0f14", margin: "8px 0 4px" }}>
          <div style={{ height: "100%", width: `${(status.hp / e.maxHp) * 100}%`, background: "#22c55e" }} />
        </div>
        <div style={{ fontSize: 13, color: MUTED, margin: "0 0 8px" }}>
          {status.hp}/{e.maxHp} HP · out for {clock(now - e.startedAt)}{e.v === 2 && <> · pack {used}/{packSize(k)}</>}
        </div>
        <TripLog ex={e} upTo={now} seenIds={game.seenIds} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button className="pixel-btn" style={{ background: recallArmed ? "#6e1f18" : undefined }} onClick={() => {
            if (!recallArmed) { setRecallArmed(true); window.setTimeout(() => setRecallArmed(false), 4000); return; }
            setRecallArmed(false);
            game.callKlutzBack();
          }}>{recallArmed ? "Tap again: call him home" : "📯 Call Klutz back"}</button>
          <button className="chip" onClick={game.klutzSkipAhead} title="A shortcut for playtesting">Testing: skip to the end</button>
        </div>
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
          <TripLog ex={ex} upTo={ex.endsAt} seenIds={game.seenIds} />
          {ex.find && <FindRow find={{ at: ex.endsAt, drop: ex.find }} />}
          {ex.recalled && <p style={{ fontSize: 13, margin: "8px 0 0", color: MUTED }}>You called him back.</p>}
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
      Home because {why}: <b>{caught}</b> caught, <b>{found}</b> found{ex.left ? <>, {ex.left} left behind</> : null}. Creatures go to the <Link href="/cage" style={{ textDecoration: "underline" }}>cage</Link>, materials to your tally, the rest to his <Link href="/crate" style={{ textDecoration: "underline" }}>chest</Link>.
    </p>
  );
}

// ── Skills: points, traits, pack ──
function SkillsTab({ game }: { game: Game }) {
  const k = game.klutz, lv = clampLevel(k.level), free = skillPointsFree(k);
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
                  <b style={{ color: GOLD }}>{info.name}</b> <span style={{ fontSize: 12, color: MUTED }}>{n}/{SKILL_MAX}</span>
                  <span style={{ display: "block", fontSize: 12, color: "#c9b48a" }}>{info.what(n)}</span>
                </span>
                <button className="chip" style={{ minWidth: 44, minHeight: 44 }} disabled={free <= 0 || n >= SKILL_MAX} onClick={() => game.spendKlutzSkill(s)}>+1</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stone-panel" style={{ marginTop: 10 }}>
        <div className="pixel-font" style={{ fontSize: 18, color: GOLD }}>Traits</div>
        <div style={{ marginTop: 8 }}>
          <b style={{ color: GOLD }}>🎒 Bigger Pack</b> <span style={{ fontSize: 12, color: MUTED }}>Lv {PACK_TRAIT.level} · +{PACK_TRAIT.slots} slots</span>
          <div style={{ marginTop: 6 }}>
            {k.traits?.pack ? <span style={{ fontSize: 13, color: "#7CFC9A" }}>Learned.</span>
              : <button className="chip" style={{ minHeight: 44 }} disabled={!canBuyPackTrait(k) || game.gold < PACK_TRAIT.cost} onClick={game.buyKlutzPackTrait}>
                  {lv < PACK_TRAIT.level ? `Opens at Lv ${PACK_TRAIT.level}` : <>Learn it · <Coin /> {PACK_TRAIT.cost}</>}
                </button>}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <b style={{ color: GOLD }}>🧐 Selective</b> <span style={{ fontSize: 12, color: MUTED }}>Lv {SELECTIVE_LEVEL} · leaves things below a rarity</span>
          {selectiveOpen(k) ? rarityChips(k.traits?.selective, game.setKlutzSelective, [null, "uncommon", "rare", "epic"], (r) => (r ? `${cap(r)}+` : "Take all"))
            : <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Opens at Lv {SELECTIVE_LEVEL}.</div>}
        </div>
        <div style={{ marginTop: 12 }}>
          <b style={{ color: GOLD }}>🔒 Cage filter</b> <span style={{ fontSize: 12, color: MUTED }}>Lv {CAGE_FILTER_LEVEL} · only cages a rarity or better</span>
          {cageFilterOpen(k) ? rarityChips(k.traits?.cageFilter, game.setKlutzCageFilter, [null, "uncommon", "rare", "epic"], (r) => (r ? `${cap(r)}+` : "Cage all"))
            : <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Opens at Lv {CAGE_FILTER_LEVEL}.</div>}
        </div>
      </div>

      <div className="stone-panel" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 18, color: GOLD, flex: 1 }}>Pack · {packSize(k)} slots</div>
          <Help title="His pack"><p>What he finds fills his pack; creatures go to the cage instead. <b>Pack Upgrades</b> (+1 each, up to {PACK_MAX}) turn up in chests and on merchants&apos; carts.</p></Help>
        </div>
        <button className="chip" style={{ minHeight: 44, marginTop: 6 }} disabled={packs === 0 || packSize(k) >= PACK_MAX} onClick={game.sewKlutzPack}>
          🎒 Sew on a Pack Upgrade ({packs} held)
        </button>
      </div>
    </>
  );
}

// ── Chest: its size, its upgrade, and the way in ──
function ChestTab({ game }: { game: Game }) {
  const k = game.klutz, size = chestSize(k), price = chestUpgradePrice(k), n = game.crate.length;
  return (
    <div className="stone-panel" style={{ marginTop: 10 }}>
      <div className="pixel-font" style={{ fontSize: 18, color: GOLD }}>His chest · {n}/{size}</div>
      <div style={{ height: 8, background: "#0e0f14", margin: "8px 0 4px" }}>
        <div style={{ height: "100%", width: `${Math.min(100, (n / size) * 100)}%`, background: n >= size ? "#e05a4a" : "#c9a24a" }} />
      </div>
      <p style={{ fontSize: 13, color: "#c8c4b8", margin: "4px 0 10px" }}>
        {n >= size ? "Full: he won't set off until there's room. A trip can fill it past the top." : "Codexes, potions and gear he brings home wait here. Materials go straight to your tally."}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/crate" className="pixel-btn">📦 Open his chest</Link>
        {price !== undefined
          ? <button className="pixel-btn" disabled={game.gold < price} onClick={game.upgradeKlutzChest}>Bigger chest · <Coin /> {price}</button>
          : <span style={{ fontSize: 13, color: MUTED, alignSelf: "center" }}>Fully built.</span>}
      </div>
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
      <Link href="/altar" className="pixel-btn" style={{ marginTop: 10, display: "inline-block" }}>🔮 To the Soul Altar</Link>
    </div>
  );
}

// Klutz's lines for the first quest (his stolen box): short, with the
// action you take next.
// Klutz's tours to choose from (lib/tour.ts), two by two: the full one
// glowing for a new player; as chips once you've had one.
function TourChoices({ chip }: { chip?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {TOUR_CHOICES.map((c) => (
        <button key={c.id} className={chip ? "chip" : `pixel-btn${c.id === "full" ? " tutorial-pulse" : ""}`}
          style={chip ? { minHeight: 44 } : undefined} onClick={() => startTour(c.id)}>{c.label}</button>
      ))}
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
  // The tavern questline (lib/tavern.ts): Klutz wants dynamite for the rubble.
  if (game.tavernDue) {
    return say(
      <>&ldquo;You&apos;re getting tough! See the Den&apos;s right-hand wall? I reckon there&apos;s a whole room behind it.
        Find me some <b>dynamite</b> and we&apos;ll blow it open. Try a <b>storehouse</b> down there.&rdquo;</>,
      <button className="pixel-btn" onClick={game.acceptTavernQuest}>&ldquo;I&apos;ll find some.&rdquo;</button>,
    );
  }
  if (game.tavern.accepted && !game.tavern.dynamite) {
    return say(
      <>&ldquo;The <b>storehouse</b>&apos;s marked on your scroll. The dynamite&apos;s in there somewhere!&rdquo;</>,
      <Link href="/dungeon" className="pixel-btn">🌀 To the Labyrinth</Link>,
    );
  }
  if (game.tavern.dynamite && !game.tavern.blasted) {
    return say(<>&ldquo;Dynamite! Take it to the <b>rubble</b> on the Den&apos;s right-hand wall and light it. Stand well back!&rdquo;</>,
      <Link href="/" className="pixel-btn">🏠 To the Den</Link>);
  }
  if (game.tavern.blasted && !game.tavern.repaired) {
    return say(<>&ldquo;That tavern won&apos;t fix itself. <b>Metal bars, planks and nails</b>, and plenty of them!&rdquo;</>,
      <Link href="/tavern" className="pixel-btn">🍺 To the tavern</Link>);
  }
  return null;
}

// His trip, as it happened: fights and finds in the order they came (older trips: fights, each with its find).
function TripLog({ ex, upTo, seenIds }: { ex: Expedition; upTo: number; seenIds: Set<string> }) {
  const fights = ex.encounters.filter((e) => e.at <= upTo);
  const finds = (ex.finds ?? []).filter((x) => x.at <= upTo);
  if (fights.length + finds.length === 0) return <div style={{ fontSize: 13, color: MUTED }}>{upTo >= ex.endsAt ? "He didn't find anything this time." : "Nothing yet…"}</div>;
  // Which of his catches went in the cage: the first ex.caged of them (older trips only say whether any were let go).
  let catches = 0;
  const rows = [...fights.map((e) => ({ at: e.at, e })), ...finds.map((x) => ({ at: x.at, x }))].sort((a, b) => a.at - b.at);
  return (
    <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
      {rows.map((r, i) => {
        if ("x" in r) return <FindRow key={i} find={r.x!} />;
        const e = r.e!;
        const isCatch = ex.v === 2 ? !!e.caught : e.won;
        const kept = !isCatch || (ex.caged !== undefined ? catches < ex.caged : !ex.letGo);
        if (isCatch) catches++;
        return (
          <div key={i} style={{ display: "grid", gap: 6 }}>
            <EncounterRow e={e} ex={ex} seen={seenIds} kept={kept} />
            {e.find && <FindRow find={{ at: e.at, drop: e.find }} />}
          </div>
        );
      })}
    </div>
  );
}

// Something he found: a codex, a potion, a material, a weapon or armour piece (a skill's extra find says so).
const SKILL_TAG: Record<NonNullable<KlutzFind["skill"]>, string> = { armourer: "⚔️ Armourer", scavenger: "🧪 Scavenger", scholar: "📜 Scholar" };
function FindRow({ find }: { find: KlutzFind }) {
  const it = find.drop as CreatureOrItemDrop;
  const sprite = itemSprite(it);
  const what = it.material ? `${it.name} ×${it.qty ?? 1}` : it.name;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#12131a", padding: 6, minHeight: 36 }}>
      {sprite ? <PixelSprite sprite={sprite} scale={1.5} /> : <span style={{ width: 24, textAlign: "center" }}>🎁</span>}
      <span style={{ fontSize: 13 }}>
        Found <b style={{ color: RARITY_COLORS[it.rarity]?.text ?? GOLD }}>{what}</b>
        {find.skill && <span style={{ color: MUTED }}> · {SKILL_TAG[find.skill]}</span>}
      </span>
    </div>
  );
}

function EncounterRow({ e, ex, seen, kept }: { e: KlutzEncounter; ex: Expedition; seen: Set<string>; kept: boolean }) {
  const t = CREATURE_BY_ID[e.creatureId];
  const mins = Math.round((e.at - ex.startedAt) / 60000);
  if (!e.won && !seen.has(e.creatureId)) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#12131a", padding: 6 }}>
        <PixelSprite sprite={creatureSprite(e.creatureId)} scale={1} style={{ filter: "brightness(0) drop-shadow(0 0 1px rgba(255,255,255,0.4))" }} />
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
          <span style={{ color: MUTED }}>{mins} min in:</span> <span style={{ color: "#ff8a80" }}>Klutz was beaten and limped home.</span>
          <span style={{ display: "block", fontStyle: "italic", color: "#d8d4c8" }}>
            &ldquo;Something came at me out of the dark — never seen anything like it. It&apos;s still down there.&rdquo;
          </span>
        </div>
      </div>
    );
  }
  const won = ex.v === 2
    ? e.caught
      ? kept ? <span style={{ color: "#7CFC9A" }}>caught it!</span> : <span style={{ color: GOLD }}>caught it, but the cage was full, so he let it go.</span>
      : <span style={{ color: GOLD }}>beat it, but it got away.</span>
    : !kept
      ? <span style={{ color: GOLD }}>won, but the cage was full, so he let it go.</span>
      : <span style={{ color: "#7CFC9A" }}>won and caught it!</span>;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#12131a", padding: 6 }}>
      <PixelSprite sprite={creatureSprite(e.creatureId)} scale={1} />
      <div style={{ fontSize: 13, lineHeight: 1.4 }}>
        <span style={{ color: MUTED }}>{mins} min in:</span> a wild <b style={{ color: RARITY_COLORS[e.rarity].text }}>{t?.name ?? e.creatureId}</b>{" "}
        <span style={{ color: MUTED }}>({e.rarity})</span> —{" "}
        {e.won ? <>{won} <span style={{ color: MUTED }}>({e.hpAfter}/{ex.maxHp} HP)</span></> : <span style={{ color: "#ff8a80" }}>Klutz was beaten and limped home.</span>}
      </div>
    </div>
  );
}
