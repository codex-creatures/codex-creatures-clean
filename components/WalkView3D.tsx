"use client";
// components/WalkView3D.tsx
// The walk view the game draws (the user, 2026-11-10, decision 38): both walkable dungeons, "New:
// the Encampment" and "New: the Cyclops", on the Labyrinth screen in place of the room view, in
// Stone mode with decision 37's picks (GAME_VIEW); /lab/three tries its other modes.
// The same walk as the 2D view (components/WalkView.tsx, kept until this one has been played),
// set up by the same code (hooks/useWalkPlay.ts: the run's layout, saved placements and the
// frame-by-frame sim, lib/world/walkSim.ts), and handing the screen the same callbacks: onEnter,
// onSpotted, onObject, onCage, onHeal, onKeep (WalkView's header says what each is). The stick,
// the campfire window and the scroll are WalkView's own. Only the drawing is new.
// It's drawn with Three.js (React Three Fiber): the floor and wall blocks as real geometry
// (lib/render3d/dungeon3d.ts), today's kit art as their textures, sharp (no smoothing), lit by
// real lights (your torch, and the nearest burning torches, candles and campfires), with no
// tints or washes over the picture. Creatures, people and things stand upright in the world as
// sprites, lit by the same lights. What you've never seen stays black (the sim's `known`).
// "Stone" (?geo=stone) is the materials-and-lighting experiment on the settled geometry: the grey
// mode's carved rock with flat stand-in textures and no Three.js lights at all, its light taken
// from the sim's light reach (lib/render3d/stone.ts).

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { Pt } from "@/lib/dungeon/floorplan";
import * as THREE from "three";
import { roomAt } from "@/lib/dungeon/walk";
import { torchReach, rubbleOf, showsRubble, fireInSight, TORCH_RADIUS, SCONCE_RADIUS, CANDLE_RADIUS, type Rubble } from "@/lib/dungeon/torch";
import { CAMPFIRE_LIGHT } from "@/lib/dungeon/campfire";
import { ALARM_LIGHT, FADE_TIME } from "@/lib/dungeon/foes";
import { FACINGS, facingOf, walkFrame } from "@/lib/dungeon/tileArt";
import { deckRarity, type Room } from "@/lib/dungeon/run";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { isPerson, locate, personOf, PERSON_LIGHT } from "@/lib/dungeon/people";
import type { LocatorKey } from "@/lib/items/materials";
import type { Layout, Progress } from "@/lib/dungeon/layout";
import type { Thing } from "@/lib/world/walkWorld";
import { torchThere, type WalkSim, type Frame } from "@/lib/world/walkSim";
import { objectDef, artOf, FOE_U, NPC_U, BOSS_SCALE, CHIEF_SCALE } from "@/lib/world/objects";
import { WALK_TILES, WALK_HERO, WALK_WITCH, KIT_LIGHTS, KIT_PX } from "@/lib/sprites/walk";
import { FALL_TIME, DUST_TIME, SHAKE_TIME } from "@/lib/render/scene";
import { useWalkPlay, type WalkPlayProps } from "@/hooks/useWalkPlay";
import { Stick, Warmth, WalkScroll } from "@/components/WalkView";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { artFor } from "@/lib/sprites/art";
import { MERCHANT, LIBRARIAN } from "@/lib/sprites/props";
import { dungeonCells, shadeOf, WALL_HEIGHT, uprightStretch, rockHeights, carvedMesh, oneWayDoors, ROCK_MARGIN, type CarvedMesh } from "@/lib/render3d/dungeon3d";
import { prop3dOf, bookcaseBroken, CANDLE_AT } from "@/lib/render3d/props3d";
import { Prop3D, Campfire, PROP_LEAN, type Tint } from "@/components/Props3D";
import { texelsPerU, pixelScale, lightField, shadeAt, seenField, SUB, WINDOW, type LightField, type Light3D, type PixelMode, type TexelMode } from "@/lib/render3d/stone";

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
const HOLD_DRAG = 10;                  // 🧪 px a held finger moves before you follow it (less, and it's a tap)
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

// What the game draws (the user, 2026-11-10: decision 36's geometry, decision 37's picks): B, the
// orthographic camera at 60° with the lean, 2.25 u walls, a low south rim, unfound places black;
// Stone at 48 art pixels a unit, kit F's stand-ins laid square on screen, art pixels at 15 across,
// smooth light and the fade into the unexplored. (/lab/three's Stone starts on the same.)
export const GAME_VIEW: View3D = { pitch: Math.PI / 3, perspective: false, pixels: "art", shadows: false, across: 15,
  grey: true, lean: 0.03, fov: 20, south: "low", wall: WALL_HEIGHT, unseen: "black",
  stone: true, density: 48, kit: "f", texels: "screen", light: "smooth", fade: true };

export default function WalkView3D({ view = GAME_VIEW, onStats, been, cleared, lit, seen, onScrollClose, ...play }: WalkPlayProps & {
  been: string[];                      // rooms you've stood in (the scroll's marks)
  cleared: string[];                   // …and the ones finished (crossed out)
  lit?: string[]; seen?: string[];     // rooms a flare or a clairvoyance scroll showed (the run's)
  onScrollClose: () => void;
  view?: View3D;                       // the lab: another way to draw it
  onStats?: (s: Stats3D) => void;      // the lab: how it's running
}) {
  const W = useWalkPlay(play);
  const { sim, plan } = W, { scroll, team } = play;
  // The camera (for taps: the scene keeps it here), and the fade into a fight over the picture.
  const camera = useRef<THREE.Camera | null>(null);
  const dark = useRef<HTMLDivElement>(null);
  const frame = useRef<Frame | null>(null);

  // A finger held down: once it's dragged past HOLD_DRAG px, you walk toward the floor under it, worked out
  // every frame (the camera follows you, so a finger held still near the edge keeps you walking that way).
  const pad = useRef<HTMLDivElement>(null);
  const held = useRef<{ id: number; x0: number; y0: number; x: number; y: number; drag: boolean; at: string } | null>(null);
  const following = () => {
    const h = held.current, el = pad.current;
    if (!h?.drag || !el) return;
    const spot = floorAt(el, h.x, h.y);
    if (!spot || `${spot.x},${spot.y}` === h.at) return;
    h.at = `${spot.x},${spot.y}`;
    W.holdAt(spot);
  };

  // Each frame: walk on (the stick's push up the screen is 1 / sin(pitch) of floor), then the picture follows.
  const step = (now: number) => {
    following();
    const F = frame.current = W.step(now, 1 / Math.sin(view.pitch));
    const A = F.alarm;
    if (dark.current) dark.current.style.opacity = A && A.fadeAt !== null ? String(Math.min(1, (now - A.fadeAt) / (FADE_TIME * 1000))) : "0";
  };

  // A tap: the floor under it (where the ray from the camera meets the floor), as the 2D view's tapCell.
  // (Measured from the box as drawn, so Settings → Screen size's scaling doesn't throw it off.)
  const floorAt = (el: HTMLElement, clientX: number, clientY: number): Pt | null => {
    const cam = camera.current;
    if (!cam) return null;
    const box = el.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - box.left) / box.width) * 2 - 1, 1 - ((clientY - box.top) / box.height) * 2), cam);
    const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    return p ? { x: Math.round(p.x), y: Math.round(p.z) } : null;
  };
  const tap = (e: React.PointerEvent<HTMLDivElement>) => {
    const spot = floorAt(e.currentTarget, e.clientX, e.clientY);
    held.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, drag: false, at: spot ? `${spot.x},${spot.y}` : "" };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (spot) W.tapAt(spot);
  };
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const h = held.current;
    if (!h || h.id !== e.pointerId) return;
    h.x = e.clientX; h.y = e.clientY;
    if (Math.hypot(h.x - h.x0, h.y - h.y0) > HOLD_DRAG) h.drag = true;
  };
  const letGo = (e: React.PointerEvent<HTMLDivElement>) => { if (held.current?.id === e.pointerId) held.current = null; };

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", height: "100%", background: "#000" }}>
      <div ref={pad} onPointerDown={tap} onPointerMove={drag} onPointerUp={letGo} onPointerCancel={letGo} style={{ position: "absolute", inset: 0, touchAction: "none" }}>
        <Canvas key={view.perspective ? "p" : "o"} orthographic={!view.perspective} flat shadows={view.shadows ? "basic" : false}
          gl={{ antialias: false, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.info.autoReset = false; /* (counted by hand: read, then reset, each frame) */ }}
          style={{ position: "absolute", inset: 0, background: "#000", imageRendering: "pixelated", touchAction: "none" }}>
          <World sim={sim} live={W.live} layout={W.layout} progress={W.progress} closed={W.closed} view={view} step={step} things={W.things} room={play.room}
            busy={play.busy} frame={frame} cameraRef={camera} onStats={onStats} />
        </Canvas>
      </div>
      <div ref={dark} aria-hidden style={{ position: "absolute", inset: 0, background: "#000", opacity: 0, pointerEvents: "none", zIndex: 2 }} />
      {!scroll && <Stick onPush={W.push} />}
      {W.warming && !scroll && <Warmth team={team} warming={W.warming} />}
      {scroll && <WalkScroll map={play.map} layout={W.layout} plan={plan} known={sim.known} trail={sim.trail} progress={W.progress} cuts={sim.cuts}
        been={been} here={roomAt(plan, sim.me)} at={sim.me} cleared={cleared} lit={lit} seen={seen} onClose={onScrollClose}
        people={tracked(play.walk.tracking, sim, W.layout, W.live, W.progress, play.room)} />}
    </div>
  );
}

// Who your locators find now (people.ts locate), each once, to show on the scroll where they stand.
function tracked(kinds: LocatorKey[] | undefined, sim: WalkSim, layout: Layout, live: WalkSim["live"], p: Progress, room: (id: string) => Room | undefined) {
  const people = sim.people.map(personOf);
  const found = (kinds ?? []).flatMap((k) => { const q = locate(k, people, sim.me, layout, live, p, room); return q ? [q] : []; });
  return found.filter((q, i) => found.findIndex((o) => o.id === q.id) === i);
}

// ── The world, in the scene ───────────────────────────────────────────────
function World({ sim, live, layout, progress, closed, view, step, things, room, busy, frame, cameraRef, onStats }: {
  sim: WalkSim; live: WalkSim["live"]; layout: Layout; progress: Progress; closed: Uint8Array; view: View3D; step: (now: number) => void;
  things: () => Thing[]; room: (id: string) => Room | undefined; busy: boolean; frame: React.RefObject<Frame | null>;
  cameraRef: React.RefObject<THREE.Camera | null>; onStats?: (s: Stats3D) => void;
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
  const fade = useRef<Float32Array | null>(null); // (Stone: what you've seen, faded, a tile: the same, as the floor is dimmed)

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
    cameraRef.current = camera;
    step(now);
    // The camera on you, from the south, at the pitch.
    const zs = density * Math.sin(view.pitch);
    centre.current = snapped ? { x: Math.round(sim.me.x * density) / density, z: Math.round(sim.me.y * zs) / zs } : { x: sim.me.x, z: sim.me.y };
    // A tunnel falling in shakes the picture a moment (as the 2D view's SHAKE_PX, about 3 art pixels).
    const shook = (now - sim.shakeAt) / 1000, shake = shook < SHAKE_TIME ? SHAKE_U * (1 - shook / SHAKE_TIME) : 0;
    const target = new THREE.Vector3(centre.current.x + (shake ? (Math.random() * 2 - 1) * shake : 0), 0, centre.current.z + (shake ? (Math.random() * 2 - 1) * shake : 0));
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
    // The 3D things lean as the rock does, about the camera's centre (Props3D).
    PROP_LEAN.uLean.value = view.grey ? view.lean : 0; PROP_LEAN.uCx.value = centre.current.x;
    // Your torch, held up.
    torch.current?.position.set(sim.me.x + 0.25, TORCH.height, sim.me.y - 0.1); // (held up beside you, not in front of your face)
    // The nearest lit lights you've seen get the pool's real lights.
    const lit = litLights(sim, live, frame.current);
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
      const cols = heroTex[0].length, moving = sim.me.path.length > 0 && !busy;
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

  const others = { sim, live, layout, progress, frame, things: things(), room, stretch };
  if (view.stone) return (
    <>
      <StoneRock sim={sim} live={live} layout={layout} view={view} closed={closed} frame={frame} centre={centre} fieldRef={field} fadeRef={fade} />
      {/* You, unlit, as in the other modes. */}
      <mesh ref={hero} raycast={() => null}><planeGeometry /><meshBasicMaterial alphaTest={0.5} side={THREE.DoubleSide} /></mesh>
      <Sprites {...others} shade={(x, y) => stoneShade(field.current, fade.current, live.w, x, y)} />
    </>
  );
  if (view.grey) return (
    <>
      <ambientLight intensity={GREY_LIGHT.ambient} />
      <directionalLight position={GREY_LIGHT.from} intensity={GREY_LIGHT.sun} />
      <GreyRock sim={sim} live={live} layout={layout} view={view} />
      <mesh ref={hero} raycast={() => null}><planeGeometry /><meshBasicMaterial alphaTest={0.5} side={THREE.DoubleSide} /></mesh>
      <Sprites {...others} sconces={false} />
    </>
  );
  return (
    <>
      <ambientLight color="#8a93b8" intensity={AMBIENT} />
      <pointLight ref={torch} color={TORCH.colour} intensity={TORCH.power} distance={TORCH_RADIUS * 1.6} decay={TORCH.decay} castShadow={view.shadows} shadow-mapSize={[512, 512]} />
      {Array.from({ length: LIGHT_POOL }, (_, i) => <pointLight key={i} ref={(l) => { pool.current[i] = l; }} color={FIRE.colour} intensity={0} decay={FIRE.decay} />)}
      <instancedMesh key={`f${cells.floor.length}`} ref={floorRef} args={[floorGeo, mats.floor, cells.floor.length]} receiveShadow raycast={() => null} />
      <instancedMesh key={`w${cells.walls.length}`} ref={wallRef} args={[wallGeo, mats.walls, cells.walls.length]} castShadow receiveShadow raycast={() => null} />
      {/* You, unlit: the player always reads clearly, whatever the light. */}
      <mesh ref={hero} raycast={() => null}><planeGeometry /><meshBasicMaterial alphaTest={0.5} side={THREE.DoubleSide} /></mesh>
      <Sprites {...others} />
    </>
  );
}

// The lit lights in sight now (wall torches, candles, campfires: the sim counts their light only
// while you can see them), and the foes that have seen you (lit up like your torch: the sim's
// ALARM_LIGHT), nearest you first.
function litLights(sim: WalkSim, live: WalkSim["live"], F: Frame | null): { x: number; y: number; r: number }[] {
  return [
    ...sim.sconces.filter((c) => c.lit && torchThere(sim, c)).map((c) => ({ x: c.x, y: c.y - (c.wall === "top" || !c.wall ? 0.4 : 0), r: SCONCE_RADIUS })),
    ...sim.candles.filter((c) => c.lit).map((c) => ({ x: c.x, y: c.y, r: CANDLE_RADIUS })),
    ...sim.fires.map((f) => ({ x: f.x, y: f.y, r: f.left > 0 ? CAMPFIRE_LIGHT : CAMPFIRE_LIGHT / 2 })),
    ...(F?.alarmed ?? []).map((f) => ({ x: f.x, y: f.y, r: ALARM_LIGHT })),
    ...(F?.peopleLit ?? []).map((w) => ({ x: w.x, y: w.y, r: PERSON_LIGHT })),
  ].filter((l) => sim.lightNow[Math.round(l.y) * live.w + Math.round(l.x)])
    .sort((a, b) => Math.hypot(a.x - sim.me.x, a.y - sim.me.y) - Math.hypot(b.x - sim.me.x, b.y - sim.me.y));
}

// Things, foes and wall torches: upright pictures, sized from their definitions (lib/world/objects.ts).
// `shade` (Stone): the colour of the light where each stands, as there are no Three.js lights to light them.
// As the 2D view (lib/render/scene.ts): things you've seen (people only while lit, unless solid), a
// used pool dimmed, a "!" over each cage you can open; foes while lit, or all of a room that's seen you,
// with a "!" over each; the card witch walking about, and the people who wander; campfires and candles; rubble where a tunnel fell.
// Foes, the witch and the people follow the sim every frame (the list itself is shown again now and then).
const FLAME_COLOUR = "#ffd27a";
const DIM_POOL = 0.6;                  // a used pool's picture, this bright (the 2D view's)
const SHAKE_U = 0.09;                  // u: the picture's shake as a tunnel falls in (the 2D view's 3 art pixels at 32 a unit)
const RUBBLE = { colours: ["#5b5560", "#6f6872", "#48434d"], size: 0.22, drop: 3 }; // the 2D view's stones; fallen from `drop` u up
function Sprites({ sim, live, layout, progress, frame, things, room, stretch, sconces = true, shade }: {
  sim: WalkSim; live: WalkSim["live"]; layout: Layout; progress: Progress; frame: React.RefObject<Frame | null>; things: Thing[];
  room: (id: string) => Room | undefined; stretch: number; sconces?: boolean; shade?: (x: number, y: number) => THREE.Color;
}) {
  const seen = (x: number, y: number) => sim.known[Math.round(y) * live.w + Math.round(x)] === 1;
  const lightNow = (x: number, y: number) => sim.lightNow[Math.round(y) * live.w + Math.round(x)] === 1;
  // A flame glows only while it's in sight: out of it (round a corner, or cut off), it's as dark as what's round it.
  const glows = (lit: boolean, x: number, y: number) => lit && lightNow(x, y);
  const A = frame.current?.alarm ?? sim.alarm;
  const out: React.ReactNode[] = [];
  for (const t of things) {
    if (!seen(t.x, t.y) || (t.npc && !lightNow(t.x, t.y) && !t.solid)) continue;
    const d = objectDef(t.def), a = artOf(d, t.state ?? (t.open ? "open" : "shut"));
    // (Someone who wanders the dungeon, world version 9, followed by their id; a room's witch by her room.)
    const person = isPerson(t.key) ? () => sim.people.find((q) => q.id === t.key) : undefined;
    const witch = t.def === "witch" ? person ?? (() => sim.npcs.find((n) => n.room === t.room)) : undefined;
    if (witch?.()) { out.push(<Witch key={t.key} find={witch} stretch={stretch} shade={shade} />); continue; }
    if (!a) continue;
    const b = d.visual.bounds, w = b.left + b.right, h = (b.up + b.down) * stretch;
    const walking = person && STROLLS[t.def] && artFor(STROLLS[t.def]);
    if (person && walking) {
      out.push(<Stroller key={t.key} find={() => person() ?? { ...t, facing: Math.PI, path: [] }} art={walking} w={w} stretch={stretch} shade={shade} />);
      continue;
    }
    // A chest, a stash's sack, a bookcase or a table: built in 3D, standing on its footprint (Props3D): where
    // the thing stands is already its footprint's middle (placements.ts spotOf). A cards room's table has
    // the deck on it till it's turned over, glowing the colour of its rarest card while it's in your sight.
    const kind = prop3dOf(t.def);
    if (kind) {
      const deck = t.def === "card-deck" && !t.open, rarest = deck ? deckRarity(room(t.room)?.deck) : undefined;
      const glow = rarest && fireInSight(live, t, sim.me) ? RARITY_COLORS[rarest].text : undefined;
      out.push(<group key={t.key} position={[t.x, 0, t.y]}><Prop3D kind={kind} open={t.open} colour={shade && (() => shade(t.x, t.y))} deck={deck} glow={glow} broken={kind === "bookcase" && bookcaseBroken(t.key)} /></group>);
      if (t.flag && lightNow(t.x, t.y)) out.push(<Mark key={`!${t.key}`} at={() => t} up={b.up * stretch + 0.25} />);
      continue;
    }
    const used = t.def === "pool" && t.open ? DIM_POOL : 1;
    const colour: Tint | undefined = shade ? () => shade(t.x, t.y).multiplyScalar(used) : used < 1 ? new THREE.Color(used, used, used) : undefined;
    out.push(<Upright key={t.key} src={a.src} x={t.x} y={t.y} w={w} h={h} below={b.down * stretch} colour={colour} />);
    if (t.flag && lightNow(t.x, t.y)) out.push(<Mark key={`!${t.key}`} at={() => t} up={b.up * stretch + 0.25} />);
  }
  for (const f of sim.foes) {
    const alarmed = !!A && f.room === A.room;
    if (!lightNow(f.x, f.y) && !alarmed) continue;
    const r = room(f.room), e = r?.enemies?.[f.index];
    const sprite = r?.boss ? CREATURE_SPRITES[r.boss] : e && CREATURE_SPRITES[e.creatureId], a = sprite && artFor(sprite);
    if (!a) continue;
    const tall = FOE_U * (f.waits ? (r?.boss ? BOSS_SCALE : CHIEF_SCALE) : 1) * stretch, wd = (tall / stretch) * (a.w / a.h);
    // (The sim swaps a foe for a moved copy each step: find it again by its room and place in it.)
    const now = () => sim.foes.find((g) => g.room === f.room && g.index === f.index) ?? f;
    out.push(<Upright key={`foe:${f.room}:${f.index}`} src={a.src} x={f.x} y={f.y} w={wd} h={tall} below={0} colour={shade && (() => { const g = now(); return shade(g.x, g.y); })}
      follow={() => { const g = now(); return { x: g.x, y: g.y, flip: (Math.cos(g.facing) > 0.1) !== (a.faces === "right") }; }} />);
    if (alarmed) out.push(<Mark key={`!foe:${f.room}:${f.index}`} at={now} up={tall + 0.25} pop={A!.at} />);
  }
  for (const f of sim.fires) {
    if (!seen(f.x, f.y)) continue;
    // A fire glows whatever's round it: drawn full bright while it burns, its embers lit as the rest. Built in
    // 3D (Props3D Campfire, the user, 2026-11-11), in the middle of its 2 × 2 footprint, its flames only while it burns.
    const burns = f.left > 0, mid = 1 / (2 * SUB);
    out.push(<group key={`fire:${f.room}`} position={[f.x - mid, 0, f.y - mid]}>
      <Campfire lit={burns} colour={glows(burns, f.x, f.y) ? (shade ? new THREE.Color(1, 1, 1) : undefined) : shade && (() => shade(f.x, f.y))} />
    </group>);
  }
  for (const c of sim.candles) {
    if (!seen(c.x, c.y)) continue;
    // The kit's candles, the 2D view's size against the walls' art (CANDLE_ART 0.85), a flame on each wick when lit.
    // (One on a table, world version 12, stands on its top: `high` up, to the left of its middle.)
    const [cw, ch] = KIT_LIGHTS.candleSize, k = 0.85 / ART_PER_U, w = cw * k, h = ch * k * stretch, on = glows(c.lit, c.x, c.y);
    const up = c.high ?? 0, cy = up ? c.y + 0.05 : c.y, cx = up ? c.x + CANDLE_AT : c.x;
    out.push(
      <group key={c.id} position={[0, up, 0]}>
        <Upright src={KIT_LIGHTS.candles} x={cx} y={cy} w={w} h={h} below={0} colour={on ? (shade ? new THREE.Color(1, 1, 1) : undefined) : shade && (() => shade(c.x, c.y))} />
        {on && KIT_LIGHTS.wicks.map(([wx, wy], i) => (
          <mesh key={i} raycast={() => null} position={[cx - w / 2 + wx * k, h - wy * k * stretch + 0.04, cy + 0.06]} scale={[0.05, 0.09, 1]}>
            <planeGeometry /><meshBasicMaterial color={FLAME_COLOUR} />
          </mesh>
        ))}
      </group>,
    );
  }
  for (const r of rubbleOf(sim.plan, layout, progress).filter(showsRubble)) {
    if (!sim.falls.has(r.key) && !r.tiles.some((q) => sim.known[q.y * live.w + q.x])) continue; // never seen: just rock
    out.push(<RubbleHeap key={r.key} sim={sim} r={r} shade={shade} />);
  }
  // (A tunnel up's top door, seen from above, is plain rock: the carved mesh shuts it, dungeon3d.ts
  // oneWayDoors. Its rubble heap looked like a broken placeholder: the user, 2026-11-11.)
  for (const c of sconces ? sim.sconces : []) {
    if (!seen(c.x, c.y) || !torchThere(sim, c)) continue;
    const side = c.wall === "left" ? -1 : c.wall === "right" ? 1 : 0;
    const [tw, th] = KIT_LIGHTS.torchSize, w = tw / ART_PER_U, h = th / ART_PER_U;
    const x = c.x + side * 0.49, z = side ? c.y : c.y - 0.49, rot = side ? -side * (Math.PI / 2) : 0;
    out.push(
      <group key={c.id} position={[x, 1.05, z]} rotation={[0, rot, 0]}>
        <Sconce w={w} h={h} colour={shade && (() => shade(c.x, c.y))} />
        {glows(c.lit, c.x, c.y) && <mesh raycast={() => null} position={[0, h / 2 - KIT_LIGHTS.head / ART_PER_U, 0.03]} scale={[0.14, 0.2, 1]}><planeGeometry /><meshBasicMaterial color="#ffd27a" /></mesh>}
      </group>,
    );
  }
  return <>{out}</>;
}

// A picture standing upright at (x, y) on the floor, facing the camera's way (south), lit by the
// lights, or (`colour`, Stone) tinted by the light where it stands.
// `follow`: where it stands now (and whether it's turned round), read every frame, for one that walks.
function Upright({ src, x, y, w, h, below, colour, follow }: { src: string; x: number; y: number; w: number; h: number; below: number; colour?: Tint;
  follow?: () => { x: number; y: number; flip?: boolean } }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = mesh.current, at = follow?.();
    if (m && typeof colour === "function") (m.material as THREE.MeshBasicMaterial).color.copy(colour());
    if (!m || !at) return;
    m.position.set(at.x, h / 2 - below, at.y + 0.05);
    m.scale.x = at.flip ? -w : w;
  });
  return (
    <mesh ref={mesh} raycast={() => null} position={[x, h / 2 - below, y + 0.05]} scale={[w, h, 1]}>
      <planeGeometry />
      {colour
        ? <meshBasicMaterial map={texture(src)} alphaTest={0.5} side={THREE.DoubleSide} color={typeof colour === "function" ? colour() : colour} />
        : <meshLambertMaterial map={texture(src)} alphaTest={0.5} side={THREE.DoubleSide} />}
    </mesh>
  );
}

// A wall torch's picture on its wall, lit by the lights, or (`colour`, Stone) tinted by the light in front of it, each frame.
function Sconce({ w, h, colour }: { w: number; h: number; colour?: () => THREE.Color }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => { if (mat.current && colour) mat.current.color.copy(colour()); });
  return (
    <mesh raycast={() => null} position={[0, 0, 0.01]} scale={[w, h, 1]}><planeGeometry />{colour
      ? <meshBasicMaterial ref={mat} map={texture(KIT_LIGHTS.torch)} alphaTest={0.5} color={colour()} />
      : <meshLambertMaterial map={texture(KIT_LIGHTS.torch)} alphaTest={0.5} />}</mesh>
  );
}

// The card witch walking about her room (a sheet like the hero's: still, then her walk; south, east
// and north, west being east turned round), facing the way she goes, at NPC_U tall.
function Witch({ find, stretch, shade }: { find: () => { x: number; y: number; facing: number; path: unknown[] } | undefined; stretch: number; shade?: (x: number, y: number) => THREE.Color }) {
  const mesh = useRef<THREE.Mesh>(null);
  const S = WALK_WITCH, cols = S.frames + 1, rows = 3;
  const frames = useMemo(() => Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => part(S.sheet, col / cols, 1 - (row + 1) / rows, 1 / cols, 1 / rows))), [S.sheet, cols]);
  const size = (NPC_U / S.tall) * S.cell, below = ((S.cell - S.feet) / S.cell) * size * stretch;
  useFrame(() => {
    const m = mesh.current, n = find();
    if (!m || !n) return;
    const face = facingOf(Math.cos(n.facing), Math.sin(n.facing), "south");
    const col = n.path.length > 0 ? 1 + (Math.floor(performance.now() / 130) % S.frames) : 0;
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.map = frames[["south", "east", "north"].indexOf(face === "west" ? "east" : face)][col];
    if (shade) mat.color = shade(n.x, n.y);
    m.scale.set(face === "west" ? -size : size, size * stretch, 1);
    m.position.set(n.x, (size * stretch) / 2 - below, n.y + 0.05);
  });
  return <mesh ref={mesh} raycast={() => null}><planeGeometry /><meshBasicMaterial alphaTest={0.5} side={THREE.DoubleSide} /></mesh>;
}

// The merchant and the librarian walking the dungeon (decision 39): their walk (the tavern's: 8 frames,
// PixMiniMax) while they move, their still while they stop, drawn `w` u wide (the still's width), feet
// on the floor; the art faces left, so it's mirrored heading right.
const STROLLS: Record<string, Parameters<typeof artFor>[0]> = { "merchant-walk": MERCHANT, "librarian-walk": LIBRARIAN };
const STROLL_FPS = 9; // walk frames a second (the tavern's)
function Stroller({ find, art, w, stretch, shade }: { find: () => { x: number; y: number; facing: number; path: unknown[] }; art: NonNullable<ReturnType<typeof artFor>>;
  w: number; stretch: number; shade?: (x: number, y: number) => THREE.Color }) {
  const mesh = useRef<THREE.Mesh>(null);
  const walk = art.walk!;
  const frames = useMemo(() => Array.from({ length: walk.frames }, (_, i) => part(walk.src, i / walk.frames, 0, 1 / walk.frames, 1)), [walk.src, walk.frames]);
  useFrame(() => {
    const m = mesh.current, n = find();
    if (!m) return;
    const k = w / art.w, moving = n.path.length > 0, right = Math.cos(n.facing) > 0.1, flip = right ? -1 : 1;
    const mat = m.material as THREE.MeshBasicMaterial;
    // The still's own size, or a whole walk frame with the still where it sits in it.
    const [fw, fh, cx, feet] = moving ? [walk.w * k, walk.h * k, (walk.w / 2 - (walk.x + art.w / 2)) * k, (walk.h - walk.y - art.h) * k] : [w, art.h * k, 0, 0];
    const tex = moving ? frames[Math.floor((performance.now() / 1000) * STROLL_FPS) % walk.frames] : texture(art.src);
    if (mat.map !== tex) { mat.map = tex; mat.needsUpdate = true; }
    if (shade) mat.color = shade(n.x, n.y);
    m.scale.set(flip * fw, fh * stretch, 1);
    m.position.set(n.x + flip * cx, (fh / 2 - feet) * stretch, n.y + 0.05);
  });
  return <mesh ref={mesh} raycast={() => null}><planeGeometry /><meshBasicMaterial alphaTest={0.5} side={THREE.DoubleSide} /></mesh>;
}

// A "!" over something (a foe that's seen you, a cage you can open), bobbing; popping up from `pop` (ms).
const MARK = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t || typeof document === "undefined") return t;
    const c = document.createElement("canvas");
    c.width = 32; c.height = 48;
    const g = c.getContext("2d");
    if (!g) return null;
    g.font = "bold 44px sans-serif"; g.textAlign = "center"; g.textBaseline = "bottom";
    g.lineWidth = 5; g.strokeStyle = "#1a0e05"; g.fillStyle = "#ffd23f";
    g.strokeText("!", 16, 46); g.fillText("!", 16, 46);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();
function Mark({ at, up, pop }: { at: () => { x: number; y: number }; up: number; pop?: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = mesh.current, p = at(), now = performance.now();
    if (!m) return;
    const k = pop === undefined ? 1 : Math.min(1, (now - pop) / 150);
    m.position.set(p.x, up + 0.12 * Math.abs(Math.sin(now / (pop === undefined ? 200 : 120))), p.y + 0.1);
    m.scale.set(0.35 * k, 0.52 * k, 1);
  });
  return <mesh ref={mesh} raycast={() => null} renderOrder={2}><planeGeometry /><meshBasicMaterial map={MARK()} transparent depthTest={false} /></mesh>;
}

// Rubble where a tunnel fell in (the 2D view's: five stones a tile, a little into the room), falling in
// from above as it happens; then the sim forgets the fall (as the 2D view's `settled`).
function RubbleHeap({ sim, r, shade }: { sim: WalkSim; r: Rubble; shade?: (x: number, y: number) => THREE.Color }) {
  const group = useRef<THREE.Group>(null);
  const into = r.wall === "top" ? 0.7 : -0.7; // (out in front of the rock it left)
  useFrame(() => {
    const fell = sim.falls.get(r.key), age = fell === undefined ? Infinity : (performance.now() - fell) / 1000;
    if (age > DUST_TIME && fell !== undefined) sim.falls.delete(r.key);
    if (group.current) group.current.position.y = age < FALL_TIME ? (1 - age / FALL_TIME) ** 2 * RUBBLE.drop : 0;
  });
  return (
    <group ref={group}>
      {r.tiles.flatMap((q) => Array.from({ length: 5 }, (_, k) => {
        const rx = ((q.x * 7 + q.y * 13 + k * 29) % 10) / 10 - 0.5, ry = ((q.x * 11 + q.y * 5 + k * 17) % 10) / 10 - 0.5;
        const c = new THREE.Color(RUBBLE.colours[k % 3]);
        if (shade) c.multiply(shade(q.x, q.y + into));
        const s = RUBBLE.size + 0.05 * (k % 2);
        return (
          <mesh key={`${q.x},${q.y},${k}`} raycast={() => null} position={[q.x + rx * 0.8, s * 0.5 * (1 + k * 0.15), q.y + into + ry * 0.5]} scale={[s, s * 0.7, s * 0.75]}>
            <icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color={c} />
          </mesh>
        );
      }))}
    </group>
  );
}

// ── 🧪 The grey experiment: the dungeon carved out of solid rock (lib/render3d/dungeon3d.ts) ──
const GREY = { floor: 0.34, floorAlt: 0.3, rock: 0.62, rim: 0.46 };   // 🧪 flat greys: floor (a faint checker, to show foreshortening), rock, and the lowered south rim's top (darker, so it reads as a step down)
const GREY_LIGHT = { ambient: 0.55, sun: 0.9, from: [3.5, 10, 7] as [number, number, number] }; // 🧪 one plain light, from above and a little south-east, so tops, north faces and each side face read as different values

// The carved rock's mesh, built from what you've seen (again as you see more, 4 times a second at
// most: about 12 ms a Labyrinth). Only the picture: the sim still walks, sees and lights by the
// floorplan, whatever shows here. `paint`: colours a vertex (the grey mode's), if the mode wants them.
// (A tunnel up's top door, seen from above, shows shut: dungeon3d.ts oneWayDoors.)
function useCarved(sim: WalkSim, live: WalkSim["live"], layout: Layout, view: View3D, paint?: (m: CarvedMesh, lit: Uint8Array | null) => Float32Array): THREE.BufferGeometry | null {
  const build = (plugs: Set<number>) => {
    const known = (i: number) => view.unseen === "shown" || sim.known[i] === 1;
    const h = rockHeights(live, (i) => live.tiles[i] !== 0 && !plugs.has(i) && (view.unseen !== "rock" || known(i)), view.wall, view.south === "low");
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
  const last = useRef({ key: "", at: -Infinity, live, doors: "" });
  useFrame(() => {
    const now = performance.now(), key = `${sim.known.reduce((n, k) => n + k, 0)}|${view.wall}|${view.south}|${view.unseen}`;
    const shut = oneWayDoors(layout, live, sim.me, roomAt(sim.plan, sim.me)), doors = shut.map((d) => d.key).join();
    if ((key !== last.current.key && now - last.current.at > 250) || live !== last.current.live || doors !== last.current.doors) {
      last.current = { key, at: now, live, doors };
      setGeo(build(new Set(shut.flatMap((d) => d.tiles.map((q) => q.y * live.w + q.x)))));
    }
  });
  return geo;
}
// The lean, in the vertex shader: a point moves outwards by lean × its height × how far across from you it is.
const LEAN = "transformed.x += uLean * (transformed.x - uCx) * transformed.y;";

function GreyRock({ sim, live, layout, view }: { sim: WalkSim; live: WalkSim["live"]; layout: Layout; view: View3D }) {
  const uni = useRef({ uLean: { value: 0 }, uCx: { value: 0 } });
  const mat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni.current);
      sh.vertexShader = "uniform float uLean;\nuniform float uCx;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${LEAN}`);
    };
    return m;
  }, []);
  const geo = useCarved(sim, live, layout, view, (m, lit) => {
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
  return <mesh geometry={geo} material={mat} raycast={() => null} />;
}

// ── 🧪 Stone: the carved rock with flat stand-in textures, lit from the sim's light reach (lib/render3d/stone.ts) ──
// No Three.js lights: one shader reads the light grid (your torch's and the other lights', a subcell
// apart, never through rock) and what you've seen, and shades each surface by which way it faces.
// Light multiplies the art (warm where it's lit, a plain dim where you only remember); nothing is
// added over the picture, so no wash or haze.
const CLOSED_DIM = 0.4; // a room cut off behind you shows this bright (the 2D view's dimming)
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

function StoneRock({ sim, live, layout, view, closed, frame, centre, fieldRef, fadeRef }: {
  sim: WalkSim; live: WalkSim["live"]; layout: Layout; view: View3D; closed: Uint8Array; frame: React.RefObject<Frame | null>;
  centre: React.RefObject<{ x: number; z: number }>; fieldRef: React.RefObject<LightField | null>; fadeRef: React.RefObject<Float32Array | null>;
}) {
  const geo = useCarved(sim, live, layout, view);
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
      const lights = litLights(sim, live, frame.current).map((l, i) => ({ ...l, power: STONE.fire * (0.93 + 0.07 * Math.sin(now / 90 + i)) }));
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
      // Rooms cut off behind you, dimmed (as the 2D view's).
      if (closed.length === s.fade.length) for (let i = 0; i < closed.length; i++) if (closed[i]) s.fade[i] *= CLOSED_DIM;
      fillGrid(tex.seen, s.fade, s.shown);
      fadeRef.current = s.fade;
    }
  });
  if (!geo) return null;
  return <mesh ref={mesh} geometry={geo} raycast={() => null} />;
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

// The light's colour where a sprite stands (Stone), as the floor under it (stone.ts shadeAt).
function stoneShade(f: LightField | null, fade: Float32Array | null, w: number, x: number, y: number): THREE.Color {
  const [r, g, b] = shadeAt(f, fade, w, x, y, STONE);
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
}
