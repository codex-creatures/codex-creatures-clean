"use client";
// app/lab/propbuilder/Builder.tsx — 🧪 the prop builder (app/lab/propbuilder/page.tsx): a recipe being edited
// (lib/props/edit.ts, with undo), drawn as the game will draw it (./Preview.tsx), its parts edited in ./Editor.tsx.
// Tap a part in the middle copy to pick it. Keys: arrows move it a snap step (Shift: up and down), Ctrl+Z / Ctrl+Y
// undo and redo, Ctrl+D duplicates, Delete deletes. An unsaved draft of each recipe is kept in this browser
// (DRAFT_KEY) till it's reset; the file in lib/props/recipes/ changes only when it's saved (stage 4: for now, Copy
// JSON and paste it into the file).

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { readRecipe, formatRecipe, SNAP_STEPS, ART_STEP, type Part, type PartKind, type PartSpec, type RecipeSpec } from "@/lib/props/recipe";
import { addPart, changePart, deletePart, duplicatePart, renamePart, reorderPart, startHistory, edit, undo, redo, type History } from "@/lib/props/edit";
import { RECIPE_FILES } from "@/lib/props/recipes";
import type { StationKey } from "@/lib/den3d/layout";
import Editor from "./Editor";

const Preview = dynamic(() => import("./Preview"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });

// What the game draws now for each recipe, to match against (the Den's places).
const NOW: Record<string, StationKey> = { altar: "altar" };
// Unsaved drafts, per recipe, in this browser only (a lab convenience, not a save).
export const DRAFT_KEY = "codex_creatures_propbuilder_draft_v1";
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
const fromFile = (id: string) => structuredClone(RECIPE_FILES[id]) as RecipeSpec;
const same = (a: RecipeSpec, b: RecipeSpec) => JSON.stringify(a) === JSON.stringify(b);

export default function Builder() {
  const ids = Object.keys(RECIPE_FILES);
  const [id, setId] = useState(ids[0]);
  const [h, setH] = useState<History>(() => startHistory(loadDrafts()[ids[0]] ?? fromFile(ids[0])));
  const [picked, setPicked] = useState<string | null>(null);
  const [stepAt, setStepAt] = useState(0);
  const [snapOn, setSnapOn] = useState(true);
  const [angle, setAngle] = useState(60);
  const [warm, setWarm] = useState(true);
  const [lean, setLean] = useState(true);
  const [compare, setCompare] = useState(true);
  const [note, setNote] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [cache] = useState(() => new WeakMap<object, Part>());
  const step = SNAP_STEPS[stepAt];

  const read = useMemo(() => readRecipe(h.now, cache), [h.now, cache]);
  const changed = useMemo(() => !same(h.now, fromFile(id)), [h.now, id]);
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

  const switchTo = (k: string) => { setId(k); setH(startHistory(loadDrafts()[k] ?? fromFile(k))); setPicked(null); };
  const reset = () => { if (window.confirm(`Throw away your changes to ${id} and go back to the file?`)) { setH((x) => edit(x, fromFile(id))); setPicked(null); } };
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
              ? <Preview recipe={read.recipe} compare={compare ? NOW[id] : undefined} angle={angle} warm={warm} lean={lean} picked={picked} onPick={setPicked} />
              : <pre style={{ color: "#e88", padding: 12, whiteSpace: "pre-wrap" }}>{read.errors.join("\n")}{"\n\n"}Undo (Ctrl+Z) to go back.</pre>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {ids.map((k) => <button key={k} style={btn(id === k)} onClick={() => switchTo(k)}>{k}</button>)}
            <button style={btn(compare)} onClick={() => setCompare(!compare)}>Game&apos;s own behind</button>
            <button style={btn(warm)} onClick={() => setWarm(!warm)}>Den light</button>
            <button style={btn(lean)} onClick={() => setLean(!lean)}>Lean</button>
            {[45, 60, 75].map((a) => <button key={a} style={btn(angle === a)} onClick={() => setAngle(a)}>{a}°</button>)}
          </div>
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
            onAdd={add} onDuplicate={duplicate} onDelete={remove} onMove={(by) => picked && apply((r) => reorderPart(r, picked, by))} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <button style={btn(false)} onClick={copy}>Copy JSON</button>
            <button style={btn(showJson)} onClick={() => setShowJson(!showJson)}>Show JSON</button>
            <button style={btn(false)} disabled={!changed} onClick={reset}>Reset to file</button>
            <span style={{ fontSize: 12, color: changed ? "#ffd66e" : "#8a8a99" }}>{note || (changed ? "Changed (kept as a draft in this browser)" : "Same as the file")}</span>
          </div>
          {showJson && <textarea readOnly value={formatRecipe(h.now)} style={{ width: "100%", height: 260, background: "#0e0d0b", color: "#cbbf9f", fontFamily: "monospace", fontSize: 11 }} />}
        </div>
      </div>
    </div>
  );
}
