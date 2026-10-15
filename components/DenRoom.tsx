"use client";
// components/DenRoom.tsx
// The clickable pixel-art Den (drawn by lib/den/scene.ts).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDen, project, ANCHORS, OBJ, W, H, RES, type DenScene, type ObjId } from "@/lib/den/scene";

type Spot = { label: string; href?: string; soon?: string };

export const SPOTS: Record<Exclude<ObjId, 0>, Spot> = {
  [OBJ.pit]:      { label: "Fight Pit", href: "/pit" },
  [OBJ.chest]:    { label: "Chest", href: "/chest" },
  [OBJ.altar]:    { label: "Scanning Altar", href: "/altar" },
  [OBJ.merchant]: { label: "Merchant", soon: "Buying, rerolls and upgrades are coming. Sell items from the Chest for now." },
  [OBJ.quests]:   { label: "Quest Board", soon: "Daily quests (and the utility moves they reward) are coming." },
  [OBJ.bag]:      { label: "Battle Bag", soon: "Your battle bag holds up to 10 potions, one per slot. Buy them from merchants in the Labyrinth (or find them in stashes) and use them there." },
  [OBJ.arch]:     { label: "The Labyrinth", href: "/dungeon" },
};

const FPS = 12;

export default function DenRoom() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<DenScene | null>(null);
  const hoverRef = useRef<ObjId>(OBJ.none);
  const [hover, setHover] = useState<ObjId>(OBJ.none);
  const [notice, setNotice] = useState<Spot | null>(null);
  const router = useRouter();

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const scene = createDen();
    sceneRef.current = scene;
    const start = performance.now();
    const draw = () => ctx.putImageData(scene.render((performance.now() - start) / 1000, hoverRef.current), 0, 0);
    draw();
    const timer = window.setInterval(draw, 1000 / FPS);
    return () => window.clearInterval(timer);
  }, []);

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

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 640, margin: "0 auto", aspectRatio: `${W} / ${H}` }}>
      <canvas
        ref={canvasRef}
        width={W * RES}
        height={H * RES}
        onPointerMove={(e) => setHovered(objectAt(e))}
        onPointerLeave={() => setHovered(OBJ.none)}
        onClick={(e) => activate(objectAt(e))}
        style={{ width: "100%", height: "100%", imageRendering: "pixelated", cursor: hover ? "pointer" : "default", display: "block" }}
        aria-label="The Den"
        role="img"
      />

      {/* Labels */}
      {(Object.keys(SPOTS) as unknown as Exclude<ObjId, 0>[]).map((key) => {
        const id = Number(key) as Exclude<ObjId, 0>;
        const a = ANCHORS[id];
        const [x, y] = project(a.u, a.v, a.z);
        const spot = SPOTS[id];
        const active = hover === id;
        return (
          <button
            key={id}
            onClick={() => activate(id)}
            onPointerEnter={() => setHovered(id)}
            onPointerLeave={() => setHovered(OBJ.none)}
            className="pixel-font"
            style={{
              position: "absolute", left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`,
              // Near the edges the label leans inwards, so it never runs off a phone screen.
              transform: `translate(${x / W < 0.2 ? -15 : x / W > 0.8 ? -85 : -50}%, ${a.below ? "15%" : "-100%"})`, whiteSpace: "nowrap",
              padding: "2px 6px", fontSize: "clamp(11px, 2.6vw, 14px)", lineHeight: 1.3,
              background: active ? "rgba(40, 28, 12, 0.95)" : "rgba(12, 12, 18, 0.78)",
              border: `2px solid ${active ? "#ffd66e" : spot.href ? "#8a6a3a" : "#4a4a55"}`,
              color: spot.href ? (active ? "#ffe9a8" : "#f1d9a0") : "#a9a9b8",
              cursor: "pointer", boxShadow: "0 2px 0 rgba(0,0,0,0.6)",
            }}
          >
            {spot.label}{spot.soon ? " 🔒" : ""}
          </button>
        );
      })}

      {/* "Coming soon" notice */}
      {notice && (
        <div onClick={() => setNotice(null)} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: 16 }}>
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
