"use client";
// app/battle/page.tsx
// Play a 3v3 battle by hand against the AI, using your own creatures with the
// gear and moves set on them. Each round plays out step by step. Finished
// battles are kept in your battle history (never in your main save).

import { useEffect, useState } from "react";
import Link from "next/link";
import { ITEM_META } from "@/lib/items/metadata";
import { ARMOR_META, type ArmorKey } from "@/lib/items/armor";
import type { ItemKey } from "@/lib/items/ceilings";
import type { Rarity } from "@/lib/items/budgets";
import { CREATURES_BY_RARITY, CREATURE_TEMPLATES } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { buildFighter, combatSummary } from "@/lib/combat/loadout";
import type { Fighter } from "@/lib/combat/engine";
import { AI_LEVEL_LABELS, type AiLevel } from "@/lib/combat/thinkingAi";
import { rollGear, RARITIES } from "@/lib/balance/simulate";
import { YOU } from "@/components/BattleLog";
import DenFrame from "@/components/DenFrame";
import {
  BattleView, Chips, SectionTitle, StatsLine, loadOwnedCreatures, rarityColor, usePlayableBattle, MUTED,
  type MemberInfo, type OwnedCreature, type Match,
} from "@/components/BattleScreen";

const TEAM_SIZE = 3;

type OppCreatures = "same" | "random";
type OppGear = "match" | "none" | Rarity;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Opponent team ─────────────────────────────────────────────────
function buildOpponents(mine: OwnedCreature[], creatures: OppCreatures, gear: OppGear) {
  const used = new Set<string>();
  const fighters: Fighter[] = [];
  const info: MemberInfo[] = [];
  for (const me of mine) {
    const pool = creatures === "same" ? CREATURES_BY_RARITY[me.rarity] : CREATURE_TEMPLATES;
    const fresh = pool.filter((c) => !used.has(c.id));
    const t = pick(fresh.length > 0 ? fresh : pool);
    used.add(t.id);

    // "match": same gear rarity as your creature in the same team slot.
    const weaponRarity = gear === "none" ? undefined : gear === "match" ? me.weaponRarity : gear;
    const armorRarity  = gear === "none" ? undefined : gear === "match" ? me.armorRarity  : gear;
    const w = weaponRarity ? rollGear(weaponRarity, t) : undefined;
    const a = armorRarity  ? rollGear(armorRarity, t)  : undefined;

    fighters.push(buildFighter(t, w?.weapon, a?.armor));
    info.push({
      rarity: t.rarity,
      label: creatureTypeLabel(t.proficiency), creatureId: t.id,
      weaponName: w ? `${ITEM_META[w.weaponKey as ItemKey].name} (${weaponRarity})` : undefined,
      armorName:  a ? `${ARMOR_META[a.armorKey as ArmorKey].name} (${armorRarity})` : undefined,
    });
  }
  return { fighters, info };
}

export default function BattlePage() {
  const [owned, setOwned] = useState<OwnedCreature[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [oppCreatures, setOppCreatures] = useState<OppCreatures>("same");
  const [oppGear, setOppGear] = useState<OppGear>("match");
  const [level, setLevel] = useState<AiLevel>("normal");
  const battle = usePlayableBattle();

  // Read the save once (read-only).
  useEffect(() => {
    const list = loadOwnedCreatures();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the save after mount
    setOwned(list);
    // Start with up to three roster creatures already picked.
    setPicked(list.filter((c) => c.roster).slice(0, TEAM_SIZE).map((c) => c.id));
  }, []);

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < TEAM_SIZE ? [...p, id] : p));
  }

  function startMatch() {
    const mine = picked.map((id) => owned!.find((c) => c.id === id)!);
    const opp = buildOpponents(mine, oppCreatures, oppGear);
    battle.start({ A: mine.map((c) => c.fighter), B: opp.fighters }, { A: mine, B: opp.info }, level);
  }

  function rematch(m: Match) {
    battle.start(m.teams, m.info, m.level);
  }

  return (
    <DenFrame title="VS AI (testing)" icon="⚔️" back="/pit" backLabel="The Pit">
      {owned === null ? (
        <p style={{ color: MUTED }}>Loading…</p>
      ) : !battle.match ? (
        <Setup
          owned={owned} picked={picked} onToggle={togglePick}
          oppCreatures={oppCreatures} setOppCreatures={setOppCreatures}
          oppGear={oppGear} setOppGear={setOppGear}
          level={level} setLevel={setLevel}
          onStart={startMatch}
        />
      ) : (
        <BattleView
          battle={battle}
          finishedActions={<>
            <button onClick={() => rematch(battle.match!)} className="pixel-btn">Rematch</button>
            <button onClick={battle.clear} className="pixel-btn">New battle</button>
          </>}
        />
      )}
    </DenFrame>
  );
}

// ── Setup screen ──────────────────────────────────────────────────
function Setup({
  owned, picked, onToggle, oppCreatures, setOppCreatures, oppGear, setOppGear, level, setLevel, onStart,
}: {
  owned: OwnedCreature[]; picked: string[]; onToggle: (id: string) => void;
  oppCreatures: OppCreatures; setOppCreatures: (v: OppCreatures) => void;
  oppGear: OppGear; setOppGear: (v: OppGear) => void;
  level: AiLevel; setLevel: (v: AiLevel) => void;
  onStart: () => void;
}) {
  if (owned.length < TEAM_SIZE) {
    return (
      <p style={{ color: MUTED, lineHeight: 1.5 }}>
        You need at least {TEAM_SIZE} creatures to battle — you have {owned.length}. Scan a few more at the{" "}
        <Link href="/altar" style={{ color: "white", textDecoration: "underline" }}>Scanning Altar</Link> first.
      </p>
    );
  }

  return (
    <>
      <SectionTitle>Your team — pick {TEAM_SIZE} ({picked.length}/{TEAM_SIZE})</SectionTitle>
      <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>
        Number 1 goes in first. Each creature fights with the gear and moves set on it in the Pit. ★ = roster.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {owned.map((c) => {
          const slot = picked.indexOf(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onToggle(c.id)}
              className="card-btn"
              style={{ borderColor: slot >= 0 ? YOU : undefined, background: slot >= 0 ? "rgba(78,161,255,0.12)" : undefined }}
            >
              <span className="pixel-font" style={{ width: 24, height: 24, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: slot >= 0 ? YOU : "rgba(255,255,255,0.08)", color: slot >= 0 ? "black" : MUTED }}>
                {slot >= 0 ? slot + 1 : ""}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 600, color: rarityColor(c.rarity) }}>{c.roster ? "★ " : ""}{c.name}</span>
                <span style={{ fontSize: 12, color: MUTED }}> · {c.label}</span>
                <span style={{ display: "block", fontSize: 12, color: MUTED, marginTop: 2 }}>
                  {c.weaponName ? <span style={{ color: rarityColor(c.weaponRarity) }}>{c.weaponName}</span> : "no weapon"}
                  {" · "}
                  {c.armorName ? <span style={{ color: rarityColor(c.armorRarity) }}>{c.armorName}</span> : "no armour"}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "#c9b48a", marginTop: 2 }}>{c.fighter.skills.map((s) => s.name).join(" · ")}</span>
                <StatsLine stats={combatSummary(c.fighter)} />
              </span>
            </button>
          );
        })}
      </div>

      <SectionTitle>Opponent skill</SectionTitle>
      <Chips value={level} onChange={setLevel} options={(Object.keys(AI_LEVEL_LABELS) as AiLevel[]).map((l) => [l, AI_LEVEL_LABELS[l]] as [AiLevel, string])} />
      <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>
        Easy goes for big hits. Normal and Hard think a few rounds ahead before every move (Hard further), so they swap, cripple and dash when it pays off.
      </p>

      <SectionTitle>Opponent creatures</SectionTitle>
      <Chips
        value={oppCreatures} onChange={setOppCreatures}
        options={[["same", "Same rarities as mine"], ["random", "Any creature"]]}
      />

      <SectionTitle>Opponent gear</SectionTitle>
      <Chips
        value={oppGear} onChange={setOppGear}
        options={[["match", "Same rarity as mine"], ["none", "No gear"], ...RARITIES.map((r) => [r, r] as [OppGear, string])]}
      />
      <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>
        The opponent&apos;s gear is freshly rolled and suits each creature&apos;s type. &quot;Same rarity&quot; copies the
        rarity of the item in each of your slots (empty slot → no item). Opponents use their default moves.
      </p>

      <button onClick={onStart} disabled={picked.length !== TEAM_SIZE} className="pixel-btn" style={{ marginTop: 22, width: "100%", fontSize: 20, padding: "12px 0" }}>
        ⚔️ Start the battle
      </button>
    </>
  );
}
