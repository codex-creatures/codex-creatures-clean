"use client";
// app/lab/hero/HeroScene.tsx — 🧪 the draft 3D you (lib/render3d/hero3d.ts) beside the sprite the game
// draws now, on a patch of the game's floor under its camera (orthographic, facing north, 60° down,
// art pixels at 48 a unit), each walking the same path: a circle (every way round), back and forth on a
// diagonal (where the sprite used to flicker), or standing still. Lit by the 3D one's own torch and a
// dim ambient, as the chest lab is: not yet the game's own light.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { pixelScale } from "@/lib/render3d/stone";
import { uprightStretch, WALL_HEIGHT } from "@/lib/render3d/dungeon3d";
import { WALK_KIT, WALK_HERO, WALK_HERO8, KIT_PX } from "@/lib/sprites/walk";
import { FACINGS, FACINGS8, walkFrame, smoothHeading, turnTo, facing8, type Facing, type Facing8 } from "@/lib/dungeon/tileArt";
import { HERO_PARTS, HERO_COLOURS, PIVOTS, FLAME_AT, heroPose, turnToward, yawOf, type Limb } from "@/lib/render3d/hero3d";
import { Solid, leaned, loaded } from "@/components/Props3D";

const PITCH = Math.PI / 3;
const ART_PER_U = 48;
const PATCH = 17;
const SPEED = 2.2;                       // u a second (about the game's walk)
export type HeroPath = "circle" | "diagonal" | "still";
export type HeroView = { path: HeroPath; across: number; outline: boolean; sprite: boolean; model: boolean; eight: boolean };

// Where a walker is `t` seconds along a path round (cx, cz): the point, and which way it's going.
function along(path: HeroPath, t: number, cx: number): { x: number; z: number; dx: number; dz: number } {
  if (path === "circle") {
    const r = 1.6, a = (t * SPEED) / r;
    return { x: cx + Math.sin(a) * r, z: 0.6 + Math.cos(a) * r, dx: Math.cos(a), dz: -Math.sin(a) };
  }
  if (path === "diagonal") {
    const len = 3, s = (t * SPEED) % (2 * len), out = s < len, d = out ? s : 2 * len - s, k = Math.SQRT1_2;
    return { x: cx - 1 + d * k * 0.8, z: -0.4 + d * k * 0.8, dx: out ? k : -k, dz: out ? k : -k };
  }
  return { x: cx, z: 0.6, dx: 0, dz: 0 };
}

// Each box's own geometry, at its size (Solid outlines it a pixel bigger).
const GEOS = Object.fromEntries((Object.keys(HERO_PARTS) as Limb[]).map((l) => [l, HERO_PARTS[l].map((b) => new THREE.BoxGeometry(...b.size))])) as Record<Limb, THREE.BoxGeometry[]>;
function Model({ path, cx, outline, torch }: { path: HeroPath; cx: number; outline: boolean; torch: React.RefObject<THREE.PointLight | null> }) {
  const root = useRef<THREE.Group>(null), limbs = useRef<Partial<Record<Limb, THREE.Group | null>>>({});
  const mats = useMemo(() => Object.fromEntries(Object.entries(HERO_COLOURS).map(([k, c]) => [k, leaned(new THREE.MeshLambertMaterial({ color: c }))])) as Record<string, THREE.Material>, []);
  const glow = useMemo(() => Object.fromEntries(Object.entries(HERO_COLOURS).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c })])) as Record<string, THREE.Material>, []);
  const state = useRef({ yaw: 0, walked: 0, last: { x: NaN, z: NaN } });
  const flame = useMemo(() => new THREE.Vector3(), []);
  useFrame((st, dt) => {
    const g = root.current;
    if (!g) return;
    const p = along(path, st.clock.elapsedTime, cx), S = state.current;
    const moved = Number.isNaN(S.last.x) ? 0 : Math.hypot(p.x - S.last.x, p.z - S.last.z);
    S.last = { x: p.x, z: p.z }; S.walked += moved;
    const moving = path !== "still";
    if (moving) S.yaw = turnToward(S.yaw, yawOf(p.dx, p.dz), dt);
    const pose = heroPose(S.walked, moving);
    g.position.set(p.x, pose.bob, p.z);
    g.rotation.y = S.yaw;
    for (const l of Object.keys(PIVOTS) as Limb[]) limbs.current[l]?.rotation.set(pose.swing[l], 0, 0);
    // The torch's light, from its flame wherever the arm has it.
    const arm = limbs.current.armL;
    if (arm && torch.current) { arm.updateWorldMatrix(true, false); torch.current.position.copy(flame.set(...FLAME_AT).applyMatrix4(arm.matrixWorld)); }
  });
  const stretch = uprightStretch(PITCH);
  return (
    <group scale={[1, stretch, 1]}>
      <group ref={root}>
        {(Object.keys(PIVOTS) as Limb[]).map((l) => (
          <group key={l} ref={(g) => { limbs.current[l] = g; }} position={PIVOTS[l]}>
            {HERO_PARTS[l].map((b, i) => <Solid key={i} geometry={GEOS[l][i]} material={(b.glow ? glow : mats)[b.colour]} at={b.at} size={b.size} outline={outline && !b.glow} />)}
          </group>
        ))}
      </group>
    </group>
  );
}
// The sprite as the game draws it now: its sheet's row for the way it faces (turning as the game does,
// tileArt.ts turnTo) and its walk frame, standing upright and stretched.
function Sprite({ path, cx }: { path: HeroPath; cx: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const cols = WALK_HERO.frames > 0 ? WALK_HERO.frames + 1 : 1;
  const tex = useMemo(() => FACINGS.map((_, row) => Array.from({ length: cols }, (_, col) => {
    const t = loaded(WALK_HERO.sheet).clone();
    t.repeat.set(1 / cols, 1 / FACINGS.length); t.offset.set(col / cols, 1 - (row + 1) / FACINGS.length); t.needsUpdate = true;
    return t;
  })), [cols]);
  const state = useRef({ facing: "south" as Facing, heading: { x: 0, y: 1 }, walked: 0, last: { x: NaN, z: NaN } });
  const stretch = uprightStretch(PITCH), w = WALK_HERO.cell / KIT_PX, h = w * stretch, below = (1 - WALK_HERO.feet / WALK_HERO.cell) * h;
  useFrame((st) => {
    const m = mesh.current;
    if (!m) return;
    const p = along(path, st.clock.elapsedTime, cx), S = state.current;
    const dx = Number.isNaN(S.last.x) ? 0 : p.x - S.last.x, dz = Number.isNaN(S.last.z) ? 0 : p.z - S.last.z;
    S.last = { x: p.x, z: p.z }; S.walked += Math.hypot(dx, dz);
    S.heading = smoothHeading(S.heading, dx, dz); S.facing = turnTo(S.heading.x, S.heading.y, S.facing);
    const moving = path !== "still", col = cols > 1 ? walkFrame(S.walked, moving, WALK_HERO.frames) + 1 : 0;
    (m.material as THREE.MeshLambertMaterial).map = tex[FACINGS.indexOf(S.facing)][col];
    m.position.set(p.x, h / 2 - below, p.z + 0.05);
  });
  return <mesh ref={mesh} scale={[w, h, 1]}><planeGeometry /><meshLambertMaterial alphaTest={0.5} side={THREE.DoubleSide} /></mesh>;
}

// 🧪 The 8-way hero (the user, 2026-11-14: "wandering with your torch held out in front"): PixelLab
// character 67704aec (public/sprites/walk/hero-8, one still a way, no walk yet; in the game since 2026-11-14), drawn at the
// game's hero size (32 art pixels a unit, as today's), the nearest of its eight views to the way it's
// heading (tileArt.ts facing8).
const EIGHT = WALK_HERO8;
function Sprite8({ path, cx }: { path: HeroPath; cx: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => Object.fromEntries(FACINGS8.map((d) => [d, loaded(`${EIGHT.dir}/${d}.png`)])) as Record<Facing8, THREE.Texture>, []);
  const state = useRef({ facing: "south" as Facing8, heading: { x: 0, y: 1 }, last: { x: NaN, z: NaN } });
  const stretch = uprightStretch(PITCH), w = EIGHT.cell / KIT_PX, h = w * stretch, below = (1 - EIGHT.feet / EIGHT.cell) * h;
  useFrame((st) => {
    const m = mesh.current;
    if (!m) return;
    const p = along(path, st.clock.elapsedTime, cx), S = state.current;
    const dx = Number.isNaN(S.last.x) ? 0 : p.x - S.last.x, dz = Number.isNaN(S.last.z) ? 0 : p.z - S.last.z;
    S.last = { x: p.x, z: p.z };
    S.heading = smoothHeading(S.heading, dx, dz); S.facing = facing8(S.heading.x, S.heading.y, S.facing);
    (m.material as THREE.MeshLambertMaterial).map = tex[S.facing];
    m.position.set(p.x, h / 2 - below, p.z + 0.05);
  });
  return <mesh ref={mesh} scale={[w, h, 1]}><planeGeometry /><meshLambertMaterial map={tex.south} alphaTest={0.5} side={THREE.DoubleSide} /></mesh>;
}

function Scene({ view }: { view: HeroView }) {
  const { size, setDpr } = useThree();
  const pix = pixelScale("art", ART_PER_U, view.across, size.width, window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);
  const floor = useMemo(() => { const t = loaded(WALK_KIT.floor, true); t.repeat.set(PATCH, 9); return t; }, []);
  const wall = useMemo(() => {
    const face = loaded(WALK_KIT.north, true), cap = loaded(WALK_KIT.cap, true), dark = leaned(new THREE.MeshLambertMaterial({ color: "#222" }));
    face.repeat.set(PATCH, (WALK_KIT.size.north - WALK_KIT.size.cap) / WALK_KIT.size.north); cap.repeat.set(PATCH, 2);
    return [dark, dark, leaned(new THREE.MeshLambertMaterial({ map: cap })), dark, leaned(new THREE.MeshLambertMaterial({ map: face })), dark];
  }, []);
  const torch = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera, target = new THREE.Vector3(0, 0.3, 0.5);
    camera.position.copy(target).addScaledVector(new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)), 60);
    camera.zoom = size.width / pix.across; camera.near = 0.1; camera.far = 200;
    camera.lookAt(target); camera.updateProjectionMatrix();
    if (torch.current) torch.current.intensity = 9 * (0.93 + 0.07 * Math.sin(state.clock.elapsedTime * 11));
  });
  // Side by side, whichever are shown.
  const shown = (["eight", "model", "sprite"] as const).filter((k) => view[k]);
  const spot = (k: (typeof shown)[number]) => (shown.length === 1 ? 0 : (shown.indexOf(k) - (shown.length - 1) / 2) * (shown.length === 3 ? 4.2 : 4.8));
  return (
    <>
      <ambientLight color="#9aa6c8" intensity={1.1} />
      <pointLight ref={torch} color="#ffc68a" intensity={9} distance={0} decay={1.6} position={[0, 1.8, 1]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.5]}><planeGeometry args={[PATCH, 9]} /><meshLambertMaterial map={floor} /></mesh>
      <mesh position={[0, WALL_HEIGHT / 2, -4]} material={wall}><boxGeometry args={[PATCH, WALL_HEIGHT, 2]} /></mesh>
      {view.eight && <Sprite8 path={view.path} cx={spot("eight")} />}
      {view.model && <Model path={view.path} cx={spot("model")} outline={view.outline} torch={torch} />}
      {view.sprite && <Sprite path={view.path} cx={spot("sprite")} />}
    </>
  );
}

export default function HeroScene({ view }: { view: HeroView }) {
  return (
    <Canvas orthographic flat gl={{ antialias: false }} style={{ imageRendering: "pixelated", background: "#000" }}>
      <Scene view={view} />
    </Canvas>
  );
}
