"use client";
// components/DenRoom.tsx
// The clickable pixel-art Den (drawn by lib/den/scene.ts), filling the
// space it's given, like a phone game's map: it opens zoomed in on the room;
// pinch (or the mouse wheel) to zoom, drag to look around. Tap an object to go
// in. With a mouse, pointing at one shows its name first.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEscape } from "@/hooks/useEscape";
import { createDen, project, ANCHORS, OBJ, W, H, RES, PROP_KEYS, propSrc, ALTAR_ANIM, type DenProps, type DenScene, type KlutzMode, type ObjId } from "@/lib/den/scene";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { artFor, loadArt, loadPixels, loadFrames, type LoadedArt, type Pixels } from "@/lib/sprites/art";

type Spot = { label: string; href?: string; soon?: string };

export const SPOTS: Record<Exclude<ObjId, 0>, Spot> = {
  [OBJ.pit]:      { label: "The Pit", href: "/pit" },
  [OBJ.chest]:    { label: "Inventory", href: "/chest" },
  [OBJ.altar]:    { label: "Soul Altar", href: "/altar" },
  [OBJ.merchant]: { label: "Merchant", soon: "Buying, rerolls and upgrades are coming. Sell items from your Inventory for now." },
  [OBJ.quests]:   { label: "Quest Board", soon: "Daily quests (and the utility moves they reward) are coming." },
  [OBJ.bag]:      { label: "Battle Bag", href: "/bag" },
  [OBJ.arch]:     { label: "The Labyrinth", href: "/dungeon" },
  [OBJ.scroll]:   { label: "Bestiary & Rules", href: "/guide" },
  [OBJ.cage]:     { label: "Cage", href: "/cage" },
  [OBJ.crate]:    { label: "Klutz's Crate", href: "/crate" },
  [OBJ.pool]:     { label: "Healing Pool", href: "/pool" },
  [OBJ.klutz]:    { label: "Klutz", href: "/klutz" },
  [OBJ.bookcase]: { label: "Bookcase", href: "/bookcase" },
  [OBJ.tavern]:   { label: "Tavern", soon: "The tavern isn't built yet. One day travellers, merchants and librarians will gather here." },
};

const FPS = 12;

// The Den's art and the built room are kept for the whole visit to the site:
// building the room (lighting every pixel) takes a moment, so it's done once,
// with all its art, and coming back to the Den shows it straight away.
type DenArt = { props: DenProps; altarFrames: Pixels[] | null };
let artCache: DenArt | null = null;
let artLoading: Promise<DenArt> | null = null;
function loadDenArt(): Promise<DenArt> {
  artLoading ??= Promise.all([
    Promise.all(PROP_KEYS.map((k) => loadPixels(propSrc(k)).then((px) => [k, px] as const).catch(() => null))),
    loadFrames(ALTAR_ANIM).catch(() => null),
  ]).then(([all, altarFrames]) => (artCache = { props: Object.fromEntries(all.filter((x) => x !== null)) as DenProps, altarFrames }));
  return artLoading;
}
const scenes = new Map<string, DenScene>();
function denScene(backpack: boolean, art: DenArt): DenScene {
  const key = String(backpack);
  let s = scenes.get(key);
  if (!s) scenes.set(key, (s = createDen({ backpack, props: art.props, altarFrames: art.altarFrames ?? undefined })));
  return s;
}

// caged: the creature id waiting in the cage (drawn inside it), if any.
// klutz: where Klutz is (strolling, healing in the pool, or away hunting).
// klutzNews: he has something to tell you (a ❗ on his label).
// backpack: you've found the rugged backpack (otherwise it's a bindle).
// highlight: a place Klutz has sent you to (its label stays up, glowing, with a ❗).
export default function DenRoom({ caged, klutz = "home", klutzNews = false, backpack = false, highlight }: { caged?: string; klutz?: KlutzMode; klutzNews?: boolean; backpack?: boolean; highlight?: ObjId }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const klutzNewsRef = useRef(klutzNews);
  useEffect(() => { klutzNewsRef.current = klutzNews; }, [klutzNews]);
  const cagedRef = useRef(caged);
  const klutzRef = useRef(klutz);
  const klutzPixels = useRef<LoadedArt | null>(null); // his drawn art, once loaded
  const cagedArt = useRef<Pixels | null>(null);        // the caged creature's, once loaded
  const klutzLabelRef = useRef<HTMLButtonElement | null>(null);
  const sceneRef = useRef<DenScene | null>(null);
  const hoverRef = useRef<ObjId>(OBJ.none);
  const [hover, setHover] = useState<ObjId>(OBJ.none);
  const [notice, setNotice] = useState<Spot | null>(null);
  useEscape(notice ? () => setNotice(null) : null);
  const router = useRouter();
  // Crisp pixels when the canvas is shown at full size or bigger; shrunk,
  // smooth scaling (crisp scaling drops pixels unevenly and looks grainy).
  const [crisp, setCrisp] = useState(false);

  // ── The view: zoom and pan ──
  // The room (the "world") is laid out at the viewport's width; the view
  // scales it by s and shifts it by (x, y), in screen pixels from the top-left.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const [vp, setVp] = useState<{ w: number; h: number } | null>(null);
  const view = useRef({ s: 1, x: 0, y: 0 });
  const limits = useRef({ min: 1, max: 4 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ s: number; d: number; wx: number; wy: number; moved: number; last: { x: number; y: number } } | null>(null);
  const dragged = useRef(false); // the last press moved the view: not a tap

  // Keep the room on screen: centred along an axis where it's smaller than
  // the viewport, otherwise no gap at either edge.
  function apply(next: { s: number; x: number; y: number }) {
    const box = viewportRef.current, world = worldRef.current;
    if (!box || !world) return;
    const vw = box.clientWidth, vh = box.clientHeight, ww = vw, wh = (vw * H) / W;
    const s = Math.min(limits.current.max, Math.max(limits.current.min, next.s));
    const fit = (pos: number, size: number, port: number) => (size * s <= port ? (port - size * s) / 2 : Math.min(0, Math.max(port - size * s, pos)));
    view.current = { s, x: fit(next.x, ww, vw), y: fit(next.y, wh, vh) };
    world.style.transform = `translate(${view.current.x}px, ${view.current.y}px) scale(${s})`;
    world.style.setProperty("--inv", String(1 / s)); // labels stay the same size
    const c = canvasRef.current;
    if (c) setCrisp(ww * s * window.devicePixelRatio >= c.width);
  }
  // Zoom to s, keeping the screen point (px, py) where it is.
  function zoomAt(s: number, px: number, py: number) {
    const v = view.current;
    const wx = (px - v.x) / v.s, wy = (py - v.y) / v.s;
    const ns = Math.min(limits.current.max, Math.max(limits.current.min, s));
    apply({ s: ns, x: px - ns * wx, y: py - ns * wy });
  }
  // The viewport's size; the first time, open zoomed in on the room (filling the height).
  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    let first = true;
    const measure = () => {
      const vw = box.clientWidth, vh = box.clientHeight;
      if (!vw || !vh) return;
      setVp({ w: vw, h: vh });
      const wh = (vw * H) / W;
      const cover = vh / wh;
      limits.current = { min: Math.min(1, cover), max: Math.max(3, cover * 2) };
      if (first) {
        first = false;
        const s = Math.min(2.6, Math.max(1, cover));
        // Centred on the room (a little below the middle of the picture).
        apply({ s, x: vw / 2 - s * vw * 0.5, y: vh / 2 - s * wh * 0.55 });
      } else apply(view.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  // The mouse wheel zooms (it needs a non-passive listener to stop the page scrolling).
  useEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = box.getBoundingClientRect();
      zoomAt(view.current.s * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One finger (or the mouse) drags; two fingers pinch (and drag).
  function startGesture() {
    const box = viewportRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const pts = [...pointers.current.values()];
    const mid = pts.length > 1 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    const v = view.current;
    gesture.current = {
      s: v.s, d: pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      wx: (mid.x - r.left - v.x) / v.s, wy: (mid.y - r.top - v.y) / v.s, moved: gesture.current?.moved ?? 0, last: mid,
    };
  }
  function onDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pointers.current.size === 0) { dragged.current = false; gesture.current = null; }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
  }
  function onMove(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && pointers.current.size === 0) { setHovered(objectAt(e)); return; }
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = viewportRef.current!.getBoundingClientRect();
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    const mid = pts.length > 1 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    g.moved += Math.hypot(mid.x - g.last.x, mid.y - g.last.y);
    g.last = mid;
    if (pts.length > 1 || g.moved > 8) dragged.current = true;
    if (!dragged.current) return;
    const s = pts.length > 1 && g.d > 0 ? g.s * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.d) : view.current.s;
    const ns = Math.min(limits.current.max, Math.max(limits.current.min, s));
    apply({ s: ns, x: mid.x - r.left - ns * g.wx, y: mid.y - r.top - ns * g.wy });
  }
  function onUp(e: React.PointerEvent) {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size > 0) startGesture(); // a finger lifted mid-pinch: carry on dragging with the other
  }
  // The furniture art (the room is rebuilt with it once it has loaded).
  const [art, setArt] = useState<DenArt | null>(artCache);
  const glows = useMemo(() => (art ? denScene(backpack, art).glows : []), [art, backpack]);
  useEffect(() => {
    if (art) return;
    let live = true;
    loadDenArt().then((a) => { if (live) setArt(a); });
    return () => { live = false; };
  }, [art]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !art) return;
    const scene = denScene(backpack, art);
    sceneRef.current = scene;
    const start = performance.now();
    let first = true; // (a new canvas or room: draw the whole frame once)
    scene.setCaged(cagedRef.current ? CREATURE_SPRITES[cagedRef.current] ?? null : null, cagedArt.current);
    scene.setKlutz(klutzRef.current, CREATURE_SPRITES.klutz ?? null, klutzPixels.current);
    const draw = () => {
      const frame = scene.render((performance.now() - start) / 1000, hoverRef.current);
      // Only the patches that changed go to the screen (the whole frame the first time).
      const dirty = scene.dirty();
      if (!dirty || first) { ctx.putImageData(frame, 0, 0); first = false; }
      else for (const [x0, y0, x1, y1] of dirty) ctx.putImageData(frame, 0, 0, x0, y0, x1 - x0, y1 - y0);
      // Round the room, the same dark as the picture's corner (no seam when zoomed out).
      const box = viewportRef.current;
      if (box && !box.style.background) box.style.background = `rgb(${frame.data[0]}, ${frame.data[1]}, ${frame.data[2]})`;
      // Klutz's label follows him about.
      const el = klutzLabelRef.current, at = scene.klutzAt();
      if (el) {
        el.style.display = at && (klutzNewsRef.current || hoverRef.current === OBJ.klutz) ? "block" : "none";
        if (at) { el.style.left = `${(at[0] / W) * 100}%`; el.style.top = `${(at[1] / H) * 100}%`; }
      }
    };
    draw();
    const timer = window.setInterval(draw, 1000 / FPS);
    return () => window.clearInterval(timer);
  }, [backpack, art]);

  useEffect(() => {
    klutzRef.current = klutz;
    sceneRef.current?.setKlutz(klutz, CREATURE_SPRITES.klutz ?? null, klutzPixels.current);
  }, [klutz]);

  // Klutz's drawn art (his grid sprite stands in until it loads).
  useEffect(() => {
    const art = CREATURE_SPRITES.klutz && artFor(CREATURE_SPRITES.klutz);
    if (!art) return;
    let live = true;
    loadArt(art).then((px) => {
      if (!live) return;
      klutzPixels.current = px;
      sceneRef.current?.setKlutz(klutzRef.current, CREATURE_SPRITES.klutz ?? null, px);
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  // Who's in the cage (the save loads after the first draw), then their art once it loads.
  useEffect(() => {
    cagedRef.current = caged;
    cagedArt.current = null;
    const sprite = caged ? CREATURE_SPRITES[caged] ?? null : null;
    sceneRef.current?.setCaged(sprite);
    const art = sprite && artFor(sprite);
    if (!art) return;
    let live = true;
    loadPixels(art.src).then((px) => {
      if (!live) return;
      cagedArt.current = px;
      sceneRef.current?.setCaged(sprite, px);
    }).catch(() => {});
    return () => { live = false; };
  }, [caged]);

  function objectAt(e: React.PointerEvent | React.MouseEvent): ObjId {
    const c = canvasRef.current, s = sceneRef.current;
    if (!c || !s) return OBJ.none;
    const r = c.getBoundingClientRect();
    return s.idAt(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }

  function setHovered(id: ObjId) {
    hoverRef.current = id;
    setHover(id);
  }

  function activate(id: ObjId) {
    if (!id) return;
    const spot = SPOTS[id];
    if (spot.href) router.push(spot.href);
    else setNotice(spot);
  }

  // A tap (not the end of a drag) on an object goes straight in.
  function press(id: ObjId) {
    if (dragged.current) return;
    setHovered(id);
    activate(id);
  }
  const shown = hover;

  return (
    <div ref={viewportRef} className="den-viewport"
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") { setHovered(OBJ.none); onUp(e); } }}>
    <div ref={worldRef} className="den-world" style={{ width: vp?.w ?? "100%", height: vp ? (vp.w * H) / W : undefined, visibility: vp ? "visible" : "hidden" }}>
      <canvas
        ref={canvasRef}
        width={W * RES}
        height={H * RES}
        onClick={(e) => press(objectAt(e))}
        style={{ width: "100%", height: "100%", imageRendering: crisp ? "pixelated" : "auto", cursor: hover ? "pointer" : "grab", display: "block" }}
        aria-label="The Den"
        role="img"
      />

      {/* The torches' flicker: soft glows over the room (cheaper than relighting it). */}
      {glows.map((g, i) => (
        <div key={i} aria-hidden className={g.pulse ? "den-glow den-glow-pulse" : "den-glow"}
          style={{ left: `${(g.x / W) * 100}%`, top: `${(g.y / H) * 100}%`, width: `${(g.r * 2 / W) * 100}%`, aspectRatio: "1", background: `radial-gradient(circle, rgba(${g.color}, 0.32), rgba(${g.color}, 0.1) 45%, transparent 70%)`, animationDelay: `${-((g.seed * 0.37) % 1) * 2}s` }} />
      ))}

      {/* Labels */}
      {(Object.keys(SPOTS) as unknown as Exclude<ObjId, 0>[]).map((key) => {
        const id = Number(key) as Exclude<ObjId, 0>;
        if (id === OBJ.klutz || (id !== shown && id !== highlight)) return null;
        const a = ANCHORS[id];
        const [x, y] = project(a.u, a.v, a.z);
        const spot = SPOTS[id];
        const active = hover === id;
        return (
          <button
            key={id}
            onClick={() => { if (!dragged.current) activate(id); }}
            className="pixel-font"
            style={{
              position: "absolute", left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`,
              // Near the edges the label leans inwards, so it never runs off a phone screen.
              transform: `translate(${x / W < 0.12 ? -15 : x / W > 0.88 ? -85 : -50}%, ${a.below ? "15%" : "-100%"}) scale(var(--inv, 1))`, transformOrigin: a.below ? "50% 0" : "50% 100%", whiteSpace: "nowrap",
              padding: "2px 6px", fontSize: "clamp(11px, 2.6cqw, 14px)", lineHeight: 1.3, pointerEvents: "none",
              background: active ? "rgba(40, 28, 12, 0.95)" : "rgba(12, 12, 18, 0.78)",
              border: `2px solid ${active ? "#ffd66e" : spot.href ? "#8a6a3a" : "#4a4a55"}`,
              color: spot.href ? (active ? "#ffe9a8" : "#f1d9a0") : "#a9a9b8",
              cursor: "pointer", boxShadow: "0 2px 0 rgba(0,0,0,0.6)",
            }}
          >
            {id === OBJ.bag ? (backpack ? "Rugged Backpack" : "Bindle") : spot.label}{spot.soon ? " 🔒" : ""}
          </button>
        );
      })}

      <button ref={klutzLabelRef} onClick={() => { if (!dragged.current) activate(OBJ.klutz); }}
        onPointerEnter={() => setHovered(OBJ.klutz)} onPointerLeave={() => setHovered(OBJ.none)}
        className={`pixel-font${klutzNews ? " news-glow" : ""}`}
        style={{
          position: "absolute", display: "none", transform: "translate(-50%, -100%) scale(var(--inv, 1))", transformOrigin: "50% 100%", whiteSpace: "nowrap",
          padding: "1px 6px", fontSize: "clamp(11px, 2.4cqw, 13px)", lineHeight: 1.3,
          background: hover === OBJ.klutz ? "rgba(40, 28, 12, 0.95)" : "rgba(12, 12, 18, 0.7)",
          border: `2px solid ${hover === OBJ.klutz ? "#ffd66e" : "#5c7a3a"}`, color: "#d6f0a8", cursor: "pointer",
        }}>
        {klutzNews && <span className="news-pulse" aria-label="Klutz has news">❗</span>}
        {(shown === OBJ.klutz || !klutzNews) && <>{klutzNews ? " " : ""}Klutz{klutz === "pool" ? " 💤" : ""}</>}
      </button>
    </div>

      {/* "Coming soon" notice */}
      {notice && (
        <div onClick={() => setNotice(null)} style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: 16 }}>
          <div className="stone-panel" style={{ maxWidth: 320, textAlign: "center" }}>
            <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0", marginBottom: 8 }}>{notice.label}</div>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "#d8d4c8", margin: 0 }}>{notice.soon}</p>
            <div className="pixel-font" style={{ fontSize: 12, color: "#8a8a99", marginTop: 12 }}>Coming soon · tap to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
