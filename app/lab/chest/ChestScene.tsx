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
import { CANDLE_AT } from "@/lib/render3d/props3d";
import { Draft3D, TableCandle3D, type DraftKind } from "@/components/Drafts3D";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { Rarity } from "@/lib/types";
import { legacyU } from "@/lib/render/projection";
import { Prop3D, Solid, leaned, sharp, loaded, PROP_LEAN } from "@/components/Props3D";

const PITCH = Math.PI / 3;
const ART_PER_U = 48;
const OLD_W = legacyU(28);       // the flat chest as the game draws it now (OBJECT_U)
// The flat sprites as the game draws them now, beside each: picture, width (units) and height for width.
const OLD: Partial<Record<Thing3D, { shut: string; open: string; w: number; tall: number }>> = {
  chest: { shut: "/sprites/props/treasure_chest.png", open: "/sprites/props/treasure_chest_open.png", w: OLD_W, tall: 1 },
  stash: { shut: "/sprites/props/burlap_sack.png", open: "/sprites/props/burlap_sack_open.png", w: legacyU(16), tall: 1 },
  bookcase: { shut: "/sprites/den/bookcase-2.png", open: "/sprites/den/bookcase-2.png", w: legacyU(30), tall: 86 / 76 },
  table: { shut: TABLE_ART.src, open: TABLE_ART.src, w: OBJECT_U, tall: TABLE_ART.h / TABLE_ART.w },
  deck: { shut: "/sprites/props/card_deck.png", open: "/sprites/props/card_deck.png", w: OBJECT_U, tall: 58 / 55 },
  // The drafts' old pictures (Drafts3D), as the game draws them now. (Rubble has none: it's drawn in code.)
  strongbox: { shut: "/sprites/props/rickety_chest.png", open: "/sprites/props/rickety_chest_open.png", w: OBJECT_U, tall: 53 / 56 },
  broken: { shut: "/sprites/den/bookcase-2.png", open: "/sprites/den/bookcase-2.png", w: legacyU(30), tall: 86 / 76 },
  gem: { shut: "/sprites/walk/healing-pool.png", open: "/sprites/walk/healing-pool.png", w: legacyU(40), tall: 48 / 64 },
  campfire: { shut: "/sprites/walk/campfire.png", open: "/sprites/walk/campfire-out.png", w: legacyU(24), tall: 1 },
  cage: { shut: "/sprites/walk/cage.png", open: "/sprites/walk/cage-open.png", w: legacyU(22), tall: 1 },
  lectern: { shut: "/sprites/den/lectern.png", open: "/sprites/den/lectern.png", w: legacyU(20), tall: 56 / 48 },
  floortorch: { shut: KIT_LIGHTS.candles, open: KIT_LIGHTS.candles, w: (KIT_LIGHTS.candleSize[0] * 0.85) / 48, tall: KIT_LIGHTS.candleSize[1] / KIT_LIGHTS.candleSize[0] },
};
const DRAFTS: Thing3D[] = ["strongbox", "broken", "gem", "campfire", "cage", "lectern", "floortorch", "torch"];
const PATCH = 17;                // units of floor and wall across (the screen is 15 at game zoom)

export type ChestView = { open: boolean; across: number; width: number; moving: boolean; old: boolean; art: boolean; outline: boolean; edges: boolean;
  at: number; lean: boolean; thing: Thing3D; turned: boolean; candle: boolean; rarity: Rarity; lit: boolean; life: boolean; splash: number };
// table: a rickety table (a candle on it, or not); deck: the cards room's table, the deck on it glowing its rarest card's colour;
// the rest: the drafts of the dungeon's other things (components/Drafts3D.tsx).
export type Thing3D = "chest" | "stash" | "bookcase" | "table" | "deck" | DraftKind;

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

// 🧪 Floor life (the user, 2026-11-13): PixelLab samples (public/sprites/walk/samples/floor-life) on
// the floor and wall. A wet puddle, flat on the floor and shiny, so the torch glints off it as it moves;
// a mouse hole at the foot of the wall; and a rat that runs along the wall and dives into the hole,
// then comes out again. Samples only: the game doesn't draw them.
const LIFE = "/sprites/walk/samples/floor-life";
const WALL_FRONT = -2;          // the wall's face (its box stands at z -3, 2 deep)
const HOLE_X = 3.5, RAT_LONG = 0.6;
const RAT_RUN = 5, RAT_HIDE = 2; // seconds along the wall, then in the hole
// The puddle's reflection, drawn by hand (the game lights nothing with Three's lights, so a shiny
// material shows nothing there): a soft glint of the light's colour where a mirror on the floor would
// show it (the light's spot, nearer you by its height ÷ tan(pitch)), shimmering a little, and a faint
// sheen as it comes near. Only on the water: pixels bluer than they're red or green.
const GLINT = { radius: 0.4, strength: 1.2, sheen: 0.3, sheenReach: 1.6 };
// Ripples (the user, 2026-11-13: when you walk in it): three rings spreading from where you stepped,
// RIPPLE.speed u a second, fading out over RIPPLE.life seconds, lighter on the water (and bending the glint).
// In the lab a step is the button (at the middle) or every RIPPLE.every seconds a small one somewhere.
const RIPPLE = { speed: 0.55, life: 1.6, width: 0.05, rings: 3, gap: 0.12, light: 0.35, every: 3.5 };
const GLINT_VERT = `varying vec2 vUv; varying vec3 vWorld;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GLINT_FRAG = `uniform sampler2D map; uniform vec3 uLight; uniform vec3 uColour; uniform float uTime; uniform float uTan;
uniform float uRadius; uniform float uStrength; uniform float uSheen; uniform float uReach;
uniform vec3 uStep; uniform float uSpeed; uniform float uLife; uniform float uWidth; uniform float uGap; uniform float uLit;
varying vec2 vUv; varying vec3 vWorld;
void main() {
  vec4 c = texture2D(map, vUv);
  float water = smoothstep(0.02, 0.09, c.b - max(c.r, c.g)) * step(0.5, c.a);
  // Rings from the last step (uStep: x, z, when): each a thin band moving out, fading as it goes.
  float age = uTime - uStep.z, rings = 0.0;
  if (age >= 0.0 && age < uLife) {
    float from = distance(vWorld.xz, uStep.xy);
    for (int i = 0; i < ${RIPPLE.rings}; i++) {
      float r = age * uSpeed - float(i) * uGap;
      if (r > 0.0) rings += exp(-pow((from - r) / uWidth, 2.0)) * (1.0 - age / uLife);
    }
  }
  vec2 mirror = vec2(uLight.x, uLight.z + uLight.y / uTan);
  float d = distance(vWorld.xz, mirror) - rings * 0.06;
  float shimmer = 0.75 + 0.25 * sin(vWorld.x * 23.0 + uTime * 2.7) * sin(vWorld.z * 19.0 - uTime * 2.1);
  float glint = exp(-d * d / (uRadius * uRadius)) * uStrength * shimmer;
  float near = distance(vWorld.xz, uLight.xz);
  float sheen = uSheen * exp(-near * near / (uReach * uReach));
  gl_FragColor = vec4(uColour * (glint + sheen + rings * uLit) * water, 1.0);
}`;
function PuddleGlint({ map, light, size, at, splash }: { map: THREE.Texture; light: React.RefObject<THREE.PointLight | null>; size: [number, number]; at: [number, number, number]; splash: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: GLINT_VERT, fragmentShader: GLINT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { map: { value: map }, uLight: { value: new THREE.Vector3() }, uColour: { value: new THREE.Color("#ffc68a") }, uTime: { value: 0 },
      uTan: { value: Math.tan(PITCH) }, uRadius: { value: GLINT.radius }, uStrength: { value: GLINT.strength }, uSheen: { value: GLINT.sheen }, uReach: { value: GLINT.sheenReach },
      uStep: { value: new THREE.Vector3(at[0], at[2], -99) }, uSpeed: { value: RIPPLE.speed }, uLife: { value: RIPPLE.life },
      uWidth: { value: RIPPLE.width }, uGap: { value: RIPPLE.gap }, uLit: { value: RIPPLE.light } },
  }), [map, at]);
  // A step: the button's (at the middle), or now and then a small one somewhere on the water.
  // (Its uniforms change each frame through a ref: React's rules keep the memo itself unchanged.)
  const stepped = useRef(splash), last = useRef(0), live = useRef(mat);
  useEffect(() => { live.current = mat; }, [mat]);
  useFrame((state) => {
    const u = live.current.uniforms, now = state.clock.elapsedTime, step = u.uStep.value as THREE.Vector3;
    if (light.current) u.uLight.value.copy(light.current.position);
    u.uTime.value = now;
    if (stepped.current !== splash) { stepped.current = splash; step.set(at[0], at[2], now); last.current = now; }
    else if (now - last.current > RIPPLE.every) { step.set(at[0] + (Math.random() - 0.5) * size[0] * 0.5, at[2] + (Math.random() - 0.5) * size[1] * 0.4, now); last.current = now; }
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[at[0], at[1] + 0.005, at[2]]} material={mat}>
      <planeGeometry args={size} />
    </mesh>
  );
}

function FloorLife({ light, splash }: { light: React.RefObject<THREE.PointLight | null>; splash: number }) {
  const tex = useMemo(() => ({ puddle: loaded(`${LIFE}/puddle.png`), rat: loaded(`${LIFE}/rat.png`), hole: loaded(`${LIFE}/mouse-hole-cut.png`) }), []);
  const rat = useRef<THREE.Group>(null);
  const puddleSize = useMemo((): [number, number] => [64 / 48, 48 / 48 / Math.sin(PITCH)], []), puddleAt = useMemo((): [number, number, number] => [1.8, 0.01, 2.3], []);
  useFrame((state) => {
    const g = rat.current;
    if (!g) return;
    // Along the wall from the left to the hole, then into it (out of sight), and round again.
    const t = state.clock.elapsedTime % (RAT_RUN + RAT_HIDE), lane = WALL_FRONT + 0.45;
    g.visible = t < RAT_RUN + 0.3;
    if (t < RAT_RUN) { g.position.set(-6 + (HOLE_X + 6) * (t / RAT_RUN), 0.02, lane); g.rotation.y = Math.PI / 2; }
    else { g.position.set(HOLE_X, 0.02, lane - ((t - RAT_RUN) / 0.3) * 0.45); g.rotation.y = Math.PI; }
  });
  const stretch = uprightStretch(PITCH);
  return (
    <>
      {/* The puddle: 64 × 48 art, a unit to 48 px, laid flat, and the light's glint on its water. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={puddleAt}>
        <planeGeometry args={puddleSize} />
        <meshLambertMaterial map={tex.puddle} transparent alphaTest={0.1} />
      </mesh>
      <PuddleGlint map={tex.puddle} light={light} size={puddleSize} at={puddleAt} splash={splash} />
      {/* The mouse hole: its 24 px cut, half a unit, at the foot of the wall. */}
      <mesh position={[HOLE_X, (0.5 * stretch) / 2, WALL_FRONT + 0.01]} scale={[0.5, 0.5 * stretch, 1]}>
        <planeGeometry />
        <meshLambertMaterial map={tex.hole} />
      </mesh>
      {/* The rat: its picture is from above (head down the picture), so it lies on the floor and turns the way it runs. */}
      <group ref={rat}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[RAT_LONG * (48 / 36), RAT_LONG]} />
          <meshLambertMaterial map={tex.rat} transparent alphaTest={0.5} />
        </mesh>
      </group>
    </>
  );
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
  const old = useMemo(() => Object.fromEntries((Object.keys(OLD) as Thing3D[]).map((k) => [k, [loaded(OLD[k]!.shut), loaded(OLD[k]!.open)]])) as Partial<Record<Thing3D, THREE.Texture[]>>, []);

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
          : DRAFTS.includes(view.thing)
            ? <Draft3D kind={view.thing as DraftKind} open={view.open} outline={view.outline} lit={view.lit} />
          : view.thing === "table" || view.thing === "deck"
            ? (<>
              <Prop3D kind="table" outline={view.outline} deck={view.thing === "deck" && !view.open} glow={RARITY_COLORS[view.rarity].text} />
              {view.thing === "table" && view.candle && <TableCandle3D x={CANDLE_AT} top={TABLE_TOP} />}
            </>)
            : <Prop3D kind={view.thing as "chest" | "stash" | "bookcase"} open={view.open} outline={view.outline} edges={view.edges} />}
      </group>
      {view.old && o && (
        <mesh position={[oldX, (o.w * o.tall * stretch) / 2, 0.4]} scale={[o.w, o.w * o.tall * stretch, 1]}>
          <planeGeometry />
          <meshLambertMaterial map={old[view.thing]![view.thing === "campfire" ? (view.lit ? 0 : 1) : view.open ? 1 : 0]} alphaTest={0.5} transparent />
        </mesh>
      )}
      {view.life && <FloorLife light={torch} splash={view.splash} />}
      <mesh position={[0, heroH / 2 - below, 1.5]} scale={[heroW, heroH, 1]}>
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
