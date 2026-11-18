"use client";
// app/lab/propbuilder/FacePicker.tsx — 🧪 the prop builder's face panel (./Editor.tsx): the picked part's faces
// (and "*", every face not given), and the picked face's paint: a picture (from the list of everything under
// public/sprites, lib/props/sprites.json, or typed by its path) with a crop dragged out on it, laid at the art
// density ("tile") or stretched over the face once ("fill", with a warning when that isn't 48 a unit); a flat colour;
// the same as another face; or nothing. A tint over either. Changes go through lib/props/edit.ts changeFace.

import { useMemo, useRef, useState } from "react";
import { FACES, DENSITY, type Crop, type FaceSpec, type PartSpec } from "@/lib/props/recipe";
import SPRITES from "@/lib/props/sprites.json";

const btn = (on = false) => ({ minHeight: 44, minWidth: 44, padding: "0 10px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
const box = { height: 40, background: "#0e0d0b", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 4, padding: "0 6px" };
const SIZES = new Map((SPRITES as [string, number, number][]).map(([p, w, h]) => [p, [w, h] as const]));
const VIEW = 300; // px: the picture's box, at most

export type FacePickerProps = {
  part: PartSpec; face: string; onFace: (face: string) => void;
  onPaint: (face: string, spec: FaceSpec | null) => void;
  density?: (face: string) => [number, number] | null; // texels a unit on screen, for "fill" faces (the warning)
};

export default function FacePicker({ part, face, onFace, onPaint, density }: FacePickerProps) {
  const names = ["*", ...FACES[part.kind]];
  const spec = part.faces[face];
  const mode = !spec ? "none" : spec.same !== undefined ? "same" : spec.colour !== undefined ? "colour" : "picture";
  const set = (next: FaceSpec | null) => onPaint(face, next);
  // (A face not given its own paint takes the rest's ("*"): its own starts from that.)
  const rest = face !== "*" && !spec ? part.faces["*"] : undefined;
  const from = spec ?? (rest && rest.same === undefined ? rest : undefined);
  const d = density?.(face);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {names.map((n) => (
          <button key={n} style={{ ...btn(n === face), opacity: part.faces[n] || n === face ? 1 : 0.55 }} onClick={() => onFace(n)} title={n === "*" ? "Every face not given its own" : undefined}>
            {n === "*" ? "* (rest)" : n}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button style={btn(mode === "picture")} onClick={() => mode !== "picture" && set(from?.src ? { ...from, colour: undefined } : { src: "/sprites/den3d/parts/pit-stone.png", crop: [0, 0, 48, 24] })}>Picture</button>
        <button style={btn(mode === "colour")} onClick={() => mode !== "colour" && set({ colour: from?.colour ?? "#8a7a66", ...(from?.tint ? { tint: from.tint } : {}) })}>Colour</button>
        {face !== "*" && <button style={btn(mode === "same")} onClick={() => mode !== "same" && set({ same: names.find((n) => n !== "*" && n !== face && part.faces[n]) ?? "*" })}>Same as…</button>}
        <button style={btn(mode === "none")} onClick={() => set(null)} title="Not given its own paint">{face === "*" ? "None" : part.faces["*"] ? "Uses the rest" : "None"}</button>
      </div>
      {spec && mode === "colour" && (
        <label style={{ fontSize: 12, color: "#cbbf9f", display: "flex", gap: 8, alignItems: "center" }}>Colour
          <input type="color" value={spec.colour} onChange={(e) => set({ ...spec, colour: e.target.value })} style={{ width: 60, height: 40 }} />
          <code>{spec.colour}</code></label>
      )}
      {spec && mode === "same" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {names.filter((n) => n !== face && n !== "*" && part.faces[n]).map((n) => <button key={n} style={btn(spec.same === n)} onClick={() => set({ same: n })}>{n}</button>)}
        </div>
      )}
      {spec && mode === "picture" && <PicturePaint spec={spec} set={set} density={d} />}
      {spec && mode !== "same" && (
        <label style={{ fontSize: 12, color: "#cbbf9f", display: "flex", gap: 8, alignItems: "center" }}>Tint
          <input type="color" value={spec.tint ?? "#ffffff"} onChange={(e) => set({ ...spec, tint: e.target.value })} style={{ width: 60, height: 40 }} />
          {spec.tint && <button style={btn()} onClick={() => { const rest = { ...spec }; delete rest.tint; set(rest); }}>No tint</button>}
        </label>
      )}
    </div>
  );
}

function PicturePaint({ spec, set, density }: { spec: FaceSpec; set: (s: FaceSpec) => void; density?: [number, number] | null }) {
  const src = spec.src!, crop = spec.crop ?? [0, 0, 1, 1], size = SIZES.get(src);
  const [find, setFind] = useState("");
  const [typed, setTyped] = useState<string | null>(null);
  const found = useMemo(() => {
    const q = find.trim().toLowerCase();
    return q ? [...SIZES.keys()].filter((p) => p.toLowerCase().includes(q)).slice(0, 40) : [];
  }, [find]);
  const choose = (p: string) => { const s = SIZES.get(p); set({ ...spec, src: p, crop: s ? [0, 0, s[0], s[1]] : crop }); setFind(""); };
  const off = density && (Math.abs(density[0] - DENSITY) > DENSITY * 0.05 || Math.abs(density[1] - DENSITY) > DENSITY * 0.05);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <input value={typed ?? src} onChange={(e) => setTyped(e.target.value)} onBlur={() => { if (typed !== null && typed.startsWith("/sprites/")) choose(typed); setTyped(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} title="The picture's path, under /sprites/" style={{ ...box, width: "100%" }} />
      <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a picture (e.g. stone, altar, kit)" style={{ ...box, width: "100%" }} />
      {found.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 220, overflowY: "auto", background: "#0e0d0b", padding: 4, borderRadius: 4 }}>
          {found.map((p) => (
            <button key={p} onClick={() => choose(p)} title={p} style={{ ...btn(), padding: 2, width: 64, height: 64, display: "grid", placeItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" style={{ maxWidth: 58, maxHeight: 58, imageRendering: "pixelated" }} />
            </button>
          ))}
        </div>
      )}
      <CropBox src={src} size={size} crop={crop} onCrop={(c) => set({ ...spec, crop: c })} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {(["x", "y", "w", "h"] as const).map((k, i) => (
          <label key={k} style={{ fontSize: 11, color: "#8a8a99" }}>{k}
            <input value={crop[i]} inputMode="numeric" onChange={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v) && v >= (i > 1 ? 1 : 0)) { const c = [...crop] as Crop; c[i] = v; set({ ...spec, crop: c }); } }}
              style={{ ...box, width: 52, marginLeft: 3, textAlign: "center" }} />
          </label>
        ))}
        {size && <button style={btn()} onClick={() => set({ ...spec, crop: [0, 0, size[0], size[1]] })}>Whole</button>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <button style={btn((spec.fit ?? "tile") === "tile")} onClick={() => set({ ...spec, fit: "tile" })} title="Repeated at 48 art pixels a unit">Tile</button>
        <button style={btn(spec.fit === "fill")} onClick={() => set({ ...spec, fit: "fill" })} title="Stretched over the face once">Fill</button>
        {spec.fit === "fill" && density && (
          <span style={{ fontSize: 12, color: off ? "#ff9a6e" : "#8fd08a" }}>
            {Math.round(density[0])} × {Math.round(density[1])} px a unit{off ? ` (not ${DENSITY}: pixels won't match)` : " ✓"}
          </span>
        )}
      </div>
    </div>
  );
}

// The picture, blown up with square pixels, the crop drawn over it; drag on it for a new crop (whole pixels).
function CropBox({ src, size, crop, onCrop }: { src: string; size?: readonly [number, number]; crop: Crop; onCrop: (c: Crop) => void }) {
  const [w, h] = size ?? [crop[0] + crop[2], crop[1] + crop[3]];
  const k = Math.max(1, Math.floor(VIEW / Math.max(w, h, 1)));
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [live, setLive] = useState<Crop | null>(null);
  const at = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: Math.max(0, Math.min(w, Math.round((e.clientX - r.left) / k))), y: Math.max(0, Math.min(h, Math.round((e.clientY - r.top) / k))) };
  };
  const rect = (a: { x: number; y: number }, b: { x: number; y: number }): Crop => [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(1, Math.abs(b.x - a.x)), Math.max(1, Math.abs(b.y - a.y))];
  const c = live ?? crop;
  return (
    <div style={{ overflow: "auto", maxWidth: "100%", background: "repeating-conic-gradient(#222 0% 25%, #2c2c2c 0% 50%) 0 0 / 12px 12px", borderRadius: 4 }}>
      <div style={{ position: "relative", width: w * k, height: h * k, touchAction: "none", cursor: "crosshair" }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = at(e); setLive(rect(drag.current, drag.current)); }}
        onPointerMove={(e) => { if (drag.current) setLive(rect(drag.current, at(e))); }}
        onPointerUp={(e) => { if (drag.current) { onCrop(rect(drag.current, at(e))); drag.current = null; setLive(null); } }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} style={{ width: w * k, height: h * k, imageRendering: "pixelated", display: "block", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: c[0] * k, top: c[1] * k, width: c[2] * k, height: c[3] * k, outline: "2px solid #ffd66e", boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}
