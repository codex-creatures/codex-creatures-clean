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
  KLUTZ_LOOP, VISITOR_LOOP, STROLL, SCONCES, BRAZIERS, DEN_WALL, DIVIDE_X, ROOM1, type Station, type DenState,
} from "@/lib/den3d/layout";
import { lightField, seenField, shadeAt, texelsPerU, pixelScale, WINDOW, SUB, type LightField } from "@/lib/render3d/stone";
import { rockHeights, carvedMesh, uprightStretch, ROCK_MARGIN } from "@/lib/render3d/dungeon3d";
import {
  STONE, STONE_VERTEX, STONE_FRAGMENT, stoneUniforms, rawTexture, gridTexture, codeTexture, fillGrid,
  Upright, Mounted, Sconce, Stroller, FLAME_COLOUR,
} from "@/components/WalkView3D";
import { Prop3D, Glow, Ring, PROP_LEAN, CAMPFIRE_3D, makeFlat, bases, useTint, type Tint } from "@/components/Props3D";
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

const PITCH = Math.PI / 3;        // the Labyrinth's camera (GAME_VIEW)
const LEAN = 0.03;
const ACROSS = 15;                // units across the screen
const DENSITY = 48;               // art pixels a unit
const HOLD_DRAG = 8;              // px a finger moves before it's a drag, not a tap
const FALL_TIME = 0.9;            // s: the wall coming down
const KIT = WALK_TILES[0].kit!;   // 🧪 the Labyrinth's walls, warmed by the light, till the Den has its own
// The Den's light: warmer than the Labyrinth's and never pitch dark (it's home). 🧪
const DEN_STONE = { ...STONE, remember: 0.3, gain: 1.15, warm: [1, 0.82, 0.6] as [number, number, number], flame: [1, 0.76, 0.5] as [number, number, number] };
const FIRE_POWER = 0.8;           // 🧪 each light's strength (STONE.fire's 0.85 in the Labyrinth)

export type Den3DProps = {
  caged?: string; klutz: KlutzMode; klutzNews: boolean; highlight?: ObjId; rubble: Rubble; onBlast?: () => void;
  tavern: TavernQuest; pit?: { ready: boolean }; tavernNews: boolean; boardNews: boolean; crateNews: boolean; cageNews: boolean;
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
  const S: DenState = { opened, pit: !!p.pit, trainingPit: !!p.tavern.pit, repaired: !!p.tavern.repaired };
  const list = useMemo(() => stations(S), [S.opened, S.pit, S.trainingPit, S.repaired]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = useRef<Pt>(lastView && lastView.opened === opened ? lastView.at : firstView(opened, PITCH));
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
    if (opened && !wasOpen.current) { fellAt.current = performance.now(); move(firstView(true, PITCH)); }
    wasOpen.current = opened;
  }, [opened]);
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
  const held = useRef<{ id: number; x: number; y: number; x0: number; y0: number; drag: boolean } | null>(null);
  const floorAt = (clientX: number, clientY: number): Pt | null => {
    const cam = camera.current, el = pad.current;
    if (!cam || !el) return null;
    const box = el.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - box.left) / box.width) * 2 - 1, 1 - ((clientY - box.top) / box.height) * 2), cam);
    const q = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    return q ? { x: q.x, y: q.z } : null;
  };
  const down = (e: React.PointerEvent) => {
    held.current = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, drag: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const drag = (e: React.PointerEvent) => {
    const h = held.current, el = pad.current;
    if (!h || h.id !== e.pointerId || !el) return;
    if (!h.drag && Math.hypot(e.clientX - h.x0, e.clientY - h.y0) > HOLD_DRAG) h.drag = true;
    if (!h.drag) return;
    const perPx = ACROSS / el.getBoundingClientRect().width;
    glide.current = null;
    view.current = clampView({ x: view.current.x - (e.clientX - h.x) * perPx, y: view.current.y - ((e.clientY - h.y) * perPx) / Math.sin(PITCH) },
      span.current.across, span.current.deep, denArea(opened, PITCH));
    h.x = e.clientX; h.y = e.clientY;
  };
  const up = (e: React.PointerEvent) => {
    const h = held.current;
    if (!h || h.id !== e.pointerId) return;
    held.current = null;
    if (h.drag) return;
    const at = floorAt(e.clientX, e.clientY);
    if (!at) return;
    const w = walkerAt(walkers, at);
    if (w) { router.push(w.href); return; }
    const s = stationAt(list, at, PITCH);
    if (s) go(s);
  };
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
    <div className={shaking ? "screen-shake" : undefined} style={{ position: "relative", width: "100%", height: "100%", background: "#000", overflow: "hidden" }}>
      <div ref={pad} onPointerDown={down} onPointerMove={drag} onPointerUp={up} onPointerCancel={() => { held.current = null; }}
        style={{ position: "absolute", inset: 0, touchAction: "none", cursor: "grab" }}>
        <Canvas resize={{ offsetSize: true }} orthographic flat gl={{ antialias: false, powerPreference: "high-performance" }}
          style={{ position: "absolute", inset: 0, background: "#000", imageRendering: "pixelated", touchAction: "none" }}>
          <DenWorld opened={opened} repaired={S.repaired} list={list} walkers={walkers} caged={p.caged} klutz={p.klutz} trainingPit={S.trainingPit}
            viewRef={view} spanRef={span} glideRef={glide} cameraRef={camera} labelsRef={labels} fellAtRef={fellAt} />
        </Canvas>
      </div>
      {/* The names over the places (and the strollers), placed by the scene each frame. */}
      {list.map((s) => (
        <NameTag key={s.key} id={s.key} labels={labels} tour={s.obj !== undefined ? `den-${s.obj}` : undefined} news={news(s)} lit={s.obj !== undefined && s.obj === p.highlight}
          onTap={() => go(s)} text={s.label} />
      ))}
      {walkers.map((w) => (
        <NameTag key={w.key} id={`walker:${w.key}`} labels={labels} tour={w.tour} news={w.news} lit={w.key === "klutz" && p.highlight === OBJ.klutz}
          onTap={() => router.push(w.href)} text={w.label} />
      ))}
      {p.klutz === "pool" && <NameTag id="walker:resting" labels={labels} tour={`den-${OBJ.klutz}`} news={p.klutzNews} lit={p.highlight === OBJ.klutz} onTap={() => router.push("/klutz")} text="Klutz 💤" />}
      {notice && (
        <div onClick={() => setNotice(false)} style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: 16 }}>
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
    <button ref={(el) => { if (el) labels.current.set(id, el); else labels.current.delete(id); }} data-tour={tour} onClick={onTap}
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
function walkerAt(walkers: Walker[], p: Pt): Walker | undefined {
  const now = performance.now() / 1000;
  return walkers.find((w) => {
    const at = strollAt(now + w.lead, w.loop, w.speed);
    return Math.abs(p.x - at.x) < 0.45 && p.y < at.y + 0.3 && p.y > at.y - (NPC_U * uprightStretch(PITCH)) / Math.tan(PITCH) - 0.2;
  });
}

// ── The scene ──
function DenWorld({ opened, repaired, list, walkers, caged, klutz, trainingPit, viewRef, spanRef, glideRef, cameraRef, labelsRef, fellAtRef }: {
  opened: boolean; repaired: boolean; list: Station[]; walkers: Walker[]; caged?: string; klutz: KlutzMode; trainingPit: boolean;
  viewRef: React.RefObject<Pt>; spanRef: React.RefObject<{ across: number; deep: number }>; glideRef: React.RefObject<{ from: Pt; to: Pt; at: number } | null>;
  cameraRef: React.RefObject<THREE.Camera | null>; labelsRef: React.RefObject<Map<string, HTMLElement>>; fellAtRef: React.RefObject<number | null>;
}) {
  const { size, setDpr } = useThree();
  const stretch = uprightStretch(PITCH);
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

  const ctx: Tick = { cameraRef, spanRef, glideRef, viewRef, fellAtRef, labelsRef, pix, size, opened, centre, lights, lit, plan, field, lastLight, v, list, walkers, stretch, klutz };
  useFrame((state) => denTick(state, ctx));

  const at = (key: string) => list.find((s) => s.key === key);
  const pool = at("pool");
  return (
    <>
      <DenRock plan={plan} seen={seen} field={field} centre={centre} />
      {list.map((s) => <Place key={s.key} s={s} tint={tint(s.x, s.y + s.d / 2)} stretch={stretch} caged={caged} trainingPit={trainingPit} repaired={repaired} />)}
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
      {BRAZIERS.map((c, i) => {
        const k = STANDING_TORCH_U / WALK_STANDING_TORCH.h, w = WALK_STANDING_TORCH.w * k, h = STANDING_TORCH_U * stretch, [fx, fy] = STANDING_TORCH_FLAME;
        return (
          <group key={`brazier${i}`}>
            <Upright src={WALK_STANDING_TORCH.src} x={c.x} y={c.y} w={w} h={h} below={0} colour={new THREE.Color(1, 1, 1)} />
            <mesh raycast={() => null} position={[c.x - w / 2 + fx * k, h - fy * k * stretch + 0.08, c.y + 0.06]} scale={[0.1, 0.18, 1]}><planeGeometry /><meshBasicMaterial color={FLAME_COLOUR} /></mesh>
          </group>
        );
      })}
      {/* Odds and ends along the walls. */}
      <group position={[ROOM1.x + 0.1, 0, 4.6]}><Decor3D kind="crates" stretch={stretch} colour={tint(ROOM1.x + 0.1, 4.6)} /></group>
      <group position={[ROOM1.x + 0.1, 0, 9.4]}><Decor3D kind="barrels" stretch={stretch} colour={tint(ROOM1.x + 0.1, 9.4)} /></group>
      <group position={[ROOM1.x + 0.1, 0, 12.8]}><Decor3D kind="pots" stretch={stretch} colour={tint(ROOM1.x + 0.1, 12.8)} /></group>
      {/* Klutz resting in the pool while he heals. */}
      {klutz === "pool" && pool && CREATURE_SPRITES.klutz && (() => {
        const art = artFor(CREATURE_SPRITES.klutz)!, h = NPC_U * 0.6 * stretch, w = (NPC_U * 0.6) * (art.w / art.h);
        return <Upright src={art.src} x={pool.x + 0.3} y={pool.y} w={w} h={h} below={0} colour={tint(pool.x, pool.y)} />;
      })()}
      {walkers.map((w) => <DenWalker key={w.key} w={w} stretch={stretch} shade={shade} />)}
      {opened && <FallenWall fellAtRef={fellAtRef} shade={shade} />}
    </>
  );
}

// Each frame (DenWorld's): the camera (where the view is, gliding, the wall's shake), the lean, the light
// (flickering, 15 times a second) and the names over everything.
type Tick = {
  cameraRef: React.RefObject<THREE.Camera | null>; spanRef: React.RefObject<{ across: number; deep: number }>; glideRef: React.RefObject<{ from: Pt; to: Pt; at: number } | null>;
  viewRef: React.RefObject<Pt>; fellAtRef: React.RefObject<number | null>; labelsRef: React.RefObject<Map<string, HTMLElement>>;
  pix: { across: number }; size: { width: number; height: number }; opened: boolean; centre: React.RefObject<{ x: number; z: number }>;
  lights: { x: number; y: number; r: number }[]; lit: Uint8Array; plan: Floorplan; field: React.RefObject<LightField | null>; lastLight: React.RefObject<number>;
  v: THREE.Vector3; list: Station[]; walkers: Walker[]; stretch: number; klutz: KlutzMode;
};
function denTick(state: { camera: THREE.Camera }, { cameraRef, spanRef, glideRef, viewRef, fellAtRef, labelsRef, pix, size, opened, centre, lights, lit, plan, field, lastLight, v, list, walkers, stretch, klutz }: Tick) {
  const now = performance.now(), cam = state.camera;
  cameraRef.current = cam;
  // How much floor is in view, and where the camera looks (gliding when Klutz shows you somewhere).
  spanRef.current = { across: pix.across, deep: (pix.across * (size.height / size.width)) / Math.sin(PITCH) };
  const a = denArea(opened, PITCH), g = glideRef.current;
  if (g) {
    const k = Math.min(1, (now - g.at) / 700), e = k * k * (3 - 2 * k);
    viewRef.current = { x: g.from.x + (g.to.x - g.from.x) * e, y: g.from.y + (g.to.y - g.from.y) * e };
    if (k >= 1) glideRef.current = null;
  }
  viewRef.current = clampView(viewRef.current, spanRef.current.across, spanRef.current.deep, a);
  // (In whole art pixels, so the stone doesn't crawl as you drag.)
  const zs = DENSITY * Math.sin(PITCH);
  centre.current = { x: Math.round(viewRef.current.x * DENSITY) / DENSITY, z: Math.round(viewRef.current.y * zs) / zs };
  const fell = fellAtRef.current === null ? Infinity : (now - fellAtRef.current) / 1000, shake = fell < FALL_TIME ? 0.08 * (1 - fell / FALL_TIME) : 0;
  const target = new THREE.Vector3(centre.current.x + (shake ? (Math.random() * 2 - 1) * shake : 0), 0, centre.current.z);
  if (cam instanceof THREE.OrthographicCamera) {
    cam.position.copy(target).addScaledVector(new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)), 60);
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
function DenRock({ plan, seen, field, centre }: { plan: Floorplan; seen: { shown: Uint8Array; fade: Float32Array }; field: React.RefObject<LightField | null>; centre: React.RefObject<{ x: number; z: number }> }) {
  const geo = useMemo(() => {
    const h = rockHeights(plan, (i) => plan.tiles[i] !== ROCK, DEN_WALL, true);
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
    u.uUp.value.set(...texelsPerU("up", DENSITY, PITCH, "screen"));
    u.uSide.value.set(...texelsPerU("face", DENSITY, PITCH, "screen"));
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

// The rock between the rooms, come down: stones all along where it stood (falling, the moment it goes).
function FallenWall({ fellAtRef, shade }: { fellAtRef: React.RefObject<number | null>; shade: (x: number, y: number) => THREE.Color }) {
  const group = useRef<THREE.Group>(null);
  const stones = useMemo(() => {
    const out: { x: number; y: number; s: number; c: THREE.Color }[] = [];
    const colours = ["#5e5248", "#4c433b", "#6d695e", "#3b352f"];
    for (let y = ROOM1.y; y < ROOM1.y + ROOM1.h; y++) for (let k = 0; k < 3; k++) {
      const r = (n: number) => (((y * 37 + k * 17 + n * 11) % 13) / 13) - 0.5;
      out.push({ x: DIVIDE_X + r(1) * 1.4, y: y + r(2) * 0.9, s: 0.12 + 0.08 * ((k + y) % 3), c: new THREE.Color(colours[(y + k) % colours.length]) });
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
        <mesh key={i} raycast={() => null} position={[q.x, q.s * 0.5, q.y]} scale={[q.s, q.s * 0.7, q.s * 0.8]}>
          <icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color={q.c.clone().multiply(shade(q.x, q.y))} />
        </mesh>
      ))}
    </group>
  );
}

// ── Each place (🧪 stand-ins where there's no art yet) ──
function Place({ s, tint, stretch, caged, trainingPit, repaired }: { s: Station; tint: () => THREE.Color; stretch: number; caged?: string; trainingPit: boolean; repaired: boolean }) {
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
    case "shack": return <Building at={at} w={s.w} d={s.d} wallH={1.7} roofH={1} wood="#5e432a" roof="#33271a" tint={tint} door />;
    case "storehouse": return <Building at={at} w={s.w} d={s.d} wallH={1.9} roofH={1} wood="#483522" roof="#2c2a11" base="#4a4d45" tint={tint} door />;
    case "tavern": return <Building at={at} w={s.w} d={s.d} wallH={2} roofH={1.1} wood={repaired ? "#6d452d" : "#483522"} roof={repaired ? "#563e2d" : "#2a2723"} base="#55544a" tint={tint} door windows={repaired} />;
    case "arch": return <Arch s={s} tint={tint} />;
    case "portal": return <><Arch s={s} tint={tint} />
      <mesh raycast={() => null} position={[s.x, 1.05, s.y + 0.02]}><circleGeometry args={[0.62, 20]} /><meshBasicMaterial color="#5fae6e" /></mesh>
      <group position={[s.x, 0, s.y + 0.6]}><Glow colour="#7fdc8a" radius={1.4} strength={0.3} /></group></>;
    case "board": return <Board s={s} tint={tint} />;
    case "altar": return <Altar at={at} tint={tint} />;
    case "pool": return (
      <group position={at} scale={[s.w / 2, 1, s.d / 2]}>
        <Ring wide={2} tall={0.16} top={CAMPFIRE_3D.rim} rim={CAMPFIRE_3D.rim} rimPx={CAMPFIRE_3D.rimPx} sides={18} colour={tint} />
        <mesh raycast={() => null} position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.86, 28]} /><meshBasicMaterial color="#3d8f95" /></mesh>
        <Glow colour="#5fe0d0" radius={0.9} strength={0.35} y={0.18} />
      </group>
    );
    case "pit": case "training": return <Pit at={at} w={s.w} d={s.d} tint={tint} sand={s.key === "training"} dummy={s.key === "training"} grate={s.key === "pit"} trained={trainingPit} />;
    case "rubble": return <Rubbled s={s} tint={tint} />;
  }
}

// Materials for a stand-in: flat colours tinted by the light where it stands, as the 3D things are.
function useFlat(colours: string[], tint: Tint) {
  const key = colours.join();
  const mats = useMemo(() => key.split(",").map((c) => makeFlat({ color: c })), [key]);
  useTint(mats, useMemo(() => bases(mats), [mats]), tint);
  return mats;
}

// 🧪 A building, till its art: walls on a stone footing, a pitched roof running east-west, its door (and
// lit windows) on the front.
function Building({ at, w, d, wallH, roofH, wood, roof, base = "#3e412e", tint, door, windows }: { at: [number, number, number]; w: number; d: number; wallH: number; roofH: number;
  wood: string; roof: string; base?: string; tint: () => THREE.Color; door?: boolean; windows?: boolean }) {
  const [mWood, mRoof, mBase, mDark] = useFlat([wood, roof, base, "#141010"], tint);
  const roofGeo = useMemo(() => {
    const s = new THREE.Shape(), o = 0.15;
    s.moveTo(-d / 2 - o, 0); s.lineTo(d / 2 + o, 0); s.lineTo(0, roofH); s.lineTo(-d / 2 - o, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: w + 0.3, bevelEnabled: false });
    g.translate(0, 0, -(w + 0.3) / 2); g.rotateY(Math.PI / 2);
    return g;
  }, [w, d, roofH]);
  const foot = 0.3;
  return (
    <group position={at}>
      <mesh material={mBase} position={[0, foot / 2, 0]} raycast={() => null}><boxGeometry args={[w, foot, d]} /></mesh>
      <mesh material={mWood} position={[0, foot + (wallH - foot) / 2, 0]} raycast={() => null}><boxGeometry args={[w - 0.04, wallH - foot, d - 0.04]} /></mesh>
      <mesh geometry={roofGeo} material={mRoof} position={[0, wallH, 0]} raycast={() => null} />
      {door && <mesh material={mDark} position={[0, 0.62, d / 2 + 0.005]} raycast={() => null}><planeGeometry args={[0.7, 1.1]} /></mesh>}
      {windows && [-1, 1].map((k) => (
        <mesh key={k} position={[k * w * 0.3, 1.1, d / 2 + 0.006]} raycast={() => null}><planeGeometry args={[0.5, 0.4]} /><meshBasicMaterial color="#ffc46a" /></mesh>
      ))}
    </group>
  );
}

// 🧪 A stone archway on the north wall (the Labyrinth's passage, the portal's frame), till its art.
function Arch({ s, tint }: { s: Station; tint: () => THREE.Color }) {
  const [stone, cap] = useFlat(["#55544a", "#646256"], tint);
  const post = 0.35, h = 2.3;
  return (
    <group position={[s.x, 0, s.y + 0.1]}>
      {[-1, 1].map((k) => <mesh key={k} material={stone} position={[k * (s.w / 2 + post / 2 - 0.1), h / 2, 0]} raycast={() => null}><boxGeometry args={[post, h, 0.3]} /></mesh>)}
      <mesh material={cap} position={[0, h + 0.15, 0]} raycast={() => null}><boxGeometry args={[s.w + 2 * post, 0.3, 0.34]} /></mesh>
    </group>
  );
}

// 🧪 The quest board on the north wall: a plank board with notes pinned on it, till its art.
function Board({ s, tint }: { s: Station; tint: () => THREE.Color }) {
  const [wood, note, seal] = useFlat(["#5e432a", "#d5cbb1", "#844c2c"], tint);
  return (
    <Mounted x={s.x} y={s.y + 0.06} up={1.15}>
      <mesh material={wood} raycast={() => null}><planeGeometry args={[s.w, 1]} /></mesh>
      {[[-0.35, 0.18, 0.05], [0.12, 0.22, -0.06], [0.38, -0.15, 0.08], [-0.15, -0.2, -0.04]].map(([x, y, r], i) => (
        <group key={i} position={[x, y, 0.01]} rotation={[0, 0, r]}>
          <mesh material={note} raycast={() => null}><planeGeometry args={[0.32, 0.4]} /></mesh>
          <mesh material={seal} position={[0, 0.15, 0.005]} raycast={() => null}><circleGeometry args={[0.04, 8]} /></mesh>
        </group>
      ))}
    </Mounted>
  );
}

// 🧪 The Soul Altar: a stone altar with its soul fire, till its art.
function Altar({ at, tint }: { at: [number, number, number]; tint: () => THREE.Color }) {
  const [stone, top] = useFlat(["#4a4d45", "#646256"], tint);
  const fire = useRef<THREE.Group>(null);
  useFrame(() => { const t = performance.now() / 160; if (fire.current) fire.current.scale.set(0.9 + 0.08 * Math.sin(t * 1.3), 1 + 0.12 * Math.sin(t), 1); });
  return (
    <group position={at}>
      <mesh material={stone} position={[0, 0.25, 0]} raycast={() => null}><boxGeometry args={[1.7, 0.5, 1.5]} /></mesh>
      <mesh material={stone} position={[0, 0.65, 0]} raycast={() => null}><boxGeometry args={[1.2, 0.3, 1.0]} /></mesh>
      <mesh material={top} position={[0, 0.84, 0]} raycast={() => null}><boxGeometry args={[1.4, 0.08, 1.15]} /></mesh>
      <group ref={fire} position={[0, 0.9, 0.1]}>
        <mesh raycast={() => null}><coneGeometry args={[0.32, 0.9, 7]} /><meshBasicMaterial color="#5fd0c8" transparent opacity={0.85} /></mesh>
        <mesh raycast={() => null} position={[0, -0.1, 0.05]}><coneGeometry args={[0.16, 0.5, 6]} /><meshBasicMaterial color="#d6fff6" /></mesh>
      </group>
      <Glow colour="#5fe0d0" radius={2.2} strength={0.3} />
    </group>
  );
}

// 🧪 A pit (the creatures' Pit under its iron grate; the tavern's sand Sparring/Training Pit with its dummy), till its art.
function Pit({ at, w, d, tint, sand, dummy, grate, trained }: { at: [number, number, number]; w: number; d: number; tint: () => THREE.Color; sand: boolean; dummy: boolean; grate: boolean; trained: boolean }) {
  const [floor, iron, post] = useFlat([sand ? "#a88a5a" : "#120d0a", "#3b352f", "#5e432a"], tint);
  return (
    <group position={at}>
      <group scale={[w / 3, 1, d / 3]}>
        <Ring wide={3} tall={0.3} top={CAMPFIRE_3D.rim} rim={CAMPFIRE_3D.rim} rimPx={CAMPFIRE_3D.rimPx} sides={20} colour={tint} />
        <mesh material={floor} position={[0, 0.305, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><circleGeometry args={[1.25, 30]} /></mesh>
        {grate && [-0.75, -0.25, 0.25, 0.75].map((k) => <mesh key={k} material={iron} position={[k, 0.33, 0]} raycast={() => null}><boxGeometry args={[0.06, 0.04, 2.4]} /></mesh>)}
        {grate && [-0.5, 0, 0.5].map((k) => <mesh key={`z${k}`} material={iron} position={[0, 0.34, k]} raycast={() => null}><boxGeometry args={[2.4, 0.04, 0.06]} /></mesh>)}
      </group>
      {dummy && (<>
        <mesh material={post} position={[0, 0.3 + 0.6, 0]} raycast={() => null}><boxGeometry args={[0.12, 1.2, 0.12]} /></mesh>
        <mesh material={post} position={[0, 1.2, 0]} raycast={() => null}><boxGeometry args={[0.8, 0.1, 0.1]} /></mesh>
        {trained && <mesh material={iron} position={[0, 1.45, 0]} raycast={() => null}><sphereGeometry args={[0.16, 8, 6]} /></mesh>}
      </>)}
    </group>
  );
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
