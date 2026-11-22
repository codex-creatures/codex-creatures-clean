// tests/duelFaults.test.ts: duels over a bad connection (lib/pvp/duel.ts). Two machines linked in the test, with
// messages lost, late and out of order, players dropping out and coming back, and both running out of time:
// whatever happens, both must end up with the same story (docs/polish-audit-2026-11.md, bugs).
import { describe, expect, it } from "vitest";
import { CREATURE_TEMPLATES } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { Duel, mirrorBattle, steadyAction, RESEND_MS, type DuelMsg, type DuelTeam, type DuelView } from "../lib/pvp/duel";
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
