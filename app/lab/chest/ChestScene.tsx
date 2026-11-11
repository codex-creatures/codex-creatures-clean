"use client";
// app/lab/chest/ChestScene.tsx — 🧪 the 3D chest draft (lib/render3d/chest3d.ts) on a patch of the
// game's floor under its camera: orthographic, facing north, 60° down, art pixels at 48 a unit
// (decision 37). Two looks: "art", the body and lid as two boxes with PixelLab's flat faces on them
// (public/sprites/props/chest3d/), and "stand-in", the boxes of chestParts with plain planks and
// noise made here. Either can have a one-pixel dark outline round its shape (a black copy a pixel
// bigger, drawn inside out, as every sprite in the game has an outline) and its top edges a pixel
// lighter (where the corners catch the light). Lit with a warm torch light you can send round it, and
// a dim ambient, not yet the game's own light.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { chestParts, OPEN_ANGLE, type Box, type ChestMat } from "@/lib/render3d/chest3d";
import { pixelScale } from "@/lib/render3d/stone";
import { uprightStretch, WALL_HEIGHT } from "@/lib/render3d/dungeon3d";
import { WALK_KIT, WALK_HERO, KIT_PX, KIT_LIGHTS } from "@/lib/sprites/walk";
import { TABLE_ART, TABLE_TOP, OBJECT_U } from "@/lib/world/objects";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { Rarity } from "@/lib/types";
import { legacyU } from "@/lib/render/projection";
import { Prop3D, Solid, leaned, sharp, loaded, PROP_LEAN } from "@/components/Props3D";

const PITCH = Math.PI / 3;
const ART_PER_U = 48;
const OLD_W = legacyU(28);       // the flat chest as the game draws it now (OBJECT_U)
// The flat sprites as the game draws them now, beside each: picture, width (units) and height for width.
const OLD: Record<Thing3D, { shut: string; open: string; w: number; tall: number }> = {
  chest: { shut: "/sprites/props/treasure_chest.png", open: "/sprites/props/treasure_chest_open.png", w: OLD_W, tall: 1 },
  stash: { shut: "/sprites/props/burlap_sack.png", open: "/sprites/props/burlap_sack_open.png", w: legacyU(16), tall: 1 },
  bookcase: { shut: "/sprites/den/bookcase-2.png", open: "/sprites/den/bookcase-2.png", w: legacyU(30), tall: 86 / 76 },
  table: { shut: TABLE_ART.src, open: TABLE_ART.src, w: OBJECT_U * 0.8, tall: TABLE_ART.h / TABLE_ART.w },
  deck: { shut: "/sprites/props/card_deck.png", open: "/sprites/props/card_deck.png", w: OBJECT_U, tall: 58 / 55 },
};
const PATCH = 17;                // units of floor and wall across (the screen is 15 at game zoom)

export type ChestView = { open: boolean; across: number; width: number; moving: boolean; old: boolean; art: boolean; outline: boolean; edges: boolean;
  at: number; lean: boolean; thing: Thing3D; turned: boolean; candle: boolean; rarity: Rarity };
// table: a rickety table (a candle on it, or not); deck: the cards room's table, the deck on it glowing its rarest card's colour.
export type Thing3D = "chest" | "stash" | "bookcase" | "table" | "deck";

// The walls' lean (decision 36, WalkView3D's at GAME_VIEW's 0.03), on the chest and the wall here
// (Props3D's PROP_LEAN, about you at x = 0).
const LEAN_U = 0.03;

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
  sharp(t);
  t.needsUpdate = true;
  return t;
}

// A stand-in box, its texture laid a unit of art to a unit across and square on screen: upright faces
// cos(pitch) tighter up the face and tops sin(pitch) tighter front to back, as the game's walls are
// laid (decision 37), and by height, so planks line up across boxes side by side.
function boxGeometry(b: Box): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(b.w, b.h, b.d), uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const up = Math.cos(PITCH), top = Math.sin(PITCH);
  const size: [number, number][] = [[b.d, b.h * up], [b.d, b.h * up], [b.w, b.d * top], [b.w, b.d * top], [b.w, b.h * up], [b.w, b.h * up]];
  for (let face = 0; face < 6; face++) for (let k = 0; k < 4; k++) {
    const i = face * 4 + k, [su, sv] = size[face], upright = face < 2 || face > 3;
    uv.setXY(i, uv.getX(i) * su + b.x, uv.getY(i) * sv + (upright ? (b.y - b.h / 2) * up : b.z * top));
  }
  return g;
}

function StandIn({ boxes, mats, outline }: { boxes: Box[]; mats: Record<ChestMat, THREE.Material>; outline: boolean }) {
  const geos = useMemo(() => boxes.map(boxGeometry), [boxes]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return <>{boxes.map((b, i) => <Solid key={i} geometry={geos[i]} material={mats[b.mat]} at={[b.x, b.y, b.z]} size={[b.w, b.h, b.d]} outline={outline} />)}</>;
}

function Scene({ view }: { view: ChestView }) {
  const { size, setDpr } = useThree();
  const pix = pixelScale("art", ART_PER_U, view.across, size.width, window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);

  const chest = useMemo(() => chestParts(view.width), [view.width]);
  const mats = useMemo(() => {
    const m = {} as Record<ChestMat, THREE.Material>;
    for (const k of ["wood", "iron", "gold", "inside"] as ChestMat[]) m[k] = leaned(new THREE.MeshLambertMaterial({ map: standIn(k) }));
    return m;
  }, []);
  const floor = useMemo(() => { const t = loaded(WALK_KIT.floor, true); t.repeat.set(PATCH, 7); return t; }, []);
  const wall = useMemo(() => {
    const face = loaded(WALK_KIT.north, true), cap = loaded(WALK_KIT.cap, true), dark = leaned(new THREE.MeshLambertMaterial({ color: "#222" }));
    face.repeat.set(PATCH, (WALK_KIT.size.north - WALK_KIT.size.cap) / WALK_KIT.size.north); cap.repeat.set(PATCH, 2);
    return [dark, dark, leaned(new THREE.MeshLambertMaterial({ map: cap })), dark, leaned(new THREE.MeshLambertMaterial({ map: face })), dark];
  }, []);
  const hero = useMemo(() => {
    const t = loaded(WALK_HERO.sheet), cols = WALK_HERO.frames > 0 ? WALK_HERO.frames + 1 : 1;
    t.repeat.set(1 / cols, 1 / 4); t.offset.set(0, 3 / 4); // standing, facing south
    return t;
  }, []);
  const old = useMemo(() => Object.fromEntries((Object.keys(OLD) as Thing3D[]).map((k) => [k, [loaded(OLD[k].shut), loaded(OLD[k].open)]])) as Record<Thing3D, THREE.Texture[]>, []);

  // You stand in the middle (the camera's on you); the chest `at` units across, the old one as far the other way.
  const chestX = view.at || 1, oldX = -(view.at || 1.3);
  const lid = useRef<THREE.Group>(null);
  const torch = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera;
    const target = new THREE.Vector3(0, 0.3, 0.5);
    PROP_LEAN.uLean.value = view.lean ? LEAN_U : 0; PROP_LEAN.uCx.value = 0;
    camera.position.copy(target).addScaledVector(new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)), 60);
    camera.zoom = size.width / pix.across;
    camera.near = 0.1; camera.far = 200;
    camera.lookAt(target); camera.updateProjectionMatrix();
    // The stand-in's lid swings to where it's going, a little at a time (the painted one's does in Props3D).
    if (lid.current) {
      const want = view.open ? -OPEN_ANGLE : 0, a = lid.current.rotation.x;
      lid.current.rotation.x = a + (want - a) * 0.15;
    }
    // The torch: still, front left and up as yours would be; or carried round the chest.
    if (torch.current) {
      const t = view.moving ? state.clock.elapsedTime / 2.5 : 2.3;
      torch.current.position.set(chestX + Math.cos(t) * 1.6, 1.8, Math.sin(t) * 1.2 + 0.3);
    }
  });

  // You, for scale, sized as the game sizes you (WalkView3D), standing on your feet.
  const stretch = uprightStretch(PITCH), heroW = WALK_HERO.cell / KIT_PX, heroH = heroW * stretch, below = (1 - WALK_HERO.feet / WALK_HERO.cell) * heroH;
  const o = OLD[view.thing];
  return (
    <>
      <ambientLight color="#9aa6c8" intensity={0.55} />
      <pointLight ref={torch} color="#ffc68a" intensity={9} distance={0} decay={1.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.5]}>
        <planeGeometry args={[PATCH, 7]} />
        <meshLambertMaterial map={floor} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, -3]} material={wall}>
        <boxGeometry args={[PATCH, WALL_HEIGHT, 2]} />
      </mesh>
      <group position={[chestX, 0, 0]} rotation={[0, view.turned ? Math.PI / 2 : 0, 0]}>
        {view.thing === "chest" && !view.art
          ? (<>
            <StandIn boxes={chest.body} mats={mats} outline={view.outline} />
            <group ref={lid} position={[0, chest.hinge.y, chest.hinge.z]}><StandIn boxes={chest.lid} mats={mats} outline={view.outline} /></group>
          </>)
          : view.thing === "table" || view.thing === "deck"
            ? <Prop3D kind="table" outline={view.outline} deck={view.thing === "deck" && !view.open} glow={RARITY_COLORS[view.rarity].text} />
            : <Prop3D kind={view.thing} open={view.open} outline={view.outline} edges={view.edges} />}
      </group>
      {view.thing === "table" && view.candle && <TableCandle x={chestX} stretch={stretch} />}
      {view.old && (
        <mesh position={[oldX, (o.w * o.tall * stretch) / 2, 0.4]} scale={[o.w, o.w * o.tall * stretch, 1]}>
          <planeGeometry />
          <meshLambertMaterial map={old[view.thing][view.open ? 1 : 0]} alphaTest={0.5} transparent />
        </mesh>
      )}
      <mesh position={[0, heroH / 2 - below, 1.5]} scale={[heroW, heroH, 1]}>
        <planeGeometry />
        <meshLambertMaterial map={hero} alphaTest={0.5} />
      </mesh>
    </>
  );
}

// A candle on the table, lit, drawn as the game draws one (WalkView3D: the kit's candles, a flame on each
// wick, `high` up on the table's top), with a little warm light of its own here.
function TableCandle({ x, stretch }: { x: number; stretch: number }) {
  const tex = useMemo(() => loaded(KIT_LIGHTS.candles), []);
  const [cw, ch] = KIT_LIGHTS.candleSize, k = 0.85 / ART_PER_U, w = cw * k, h = ch * k * stretch, z = 0.05;
  return (
    <group position={[0, TABLE_TOP, 0]}>
      <mesh position={[x, h / 2, z]} scale={[w, h, 1]}><planeGeometry /><meshBasicMaterial map={tex} alphaTest={0.5} /></mesh>
      {KIT_LIGHTS.wicks.map(([wx, wy], i) => (
        <mesh key={i} position={[x - w / 2 + wx * k, h - wy * k * stretch + 0.04, z + 0.06]} scale={[0.05, 0.09, 1]}><planeGeometry /><meshBasicMaterial color="#ffd27a" /></mesh>
      ))}
      <pointLight color="#ffbe5a" intensity={3} distance={3} decay={1.6} position={[x, h + 0.2, z + 0.2]} />
    </group>
  );
}

export default function ChestScene({ view }: { view: ChestView }) {
  return (
    <Canvas orthographic flat gl={{ antialias: false }} style={{ imageRendering: "pixelated", background: "#000" }}>
      <Scene view={view} />
    </Canvas>
  );
}
