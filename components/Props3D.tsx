"use client";
// components/Props3D.tsx — things built in 3D (the user, 2026-11-11): the treasure chest
// (lib/render3d/chest3d.ts), a stash's sack and a library's bookcase (lib/render3d/props3d.ts), with
// PixelLab's flat faces on their boxes, a one-pixel dark outline and lit top edges, leaning as the
// rock does. Drawn by the walk view (components/WalkView3D.tsx) in place of their flat pictures, and
// by /lab/chest beside them. Each stands on y = 0, centred on its spot, facing south (z +).
// `colour` (the game's Stone): unlit, tinted by the light where it stands, as the sprites are;
// without it (the lab), lit by Three.js lights.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { chestArt, OPEN_ANGLE, ART_FACES, ART_PER_U } from "@/lib/render3d/chest3d";
import { bookcaseArt, BOOKCASE_FACES, sackOutline, sackOpenOutline, SACK_SIDES, SACK_CLOTH, SACK_NECK, SACK_TALL, type Prop3DKind } from "@/lib/render3d/props3d";

const OUTLINE_U = 1 / ART_PER_U; // the outline: an art pixel
const LID_EASE = 0.15;           // of the way the lid swings to where it's going, each frame
const DARK = "#141010";          // the undersides and the chest's bottom

// The walls' lean (decision 36): a point moves outwards by lean × its height × how far across from
// the camera's centre it is, so a thing across the screen shows a little of its end, as the walls
// do. Worked out from where the point is in the world, so a thing turned round still leans across
// the screen. Whoever draws them sets these each frame (the lean, and the camera's x).
export const PROP_LEAN = { uLean: { value: 0 }, uCx: { value: 0 } };
export function leaned<M extends THREE.Material>(m: M): M {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, PROP_LEAN);
    sh.vertexShader = "uniform float uLean;\nuniform float uCx;\n" + sh.vertexShader.replace("#include <project_vertex>",
      "vec4 mvPosition = modelMatrix * vec4(transformed, 1.0);\nmvPosition.x += uLean * (mvPosition.x - uCx) * mvPosition.y;\n" +
      "mvPosition = viewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;");
  };
  return m;
}
const HULL = leaned(new THREE.MeshBasicMaterial({ color: "#000", side: THREE.BackSide }));

export function sharp(t: THREE.Texture) {
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
}
// Pictures, loaded once (a dungeon has many chests and sacks), drawn sharp.
const LOADED = new Map<string, THREE.Texture>();
export function loaded(src: string, repeat = false): THREE.Texture {
  const key = `${src}|${repeat}`;
  let t = LOADED.get(key);
  if (!t) {
    t = new THREE.TextureLoader().load(src);
    sharp(t);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    LOADED.set(key, t);
  }
  return t;
}

// A painted box: each face shows part of a picture, columns [x0, x1) and rows [y0, y1) of a w × h
// picture (rows counted from the top), set in the box's UVs (BoxGeometry's faces: east, west, top,
// bottom, south, north; a top shows the picture's top row at the back). (A copy of a texture cut
// before its picture loaded stayed black, so the cut is in the UVs.)
type Part = { w: number; h: number; x0: number; x1: number; y0: number; y1: number };
function paintedBox(w: number, h: number, d: number, parts: Part[]): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.getAttribute("uv") as THREE.BufferAttribute;
  parts.forEach((p, face) => {
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, (p.x0 + uv.getX(i) * (p.x1 - p.x0)) / p.w, 1 - (p.y1 - uv.getY(i) * (p.y1 - p.y0)) / p.h);
    }
  });
  return g;
}

// A shape, and its outline: a black copy an art pixel bigger all round, drawn inside out behind it.
export function Solid({ geometry, material, at, size, outline }: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; at: [number, number, number]; size: [number, number, number]; outline: boolean }) {
  return (
    <group position={at}>
      <mesh geometry={geometry} material={material} raycast={() => null} />
      {outline && (
        <mesh geometry={geometry} material={HULL} raycast={() => null} scale={size.map((s) => (s + 2 * OUTLINE_U) / s) as [number, number, number]} />
      )}
    </group>
  );
}

// The faces' material: lit (the lab), or plain and tinted by the light where it stands (the game).
type Make = (o: { map?: THREE.Texture; color?: string; flatShading?: boolean; side?: THREE.Side }) => THREE.Material;
const makeLit: Make = (o) => leaned(new THREE.MeshLambertMaterial(o));
const makeFlat: Make = (o) => leaned(new THREE.MeshBasicMaterial({ map: o.map, color: o.color, side: o.side })); // (unlit: no shading to flatten)
const lit = (src: string, edges: boolean) => (edges ? src.replace(".png", "-lit.png") : src);

function tint(mats: THREE.Material[], base: Map<THREE.Material, THREE.Color>, colour?: THREE.Color) {
  if (!colour) return;
  for (const m of mats) if (m instanceof THREE.MeshBasicMaterial) m.color.copy(base.get(m) ?? WHITE).multiply(colour);
}
const WHITE = new THREE.Color(1, 1, 1);
// (Each material's own colour, kept to tint from.)
function bases(mats: THREE.Material[]) {
  return new Map(mats.flatMap((m) => (m instanceof THREE.MeshBasicMaterial ? [[m, m.color.clone()] as const] : [])));
}

export function Prop3D({ kind, open = false, colour, outline = true, edges = true }: { kind: Prop3DKind; open?: boolean; colour?: THREE.Color; outline?: boolean; edges?: boolean }) {
  if (kind === "bookcase") return <Bookcase colour={colour} outline={outline} edges={edges} />;
  if (kind === "stash") return <Sack open={open} colour={colour} outline={outline} />;
  return <Chest open={open} colour={colour} outline={outline} edges={edges} />;
}

// The chest: the body and lid as two painted boxes, the lid turning on its hinge along the back top
// edge. Open, the body's top is its inside (gold and gems). The lit edges (the top row of each front,
// the lid top's front row) and the lid's darker underside are made beforehand, in the `-lit` and
// `under` pictures beside the others.
function Chest({ open, colour, outline, edges }: { open: boolean; colour?: THREE.Color; outline: boolean; edges: boolean }) {
  const art = useMemo(() => chestArt(), []);
  const geo = useMemo(() => {
    const F = ART_FACES, fw = F.front.w, fh = F.front.h, split = F.front.lid;
    const front = (y0: number, y1: number): Part => ({ w: fw, h: fh, x0: 0, x1: fw, y0, y1 });
    const side = (y0: number, y1: number): Part => ({ w: F.side.w, h: F.side.h, x0: 0, x1: F.side.w, y0, y1 });
    const top: Part = { w: F.top.w, h: F.top.h, x0: 0, x1: F.top.w, y0: 0, y1: F.top.h };
    return {
      lid: paintedBox(art.width, art.lid, art.depth, [side(0, split), side(0, split), top, top, front(0, split), front(0, split)]),
      body: paintedBox(art.width, art.body, art.depth, [side(split, fh), side(split, fh), top, top, front(split, fh), front(split, fh)]),
    };
  }, [art]);
  const flat = !!colour;
  const mats = useMemo(() => {
    const make = flat ? makeFlat : makeLit, pic = (src: string) => make({ map: loaded(src) });
    const front = pic(lit(ART_FACES.front.src, edges)), side = pic(lit(ART_FACES.side.src, edges)), top = pic(lit(ART_FACES.top.src, edges));
    const under = pic(ART_FACES.top.src.replace("top.png", "under.png")), inside = pic(ART_FACES.inside.src), dark = make({ color: DARK });
    const all = [front, side, top, under, inside, dark];
    return { lid: [side, side, top, under, front, front], body: [side, side, inside, dark, front, front], all, base: bases(all) };
  }, [flat, edges]);
  tint(mats.all, mats.base, colour);
  const lid = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = lid.current;
    if (!g) return;
    const want = open ? -OPEN_ANGLE : 0, a = g.rotation.x;
    g.rotation.x = Math.abs(want - a) < 0.001 ? want : a + (want - a) * LID_EASE;
  });
  return (
    <>
      <Solid geometry={geo.body} material={mats.body} at={[0, art.body / 2, 0]} size={[art.width, art.body, art.depth]} outline={outline} />
      <group ref={lid} position={[0, art.body, -art.depth / 2]} rotation={[open ? -OPEN_ANGLE : 0, 0, 0]}>
        <Solid geometry={geo.lid} material={mats.lid} at={[0, art.lid / 2, art.depth / 2]} size={[art.width, art.lid, art.depth]} outline={outline} />
      </group>
    </>
  );
}

// The bookcase: one box, its faces PixelLab's (lit edges made beforehand, as the chest's).
function Bookcase({ colour, outline, edges }: { colour?: THREE.Color; outline: boolean; edges: boolean }) {
  const b = useMemo(() => bookcaseArt(), []);
  const geo = useMemo(() => new THREE.BoxGeometry(b.width, b.height, b.depth), [b]);
  const flat = !!colour;
  const mats = useMemo(() => {
    const F = BOOKCASE_FACES, make = flat ? makeFlat : makeLit, pic = (src: string) => make({ map: loaded(src) });
    const front = pic(lit(F.front.src, edges)), side = pic(lit(F.side.src, edges)), top = pic(lit(F.top.src, edges)), dark = make({ color: DARK });
    const all = [front, side, top, dark];
    return { faces: [side, side, top, dark, front, front], all, base: bases(all) };
  }, [flat, edges]);
  tint(mats.all, mats.base, colour);
  return <Solid geometry={geo} material={mats.faces} at={[0, b.height / 2, 0]} size={[b.width, b.height, b.depth]} outline={outline} />;
}

// The sack: its outline turned round (flat-shaded, so its few sides show as facets), in burlap laid
// about a unit of cloth to a unit round it, and a rope round its neck. Opened, it's untied: no rope,
// its mouth open (both sides of the cloth drawn, so you see into it).
function Sack({ open, colour, outline }: { open: boolean; colour?: THREE.Color; outline: boolean }) {
  const geo = useMemo(() => new THREE.LatheGeometry((open ? sackOpenOutline() : sackOutline()).map(([r, y]) => new THREE.Vector2(r, y)), SACK_SIDES), [open]);
  const rope = useMemo(() => new THREE.TorusGeometry(SACK_NECK.r + SACK_NECK.rope / 2, SACK_NECK.rope, 4, SACK_SIDES), []);
  const flat = !!colour;
  const mats = useMemo(() => {
    const make = flat ? makeFlat : makeLit, cloth = loaded(SACK_CLOTH.src, true); // (only the sack's: its repeat is set on it, not a copy)
    cloth.repeat.set(2, 0.5);
    const all = [make({ map: cloth, flatShading: true, side: open ? THREE.DoubleSide : THREE.FrontSide }), make({ color: "#8a6a44", flatShading: true })];
    return { cloth: all[0], rope: all[1], all, base: bases(all) };
  }, [flat, open]);
  tint(mats.all, mats.base, colour);
  const wide = 2 * Math.max(...sackOutline().map(([r]) => r));
  return (
    <>
      <Solid geometry={geo} material={mats.cloth} at={[0, 0, 0]} size={[wide, SACK_TALL, wide]} outline={outline} />
      {!open && (
        <group rotation={[Math.PI / 2, 0, 0]} position={[0, SACK_NECK.y, 0]}>
          <Solid geometry={rope} material={mats.rope} at={[0, 0, 0]} size={[0.2, 0.2, 0.05]} outline={false} />
        </group>
      )}
    </>
  );
}
