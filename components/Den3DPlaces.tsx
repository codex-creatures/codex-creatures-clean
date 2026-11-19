"use client";
// components/Den3DPlaces.tsx
// 🧪 How each of the new Den's places is drawn (components/Den3D.tsx draws the room and places them; where
// they stand is lib/den3d/layout.ts's). Built as the Labyrinth's 3D things are: simple shapes, their surfaces
// PixelLab's (lib/den3d/art.ts), square on screen at 48 art pixels a unit, leaning as the rock does, unlit and
// tinted by the light where they stand. The buildings are boxes with their fronts painted on and pitched
// roofs; the Soul Altar, the pool and both pits are 3D models whose parts are cut from their approved
// pictures (the user, 2026-11-19); the ways out's arches (over their dark holes) and the board's notes hang on
// the north walls.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Upright } from "@/components/WalkView3D";
import { Prop3D, Glow, Ring, CAMPFIRE_3D, makeFlat, bases, useTint, loaded, type Tint } from "@/components/Props3D";
import { Decor3D } from "@/components/Decor3D";
import { BUILDINGS, buildingWide, buildingWalls, ARCH, PORTAL_ARCH, ARCH_HOLE, PORTAL_HOLE, NOTES, PARTS, ART_PX, FACE_PX, type BuildingArt, type Pic } from "@/lib/den3d/art";
import { DEN_WALL, DIVIDE_X, WALL_GAP, NOOK_N, type Station } from "@/lib/den3d/layout";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { artFor } from "@/lib/sprites/art";
import { PropRecipe3D } from "@/components/PropRecipe3D";
import { recipeOf } from "@/lib/props/recipes/load";
import { recipeReach, type Recipe } from "@/lib/props/recipe";

const SOUL = "#5fe0d0"; // the altar's and pool's teal
const GREEN = "#7fdc8a"; // the portal's

// Each place. `tint`: the light where it stands (red while it's being moved somewhere it can't go).
// The props built from recipes (lib/props/recipes; the user approved them for the new Den, 2026-11-19) stand in
// for their old drawings: the altar, the pool, the pits, the board and the buildings (the tavern once it's repaired).
// Without its recipe (one that won't read), a place keeps its old drawing.
// `classic`: the old drawings, never the recipes (the prop builder's "what the game draws now", to compare).
export function Place({ s, tint, stretch, pitch = Math.PI / 3, caged, repaired, trainingPit, stoneReady, classic = false }: { s: Station; tint: () => THREE.Color; stretch: number; pitch?: number; caged?: string;
  repaired: boolean; trainingPit: boolean; stoneReady: boolean; classic?: boolean }) {
  const at: [number, number, number] = [s.x, 0, s.y];
  const made = (id: string, against: "middle" | "north" | "west" = "middle", extra?: React.ReactNode) => {
    const r = classic ? null : recipeOf(id);
    return r ? <Made r={r} s={s} against={against} tint={tint} pitch={pitch} stretch={stretch}>{extra}</Made> : null;
  };
  switch (s.key) {
    case "shack": return made("shack", "north") ?? <Building at={at} d={s.d} art={BUILDINGS.shack} tint={tint} />;
    case "storehouse": return made("storehouse", "west") ?? <Building at={at} d={s.turn ? s.w : s.d} art={BUILDINGS.storehouse} tint={tint} turn={!!s.turn} />;
    case "tavern": return (repaired ? made("tavern", "north", <Smoke at={CHIMNEY} />) : made("tavern-broken", "north")) ?? <Building at={at} d={s.d} art={BUILDINGS.tavern} broken={!repaired} tint={tint} />;
    case "board": return made("board", "north") ?? <OnWall s={s} pic={NOTES} tint={tint} backing={{ colour: "#5e432a", pad: 0.12 }} />;
    case "altar": return made("altar") ?? <Altar at={at} tint={tint} stretch={stretch} />;
    case "pool": return made("pool") ?? <Pool at={at} w={s.w} d={s.d} tint={tint} />;
    case "pit": return made("pit") ?? <Pit at={at} w={s.w} d={s.d} tint={tint} />;
    case "training": return made(trainingPit ? "training" : "sparring") ?? <Sparring at={at} w={s.w} d={s.d} tint={tint} stretch={stretch} spikes={trainingPit} />;
  }
  switch (s.key) {
    case "bookcase": return <group position={at}><Prop3D kind="bookcase" colour={tint} /></group>;
    case "lectern": return <group position={at}><Decor3D kind="lectern" stretch={stretch} colour={tint} /></group>;
    case "cage": {
      const sprite = caged ? CREATURE_SPRITES[caged] : undefined, art = sprite && artFor(sprite);
      const tall = 0.8, w = art ? tall * (art.w / art.h) : 0;
      // (The cage's recipe, 1 × 1 and 1.5 high, the user's 2026-11-19 redesign; the creature stands on its straw.)
      const cage = made("cage");
      return (
        <group>
          {cage ?? <group position={at}><Decor3D kind="cage" stretch={stretch} colour={tint} /></group>}
          {art && <Breathe at={at}><Upright src={art.src} x={0} y={0} w={Math.min(w, 0.75)} h={tall * stretch} below={cage ? -0.23 : -0.14} colour={tint} /></Breathe>}
        </group>
      );
    }
    // (The arch and the portal from their recipes, standing out from the wall over their holes.)
    case "arch": { const a = made("arch"); return a ? <><OnWall s={s} pic={ARCH_HOLE} tint={tint} />{a}</> : <OnWall s={s} pic={ARCH} hole={ARCH_HOLE} tint={tint} />; }
    case "portal": return <Portal s={s} tint={tint} arch={made("portal")} />;
    case "rubble": return <Socket at={at} tint={tint} ready={stoneReady} body={made("socket")} />;
  }
}

// ── Small movements (the user, 2026-11-19: "bringing it to life") ──
// Smoke from the tavern's chimney (its top in tavern.json): puffs of a few art pixels rising, drifting east, growing and
// fading, one after another.
const CHIMNEY: [number, number, number] = [1.55, 3.1, -0.41];
const PUFFS = 5, PUFF_S = 2.6; // puffs at once; seconds each rises
function Smoke({ at }: { at: [number, number, number] }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const t = performance.now() / 1000;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const k = ((t / PUFF_S + i / PUFFS) % 1), size = (4 + Math.round(k * 5)) / 48;
      m.position.set(at[0] + k * 0.35 + 0.04 * Math.sin(t * 2 + i), at[1] + k * 1.1, at[2]);
      m.scale.set(size, size, 1);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k) * Math.min(1, k * 6);
    });
  });
  return <>{Array.from({ length: PUFFS }, (_, i) => (
    <mesh key={i} ref={(m) => { refs.current[i] = m; }} raycast={() => null} position={at}>
      <planeGeometry /><meshBasicMaterial color="#9a948c" transparent depthWrite={false} />
    </mesh>
  ))}</>;
}
// The caged creature breathing: a slow rise and fall of an art pixel.
function Breathe({ at, children }: { at: [number, number, number]; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => { if (g.current) g.current.position.set(at[0], at[1] + (Math.sin(performance.now() / 700) > 0 ? 1 / 48 : 0), at[2]); });
  return <group ref={g} position={at}>{children}</group>;
}

// A prop from its recipe, where its place is: in the middle of its footprint, or its back to the north wall (the
// shack, the tavern, the board) or the west one (the storehouse, turned to face east into the room). Lit by the
// Den's key light (Den3D's) and tinted by the light where it stands, as the old drawings were.
// `children`: anything that goes with it (the tavern's smoke), placed in the recipe's own units from its middle.
function Made({ r, s, against, tint, pitch, stretch, children }: { r: Recipe; s: Station; against: "middle" | "north" | "west"; tint: () => THREE.Color; pitch: number; stretch: number; children?: React.ReactNode }) {
  const [, deep] = useMemo(() => recipeReach(r, { pitch, stretch }), [r, pitch, stretch]);
  const back = 0.02;
  const at: [number, number, number] = against === "north" ? [s.x, 0, s.y - s.d / 2 + deep + back]
    : against === "west" ? [s.x - s.w / 2 + deep + back, 0, s.y] : [s.x, 0, s.y];
  return (
    <group rotation={[0, against === "west" ? Math.PI / 2 : 0, 0]} position={against === "west" ? at : [0, 0, 0]}>
      <PropRecipe3D recipe={r} at={against === "west" ? [0, 0, 0] : at} pitch={pitch} stretch={stretch} tint={tint} lit />
      {children && <group position={against === "west" ? [0, 0, 0] : at}>{children}</group>}
    </group>
  );
}

// ── Materials ──
// A picture's material: flat, leaning as the rock does, tinted. `repeat`: laid that many times across and up
// (a surface longer than its picture); `uv`: only part of it (x, y from the bottom, width, height, as fractions).
function usePicture(src: string, tint: Tint, opts: { repeat?: [number, number]; uv?: [number, number, number, number]; see?: boolean } = {}) {
  const key = `${opts.repeat?.join() ?? ""}|${opts.uv?.join() ?? ""}|${opts.see ?? true}`;
  const mat = useMemo(() => {
    const [rep, uv, see] = key.split("|");
    const t = loaded(src, !!rep).clone();
    if (rep) { const [rx, ry] = rep.split(",").map(Number); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
    if (uv) { const u = uv.split(",").map(Number); t.offset.set(u[0], u[1]); t.repeat.set(u[2], u[3]); }
    t.needsUpdate = true;
    const m = makeFlat({ map: t, side: THREE.DoubleSide });
    if (see === "true") { m.transparent = true; m.alphaTest = 0.5; }
    return m;
  }, [src, key]);
  useTint([mat], useMemo(() => bases([mat]), [mat]), tint);
  return mat;
}
// Plain parts: flat colours, tinted.
export function useFlat(colours: string[], tint: Tint) {
  const key = colours.join();
  const mats = useMemo(() => key.split(",").map((c) => makeFlat({ color: c })), [key]);
  useTint(mats, useMemo(() => bases(mats), [mats]), tint);
  return mats;
}
// How many times a picture `pic` repeats along a surface `u` wide (square on screen at 48 a unit, across).
const across = (u: number, pic: Pic) => (u * ART_PX) / pic.w;
const upFace = (u: number, pic: Pic) => (u * FACE_PX) / pic.h;

// ── The buildings ──
// As wide as its front and as tall as its walls, the front painted on, its ends a strip of the front's end,
// a pitched roof: the roof's picture on the slope facing you, its top part (darker) on the slope behind,
// the gables plain dark wood. `turn`: turned a quarter, to face east along the west wall.
function Building({ at, d, art, broken, tint, turn = false }: { at: [number, number, number]; d: number; art: BuildingArt; broken?: boolean; tint: () => THREE.Color; turn?: boolean }) {
  const w = buildingWide(art), wallH = buildingWalls(art), over = 0.15, half = d / 2 + over, rise = art.rise;
  const front = usePicture((broken && art.broken ? art.broken : art.front).src, tint);
  const end = usePicture(art.front.src, tint, { uv: [0, 0, 12 / art.front.w, 1] });
  const roof = usePicture(art.roof.src, tint);
  const back = usePicture(art.roof.src, () => tint().multiplyScalar(0.6), { uv: [0, 0.55, 1, 0.45] });
  const gable = useFlat(["#2e1f14"], tint)[0];
  const slope = Math.hypot(half, rise), tilt = Math.atan2(half, rise);
  const gableGeo = useMemo(() => {
    const g = new THREE.Shape();
    g.moveTo(-d / 2, 0); g.lineTo(d / 2, 0); g.lineTo(0, rise); g.lineTo(-d / 2, 0);
    return new THREE.ShapeGeometry(g);
  }, [d, rise]);
  return (
    <group position={at} rotation={[0, turn ? Math.PI / 2 : 0, 0]}>
      <mesh material={front} position={[0, wallH / 2, d / 2]} raycast={() => null}><planeGeometry args={[w, wallH]} /></mesh>
      {[-1, 1].map((k) => <mesh key={k} material={end} position={[(k * w) / 2, wallH / 2, 0]} rotation={[0, (k * Math.PI) / 2, 0]} raycast={() => null}><planeGeometry args={[d, wallH]} /></mesh>)}
      {[-1, 1].map((k) => <mesh key={`g${k}`} geometry={gableGeo} material={gable} position={[(k * w) / 2, wallH, 0]} rotation={[0, (k * Math.PI) / 2, 0]} raycast={() => null} />)}
      <mesh material={roof} position={[0, wallH + rise / 2, half / 2]} rotation={[-tilt, 0, 0]} raycast={() => null}><planeGeometry args={[w + 2 * over, slope]} /></mesh>
      <mesh material={back} position={[0, wallH + rise / 2, -half / 2]} rotation={[tilt, Math.PI, 0]} raycast={() => null}><planeGeometry args={[w + 2 * over, slope]} /></mesh>
    </group>
  );
}

// ── On the north walls ──
// A picture on a north wall (a way out's arch over its `hole`, the board's notes on a plank backing), its foot on
// the floor (the notes up off it), standing square on screen as the wall's own stone does.
function OnWall({ s, pic, tint, backing, hole }: { s: Station; pic: Pic; tint: () => THREE.Color; backing?: { colour: string; pad: number }; hole?: Pic }) {
  const mat = usePicture(pic.src, tint), back = useFlat([backing?.colour ?? "#000000"], tint)[0];
  const dark = usePicture((hole ?? pic).src, tint);
  const w = pic.w / ART_PX, h = pic.h / FACE_PX, up = backing ? 0.7 : 0;
  return (
    <group position={[s.x, up + h / 2, s.y + 0.02]}>
      {backing && <mesh material={back} position={[0, 0, -0.005]} raycast={() => null}><planeGeometry args={[w + 2 * backing.pad, h + 2 * backing.pad]} /></mesh>}
      {hole && <mesh material={dark} position={[0, 0, -0.005]} raycast={() => null}><planeGeometry args={[w, h]} /></mesh>}
      <mesh material={mat} raycast={() => null}><planeGeometry args={[w, h]} /></mesh>
    </group>
  );
}
// The PvP portal: the Labyrinth's way in mirrored, its arch green over its dark hole, a green swirl across its
// mouth and its glow on the floor (the user, 2026-11-19).
function Portal({ s, tint, arch }: { s: Station; tint: () => THREE.Color; arch?: React.ReactNode }) {
  const swirl = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => { if (swirl.current) swirl.current.opacity = 0.55 + 0.15 * Math.sin(performance.now() / 420); });
  return (<>
    <mesh raycast={() => null} position={[s.x, 1.05, NOOK_N + 0.017]}><planeGeometry args={[1.95, 2.1]} />
      <meshBasicMaterial ref={swirl} color="#3f9a55" transparent opacity={0.6} depthWrite={false} /></mesh>
    {arch ? <><OnWall s={s} pic={PORTAL_HOLE} tint={tint} />{arch}</> : <OnWall s={s} pic={PORTAL_ARCH} hole={PORTAL_HOLE} tint={tint} />}
    <group position={[s.x, 0, s.y + 0.8]}><Glow colour={GREEN} radius={1.6} strength={0.35} /></group>
  </>);
}

// ── The Soul Altar (3D): a two-tier plinth of the Labyrinth's stone gone blue-grey, a black iron cauldron
// with the horned skull on its front, teal lanterns at the plinth's front corners, and the soul fire rising
// out of it, spirits and all (the old picture's), flickering; its teal glow on the floor.
function Altar({ at, tint, stretch }: { at: [number, number, number]; tint: () => THREE.Color; stretch: number }) {
  const blue = () => tint().multiply(new THREE.Color(0.62, 0.66, 0.85));
  const base = usePicture(PARTS.stone.src, blue, { repeat: [across(2, PARTS.stone), upFace(0.45, PARTS.stone)], see: false });
  const tier = usePicture(PARTS.stone.src, blue, { repeat: [across(1.5, PARTS.stone), upFace(0.35, PARTS.stone)], see: false });
  const [iron, rim, top] = useFlat(["#26252e", "#3a3946", "#33343d"], tint);
  const skull = usePicture(PARTS.skull.src, tint);
  const pot = useMemo(() => new THREE.LatheGeometry([[0.2, 0], [0.48, 0.08], [0.6, 0.3], [0.58, 0.58], [0.5, 0.7], [0.56, 0.74], [0.5, 0.78]].map(([r, y]) => new THREE.Vector2(r, y)), 14), []);
  const fire = useRef<THREE.Group>(null);
  useFrame(() => { const t = performance.now() / 260; if (fire.current) fire.current.scale.set(1 + 0.03 * Math.sin(t * 1.3), 1 + 0.06 * Math.sin(t), 1); });
  const fw = PARTS.fire.w / ART_PX, fh = (PARTS.fire.h / ART_PX) * stretch, lw = PARTS.lantern.w / ART_PX, lh = (PARTS.lantern.h / ART_PX) * stretch;
  const plinth = 0.8;
  return (
    <group position={at}>
      <mesh material={[base, base, top, top, base, base]} position={[0, 0.225, 0]} raycast={() => null}><boxGeometry args={[2, 0.45, 1.8]} /></mesh>
      <mesh material={[tier, tier, top, top, tier, tier]} position={[0, 0.45 + 0.175, 0]} raycast={() => null}><boxGeometry args={[1.5, 0.35, 1.35]} /></mesh>
      <mesh geometry={pot} material={iron} position={[0, plinth, 0]} raycast={() => null} />
      <mesh material={rim} position={[0, plinth + 0.78, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><ringGeometry args={[0.42, 0.56, 14]} /></mesh>
      <mesh material={skull} position={[0, plinth + 0.38, 0.62]} raycast={() => null}><planeGeometry args={[PARTS.skull.w / ART_PX, (PARTS.skull.h / FACE_PX) * 0.7]} /></mesh>
      {[-1, 1].map((k) => <Upright key={k} src={PARTS.lantern.src} x={k * 0.88} y={0.82} w={lw} h={lh} below={0} colour={new THREE.Color(1, 1, 1)} />)}
      <group ref={fire} position={[0, plinth + 0.62, 0.05]}><Upright src={PARTS.fire.src} x={0} y={0} w={fw} h={fh} below={0} colour={new THREE.Color(1, 1, 1)} /></group>
      <Glow colour={SOUL} radius={2.2} strength={0.3} />
    </group>
  );
}

// ── The healing pool (3D): a low ring of stones (the campfire's) round its water (the old picture's, lily pads
// and all), oval to its footprint, the water's teal glow over it.
function Pool({ at, w, d, tint }: { at: [number, number, number]; w: number; d: number; tint: () => THREE.Color }) {
  const water = usePicture(PARTS.water.src, () => new THREE.Color(1, 1, 1), { see: false });
  return (
    <group position={at} scale={[w / 2, 1, d / 2]}>
      <Ring wide={2} tall={0.2} top={CAMPFIRE_3D.rim} rim={CAMPFIRE_3D.rim} rimPx={CAMPFIRE_3D.rimPx} sides={20} colour={tint} />
      <mesh material={water} position={[0, 0.205, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><circleGeometry args={[0.84, 28]} /></mesh>
      <Glow colour={SOUL} radius={1} strength={0.3} y={0.21} />
    </group>
  );
}

// ── The Pit (3D): a square stone frame, dark below, an iron grate of bars across it.
function Pit({ at, w, d, tint }: { at: [number, number, number]; w: number; d: number; tint: () => THREE.Color }) {
  return (
    <group position={at}>
      <StoneFrame w={w} d={d} tall={0.35} thick={0.32} tint={tint} floor="#0b0908" />
      <Grate w={w - 0.64} d={d - 0.64} up={0.3} tint={tint} />
    </group>
  );
}
function Grate({ w, d, up, tint }: { w: number; d: number; up: number; tint: () => THREE.Color }) {
  const [iron, frame] = useFlat(["#3b352f", "#4c433b"], tint);
  const bars = 6, cross = 2;
  return (<>
    {Array.from({ length: bars }, (_, i) => -w / 2 + ((i + 1) * w) / (bars + 1)).map((x) => (
      <mesh key={`b${x}`} material={iron} position={[x, up, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}><cylinderGeometry args={[0.035, 0.035, d, 6]} /></mesh>
    ))}
    {Array.from({ length: cross }, (_, i) => -d / 2 + ((i + 1) * d) / (cross + 1)).map((z) => (
      <mesh key={`c${z}`} material={frame} position={[0, up + 0.02, z]} raycast={() => null}><boxGeometry args={[w, 0.05, 0.07]} /></mesh>
    ))}
  </>);
}

// ── The Sparring Pit (3D): a low stone wall round its sand, the dummy in the middle (the Training Pit, once
// built over it, with iron spikes along its wall).
function Sparring({ at, w, d, tint, stretch, spikes }: { at: [number, number, number]; w: number; d: number; tint: () => THREE.Color; stretch: number; spikes: boolean }) {
  const sand = usePicture(PARTS.sand.src, tint, { repeat: [across(w, PARTS.sand), across(d, PARTS.sand)], see: false });
  const iron = useFlat(["#2e2a26"], tint)[0];
  const thick = 0.3, tall = 0.3, dw = PARTS.dummy.w / ART_PX, dh = (PARTS.dummy.h / ART_PX) * stretch;
  const posts = spikes ? [...Array.from({ length: 5 }, (_, i) => [-w / 2 + thick / 2 + (i * (w - thick)) / 4, -d / 2 + thick / 2]), ...Array.from({ length: 5 }, (_, i) => [-w / 2 + thick / 2 + (i * (w - thick)) / 4, d / 2 - thick / 2]),
    ...[1, 2, 3].flatMap((i) => [[-w / 2 + thick / 2, -d / 2 + thick / 2 + (i * (d - thick)) / 4], [w / 2 - thick / 2, -d / 2 + thick / 2 + (i * (d - thick)) / 4]])] : [];
  return (
    <group position={at}>
      <StoneFrame w={w} d={d} tall={tall} thick={thick} tint={tint} />
      <mesh material={sand} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><planeGeometry args={[w - 2 * thick, d - 2 * thick]} /></mesh>
      {posts.map(([x, z], i) => <mesh key={i} material={iron} position={[x, tall + 0.18, z]} raycast={() => null}><coneGeometry args={[0.04, 0.36, 5]} /></mesh>)}
      <Upright src={PARTS.dummy.src} x={0} y={-0.2} w={dw} h={dh} below={0} colour={tint} />
    </group>
  );
}

// A low square wall of the Labyrinth's grey stone, `thick` deep, its middle open (and `floor` coloured there).
function StoneFrame({ w, d, tall, thick, tint, floor }: { w: number; d: number; tall: number; thick: number; tint: () => THREE.Color; floor?: string }) {
  const long = usePicture(PARTS.stone.src, tint, { repeat: [across(w, PARTS.stone), upFace(tall, PARTS.stone)], see: false });
  const short = usePicture(PARTS.stone.src, tint, { repeat: [across(d, PARTS.stone), upFace(tall, PARTS.stone)], see: false });
  const [cap, under] = useFlat(["#55544a", floor ?? "#000000"], tint);
  const side = (m: THREE.Material) => [m, m, cap, cap, m, m];
  return (<>
    {[-1, 1].map((k) => <mesh key={`z${k}`} material={side(long)} position={[0, tall / 2, k * (d / 2 - thick / 2)]} raycast={() => null}><boxGeometry args={[w, tall, thick]} /></mesh>)}
    {[-1, 1].map((k) => <mesh key={`x${k}`} material={side(short)} position={[k * (w / 2 - thick / 2), tall / 2, 0]} raycast={() => null}><boxGeometry args={[thick, tall, d - 2 * thick]} /></mesh>)}
    {floor && <mesh material={under} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><planeGeometry args={[w - 2 * thick, d - 2 * thick]} /></mesh>}
  </>);
}

// ── The old wall's socket: a waist-high stone post with a hollow in its top, where Klutz will set the
// Labyrinth Stone (glowing once you've the stone).
function Socket({ at, tint, ready, body }: { at: [number, number, number]; tint: () => THREE.Color; ready: boolean; body?: React.ReactNode }) {
  const stone = usePicture(PARTS.stone.src, tint, { repeat: [across(0.6, PARTS.stone), upFace(0.9, PARTS.stone)], see: false });
  const [cap, hollow] = useFlat(["#55544a", ready ? "#5fe0d0" : "#141210"], ready ? () => new THREE.Color(1, 1, 1) : tint);
  return (
    <>{body}<group position={at}>
      {!body && <mesh material={[stone, stone, cap, cap, stone, stone]} position={[0, 0.45, 0]} raycast={() => null}><boxGeometry args={[0.6, 0.9, 0.6]} /></mesh>}
      <mesh material={hollow} position={[0, 0.905, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><circleGeometry args={[0.18, 10]} /></mesh>
      {ready && <Glow colour={SOUL} radius={1.2} strength={0.35} />}
    </group></>
  );
}

// ── The wall moving away (the user, 2026-11-19: Klutz uses the Labyrinth Stone and the whole wall moves): the
// rock between the rooms, all of it, sinking into the floor over SINK seconds, the moment it goes.
export const SINK = 2.6;
export function MovingWall({ movedAt, wallFace }: { movedAt: React.RefObject<number | null>; wallFace: string }) {
  const group = useRef<THREE.Group>(null);
  const len = WALL_GAP.y1 - WALL_GAP.y0;
  const face = usePicture(wallFace, () => new THREE.Color(0.75, 0.68, 0.6), { repeat: [len * ART_PX / 48, (DEN_WALL * FACE_PX) / 72], see: false });
  const top = useFlat(["#2b2017"], () => new THREE.Color(1, 1, 1))[0];
  useFrame(() => {
    const g = group.current, t = movedAt.current === null ? Infinity : (performance.now() - movedAt.current) / 1000;
    if (!g) return;
    g.visible = t < SINK;
    const k = Math.min(1, t / SINK);
    g.position.y = -DEN_WALL * k * k;
  });
  return (
    <group ref={group} visible={false}>
      <mesh material={[face, face, top, top, face, face]} position={[DIVIDE_X, DEN_WALL / 2, (WALL_GAP.y0 + WALL_GAP.y1) / 2 - 0.5]} raycast={() => null}>
        <boxGeometry args={[1, DEN_WALL, len]} />
      </mesh>
    </group>
  );
}
