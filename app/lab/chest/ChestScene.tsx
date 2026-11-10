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
import { chestParts, chestArt, OPEN_ANGLE, ART_FACES, type Box, type ChestMat } from "@/lib/render3d/chest3d";
import { pixelScale } from "@/lib/render3d/stone";
import { uprightStretch, WALL_HEIGHT } from "@/lib/render3d/dungeon3d";
import { WALK_KIT, WALK_HERO, KIT_PX } from "@/lib/sprites/walk";
import { legacyU } from "@/lib/render/projection";
import { bookcaseArt, BOOKCASE_FACES, sackOutline, SACK_SIDES, SACK_CLOTH, SACK_NECK, SACK_TALL } from "@/lib/render3d/props3d";

const PITCH = Math.PI / 3;
const ART_PER_U = 48;
const OUTLINE_U = 1 / ART_PER_U; // the outline: an art pixel
const OLD_W = legacyU(28);       // the flat chest as the game draws it now (OBJECT_U)
// The flat sprites as the game draws them now, beside each: picture, width (units) and height for width.
const OLD: Record<Thing3D, { shut: string; open: string; w: number; tall: number }> = {
  chest: { shut: "/sprites/props/treasure_chest.png", open: "/sprites/props/treasure_chest_open.png", w: OLD_W, tall: 1 },
  stash: { shut: "/sprites/props/burlap_sack.png", open: "/sprites/props/burlap_sack_open.png", w: legacyU(16), tall: 1 },
  bookcase: { shut: "/sprites/den/bookcase-2.png", open: "/sprites/den/bookcase-2.png", w: legacyU(30), tall: 86 / 76 },
};
const PATCH = 17;                // units of floor and wall across (the screen is 15 at game zoom)

export type ChestView = { open: boolean; across: number; width: number; moving: boolean; old: boolean; art: boolean; outline: boolean; edges: boolean;
  at: number; lean: boolean; thing: Thing3D; turned: boolean };
export type Thing3D = "chest" | "stash" | "bookcase";

// The walls' lean (decision 36, WalkView3D's LEAN at GAME_VIEW's 0.03), on the chest and the wall
// here: a point moves outwards by lean × its height × how far across from you (x = 0) it is, so a
// chest across the screen shows a little of its side, as the walls do. Worked out from where the
// point is in the world (the chest's boxes are placed and its lid turned), applied before that.
const LEAN_U = 0.03;
const LEANING = { uLean: { value: LEAN_U }, uCx: { value: 0 } };
function leaned<M extends THREE.Material>(m: M): M {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LEANING);
    // (In the world, as the rock's is, so a thing turned round still leans across the screen.)
    sh.vertexShader = "uniform float uLean;\nuniform float uCx;\n" + sh.vertexShader.replace("#include <project_vertex>",
      "vec4 mvPosition = modelMatrix * vec4(transformed, 1.0);\nmvPosition.x += uLean * (mvPosition.x - uCx) * mvPosition.y;\n" +
      "mvPosition = viewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;");
  };
  return m;
}
const HULL = leaned(new THREE.MeshBasicMaterial({ color: "#000", side: THREE.BackSide }));

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

function sharp(t: THREE.Texture) {
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
}
function loaded(src: string, repeat = false): THREE.Texture {
  const t = new THREE.TextureLoader().load(src);
  sharp(t);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// A painted box: each face shows part of a picture, columns [x0, x1) and rows [y0, y1) of a w × h
// picture (rows counted from the top), set in the box's UVs (BoxGeometry's faces: east, west, top,
// bottom, south, north; a top shows the picture's top row at the back).
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

// A box, and its outline: a black copy an art pixel bigger all round, drawn inside out behind it.
function Solid({ geometry, material, at, size, outline }: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; at: [number, number, number]; size: [number, number, number]; outline: boolean }) {
  return (
    <group position={at}>
      <mesh geometry={geometry} material={material} />
      {outline && (
        <mesh geometry={geometry} material={HULL} scale={size.map((s) => (s + 2 * OUTLINE_U) / s) as [number, number, number]} />
      )}
    </group>
  );
}

function StandIn({ boxes, mats, outline }: { boxes: Box[]; mats: Record<ChestMat, THREE.Material>; outline: boolean }) {
  const geos = useMemo(() => boxes.map(boxGeometry), [boxes]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return <>{boxes.map((b, i) => <Solid key={i} geometry={geos[i]} material={mats[b.mat]} at={[b.x, b.y, b.z]} size={[b.w, b.h, b.d]} outline={outline} />)}</>;
}

// The painted body and lid: their boxes, and a material for each face. The lit edges (the top row of
// each front, the lid top's front row) and the lid's darker underside are made beforehand, in the
// pictures `-lit` and `under` beside the others.
function useArt(edges: boolean) {
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
  const mats = useMemo(() => {
    const lam = (src: string) => leaned(new THREE.MeshLambertMaterial({ map: loaded(src) }));
    const lit = (src: string) => (edges ? src.replace(".png", "-lit.png") : src);
    const front = lam(lit(ART_FACES.front.src)), side = lam(lit(ART_FACES.side.src)), top = lam(lit(ART_FACES.top.src)), under = lam(ART_FACES.top.src.replace("top.png", "under.png"));
    const inside = lam(ART_FACES.inside.src), dark = leaned(new THREE.MeshLambertMaterial({ color: "#141010" }));
    return { lid: [side, side, top, under, front, front], body: [side, side, inside, dark, front, front] };
  }, [edges]);
  return { art, geo, mats };
}

// The bookcase: one box, its faces PixelLab's (lit edges made beforehand, as the chest's).
function Bookcase({ outline, edges }: { outline: boolean; edges: boolean }) {
  const b = useMemo(() => bookcaseArt(), []);
  const geo = useMemo(() => new THREE.BoxGeometry(b.width, b.height, b.depth), [b]);
  const mats = useMemo(() => {
    const F = BOOKCASE_FACES, lam = (src: string) => leaned(new THREE.MeshLambertMaterial({ map: loaded(src) }));
    const lit = (src: string) => (edges ? src.replace(".png", "-lit.png") : src);
    const front = lam(lit(F.front.src)), side = lam(lit(F.side.src)), top = lam(lit(F.top.src)), dark = leaned(new THREE.MeshLambertMaterial({ color: "#141010" }));
    return [side, side, top, dark, front, front];
  }, [edges]);
  return <Solid geometry={geo} material={mats} at={[0, b.height / 2, 0]} size={[b.width, b.height, b.depth]} outline={outline} />;
}

// The sack: its outline turned round (flat-shaded, so its few sides show as facets), in burlap laid
// about a unit of cloth to a unit round it, and a rope round its neck.
function Sack({ outline }: { outline: boolean }) {
  const geo = useMemo(() => new THREE.LatheGeometry(sackOutline().map(([r, y]) => new THREE.Vector2(r, y)), SACK_SIDES), []);
  const rope = useMemo(() => new THREE.TorusGeometry(SACK_NECK.r + SACK_NECK.rope / 2, SACK_NECK.rope, 4, SACK_SIDES), []);
  const mats = useMemo(() => {
    const cloth = loaded(SACK_CLOTH.src, true);
    cloth.repeat.set(2, 0.5);
    return { cloth: leaned(new THREE.MeshLambertMaterial({ map: cloth, flatShading: true })), rope: leaned(new THREE.MeshLambertMaterial({ color: "#8a6a44", flatShading: true })) };
  }, []);
  const wide = 2 * Math.max(...sackOutline().map(([r]) => r));
  return (
    <>
      <Solid geometry={geo} material={mats.cloth} at={[0, 0, 0]} size={[wide, SACK_TALL, wide]} outline={outline} />
      <group rotation={[Math.PI / 2, 0, 0]} position={[0, SACK_NECK.y, 0]}>
        <Solid geometry={rope} material={mats.rope} at={[0, 0, 0]} size={[0.2, 0.2, 0.05]} outline={false} />
      </group>
    </>
  );
}

function Scene({ view }: { view: ChestView }) {
  const { size, setDpr } = useThree();
  const pix = pixelScale("art", ART_PER_U, view.across, size.width, window.devicePixelRatio || 1);
  useEffect(() => { setDpr(pix.dpr); }, [pix.dpr, setDpr]);

  const chest = useMemo(() => chestParts(view.width), [view.width]);
  const { art, geo: artGeo, mats: artMats } = useArt(view.edges);
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
  const old = useMemo(() => Object.fromEntries((Object.keys(OLD) as Thing3D[]).map((k) => [k, [loaded(OLD[k].shut), loaded(OLD[k].open)]])) as Record<Thing3D, THREE.Texture[]>, []);

  // You stand in the middle (the camera's on you); the chest `at` units across, the old one as far the other way.
  const chestX = view.at || 1, oldX = -(view.at || 1.3);
  const lid = useRef<THREE.Group>(null);
  const torch = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera;
    const target = new THREE.Vector3(0, 0.3, 0.5);
    LEANING.uLean.value = view.lean ? LEAN_U : 0;
    camera.position.copy(target).addScaledVector(new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)), 60);
    camera.zoom = size.width / pix.across;
    camera.near = 0.1; camera.far = 200;
    camera.lookAt(target); camera.updateProjectionMatrix();
    // The lid swings to where it's going, a little at a time.
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
  const hinge = view.art ? { y: art.body, z: -art.depth / 2 } : chest.hinge;
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
        {view.thing === "bookcase" && <Bookcase outline={view.outline} edges={view.edges} />}
        {view.thing === "stash" && <Sack outline={view.outline} />}
        {view.thing === "chest" && (<>
        {view.art
          ? <Solid geometry={artGeo.body} material={artMats.body} at={[0, art.body / 2, 0]} size={[art.width, art.body, art.depth]} outline={view.outline} />
          : <StandIn boxes={chest.body} mats={mats} outline={view.outline} />}
        <group ref={lid} position={[0, hinge.y, hinge.z]}>
          {view.art
            ? <Solid geometry={artGeo.lid} material={artMats.lid} at={[0, art.lid / 2, art.depth / 2]} size={[art.width, art.lid, art.depth]} outline={view.outline} />
            : <StandIn boxes={chest.lid} mats={mats} outline={view.outline} />}
        </group>
        </>)}
      </group>
      {view.old && (
        <mesh position={[oldX, (o.w * o.tall * stretch) / 2, 0.4]} scale={[o.w, o.w * o.tall * stretch, 1]}>
          <planeGeometry />
          <meshLambertMaterial map={old[view.thing][view.open ? 1 : 0]} alphaTest={0.5} transparent />
        </mesh>
      )}
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
