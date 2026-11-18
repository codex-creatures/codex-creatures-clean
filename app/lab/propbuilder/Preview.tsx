"use client";
// app/lab/propbuilder/Preview.tsx — 🧪 the prop as the game will draw it (components/PropRecipe3D.tsx): the game's
// camera (orthographic, facing north, `pitch` down), its pixel size (48 art pixels a unit at 15 units across,
// drawn that small and scaled up, as components/Den3D.tsx), its lean, on the Den's floor. The prop three times,
// near the left edge, in the middle and near the right edge, so the lean shows its sides as the game will; behind
// each, what the game draws there now, to match it against. Light: even, the Den's warm light, or the Labyrinth's
// torch (the game's own light field, lib/render3d/stone.ts, with you holding it beside each copy). Over it all,
// the prop's drawing (its recipe's `ref`), see-through, its `foot` pixel on the middle copy's origin at its true
// size; and the palette check (./PalettePass.tsx). For app/lab/propbuilder/Builder.tsx.

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Place } from "@/components/Den3DPlaces";
import { PROP_LEAN } from "@/components/Props3D";
import { PropRecipe3D } from "@/components/PropRecipe3D";
import { Upright, STONE } from "@/components/WalkView3D";
import { pixelScale, lightField, shadeAt } from "@/lib/render3d/stone";
import { uprightStretch } from "@/lib/render3d/dungeon3d";
import { FLOOR, type Floorplan } from "@/lib/dungeon/floorplan";
import { TORCH_RADIUS } from "@/lib/dungeon/torch";
import { WALK_HERO8, KIT_PX } from "@/lib/sprites/walk";
import { stations, type StationKey } from "@/lib/den3d/layout";
import { DENSITY, type Recipe } from "@/lib/props/recipe";
import type { PaletteKey } from "@/lib/props/palette";
import PalettePass from "./PalettePass";

export const ACROSS = 15;          // units across, as the game starts
export const LEAN = 0.03;          // the rock's lean (decision 36)
export const SPOTS = [-5.5, 0, 5.5]; // where the prop stands: near the left edge, the middle, near the right edge
const BEHIND = -4;                 // (the game's own one, a row back)
const FLOOR_ART = "/sprites/den3d/kit-floor.png";
const DEN_LIGHT = new THREE.Color(1, 0.86, 0.7); // 🧪 roughly the Den's warm light, even everywhere
const PLACES = stations({ opened: true, pit: true, trainingPit: false, repaired: true });
// The torch: you, standing in front of each copy and a little to its right, holding it (as in the Labyrinth).
const HOLD = { dx: 1.4, dz: 1.3 };
// The floor the light is worked out over: open floor all round (tiles; world x, z → tile x + OX, z + OZ).
const PLAN_W = 34, PLAN_H = 26, OX = PLAN_W / 2, OZ = PLAN_H / 2;

// The drawing over the view: `k` CSS pixels an art pixel, its foot pixel at (sx, sy).
function place(img: HTMLImageElement, foot: [number, number], k: number, sx: number, sy: number) {
  if (!img.naturalWidth) return;
  img.style.width = `${img.naturalWidth * k}px`;
  img.style.transform = `translate(${sx - foot[0] * k}px, ${sy - foot[1] * k}px)`;
  img.style.visibility = "visible";
}

export type LightMode = "even" | "den" | "torch";
export type Overlay = { show: boolean; opacity: number };
// `picked`, `onPick`: the part picked, and a tap on one (on the middle copy).
export type PreviewProps = {
  recipe: Recipe; compare?: StationKey; angle: number; light: LightMode; lean: boolean; palette: PaletteKey | null; overlay: Overlay;
  picked?: string | null; onPick?: (part: string) => void;
};

export default function Preview(p: PreviewProps) {
  const ref = useRef<HTMLImageElement>(null);
  const r = p.recipe.ref;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Canvas resize={{ offsetSize: true }} orthographic flat gl={{ antialias: false }}
        style={{ position: "absolute", inset: 0, background: "#000", imageRendering: "pixelated" }}>
        <Scene {...p} drawing={ref} />
      </Canvas>
      {r && p.overlay.show && (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={ref} src={r.src} alt="" draggable={false}
          style={{ position: "absolute", left: 0, top: 0, opacity: p.overlay.opacity, imageRendering: "pixelated", pointerEvents: "none", transformOrigin: "0 0", visibility: "hidden" }} />
      )}
    </div>
  );
}

function Scene({ recipe, compare, angle, light, lean, palette, picked, onPick, drawing }: PreviewProps & { drawing: React.RefObject<HTMLImageElement | null> }) {
  const { size, setDpr } = useThree();
  const pitch = (angle * Math.PI) / 180, stretch = uprightStretch(pitch);
  const pix = pixelScale("art", DENSITY, ACROSS, size.width, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);
  const old = compare && PLACES.find((s) => s.key === compare);

  // The light: one colour for each copy (as the game tints a thing by the light where it stands), and the floor's.
  const lit = useMemo(() => {
    if (light !== "torch") { const c = light === "den" ? DEN_LIGHT : new THREE.Color(1, 1, 1); return { copy: SPOTS.map(() => c), floor: null }; }
    const plan: Floorplan = { w: PLAN_W, h: PLAN_H, tiles: new Uint8Array(PLAN_W * PLAN_H).fill(FLOOR), rooms: {}, doors: [], tunnels: {} };
    const on = new Uint8Array(PLAN_W * PLAN_H).fill(1);
    const fields = SPOTS.map((x) => lightField(plan, on, { x: x + HOLD.dx + OX, y: HOLD.dz + OZ, r: TORCH_RADIUS, power: 1 }, [], OX, OZ));
    const shade = (i: number, x: number, z: number) => new THREE.Color().setRGB(...shadeAt(fields[i], null, PLAN_W, x + OX, z + OZ, STONE), THREE.SRGBColorSpace);
    return { copy: SPOTS.map((x, i) => shade(i, x, 0.5)), floor: (x: number, z: number) => { const c = SPOTS.map((_, i) => shade(i, x, z)); return new THREE.Color(Math.max(...c.map((q) => q.r)), Math.max(...c.map((q) => q.g)), Math.max(...c.map((q) => q.b))); } };
  }, [light]);
  const tints = useMemo(() => lit.copy.map((c) => () => c.clone()), [lit]);
  const floorGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(30, 20, 60, 40);
    g.rotateX(-Math.PI / 2);
    if (lit.floor) {
      const p = g.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const c = lit.floor(p.getX(i), p.getZ(i)); col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    }
    return g;
  }, [lit]);
  useEffect(() => () => floorGeo.dispose(), [floorGeo]);
  const floorTex = useMemo(() => {
    const t = new THREE.TextureLoader().load(FLOOR_ART);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(30, 20);
    return t;
  }, []);

  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    PROP_LEAN.uLean.value = lean ? LEAN : 0; PROP_LEAN.uCx.value = 0;
    if (camera instanceof THREE.OrthographicCamera) {
      const look = new THREE.Vector3(0, 0, BEHIND / 2);
      camera.position.set(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(60).add(look);
      camera.zoom = size.width / pix.across; camera.near = 0.1; camera.far = 200;
      camera.lookAt(look);
      camera.updateProjectionMatrix();
    }
    // The drawing: its foot pixel on the middle copy's origin, an art pixel the size of the game's.
    const r = recipe.ref;
    if (drawing.current && r) {
      v.set(0, 0, 0).project(camera);
      place(drawing.current, r.foot, size.width / (DENSITY * pix.across), ((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height);
    }
  });
  const hero = WALK_HERO8.cell / KIT_PX, heroH = hero * stretch, heroBelow = (1 - WALK_HERO8.feet / WALK_HERO8.cell) * heroH;
  return (
    <>
      <mesh geometry={floorGeo} raycast={() => null}>
        <meshBasicMaterial key={light} map={floorTex} color={light === "den" ? DEN_LIGHT : "#ffffff"} vertexColors={!!lit.floor} /> {/* (keyed: vertex colours need the shader rebuilt) */}
      </mesh>
      {SPOTS.map((x, i) => <PropRecipe3D key={x} recipe={recipe} at={[x, 0, 0]} pitch={pitch} stretch={stretch} tint={tints[i]} picked={picked} onPick={x === 0 ? onPick : undefined} />)}
      {old && SPOTS.map((x, i) => (
        <group key={`old${x}`} position={[x - old.x, 0, BEHIND - old.y]}>
          <Place s={old} tint={tints[i]} stretch={stretch} repaired trainingPit={false} stoneReady={false} />
        </group>
      ))}
      {light === "torch" && SPOTS.map((x, i) => (
        <Upright key={`you${x}`} src={`${WALK_HERO8.dir}/north-west.png`} x={x + HOLD.dx} y={HOLD.dz} w={hero} h={heroH} below={heroBelow} colour={tints[i]} />
      ))}
      {palette && <PalettePass pal={palette} />}
    </>
  );
}
