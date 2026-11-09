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
// The setup copies WalkView's (a seam to share later, if the prototype is kept).

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Pt } from "@/lib/dungeon/floorplan";
import { layoutFloorplan, type Progress } from "@/lib/dungeon/layout";
import { walkToward, walkStick, keysPush, isWalkKey, STICK_DEAD, type CanStep } from "@/lib/dungeon/walk";
import { shutPlan, TORCH_RADIUS, SCONCE_RADIUS, CANDLE_RADIUS } from "@/lib/dungeon/torch";
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
import { dungeonCells, shadeOf, WALL_HEIGHT, uprightStretch } from "@/lib/render3d/dungeon3d";

// What the lab can change, to compare.
export type View3D = { pitch: number; perspective: boolean; pixels: "device" | "art"; shadows: boolean; across: number };
export type Stats3D = { fps: number; calls: number; triangles: number; lights: number };

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

  // Pixels: the screen's own, or one canvas pixel to each art pixel (blown up, sharp).
  useEffect(() => { setDpr(view.pixels === "art" ? (ART_PER_U * view.across) / size.width : window.devicePixelRatio || 1); }, [view.pixels, view.across, size.width, setDpr]);

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
    const target = new THREE.Vector3(sim.me.x, 0, sim.me.y);
    const back = new THREE.Vector3(0, Math.sin(view.pitch), Math.cos(view.pitch));
    if (camera instanceof THREE.OrthographicCamera) {
      camera.position.copy(target).addScaledVector(back, 60);
      camera.zoom = size.width / view.across;
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 30;
      const halfW = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * (size.width / size.height));
      camera.position.copy(target).addScaledVector(back, view.across / 2 / Math.tan(halfW));
    }
    camera.near = 0.1; camera.far = 200;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    // Your torch, held up.
    torch.current?.position.set(sim.me.x + 0.25, TORCH.height, sim.me.y - 0.1); // (held up beside you, not in front of your face)
    // The nearest lit lights you've seen get the pool's real lights.
    const lit = [
      ...sim.sconces.filter((c) => c.lit).map((c) => ({ x: c.x, y: c.y - (c.wall === "top" || !c.wall ? 0.4 : 0), r: SCONCE_RADIUS })),
      ...sim.candles.filter((c) => c.lit).map((c) => ({ x: c.x, y: c.y, r: CANDLE_RADIUS })),
      ...sim.fires.map((f) => ({ x: f.x, y: f.y, r: f.left > 0 ? CAMPFIRE_LIGHT : CAMPFIRE_LIGHT / 2 })),
    ].filter((l) => sim.known[Math.round(l.y) * live.w + Math.round(l.x)])
      .sort((a, b) => Math.hypot(a.x - sim.me.x, a.y - sim.me.y) - Math.hypot(b.x - sim.me.x, b.y - sim.me.y));
    pool.current.forEach((pl, i) => {
      if (!pl) return;
      const l = lit[i];
      pl.intensity = l ? FIRE.power * (0.93 + 0.07 * Math.sin(now / 90 + i)) : 0;
      if (l) { pl.position.set(l.x, FIRE.height, l.y); pl.distance = l.r * 1.4; }
    });
    // What you've seen: black where you never have.
    const seen = sim.known.reduce((n, k) => n + k, 0);
    if (seen !== last.current.known && now - last.current.shadeAt > 150) {
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
      onStats({ fps: Math.round((last.current.frames * 1000) / (now - last.current.statsAt || 1)), calls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles, lights: lit.length });
      last.current.frames = 0; last.current.statsAt = now;
    }
    state.gl.info.reset();
  });

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

// Things, foes and wall torches: upright pictures, sized from their definitions (lib/world/objects.ts).
function Sprites({ sim, live, things, room, stretch }: { sim: WalkSim; live: WalkSim["live"]; things: Thing[]; room: (id: string) => Room | undefined; stretch: number }) {
  const seen = (x: number, y: number) => sim.known[Math.round(y) * live.w + Math.round(x)] === 1;
  const lightNow = (x: number, y: number) => sim.lightNow[Math.round(y) * live.w + Math.round(x)] === 1;
  const out: React.ReactNode[] = [];
  for (const t of things) {
    if (!seen(t.x, t.y)) continue;
    const d = objectDef(t.def), a = artOf(d, t.state ?? (t.open ? "open" : "shut"));
    if (!a) continue;
    const b = d.visual.bounds, w = b.left + b.right, h = (b.up + b.down) * stretch;
    out.push(<Upright key={t.key} src={a.src} x={t.x} y={t.y} w={w} h={h} below={b.down * stretch} />);
  }
  for (const f of sim.foes) {
    if (!lightNow(f.x, f.y) && !sim.alarm) continue;
    const r = room(f.room), e = r?.enemies?.[f.index];
    const sprite = r?.boss ? CREATURE_SPRITES[r.boss] : e && CREATURE_SPRITES[e.creatureId], a = sprite && artFor(sprite);
    if (!a) continue;
    const tall = FOE_U * (f.waits ? (r?.boss ? BOSS_SCALE : CHIEF_SCALE) : 1) * stretch, wd = (tall / stretch) * (a.w / a.h);
    const flip = (Math.cos(f.facing) > 0.1) !== (a.faces === "right");
    out.push(<Upright key={`foe:${f.room}:${f.index}`} src={a.src} x={f.x} y={f.y} w={flip ? -wd : wd} h={tall} below={0} />);
  }
  for (const c of sim.sconces) {
    if (!seen(c.x, c.y)) continue;
    const side = c.wall === "left" ? -1 : c.wall === "right" ? 1 : 0;
    const [tw, th] = KIT_LIGHTS.torchSize, w = tw / ART_PER_U, h = th / ART_PER_U;
    const x = c.x + side * 0.49, z = side ? c.y : c.y - 0.49, rot = side ? -side * (Math.PI / 2) : 0;
    out.push(
      <group key={c.id} position={[x, 1.05, z]} rotation={[0, rot, 0]}>
        <mesh raycast={() => null} position={[0, 0, 0.01]} scale={[w, h, 1]}><planeGeometry /><meshLambertMaterial map={texture(KIT_LIGHTS.torch)} alphaTest={0.5} /></mesh>
        {c.lit && <mesh raycast={() => null} position={[0, h / 2 - KIT_LIGHTS.head / ART_PER_U, 0.03]} scale={[0.14, 0.2, 1]}><planeGeometry /><meshBasicMaterial color="#ffd27a" /></mesh>}
      </group>,
    );
  }
  return <>{out}</>;
}

// A picture standing upright at (x, y) on the floor, facing the camera's way (south), lit by the lights.
function Upright({ src, x, y, w, h, below }: { src: string; x: number; y: number; w: number; h: number; below: number }) {
  return (
    <mesh raycast={() => null} position={[x, h / 2 - below, y + 0.05]} scale={[w, h, 1]}>
      <planeGeometry />
      <meshLambertMaterial map={texture(src)} alphaTest={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}
