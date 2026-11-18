"use client";
// app/lab/propbuilder/Editor.tsx — 🧪 the prop builder's parts panel (app/lab/propbuilder/page.tsx): the list of
// parts (tap one to pick it; ▲▼ move it in the list), adding, duplicating and deleting, and the picked part's
// fields: where it stands, its size and turn (each typed, or nudged a snap step with − and +), a cylinder's sides
// and taper, its light and glow; and its faces' paint (./FacePicker.tsx). Every change goes through lib/props/edit.ts.

import { useState } from "react";
import { DENSITY, TURN_STEP, type FaceSpec, type PartKind, type PartSpec } from "@/lib/props/recipe";
import FacePicker from "./FacePicker";

export type EditorProps = {
  parts: PartSpec[]; picked: string | null; step: number;
  onPick: (id: string) => void; onChange: (id: string, patch: Partial<PartSpec>) => void; onRename: (id: string, to: string) => void;
  onAdd: (kind: PartKind) => void; onDuplicate: () => void; onDelete: () => void; onMove: (by: -1 | 1) => void;
  onPaint: (id: string, face: string, spec: FaceSpec | null) => void; density: (id: string, face: string) => [number, number] | null;
};

const btn = (on = false) => ({ minHeight: 44, minWidth: 44, padding: "0 10px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });
const KINDS: PartKind[] = ["box", "cylinder", "panel", "sprite"];
const AXES = ["x", "y", "z"];

export default function Editor(p: EditorProps) {
  const part = p.parts.find((q) => q.id === p.picked);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {p.parts.map((q) => <button key={q.id} style={btn(q.id === p.picked)} onClick={() => p.onPick(q.id)}>{q.id}</button>)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {KINDS.map((k) => <button key={k} style={btn()} onClick={() => p.onAdd(k)}>+ {k}</button>)}
      </div>
      {part ? <PartFields key={part.id} part={part} {...p} /> : <div style={{ color: "#8a8a99", fontSize: 13 }}>Tap a part in the middle copy, or in the list, to edit it.</div>}
    </div>
  );
}

function PartFields({ part, step, onChange, onRename, onDuplicate, onDelete, onMove, parts, onPaint, density }: EditorProps & { part: PartSpec }) {
  const flat = part.kind === "panel" || part.kind === "sprite";
  const [face, setFace] = useState(() => (part.faces["*"] ? "*" : Object.keys(part.faces)[0] ?? "*"));
  const set = (key: "at" | "size" | "turn", i: number, v: number) => {
    const now = [...(part[key] ?? [0, 0, 0])];
    now[i] = v;
    onChange(part.id, { [key]: now });
  };
  const sizeAxes = flat ? ["w", "h"] : ["w", "h", "d"];
  return (
    <div style={{ display: "grid", gap: 8, background: "#1a1814", border: "1px solid #3a3020", borderRadius: 8, padding: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <IdField id={part.id} onRename={(to) => onRename(part.id, to)} />
        <span style={{ fontSize: 12, color: "#8a8a99" }}>{part.kind}</span>
        <button style={btn()} title="Earlier in the list" onClick={() => onMove(-1)}>▲</button>
        <button style={btn()} title="Later in the list" onClick={() => onMove(1)}>▼</button>
        <button style={btn()} onClick={onDuplicate}>Duplicate</button>
        <button style={btn()} disabled={parts.length < 2} onClick={onDelete}>Delete</button>
      </div>
      <Row label="At">{AXES.map((a, i) => <NumberField key={a} label={a} value={part.at[i]} step={step} px onChange={(v) => set("at", i, v)} />)}</Row>
      <Row label="Size">{sizeAxes.map((a, i) => <NumberField key={a} label={a} value={part.size[i]} step={step} px onChange={(v) => set("size", i, v)} />)}</Row>
      {part.kind !== "sprite" && <Row label="Turn">{AXES.map((a, i) => <NumberField key={a} label={`${a}°`} value={part.turn?.[i] ?? 0} step={TURN_STEP} onChange={(v) => set("turn", i, v)} />)}</Row>}
      {part.kind === "cylinder" && (
        <Row label="Shape">
          <NumberField label="sides" value={part.sides ?? 12} step={1} min={3} max={32} onChange={(v) => onChange(part.id, { sides: Math.round(v) })} />
          <NumberField label="taper" value={part.taper ?? 1} step={0.05} min={0} onChange={(v) => onChange(part.id, { taper: Math.round(v * 1e4) / 1e4 })} />
        </Row>
      )}
      <Row label="Light">
        <button style={btn((part.light ?? "unlit") === "unlit")} onClick={() => onChange(part.id, { light: "unlit" })}>Unlit</button>
        <button style={btn(part.light === "toon")} onClick={() => onChange(part.id, { light: "toon" })}>Toon</button>
        <button style={btn(!!part.glow)} onClick={() => onChange(part.id, { glow: !part.glow })}>Glow</button>
        <button style={btn(!!part.four)} onClick={() => onChange(part.id, { four: !part.four })} title="Repeated at all four corners (or sides), a quarter turn apart round the middle">×4 round</button>
        {!flat && <button style={btn(!!part.inside)} onClick={() => onChange(part.id, { inside: !part.inside })} title="Hollow: its inner walls show (a pot's inside)">Hollow</button>}
        {!flat && <button style={btn(!!part.outline)} onClick={() => onChange(part.id, { outline: !part.outline })} title="A dark pixel round its edges">Outline</button>}
      </Row>
      <div style={{ borderTop: "1px solid #3a3020", paddingTop: 8 }}>
        <div style={{ fontSize: 12, color: "#cbbf9f", marginBottom: 6 }}>Faces</div>
        <FacePicker part={part} face={face} onFace={setFace} onPaint={(f, s) => onPaint(part.id, f, s)} density={(f) => density(part.id, f)} />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span style={{ width: 44, fontSize: 12, color: "#cbbf9f" }}>{label}</span>
      {children}
    </div>
  );
}

// A number: typed (kept on Enter or leaving the box) or nudged one `step` with − and +. `px`: also shown in art
// pixels (48 a unit), to match against a drawing.
function NumberField({ label, value, step, onChange, min, max, px = false }: { label: string; value: number; step: number; onChange: (v: number) => void; min?: number; max?: number; px?: boolean }) {
  const [typed, setTyped] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = () => { if (typed !== null) { const v = Number(typed); if (Number.isFinite(v)) onChange(clamp(v)); setTyped(null); } };
  const shown = Math.round(value * 1e4) / 1e4;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: 11, color: "#8a8a99", width: 26, textAlign: "right" }}>{label}</span>
      <button style={{ ...btn(), padding: 0 }} onClick={() => onChange(clamp(value - step))}>−</button>
      <input value={typed ?? String(shown)} onChange={(e) => setTyped(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        inputMode="decimal" style={{ width: 62, height: 40, background: "#0e0d0b", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 4, textAlign: "center" }} />
      <button style={{ ...btn(), padding: 0 }} onClick={() => onChange(clamp(value + step))}>+</button>
      {px && <span style={{ fontSize: 10, color: "#8a8a99", width: 38 }}>{Math.round(value * DENSITY * 10) / 10}px</span>}
    </span>
  );
}

function IdField({ id, onRename }: { id: string; onRename: (to: string) => void }) {
  const [typed, setTyped] = useState<string | null>(null);
  const commit = () => { if (typed !== null) { onRename(typed.trim().toLowerCase()); setTyped(null); } };
  return (
    <input value={typed ?? id} onChange={(e) => setTyped(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} title="The part's name (lower-case letters, digits and dashes)"
      style={{ width: 150, height: 40, background: "#0e0d0b", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 4, padding: "0 6px" }} />
  );
}
