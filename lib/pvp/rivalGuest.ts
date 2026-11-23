// lib/pvp/rivalGuest.ts
// A simulated rival as the other player in a duel (docs/design/online.md
// §12, Ranked). It takes the guest's place against the host's Duel machine
// (lib/pvp/duel.ts), in the same browser: the host sends it each message
// as it would over the wire, and it answers as a player would, with the
// hard AI's choices (lib/combat/thinkingAi.ts). So a ranked match plays on
// the duel screen unchanged (bring your team, the lead room, the battle),
// with no connection and nothing new to draw.
//
// It answers after a short pause (ANSWER_MS), so it feels like someone
// thinking rather than a reflex; tests pass `later: (f) => f()`.

import type { BattleState } from "../combat/battle";
import { chooseAiAction, chooseAiReplacement, type AiLevel } from "../combat/thinkingAi";
import { mirrorBattle, duelActionOk, steadyAction, firstStanding, firstPicks, type DuelMsg, type DuelTeam } from "./duel";
import type { PvpFormat } from "./formats";
import { RIVAL_PVP_AI } from "./rivalMatch";

export const ANSWER_MS: [number, number] = [900, 2200];

export type RivalGuestOptions = {
  format: PvpFormat;
  team: DuelTeam;                       // what it brings (rivalTeam)
  send: (m: DuelMsg) => void;           // to the host
  level?: AiLevel;
  later?: (f: () => void, ms: number) => void;
  rng?: () => number;
};

export class RivalGuest {
  private readonly format: PvpFormat;
  private readonly team: DuelTeam;
  private readonly send: (m: DuelMsg) => void;
  private readonly level: AiLevel;
  private readonly later: (f: () => void, ms: number) => void;
  private readonly rng: () => number;
  private seq = -1;      // the last step it answered
  private battle?: BattleState; // in its own view (A = the rival)
  done = false;

  constructor(o: RivalGuestOptions) {
    this.format = o.format;
    this.team = o.team;
    this.send = o.send;
    this.level = o.level ?? RIVAL_PVP_AI;
    this.later = o.later ?? ((f, ms) => { setTimeout(f, ms); });
    this.rng = o.rng ?? Math.random;
  }

  // Joined: say hello (the host begins the picking).
  start() { this.send({ t: "hello", from: "guest" }); }

  // Leaving (the player left first): nothing to say.
  stop() { this.done = true; }

  private pause(f: () => void) {
    const ms = ANSWER_MS[0] + this.rng() * (ANSWER_MS[1] - ANSWER_MS[0]);
    this.later(() => { if (!this.done) f(); }, ms);
  }

  receive(m: DuelMsg) {
    if (this.done) return;
    if (m.t === "forfeit") { this.done = true; return; }
    if (m.t !== "snap" && m.t !== "round") return;
    if (m.t === "snap" && m.phase === "pick") { this.pause(() => this.send({ t: "team", team: this.team })); return; }
    if (m.t === "snap" && m.phase === "lead") { this.pause(() => this.send({ t: "lead", picks: this.lead(m.guest) })); return; }
    if (m.t === "snap" && m.phase === "over") { this.done = true; return; }
    // (A round comes without the log, which isn't needed to choose.)
    const state: BattleState = m.t === "round" ? { ...m.state, log: [] } : m.state;
    this.step(mirrorBattle(state), m.seq);
  }

  // Who fights, from what it brought: the first of the format's size (the team comes strongest first).
  private lead(brought: DuelTeam): number[] { return firstPicks(Math.min(this.format.size, brought.fighters.length)); }

  // A new step of the battle: its replacement or its move, by the AI.
  private step(mine: BattleState, seq: number) {
    this.battle = mine;
    if (mine.winner) { this.done = true; return; }
    if (seq <= this.seq) return;
    this.seq = seq;
    if (mine.needsReplacement.includes("A")) {
      const index = chooseAiReplacement(mine, "A", this.level);
      const ok = mine.sides.A.team[index]?.hp > 0 && index !== mine.sides.A.active ? index : firstStanding(mine, "A");
      this.pause(() => this.send({ t: "replace", seq, index: ok }));
    } else if (!mine.needsReplacement.length) {
      const action = chooseAiAction(mine, "A", this.level);
      this.pause(() => this.send({ t: "action", seq, action: duelActionOk(mine, "A", action) ? action : steadyAction(mine, "A") }));
    }
  }
}
