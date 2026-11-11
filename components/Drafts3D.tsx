"use client";
// components/Drafts3D.tsx — 🧪 drafts of the walkable dungeon's other things in 3D, for /lab/chest only (the
// user, 2026-11-11: "get the current things found in the dungeon up to the level of the tables and
// bookcases"). Nothing in the game draws these yet; each waits for the user's say-so in the lab. (Approved
// and in the game: the broken bookcase, the campfire and the healing gem, in Props3D.)
// The user's review, 2026-11-11, gave the second round:
// - the strongbox: the mini boss's and storehouse's loot, half as big again as the chest, iron-bound (PixelLab,
//   styled on the Warden's strongbox), with a faint glow (it's guarded, so it spoils no surprise);
// - the healing gem: floating, glowing, in place of the dungeon's pools (the Den keeps its pool); dark once used;
// - the cage: big (larger creatures go in it) and tall, rusty;
// - the lectern: worn and detailed (PixelLab faces, styled on the old one);
// - a floor torch in place of the floor candles (candles stay for tables: a 3D one here, not a flat picture);
// - the wall torch, redone bigger.
// Units as Props3D: x across, y up, z towards you; each stands on y = 0, centred, facing south.

import { useMemo } from "react";
import * as THREE from "three";
import { Chest, Bookcase, Glow, Campfire, HealingGem, Flame, leaned, loaded } from "@/components/Props3D";
import { ART_FACES, ART_PER_U, ART_PITCH, type ChestFaces } from "@/lib/render3d/chest3d";
import { BROKEN_BOOKCASE_FACES } from "@/lib/render3d/props3d";

export type DraftKind = "strongbox" | "broken" | "gem" | "campfire" | "cage" | "lectern" | "floortorch" | "torch";

const SAMPLES = "/sprites/walk/samples/3d";
const V = 1; // (a new address when a picture changes)
// The palette's colours these use (art/palettes/dungeon.json).
const C = {
  iron: "#3b352f", ironLit: "#5e5248", ironDark: "#2a2723", rust: ["#563e2d", "#6d452d", "#844c2c", "#3b352f", "#4c433b"],
  wood: "#483522", woodDark: "#33271a", woodLit: "#5e432a", cloth: "#22221e", wax: "#d5cbb1",
};
const lambert = (color: string) => leaned(new THREE.MeshLambertMaterial({ color, flatShading: true }));

// ── The strongbox: the chest's two boxes with PixelLab's iron-bound faces, half as big again ──
export const STRONGBOX_FACES: ChestFaces = {
  front: { src: `${SAMPLES}/strongbox/front.png?v=${V}`, w: 90, h: 28, lid: 9 },
  side: { src: `${SAMPLES}/strongbox/side.png?v=${V}`, w: 58, h: 28 },
  inside: ART_FACES.inside,
  top: { src: `${SAMPLES}/strongbox/top.png?v=${V}`, w: 90, h: 50 },
};
const LECTERN = { top: `${SAMPLES}/lectern/top.png?v=${V}`, post: `${SAMPLES}/lectern/post.png?v=${V}` };

export function Draft3D({ kind, open = false, outline = true, lit = true }: { kind: DraftKind; open?: boolean; outline?: boolean; lit?: boolean }) {
  switch (kind) {
    case "strongbox": return (
      <>
        <Chest open={open} outline={outline} edges={false} faces={STRONGBOX_FACES} />
        <Glow colour="#ffcc4d" radius={1.3} strength={0.22} />
      </>
    );
    case "broken": return <Bookcase outline={outline} edges={false} faces={BROKEN_BOOKCASE_FACES} />;
    case "gem": return <HealingGem used={open} />;
    case "campfire": return <Campfire lit={lit} />;
    case "cage": return <Cage open={open} />;
    case "lectern": return <Lectern />;
    case "floortorch": return <FloorTorch lit={lit} />;
    case "torch": return <WallTorch lit={lit} />;
  }
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const HULL = leaned(new THREE.MeshBasicMaterial({ color: "#000", side: THREE.BackSide }));
// A box of a plain colour (or painted), `size` big, with the one-pixel dark outline every thing has.
function Block({ material, at, size, turn }: { material: THREE.Material | THREE.Material[]; at: [number, number, number]; size: [number, number, number]; turn?: [number, number, number] }) {
  return (
    <group position={at} rotation={turn}>
      <mesh geometry={BOX} material={material} scale={size} raycast={() => null} />
      <mesh geometry={BOX} material={HULL} scale={size.map((v) => v + 2 / ART_PER_U) as [number, number, number]} raycast={() => null} />
    </group>
  );
}

// ── The cage: big enough for a large creature, 1.5 u across and 2 u tall (its footprint is 1 u: a bigger
// one would be a new world version), rusty iron: corner posts, a frame round the top, middle and bottom,
// thick bars between, each its own shade of rust; open, its front swings out on its left post.
function Cage({ open }: { open: boolean }) {
  const W = 1.5, H = 2, post = 0.11, bar = 0.05, gap = 0.19;
  const m = useMemo(() => ({ rust: C.rust.map(lambert), floor: lambert(C.woodDark), post: lambert(C.rust[1]) }), []);
  const rustOf = (i: number) => m.rust[(i * 7 + 3) % m.rust.length];
  const bars = (side: "back" | "left" | "right" | "front") => {
    const n = Math.floor((W - 2 * post) / gap), out: React.ReactNode[] = [];
    for (let i = 1; i < n; i++) {
      const a = -W / 2 + post + i * gap;
      const at: [number, number, number] = side === "back" ? [a, H / 2, -W / 2 + post / 2] : side === "front" ? [a + W / 2, H / 2, 0] : [side === "left" ? -W / 2 + post / 2 : W / 2 - post / 2, H / 2, a];
      out.push(<Block key={`${side}${i}`} material={rustOf(i + side.length)} at={at} size={[bar, H - 2 * post, bar]} />);
    }
    return out;
  };
  return (
    <>
      <Block material={m.floor} at={[0, 0.04, 0]} size={[W, 0.08, W]} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Block key={`p${sx}${sz}`} material={m.post} at={[sx * (W / 2 - post / 2), H / 2, sz * (W / 2 - post / 2)]} size={[post, H, post]} />))}
      {[post / 2, H - post / 2, H * 0.55].flatMap((y, k) => [
        <Block key={`b${k}`} material={rustOf(k)} at={[0, y, -W / 2 + post / 2]} size={[W, post * 0.8, post * 0.8]} />,
        <Block key={`l${k}`} material={rustOf(k + 1)} at={[-W / 2 + post / 2, y, 0]} size={[post * 0.8, post * 0.8, W]} />,
        <Block key={`r${k}`} material={rustOf(k + 2)} at={[W / 2 - post / 2, y, 0]} size={[post * 0.8, post * 0.8, W]} />,
      ])}
      {bars("back")}{bars("left")}{bars("right")}
      {/* The front: a door on its left post. */}
      <group position={[-W / 2 + post / 2, 0, W / 2 - post / 2]} rotation={[0, open ? -1.9 : 0, 0]}>
        {[post / 2, H - post / 2, H * 0.55].map((y, k) => <Block key={`f${k}`} material={rustOf(k + 3)} at={[W / 2, y, 0]} size={[W - post, post * 0.8, post * 0.8]} />)}
        {bars("front")}
      </group>
    </>
  );
}

// ── The lectern: a heavy foot, a carved post (PixelLab's), and a sloping desk facing you with an open
// book on it (PixelLab's, seen from above). 0.7 u across, about 1.1 u tall.
function Lectern() {
  const m = useMemo(() => {
    const top = leaned(new THREE.MeshLambertMaterial({ map: loaded(LECTERN.top) }));
    const post = leaned(new THREE.MeshLambertMaterial({ map: loaded(LECTERN.post), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    const wood = lambert(C.wood), dark = lambert(C.woodDark);
    return { desk: [dark, dark, top, dark, wood, wood], post, dark };
  }, []);
  const postH = (36 / (ART_PER_U * Math.cos(ART_PITCH))) * 0.55;
  return (
    <>
      <Block material={m.dark} at={[0, 0.06, 0]} size={[0.5, 0.12, 0.4]} />
      {/* The post: its picture on two crossed planes, so it shows from the front and a little round. */}
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} material={m.post} position={[0, 0.12 + postH / 2, 0]} rotation={[0, r, 0]} scale={[20 / ART_PER_U, postH, 1]} raycast={() => null}><planeGeometry /></mesh>
      ))}
      <Block material={m.desk} at={[0, 0.12 + postH + 0.05, 0]} size={[36 / ART_PER_U, 0.07, 28 / (ART_PER_U * Math.sin(ART_PITCH))]} turn={[0.45, 0, 0]} />
    </>
  );
}

// ── A floor torch, in place of the floor candles: an iron stand on three feet, a pole, and a bowl of fire
// at the top. 1.2 u tall.
function FloorTorch({ lit }: { lit: boolean }) {
  const m = useMemo(() => ({ iron: lambert(C.iron), lit: lambert(C.ironLit), dark: lambert(C.ironDark), coal: lambert("#1c1d15") }), []);
  return (
    <>
      {[0, 2.09, 4.19].map((a) => <Block key={a} material={m.dark} at={[Math.cos(a) * 0.12, 0.1, Math.sin(a) * 0.12]} size={[0.04, 0.24, 0.04]} turn={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]} />)}
      <Block material={m.iron} at={[0, 0.6, 0]} size={[0.06, 1, 0.06]} />
      <mesh material={m.lit} position={[0, 1.13, 0]} raycast={() => null}><cylinderGeometry args={[0.15, 0.08, 0.14, 8]} /></mesh>
      <mesh material={m.coal} position={[0, 1.2, 0]} raycast={() => null}><cylinderGeometry args={[0.13, 0.13, 0.01, 8]} /></mesh>
      {lit && <Flame at={[0, 1.2, 0.03]} size={0.36} />}
      {lit && <Glow colour="#ff9632" radius={1.2} strength={0.3} />}
    </>
  );
}

// ── The wall torch, redone (the user: the first "looks like a speck"): a riveted iron plate on the wall, an
// arm out to a ring, the torch leaning out through it, its head wrapped in pitch-black cloth with a band,
// a big flame. On the lab's wall (2 u north), 1.1 u up.
function WallTorch({ lit }: { lit: boolean }) {
  const m = useMemo(() => ({ iron: lambert(C.iron), lit: lambert(C.ironLit), wood: lambert(C.wood), cloth: lambert(C.cloth), band: lambert(C.rust[1]) }), []);
  return (
    <group position={[0, 1.1, -2]}>
      <Block material={m.iron} at={[0, 0, 0.02]} size={[0.22, 0.34, 0.04]} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sy) => <Block key={`${sx}${sy}`} material={m.lit} at={[sx * 0.07, sy * 0.12, 0.05]} size={[0.03, 0.03, 0.02]} />))}
      <Block material={m.iron} at={[0, -0.05, 0.12]} size={[0.04, 0.04, 0.18]} />
      <mesh material={m.lit} position={[0, -0.05, 0.22]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}><torusGeometry args={[0.055, 0.015, 6, 10]} /></mesh>
      <group position={[0, -0.05, 0.22]} rotation={[0.4, 0, 0]}>
        <mesh material={m.wood} position={[0, 0.05, 0]} raycast={() => null}><cylinderGeometry args={[0.035, 0.03, 0.55, 6]} /></mesh>
        <mesh material={m.cloth} position={[0, 0.34, 0]} raycast={() => null}><cylinderGeometry args={[0.07, 0.05, 0.16, 7]} /></mesh>
        <mesh material={m.band} position={[0, 0.28, 0]} raycast={() => null}><cylinderGeometry args={[0.055, 0.055, 0.03, 7]} /></mesh>
        {lit && <Flame at={[0, 0.41, 0.04]} size={0.34} />}
      </group>
      {lit && <Glow colour="#ff9632" radius={0.9} strength={0.25} y={-1.09} />}
    </group>
  );
}

// ── A candle on a table, built in 3D (the user: the flat one looked wrong, hanging off a turned table): an
// iron dish, the candle, its flame. `x`: where on the table's top (props3d.ts CANDLE_AT).
export function TableCandle3D({ x, top, lit = true }: { x: number; top: number; lit?: boolean }) {
  const m = useMemo(() => ({ dish: lambert(C.iron), wax: lambert(C.wax) }), []);
  return (
    <group position={[x, top, 0]}>
      <mesh material={m.dish} position={[0, 0.01, 0]} raycast={() => null}><cylinderGeometry args={[0.08, 0.07, 0.02, 10]} /></mesh>
      <mesh material={m.wax} position={[0, 0.1, 0]} raycast={() => null}><cylinderGeometry args={[0.035, 0.04, 0.16, 8]} /></mesh>
      {lit && <Flame at={[0, 0.18, 0.02]} size={0.11} />}
      {lit && <Glow colour="#ffbe5a" radius={0.5} strength={0.3} y={0.005} />}
    </group>
  );
}
