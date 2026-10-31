// lib/pvp/duel.ts
// A live duel between two players (docs/design.md §12), as a machine that
// only sends and receives messages: the connection itself (Supabase
// Realtime: lib/online/duelChannel.ts) is handed in, so tests can link two
// machines directly and nothing here needs the internet.
//
// How the two browsers agree (the kink §12 left to Claude): the player who
// sent the invite is the host, and their browser runs the fight. The other
// player (the guest) sends each choice to the host and is sent back what
// happened. So the combat rules (and their dice) run in one place only, as
// they do against the AI. The host's side is A in the real battle; each
// player's screen shows itself as A (the guest's copy is mirrored).
//
// The steps: both join → each picks a team (PICK_SECONDS) → both teams are
// shown and each picks who goes out first (LEAD_SECONDS) → the battle, one
// round at a time (TURN_SECONDS a move; a steady move is made for you when
// it runs out) → over. Leaving, or being gone for GONE_SECONDS, loses.
//
// Lost messages: the guest repeats its latest choice every RESEND_MS until
// the host has moved on, and the host answers anything out of date with the
// whole state again ("snap"). Not hardened against cheating (accepted for
// playtesting: §12).

import type { Fighter } from "../combat/engine";
import type { Rarity } from "../items/budgets";
import { isSteadyMove } from "../creatures/creatureData";
import {
  createBattle, resolveRound, sendInReplacement, cloneBattle, isValidAction, affordableSkills, activeOf, attackTargets,
  type BattleAction, type BattleEvent, type BattleState, type SideKey,
} from "../combat/battle";
import { GONE_SECONDS, GRACE_SECONDS, INVITE_SECONDS, LEAD_SECONDS, PICK_SECONDS, REPLACE_SECONDS, TURN_SECONDS, type PvpFormat } from "./formats";

export type DuelRole = "host" | "guest";
export const RESEND_MS = 4_000;
// A guest whose host never answers gives up after this.
export const JOIN_SECONDS = 20;

// What the screen shows about each team member (the same shape as the battle screen's MemberInfo).
export type DuelMember = { rarity: Rarity; label: string; weaponName?: string; armorName?: string; creatureId?: string };
export type DuelTeam = { fighters: Fighter[]; info: DuelMember[] };

// The host's state of the battle without its log (sent each round with just the new log lines).
type StateNoLog = Omit<BattleState, "log">;
export type DuelResult = "win" | "loss" | "draw";
export type OverReason = "battle" | "forfeit" | "gone";

export type DuelMsg =
  | { t: "hello"; from: DuelRole }
  | { t: "decline" }
  | { t: "forfeit" }
  | { t: "team"; team: DuelTeam }
  | { t: "lead"; index: number }
  | { t: "action"; seq: number; action: BattleAction }
  | { t: "replace"; seq: number; index: number }
  // From the host: where things are now (in the host's view: A is the host).
  | { t: "snap"; phase: "pick" }
  | { t: "snap"; phase: "lead"; host: DuelTeam; guest: DuelTeam }
  | { t: "snap"; phase: "battle"; seq: number; state: BattleState; info: Record<SideKey, DuelMember[]> }
  | { t: "snap"; phase: "over"; winner: SideKey | "draw"; reason: OverReason }
  | { t: "round"; seq: number; from: number; state: StateNoLog; log: BattleEvent[] };

// What this player's screen shows (always from their side: A is you).
// deadline: when this step's time runs out (ms, this device's clock).
// sent: your choice is in, waiting for theirs.
export type DuelView =
  | { phase: "waiting"; deadline: number }
  | { phase: "pick"; deadline: number; sent: boolean }
  | { phase: "lead"; deadline: number; mine: DuelTeam; theirs: DuelTeam; sent: boolean }
  | { phase: "battle"; state: BattleState; info: Record<SideKey, DuelMember[]>; seq: number; deadline: number; sent: boolean }
  | { phase: "over"; result: DuelResult; reason: OverReason; state?: BattleState; info?: Record<SideKey, DuelMember[]> }
  | { phase: "cancelled"; reason: string };

// ── Small rules ────────────────────────────────────────────────────────
// The move made for a player whose time ran out: a steady move (always
// affordable), else any affordable one, else a rest.
export function steadyAction(state: BattleState, key: SideKey): BattleAction {
  const me = activeOf(state.sides[key]);
  const can = affordableSkills(me);
  const pick = can.find(isSteadyMove) ?? can[0];
  if (!pick) return { kind: "pass" };
  const targets = attackTargets(state, key);
  return { kind: "attack", skillName: pick.name, ...(targets.length > 1 ? { target: targets[0] } : {}) };
}

// The replacement made for a player whose time ran out: the first one standing.
export const firstStanding = (state: BattleState, key: SideKey) =>
  state.sides[key].team.findIndex((f, i) => f.hp > 0 && i !== state.sides[key].active);

// A team with its chosen first creature moved to the front (the battle starts with index 0 out).
export function leadFirst(team: DuelTeam, index: number): DuelTeam {
  const i = index >= 0 && index < team.fighters.length ? index : 0;
  const order = [i, ...team.fighters.map((_, j) => j).filter((j) => j !== i)];
  return { fighters: order.map((j) => team.fighters[j]), info: order.map((j) => team.info[j]) };
}

const flip = (k: SideKey): SideKey => (k === "A" ? "B" : "A");

// The battle seen from the other side: A and B swapped everywhere.
export function mirrorBattle(state: BattleState): BattleState {
  const s = cloneBattle(state);
  return {
    ...s,
    sides: { A: { ...s.sides.B, key: "A" }, B: { ...s.sides.A, key: "B" } },
    needsReplacement: s.needsReplacement.map(flip),
    winner: s.winner === "A" || s.winner === "B" ? flip(s.winner) : s.winner,
    log: s.log.map((e) => ("side" in e ? { ...e, side: flip(e.side) } : e.type === "end" && e.winner !== "draw" ? { ...e, winner: flip(e.winner) } : e)),
  };
}

// No battle bag in a duel (gear only): items and weapon swaps aren't moves here.
export const duelActionOk = (state: BattleState, key: SideKey, a: BattleAction) =>
  a.kind !== "item" && a.kind !== "weapon" && isValidAction(state, key, a);

// A team from the other player, checked loosely (cheating is accepted for
// playtesting; this only stops a broken or wrong-format team).
export function teamFits(team: DuelTeam | undefined, f: PvpFormat): boolean {
  return !!team && Array.isArray(team.fighters) && Array.isArray(team.info) &&
    team.fighters.length === f.size && team.info.length === f.size &&
    team.fighters.every((x) => x && typeof x.name === "string" && x.maxHp > 0 && x.level === f.level && Array.isArray(x.skills) && x.skills.length > 0);
}

// ── The machine ─────────────────────────────────────────────────────────
export type DuelOptions = {
  role: DuelRole;
  format: PvpFormat;
  send: (msg: DuelMsg) => void;
  now?: () => number;
  // Your team when the picking time runs out before you lock one in.
  autoTeam: () => DuelTeam;
  onChange?: (view: DuelView) => void;
};

export class Duel {
  readonly role: DuelRole;
  readonly format: PvpFormat;
  private send: (m: DuelMsg) => void;
  private now: () => number;
  private autoTeam: () => DuelTeam;
  private onChange?: (v: DuelView) => void;

  view: DuelView;
  peerHere = false;
  private goneAt: number | null = null;
  private lastResend = 0;
  private joinedAt: number;

  // Mine (both roles).
  private myTeam?: DuelTeam;
  private myLead?: number;
  private myAction?: { seq: number; action: BattleAction };
  private myReplace?: { seq: number; index: number };

  // The host's own copy of everything.
  private guestTeam?: DuelTeam;
  private guestLead?: number;
  private hostTeams?: { host: DuelTeam; guest: DuelTeam };
  private battle?: BattleState;      // the real battle (A = host)
  private info?: Record<SideKey, DuelMember[]>;
  private seq = 0;
  private stepAt = 0;                // when the current step began (the host's grace timers)
  private guestAction?: BattleAction;
  private guestReplace?: number;
  private hostWinner?: { winner: SideKey | "draw"; reason: OverReason };

  constructor(o: DuelOptions) {
    this.role = o.role;
    this.format = o.format;
    this.send = o.send;
    this.now = o.now ?? Date.now;
    this.autoTeam = o.autoTeam;
    this.onChange = o.onChange;
    this.joinedAt = this.now();
    this.view = { phase: "waiting", deadline: this.joinedAt + (o.role === "host" ? INVITE_SECONDS : JOIN_SECONDS) * 1000 };
  }

  private set(v: DuelView) {
    this.view = v;
    this.onChange?.(v);
  }
  private get done() { return this.view.phase === "over" || this.view.phase === "cancelled"; }

  // Joined the channel: say so (the host answers the guest's hello with where things are).
  start() {
    this.send({ t: "hello", from: this.role });
  }

  // ── The other player comes and goes ──────────────────────────────────
  peer(present: boolean) {
    this.peerHere = present;
    this.goneAt = present ? null : this.goneAt ?? this.now();
    if (present && this.role === "host" && this.view.phase === "waiting") this.beginPick();
    this.onChange?.(this.view);
  }

  // ── Your choices ─────────────────────────────────────────────────────
  pickTeam(team: DuelTeam) {
    if (this.view.phase !== "pick" || this.view.sent) return;
    this.myTeam = team;
    this.set({ ...this.view, sent: true });
    if (this.role === "guest") this.send({ t: "team", team });
    else this.hostCheck();
  }

  chooseLead(index: number) {
    if (this.view.phase !== "lead" || this.view.sent) return;
    this.myLead = index;
    this.set({ ...this.view, sent: true });
    if (this.role === "guest") this.send({ t: "lead", index });
    else this.hostCheck();
  }

  // A move, swap or rest for the coming round (in your own view: swap
  // and target indexes are the same on both sides' copies).
  act(action: BattleAction) {
    const v = this.view;
    if (v.phase !== "battle" || v.sent || v.state.winner || v.state.needsReplacement.length) return;
    if (!duelActionOk(v.state, "A", action)) return;
    this.myAction = { seq: v.seq, action };
    this.set({ ...v, sent: true });
    if (this.role === "guest") this.send({ t: "action", seq: v.seq, action });
    else this.hostCheck();
  }

  replace(index: number) {
    const v = this.view;
    if (v.phase !== "battle" || v.sent || !v.state.needsReplacement.includes("A")) return;
    const f = v.state.sides.A.team[index];
    if (!f || f.hp <= 0 || index === v.state.sides.A.active) return;
    this.myReplace = { seq: v.seq, index };
    this.set({ ...v, sent: true });
    if (this.role === "guest") this.send({ t: "replace", seq: v.seq, index });
    else this.hostCheck();
  }

  forfeit() {
    if (this.done) return;
    this.send({ t: "forfeit" });
    this.over("loss", "forfeit");
  }

  // The guest turns the invite down (sent before leaving).
  decline() {
    this.send({ t: "decline" });
    this.set({ phase: "cancelled", reason: "You declined." });
  }

  // ── Time passing (the screen calls this every second or so) ───────────
  tick() {
    if (this.done) return;
    const now = this.now();
    const v = this.view;
    if (v.phase === "waiting") {
      if (now >= v.deadline) this.set({ phase: "cancelled", reason: this.role === "host" ? "No answer." : "The duel has gone." });
      else if (this.role === "guest" && now - this.lastResend >= RESEND_MS) { this.lastResend = now; this.start(); }
      return;
    }
    if (this.goneAt !== null && now - this.goneAt >= GONE_SECONDS * 1000) { this.over("win", "gone"); return; }

    // My own time running out.
    if (now >= ("deadline" in v ? v.deadline : Infinity) && "sent" in v && !v.sent) {
      if (v.phase === "pick") this.pickTeam(this.autoTeam());
      else if (v.phase === "lead") this.chooseLead(0);
      else if (v.phase === "battle") {
        if (v.state.needsReplacement.includes("A")) this.replace(firstStanding(v.state, "A"));
        else if (!v.state.needsReplacement.length && !v.state.winner) this.act(steadyAction(v.state, "A"));
      }
    }
    if (this.done) return;

    if (this.role === "guest") this.resend(now);
    else this.hostTimeouts(now);
  }

  // The guest says its latest choice again until the host has moved on.
  private resend(now: number) {
    if (now - this.lastResend < RESEND_MS) return;
    const v = this.view;
    if (!("sent" in v) || !v.sent) return;
    this.lastResend = now;
    if (v.phase === "pick" && this.myTeam) this.send({ t: "team", team: this.myTeam });
    if (v.phase === "lead" && this.myLead !== undefined) this.send({ t: "lead", index: this.myLead });
    if (v.phase === "battle" && this.myAction?.seq === v.seq) this.send({ t: "action", ...this.myAction });
    if (v.phase === "battle" && this.myReplace?.seq === v.seq) this.send({ t: "replace", ...this.myReplace });
  }

  // The host stops waiting for a guest that's still here but silent.
  private hostTimeouts(now: number) {
    const late = (secs: number) => now - this.stepAt >= (secs + GRACE_SECONDS) * 1000;
    const v = this.view;
    if (v.phase === "pick" && !this.guestTeam && late(PICK_SECONDS)) {
      this.send({ t: "snap", phase: "over", winner: "A", reason: "gone" });
      this.over("win", "gone");
    } else if (v.phase === "lead" && this.guestLead === undefined && late(LEAD_SECONDS)) {
      this.guestLead = 0;
      this.hostCheck();
    } else if (v.phase === "battle" && this.battle && !this.battle.winner) {
      const b = this.battle;
      if (b.needsReplacement.includes("B") && this.guestReplace === undefined && late(REPLACE_SECONDS)) {
        this.guestReplace = firstStanding(b, "B");
        this.hostCheck();
      } else if (!b.needsReplacement.length && !this.guestAction && late(TURN_SECONDS)) {
        this.guestAction = steadyAction(b, "B");
        this.hostCheck();
      }
    }
  }

  // ── Messages ─────────────────────────────────────────────────────────
  receive(m: DuelMsg) {
    if (this.done) {
      // A guest asking after it's over (it missed the end): tell it again.
      if (this.role === "host" && m.t === "hello" && this.hostWinner) this.send({ t: "snap", phase: "over", ...this.hostWinner });
      return;
    }
    if (m.t === "forfeit") { this.over("win", "forfeit"); return; }
    if (this.role === "host") this.hostReceive(m);
    else this.guestReceive(m);
  }

  private hostReceive(m: DuelMsg) {
    const phase = this.view.phase;
    switch (m.t) {
      case "hello":
        if (m.from !== "guest") return;
        if (phase === "waiting") this.beginPick();
        else this.sendSnap();
        return;
      case "decline":
        if (phase === "waiting") this.set({ phase: "cancelled", reason: "They said no." });
        return;
      case "team":
        if (phase !== "pick") { this.sendSnap(); return; }
        if (!teamFits(m.team, this.format)) return;
        this.guestTeam = m.team;
        this.hostCheck();
        return;
      case "lead":
        if (phase !== "lead") { this.sendSnap(); return; }
        this.guestLead = m.index;
        this.hostCheck();
        return;
      case "action":
        if (phase !== "battle" || !this.battle || m.seq !== this.seq) { this.sendSnap(); return; }
        if (this.battle.needsReplacement.length || this.guestAction) return;
        this.guestAction = duelActionOk(this.battle, "B", m.action) ? m.action : steadyAction(this.battle, "B");
        this.hostCheck();
        return;
      case "replace":
        if (phase !== "battle" || !this.battle || m.seq !== this.seq) { this.sendSnap(); return; }
        if (!this.battle.needsReplacement.includes("B")) return;
        this.guestReplace = this.battle.sides.B.team[m.index]?.hp > 0 && m.index !== this.battle.sides.B.active ? m.index : firstStanding(this.battle, "B");
        this.hostCheck();
        return;
    }
  }

  private beginPick() {
    this.stepAt = this.now();
    this.set({ phase: "pick", deadline: this.stepAt + PICK_SECONDS * 1000, sent: false });
    this.send({ t: "snap", phase: "pick" });
  }

  // The host moves things on once both choices for this step are in.
  private hostCheck() {
    const v = this.view;
    if (v.phase === "pick" && this.myTeam && this.guestTeam) {
      this.hostTeams = { host: this.myTeam, guest: this.guestTeam };
      this.stepAt = this.now();
      this.set({ phase: "lead", deadline: this.stepAt + LEAD_SECONDS * 1000, mine: this.myTeam, theirs: this.guestTeam, sent: false });
      this.sendSnap();
    } else if (v.phase === "lead" && this.myLead !== undefined && this.guestLead !== undefined && this.hostTeams) {
      const A = leadFirst(this.hostTeams.host, this.myLead), B = leadFirst(this.hostTeams.guest, this.guestLead);
      this.battle = createBattle(A.fighters, B.fighters);
      this.info = { A: A.info, B: B.info };
      this.seq = 1;
      this.showBattle();
      this.sendSnap();
    } else if (v.phase === "battle" && this.battle && !this.battle.winner) {
      const b = this.battle;
      const needA = b.needsReplacement.includes("A"), needB = b.needsReplacement.includes("B");
      if (needA || needB) {
        // Both replacements at once, so neither sees the other's first.
        const mine = this.myReplace?.seq === this.seq ? this.myReplace.index : undefined;
        if ((needA && mine === undefined) || (needB && this.guestReplace === undefined)) return;
        const after = cloneBattle(b);
        if (needA) sendInReplacement(after, "A", mine!);
        if (needB) sendInReplacement(after, "B", this.guestReplace!);
        this.advance(after);
      } else {
        const mine = this.myAction?.seq === this.seq ? this.myAction.action : undefined;
        if (!mine || !this.guestAction) return;
        const after = cloneBattle(b);
        resolveRound(after, { A: mine, B: this.guestAction });
        this.advance(after);
      }
    }
  }

  // A new battle state: on the host's screen, then to the guest (just the new log lines).
  private advance(after: BattleState) {
    const from = this.battle!.log.length;
    this.battle = after;
    this.seq++;
    this.guestAction = undefined;
    this.guestReplace = undefined;
    const { log, ...rest } = after;
    this.send({ t: "round", seq: this.seq, from, state: rest, log: log.slice(from) });
    this.showBattle();
  }

  private showBattle() {
    const b = this.battle!;
    this.stepAt = this.now();
    if (b.winner) { this.over(b.winner === "A" ? "win" : b.winner === "B" ? "loss" : "draw", "battle"); return; }
    this.set({ phase: "battle", state: b, info: this.info!, seq: this.seq, sent: false,
      deadline: this.stepAt + (b.needsReplacement.length ? REPLACE_SECONDS : TURN_SECONDS) * 1000 });
    // Only one side needs a replacement: the other has nothing to do this step.
    if (b.needsReplacement.length && !b.needsReplacement.includes("A")) this.set({ ...this.view, sent: true } as DuelView);
  }

  private sendSnap() {
    const v = this.view;
    if (v.phase === "pick") this.send({ t: "snap", phase: "pick" });
    else if (v.phase === "lead" && this.hostTeams) this.send({ t: "snap", phase: "lead", ...this.hostTeams });
    else if ((v.phase === "battle" || v.phase === "over") && this.battle && this.info) {
      this.send({ t: "snap", phase: "battle", seq: this.seq, state: this.battle, info: this.info });
    }
  }

  private guestReceive(m: DuelMsg) {
    const v = this.view;
    if (m.t === "snap") {
      if (m.phase === "pick") {
        if (v.phase === "waiting") this.set({ phase: "pick", deadline: this.now() + PICK_SECONDS * 1000, sent: false });
      } else if (m.phase === "lead") {
        if (v.phase === "waiting" || v.phase === "pick") {
          this.set({ phase: "lead", deadline: this.now() + LEAD_SECONDS * 1000, mine: m.guest, theirs: m.host, sent: false });
        }
      } else if (m.phase === "battle") {
        this.guestBattle(m.state, m.info, m.seq);
      } else if (m.phase === "over") {
        this.over(m.winner === "B" ? "win" : m.winner === "A" ? "loss" : "draw", m.reason);
      }
    } else if (m.t === "round") {
      // Only follows on from the copy this guest has; otherwise ask for the whole state.
      if (v.phase !== "battle" || !this.battle || !this.info) { this.start(); return; }
      if (m.seq <= this.seq) return;
      if (m.seq !== this.seq + 1 || m.from !== this.battle.log.length) { this.start(); return; }
      this.guestBattle({ ...m.state, log: [...this.battle.log, ...m.log] }, this.info, m.seq);
    }
  }

  // The host's battle (A = host), shown mirrored.
  private guestBattle(state: BattleState, info: Record<SideKey, DuelMember[]>, seq: number) {
    if (this.battle && seq <= this.seq) return;
    this.battle = state;
    this.info = info;
    this.seq = seq;
    const mine = mirrorBattle(state);
    const myInfo = { A: info.B, B: info.A };
    if (mine.winner) {
      this.over(mine.winner === "A" ? "win" : mine.winner === "B" ? "loss" : "draw", "battle", mine, myInfo);
      return;
    }
    const waitingOnThem = mine.needsReplacement.length > 0 && !mine.needsReplacement.includes("A");
    this.set({ phase: "battle", state: mine, info: myInfo, seq, sent: waitingOnThem,
      deadline: this.now() + (mine.needsReplacement.length ? REPLACE_SECONDS : TURN_SECONDS) * 1000 });
  }

  private over(result: DuelResult, reason: OverReason, state?: BattleState, info?: Record<SideKey, DuelMember[]>) {
    this.hostWinner = { winner: result === "win" ? "A" : result === "loss" ? "B" : "draw", reason };
    const b = state ?? (this.battle && (this.role === "host" ? this.battle : mirrorBattle(this.battle)));
    const i = info ?? (this.info && (this.role === "host" ? this.info : { A: this.info.B, B: this.info.A }));
    this.set({ phase: "over", result, reason, ...(b ? { state: b } : {}), ...(i ? { info: i } : {}) });
  }

  // The battle in your view (A = you), whatever the phase (for the end screen).
  myBattle(): BattleState | undefined {
    if (!this.battle) return undefined;
    return this.role === "host" ? this.battle : mirrorBattle(this.battle);
  }
}
