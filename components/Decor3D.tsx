"use client";
// components/Decor3D.tsx: 🧪 drafts (the user, 2026-11-16: "build 3D assets for the dungeon's props") of
// the things the 3D Labyrinth still draws as flat pictures: a room's corner decor (barrels, crates, a
// skull on its bones, a fallen pillar, a nest, pots) and a storehouse's finds (the dynamite, the
// backpack). Built as the chest, crate and barrel are: simple shapes made here, their surfaces PixelLab's
// (public/sprites/walk/samples/drafts/decor3d/), leaning as the rock does. Shown in /lab/art's 3D panel;
// the game doesn't use them till the user approves them.

import { useMemo } from "react";
import * as THREE from "three";
import { Barrel, Crate, Ring, leaned, loaded } from "./Props3D";

const D = "/sprites/walk/samples/drafts/decor3d";
export type Decor3DKind = "barrels" | "crates" | "skull" | "pillar" | "nest" | "pots" | "dynamite" | "backpack";

const lit = (o: THREE.MeshLambertMaterialParameters) => leaned(new THREE.MeshLambertMaterial(o));
const tex = (f: string, repeat?: [number, number]) => {
  if (!repeat) return loaded(`${D}/${f}`);
  const t = loaded(`${D}/${f}`, true).clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.needsUpdate = true;
  return t;
};

// Each one's size against the flat picture it replaces (the first drafts came out small beside them).
const SIZE: Partial<Record<Decor3DKind, number>> = { skull: 1.7, nest: 1.35, pots: 1.45, dynamite: 1.7, backpack: 1.5 };

export function Decor3D({ kind, stretch }: { kind: Decor3DKind; stretch: number }) {
  return <group scale={SIZE[kind] ?? 1}><Piece kind={kind} stretch={stretch} /></group>;
}
function Piece({ kind, stretch }: { kind: Decor3DKind; stretch: number }) {
  if (kind === "barrels") return (<>
    <group position={[-0.38, 0, 0]}><Barrel stretch={stretch} lid={`${D}/barrel-lid.png`} /></group>
    <group position={[0.38, 0, 0.06]} rotation={[0, 0.7, 0]}><Barrel stretch={stretch} lid={`${D}/barrel-lid.png`} /></group>
  </>);
  if (kind === "crates") return (<>
    <Crate inside="materials" open={false} outline edges />
    <group position={[0.1, 0.79, -0.05]} rotation={[0, 0.35, 0]} scale={0.8}><Crate inside="materials" open={false} outline edges /></group>
  </>);
  if (kind === "skull") return <Skull />;
  if (kind === "pillar") return <FallenPillar />;
  if (kind === "nest") return <Ring wide={0.8} tall={0.16} top={`${D}/nest-top.png`} rim={`${D}/nest-rim.png`} rimPx={[96, 28]} sides={14} />;
  if (kind === "pots") return <Pots />;
  if (kind === "dynamite") return <Dynamite />;
  return <Backpack />;
}

// A skull: a block of bone (its face painted on the front) sitting on a scatter of bones lying flat.
function Skull() {
  const m = useMemo(() => {
    const bone = lit({ color: "#cbc29a" });
    return { bones: lit({ map: tex("bones-floor.png"), transparent: true, alphaTest: 0.5 }), box: [bone, bone, bone, lit({ color: "#8a8466" }), lit({ map: tex("skull-face.png") }), bone] };
  }, []);
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} material={m.bones}><planeGeometry args={[0.85, 0.85]} /></mesh>
    <mesh position={[0.06, 0.13, 0.05]} rotation={[0, -0.3, 0]} material={m.box}><boxGeometry args={[0.24, 0.26, 0.26]} /></mesh>
  </>);
}

// A fallen pillar: a mossy stone column lying on its side, its broken ends showing.
function FallenPillar() {
  const R = 0.3, L = 1.2;
  const m = useMemo(() => { const end = lit({ map: tex("pillar-end.png"), transparent: true, alphaTest: 0.5 }); return [lit({ map: tex("pillar-side.png", [2, 1]) }), end, end]; }, []);
  return <mesh position={[0, R, 0]} rotation={[0, 0.25, Math.PI / 2]} material={m}><cylinderGeometry args={[R, R * 0.95, L, 14]} /></mesh>;
}

// Pots: three turned clay pots, a big one and two small.
const POT = (h: number, r: number) => {
  const pts = Array.from({ length: 11 }, (_, i) => { const y = (i / 10) * h; const k = Math.sin(Math.min(1, (y / h) * 1.15) * Math.PI); return new THREE.Vector2(r * (0.45 + 0.55 * k) + (y > h * 0.88 ? r * 0.12 : 0), y); });
  return new THREE.LatheGeometry(pts, 16);
};
function Pots() {
  const m = useMemo(() => ({ side: lit({ map: tex("pot-side.png", [2, 1]) }), top: lit({ map: tex("pot-top.png"), transparent: true, alphaTest: 0.5 }) }), []);
  const pots: [number, number, number, number][] = [[-0.12, -0.05, 0.42, 0.17], [0.2, 0.06, 0.28, 0.12], [0.02, 0.2, 0.24, 0.1]];
  return (<>{pots.map(([x, z, h, r], i) => (
    <group key={i} position={[x, 0, z]}>
      <mesh geometry={POT(h, r)} material={m.side} />
      <mesh position={[0, h + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.top}><circleGeometry args={[r * 0.6, 14]} /></mesh>
    </group>))}</>);
}

// The dynamite: three red paper sticks standing bound together, a fuse curling up out of the middle one.
function Dynamite() {
  const m = useMemo(() => ({ paper: lit({ map: tex("dynamite-paper.png", [0.34, 1]) }), end: lit({ color: "#7a1f1a" }), fuse: lit({ color: "#3a3226" }) }), []);
  const H = 0.36, r = 0.055;
  return (<>
    {[[-r * 1.05, 0], [r * 1.05, 0], [0, -r * 1.7]].map(([x, z], i) => (
      <mesh key={i} position={[x, H / 2, z]} material={[m.paper, m.end, m.end]}><cylinderGeometry args={[r, r, H, 10]} /></mesh>
    ))}
    <mesh position={[0.02, H + 0.07, -0.05]} rotation={[0, 0, -0.5]} material={m.fuse}><cylinderGeometry args={[0.008, 0.008, 0.16, 5]} /></mesh>
  </>);
}

// The backpack: a block of worn leather, its front the painted pack (flap, pockets, buckles, bedroll).
function Backpack() {
  const m = useMemo(() => { const leather = lit({ color: "#5e3d24" }); return [leather, leather, lit({ color: "#4a3020" }), leather, lit({ map: tex("backpack-front.png"), transparent: true, alphaTest: 0.5 }), leather]; }, []);
  return <mesh position={[0, 0.24, 0]} rotation={[0, -0.25, 0]} material={m}><boxGeometry args={[0.46, 0.48, 0.22]} /></mesh>;
}
