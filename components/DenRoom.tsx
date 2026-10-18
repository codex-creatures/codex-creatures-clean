"use client";
// components/DenRoom.tsx
// The clickable pixel-art Den (drawn by lib/den/scene.ts), fitted to the
// screen. Nothing is labelled until you point at it: hover an object (or
// tap it once on a touch screen) to see its name; click it (or tap it again)
// to go in.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDen, project, ANCHORS, OBJ, W, H, RES, PROP_KEYS, propSrc, type DenProps, type DenScene, type KlutzMode, type ObjId } from "@/lib/den/scene";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { artFor, loadArt, loadPixels, type LoadedArt, type Pixels } from "@/lib/sprites/art";

type Spot = { label: string; href?: string; soon?: string };

export const SPOTS: Record<Exclude<ObjId, 0>, Spot> = {
  [OBJ.pit]:      { label: "The Pit", href: "/pit" },
  [OBJ.chest]:    { label: "Chest", href: "/chest" },
  [OBJ.altar]:    { label: "Soul Altar", href: "/altar" },
  [OBJ.merchant]: { label: "Merchant", soon: "Buying, rerolls and upgrades are coming. Sell items from the Chest for now." },
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

// caged: the creature id waiting in the cage (drawn inside it), if any.
// klutz: where Klutz is (strolling, healing in the pool, or away hunting).
// klutzNews: he has something to tell you (a ❗ on his label).
// backpack: you've found the rugged backpack (otherwise it's a bindle).
export default function DenRoom({ caged, klutz = "home", klutzNews = false, backpack = false }: { caged?: string; klutz?: KlutzMode; klutzNews?: boolean; backpack?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Touch: the first tap picks an object (shows its name), the second goes in.
  const [picked, setPicked] = useState<ObjId>(OBJ.none);
  const touchRef = useRef(false);
  const [touch, setTouch] = useState(false);
  const klutzNewsRef = useRef(klutzNews);
  const pickedRef = useRef<ObjId>(OBJ.none);
  useEffect(() => { klutzNewsRef.current = klutzNews; }, [klutzNews]);
  useEffect(() => { pickedRef.current = picked; }, [picked]);
  const cagedRef = useRef(caged);
  const klutzRef = useRef(klutz);
  const klutzPixels = useRef<LoadedArt | null>(null); // his drawn art, once loaded
  const cagedArt = useRef<Pixels | null>(null);        // the caged creature's, once loaded
  const klutzLabelRef = useRef<HTMLButtonElement | null>(null);
  const sceneRef = useRef<DenScene | null>(null);
  const hoverRef = useRef<ObjId>(OBJ.none);
  const [hover, setHover] = useState<ObjId>(OBJ.none);
  const [notice, setNotice] = useState<Spot | null>(null);
  const router = useRouter();
  // Crisp pixels when the canvas is shown at full size or bigger; shrunk to
  // fit, smooth scaling (crisp scaling drops pixels unevenly and looks grainy).
  const [crisp, setCrisp] = useState(false);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => setCrisp(c.clientWidth * window.devicePixelRatio >= c.width);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);
  // The furniture art (the room is rebuilt with it once it has loaded).
  const [props, setProps] = useState<DenProps>({});
  useEffect(() => {
    let live = true;
    Promise.all(PROP_KEYS.map((k) => loadPixels(propSrc(k)).then((px) => [k, px] as const).catch(() => null)))
      .then((all) => { if (live) setProps(Object.fromEntries(all.filter((x) => x !== null))); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const scene = createDen({ backpack, props });
    sceneRef.current = scene;
    const start = performance.now();
    scene.setCaged(cagedRef.current ? CREATURE_SPRITES[cagedRef.current] ?? null : null, cagedArt.current);
    scene.setKlutz(klutzRef.current, CREATURE_SPRITES.klutz ?? null, klutzPixels.current);
    const draw = () => {
      ctx.putImageData(scene.render((performance.now() - start) / 1000, hoverRef.current), 0, 0);
      // Klutz's label follows him about.
      const el = klutzLabelRef.current, at = scene.klutzAt();
      if (el) {
        el.style.display = at && (klutzNewsRef.current || hoverRef.current === OBJ.klutz || pickedRef.current === OBJ.klutz) ? "block" : "none";
        if (at) { el.style.left = `${(at[0] / W) * 100}%`; el.style.top = `${(at[1] / H) * 100}%`; }
      }
    };
    draw();
    const timer = window.setInterval(draw, 1000 / FPS);
    return () => window.clearInterval(timer);
  }, [backpack, props]);

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

  // A click or tap on an object. With a mouse it goes straight in; on a
  // touch screen the first tap shows the name, a second tap on it goes in.
  function press(id: ObjId) {
    if (!touchRef.current) { activate(id); return; }
    if (id && id === picked) { activate(id); return; }
    setPicked(id);
    setHovered(id);
  }
  // Which object's name is showing: the one you're pointing at or have picked.
  const shown = (hover || picked) as ObjId;

  return (
    <div>
    <div style={{ position: "relative", width: "100%", margin: "0 auto", aspectRatio: `${W} / ${H}` }}>
      <canvas
        ref={canvasRef}
        width={W * RES}
        height={H * RES}
        onPointerDown={(e) => { touchRef.current = e.pointerType !== "mouse"; setTouch(touchRef.current); }}
        onPointerMove={(e) => { if (e.pointerType === "mouse") setHovered(objectAt(e)); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setHovered(OBJ.none); }}
        onClick={(e) => press(objectAt(e))}
        style={{ width: "100%", height: "100%", imageRendering: crisp ? "pixelated" : "auto", cursor: hover ? "pointer" : "default", display: "block" }}
        aria-label="The Den"
        role="img"
      />

      {/* Labels */}
      {(Object.keys(SPOTS) as unknown as Exclude<ObjId, 0>[]).map((key) => {
        const id = Number(key) as Exclude<ObjId, 0>;
        if (id === OBJ.klutz || id !== shown) return null;
        const a = ANCHORS[id];
        const [x, y] = project(a.u, a.v, a.z);
        const spot = SPOTS[id];
        const active = hover === id;
        return (
          <button
            key={id}
            onClick={() => activate(id)}
            className="pixel-font"
            style={{
              position: "absolute", left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`,
              // Near the edges the label leans inwards, so it never runs off a phone screen.
              transform: `translate(${x / W < 0.12 ? -15 : x / W > 0.88 ? -85 : -50}%, ${a.below ? "15%" : "-100%"})`, whiteSpace: "nowrap",
              padding: "2px 6px", fontSize: "clamp(11px, 2.6vw, 14px)", lineHeight: 1.3, pointerEvents: touch ? "auto" : "none",
              background: active ? "rgba(40, 28, 12, 0.95)" : "rgba(12, 12, 18, 0.78)",
              border: `2px solid ${active ? "#ffd66e" : spot.href ? "#8a6a3a" : "#4a4a55"}`,
              color: spot.href ? (active ? "#ffe9a8" : "#f1d9a0") : "#a9a9b8",
              cursor: "pointer", boxShadow: "0 2px 0 rgba(0,0,0,0.6)",
            }}
          >
            {id === OBJ.bag ? (backpack ? "Rugged Backpack" : "Bindle") : spot.label}{spot.soon ? " 🔒" : ""}{touch && spot.href ? " ›" : ""}
          </button>
        );
      })}

      <button ref={klutzLabelRef} onClick={() => activate(OBJ.klutz)}
        onPointerEnter={() => setHovered(OBJ.klutz)} onPointerLeave={() => setHovered(OBJ.none)}
        className={`pixel-font${klutzNews ? " news-glow" : ""}`}
        style={{
          position: "absolute", display: "none", transform: "translate(-50%, -100%)", whiteSpace: "nowrap",
          padding: "1px 6px", fontSize: "clamp(11px, 2.4vw, 13px)", lineHeight: 1.3,
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
