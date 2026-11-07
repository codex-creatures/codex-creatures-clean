// lib/render/scene.ts
// What the walk screen draws each frame (docs/world-spec.md §4), as a list of
// draw commands: built from the walk as it stands (lib/world/walkSim.ts), the
// rooms, and the camera (projection.ts), and nothing else. Pure: no canvas,
// no clock, no images. The walk screen (components/WalkView.tsx) paints the
// list (paint.ts); the tests read it.
//
// The commands are the 2D canvas's own calls, in order (draw this picture
// here, fill this, set the glow to that), so painting the list draws exactly
// what the walk screen drew when it drew straight onto its canvas: phase 1
// moved that code here line for line (§8). A picture that hasn't loaded is
// left out (`ready`), as before. The dark over everything is one command
// ("dark": a pixel a cell, for the cells in view), smoothed up by the painter.

import { ROCK, type Floorplan, type Pt } from "../dungeon/floorplan";
import { isOpen, type Layout } from "../dungeon/layout";
import { drawOrder, facingOf, walkFrame, capFade, FACINGS, WALL_LIFT, type DepthEdges } from "../dungeon/tileArt";
import { torchGlow, rubbleOf, sconceGlow, SCONCE_RADIUS, CANDLE_RADIUS, type Sconce, type Candle } from "../dungeon/torch";
import { floorVariant, wallVariant, type Decor } from "../dungeon/decor";
import { CAMPFIRE_HEAL, type Campfire } from "../dungeon/campfire";
import { ALARM_LIGHT, FADE_TIME } from "../dungeon/foes";
import type { Room } from "../dungeon/run";
import { WALK_KIT, WALK_HERO, WALK_WITCH, WALK_FLOOR_WORN, WALK_WALL_WORN, KIT_PX, KIT_ROW, KIT_NORTH, KIT_CAP, KIT_SIDE } from "../sprites/walk";
import { CREATURE_SPRITES } from "../sprites/creatures";
import { artFor } from "../sprites/art";
import { objectDef, artOf, DECOR_DEF, FOE_U, NPC_U, BOSS_SCALE, CHIEF_SCALE, type ObjectDef, type ArtRef } from "../world/objects";
import { torchThere, fireReach, sconceLight, fireLight, candleLight, type WalkSim, type Frame } from "../world/walkSim";
import type { Thing } from "../world/walkWorld";
import { walkView, artPxAcross, artPxDown, across, legacySize, type View } from "./projection";

export const FALL_TIME = 0.6, DUST_TIME = 1.2, SHAKE_TIME = 0.4, SHAKE_PX = 3; // a tunnel falling in

// The kit's and the hero's art pixels (projection.ts ArtDensity): the kit's rows squashed into a square cell.
const KIT_DENSITY = { perU: KIT_PX, rowsPerU: KIT_ROW }, HERO_DENSITY = { perU: KIT_PX };

const COLOURS = { rock: "#07060b", goal: "#f1d9a0", foe: "#b0302a", rubble: ["#5b5560", "#6f6872", "#48434d"], dust: "200, 190, 175" };
export const DARK_RGB = [6, 5, 12];
const CLOSED = "rgba(7, 6, 11, 0.6)";

// What's drawn the same way every frame (lib/world/objects.ts).
const CAMPFIRE = objectDef("campfire"), CANDLE = objectDef("candle"), BANNER = objectDef("banner"), SOUTH_WALL = objectDef("wall-south");
// A definition's picture on screen, at today's size.
const drawSize = (view: View, d: ObjectDef, a: ArtRef) => legacySize(view, d.visual.legacy, a);

// A picture to draw (by its address), a glow (a radial gradient: its circles
// and colour stops), and the dark (a pixel a cell, x..x+w by y..y+h: how dark).
export type Img = { src: string };
export type Glow = { glow: [number, number, number, number, number, number]; stops: [number, string][]; addColorStop: (at: number, colour: string) => void };
export type Dark = { x: number; y: number; w: number; h: number; alpha: Uint8ClampedArray };
// A command: a canvas call ["fillRect", x, y, w, h], a setting ["set", "globalAlpha", 0.6], or the dark ["dark", Dark, x, y, w, h].
export type DrawCmd = [string, ...unknown[]];

// Takes the canvas calls the drawing makes, in order.
class Recorder {
  cmds: DrawCmd[] = [];
  private put(name: string, v: unknown) { this.cmds.push(["set", name, v]); }
  set fillStyle(v: string | Glow) { this.put("fillStyle", v); }
  set strokeStyle(v: string) { this.put("strokeStyle", v); }
  set lineWidth(v: number) { this.put("lineWidth", v); }
  set globalAlpha(v: number) { this.put("globalAlpha", v); }
  set globalCompositeOperation(v: string) { this.put("globalCompositeOperation", v); }
  set imageSmoothingEnabled(v: boolean) { this.put("imageSmoothingEnabled", v); }
  set font(v: string) { this.put("font", v); }
  set textAlign(v: string) { this.put("textAlign", v); }
  set textBaseline(v: string) { this.put("textBaseline", v); }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Glow {
    const g: Glow = { glow: [x0, y0, r0, x1, y1, r1], stops: [], addColorStop: (at, colour) => { g.stops.push([at, colour]); } };
    return g;
  }
  drawImage(img: Img, ...at: number[]) { this.cmds.push(["drawImage", img.src, ...at]); }
  dark(d: Dark, ...at: number[]) { this.cmds.push(["dark", d, ...at]); }
  fillRect(...a: number[]) { this.cmds.push(["fillRect", ...a]); }
  strokeRect(...a: number[]) { this.cmds.push(["strokeRect", ...a]); }
  rect(...a: number[]) { this.cmds.push(["rect", ...a]); }
  ellipse(...a: number[]) { this.cmds.push(["ellipse", ...a]); }
  arc(...a: number[]) { this.cmds.push(["arc", ...a]); }
  moveTo(...a: number[]) { this.cmds.push(["moveTo", ...a]); }
  lineTo(...a: number[]) { this.cmds.push(["lineTo", ...a]); }
  translate(...a: number[]) { this.cmds.push(["translate", ...a]); }
  scale(...a: number[]) { this.cmds.push(["scale", ...a]); }
  setLineDash(a: number[]) { this.cmds.push(["setLineDash", a]); }
  fillText(t: string, x: number, y: number) { this.cmds.push(["fillText", t, x, y]); }
  strokeText(t: string, x: number, y: number) { this.cmds.push(["strokeText", t, x, y]); }
  beginPath() { this.cmds.push(["beginPath"]); }
  fill() { this.cmds.push(["fill"]); }
  stroke() { this.cmds.push(["stroke"]); }
  save() { this.cmds.push(["save"]); }
  restore() { this.cmds.push(["restore"]); }
}

// Everything a frame's picture is made from.
export type SceneInput = {
  sim: WalkSim; frame: Frame;          // the walk as it stands, and what this frame worked out
  plan: Floorplan; live: Floorplan; edges: DepthEdges; layout: Layout;
  decor: boolean; decorItems: Decor[]; banners: Pt[]; seed: number; // 🚧 the lab's decor
  room: (id: string) => Room | undefined; things: Thing[]; // the rooms as they stand, and the things to tap
  now: number; w: number; h: number;   // the time (ms), and the view's size (px)
  ready: (src: string) => boolean;     // the picture's loaded
  random: () => number;                // for the screen's shake
};
// The commands, and the tunnels whose falling in is over (the screen forgets them).
export type Scene = { cmds: DrawCmd[]; settled: string[] };

export function buildScene(input: SceneInput): Scene {
  const { sim, frame: F, plan, live, edges, layout, decor, decorItems, banners, room, now, w: cw, h: ch, ready, random } = input;
  const { w, h } = plan;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? ROCK : live.tiles[y * w + x]);
  const knownAt = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && sim.known[y * w + x] === 1;
  const litAt = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && sim.lightNow[y * w + x] === 1;
  const there = (c: Sconce) => torchThere(sim, c);
  const { busy, alarm: A, reachNow, candlesSeen, fireSeen, alarmed, foeLight, giving } = F;
  const p = sim.progress;
  const flicker = 1 + 0.03 * Math.sin(now / 90) + 0.02 * Math.sin(now / 37 + 1.3);
  const ctx = new Recorder(), settled: string[] = [];
  const image = (src: string): Img | null => (ready(src) ? { src } : null);
  const things = () => input.things, P = { room }, walk = { seed: input.seed };
  const still = walkView(plan, sim.me, cw, ch), scale = still.scale;
  const shake = (now - sim.shakeAt) / 1000 < SHAKE_TIME ? SHAKE_PX * scale * (1 - (now - sim.shakeAt) / 1000 / SHAKE_TIME) : 0;
  const jx = shake ? (random() * 2 - 1) * shake : 0, jy = shake ? (random() * 2 - 1) * shake : 0;
  const view = shake ? walkView(plan, sim.me, cw, ch, { x: jx, y: jy }) : still;
  const { T, sx, sy, midX, midY, footX, footY, x0, x1, y0, y1 } = view;
  ctx.fillStyle = COLOURS.rock;
  ctx.fillRect(0, 0, cw, ch);
  // The kit (lib/sprites/walk.ts): a kit pixel is T / KIT_PX across and T / KIT_ROW down.
  const kitImg = { floor: image(WALK_KIT.floor), north: image(WALK_KIT.north), cap: image(WALK_KIT.cap), east: image(WALK_KIT.east), west: image(WALK_KIT.west) };
  const kit = Object.values(kitImg).every(Boolean) ? (kitImg as Record<keyof typeof kitImg, Img>) : null;
  const worn = WALK_FLOOR_WORN.map(image).filter((i): i is Img => !!i);
  const wornWalls = WALK_WALL_WORN.map(image).filter((i): i is Img => !!i);
  const vy = artPxDown(view, KIT_DENSITY), side = Math.round(KIT_SIDE * artPxAcross(view, KIT_DENSITY));
  const faceAbove = (x: number, y: number) => {
    let rows = 0;
    while (rows < 3 && at(x, y - rows - 1) === ROCK) rows++;
    return Math.min(Math.round(KIT_NORTH * vy), rows * T);
  };
  if (kit) {
    // Floors, each north wall's face standing in the rock above it, the narrow side walls' tops.
    for (let y = y0; y < y1 + 3; y++) for (let x = x0; x < x1; x++) {
      if (at(x, y) === ROCK || !knownAt(x, y)) continue;
      const wd = sx(x + 1) - sx(x);
      const v = decor && worn.length > 0 ? floorVariant(x, y, walk.seed, worn.length) : 0;
      if (y < y1) ctx.drawImage(v > 0 ? worn[v - 1] : kit.floor, 0, 0, KIT_PX, KIT_ROW, sx(x), sy(y), wd, sy(y + 1) - sy(y));
      if (at(x, y - 1) !== ROCK) continue;
      const dh = faceAbove(x, y);
      const wv = decor && wornWalls.length > 0 ? wallVariant(Math.floor(x / 2), y, walk.seed, wornWalls.length) : 0;
      if (dh > 0) ctx.drawImage(wv > 0 ? wornWalls[wv - 1] : kit.north, wv > 0 ? (x & 1) * KIT_PX : 0, KIT_NORTH - dh / vy, KIT_PX, dh / vy, sx(x), sy(y) - dh, wd, dh);
    }
    const bannerArt = artOf(BANNER)!, bannerImg = image(bannerArt.src);
    if (bannerImg) for (const b of banners) {
      if (!knownAt(b.x, b.y) || b.x < x0 - 2 || b.x > x1 || b.y < y0 || b.y > y1 + 3) continue;
      const { wd: wd2, h2 } = drawSize(view, BANNER, bannerArt), face = faceAbove(b.x, b.y);
      ctx.drawImage(bannerImg, sx(b.x + 1) - wd2 / 2, sy(b.y) - face + Math.max(0, (face - h2) * 0.35), wd2, Math.min(h2, face));
    }
    const strip = (img: Img, left: number, q: Pt, floorX: number) => {
      ctx.drawImage(img, 0, 0, KIT_SIDE, KIT_ROW, left, sy(q.y), side, sy(q.y + 1) - sy(q.y));
      if (at(floorX, q.y - 1) !== ROCK) return;
      const dh = faceAbove(floorX, q.y);
      ctx.drawImage(img, 0, 0, KIT_SIDE, KIT_ROW, left, sy(q.y) - dh, side, dh);
    };
    for (const q of edges.left) if (q.x >= x0 - 1 && q.x < x1 && q.y >= y0 && q.y < y1 + 3 && knownAt(q.x + 1, q.y)) strip(kit.west, sx(q.x + 1) - side, q, q.x + 1);
    for (const q of edges.right) if (q.x >= x0 && q.x < x1 + 1 && q.y >= y0 && q.y < y1 + 3 && knownAt(q.x - 1, q.y)) strip(kit.east, sx(q.x), q, q.x - 1);
  }
  // Rooms cut off behind you, dimmed.
  for (const [id, rs] of Object.entries(plan.rooms)) {
    if (isOpen(layout, p, id)) continue;
    ctx.fillStyle = CLOSED;
    ctx.beginPath();
    for (const r of rs) ctx.rect(sx(r.x) - T, sy(r.y) - T, (r.w + 2) * T, (r.h + 2) * T);
    ctx.fill();
  }
  // The way you'll walk: a dotted line from you, shrinking as you go.
  const end = sim.me.path[sim.me.path.length - 1];
  if (end) {
    ctx.strokeStyle = COLOURS.goal;
    ctx.lineWidth = 2;
    ctx.setLineDash([3 * scale, 4 * scale]);
    ctx.beginPath();
    ctx.moveTo(midX(sim.me.x), midY(sim.me.y));
    for (const q of sim.me.path) ctx.lineTo(midX(q.x), midY(q.y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeRect(sx(end.x) + 3 * scale, sy(end.y) + 3 * scale, T - 6 * scale, T - 6 * scale);
  }
  // Everything standing up, lowest on screen last: things to loot, rubble, foes, you, south walls' tops.
  const standing: { x: number; y: number; draw: () => void }[] = [];
  const shown = things().filter((t) => knownAt(t.x, t.y) && (!t.npc || litAt(t.x, t.y) || t.solid));
  for (const t of shown) {
    const witch = t.def === "witch" ? sim.npcs.find((n) => n.room === t.room) : undefined;
    const sheet = witch && image(WALK_WITCH.sheet);
    if (witch && sheet) {
      // The card witch walking about (a sheet like the hero's), facing the way she goes.
      standing.push({ x: witch.x, y: witch.y, draw: () => {
        const face = facingOf(Math.cos(witch.facing), Math.sin(witch.facing), "south");
        const col = witch.path.length > 0 ? 1 + (Math.floor(now / 130) % WALK_WITCH.frames) : 0;
        const px = across(view, NPC_U) / WALK_WITCH.tall, size = WALK_WITCH.cell * px;
        const row = FACINGS.indexOf(face === "west" ? "east" : face);
        ctx.save();
        ctx.translate(Math.round(footX(witch.x)), Math.round(footY(witch.y) - WALK_WITCH.feet * px));
        if (face === "west") ctx.scale(-1, 1);
        ctx.drawImage(sheet, col * WALK_WITCH.cell, row * WALK_WITCH.cell, WALK_WITCH.cell, WALK_WITCH.cell, -size / 2, 0, size, size);
        ctx.restore();
      } });
      continue;
    }
    const d = objectDef(t.def), a = artOf(d, t.state), img = a && image(a.src);
    const px = witch ? { x: witch.x, y: witch.y } : t;
    standing.push({ x: px.x, y: px.y, draw: () => {
      if (!img || !a) return;
      const { wd, h2 } = drawSize(view, d, a);
      // (A used pool is dimmed.)
      if (t.def === "pool" && t.open) ctx.globalAlpha = 0.6;
      ctx.drawImage(img, footX(px.x) - wd / 2, footY(px.y) - h2 + h2 * (d.visual.legacy.lift ?? 0), wd, h2);
      ctx.globalAlpha = 1;
    } });
  }
  for (const r of rubbleOf(plan, layout, p)) {
    const fell = sim.falls.get(r.key);
    if (fell === undefined && !r.tiles.some((q) => sim.known[q.y * w + q.x])) continue; // never seen: just rock
    const age = fell === undefined ? Infinity : (now - fell) / 1000;
    if (age > DUST_TIME) settled.push(r.key);
    const into = r.wall === "top" ? { x: 0, y: 0.35 } : r.wall === "bottom" ? { x: 0, y: -0.35 } : r.wall === "left" ? { x: 0.35, y: 0 } : { x: -0.35, y: 0 };
    for (const q of r.tiles) standing.push({ x: q.x, y: q.y + into.y, draw: () => {
      const drop = age < FALL_TIME ? (1 - age / FALL_TIME) ** 2 * 3 * T : 0;
      for (let k = 0; k < 5; k++) {
        const rx = ((q.x * 7 + q.y * 13 + k * 29) % 10) / 10 - 0.5, ry = ((q.x * 11 + q.y * 5 + k * 17) % 10) / 10 - 0.5;
        ctx.fillStyle = COLOURS.rubble[k % 3];
        ctx.beginPath();
        ctx.ellipse(footX(q.x + into.x + rx * 0.8), footY(q.y + into.y + ry * 0.5) - 4 * scale - drop * (1 + k * 0.15), T * (0.22 + 0.05 * (k % 2)), T * 0.16, 0, 0, 2 * Math.PI);
        ctx.fill();
      }
      if (age < DUST_TIME) {
        const f = age / DUST_TIME;
        ctx.fillStyle = `rgba(${COLOURS.dust}, ${0.5 * (1 - f)})`;
        ctx.beginPath();
        ctx.arc(footX(q.x + into.x), footY(q.y + into.y) - 6 * scale, T * (0.4 + 1.1 * f), 0, 2 * Math.PI);
        ctx.fill();
      }
    } });
  }
  for (const f of sim.foes) {
    if (!litAt(Math.round(f.x), Math.round(f.y)) && !(A && f.room === A.room)) continue;
    const fr = P.room(f.room), e = fr?.enemies?.[f.index];
    const sprite = fr?.boss ? CREATURE_SPRITES[fr.boss] : e && CREATURE_SPRITES[e.creatureId];
    const a = sprite && artFor(sprite), img = a && image(a.src);
    standing.push({ x: f.x, y: f.y, draw: () => {
      const fx = footX(f.x), fy = footY(f.y), tall = across(view, FOE_U) * (f.waits ? (fr?.boss ? BOSS_SCALE : CHIEF_SCALE) : 1);
      if (img && a) {
        // Art faces left unless marked; turned to face the way it looks.
        const wd = (tall * a.w) / a.h, flip = (Math.cos(f.facing) > 0.1) !== (a.faces === "right");
        ctx.save();
        ctx.translate(fx, fy - tall);
        if (flip) ctx.scale(-1, 1);
        ctx.translate(-wd / 2, 0);
        ctx.drawImage(img, 0, 0, wd, tall);
        ctx.restore();
      } else {
        ctx.fillStyle = COLOURS.foe;
        ctx.beginPath();
        ctx.arc(fx, fy - T * 0.4, T * 0.4, 0, 2 * Math.PI);
        ctx.fill();
      }
    } });
  }
  const heroImg = image(WALK_HERO.sheet);
  standing.push({ x: sim.me.x, y: sim.me.y, draw: () => {
    if (!heroImg) return;
    const moving = sim.me.path.length > 0 && !busy;
    const col = WALK_HERO.frames > 0 ? walkFrame(sim.walked, moving, WALK_HERO.frames) + 1 : 0;
    const row = FACINGS.indexOf(sim.facing), px = artPxAcross(view, HERO_DENSITY), size = WALK_HERO.cell * px;
    ctx.drawImage(heroImg, col * WALK_HERO.cell, row * WALK_HERO.cell, WALK_HERO.cell, WALK_HERO.cell,
      Math.round(footX(sim.me.x) - size / 2), Math.round(footY(sim.me.y) - WALK_HERO.feet * px), size, size);
  } });
  // South walls stand up over the floor's bottom row (see-through close to you).
  const lift = Math.round(KIT_CAP * vy);
  if (kit) for (const q of edges.south) {
    if (q.x < x0 || q.x >= x1 || q.y < y0 || q.y >= y1 || !knownAt(q.x, q.y - 1)) continue;
    standing.push({ x: q.x, y: q.y + SOUTH_WALL.visual.legacy.sortDy!, draw: () => {
      ctx.globalAlpha = capFade(Math.hypot(q.x - sim.me.x, q.y - 0.5 - WALL_LIFT / 2 - sim.me.y));
      const l = at(q.x - 1, q.y) === ROCK && at(q.x - 1, q.y - 1) === ROCK ? side : 0;
      const r = at(q.x + 1, q.y) === ROCK && at(q.x + 1, q.y - 1) === ROCK ? side : 0;
      ctx.drawImage(kit.cap, 0, 0, KIT_PX, KIT_CAP, sx(q.x) - l, sy(q.y) - lift, sx(q.x + 1) - sx(q.x) + l + r, lift);
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(sx(q.x), sy(q.y) - lift, T, Math.max(1, scale));
      ctx.globalAlpha = 1;
    } });
  }
  // The wall torches' brackets (their flames go over the dark, below).
  const burning = sim.sconces.filter((c) => c.lit && there(c) && knownAt(c.x, c.y) && c.x >= x0 - SCONCE_RADIUS && c.x < x1 + SCONCE_RADIUS && c.y >= y0 - SCONCE_RADIUS && c.y < y1 + SCONCE_RADIUS);
  // (On a tunnel's side wall, it sticks out from the wall's edge, by the tile's middle.)
  const bracket = (c: Sconce) => (c.wall === "left" ? { x: sx(c.x) + 0.1 * T, top: sy(c.y) - 0.2 * T } : c.wall === "right" ? { x: sx(c.x + 1) - 0.1 * T, top: sy(c.y) - 0.2 * T } : { x: footX(c.x), top: sy(c.y) - 1.1 * T });
  for (const c of sim.sconces) {
    if (c.x < x0 || c.x >= x1 || c.y < y0 || c.y >= y1 + 1 || !knownAt(c.x, c.y) || !there(c)) continue;
    standing.push({ x: c.x, y: c.y + objectDef(c.wall === "left" || c.wall === "right" ? "sconce-side" : "sconce").visual.legacy.sortDy!, draw: () => {
      const { x: fx, top } = bracket(c);
      ctx.fillStyle = "#2a2018";
      ctx.fillRect(fx - 0.08 * T, top, 0.16 * T, 0.45 * T);
      ctx.fillStyle = "#4a3a2a";
      ctx.fillRect(fx - 0.16 * T, top, 0.32 * T, 0.1 * T);
    } });
  }
  // Campfires: a ring of stones round logs stacked up, burning (or burnt down: embers). PixelLab art.
  const fireImg = image(artOf(CAMPFIRE, "lit")!.src), embersImg = image(artOf(CAMPFIRE, "out")!.src);
  const fireSize = drawSize(view, CAMPFIRE, artOf(CAMPFIRE, "lit")!);
  const drawFire = (f: Campfire, img: Img | null) => {
    if (!img) return;
    const { wd, h2 } = fireSize;
    ctx.drawImage(img, footX(f.x) - wd / 2, footY(f.y) - h2 + h2 * CAMPFIRE.visual.legacy.lift!, wd, h2);
  };
  for (const f of sim.fires) {
    if (!knownAt(f.x, f.y)) continue;
    standing.push({ x: f.x, y: f.y, draw: () => drawFire(f, f.left > 0 ? fireImg : embersImg) });
  }
  const candleImg = image(artOf(CANDLE, "out")!.src), candleLitImg = image(artOf(CANDLE, "lit")!.src);
  const candleSize = drawSize(view, CANDLE, artOf(CANDLE, "out")!);
  const drawCandle = (c: Candle) => {
    const img = c.lit ? candleLitImg : candleImg;
    if (!img) return;
    const { wd, h2 } = candleSize;
    ctx.drawImage(img, footX(c.x) - wd / 2, footY(c.y) - h2, wd, h2);
  };
  for (const c of sim.candles) if (knownAt(c.x, c.y)) standing.push({ x: c.x, y: c.y, draw: () => drawCandle(c) });
  for (const d of decorItems) {
    if (!knownAt(d.x, d.y) || d.x < x0 - 2 || d.x > x1 + 2 || d.y < y0 - 2 || d.y > y1 + 2) continue;
    const def = objectDef(DECOR_DEF[d.kind]), art = artOf(def)!, img = image(art.src);
    // (Flat things lie under everything else; things standing up take their turn.)
    const draw = () => {
      if (!img) return;
      const { wd, h2 } = drawSize(view, def, art);
      ctx.drawImage(img, footX(d.x) - wd / 2, footY(d.y) - h2 + h2 * (def.visual.legacy.lift ?? 0), wd, h2);
    };
    standing.push({ x: d.x, y: d.y + (def.visual.legacy.sortDy ?? 0), draw });
  }
  for (const s of drawOrder(standing)) s.draw();
  // Your torch's warm glow, going cold away from it, the wall torches' pools; then the dark
  // over everything (black where you've never seen, dim where you remember).
  const hx = footX(sim.me.x), hy = footY(sim.me.y) - 12 * scale, reach = reachNow * T * flicker;
  ctx.globalCompositeOperation = "multiply";
  const cool = ctx.createRadialGradient(hx, hy, 0, hx, hy, reach);
  cool.addColorStop(0, "rgb(255, 222, 170)");
  cool.addColorStop(0.6, "rgb(205, 170, 150)");
  cool.addColorStop(1, "rgb(150, 146, 185)");
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, cw, ch);
  ctx.globalCompositeOperation = "lighter";
  const warm = ctx.createRadialGradient(hx, hy, 0, hx, hy, reach * 0.7);
  warm.addColorStop(0, "rgba(255, 150, 60, 0.22)");
  warm.addColorStop(1, "rgba(255, 150, 60, 0)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, cw, ch);
  for (const c of burning) {
    const fx = footX(c.x), fy = sy(c.y) - 0.3 * T, r = SCONCE_RADIUS * T * flicker;
    const pool = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
    pool.addColorStop(0, "rgba(255, 150, 60, 0.2)");
    pool.addColorStop(1, "rgba(255, 150, 60, 0)");
    ctx.fillStyle = pool;
    ctx.fillRect(fx - r, fy - r, 2 * r, 2 * r);
  }
  for (const f of fireSeen) {
    const fx = footX(f.x), fy = footY(f.y) - 6 * scale, r = fireReach(f) * T * flicker;
    const pool = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
    pool.addColorStop(0, f.left > 0 ? "rgba(255, 150, 50, 0.3)" : "rgba(255, 90, 40, 0.18)");
    pool.addColorStop(1, "rgba(255, 150, 60, 0)");
    ctx.fillStyle = pool;
    ctx.fillRect(fx - r, fy - r, 2 * r, 2 * r);
  }
  for (const f of alarmed) {
    const fx = footX(f.x), fy = footY(f.y) - 8 * scale, r = ALARM_LIGHT * T * flicker;
    const pool = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
    pool.addColorStop(0, "rgba(255, 150, 60, 0.25)");
    pool.addColorStop(1, "rgba(255, 150, 60, 0)");
    ctx.fillStyle = pool;
    ctx.fillRect(fx - r, fy - r, 2 * r, 2 * r);
  }
  ctx.globalCompositeOperation = "source-over";
  const dark: Dark = { x: Math.max(0, x0 - 1), y: Math.max(0, y0 - 1), w: 0, h: 0, alpha: new Uint8ClampedArray(0) };
  dark.w = Math.max(0, Math.min(w, x1 + 1) - dark.x); dark.h = Math.max(0, Math.min(h, y1 + 1) - dark.y);
  dark.alpha = new Uint8ClampedArray(dark.w * dark.h);
  for (let y = Math.max(0, y0 - 1); y < Math.min(h, y1 + 1); y++) for (let x = Math.max(0, x0 - 1); x < Math.min(w, x1 + 1); x++) {
    const i = y * w + x;
    let glow = torchGlow(Math.hypot(x - sim.me.x, y - sim.me.y), sim.lightNow[i] === 1, sim.known[i] === 1, reachNow, flicker);
    for (const c of burning) if (sconceLight(sim, c)[i]) glow = Math.min(glow, sconceGlow(Math.hypot(x - c.x, y - c.y), flicker));
    for (const f of fireSeen) if (fireLight(sim, f)[i]) glow = Math.min(glow, sconceGlow(Math.hypot(x - f.x, y - f.y), flicker, fireReach(f)));
    for (const c of candlesSeen) if (candleLight(sim, c)[i]) glow = Math.min(glow, sconceGlow(Math.hypot(x - c.x, y - c.y), flicker, CANDLE_RADIUS));
    alarmed.forEach((f, k) => { if (foeLight[k][i]) glow = Math.min(glow, torchGlow(Math.hypot(x - f.x, y - f.y), true, true, ALARM_LIGHT, flicker)); });
    dark.alpha[(y - dark.y) * dark.w + (x - dark.x)] = Math.round(glow * 255);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.dark(dark, sx(0), sy(0), w * T, h * T);
  ctx.imageSmoothingEnabled = false;
  // The burning torches' flames, over the dark: a fire glows whatever's round it.
  for (const c of sim.sconces) {
    if (!c.lit || c.x < x0 || c.x >= x1 || c.y < y0 || c.y >= y1 + 1 || !knownAt(c.x, c.y) || !there(c)) continue;
    const { x: fx, top } = bracket(c), wob = 1 + 0.12 * Math.sin(now / 70 + c.x);
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(fx, top - 0.15 * T, 0, fx, top - 0.15 * T, 0.7 * T);
    halo.addColorStop(0, "rgba(255, 170, 70, 0.55)");
    halo.addColorStop(1, "rgba(255, 170, 70, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(fx - 0.7 * T, top - 0.85 * T, 1.4 * T, 1.4 * T);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ff9a2e";
    ctx.beginPath();
    ctx.ellipse(fx, top - 0.16 * T * wob, 0.14 * T, 0.26 * T * wob, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#fff1b0";
    ctx.beginPath();
    ctx.ellipse(fx, top - 0.08 * T, 0.07 * T, 0.13 * T * wob, 0, 0, 2 * Math.PI);
    ctx.fill();
  }
  // Lit candles, over the dark, with a little flickering halo.
  for (const c of candlesSeen) {
    const fx = footX(c.x), top = footY(c.y) - candleSize.h2 * 0.9, r = 0.5 * T * (1 + 0.1 * Math.sin(now / 80 + c.x));
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(fx, top, 0, fx, top, r);
    halo.addColorStop(0, "rgba(255, 190, 90, 0.5)");
    halo.addColorStop(1, "rgba(255, 190, 90, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(fx - r, top - r, 2 * r, 2 * r);
    ctx.globalCompositeOperation = "source-over";
    drawCandle(c);
  }
  // The campfires, over the dark: a fire glows whatever's round it.
  for (const f of sim.fires) {
    if (f.x < x0 || f.x >= x1 || f.y < y0 || f.y >= y1 + 1 || !knownAt(f.x, f.y)) continue;
    const fx = footX(f.x), base = footY(f.y) - 0.45 * T, lit = f.left > 0;
    const r = (lit ? 0.9 + 0.5 * (f.left / CAMPFIRE_HEAL) : 0.55) * T * (1 + 0.08 * Math.sin(now / 90 + f.x));
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(fx, base, 0, fx, base, r);
    halo.addColorStop(0, lit ? "rgba(255, 160, 60, 0.55)" : "rgba(255, 80, 30, 0.3)");
    halo.addColorStop(1, "rgba(255, 160, 60, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(fx - r, base - r, 2 * r, 2 * r);
    ctx.globalCompositeOperation = "source-over";
    drawFire(f, lit ? fireImg : embersImg);
    if (lit) {
      // A tongue of flame flickering over the sprite's, taller the more the fire has left.
      const big = 0.5 + 0.5 * (f.left / CAMPFIRE_HEAL), wob = 1 + 0.2 * Math.sin(now / 55 + f.x);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "#ffd27a";
      ctx.beginPath();
      ctx.ellipse(fx, base - 0.05 * T - 0.2 * T * big * wob, 0.08 * T, 0.22 * T * big * wob, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // A healing pool's very faint glow, and a "!" over each cage you can open.
  for (const t of shown) {
    if (t.glow) {
      const fx = footX(t.x), fy = footY(t.y) - 0.1 * T, r = 1.1 * T, pulse = 0.06 + 0.03 * Math.sin(now / 700);
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
      g.addColorStop(0, `rgba(120, 220, 255, ${pulse})`);
      g.addColorStop(1, "rgba(120, 220, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(fx - r, fy - r, 2 * r, 2 * r);
      ctx.globalCompositeOperation = "source-over";
    }
    if (t.flag && litAt(t.x, t.y)) {
      ctx.font = `bold ${Math.round(T * 0.75)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.lineWidth = Math.max(2, scale * 1.5);
      ctx.strokeStyle = "#1a0e05";
      ctx.fillStyle = "#ffd23f";
      const top = footY(t.y) - drawSize(view, objectDef(t.def), artOf(objectDef(t.def), t.state)!).wd - 1 * scale - Math.abs(Math.sin(now / 200)) * 2 * scale;
      ctx.strokeText("!", footX(t.x), top);
      ctx.fillText("!", footX(t.x), top);
    }
  }
  // Healing by one: green crosses rising round you.
  if (giving.length > 0) {
    ctx.font = `bold ${Math.round(T * 0.4)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let k = 0; k < 6; k++) {
      const ph = (now / 1100 + k / 6) % 1;
      ctx.fillStyle = `rgba(120, 255, 140, ${1 - ph})`;
      ctx.fillText("+", footX(sim.me.x) + Math.sin(k * 2.3) * 0.45 * T, footY(sim.me.y) - (0.6 + ph * 0.9) * T);
    }
  }
  if (A) {
    const pop = Math.min(1, (now - A.at) / 150);
    ctx.font = `bold ${Math.round(T * 0.9 * pop)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = Math.max(2, scale * 1.5);
    ctx.strokeStyle = "#1a0e05";
    ctx.fillStyle = "#ffd23f";
    for (const f of sim.foes.filter((g) => g.room === A.room)) {
      const fx = footX(f.x), top = footY(f.y) - across(view, FOE_U) - 2 * scale - Math.abs(Math.sin(now / 120)) * 3 * scale;
      ctx.strokeText("!", fx, top);
      ctx.fillText("!", fx, top);
    }
    if (A.fadeAt !== null) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, (now - A.fadeAt) / (FADE_TIME * 1000))})`;
      ctx.fillRect(0, 0, cw, ch);
    }
  }
  return { cmds: ctx.cmds, settled };
}
