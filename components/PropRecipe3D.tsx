"use client";
// components/PropRecipe3D.tsx
// 🧪 A prop drawn from its recipe (lib/props/recipe.ts): each part's faces as flat polygons, painted with their
// crops at the art density, leaning as the rock does (Props3D's PROP_LEAN), unlit and tinted by the light where
// the prop stands as the game's 3D things are; a part that glows is drawn full bright; toon parts carry their
// band of light in each face's colour. /lab/propbuilder draws with it; the game will (world/art-pipeline.md §6.6).
// Each part is drawn from its own recipe object, and each face from its own, so changing one part or one face's
// texture rebuilds that part alone.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PROP_LEAN } from "@/components/Props3D";
import { texture } from "@/components/WalkView3D";
import { partFaces, type FacePoly, type Part, type Recipe } from "@/lib/props/recipe";

export type Tint = () => THREE.Color;

// The material's shader: the lean (as Props3D's `leaned`), and the picture read from the face's crop (whole
// numbers of the texture coordinates are the crop's edges, so "tile" repeats it and "fill" shows it once).
function faceMaterial(f: FacePoly): THREE.MeshBasicMaterial {
  const art = f.art, m = new THREE.MeshBasicMaterial({
    map: art.kind === "art" ? texture(art.src) : null, color: art.kind === "colour" ? art.colour : "#ffffff",
    vertexColors: true, alphaTest: 0.5, side: f.hull ? THREE.BackSide : f.twoSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  const crop = { value: new THREE.Vector4(...(art.kind === "art" ? art.crop : [0, 0, 1, 1])) }, tile = { value: art.kind === "art" && art.fit === "tile" ? 1 : 0 };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, PROP_LEAN, { uCrop: crop, uTile: tile });
    sh.vertexShader = "uniform float uLean;\nuniform float uCx;\n" + sh.vertexShader.replace("#include <project_vertex>",
      "vec4 mvPosition = modelMatrix * vec4(transformed, 1.0);\nmvPosition.x += uLean * (mvPosition.x - uCx) * mvPosition.y;\n" +
      "mvPosition = viewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;\n");
    sh.fragmentShader = "uniform vec4 uCrop;\nuniform float uTile;\n" + sh.fragmentShader.replace("#include <map_fragment>", `
      #ifdef USE_MAP
        vec2 size = vec2(textureSize(map, 0));
        vec2 f = uTile > 0.5 ? fract(vMapUv) : clamp(vMapUv, 0.0, 0.9999);
        vec4 sampledDiffuseColor = texture2D(map, vec2(uCrop.x + f.x * uCrop.z, size.y - uCrop.y - uCrop.w + f.y * uCrop.w) / size);
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
  m.customProgramCacheKey = () => "propRecipe";
  return m;
}

// A face's polygon as triangles (a fan: every face is flat and convex), its band of light in its colours.
function faceGeometry(f: FacePoly): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], col: number[] = [];
  for (let i = 1; i < f.points.length - 1; i++) for (const k of [0, i, i + 1]) { pos.push(...f.points[k]); uv.push(...f.uv[k]); col.push(f.shade, f.shade, f.shade); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

const WHITE = new THREE.Color(1, 1, 1);
// The face's own colour (a flat colour, or white under a picture) times its tint.
const baseOf = (f: FacePoly) => new THREE.Color(f.art.kind === "colour" ? f.art.colour : "#ffffff").multiply(new THREE.Color(f.art.tint));
// Its colour now: that, times the light where the prop stands unless it glows; a part picked in the builder
// pulses towards gold.
const PICKED = new THREE.Color("#ffd66e");
function paint(m: THREE.MeshBasicMaterial, base: THREE.Color, glow: boolean, light: THREE.Color, picked: boolean) {
  m.color.copy(base);
  if (!glow) m.color.multiply(light);
  if (picked) m.color.lerp(PICKED, 0.18 + 0.12 * Math.sin(performance.now() / 160)); // (soft: the picture still reads)
}

// (`onPick`: the builder's; tapping the face picks its part. Without it, taps go straight through, as the game's.)
type Pick = (part: string) => void;
// (A face is rebuilt only when what it draws changes: a part's faces are worked out afresh when the part changes,
// but each one that draws as before is handed back as the same object, so painting one face leaves the rest.)
const drawn = (f: FacePoly) => JSON.stringify([f.points, f.uv, f.art, f.shade, f.glow, f.twoSided]);
function reuse(before: Map<string, { f: FacePoly; sig: string }>, faces: FacePoly[]): FacePoly[] {
  const out = faces.map((f) => { const sig = drawn(f), old = before.get(f.key); return old && old.sig === sig ? old.f : (before.set(f.key, { f, sig }), f); });
  for (const k of [...before.keys()]) if (!faces.some((f) => f.key === k)) before.delete(k);
  return out;
}
const Face = memo(function Face({ f, tint, picked, onPick }: { f: FacePoly; tint?: Tint; picked: boolean; onPick?: Pick }) {
  const geo = useMemo(() => faceGeometry(f), [f]);
  const mat = useMemo(() => faceMaterial(f), [f]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  const base = useMemo(() => baseOf(f), [f]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) paint(ref.current.material as THREE.MeshBasicMaterial, base, f.glow || !!f.hull, tint ? tint() : WHITE, picked && !f.hull); });
  return onPick && !f.hull
    ? <mesh ref={ref} geometry={geo} material={mat} onClick={(e) => { e.stopPropagation(); onPick(f.part); }} />
    : <mesh ref={ref} geometry={geo} material={mat} raycast={() => null} />;
});

// One part: its faces worked out again only when the part (or the camera's angle) changes.
const RecipePart = memo(function RecipePart({ part, pitch, stretch, tint, picked, onPick }: { part: Part; pitch: number; stretch: number; tint?: Tint; picked: boolean; onPick?: Pick }) {
  const [before] = useState(() => new Map<string, { f: FacePoly; sig: string }>());
  const faces = useMemo(() => reuse(before, partFaces(part, { pitch, stretch })), [before, part, pitch, stretch]);
  return <>{faces.map((f) => <Face key={f.key} f={f} tint={tint} picked={picked} onPick={onPick} />)}</>;
});

// The prop, standing at `at` (its origin, the middle of its foot), facing south. `picked`, `onPick`: the
// builder's (the part picked, and a tap on a part).
export function PropRecipe3D({ recipe, at = [0, 0, 0], pitch, stretch, tint, picked, onPick }: { recipe: Recipe; at?: [number, number, number]; pitch: number; stretch: number; tint?: Tint;
  picked?: string | null; onPick?: Pick }) {
  return (
    <group position={at}>
      {recipe.parts.map((p) => <RecipePart key={p.id} part={p} pitch={pitch} stretch={stretch} tint={tint} picked={p.id === picked} onPick={onPick} />)}
    </group>
  );
}
