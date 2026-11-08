// lib/world/placementView.ts
// The placement debugging view (docs/world-spec.md §8 2b-2 stage A, the user,
// 2026-11-08): one room of a run as a picture of what the placer saw and did,
// to see why things went where they did. Pure: it returns an SVG (drawn by
// app/lab/placement), so a test can check it.
//
// Shown: the panel grid and each panel's 3 × 3 subcells; rock, floor and
// tunnel; reservations (doors, required paths, spots kept for things); panels
// blocked to walking (the temporary policy, hatched); each occupancy layer's
// subcells (structure, blocking, walk-over, trigger, overhead); clearances;
// each thing's footprint and anchor; where each thing you use is used from;
// attachment slots on walls and pillars, free or taken; foes and the witch
// with their bodies' footprints; and every spot tried and refused, numbered
// (the reasons are listed beside the picture). World version 5 (stage B)
// adds the darkness map (the panels the room's torches and campfires leave
// dark, and what each candle then lit), mounted candles in their slots with
// their light points and whether they start lit, and the room's candle budget.

import { layoutFloorplan } from "../dungeon/layout";
import { ROCK, FLOOR, type Pt } from "../dungeon/floorplan";
import type { WalkRun } from "../dungeon/walkRun";
import type { Room } from "../dungeon/run";
import { footprintCells, subcellOfPanel, SUBCELLS } from "./grid";
import { LAYERS, attachmentSlots, slotPoint, slotLightCell, subcellPoint, occupant, panelKey, type Layer } from "./occupancy";
import { navBlocked } from "./policy";
import { objectDef, type Instance } from "./objects";
import { creatureSize } from "./creatures";
import { MOUNTED_DEFS, type Placed, type CandleBudget } from "./place";

export const VIEW_COLOURS = {
  rock: "#3a3a46", floor: "#e8e1d2", tunnel: "#c9d3e0",
  door: "#4a90e2", path: "#f5c542", point: "#e056c1",
  blocked: "#c0392b",
  structure: "#5b5b66", blocking: "#d9534f", "walk-over": "#4caf50", trigger: "#8e44ad", overhead: "#2e86de",
  clearance: "#f39c12", access: "#16a7b8", slot: "#7f8c8d", slotTaken: "#e67e22", foe: "#222", rejected: "#000",
  dark: "#1d2b6b", candleLit: "#ffd23f", candle: "#b8860b",
} as const;

export type ViewNote = { n: number; id: string; what: string };

// The room's picture, and the numbered refusals it marks.
export function placementSvg(walk: WalkRun, placed: Placed, roomId: string, room: (id: string) => Room | undefined, S = 10): { svg: string; rejected: ViewNote[]; things: Instance[]; budget?: CandleBudget } {
  const fp = layoutFloorplan(walk.layout), o = placed.occupancy, P = S * SUBCELLS;
  const floors = fp.rooms[roomId] ?? [];
  const x0 = Math.min(...floors.map((r) => r.x)) - 1, y0 = Math.min(...floors.map((r) => r.y)) - 1;
  const x1 = Math.max(...floors.map((r) => r.x + r.w)) + 1, y1 = Math.max(...floors.map((r) => r.y + r.h)) + 1;
  const budget = placed.lighting?.budgets.find((b) => b.room === roomId);
  const W = (x1 - x0) * P, mapH = (y1 - y0) * P, H = mapH + (budget ? 34 : 0);
  const inView = (p: Pt) => p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1;
  const px = (x: number) => (x - x0) * P, py = (y: number) => (y - y0) * P;     // a panel's left/top edge
  // A subcell's left/top edge: panel p holds subcells 3p − 1 … 3p + 1.
  const cx = (s: number) => px(Math.floor((s + 1) / SUBCELLS)) + (s - Math.floor((s + 1) / SUBCELLS) * SUBCELLS + 1) * S;
  const cy = (s: number) => py(Math.floor((s + 1) / SUBCELLS)) + (s - Math.floor((s + 1) / SUBCELLS) * SUBCELLS + 1) * S;
  const ux = (u: number) => (u - x0 + 0.5) * P, uy = (u: number) => (u - y0 + 0.5) * P; // a point in u
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="monospace">`);
  out.push(`<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${VIEW_COLOURS.blocked}" stroke-width="2"/></pattern></defs>`);
  // Panels: rock, floor, tunnel; reservations; blocked to walking.
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const t = x < 0 || y < 0 || x >= fp.w || y >= fp.h ? ROCK : fp.tiles[y * fp.w + x];
    out.push(`<rect x="${px(x)}" y="${py(y)}" width="${P}" height="${P}" fill="${t === ROCK ? VIEW_COLOURS.rock : t === FLOOR ? VIEW_COLOURS.floor : VIEW_COLOURS.tunnel}"/>`);
    const r = o.reserved.get(panelKey({ x, y }));
    if (r) out.push(`<rect x="${px(x)}" y="${py(y)}" width="${P}" height="${P}" fill="${VIEW_COLOURS[r.why]}" opacity="0.28"><title>${esc(`${r.why}${r.owner ? `: ${r.owner}` : ""}`)}</title></rect>`);
    // (v5) The darkness map: dark with every torch and campfire lit, or lit by a candle.
    const lit = placed.lighting?.candleLit.get(panelKey({ x, y }));
    if (lit) out.push(`<rect x="${px(x)}" y="${py(y)}" width="${P}" height="${P}" fill="${VIEW_COLOURS.candleLit}" opacity="0.4"><title>${esc(`dark, lit by ${lit}`)}</title></rect>`);
    else if (placed.lighting?.dark.has(panelKey({ x, y }))) out.push(`<rect x="${px(x)}" y="${py(y)}" width="${P}" height="${P}" fill="${VIEW_COLOURS.dark}" opacity="0.3"><title>dark</title></rect>`);
    if (t !== ROCK && navBlocked(o, { x, y })) out.push(`<rect x="${px(x)}" y="${py(y)}" width="${P}" height="${P}" fill="url(#hatch)" opacity="0.55"><title>blocked to walking (policy)</title></rect>`);
  }
  // Each layer's subcells, and clearances.
  for (let s = subcellOfPanel(x0) - 1; s <= subcellOfPanel(x1 - 1) + 1; s++) for (let t = subcellOfPanel(y0) - 1; t <= subcellOfPanel(y1 - 1) + 1; t++) {
    for (const l of LAYERS) {
      const who = occupant(o, l, { sx: s, sy: t });
      if (!who) continue;
      const fill = VIEW_COLOURS[l as Layer];
      out.push(l === "overhead"
        ? `<rect x="${cx(s) + 1}" y="${cy(t) + 1}" width="${S - 2}" height="${S - 2}" fill="none" stroke="${fill}" stroke-width="2"><title>${esc(`${l}: ${who}`)}</title></rect>`
        : `<rect x="${cx(s)}" y="${cy(t)}" width="${S}" height="${S}" fill="${fill}" opacity="${l === "trigger" ? 0.45 : 0.8}"><title>${esc(`${l}: ${who}`)}</title></rect>`);
    }
    const c = o.clear.get(`${s},${t}`);
    if (c) out.push(`<rect x="${cx(s) + 1.5}" y="${cy(t) + 1.5}" width="${S - 3}" height="${S - 3}" fill="none" stroke="${VIEW_COLOURS.clearance}" stroke-dasharray="2 2"><title>${esc(`clearance: ${c}`)}</title></rect>`);
  }
  // The grid: subcells faint, panels firm.
  for (let x = x0; x <= x1; x++) for (let k = 0; k < SUBCELLS; k++) out.push(`<line x1="${px(x) + k * S}" y1="0" x2="${px(x) + k * S}" y2="${mapH}" stroke="#000" stroke-opacity="${k ? 0.1 : 0.4}"/>`);
  for (let y = y0; y <= y1; y++) for (let k = 0; k < SUBCELLS; k++) out.push(`<line x1="0" y1="${py(y) + k * S}" x2="${W}" y2="${py(y) + k * S}" stroke="#000" stroke-opacity="${k ? 0.1 : 0.4}"/>`);
  // Attachment slots on the faces of walls and pillars in view, free or taken (and by what).
  // A mounted candle (v5): its slot, a line to its light point (filled if it starts lit).
  const byId = new Map(placed.placed.map((i) => [i.id, i]));
  for (const sl of attachmentSlots(fp)) {
    if (!inView(sl.floor)) continue;
    const q = slotPoint(sl), who = o.attached.get(sl.key), i = who ? byId.get(who) : undefined;
    if (i && MOUNTED_DEFS.includes(i.def)) {
      const c = subcellPoint(slotLightCell(sl)), lit = i.start === "lit";
      out.push(`<line x1="${ux(q.x)}" y1="${uy(q.y)}" x2="${ux(c.x)}" y2="${uy(c.y)}" stroke="${VIEW_COLOURS.candle}" stroke-width="2"/>`);
      out.push(`<circle cx="${ux(c.x)}" cy="${uy(c.y)}" r="4" fill="${lit ? VIEW_COLOURS.candleLit : "#fff"}" stroke="${VIEW_COLOURS.candle}" stroke-width="2"><title>${esc(`${who}: light point (${lit ? "starts lit" : "unlit"})`)}</title></circle>`);
    }
    out.push(`<circle cx="${ux(q.x)}" cy="${uy(q.y)}" r="${who ? 4 : 2}" fill="${i && MOUNTED_DEFS.includes(i.def) ? VIEW_COLOURS.candle : who ? VIEW_COLOURS.slotTaken : VIEW_COLOURS.slot}"><title>${esc(`${sl.kind} slot, ${sl.wall} wall, ${sl.k}${who ? `: ${who}` : ""}`)}</title></circle>`);
  }
  // Things: footprint outline, anchor, where each one you use is used from.
  const things = placed.placed.filter((i) => inView({ x: Math.floor((i.sx + 1) / 3), y: Math.floor((i.sy + 1) / 3) }));
  for (const i of things) {
    const d = objectDef(i.def);
    if (i.def === "foe" || i.def === "witch") {
      const r = room(i.room), species = i.foe?.waits ? r?.boss ?? r?.enemies?.[0]?.creatureId : r?.enemies?.[Number(i.id.split(":").pop())]?.creatureId;
      const body = footprintCells(i, species ? creatureSize(species) : { w: 2, d: 2 });
      const bx = Math.min(...body.map((c) => c.sx)), by = Math.min(...body.map((c) => c.sy));
      const bw = Math.max(...body.map((c) => c.sx)) - bx + 1, bh = Math.max(...body.map((c) => c.sy)) - by + 1;
      out.push(`<rect x="${cx(bx)}" y="${cy(by)}" width="${bw * S}" height="${bh * S}" fill="none" stroke="${VIEW_COLOURS.foe}" stroke-dasharray="4 2"/>`);
      out.push(`<circle cx="${cx(i.sx) + S / 2}" cy="${cy(i.sy) + S / 2}" r="${S * 0.45}" fill="${i.def === "witch" ? "#9b59b6" : VIEW_COLOURS.foe}"><title>${esc(`${i.id}${species ? ` (${species})` : ""}`)}</title></circle>`);
      continue;
    }
    if (d.attach !== "floor" || !i.size) continue;
    const cells = footprintCells(i, i.size);
    const fx = Math.min(...cells.map((c) => c.sx)), fy = Math.min(...cells.map((c) => c.sy));
    const fw = Math.max(...cells.map((c) => c.sx)) - fx + 1, fh = Math.max(...cells.map((c) => c.sy)) - fy + 1;
    out.push(`<rect x="${cx(fx)}" y="${cy(fy)}" width="${fw * S}" height="${fh * S}" fill="none" stroke="#111" stroke-width="1.5"><title>${esc(`${i.id} (${i.def}, ${fw}×${fh})`)}</title></rect>`);
    out.push(`<circle cx="${cx(i.sx) + S / 2}" cy="${cy(i.sy) + S / 2}" r="2" fill="#111"/>`);
    out.push(`<text x="${cx(fx) + 1}" y="${cy(fy) - 2}" font-size="${Math.max(7, S * 0.8)}" fill="#111">${esc(i.def)}</text>`);
    if (d.interact) for (const { dx, dy } of d.interact.points) {
      const p = { x: Math.floor((i.sx + 1) / 3) + dx, y: Math.floor((i.sy + 1) / 3) + dy };
      if ((dx || dy) && fp.tiles[p.y * fp.w + p.x] !== ROCK && !navBlocked(o, p)) out.push(`<circle cx="${px(p.x) + P / 2}" cy="${py(p.y) + P / 2}" r="3" fill="none" stroke="${VIEW_COLOURS.access}" stroke-width="2"><title>${esc(`${i.id} used from here`)}</title></circle>`);
    }
  }
  // Refusals, numbered.
  const rejected: ViewNote[] = [];
  for (const r of placed.report.rejected) {
    if (!inView({ x: Math.floor((r.sx + 1) / 3), y: Math.floor((r.sy + 1) / 3) })) continue;
    const n = rejected.length + 1;
    rejected.push({ n, id: r.id, what: r.what });
    const x = cx(r.sx), y = cy(r.sy);
    out.push(`<g stroke="${VIEW_COLOURS.rejected}" stroke-width="1.2"><line x1="${x + 2}" y1="${y + 2}" x2="${x + S - 2}" y2="${y + S - 2}"/><line x1="${x + S - 2}" y1="${y + 2}" x2="${x + 2}" y2="${y + S - 2}"/></g><text x="${x + S}" y="${y + S / 2}" font-size="7" fill="#000">${n}<title>${esc(`${r.id}: ${r.what}`)}</title></text>`);
  }
  // (v5) The room's candle budget, under the picture.
  if (budget) {
    const b = budget, f2 = (n: number) => n.toFixed(2);
    out.push(`<rect x="0" y="${mapH}" width="${W}" height="34" fill="#fff"/>`);
    out.push(`<text x="4" y="${mapH + 14}" font-size="11" fill="#000">${esc(`${b.kind || "?"} (${b.group}${b.large ? ", large" : ""}): D ${b.dark} of ${b.floor} · W ${b.weight} · E ${f2(b.expected)} → ${b.wanted} wanted, ${b.mounted} mounted`)}</text>`);
    out.push(`<text x="4" y="${mapH + 28}" font-size="11" fill="#000">${esc(`dark left ${b.darkLeft} (${Math.round((100 * b.darkLeft) / Math.max(1, b.floor))}%) · floor candles: F ${f2(b.floorExpected)} → ${b.floorWanted} wanted, ${b.floorPlaced} placed`)}</text>`);
  }
  out.push("</svg>");
  return { svg: out.join(""), rejected, things, ...(budget ? { budget } : {}) };
}
