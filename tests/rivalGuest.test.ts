// tests/rivalGuest.test.ts: a simulated rival as the other player in a duel (lib/pvp/rivalGuest.ts), and
// rivals fighting each other (lib/pvp/rivalMatch.ts).
import { describe, expect, it } from "vitest";
import { CREATURE_TEMPLATES } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { chooseAiAction, chooseAiReplacement, type AiLevel } from "../lib/combat/thinkingAi";
import { Duel, type DuelMsg, type DuelTeam, type DuelView } from "../lib/pvp/duel";
import { RANKED_FORMATS } from "../lib/pvp/ranked";
import { RivalGuest } from "../lib/pvp/rivalGuest";
import { playRivalMatch } from "../lib/pvp/rivalMatch";
import { RIVALS, rivalTeam } from "../lib/pvp/rivals";

const FMT = RANKED_FORMATS["3v3"];
const team = (offset: number, n: number, f = FMT): DuelTeam => {
  const ts = CREATURE_TEMPLATES.filter((t) => !t.boss && !t.companion).slice(offset, offset + n);
  return { fighters: ts.map((t) => buildFighter(t, undefined, undefined, undefined, undefined, undefined, undefined, f.level)),
    info: ts.map((t) => ({ rarity: t.rarity, label: t.name, creatureId: t.id })) };
};

// A ranked match in one browser: the host's machine and the rival, wired straight to each other. The host (the
// player) is played here by the normal AI. Returns how it ended for the player.
function playRanked(f = FMT, rival: DuelTeam = team(8, f.size + 2, f), mine: DuelTeam = team(0, f.size + 2, f), level: AiLevel = "normal") {
  let now = 1_000_000;
  const views: DuelView[] = [];
  // (Each is wired to the other; neither speaks before both exist.)
  const host = new Duel({ role: "host", format: f, now: () => now, autoTeam: () => mine, send: (m: DuelMsg) => guest.receive(JSON.parse(JSON.stringify(m))), onChange: (v) => views.push(v) });
  const guest = new RivalGuest({ format: f, team: rival, send: (m) => host.receive(JSON.parse(JSON.stringify(m))), later: (fn) => fn(), rng: () => 0.5, level });
  host.peer(true);
  guest.start();
  for (let guard = 0; guard < 600 && host.view.phase !== "over" && host.view.phase !== "cancelled"; guard++) {
    const v = host.view;
    if (v.phase === "pick" && !v.sent) host.pickTeam(mine);
    else if (v.phase === "lead" && !v.sent) host.chooseLead([0, 1, 2, 3, 4].slice(0, f.size));
    else if (v.phase === "battle" && !v.sent) {
      if (v.state.needsReplacement.includes("A")) host.replace(chooseAiReplacement(v.state, "A", "normal"));
      else if (!v.state.needsReplacement.length) host.act(chooseAiAction(v.state, "A", "normal"));
    }
    now += 1000;
    host.tick();
  }
  return { host, views, guest };
}

describe("a rival as the other player", () => {
  it("brings its team, picks its lead and plays every round, so a ranked match ends", () => {
    const { host, views } = playRanked();
    expect(host.view.phase).toBe("over");
    if (host.view.phase !== "over") return;
    expect(host.view.reason).toBe("battle");
    expect(["win", "loss", "draw"]).toContain(host.view.result);
    expect(host.view.state?.winner).toBeTruthy();
    // Every phase was passed through, and the rival's side was its own team.
    expect(views.some((v) => v.phase === "lead")).toBe(true);
    const lead = views.find((v) => v.phase === "lead");
    if (lead?.phase === "lead") expect(lead.theirs.fighters.map((x) => x.name)).toEqual(team(8, FMT.size + 2).fighters.map((x) => x.name));
    const battle = views.find((v) => v.phase === "battle");
    if (battle?.phase === "battle") expect(battle.state.sides.B.team).toHaveLength(FMT.size);
  });

  it("plays the 5v5 queue too", () => {
    const f = RANKED_FORMATS["5v5"];
    const { host } = playRanked(f, team(10, f.size + 2, f), team(0, f.size + 2, f));
    expect(host.view.phase).toBe("over");
  });

  it("stops answering once told to", () => {
    const sent: DuelMsg[] = [];
    const g = new RivalGuest({ format: FMT, team: team(8, 5), send: (m) => sent.push(m), later: (fn) => fn() });
    g.stop();
    g.receive({ t: "snap", phase: "pick" });
    expect(sent).toEqual([]);
  });
});

describe("the rivals in the repo", () => {
  // (The normal AI for the rival here, to keep the test quick; in the game it plays hard.)
  it.skipIf(RIVALS.length === 0)("each plays a ranked match against a player and against each other", () => {
    for (const q of ["3v3", "5v5"] as const) {
      const f = RANKED_FORMATS[q];
      const { host } = playRanked(f, rivalTeam(RIVALS[0], f), team(0, f.size + 2, f), "normal");
      expect(host.view.phase).toBe("over");
    }
    const m = playRivalMatch(RIVALS[0], RIVALS[1 % RIVALS.length], FMT, "normal");
    expect(m).not.toBeNull();
    expect(["a", "b", "draw"]).toContain(m!.winner);
    expect(m!.state.winner).toBeTruthy();
  });
});
