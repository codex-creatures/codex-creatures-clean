"use client";
// components/Den3D.tsx
// 🧪 The new Den (Settings → New Den: lib/den3d/setting.ts; the user, 2026-11-18): the Den as a room of
// the Labyrinth, drawn as the Labyrinth is (components/WalkView3D.tsx's Stone: the carved rock and its
// shader, the camera at 60°, the lean, art pixels at 48 a unit and 15 units across), lit warmer. Where
// everything stands, its lights and who strolls where are lib/den3d/layout.ts's.
// No walking: drag to look round (the camera stays on the Den: room 1 till the rubble's blown, then
// both), tap a place to go in. Every place has its name over it, a ❗ when something's waiting there.
// The rubble: tap it, and with Klutz's dynamite, blow it; the wall between the rooms comes down.
// Things built in 3D for the dungeon stand here as they are (the bookcase, the cage, the lectern, the
// standing and wall torches); the buildings, the altar, the pits, the board and the portal are plain
// stand-ins (🧪) till their art's made and approved (docs/design/den.md, "The new Den").

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ROCK, type Floorplan, type Pt } from "@/lib/dungeon/floorplan";
import {
  denPlan, denShown, denLit, denLights, stations, stationAt, strollAt, loopTime, clampView, denArea, firstView,
  KLUTZ_LOOP, VISITOR_LOOP, STROLL, SCONCES, BRAZIERS, BRAZIERS_2, DEN_WALL, DIVIDE_X, ROOM1, WALL_GAP, type Station, type DenState,
} from "@/lib/den3d/layout";
import { lightField, seenField, shadeAt, texelsPerU, pixelScale, WINDOW, SUB, type LightField } from "@/lib/render3d/stone";
import { rockHeights, carvedMesh, uprightStretch, ROCK_MARGIN, SOUTH_LIP } from "@/lib/render3d/dungeon3d";
import {
  STONE, STONE_VERTEX, STONE_FRAGMENT, stoneUniforms, rawTexture, gridTexture, codeTexture, fillGrid,
  Upright, Mounted, Sconce, Stroller, FLAME_COLOUR,
} from "@/components/WalkView3D";
import { Prop3D, Glow, PROP_LEAN, makeFlat, bases, useTint, loaded, type Tint } from "@/components/Props3D";
import { BUILDINGS, buildingWide, buildingWalls, ALTAR, POOL_TOP, PIT_TOP, SPARRING_TOP, ARCH, PORTAL, NOTES, ART_PX, FACE_PX, TOP_PX, type BuildingArt, type Pic } from "@/lib/den3d/art";
import { Decor3D } from "@/components/Decor3D";
import { WALK_TILES, KIT_LIGHTS, WALK_STANDING_TORCH, STANDING_TORCH_U, STANDING_TORCH_FLAME } from "@/lib/sprites/walk";
import { NPC_U } from "@/lib/world/objects";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { artFor } from "@/lib/sprites/art";
import { COLLECTOR, ENCHANTRESS, LIBRARIAN, MERCHANT } from "@/lib/sprites/props";
import type { Sprite } from "@/lib/sprites/pixels";
import { OBJ, type KlutzMode, type ObjId } from "@/lib/den/scene";
import { tavernVisitors, type TavernQuest, type Visitor } from "@/lib/tavern";
import { SPOTS, VISITOR_HREF, type Rubble } from "@/components/DenRoom";
import { useDenOptions } from "@/hooks/useNewDen";
import { DEN_DEFAULTS, type DenOptions } from "@/lib/den3d/setting";

// (The camera's angle down from the horizon is the Den's option: the Labyrinth's 60° unless changed.)
const LEAN = 0.03;
const ACROSS = 15;                // units across the screen
const DENSITY = 48;               // art pixels a unit
const HOLD_DRAG = 8;              // px a finger moves before it's a drag, not a tap
const FALL_TIME = 0.9;            // s: the wall coming down
// 🧪 The Den's walls: the Labyrinth's kit F, every pixel kept, recoloured warm (scripts/den-kit-warm.mjs).
const LAB_KIT = WALK_TILES[0].kit!;
const KIT = { ...LAB_KIT, floor: "/sprites/den3d/kit-floor.png", north: "/sprites/den3d/kit-north.png", cap: "/sprites/den3d/kit-cap.png" };
// The Den's light: warmer than the Labyrinth's and never pitch dark (it's home). 🧪
const DEN_STONE = { ...STONE, remember: 0.3, gain: 1.15, warm: [1, 0.82, 0.6] as [number, number, number], flame: [1, 0.76, 0.5] as [number, number, number] };
const FIRE_POWER = 0.8;           // 🧪 each light's strength (STONE.fire's 0.85 in the Labyrinth)

export type Den3DProps = {
  caged?: string; klutz: KlutzMode; klutzNews: boolean; highlight?: ObjId; rubble: Rubble; onBlast?: () => void;
  tavern: TavernQuest; pit?: { ready: boolean }; tavernNews: boolean; boardNews: boolean; crateNews: boolean; cageNews: boolean;
  options?: DenOptions; // (the lab's; the game's are the player's own, from Settings)
};

// Where the view was left, for the whole visit to the site (and with the wall up or down), so coming
// back from a place opens where you were.
let lastView: { at: Pt; opened: boolean } | null = null;

// Someone strolling: Klutz, or a visitor. `lead`: seconds along their loop.
type Walker = { key: string; label: string; href: string; sprite: Sprite; loop: [number, number][]; speed: number; lead: number; news: boolean; tour?: string; faces: "left" | "right" };
const VISITOR_SPRITE: Record<Visitor, Sprite> = { merchant: MERCHANT, librarian: LIBRARIAN, collector: COLLECTOR, enchantress: ENCHANTRESS };
const VISITOR_LABEL: Record<Visitor, string> = { merchant: "Merchant", librarian: "Librarian", collector: "Collector", enchantress: "Enchantress" };

export default function Den3D(p: Den3DProps) {
  const router = useRouter();
  const opened = p.rubble === "open";
  // The player's options (Settings: lib/den3d/setting.ts): names, the stones left, the camera's angle.
  const stored = useDenOptions(), o = p.options ?? stored ?? DEN_DEFAULTS, pitch = (o.angle * Math.PI) / 180;
  const hasPit = !!p.pit, trainingPit = !!p.tavern.pit, repaired = !!p.tavern.repaired;
  const list = useMemo(() => stations({ opened, pit: hasPit, trainingPit, repaired } satisfies DenState), [opened, hasPit, trainingPit, repaired]);
  const view = useRef<Pt>(lastView && lastView.opened === opened ? lastView.at : firstView(opened, pitch));
  const span = useRef({ across: ACROSS, deep: 10 });  // floor units in view (set by the scene from its size)
  const camera = useRef<THREE.Camera | null>(null);
  const pad = useRef<HTMLDivElement>(null);
  const labels = useRef(new Map<string, HTMLElement>());
  const [notice, setNotice] = useState(false);       // the rubble's window
  const [shaking, setShaking] = useState(false);
  const fellAt = useRef<number | null>(null);       // when the wall came down (this visit)
  const wasOpen = useRef(opened);
  const glide = useRef<{ from: Pt; to: Pt; at: number } | null>(null);
  const move = (to: Pt) => { glide.current = { from: { ...view.current }, to, at: performance.now() }; };

  // The wall coming down: it falls, and the view glides out to both rooms.
  useEffect(() => {
    if (opened && !wasOpen.current) { fellAt.current = performance.now(); move(firstView(true, pitch)); }
    wasOpen.current = opened;
  }, [opened, pitch]); // (a new angle with the wall already down does nothing: wasOpen)
  // Klutz (his tour, or where he's sent you) shows a place: the view goes to it.
  useEffect(() => {
    const s = p.highlight === undefined ? undefined : list.find((x) => x.obj === p.highlight);
    if (s) move({ x: s.x, y: s.y - 1 });
  }, [p.highlight, list]);
  useEffect(() => () => { lastView = { at: view.current, opened: wasOpen.current }; }, []);

  // Klutz strolling round room 1 while he's home; visitors round the whole Den once it's open.
  const walkers = useMemo(() => {
    const out: Walker[] = [];
    if (p.klutz === "home" && CREATURE_SPRITES.klutz) out.push({ key: "klutz", label: "Klutz", href: "/klutz", sprite: CREATURE_SPRITES.klutz, loop: KLUTZ_LOOP, speed: STROLL.klutz, lead: 0, news: p.klutzNews, tour: `den-${OBJ.klutz}`, faces: "right" });
    if (opened) {
      const who = tavernVisitors(p.tavern), T = loopTime(VISITOR_LOOP, STROLL.visitor);
      who.forEach((v, i) => out.push({ key: v, label: VISITOR_LABEL[v], href: `${VISITOR_HREF}?v=${v}`, sprite: VISITOR_SPRITE[v], loop: VISITOR_LOOP, speed: STROLL.visitor, lead: (i * T) / who.length, news: true, faces: "left" }));
    }
    return out;
  }, [p.klutz, p.klutzNews, opened, p.tavern]);

  // What's waiting where (a ❗ on its name).
  const news = (s: Station) => (s.key === "shack" && (p.crateNews || (p.klutz !== "home" && p.klutzNews))) || (s.key === "cage" && p.cageNews)
    || (s.key === "board" && p.boardNews) || (s.key === "tavern" && p.tavernNews) || (s.key === "training" && !!p.pit?.ready);

  // ── Drag to look, tap to go in ──
  // (Over the whole picture, its names included: a drag that starts on a name still looks round, and a tap
  // on one goes where the name says. `label`: the name a press started on.)
  const held = useRef<{ id: number; x: number; y: number; x0: number; y0: number; drag: boolean; label: string | null } | null>(null);
  const floorAt = (clientX: number, clientY: number): Pt | null => {
    const cam = camera.current, el = pad.current;
    if (!cam || !el) return null;
    const box = el.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - box.left) / box.width) * 2 - 1, 1 - ((clientY - box.top) / box.height) * 2), cam);
    const q = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    return q ? { x: q.x, y: q.z } : null;
  };
  const down = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-den-window]")) return; // (the rubble's window: its own taps)
    held.current = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, drag: false, label: t.closest("[data-den-label]")?.getAttribute("data-den-label") ?? null };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const drag = (e: React.PointerEvent) => {
    const h = held.current, el = pad.current;
    if (!h || h.id !== e.pointerId || !el) return;
    if (!h.drag && Math.hypot(e.clientX - h.x0, e.clientY - h.y0) > HOLD_DRAG) h.drag = true;
    if (!h.drag) return;
    const perPx = ACROSS / el.getBoundingClientRect().width;
    glide.current = null;
    view.current = clampView({ x: view.current.x - (e.clientX - h.x) * perPx, y: view.current.y - ((e.clientY - h.y) * perPx) / Math.sin(pitch) },
      span.current.across, span.current.deep, denArea(opened, pitch));
    h.x = e.clientX; h.y = e.clientY;
  };
  const up = (e: React.PointerEvent) => {
    const h = held.current;
    if (!h || h.id !== e.pointerId) return;
    held.current = null;
    if (h.drag) return;
    if (h.label) { tapName(h.label); return; }
    const at = floorAt(e.clientX, e.clientY);
    if (!at) return;
    const w = walkerAt(walkers, at, pitch);
    if (w) { router.push(w.href); return; }
    const s = stationAt(list, at, pitch);
    if (s) go(s);
  };
  function tapName(id: string) {
    const s = list.find((x) => x.key === id), w = walkers.find((x) => `walker:${x.key}` === id);
    if (s) go(s);
    else if (w) router.push(w.href);
    else if (id === "walker:resting") router.push("/klutz");
  }
  function go(s: Station) {
    if (s.key === "rubble") setNotice(true);
    else if (s.href) router.push(s.href);
  }
  function lightDynamite() {
    setNotice(false);
    setShaking(true);
    window.setTimeout(() => p.onBlast?.(), 300);
    window.setTimeout(() => setShaking(false), 900);
  }

  return (
    <div className={shaking ? "screen-shake" : undefined} onPointerDown={down} onPointerMove={drag} onPointerUp={up} onPointerCancel={() => { held.current = null; }}
      style={{ position: "relative", width: "100%", height: "100%", background: "#000", overflow: "hidden", touchAction: "none" }}>
      <div ref={pad} style={{ position: "absolute", inset: 0, touchAction: "none", cursor: "grab" }}>
        <Canvas resize={{ offsetSize: true }} orthographic flat gl={{ antialias: false, powerPreference: "high-performance" }}
          style={{ position: "absolute", inset: 0, background: "#000", imageRendering: "pixelated", touchAction: "none" }}>
          <DenWorld pitch={pitch} rubbleLeft={o.rubble} opened={opened} repaired={repaired} list={list} walkers={walkers} caged={p.caged} klutz={p.klutz}
            viewRef={view} spanRef={span} glideRef={glide} cameraRef={camera} labelsRef={labels} fellAtRef={fellAt} />
        </Canvas>
      </div>
      {/* The names over the places (and the strollers), placed by the scene each frame. */}
      {list.filter((s) => o.names || news(s) || (s.obj !== undefined && s.obj === p.highlight)).map((s) => (
        <NameTag key={s.key} id={s.key} labels={labels} tour={s.obj !== undefined ? `den-${s.obj}` : undefined} news={news(s)} lit={s.obj !== undefined && s.obj === p.highlight}
          onTap={() => go(s)} text={s.label} />
      ))}
      {walkers.filter((w) => o.names || w.news || (w.key === "klutz" && p.highlight === OBJ.klutz)).map((w) => (
        <NameTag key={w.key} id={`walker:${w.key}`} labels={labels} tour={w.tour} news={w.news} lit={w.key === "klutz" && p.highlight === OBJ.klutz}
          onTap={() => router.push(w.href)} text={w.label} />
      ))}
      {p.klutz === "pool" && (o.names || p.klutzNews || p.highlight === OBJ.klutz) && <NameTag id="walker:resting" labels={labels} tour={`den-${OBJ.klutz}`} news={p.klutzNews} lit={p.highlight === OBJ.klutz} onTap={() => router.push("/klutz")} text="Klutz 💤" />}
      {notice && (
        <div data-den-window onClick={() => setNotice(false)} style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: 16 }}>
          <div className="stone-panel" style={{ maxWidth: 320, textAlign: "center" }}>
            <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0", marginBottom: 8 }}>Rubble</div>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "#d8d4c8", margin: 0 }}>{SPOTS[OBJ.tavern].soon}</p>
            {p.rubble === "dynamite"
              ? <button className="pixel-btn" style={{ marginTop: 12 }} onClick={(e) => { e.stopPropagation(); lightDynamite(); }}>🧨 Use the dynamite</button>
              : <div className="pixel-font" style={{ fontSize: 12, color: "#8a8a99", marginTop: 12 }}>Tap to close</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// A place's name, over it on screen (the scene moves it each frame). Tapping it goes there, as the place does.
function NameTag({ id, labels, tour, news, lit, onTap, text }: { id: string; labels: React.RefObject<Map<string, HTMLElement>>; tour?: string; news: boolean; lit: boolean; onTap: () => void; text: string }) {
  return (
    <button ref={(el) => { if (el) labels.current.set(id, el); else labels.current.delete(id); }} data-tour={tour} data-den-label={id} onClick={(e) => { if (e.detail === 0) onTap(); }}
      className={`pixel-font${news || lit ? " news-glow" : ""}`}
      style={{
        position: "absolute", left: 0, top: 0, visibility: "hidden", whiteSpace: "nowrap", zIndex: 2,
        padding: "1px 5px", fontSize: "clamp(10px, 2.5cqw, 13px)", lineHeight: 1.3, cursor: "pointer",
        background: lit ? "rgba(40, 28, 12, 0.95)" : "rgba(12, 12, 18, 0.72)", border: `2px solid ${lit ? "#ffd66e" : "#8a6a3a"}`, color: "#f1d9a0",
        boxShadow: "0 2px 0 rgba(0,0,0,0.6)",
      }}>
      {news && <span className="news-pulse" aria-label="Something's waiting">❗ </span>}{text}
    </button>
  );
}

// Whoever's strolling at a spot on the floor (a tap on them, their height included as the camera sees it).
function walkerAt(walkers: Walker[], p: Pt, pitch: number): Walker | undefined {
  const now = performance.now() / 1000;
  return walkers.find((w) => {
    const at = strollAt(now + w.lead, w.loop, w.speed);
    return Math.abs(p.x - at.x) < 0.45 && p.y < at.y + 0.3 && p.y > at.y - (NPC_U * uprightStretch(pitch)) / Math.tan(pitch) - 0.2;
  });
}

// ── The scene ──
function DenWorld({ pitch, rubbleLeft, opened, repaired, list, walkers, caged, klutz, viewRef, spanRef, glideRef, cameraRef, labelsRef, fellAtRef }: {
  pitch: number; rubbleLeft: boolean; opened: boolean; repaired: boolean; list: Station[]; walkers: Walker[]; caged?: string; klutz: KlutzMode;
  viewRef: React.RefObject<Pt>; spanRef: React.RefObject<{ across: number; deep: number }>; glideRef: React.RefObject<{ from: Pt; to: Pt; at: number } | null>;
  cameraRef: React.RefObject<THREE.Camera | null>; labelsRef: React.RefObject<Map<string, HTMLElement>>; fellAtRef: React.RefObject<number | null>;
}) {
  const { size, setDpr } = useThree();
  const stretch = uprightStretch(pitch);
  const plan = useMemo(() => denPlan(opened), [opened]);
  const shown = useMemo(() => denShown(opened), [opened]);
  const lit = useMemo(() => denLit(plan, shown), [plan, shown]);
  const seen = useMemo(() => seenField(plan, shown, "black"), [plan, shown]);
  const lights = useMemo(() => denLights(opened, repaired), [opened, repaired]);
  const field = useRef<LightField | null>(null);
  const pix = pixelScale("art", DENSITY, ACROSS, size.width, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);
  const centre = useRef({ x: 0, z: 0 });
  const lastLight = useRef(-Infinity);
  const shade = (x: number, y: number) => { const [r, g, b] = shadeAt(field.current, seen.fade, plan.w, x, y, DEN_STONE); return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace); };
  const tint = (x: number, y: number) => () => shade(x, y);
  const v = useMemo(() => new THREE.Vector3(), []);

  const ctx: Tick = { pitch, cameraRef, spanRef, glideRef, viewRef, fellAtRef, labelsRef, pix, size, opened, centre, lights, lit, plan, field, lastLight, v, list, walkers, stretch, klutz };
  useFrame((state) => denTick(state, ctx));

  const at = (key: string) => list.find((s) => s.key === key);
  const pool = at("pool");
  return (
    <>
      <DenRock pitch={pitch} plan={plan} seen={seen} field={field} centre={centre} />
      {list.map((s) => <Place key={s.key} s={s} tint={tint(s.x, s.y + s.d / 2)} stretch={stretch} caged={caged} repaired={repaired} />)}
      {/* The torches on the north walls, and the braziers by the altar. */}
      {SCONCES.filter((c) => opened || c.x < DIVIDE_X).map((c, i) => {
        const [tw, th] = KIT_LIGHTS.torchSize, w = tw / DENSITY, h = th / DENSITY;
        return (
          <Mounted key={`sconce${i}`} x={c.x} y={c.y + 0.01} up={1.25}>
            <Sconce w={w} h={h} colour={() => shade(c.x, c.y + 0.6)} />
            <mesh raycast={() => null} position={[0, h / 2 - KIT_LIGHTS.head / DENSITY, 0.03]} scale={[0.14, 0.2, 1]}><planeGeometry /><meshBasicMaterial color={FLAME_COLOUR} /></mesh>
          </Mounted>
        );
      })}
      {[...BRAZIERS, ...(opened ? BRAZIERS_2 : [])].map((c, i) => {
        const k = STANDING_TORCH_U / WALK_STANDING_TORCH.h, w = WALK_STANDING_TORCH.w * k, h = STANDING_TORCH_U * stretch, [fx, fy] = STANDING_TORCH_FLAME;
        return (
          <group key={`brazier${i}`}>
            <Upright src={WALK_STANDING_TORCH.src} x={c.x} y={c.y} w={w} h={h} below={0} colour={new THREE.Color(1, 1, 1)} />
            <mesh raycast={() => null} position={[c.x - w / 2 + fx * k, h - fy * k * stretch + 0.08, c.y + 0.06]} scale={[0.1, 0.18, 1]}><planeGeometry /><meshBasicMaterial color={FLAME_COLOUR} /></mesh>
          </group>
        );
      })}
      {/* Odds and ends along the walls. */}
      <group position={[ROOM1.x + 0.1, 0, 11]}><Decor3D kind="crates" stretch={stretch} colour={tint(ROOM1.x + 0.1, 11)} /></group>
      <group position={[ROOM1.x + 0.1, 0, 15.7]}><Decor3D kind="barrels" stretch={stretch} colour={tint(ROOM1.x + 0.1, 15.7)} /></group>
      <group position={[ROOM1.x + 0.1, 0, 18.1]}><Decor3D kind="pots" stretch={stretch} colour={tint(ROOM1.x + 0.1, 18.1)} /></group>
      {/* Klutz resting in the pool while he heals. */}
      {klutz === "pool" && pool && CREATURE_SPRITES.klutz && (() => {
        const art = artFor(CREATURE_SPRITES.klutz)!, h = NPC_U * 0.6 * stretch, w = (NPC_U * 0.6) * (art.w / art.h);
        return <Upright src={art.src} x={pool.x + 0.3} y={pool.y} w={w} h={h} below={0} colour={tint(pool.x, pool.y)} />;
      })()}
      {walkers.map((w) => <DenWalker key={w.key} w={w} stretch={stretch} shade={shade} />)}
      {opened && rubbleLeft && <FallenWall fellAtRef={fellAtRef} shade={shade} />}
    </>
  );
}

// Each frame (DenWorld's): the camera (where the view is, gliding, the wall's shake), the lean, the light
// (flickering, 15 times a second) and the names over everything.
type Tick = {
  pitch: number;
  cameraRef: React.RefObject<THREE.Camera | null>; spanRef: React.RefObject<{ across: number; deep: number }>; glideRef: React.RefObject<{ from: Pt; to: Pt; at: number } | null>;
  viewRef: React.RefObject<Pt>; fellAtRef: React.RefObject<number | null>; labelsRef: React.RefObject<Map<string, HTMLElement>>;
  pix: { across: number }; size: { width: number; height: number }; opened: boolean; centre: React.RefObject<{ x: number; z: number }>;
  lights: { x: number; y: number; r: number }[]; lit: Uint8Array; plan: Floorplan; field: React.RefObject<LightField | null>; lastLight: React.RefObject<number>;
  v: THREE.Vector3; list: Station[]; walkers: Walker[]; stretch: number; klutz: KlutzMode;
};
function denTick(state: { camera: THREE.Camera }, { pitch, cameraRef, spanRef, glideRef, viewRef, fellAtRef, labelsRef, pix, size, opened, centre, lights, lit, plan, field, lastLight, v, list, walkers, stretch, klutz }: Tick) {
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
  const fell = fellAtRef.current === null ? Infinity : (now - fellAtRef.current) / 1000, shake = fell < FALL_TIME ? 0.08 * (1 - fell / FALL_TIME) : 0;
  const target = new THREE.Vector3(centre.current.x + (shake ? (Math.random() * 2 - 1) * shake : 0), 0, centre.current.z);
  if (cam instanceof THREE.OrthographicCamera) {
    cam.position.copy(target).addScaledVector(new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)), 60);
    cam.zoom = size.width / pix.across;
    cam.near = 0.1; cam.far = 200;
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }
  PROP_LEAN.uLean.value = LEAN; PROP_LEAN.uCx.value = centre.current.x;
  // The light, flickering (15 times a second is plenty).
  if (now - lastLight.current > 66) {
    lastLight.current = now;
    const ls = lights.map((l, i) => ({ ...l, power: FIRE_POWER * (0.93 + 0.07 * Math.sin(now / 110 + i * 1.7)) }));
    field.current = lightField(plan, lit, null, ls, plan.w / 2, plan.h / 2, WINDOW, field.current ?? undefined);
  }
  // The names: over each place's top front, and over each stroller's head; one that would cover
  // another moves up or down out of its way (the places first, so theirs move least).
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const put = (id: string, x: number, up: number, z: number) => {
    const el = labelsRef.current.get(id);
    if (!el) return;
    v.set(x + LEAN * (x - centre.current.x) * up, up, z).project(cam);
    const sx = ((v.x + 1) / 2) * size.width, sy0 = ((1 - v.y) / 2) * size.height;
    const w = el.offsetWidth, h = el.offsetHeight + 2;
    const at = (dy: number) => ({ x0: sx - w / 2, x1: sx + w / 2, y0: sy0 + dy - h, y1: sy0 + dy });
    const clear = (r: ReturnType<typeof at>) => !placed.some((q) => r.x0 < q.x1 && q.x0 < r.x1 && r.y0 < q.y1 && q.y0 < r.y1);
    const dy = [0, -h, h, -2 * h, 2 * h].find((d) => clear(at(d))) ?? 0, sy = sy0 + dy;
    placed.push(at(dy));
    const off = sx < -40 || sx > size.width + 40 || sy < -20 || sy > size.height + 20;
    el.style.visibility = off ? "hidden" : "visible";
    el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
  };
  for (const s of list) put(s.key, s.x, s.tall + 0.15, s.y - s.d / 2 + (s.wall ? 0.3 : 0));
  const t = now / 1000;
  for (const w of walkers) { const at = strollAt(t + w.lead, w.loop, w.speed); put(`walker:${w.key}`, at.x, NPC_U * stretch + 0.1, at.y); }
  const pool = list.find((s) => s.key === "pool");
  if (pool && klutz === "pool") put("walker:resting", pool.x, NPC_U * stretch * 0.6 + 0.2, pool.y);
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
    const at = strollAt(performance.now() / 1000 + w.lead, w.loop, w.speed);
    return { x: at.x, y: at.y, facing: w.faces === "right" ? Math.PI - at.facing : at.facing, path: at.moving ? [at] : [] };
  };
  return <Stroller find={find} art={art} w={width} stretch={stretch} shade={shade} />;
}

// The rubble's wall, come down: stones all along where it stood (falling, the moment it goes).
function FallenWall({ fellAtRef, shade }: { fellAtRef: React.RefObject<number | null>; shade: (x: number, y: number) => THREE.Color }) {
  const group = useRef<THREE.Group>(null);
  const mats = useFlat(["#8e6d48", "#715639", "#a98659", "#55402b"], () => shade(DIVIDE_X, (WALL_GAP.y0 + WALL_GAP.y1) / 2));
  const stones = useMemo(() => {
    const out: { x: number; y: number; s: number; k: number }[] = [];
    for (let y = WALL_GAP.y0; y < WALL_GAP.y1; y++) for (let k = 0; k < 3; k++) {
      const r = (n: number) => (((y * 37 + k * 17 + n * 11) % 13) / 13) - 0.5;
      out.push({ x: DIVIDE_X + r(1) * 1.4, y: y + r(2) * 0.9, s: 0.12 + 0.08 * ((k + y) % 3), k: (y + k) % 4 });
    }
    return out;
  }, []);
  useFrame(() => {
    const fell = fellAtRef.current === null ? Infinity : (performance.now() - fellAtRef.current) / 1000;
    if (group.current) group.current.position.y = fell < FALL_TIME ? (1 - fell / FALL_TIME) ** 2 * DEN_WALL : 0;
  });
  return (
    <group ref={group}>
      {stones.map((q, i) => (
        <mesh key={i} material={mats[q.k]} raycast={() => null} position={[q.x, q.s * 0.5, q.y]} scale={[q.s, q.s * 0.7, q.s * 0.8]}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}

// ── Each place (🧪 its art samples: lib/den3d/art.ts) ──
function Place({ s, tint, stretch, caged, repaired }: { s: Station; tint: () => THREE.Color; stretch: number; caged?: string; repaired: boolean }) {
  const at: [number, number, number] = [s.x, 0, s.y];
  switch (s.key) {
    case "bookcase": return <group position={at}><Prop3D kind="bookcase" colour={tint} /></group>;
    case "lectern": return <group position={at}><Decor3D kind="lectern" stretch={stretch} colour={tint} /></group>;
    case "cage": {
      const sprite = caged ? CREATURE_SPRITES[caged] : undefined, art = sprite && artFor(sprite);
      const tall = 0.8, w = art ? tall * (art.w / art.h) : 0;
      return (
        <group position={at}>
          <Decor3D kind="cage" stretch={stretch} colour={tint} />
          {art && <Upright src={art.src} x={0} y={0} w={Math.min(w, 0.9)} h={tall * stretch} below={-0.14} colour={tint} />}
        </group>
      );
    }
    case "shack": return <Building at={at} d={s.d} art={BUILDINGS.shack} tint={tint} />;
    case "storehouse": return <Building at={at} d={s.d} art={BUILDINGS.storehouse} tint={tint} />;
    case "tavern": return <Building at={at} d={s.d} art={BUILDINGS.tavern} broken={!repaired} tint={tint} />;
    case "arch": return <OnWall s={s} pic={ARCH} tint={tint} />;
    case "portal": return (<>
      <OnWall s={s} pic={PORTAL} tint={() => new THREE.Color(1, 1, 1)} />
      <group position={[s.x, 0, s.y + 0.6]}><Glow colour="#7fdc8a" radius={1.4} strength={0.3} /></group>
    </>);
    case "board": return <OnWall s={s} pic={NOTES} tint={tint} backing={{ colour: "#5e432a", pad: 0.12 }} />;
    case "altar": {
      const w = ALTAR.w / ART_PX, h = (ALTAR.h / ART_PX) * stretch;
      return (<>
        <Upright src={ALTAR.src} x={s.x} y={s.y + s.d / 2 - 0.2} w={w} h={h} below={0} colour={new THREE.Color(1, 1, 1)} />
        <group position={at}><Glow colour="#5fe0d0" radius={2.2} strength={0.3} /></group>
      </>);
    }
    case "pool": return (<>
      <Slab at={at} pic={POOL_TOP} tint={tint} tall={0.04} />
      <group position={at}><Glow colour="#5fe0d0" radius={1.1} strength={0.3} y={0.05} /></group>
    </>);
    case "pit": return <Slab at={at} pic={PIT_TOP} tint={tint} />;
    case "training": return <Slab at={at} pic={SPARRING_TOP} tint={tint} />;
    case "rubble": return <Rubbled s={s} tint={tint} />;
  }
}

// A picture's material: flat, leaning as the rock does, tinted by the light where it stands. `uv`: only
// part of it (x, y from the bottom, width, height, as fractions).
function usePicture(src: string, tint: Tint, uv?: [number, number, number, number]) {
  const key = uv?.join() ?? "";
  const mat = useMemo(() => {
    const t = loaded(src).clone();
    const u = key ? key.split(",").map(Number) : null;
    if (u) { t.offset.set(u[0], u[1]); t.repeat.set(u[2], u[3]); }
    t.needsUpdate = true;
    const m = makeFlat({ map: t, side: THREE.DoubleSide });
    m.transparent = true; m.alphaTest = 0.5;
    return m;
  }, [src, key]);
  useTint([mat], useMemo(() => bases([mat]), [mat]), tint);
  return mat;
}

// A building (its art: lib/den3d/art.ts BUILDINGS): as wide as its front and as tall as its walls, the front
// painted on, its ends a strip of the front's end, and a pitched roof running east-west: the roof's picture
// on the slope facing you, its top part (darker) on the slope behind. Its gables in plain dark wood.
function Building({ at, d, art, broken, tint }: { at: [number, number, number]; d: number; art: BuildingArt; broken?: boolean; tint: () => THREE.Color }) {
  const w = buildingWide(art), wallH = buildingWalls(art), over = 0.15, half = d / 2 + over, rise = art.rise;
  const front = usePicture((broken && art.broken ? art.broken : art.front).src, tint);
  const end = usePicture(art.front.src, tint, [0, 0, 12 / art.front.w, 1]);
  const roof = usePicture(art.roof.src, tint);
  const back = usePicture(art.roof.src, () => tint().multiplyScalar(0.6), [0, 0.55, 1, 0.45]);
  const gable = useFlat(["#2e1f14"], tint)[0];
  const slope = Math.hypot(half, rise), tilt = Math.atan2(half, rise);
  const gableGeo = useMemo(() => {
    const g = new THREE.Shape();
    g.moveTo(-d / 2, 0); g.lineTo(d / 2, 0); g.lineTo(0, rise); g.lineTo(-d / 2, 0);
    return new THREE.ShapeGeometry(g);
  }, [d, rise]);
  return (
    <group position={at}>
      <mesh material={front} position={[0, wallH / 2, d / 2]} raycast={() => null}><planeGeometry args={[w, wallH]} /></mesh>
      {[-1, 1].map((k) => <mesh key={k} material={end} position={[(k * w) / 2, wallH / 2, 0]} rotation={[0, (k * Math.PI) / 2, 0]} raycast={() => null}><planeGeometry args={[d, wallH]} /></mesh>)}
      {[-1, 1].map((k) => <mesh key={`g${k}`} geometry={gableGeo} material={gable} position={[(k * w) / 2, wallH, 0]} rotation={[0, (k * Math.PI) / 2, 0]} raycast={() => null} />)}
      <mesh material={roof} position={[0, wallH + rise / 2, half / 2]} rotation={[-tilt, 0, 0]} raycast={() => null}><planeGeometry args={[w + 2 * over, slope]} /></mesh>
      <mesh material={back} position={[0, wallH + rise / 2, -half / 2]} rotation={[tilt, Math.PI, 0]} raycast={() => null}><planeGeometry args={[w + 2 * over, slope]} /></mesh>
    </group>
  );
}

// A picture on the north wall (the passage's arch, the portal, the board's notes on a plank backing), its
// foot on the floor (the notes up off it), standing square on screen as the wall's own stone does.
function OnWall({ s, pic, tint, backing }: { s: Station; pic: Pic; tint: () => THREE.Color; backing?: { colour: string; pad: number } }) {
  const mat = usePicture(pic.src, tint), back = useFlat([backing?.colour ?? "#000000"], tint)[0];
  const w = pic.w / ART_PX, h = pic.h / FACE_PX, up = backing ? 0.7 : 0;
  return (
    <group position={[s.x, up + h / 2, s.y + 0.02]}>
      {backing && <mesh material={back} position={[0, 0, -0.005]} raycast={() => null}><planeGeometry args={[w + 2 * backing.pad, h + 2 * backing.pad]} /></mesh>}
      <mesh material={mat} raycast={() => null}><planeGeometry args={[w, h]} /></mesh>
    </group>
  );
}

// A pit seen from above (its picture: the rim, and the grate or the sand), on a low block of stone.
function Slab({ at, pic, tint, tall = 0.18 }: { at: [number, number, number]; pic: Pic; tint: () => THREE.Color; tall?: number }) {
  const top = usePicture(pic.src, tint), side = useFlat(["#30322c"], tint)[0];
  const w = pic.w / ART_PX, d = pic.h / TOP_PX;
  return (
    <group position={at}>
      <mesh material={side} position={[0, tall / 2 - 0.01, 0]} raycast={() => null}><boxGeometry args={[w * 0.96, tall, d * 0.96]} /></mesh>
      <mesh material={top} position={[0, tall, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><planeGeometry args={[w, d]} /></mesh>
    </group>
  );
}

// Materials for plain parts: flat colours tinted by the light where they stand, as the 3D things are.
function useFlat(colours: string[], tint: Tint) {
  const key = colours.join();
  const mats = useMemo(() => key.split(",").map((c) => makeFlat({ color: c })), [key]);
  useTint(mats, useMemo(() => bases(mats), [mats]), tint);
  return mats;
}

// The rubble against the wall between the rooms: a heap of fallen stone.
function Rubbled({ s, tint }: { s: Station; tint: () => THREE.Color }) {
  const mats = useFlat(["#5e5248", "#4c433b", "#6d695e"], tint);
  const stones = useMemo(() => Array.from({ length: 16 }, (_, i) => {
    const r = (n: number) => (((i * 29 + n * 13) % 17) / 17) - 0.5;
    const up = 1 - Math.abs(r(2)) * 1.4;
    return { x: s.x + 0.25 + r(1) * 0.7, y: s.y + r(2) * s.d, h: 0.15 + up * 0.9 * (0.5 + Math.abs(r(3))), s: 0.2 + 0.1 * (i % 3) };
  }), [s.x, s.y, s.d]);
  return (<>{stones.map((q, i) => (
    <mesh key={i} material={mats[i % mats.length]} position={[q.x, q.h * 0.6, q.y]} scale={[q.s, q.s * 0.8, q.s]} raycast={() => null}><icosahedronGeometry args={[1, 0]} /></mesh>
  ))}</>);
}
