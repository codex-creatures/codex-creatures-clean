"use client";
// components/Den3D.tsx
// 🧪 The new Den (Settings → New Den: lib/den3d/setting.ts; the user, 2026-11-18): the Den as a room of
// the Labyrinth, drawn as the Labyrinth is (components/WalkView3D.tsx's Stone: the carved rock and its
// shader, the camera, the lean, art pixels at 48 a unit), lit warmer. Where everything stands, its lights
// and who strolls where are lib/den3d/layout.ts's; how each place is drawn, components/Den3DPlaces.tsx.
// No walking: drag to look round (past the walls a little), pinch or scroll to zoom, tap a place to go in.
// Hold a movable thing (the altar, the pool, the pits; the bookcase, the board, the cage), drag it and let
// go: floor things snap to a grid in the middle of the hall, wall things to the slots on the north walls;
// it goes red where it can't stand. Where you've put things is kept in the save (lib/den3d/placement.ts).
// Every place has its name over it (Settings can hide them), a ❗ when something's waiting there.
// The old wall: Klutz uses the Labyrinth Stone on it, and the whole wall sinks away (lib/tavern.ts).
// Made once and kept (DenKept): going into a place takes the Den off the page, still made, and coming home puts
// it back, so it isn't all built again each time; and it stops drawing the moment a place is tapped, so that
// place's screen gets the phone's whole attention (the user, 2026-11-23: opening and closing things was slow).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ROCK, type Floorplan, type Pt } from "@/lib/dungeon/floorplan";
import {
  denPlan, denShown, denLit, denLights, stations, stationAt, strollAt, routeLoop, routeTime, strollBlocked, braziers, clampView, denArea, firstView,
  placed as placeAll, footBox, wallFoot, fitsFloor, fitsWall, placeWall, nearestSlot, toLayout, snap,
  KLUTZ_LOOP, VISITOR_LOOP, STROLL, SCONCES, DEN_WALL, DIVIDE_X, ROOM1, ZOOM, DECOR, isLamp, fitMapper, SNAP, type FitMap, type Box,
  type Station, type DenState, type DenLayout, type Placed, type Route, type FloorKey, type WallKey, type SlotId,
} from "@/lib/den3d/layout";
import { loadDenLayout, saveDenLayout } from "@/lib/den3d/placement";
import { denView, keepDenView } from "@/lib/den3d/view";
import { lightShapes, mixLights, seenField, shadeAt, texelsPerU, pixelScale, WINDOW, SUB, type LightField, type LightShapes } from "@/lib/render3d/stone";
import { rockHeights, carvedMesh, uprightStretch, ROCK_MARGIN, SOUTH_LIP } from "@/lib/render3d/dungeon3d";
import {
  STONE, STONE_VERTEX, STONE_FRAGMENT, stoneUniforms, rawTexture, gridTexture, codeTexture, fillGrid,
  Upright, Mounted, Sconce, Stroller, FLAME_COLOUR,
} from "@/components/WalkView3D";
import { PROP_LEAN } from "@/components/Props3D";
import { Place, MovingWall, SINK } from "@/components/Den3DPlaces";
import { Decor3D } from "@/components/Decor3D";
import { WALK_TILES, KIT_LIGHTS, WALK_STANDING_TORCH, STANDING_TORCH_U, STANDING_TORCH_FLAME } from "@/lib/sprites/walk";
import { NPC_U } from "@/lib/world/objects";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { artFor } from "@/lib/sprites/art";
import { COLLECTOR, ENCHANTRESS, LIBRARIAN, MERCHANT } from "@/lib/sprites/props";
import type { Sprite } from "@/lib/sprites/pixels";
import { OBJ, type KlutzMode, type ObjId } from "@/lib/den/scene";
import { tavernVisitors, visitorNews, type TavernQuest, type Visitor } from "@/lib/tavern";
import { VISITOR_HREF, type Rubble } from "@/components/DenRoom";
import { useDenOptions } from "@/hooks/useNewDen";
import { useOthersOnline } from "@/hooks/useOthersOnline";
import { DEN_DEFAULTS, type DenOptions } from "@/lib/den3d/setting";

// (The camera's angle down from the horizon is the Den's option: the Labyrinth's 60° unless changed.)
const LEAN = 0.03;
const DENSITY = 48;               // art pixels a unit
const HOLD_DRAG = 8;              // px a finger moves before it's a drag, not a tap
const LIFT_MS = 450;              // ms held still on a movable thing before it lifts
// 🧪 The Den's walls: the Labyrinth's kit F, every pixel kept, recoloured warm (scripts/den-kit-warm.mjs).
const LAB_KIT = WALK_TILES[0].kit!;
const KIT = { ...LAB_KIT, floor: "/sprites/den3d/kit-floor.png", north: "/sprites/den3d/kit-north.png", cap: "/sprites/den3d/kit-cap.png" };
// The Den's light: warmer than the Labyrinth's and never pitch dark (it's home). 🧪
// (The user, 2026-11-19: a higher ambient light, with lamps adding to it in places: remember 0.3 → 0.48; 2026-11-20, "too many
// dark spots": 0.58, with the lights' reaches up, DEN_LIGHT.)
const DEN_STONE = { ...STONE, remember: 0.58, gain: 1.15, warm: [1, 0.82, 0.6] as [number, number, number], flame: [1, 0.76, 0.5] as [number, number, number] };
const FIRE_POWER = 0.8;           // 🧪 each light's strength (STONE.fire's 0.85 in the Labyrinth)
// 🧪 The light the props built from recipes take for their shape (from the upper left, in front), times the Den's own.
const DEN_KEY = { ambient: 1.05, key: 1.25, at: [-5, 7, 4] as [number, number, number] };
const NO = new THREE.Color(1, 0.35, 0.35); // a thing being moved where it can't go
// 🧪 The camera turns a little as the view moves (the user, 2026-11-19: so the sides of things shift and the 3D shows),
// and settles back square when it stops, so a still view keeps its pixels square: degrees per unit a second, the most
// it turns, and how quickly it follows.
const TURN = { perSpeed: 0.55, max: 6, follow: 5 };
const PRESS_GLOW = 1.45; // 🧪 how much brighter a place is while a finger's on it
const FIT_MS = 6;         // ms a frame spent working out the where-it-fits map (a row at a time: every small tile across the Den)
const FOOT_COLOURS = { fits: [120, 255, 150], no: [255, 80, 70] }; // 🧪 the footprint of a thing being moved
const FIT_COLOURS = { fits: [90, 220, 120, 75], no: [230, 60, 50, 60] }; // 🧪 RGBA over the floor

const DAILY_BOARD = "/board?tab=daily"; // (where the board opens when a daily quest is what's waiting)
const LEAVE_MS = 4000;    // ms after a tap on a place before the Den draws again, if that place never opened

export type Den3DProps = {
  caged?: string; klutz: KlutzMode; klutzNews: boolean; highlight?: ObjId; rubble: Rubble; onBlast?: () => void;
  tavern: TavernQuest; pit?: { ready: boolean }; tavernNews: boolean; boardNews: boolean | "daily"; crateNews: boolean; cageNews: boolean;
  shack?: boolean;       // Klutz's place still the broken-down shack (lib/klutz.ts): drawn so till it's repaired
  altarBroken?: boolean; // the Soul Altar not yet mended (lib/dungeon/run.ts altarMended): drawn cracked and cold
  options?: DenOptions;  // (the lab's; the game's are the player's own, from Settings)
  keep?: "save" | "none"; // where moved things are kept (the lab keeps them nowhere)
};

// Someone strolling: Klutz, or a visitor. `lead`: seconds along their route.
type Walker = { key: string; label: string; href: string; sprite: Sprite; route: Route; speed: number; lead: number; news: boolean; tour?: string; faces: "left" | "right" };
const VISITOR_SPRITE: Record<Visitor, Sprite> = { merchant: MERCHANT, librarian: LIBRARIAN, collector: COLLECTOR, enchantress: ENCHANTRESS };
const VISITOR_LABEL: Record<Visitor, string> = { merchant: "Merchant", librarian: "Librarian", collector: "Collector", enchantress: "Enchantress" };
// A thing being moved: what, where it would go now, whether it can, and where on it the finger took hold.
type Moving = { key: FloorKey | WallKey; kind: "floor" | "wall"; at: Pt; slot?: SlotId; ok: boolean; grab: Pt };

// Going into places: the page's router (the kept Den is drawn outside the page's own tree, where there's none to ask for).
type Nav = { push: (href: string) => void; prefetch: (href: string) => void };

export default function Den3D(p: Den3DProps) {
  const router = useRouter();
  const nav = useMemo<Nav>(() => ({ push: (h) => router.push(h), prefetch: (h) => router.prefetch(h) }), [router]);
  // (The lab's Den keeps nothing, and is made afresh each time.)
  return p.keep === "none" ? <DenLive {...p} nav={nav} shown /> : <DenKept {...p} nav={nav} />;
}

// The game's Den, made once and kept for as long as the site's open: on the Den's page it's put in the page; going
// anywhere else parks it off the side of the screen, still made (its scene, its pictures on the graphics card),
// hidden and not drawing. Coming home puts it back as it was, with the game as it is now. Made again each time,
// it was most of a second on a laptop and several on a phone before the Den showed (docs/polish-audit-2026-11.md).
// (Parked at the size it was, not taken out of the page: a canvas with no size is left alone by its renderer,
// which then wouldn't be told to stop drawing.)
const SHOWN = "position:absolute;inset:0";
const parked = (w: number, h: number) => `position:fixed;left:-100000px;top:0;width:${w || 390}px;height:${h || 600}px;visibility:hidden;pointer-events:none`;
// `lost`: the graphics card dropped its canvas (a phone short of memory may, while it's parked): made afresh next visit.
type Keeper = { box: HTMLDivElement; root: Root; lost: boolean };
let keeper: Keeper | null = null;
// Let go of the kept Den (the tests': each starts with none made).
export function forgetDen() {
  keeper?.root.unmount();
  keeper?.box.remove();
  keeper = null;
}
function DenKept(p: Den3DProps & { nav: Nav }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(p);
  useLayoutEffect(() => {
    if (keeper?.lost) forgetDen();
    if (!keeper) {
      const box = document.createElement("div"), made: Keeper = { box, root: createRoot(box), lost: false };
      keeper = made;
      box.addEventListener("webglcontextlost", () => { made.lost = true; }, true);
    }
    const k = keeper;
    k.box.style.cssText = SHOWN;
    k.box.removeAttribute("data-den-parked");
    host.current?.replaceChildren(k.box);
    return () => {
      k.box.style.cssText = parked(k.box.offsetWidth, k.box.offsetHeight);
      k.box.setAttribute("data-den-parked", "");
      document.body.appendChild(k.box);
      k.root.render(<DenLive {...latest.current} shown={false} />);
    };
  }, []);
  // (Every time the page draws: the game as it is now, handed on.)
  useLayoutEffect(() => { latest.current = p; keeper?.root.render(<DenLive {...p} shown />); });
  return <div ref={host} style={{ position: "absolute", inset: 0 }} />;
}

// The Den itself. `shown`: on the page now (the kept one isn't while you're elsewhere).
function DenLive(p: Den3DProps & { nav: Nav; shown: boolean }) {
  const nav = p.nav;
  const opened = p.rubble === "open";
  // The player's options (Settings: lib/den3d/setting.ts): names, the camera's angle.
  const stored = useDenOptions(), o = p.options ?? stored ?? DEN_DEFAULTS, pitch = (o.angle * Math.PI) / 180;
  const hasPit = !!p.pit, trainingPit = !!p.tavern.pit, repaired = !!p.tavern.repaired;
  const shack = !!p.shack, altarBroken = !!p.altarBroken;
  const state: DenState = useMemo(() => ({ opened, pit: hasPit, trainingPit, repaired, shack, altarBroken }), [opened, hasPit, trainingPit, repaired, shack, altarBroken]);
  const others = useOthersOnline();

  // Where things stand: the saved layout (the lab's starts fresh), and the thing being moved, if any.
  const [layout, setLayout] = useState<DenLayout>(() => (p.keep === "none" ? {} : loadDenLayout()));
  const [moving, setMoving] = useState<Moving | null>(null);
  const [pressed, setPressed] = useState<string | null>(null); // (the place under a finger, lit up till it lifts or drags)
  const settled = useMemo(() => placeAll(layout, opened), [layout, opened]);
  const now = useMemo((): Placed => {
    if (!moving) return settled;
    if (moving.kind === "wall") return moving.slot ? placeWall(settled, moving.key as WallKey, moving.slot) : settled;
    return { ...settled, floor: { ...settled.floor, [moving.key]: moving.at } };
  }, [settled, moving]);
  const list = useMemo(() => stations(state, now), [state, now]);
  const plan = useMemo(() => denPlan(opened), [opened]);
  const shown = useMemo(() => denShown(opened), [opened]);

  // Where the view was left (lib/den3d/view.ts): coming back from a place opens where you were; the first time,
  // or after a run, in the middle.
  const [kept] = useState(() => { const v = denView(); return v && v.opened === opened ? v : null; });
  const [across, setAcross] = useState(() => kept?.across ?? ZOOM.start);
  const view = useRef<Pt>(kept ? kept.at : firstView(opened, pitch));
  const span = useRef({ across, deep: 10 });  // floor units in view (set by the scene from its size)
  const camera = useRef<THREE.Camera | null>(null);
  const pad = useRef<HTMLDivElement>(null);
  const labels = useRef(new Map<string, HTMLElement>());
  const [notice, setNotice] = useState(false);       // the old wall's window
  const [shaking, setShaking] = useState(false);
  const movedAt = useRef<number | null>(null);      // when the wall moved away (this visit)
  const wasOpen = useRef(opened);
  const glide = useRef<{ from: Pt; to: Pt; at: number } | null>(null);
  const move = (to: Pt) => { glide.current = { from: { ...view.current }, to, at: performance.now() }; };

  // The wall moving away: it sinks, and the view glides out to both rooms.
  useEffect(() => {
    if (opened && !wasOpen.current) { movedAt.current = performance.now(); move(firstView(true, pitch)); }
    wasOpen.current = opened;
  }, [opened, pitch]); // (a new angle with the wall already gone does nothing: wasOpen)
  // Klutz (his tour, or where he's sent you) shows a place: the view goes to it. (Not on coming back to where
  // you'd left the view: only when he shows somewhere new, or the view starts afresh.)
  const shownFirst = useRef(!!kept);
  useEffect(() => {
    const s = p.highlight === undefined ? undefined : list.find((x) => x.obj === p.highlight);
    if (s && !shownFirst.current) move({ x: s.x, y: s.y - 1 });
    shownFirst.current = false;
  }, [p.highlight]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoomed = useRef(across);
  useEffect(() => { zoomed.current = across; }, [across]);
  useEffect(() => () => { if (p.keep !== "none") keepDenView({ at: view.current, across: zoomed.current, opened: wasOpen.current }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // A place tapped: the Den stops drawing till it's left (or, if that place never opens, for LEAVE_MS), so the
  // place's screen isn't loaded a few milliseconds at a time between the Den's frames.
  const [leaving, setLeaving] = useState(false);
  const leave = (href: string) => { setLeaving(true); nav.push(href); };
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(false), LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);
  // Taken off the page (the kept Den, while you're elsewhere): where the view was is kept, as on leaving it was, and
  // anything half done (a press, a thing being moved) is let go. Put back: drawing again, with where things stand
  // read again from the save (another save may have been loaded since), and after a run, back in the middle.
  const wasShown = useRef(p.shown);
  useEffect(() => {
    if (p.shown === wasShown.current) return;
    wasShown.current = p.shown;
    if (!p.shown) {
      if (p.keep !== "none") keepDenView({ at: view.current, across: zoomed.current, opened: wasOpen.current });
      if (held.current?.lift) window.clearTimeout(held.current.lift);
      held.current = null; fingers.current.clear(); pinch.current = null;
      setPressed(null); hideFit(); setMoving(null); setNotice(false);
      return;
    }
    setLeaving(false);
    if (p.keep !== "none") { const saved = loadDenLayout(); setLayout((old) => (JSON.stringify(old) === JSON.stringify(saved) ? old : saved)); }
    const v = denView();
    if (!v || v.opened !== opened) {
      glide.current = null;
      view.current = firstView(opened, pitch);
      setAcross(ZOOM.start);
      const s = p.highlight === undefined ? undefined : list.find((x) => x.obj === p.highlight);
      if (s) move({ x: s.x, y: s.y - 1 });
    }
  }, [p.shown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Klutz strolling round room 1 while he's home; visitors round the whole Den once it's open; each finding
  // their way round wherever things stand now.
  const blocked = useMemo(() => strollBlocked(plan, shown, list, braziers(now, state)), [plan, shown, list, now, state]);
  const walkers = useMemo(() => {
    const out: Walker[] = [];
    if (p.klutz === "home" && CREATURE_SPRITES.klutz) out.push({ key: "klutz", label: "Klutz", href: "/klutz", sprite: CREATURE_SPRITES.klutz, route: routeLoop(KLUTZ_LOOP, blocked), speed: STROLL.klutz, lead: 0, news: p.klutzNews, tour: `den-${OBJ.klutz}`, faces: "right" });
    if (opened) {
      const who = tavernVisitors(p.tavern), route = routeLoop(VISITOR_LOOP, blocked), T = routeTime(route, STROLL.visitor);
      who.forEach((v, i) => out.push({ key: v, label: VISITOR_LABEL[v], href: `${VISITOR_HREF}?v=${v}`, sprite: VISITOR_SPRITE[v], route, speed: STROLL.visitor, lead: (i * T) / who.length, news: visitorNews(p.tavern, v), faces: "left" }));
    }
    return out;
  }, [p.klutz, p.klutzNews, opened, p.tavern, blocked]);

  // Every place's page loaded in the background as the Den opens, so a tap goes straight in (taps go by
  // router.push, which doesn't fetch ahead as a link does; the user, 2026-11-20: going in was slow).
  const hrefs = [...new Set([...list.flatMap((s) => (s.href ? [s.href.split("?")[0]] : [])), "/klutz", VISITOR_HREF])].join("|");
  useEffect(() => { for (const h of hrefs.split("|")) nav.prefetch(h); }, [hrefs, nav]);

  // What's waiting where (a ❗ on its name).
  const news = (s: Station) => (s.key === "shack" && (p.crateNews || (p.klutz !== "home" && p.klutzNews))) || (s.key === "cage" && p.cageNews)
    || (s.key === "board" && !!p.boardNews) || (s.key === "tavern" && p.tavernNews) || (s.key === "training" && !!p.pit?.ready) || (s.key === "rubble" && p.rubble === "dynamite");

  // ── Drag to look, pinch or scroll to zoom, tap to go in, hold to move ──
  // (Over the whole picture, its names included: a drag that starts on a name still looks round, and a tap
  // on one goes where the name says. `label`: the name a press started on; `lift`: the hold's timer.)
  const held = useRef<{ id: number; x: number; y: number; x0: number; y0: number; drag: boolean; label: string | null; lift?: number } | null>(null);
  const fingers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ d0: number; across0: number } | null>(null);
  const zoomTo = (a: number) => setAcross(Math.min(ZOOM.max, Math.max(ZOOM.min, a)));
  const floorAt = (clientX: number, clientY: number): Pt | null => {
    const cam = camera.current, el = pad.current;
    if (!cam || !el) return null;
    const box = el.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - box.left) / box.width) * 2 - 1, 1 - ((clientY - box.top) / box.height) * 2), cam);
    const q = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    return q ? { x: q.x, y: q.z } : null;
  };
  // Where a thing being moved would go, with the finger at `f` on the floor.
  const aim = (m: Moving, f: Pt): Moving => {
    if (m.kind === "wall") { const s = nearestSlot(f, opened); return { ...m, at: f, slot: s.id, ok: fitsWall(m.key as WallKey, s.id, opened) }; }
    const at = { x: snap(f.x + m.grab.x), y: snap(f.y + m.grab.y) };
    return { ...m, at, ok: fitsFloor(m.key as FloorKey, at, settled, opened) };
  };
  // Where a floor thing being moved could go (the user, 2026-11-19: "show where in the Den it can be dragged to"):
  // worked out a few rows a frame from when it lifts, shown green where it fits and red where it doesn't.
  const [fit, setFit] = useState<{ map: FitMap; rev: number } | null>(null);
  const fitJob = useRef(0);
  const showFit = (key: FloorKey) => {
    const job = ++fitJob.current, m = fitMapper(key, settled, opened);
    let rev = 0;
    const step = () => {
      if (job !== fitJob.current) return;
      const t0 = performance.now();
      let done = false;
      while (!done && performance.now() - t0 < FIT_MS) done = m.next(1);
      setFit({ map: m.map, rev: ++rev });
      if (!done) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const hideFit = () => { fitJob.current++; setFit(null); };
  const lift = (s: Station, f: Pt) => {
    if (navigator.vibrate) navigator.vibrate(15);
    if (s.move === "floor") showFit(s.key as FloorKey);
    const start: Moving = { key: s.key as FloorKey | WallKey, kind: s.move!, at: { x: s.x, y: s.y }, ok: true, grab: { x: s.x - f.x, y: s.y - f.y } };
    setMoving(aim(start, f));
  };
  const down = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-den-window]")) return; // (the old wall's window: its own taps)
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (fingers.current.size === 2) {
      // Two fingers: a pinch (and no tap, drag or hold).
      const [a, b] = [...fingers.current.values()];
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y), across0: across };
      if (held.current?.lift) window.clearTimeout(held.current.lift);
      held.current = null;
      return;
    }
    const label = t.closest("[data-den-label]")?.getAttribute("data-den-label") ?? null;
    const h = held.current = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, drag: false, label };
    // Held still on something movable: it lifts.
    const f = floorAt(e.clientX, e.clientY), s = label ? list.find((x) => x.key === label) : f ? stationAt(list, f, pitch) : undefined;
    setPressed(s?.key ?? null);
    if (s?.move && f) {
      const id = e.pointerId;
      held.current.lift = window.setTimeout(() => { if (held.current === h && !h.drag && held.current.id === id) lift(s, floorAt(h.x, h.y) ?? f); }, LIFT_MS);
    }
  };
  const drag = (e: React.PointerEvent) => {
    if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && fingers.current.size >= 2) {
      const [a, b] = [...fingers.current.values()];
      zoomTo(pinch.current.across0 * (pinch.current.d0 / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y))));
      return;
    }
    const h = held.current, el = pad.current;
    if (!h || h.id !== e.pointerId || !el) return;
    if (moving) { const f = floorAt(e.clientX, e.clientY); if (f) setMoving(aim(moving, f)); h.x = e.clientX; h.y = e.clientY; return; }
    if (!h.drag && Math.hypot(e.clientX - h.x0, e.clientY - h.y0) > HOLD_DRAG) { h.drag = true; setPressed(null); if (h.lift) window.clearTimeout(h.lift); }
    if (!h.drag) { h.x = e.clientX; h.y = e.clientY; return; }
    const perPx = span.current.across / el.getBoundingClientRect().width;
    glide.current = null;
    view.current = clampView({ x: view.current.x - (e.clientX - h.x) * perPx, y: view.current.y - ((e.clientY - h.y) * perPx) / Math.sin(pitch) },
      span.current.across, span.current.deep, denArea(opened, pitch));
    h.x = e.clientX; h.y = e.clientY;
  };
  const up = (e: React.PointerEvent) => {
    fingers.current.delete(e.pointerId);
    if (pinch.current) { if (fingers.current.size < 2) pinch.current = null; return; }
    const h = held.current;
    if (!h || h.id !== e.pointerId) return;
    held.current = null;
    setPressed(null);
    if (h.lift) window.clearTimeout(h.lift);
    if (moving) { drop(moving); return; }
    if (h.drag) return;
    if (h.label) { tapName(h.label); return; }
    const at = floorAt(e.clientX, e.clientY);
    if (!at) return;
    const w = walkerAt(walkers, at, pitch);
    if (w) { leave(w.href); return; }
    const s = stationAt(list, at, pitch);
    if (s) go(s);
  };
  const cancel = (e: React.PointerEvent) => {
    fingers.current.delete(e.pointerId);
    pinch.current = null;
    if (held.current?.lift) window.clearTimeout(held.current.lift);
    held.current = null;
    setPressed(null);
    hideFit();
    setMoving(null);
  };
  // Let go of a thing being moved: it stays where it can stand (and that's kept), or goes back.
  function drop(m: Moving) {
    setMoving(null);
    hideFit();
    if (!m.ok) return;
    const next = toLayout(m.kind === "wall" ? placeWall(settled, m.key as WallKey, m.slot!) : { ...settled, floor: { ...settled.floor, [m.key]: m.at } });
    setLayout(next);
    if (p.keep !== "none") saveDenLayout(next);
  }
  function tapName(id: string) {
    const s = list.find((x) => x.key === id), w = walkers.find((x) => `walker:${x.key}` === id);
    if (s) go(s);
    else if (w) leave(w.href);
    else if (id === "walker:resting") leave("/klutz");
  }
  function go(s: Station) {
    if (s.key === "rubble") setNotice(true);
    else if (s.href) leave(s.key === "board" && p.boardNews === "daily" ? DAILY_BOARD : s.href);
  }
  // Klutz sets the Labyrinth Stone in the wall's socket: the ground rumbles and the wall sinks away.
  function setTheStone() {
    setNotice(false);
    setShaking(true);
    window.setTimeout(() => p.onBlast?.(), 300);
    window.setTimeout(() => setShaking(false), SINK * 1000);
  }

  return (
    <div className={shaking ? "screen-shake" : undefined} onPointerDown={down} onPointerMove={drag} onPointerUp={up} onPointerCancel={cancel}
      onWheel={(e) => zoomTo(across * (e.deltaY > 0 ? 1.1 : 1 / 1.1))}
      style={{ position: "relative", width: "100%", height: "100%", background: "#000", overflow: "hidden", touchAction: "none" }}>
      <div ref={pad} style={{ position: "absolute", inset: 0, touchAction: "none", cursor: moving ? "grabbing" : "grab" }}>
        <Canvas resize={{ offsetSize: true }} orthographic flat gl={{ antialias: false, powerPreference: "high-performance" }} frameloop={p.shown && !leaving ? "always" : "never"}
          style={{ position: "absolute", inset: 0, background: "#000", imageRendering: "pixelated", touchAction: "none" }}>
          <DenWorld pitch={pitch} across={across} state={state} placed={now} plan={plan} shown={shown} list={list} walkers={walkers} caged={p.caged} klutz={p.klutz}
            movingKey={moving && !moving.ok ? moving.key : null}
            foot={moving ? { box: moving.kind === "wall" ? wallFoot(moving.key as WallKey, moving.slot!) : footBox(moving.key as FloorKey, moving.at), ok: moving.ok } : null} pressedKey={moving ? null : pressed} fit={moving ? fit : null} stoneReady={p.rubble === "dynamite"}
            viewRef={view} spanRef={span} glideRef={glide} cameraRef={camera} labelsRef={labels} movedAtRef={movedAt} />
        </Canvas>
      </div>
      {/* The names over the places (and the strollers), placed by the scene each frame. (The portal's always,
          when there's a count of players online to show over it.) */}
      {list.filter((s) => !s.quiet).filter((s) => o.names || news(s) || (s.obj !== undefined && s.obj === p.highlight) || (s.key === "portal" && others !== null)).map((s) => (
        <NameTag key={s.key} id={s.key} labels={labels} tour={s.obj !== undefined ? `den-${s.obj}` : undefined} news={news(s)} lit={(s.obj !== undefined && s.obj === p.highlight) || moving?.key === s.key}
          onTap={() => go(s)} text={s.label} count={s.key === "portal" ? others : null} />
      ))}
      {walkers.filter((w) => o.names || w.news || (w.key === "klutz" && p.highlight === OBJ.klutz)).map((w) => (
        <NameTag key={w.key} id={`walker:${w.key}`} labels={labels} tour={w.tour} news={w.news} lit={w.key === "klutz" && p.highlight === OBJ.klutz}
          onTap={() => leave(w.href)} text={w.label} />
      ))}
      {p.klutz === "pool" && (o.names || p.klutzNews || p.highlight === OBJ.klutz) && <NameTag id="walker:resting" labels={labels} tour={`den-${OBJ.klutz}`} news={p.klutzNews} lit={p.highlight === OBJ.klutz} onTap={() => leave("/klutz")} text="Klutz 💤" />}
      {moving && (
        <div className="pixel-font" style={{ position: "absolute", top: 8, left: "50%", translate: "-50% 0", zIndex: 3, padding: "3px 8px", fontSize: 12, pointerEvents: "none",
          background: "rgba(12, 12, 18, 0.85)", border: `2px solid ${moving.ok ? "#6fc36f" : "#d05a5a"}`, color: "#f1d9a0" }}>
          {moving.ok ? "Let go to put it here" : "It won't fit there"}
        </div>
      )}
      {notice && (
        <div data-den-window onClick={() => setNotice(false)} style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: 16 }}>
          <div className="stone-panel" style={{ maxWidth: 320, textAlign: "center" }}>
            <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0", marginBottom: 8 }}>Old wall</div>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "#d8d4c8", margin: 0 }}>
              {p.rubble === "dynamite" ? "Klutz has the Labyrinth Stone. Set in the socket, it'll make this whole wall move." : "A wall of old carved stone, splitting the Den in two. Klutz reckons a Labyrinth Stone would make it move."}
            </p>
            {p.rubble === "dynamite"
              ? <button className="pixel-btn" style={{ marginTop: 12 }} onClick={(e) => { e.stopPropagation(); setTheStone(); }}>🔷 Use the Labyrinth Stone</button>
              : <div className="pixel-font" style={{ fontSize: 12, color: "#8a8a99", marginTop: 12 }}>Tap to close</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// A place's name, over it on screen (the scene moves it each frame). Tapping it goes there, as the place does.
// `count`: the PvP portal's players online (a number only, no names; null: not shown).
function NameTag({ id, labels, tour, news, lit, onTap, text, count = null }: { id: string; labels: React.RefObject<Map<string, HTMLElement>>; tour?: string; news: boolean; lit: boolean; onTap: () => void; text: string; count?: number | null }) {
  return (
    <button ref={(el) => { if (el) labels.current.set(id, el); else labels.current.delete(id); }} data-tour={tour} data-den-label={id} onClick={(e) => { if (e.detail === 0) onTap(); }}
      className={`pixel-font${news || lit ? " news-glow" : ""}`}
      style={{
        position: "absolute", left: 0, top: 0, visibility: "hidden", whiteSpace: "nowrap", zIndex: 2,
        padding: "1px 5px", fontSize: "clamp(10px, 2.5cqw, 13px)", lineHeight: 1.3, cursor: "pointer",
        background: lit ? "rgba(40, 28, 12, 0.95)" : "rgba(12, 12, 18, 0.72)", border: `2px solid ${lit ? "#ffd66e" : "#8a6a3a"}`, color: "#f1d9a0",
        boxShadow: "0 2px 0 rgba(0,0,0,0.6)",
      }}>
      {news && <span className="news-pulse" aria-label="Something's waiting">❗ </span>}
      {count !== null && <span className={`portal-online${count > 0 ? " portal-online-on" : ""}`} aria-label={`${count} other ${count === 1 ? "player" : "players"} online`}>{count}</span>}
      {text}
    </button>
  );
}

// Whoever's strolling at a spot on the floor (a tap on them, their height included as the camera sees it).
function walkerAt(walkers: Walker[], p: Pt, pitch: number): Walker | undefined {
  const now = performance.now() / 1000;
  return walkers.find((w) => {
    const at = strollAt(now + w.lead, w.route, w.speed);
    return Math.abs(p.x - at.x) < 0.45 && p.y < at.y + 0.3 && p.y > at.y - (NPC_U * uprightStretch(pitch)) / Math.tan(pitch) - 0.2;
  });
}

// ── The scene ──
function DenWorld({ pitch, across, state, placed, plan, shown, list, walkers, caged, klutz, movingKey, foot, pressedKey, fit, stoneReady, viewRef, spanRef, glideRef, cameraRef, labelsRef, movedAtRef }: {
  pitch: number; across: number; state: DenState; placed: Placed; plan: Floorplan; shown: Uint8Array; list: Station[]; walkers: Walker[]; caged?: string; klutz: KlutzMode;
  movingKey: string | null; foot: { box: Box; ok: boolean } | null; pressedKey: string | null; fit: { map: FitMap; rev: number } | null; stoneReady: boolean;
  viewRef: React.RefObject<Pt>; spanRef: React.RefObject<{ across: number; deep: number }>; glideRef: React.RefObject<{ from: Pt; to: Pt; at: number } | null>;
  cameraRef: React.RefObject<THREE.Camera | null>; labelsRef: React.RefObject<Map<string, HTMLElement>>; movedAtRef: React.RefObject<number | null>;
}) {
  const { size, setDpr } = useThree();
  const stretch = uprightStretch(pitch);
  const lit = useMemo(() => denLit(plan, shown), [plan, shown]);
  const seen = useMemo(() => seenField(plan, shown, "black"), [plan, shown]);
  // (The lights stand still: each one's share of the light is traced once, here, and only mixed again as they flicker.)
  const lights = useMemo(() => lightShapes(plan, lit, denLights(state, placed), plan.w / 2, plan.h / 2, WINDOW), [plan, lit, state, placed]);
  const fires = useMemo(() => braziers(placed, state), [placed, state]);
  const field = useRef<LightField | null>(null);
  const pix = pixelScale("art", DENSITY, across, size.width, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);
  const centre = useRef({ x: 0, z: 0 });
  const lastLight = useRef(-Infinity);
  const shade = (x: number, y: number) => { const [r, g, b] = shadeAt(field.current, seen.fade, plan.w, x, y, DEN_STONE); return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace); };
  const tint = (x: number, y: number) => () => shade(x, y);
  const v = useMemo(() => new THREE.Vector3(), []);

  const turn = useRef({ yaw: 0, x: NaN, at: 0 }); // (set on the first frame)
  const ctx: Tick = { pitch, cameraRef, spanRef, glideRef, viewRef, movedAtRef, labelsRef, pix, size, opened: state.opened, centre, turn, lights, field, lastLight, v, list, walkers, stretch, klutz };
  useFrame((st) => denTick(st, ctx));

  const pool = list.find((s) => s.key === "pool");
  return (
    <>
      <DenRock pitch={pitch} plan={plan} seen={seen} field={field} centre={centre} />
      {fit && <FitOverlay map={fit.map} rev={fit.rev} />}
      {foot && <Footprint {...foot} />}
      {/* Shadows on the floor under everything that stands on it (the lights don't move, so they're fixed patches). */}
      {list.filter((s) => !s.wall && !s.quiet).map((s) => <Shadow key={`shadow:${s.key}`} {...shadowOf(s)} />)}
      {fires.map((c, i) => <Shadow key={`shadow:fire${i}`} x={c.x + 0.06} y={c.y + 0.04} w={0.42} d={0.26} />)}
      {walkers.map((w) => <Shadow key={`shadow:${w.key}`} x={0} y={0} w={0.55} d={0.3} follow={() => strollAt(performance.now() / 1000 + w.lead, w.route, w.speed)} />)}
      {/* The key light from the upper left (and its ambient): only the props built from recipes take it (they're lit;
          everything else is tinted by the Den's own light field), so they keep their shape. 🧪 */}
      <ambientLight color="#ffe6c8" intensity={DEN_KEY.ambient} />
      <directionalLight color="#ffe2bd" intensity={DEN_KEY.key} position={DEN_KEY.at} />
      {list.map((s) => <Place key={s.key} s={s} tint={movingKey === s.key ? () => NO.clone() : pressedKey === s.key ? () => shade(s.x, s.y + s.d / 2).multiplyScalar(PRESS_GLOW) : tint(s.x, s.y + s.d / 2)} stretch={stretch} pitch={pitch} caged={caged}
        repaired={state.repaired} trainingPit={state.trainingPit} stoneReady={stoneReady} shack={!!state.shack} altarBroken={!!state.altarBroken} />)}
      {/* The torches on the north walls, and the braziers (with the altar, and the tavern room's pit). */}
      {SCONCES.filter((c) => state.opened || c.x < DIVIDE_X).map((c, i) => {
        const [tw, th] = KIT_LIGHTS.torchSize, w = tw / DENSITY, h = th / DENSITY;
        return (
          <Mounted key={`sconce${i}`} x={c.x} y={c.y + 0.01} up={1.25}>
            <Sconce w={w} h={h} colour={() => shade(c.x, c.y + 0.6)} />
            <Flame at={[0, h / 2 - KIT_LIGHTS.head / DENSITY, 0.03]} w={0.14} h={0.2} seed={i} />
          </Mounted>
        );
      })}
      {fires.map((c, i) => {
        const k = STANDING_TORCH_U / WALK_STANDING_TORCH.h, w = WALK_STANDING_TORCH.w * k, h = STANDING_TORCH_U * stretch, [fx, fy] = STANDING_TORCH_FLAME;
        return (
          <group key={`brazier${i}`}>
            <Upright src={WALK_STANDING_TORCH.src} x={c.x} y={c.y} w={w} h={h} below={0} colour={movingKey && isLamp(movingKey) && placed.floor[movingKey] === c ? NO.clone() : new THREE.Color(1, 1, 1)} follow={() => c} />
            <Flame at={[c.x - w / 2 + fx * k, h - fy * k * stretch + 0.08, c.y + 0.06]} w={0.1} h={0.18} seed={i + 7} />
          </group>
        );
      })}
      {/* Odds and ends along the west wall, below the storehouse. */}
      {DECOR.map((d) => <group key={d.kind} position={[d.at.x, 0, d.at.y]}><Decor3D kind={d.kind} stretch={stretch} colour={tint(d.at.x, d.at.y)} /></group>)}
      {/* Klutz resting in the pool while he heals. */}
      {klutz === "pool" && pool && CREATURE_SPRITES.klutz && (() => {
        const art = artFor(CREATURE_SPRITES.klutz)!, h = NPC_U * 0.6 * stretch, w = (NPC_U * 0.6) * (art.w / art.h);
        return <Upright src={art.src} x={pool.x + 0.3} y={pool.y} w={w} h={h} below={0} colour={tint(pool.x, pool.y)} />;
      })()}
      {walkers.map((w) => <DenWalker key={w.key} w={w} stretch={stretch} shade={shade} />)}
      {state.opened && <MovingWall movedAt={movedAtRef} wallFace={KIT.north} />}
    </>
  );
}

// Each frame (DenWorld's): the camera (where the view is, gliding, the wall's rumble), the lean, the light
// (flickering, 15 times a second) and the names over everything.
type Tick = {
  pitch: number;
  cameraRef: React.RefObject<THREE.Camera | null>; spanRef: React.RefObject<{ across: number; deep: number }>; glideRef: React.RefObject<{ from: Pt; to: Pt; at: number } | null>;
  viewRef: React.RefObject<Pt>; movedAtRef: React.RefObject<number | null>; labelsRef: React.RefObject<Map<string, HTMLElement>>;
  pix: { across: number }; size: { width: number; height: number }; opened: boolean; centre: React.RefObject<{ x: number; z: number }>;
  turn: React.RefObject<{ yaw: number; x: number; at: number }>;
  lights: LightShapes; field: React.RefObject<LightField | null>; lastLight: React.RefObject<number>;
  v: THREE.Vector3; list: Station[]; walkers: Walker[]; stretch: number; klutz: KlutzMode;
};
function denTick(state: { camera: THREE.Camera }, { pitch, cameraRef, spanRef, glideRef, viewRef, movedAtRef, labelsRef, pix, size, opened, centre, turn, lights, field, lastLight, v, list, walkers, stretch, klutz }: Tick) {
  const now = performance.now(), cam = state.camera;
  cameraRef.current = cam;
  // How much floor is in view, and where the camera looks (gliding when Klutz shows you somewhere).
  spanRef.current = { across: pix.across, deep: (pix.across * (size.height / size.width)) / Math.sin(pitch) };
  const a = denArea(opened, pitch), g = glideRef.current;
  if (g) {
    const k = Math.min(1, (now - g.at) / 700), e = k * k * (3 - 2 * k);
    viewRef.current = { x: g.from.x + (g.to.x - g.from.x) * e, y: g.from.y + (g.to.y - g.from.y) * e };
    if (k >= 1) glideRef.current = null;
  }
  viewRef.current = clampView(viewRef.current, spanRef.current.across, spanRef.current.deep, a);
  // (In whole art pixels, so the stone doesn't crawl as you drag.)
  const zs = DENSITY * Math.sin(pitch);
  centre.current = { x: Math.round(viewRef.current.x * DENSITY) / DENSITY, z: Math.round(viewRef.current.y * zs) / zs };
  const moved = movedAtRef.current === null ? Infinity : (now - movedAtRef.current) / 1000, shake = moved < SINK ? 0.05 * (1 - moved / SINK) : 0;
  const target = new THREE.Vector3(centre.current.x + (shake ? (Math.random() * 2 - 1) * shake : 0), 0, centre.current.z);
  // The turn: towards the way the view's sliding across (so you see a little round the sides you're moving past), back to square when still.
  const tn = turn.current, dt = Math.min(0.1, (now - tn.at) / 1000 || 0.016), speed = Number.isNaN(tn.x) ? 0 : (viewRef.current.x - tn.x) / dt;
  const want = Math.max(-TURN.max, Math.min(TURN.max, speed * TURN.perSpeed));
  tn.yaw += (want - tn.yaw) * Math.min(1, dt * TURN.follow);
  if (Math.abs(tn.yaw) < 0.02 && want === 0) tn.yaw = 0;
  tn.x = viewRef.current.x; tn.at = now;
  const yaw = (tn.yaw * Math.PI) / 180;
  if (cam instanceof THREE.OrthographicCamera) {
    cam.position.copy(target).addScaledVector(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)), 60);
    cam.zoom = size.width / pix.across;
    cam.near = 0.1; cam.far = 200;
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }
  PROP_LEAN.uLean.value = LEAN; PROP_LEAN.uCx.value = centre.current.x;
  // The light, flickering (15 times a second is plenty).
  if (now - lastLight.current > 66) {
    lastLight.current = now;
    field.current = mixLights(lights, lights.shapes.map((_, i) => FIRE_POWER * (0.93 + 0.07 * Math.sin(now / 110 + i * 1.7))), field.current ?? undefined);
  }
  // The names: over each place's top front, and over each stroller's head; one that would cover
  // another moves up or down out of its way (the places first, so theirs move least).
  const taken: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const put = (id: string, x: number, up: number, z: number) => {
    const el = labelsRef.current.get(id);
    if (!el) return;
    v.set(x + LEAN * (x - centre.current.x) * up, up, z).project(cam);
    const sx = ((v.x + 1) / 2) * size.width, sy0 = ((1 - v.y) / 2) * size.height;
    const w = el.offsetWidth, h = el.offsetHeight + 2;
    const at = (dy: number) => ({ x0: sx - w / 2, x1: sx + w / 2, y0: sy0 + dy - h, y1: sy0 + dy });
    const clear = (r: ReturnType<typeof at>) => !taken.some((q) => r.x0 < q.x1 && q.x0 < r.x1 && r.y0 < q.y1 && q.y0 < r.y1);
    const dy = [0, -h, h, -2 * h, 2 * h].find((d) => clear(at(d))) ?? 0, sy = sy0 + dy;
    taken.push(at(dy));
    const off = sx < -40 || sx > size.width + 40 || sy < -20 || sy > size.height + 20;
    el.style.visibility = off ? "hidden" : "visible";
    el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
  };
  for (const s of list) put(s.key, s.x, s.tall + 0.15, s.y - s.d / 2 + (s.wall ? 0.3 : 0));
  const t = now / 1000;
  for (const w of walkers) { const at = strollAt(t + w.lead, w.route, w.speed); put(`walker:${w.key}`, at.x, NPC_U * stretch + 0.1, at.y); }
  const pool = list.find((s) => s.key === "pool");
  if (pool && klutz === "pool") put("walker:resting", pool.x, NPC_U * stretch * 0.6 + 0.2, pool.y);
}

// A flame that flickers: taller and shorter, a touch wider and narrower, each on its own beat (seed), its foot kept still.
function Flame({ at, w, h, seed }: { at: [number, number, number]; w: number; h: number; seed: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = mesh.current; if (!m) return;
    const t = performance.now() / 1000 + seed * 1.37, k = 1 + 0.16 * Math.sin(t * 9.1) * Math.sin(t * 3.7 + seed), kw = 1 + 0.08 * Math.sin(t * 7.3 + seed * 2);
    m.scale.set(w * kw, h * k, 1); m.position.set(at[0], at[1] + (h * (k - 1)) / 2, at[2]);
  });
  return <mesh ref={mesh} raycast={() => null} position={at} scale={[w, h, 1]}><planeGeometry /><meshBasicMaterial color={FLAME_COLOUR} /></mesh>;
}

// The where-it-fits map over the floor while a thing's being moved: each square a spot for its middle, green where it
// fits, red where it doesn't (or would block a way out, a door, or someone's way through), nothing off the floor.
function FitOverlay({ map, rev }: { map: FitMap; rev: number }) {
  // (A new small texture each time more of the map is worked out: a few times, over a fraction of a second.)
  const tex = useMemo(() => {
    const data = new Uint8Array(map.w * map.h * 4);
    for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
      const v = map.at[j * map.w + i], c = v === 2 ? FIT_COLOURS.fits : v === 1 ? FIT_COLOURS.no : [0, 0, 0, 0];
      data.set(c, ((map.h - 1 - j) * map.w + i) * 4); // (the texture's first row is the south edge)
    }
    const t = new THREE.DataTexture(data, map.w, map.h);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
    return t;
  }, [map, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh raycast={() => null} position={[((map.w - 1) * SNAP) / 2, 0.006, ((map.h - 1) * SNAP) / 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[map.w * SNAP, map.h * SNAP, 1]} renderOrder={2}>
      <planeGeometry />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// The floor a thing being moved would take where it is now (the user, 2026-11-20: "show its footprint when moving items"):
// filled and edged, green where it can go, red where it can't, over the where-it-fits map.
function Footprint({ box, ok }: { box: Box; ok: boolean }) {
  const [r, g, b] = ok ? FOOT_COLOURS.fits : FOOT_COLOURS.no, colour = new THREE.Color(r / 255, g / 255, b / 255);
  const w = box.x1 - box.x0, d = box.y1 - box.y0;
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), []);
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <group position={[(box.x0 + box.x1) / 2, 0.008, (box.y0 + box.y1) / 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[w, d, 1]}>
      <mesh raycast={() => null} renderOrder={3}>
        <planeGeometry />
        <meshBasicMaterial color={colour} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </mesh>
      <lineSegments geometry={edges} raycast={() => null} renderOrder={4}>
        <lineBasicMaterial color={colour} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

// ── Shadows ──
// The lights never move (the user, 2026-11-19), so each thing's shadow is a fixed soft patch on the floor under it, a
// little to the lower right of it (away from the key light, upper left), in three stepped bands so it stays pixel art.
// Buildings and things against a wall throw theirs forward onto the floor in front.
const SHADOW_BANDS = [0.62, 0.42, 0.22];   // 🧪 darkness, middle to edge
const SHADOW_FALL = { x: 0.12, y: 0.1 }; // u: towards the lower right
const SHADOW_TEX = (() => {
  const n = 32, data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.hypot((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5) * 2;
    const a = r < 0.55 ? SHADOW_BANDS[0] : r < 0.8 ? SHADOW_BANDS[1] : r < 1 ? SHADOW_BANDS[2] : 0;
    data.set([0, 0, 0, Math.round(a * 255)], (j * n + i) * 4);
  }
  const t = new THREE.DataTexture(data, n, n);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
})();
function shadowOf(s: Station): { x: number; y: number; w: number; d: number } {
  const { w, d } = s;
  if (s.key === "shack" || s.key === "tavern") return { x: s.x + SHADOW_FALL.x, y: s.y + d / 2 - 0.1, w: w + 0.3, d: 1.1 };
  if (s.turn) return { x: s.x + w / 2 - 0.1, y: s.y + SHADOW_FALL.y, w: 1.1, d: d + 0.3 };
  return { x: s.x + SHADOW_FALL.x, y: s.y + SHADOW_FALL.y, w: w * 1.12 + 0.25, d: d * 1.12 + 0.2 };
}
function Shadow({ x, y, w, d, follow }: { x: number; y: number; w: number; d: number; follow?: () => { x: number; y: number } }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => { if (follow && mesh.current) { const at = follow(); mesh.current.position.set(at.x + SHADOW_FALL.x * 0.5, 0.004, at.y + 0.08); } });
  return (
    <mesh ref={mesh} raycast={() => null} position={[x, 0.004, y]} rotation={[-Math.PI / 2, 0, 0]} scale={[w, d, 1]} renderOrder={1}>
      <planeGeometry />
      <meshBasicMaterial map={SHADOW_TEX} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// The carved rock, in the Labyrinth's Stone shader, lit by the Den's lights.
function DenRock({ pitch, plan, seen, field, centre }: { pitch: number; plan: Floorplan; seen: { shown: Uint8Array; fade: Float32Array }; field: React.RefObject<LightField | null>; centre: React.RefObject<{ x: number; z: number }> }) {
  const geo = useMemo(() => {
    const h = rockHeights(plan, (i) => plan.tiles[i] !== ROCK, DEN_WALL, true);
    // All the rock south of the hall is the low rim: from a flatter camera, full-height rock there hid the hall's front.
    for (let y = ROOM1.y + ROOM1.h; y < plan.h; y++) for (let x = 0; x < plan.w; x++) if (h[y * plan.w + x] > 0) h[y * plan.w + x] = SOUTH_LIP;
    const m = carvedMesh(h, plan.w, plan.h, DEN_WALL, ROCK_MARGIN);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
    g.computeBoundingSphere();
    return g;
  }, [plan]);
  useEffect(() => () => geo.dispose(), [geo]);
  const grids = useMemo(() => {
    const seenTex = gridTexture(plan.w, plan.h);
    fillGrid(seenTex, seen.fade, seen.shown);
    const none = new Uint8Array(plan.w * plan.h);
    return { light: gridTexture(WINDOW * SUB, WINDOW * SUB), seen: seenTex, face: codeTexture(none, plan.w, plan.h), moss: codeTexture(none, plan.w, plan.h) };
  }, [plan, seen]);
  useEffect(() => () => { for (const t of Object.values(grids)) t.dispose(); }, [grids]);
  // The shader, made on the first frame and put on the mesh then (as the Labyrinth's StoneRock), its
  // settings kept in a ref and set each frame (cheap).
  const uni = useRef(stoneUniforms());
  const mat = useRef<THREE.ShaderMaterial | null>(null), mesh = useRef<THREE.Mesh>(null);
  useEffect(() => () => mat.current?.dispose(), []);
  const lastFill = useRef(-Infinity);
  useFrame(() => {
    const u = uni.current, now = performance.now(), k = KIT.size;
    mat.current ??= new THREE.ShaderMaterial({ uniforms: u, vertexShader: STONE_VERTEX, fragmentShader: STONE_FRAGMENT });
    if (mesh.current && mesh.current.material !== mat.current) mesh.current.material = mat.current;
    u.uFloor.value = rawTexture(KIT.floor); u.uFloorSize.value.set(k.px, k.row);
    u.uFace.value = rawTexture(KIT.north); u.uFaceSize.value.set(k.px, k.north); u.uFaceRows.value = k.north - k.cap;
    u.uRim.value = rawTexture(KIT.cap); u.uRimSize.value.set(k.px, k.cap);
    for (const key of ["uMoss", "uHole", "uWebA", "uWebB", "uWebC", "uWebD"] as const) u[key].value = rawTexture(KIT.floor);
    u.uUp.value.set(...texelsPerU("up", DENSITY, pitch, "screen"));
    u.uSide.value.set(...texelsPerU("face", DENSITY, pitch, "screen"));
    u.uWall.value = DEN_WALL; u.uRemember.value = DEN_STONE.remember; u.uGain.value = DEN_STONE.gain;
    u.uWarm.value.set(...DEN_STONE.warm); u.uFlame.value.set(...DEN_STONE.flame);
    u.uLean.value = LEAN; u.uPlan.value.set(plan.w, plan.h); u.uCx.value = centre.current.x;
    u.uSeen.value = grids.seen; u.uFaceVar.value = grids.face; u.uMossVar.value = grids.moss; u.uMossRows.value = plan.h; u.uLight.value = grids.light;
    // (The light's worked out 15 times a second, in the same grid each time: sent on as often.)
    const f = field.current;
    if (f && now - lastFill.current > 60) { lastFill.current = now; fillGrid(grids.light, f.torch, f.other); u.uWin.value.set(f.x0 - 0.5, f.y0 - 0.5, f.size); }
  });
  return <mesh ref={mesh} geometry={geo} raycast={() => null} />;
}

// Someone strolling round (their walk while they move, their still while they stop), facing the way they go.
function DenWalker({ w, stretch, shade }: { w: Walker; stretch: number; shade: (x: number, y: number) => THREE.Color }) {
  const art = artFor(w.sprite);
  if (!art?.walk) return null;
  const width = art.w * (NPC_U / art.h);
  // (The Labyrinth's people face left in their art; Klutz faces right, so he's turned the other way.)
  const find = () => {
    const at = strollAt(performance.now() / 1000 + w.lead, w.route, w.speed);
    return { x: at.x, y: at.y, facing: w.faces === "right" ? Math.PI - at.facing : at.facing, path: at.moving ? [at] : [] };
  };
  return <Stroller find={find} art={art} w={width} stretch={stretch} shade={shade} />;
}
