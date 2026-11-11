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
import { chestArt, OPEN_ANGLE, ART_FACES, ART_PER_U, CHEST_NUDGE, type ChestFaces } from "@/lib/render3d/chest3d";
import { bookcaseArt, BOOKCASE_FACES, sackOutline, sackOpenOutline, SACK_SIDES, SACK_CLOTH, SACK_NECK, SACK_TALL, BROKEN_BOOKCASE_FACES, tableArt, TABLE_FACES, DECK_TALL, LEG_IN, DECK_AT, DECK_GLOW, type Prop3DKind, type BookcaseFaces } from "@/lib/render3d/props3d";
import { CANDLE_RADIUS } from "@/lib/dungeon/torch";

const OUTLINE_U = 1 / ART_PER_U; // the outline: an art pixel
const LID_EASE = 0.15;           // of the way the lid swings to where it's going, each frame
const DARK = "#141010";          // the undersides and the chest's bottom

// The walls' lean (decision 36): a point moves outwards by lean × its height × how far across from
// the camera's centre it is, so a thing across the screen shows a little of its end, as the walls
// do. Worked out from where the point is in the world, so a thing turned round still leans across
// the screen. Whoever draws them sets these each frame (the lean, and the camera's x).
export const PROP_LEAN = { uLean: { value: 0 }, uCx: { value: 0 } };
// `nudge` (u): drawn that much nearer the camera in depth only, where it shows unchanged (the chest: CHEST_NUDGE).
export function leaned<M extends THREE.Material>(m: M, nudge = 0): M {
  const near = nudge ? `vec4 nearer = projectionMatrix * (mvPosition + vec4(0.0, 0.0, ${nudge.toFixed(3)}, 0.0));\ngl_Position.z = nearer.z / nearer.w * gl_Position.w;\n` : "";
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, PROP_LEAN);
    sh.vertexShader = "uniform float uLean;\nuniform float uCx;\n" + sh.vertexShader.replace("#include <project_vertex>",
      "vec4 mvPosition = modelMatrix * vec4(transformed, 1.0);\nmvPosition.x += uLean * (mvPosition.x - uCx) * mvPosition.y;\n" +
      "mvPosition = viewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;\n" + near);
  };
  m.customProgramCacheKey = () => `leaned${nudge}`;
  return m;
}
const hull = (nudge = 0) => leaned(new THREE.MeshBasicMaterial({ color: "#000", side: THREE.BackSide }), nudge);
const HULL = hull(), CHEST_HULL = hull(CHEST_NUDGE);

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
export function Solid({ geometry, material, at, size, outline, hull = HULL }: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; at: [number, number, number]; size: [number, number, number]; outline: boolean; hull?: THREE.Material }) {
  return (
    <group position={at}>
      <mesh geometry={geometry} material={material} raycast={() => null} />
      {outline && (
        <mesh geometry={geometry} material={hull} raycast={() => null} scale={size.map((s) => (s + 2 * OUTLINE_U) / s) as [number, number, number]} />
      )}
    </group>
  );
}

// The faces' material: lit (the lab), or plain and tinted by the light where it stands (the game).
type Make = (o: { map?: THREE.Texture; color?: string; flatShading?: boolean; side?: THREE.Side }, nudge?: number) => THREE.Material;
const makeLit: Make = (o, nudge) => leaned(new THREE.MeshLambertMaterial(o), nudge);
const makeFlat: Make = (o, nudge) => leaned(new THREE.MeshBasicMaterial({ map: o.map, color: o.color, side: o.side }), nudge); // (unlit: no shading to flatten)
const lit = (src: string, edges: boolean) => (edges ? src.replace(".png", "-lit.png") : src);

// `colour`: the light's colour, or (the game) where to read it each frame, so a thing follows the
// light as the floor round it does (your torch as you walk, a fire's flicker), not only when the
// list of things is drawn again.
export type Tint = THREE.Color | (() => THREE.Color);
function tint(mats: THREE.Material[], base: Map<THREE.Material, THREE.Color>, colour?: Tint) {
  if (!colour) return;
  const c = typeof colour === "function" ? colour() : colour;
  for (const m of mats) if (m instanceof THREE.MeshBasicMaterial) m.color.copy(base.get(m) ?? WHITE).multiply(c);
}
function useTint(mats: THREE.Material[], base: Map<THREE.Material, THREE.Color>, colour?: Tint) {
  tint(mats, base, colour);
  useFrame(() => { if (typeof colour === "function") tint(mats, base, colour); });
}
const WHITE = new THREE.Color(1, 1, 1);
// (Each material's own colour, kept to tint from.)
function bases(mats: THREE.Material[]) {
  return new Map(mats.flatMap((m) => (m instanceof THREE.MeshBasicMaterial ? [[m, m.color.clone()] as const] : [])));
}

// `deck`: a table with the deck of cards on it; `glow`: the colour of the rarest card in it (a CSS colour);
// `broken`: a broken bookcase.
export function Prop3D({ kind, open = false, colour, outline = true, edges = true, deck = false, glow, broken = false }: { kind: Prop3DKind; open?: boolean; colour?: Tint; outline?: boolean; edges?: boolean; deck?: boolean; glow?: string; broken?: boolean }) {
  if (kind === "table") return <Table colour={colour} outline={outline} deck={deck} glow={glow} />;
  if (kind === "bookcase") return broken ? <Bookcase colour={colour} outline={outline} edges={false} faces={BROKEN_BOOKCASE_FACES} /> : <Bookcase colour={colour} outline={outline} edges={edges} />;
  if (kind === "stash") return <Sack open={open} colour={colour} outline={outline} />;
  return <Chest open={open} colour={colour} outline={outline} edges={edges} />;
}

// The chest: the body and lid as two painted boxes, the lid turning on its hinge along the back top
// edge. Open, the body's top is its inside (gold and gems). The lit edges (the top row of each front,
// the lid top's front row) and the lid's darker underside are made beforehand, in the `-lit` and
// `under` pictures beside the others.
// (`faces`: another chest's pictures, the lab's drafts: the rickety chest. Each has its `under` and, with
// `edges`, its `-lit` pictures beside them.)
export function Chest({ open, colour, outline, edges, faces = ART_FACES }: { open: boolean; colour?: Tint; outline: boolean; edges: boolean; faces?: ChestFaces }) {
  const art = useMemo(() => chestArt(faces), [faces]);
  const geo = useMemo(() => {
    const F = faces, fw = F.front.w, fh = F.front.h, split = F.front.lid;
    const front = (y0: number, y1: number): Part => ({ w: fw, h: fh, x0: 0, x1: fw, y0, y1 });
    const side = (y0: number, y1: number): Part => ({ w: F.side.w, h: F.side.h, x0: 0, x1: F.side.w, y0, y1 });
    const top: Part = { w: F.top.w, h: F.top.h, x0: 0, x1: F.top.w, y0: 0, y1: F.top.h };
    return {
      lid: paintedBox(art.width, art.lid, art.depth, [side(0, split), side(0, split), top, top, front(0, split), front(0, split)]),
      body: paintedBox(art.width, art.body, art.depth, [side(split, fh), side(split, fh), top, top, front(split, fh), front(split, fh)]),
    };
  }, [art, faces]);
  const flat = !!colour;
  const mats = useMemo(() => {
    const make: Make = (o) => (flat ? makeFlat : makeLit)(o, CHEST_NUDGE), pic = (src: string) => make({ map: loaded(src) });
    const front = pic(lit(faces.front.src, edges)), side = pic(lit(faces.side.src, edges)), top = pic(lit(faces.top.src, edges));
    const under = pic(faces.top.src.replace("top.png", "under.png")), inside = pic(faces.inside.src), dark = make({ color: DARK });
    const all = [front, side, top, under, inside, dark];
    return { lid: [side, side, top, under, front, front], body: [side, side, inside, dark, front, front], all, base: bases(all) };
  }, [flat, edges, faces]);
  useTint(mats.all, mats.base, colour);
  const lid = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = lid.current;
    if (!g) return;
    const want = open ? -OPEN_ANGLE : 0, a = g.rotation.x;
    g.rotation.x = Math.abs(want - a) < 0.001 ? want : a + (want - a) * LID_EASE;
  });
  return (
    <>
      <Solid geometry={geo.body} material={mats.body} at={[0, art.body / 2, 0]} size={[art.width, art.body, art.depth]} outline={outline} hull={CHEST_HULL} />
      <group ref={lid} position={[0, art.body, -art.depth / 2]} rotation={[open ? -OPEN_ANGLE : 0, 0, 0]}>
        <Solid geometry={geo.lid} material={mats.lid} at={[0, art.lid / 2, art.depth / 2]} size={[art.width, art.lid, art.depth]} outline={outline} hull={CHEST_HULL} />
      </group>
    </>
  );
}

// The bookcase: one box, its faces PixelLab's (lit edges made beforehand, as the chest's).
export function Bookcase({ colour, outline, edges, faces = BOOKCASE_FACES }: { colour?: Tint; outline: boolean; edges: boolean; faces?: BookcaseFaces }) {
  const b = useMemo(() => bookcaseArt(faces), [faces]);
  const geo = useMemo(() => new THREE.BoxGeometry(b.width, b.height, b.depth), [b]);
  const flat = !!colour;
  const mats = useMemo(() => {
    const F = faces, make = flat ? makeFlat : makeLit, pic = (src: string) => make({ map: loaded(src) });
    const front = pic(lit(F.front.src, edges)), side = pic(lit(F.side.src, edges)), top = pic(lit(F.top.src, edges)), dark = make({ color: DARK });
    const all = [front, side, top, dark];
    return { faces: [side, side, top, dark, front, front], all, base: bases(all) };
  }, [flat, edges, faces]);
  useTint(mats.all, mats.base, colour);
  return <Solid geometry={geo} material={mats.faces} at={[0, b.height / 2, 0]} size={[b.width, b.height, b.depth]} outline={outline} />;
}

// The table: a slab on four legs, each a painted box cut from the front picture (props3d.ts TABLE_FACES),
// the deck of cards lying face down on top, and the glow of its rarest card round it.
function Table({ colour, outline, deck, glow }: { colour?: Tint; outline: boolean; deck: boolean; glow?: string }) {
  const t = useMemo(() => tableArt(), []);
  const geo = useMemo(() => {
    const F = TABLE_FACES.front, [e0, e1] = F.edge, [a0, a1] = F.across, sideW = Math.round(t.depth * ART_PER_U);
    const front: Part = { w: F.w, h: F.h, x0: a0, x1: a1, y0: e0, y1: e1 };
    const side: Part = { w: F.w, h: F.h, x0: a0, x1: a0 + sideW, y0: e0, y1: e1 };
    const top: Part = { w: TABLE_FACES.top.w, h: TABLE_FACES.top.h, x0: 0, x1: TABLE_FACES.top.w, y0: 0, y1: TABLE_FACES.top.h };
    const leg: Part = { w: F.w, h: F.h, x0: F.leg.x[0], x1: F.leg.x[1], y0: F.leg.y[0], y1: F.leg.y[1] };
    const deckTop: Part = { w: TABLE_FACES.deck.w, h: TABLE_FACES.deck.h, x0: 0, x1: TABLE_FACES.deck.w, y0: 0, y1: TABLE_FACES.deck.h };
    // (The brace: what's under the slab, the width of the table, see-through between its boards.)
    const brace = paintedBox(t.width, t.legs, 0, [front, front, front, front, { w: F.w, h: F.h, x0: a0, x1: a1, y0: e1, y1: F.h }, { w: F.w, h: F.h, x0: a0, x1: a1, y0: e1, y1: F.h }]);
    return {
      brace,
      slab: paintedBox(t.width, t.slab, t.depth, [side, side, top, top, front, front]),
      leg: paintedBox(t.leg, t.legs, t.leg, [leg, leg, leg, leg, leg, leg]),
      deck: paintedBox(t.deck.width, DECK_TALL, t.deck.depth, [deckTop, deckTop, deckTop, deckTop, deckTop, deckTop]),
    };
  }, [t]);
  const flat = !!colour;
  const mats = useMemo(() => {
    const make = flat ? makeFlat : makeLit, pic = (src: string) => make({ map: loaded(src) });
    const front = pic(TABLE_FACES.front.src), top = pic(TABLE_FACES.top.src), dark = make({ color: DARK }), cards = pic(TABLE_FACES.deck.src);
    const see = make({ map: loaded(TABLE_FACES.front.src), side: THREE.DoubleSide });
    see.alphaTest = 0.5;
    const all = [front, top, dark, cards, see];
    return { brace: [see, see, see, see, see, see], slab: [front, front, top, dark, front, front], leg: [front, front, dark, dark, front, front], deck: [cards, cards, cards, dark, cards, cards], all, base: bases(all) };
  }, [flat]);
  useTint(mats.all, mats.base, colour);
  const lx = t.width / 2 - LEG_IN - t.leg / 2, lz = t.depth / 2 - LEG_IN - t.leg / 2;
  return (
    <>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <Solid key={`${sx}${sz}`} geometry={geo.leg} material={mats.leg} at={[sx * lx, t.legs / 2, sz * lz]} size={[t.leg, t.legs, t.leg]} outline={outline} />
      )))}
      {[-1, 1].map((sz) => <mesh key={sz} geometry={geo.brace} material={mats.brace} position={[0, t.legs / 2, sz * lz]} raycast={() => null} />)}
      <Solid geometry={geo.slab} material={mats.slab} at={[0, t.legs + t.slab / 2, 0]} size={[t.width, t.slab, t.depth]} outline={outline} />
      {deck && <Solid geometry={geo.deck} material={mats.deck} at={[DECK_AT, t.top + DECK_TALL / 2, 0]} size={[t.deck.width, DECK_TALL, t.deck.depth]} outline={outline} />}
      {deck && glow && <group position={[DECK_AT, 0, 0]}>
        <Glow colour={glow} radius={CANDLE_RADIUS * DECK_GLOW.share} strength={DECK_GLOW.strength} />
        <Glow colour={glow} radius={t.deck.depth} strength={DECK_GLOW.strength} y={t.top + DECK_TALL + 0.005} />
      </group>}
    </>
  );
}

// A soft round glow on the floor (added to what's there, so it shows in the dark), as a candle's light
// pools: full in the middle, fading out to `radius`. Gently pulsing.
const GLOW_TEX = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.4, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();
export function Glow({ colour, radius, strength, y = 0.01 }: { colour: string; radius: number; strength: number; y?: number }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => { if (mat.current) mat.current.opacity = strength * (0.85 + 0.15 * Math.sin(performance.now() / 400)); });
  return (
    <mesh raycast={() => null} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[radius * 2, radius * 2, 1]}>
      <planeGeometry />
      <meshBasicMaterial ref={mat} map={GLOW_TEX()} color={colour} transparent opacity={strength} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ── The campfire (the user, 2026-11-11): a low ring of stones (the rim picture laid round it) round its pit
// (the pit seen from above: ash, embers, crossed logs), flames standing up in it while it burns, and its
// warm glow on the floor. PixelLab's, in public/sprites/props/campfire3d.
export const CAMPFIRE_3D = { top: "/sprites/props/campfire3d/top.png?v=1", rim: "/sprites/props/campfire3d/rim.png?v=1", rimPx: [48, 16] as const, wide: 0.9, tall: 0.12 };
export function Campfire({ lit, colour }: { lit: boolean; colour?: Tint }) {
  const F = CAMPFIRE_3D;
  return (
    <>
      <Ring wide={F.wide} tall={F.tall} top={F.top} rim={F.rim} rimPx={F.rimPx} sides={12} colour={colour} />
      {lit && <Flame at={[0, F.tall, 0.05]} size={0.42} />}
      {lit && <Glow colour="#ff9632" radius={1.4} strength={0.35} />}
    </>
  );
}

// A low round wall (`rim` laid round it, a unit of art to a unit, as many of its rows as fit square on
// screen), its top `top` seen from above. `colour`: tinted by the light where it stands (the game's Stone).
export function Ring({ wide, tall, top, rim, rimPx, sides = 16, colour }: { wide: number; tall: number; top: string; rim: string; rimPx: readonly [number, number]; sides?: number; colour?: Tint }) {
  const r = wide / 2, flat = !!colour;
  const mats = useMemo(() => {
    const side = loaded(rim).clone();
    sharp(side);
    side.wrapS = side.wrapT = THREE.RepeatWrapping;
    const rows = (tall * ART_PER_U * Math.cos(Math.PI / 3)) / rimPx[1];
    side.repeat.set(Math.max(1, Math.round((Math.PI * wide * ART_PER_U) / rimPx[0])), rows);
    side.offset.set(0, 1 - rows);
    side.needsUpdate = true;
    const make = flat ? makeFlat : makeLit, s = make({ map: side }), t = make({ map: loaded(top) });
    t.transparent = true; t.alphaTest = 0.5;
    const all = [s, t];
    return { side: s, top: t, all, base: bases(all) };
  }, [rim, top, tall, wide, rimPx, flat]);
  useTint(mats.all, mats.base, colour);
  return (
    <>
      <mesh material={mats.side} position={[0, tall / 2, 0]} raycast={() => null}><cylinderGeometry args={[r, r, tall, sides, 1, true]} /></mesh>
      <mesh material={mats.top} position={[0, tall + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><circleGeometry args={[r, sides * 2]} /></mesh>
    </>
  );
}

// A flame: two flat shapes (the outer orange, the core yellow) facing you, flickering. Always full bright.
const FLAME_SHAPE = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(0.5, 0.1, 0.32, 0.55); s.quadraticCurveTo(0.2, 0.8, 0, 1);
  s.quadraticCurveTo(-0.2, 0.8, -0.32, 0.55); s.quadraticCurveTo(-0.5, 0.1, 0, 0);
  return new THREE.ShapeGeometry(s, 4);
})();
export function Flame({ at, size }: { at: [number, number, number]; size: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = performance.now() / 120;
    if (g.current) g.current.scale.set(size * (0.92 + 0.08 * Math.sin(t * 1.3)), size * (0.9 + 0.12 * Math.sin(t)), 1);
  });
  return (
    <group ref={g} position={at}>
      <mesh geometry={FLAME_SHAPE} raycast={() => null}><meshBasicMaterial color="#f4a034" /></mesh>
      <mesh geometry={FLAME_SHAPE} position={[0, 0.02, 0.01]} scale={[0.55, 0.6, 1]} raycast={() => null}><meshBasicMaterial color="#fcd678" /></mesh>
    </group>
  );
}

// The sack: its outline turned round (flat-shaded, so its few sides show as facets), in burlap laid
// about a unit of cloth to a unit round it, and a rope round its neck. Opened, it's untied: no rope,
// its mouth open (both sides of the cloth drawn, so you see into it).
function Sack({ open, colour, outline }: { open: boolean; colour?: Tint; outline: boolean }) {
  const geo = useMemo(() => new THREE.LatheGeometry((open ? sackOpenOutline() : sackOutline()).map(([r, y]) => new THREE.Vector2(r, y)), SACK_SIDES), [open]);
  const rope = useMemo(() => new THREE.TorusGeometry(SACK_NECK.r + SACK_NECK.rope / 2, SACK_NECK.rope, 4, SACK_SIDES), []);
  const flat = !!colour;
  const mats = useMemo(() => {
    const make = flat ? makeFlat : makeLit, cloth = loaded(SACK_CLOTH.src, true); // (only the sack's: its repeat is set on it, not a copy)
    cloth.repeat.set(2, 0.5);
    const all = [make({ map: cloth, flatShading: true, side: open ? THREE.DoubleSide : THREE.FrontSide }), make({ color: "#8a6a44", flatShading: true })];
    return { cloth: all[0], rope: all[1], all, base: bases(all) };
  }, [flat, open]);
  useTint(mats.all, mats.base, colour);
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
