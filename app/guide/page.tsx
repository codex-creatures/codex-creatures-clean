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
import RaceChart from "@/components/RaceChart";
import ClassBadge, { moveKind } from "@/components/ClassBadge";
import { CreatureFilterBar, CreatureMarks, NO_FILTER, matchesFilter, type CreatureFilter } from "@/components/CreatureMarks";
import {
  ALL_SKILLS, BASIC_CODEX_MAX_DAMAGE, BOSS_MOVES, CLASS_INFO, COMBAT_CLASSES, CREATURE_TEMPLATES, DAMAGE_TYPE_INFO, LEARNABLE_MOVES, MOVE_BY_NAME, RACES, RACE_INFO, RACE_MOVES,
  STEADY_MAX_ENERGY, learnRacesOf, raceMovesFor, type CombatClass, type CreatureProficiency, type CreatureTemplate, type Race, type Skill,
} from "@/lib/creatures/creatureData";
import {
  AFFINITY_BONUS, DAMAGE_VARIANCE, ENERGY_REGEN, MAX_ENERGY, PRECISE_CHANCE, PRECISE_DAMAGE, PRECISE_IGNORE,
  calcDamage, damageTypesOn, type CombatItem, type Fighter,
} from "@/lib/combat/engine";
import { MATCH_BONUS, RACE_EFFECT } from "@/lib/combat/raceChart";
import { ARMOR_DEFENCE_WEIGHT } from "@/lib/combat/engine";
import { CRIPPLE, CRIPPLE_AGILITY_LOSS, CRIPPLE_ROUNDS, SWAP_ENERGY_RESTORE } from "@/lib/combat/battle";
import { SOUL_STONES, SOUL_STONE_CHANCE, SOUL_STONE_REPLACE_COST, stonesFor, type SoulStoneKey } from "@/lib/creatures/soulStones";
import { SCAN_ODDS } from "@/lib/barcodeRegistry";
import { CYCLOPS_SOUL_STONE, WARDEN_SOUL_STONE } from "@/lib/dungeon/run";
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
      <H>Races</H>
      <P>Every creature has one or two <b>races</b>. Most moves have one race too; <b>Neutral</b> moves have none and land the same on everyone. A move&apos;s race against the target&apos;s races:
        effective does <b>{signed(RACE_EFFECT.strong - 1)}</b> damage, resisted <b>{signed(RACE_EFFECT.resisted - 1)}</b>, anything else normal.
        Against two races both count (a double weakness is ×{(RACE_EFFECT.strong ** 2).toFixed(2)}). A move of one of the attacker&apos;s own races does
        another <b>{signed(MATCH_BONUS - 1)}</b>.</P>
      <RaceChart />
      <P>Mix your team: a team weak to the same race loses badly. Swap out of a bad matchup — swapping uses your turn, the
        opponent gets a free hit on the creature coming in, and the one going out recovers {pct(SWAP_ENERGY_RESTORE)} of its missing energy.</P>

      <H>Damage</H>
      <P>A move&apos;s <b>style</b> (melee, ranged or magic) decides which attack and defence it uses. A hit is <b>move power + your attack</b> for
        that style (your weapon&apos;s stat boosted by the creature&apos;s %). Armour then cuts it as a ratio:</P>
      <div className="pixel-font" style={{ ...PANEL, textAlign: "center", fontSize: 15, color: GOLD }}>damage = hit × hit ÷ (hit + defence)</div>
      <P>Armour&apos;s defence counts at {Math.round(ARMOR_DEFENCE_WEIGHT * 100)}% (a full set rolls about three times what one piece did), so
        defence always matters but never stops a hit dead: a hit as big as the counted defence does half. Then the races multiply it.
        Every hit rolls ±{pct(DAMAGE_VARIANCE)}.</P>

      <H>Try it</H>
      <Calculator />

      <H>Turn order, energy and the rest</H>
      <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 18, margin: "4px 0" }}>
        <li><b>Turn order</b>: swaps and items come first, then attacks. <b>Priority moves</b> (Rush, Quickshot, Blink, the race kits&apos; quick attacks, Pounce) always go before the rest; between two of them, or two ordinary moves, the higher <b>agility</b> goes first. Agility does nothing else.</li>
        <li><b>Energy</b>: everyone starts on {MAX_ENERGY}. Moves cost energy; you get {ENERGY_REGEN} back after each attack, so energy never drops below {ENERGY_REGEN}. Every creature keeps at least one move of {STEADY_MAX_ENERGY} energy or less, so it can always attack: there&apos;s no resting.</li>
        <li><b>Moves</b>: a creature is born with 3 (a Neutral move, its race&apos;s move and a Neutral priority move), sometimes a rare 4th. Codexes teach the rest of its race kits and more. Enemies learn more of their kits as they level.</li>
        <li><b>Precise hits</b>: {pct(PRECISE_CHANCE)} of hits are precise: they do {PRECISE_DAMAGE}× damage and ignore {pct(PRECISE_IGNORE)} of the defence.</li>
        <li><b>Cripple</b>: for {CRIPPLE_ROUNDS} rounds, −{pct(CRIPPLE_AGILITY_LOSS)} agility and a {pct(CRIPPLE.stumble)} chance to stumble and lose each attack (no energy spent). <b>Haste</b>: double agility this round only, to strike first.</li>
        <li><b>Stances</b> (the Cyclops&apos;s Eye floats): floating takes +10% from ranged, −10% from melee; entrenched the other way round.</li>
      </ul>

      <H>Creature rolls</H>
      <P>Every creature is an individual: its %s are rolled around its species&apos; — each within ±{pct(ROLL_SPREAD_SHARE)} of the species&apos; total %s (at least ±{ROLL_SPREAD_MIN}), so rarer creatures, with more to work with, vary more — and a {pct(RARE_MOVE_CHANCE)} chance its empty fourth move slot
        holds a rare learnable move of its style.</P>

      <H>Soul stones</H>
      <P>Some creatures are born with a soul stone, shown under their weapon: Rare {pct(SOUL_STONE_CHANCE.rare ?? 0)}, Epic {pct(SOUL_STONE_CHANCE.epic ?? 0)}, Legendary always. Cards have them too, and summoning from a card keeps its stone. Each species can get one of a few (see the Bestiary).</P>
      <P>Soul stones also turn up on their own: in {SCAN_ODDS.soul_stone}% of barcodes nobody has scanned before (anyone who scans it after you gets gold), and now and then in a boss&apos;s chest (the Cyclops {pct(CYCLOPS_SOUL_STONE)}, the Warden {pct(WARDEN_SOUL_STONE)}). Tap a creature&apos;s soul stone slot to set one in it, any creature at all: free into an empty slot, {SOUL_STONE_REPLACE_COST.toLocaleString()} gold to replace a stone, and the old one is destroyed.</P>
      <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 18, margin: "4px 0" }}>
        {(Object.keys(SOUL_STONES) as SoulStoneKey[]).map((k) => <li key={k}>{SOUL_STONES[k].icon} <b>{SOUL_STONES[k].name}</b>: {SOUL_STONES[k].text}</li>)}
      </ul>
    </div>
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
  const [rel, setRel] = useState<"double" | "strong" | "even" | "weak">("even");
  const [own, setOwn] = useState(false);
  // A Beast kit move (Gore) against a target its race beats, or not.
  const target: Race[] = rel === "double" ? ["humanoid", "underkin"] : rel === "strong" ? ["humanoid"] : rel === "weak" ? ["geo"] : ["beast"];
  const skill: Skill = { ...MOVE_BY_NAME.Gore, damage: power };
  const a = { ...dummy("melee", 100, { atk: attack }, {}), races: [own ? "beast" : "divine"] as Race[] };
  const d = { ...dummy("melee", hp, {}, { mdef: defence }), races: target };
  const dmg = calcDamage(skill, a, d, false).damage;
  const label = { double: `▲▲ Double weakness (×${(RACE_EFFECT.strong ** 2).toFixed(2)})`, strong: `▲ Effective (${signed(RACE_EFFECT.strong - 1)})`, even: "Neutral", weak: `▼ Resisted (${signed(RACE_EFFECT.resisted - 1)})` };
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
        {(["double", "strong", "even", "weak"] as const).map((k) => (
          <button key={k} className="chip" data-active={rel === k} onClick={() => setRel(k)}>{label[k]}</button>
        ))}
        <button className="chip" data-active={own} onClick={() => setOwn(!own)}>Its own race {own ? `on (${signed(MATCH_BONUS - 1)})` : "off"}</button>
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
  const shown = CREATURE_TEMPLATES.filter((t) => (filtering ? known(t) && matchesFilter(filter, t.races ?? t.race, t.cls) : true));
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
        raceCount={(r) => CREATURE_TEMPLATES.filter((t) => known(t) && (t.races ?? []).includes(r) && (filter.cls === "all" || t.cls === filter.cls)).length}
        classCount={(c) => CREATURE_TEMPLATES.filter((t) => known(t) && t.cls === c && (filter.race === "all" || (t.races ?? []).includes(filter.race))).length} />
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
  const stones = stonesFor(t.id);
  return (
    <div style={{ ...PANEL, marginTop: 0, borderColor: rc.border }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ background: `radial-gradient(circle, ${rc.glow}, #101117 75%)`, padding: 4 }}>
          <PixelSprite sprite={creatureSprite(t.id)} scale={2} title={t.name} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="pixel-font" style={{ color: rc.text, fontSize: 16, lineHeight: 1.1 }}>{t.name}</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
            <RaceTag race={t.race} races={t.races} /><ClassBadge cls={t.cls} />
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
      {stones.length > 0 && (
        <div style={{ fontSize: 12, color: "#b9e6ff", marginTop: 6 }}>Soul stones ({pct(SOUL_STONE_CHANCE[t.rarity] ?? 0)}): {stones.map((s) => `${SOUL_STONES[s].icon} ${SOUL_STONES[s].name}`).join(", ")}</div>
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
      {RACE_MOVES.map((m) => row(m, <>Only <RaceTag races={learnRacesOf(m)} /> creatures can learn it, from a codex.</>))}
      <H>Boss moves</H>
      {BOSS_MOVES.map((m) => row(m, "The Cyclops only."))}
    </div>
  );
}

function CreatureName({ t }: { t: CreatureTemplate }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginRight: 8, color: RARITY_COLORS[t.rarity].text, whiteSpace: "nowrap" }}>
      <CreatureMarks race={t.race} races={t.races} cls={t.cls} size={9} /> {t.name}
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
                  {damageTypesOn() && <div style={{ fontSize: 12, marginTop: 6, color: aff.color }}>{aff.icon} Strong in {aff.name} ({signed(AFFINITY_BONUS)})</div>}
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
      <P>Every creature has one or two races and a class (its main style). Races decide how hard its moves land and which codex moves it can learn.</P>
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
                    {CREATURE_TEMPLATES.filter((t) => seen.has(t.id) && (t.races ?? []).includes(r) && t.cls === c).sort(byRarity).map((t) => (
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
      {RACES.filter((r) => RACE_MOVES.some((m) => learnRacesOf(m).includes(r))).map((r) => (
        <div key={r} style={{ ...PANEL, marginTop: 6 }}>
          <RaceTag race={r} />{" "}
          {RACE_MOVES.filter((m) => learnRacesOf(m).includes(r)).map((m) => (
            <span key={m.name} style={{ fontSize: 13 }}> <b>{m.name}</b> <span style={{ color: MUTED }}>({m.self ? "utility" : moveKind(m)})</span> — {m.desc}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
