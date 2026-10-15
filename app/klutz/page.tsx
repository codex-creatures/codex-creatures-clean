"use client";
// app/klutz/page.tsx
// Klutz, your helper: gear him up and send him hunting in the Labyrinth.
// Creatures he beats come home to the cage; their gear to your inventory.

import { useEffect, useState } from "react";
import Link from "next/link";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";
import CreatureDetailModal from "@/components/CreatureDetailModal";
import { StatsLine } from "@/components/BattleScreen";
import { useGameState, klutzDrop, KLUTZ_DROP_ID } from "@/hooks/useGameState";
import { combatSummary } from "@/lib/combat/loadout";
import { CREATURE_BY_ID, KLUTZ } from "@/lib/creatures/creatureData";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { isCreatureDrop, isItemDrop, type CreatureOrItemDrop } from "@/lib/types";
import {
  klutzStatus, ENCOUNTER_CHANCE, ENCOUNTER_CHECKS, EXPEDITION_MS, HEAL_MS_PER_HP, type Expedition, type KlutzEncounter,
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
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  if (!game.hydrated) return <DenFrame title="Klutz" icon="👺"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const f = game.klutzFighter;
  const status = klutzStatus(game.klutz, f.maxHp, now);
  const ex = game.klutz.expedition;
  const items = game.inventory.filter(isItemDrop) as CreatureOrItemDrop[];
  const weapons = items.filter((d) => d.itemCategory === "weapon"), armors = items.filter((d) => d.itemCategory === "armor");
  const names = new Map<string, string>([...game.inventory.filter(isCreatureDrop).map((c) => [c.id, c.name] as [string, string]), [KLUTZ_DROP_ID, "Klutz"]]);
  const rc = RARITY_COLORS[KLUTZ.rarity];

  return (
    <DenFrame title="Klutz" icon="👺">
      <div className="stone-panel" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <PixelSprite sprite={creatureSprite("klutz")} scale={3} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="pixel-font" style={{ fontSize: 22, color: GOLD }}>Klutz</div>
          <div style={{ fontSize: 13, color: MUTED }}>Your helper · <span style={{ color: rc.text, textTransform: "capitalize" }}>{KLUTZ.rarity}</span></div>
          <p style={{ fontSize: 13, color: "#c8c4b8", margin: "6px 0 0", lineHeight: 1.45 }}>
            Pay him in gear and he&apos;ll hunt the Labyrinth for you. Whatever he beats, he drags home to the cage — along with its gear.
          </p>
          <StatsLine stats={combatSummary(f)} />
        </div>
      </div>

      <QuestTalk game={game} />

      <button className="pixel-btn" style={{ marginTop: 12 }} disabled={status.kind === "away"} onClick={() => setGearOpen(true)}>
        🎒 Klutz&apos;s gear &amp; moves
      </button>
      {status.kind === "away" && <span style={{ fontSize: 12, color: MUTED, marginLeft: 8 }}>(he&apos;s got it with him)</span>}

      {/* Where he is */}
      {status.kind === "home" && (
        <div className="stone-panel" style={{ marginTop: 14 }}>
          <div className="pixel-font" style={{ fontSize: 16, color: GOLD }}>Send him hunting</div>
          <p style={{ fontSize: 13, color: "#c8c4b8", lineHeight: 1.5, margin: "6px 0 10px" }}>
            He&apos;ll be gone for {Math.round(EXPEDITION_MS / 60000)} minutes, with {ENCOUNTER_CHECKS} chances ({Math.round(ENCOUNTER_CHANCE * 100)}% each) to
            run into a wild creature. It could be any rarity, wearing gear one tier below it. If he wins he brings it home;
            if he loses he limps back to the pool and heals 1 HP every {HEAL_MS_PER_HP / 1000} seconds. Better gear means he can take on tougher creatures.
          </p>
          <button className="pixel-btn" onClick={game.sendKlutzOff}>🌀 Send Klutz into the Labyrinth</button>
        </div>
      )}
      {status.kind === "away" && (
        <div className="stone-panel" style={{ marginTop: 14 }}>
          <div className="pixel-font" style={{ fontSize: 16, color: GOLD }}>Hunting in the Labyrinth…</div>
          <div style={{ fontSize: 13, color: MUTED, margin: "4px 0 8px" }}>Back in {clock(status.expedition.endsAt - now)} at the latest.</div>
          <EncounterLog ex={status.expedition} upTo={now} />
          <button className="chip" style={{ marginTop: 10 }} onClick={game.klutzSkipAhead} title="A shortcut for playtesting">Testing: skip to the end</button>
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
          <EncounterLog ex={ex} upTo={ex.endsAt} />
          {ex.encounters.some((e) => e.won) && (
            <p style={{ fontSize: 13, margin: "8px 0 0" }}>Caught creatures are waiting in the <Link href="/cage" style={{ textDecoration: "underline" }}>cage</Link>; their gear is in your inventory.</p>
          )}
        </div>
      )}

      {gearOpen && (
        <CreatureDetailModal
          creature={klutzDrop()}
          isFavorite={false}
          loadout={game.equipment[KLUTZ_DROP_ID]}
          weapons={weapons}
          armors={armors}
          equippedOn={game.equippedOn}
          creatureNameById={names}
          onEquip={(slot, itemId) => game.equipItem(KLUTZ_DROP_ID, slot, itemId)}
          onSetMoves={(moves) => game.setMoves(KLUTZ_DROP_ID, moves)}
          onClose={() => setGearOpen(false)}
        />
      )}
    </DenFrame>
  );
}

// Klutz's lines for the first quest (his stolen box).
function QuestTalk({ game }: { game: ReturnType<typeof useGameState> }) {
  const q = game.quest;
  const [handed, setHanded] = useState<number | null>(null);
  const say = (lines: React.ReactNode, action?: React.ReactNode) => (
    <div className="stone-panel" style={{ marginTop: 12, borderColor: "#8a6a3a" }}>
      <div className="pixel-font" style={{ fontSize: 14, color: "#d6f0a8", marginBottom: 6 }}>Klutz says:</div>
      <div style={{ fontSize: 14, color: "#e8e2d0", lineHeight: 1.55, fontStyle: "italic" }}>{lines}</div>
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
  if (handed !== null) {
    return say(<>&ldquo;There. Put the lot in your storage — {handed} bits of gear, all yours. Now go on, get stuck in!&rdquo;</>,
      <Link href="/chest" className="pixel-btn">Open your storage</Link>);
  }
  if (q.stage === "start") {
    return say(
      <>
        &ldquo;Oi! You&apos;re up. Listen — I&apos;ve been collecting weapons and armour down in the Labyrinth for ages. Kept &apos;em all in a box.
        Woke up this morning and there&apos;s a <b>Rattlebones</b> legging it into the Labyrinth with the whole lot!
        Get it back for me, would you?&rdquo;
      </>,
      <button className="pixel-btn" onClick={game.acceptQuest}>&ldquo;I&apos;ll find it.&rdquo;</button>,
    );
  }
  if (q.stage === "hunt") {
    return say(
      <>&ldquo;It went through the archway, rattling like a bag of spoons. {q.clubFound ? "You found my club! Good — bonk it with that." : "Oh — and I dropped my old club in there chasing it. Grab it if you see it."}&rdquo;</>,
      <Link href="/dungeon" className="pixel-btn">🌀 To the Labyrinth</Link>,
    );
  }
  if (q.stage === "boxFound") {
    return say(
      <>
        &ldquo;MY BOX! You actually got it back! … Funny thing — while you were down there I heard the whole Labyrinth <b>shift</b>.
        Walls grinding about, tunnels moving. Every time you go in, it&apos;ll be different.
        Tell you what — you keep what&apos;s in the box. I&apos;ll put it all in your storage.&rdquo;
      </>,
      <button className="pixel-btn" onClick={() => { setHanded(q.box?.length ?? 0); game.handOverBox(); }}>📦 Hand over the box</button>,
    );
  }
  return null;
}

function EncounterLog({ ex, upTo }: { ex: Expedition; upTo: number }) {
  const seen = ex.encounters.filter((e) => e.at <= upTo);
  if (seen.length === 0) return <div style={{ fontSize: 13, color: MUTED }}>{upTo >= ex.endsAt ? "He didn't run into anything this time." : "Nothing yet…"}</div>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {seen.map((e, i) => <EncounterRow key={i} e={e} ex={ex} />)}
    </div>
  );
}

function EncounterRow({ e, ex }: { e: KlutzEncounter; ex: Expedition }) {
  const t = CREATURE_BY_ID[e.creatureId];
  const mins = Math.round((e.at - ex.startedAt) / 60000);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#12131a", padding: 6 }}>
      <PixelSprite sprite={creatureSprite(e.creatureId)} scale={1} />
      <div style={{ fontSize: 13, lineHeight: 1.4 }}>
        <span style={{ color: MUTED }}>{mins} min in:</span> a wild <b style={{ color: RARITY_COLORS[e.rarity].text }}>{t?.name ?? e.creatureId}</b>{" "}
        <span style={{ color: MUTED }}>({e.rarity}, {e.gearRarity} gear)</span> —{" "}
        {e.won
          ? <span style={{ color: "#7CFC9A" }}>Klutz won in {e.rounds} rounds and caught it! ({e.hpAfter}/{ex.maxHp} HP left)</span>
          : <span style={{ color: "#ff8a80" }}>Klutz was beaten and limped home.</span>}
      </div>
    </div>
  );
}
