// app/lab/pvp/rules.ts — 🧪 the balance packages the PvP lab can fight under (docs/two-styles-sim-2026-11.md).
// "Today" is the game as it is. The two-style packages are the sims' transform: species, moves, weapon and
// armour ceilings, HP and armour weight reshaped on the way into a fight. The game's own code is untouched;
// nothing here is used outside the lab.

import { CREATURE_BY_ID, type CombatClass, type CreatureTemplate, type Skill } from "@/lib/creatures/creatureData";
import { coreFor } from "@/lib/creatures/raceKitsV2";
import { buildFighter } from "@/lib/combat/loadout";
import { levelFactor } from "@/lib/creatures/levels";
import { LIVE_RULES, type CombatRules, type Fighter } from "@/lib/combat/engine";
import { rollItemStats } from "@/lib/items/rollItemStats";
import { rollArmorStats } from "@/lib/items/rollArmorStats";
import { ITEM_CEILINGS, type ItemKey, type StatBlock } from "@/lib/items/ceilings";
import { ARMOR_CEILINGS, PIECE_HP_SHARE, type ArmorKey, type ArmorStatBlock } from "@/lib/items/armor";
import type { Rarity } from "@/lib/items/budgets";

export type RulesKey = "today" | "M1" | "T1" | "T2" | "T3" | "K8" | "K9";
// two: melee + ranged only. sharp: every creature's defences lean with a weakness (the user's table) and the sided
// plates lose their other sides. hp: the HP % per creature. W: how much armour defence counts (today a third).
// M: hits this many times bigger next to HP (done as HP ÷ M). multiply: the engine's "multiply" power model, with
// every move in swing units (10 = one swing).
export const RULES: Record<RulesKey, { name: string; two: boolean; sharp: boolean; hp: boolean; W: number; M: number; multiply?: boolean; blurb: string }> = {
  today: { name: "Today", two: false, sharp: false, hp: false, W: 1 / 3, M: 1, blurb: "The game as it is: three styles, armour counts at a third." },
  M1: { name: "Multiply (not picked)", two: false, sharp: true, hp: true, W: 1, M: 2, multiply: true, blurb: "Three styles; every creature's defences lean with a weakness; HP % per creature; armour in full; moves multiply the swing (10 = one swing, 15 = a heavy); hits ×2 next to HP (HP shown ÷2)." },
  T1: { name: "3 styles T1", two: false, sharp: true, hp: true, W: 1 / 3, M: 1, blurb: "Three styles; tanks lean one way, HP % per creature; today's maths." },
  T2: { name: "The refresh (T2)", two: false, sharp: true, hp: true, W: 1, M: 2, blurb: "The user's pick, 2026-11-25: three styles; every creature's defences lean with a weakness; an HP % that grows with level; armour counts in full; hits ×2 next to HP (HP shown ÷2)." },
  T3: { name: "3 styles T3", two: false, sharp: true, hp: true, W: 1, M: 2.5, blurb: "T1 with armour in full and hits ×2.5 (HP shown ÷2.5)." },
  K8: { name: "Two styles K8", two: true, sharp: true, hp: true, W: 1, M: 2, blurb: "Melee + ranged, HP % per creature, armour in full, hits ×2 (HP shown ÷2)." },
  K9: { name: "Two styles K9", two: true, sharp: true, hp: true, W: 1, M: 2.5, blurb: "As K8 with hits ×2.5 (HP shown ÷2.5)." },
};

// Three styles: every creature's defences (melee / ranged / magic) leaning to what it's made of, with a clear
// weakness; attackers less tanky than tanks, even spreads lower (the user's table, 2026-11-25,
// docs/balance-refresh-2026-11.md).
export const SHARP3: Record<string, [number, number, number]> = {
  moss_wolf: [5, 1, 3], amber_wasp: [4, 1, 4], bellow_toad: [8, 2, 14], dire_wolf: [14, 5, 11], ironhide: [60, 33, 18],
  cave_bat: [2, 6, 4], rust_beetle: [20, 28, 6], crystalback: [12, 30, 42], crystal_golem: [12, 27, 39], hollow_matriarch: [18, 7, 22],
  dust_sprite: [1, 5, 6], flicker_wisp: [2, 7, 9], veilstalker: [10, 8, 2], the_watcher: [12, 6, 18], void_serpent: [15, 15, 8],
  rattlebones: [2, 7, 5], shambler: [22, 12, 5], dustwraith: [6, 9, 3], mr_shadows: [24, 16, 8], storm_phoenix: [14, 8, 20],
  thicket_archer: [1, 5, 3], leafblade_scout: [5, 5, 2], aurelius: [12, 5, 9], swamp_witch: [4, 16, 13], sylvaran: [8, 22, 16],
  gleamling: [1, 5, 6], flame_imp: [5, 3, 10], thunderhead: [16, 18, 8], deep_angler: [10, 10, 5], tunnel_wyrm: [50, 24, 8],
  plague_rat: [2, 5, 3], rotgut_fly: [6, 3, 7], glob: [32, 26, 10], dreadpox: [10, 22, 38], pale_rider: [18, 16, 6],
};
// Today's power (× its multiplier) in swing units: 10 stays 10; 15 → 12, 20 → 13, 25 → 15; 32 → 20, 35 → 21, 50 → 30, 62 → 38.
export const swingUnits = (p: number) => Math.round(p <= 10 ? p : p <= 25 ? 10 + (p - 10) / 3 : 15 + (p - 25) * 0.6);
export const inSwings = (s: Skill): Skill => (s.damage > 0 ? { ...s, damage: swingUnits(s.damage * (s.mult ?? 1)), mult: undefined } : s);

// ── The two-style draft (the report's tables) ──────────────────────────────────
// melee %, ranged %, HP %; defence is magic defence split half and half unless SHARP_DEF says otherwise.
export const DRAFT: Record<string, { melee: number; ranged: number; hp: number }> = {
  moss_wolf: { melee: 14, ranged: 4, hp: 20 }, amber_wasp: { melee: 17, ranged: 5, hp: 10 }, bellow_toad: { melee: 13, ranged: 13, hp: 30 },
  dire_wolf: { melee: 37, ranged: 9, hp: 25 }, ironhide: { melee: 46, ranged: 12, hp: 50 }, cave_bat: { melee: 14, ranged: 4, hp: 15 },
  rust_beetle: { melee: 10, ranged: 3, hp: 60 }, crystalback: { melee: 5, ranged: 9, hp: 70 }, crystal_golem: { melee: 20, ranged: 14, hp: 60 },
  hollow_matriarch: { melee: 32, ranged: 32, hp: 25 }, dust_sprite: { melee: 4, ranged: 16, hp: 0 }, flicker_wisp: { melee: 5, ranged: 19, hp: 5 },
  veilstalker: { melee: 20, ranged: 16, hp: 10 }, the_watcher: { melee: 11, ranged: 41, hp: 15 }, void_serpent: { melee: 36, ranged: 36, hp: 20 },
  rattlebones: { melee: 16, ranged: 4, hp: 20 }, shambler: { melee: 16, ranged: 4, hp: 50 }, dustwraith: { melee: 6, ranged: 20, hp: 0 },
  mr_shadows: { melee: 19, ranged: 19, hp: 20 }, storm_phoenix: { melee: 20, ranged: 48, hp: 5 }, thicket_archer: { melee: 5, ranged: 19, hp: 5 },
  leafblade_scout: { melee: 14, ranged: 14, hp: 15 }, aurelius: { melee: 12, ranged: 22, hp: 25 }, swamp_witch: { melee: 11, ranged: 41, hp: 10 },
  sylvaran: { melee: 14, ranged: 52, hp: 10 }, gleamling: { melee: 4, ranged: 16, hp: 0 }, flame_imp: { melee: 5, ranged: 19, hp: 5 },
  thunderhead: { melee: 41, ranged: 41, hp: 40 }, deep_angler: { melee: 30, ranged: 8, hp: 30 }, tunnel_wyrm: { melee: 21, ranged: 5, hp: 80 },
  plague_rat: { melee: 11, ranged: 3, hp: 15 }, rotgut_fly: { melee: 5, ranged: 17, hp: 5 }, glob: { melee: 11, ranged: 3, hp: 70 },
  dreadpox: { melee: 8, ranged: 28, hp: 60 }, pale_rider: { melee: 44, ranged: 32, hp: 30 },
};
// The tanks' defences, leaning hard one way (melee def, ranged def).
export const SHARP_DEF: Record<string, [number, number]> = {
  tunnel_wyrm: [70, 12], glob: [55, 13], crystal_golem: [60, 18], rust_beetle: [40, 14], ironhide: [80, 31], shambler: [30, 9],
  crystalback: [20, 64], dreadpox: [20, 50],
};

// The species' HP % as listed (its level-15 value).
export const hpPct = (id: string, rules: RulesKey) => (RULES[rules].hp ? DRAFT[id]?.hp ?? 0 : 0);
// …and at a level: it grows like every other % (none at Lv 1, as listed at Lv 15, about double at Lv 29; the user, 2026-11-25).
export const hpPctAt = (id: string, rules: RulesKey, level: number) => Math.round(hpPct(id, rules) * levelFactor(level));

// The species under the rules: today's template, the three-style one with its tank defences leaning, or the two-style one.
export function templateUnder(id: string, rules: RulesKey): CreatureTemplate {
  // (The game's own HP % is left out: the lab puts on its rule set's, hpPct above, so its rows stay comparable.)
  const t0 = CREATURE_BY_ID[id], t = { ...t0, proficiency: { ...t0.proficiency, hp: 0 } };
  if (!RULES[rules].two) {
    if (!RULES[rules].sharp || !SHARP3[id]) return t;
    const [mdef, rdef, magdef] = SHARP3[id];
    return { ...t, proficiency: { ...t.proficiency, mdef, rdef, magdef } };
  }
  if (!DRAFT[id]) return t;
  const d = DRAFT[id], p = t.proficiency;
  const cls: CombatClass = d.melee >= d.ranged ? "melee" : "ranged", second: CombatClass = cls === "melee" ? "ranged" : "melee";
  const [mdef, rdef] = SHARP_DEF[id] ?? [p.mdef + Math.ceil(p.magdef / 2), p.rdef + Math.floor(p.magdef / 2)];
  return { ...t, cls, proficiency: { atk: d.melee, rng: d.ranged, mag: 0, agil: p.agil, mdef, rdef, magdef: 0, hp: 0 }, skills: [...coreFor(cls), ...coreFor(second)] };
}

// What a creature is, from its %s: a tank when its defences outweigh its attacks, leaning to the side that's half
// again the other's (or "all-round"); otherwise an attacker in its style, or a hybrid when its styles are close.
export function roleOf(t: Pick<CreatureTemplate, "proficiency">): string {
  const p = t.proficiency;
  const lean = (a: [string, number][]) => {
    const s = a.filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    if (s.length === 0) return "all-round";
    return s[0][1] >= 1.5 * (s[1]?.[1] ?? 0) ? s[0][0] : "all-round";
  };
  const attack = p.atk + p.rng + p.mag, defence = p.mdef + p.rdef + p.magdef;
  if (defence >= 1.2 * attack) return `${lean([["melee", p.mdef], ["ranged", p.rdef], ["magic", p.magdef]])} tank`;
  const a = lean([["melee", p.atk], ["ranged", p.rng], ["magic", p.mag]]);
  return a === "all-round" ? "hybrid attacker" : `${a} attacker`;
}

// The gear a player would give it: tanks a shield of their side and the heavy plate of their side; attackers the
// weapon with the highest ceiling in their main style and all-round plate; hybrids the Trident.
export function fittedGear(id: string, rules: RulesKey): { weapon: ItemKey; armor: ArmorKey } {
  const t = templateUnder(id, rules), role = roleOf(t);
  if (role.endsWith("tank")) {
    if (role.startsWith("ranged")) return { weapon: "chainbound_aegis", armor: RULES[rules].two ? "arcane_nullifier" : "arrowward_mantle" };
    if (role.startsWith("magic")) return { weapon: "aether_shield", armor: "arcane_nullifier" };
    if (role.startsWith("melee")) return { weapon: "basalt_bulwark", armor: "colossal_shellarmor" };
    return { weapon: "basalt_bulwark", armor: "juggernaut_platemail" };
  }
  if (role === "hybrid attacker") return { weapon: RULES[rules].two ? "lightning_trident" : "stormlash_whip", armor: "juggernaut_platemail" };
  const stat = t.cls === "melee" ? "melee" : t.cls === "ranged" ? "ranged" : "magic";
  const keys = (Object.keys(ITEM_CEILINGS) as ItemKey[]).filter((k) => k !== "klutz_club");
  const weapon = keys.reduce((b, k) => (weaponCeilings(k, "rare", rules)[stat] > weaponCeilings(b, "rare", rules)[stat] ? k : b));
  return { weapon, armor: "juggernaut_platemail" };
}

// Magic moves filed: Smite is a blow; everything else a bolt. The magic core moves become the ranged ones.
const CORE_RENAME: Record<string, string> = { Zap: "Shot", Blast: "Power Shot", Blink: "Quickshot" };
export const restyle = (s: Skill): Skill => (s.type === "magic" ? { ...s, type: s.name === "Smite" ? "melee" : "ranged" } : s);
export const moveNameUnder = (name: string, rules: RulesKey) => (RULES[rules].two ? CORE_RENAME[name] ?? name : name);

// ── Gear ceilings under the rules ────────────────────────────────────────────────
// Share of each weapon's magic ceiling that goes to melee (the rest to ranged).
const WEAPON_LEAN: Record<ItemKey, number> = {
  void_scythe: 1, temporal_maul: 1, serrated_fanblade: 1, stormlash_whip: 0, weeping_greatbow: 0, lightning_trident: 1, thunderhead_crossbow: 0,
  soul_storm: 0, chaos_orb: 0, frostspire_staff: 2 / 3, klutz_club: 0.5, chainbound_aegis: 0, ironfang_guard: 1, basalt_bulwark: 1, aether_shield: 0.5,
};
export function weaponCeilings(key: ItemKey, rarity: Rarity, rules: RulesKey): StatBlock {
  const c = ITEM_CEILINGS[key][rarity];
  if (!RULES[rules].two) return c;
  const toMelee = Math.round(c.magic * WEAPON_LEAN[key]);
  return { melee: c.melee + toMelee, ranged: c.ranged + (c.magic - toMelee), magic: 0, agility: c.agility, hp: c.hp };
}
// Share of each armour's magic defence ceiling that goes to melee defence; the two heavy plates' weak side drops to 15 (Rare).
const ARMOR_FOLD: Record<ArmorKey, number> = { frontiers_mail: 0.5, arrowward_mantle: 0.5, dragonscale_tunic: 0.5, colossal_shellarmor: 1, arcane_nullifier: 0, polished_chainbolster: 0.5, juggernaut_platemail: 0.5 };
export function armorCeilings(key: ArmorKey, rarity: Rarity, rules: RulesKey): ArmorStatBlock {
  const c = ARMOR_CEILINGS[key][rarity];
  const weak = Math.round((15 * c.hp) / ARMOR_CEILINGS[key].rare.hp);
  if (!RULES[rules].two) {
    if (!RULES[rules].sharp) return c;
    // Three styles: each sided plate keeps its side and loses the other two.
    if (key === "colossal_shellarmor") return { ...c, rDef: weak, magDef: weak };
    if (key === "arcane_nullifier") return { ...c, mDef: weak, rDef: weak };
    if (key === "arrowward_mantle") return { ...c, mDef: weak, magDef: weak };
    return c;
  }
  const toMelee = Math.round(c.magDef * ARMOR_FOLD[key]);
  const out = { mDef: c.mDef + toMelee, rDef: c.rDef + (c.magDef - toMelee), magDef: 0, agility: c.agility, hp: c.hp };
  if (key === "colossal_shellarmor") out.rDef = weak;
  if (key === "arcane_nullifier") out.mDef = weak;
  return out;
}

// A weapon rolled under the rules (the real roller, with the ceilings swapped for the roll).
export function rollWeaponUnder(key: ItemKey, rarity: Rarity, rules: RulesKey): Record<string, number> {
  if (!RULES[rules].two) return { ...rollItemStats(key, rarity).stats };
  const saved = ITEM_CEILINGS[key][rarity];
  ITEM_CEILINGS[key][rarity] = weaponCeilings(key, rarity, rules);
  try { return { ...rollItemStats(key, rarity).stats }; } finally { ITEM_CEILINGS[key][rarity] = saved; }
}
// One armour piece rolled under the rules.
export function rollPieceUnder(key: ArmorKey, rarity: Rarity, rules: RulesKey): Record<string, number> {
  const c = armorCeilings(key, rarity, rules);
  return { ...rollArmorStats(key, rarity, Math.random, { ...c, hp: Math.max(1, Math.round(c.hp * PIECE_HP_SHARE)) }).stats };
}

// ── A fighter under the rules ───────────────────────────────────────────────────
// weapon / armour: item stats (armour: the three pieces summed). No set bonuses in the lab (the user, 2026-11-24).
export function fighterUnder(id: string, rules: RulesKey, level: number, weapon: Record<string, number> | undefined, armor: Record<string, number> | undefined,
  moves: string[] | undefined, weaponKey?: ItemKey): Fighter {
  const r = RULES[rules];
  const t = templateUnder(id, rules);
  const f = buildFighter(t, weapon, armor, moves?.map((m) => moveNameUnder(m, rules)), undefined, undefined, weaponKey, level);
  if (rules === "today") return f;
  const hp = Math.max(1, Math.round((f.maxHp * (1 + hpPctAt(id, rules, level) / 100)) / r.M));
  const skills = r.multiply ? f.skills.map(inSwings) : f.skills;
  const scaled = { ...f, hp, maxHp: hp, skills, armor: { ...f.armor, mdef: f.armor.mdef * 3 * r.W, rdef: f.armor.rdef * 3 * r.W, magdef: f.armor.magdef * 3 * r.W } };
  return r.two ? { ...scaled, skills: skills.map(restyle), armor: { ...scaled.armor, magdef: 0 } } : scaled;
}

// The engine's rules for a package: the lab sets them while it's open and puts the game's back when it closes.
export const engineRulesFor = (rules: RulesKey): CombatRules => (RULES[rules].multiply ? { ...LIVE_RULES, powerModel: "multiply" } : LIVE_RULES);
