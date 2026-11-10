// @vitest-environment happy-dom
// The Labyrinth screen (app/dungeon/page.tsx) played end to end, in a pretend browser, so its
// handlers are covered before they're moved out (the refactor's Stage 3). The real page runs
// with the real game state and saves; only the drawing is stood in for: the room's and the walk's
// canvases (DungeonRoomView, WalkView) and the battle itself (usePlayableBattle: a fight is won or
// lost at once, with the real battle state, so finishFight's XP, loot and HP run for real).
// Random numbers, ids and the clock are fixed, so a run plays the same every time: what's on
// screen and what's saved after each step is pinned in tests/golden/page/encampment.json.
// UPDATE_PAGE_GOLDEN=1 rewrites it: only for a change the user approved (world/persistence.md,
// "Reviewing goldens"). DUNGEON_PAGE=<path> runs another copy of the page against it.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { SAVE_KEY } from "@/lib/save";
import { CREATURE_TEMPLATES } from "@/lib/creatures/creatureData";
import { makeCreatureDrop } from "@/lib/creatures/summon";
import { waysOn } from "@/lib/dungeon/map";
import { runPosition, loadDungeon, type DungeonRun } from "@/lib/dungeon/run";
import { createBattle } from "@/lib/combat/battle";

// ── Stand-ins for what draws to a canvas, and for the battle ──────────────
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: push, back: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/dungeon" }));
vi.mock("@/components/DungeonRoomView", () => ({
  default: ({ run, open, onGo, onObject, onFight }: { run: DungeonRun; open: boolean; onGo: (id: string) => void; onObject?: () => void; onFight?: () => void }) => (
    <div data-stub="room">
      {open && [...waysOn(run.map, runPosition(run))].sort((a, b) => a.x - b.x).map((w) => <button key={w.id} data-way={w.id} onClick={() => onGo(w.id)}>way {w.id}</button>)}
      {onObject && <button data-object onClick={onObject}>floor object</button>}
      {onFight && <button onClick={onFight}>⚔️ Fight!</button>}
    </div>
  ),
}));
vi.mock("@/components/WalkView", () => ({
  default: () => <div data-stub="walk" />, WalkFirstMap: () => <div data-stub="walk-first-map" />, WalkMap: () => <div data-stub="walk-map" />,
}));
// The walk the game draws (3D, decision 38): stood in for like the 2D one, keeping what the page handed it.
const walkProps: { last: Record<string, unknown> | null } = { last: null };
vi.mock("@/components/WalkView3D", () => ({
  default: (p: Record<string, unknown>) => { walkProps.last = p; return <div data-stub="walk" />; },
}));
const outcome = { next: "A" as "A" | "B" };
vi.mock("@/components/BattleScreen", async (orig) => {
  const real = await orig<typeof import("@/components/BattleScreen")>();
  return {
    ...real,
    BattleView: ({ finishedActions }: { finishedActions?: React.ReactNode }) => <div data-stub="battle">{finishedActions}</div>,
    // The fight's over as soon as it starts: the losing side all knocked out.
    usePlayableBattle: (onChange: (m: import("@/components/BattleScreen").Match) => void) => {
      const [match, setMatch] = useState<import("@/components/BattleScreen").Match | null>(null);
      return {
        match, view: null,
        start: (teams: import("@/components/BattleScreen").Match["teams"], info: import("@/components/BattleScreen").Match["info"], level: string, opts: { startHp?: number[]; boss?: never; pair?: boolean; turnLimit?: number } = {}) => {
          const state = createBattle(teams.A, teams.B, { A: opts.startHp }, opts.boss, { pairB: opts.pair, turnLimit: opts.turnLimit });
          const loser = outcome.next === "A" ? "B" : "A";
          state.sides[loser].team.forEach((f) => { f.hp = 0; });
          state.winner = outcome.next;
          const m = { state, info, teams, level } as unknown as import("@/components/BattleScreen").Match;
          setMatch(m); onChange(m);
        },
        resume: (m: import("@/components/BattleScreen").Match) => setMatch(m),
        clear: () => setMatch(null),
      };
    },
  };
});

// ── Fixed randomness, ids and time ────────────────────────────────────────
let seed = 0;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let uid = 0;
beforeEach(() => {
  seed = 20261110; uid = 0; outcome.next = "A"; push.mockClear();
  vi.spyOn(Math, "random").mockImplementation(rand);
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => `00000000-0000-4000-8000-${String(++uid).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  window.requestAnimationFrame = () => 0; // (the shows' counting animations stay on their first frame)
  localStorage.clear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// A player with three Common creatures, past Klutz's tutorial, and some gold.
function seedSave() {
  const commons = CREATURE_TEMPLATES.filter((t) => t.rarity === "common").slice(0, 3);
  const inventory = commons.map((t) => ({ ...makeCreatureDrop(t, "creature", ""), level: 4, xp: 0 }));
  localStorage.setItem(SAVE_KEY, JSON.stringify({ gold: 500, inventory, quest: { stage: "done" } }));
}

// ── Driving the page ──────────────────────────────────────────────────────
const pagePath = process.env.DUNGEON_PAGE ? path.resolve(process.env.DUNGEON_PAGE) : "@/app/dungeon/page";
let root: Root | null = null, host: HTMLElement | null = null;
async function mount() {
  const Page = (await import(/* @vite-ignore */ pagePath)).default;
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<Page />); });
  await settle();
}
async function unmount() { await act(async () => root?.unmount()); host?.remove(); root = null; }
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const text = () => (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
const buttons = () => [...document.querySelectorAll("button")] as HTMLButtonElement[];
const find = (label: string | RegExp) => buttons().find((b) => !b.disabled && (typeof label === "string" ? (b.textContent ?? "").includes(label) : label.test(b.textContent ?? "")));
async function tap(label: string | RegExp | HTMLElement) {
  const b = typeof label === "object" && "click" in label ? label : find(label);
  if (!b) throw new Error(`no button "${String(label)}" on screen: ${text().slice(0, 300)}`);
  await act(async () => { b.click(); });
  await settle();
}
const tapIf = async (label: string | RegExp) => { const b = find(label); if (b) await tap(b); return !!b; };

// What's saved: a readable summary, and a hash of the whole save so any other change shows too.
function saved() {
  const raw = localStorage.getItem(SAVE_KEY) ?? "{}";
  const s = JSON.parse(raw);
  const lab = s.labyrinth ?? null, r = lab?.run;
  return {
    gold: s.gold,
    creatures: (s.inventory ?? []).filter((d: { dropType: string }) => d.dropType === "creature").map((d: { name: string; level?: number; xp?: number }) => `${d.name} Lv${d.level ?? 1} ${d.xp ?? 0}xp`),
    items: (s.inventory ?? []).filter((d: { dropType: string }) => d.dropType !== "creature").length,
    equipment: s.equipment ?? {},
    bag: lab?.meta?.bag ?? [],
    run: r ? { status: r.status, room: r.room, at: r.current?.kind ?? null, done: !!r.current?.done, opened: !!r.current?.opened, sack: r.current?.sack?.length ?? 0, hp: r.hp, got: r.got?.length ?? 0, floor: r.floor?.length ?? 0, loot: r.loot } : null,
    hash: createHash("sha1").update(raw).digest("hex"),
  };
}
type Step = { step: string; screen: string; save: ReturnType<typeof saved> };
const trace: Step[] = [];
const note = (step: string) => trace.push({ step, screen: text().slice(0, 1200), save: saved() });

// One Encampment run on the scroll map: pick the party, look at the map, go in, and take each
// room as it comes (fight and loot it, open what's there), equip a find, reload part-way, and go
// home at the end (the haul after the chief, or retreating if it ends early).
async function playEncampment() {
  await mount(); note("entrance");
  for (let i = 0; i < 3; i++) await tap(/^Lv \d/); // (each creature's button starts with its level)
  note("party picked");
  await tap(/Enter the Encampment/); note("entered: the map");
  await tap("Put the map away and step inside"); note("inside");
  for (let room = 1; room <= 9; room++) {
    const run = loadDungeon().run!;
    if (run.status !== "exploring") break;
    const way = document.querySelector("button[data-way]") as HTMLButtonElement | null;
    if (!way) { note(`room ${room}: no way on`); break; }
    await tap(way);
    if (await tapIf(/^Leave (it|them)$/)) note(`room ${room}: left rare things behind`);
    note(`room ${room}: ${loadDungeon().run?.current?.kind ?? "?"}`);
    if (await tapIf("⚔️ Fight!")) {
      note(`room ${room}: fought`);
      await tap(/Collect your reward|Everything goes dark/); note(`room ${room}: fight over`);
      if (await tapIf(/^Loot$/)) { note(`room ${room}: loot open`); await tap("Take all"); note(`room ${room}: took all`); await tapIf("Done"); }
      else await tapIf(/^(Leave|Carry on)$/);
    }
    const object = document.querySelector("button[data-object]") as HTMLButtonElement | null;
    if (object) {
      await tap(object); note(`room ${room}: opened what's here`);
      if (await tapIf("Take all")) { note(`room ${room}: took all`); await tapIf("Done"); }
    }
    await tapIf("Take the gold");
    if (room === 2) { await unmount(); await mount(); note(`room ${room}: reloaded`); }
    // Equip the first piece of gear in the bag, through the bag and the compare window.
    await tapIf("🎒 Bag");
    const slot = document.querySelector("button[aria-pressed][title]:not([aria-label^='Empty'])") as HTMLElement | null; // (a bag slot with something in it)
    if (slot) { await tap(slot); if (await tapIf(/^Equip on /)) { await tapIf(/^Equip$/); note(`room ${room}: equipped`); } }
    await tapIf("✕");
  }
  const run = loadDungeon().run;
  if (run?.status === "cleared") {
    note("cleared"); await tapIf("Continue"); note("the haul");
    if (await tapIf(/^Sort/)) { await tap("Take all"); note("haul: took all"); await tapIf("Done"); }
    await tapIf("🏠 Return to Den"); await tapIf(/^Return to Den$/);
  } else if (run?.status === "exploring") {
    await tap("🏃 Retreat"); await tap("Tap: leave"); note("retreated");
    await tap("Continue");
  } else { note(`run over: ${run?.status}`); await tapIf("Continue"); }
  note("home");
  await unmount();
}

// The first fight lost: knocked out, Klutz drags you back to the Den.
async function playDefeat() {
  outcome.next = "B";
  await mount();
  for (let i = 0; i < 3; i++) await tap(/^Lv \d/);
  await tap(/Enter the Encampment/);
  await tap("Put the map away and step inside"); note("inside");
  for (let room = 1; room <= 6 && !find("⚔️ Fight!"); room++) {
    const way = document.querySelector("button[data-way]") as HTMLButtonElement | null;
    if (!way) break;
    await tap(way); await tapIf(/^Leave (it|them)$/);
    if (!find("⚔️ Fight!")) { const o = document.querySelector("button[data-object]") as HTMLButtonElement | null; if (o) { await tap(o); await tapIf("Done"); } }
  }
  await tap("⚔️ Fight!"); note("fought");
  await tap(/Everything goes dark/); note("knocked out");
  await tap("Continue"); note("home");
  await unmount();
}

// A walkable ("🔥 New") Encampment run: started, the scroll's first look, the walk (its canvas
// stood in for), a reload, and a retreat.
async function playWalk() {
  await mount();
  await tap(/^🔥 NewThe Encampment/); // (the "🔥 New" Encampment)
  for (let i = 0; i < 3; i++) await tap(/^Lv \d/);
  await tap(/Enter the new Encampment/);
  await act(async () => { await new Promise((r) => setTimeout(r, 120)); }); await settle(); // ("Lighting the torches…")
  note("the scroll's first look");
  await tap("Put the scroll away and begin"); note("walking");
  expect(document.querySelector("[data-stub='walk']")).not.toBeNull();
  // The 3D walk is handed everything the 2D one was: the run, the rooms, the windows over it, and each callback.
  for (const k of ["walk", "map", "here", "room", "busy", "been", "cleared", "scroll", "team", "hp", "onScrollClose", "onEnter", "onSpotted", "onObject", "onCage", "onHeal", "onKeep"]) expect(walkProps.last?.[k], k).toBeDefined();
  expect(walkProps.last?.busy).toBe(false);
  await unmount(); await mount(); note("reloaded");
  await tap("🏃 Retreat"); await tap("Tap: leave"); note("retreated");
  await tap("Continue"); note("home");
  await unmount();
}

const GOLDEN = path.join(__dirname, "golden", "page", "dungeon.json");
const golden: Record<string, Step[]> = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, "utf8")) : {};
afterEach(() => {
  if (process.env.UPDATE_PAGE_GOLDEN === "1") { fs.mkdirSync(path.dirname(GOLDEN), { recursive: true }); fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 1) + "\n"); }
});
async function pinned(name: string, play: () => Promise<void>) {
  seedSave();
  trace.length = 0;
  await play();
  expect(push).toHaveBeenCalledWith("/");
  if (process.env.UPDATE_PAGE_GOLDEN === "1") golden[name] = [...trace];
  const want = golden[name];
  expect(want, `no golden for ${name}: run with UPDATE_PAGE_GOLDEN=1`).toBeDefined();
  expect(trace.map((s) => s.step)).toEqual(want.map((s) => s.step));
  trace.forEach((s, i) => expect(s, `${name}, step ${i}: ${s.step}`).toEqual(want[i]));
}

describe("the Labyrinth screen, played through (what's on screen and what's saved, step by step, as pinned)", () => {
  it("an Encampment run: a stash, fights won, loot, equipping, a reload, the chief, the haul, home", () => pinned("encampment", playEncampment));
  it("a fight lost: knocked out and home", () => pinned("defeat", playDefeat));
  it("a walkable run: started, the scroll, a reload, a retreat", () => pinned("walk", playWalk));
});
