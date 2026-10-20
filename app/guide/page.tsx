"use client";
// app/guide/page.tsx
// The Bestiary & Rules scroll (the lectern in the Den): every combat rule,
// creature, move and piece of gear, drawn straight from the game's data so it
// is always up to date. Creatures you haven't come across yet are black
// silhouettes ("???"); you fill the Bestiary in by exploring.

import { useMemo, useState } from "react";
import DenFrame from "@/components/DenFrame";
import { useGameState } from "@/hooks/useGameState";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";
import RaceTag from "@/components/RaceTag";
import ClassBadge, { moveKind } from "@/components/ClassBadge";
import { CreatureFilterBar, CreatureMarks, NO_FILTER, matchesFilter, type CreatureFilter } from "@/components/CreatureMarks";
import {
  ALL_SKILLS, BASIC_CODEX_MAX_DAMAGE, BOSS_MOVES, CLASS_INFO, COMBAT_CLASSES, CREATURE_TEMPLATES, DAMAGE_TYPE_INFO, LEARNABLE_MOVES, RACES, RACE_INFO, RACE_MOVES,
  raceMovesFor, type CombatClass, type CreatureProficiency, type CreatureTemplate, type DamageType, type Skill,
} from "@/lib/creatures/creatureData";
import {
  AFFINITY_BONUS, ARCANE_CAP, ARCANE_REF_POWER, BEATS, DAMAGE_TYPES, DAMAGE_VARIANCE, ENERGY_REGEN, MAX_ENERGY, NEUTRAL_COUNTER, PRECISE_CHANCE, PRECISE_IGNORE,
  TRIANGLE, calcDamage, type CombatItem, type Fighter,
} from "@/lib/combat/engine";
import { CRIPPLE, CRIPPLE_AGILITY_LOSS, CRIPPLE_ROUNDS, STREAK_PRECISE_STEP, STREAK_START, SWAP_ENERGY_RESTORE } from "@/lib/combat/battle";
import { ABILITIES, ABILITY_CHANCE, abilitiesFor } from "@/lib/creatures/abilities";
import { RARE_MOVE_CHANCE, ROLL_SPREAD_SHARE, ROLL_SPREAD_MIN } from "@/lib/creatures/creatureRoll";
import { ITEM_CEILINGS, ITEM_KEYS, STAT_KEYS, WEAPON_AFFINITY, type ItemKey } from "@/lib/items/ceilings";
import { ITEM_META } from "@/lib/items/metadata";
import { PRIMARY_STATS_BY_ITEMKEY } from "@/lib/items/itemPrimaries";
import { ARMOR_CEILINGS, ARMOR_KEYS, ARMOR_META, ARMOR_STAT_KEYS, SET_BONUS } from "@/lib/items/armor";
import { RARITY_BUDGETS, type Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { WEAPON_SPRITES, ARMOR_SPRITES } from "@/lib/sprites/items";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";
const PANEL: React.CSSProperties = { background: "#14151c", border: "2px solid #2a2d38", padding: 12, marginTop: 10 };
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)}%`;

type Tab = "combat" | "creatures" | "moves" | "gear" | "races";
const TABS: [Tab, string][] = [["combat", "⚔️ How fights work"], ["creatures", "🐾 Creatures"], ["moves", "📜 Moves"], ["gear", "🛡️ Gear"], ["races", "🗺️ Races × classes"]];

export default function GuidePage() {
  const [tab, setTab] = useState<Tab>("combat");
  const game = useGameState();
  const seen = game.seenIds;
  return (
    <DenFrame title="Bestiary & Rules" icon="📜">
      <p style={{ color: MUTED, fontSize: 13, margin: "0 0 10px" }}>
        Everything here is read straight from the game&apos;s own numbers, so it&apos;s always current.
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TABS.map(([k, label]) => <button key={k} className="chip" data-active={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === "combat" && <Combat />}
      {tab === "creatures" && <Creatures seen={seen} />}
      {tab === "moves" && <Moves seen={seen} />}
      {tab === "gear" && <Gear />}
      {tab === "races" && <Races seen={seen} />}
    </DenFrame>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="pixel-font" style={{ color: GOLD, fontSize: 16, margin: "18px 0 4px", fontWeight: 600 }}>{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, lineHeight: 1.5, margin: "4px 0", color: "rgba(255,255,255,0.85)" }}>{children}</p>;
}

// ── How fights work ───────────────────────────────────────────────
function Combat() {
  return (
    <div>
      <H>The triangle</H>
      <P>Every creature has a <b>class</b> and every attack has a <b>style</b>. A move&apos;s style against the target&apos;s class:
        strong does <b>{signed(TRIANGLE.strong - 1)}</b> damage, weak does <b>{signed(TRIANGLE.weak - 1)}</b>. Same class: normal damage.
        Klutz is <b>Balanced</b>, outside the triangle: nothing counters him, and his moves do <b>{signed(NEUTRAL_COUNTER - 1)}</b> against a class they counter.</P>
      <TriangleDiagram />
      <P>Mix your team: a team that is countered three times over loses badly. Swap out of a bad matchup — swapping uses your turn, the
        opponent gets a free hit on the creature coming in, and the one going out recovers {pct(SWAP_ENERGY_RESTORE)} of its missing energy.</P>

      <H>Damage</H>
      <P>A hit is <b>move power + your attack</b> for that style (your weapon&apos;s stat boosted by the creature&apos;s %). Armour then cuts it as a ratio:</P>
      <div className="pixel-font" style={{ ...PANEL, textAlign: "center", fontSize: 15, color: GOLD }}>damage = hit × hit ÷ (hit + defence)</div>
      <P>So defence always matters but never stops a hit dead: a hit as big as the armour does half. Then the damage type, weapon affinity and
        the triangle multiply it. Every hit rolls ±{pct(DAMAGE_VARIANCE)}.</P>

      <H>Damage types</H>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
        {(Object.keys(DAMAGE_TYPES) as DamageType[]).map((k) => {
          const d = DAMAGE_TYPES[k], info = DAMAGE_TYPE_INFO[k];
          return (
            <div key={k} style={{ ...PANEL, marginTop: 0, borderTop: `3px solid ${info.color}` }}>
              <div className="pixel-font" style={{ color: info.color, fontSize: 16 }}>{info.icon} {info.name}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Damage {signed(d.mult - 1)}</div>
              <div style={{ fontSize: 13 }}>Ignores {pct(d.pen)} of armour</div>
              {d.maxHp > 0 && <div style={{ fontSize: 13 }}>+ {pct(d.maxHp)} of the target&apos;s max HP per {ARCANE_REF_POWER} power (max {ARCANE_CAP} a hit)</div>}
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                {k === "force" ? "Best against light armour." : k === "pierce" ? "Best against heavy armour." : "Best against big HP pools."}
              </div>
            </div>
          );
        })}
      </div>
      <P>Each weapon is strong in one damage type: moves of that type do <b>{signed(AFFINITY_BONUS)}</b> with it. A warhammer (Force) can still use
        a Pierce move — it just doesn&apos;t get the bonus.</P>

      <H>Try it</H>
      <Calculator />

      <H>Turn order, energy and the rest</H>
      <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 18, margin: "4px 0" }}>
        <li><b>Agility</b> only decides who strikes first each round — higher goes first.</li>
        <li><b>Energy</b>: everyone starts on {MAX_ENERGY}. Moves cost energy; you get {ENERGY_REGEN} back after each attack. With nothing affordable, a creature rests.</li>
        <li><b>Precise hits</b>: {pct(PRECISE_CHANCE)} of hits are precise and ignore {pct(PRECISE_IGNORE)} of the defence (on top of the damage type).</li>
        <li><b>Armour gap</b>: from the {STREAK_START + 1}th use of the same move on the same target in a row, each use adds {pct(STREAK_PRECISE_STEP)} precise chance, and precise hits in that run crack through more armour. It resets when either side swaps or you change move.</li>
        <li><b>Cripple</b>: for {CRIPPLE_ROUNDS} rounds, −{pct(CRIPPLE_AGILITY_LOSS)} agility and a {pct(CRIPPLE.stumble)} chance to stumble and lose each attack (no energy spent). <b>Haste</b>: double agility this round only, to strike first.</li>
        <li><b>Stances</b>: floating takes +10% from ranged, −10% from melee; entrenched the other way round.</li>
      </ul>

      <H>Creature rolls</H>
      <P>Every creature is an individual: its %s are rolled around its species&apos; — each within ±{pct(ROLL_SPREAD_SHARE)} of the species&apos; total %s (at least ±{ROLL_SPREAD_MIN}), so rarer creatures, with more to work with, vary more — each move slot has a {pct(RARE_MOVE_CHANCE)} chance to
        be a rare learnable move of its class, and Epic ({pct(ABILITY_CHANCE.epic ?? 0)}) and Legendary ({pct(ABILITY_CHANCE.legendary ?? 0)}) creatures can be born with an ability.</P>
    </div>
  );
}

function TriangleDiagram() {
  // Three nodes on a triangle; arrows point from each class to the one it beats.
  const pos: Record<CombatClass, [number, number]> = { melee: [150, 30], ranged: [262, 200], magic: [38, 200] };
  return (
    <svg viewBox="0 0 300 240" style={{ width: "100%", maxWidth: 360, display: "block", margin: "8px auto" }} role="img" aria-label="Melee beats ranged, ranged beats magic, magic beats melee">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={GOLD} />
        </marker>
      </defs>
      {COMBAT_CLASSES.map((c) => {
        const [x1, y1] = pos[c], [x2, y2] = pos[BEATS[c]];
        const k = 34 / Math.hypot(x2 - x1, y2 - y1);
        const ax = x1 + (x2 - x1) * k, ay = y1 + (y2 - y1) * k, bx = x2 - (x2 - x1) * k, by = y2 - (y2 - y1) * k;
        return <g key={c}>
          <line x1={ax} y1={ay} x2={bx} y2={by} stroke={GOLD} strokeWidth={2.5} markerEnd="url(#arrow)" />
          <text x={(x1 + x2) / 2 + (c === "ranged" ? 0 : c === "melee" ? 18 : -18)} y={(y1 + y2) / 2 + (c === "ranged" ? 18 : 0)} fill={GOLD} fontSize={12} textAnchor="middle">beats</text>
        </g>;
      })}
      {COMBAT_CLASSES.map((c) => (
        <g key={c}>
          <circle cx={pos[c][0]} cy={pos[c][1]} r={28} fill="#14151c" stroke={CLASS_INFO[c].color} strokeWidth={3} />
          <text x={pos[c][0]} y={pos[c][1] + 2} fontSize={20} textAnchor="middle">{CLASS_INFO[c].icon}</text>
          <text x={pos[c][0]} y={pos[c][1] + 20} fontSize={9} fill={CLASS_INFO[c].color} textAnchor="middle">{CLASS_INFO[c].name.toUpperCase()}</text>
        </g>
      ))}
    </svg>
  );
}

const ZERO: CombatItem = { atk: 0, rng: 0, mag: 0, agil: 0, mdef: 0, rdef: 0, magdef: 0, hp: 0 };
const NO_PROF: CreatureProficiency = { atk: 0, rng: 0, mag: 0, agil: 0, mdef: 0, rdef: 0, magdef: 0 };
const dummy = (cls: CombatClass, maxHp: number, weapon: Partial<CombatItem>, armor: Partial<CombatItem>): Fighter => ({
  name: "x", hp: maxHp, maxHp, energy: 100, proficiency: NO_PROF, cls, skills: [],
  weapon: { ...ZERO, ...weapon }, armor: { ...ZERO, ...armor }, stance: "neutral", elemental: null,
});

function Calculator() {
  const [power, setPower] = useState(25);
  const [attack, setAttack] = useState(40);
  const [defence, setDefence] = useState(30);
  const [hp, setHp] = useState(150);
  const [type, setType] = useState<DamageType>("force");
  const [affinity, setAffinity] = useState(false);
  const [rel, setRel] = useState<"strong" | "even" | "weak">("even");
  const target: CombatClass = rel === "strong" ? "ranged" : rel === "weak" ? "magic" : "melee";
  const skill: Skill = { name: "Test", damage: power, energyCost: 0, type: "melee", dmgType: type };
  const a = dummy("melee", 100, { atk: attack, ...(affinity ? { affinity: type } : {}) }, {});
  const d = dummy(target, hp, {}, { mdef: defence });
  const dmg = calcDamage(skill, a, d, false).damage;
  const slider = (label: string, v: number, set: (n: number) => void, max: number) => (
    <label style={{ display: "block", fontSize: 13, marginTop: 6 }}>
      {label}: <b>{v}</b>
      <input type="range" min={0} max={max} value={v} onChange={(e) => set(+e.target.value)} style={{ width: "100%", display: "block" }} />
    </label>
  );
  return (
    <div style={PANEL}>
      {slider("Move power", power, setPower, 45)}
      {slider("Your attack (gear × %)", attack, setAttack, 200)}
      {slider("Their defence for that style", defence, setDefence, 200)}
      {slider("Their max HP", hp, setHp, 400)}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {(Object.keys(DAMAGE_TYPES) as DamageType[]).map((k) => (
          <button key={k} className="chip" data-active={type === k} onClick={() => setType(k)} style={{ color: DAMAGE_TYPE_INFO[k].color }}>
            {DAMAGE_TYPE_INFO[k].icon} {DAMAGE_TYPE_INFO[k].name}
          </button>
        ))}
        <button className="chip" data-active={affinity} onClick={() => setAffinity(!affinity)}>Weapon affinity {affinity ? "on" : "off"}</button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        {(["strong", "even", "weak"] as const).map((k) => (
          <button key={k} className="chip" data-active={rel === k} onClick={() => setRel(k)}>
            {k === "strong" ? `▲ Strong matchup (${signed(TRIANGLE.strong - 1)})` : k === "weak" ? `▼ Weak matchup (${signed(TRIANGLE.weak - 1)})` : "Same class"}
          </button>
        ))}
      </div>
      <div className="pixel-font" style={{ marginTop: 12, fontSize: 22, color: GOLD }}>{dmg} damage</div>
      <div style={{ fontSize: 13, color: MUTED }}>
        {Math.ceil(hp / dmg)} hits to knock out
      </div>
    </div>
  );
}

// ── Creatures ─────────────────────────────────────────────────────
const PROF_LABELS: [keyof CreatureProficiency, string][] = [["atk", "⚔️ Melee"], ["rng", "🏹 Ranged"], ["mag", "🔮 Magic"], ["agil", "💨 Agility"], ["mdef", "🛡️ M.Def"], ["rdef", "🔰 R.Def"], ["magdef", "🧿 Mg.Def"]];
const byRarity = (a: CreatureTemplate, b: CreatureTemplate) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || a.name.localeCompare(b.name);

function Creatures({ seen }: { seen: Set<string> }) {
  const [filter, setFilter] = useState<CreatureFilter>(NO_FILTER);
  const known = (t: CreatureTemplate) => seen.has(t.id);
  // You only know a creature's race and class once you've seen it.
  const filtering = filter.race !== "all" || filter.cls !== "all";
  const shown = CREATURE_TEMPLATES.filter((t) => (filtering ? known(t) && matchesFilter(filter, t.race, t.cls) : true));
  const unseen = shown.filter((t) => !known(t)).sort(byRarity);
  const groups: [string, string, string, CreatureTemplate[]][] =
    filter.groupBy === "class" ? [...COMBAT_CLASSES.map((c): [string, string, string, CreatureTemplate[]] => [c, `${CLASS_INFO[c].icon} ${CLASS_INFO[c].name}`, CLASS_INFO[c].color, shown.filter((t) => known(t) && t.cls === c).sort(byRarity)]), ["unseen", "❔ Not seen yet", MUTED, unseen]]
    : filter.groupBy === "race" ? [...RACES.map((r): [string, string, string, CreatureTemplate[]] => [r, `${RACE_INFO[r].icon} ${RACE_INFO[r].name}`, RACE_INFO[r].color, shown.filter((t) => known(t) && t.race === r).sort(byRarity)]), ["unseen", "❔ Not seen yet", MUTED, unseen]]
    : [...RARITIES].reverse().map((r) => [r, r, RARITY_COLORS[r].text, shown.filter((t) => t.rarity === r).sort(byRarity)]);
  const count = CREATURE_TEMPLATES.filter(known).length;
  return (
    <div>
      <P>You&apos;ve come across <b>{count} of {CREATURE_TEMPLATES.length}</b> creatures. The rest are shadows until you see one — scan barcodes,
        explore the Labyrinth, or send Klutz hunting.</P>
      <CreatureFilterBar value={filter} onChange={setFilter}
        raceCount={(r) => CREATURE_TEMPLATES.filter((t) => known(t) && t.race === r && (filter.cls === "all" || t.cls === filter.cls)).length}
        classCount={(c) => CREATURE_TEMPLATES.filter((t) => known(t) && t.cls === c && (filter.race === "all" || t.race === filter.race)).length} />
      {groups.map(([key, title, color, list]) => list.length > 0 && (
        <section key={key}>
          <H><span style={{ color, textTransform: "capitalize" }}>{title}</span> <span style={{ color: MUTED, fontSize: 13 }}>· {list.length}</span></H>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
            {list.map((t) => (known(t) ? <CreatureCard key={t.id} t={t} /> : <UnseenCard key={t.id} t={t} />))}
          </div>
        </section>
      ))}
    </div>
  );
}

// A creature you haven't come across: a black shape and its rarity, nothing more.
function UnseenCard({ t }: { t: CreatureTemplate }) {
  const rc = RARITY_COLORS[t.rarity];
  return (
    <div style={{ ...PANEL, marginTop: 0, borderColor: rc.border, opacity: 0.85 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06), #101117 75%)", padding: 4 }}>
          <PixelSprite sprite={creatureSprite(t.id)} scale={2} style={{ filter: "brightness(0) drop-shadow(0 0 1px rgba(255,255,255,0.35))" }} />
        </div>
        <div>
          <div className="pixel-font" style={{ color: MUTED, fontSize: 18 }}>???</div>
          <div style={{ fontSize: 12, color: rc.text, textTransform: "capitalize", marginTop: 2 }}>{t.rarity}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Not seen yet.</div>
        </div>
      </div>
    </div>
  );
}

function CreatureCard({ t }: { t: CreatureTemplate }) {
  const rc = RARITY_COLORS[t.rarity];
  const abilities = abilitiesFor(t.id);
  return (
    <div style={{ ...PANEL, marginTop: 0, borderColor: rc.border }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ background: `radial-gradient(circle, ${rc.glow}, #101117 75%)`, padding: 4 }}>
          <PixelSprite sprite={creatureSprite(t.id)} scale={2} title={t.name} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="pixel-font" style={{ color: rc.text, fontSize: 16, lineHeight: 1.1 }}>{t.name}</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
            <RaceTag race={t.race} /><ClassBadge cls={t.cls} />
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 3, textTransform: "capitalize" }}>{t.rarity} · {t.baseHp} base HP</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, marginTop: 8 }}>
        {PROF_LABELS.map(([k, label]) => (
          <div key={k} style={{ background: "#0e0f14", padding: "3px 2px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap", overflow: "hidden" }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.proficiency[k] > 0 ? "white" : MUTED }}>+{t.proficiency[k]}%</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Move pool</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
        {t.skills.map((m) => <MoveChip key={m.name} m={m} />)}
      </div>
      {raceMovesFor(t).length > 0 && (
        <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>Codex: {raceMovesFor(t).map((m) => <MoveChip key={m.name} m={m} />)}</div>
      )}
      {abilities.length > 0 && (
        <div style={{ fontSize: 12, color: "#ffd98a", marginTop: 6 }}>Can be born with: {abilities.map((a) => ABILITIES[a].name).join(", ")}</div>
      )}
    </div>
  );
}

function MoveChip({ m }: { m: Skill }) {
  return (
    <span title={`${m.name}: ${m.self ? "utility" : moveKind(m)} · ${m.damage} power · ${m.energyCost} energy${m.desc ? ` — ${m.desc}` : ""}`}
      style={{ display: "inline-block", fontSize: 11, padding: "2px 6px", margin: "0 3px 3px 0", background: "#1b1d25", border: `1px solid ${CLASS_INFO[m.type].color}66` }}>
      {CLASS_INFO[m.type].icon}{m.self ? "" : DAMAGE_TYPE_INFO[m.dmgType].icon} {m.name} <span style={{ color: MUTED }}>{m.self ? "utility" : m.damage}</span>
    </span>
  );
}

// ── Moves ─────────────────────────────────────────────────────────
function Moves({ seen }: { seen: Set<string> }) {
  const knownBy = useMemo(() => {
    const map = new Map<string, CreatureTemplate[]>();
    for (const t of CREATURE_TEMPLATES) for (const m of t.skills) map.set(m.name, [...(map.get(m.name) ?? []), t]);
    return map;
  }, []);
  const row = (m: Skill, who: React.ReactNode) => (
    <div key={m.name} style={{ ...PANEL, marginTop: 6, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <b style={{ color: m.effect ? "#ffd98a" : "white" }}>{m.name}</b>
        <span style={{ fontSize: 12, color: MUTED }}>{m.self ? "utility" : `${moveKind(m)} · ${m.damage} power`} · {m.energyCost}⚡</span>
      </div>
      {m.desc && <div style={{ fontSize: 12, color: "#c9b48a", marginTop: 2 }}>{m.desc}</div>}
      <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{who}</div>
    </div>
  );
  return (
    <div>
      <P>Each creature has its own move pool and takes 4 into battle. Learnable moves can go in any slot; race moves come from codexes.</P>
      {COMBAT_CLASSES.map((c) => (
        <section key={c}>
          <H><span style={{ color: CLASS_INFO[c].color }}>{CLASS_INFO[c].icon} {CLASS_INFO[c].name} moves</span></H>
          {ALL_SKILLS.filter((m) => m.type === c).map((m) => {
            const who = knownBy.get(m.name) ?? [];
            const met = who.filter((t) => seen.has(t.id)), hidden = who.length - met.length;
            return row(m, who.length === 0 ? "No creature knows this yet."
              : <>Known by {met.map((t) => <CreatureName key={t.id} t={t} />)}{hidden > 0 && <span>{met.length ? "and " : ""}{hidden} creature{hidden === 1 ? "" : "s"} you haven&apos;t seen</span>}</>);
          })}
        </section>
      ))}
      <H>Learnable moves</H>
      <P>Any creature can put these in a slot. Each slot also has a {pct(RARE_MOVE_CHANCE)} chance to be born with one of its own class.</P>
      {LEARNABLE_MOVES.map((m) => row(m, `${CLASS_INFO[m.type].icon} Rolls on ${CLASS_INFO[m.type].name} creatures`))}
      <H>Move codexes</H>
      <P>Every {CLASS_INFO.melee.name}, {CLASS_INFO.ranged.name} and {CLASS_INFO.magic.name} move above also comes as a codex, from scans: Common for up to {BASIC_CODEX_MAX_DAMAGE} damage, Rare above that. It teaches a creature of that move&apos;s class (Klutz can learn any).</P>
      <H>Race moves (codexes)</H>
      {RACE_MOVES.map((m) => row(m, <>Only {m.race && <RaceTag race={m.race} />} creatures can learn it, from a codex.</>))}
      <H>Boss moves</H>
      {BOSS_MOVES.map((m) => row(m, "The Cyclops only."))}
    </div>
  );
}

function CreatureName({ t }: { t: CreatureTemplate }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginRight: 8, color: RARITY_COLORS[t.rarity].text, whiteSpace: "nowrap" }}>
      <CreatureMarks race={t.race} cls={t.cls} size={9} /> {t.name}
    </span>
  );
}

// ── Gear ──────────────────────────────────────────────────────────
function Bars({ ceil, keys, labels }: { ceil: Record<string, number>; keys: readonly string[]; labels: Record<string, string> }) {
  const max = Math.max(...keys.map((k) => ceil[k]));
  return (
    <div style={{ marginTop: 6 }}>
      {keys.map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span style={{ width: 66, color: MUTED }}>{labels[k]}</span>
          <span style={{ flex: 1, height: 7, background: "#0e0f14" }}>
            <span style={{ display: "block", height: "100%", width: `${(ceil[k] / max) * 100}%`, background: ceil[k] === max ? GOLD : "#6b7280" }} />
          </span>
          <span style={{ width: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ceil[k]}</span>
        </div>
      ))}
    </div>
  );
}
const WEAPON_LABELS: Record<string, string> = { melee: "⚔️ Melee", ranged: "🏹 Ranged", magic: "🔮 Magic", agility: "💨 Agility", hp: "❤️ HP" };
const ARMOR_LABELS: Record<string, string> = { mDef: "🛡️ M.Def", rDef: "🔰 R.Def", magDef: "🧿 Mg.Def", agility: "💨 Agility", hp: "❤️ HP" };

function weaponGroup(k: ItemKey): string {
  const p = PRIMARY_STATS_BY_ITEMKEY[k];
  if (p[0] === "hp") return "Shields";
  return p[0] === "melee" ? "Melee weapons" : p[0] === "ranged" ? "Ranged weapons" : "Magic weapons";
}

function Gear() {
  const groups = ["Melee weapons", "Ranged weapons", "Magic weapons", "Shields"];
  return (
    <div>
      <P>Every item rolls its rarity&apos;s budget of stat points ({RARITIES.map((r) => `${r} ${RARITY_BUDGETS[r]}`).join(", ")}) across its stats,
        up to each stat&apos;s cap. The bars show the Legendary caps — the gold bar is what the item leans to.</P>
      {groups.map((g) => (
        <section key={g}>
          <H>{g}</H>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
            {ITEM_KEYS.filter((k) => weaponGroup(k) === g).map((k) => {
              const aff = DAMAGE_TYPE_INFO[WEAPON_AFFINITY[k]];
              return (
                <div key={k} style={{ ...PANEL, marginTop: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <PixelSprite sprite={WEAPON_SPRITES[k]} scale={2} />
                    <div>
                      <div className="pixel-font" style={{ color: GOLD, fontSize: 15 }}>{ITEM_META[k].name}</div>
                      <div style={{ fontSize: 12, color: MUTED }}>{ITEM_META[k].category}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6, color: aff.color }}>{aff.icon} Strong in {aff.name} ({signed(AFFINITY_BONUS)})</div>
                  <Bars ceil={ITEM_CEILINGS[k].legendary} keys={STAT_KEYS} labels={WEAPON_LABELS} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <H>Armour</H>
      <P>Armour comes as helmet, chest and legs, and every piece rolls the same way. Defence counts at a third: 30 blocks like 10. Wear all three of one kind for its set bonus.</P>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
        {ARMOR_KEYS.map((k) => (
          <div key={k} style={{ ...PANEL, marginTop: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <PixelSprite sprite={ARMOR_SPRITES[k]} scale={2} />
              <div className="pixel-font" style={{ color: GOLD, fontSize: 15 }}>{ARMOR_META[k].name}</div>
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{ARMOR_META[k].desc}</div>
            <Bars ceil={ARMOR_CEILINGS[k].legendary} keys={ARMOR_STAT_KEYS} labels={ARMOR_LABELS} />
            <div style={{ fontSize: 12, color: "#ffd98a", marginTop: 6 }}>Set: {SET_BONUS[k].name} — {SET_BONUS[k].text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Races × classes ───────────────────────────────────────────────
function Races({ seen }: { seen: Set<string> }) {
  const hidden = CREATURE_TEMPLATES.filter((t) => !seen.has(t.id)).length;
  return (
    <div>
      <P>Every creature has a race and a class. Races decide which codex moves a creature can learn; classes decide the triangle.</P>
      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480, fontSize: 12 }}>
          <thead>
            <tr>
              <th />
              {COMBAT_CLASSES.map((c) => <th key={c} style={{ padding: 6, color: CLASS_INFO[c].color, textAlign: "left" }}>{CLASS_INFO[c].icon} {CLASS_INFO[c].name}</th>)}
            </tr>
          </thead>
          <tbody>
            {RACES.map((r) => (
              <tr key={r} style={{ borderTop: "1px solid #2a2d38" }}>
                <th style={{ padding: 6, textAlign: "left", color: RACE_INFO[r].color, whiteSpace: "nowrap", verticalAlign: "top" }}>{RACE_INFO[r].icon} {RACE_INFO[r].name}</th>
                {COMBAT_CLASSES.map((c) => (
                  <td key={c} style={{ padding: 6, verticalAlign: "top" }}>
                    {CREATURE_TEMPLATES.filter((t) => seen.has(t.id) && t.race === r && t.cls === c).sort(byRarity).map((t) => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4, color: RARITY_COLORS[t.rarity].text }}>
                        <PixelSprite sprite={creatureSprite(t.id)} scale={0.75} /> {t.name}
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid #2a2d38" }}>
              <th style={{ padding: 6, textAlign: "left", color: MUTED }}>Total</th>
              {COMBAT_CLASSES.map((c) => <td key={c} style={{ padding: 6, color: MUTED }}>{CREATURE_TEMPLATES.filter((t) => seen.has(t.id) && t.cls === c).length}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {hidden > 0 && <P>❔ {hidden} more creature{hidden === 1 ? "" : "s"} you haven&apos;t come across yet.</P>}
      <H>Race moves</H>
      {RACES.map((r) => (
        <div key={r} style={{ ...PANEL, marginTop: 6 }}>
          <RaceTag race={r} />{" "}
          {RACE_MOVES.filter((m) => m.race === r).map((m) => (
            <span key={m.name} style={{ fontSize: 13 }}> <b>{m.name}</b> <span style={{ color: MUTED }}>({m.self ? "utility" : moveKind(m)})</span> — {m.desc}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
