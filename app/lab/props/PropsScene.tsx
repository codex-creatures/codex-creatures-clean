"use client";
// app/lab/props/PropsScene.tsx — 🧪 every 3D thing you can find in the Labyrinth, on the dungeon's floor under
// the game's camera (orthographic, 60° down, art pixels at 48 a unit), drawn with the game's own models
// (components/Props3D.tsx, Decor3D.tsx; the standing torch as WalkView3D stands it up). Lit by a warm torch
// over whichever one you're looking at, and a dim ambient. Or walk round them as the game's torchbearer
// (WALK_HERO8, sized as WalkView3D sizes you), the torch you carry lighting what's near. Nothing is saved, and
// the game doesn't use it.

import { useEffect, useMemo, useRef } from "react";
import { COLS, GAP_X, GAP_Z, PROPS, REACH, ROWS, spotOf, WALK_INPUT, FOLLOW } from "./props";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { uprightStretch, WALL_HEIGHT } from "@/lib/render3d/dungeon3d";
import { pixelScale } from "@/lib/render3d/stone";
import { WALK_KIT, WALK_STANDING_TORCH, STANDING_TORCH_U, STANDING_TORCH_FLAME, WALK_HERO8, KIT_PX } from "@/lib/sprites/walk";
import { FACINGS8, facing8, type Facing8 } from "@/lib/dungeon/tileArt";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { DYNAMITE_GLOW } from "@/lib/render3d/props3d";
import { Prop3D, Crate, Barrel, Campfire, HealingGem, Glow, loaded, PROP_LEAN } from "@/components/Props3D";
import { Decor3D } from "@/components/Decor3D";

const PITCH = Math.PI / 3;
const ART_PER_U = 48;

const SPEED = 2.2;        // u a second, walking
const BODY = 0.28;        // u: your own reach, round your feet (on top of each prop's REACH)
const NEAR = 1.4;         // u: close enough to name it
// Where you can walk: the floor laid down, a little in from its edges.
const BOUNDS = { x0: -(COLS * GAP_X) / 2, x1: (COLS * GAP_X) / 2, z0: -0.9, z1: (ROWS - 1) * GAP_Z + 1.2 };

// You: the 8-way hero's still for the way you're heading, standing on your feet, the torch's light on you.
function Hero({ onNear }: { onNear: (i: number | null) => void }) {
  const stretch = uprightStretch(PITCH), w = WALK_HERO8.cell / KIT_PX, h = w * stretch, below = (1 - WALK_HERO8.feet / WALK_HERO8.cell) * h;
  const tex = useMemo(() => Object.fromEntries(FACINGS8.map((d) => [d, loaded(`${WALK_HERO8.dir}/${d}.png`)])) as Record<Facing8, THREE.Texture>, []);
  const mat = useRef<THREE.MeshBasicMaterial>(null), mesh = useRef<THREE.Mesh>(null), light = useRef<THREE.PointLight>(null);
  const me = useRef({ x: 0, z: BOUNDS.z1 - 0.3, f: "north" as Facing8, near: null as number | null });
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current.add(e.key.toLowerCase()); if (e.key.startsWith("Arrow")) e.preventDefault(); };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useFrame((state, dt) => {
    const k = keys.current, inp = WALK_INPUT, m = me.current;
    if (inp.jump !== null) { const s = spotOf(inp.jump); m.x = s.x; m.z = s.z + 1.1; m.f = "north"; inp.jump = null; inp.target = null; }
    let dx = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
    let dz = (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0);
    if (inp.push) { dx = inp.push.x; dz = inp.push.y; }
    if (dx || dz) inp.target = null;
    else if (inp.target) { const tx = inp.target.x - m.x, tz = inp.target.z - m.z, d = Math.hypot(tx, tz); if (d < 0.08) inp.target = null; else { dx = tx / d; dz = tz / d; } }
    const len = Math.hypot(dx, dz);
    if (len > 0.1) {
      const n = Math.min(1, len), step = Math.min(0.05, dt) * SPEED * n;
      let x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, m.x + (dx / len) * step)), z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, m.z + (dz / len) * step));
      // Not into a prop: out of its reach (a box round it, yours added), by the shorter way out.
      for (let i = 0; i < PROPS.length; i++) {
        const s = spotOf(i), [rx, rz] = REACH[PROPS[i].id] ?? [0.5, 0.5], ax = rx + BODY, az = rz + BODY, ox = x - s.x, oz = z - s.z;
        if (Math.abs(ox) >= ax || Math.abs(oz) >= az) continue;
        if (ax - Math.abs(ox) < az - Math.abs(oz)) x = s.x + Math.sign(ox || 1) * ax; else z = s.z + Math.sign(oz || 1) * az;
      }
      m.x = x; m.z = z; m.f = facing8(dx, dz, m.f);
    }
    if (mesh.current) mesh.current.position.set(m.x, h / 2 - below, m.z + 0.05);
    if (mat.current && mat.current.map !== tex[m.f]) { mat.current.map = tex[m.f]; mat.current.needsUpdate = true; }
    if (light.current) { const t = state.clock.elapsedTime; light.current.position.set(m.x + 0.3, 1.6, m.z + 0.4); light.current.intensity = 8 * (0.93 + 0.05 * Math.sin(t * 9) + 0.02 * Math.sin(t * 23)); }
    // The nearest prop in reach, named under the view.
    let best: number | null = null, bd = NEAR;
    for (let i = 0; i < PROPS.length; i++) { const s = spotOf(i), d = Math.hypot(s.x - m.x, s.z - m.z); if (d < bd) { bd = d; best = i; } }
    if (best !== m.near) { m.near = best; onNear(best); }
    FOLLOW.x = m.x; FOLLOW.z = m.z; FOLLOW.set = true;
  });
  return (<>
    <mesh ref={mesh} scale={[w, h, 1]}><planeGeometry /><meshBasicMaterial ref={mat} map={tex.north} alphaTest={0.5} transparent /></mesh>
    <pointLight ref={light} color="#ffc68a" intensity={8} distance={0} decay={1.6} />
  </>);
}

function StandingTorch() {
  const stretch = uprightStretch(PITCH), map = useMemo(() => loaded(WALK_STANDING_TORCH.src), []);
  const k = STANDING_TORCH_U / WALK_STANDING_TORCH.h, w = WALK_STANDING_TORCH.w * k, h = STANDING_TORCH_U * stretch, [fx, fy] = STANDING_TORCH_FLAME;
  return (<>
    <mesh position={[0, h / 2, 0.05]} scale={[w, h, 1]}><planeGeometry /><meshLambertMaterial map={map} alphaTest={0.5} transparent /></mesh>
    <mesh position={[-w / 2 + fx * k, h - fy * k * stretch + 0.08, 0.11]} scale={[0.1, 0.18, 1]}><planeGeometry /><meshBasicMaterial color="#ffd27a" /></mesh>
    <pointLight position={[0, h + 0.1, 0.25]} color="#ffbe5a" intensity={4} distance={0} decay={1.6} />
  </>);
}

function Piece({ id, open }: { id: string; open: boolean }) {
  const stretch = uprightStretch(PITCH);
  switch (id) {
    case "chest": return <Prop3D kind="chest" open={open} />;
    case "golden": return <Prop3D kind="chest" golden open={open} />;
    case "stash": return <Prop3D kind="stash" open={open} />;
    case "money": return <Prop3D kind="stash" money open={open} />;
    case "store-crate": return <Crate inside="materials" open={open} outline edges empty={open} />;
    case "corner-crates": return <Decor3D kind="crates" stretch={stretch} open={open} />;
    case "stacked-crates": return <Decor3D kind="stack" stretch={stretch} open={open} />;
    case "barrel": return <Decor3D kind="barrel" stretch={stretch} />;
    case "barrels": return <Decor3D kind="barrels" stretch={stretch} />;
    case "pots": return <Decor3D kind="pots" stretch={stretch} />;
    case "bookcase": return <Prop3D kind="bookcase" />;
    case "broken": return <Prop3D kind="bookcase" broken />;
    case "lectern": return <Decor3D kind="lectern" stretch={stretch} />;
    case "table": return <Prop3D kind="table" />;
    case "deck": return <Prop3D kind="table" deck glow={RARITY_COLORS.legendary.text} />;
    case "cage": return <Decor3D kind="cage" stretch={stretch} open={open} />;
    case "dynamite": return (<><Decor3D kind="dynamite" stretch={stretch} /><Glow colour={DYNAMITE_GLOW.colour} radius={DYNAMITE_GLOW.radius} strength={DYNAMITE_GLOW.strength} /></>);
    case "campfire": return (<><Campfire lit={!open} />{!open && <pointLight position={[0, 0.6, 0.2]} color="#ff9632" intensity={5} distance={0} decay={1.6} />}</>);
    case "gem": return <HealingGem used={open} />;
    case "torch": return <StandingTorch />;
    default: return <Barrel stretch={stretch} />;
  }
}

function Scene({ at, all, open, walk, onNear }: { at: number; all: boolean; open: boolean; walk: boolean; onNear: (i: number | null) => void }) {
  const { size, setDpr } = useThree();
  const across = walk ? 9 : all ? COLS * GAP_X + 1 : 6;
  const pix = pixelScale("art", ART_PER_U, across, size.width, window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);
  const floor = useMemo(() => { const t = loaded(WALK_KIT.floor, true); t.repeat.set(COLS * 3, ROWS * 3 + 2); return t; }, []);
  const torch = useRef<THREE.PointLight>(null);
  const want = useRef(new THREE.Vector3());
  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera, s = spotOf(at);
    const mid = { x: 0, z: ((ROWS - 1) * GAP_Z) / 2 };
    if (walk && FOLLOW.set) want.current.set(FOLLOW.x, 0.5, FOLLOW.z - 0.4); else want.current.set(all ? mid.x : s.x, 0.5, all ? mid.z : s.z);
    PROP_LEAN.uLean.value = 0;
    camera.position.copy(want.current).addScaledVector(new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)), 60);
    camera.zoom = size.width / across; camera.near = 0.1; camera.far = 200;
    camera.lookAt(want.current); camera.updateProjectionMatrix();
    if (torch.current && !walk) { const t = state.clock.elapsedTime; torch.current.position.set(s.x - 0.9, 1.8, s.z + 1.1); torch.current.intensity = 8 * (0.94 + 0.04 * Math.sin(t * 9)); }
  });
  return (
    <>
      <ambientLight color="#9aa6c8" intensity={all && !walk ? 1.1 : walk ? 0.35 : 0.55} />
      {!walk && <pointLight ref={torch} color="#ffc68a" intensity={8} distance={0} decay={1.6} />}
      {/* (Tap the floor to walk there.) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ((ROWS - 1) * GAP_Z) / 2]} onPointerDown={(e) => { if (walk) WALK_INPUT.target = { x: e.point.x, z: e.point.z }; }}>
        <planeGeometry args={[COLS * GAP_X + 2, ROWS * GAP_Z + 2]} />
        <meshLambertMaterial map={floor} />
      </mesh>
      {/* A wall behind the first row, so the wall-height things read against one. */}
      <mesh position={[0, WALL_HEIGHT / 2, -1.6]}>
        <boxGeometry args={[COLS * GAP_X + 2, WALL_HEIGHT, 0.6]} />
        <meshLambertMaterial color="#2c2a24" />
      </mesh>
      {PROPS.map((p, i) => { const s = spotOf(i); return <group key={p.id} position={[s.x, 0, s.z]}><Piece id={p.id} open={open} /></group>; })}
      {walk && <Hero onNear={onNear} />}
    </>
  );
}

export default function PropsScene({ at, all, open, walk, onNear }: { at: number; all: boolean; open: boolean; walk: boolean; onNear: (i: number | null) => void }) {
  return (
    <Canvas orthographic flat gl={{ antialias: false }} style={{ imageRendering: "pixelated", background: "#0e0f0c", touchAction: "none" }}>
      <Scene at={at} all={all} open={open} walk={walk} onNear={onNear} />
    </Canvas>
  );
}
