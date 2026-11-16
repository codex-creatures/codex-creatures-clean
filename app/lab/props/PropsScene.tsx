"use client";
// app/lab/props/PropsScene.tsx — 🧪 every 3D thing you can find in the Labyrinth, on the dungeon's floor under
// the game's camera (orthographic, 60° down, art pixels at 48 a unit), drawn with the game's own models
// (components/Props3D.tsx, Decor3D.tsx; the standing torch as WalkView3D stands it up). Lit by a warm torch
// over whichever one you're looking at, and a dim ambient. Nothing is saved, and the game doesn't use it.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { uprightStretch, WALL_HEIGHT } from "@/lib/render3d/dungeon3d";
import { pixelScale } from "@/lib/render3d/stone";
import { WALK_KIT, WALK_STANDING_TORCH, STANDING_TORCH_U, STANDING_TORCH_FLAME } from "@/lib/sprites/walk";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { DYNAMITE_GLOW } from "@/lib/render3d/props3d";
import { Prop3D, Crate, Barrel, Campfire, HealingGem, Glow, loaded, PROP_LEAN } from "@/components/Props3D";
import { Decor3D } from "@/components/Decor3D";

const PITCH = Math.PI / 3;
const ART_PER_U = 48;
const COLS = 5, GAP_X = 2.6, GAP_Z = 2.6;
export type PropEntry = { id: string; name: string; where: string };
// Every one, in the order they're laid out (row by row, COLS a row).
export const PROPS: PropEntry[] = [
  { id: "chest", name: "Treasure chest", where: "Chest rooms, mini bosses, the boss" },
  { id: "golden", name: "Golden chest", where: "1 in 10 mini bosses (a Gold Key opens it)" },
  { id: "stash", name: "Stash (sack)", where: "Stashes, by campfires" },
  { id: "store-crate", name: "Storehouse crate", where: "A storehouse's stores (searched)" },
  { id: "corner-crates", name: "Corner crates", where: "Rooms' corners (v17: searchable)" },
  { id: "barrels", name: "Barrels", where: "Rooms' corners, a storehouse" },
  { id: "pots", name: "Pots", where: "Rooms' corners (scenery)" },
  { id: "bookcase", name: "Bookcase", where: "Against rooms' walls, libraries" },
  { id: "broken", name: "Broken bookcase", where: "Libraries" },
  { id: "lectern", name: "Lectern", where: "Libraries" },
  { id: "table", name: "Table", where: "Rooms, now and then" },
  { id: "deck", name: "Deck of cards", where: "On a table, now and then" },
  { id: "cage", name: "Cage", where: "The Encampment's camp, encampment rooms" },
  { id: "dynamite", name: "Dynamite", where: "A storehouse's floor (glows till taken)" },
  { id: "campfire", name: "Campfire", where: "Campfire rooms" },
  { id: "gem", name: "Healing gem", where: "Pool rooms" },
  { id: "torch", name: "Standing torch", where: "The way to the boss" },
];
export const spotOf = (i: number) => ({ x: (i % COLS - (COLS - 1) / 2) * GAP_X, z: Math.floor(i / COLS) * GAP_Z });
const ROWS = Math.ceil(PROPS.length / COLS);

function StandingTorch() {
  const stretch = uprightStretch(PITCH), map = useMemo(() => loaded(WALK_STANDING_TORCH.src), []);
  const k = STANDING_TORCH_U / WALK_STANDING_TORCH.h, w = WALK_STANDING_TORCH.w * k, h = STANDING_TORCH_U * stretch, [fx, fy] = STANDING_TORCH_FLAME;
  return (<>
    <mesh position={[0, h / 2, 0.05]} scale={[w, h, 1]}><planeGeometry /><meshLambertMaterial map={map} alphaTest={0.5} transparent /></mesh>
    <mesh position={[-w / 2 + fx * k, h - fy * k * stretch + 0.08, 0.11]} scale={[0.1, 0.18, 1]}><planeGeometry /><meshBasicMaterial color="#ffd27a" /></mesh>
  </>);
}

function Piece({ id, open }: { id: string; open: boolean }) {
  const stretch = uprightStretch(PITCH);
  switch (id) {
    case "chest": return <Prop3D kind="chest" open={open} />;
    case "golden": return <Prop3D kind="chest" golden open={open} />;
    case "stash": return <Prop3D kind="stash" open={open} />;
    case "store-crate": return <Crate inside="materials" open={open} outline edges empty={open} />;
    case "corner-crates": return <Decor3D kind="crates" stretch={stretch} open={open} />;
    case "barrels": return <Decor3D kind="barrels" stretch={stretch} />;
    case "pots": return <Decor3D kind="pots" stretch={stretch} />;
    case "bookcase": return <Prop3D kind="bookcase" />;
    case "broken": return <Prop3D kind="bookcase" broken />;
    case "lectern": return <Decor3D kind="lectern" stretch={stretch} />;
    case "table": return <Prop3D kind="table" />;
    case "deck": return <Prop3D kind="table" deck glow={RARITY_COLORS.legendary.text} />;
    case "cage": return <Decor3D kind="cage" stretch={stretch} open={open} />;
    case "dynamite": return (<><Decor3D kind="dynamite" stretch={stretch} /><Glow colour={DYNAMITE_GLOW.colour} radius={DYNAMITE_GLOW.radius} strength={DYNAMITE_GLOW.strength} /></>);
    case "campfire": return <Campfire lit={!open} />;
    case "gem": return <HealingGem used={open} />;
    case "torch": return <StandingTorch />;
    default: return <Barrel stretch={stretch} />;
  }
}

function Scene({ at, all, open }: { at: number; all: boolean; open: boolean }) {
  const { size, setDpr } = useThree();
  const across = all ? COLS * GAP_X + 1 : 6;
  const pix = pixelScale("art", ART_PER_U, across, size.width, window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);
  const floor = useMemo(() => { const t = loaded(WALK_KIT.floor, true); t.repeat.set(COLS * 3, ROWS * 3 + 2); return t; }, []);
  const torch = useRef<THREE.PointLight>(null);
  const want = useRef(new THREE.Vector3());
  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera, s = spotOf(at);
    const mid = { x: 0, z: ((ROWS - 1) * GAP_Z) / 2 };
    want.current.set(all ? mid.x : s.x, 0.5, all ? mid.z : s.z);
    PROP_LEAN.uLean.value = 0;
    camera.position.copy(want.current).addScaledVector(new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)), 60);
    camera.zoom = size.width / across; camera.near = 0.1; camera.far = 200;
    camera.lookAt(want.current); camera.updateProjectionMatrix();
    if (torch.current) { const t = state.clock.elapsedTime; torch.current.position.set(s.x - 0.9, 1.8, s.z + 1.1); torch.current.intensity = 8 * (0.94 + 0.04 * Math.sin(t * 9)); }
  });
  return (
    <>
      <ambientLight color="#9aa6c8" intensity={all ? 1.1 : 0.55} />
      <pointLight ref={torch} color="#ffc68a" intensity={8} distance={0} decay={1.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ((ROWS - 1) * GAP_Z) / 2]}>
        <planeGeometry args={[COLS * GAP_X + 2, ROWS * GAP_Z + 2]} />
        <meshLambertMaterial map={floor} />
      </mesh>
      {/* A wall behind the first row, so the wall-height things read against one. */}
      <mesh position={[0, WALL_HEIGHT / 2, -1.6]}>
        <boxGeometry args={[COLS * GAP_X + 2, WALL_HEIGHT, 0.6]} />
        <meshLambertMaterial color="#2c2a24" />
      </mesh>
      {PROPS.map((p, i) => { const s = spotOf(i); return <group key={p.id} position={[s.x, 0, s.z]}><Piece id={p.id} open={open} /></group>; })}
    </>
  );
}

export default function PropsScene({ at, all, open }: { at: number; all: boolean; open: boolean }) {
  return (
    <Canvas orthographic flat gl={{ antialias: false }} style={{ imageRendering: "pixelated", background: "#0e0f0c" }}>
      <Scene at={at} all={all} open={open} />
    </Canvas>
  );
}
