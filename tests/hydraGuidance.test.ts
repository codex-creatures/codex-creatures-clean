// tests/hydraGuidance.test.ts: the user's way of fighting the Hydra (2026-11-24), scripted as a player, against
// each ranked rival's own team (lib/pvp/rivals.json: their levels, gear and codex moves as they stand), beside the
// Normal AI. An experiment, not a game rule: run it with HYDRA_SIM=1 (`HYDRA_SIM=1 npx vitest run tests/hydraGuidance.test.ts`).
//
// The user's plan: "a high damage lead that uses the combat triangle to focus the first one down but not kill
// it, then swap to a toxic if possible so that the poison does not take you down while you focus a second one to
// low, then finish the 1st one which essentially gives you 4 more turns to finish off the second to reset the
// head spawn timer, which gives you enough time to finish the other too. Each head has an attack style and each
// head can be affected more by a secret attack style."
import { describe, expect, it } from "vitest";
import { isCreatureDrop, isItemDrop, type CreatureOrItemDrop } from "../lib/types";
import { findCreatureTemplate } from "../lib/creatures/creatureData";
import { fighterFor } from "../lib/creatures/instance";
import { ARMOR_SLOTS } from "../lib/items/armor";
import type { ItemKey } from "../lib/items/ceilings";
import { bossTeam } from "../lib/creatures/bosses";
import { WARDEN_LEVEL } from "../lib/dungeon/run";
import { calcDamage, poisonImmune, type Fighter } from "../lib/combat/engine";
import { activeOf, affordableSkills, attackTargets, createBattle, resolveRound, sendInReplacement, swapTargets, type BattleAction, type BattleState } from "../lib/combat/battle";
import { cloudLeft } from "../lib/combat/bossAi";
import { chooseAiAction, chooseAiReplacement, type AiLevel } from "../lib/combat/thinkingAi";
import { RIVALS, type Rival } from "../lib/pvp/rivals";

const TRIES = 5;
const LOW = 0.3; // a head "focused down": this share of its HP or less, still alive

// A rival's creatures as fighters, at their own levels with their own gear and moves.
function fightersOf(r: Rival): { f: Fighter; d: CreatureOrItemDrop }[] {
  const items = new Map(r.inventory.filter(isItemDrop).map((d) => [d.id, d]));
  return r.inventory.filter(isCreatureDrop).map((d) => {
    const t = findCreatureTemplate(d.creatureId, d.name)!;
    const l = r.equipment[d.id] ?? {};
    const w = l.weaponId ? items.get(l.weaponId) : undefined;
    const pieces = ARMOR_SLOTS.map((s) => (l[`${s}Id` as "helmetId" | "chestId" | "legsId"] ? items.get(l[`${s}Id` as "helmetId" | "chestId" | "legsId"]!) : undefined));
    return { f: fighterFor(d, t, w?.stats, pieces, l.moves, w?.itemKey as ItemKey | undefined, w), d };
  });
}
const power = (x: { f: Fighter }) => (x.f.level ?? 1) * 10 + x.f.maxHp / 10;

// The team the plan wants: the strongest as the lead, a toxic creature if there is one, then the strongest of
// another style than the lead's (so the triangle covers more heads).
function guidedTeam(r: Rival): Fighter[] {
  const all = fightersOf(r).sort((a, b) => power(b) - power(a));
  const lead = all[0];
  const toxic = all.find((x) => x !== lead && poisonImmune(x.f));
  const other = all.find((x) => x !== lead && x !== toxic && x.f.cls !== lead.f.cls) ?? all.find((x) => x !== lead && x !== toxic);
  return [lead, toxic, other].filter((x): x is { f: Fighter; d: CreatureOrItemDrop } => !!x).slice(0, 3).map((x) => x.f);
}
// The strongest three, as the sim's rivals pick (the baseline's team).
const plainTeam = (r: Rival) => fightersOf(r).sort((a, b) => power(b) - power(a)).slice(0, 3).map((x) => x.f);

// The user's plan as a player. Each round: swap to the toxic creature when the cloud's up; else pick a head and a
// move: focus the head weak to my style down to LOW without killing it; once two heads are low, kill them one
// after the other (the second restarts the count), then the third.
function guidedAction(state: BattleState, key: "A"): BattleAction {
  const me = activeOf(state.sides[key]);
  const foe = state.sides.B;
  const heads = attackTargets(state, key);
  const share = (i: number) => foe.team[i].hp / foe.team[i].maxHp;
  const low = heads.filter((i) => share(i) <= LOW);
  // The cloud: a toxic creature stands in it unharmed.
  if (cloudLeft(state, "B") > 0 && !poisonImmune(me)) {
    const toxic = swapTargets(state.sides[key]).find((i) => poisonImmune(state.sides[key].team[i]));
    if (toxic !== undefined) return { kind: "swap", to: toxic };
  }
  const skills = affordableSkills(me).filter((s) => s.damage > 0 && !s.self);
  if (skills.length === 0) return { kind: "pass" };
  const dmg = (i: number, s: (typeof skills)[number]) => calcDamage(s, me, foe.team[i], false).damage;
  const strongest = (i: number) => [...skills].sort((a, b) => dmg(i, b) - dmg(i, a))[0];
  const down = foe.team.filter((f) => f.hp <= 0).length;
  // Kill time: two heads low (or one down and the count running): finish the lowest.
  if (low.length >= 2 || (down >= 1 && low.length >= 1)) {
    const target = [...low].sort((a, b) => share(a) - share(b))[0];
    return { kind: "attack", skillName: strongest(target).name, target };
  }
  // Focus a head that isn't low yet: the one weak to my style first, then any; a hit that would kill it is
  // traded for a lighter one, or another head.
  const fresh = heads.filter((i) => share(i) > LOW).sort((a, b) => Number(foe.team[b].weakTo === me.cls) - Number(foe.team[a].weakTo === me.cls) || share(a) - share(b));
  for (const target of fresh) {
    const safe = [...skills].filter((s) => dmg(target, s) < foe.team[target].hp).sort((a, b) => dmg(target, b) - dmg(target, a))[0];
    if (safe) return { kind: "attack", skillName: safe.name, target };
  }
  // Nothing safe: hit the lowest with everything (a kill starts the count; the others follow).
  const target = [...heads].sort((a, b) => share(a) - share(b))[0];
  return { kind: "attack", skillName: strongest(target).name, target };
}
const healthiest = (state: BattleState) => state.sides.A.team.map((f, i) => ({ i, hp: f.hp / f.maxHp })).filter((x) => x.hp > 0 && x.i !== state.sides.A.active).sort((a, b) => b.hp - a.hp)[0]?.i ?? 0;

type Player = { act: (s: BattleState) => BattleAction; replace: (s: BattleState) => number };
const guided: Player = { act: (s) => guidedAction(s, "A"), replace: healthiest };
const ai = (level: AiLevel): Player => ({ act: (s) => chooseAiAction(s, "A", level), replace: (s) => chooseAiReplacement(s, "A", level) });

// One Hydra fight at the lair, everyone fresh. Returns who won and how many rounds.
function hydraFight(team: Fighter[], player: Player): { won: boolean; rounds: number; headsLeft: number } {
  let st = createBattle(team, bossTeam("hydra", WARDEN_LEVEL), undefined, "hydra");
  for (let guard = 0; !st.winner && guard < 300; guard++) {
    if (st.needsReplacement.includes("A")) { st = sendInReplacement(st, "A", player.replace(st)); continue; }
    if (st.needsReplacement.length) break;
    st = resolveRound(st, { A: player.act(st), B: { kind: "pass" } });
  }
  return { won: st.winner === "A", rounds: st.round, headsLeft: st.sides.B.team.filter((f) => f.hp > 0).length };
}

describe("the Hydra, the user's way", () => {
  it.skipIf(!process.env.HYDRA_SIM)("each rival's team, five tries: guided play beside the Normal AI", () => {
    const lines: string[] = [];
    let guidedWins = 0, aiWins = 0;
    for (const r of RIVALS) {
      const g = Array.from({ length: TRIES }, () => hydraFight(guidedTeam(r), guided));
      const a = Array.from({ length: TRIES }, () => hydraFight(plainTeam(r), ai("normal")));
      const gt = Array.from({ length: TRIES }, () => hydraFight(guidedTeam(r), ai("normal")));
      guidedWins += g.filter((x) => x.won).length; aiWins += a.filter((x) => x.won).length;
      const team = guidedTeam(r).map((f) => `${f.name} ${f.cls[0]}${f.level}${poisonImmune(f) ? " toxic" : ""}`).join(", ");
      lines.push(`${r.name}: guided ${g.filter((x) => x.won).length}/${TRIES} (rounds ${g.map((x) => x.rounds).join("/")}; heads left ${g.map((x) => x.headsLeft).join("/")}) · AI, its own team ${a.filter((x) => x.won).length}/${TRIES} · AI with the guided team ${gt.filter((x) => x.won).length}/${TRIES} · team: ${team}`);
    }
    lines.push(`all: guided ${guidedWins}/${RIVALS.length * TRIES}, AI ${aiWins}/${RIVALS.length * TRIES}`);
    console.log(lines.join("\n"));
    expect(lines.length).toBe(RIVALS.length + 1);
  }, 20 * 60 * 1000);
});
