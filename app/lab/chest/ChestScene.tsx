"use client";
// app/lab/chest/ChestScene.tsx — 🧪 the 3D chest draft (lib/render3d/chest3d.ts) on a patch of the
// game's floor under its camera: orthographic, facing north, 60° down, art pixels at 48 a unit
// (decision 37). The wood, iron and gold are plain stand-ins made here (planks and noise, no
// detail): the real surfaces would be flat PixelLab art laid on the same boxes. Lit with a warm
// torch light you can send round it, and a dim ambient, not yet the game's own light.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { chestParts, OPEN_ANGLE, type Box, type ChestMat } from "@/lib/render3d/chest3d";
import { pixelScale } from "@/lib/render3d/stone";
import { uprightStretch, WALL_HEIGHT } from "@/lib/render3d/dungeon3d";
import { WALK_KIT, WALK_HERO, KIT_PX } from "@/lib/sprites/walk";
import { legacyU } from "@/lib/render/projection";

const PITCH = Math.PI / 3;
const ART_PER_U = 48;
const OLD_W = legacyU(28); // the flat chest as the game draws it now (OBJECT_U)

export type ChestView = { open: boolean; across: number; width: number; moving: boolean; old: boolean };

// Stand-in surfaces, a unit of art (48 px) each, repeated across the boxes.
function standIn(mat: ChestMat): THREE.Texture {
  const n = ART_PER_U, data = new Uint8Array(n * n * 4);
  let s = 7 + mat.length * 31;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const base: Record<ChestMat, [number, number, number]> = { wood: [78, 74, 76], iron: [44, 46, 52], gold: [214, 168, 62], inside: [24, 20, 20] };
  const plank = Array.from({ length: 4 }, () => 0.85 + rand() * 0.25);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let k = 0.9 + rand() * 0.15;
    if (mat === "wood") { k *= plank[Math.floor(y / 12)]; if (y % 12 === 0) k *= 0.45; else if (y % 12 === 1) k *= 1.12; if (rand() < 0.04) k *= 0.8; }
    if (mat === "iron" && y % 24 === 1) k *= 1.35;
    if (mat === "gold" && rand() < 0.08) k *= 1.3;
    const [r, g, b] = base[mat], i = (y * n + x) * 4;
    data[i] = Math.min(255, r * k); data[i + 1] = Math.min(255, g * k); data[i + 2] = Math.min(255, b * k); data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function loaded(src: string, repeat = false): THREE.Texture {
  const t = new THREE.TextureLoader().load(src);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A box whose texture is laid by size, a unit of art to a unit (so every face has the same density),
// and by height, so planks line up across boxes side by side.
function boxGeometry(b: Box): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(b.w, b.h, b.d), uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const size: [number, number][] = [[b.d, b.h], [b.d, b.h], [b.w, b.d], [b.w, b.d], [b.w, b.h], [b.w, b.h]];
  for (let face = 0; face < 6; face++) for (let k = 0; k < 4; k++) {
    const i = face * 4 + k, [su, sv] = size[face], upright = face < 2 || face > 3;
    uv.setXY(i, uv.getX(i) * su + b.x, uv.getY(i) * sv + (upright ? b.y - b.h / 2 : b.z));
  }
  return g;
}

function Parts({ boxes, mats }: { boxes: Box[]; mats: Record<ChestMat, THREE.Material> }) {
  const geos = useMemo(() => boxes.map(boxGeometry), [boxes]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return <>{boxes.map((b, i) => <mesh key={i} geometry={geos[i]} material={mats[b.mat]} position={[b.x, b.y, b.z]} />)}</>;
}

function Scene({ view }: { view: ChestView }) {
  const { size, setDpr } = useThree();
  const pix = pixelScale("art", ART_PER_U, view.across, size.width, window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);

  const chest = useMemo(() => chestParts(view.width), [view.width]);
  const mats = useMemo(() => {
    const m = {} as Record<ChestMat, THREE.Material>;
    for (const k of ["wood", "iron", "gold", "inside"] as ChestMat[]) m[k] = new THREE.MeshLambertMaterial({ map: standIn(k) });
    return m;
  }, []);
  const floor = useMemo(() => { const t = loaded(WALK_KIT.floor, true); t.repeat.set(9, 7); return t; }, []);
  const wall = useMemo(() => {
    const t = loaded(WALK_KIT.north, true);
    t.repeat.set(9, (WALK_KIT.size.north - WALK_KIT.size.cap) / WALK_KIT.size.north);
    return t;
  }, []);
  const cap = useMemo(() => { const t = loaded(WALK_KIT.cap, true); t.repeat.set(9, 2); return t; }, []);
  const hero = useMemo(() => {
    const t = loaded(WALK_HERO.sheet), cols = WALK_HERO.frames > 0 ? WALK_HERO.frames + 1 : 1;
    t.repeat.set(1 / cols, 1 / 4); t.offset.set(0, 3 / 4); // standing, facing south
    return t;
  }, []);
  const old = useMemo(() => [loaded("/sprites/props/treasure_chest.png"), loaded("/sprites/props/treasure_chest_open.png")], []);

  const lid = useRef<THREE.Group>(null);
  const torch = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera;
    const target = new THREE.Vector3(0, 0.3, 0);
    camera.position.copy(target).addScaledVector(new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)), 60);
    camera.zoom = size.width / pix.across;
    camera.near = 0.1; camera.far = 200;
    camera.lookAt(target); camera.updateProjectionMatrix();
    // The lid swings to where it's going, a little at a time.
    if (lid.current) {
      const want = view.open ? -OPEN_ANGLE : 0, a = lid.current.rotation.x;
      lid.current.rotation.x = a + (want - a) * 0.15;
    }
    // The torch: still, front left and up as yours would be; or carried round the chest.
    if (torch.current) {
      const t = view.moving ? state.clock.elapsedTime / 2.5 : 2.3;
      torch.current.position.set(Math.cos(t) * 1.6, 1.8, Math.sin(t) * 1.2 + 0.3);
    }
  });

  // You, for scale, sized as the game sizes you (WalkView3D), standing on your feet.
  const stretch = uprightStretch(PITCH), heroW = WALK_HERO.cell / KIT_PX, heroH = heroW * stretch, below = (1 - WALK_HERO.feet / WALK_HERO.cell) * heroH;
  return (
    <>
      <ambientLight color="#9aa6c8" intensity={0.55} />
      <pointLight ref={torch} color="#ffc68a" intensity={9} distance={0} decay={1.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.5]}>
        <planeGeometry args={[9, 7]} />
        <meshLambertMaterial map={floor} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, -3]}>
        <boxGeometry args={[9, WALL_HEIGHT, 2]} />
        <meshLambertMaterial attach="material-0" color="#222" />
        <meshLambertMaterial attach="material-1" color="#222" />
        <meshLambertMaterial attach="material-2" map={cap} />
        <meshLambertMaterial attach="material-3" color="#222" />
        <meshLambertMaterial attach="material-4" map={wall} />
        <meshLambertMaterial attach="material-5" color="#222" />
      </mesh>
      <group position={[view.old ? -0.9 : 0, 0, 0]}>
        <Parts boxes={chest.body} mats={mats} />
        <group ref={lid} position={[0, chest.hinge.y, chest.hinge.z]}>
          <Parts boxes={chest.lid} mats={mats} />
        </group>
      </group>
      {view.old && (
        <mesh position={[1.3, (OLD_W * stretch) / 2, 0.4]} scale={[OLD_W, OLD_W * stretch, 1]}>
          <planeGeometry />
          <meshLambertMaterial map={old[view.open ? 1 : 0]} alphaTest={0.5} transparent />
        </mesh>
      )}
      <mesh position={[view.old ? -2.4 : -1.6, heroH / 2 - below, 0.6]} scale={[heroW, heroH, 1]}>
        <planeGeometry />
        <meshLambertMaterial map={hero} alphaTest={0.5} />
      </mesh>
    </>
  );
}

export default function ChestScene({ view }: { view: ChestView }) {
  return (
    <Canvas orthographic flat gl={{ antialias: false }} style={{ imageRendering: "pixelated", background: "#000" }}>
      <Scene view={view} />
    </Canvas>
  );
}
