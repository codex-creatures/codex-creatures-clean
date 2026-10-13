"use client";
// app/battle/page.tsx
// Play a 3v3 battle by hand against the AI, using your own creatures and the
// gear equipped on them. Reads your save but never changes it.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadSave } from "@/hooks/useGameState";
import { isCreatureDrop, isItemDrop, type CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { ITEM_META } from "@/lib/items/metadata";
import { ARMOR_META, type ArmorKey } from "@/lib/items/armor";
import type { ItemKey } from "@/lib/items/ceilings";
import { CREATURES_BY_RARITY, CREATURE_TEMPLATES, findCreatureTemplate, type CreatureTemplate } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { buildFighter, combatSummary } from "@/lib/combat/loadout";
import { effectiveAgil, type Fighter } from "@/lib/combat/engine";
import {
  createBattle, resolveRound, sendInReplacement, cloneBattle,
  activeOf, affordableSkills, swapTargets, previewDamage,
  type BattleAction, type BattleEvent, type BattleState, type Combatant, type SideKey,
} from "@/lib/combat/battle";
import { aiChooseAction, aiChooseReplacement } from "@/lib/combat/teamBattle";
import { rollGear, RARITIES } from "@/lib/balance/simulate";

const TEAM_SIZE = 3;
const MUTED = "rgba(255,255,255,0.45)";
const YOU = "#4EA1FF";
const FOE = "#ff6b6b";

// What the screen shows about each team member (gear names etc.).
type MemberInfo = { rarity: Rarity; label: string; weaponName?: string; armorName?: string };
type OwnedCreature = MemberInfo & {
  id: string; name: string; template: CreatureTemplate; roster: boolean;
  weaponRarity?: Rarity; armorRarity?: Rarity; fighter: Fighter;
};

type OppCreatures = "same" | "random";
type OppGear = "match" | "none" | Rarity;

type Match = {
  state: BattleState;
  info: Record<SideKey, MemberInfo[]>;
  teams: Record<SideKey, Fighter[]>; // for rematches
};

function rarityColor(r?: Rarity) {
  return r ? RARITY_COLORS[r].text : "white";
}

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
      label: creatureTypeLabel(t.proficiency),
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
  const [match, setMatch] = useState<Match | null>(null);

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
        fighter: buildFighter(t, w?.stats, a?.stats),
      });
    }
    list.sort((x, y) =>
      Number(y.roster) - Number(x.roster) ||
      RARITIES.indexOf(y.rarity) - RARITIES.indexOf(x.rarity) ||
      x.name.localeCompare(y.name)
    );
    setOwned(list);
    // Start with up to three roster creatures already picked.
    setPicked(list.filter((c) => c.roster).slice(0, TEAM_SIZE).map((c) => c.id));
  }, []);

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < TEAM_SIZE ? [...p, id] : p));
  }

  function startMatch(teams?: Match["teams"], info?: Match["info"]) {
    if (!teams || !info) {
      const mine = picked.map((id) => owned!.find((c) => c.id === id)!);
      const opp = buildOpponents(mine, oppCreatures, oppGear);
      teams = { A: mine.map((c) => c.fighter), B: opp.fighters };
      info = { A: mine, B: opp.info };
    }
    setMatch({ state: createBattle(teams.A, teams.B), info, teams });
  }

  // ── Turn handling ───────────────────────────────────────────────
  function act(action: BattleAction) {
    if (!match) return;
    const s = cloneBattle(match.state);
    resolveRound(s, { A: action, B: aiChooseAction(s, "B", { canSwap: true }) });
    if (s.needsReplacement.includes("B")) sendInReplacement(s, "B", aiChooseReplacement(s, "B"));
    setMatch({ ...match, state: s });
  }

  function replace(index: number) {
    if (!match) return;
    const s = cloneBattle(match.state);
    sendInReplacement(s, "A", index);
    setMatch({ ...match, state: s });
  }

  if (owned === null) return <Shell><p style={{ color: MUTED }}>Loading…</p></Shell>;

  if (!match) {
    return (
      <Shell>
        <Setup
          owned={owned} picked={picked} onToggle={togglePick}
          oppCreatures={oppCreatures} setOppCreatures={setOppCreatures}
          oppGear={oppGear} setOppGear={setOppGear}
          onStart={() => startMatch()}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <BattleView
        match={match}
        onAct={act}
        onReplace={replace}
        onRematch={() => startMatch(match.teams, match.info)}
        onNew={() => setMatch(null)}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ padding: "24px 16px", color: "white", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>⚔️ Battle</h1>
        <Link href="/" style={{ color: MUTED, fontSize: 14 }}>← Back to collection</Link>
      </div>
      {children}
    </main>
  );
}

// ── Setup screen ──────────────────────────────────────────────────
function Setup({
  owned, picked, onToggle, oppCreatures, setOppCreatures, oppGear, setOppGear, onStart,
}: {
  owned: OwnedCreature[]; picked: string[]; onToggle: (id: string) => void;
  oppCreatures: OppCreatures; setOppCreatures: (v: OppCreatures) => void;
  oppGear: OppGear; setOppGear: (v: OppGear) => void;
  onStart: () => void;
}) {
  if (owned.length < TEAM_SIZE) {
    return (
      <p style={{ color: MUTED, lineHeight: 1.5 }}>
        You need at least {TEAM_SIZE} creatures to battle — you have {owned.length}. Scan a few more on the{" "}
        <Link href="/" style={{ color: "white" }}>collection page</Link> first.
      </p>
    );
  }

  return (
    <>
      <SectionTitle>Your team — pick {TEAM_SIZE} ({picked.length}/{TEAM_SIZE})</SectionTitle>
      <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>
        Number 1 starts the battle. Gear is whatever each creature has equipped. ★ = in your roster.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {owned.map((c) => {
          const slot = picked.indexOf(c.id);
          const stats = combatSummary(c.fighter);
          return (
            <button
              key={c.id}
              onClick={() => onToggle(c.id)}
              style={{
                textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer", color: "white",
                border: slot >= 0 ? `1px solid ${YOU}` : "1px solid rgba(255,255,255,0.1)",
                background: slot >= 0 ? "rgba(78,161,255,0.1)" : "rgba(255,255,255,0.02)",
                display: "flex", gap: 12, alignItems: "center",
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: slot >= 0 ? YOU : "rgba(255,255,255,0.08)", color: slot >= 0 ? "black" : MUTED }}>
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
                <StatsLine stats={stats} />
              </span>
            </button>
          );
        })}
      </div>

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
        rarity of the item in each of your slots (empty slot → no item).
      </p>

      <button
        onClick={onStart}
        disabled={picked.length !== TEAM_SIZE}
        style={{ marginTop: 22, width: "100%", padding: "13px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 16, cursor: picked.length === TEAM_SIZE ? "pointer" : "not-allowed", background: picked.length === TEAM_SIZE ? "white" : "rgba(255,255,255,0.1)", color: picked.length === TEAM_SIZE ? "black" : "rgba(255,255,255,0.3)" }}
      >
        Start battle
      </button>
    </>
  );
}

// ── Battle screen ─────────────────────────────────────────────────
function BattleView({ match, onAct, onReplace, onRematch, onNew }: {
  match: Match; onAct: (a: BattleAction) => void; onReplace: (i: number) => void;
  onRematch: () => void; onNew: () => void;
}) {
  const { state, info } = match;
  const you = state.sides.A, foe = state.sides.B;
  const me = activeOf(you), them = activeOf(foe);
  const mustReplace = state.needsReplacement.includes("A");
  const iGoFirst = effectiveAgil(me) >= effectiveAgil(them);
  const agilTie = effectiveAgil(me) === effectiveAgil(them);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <ActivePanel side="A" f={me} info={info.A[you.active]} />
        <ActivePanel side="B" f={them} info={info.B[foe.active]} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 8 }}>
        <Bench team={you.team} active={you.active} info={info.A} color={YOU} />
        <Bench team={foe.team} active={foe.active} info={info.B} color={FOE} />
      </div>

      {state.winner ? (
        <div style={{ marginTop: 18, padding: 16, borderRadius: 12, textAlign: "center", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: state.winner === "A" ? "#22c55e" : state.winner === "B" ? FOE : "white" }}>
            {state.winner === "A" ? "Victory!" : state.winner === "B" ? "Defeat" : "Draw"}
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{state.round} rounds · you swapped {you.swaps}×, the AI swapped {foe.swaps}×</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={onRematch} style={btn}>Rematch (same teams & gear)</button>
            <button onClick={onNew} style={btn}>New battle</button>
          </div>
        </div>
      ) : mustReplace ? (
        <ActionBox title={`${me.name} fainted — choose who goes in next`}>
          {you.team.map((f, i) => f.hp > 0 && (
            <button key={i} onClick={() => onReplace(i)} style={actionBtn}>
              <b>{f.name}</b>
              <span style={{ color: MUTED, fontSize: 12 }}> · {f.hp}/{f.maxHp} HP · {Math.round(f.energy)}⚡ · {info.A[i].label}</span>
            </button>
          ))}
        </ActionBox>
      ) : (
        <ActionBox title={`Round ${state.round + 1} — what will ${me.name} do?`}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
            {agilTie ? "Equal agility — a coin flip decides who strikes first." : iGoFirst ? `Your ${me.name} is faster and strikes first.` : `Their ${them.name} is faster and strikes first.`}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
            {me.skills.map((sk) => {
              const ok = sk.energyCost <= me.energy;
              return (
                <button key={sk.name} disabled={!ok} onClick={() => onAct({ kind: "attack", skillName: sk.name })}
                  style={{ ...actionBtn, opacity: ok ? 1 : 0.35, cursor: ok ? "pointer" : "not-allowed" }}>
                  <b>{sk.name}</b> <span style={{ fontSize: 11, color: MUTED }}>{sk.type}</span>
                  <span style={{ display: "block", fontSize: 12, color: MUTED }}>
                    ~{previewDamage(state, "A", sk)} dmg · {sk.energyCost}⚡
                  </span>
                </button>
              );
            })}
          </div>
          {affordableSkills(me).length === 0 && (
            <button onClick={() => onAct({ kind: "pass" })} style={{ ...actionBtn, marginTop: 6 }}>Not enough energy — pass</button>
          )}
          {swapTargets(you).length > 0 && (
            <>
              <div style={{ fontSize: 12, color: MUTED, margin: "12px 0 6px" }}>
                Swap (uses your turn — their {them.name} gets a free hit on the incoming creature; your {me.name} recovers 50% of its missing energy)
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {swapTargets(you).map((i) => (
                  <button key={i} onClick={() => onAct({ kind: "swap", to: i })} style={actionBtn}>
                    ⇄ {you.team[i].name}
                    <span style={{ fontSize: 12, color: MUTED }}> · {you.team[i].hp}/{you.team[i].maxHp} HP</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </ActionBox>
      )}

      <SectionTitle>Battle log</SectionTitle>
      <BattleLog log={state.log} />
    </>
  );
}

function ActivePanel({ side, f, info }: { side: SideKey; f: Combatant; info: MemberInfo }) {
  const color = side === "A" ? YOU : FOE;
  const hpPct = (f.hp / f.maxHp) * 100;
  return (
    <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${color}55`, background: "rgba(255,255,255,0.03)" }}>
      <div style={{ fontSize: 11, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{side === "A" ? "You" : "Opponent"}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: rarityColor(info.rarity), marginTop: 2 }}>{f.name}</div>
      <div style={{ fontSize: 12, color: MUTED }}>{info.rarity} · {info.label}</div>
      <Bar label="HP" value={`${f.hp}/${f.maxHp}`} pct={hpPct} color={hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#f5c542" : "#ef4444"} />
      <Bar label="Energy" value={`${Math.round(f.energy)}/100`} pct={f.energy} color="#4EA1FF" />
      <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
        ⚔️ {info.weaponName ?? "no weapon"}<br />🛡️ {info.armorName ?? "no armour"}
      </div>
      <StatsLine stats={combatSummary(f)} />
    </div>
  );
}

function Bench({ team, active, info, color }: { team: Combatant[]; active: number; info: MemberInfo[]; color: string }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {team.map((f, i) => (
        <span key={i} title={info[i].label} style={{
          fontSize: 12, padding: "4px 8px", borderRadius: 8,
          border: i === active ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.1)",
          opacity: f.hp <= 0 ? 0.35 : 1, textDecoration: f.hp <= 0 ? "line-through" : "none",
        }}>
          {f.name} <span style={{ color: MUTED }}>{f.hp > 0 ? `${Math.round((f.hp / f.maxHp) * 100)}%` : "KO"}</span>
        </span>
      ))}
    </div>
  );
}

function BattleLog({ log }: { log: BattleEvent[] }) {
  // Group by round, newest first.
  const rounds = useMemo(() => {
    const out: { round: number; events: BattleEvent[] }[] = [];
    for (const e of log) {
      if (e.type === "round") out.push({ round: e.round, events: [] });
      else if (out.length > 0) out[out.length - 1].events.push(e);
    }
    return out.reverse();
  }, [log]);

  if (rounds.length === 0) return <p style={{ fontSize: 13, color: MUTED }}>Nothing yet — pick your first move.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
      {rounds.map(({ round, events }) => (
        <div key={round} style={{ fontSize: 13, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>ROUND {round}</div>
          {events.map((e, i) => <LogLine key={i} e={e} />)}
        </div>
      ))}
    </div>
  );
}

// "Your X" / "Their X" — both teams can field the same creature.
function Who({ side, name, plain }: { side: SideKey; name: string; plain?: boolean }) {
  return <>{plain ? "" : side === "A" ? "Your " : "Their "}<b style={{ color: side === "A" ? YOU : FOE }}>{name}</b></>;
}

function LogLine({ e }: { e: BattleEvent }) {
  switch (e.type) {
    case "swap":
      return <div>⇄ <Who side={e.side} name={e.from} /> swaps out for <Who side={e.side} name={e.to} plain /> <span style={{ color: MUTED }}>(+{e.energyRestored}⚡)</span></div>;
    case "attack":
      return (
        <div>
          <Who side={e.side} name={e.attacker} /> uses {e.skill.name} → <b>{e.damage}</b> dmg
          {e.precise && <span style={{ color: "#f5c542" }}> · precise hit!</span>}
          <span style={{ color: MUTED }}> ({e.side === "A" ? "their" : "your"} {e.target}: {e.targetHpAfter} HP left)</span>
        </div>
      );
    case "pass":
      return <div><Who side={e.side} name={e.name} /> is out of energy and passes.</div>;
    case "faint":
      return <div>💀 <Who side={e.side} name={e.name} /> fainted!</div>;
    case "sendIn":
      return <div>→ <Who side={e.side} name={e.name} /> is sent in.</div>;
    case "end":
      return <div style={{ fontWeight: 700 }}>{e.winner === "A" ? "You win!" : e.winner === "B" ? "The opponent wins." : "Draw (round limit)."}</div>;
    default:
      return null;
  }
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
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED, marginBottom: 3 }}>
        <span>{label}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: 999, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function ActionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18, padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", margin: "20px 0 8px" }}>{children}</div>;
}

function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: "6px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer", textTransform: "capitalize",
          border: value === v ? "1px solid white" : "1px solid rgba(255,255,255,0.2)",
          background: value === v ? "rgba(255,255,255,0.15)" : "transparent", color: "white", fontWeight: value === v ? 700 : 400,
        }}>{label}</button>
      ))}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent", color: "white", cursor: "pointer", fontWeight: 600,
};

const actionBtn: React.CSSProperties = {
  textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.04)", color: "white", cursor: "pointer", fontSize: 14,
};
