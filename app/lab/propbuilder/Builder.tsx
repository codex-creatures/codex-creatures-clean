"use client";
// app/lab/propbuilder/Builder.tsx — 🧪 the prop builder (app/lab/propbuilder/page.tsx): a recipe being edited
// (lib/props/edit.ts, with undo), drawn as the game will draw it (./Preview.tsx), its parts edited in ./Editor.tsx.
// Tap a part in the middle copy to pick it. Keys: arrows move it a snap step (Shift: up and down), Ctrl+Z / Ctrl+Y
// undo and redo, Ctrl+D duplicates, Delete deletes. An unsaved draft of each recipe (a new one too) is kept in this
// browser (DRAFT_KEY) till it's saved or reset. Save writes lib/props/recipes/<id>.json under `npm run dev` (./save,
// dev only); anywhere else it downloads the file to put there. The drawing (the recipe's `ref`) can be laid over
// the view; the light can be the Den's or the Labyrinth's torch; and the palette check snaps it to a palette.

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { readRecipe, formatRecipe, partFaces, faceDensity, SNAP_STEPS, ART_STEP, type FaceSpec, type Part, type PartKind, type PartSpec, type RecipeSpec } from "@/lib/props/recipe";
import { uprightStretch } from "@/lib/render3d/dungeon3d";
import { addPart, changeFace, changePart, deletePart, duplicatePart, renamePart, reorderPart, startHistory, edit, undo, redo, type History } from "@/lib/props/edit";
import { RECIPE_FILES } from "@/lib/props/recipes";
import type { StationKey } from "@/lib/den3d/layout";
import { PALETTE_KEYS, type PaletteKey } from "@/lib/props/palette";
import SPRITES from "@/lib/props/sprites.json";
import Editor from "./Editor";
import type { LightMode } from "./Preview";

const Preview = dynamic(() => import("./Preview"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });

// What the game draws now for each recipe, to match against (the Den's places).
const NOW: Record<string, StationKey> = { altar: "altar", pool: "pool", pit: "pit" };
import { DRAFT_KEY } from "./drafts";
const STEP_NAMES = ["1 px", "1/8", "1/4", "1/2"];

type Drafts = Record<string, RecipeSpec>;
function loadDrafts(): Drafts {
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); return d && typeof d === "object" ? d : {}; } catch { return {}; }
}
function saveDraft(id: string, r: RecipeSpec | null) {
  try {
    const d = loadDrafts();
    if (r) d[id] = r; else delete d[id];
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch { /* (private window, or storage full: the draft just isn't kept) */ }
}
const fromFile = (id: string) => (RECIPE_FILES[id] ? structuredClone(RECIPE_FILES[id]) as RecipeSpec : undefined);
const SIZES = new Map((SPRITES as [string, number, number][]).map(([p, w, h]) => [p, [w, h] as const]));
// A new prop: one plain box, to build from.
const newProp = (id: string, name: string, setting: "den" | "dungeon"): RecipeSpec => ({ format: 1, id, name, setting,
  parts: [{ id: "base", kind: "box", at: [0, 0, 0], size: [1, 0.5, 1], faces: { "*": { colour: "#8a7a66" } } }] });
const LIGHTS: [LightMode, string][] = [["even", "Even light"], ["den", "Den light"], ["torch", "Torch"]];
const same = (a: RecipeSpec, b: RecipeSpec) => JSON.stringify(a) === JSON.stringify(b);
const field = { height: 40, background: "#0e0d0b", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 4, padding: "0 6px" };

export default function Builder() {
  // Every recipe: the files', and new ones not saved yet (drafts in this browser).
  const [ids, setIds] = useState(() => [...new Set([...Object.keys(RECIPE_FILES), ...Object.keys(loadDrafts())])]);
  const [id, setId] = useState(ids[0]);
  const [h, setH] = useState<History>(() => startHistory(loadDrafts()[ids[0]] ?? fromFile(ids[0])!));
  const [picked, setPicked] = useState<string | null>(null);
  const [stepAt, setStepAt] = useState(0);
  const [snapOn, setSnapOn] = useState(true);
  const [angle, setAngle] = useState(60);
  const [light, setLight] = useState<LightMode>("den");
  const [pal, setPal] = useState<PaletteKey | null>(null);
  const [overlay, setOverlay] = useState({ show: true, opacity: 0.5 });
  const [making, setMaking] = useState<{ id: string; name: string; setting: "den" | "dungeon" } | null>(null);
  const [lean, setLean] = useState(true);
  const [compare, setCompare] = useState(true);
  const [note, setNote] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [cache] = useState(() => new WeakMap<object, Part>());
  const step = SNAP_STEPS[stepAt];

  const read = useMemo(() => readRecipe(h.now, cache), [h.now, cache]);
  const changed = useMemo(() => { const file = fromFile(id); return !file || !same(h.now, file); }, [h.now, id]);
  useEffect(() => { saveDraft(id, changed ? h.now : null); }, [id, h.now, changed]);

  // Every edit goes through here: one step of undo each.
  const apply = useCallback((f: (r: RecipeSpec) => RecipeSpec) => setH((x) => edit(x, f(x.now))), []);
  const onChange = useCallback((part: string, patch: Partial<PartSpec>) => apply((r) => changePart(r, part, patch, step, snapOn)), [apply, step, snapOn]);
  const nudge = useCallback((axis: number, by: number) => {
    if (!picked) return;
    apply((r) => { const p = r.parts.find((q) => q.id === picked); if (!p) return r; const at = [...p.at]; at[axis] += by; return changePart(r, picked, { at: at as PartSpec["at"] }, step, snapOn); });
  }, [apply, picked, step, snapOn]);
  const duplicate = useCallback(() => { if (!picked) return; setH((x) => { const d = duplicatePart(x.now, picked, step < 0.25 ? 0.25 : step); setPicked(d.id); return edit(x, d.recipe); }); }, [picked, step]);
  const remove = useCallback(() => { if (!picked) return; apply((r) => deletePart(r, picked)); setPicked(null); }, [apply, picked]);
  const add = (kind: PartKind) => setH((x) => { const a = addPart(x.now, kind); setPicked(a.id); return edit(x, a.recipe); });
  const paint = useCallback((part: string, face: string, spec: FaceSpec | null) => apply((r) => changeFace(r, part, face, spec)), [apply]);
  // A face's pixels a unit on screen, for the "fill" warning ("*": the first face it paints).
  const density = (part: string, face: string) => {
    const p = read.ok ? read.recipe.parts.find((q) => q.id === part) : undefined, spec = h.now.parts.find((q) => q.id === part);
    if (!p || !spec) return null;
    const pitch = (angle * Math.PI) / 180, fs = partFaces(p, { pitch, stretch: uprightStretch(pitch) });
    const f = face === "*" ? fs.find((q) => !(q.face in spec.faces)) : fs.find((q) => q.face === face);
    return f ? faceDensity(f) : null;
  };
  const rename = (part: string, to: string) => { setH((x) => { const next = renamePart(x.now, part, to); if (next !== x.now) setPicked(to); return edit(x, next); }); };

  // The keys (not while typing in a box).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (ctrl && k === "z") { e.preventDefault(); setH((x) => (e.shiftKey ? redo(x) : undo(x))); }
      else if (ctrl && k === "y") { e.preventDefault(); setH(redo); }
      else if (ctrl && k === "d") { e.preventDefault(); duplicate(); }
      else if (e.key === "Delete") remove();
      else if (e.key.startsWith("Arrow") && picked) {
        e.preventDefault();
        const s = snapOn ? step : ART_STEP;
        if (e.key === "ArrowLeft") nudge(0, -s);
        if (e.key === "ArrowRight") nudge(0, s);
        if (e.key === "ArrowUp") { if (e.shiftKey) nudge(1, s); else nudge(2, -s); }
        if (e.key === "ArrowDown") { if (e.shiftKey) nudge(1, -s); else nudge(2, s); }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [duplicate, remove, nudge, picked, step, snapOn]);

  const switchTo = (k: string) => { const r = loadDrafts()[k] ?? fromFile(k); if (!r) return; setId(k); setH(startHistory(r)); setPicked(null); };
  const reset = () => {
    const file = fromFile(id);
    if (!file) { // (a new prop, never saved: thrown away)
      if (!window.confirm(`Throw away ${id}? It's never been saved.`)) return;
      saveDraft(id, null);
      const rest = ids.filter((k) => k !== id);
      setIds(rest); switchTo(rest[0]);
      return;
    }
    if (window.confirm(`Throw away your changes to ${id} and go back to the file?`)) { setH((x) => edit(x, file)); setPicked(null); }
  };
  const make = () => {
    if (!making) return;
    const k = making.id.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(k) || ids.includes(k)) { setNote("A new prop needs a free name of lower-case letters, digits and dashes"); return; }
    const r = newProp(k, making.name.trim() || k, making.setting);
    saveDraft(k, r); setIds([...ids, k]); setId(k); setH(startHistory(r)); setPicked("base"); setMaking(null);
  };
  // The drawing to build against (the recipe's `ref`): its picture and the pixel that stands on the prop's origin.
  const setRef = (ref: RecipeSpec["ref"] | undefined) => apply((r) => { const next = { ...r }; if (ref) next.ref = ref; else delete next.ref; return next; });
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([formatRecipe(h.now)], { type: "application/json" }));
    a.download = `${id}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  // Save: into the repo under the dev server; anywhere else, the file downloaded to put there yourself.
  const save = async () => {
    if (!read.ok) { setNote("Not saved: it doesn't read (see the errors)"); return; }
    setNote("Saving…");
    try {
      const res = await fetch("/lab/propbuilder/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(h.now) });
      const j = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
      if (res.ok && j?.ok) { setNote(`Saved: ${j.file} (the page picks it up in a moment)`); return; }
      if (res.status === 400 && j) { setNote(`Not saved: ${j.errors.join("; ")}`); return; }
    } catch { /* (no dev server: download it instead) */ }
    download();
    setNote(`Downloaded ${id}.json: put it in lib/props/recipes/${fromFile(id) ? "" : " and list it in index.ts"}`);
  };
  const copy = () => {
    navigator.clipboard?.writeText(formatRecipe(h.now)).then(() => setNote(`Copied: paste it over lib/props/recipes/${id}.json`), () => setShowJson(true));
  };
  const btn = (on: boolean) => ({ minHeight: 44, padding: "0 10px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
  return (
    <div style={{ background: "#111", color: "#f1d9a0", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Prop builder</h1>
      <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 8px", maxWidth: 1100 }}>
        Left, middle, right: the prop as the game will draw it at each edge of the screen. Behind: what the game draws now. Tap a part in the middle copy to edit it. Keys: arrows move it (Shift: up/down), Ctrl+Z / Ctrl+Y undo/redo, Ctrl+D duplicate, Delete.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 520px", maxWidth: 760 }}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 8, overflow: "hidden" }}>
            {read.ok
              ? <Preview recipe={read.recipe} compare={compare ? NOW[id] : undefined} angle={angle} light={light} lean={lean} palette={pal} overlay={overlay} picked={picked} onPick={setPicked} />
              : <pre style={{ color: "#e88", padding: 12, whiteSpace: "pre-wrap" }}>{read.errors.join("\n")}{"\n\n"}Undo (Ctrl+Z) to go back.</pre>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {ids.map((k) => <button key={k} style={btn(id === k)} onClick={() => switchTo(k)}>{k}{fromFile(k) ? "" : " (new)"}</button>)}
            <button style={btn(!!making)} onClick={() => setMaking(making ? null : { id: "", name: "", setting: "den" })}>+ New prop</button>
          </div>
          {making && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8 }}>
              <input value={making.id} onChange={(e) => setMaking({ ...making, id: e.target.value })} placeholder="file name, e.g. healing-pool" style={{ ...field, width: 180 }} />
              <input value={making.name} onChange={(e) => setMaking({ ...making, name: e.target.value })} placeholder="name, e.g. Healing Pool" style={{ ...field, width: 180 }} />
              {(["den", "dungeon"] as const).map((s) => <button key={s} style={btn(making.setting === s)} onClick={() => setMaking({ ...making, setting: s })}>{s}</button>)}
              <button style={btn(false)} onClick={make}>Make it</button>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <button style={btn(compare)} onClick={() => setCompare(!compare)}>Game&apos;s own behind</button>
            {LIGHTS.map(([k, name]) => <button key={k} style={btn(light === k)} onClick={() => setLight(k)}>{name}</button>)}
            <button style={btn(lean)} onClick={() => setLean(!lean)}>Lean</button>
            {[45, 60, 75].map((a) => <button key={a} style={btn(angle === a)} onClick={() => setAngle(a)}>{a}°</button>)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#cbbf9f" }}>Palette check</span>
            <button style={btn(pal === null)} onClick={() => setPal(null)}>Off</button>
            {PALETTE_KEYS.map((k) => <button key={k} style={btn(pal === k)} onClick={() => setPal(k)}>{k}</button>)}
          </div>
          <Drawing value={h.now.ref} overlay={overlay} onOverlay={setOverlay} onChange={setRef} btn={btn} />
        </div>
        <div style={{ flex: "1 1 360px", maxWidth: 600, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <button style={btn(false)} disabled={!h.past.length} onClick={() => setH(undo)}>↶ Undo</button>
            <button style={btn(false)} disabled={!h.future.length} onClick={() => setH(redo)}>↷ Redo</button>
            <span style={{ fontSize: 12, color: "#cbbf9f", marginLeft: 6 }}>Snap</span>
            {STEP_NAMES.map((n, i) => <button key={n} style={btn(snapOn && stepAt === i)} onClick={() => { setSnapOn(true); setStepAt(i); }}>{n}</button>)}
            <button style={btn(!snapOn)} onClick={() => setSnapOn(!snapOn)}>Off</button>
          </div>
          <Editor parts={h.now.parts} picked={picked} step={snapOn ? step : ART_STEP} onPick={setPicked} onChange={onChange} onRename={rename}
            onAdd={add} onDuplicate={duplicate} onDelete={remove} onMove={(by) => picked && apply((r) => reorderPart(r, picked, by))} onPaint={paint} density={density} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <button style={btn(changed)} onClick={save}>💾 Save</button>
            <button style={btn(false)} onClick={copy}>Copy JSON</button>
            <button style={btn(showJson)} onClick={() => setShowJson(!showJson)}>Show JSON</button>
            <button style={btn(false)} disabled={!changed} onClick={reset}>{fromFile(id) ? "Reset to file" : "Throw away"}</button>
            <span style={{ fontSize: 12, color: changed ? "#ffd66e" : "#8a8a99" }}>{note || (changed ? "Changed (kept as a draft in this browser)" : "Same as the file")}</span>
          </div>
          {showJson && <textarea readOnly value={formatRecipe(h.now)} style={{ width: "100%", height: 260, background: "#0e0d0b", color: "#cbbf9f", fontFamily: "monospace", fontSize: 11 }} />}
        </div>
      </div>
    </div>
  );
}

// The drawing to build against: laid over the view (see-through), at its true size, its foot pixel on the middle
// copy's origin. Its picture (a path under /sprites/), that pixel (x, y from its top left), shown or not, how faint.
function Drawing({ value, overlay, onOverlay, onChange, btn }: { value: RecipeSpec["ref"]; overlay: { show: boolean; opacity: number };
  onOverlay: (o: { show: boolean; opacity: number }) => void; onChange: (r: RecipeSpec["ref"] | undefined) => void; btn: (on: boolean) => React.CSSProperties }) {
  const [typed, setTyped] = useState<string | null>(null);
  const size = value && SIZES.get(value.src);
  const choose = (src: string) => { const s = SIZES.get(src); onChange({ src, foot: s ? [Math.floor(s[0] / 2), s[1] - 1] : value?.foot ?? [0, 0] }); };
  const nudge = (i: number, by: number) => { if (!value) return; const f = [...value.foot] as [number, number]; f[i] += by; onChange({ ...value, foot: f }); };
  return (
    <div style={{ display: "grid", gap: 6, marginTop: 10, background: "#1a1814", border: "1px solid #3a3020", borderRadius: 8, padding: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#cbbf9f" }}>Drawing</span>
        <input value={typed ?? value?.src ?? ""} placeholder="/sprites/… (the drawing to build against)" onChange={(e) => setTyped(e.target.value)}
          onBlur={() => { if (typed !== null) { if (typed.startsWith("/sprites/")) choose(typed); else if (!typed) onChange(undefined); setTyped(null); } }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} style={{ ...field, flex: "1 1 220px" }} />
      </div>
      {value && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <button style={btn(overlay.show)} onClick={() => onOverlay({ ...overlay, show: !overlay.show })}>Show over the view</button>
          <label style={{ fontSize: 12, color: "#cbbf9f", display: "flex", alignItems: "center", gap: 6 }}>Faint
            <input type="range" min={0.1} max={1} step={0.05} value={overlay.opacity} onChange={(e) => onOverlay({ ...overlay, opacity: Number(e.target.value) })} /></label>
          <span style={{ fontSize: 12, color: "#cbbf9f" }}>Foot</span>
          {[0, 1].map((i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              <button style={btn(false)} onClick={() => nudge(i, -1)}>−</button>
              <span style={{ width: 44, textAlign: "center", fontSize: 13 }}>{"xy"[i]} {value.foot[i]}</span>
              <button style={btn(false)} onClick={() => nudge(i, 1)}>+</button>
            </span>
          ))}
          {size && <button style={btn(false)} onClick={() => onChange({ ...value, foot: [Math.floor(size[0] / 2), size[1] - 1] })}>Bottom middle</button>}
        </div>
      )}
    </div>
  );
}
