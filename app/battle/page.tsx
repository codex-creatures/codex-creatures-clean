"use client";
// app/battle/page.tsx
// Play a 3v3 battle by hand against the AI, using your own creatures with the
// gear and moves set on them. Each round plays out step by step. Finished
// battles are kept in your battle history (never in your main save).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadSave } from "@/hooks/useGameState";
import { isCreatureDrop, isItemDrop, type CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { ITEM_META } from "@/lib/items/metadata";
import { ARMOR_META, type ArmorKey } from "@/lib/items/armor";
import type { ItemKey } from "@/lib/items/ceilings";
import { CREATURES_BY_RARITY, CREATURE_TEMPLATES, findCreatureTemplate, type CreatureTemplate, type Skill } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { buildFighter, combatSummary } from "@/lib/combat/loadout";
import { calcDamage, type Fighter } from "@/lib/combat/engine";
import {
  createBattle, resolveRound, sendInReplacement, cloneBattle,
  activeOf, affordableSkills, swapTargets, currentAgility, other,
  CRIPPLE_ROUNDS, STREAK_START, streakEffects,
  type BattleAction, type BattleEvent, type BattleState, type Combatant, type SideKey,
} from "@/lib/combat/battle";
import { chooseAiAction, chooseAiReplacement, AI_LEVEL_LABELS, type AiLevel } from "@/lib/combat/thinkingAi";
import { rollGear, RARITIES } from "@/lib/balance/simulate";
import { saveBattle, type BattleMember } from "@/lib/battleHistory";
import BattleLog, { YOU, FOE } from "@/components/BattleLog";
import DungeonFrame from "@/components/DungeonFrame";

const TEAM_SIZE = 3;
const MUTED = "rgba(255,255,255,0.5)";
const STEP_MS = { attack: 950, other: 650 };

// What the screen shows about each team member (gear names etc.).
type MemberInfo = { rarity: Rarity; label: string; weaponName?: string; armorName?: string };
type OwnedCreature = MemberInfo & {
  id: string; name: string; template: CreatureTemplate; roster: boolean;
  weaponRarity?: Rarity; armorRarity?: Rarity; fighter: Fighter;
};

type OppCreatures = "same" | "random";
type OppGear = "match" | "none" | Rarity;

type Match = {
  state: BattleState;                 // the real battle
  info: Record<SideKey, MemberInfo[]>;
  teams: Record<SideKey, Fighter[]>;  // for rematches and the history
  level: AiLevel;                     // how well the opponent plays
};

// The animation currently playing.
type Fx =
  | { id: number; kind: "attack"; side: SideKey; damage: number; precise: boolean; missed: boolean; crippled: boolean; gap: boolean }
  | { id: number; kind: "swap" | "sendIn" | "faint"; side: SideKey };

function rarityColor(r?: Rarity) {
  return r ? RARITY_COLORS[r].text : "white";
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      label: creatureTypeLabel(t.proficiency),
      weaponName: w ? `${ITEM_META[w.weaponKey as ItemKey].name} (${weaponRarity})` : undefined,
      armorName:  a ? `${ARMOR_META[a.armorKey as ArmorKey].name} (${armorRarity})` : undefined,
    });
  }
  return { fighters, info };
}

// Replays one event onto the on-screen copy of the battle.
function applyEvent(view: BattleState, e: BattleEvent) {
  switch (e.type) {
    case "swap": {
      const s = view.sides[e.side];
      const leaving = activeOf(s);
      leaving.energy = Math.min(100, leaving.energy + e.energyRestored);
      leaving.streak = undefined;
      s.active = e.toIndex;
      activeOf(s).streak = undefined;
      break;
    }
    case "attack": {
      const attacker = activeOf(view.sides[e.side]);
      const target = activeOf(view.sides[other(e.side)]);
      attacker.energy = e.attackerEnergyAfter;
      attacker.streak = { ...e.streak };
      target.hp = e.targetHpAfter;
      if (e.crippled) target.statuses = [...target.statuses.filter((s) => s.id !== "cripple"), { id: "cripple", rounds: CRIPPLE_ROUNDS }];
      break;
    }
    case "sendIn":
      view.sides[e.side].active = e.index;
      activeOf(view.sides[e.side]).streak = undefined;
      break;
  }
}

function historyMembers(m: Match, k: SideKey): BattleMember[] {
  return m.teams[k].map((f, i) => {
    const s = combatSummary(f);
    return {
      name: f.name, rarity: m.info[k][i].rarity, label: m.info[k][i].label,
      weapon: m.info[k][i].weaponName, armor: m.info[k][i].armorName,
      moves: f.skills.map((sk) => sk.name),
      stats: { hp: s.hp, atk: Math.round(s.atk), rng: Math.round(s.rng), agil: Math.round(s.agil), mdef: Math.round(s.mdef), rdef: Math.round(s.rdef) },
    };
  });
}

export default function BattlePage() {
  const [owned, setOwned] = useState<OwnedCreature[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [oppCreatures, setOppCreatures] = useState<OppCreatures>("same");
  const [oppGear, setOppGear] = useState<OppGear>("match");
  const [level, setLevel] = useState<AiLevel>("normal");
  const [match, setMatch] = useState<Match | null>(null);
  const [view, setView] = useState<BattleState | null>(null); // on-screen copy while a round plays
  const [fx, setFx] = useState<Fx | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // Read the save once (read-only).
  useEffect(() => {
    const save = loadSave();
    const inv = save?.inventory ?? [];
    const favs = new Set(save?.favoriteIds ?? []);
    const equipment = save?.equipment ?? {};
    const items = new Map(inv.filter(isItemDrop).map((d) => [d.id, d as CreatureOrItemDrop]));

    const list: OwnedCreature[] = [];
    for (const d of inv.filter(isCreatureDrop)) {
      const t = findCreatureTemplate(d.creatureId, d.name);
      if (!t) continue;
      const w = items.get(equipment[d.id]?.weaponId ?? "");
      const a = items.get(equipment[d.id]?.armorId ?? "");
      list.push({
        id: d.id, name: t.name, template: t, roster: favs.has(d.id),
        rarity: t.rarity, label: creatureTypeLabel(t.proficiency),
        weaponName: w?.name, armorName: a?.name,
        weaponRarity: w?.rarity, armorRarity: a?.rarity,
        fighter: buildFighter(t, w?.stats, a?.stats, equipment[d.id]?.moves),
      });
    }
    list.sort((x, y) =>
      Number(y.roster) - Number(x.roster) ||
      RARITIES.indexOf(y.rarity) - RARITIES.indexOf(x.rarity) ||
      x.name.localeCompare(y.name)
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the save after mount
    setOwned(list);
    // Start with up to three roster creatures already picked.
    setPicked(list.filter((c) => c.roster).slice(0, TEAM_SIZE).map((c) => c.id));
  }, []);

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < TEAM_SIZE ? [...p, id] : p));
  }

  function startMatch(teams?: Match["teams"], info?: Match["info"], lvl: AiLevel = level) {
    if (!teams || !info) {
      const mine = picked.map((id) => owned!.find((c) => c.id === id)!);
      const opp = buildOpponents(mine, oppCreatures, oppGear);
      teams = { A: mine.map((c) => c.fighter), B: opp.fighters };
      info = { A: mine, B: opp.info };
    }
    setView(null);
    setFx(null);
    setMatch({ state: createBattle(teams.A, teams.B), info, teams, level: lvl });
  }

  // ── Turn handling ───────────────────────────────────────────────
  async function act(action: BattleAction) {
    if (!match || view) return;
    const before = match.state;
    const after = cloneBattle(before);
    resolveRound(after, { A: action, B: chooseAiAction(after, "B", match.level) });
    if (after.needsReplacement.includes("B")) sendInReplacement(after, "B", chooseAiReplacement(after, "B", match.level));
    const done: Match = { ...match, state: after };
    if (after.winner) {
      saveBattle({
        id: crypto.randomUUID(), date: new Date().toISOString(), winner: after.winner, rounds: after.round,
        teams: { A: historyMembers(done, "A"), B: historyMembers(done, "B") }, log: after.log,
      });
    }

    // Play the round's events one at a time.
    let shown = cloneBattle(before);
    setView(shown);
    let n = 0;
    for (const e of after.log.slice(before.log.length)) {
      if (e.type === "round" || e.type === "end" || e.type === "pass") continue;
      shown = cloneBattle(shown);
      applyEvent(shown, e);
      setView(shown);
      setFx(e.type === "attack"
        ? { id: ++n, kind: "attack", side: e.side, damage: e.damage, precise: e.precise, missed: e.missed, crippled: e.crippled, gap: e.defenceIgnored > 0.25 }
        : { id: ++n, kind: e.type, side: e.side });
      await sleep(e.type === "attack" ? STEP_MS.attack : STEP_MS.other);
      if (!alive.current) return;
    }
    setFx(null);
    setView(null);
    setMatch(done);
  }

  function replace(index: number) {
    if (!match || view) return;
    const s = cloneBattle(match.state);
    sendInReplacement(s, "A", index);
    setFx({ id: Date.now(), kind: "sendIn", side: "A" });
    setMatch({ ...match, state: s });
  }

  return (
    <DungeonFrame title="Fight Pit" icon="⚔️" back="/pit" backLabel="Pit">
      {owned === null ? (
        <p style={{ color: MUTED }}>Loading…</p>
      ) : !match ? (
        <Setup
          owned={owned} picked={picked} onToggle={togglePick}
          oppCreatures={oppCreatures} setOppCreatures={setOppCreatures}
          oppGear={oppGear} setOppGear={setOppGear}
          level={level} setLevel={setLevel}
          onStart={() => startMatch()}
        />
      ) : (
        <BattleView
          match={match}
          view={view ?? match.state}
          playing={view !== null}
          fx={fx}
          onAct={act}
          onReplace={replace}
          onRematch={() => startMatch(match.teams, match.info, match.level)}
          onNew={() => setMatch(null)}
        />
      )}
    </DungeonFrame>
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
        Number 1 goes in first. Each creature fights with the gear and moves set on it in the Fight Pit. ★ = roster.
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
        ⚔️ Enter the pit
      </button>
    </>
  );
}

// ── Battle screen ─────────────────────────────────────────────────
function BattleView({ match, view, playing, fx, onAct, onReplace, onRematch, onNew }: {
  match: Match; view: BattleState; playing: boolean; fx: Fx | null;
  onAct: (a: BattleAction) => void; onReplace: (i: number) => void;
  onRematch: () => void; onNew: () => void;
}) {
  const { info } = match;
  const state = view;
  const you = state.sides.A, foe = state.sides.B;
  const me = activeOf(you), them = activeOf(foe);
  const finished = !playing && match.state.winner;
  const mustReplace = !playing && match.state.needsReplacement.includes("A");

  const myAgil = currentAgility(me), theirAgil = currentAgility(them);

  return (
    <>
      {/* The arena */}
      <div className="arena">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
          <FighterCard side="A" f={me} foe={them} info={info.A[you.active]} fx={fx} slot={you.active} />
          <FighterCard side="B" f={them} foe={me} info={info.B[foe.active]} fx={fx} slot={foe.active} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10, alignItems: "start" }}>
          <Bench team={you.team} active={you.active} color={YOU} />
          <Bench team={foe.team} active={foe.active} color={FOE} />
        </div>
      </div>

      {finished ? (
        <div className="stone-panel" style={{ marginTop: 16, textAlign: "center" }}>
          <div className="pixel-font" style={{ fontSize: 30, color: match.state.winner === "A" ? "#5ee08a" : match.state.winner === "B" ? FOE : "white" }}>
            {match.state.winner === "A" ? "Victory!" : match.state.winner === "B" ? "Defeat" : "Draw"}
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
            {AI_LEVEL_LABELS[match.level]} AI · {match.state.round} rounds · you swapped {match.state.sides.A.swaps}×, the AI swapped {match.state.sides.B.swaps}× · saved to your battle history
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={onRematch} className="pixel-btn">Rematch</button>
            <button onClick={onNew} className="pixel-btn">New battle</button>
          </div>
        </div>
      ) : mustReplace ? (
        <ActionBox title={`${me.name} fainted — who goes in next?`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {you.team.map((f, i) => f.hp > 0 && (
              <button key={i} onClick={() => onReplace(i)} className="card-btn">
                <span>
                  <b style={{ color: rarityColor(info.A[i].rarity) }}>{f.name}</b>
                  <span style={{ color: MUTED, fontSize: 12 }}> · {f.hp}/{f.maxHp} HP · {Math.round(f.energy)}⚡ · {info.A[i].label}</span>
                  <span style={{ display: "block", fontSize: 12, color: MUTED }}>vs their {them.name}: {matchupHint(f, them)}</span>
                </span>
              </button>
            ))}
          </div>
        </ActionBox>
      ) : (
        <ActionBox title={playing ? "…" : `Round ${state.round + 1} — what will ${me.name} do?`} dim={playing}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
            {myAgil === theirAgil ? "Equal agility — a coin flip decides who strikes first."
              : myAgil > theirAgil ? `Your ${me.name} is faster (${Math.round(myAgil)} vs ${Math.round(theirAgil)} agility) and strikes first.`
              : `Their ${them.name} is faster (${Math.round(theirAgil)} vs ${Math.round(myAgil)} agility) and strikes first.`}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
            {me.skills.map((sk) => (
              <MoveButton key={sk.name} sk={sk} me={me} them={them} myAgil={myAgil} theirAgil={theirAgil}
                disabled={playing || sk.energyCost > me.energy} onClick={() => onAct({ kind: "attack", skillName: sk.name })} />
            ))}
          </div>
          {affordableSkills(me).length === 0 && (
            <button onClick={() => onAct({ kind: "pass" })} disabled={playing} className="card-btn" style={{ marginTop: 6 }}>Not enough energy — rest (+30⚡)</button>
          )}
          {swapTargets(you).length > 0 && (
            <>
              <div style={{ fontSize: 12, color: MUTED, margin: "12px 0 6px" }}>
                Swap — uses your turn: their {them.name} gets a free hit on the incoming creature, and your {me.name} recovers 50% of its missing energy.
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {swapTargets(you).map((i) => (
                  <button key={i} onClick={() => onAct({ kind: "swap", to: i })} disabled={playing} className="card-btn" style={{ width: "auto" }}>
                    ⇄ {you.team[i].name}
                    <span style={{ fontSize: 12, color: MUTED }}> · {you.team[i].hp}/{you.team[i].maxHp} HP · {matchupHint(you.team[i], them)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </ActionBox>
      )}

      <SectionTitle>Battle log</SectionTitle>
      <BattleLog log={match.state.log} />
    </>
  );
}

// Damage a move would do (a precise move's damage when it lands).
function moveDamage(s: Skill, a: Fighter, d: Fighter): number {
  return calcDamage(s, a, d, s.effect?.kind === "precise").damage;
}

// Rough read of a matchup, for swap / replacement choices: best hit each way.
function matchupHint(mine: Combatant, them: Combatant): string {
  const best = (a: Combatant, d: Combatant) => Math.max(...a.skills.map((s) => moveDamage(s, a, d)));
  return `hits for ~${best(mine, them)}, takes ~${best(them, mine)}`;
}

function MoveButton({ sk, me, them, myAgil, theirAgil, disabled, onClick }: {
  sk: Skill; me: Combatant; them: Combatant; myAgil: number; theirAgil: number; disabled: boolean; onClick: () => void;
}) {
  const fx = sk.effect;
  const dmg = moveDamage(sk, me, them);
  const tags: string[] = [];
  const run = me.streak?.move === sk.name ? me.streak.hits + 1 : 1; // this use's place in the run
  if (run > STREAK_START) tags.push(`run ×${run}: ${Math.round(streakEffects({ ...me.streak!, hits: run }).preciseChance * 100)}% precise`);
  else if (run > 2) tags.push(`run ×${run} (armour gap from ×${STREAK_START + 1})`);
  if (fx?.kind === "precise") tags.push(`${Math.round(fx.hitChance * 100)}% to hit · always precise`);
  if (fx?.kind === "cripple") tags.push(`${Math.round(fx.chance * 100)}% to cripple`);
  if (fx?.kind === "dash") {
    const flips = theirAgil >= myAgil && myAgil * (1 + fx.agilityBonus) > theirAgil;
    tags.push(`+${Math.round(fx.agilityBonus * 100)}% agility${flips ? " → strike first!" : ""}`);
  }
  return (
    <button disabled={disabled} onClick={onClick} className="card-btn" style={{ display: "block", opacity: sk.energyCost > me.energy ? 0.35 : 1 }}>
      <b style={{ color: fx ? "#ffd98a" : "white" }}>{sk.name}</b> <span style={{ fontSize: 11, color: MUTED }}>{sk.type}</span>
      <span style={{ display: "block", fontSize: 12, color: MUTED }}>~{dmg} dmg · {sk.energyCost}⚡</span>
      {tags.map((t) => <span key={t} style={{ display: "block", fontSize: 11, color: "#c9b48a" }}>{t}</span>)}
    </button>
  );
}

function FighterCard({ side, f, foe, info, fx, slot }: { side: SideKey; f: Combatant; foe: Combatant; info: MemberInfo; fx: Fx | null; slot: number }) {
  const color = side === "A" ? YOU : FOE;
  const hpPct = (f.hp / f.maxHp) * 100;
  const cripple = f.statuses.find((s) => s.id === "cripple");

  // Which animation this card plays for the current step.
  let anim = "";
  let float: { text: string; color: string } | null = null;
  if (fx) {
    if (fx.kind === "attack" && fx.side === side) anim = side === "A" ? "anim-lunge-right" : "anim-lunge-left";
    if (fx.kind === "attack" && fx.side !== side) {
      anim = fx.missed ? "anim-dodge" : "anim-hit";
      float = fx.missed ? { text: "MISS", color: "#bbb" }
        : { text: `-${fx.damage}${fx.gap ? " ARMOUR GAP!" : fx.precise ? " PRECISE!" : ""}${fx.crippled ? " CRIPPLED!" : ""}`, color: fx.gap ? "#ff9f43" : fx.precise ? "#ffd84a" : fx.crippled ? "#d7a6ff" : "#ff7a6b" };
    }
    if ((fx.kind === "swap" || fx.kind === "sendIn") && fx.side === side) anim = "anim-swapin";
    if (fx.kind === "faint" && fx.side === side) anim = "anim-faint";
  }

  return (
    <div style={{ position: "relative" }}>
      <div key={`${fx?.id ?? 0}-${slot}`} className={`fighter-card ${anim}`} style={{ borderColor: `${color}88`, opacity: f.hp <= 0 ? 0.4 : 1, filter: f.hp <= 0 ? "grayscale(1)" : undefined }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Token name={f.name} rarity={info.rarity} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{side === "A" ? "You" : "Opponent"}</div>
            <div className="pixel-font" style={{ fontSize: 17, color: rarityColor(info.rarity), lineHeight: 1.1 }}>{f.name}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{info.label}</div>
          </div>
        </div>
        <Bar label="HP" value={`${f.hp}/${f.maxHp}`} pct={hpPct} color={hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f5c542" : "#ef4444"} />
        <Bar label="Energy" value={`${Math.round(f.energy)}`} pct={f.energy} color="#4EA1FF" />
        {cripple && <div style={{ fontSize: 11, color: "#d7a6ff", marginTop: 6 }}>🐌 Crippled · {cripple.rounds} round{cripple.rounds === 1 ? "" : "s"} left</div>}
        <StreakBadges f={f} foe={foe} />
        <div style={{ fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>
          ⚔️ {info.weaponName ?? "no weapon"}<br />🛡️ {info.armorName ?? "no armour"}
        </div>
        <StatsLine stats={combatSummary(f)} />
      </div>
      {float && <div key={`f${fx!.id}`} className="float-text pixel-font" style={{ color: float.color }}>{float.text}</div>}
    </div>
  );
}

// The armour-gap run: shown on the attacker ("Focus") and on the creature
// whose armour is being worn down.
function StreakBadges({ f, foe }: { f: Combatant; foe: Combatant }) {
  const mine = f.streak && f.streak.hits >= 2 ? f.streak : null;
  const theirs = foe.streak && foe.streak.cracks > 0 ? foe.streak : null;
  return (
    <>
      {mine && (
        <div style={{ fontSize: 11, color: "#ffb86b", marginTop: 6 }}>
          🎯 {mine.move} ×{mine.hits}
          {mine.hits >= STREAK_START
            ? ` · next: ${Math.round(streakEffects({ ...mine, hits: mine.hits + 1 }).preciseChance * 100)}% precise`
            : ` · gap opens after ×${STREAK_START}`}
        </div>
      )}
      {theirs && (
        <div style={{ fontSize: 11, color: "#ff9f43", marginTop: 4 }}>
          🛡️ Armour cracked: next precise hit ignores {Math.round(streakEffects(theirs).ignore * 100)}% of defence
        </div>
      )}
    </>
  );
}

// Stand-in portrait until creatures have art: initials in a rarity frame.
function Token({ name, rarity }: { name: string; rarity: Rarity }) {
  const c = RARITY_COLORS[rarity];
  const initials = name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2);
  return (
    <span className="pixel-font" style={{
      width: 44, height: 44, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 18, color: c.text, background: "#15161c", border: `3px solid ${c.border}`, boxShadow: `0 0 12px ${c.glow}, inset 0 0 8px ${c.glow}`,
    }}>{initials}</span>
  );
}

function Bench({ team, active, color }: { team: Combatant[]; active: number; color: string }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {team.map((f, i) => (
        <span key={i} style={{
          fontSize: 11, padding: "3px 6px", background: "rgba(10,10,14,0.7)",
          border: i === active ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.12)",
          opacity: f.hp <= 0 ? 0.4 : 1, textDecoration: f.hp <= 0 ? "line-through" : "none",
        }}>
          {f.name} <span style={{ color: MUTED }}>{f.hp > 0 ? `${Math.round((f.hp / f.maxHp) * 100)}%` : "KO"}</span>
        </span>
      ))}
    </div>
  );
}

// ── Small pieces ──────────────────────────────────────────────────
function StatsLine({ stats }: { stats: ReturnType<typeof combatSummary> }) {
  const r = Math.round;
  return (
    <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
      HP {stats.hp} · Atk {r(stats.atk)} · Rng {r(stats.rng)} · Agi {r(stats.agil)} · MDef {r(stats.mdef)} · RDef {r(stats.rdef)}
    </span>
  );
}

function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 2 }}>
        <span>{label}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ height: 8, background: "#0d0e12", border: "1px solid #000" }}>
        <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: color, transition: "width 0.45s ease-out" }} />
      </div>
    </div>
  );
}

function ActionBox({ title, children, dim }: { title: string; children: React.ReactNode; dim?: boolean }) {
  return (
    <div className="stone-panel" style={{ marginTop: 16, opacity: dim ? 0.6 : 1, transition: "opacity 0.2s" }}>
      <div className="pixel-font" style={{ fontSize: 17, color: "#f1d9a0", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="pixel-font" style={{ fontSize: 15, color: "#c9b48a", margin: "20px 0 8px" }}>{children}</div>;
}

function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className="chip" data-active={value === v}>{label}</button>
      ))}
    </div>
  );
}
