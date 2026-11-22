// tests/duelFaults.test.ts: duels over a bad connection (lib/pvp/duel.ts). Two machines linked in the test, with
// messages lost, late and out of order, players dropping out and coming back, and both running out of time:
// whatever happens, both must end up with the same story (docs/polish-audit-2026-11.md, bugs).
import { describe, expect, it } from "vitest";
import { CREATURE_TEMPLATES } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { activeOf, affordableSkills, attackTargets, type BattleAction } from "../lib/combat/battle";
import { Duel, duelActionOk, mirrorBattle, steadyAction, RESEND_MS, type DuelMsg, type DuelTeam, type DuelView } from "../lib/pvp/duel";
import { slowIt } from "./slow";
import { PVP_FORMATS, GONE_SECONDS, GRACE_SECONDS, PICK_SECONDS } from "../lib/pvp/formats";

const FMT = PVP_FORMATS["3v3-rare"];
const team = (offset: number, n = FMT.size): DuelTeam => {
  const ts = Array.from({ length: n }, (_, i) => CREATURE_TEMPLATES[(offset + i) % CREATURE_TEMPLATES.length]);
  return { fighters: ts.map((t) => buildFighter(t, undefined, undefined, undefined, undefined, undefined, undefined, FMT.level)),
    info: ts.map((t) => ({ rarity: t.rarity, label: t.name, creatureId: t.id })) };
};

type To = "host" | "guest";
// Two machines and the wire between them. `lose`: this message never arrives; `late`: ms it takes (so messages can
// overtake each other). The clock is shared; step() moves it on, ticks both and delivers what's due.
function link(o: { lose?: (m: DuelMsg, to: To, now: number) => boolean; late?: (m: DuelMsg, to: To) => number; teams?: [DuelTeam, DuelTeam] } = {}) {
  let now = 1_000_000, n = 0;
  const wire: { at: number; n: number; to: To; m: DuelMsg }[] = [];
  const [th, tg] = o.teams ?? [team(0), team(10)];
  const mk = (role: To, t: DuelTeam) => new Duel({
    role, format: FMT, now: () => now, autoTeam: () => t,
    send: (m) => { const to: To = role === "host" ? "guest" : "host"; if (!o.lose?.(m, to, now)) wire.push({ at: now + (o.late?.(m, to) ?? 0), n: n++, to, m: JSON.parse(JSON.stringify(m)) }); },
  });
  const host = mk("host", th), guest = mk("guest", tg);
  const deliver = () => {
    for (let k = 0; k < 2000; k++) {
      const due = wire.filter((w) => w.at <= now).sort((a, b) => a.at - b.at || a.n - b.n)[0];
      if (!due) return;
      wire.splice(wire.indexOf(due), 1);
      (due.to === "host" ? host : guest).receive(due.m);
    }
    throw new Error("the two never stopped talking");
  };
  const step = (ms: number) => { now += ms; host.tick(); guest.tick(); deliver(); };
  const run = (secs: number, every = 500) => { for (let t = 0; t < secs * 1000; t += every) step(every); };
  const join = () => { host.start(); guest.start(); host.peer(true); guest.peer(true); deliver(); };
  const toBattle = () => { join(); host.pickTeam(th); guest.pickTeam(tg); deliver(); host.chooseLead([0, 1, 2]); guest.chooseLead([0, 1, 2]); deliver(); };
  // Time passing with only the host awake (the guest's phone asleep: it doesn't tick).
  const hostOnly = (secs: number, every = 500) => { for (let t = 0; t < secs * 1000; t += every) { now += every; host.tick(); deliver(); } };
  const guestOnly = (secs: number, every = 500) => { for (let t = 0; t < secs * 1000; t += every) { now += every; guest.tick(); deliver(); } };
  return { host, guest, deliver, step, run, hostOnly, guestOnly, join, toBattle, teams: [th, tg] as const, at: () => now };
}
type Link = ReturnType<typeof link>;
const flipped = { win: "loss", loss: "win", draw: "draw" } as const;
const over = (v: DuelView) => { if (v.phase !== "over") throw new Error(`not over: ${v.phase}`); return v; };

// One choice for whoever can make one: the steady move, or the first replacement standing.
function playSteady(d: Duel) {
  const v = d.view;
  if (v.phase !== "battle" || v.sent) return;
  if (v.state.needsReplacement.includes("A")) d.replace(v.state.sides.A.team.findIndex((f, i) => f.hp > 0 && i !== v.state.sides.A.active));
  else d.act(steadyAction(v.state, "A"));
}
// The two tell the same story: over, opposite results, the same reason, and the guest's last picture of the
// battle is the host's, mirrored.
function sameStory(p: Link) {
  const h = over(p.host.view), g = over(p.guest.view);
  expect(g.result).toBe(flipped[h.result]);
  expect(g.reason).toBe(h.reason);
  if (h.reason === "battle") expect(JSON.parse(JSON.stringify(g.state))).toEqual(JSON.parse(JSON.stringify(mirrorBattle(h.state!))));
}

describe("a duel's end always reaches the guest", () => {
  it("the last round's message lost: the guest's next word gets it the result, and the battle as it ended", () => {
    let lose = true;
    const p = link({ lose: (m, to) => lose && to === "guest" && m.t === "round" && !!m.state.winner });
    p.toBattle();
    for (let n = 0; n < 500 && p.host.view.phase === "battle"; n++) { playSteady(p.host); playSteady(p.guest); p.deliver(); }
    expect(p.host.view).toMatchObject({ phase: "over", reason: "battle" });
    expect(p.guest.view.phase).toBe("battle"); // (it never heard)
    lose = false;
    p.run(RESEND_MS / 1000 + 1); // (the guest says its last choice again; the host, finished, tells it how it ended)
    sameStory(p);
  });

  it("…and it isn't told it won when the host then leaves", () => {
    const p = link({ lose: (m, to) => to === "guest" && m.t === "round" && !!m.state.winner });
    p.toBattle();
    for (let n = 0; n < 500 && p.host.view.phase === "battle"; n++) { playSteady(p.host); playSteady(p.guest); p.deliver(); }
    const h = over(p.host.view);
    // The host reads the result and goes back to the portal; the guest's connection is still bad.
    p.guest.peer(false);
    p.run(GONE_SECONDS + 5);
    const g = p.guest.view;
    if (g.phase === "over") expect(g.result).toBe(flipped[h.result]); // (never a win for both)
    else expect(g.phase).toBe("battle");
  });

  it("out of time picking a team, with the host's word of it lost: the guest hears it lost on its next word", () => {
    let lose = true;
    const p = link({ lose: (m, to) => lose && to === "guest" && m.t === "snap" && m.phase === "over" });
    p.join();
    p.host.pickTeam(p.teams[0]); p.deliver();
    // The guest's game is asleep (a phone's screen off): it doesn't tick. The host waits, then calls it.
    p.hostOnly(PICK_SECONDS + GRACE_SECONDS + 2);
    expect(p.host.view).toMatchObject({ phase: "over", result: "win", reason: "gone" });
    expect(p.guest.view.phase).toBe("pick");
    lose = false;
    p.run(RESEND_MS / 1000 + 2); // (awake again: out of time, it sends a team; the host tells it it's over)
    expect(p.guest.view).toMatchObject({ phase: "over", result: "loss", reason: "gone" });
  });

  it("gone too long, then back: it's told it lost, whatever it says next", () => {
    for (const stage of ["pick", "lead", "battle"] as const) {
      const p = link();
      p.join();
      if (stage !== "pick") { p.host.pickTeam(p.teams[0]); p.guest.pickTeam(p.teams[1]); p.deliver(); }
      if (stage === "battle") { p.host.chooseLead([0, 1, 2]); p.guest.chooseLead([0, 1, 2]); p.deliver(); }
      expect(p.guest.view.phase).toBe(stage);
      // The guest drops off the channel for longer than it's waited for (its own game asleep too).
      p.host.peer(false);
      p.hostOnly(GONE_SECONDS + 2);
      expect(p.host.view).toMatchObject({ phase: "over", result: "win", reason: "gone" });
      // Back, and none the wiser: it makes its choice.
      p.host.peer(true);
      if (stage === "pick") p.guest.pickTeam(p.teams[1]);
      else if (stage === "lead") p.guest.chooseLead([0, 1, 2]);
      else playSteady(p.guest);
      p.deliver();
      p.run(RESEND_MS / 1000 + 2);
      expect(p.guest.view, stage).toMatchObject({ phase: "over", result: "loss", reason: "gone" });
    }
  });
});

describe("a guest with nothing to say still asks", () => {
  // Waiting for the host to send in a replacement, the guest has no choice of its own to repeat. If the host's
  // next message was lost, nobody said anything: the guest sat on "Waiting…" until the host's own clock ran out
  // (40 s) and made the guest's move for it.
  it("the host's replacement lost on the way: the guest asks, gets the battle as it is, and makes its own move", () => {
    let lose = false;
    const p = link({ lose: (_, to) => lose && to === "guest" });
    p.toBattle();
    // Play till only the host's creature is down (the guest waits on the host's replacement).
    for (let n = 0; n < 500; n++) {
      const g = p.guest.view;
      if (g.phase !== "battle") throw new Error("the battle ended before the host lost a creature alone: pick other teams");
      if (g.state.needsReplacement.length === 1 && g.state.needsReplacement[0] === "B") break;
      playSteady(p.host); playSteady(p.guest); p.deliver();
    }
    expect(p.guest.view).toMatchObject({ phase: "battle", sent: true });
    const before = (p.guest.view as { seq: number }).seq;
    lose = true;
    playSteady(p.host); p.deliver(); // (the host sends its replacement in; the news of it never arrives)
    lose = false;
    expect(p.host.view).toMatchObject({ phase: "battle", seq: before + 1 });
    expect(p.guest.view).toMatchObject({ phase: "battle", seq: before, sent: true });
    p.run(RESEND_MS / 1000 + 1);
    expect(p.guest.view).toMatchObject({ phase: "battle", seq: before + 1, sent: false }); // (its turn, in good time)
  });

  it("…and if the duel ended meanwhile, it hears that", () => {
    let lose = false;
    const p = link({ lose: (_, to) => lose && to === "guest" });
    p.toBattle();
    for (let n = 0; n < 500; n++) {
      const g = p.guest.view;
      if (g.phase !== "battle") throw new Error("the battle ended before the host lost a creature alone: pick other teams");
      if (g.state.needsReplacement.length === 1 && g.state.needsReplacement[0] === "B") break;
      playSteady(p.host); playSteady(p.guest); p.deliver();
    }
    lose = true;
    p.host.forfeit(); p.deliver(); // (the host leaves instead; that's lost too)
    lose = false;
    p.run(RESEND_MS / 1000 + 1);
    expect(p.guest.view).toMatchObject({ phase: "over", result: "win", reason: "forfeit" });
  });
});

describe("a duel's end always reaches the host", () => {
  it("the host gone too long (its phone asleep), then back: it's told it lost, and doesn't play on against nobody", () => {
    let asleep = false;
    const p = link({ lose: (_, to) => asleep && to === "host" });
    p.toBattle();
    // The host drops off the channel (nothing reaches it); the guest, awake, waits its 30 seconds and takes the win.
    asleep = true;
    p.guest.peer(false);
    p.guestOnly(GONE_SECONDS + 2);
    expect(p.guest.view).toMatchObject({ phase: "over", result: "win", reason: "gone" });
    expect(p.host.view.phase).toBe("battle");
    // The host wakes and plays on: its next word to the guest is answered with how it ended.
    asleep = false;
    p.guest.peer(true);
    for (let n = 0; n < 400 && p.host.view.phase === "battle"; n++) { playSteady(p.host); p.step(500); }
    expect(p.host.view).toMatchObject({ phase: "over", result: "loss", reason: "gone" });
  });
});

// ── Many duels over a bad line ──
// Each game: its own dice (so a failing one can be played again by its number) for the teams, who leads, every
// choice (any move that's allowed, a swap, a replacement; now and then no choice at all, so time runs out), which
// messages are lost and how late the rest are (so they overtake each other), and the odd drop-out shorter than
// the 30 seconds that loses. Whatever happens: nothing breaks, the duel ends, and both tell the same story.
const dice = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// The same thing, whatever order its fields were written in (a copy that's been down the wire has them in another).
const canon = (v: unknown): string => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const same = (a: unknown, b: unknown) => canon(a) === canon(b);

function anyChoice(d: Duel, rng: () => number) {
  const v = d.view, pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  if (v.phase !== "battle" || v.sent || v.state.winner) return;
  const s = v.state.sides.A;
  if (v.state.needsReplacement.includes("A")) { d.replace(pick(s.team.flatMap((f, i) => (f.hp > 0 && i !== s.active ? [i] : [])))); return; }
  if (v.state.needsReplacement.length) return;
  const all: BattleAction[] = [
    ...affordableSkills(activeOf(s)).map((sk): BattleAction => { const ts = attackTargets(v.state, "A"); return { kind: "attack", skillName: sk.name, ...(ts.length > 1 ? { target: pick(ts) } : {}) }; }),
    ...s.team.flatMap((f, i): BattleAction[] => (f.hp > 0 && i !== s.active ? [{ kind: "swap", to: i }] : [])),
    { kind: "pass" },
  ];
  const options = all.filter((a) => duelActionOk(v.state, "A", a));
  if (options.length) d.act(pick(options));
}

// One duel, start to finish. Returns what went wrong (null: nothing).
function badLine(seed: number, lossy: number): string | null {
  const rng = dice(seed);
  const teams: [DuelTeam, DuelTeam] = [team(Math.floor(rng() * 200), FMT.size + Math.floor(rng() * 3)), team(Math.floor(rng() * 200), FMT.size + Math.floor(rng() * 3))];
  const p = link({ teams, lose: () => rng() < lossy, late: () => (rng() < 0.3 ? Math.floor(rng() * 6000) : 0) });
  const lazy = [rng() < 0.2 ? 0.5 : 0.05, rng() < 0.2 ? 0.5 : 0.05]; // (how often each just doesn't choose this half second)
  const leads = () => { const n = teams[0].fighters.length; return Array.from({ length: n }, (_, i) => i).sort(() => rng() - 0.5).slice(0, FMT.size); };
  p.join();
  let away: { who: Duel; till: number } | null = null, checked = 0;
  for (let t = 0; t < 3600 * 2; t++) { // (an hour of the duel's own time, a half second at a time)
    const h = p.host.view, g = p.guest.view;
    if (h.phase === "over" && g.phase === "over") break;
    // A guest that never got in (every answer to its hellos lost for 20 seconds: it happens on the worst lines)
    // has given up, and says so; the host, who saw it arrive, waits out the picking time and takes the win.
    if (g.phase === "cancelled") {
      if (h.phase === "over") return h.result === "win" && h.reason === "gone" ? null : `the guest gave up joining, the host ${h.result} (${h.reason})`;
      if (h.phase === "cancelled") return null;
      if (h.phase === "lead" || h.phase === "battle") return `the guest gave up joining, the host in ${h.phase}`;
    }
    if (h.phase === "cancelled") return `the host cancelled: ${JSON.stringify(h)}`;
    // Both in the same round of the battle: the guest sees the host's battle, mirrored. (Once a round: it's a big sum.)
    if (h.phase === "battle" && g.phase === "battle" && h.seq === g.seq && h.seq !== checked) {
      checked = h.seq;
      if (!same(g.state, mirrorBattle(h.state))) return `round ${h.seq}: the guest's battle isn't the host's, mirrored`;
    }
    for (const [i, d] of [p.host, p.guest].entries()) {
      if (rng() < lazy[i]) continue;
      const v = d.view;
      if (v.phase === "pick" && !v.sent) d.pickTeam(teams[i]);
      else if (v.phase === "lead" && !v.sent) d.chooseLead(leads());
      else anyChoice(d, rng);
    }
    // Now and then one drops off the channel for up to 20 seconds (less than loses), as the other sees it.
    if (!away && rng() < 0.002) { away = { who: rng() < 0.5 ? p.host : p.guest, till: p.at() + 1000 + Math.floor(rng() * 19000) }; away.who.peer(false); }
    if (away && p.at() >= away.till) { away.who.peer(true); away = null; }
    p.step(500);
  }
  const h = p.host.view, g = p.guest.view;
  if (h.phase !== "over" || g.phase !== "over") return `not over after an hour: host ${h.phase}, guest ${g.phase}`;
  if (g.result !== flipped[h.result]) return `host ${h.result} (${h.reason}), guest ${g.result} (${g.reason})`;
  if (g.reason !== h.reason) return `host's reason ${h.reason}, guest's ${g.reason}`;
  if (h.reason === "battle" && !same(g.state, mirrorBattle(h.state!))) return "the guest's last picture of the battle isn't the host's, mirrored";
  return null;
}

describe("many duels over a bad line", () => {
  const sweep = (from: number, n: number, lossy: number) => {
    const wrong: string[] = [];
    for (let seed = from; seed < from + n; seed++) {
      let w: string | null;
      try { w = badLine(seed, lossy); } catch (e) { w = `threw: ${(e as Error).message}`; }
      if (w) wrong.push(`#${seed}: ${w}`);
    }
    return wrong;
  };
  it("a good line: 40 duels of any moves, both always seeing the same battle and the same end", () => {
    expect(sweep(1, 40, 0)).toEqual([]);
  });
  it("a bad line (1 message in 4 lost, some up to 6 s late): 15 duels still end the same for both", () => {
    expect(sweep(1000, 15, 0.25)).toEqual([]);
  });
  // (DUEL_SWEEP=1000 for a long soak: 3,000 duels, about 4 minutes. Run so on 2026-11-23: all the same for both.)
  const each = Number(process.env.DUEL_SWEEP) || 30;
  slowIt(`${each * 3} more, from a good line to half the messages lost`, () => {
    expect([...sweep(5000, each, 0.1), ...sweep(6000, each, 0.3), ...sweep(7000, each, 0.5)]).toEqual([]);
  }, 600_000);
});
