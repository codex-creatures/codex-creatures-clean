"use client";
// app/lab/propreview/ReviewScene.tsx — 🧪 the props built from recipes (lib/props/recipes/), standing in a row on
// the Den's floor under the game's camera at its pixel size (48 art pixels a unit), for walking round as the game's
// torchbearer (WALK_HERO8, sized as WalkView3D sizes you), the camera following and the rock's lean about it.
// Light (the user, 2026-11-19: "always produce the item in a lab setting with lighting and me with the ability to
// move around"): the Den's (a key light from the upper left, a warm ambient, your torch), the torch alone (the
// Labyrinth's dark), or the game's flat look as it is today (unlit, tinted), to compare. Nothing is saved.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { uprightStretch } from "@/lib/render3d/dungeon3d";
import { pixelScale } from "@/lib/render3d/stone";
import { WALK_HERO8, KIT_PX } from "@/lib/sprites/walk";
import { FACINGS8, facing8, type Facing8 } from "@/lib/dungeon/tileArt";
import { loaded, PROP_LEAN } from "@/components/Props3D";
import { PropRecipe3D } from "@/components/PropRecipe3D";
import { recipeReach, DENSITY, type Recipe } from "@/lib/props/recipe";
import { walkTo, type Walk, type LightMode } from "./walk";

export const GAP = 5;            // u between props
const LEAN = 0.03;               // the rock's lean (decision 36)
const SPEED = 2.2;               // u a second, walking
const BODY = 0.28;               // u round your feet
const NEAR = 2.2;                // u: close enough to name it
const FLOOR = "/sprites/den3d/kit-floor.png";
const DEN_TINT = new THREE.Color(1, 0.86, 0.7); // (the game look's warm Den light, even everywhere)
// The lights. 🧪 Den: a warm key light from the upper left, in front (as the art spec's light), a warm ambient; your
// torch either way (as the props lab's: warm, falling off).
export const LIGHTS = { key: { colour: "#ffe2bd", den: 3.2, at: [-5, 7, 4] as const }, ambient: { colour: "#ffd9b0", den: 0.55, torch: 0.03 }, torch: { colour: "#ffc68a", power: 8, decay: 1.8 } };

export const spotOf = (i: number, n: number) => ({ x: (i - (n - 1) / 2) * GAP, z: 0 });


export default function ReviewScene({ recipes, light, across, walk }: { recipes: Recipe[]; light: LightMode; across: number; walk: Walk }) {
  return (
    <Canvas resize={{ offsetSize: true }} orthographic flat gl={{ antialias: false }}
      style={{ position: "absolute", inset: 0, background: "#000", imageRendering: "pixelated", touchAction: "none" }}>
      <Scene recipes={recipes} light={light} across={across} walk={walk} />
    </Canvas>
  );
}

function Scene({ recipes, light, across, walk }: { recipes: Recipe[]; light: LightMode; across: number; walk: Walk }) {
  const { size, setDpr } = useThree();
  const pitch = Math.PI / 3, stretch = uprightStretch(pitch);
  const pix = pixelScale("art", DENSITY, across, size.width, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);
  const reach = useMemo(() => recipes.map((r) => recipeReach(r, { pitch, stretch })), [recipes, pitch, stretch]);
  const width = Math.max(40, recipes.length * GAP + 20), depth = 30; // (floor past the view every way)
  const me = useRef({ x: 0, z: 3, f: "north" as Facing8, near: null as number | null });
  const floorTex = useMemo(() => {
    const t = loaded(FLOOR).clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(width, depth); t.needsUpdate = true;
    return t;
  }, [width, depth]);
  const lit = light !== "game", tint = useMemo(() => () => DEN_TINT.clone(), []);
  return (
    <>
      <Camera me={me} pitch={pitch} pix={pix.across} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1]} onPointerDown={(e) => walkTo(walk, e.point.x, e.point.z)}>
        <planeGeometry args={[width, depth]} />
        {lit ? <meshLambertMaterial key="lit" map={floorTex} /> : <meshBasicMaterial key="flat" map={floorTex} color={DEN_TINT} />}
      </mesh>
      {recipes.map((r, i) => <PropRecipe3D key={r.id} recipe={r} at={[spotOf(i, recipes.length).x, 0, 0]} pitch={pitch} stretch={stretch} lit={lit} tint={lit ? undefined : tint} />)}
      {light === "den" && <directionalLight color={LIGHTS.key.colour} intensity={LIGHTS.key.den} position={[...LIGHTS.key.at]} />}
      {lit && <ambientLight color={LIGHTS.ambient.colour} intensity={light === "den" ? LIGHTS.ambient.den : LIGHTS.ambient.torch} />}
      <Hero me={me} walk={walk} recipes={recipes} reach={reach} width={width} lit={lit} />
    </>
  );
}

// The camera: the game's (orthographic, from the south, 60° down), following you, the rock's lean about it.
function Camera({ me, pitch, pix }: { me: React.RefObject<{ x: number; z: number }>; pitch: number; pix: number }) {
  const { size } = useThree();
  useFrame(({ camera }) => {
    const m = me.current, look = new THREE.Vector3(Math.round(m.x * DENSITY) / DENSITY, 0, m.z - 1.2);
    PROP_LEAN.uLean.value = LEAN; PROP_LEAN.uCx.value = look.x;
    if (camera instanceof THREE.OrthographicCamera) {
      camera.position.set(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(60).add(look);
      camera.zoom = size.width / pix; camera.near = 0.1; camera.far = 200;
      camera.lookAt(look); camera.updateProjectionMatrix();
    }
  });
  return null;
}

// You: the 8-way hero's still for the way you're heading, on your feet; your torch's light when lit.
function Hero({ me, walk, recipes, reach, width, lit }: { me: React.RefObject<{ x: number; z: number; f: Facing8; near: number | null }>; walk: Walk; recipes: Recipe[]; reach: [number, number][]; width: number; lit: boolean }) {
  const stretch = uprightStretch(Math.PI / 3), w = WALK_HERO8.cell / KIT_PX, h = w * stretch, below = (1 - WALK_HERO8.feet / WALK_HERO8.cell) * h;
  const tex = useMemo(() => Object.fromEntries(FACINGS8.map((d) => [d, loaded(`${WALK_HERO8.dir}/${d}.png`)])) as Record<Facing8, THREE.Texture>, []);
  const mat = useRef<THREE.MeshBasicMaterial>(null), mesh = useRef<THREE.Mesh>(null), torch = useRef<THREE.PointLight>(null);
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current.add(e.key.toLowerCase()); if (e.key.startsWith("Arrow")) e.preventDefault(); };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useFrame((state, dt) => step(me.current, keys.current, walk, recipes, reach, width, dt, state.clock.elapsedTime, { mesh: mesh.current, mat: mat.current, torch: torch.current, tex, h, below }));
  return (<>
    <mesh ref={mesh} scale={[w, h, 1]} raycast={() => null}><planeGeometry /><meshBasicMaterial ref={mat} map={tex.north} alphaTest={0.5} transparent /></mesh>
    {lit && <pointLight ref={torch} color={"#ffc68a"} intensity={7} distance={0} decay={1.6} />}
  </>);
}

// A frame of walking (kept out of the component: it moves three's objects about).
function step(m: { x: number; z: number; f: Facing8; near: number | null }, k: Set<string>, walk: Walk, recipes: Recipe[], reach: [number, number][], width: number, dt: number, t: number,
  o: { mesh: THREE.Mesh | null; mat: THREE.MeshBasicMaterial | null; torch: THREE.PointLight | null; tex: Record<Facing8, THREE.Texture>; h: number; below: number }) {
  const n = recipes.length;
  // (Going to a prop: you stand at its front right, facing it, so you don't hide its front.)
  if (walk.jump !== null) { const s = spotOf(walk.jump, n); m.x = s.x + reach[walk.jump][0] * 0.7 + 0.6; m.z = s.z + reach[walk.jump][1] + 0.9; m.f = "north-west"; walk.jump = null; walk.target = null; }
  let dx = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
  let dz = (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0);
  if (walk.push) { dx = walk.push.x; dz = walk.push.y; }
  if (dx || dz) walk.target = null;
  else if (walk.target) { const tx = walk.target.x - m.x, tz = walk.target.z - m.z, d = Math.hypot(tx, tz); if (d < 0.08) walk.target = null; else { dx = tx / d; dz = tz / d; } }
  const len = Math.hypot(dx, dz);
  if (len > 0.1) {
    const go = Math.min(0.05, dt) * SPEED * Math.min(1, len);
    const room = Math.max(1, n) * GAP / 2 + 4; // (round the props, not off into the dark)
    let x = Math.max(-room, Math.min(room, m.x + (dx / len) * go)), z = Math.max(-6, Math.min(8, m.z + (dz / len) * go));
    // Not into a prop: out of its reach (yours added), by the shorter way out.
    for (let i = 0; i < n; i++) {
      const s = spotOf(i, n), ax = reach[i][0] + BODY, az = reach[i][1] + BODY, ox = x - s.x, oz = z - s.z;
      if (Math.abs(ox) >= ax || Math.abs(oz) >= az) continue;
      if (ax - Math.abs(ox) < az - Math.abs(oz)) x = s.x + Math.sign(ox || 1) * ax; else z = s.z + Math.sign(oz || 1) * az;
    }
    m.x = x; m.z = z; m.f = facing8(dx, dz, m.f);
  }
  o.mesh?.position.set(m.x, o.h / 2 - o.below, m.z + 0.05);
  if (o.mat && o.mat.map !== o.tex[m.f]) { o.mat.map = o.tex[m.f]; o.mat.needsUpdate = true; }
  if (o.torch) { o.torch.position.set(m.x + 0.3, 1.6, m.z + 0.4); o.torch.intensity = LIGHTS.torch.power * (0.93 + 0.05 * Math.sin(t * 9) + 0.02 * Math.sin(t * 23)); }
  let best: number | null = null, bd = NEAR;
  for (let i = 0; i < n; i++) { const s = spotOf(i, n), d = Math.hypot(s.x - m.x, s.z - m.z) - Math.max(...reach[i]); if (d < bd) { bd = d; best = i; } }
  if (best !== m.near) { m.near = best; walk.near(best); }
}
