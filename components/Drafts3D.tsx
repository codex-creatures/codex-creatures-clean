"use client";
// components/Drafts3D.tsx — 🧪 drafts of the walkable dungeon's other things in 3D, for /lab/chest only (the
// user, 2026-11-11: "get the current things found in the dungeon up to the level of the tables and
// bookcases"). Nothing in the game draws these yet; each waits for the user's say-so in the lab.
// Painted (PixelLab samples, public/sprites/walk/samples/3d/, the art standard's samples folder): the
// storehouse's rickety chest, the library's broken bookcase, the healing pool and the campfire. Shape only
// (plain colours from the dungeon palette, art/palettes/dungeon.json, to judge size and form first): the
// cage, the lectern, the candles, the wall torch and the rubble. Units as Props3D: x across, y up, z
// towards you; each stands on y = 0, centred, facing south.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Chest, Bookcase, Glow, leaned, loaded, sharp } from "@/components/Props3D";
import { ART_FACES, ART_PER_U, ART_PITCH, type ChestFaces } from "@/lib/render3d/chest3d";
import { BOOKCASE_FACES, type BookcaseFaces } from "@/lib/render3d/props3d";

export type DraftKind = "rickety" | "broken" | "pool" | "campfire" | "cage" | "lectern" | "candles" | "torch" | "rubble";

const SAMPLES = "/sprites/walk/samples/3d";
const V = 1; // (a new address when a picture changes)
// The palette's colours these use (art/palettes/dungeon.json).
const C = {
  iron: "#3b352f", ironLit: "#5e5248", rust: "#6d452d", wood: "#483522", woodDark: "#33271a", woodLit: "#5e432a",
  stone: ["#454239", "#4a4d45", "#55544a", "#5a5d55", "#646256", "#3a362e"], wax: "#d5cbb1", waxDark: "#aca38b", page: "#e8dfc2",
  flame: "#f4a034", flameCore: "#fcd678",
};
const lambert = (color: string) => leaned(new THREE.MeshLambertMaterial({ color, flatShading: true }));

// ── The painted ones ──
export const RICKETY_FACES: ChestFaces = {
  front: { src: `${SAMPLES}/rickety/front.png?v=${V}`, w: 60, h: 19, lid: 6 },
  side: { src: `${SAMPLES}/rickety/side.png?v=${V}`, w: 38, h: 19 },
  inside: ART_FACES.inside,
  top: { src: `${SAMPLES}/rickety/top.png?v=${V}`, w: 60, h: 33 },
};
export const BROKEN_FACES: BookcaseFaces = {
  front: { src: `${SAMPLES}/broken-bookcase/front.png?v=${V}`, w: 54, h: 44 },
  side: BOOKCASE_FACES.side,
  top: BOOKCASE_FACES.top,
};
const POOL = { top: `${SAMPLES}/pool/top.png?v=${V}`, rim: `${SAMPLES}/pool/rim.png?v=${V}`, rimPx: [48, 16] as const, wide: 1.3, tall: 0.2 };
const FIRE = { top: `${SAMPLES}/campfire/top.png?v=${V}`, wide: 0.9, tall: 0.12 };

export function Draft3D({ kind, open = false, outline = true, lit = true }: { kind: DraftKind; open?: boolean; outline?: boolean; lit?: boolean }) {
  switch (kind) {
    case "rickety": return <Chest open={open} outline={outline} edges={false} faces={RICKETY_FACES} />;
    case "broken": return <Bookcase outline={outline} edges={false} faces={BROKEN_FACES} />;
    case "pool": return <Pool used={open} />;
    case "campfire": return <Campfire lit={lit} />;
    case "cage": return <Cage open={open} />;
    case "lectern": return <Lectern />;
    case "candles": return <Candles lit={lit} />;
    case "torch": return <WallTorch lit={lit} />;
    case "rubble": return <Rubble />;
  }
}

// A low round wall of stones (the rim texture laid round it, a unit of art to a unit), its top the picture
// seen from above (the ring, and the water or the fire pit inside).
function Ring({ wide, tall, top, rim, sides = 16 }: { wide: number; tall: number; top: string; rim: string; sides?: number }) {
  const r = wide / 2;
  const mats = useMemo(() => {
    const side = loaded(rim).clone();
    sharp(side);
    side.wrapS = side.wrapT = THREE.RepeatWrapping;
    // Round it, a rim picture (48 px) a unit; up its height, as many of its rows as fit square on screen.
    const rows = (tall * ART_PER_U * Math.cos(ART_PITCH)) / POOL.rimPx[1];
    side.repeat.set(Math.round(Math.PI * wide), rows);
    side.offset.set(0, 1 - rows);
    side.needsUpdate = true;
    return { side: leaned(new THREE.MeshLambertMaterial({ map: side })), top: leaned(new THREE.MeshLambertMaterial({ map: loaded(top), transparent: true, alphaTest: 0.5 })) };
  }, [rim, top, tall, wide]);
  return (
    <>
      <mesh material={mats.side} position={[0, tall / 2, 0]} raycast={() => null}><cylinderGeometry args={[r, r, tall, sides, 1, true]} /></mesh>
      <mesh material={mats.top} position={[0, tall + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><circleGeometry args={[r, sides * 2]} /></mesh>
    </>
  );
}

// The healing pool: the ring with its water, a faint turquoise glow over it (dimmer once you've drunk).
function Pool({ used }: { used: boolean }) {
  return (
    <>
      <Ring wide={POOL.wide} tall={POOL.tall} top={POOL.top} rim={POOL.rim} />
      <Glow colour="#5fe0d0" radius={POOL.wide * 0.45} strength={used ? 0.15 : 0.45} y={POOL.tall + 0.01} />
    </>
  );
}

// The campfire: a ring of the pool's stones round the pit (its picture: ash, embers, the logs), the fire's
// flames standing up in it while it burns, and its warm glow on the floor.
function Campfire({ lit }: { lit: boolean }) {
  return (
    <>
      <Ring wide={FIRE.wide} tall={FIRE.tall} top={FIRE.top} rim={POOL.rim} sides={12} />
      {lit && <Flame at={[0, FIRE.tall, 0.05]} size={0.42} />}
      {lit && <Glow colour="#ff9632" radius={1.4} strength={0.35} />}
    </>
  );
}

// A flame: two flat shapes (the outer orange, the core yellow) facing you, flickering.
function Flame({ at, size }: { at: [number, number, number]; size: number }) {
  const g = useRef<THREE.Group>(null);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(0.5, 0.1, 0.32, 0.55); s.quadraticCurveTo(0.2, 0.8, 0, 1);
    s.quadraticCurveTo(-0.2, 0.8, -0.32, 0.55); s.quadraticCurveTo(-0.5, 0.1, 0, 0);
    return new THREE.ShapeGeometry(s, 4);
  }, []);
  useFrame(() => {
    const t = performance.now() / 120;
    if (g.current) g.current.scale.set(size * (0.92 + 0.08 * Math.sin(t * 1.3)), size * (0.9 + 0.12 * Math.sin(t)), 1);
  });
  return (
    <group ref={g} position={at}>
      <mesh geometry={shape} raycast={() => null}><meshBasicMaterial color={C.flame} /></mesh>
      <mesh geometry={shape} position={[0, 0.02, 0.01]} scale={[0.55, 0.6, 1]} raycast={() => null}><meshBasicMaterial color={C.flameCore} /></mesh>
    </group>
  );
}

// ── Shape only (plain palette colours) ──

// A camp's cage: a floor of planks, iron posts at the corners, a frame round the top and bottom, bars
// between; open, its front swings out on its left post. 1 × 1 u (its footprint), 1.2 u tall.
function Cage({ open }: { open: boolean }) {
  const W = 1, H = 1.2, post = 0.08, bar = 0.035, gap = 0.16;
  const m = useMemo(() => ({ iron: lambert(C.iron), lit: lambert(C.ironLit), floor: lambert(C.woodDark) }), []);
  const box = (k: string, at: [number, number, number], size: [number, number, number], mat: THREE.Material) => (
    <Block key={k} material={mat} at={at} size={size} />
  );
  const bars = (side: "back" | "left" | "right" | "front") => {
    const n = Math.floor((W - 2 * post) / gap), out: React.ReactNode[] = [];
    for (let i = 1; i < n; i++) {
      const a = -W / 2 + post + i * gap;
      const at: [number, number, number] = side === "back" ? [a, H / 2, -W / 2 + post / 2] : side === "front" ? [a + W / 2, H / 2, 0] : [side === "left" ? -W / 2 + post / 2 : W / 2 - post / 2, H / 2, a];
      out.push(<mesh key={`${side}${i}`} geometry={BOX} material={m.iron} position={at} scale={[bar, H - 2 * post, bar]} raycast={() => null} />);
    }
    return out;
  };
  return (
    <>
      {box("floor", [0, 0.03, 0], [W, 0.06, W], m.floor)}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(`p${sx}${sz}`, [sx * (W / 2 - post / 2), H / 2, sz * (W / 2 - post / 2)], [post, H, post], m.lit)))}
      {[post / 2, H - post / 2].flatMap((y) => [
        box(`b${y}`, [0, y, -W / 2 + post / 2], [W, post, post], m.iron), box(`l${y}`, [-W / 2 + post / 2, y, 0], [post, post, W], m.iron),
        box(`r${y}`, [W / 2 - post / 2, y, 0], [post, post, W], m.iron),
      ])}
      {bars("back")}{bars("left")}{bars("right")}
      {/* The front: a door on its left post. */}
      <group position={[-W / 2 + post / 2, 0, W / 2 - post / 2]} rotation={[0, open ? -1.9 : 0, 0]}>
        {[post / 2, H - post / 2].map((y) => box(`f${y}`, [W / 2, y, 0], [W - post, post, post], m.iron))}
        {bars("front")}
      </group>
    </>
  );
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const HULL = leaned(new THREE.MeshBasicMaterial({ color: "#000", side: THREE.BackSide }));
// A box of a plain colour, `size` big, with the one-pixel dark outline every thing has.
function Block({ material, at, size }: { material: THREE.Material; at: [number, number, number]; size: [number, number, number] }) {
  return (
    <group position={at}>
      <mesh geometry={BOX} material={material} scale={size} raycast={() => null} />
      <mesh geometry={BOX} material={HULL} scale={size.map((v) => v + 2 / ART_PER_U) as [number, number, number]} raycast={() => null} />
    </group>
  );
}

// The library's lectern: a plinth, a post and a sloping top facing you, an open book on it.
// 0.67 u (its footprint) across, 1 u tall.
function Lectern() {
  const m = useMemo(() => ({ wood: lambert(C.wood), dark: lambert(C.woodDark), lit: lambert(C.woodLit), page: lambert(C.page) }), []);
  return (
    <>
      <Block material={m.dark} at={[0, 0.05, 0]} size={[0.5, 0.1, 0.42]} />
      <Block material={m.wood} at={[0, 0.45, 0]} size={[0.16, 0.7, 0.16]} />
      <group position={[0, 0.86, 0]} rotation={[0.45, 0, 0]}>
        <Block material={m.lit} at={[0, 0, 0]} size={[0.6, 0.06, 0.44]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={BOX} material={m.page} position={[s * 0.13, 0.045, 0]} rotation={[0, 0, s * -0.12]} scale={[0.25, 0.02, 0.34]} raycast={() => null} />
        ))}
      </group>
    </>
  );
}

// A floor candle: three of them, of different heights, a flame on each when lit.
function Candles({ lit }: { lit: boolean }) {
  const m = useMemo(() => ({ wax: lambert(C.wax), dark: lambert(C.waxDark) }), []);
  const three: [number, number, number, number][] = [[-0.07, 0.02, 0.26, 0.045], [0.06, -0.03, 0.18, 0.04], [0.02, 0.07, 0.12, 0.05]];
  return (
    <>
      {three.map(([x, z, h, r], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh material={i === 1 ? m.dark : m.wax} position={[0, h / 2, 0]} raycast={() => null}><cylinderGeometry args={[r, r * 1.08, h, 8]} /></mesh>
          {lit && <Flame at={[0, h, 0.02]} size={0.09} />}
        </group>
      ))}
      {lit && <Glow colour="#ffbe5a" radius={0.6} strength={0.3} />}
    </>
  );
}

// A wall torch on the wall behind (the lab's back wall stands 2 u north): an iron bracket on the wall,
// the stick leaning out of it, its head wrapped in pitch, a flame when lit. Drawn at the wall, 1.05 u up.
function WallTorch({ lit }: { lit: boolean }) {
  const m = useMemo(() => ({ iron: lambert(C.iron), wood: lambert(C.wood), pitch: lambert("#22221e") }), []);
  return (
    <group position={[0, 1.05, -2 + 0.01]}>
      <Block material={m.iron} at={[0, 0, 0.04]} size={[0.12, 0.2, 0.08]} />
      <group position={[0, 0, 0.1]} rotation={[0.35, 0, 0]}>
        <mesh material={m.wood} position={[0, 0.12, 0]} raycast={() => null}><cylinderGeometry args={[0.03, 0.025, 0.4, 6]} /></mesh>
        <mesh material={m.pitch} position={[0, 0.33, 0]} raycast={() => null}><cylinderGeometry args={[0.05, 0.04, 0.1, 6]} /></mesh>
        {lit && <Flame at={[0, 0.37, 0.03]} size={0.2} />}
      </group>
    </group>
  );
}

// Rubble where a tunnel fell in: a heap of stones of the rock's colours, bigger in the middle.
// (Laid out once, from a fixed seed.)
const STONES = (() => {
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 18 }, (_, i) => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.55, size = 0.12 + r() * 0.16 * (1 - d);
    return { at: [Math.cos(a) * d, size / 2 + (i > 12 ? 0.12 : 0), Math.sin(a) * d * 0.8] as [number, number, number], size, turn: r() * 3, colour: C.stone[i % C.stone.length] };
  });
})();
function Rubble() {
  const stones = STONES;
  const mats = useMemo(() => Object.fromEntries(C.stone.map((c) => [c, lambert(c)])), []);
  return (
    <>
      {stones.map((st, i) => (
        <group key={i} position={st.at} rotation={[st.turn * 0.3, st.turn, st.turn * 0.2]}>
          <Block material={mats[st.colour]} at={[0, 0, 0]} size={[st.size, st.size * 0.7, st.size * 0.9]} />
        </group>
      ))}
    </>
  );
}
