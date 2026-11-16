"use client";
// components/Decor3D.tsx: the dungeon's props in 3D (the user, 2026-11-16/17: "build 3D assets for the
// dungeon's props"), built as the chest, crate and barrel are: simple shapes made here, their surfaces
// PixelLab's, leaning as the rock does. In the game (✓, public/sprites/props/decor3d/ and lectern3d/): a
// pair of lidded barrels, stacked crates, clay pots, the dynamite, the librarian's lectern. Still drafts,
// for /lab/art only (public/sprites/walk/samples/drafts/decor3d/): the skull and the backpack, being redone.
// `colour` (the game's Stone): unlit, tinted by the light where it stands; without it, lit (the labs).

import { useMemo } from "react";
import * as THREE from "three";
import { Barrel, Crate, loaded, makeFlat, makeLit, bases, useTint, type Tint } from "./Props3D";
import { ART_PER_U, ART_PITCH } from "@/lib/render3d/chest3d";

const GAME = "/sprites/props/decor3d", DRAFT = "/sprites/walk/samples/drafts/decor3d";
export type Decor3DKind = "barrels" | "crates" | "pots" | "dynamite" | "lectern" | "skull" | "backpack" | "cage";
// Each one's size against the flat picture it replaces (the first drafts came out small beside them).
const SIZE: Partial<Record<Decor3DKind, number>> = { skull: 1.4, pots: 1.45, dynamite: 1.7, backpack: 1.75 };

const tex = (src: string, repeat?: [number, number]) => {
  if (!repeat) return loaded(src);
  const t = loaded(src, true).clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.needsUpdate = true;
  return t;
};
// The materials for one piece, lit or (colour) flat and tinted, kept following the light each frame.
// (`build` is each piece's own builder, made once at the top level, so it never changes.)
function useMats<T extends Record<string, THREE.Material | THREE.Material[]>>(build: (make: typeof makeLit) => T, colour?: Tint): T {
  const flat = !!colour;
  const m = useMemo(() => build(flat ? makeFlat : makeLit), [build, flat]);
  const all = useMemo(() => Object.values(m).flat(), [m]);
  useTint(all, useMemo(() => bases(all), [all]), colour);
  return m;
}
const see = (m: THREE.Material) => { m.transparent = true; m.alphaTest = 0.5; return m; };

// `open`: a searched corner crate (world version 17) stands open and bare.
export function Decor3D({ kind, stretch, colour, open = false }: { kind: Decor3DKind; stretch: number; colour?: Tint; open?: boolean }) {
  return <group scale={SIZE[kind] ?? 1}><Piece kind={kind} stretch={stretch} colour={colour} open={open} /></group>;
}
function Piece({ kind, stretch, colour, open }: { kind: Decor3DKind; stretch: number; colour?: Tint; open: boolean }) {
  if (kind === "barrels") return (<>
    <group position={[-0.38, 0, 0]}><Barrel stretch={stretch} lid={`${GAME}/barrel-lid.png`} colour={colour} /></group>
    <group position={[0.38, 0, 0.06]} rotation={[0, 0.7, 0]}><Barrel stretch={stretch} lid={`${GAME}/barrel-lid.png`} colour={colour} /></group>
  </>);
  if (kind === "crates") return open
    ? <Crate inside="materials" open colour={colour} outline edges empty />
    : (<>
      <Crate inside="materials" open={false} colour={colour} outline edges />
      <group position={[0.1, 0.79, -0.05]} rotation={[0, 0.35, 0]} scale={0.8}><Crate inside="materials" open={false} colour={colour} outline edges /></group>
    </>);
  if (kind === "pots") return <Pots colour={colour} />;
  if (kind === "dynamite") return <Dynamite colour={colour} />;
  if (kind === "lectern") return <Lectern colour={colour} />;
  if (kind === "skull") return <Skull colour={colour} />;
  if (kind === "cage") return <Cage colour={colour} open={open} />;
  return <Backpack colour={colour} />;
}

// Pots: three turned clay pots, a big one and two small (scenery: nothing in them).
const POT = (h: number, r: number) => {
  const pts = Array.from({ length: 11 }, (_, i) => { const y = (i / 10) * h; const k = Math.sin(Math.min(1, (y / h) * 1.15) * Math.PI); return new THREE.Vector2(r * (0.45 + 0.55 * k) + (y > h * 0.88 ? r * 0.12 : 0), y); });
  return new THREE.LatheGeometry(pts, 16);
};
const POTS: [number, number, number, number][] = [[-0.12, -0.05, 0.42, 0.17], [0.2, 0.06, 0.28, 0.12], [0.02, 0.2, 0.24, 0.1]];
const POTS_MATS = (make: typeof makeLit) => ({ side: make({ map: tex(`${GAME}/pot-side.png`, [2, 1]) }), top: see(make({ map: tex(`${GAME}/pot-top.png`) })) });
function Pots({ colour }: { colour?: Tint }) {
  const m = useMats(POTS_MATS, colour);
  return (<>{POTS.map(([x, z, h, r], i) => (
    <group key={i} position={[x, 0, z]}>
      <mesh geometry={POT(h, r)} material={m.side} raycast={() => null} />
      <mesh position={[0, h + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.top} raycast={() => null}><circleGeometry args={[r * 0.6, 14]} /></mesh>
    </group>))}</>);
}

// The dynamite: three red paper sticks standing bound together, a fuse curling up out of the middle one.
const DYNAMITE_MATS = (make: typeof makeLit) => ({ paper: make({ map: tex(`${GAME}/dynamite-paper.png`, [0.34, 1]) }), end: make({ color: "#7a1f1a" }), fuse: make({ color: "#3a3226" }) });
function Dynamite({ colour }: { colour?: Tint }) {
  const m = useMats(DYNAMITE_MATS, colour);
  const H = 0.36, r = 0.055;
  return (<>
    {[[-r * 1.05, 0], [r * 1.05, 0], [0, -r * 1.7]].map(([x, z], i) => (
      <mesh key={i} position={[x, H / 2, z]} material={[m.paper, m.end, m.end]} raycast={() => null}><cylinderGeometry args={[r, r, H, 10]} /></mesh>
    ))}
    <mesh position={[0.02, H + 0.07, -0.05]} rotation={[0, 0, -0.5]} material={m.fuse} raycast={() => null}><cylinderGeometry args={[0.008, 0.008, 0.16, 5]} /></mesh>
  </>);
}

// The lectern (approved from the chest lab's draft, 2026-11-17): a dark base, its post a picture on two
// crossed planes, and a sloping desk with its painted top.
const LECTERN_MATS = (make: typeof makeLit) => {
  const dark = make({ color: "#33271a" }), wood = make({ color: "#483522" });
  return { base: dark, post: see(make({ map: tex("/sprites/props/lectern3d/post.png"), side: THREE.DoubleSide })), desk: [dark, dark, make({ map: tex("/sprites/props/lectern3d/top.png") }), dark, wood, wood] };
};
function Lectern({ colour }: { colour?: Tint }) {
  const m = useMats(LECTERN_MATS, colour);
  const postH = (36 / (ART_PER_U * Math.cos(ART_PITCH))) * 0.55, deskD = 28 / (ART_PER_U * Math.sin(ART_PITCH));
  return (<>
    <mesh position={[0, 0.06, 0]} material={m.base} raycast={() => null}><boxGeometry args={[0.5, 0.12, 0.4]} /></mesh>
    {[0, Math.PI / 2].map((r) => (
      <mesh key={r} material={m.post} position={[0, 0.12 + postH / 2, 0]} rotation={[0, r, 0]} scale={[20 / ART_PER_U, postH, 1]} raycast={() => null}><planeGeometry /></mesh>
    ))}
    <mesh position={[0, 0.12 + postH + 0.05, 0]} rotation={[0.45, 0, 0]} material={m.desk} raycast={() => null}><boxGeometry args={[36 / ART_PER_U, 0.07, deskD]} /></mesh>
  </>);
}

// 🧪 Drafts (round 2, 2026-11-17): a skull on crossed bones, the backpack, the cage.

// A skull: a round cranium, its face painted on the front, a jaw, lying on two crossed bones (a shaft with
// a knuckle at each end), big enough to read at a glance.
const BONE = "#d6cca2";
const SKULL_MATS = (make: typeof makeLit) => ({ bone: make({ color: BONE }), shade: make({ color: "#a39a76" }), face: see(make({ map: tex(`${DRAFT}/skull-face.png`) })) });
function Bone({ m, at, turn }: { m: THREE.Material; at: [number, number, number]; turn: number }) {
  const L = 0.46, r = 0.026, k = 0.04;
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={m} raycast={() => null}><cylinderGeometry args={[r, r, L, 8]} /></mesh>
      {[-1, 1].flatMap((e) => [-1, 1].map((f) => (
        <mesh key={`${e}${f}`} position={[(e * L) / 2, 0, f * k * 0.6]} material={m} raycast={() => null}><sphereGeometry args={[k, 8, 6]} /></mesh>
      )))}
    </group>
  );
}
function Skull({ colour }: { colour?: Tint }) {
  const m = useMats(SKULL_MATS, colour);
  return (<>
    <Bone m={m.shade} at={[0, 0.04, 0.02]} turn={0.55} />
    <Bone m={m.bone} at={[0, 0.07, 0.02]} turn={-0.55} />
    <group position={[0, 0.2, 0]}>
      <mesh scale={[1, 0.92, 1.08]} material={m.bone} raycast={() => null}><sphereGeometry args={[0.13, 14, 10]} /></mesh>
      <mesh position={[0, -0.1, 0.05]} material={m.shade} raycast={() => null}><boxGeometry args={[0.15, 0.06, 0.12]} /></mesh>
      <mesh position={[0, -0.01, 0.135]} material={m.face} raycast={() => null}><planeGeometry args={[0.22, 0.25]} /></mesh>
    </group>
  </>);
}

// The backpack: a rounded leather body (a squashed lathe, its straps and buckles wrapped round), a pocket
// on its front, and the bedroll strapped across the top.
const PACK = (() => {
  const H = 0.5, R = 0.21;
  const pts = Array.from({ length: 13 }, (_, i) => { const y = (i / 12) * H; return new THREE.Vector2(Math.max(0.02, R * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * (y / H))), 0.45)), y); });
  return { geo: new THREE.LatheGeometry(pts, 18), H, R };
})();
const BACKPACK_MATS = (make: typeof makeLit) => ({
  body: make({ map: tex(`${DRAFT}/pack-leather.png`, [1.5, 1]) }), roll: make({ map: tex(`${DRAFT}/pack-bedroll.png`, [1, 1]) }),
  pocket: see(make({ map: tex(`${DRAFT}/pack-pocket.png`) })), end: make({ color: "#3e5a32" }),
});
function Backpack({ colour }: { colour?: Tint }) {
  const m = useMats(BACKPACK_MATS, colour);
  return (
    <group rotation={[0, -0.3, 0]}>
      <mesh geometry={PACK.geo} scale={[1, 1, 0.78]} material={m.body} raycast={() => null} />
      <mesh position={[0, 0.2, PACK.R * 0.78 + 0.005]} material={m.pocket} raycast={() => null}><planeGeometry args={[0.26, 0.26]} /></mesh>
      <mesh position={[0, PACK.H + 0.03, 0]} rotation={[0, 0, Math.PI / 2]} material={[m.roll, m.end, m.end]} raycast={() => null}><cylinderGeometry args={[0.07, 0.07, 0.42, 12]} /></mesh>
    </group>
  );
}

// The cage: built as the crates are, a plank floor and roof in the crate's own wood, corner posts, and
// rusty iron bars between; open, its front swings out on its left post. CAGE: 1 u across, 1.2 u tall.
const CAGE = { w: 1, h: 1.2, deck: 0.12, roof: 0.08, post: 0.09, bars: 5, bar: 0.018 };
const CRATE_WOOD = "/sprites/props/crate3d";
const CAGE_MATS = (make: typeof makeLit) => {
  const side = make({ map: tex(`${CRATE_WOOD}/side.png`) }), top = make({ map: tex(`${CRATE_WOOD}/top.png`) }), dark = make({ color: "#33271a" });
  return { slab: [side, side, top, dark, side, side], post: make({ color: "#483522" }), bars: [make({ color: "#6d452d" }), make({ color: "#563e2d" }), make({ color: "#4c433b" })] };
};
function Cage({ colour, open }: { colour?: Tint; open: boolean }) {
  const m = useMats(CAGE_MATS, colour), W = CAGE.w, h = CAGE.h - CAGE.deck - CAGE.roof, half = W / 2 - CAGE.post / 2;
  // One side's bars, along x from -half to half, at z = 0 of its group.
  const bars = (key: string) => Array.from({ length: CAGE.bars }, (_, i) => {
    const x = -half + ((i + 1) * (2 * half)) / (CAGE.bars + 1);
    return <mesh key={`${key}${i}`} position={[x, CAGE.deck + h / 2, 0]} material={m.bars[i % m.bars.length]} raycast={() => null}><cylinderGeometry args={[CAGE.bar, CAGE.bar, h, 6]} /></mesh>;
  });
  return (<>
    <mesh position={[0, CAGE.deck / 2, 0]} material={m.slab} raycast={() => null}><boxGeometry args={[W, CAGE.deck, W]} /></mesh>
    {/* The roof: an open frame of beams, bars across it (a solid roof hid what's inside from the high camera). */}
    {[-1, 1].map((z) => <mesh key={`rz${z}`} position={[0, CAGE.h - CAGE.roof / 2, z * half]} material={m.post} raycast={() => null}><boxGeometry args={[W, CAGE.roof, CAGE.post]} /></mesh>)}
    {[-1, 1].map((x) => <mesh key={`rx${x}`} position={[x * half, CAGE.h - CAGE.roof / 2, 0]} material={m.post} raycast={() => null}><boxGeometry args={[CAGE.post, CAGE.roof, W]} /></mesh>)}
    {Array.from({ length: CAGE.bars }, (_, i) => -half + ((i + 1) * (2 * half)) / (CAGE.bars + 1)).map((x, i) => (
      <mesh key={`rb${i}`} position={[x, CAGE.h - CAGE.roof / 2, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.bars[i % m.bars.length]} raycast={() => null}><cylinderGeometry args={[CAGE.bar, CAGE.bar, W - CAGE.post, 6]} /></mesh>
    ))}
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
      <mesh key={`p${x}${z}`} position={[x * half, CAGE.deck + h / 2, z * half]} material={m.post} raycast={() => null}><boxGeometry args={[CAGE.post, h, CAGE.post]} /></mesh>
    )))}
    <group position={[0, 0, -half]}>{bars("b")}</group>
    <group position={[-half, 0, 0]} rotation={[0, Math.PI / 2, 0]}>{bars("l")}</group>
    <group position={[half, 0, 0]} rotation={[0, Math.PI / 2, 0]}>{bars("r")}</group>
    {/* The front: on a hinge at its left post, swung out when open. */}
    <group position={[-half, 0, half]} rotation={[0, open ? -1.9 : 0, 0]}><group position={[half, 0, 0]}>{bars("f")}</group></group>
  </>);
}
