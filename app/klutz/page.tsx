"use client";
// app/klutz/page.tsx
// Klutz, your helper: gear him up and send him hunting in the Labyrinth.
// Creatures he beats come home to the cage; their gear to your inventory.

import { useEffect, useState } from "react";
import Link from "next/link";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { creatureSprite, itemSprite } from "@/components/PixelSprite";
import { LevelBar } from "@/components/CreatureDetailModal";
import CodeCache from "@/components/CodeCache";
import KlutzGear from "@/components/KlutzGear";
import Help, { HelpSection } from "@/components/Help";
import { useGameState } from "@/hooks/useGameState";
import { CREATURE_BY_ID, KLUTZ } from "@/lib/creatures/creatureData";
import { klutzHelping, needsFirstCreature, needsGearUp } from "@/lib/quest";
import { canFind, clampLevel, SCAN_UNLOCK } from "@/lib/creatures/levels";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { CreatureOrItemDrop, Drop } from "@/lib/types";
import {
  klutzStatus, pointsFree, WALK_MIN_MS, WALK_MAX_MS, TOUGHER_AFTER_MS, HEAL_MS_PER_HP, FIND_CHANCE, CAPTURE_XP, FIND_XP, sameRarityChance, HUNT_BELOW, HUNT_ABOVE, type Expedition, type KlutzEncounter,
} from "@/lib/klutz";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(sec).padStart(2, "0")}`;
};

export default function KlutzPage() {
  const game = useGameState();
  const [now, setNow] = useState(() => Date.now());
  const [gearOpen, setGearOpen] = useState(false);
  const [recallArmed, setRecallArmed] = useState(false);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  if (!game.hydrated) return <DenFrame title="Klutz" icon="👺"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const f = game.klutzFighter;
  const status = klutzStatus(game.klutz, f.maxHp, now);
  const ex = game.klutz.expedition;
  const rc = RARITY_COLORS[KLUTZ.rarity];
  // His gear, moves and hunting only open up once you've got his box back to
  // him, looked through it, and agreed to lend him some.
  const helping = klutzHelping(game.quest);
  const klutzLv = clampLevel(game.klutz.level);
  const rarest = (["legendary", "epic", "rare", "uncommon", "common"] as const).find((r) => canFind(klutzLv, r))!;

  return (
    <DenFrame title="Klutz" icon="👺">
      <div className="stone-panel" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <PixelSprite sprite={creatureSprite("klutz")} scale={3} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="pixel-font" style={{ fontSize: 22, color: GOLD }}>Klutz</div>
          <div style={{ fontSize: 13, color: MUTED }}>Your helper · <b style={{ color: GOLD }}>Lv {klutzLv}</b> · <span style={{ color: rc.text, textTransform: "capitalize" }}>{KLUTZ.rarity}</span></div>
          <p style={{ fontSize: 15, color: "#c8c4b8", margin: "6px 0 0", lineHeight: 1.45 }}>
            {helping ? "Gear him up and he'll hunt the Labyrinth for loot and creatures." : "Your dopey goblin helper."}
          </p>
        </div>
      </div>
      {helping && <LevelBar level={klutzLv} xp={game.klutz.xp ?? 0} />}

      <QuestTalk game={game} />
      <ScanTip game={game} />

      {helping && (
        <>
          {/* (Open while he's away too, to look: his gear's with him, so no swapping.) */}
          <button className={`pixel-btn${pointsFree(game.klutz) > 0 ? " news-glow" : ""}`} style={{ marginTop: 12 }} onClick={() => setGearOpen(true)}>
            ⚔️ Equip{pointsFree(game.klutz) > 0 && <> · <b>{pointsFree(game.klutz)}</b> points to spend</>}
          </button>
        </>
      )}

      {/* Where he is */}
      {helping && status.kind === "home" && (
        <div className="stone-panel" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="pixel-font" style={{ fontSize: 18, color: GOLD }}>Send him hunting</div>
            <Help title="Klutz's hunts">
              <HelpSection title="The trip">
                <ul>
                  <li>He hunts <b>until something beats him</b>. Every <b>{WALK_MIN_MS / 60000}–{WALK_MAX_MS / 60000} minutes</b> he meets a <b>wild creature</b> and fights it.</li>
                  <li>He <b>doesn&apos;t heal</b> on the way. After <b>{TOUGHER_AFTER_MS / 3_600_000} hours</b> out, what he meets gets tougher.</li>
                  <li>You can <b>call him back</b> at any time: he comes home with what he&apos;s won so far.</li>
                  <li>They&apos;re around <b>his level</b> ({Math.max(1, klutzLv - HUNT_BELOW)}–{klutzLv + HUNT_ABOVE}), wearing gear <b>one tier below</b> them.</li>
                  <li>Up to <b style={{ textTransform: "capitalize" }}>{rarest}</b> at his level. Rarer ones open at <b>Lv {SCAN_UNLOCK.rare} / {SCAN_UNLOCK.epic} / {SCAN_UNLOCK.legendary}</b> (Rare / Epic / Legendary).</li>
                </ul>
              </HelpSection>
              <HelpSection title="Each win">
                <ul>
                  <li>The creature goes in the <b>cage</b> and its gear in <b>his crate</b>.</li>
                  <li>He gets <b>XP</b>: <b>+{CAPTURE_XP}</b> on top of the fight. Each piece of gear he brings home gives <b>+{FIND_XP}</b>. <b>XP scrolls</b> work on him too.</li>
                  <li>The cage holds <b>{game.cageSize === 1 ? "one" : game.cageSize}</b>: catches that don&apos;t fit, he lets go (and keeps their gear).</li>
                </ul>
              </HelpSection>
              <HelpSection title="When he&apos;s beaten">
                <p>He limps home with everything he&apos;s won, to the <b>healing pool</b>: <b>1 HP every {HEAL_MS_PER_HP / 1000}s</b>.</p>
              </HelpSection>
              <HelpSection title="Gear he finds">
                <p><b>{Math.round(FIND_CHANCE * 100)}%</b> a walk: a piece for a slot he&apos;s wearing, <b>never better than his own</b> ({Math.round(sameRarityChance(klutzLv) * 100)}% the same rarity; better as he levels). Handy for alternatives to gear you have.</p>
              </HelpSection>
              <p><b>Better gear = tougher creatures he can beat.</b></p>
            </Help>
          </div>
          <p style={{ fontSize: 15, color: "#c8c4b8", lineHeight: 1.5, margin: "6px 0 10px" }}>
            He hunts until something beats him. Send him off at bedtime!
          </p>
          <button className="pixel-btn" onClick={game.sendKlutzOff}>🌀 Send Klutz into the Labyrinth</button>
        </div>
      )}
      {status.kind === "away" && (
        <div className="stone-panel" style={{ marginTop: 14 }}>
          <div className="pixel-font" style={{ fontSize: 16, color: GOLD }}>Hunting in the Labyrinth…</div>
          <div style={{ height: 8, background: "#0e0f14", margin: "8px 0 4px" }}>
            <div style={{ height: "100%", width: `${(status.hp / status.expedition.maxHp) * 100}%`, background: "#22c55e" }} />
          </div>
          <div style={{ fontSize: 13, color: MUTED, margin: "0 0 8px" }}>
            {status.hp}/{status.expedition.maxHp} HP · out for {clock(now - status.expedition.startedAt)}
          </div>
          <EncounterLog ex={status.expedition} upTo={now} seenIds={game.seenIds} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="pixel-btn" style={{ background: recallArmed ? "#6e1f18" : undefined }} onClick={() => {
              if (!recallArmed) { setRecallArmed(true); window.setTimeout(() => setRecallArmed(false), 4000); return; }
              setRecallArmed(false);
              game.callKlutzBack();
            }}>{recallArmed ? "Tap again: call him home" : "📯 Call Klutz back"}</button>
            <button className="chip" onClick={game.klutzSkipAhead} title="A shortcut for playtesting">Testing: skip to the end</button>
          </div>
        </div>
      )}
      {status.kind === "healing" && (
        <div className="stone-panel" style={{ marginTop: 14 }}>
          <div className="pixel-font" style={{ fontSize: 16, color: "#9fd8d8" }}>💤 Soaking in the pool</div>
          <div style={{ height: 8, background: "#0e0f14", margin: "8px 0 4px" }}>
            <div style={{ height: "100%", width: `${(status.hp / status.maxHp) * 100}%`, background: "#22c55e" }} />
          </div>
          <div style={{ fontSize: 13, color: MUTED }}>{status.hp}/{status.maxHp} HP · ready again in {clock(status.fullAt - now)}</div>
          <button className="chip" style={{ marginTop: 10 }} onClick={game.klutzSkipAhead} title="A shortcut for playtesting">Testing: heal him now</button>
        </div>
      )}

      {/* The last trip */}
      {ex && status.kind !== "away" && (
        <div className="stone-panel" style={{ marginTop: 14 }}>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD }}>Last trip</div>
          <EncounterLog ex={ex} upTo={ex.endsAt} seenIds={game.seenIds} />
          {ex.find && <FindRow find={ex.find} />}
          {ex.recalled && <p style={{ fontSize: 13, margin: "8px 0 0", color: MUTED }}>You called him back.</p>}
          {ex.encounters.some((e) => e.won) && (ex.caged ?? (ex.letGo ? 0 : 1)) > 0 && (
            <p style={{ fontSize: 13, margin: "8px 0 0" }}>Caught creatures are waiting in the <Link href="/cage" style={{ textDecoration: "underline" }}>cage</Link>; their gear is in <Link href="/crate" style={{ textDecoration: "underline" }}>his crate</Link>.</p>
          )}
        </div>
      )}

      {gearOpen && <KlutzGear game={game} onClose={() => setGearOpen(false)} />}
    </DenFrame>
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
      <>&ldquo;There — it&apos;s all in your Inventory. Go and have a look!&rdquo;</>,
      <Link href="/chest" className="pixel-btn tutorial-pulse">🧰 Open your Inventory</Link>,
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

function EncounterLog({ ex, upTo, seenIds }: { ex: Expedition; upTo: number; seenIds: Set<string> }) {
  const shown = ex.encounters.filter((e) => e.at <= upTo);
  if (shown.length === 0) return <div style={{ fontSize: 13, color: MUTED }}>{upTo >= ex.endsAt ? "He didn't run into anything this time." : "Nothing yet…"}</div>;
  // Which of his catches went in the cage: the first ex.caged of them (older
  // trips only say whether any were let go).
  let wins = 0;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {shown.map((e, i) => {
        const kept = !e.won || (ex.caged !== undefined ? wins < ex.caged : !ex.letGo);
        if (e.won) wins++;
        return (
          <div key={i} style={{ display: "grid", gap: 6 }}>
            <EncounterRow e={e} ex={ex} seen={seenIds} kept={kept} />
            {e.find && <FindRow find={e.find} />}
          </div>
        );
      })}
    </div>
  );
}

// A piece of gear he picked up on a walk.
function FindRow({ find }: { find: Drop }) {
  const it = find as CreatureOrItemDrop;
  const sprite = itemSprite(it);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#12131a", padding: 6 }}>
      {sprite && <PixelSprite sprite={sprite} scale={2} />}
      <span style={{ fontSize: 13 }}>🎁 On the way he picked up <b style={{ color: RARITY_COLORS[it.rarity].text }}>{it.name}</b> <span style={{ color: MUTED }}>({it.rarity})</span> — it goes in <Link href="/crate" style={{ textDecoration: "underline" }}>his crate</Link>.</span>
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
            &ldquo;Something came at me out of the dark — never seen anything like it.
            I didn&apos;t get a proper look… but it&apos;s still down there.&rdquo;
          </span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#12131a", padding: 6 }}>
      <PixelSprite sprite={creatureSprite(e.creatureId)} scale={1} />
      <div style={{ fontSize: 13, lineHeight: 1.4 }}>
        <span style={{ color: MUTED }}>{mins} min in:</span> a wild <b style={{ color: RARITY_COLORS[e.rarity].text }}>{t?.name ?? e.creatureId}</b>{" "}
        <span style={{ color: MUTED }}>({e.rarity}, {e.gearRarity} gear)</span> —{" "}
        {e.won
          ? !kept
            ?<span style={{ color: "#f1d9a0" }}>Klutz won in {e.rounds} rounds — but the cage was full, so he let it go. He kept its gear. ({e.hpAfter}/{ex.maxHp} HP left)</span>
            : <span style={{ color: "#7CFC9A" }}>Klutz won in {e.rounds} rounds and caught it! ({e.hpAfter}/{ex.maxHp} HP left)</span>
          : <span style={{ color: "#ff8a80" }}>Klutz was beaten and limped home.</span>}
      </div>
    </div>
  );
}
