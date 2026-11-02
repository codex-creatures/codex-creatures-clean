import { describe, expect, it } from "vitest";
import { CREATURE_TEMPLATES, isSteadyMove } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { createBattle } from "../lib/combat/battle";
import {
  Duel, chooseFighters, firstPicks, mirrorBattle, steadyAction, teamFits, RESEND_MS,
  type DuelMsg, type DuelTeam, type DuelView,
} from "../lib/pvp/duel";
import {
  PVP_FORMATS, GONE_SECONDS, GRACE_SECONDS, PICK_SECONDS, TURN_SECONDS, INVITE_SECONDS,
  eligibleCount, ineligibleReason, rarityAllowed, parseFormat, makeFormat, duelLevel, bringMax, DEFAULT_PVP, BRING_EXTRA,
} from "../lib/pvp/formats";

const FMT = PVP_FORMATS["3v3-rare"];
const team = (offset: number, level = FMT.level, n = FMT.size): DuelTeam => {
  const ts = CREATURE_TEMPLATES.slice(offset, offset + n);
  return { fighters: ts.map((t) => buildFighter(t, undefined, undefined, undefined, undefined, undefined, undefined, level)),
    info: ts.map((t) => ({ rarity: t.rarity, label: t.name, creatureId: t.id })) };
};

// Two machines joined by a pretend connection. Messages wait in a queue until
// flush() (so a test can drop some, as a bad connection would); the clock is shared.
function pair(opts: { drop?: (m: DuelMsg, to: "host" | "guest") => boolean; format?: typeof FMT } = {}) {
  let now = 1_000_000;
  const queue: { to: "host" | "guest"; m: DuelMsg }[] = [];
  const mk = (role: "host" | "guest", t: DuelTeam) => new Duel({
    role, format: opts.format ?? FMT, now: () => now, autoTeam: () => t,
    send: (m) => { const to = role === "host" ? "guest" : "host"; if (!opts.drop?.(m, to)) queue.push({ to, m: JSON.parse(JSON.stringify(m)) }); },
  });
  const host = mk("host", team(0)), guest = mk("guest", team(10));
  const flush = () => { for (let n = 0; queue.length && n < 1000; n++) { const { to, m } = queue.shift()!; (to === "host" ? host : guest).receive(m); } };
  const tick = (ms: number) => { now += ms; host.tick(); guest.tick(); flush(); };
  const join = () => { host.start(); guest.start(); host.peer(true); guest.peer(true); flush(); };
  return { host, guest, flush, tick, join, queue, at: () => now };
}

const battleOf = (v: DuelView) => { if (v.phase !== "battle") throw new Error(`not in battle: ${v.phase}`); return v; };

// Both lock in teams and leads, straight into the battle.
function toBattle(p: ReturnType<typeof pair>, leads = [[0, 1, 2], [0, 1, 2]]) {
  p.join();
  p.host.pickTeam(team(0)); p.guest.pickTeam(team(10)); p.flush();
  p.host.chooseLead(leads[0]); p.guest.chooseLead(leads[1]); p.flush();
}

describe("PvP formats and the gear screen", () => {
  it("has the three formats", () => {
    expect(PVP_FORMATS["3v3-rare"]).toMatchObject({ size: 3, maxRarity: "rare", level: 15 });
    expect(PVP_FORMATS["5v5-rare"]).toMatchObject({ size: 5, maxRarity: "rare", level: 15 });
    expect(PVP_FORMATS["5v5-legendary"]).toMatchObject({ size: 5, maxRarity: "legendary", level: 25 });
  });

  it("keeps out creatures, and creatures wearing gear, above the format's rarity", () => {
    const rare = PVP_FORMATS["5v5-rare"];
    expect(ineligibleReason({ rarity: "rare", gear: [{ name: "Sword", rarity: "rare" }] }, rare)).toBeNull();
    expect(ineligibleReason({ rarity: "epic", gear: [] }, rare)).toMatch(/Too rare/);
    expect(ineligibleReason({ rarity: "rare", gear: [{ name: "Helm", rarity: "common" }, { name: "Void Scythe", rarity: "epic" }] }, rare)).toBe("Void Scythe is too rare");
    expect(ineligibleReason({ rarity: "legendary", gear: [{ name: "Crown", rarity: "legendary" }] }, PVP_FORMATS["5v5-legendary"])).toBeNull();
    expect(eligibleCount([{ rarity: "common", gear: [] }, { rarity: "epic", gear: [] }], rare)).toBe(1);
    expect(rarityAllowed(undefined, rare)).toBe(true);
  });
});

describe("duel helpers", () => {
  it("mirrors a battle so each player is side A", () => {
    const s = createBattle(team(0).fighters, team(10).fighters);
    s.needsReplacement = ["B"];
    s.winner = "A";
    s.log.push({ type: "faint", side: "B", name: "x" }, { type: "end", winner: "A" });
    const m = mirrorBattle(s);
    expect(m.sides.A.team[0].name).toBe(s.sides.B.team[0].name);
    expect(m.sides.A.key).toBe("A");
    expect(m.needsReplacement).toEqual(["A"]);
    expect(m.winner).toBe("B");
    expect(m.log.slice(-2)).toEqual([{ type: "faint", side: "A", name: "x" }, { type: "end", winner: "B" }]);
    expect(mirrorBattle(m).sides.A.team[0].name).toBe(s.sides.A.team[0].name);
  });

  it("makes a steady move when time runs out, and puts the lead first", () => {
    const s = createBattle(team(0).fighters, team(10).fighters);
    const a = steadyAction(s, "A");
    expect(a.kind).toBe("attack");
    const sk = s.sides.A.team[0].skills.find((x) => a.kind === "attack" && x.name === a.skillName)!;
    expect(isSteadyMove(sk)).toBe(true);
    const t = team(0);
    expect(chooseFighters(t, [2, 0, 1], 3).fighters.map((f) => f.name)).toEqual([t.fighters[2].name, t.fighters[0].name, t.fighters[1].name]);
    expect(chooseFighters(t, [2, 0, 1], 3).info[0]).toEqual(t.info[2]);
    // Nonsense picks (repeats, too few, out of range) fall back to the first ones brought.
    for (const bad of [[0, 0, 1], [1, 2], [0, 1, 9], undefined]) expect(chooseFighters(t, bad, 3).fighters.map((f) => f.name)).toEqual(t.fighters.map((f) => f.name));
    expect(firstPicks(3)).toEqual([0, 1, 2]);
  });

  it("refuses a team of the wrong size or level", () => {
    expect(teamFits(team(0), FMT)).toBe(true);
    expect(teamFits(team(0, 20), FMT)).toBe(false);
    expect(teamFits({ fighters: team(0).fighters.slice(0, 2), info: team(0).info.slice(0, 2) }, FMT)).toBe(false);
  });
});

describe("a duel between two machines", () => {
  it("goes from joining to picking, the lead room and the battle", () => {
    const p = pair();
    p.join();
    expect(p.host.view.phase).toBe("pick");
    expect(p.guest.view.phase).toBe("pick");
    p.host.pickTeam(team(0));
    p.flush();
    expect(p.host.view).toMatchObject({ phase: "pick", sent: true });
    p.guest.pickTeam(team(10));
    p.flush();
    // Each sees both teams: its own as "mine".
    const hv = p.host.view, gv = p.guest.view;
    expect(hv.phase === "lead" && hv.theirs.fighters[0].name).toBe(team(10).fighters[0].name);
    expect(gv.phase === "lead" && gv.mine.fighters[0].name).toBe(team(10).fighters[0].name);
    p.host.chooseLead([1, 0, 2]);
    p.guest.chooseLead([2, 0, 1]);
    p.flush();
    const h = battleOf(p.host.view), g = battleOf(p.guest.view);
    expect(h.state.sides.A.team[0].name).toBe(team(0).fighters[1].name);
    expect(h.state.sides.B.team[0].name).toBe(team(10).fighters[2].name);
    // The guest's copy is the same battle, mirrored.
    expect(g.state.sides.A.team[0].name).toBe(team(10).fighters[2].name);
    expect(g.state.sides.B.team[0].hp).toBe(h.state.sides.A.team[0].hp);
  });

  it("plays a round once both have chosen, and both copies agree", () => {
    const p = pair();
    toBattle(p);
    const before = battleOf(p.host.view).state.round;
    p.host.act(steadyAction(battleOf(p.host.view).state, "A"));
    p.flush();
    expect(battleOf(p.host.view).state.round).toBe(before); // still waiting for the guest
    p.guest.act(steadyAction(battleOf(p.guest.view).state, "A"));
    p.flush();
    const h = battleOf(p.host.view).state, g = battleOf(p.guest.view).state;
    expect(h.round).toBe(before + 1);
    expect(g.round).toBe(h.round);
    expect(g.sides.A.team.map((f) => f.hp)).toEqual(h.sides.B.team.map((f) => f.hp));
    expect(g.sides.B.team.map((f) => f.hp)).toEqual(h.sides.A.team.map((f) => f.hp));
    expect(g.log.length).toBe(h.log.length);
  });

  it("fights to the end with steady moves and replacements, both seeing the same result", () => {
    const p = pair();
    toBattle(p);
    for (let n = 0; n < 500 && p.host.view.phase === "battle"; n++) {
      for (const d of [p.host, p.guest]) {
        const v = d.view;
        if (v.phase !== "battle" || v.sent) continue;
        if (v.state.needsReplacement.includes("A")) d.replace(v.state.sides.A.team.findIndex((f, i) => f.hp > 0 && i !== v.state.sides.A.active));
        else d.act(steadyAction(v.state, "A"));
      }
      p.flush();
    }
    const h = p.host.view, g = p.guest.view;
    expect(h.phase).toBe("over");
    expect(g.phase).toBe("over");
    if (h.phase !== "over" || g.phase !== "over") return;
    const flipped = { win: "loss", loss: "win", draw: "draw" } as const;
    expect(g.result).toBe(flipped[h.result]);
    expect(h.reason).toBe("battle");
  });

  it("makes a steady move for a player whose time runs out", () => {
    const p = pair();
    toBattle(p);
    p.host.act(steadyAction(battleOf(p.host.view).state, "A"));
    p.flush();
    p.tick(TURN_SECONDS * 1000 + 1);
    expect(battleOf(p.host.view).state.round).toBe(1);
  });

  it("picks a team for a player whose picking time runs out", () => {
    const p = pair();
    p.join();
    p.host.pickTeam(team(0));
    p.tick(PICK_SECONDS * 1000 + 1);
    expect(p.host.view.phase).toBe("lead");
    expect(p.guest.view.phase).toBe("lead");
  });

  it("gets over lost messages: the guest says it again, the host sends the whole state", () => {
    let dropNext = 2; // the first two rounds' results never reach the guest
    const p = pair({ drop: (m, to) => to === "guest" && m.t === "round" && dropNext-- > 0 });
    toBattle(p);
    for (let r = 0; r < 2; r++) {
      p.host.act(steadyAction(battleOf(p.host.view).state, "A"));
      p.guest.act(steadyAction(battleOf(p.guest.view).state, "A"));
      p.flush();
      p.tick(RESEND_MS);
    }
    const h = battleOf(p.host.view).state, g = battleOf(p.guest.view).state;
    expect(g.round).toBe(h.round);
    expect(g.sides.A.team.map((f) => f.hp)).toEqual(h.sides.B.team.map((f) => f.hp));
  });

  it("the host makes the guest's move if it never arrives", () => {
    const p = pair({ drop: (m) => m.t === "action" });
    toBattle(p);
    p.host.act(steadyAction(battleOf(p.host.view).state, "A"));
    p.tick((TURN_SECONDS + GRACE_SECONDS) * 1000 + 1);
    expect(battleOf(p.host.view).state.round).toBe(1);
  });

  it("leaving loses, and so does being gone too long", () => {
    const a = pair();
    toBattle(a);
    a.guest.forfeit();
    a.flush();
    expect(a.host.view).toMatchObject({ phase: "over", result: "win", reason: "forfeit" });
    expect(a.guest.view).toMatchObject({ phase: "over", result: "loss" });

    const b = pair();
    toBattle(b);
    b.host.peer(false);
    b.tick(GONE_SECONDS * 1000 - 1000);
    expect(b.host.view.phase).toBe("battle");
    b.host.peer(true); // back in time
    b.tick(2000);
    expect(b.host.view.phase).toBe("battle");
    b.host.peer(false);
    b.tick(GONE_SECONDS * 1000 + 1);
    expect(b.host.view).toMatchObject({ phase: "over", result: "win", reason: "gone" });
  });

  it("an invite can be declined, or lapse unanswered", () => {
    const a = pair();
    a.host.start();
    a.guest.decline();
    a.flush();
    expect(a.host.view.phase).toBe("cancelled");

    const b = pair();
    b.host.start();
    b.tick(INVITE_SECONDS * 1000 + 1);
    expect(b.host.view.phase).toBe("cancelled");
  });

  it("rejects moves that aren't allowed (no battle bag in a duel)", () => {
    const p = pair();
    toBattle(p);
    p.guest.act({ kind: "item", item: "Potion", heal: 999 });
    expect(battleOf(p.guest.view).sent).toBe(false);
  });

  it("a guest that missed the end hears it again", () => {
    let drop = true;
    const p = pair({ drop: (m, to) => drop && to === "guest" && m.t !== "snap" });
    toBattle(p);
    p.host.forfeit();
    p.flush();
    expect(p.guest.view.phase).toBe("battle"); // the forfeit got lost
    drop = false;
    p.guest.start();
    p.flush();
    expect(p.guest.view).toMatchObject({ phase: "over", result: "win" });
  });
});


describe("custom duels (the user, 2026-11-02)", () => {
  it("default to 3v3, Rare, up to Lv 15, not scaled up", () => {
    const f = makeFormat(DEFAULT_PVP);
    expect(f).toMatchObject({ size: 3, maxRarity: "rare", level: 15, scaleUp: false, id: "3v3-rare-15", name: "3v3 · Rare · up to Lv 15" });
    expect(makeFormat({ size: 5, maxRarity: "rare", level: 25, scaleUp: true }).name).toBe("5v5 · Rare · Lv 25");
  });

  it("travel as an id, and only real choices read back (old ids too)", () => {
    for (const o of [DEFAULT_PVP, { size: 5, maxRarity: "legendary" as const, level: 25, scaleUp: true }, { size: 5, maxRarity: "epic" as const, level: 15, scaleUp: false }])
      expect(parseFormat(makeFormat(o).id)).toEqual(makeFormat(o));
    expect(parseFormat("5v5-legendary")).toMatchObject({ size: 5, maxRarity: "legendary", level: 25, scaleUp: true });
    for (const bad of ["3v5-rare-15", "4v4-rare-15", "3v3-mythic-15", "3v3-rare-99", "3v3-rare-15-x", "", 7, null]) expect(parseFormat(bad)).toBeNull();
  });

  it("not scaled: only those above the level come down to it; scaled: everyone's at it", () => {
    const down = makeFormat(DEFAULT_PVP), all = makeFormat({ ...DEFAULT_PVP, scaleUp: true });
    expect([duelLevel(8, down), duelLevel(15, down), duelLevel(30, down)]).toEqual([8, 15, 15]);
    expect([duelLevel(8, all), duelLevel(30, all)]).toEqual([15, 15]);
    expect(teamFits(team(0, 8), down)).toBe(true);
    expect(teamFits(team(0, 16), down)).toBe(false);
    expect(teamFits(team(0, 8), all)).toBe(false);
  });

  it("you bring the size and up to 2 more", () => {
    const f = makeFormat(DEFAULT_PVP);
    expect(BRING_EXTRA).toBe(2);
    expect(bringMax(f)).toBe(5);
    expect(teamFits(team(0, 15, 2), f)).toBe(false);
    for (const n of [3, 4, 5]) expect(teamFits(team(0, 15, n), f)).toBe(true);
    expect(teamFits(team(0, 15, 6), f)).toBe(false);
  });

  it("both see who the other brought, then each picks who fights", () => {
    const f = makeFormat(DEFAULT_PVP);
    const p = pair({ format: f });
    p.join();
    p.host.pickTeam(team(0, 15, 5)); p.guest.pickTeam(team(10, 15, 5)); p.flush();
    const hv = p.host.view;
    expect(hv.phase === "lead" && hv.theirs.fighters.length).toBe(5);
    p.host.chooseLead([4, 1, 3]); p.guest.chooseLead([0, 2, 4]); p.flush();
    const h = battleOf(p.host.view);
    expect(h.state.sides.A.team.map((x) => x.name)).toEqual([4, 1, 3].map((i) => team(0, 15, 5).fighters[i].name));
    expect(h.state.sides.B.team.map((x) => x.name)).toEqual([0, 2, 4].map((i) => team(10, 15, 5).fighters[i].name));
    expect(battleOf(p.guest.view).state.sides.A.team[0].name).toBe(team(10, 15, 5).fighters[0].name);
  });

  it("out of time choosing: the first 3 brought fight", () => {
    const p = pair({ format: makeFormat(DEFAULT_PVP) });
    p.join();
    p.host.pickTeam(team(0, 15, 5)); p.guest.pickTeam(team(10, 15, 5)); p.flush();
    p.host.chooseLead([2, 3, 4]);
    p.tick(60_000);
    const h = battleOf(p.host.view);
    expect(h.state.sides.B.team.map((x) => x.name)).toEqual(team(10, 15, 5).fighters.slice(0, 3).map((x) => x.name));
  });
});
