"use client";
// components/WalkView3D.tsx
// 🧪 The 3D prototype of the walk view (/lab/three only; the game uses components/WalkView.tsx).
// The same walk as the 2D view: the run's layout, saved placements and the frame-by-frame sim
// (lib/world/walkSim.ts: walking, sight, light reach, foes, taps), with only the drawing new.
// It's drawn with Three.js (React Three Fiber): the floor and wall blocks as real geometry
// (lib/render3d/dungeon3d.ts), today's kit art as their textures, sharp (no smoothing), lit by
// real lights (your torch, and the nearest burning torches, candles and campfires), with no
// tints or washes over the picture. Creatures, people and things stand upright in the world as
// sprites, lit by the same lights. What you've never seen stays black (the sim's `known`).
// "Stone" (?geo=stone) is the materials-and-lighting experiment on the settled geometry: the grey
// mode's carved rock with flat stand-in textures and no Three.js lights at all, its light taken
// from the sim's light reach (lib/render3d/stone.ts).
// The setup copies WalkView's (a seam to share later, if the prototype is kept).

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Pt } from "@/lib/dungeon/floorplan";
import { layoutFloorplan, type Progress } from "@/lib/dungeon/layout";
import { walkToward, walkStick, keysPush, isWalkKey, STICK_DEAD, type CanStep } from "@/lib/dungeon/walk";
import { shutPlan, torchReach, TORCH_RADIUS, SCONCE_RADIUS, CANDLE_RADIUS } from "@/lib/dungeon/torch";
import { CAMPFIRE_LIGHT } from "@/lib/dungeon/campfire";
import { FACINGS, walkFrame } from "@/lib/dungeon/tileArt";
import type { DungeonId, Room } from "@/lib/dungeon/run";
import type { WalkRun } from "@/lib/dungeon/walkRun";
import type { DungeonMap } from "@/lib/dungeon/map";
import { foeStarts, guarding, roomIds, thingsOf, solidCells, walkRule, tappedThing, fromRuns, type Thing } from "@/lib/world/walkWorld";
import { placementsOfWalk } from "@/lib/world/migrate";
import { startWalk, restartLoop, stepWalk, walkUpTo, soundAlarm, type WalkState, type WalkSim } from "@/lib/world/walkSim";
import { objectDef, artOf, FOE_U, BOSS_SCALE, CHIEF_SCALE } from "@/lib/world/objects";
import { WALK_TILES, WALK_HERO, KIT_LIGHTS, KIT_PX } from "@/lib/sprites/walk";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { artFor } from "@/lib/sprites/art";
import { dungeonCells, shadeOf, WALL_HEIGHT, uprightStretch, rockHeights, carvedMesh, ROCK_MARGIN, type CarvedMesh } from "@/lib/render3d/dungeon3d";
import { texelsPerU, pixelScale, lightField, lightAt, seenField, SUB, WINDOW, type LightField, type Light3D, type PixelMode, type TexelMode } from "@/lib/render3d/stone";

// What the lab can change, to compare. `grey` is the geometry experiment (world/rendering.md §4.8):
// solid rock in flat grey under one plain light, no art; `lean` (orthographic's side-wall candidate)
// leans everything outwards with its height and its distance across from you; `fov` is the
// perspective camera's; `south` and `wall` shape the rock; `unseen` is how places you haven't
// found show: as solid rock, carved but black (as the 2D view does), or carved and shown (to judge).
// `stone` (with `grey`'s geometry) is the materials-and-lighting experiment: `density` art pixels a
// unit; `kit`, which stand-in art (kit F, drawn at 48 a unit, or kit A, at 32); `texels`, laid
// square on screen or on the surface (stone.ts); `light`, smooth, in steps, or steps dithered;
// `fade`, what you've seen fading into the unexplored black or a hard edge. `pixels`: stone.ts.
export type View3D = { pitch: number; perspective: boolean; pixels: PixelMode; shadows: boolean; across: number;
  grey: boolean; lean: number; fov: number; south: "full" | "low"; wall: number; unseen: "rock" | "black" | "shown";
  stone: boolean; density: number; kit: "f" | "a"; texels: TexelMode; light: "smooth" | "stepped" | "dither"; fade: boolean };
// (`across` and `scale`: the units across the screen as drawn, and screen pixels to each canvas pixel.)
export type Stats3D = { fps: number; calls: number; triangles: number; lights: number; across: number; scale: number };

const KIT = WALK_TILES[0].kit!;        // kit F, the game's walls
const ART_PER_U = 48;                  // the kit's art pixels a unit across (KitArt.size.px)
const LIGHT_POOL = 8;                  // 🧪 real lights besides your torch, given to the nearest lit ones (a fixed number: changing it recompiles shaders)
const AMBIENT = 0.5;                   // 🧪 how much of a remembered, unlit place you still see (a cool, dim light)
const TORCH = { colour: "#ffc68a", power: 34, height: 1.8, decay: 1.6 }; // 🧪 your torch: a bright core, then falling off
const FIRE = { colour: "#ffa255", power: 22, height: 1.3, decay: 1.6 }; // 🧪 wall torches, candles, campfires

// Textures, loaded once and drawn sharp: one art pixel stays one block of colour.
const TEXTURES = new Map<string, THREE.Texture>();
function texture(src: string): THREE.Texture {
  let t = TEXTURES.get(src);
  if (!t) {
    t = new THREE.TextureLoader().load(src);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    TEXTURES.set(src, t);
  }
  return t;
}
// A copy of a texture showing part of it (a hero sheet's frame, the face rows of the north wall).
function part(src: string, ox: number, oy: number, rx: number, ry: number): THREE.Texture {
  const t = texture(src).clone();
  t.repeat.set(rx, ry); t.offset.set(ox, oy); t.needsUpdate = true;
  return t;
}

export default function WalkView3D({ walk, map, dungeon = 0, here, room, view, onEnter, onLog, onStats, seeAll = false, startIn }: {
  walk: WalkRun; map: DungeonMap; dungeon?: DungeonId; here: string;
  seeAll?: boolean;                    // the lab: everything shown as seen (to judge a room)
  startIn?: string;                    // the lab: start in the middle of this room
  room: (id: string) => Room | undefined;
  view: View3D;
  onEnter: (id: string, state: WalkState) => void;
  onLog: (s: string) => void;
  onStats?: (s: Stats3D) => void;
}) {
  // ── The walk, as WalkView sets it up ──
  const layout = walk.layout;
  const plan = useMemo(() => layoutFloorplan(layout), [layout]);
  const [progress, setProgress] = useState<Progress>({ room: walk.room, line: walk.line ?? Infinity });
  const live = useMemo(() => shutPlan(plan, layout, progress), [plan, layout, progress]);
  const ids = useMemo(() => roomIds(layout, map), [layout, map]);
  const [placed] = useState(() => placementsOfWalk(walk, map, dungeon, room));
  const [sim] = useState(() => {
    const s = startWalk(walk, plan, live, { sconces: placed.sconces, candles: placed.candles, foes: guarding(foeStarts(placed, ids, room), layout, room, dungeon, placed), npcs: placed.witches }, fromRuns(walk.known, plan.w * plan.h));
    if (seeAll) s.known.fill(1);
    const r = startIn ? plan.rooms[startIn]?.[0] : undefined;
    if (r) s.me = { ...s.me, x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2), path: [] };
    return s;
  });
  const props = useRef({ here, room, onEnter, onLog });
  useEffect(() => { props.current = { here, room, onEnter, onLog }; });
  const things = (): Thing[] => thingsOf(layout, placed, ids, props.current.room, sim.npcs, walk.spots, dungeon);
  const rule = (p: Progress): CanStep => walkRule(layout, plan, p, sim.known, solidCells(things(), sim.fires, []));
  // (The lab only says what you opened; the real screen would play it out.)
  const openThing = (t: Thing) => { if (t.guarded) soundAlarm(sim, t.room, performance.now()); else props.current.onLog(`Opened ${t.def} in ${t.room}`); };
  useEffect(() => { restartLoop(sim, live, {}, performance.now()); }, [sim, live]);
  useEffect(() => { if (sim.goal) sim.me = walkToward(live, { ...sim.me, path: sim.me.path.slice(0, 1) }, sim.goal, rule(progress)); }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keys: WASD / the arrows walk, as in WalkView.
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (isWalkKey(e.code)) { keys.current.add(e.code); e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.code); };
    const drop = () => keys.current.clear();
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", drop);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", drop); };
  }, []);

  // A tap on the floor: a thing beside it (walk up and use it), or walk there.
  const tap = (p: THREE.Vector3) => {
    if (sim.fired > 0 || sim.alarm) return;
    const spot: Pt = { x: Math.round(p.x), y: Math.round(p.z) };
    const can = rule(sim.progress);
    const t = tappedThing(things(), spot, sim.known, plan.w);
    if (t) { if (walkUpTo(sim, t, live, can) === "use") openThing(t); return; }
    sim.goal = spot; sim.wantThing = null;
    sim.me = walkToward(live, sim.me, spot, can);
  };

  // Each frame: walk on (the sim), then the picture follows.
  const step = (now: number) => {
    const S = keysPush(keys.current);
    if (S && Math.hypot(S.x, S.y) >= STICK_DEAD && sim.fired === 0 && !sim.alarm) {
      sim.goal = null; sim.wantThing = null;
      let can: CanStep | null = null;
      sim.me = walkStick(live, sim.me, S.x, S.y, (a, b) => (can ??= rule(sim.progress))(a, b));
    }
    const P = props.current;
    const F = stepWalk(sim, { now, busy: false, room: P.room, here: P.here, team: [], hp: {}, things });
    for (const e of F.events) {
      if (e.type === "progress") setProgress(e.progress);
      else if (e.type === "enter") P.onEnter(e.room, e.state);
      else if (e.type === "spotted") { P.onLog(`Seen by ${e.room}'s foes: a fight`); sim.fired = 0; sim.alarm = null; }
      else if (e.type === "use") openThing(e.thing);
    }
  };

  return (
    <Canvas key={view.perspective ? "p" : "o"} orthographic={!view.perspective} flat shadows={view.shadows ? "basic" : false}
      gl={{ antialias: false, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.info.autoReset = false; /* (counted by hand: read, then reset, each frame) */ }}
      style={{ position: "absolute", inset: 0, background: "#000", imageRendering: "pixelated", touchAction: "none" }}>
      <World sim={sim} live={live} view={view} step={step} tap={tap} things={things} room={room} onStats={onStats} />
    </Canvas>
  );
}

// ── The world, in the scene ───────────────────────────────────────────────
function World({ sim, live, view, step, tap, things, room, onStats }: {
  sim: WalkSim; live: WalkSim["live"]; view: View3D; step: (now: number) => void; tap: (p: THREE.Vector3) => void;
  things: () => Thing[]; room: (id: string) => Room | undefined; onStats?: (s: Stats3D) => void;
}) {
  const { size, setDpr } = useThree();
  const cells = useMemo(() => dungeonCells(live), [live]);
  const floorRef = useRef<THREE.InstancedMesh>(null), wallRef = useRef<THREE.InstancedMesh>(null);
  const stretch = uprightStretch(view.pitch);

  // Materials: the kit's floor, its north face (the rows under the cap) on a block's sides, its cap on top.
  const mats = useMemo(() => {
    const lambert = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });
    const face = part(KIT.north, 0, 0, 1, (KIT.size.north - KIT.size.cap) / KIT.size.north);
    return { floor: lambert(texture(KIT.floor)), walls: [face, face, texture(KIT.cap), face, face, face].map(lambert) };
  }, []);
  const floorGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const wallGeo = useMemo(() => new THREE.BoxGeometry(1, WALL_HEIGHT, 1), []);

  // Lay the blocks out (again when a tunnel falls in).
  useEffect(() => {
    const m = new THREE.Matrix4();
    cells.floor.forEach((p, i) => floorRef.current?.setMatrixAt(i, m.makeTranslation(p.x, 0, p.y)));
    cells.walls.forEach((p, i) => wallRef.current?.setMatrixAt(i, m.makeTranslation(p.x, WALL_HEIGHT / 2, p.y)));
    for (const r of [floorRef, wallRef]) if (r.current) { r.current.instanceMatrix.needsUpdate = true; r.current.computeBoundingSphere(); }
  }, [cells]);

  // Pixels: the screen's own, or one canvas pixel to each art pixel (blown up, sharp: stone.ts `pixelScale`).
  // (Grey has no art, so always the screen's own.)
  const density = view.stone ? view.density : ART_PER_U;
  const pix = pixelScale(view.grey && !view.stone ? "device" : view.pixels, density, view.across, size.width, window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);
  // With art pixels the camera moves in whole canvas pixels (1 / density a unit across, and up the
  // screen 1 / (density · sin pitch) of floor), so the art doesn't crawl as you walk.
  const snapped = view.pixels !== "device" && !view.perspective && !(view.grey && !view.stone);
  const centre = useRef({ x: 0, z: 0 });
  const field = useRef<LightField | null>(null); // (Stone: the light grid, for the sprites standing in it)

  const torch = useRef<THREE.PointLight>(null);
  const pool = useRef<(THREE.PointLight | null)[]>([]);
  const hero = useRef<THREE.Mesh>(null);
  const heroTex = useMemo(() => {
    const cols = WALK_HERO.frames > 0 ? WALK_HERO.frames + 1 : 1;
    return FACINGS.map((_, row) => Array.from({ length: cols }, (_, col) => part(WALK_HERO.sheet, col / cols, 1 - (row + 1) / FACINGS.length, 1 / cols, 1 / FACINGS.length)));
  }, []);
  const [, redraw] = useState(0); // (the sprites' list, shown again now and then)
  const last = useRef({ shadeAt: 0, known: -1, statsAt: 0, frames: 0, listAt: 0 });

  useFrame((state) => {
    const now = performance.now(), camera = state.camera;
    step(now);
    // The camera on you, from the south, at the pitch.
    const zs = density * Math.sin(view.pitch);
    centre.current = snapped ? { x: Math.round(sim.me.x * density) / density, z: Math.round(sim.me.y * zs) / zs } : { x: sim.me.x, z: sim.me.y };
    const target = new THREE.Vector3(centre.current.x, 0, centre.current.z);
    const back = new THREE.Vector3(0, Math.sin(view.pitch), Math.cos(view.pitch));
    if (camera instanceof THREE.OrthographicCamera) {
      camera.position.copy(target).addScaledVector(back, 60);
      camera.zoom = size.width / pix.across;
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = view.fov;
      const halfW = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * (size.width / size.height));
      camera.position.copy(target).addScaledVector(back, view.across / 2 / Math.tan(halfW));
    }
    camera.near = 0.1; camera.far = 200;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    // Your torch, held up.
    torch.current?.position.set(sim.me.x + 0.25, TORCH.height, sim.me.y - 0.1); // (held up beside you, not in front of your face)
    // The nearest lit lights you've seen get the pool's real lights.
    const lit = litLights(sim, live);
    pool.current.forEach((pl, i) => {
      if (!pl) return;
      const l = lit[i];
      pl.intensity = l ? FIRE.power * (0.93 + 0.07 * Math.sin(now / 90 + i)) : 0;
      if (l) { pl.position.set(l.x, FIRE.height, l.y); pl.distance = l.r * 1.4; }
    });
    // What you've seen: black where you never have.
    const seen = view.grey ? -1 : sim.known.reduce((n, k) => n + k, 0);
    if (!view.grey && seen !== last.current.known && now - last.current.shadeAt > 150) {
      last.current.known = seen; last.current.shadeAt = now;
      const s = shadeOf(live, sim.known), c = new THREE.Color();
      cells.floor.forEach((p, i) => floorRef.current?.setColorAt(i, c.setScalar(s[p.y * live.w + p.x])));
      cells.walls.forEach((p, i) => wallRef.current?.setColorAt(i, c.setScalar(s[p.y * live.w + p.x])));
      for (const r of [floorRef, wallRef]) if (r.current?.instanceColor) r.current.instanceColor.needsUpdate = true;
    }
    // You: your sheet's frame for the way you face, standing up on your feet.
    if (hero.current) {
      const cols = heroTex[0].length, moving = sim.me.path.length > 0;
      const col = cols > 1 ? walkFrame(sim.walked, moving, WALK_HERO.frames) + 1 : 0;
      (hero.current.material as THREE.MeshBasicMaterial).map = heroTex[FACINGS.indexOf(sim.facing)][col];
      const w = WALK_HERO.cell / KIT_PX, h = w * stretch, below = (1 - WALK_HERO.feet / WALK_HERO.cell) * h;
      hero.current.scale.set(w, h, 1);
      hero.current.position.set(sim.me.x, h / 2 - below, sim.me.y + 0.05);
    }
    if (now - last.current.listAt > 120) { last.current.listAt = now; redraw((n) => n + 1); }
    // How it's running.
    last.current.frames++;
    if (onStats && now - last.current.statsAt > 500) {
      onStats({ fps: Math.round((last.current.frames * 1000) / (now - last.current.statsAt || 1)), calls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles, lights: lit.length, across: pix.across, scale: pix.scale });
      last.current.frames = 0; last.current.statsAt = now;
    }
    state.gl.info.reset();
  });

  if (view.stone) return (
    <>
      <StoneRock sim={sim} live={live} view={view} tap={tap} centre={centre} fieldRef={field} />
      {/* You, unlit, as in the other modes. */}
      <mesh ref={hero} raycast={() => null}><planeGeometry /><meshBasicMaterial alphaTest={0.5} side={THREE.DoubleSide} /></mesh>
      <Sprites sim={sim} live={live} things={things()} room={room} stretch={stretch} shade={(x, y) => stoneShade(field.current, x, y)} />
    </>
  );
  if (view.grey) return (
    <>
      <ambientLight intensity={GREY_LIGHT.ambient} />
      <directionalLight position={GREY_LIGHT.from} intensity={GREY_LIGHT.sun} />
      <GreyRock sim={sim} live={live} view={view} tap={tap} />
      <mesh ref={hero} raycast={() => null}><planeGeometry /><meshBasicMaterial alphaTest={0.5} side={THREE.DoubleSide} /></mesh>
      <Sprites sim={sim} live={live} things={things()} room={room} stretch={stretch} sconces={false} />
    </>
  );
  return (
    <>
      <ambientLight color="#8a93b8" intensity={AMBIENT} />
      <pointLight ref={torch} color={TORCH.colour} intensity={TORCH.power} distance={TORCH_RADIUS * 1.6} decay={TORCH.decay} castShadow={view.shadows} shadow-mapSize={[512, 512]} />
      {Array.from({ length: LIGHT_POOL }, (_, i) => <pointLight key={i} ref={(l) => { pool.current[i] = l; }} color={FIRE.colour} intensity={0} decay={FIRE.decay} />)}
      <instancedMesh key={`f${cells.floor.length}`} ref={floorRef} args={[floorGeo, mats.floor, cells.floor.length]} receiveShadow
        onPointerDown={(e) => { e.stopPropagation(); tap(e.point); }} />
      <instancedMesh key={`w${cells.walls.length}`} ref={wallRef} args={[wallGeo, mats.walls, cells.walls.length]} castShadow receiveShadow raycast={() => null} />
      {/* You, unlit: the player always reads clearly, whatever the light. */}
      <mesh ref={hero} raycast={() => null}><planeGeometry /><meshBasicMaterial alphaTest={0.5} side={THREE.DoubleSide} /></mesh>
      <Sprites sim={sim} live={live} things={things()} room={room} stretch={stretch} />
    </>
  );
}

// The lit lights you've seen (wall torches, candles, campfires), nearest you first.
function litLights(sim: WalkSim, live: WalkSim["live"]): { x: number; y: number; r: number }[] {
  return [
    ...sim.sconces.filter((c) => c.lit).map((c) => ({ x: c.x, y: c.y - (c.wall === "top" || !c.wall ? 0.4 : 0), r: SCONCE_RADIUS })),
    ...sim.candles.filter((c) => c.lit).map((c) => ({ x: c.x, y: c.y, r: CANDLE_RADIUS })),
    ...sim.fires.map((f) => ({ x: f.x, y: f.y, r: f.left > 0 ? CAMPFIRE_LIGHT : CAMPFIRE_LIGHT / 2 })),
  ].filter((l) => sim.known[Math.round(l.y) * live.w + Math.round(l.x)])
    .sort((a, b) => Math.hypot(a.x - sim.me.x, a.y - sim.me.y) - Math.hypot(b.x - sim.me.x, b.y - sim.me.y));
}

// Things, foes and wall torches: upright pictures, sized from their definitions (lib/world/objects.ts).
// `shade` (Stone): the colour of the light where each stands, as there are no Three.js lights to light them.
function Sprites({ sim, live, things, room, stretch, sconces = true, shade }: { sim: WalkSim; live: WalkSim["live"]; things: Thing[]; room: (id: string) => Room | undefined; stretch: number; sconces?: boolean; shade?: (x: number, y: number) => THREE.Color }) {
  const seen = (x: number, y: number) => sim.known[Math.round(y) * live.w + Math.round(x)] === 1;
  const lightNow = (x: number, y: number) => sim.lightNow[Math.round(y) * live.w + Math.round(x)] === 1;
  const out: React.ReactNode[] = [];
  for (const t of things) {
    if (!seen(t.x, t.y)) continue;
    const d = objectDef(t.def), a = artOf(d, t.state ?? (t.open ? "open" : "shut"));
    if (!a) continue;
    const b = d.visual.bounds, w = b.left + b.right, h = (b.up + b.down) * stretch;
    out.push(<Upright key={t.key} src={a.src} x={t.x} y={t.y} w={w} h={h} below={b.down * stretch} colour={shade?.(t.x, t.y)} />);
  }
  for (const f of sim.foes) {
    if (!lightNow(f.x, f.y) && !sim.alarm) continue;
    const r = room(f.room), e = r?.enemies?.[f.index];
    const sprite = r?.boss ? CREATURE_SPRITES[r.boss] : e && CREATURE_SPRITES[e.creatureId], a = sprite && artFor(sprite);
    if (!a) continue;
    const tall = FOE_U * (f.waits ? (r?.boss ? BOSS_SCALE : CHIEF_SCALE) : 1) * stretch, wd = (tall / stretch) * (a.w / a.h);
    const flip = (Math.cos(f.facing) > 0.1) !== (a.faces === "right");
    out.push(<Upright key={`foe:${f.room}:${f.index}`} src={a.src} x={f.x} y={f.y} w={flip ? -wd : wd} h={tall} below={0} colour={shade?.(f.x, f.y)} />);
  }
  for (const c of sconces ? sim.sconces : []) {
    if (!seen(c.x, c.y)) continue;
    const side = c.wall === "left" ? -1 : c.wall === "right" ? 1 : 0;
    const [tw, th] = KIT_LIGHTS.torchSize, w = tw / ART_PER_U, h = th / ART_PER_U;
    const x = c.x + side * 0.49, z = side ? c.y : c.y - 0.49, rot = side ? -side * (Math.PI / 2) : 0;
    out.push(
      <group key={c.id} position={[x, 1.05, z]} rotation={[0, rot, 0]}>
        <mesh raycast={() => null} position={[0, 0, 0.01]} scale={[w, h, 1]}><planeGeometry />{shade
          ? <meshBasicMaterial map={texture(KIT_LIGHTS.torch)} alphaTest={0.5} color={shade(c.x, c.y)} />
          : <meshLambertMaterial map={texture(KIT_LIGHTS.torch)} alphaTest={0.5} />}</mesh>
        {c.lit && <mesh raycast={() => null} position={[0, h / 2 - KIT_LIGHTS.head / ART_PER_U, 0.03]} scale={[0.14, 0.2, 1]}><planeGeometry /><meshBasicMaterial color="#ffd27a" /></mesh>}
      </group>,
    );
  }
  return <>{out}</>;
}

// A picture standing upright at (x, y) on the floor, facing the camera's way (south), lit by the
// lights, or (`colour`, Stone) tinted by the light where it stands.
function Upright({ src, x, y, w, h, below, colour }: { src: string; x: number; y: number; w: number; h: number; below: number; colour?: THREE.Color }) {
  return (
    <mesh raycast={() => null} position={[x, h / 2 - below, y + 0.05]} scale={[w, h, 1]}>
      <planeGeometry />
      {colour
        ? <meshBasicMaterial map={texture(src)} alphaTest={0.5} side={THREE.DoubleSide} color={colour} />
        : <meshLambertMaterial map={texture(src)} alphaTest={0.5} side={THREE.DoubleSide} />}
    </mesh>
  );
}

// ── 🧪 The grey experiment: the dungeon carved out of solid rock (lib/render3d/dungeon3d.ts) ──
const GREY = { floor: 0.34, floorAlt: 0.3, rock: 0.62, rim: 0.46 };   // 🧪 flat greys: floor (a faint checker, to show foreshortening), rock, and the lowered south rim's top (darker, so it reads as a step down)
const GREY_LIGHT = { ambient: 0.55, sun: 0.9, from: [3.5, 10, 7] as [number, number, number] }; // 🧪 one plain light, from above and a little south-east, so tops, north faces and each side face read as different values

// The carved rock's mesh, built from what you've seen (again as you see more, 4 times a second at
// most: about 12 ms a Labyrinth). Only the picture: the sim still walks, sees and lights by the
// floorplan, whatever shows here. `paint`: colours a vertex (the grey mode's), if the mode wants them.
function useCarved(sim: WalkSim, live: WalkSim["live"], view: View3D, paint?: (m: CarvedMesh, lit: Uint8Array | null) => Float32Array): THREE.BufferGeometry | null {
  const build = () => {
    const known = (i: number) => view.unseen === "shown" || sim.known[i] === 1;
    const h = rockHeights(live, (i) => live.tiles[i] !== 0 && (view.unseen !== "rock" || known(i)), view.wall, view.south === "low");
    // "black": everything's carved, and what's beside nothing you've seen is drawn black.
    const lit = view.unseen === "black" ? Uint8Array.from(shadeOf(live, sim.known), (v) => (v > 0 ? 1 : 0)) : null;
    const m = carvedMesh(h, live.w, live.h, view.wall, lit ? 0 : ROCK_MARGIN, lit ?? undefined);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
    if (paint) geo.setAttribute("color", new THREE.BufferAttribute(paint(m, lit), 3));
    geo.computeBoundingSphere();
    return geo;
  };
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => () => geo?.dispose(), [geo]);
  const last = useRef({ key: "", at: -Infinity, live });
  useFrame(() => {
    const now = performance.now(), key = `${sim.known.reduce((n, k) => n + k, 0)}|${view.wall}|${view.south}|${view.unseen}`;
    if ((key !== last.current.key && now - last.current.at > 250) || live !== last.current.live) {
      last.current = { key, at: now, live };
      setGeo(build());
    }
  });
  return geo;
}
// Taps count on the floor only (a tap on rock's top would land on the wrong tile).
const floorTap = (tap: (p: THREE.Vector3) => void) => (e: { point: THREE.Vector3; stopPropagation: () => void }) => { if (e.point.y < 0.01) { e.stopPropagation(); tap(e.point); } };
// The lean, in the vertex shader: a point moves outwards by lean × its height × how far across from you it is.
const LEAN = "transformed.x += uLean * (transformed.x - uCx) * transformed.y;";

function GreyRock({ sim, live, view, tap }: { sim: WalkSim; live: WalkSim["live"]; view: View3D; tap: (p: THREE.Vector3) => void }) {
  const uni = useRef({ uLean: { value: 0 }, uCx: { value: 0 } });
  const mat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni.current);
      sh.vertexShader = "uniform float uLean;\nuniform float uCx;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${LEAN}`);
    };
    return m;
  }, []);
  const geo = useCarved(sim, live, view, (m, lit) => {
    const col = new Float32Array(m.position.length);
    for (let q = 0; q < m.tile.length; q++) {
      const v = q * 18, ti = m.tile[q], y = m.position[v + 1], up = m.normal[v + 1] > 0.5;
      const g = up && y === 0 ? (((ti % live.w) + Math.floor(ti / live.w)) & 1 ? GREY.floorAlt : GREY.floor)
        : up && y < view.wall ? GREY.rim : GREY.rock;
      col.fill(lit && (ti < 0 || !lit[ti]) ? 0 : g, v, v + 18);
    }
    return col;
  });
  useFrame(() => { uni.current.uLean.value = view.lean; uni.current.uCx.value = sim.me.x; });
  if (!geo) return null;
  return <mesh geometry={geo} material={mat} onPointerDown={floorTap(tap)} />;
}

// ── 🧪 Stone: the carved rock with flat stand-in textures, lit from the sim's light reach (lib/render3d/stone.ts) ──
// No Three.js lights: one shader reads the light grid (your torch's and the other lights', a subcell
// apart, never through rock) and what you've seen, and shades each surface by which way it faces.
// Light multiplies the art (warm where it's lit, a plain dim where you only remember); nothing is
// added over the picture, so no wash or haze.
const STONE = {
  remember: 0.2,     // 🧪 how bright a place you've seen but isn't lit now shows (a plain dim, no tint)
  gain: 1.25,        // 🧪 full light: the art a little brighter than drawn (the kits are drawn dark)
  top: 0.5,          // 🧪 rock tops: their stone this much darker, so they read as rock, not floor
  topLight: 0.3,     // 🧪 and lit this much (the light's below them)
  rimLight: 0.85,    // 🧪 the low south rim's top: nearly as lit as the floor beside it
  fire: 0.85,        // 🧪 wall torches, candles and campfires: how bright, beside your torch's 1
  faceFire: 0.8,     // 🧪 wall faces lit by those (they don't follow which way a face looks)
  facing: 0.6,       // 🧪 how much a face's light from your torch follows how squarely it faces your torch
  faceFall: 0.35,    // 🧪 faces darken this much up to their tops (your torch is lower than the wall)
  bands: 6,          // 🧪 light's steps from black to full, when stepped
  torchHeight: 1.8,  // your torch, held up (u)
  warm: [1, 0.86, 0.68] as [number, number, number],  // 🧪 your torch's colour (multiplied in, never added)
  flame: [1, 0.76, 0.52] as [number, number, number], // 🧪 the other lights'
};
// The stand-in art: today's 2D kits, laid flat and square at the chosen density (not redrawn).
// Kit F was drawn at 48 a unit, kit A at 32. Floors are the kit's floor; wall faces the rows of its
// north wall under the cap (the bottom row at the wall's foot); rock tops that stone again, darker;
// the low rim's top the cap's band.
const KIT_A = WALK_TILES.find((t) => t.kit?.floor.includes("kit-a-"))!.kit!;
const STAND_INS = { f: KIT, a: KIT_A };

// Textures for the shader: the PNG's own values (no colour-space change: light multiplies what the
// artist drew), repeating, sharp.
const RAW = new Map<string, THREE.Texture>();
function rawTexture(src: string): THREE.Texture {
  let t = RAW.get(src);
  if (!t) {
    t = new THREE.TextureLoader().load(src);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    RAW.set(src, t);
  }
  return t;
}
// A grid of bytes as a texture (the light, what you've seen), blended between samples.
function gridTexture(w: number, h: number): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

// Two grids (values 0–1) into a grid texture's red and green.
function fillGrid(t: THREE.DataTexture, r: ArrayLike<number>, g: ArrayLike<number>) {
  const d = t.image.data as Uint8Array;
  for (let i = 0; i < r.length; i++) { d[i * 4] = Math.round(r[i] * 255); d[i * 4 + 1] = Math.round(g[i] * 255); }
  t.needsUpdate = true;
}

const STONE_VERTEX = `
uniform float uLean;
uniform float uCx;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vWorld = position; vNormal = normal;   // (the texture and the light stay on the rock: the lean moves only the picture)
  vec3 transformed = position;
  ${LEAN}
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}`;
const STONE_FRAGMENT = `
uniform sampler2D uFloor; uniform sampler2D uFace; uniform sampler2D uRim;
uniform vec2 uFloorSize; uniform vec2 uFaceSize; uniform vec2 uRimSize;   // (their pixels)
uniform float uFaceRows;                                                  // the face's rows under the cap
uniform vec2 uUp; uniform vec2 uSide;                                     // texels a unit: floors and tops, faces (stone.ts texelsPerU)
uniform sampler2D uLight; uniform vec3 uWin;                              // r: your torch, g: the others; its corner (x, z) and size (u)
uniform sampler2D uSeen; uniform vec2 uPlan;                              // r: the fade (blended), g: shown (exact)
uniform float uWall; uniform float uRemember; uniform float uGain; uniform float uTop; uniform float uTopLight; uniform float uRimLight;
uniform float uFaceFire; uniform float uFacing; uniform float uFaceFall; uniform float uBands; uniform float uMode;
uniform vec3 uTorch; uniform vec3 uWarm; uniform vec3 uFlame;
varying vec3 vWorld;
varying vec3 vNormal;

const int BAYER[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
vec3 face(vec2 t) { return texture2D(uFace, vec2(t.x / uFaceSize.x, mod(t.y, uFaceRows) / uFaceSize.y)).rgb; }

void main() {
  vec3 n = normalize(vNormal);
  bool up = n.y > 0.5;
  float y = vWorld.y;
  // A face takes the light (and what's known) of the open tile in front of it.
  vec2 q = vWorld.xz + (up ? vec2(0.0) : n.xz * (0.5 / 3.0));
  ivec2 tile = ivec2(floor(q + 0.5));
  if (tile.x < 0 || tile.y < 0 || float(tile.x) >= uPlan.x || float(tile.y) >= uPlan.y || texelFetch(uSeen, tile, 0).g < 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float fade = texture2D(uSeen, (q + 0.5) / uPlan).r;

  // The art, laid flat: floors and tops by x and z (north up the picture), faces by across and height.
  vec3 tex;
  if (up) {
    vec2 t = vec2(vWorld.x, -vWorld.z) * uUp;
    if (y < 0.01) tex = texture2D(uFloor, t / uFloorSize).rgb;
    else if (y < uWall - 0.01) tex = texture2D(uRim, t / uRimSize).rgb;
    else tex = face(t) * uTop;
  } else {
    float across = abs(n.z) > 0.5 ? vWorld.x : vWorld.z * n.x;
    tex = face(vec2(across, y) * uSide);
  }

  // The light where it lands, and how the surface takes it.
  vec2 lu = (q - uWin.xy) / uWin.z;
  vec2 l = (lu.x < 0.0 || lu.y < 0.0 || lu.x > 1.0 || lu.y > 1.0) ? vec2(0.0) : texture2D(uLight, lu).rg;
  float lit;
  if (up) lit = (l.r + l.g) * (y < 0.01 ? 1.0 : y < uWall - 0.01 ? uRimLight : uTopLight);
  else {
    float squarely = max(dot(n, normalize(uTorch - vWorld)), 0.0);
    lit = (l.r * mix(1.0, squarely, uFacing) + l.g * uFaceFire) * (1.0 - uFaceFall * clamp(y / uWall, 0.0, 1.0));
  }
  lit *= uGain;
  vec3 colour = (vec3(uRemember) + lit * mix(uFlame, uWarm, l.r / max(l.r + l.g, 0.0001))) * fade;
  // Stepped: the brightness rounded to bands (dithered: where they meet, mixed in a fixed pattern).
  float I = (uRemember + lit) * fade, Q = I;
  if (uMode > 0.5) {
    ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
    float d = uMode > 1.5 ? (float(BAYER[p.y * 4 + p.x]) + 0.5) / 16.0 : 0.5;
    Q = floor(I * uBands + d) / uBands;
  }
  gl_FragColor = vec4(tex * colour * (I > 0.0 ? Q / I : 0.0), 1.0);
}`;

function StoneRock({ sim, live, view, tap, centre, fieldRef }: {
  sim: WalkSim; live: WalkSim["live"]; view: View3D; tap: (p: THREE.Vector3) => void;
  centre: React.RefObject<{ x: number; z: number }>; fieldRef: React.RefObject<LightField | null>;
}) {
  const geo = useCarved(sim, live, view);
  // The light grid and what you've seen, as textures (written into each frame, so kept in a ref).
  const grids = useRef<{ light: THREE.DataTexture; seen: THREE.DataTexture } | null>(null);
  useEffect(() => () => { grids.current?.light.dispose(); grids.current?.seen.dispose(); }, []);
  // The shader, made on the first frame and put on the mesh then (its settings change every frame, so it lives in refs).
  const uni = useRef(stoneUniforms());
  const mat = useRef<THREE.ShaderMaterial | null>(null), mesh = useRef<THREE.Mesh>(null);
  useEffect(() => () => mat.current?.dispose(), []);
  const last = useRef({ light: -Infinity, seen: "", seenAt: -Infinity, live });

  useFrame(() => {
    const u = uni.current, now = performance.now();
    mat.current ??= new THREE.ShaderMaterial({ uniforms: u, vertexShader: STONE_VERTEX, fragmentShader: STONE_FRAGMENT });
    if (mesh.current && mesh.current.material !== mat.current) mesh.current.material = mat.current;
    let tex = grids.current, fresh = false;
    if (!tex || tex.seen.image.width !== live.w || tex.seen.image.height !== live.h) {
      tex?.light.dispose(); tex?.seen.dispose();
      tex = grids.current = { light: gridTexture(WINDOW * SUB, WINDOW * SUB), seen: gridTexture(live.w, live.h) };
      fresh = true;
    }
    // The view's choices (cheap: set every frame).
    const kit = STAND_INS[view.kit], k = kit.size;
    u.uLean.value = view.lean; u.uCx.value = centre.current.x; u.uWall.value = view.wall;
    u.uFloor.value = rawTexture(kit.floor); u.uFloorSize.value.set(k.px, k.row);
    u.uFace.value = rawTexture(kit.north); u.uFaceSize.value.set(k.px, k.north); u.uFaceRows.value = k.north - k.cap;
    u.uRim.value = rawTexture(kit.cap); u.uRimSize.value.set(k.px, k.cap);
    u.uUp.value.set(...texelsPerU("up", view.density, view.pitch, view.texels));
    u.uSide.value.set(...texelsPerU("face", view.density, view.pitch, view.texels));
    u.uMode.value = view.light === "smooth" ? 0 : view.light === "stepped" ? 1 : 2;
    u.uLight.value = tex.light; u.uSeen.value = tex.seen; u.uPlan.value.set(live.w, live.h);
    // The light, 30 times a second: your torch (as far as the sim's reaches now) and the lit lights you've seen.
    if (now - last.current.light > 33) {
      last.current.light = now;
      const torch: Light3D = { x: sim.me.x, y: sim.me.y, r: torchReach(sim.flareLeft), power: 1 };
      const lights = litLights(sim, live).map((l, i) => ({ ...l, power: STONE.fire * (0.93 + 0.07 * Math.sin(now / 90 + i)) }));
      const f = fieldRef.current = lightField(live, sim.lightNow, torch, lights, sim.me.x, sim.me.y, WINDOW, fieldRef.current ?? undefined);
      fillGrid(tex.light, f.torch, f.other);
      u.uWin.value.set(f.x0 - 0.5, f.y0 - 0.5, f.size);
      u.uTorch.value.set(sim.me.x, STONE.torchHeight, sim.me.y);
    }
    // What you've seen, and the fade (again as you see more).
    const key = `${sim.known.reduce((n, k) => n + k, 0)}|${view.unseen}|${view.fade}`;
    if ((key !== last.current.seen && now - last.current.seenAt > 250) || live !== last.current.live || fresh) {
      last.current = { ...last.current, seen: key, seenAt: now, live };
      const s = seenField(live, sim.known, view.unseen, view.fade ? undefined : 0);
      fillGrid(tex.seen, s.fade, s.shown);
    }
  });
  if (!geo) return null;
  return <mesh ref={mesh} geometry={geo} onPointerDown={floorTap(tap)} />;
}

// The shader's settings, filled in each frame from the view (STONE's numbers to start).
function stoneUniforms() {
  const v2 = () => ({ value: new THREE.Vector2() }), v3 = (x = 0, y = 0, z = 0) => ({ value: new THREE.Vector3(x, y, z) });
  const map = () => ({ value: null as THREE.Texture | null });
  return {
    uLean: { value: 0 }, uCx: { value: 0 }, uFloor: map(), uFace: map(), uRim: map(), uFloorSize: v2(), uFaceSize: v2(), uRimSize: v2(),
    uFaceRows: { value: 1 }, uUp: v2(), uSide: v2(), uLight: map(), uWin: v3(), uSeen: map(), uPlan: v2(),
    uWall: { value: WALL_HEIGHT }, uRemember: { value: STONE.remember }, uGain: { value: STONE.gain }, uTop: { value: STONE.top },
    uTopLight: { value: STONE.topLight }, uRimLight: { value: STONE.rimLight }, uFaceFire: { value: STONE.faceFire },
    uFacing: { value: STONE.facing }, uFaceFall: { value: STONE.faceFall }, uBands: { value: STONE.bands }, uMode: { value: 0 },
    uTorch: v3(), uWarm: v3(...STONE.warm), uFlame: v3(...STONE.flame),
  };
}

// The light's colour where a sprite stands (Stone), as the rock's: a plain dim, warmed by the light.
function stoneShade(f: LightField | null, x: number, y: number): THREE.Color {
  const l = f ? lightAt(f, x, y) * STONE.gain : 0;
  const [r, g, b] = STONE.warm.map((w) => Math.min(1, STONE.remember + l * w));
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
}
