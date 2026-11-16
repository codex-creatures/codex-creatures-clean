"use client";
// app/lab/art/page.tsx — 🧪 the art drafts (the user, 2026-11-16): every placeholder in the game
// with the PixelLab draft made for it (docs/design/art.md, "The placeholder audit"), laid out on
// plinths in a stone room you walk round by torchlight (round 2: the redrafts; the approved ones listed below).
// At the top, the Labyrinth's props rendered in 3D as the game draws them (the chest lab's scene). Walk up to one and its card shows the
// draft beside what the game shows now. Below the room, all of them in a grid, fully lit.
// Nothing here is used by the game, and nothing is saved.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Stick } from "@/components/WalkView";
import { VISITOR_SPEED } from "@/lib/den/scene";
import { CHEST_W } from "@/lib/render3d/chest3d";
import type { ChestView, Thing3D } from "../chest/ChestScene";
import RewardReveal from "@/components/RewardReveal";
import type { RewardModel } from "@/lib/campaign";

// The world props in 3D, through the chest lab's scene (the game's camera, floor, wall and lean, a torch
// carried round them, you for scale, and the flat picture the game draws now beside each). Three.js loads
// on this page only.
const ChestScene = dynamic(() => import("../chest/ChestScene"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });
const PROPS_3D: { thing: Thing3D; label: string }[] = [
  { thing: "decor-skull", label: "Skull & bones" }, { thing: "decor-backpack", label: "Backpack" }, { thing: "cage", label: "Cage" },
  { thing: "decor-barrels", label: "Barrels ✓" }, { thing: "decor-crates", label: "Crates ✓" }, { thing: "decor-pots", label: "Pots ✓" },
  { thing: "decor-lectern", label: "Lectern ✓" }, { thing: "decor-dynamite", label: "Dynamite ✓" },
  { thing: "barrel", label: "Gear Barrel ✓" }, { thing: "bookcase", label: "Codex reward: bookcase" },
  { thing: "crate-materials", label: "Materials Crate ✓" }, { thing: "crate-supplies", label: "Supplies Crate ✓" },
  { thing: "golden", label: "Golden chest ✓" }, { thing: "standingtorch", label: "Standing torch ✓" }, { thing: "dynamite", label: "Dynamite ✓" },
];

const DRAFTS = "/sprites/walk/samples/drafts";
type Exhibit = { file: string; name: string; now: string; nowArt?: string; where: string; px?: number };

// Still to review (2026-11-16): the Enchantress, smaller, with her walk (shown playing under the gallery).
// (The crates and the gear barrel are 3D drafts, in the 3D panel above; the fireplace, the Cyclops Head and
// charged were dropped by the user.)
// Each with what it replaces (an emoji, or the picture standing in) and where.
const EXHIBITS: Exhibit[] = [
  { file: "enchantress-3", name: "The Enchantress (smaller)", now: "", nowArt: "/sprites/npcs/collector.png", where: "The tavern: smaller, with her walk below", px: 80 },
];
// Approved in round 1, and now in the game.
const APPROVED: { file: string; name: string }[] = [
  ["soul-toxic-skin", "Toxic Skin"], ["soul-haunting-presence", "Haunting Presence"], ["soul-unstoppable-force", "Unstoppable Force"], ["soul-perfectionist", "Perfectionist"],
  ["soul-trickster", "Trickster"], ["soul-revitalise", "Revitalise"], ["essence", "Essence crystal"], ["klutz-pack", "Klutz's Pack Upgrade"],
  ["locator-crystal-ball", "Crystal Ball"], ["locator-librarian", "Librarian Locator"], ["dynamite", "Dynamite"], ["standing-torch", "Standing torch"],
  ["race-toxic", "Toxic"], ["status-corpse", "Corpsify"], ["status-mirage", "Mirage"], ["status-bleed", "Bleed"], ["status-boost", "Boost"],
  ["status-flame", "Burning"], ["status-ward", "Ward"], ["status-weaken", "Weakened"], ["status-seal", "Sealed"], ["status-haste", "Haste"],
  ["ui-items", "Items discovered"], ["ui-campaign", "Campaign"], ["ui-quests", "Quests"], ["ui-leaderboards", "Leaderboards"],
  ["golden-chest3d/front", "Golden chest (3D)"], ["stone", "Stone"], ["locator-merchant-map-2", "Merchant's Map"], ["ui-settings-2", "Settings"], ["ui-creatures-2", "Creatures discovered"], ["race-underkin-3", "Underkin"], ["status-soak-2", "Soaked"],
].map(([file, name]) => ({ file, name }));

// The room, in art pixels (kit F's tiles are 48 × 36), drawn SCALE× on screen.
const TILE_W = 48, TILE_H = 36, WALL_H = 87;
const COLS = 16, ROWS = 15;
const ROOM_W = COLS * TILE_W, ROOM_H = ROWS * TILE_H;
const SCALE = 2;
const PER_ROW = 7;          // plinths in a row
const GAP_X = 100, GAP_Y = 88, FIRST = { x: 84, y: 70 };
const SHOW = 48;            // an exhibit drawn at most this many art pixels across (unless it says)
const NEAR = 46;            // art pixels: close enough for its card
const SPEED = 130;          // art pixels a second
const TORCH = 120;          // the torch's reach, art pixels
const HERO = 96;            // the hero stills' canvas (the figure's about half of it)
const DIRS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];

const spot = (i: number) => ({ x: FIRST.x + (i % PER_ROW) * GAP_X, y: FIRST.y + Math.floor(i / PER_ROW) * GAP_Y });

export default function ArtLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useRef(new Set<string>());
  const stick = useRef<{ x: number; y: number } | null>(null);
  const target = useRef<{ x: number; y: number } | null>(null);
  const hero = useRef({ x: ROOM_W / 2, y: ROOM_H - 30, dir: "north" });
  const [near, setNear] = useState<number | null>(null);
  const [lit, setLit] = useState(false);
  const [view3d, setView3d] = useState<ChestView>({ open: false, across: 15, width: CHEST_W, moving: true, old: true, art: true, outline: true, edges: true, at: 0, lean: true,
    thing: "decor-skull", turned: false, candle: false, rarity: "rare", lit: true, life: false, splash: 0 });
  const set3d = (v: Partial<ChestView>) => setView3d((x) => ({ ...x, ...v }));
  const [reveal, setReveal] = useState<{ title: string; model: RewardModel } | null>(null); // the campaign's reward reveal, previewed
  const litRef = useRef(lit);
  useEffect(() => { litRef.current = lit; }, [lit]);

  useEffect(() => {
    const load = (src: string) => { const img = new Image(); img.src = src; return img; };
    const art = EXHIBITS.map((e) => load(`${DRAFTS}/${e.file}.png`));
    const floor = load("/sprites/walk/kit-f-floor.png"), wall = load("/sprites/walk/kit-f-north.png");
    const heroes = Object.fromEntries(DIRS.map((d) => [d, load(`/sprites/walk/hero-8/${d}.png`)]));
    const down = (e: KeyboardEvent) => { keys.current.add(e.key.toLowerCase()); if (e.key.startsWith("Arrow")) e.preventDefault(); };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const dark = document.createElement("canvas");
    let last = performance.now(), frame = 0, shown: number | null = null;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = canvas.current;
      if (!c) { frame = requestAnimationFrame(tick); return; }
      // Where you're heading: keys, the stick, or a tapped spot.
      const k = keys.current, h = hero.current;
      let dx = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
      let dy = (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0);
      if (stick.current) { dx = stick.current.x; dy = stick.current.y; }
      if (dx || dy) target.current = null;
      else if (target.current) {
        const tx = target.current.x - h.x, ty = target.current.y - h.y, d = Math.hypot(tx, ty);
        if (d < 3) target.current = null; else { dx = tx / d; dy = ty / d; }
      }
      const len = Math.hypot(dx, dy);
      if (len > 0.1) {
        const n = Math.min(1, len);
        h.x = Math.max(16, Math.min(ROOM_W - 16, h.x + (dx / len) * n * SPEED * dt));
        h.y = Math.max(WALL_H - TILE_H + 12, Math.min(ROOM_H - 8, h.y + (dy / len) * n * SPEED * dt));
        h.dir = DIRS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
      }

      // The camera follows you, kept inside the room.
      const vw = c.width / SCALE, vh = c.height / SCALE;
      const cx = Math.max(0, Math.min(ROOM_W - vw, h.x - vw / 2)), cy = Math.max(0, Math.min(ROOM_H - vh, h.y - vh / 2));
      const g = c.getContext("2d")!;
      g.imageSmoothingEnabled = false;
      g.setTransform(SCALE, 0, 0, SCALE, -cx * SCALE, -cy * SCALE);
      g.fillStyle = "#0e0f0c";
      g.fillRect(cx, cy, vw, vh);
      for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) if (floor.complete) g.drawImage(floor, col * TILE_W, r * TILE_H);
      for (let col = 0; col < COLS; col++) if (wall.complete) g.drawImage(wall, col * TILE_W, 0 - (WALL_H - TILE_H * 2));

      // The plinths and drafts, and you, back to front.
      const things: { y: number; draw: () => void }[] = EXHIBITS.map((e, i) => ({
        y: spot(i).y,
        draw: () => {
          const p = spot(i), img = art[i];
          g.fillStyle = "rgba(0,0,0,0.35)";
          g.beginPath(); g.ellipse(p.x, p.y, 20, 6, 0, 0, Math.PI * 2); g.fill();
          if (!img.complete || !img.naturalWidth) return;
          const max = e.px ?? SHOW, f = Math.min(max / img.naturalWidth, max / img.naturalHeight);
          const w = img.naturalWidth * f, ht = img.naturalHeight * f;
          g.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - ht + 4), Math.round(w), Math.round(ht));
        },
      }));
      things.push({ y: h.y, draw: () => { const img = heroes[h.dir]; if (img.complete) g.drawImage(img, Math.round(h.x - HERO / 2), Math.round(h.y - HERO + 22)); } });
      things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());

      // The torch: the dark everywhere but round you, flickering a little.
      if (!litRef.current) {
        dark.width = c.width; dark.height = c.height;
        const d = dark.getContext("2d")!;
        d.fillStyle = "rgba(6,6,10,0.94)";
        d.fillRect(0, 0, dark.width, dark.height);
        const fx = (h.x - cx) * SCALE, fy = (h.y - 30 - cy) * SCALE;
        const reach = TORCH * SCALE * (0.96 + 0.04 * Math.sin(now / 90) + 0.02 * Math.sin(now / 37));
        const hole = d.createRadialGradient(fx, fy, reach * 0.15, fx, fy, reach);
        hole.addColorStop(0, "rgba(0,0,0,1)"); hole.addColorStop(0.6, "rgba(0,0,0,0.75)"); hole.addColorStop(1, "rgba(0,0,0,0)");
        d.globalCompositeOperation = "destination-out";
        d.fillStyle = hole;
        d.fillRect(0, 0, dark.width, dark.height);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(dark, 0, 0);
        const warm = g.createRadialGradient(fx, fy, 0, fx, fy, reach);
        warm.addColorStop(0, "rgba(255,170,80,0.22)"); warm.addColorStop(1, "rgba(255,150,60,0)");
        g.globalCompositeOperation = "lighter";
        g.fillStyle = warm;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = "source-over";
      }

      // The nearest exhibit within reach shows its card.
      let best: number | null = null, bd = NEAR;
      EXHIBITS.forEach((_, i) => { const p = spot(i), d = Math.hypot(p.x - h.x, p.y - h.y); if (d < bd) { bd = d; best = i; } });
      if (best !== shown) { shown = best; setNear(best); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Tap the room to walk there.
  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!, box = c.getBoundingClientRect(), h = hero.current;
    const vw = c.width / SCALE, vh = c.height / SCALE;
    const cx = Math.max(0, Math.min(ROOM_W - vw, h.x - vw / 2)), cy = Math.max(0, Math.min(ROOM_H - vh, h.y - vh / 2));
    target.current = { x: cx + ((e.clientX - box.left) / box.width) * vw, y: cy + ((e.clientY - box.top) / box.height) * vh };
  };
  const ex = near !== null ? EXHIBITS[near] : null;
  const btn = (on: boolean) => ({ minHeight: 44, padding: "0 12px", background: on ? "#6b5420" : "#2a2622", color: "#f1d9a0", border: "1px solid #6b5a40", borderRadius: 6 });

  return (
    <div style={{ background: "#111", color: "#f1d9a0", minHeight: "100vh", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Art drafts: the placeholder audit</h1>

      {/* The world props, rendered in 3D as the Labyrinth draws them. */}
      <h2 style={{ fontSize: 15, margin: "8px 0 4px" }}>3D renders: the Labyrinth&apos;s props</h2>
      <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 8px", maxWidth: 520 }}>
        Under the game&apos;s camera, on its floor, with a torch carried round. The flat picture on the left is what the game draws now; you stand in the middle for scale.
      </p>
      <div style={{ width: "100%", maxWidth: 520, aspectRatio: "4 / 3", borderRadius: 8, overflow: "hidden" }}>
        <ChestScene view={view3d} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 520 }}>
        {PROPS_3D.map((k) => <button key={k.thing} style={btn(view3d.thing === k.thing)} onClick={() => set3d({ thing: k.thing })}>{k.label}</button>)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, maxWidth: 520 }}>
        <button style={btn(view3d.open)} onClick={() => set3d({ open: !view3d.open })}>{view3d.open ? "Chest open" : "Chest shut"}</button>
        <button style={btn(view3d.lit)} onClick={() => set3d({ lit: !view3d.lit })}>{view3d.lit ? "Torch lit" : "Torch out"}</button>
        <button style={btn(view3d.moving)} onClick={() => set3d({ moving: !view3d.moving })}>{view3d.moving ? "Light moving" : "Light still"}</button>
        <button style={btn(view3d.old)} onClick={() => set3d({ old: !view3d.old })}>{view3d.old ? "Now shown" : "Now hidden"}</button>
        <button style={btn(view3d.across === 7)} onClick={() => set3d({ across: view3d.across === 7 ? 15 : 7 })}>{view3d.across === 7 ? "Close" : "Game zoom"}</button>
      </div>

      <h2 style={{ fontSize: 15, margin: "20px 0 4px" }}>The campaign&apos;s reward reveal (in the game)</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 520 }}>
        {([["Materials Crate", "crate-materials"], ["Supplies Crate", "crate-supplies"], ["Gear Barrel", "barrel"], ["Codex Bookcase", "bookcase"]] as [string, RewardModel][]).map(([title, model]) => (
          <button key={model} style={btn(false)} onClick={() => setReveal({ title, model })}>{title}</button>
        ))}
      </div>
      {reveal && <RewardReveal title={reveal.title} model={reveal.model} onOpen={() => setReveal(null)} />}

      <h2 style={{ fontSize: 15, margin: "20px 0 4px" }}>The gallery: walk round the drafts</h2>
      <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 8px", maxWidth: 520 }}>
        Walk with the arrow keys or WASD, the stick, or tap where to go. Walk up to a draft to see it beside what the game shows now.
      </p>
      <div style={{ position: "relative", width: "100%", maxWidth: 520, containerType: "size", aspectRatio: "4 / 3" }}>
        <canvas ref={canvas} width={1040} height={780} onPointerDown={tap}
          style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated", borderRadius: 8, touchAction: "none" }} />
        <Stick onPush={(p) => { stick.current = p; }} />
      </div>
      {/* The card for the draft you're beside, under the room: fixed boxes, so only the words and pictures change. */}
      <div style={{ maxWidth: 520, marginTop: 8, padding: 8, borderRadius: 8, background: "#1c1a17", border: "1px solid #6b5a40", boxSizing: "border-box" }}>
        <div style={{ visibility: ex ? "visible" : "hidden" }}>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex?.name ?? "—"}</div>
          <div style={{ fontSize: 11, color: "#aaa", height: 28, overflow: "hidden" }}>{ex?.where}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4, textAlign: "center", fontSize: 11 }}>
            <div>Now<Thumb ex={ex} now /></div>
            <div>Draft<Thumb ex={ex} /></div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button style={btn(!lit)} onClick={() => setLit(false)}>🔥 Torch</button>
        <button style={btn(lit)} onClick={() => setLit(true)}>☀️ Fully lit</button>
      </div>

      <h2 style={{ fontSize: 15, margin: "20px 0 8px" }}>Still to review: {EXHIBITS.length} drafts, now → draft</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, maxWidth: 980 }}>
        {EXHIBITS.map((e) => (
          <div key={e.file} style={{ background: "#3a362e", borderRadius: 8, padding: 8, fontSize: 12 }}>
            <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={e.name}>{e.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, alignItems: "center" }}><Thumb ex={e} now /><Thumb ex={e} /></div>
            <div style={{ color: "#cbbf9f", height: 30, overflow: "hidden" }} title={e.where}>{e.where}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, margin: "20px 0 8px" }}>The Enchantress walking (as the tavern plays a visitor&apos;s walk)</h2>
      <div style={{ display: "grid", gap: 8 }}>
        <WalkStrip src={`${DRAFTS}/enchantress-3-walk-a.png`} frames={8} label="The Enchantress: walk A" />
        <WalkStrip src={`${DRAFTS}/enchantress-3-walk-b.png`} frames={8} label="The Enchantress: walk B" />
        <WalkStrip src="/sprites/npcs/collector-walk.png" frames={8} label="The collector (in the game), for comparison" />
      </div>

      <h2 style={{ fontSize: 15, margin: "20px 0 8px" }}>✓ Approved, in the game now ({APPROVED.length})</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 6, maxWidth: 980 }}>
        {APPROVED.map((e) => (
          <div key={e.file} style={{ background: "#2a2622", borderRadius: 8, padding: 6, fontSize: 11, textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${DRAFTS}/${e.file}.png`} alt="" style={{ width: 48, height: 48, objectFit: "contain", imageRendering: "pixelated" }} />
            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={e.name}>{e.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// A picture in a fixed 64px box: the draft, or what the game shows now (its emoji or its stand-in picture).
function Thumb({ ex, now = false }: { ex: Exhibit | null; now?: boolean }) {
  const box: React.CSSProperties = { height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)", borderRadius: 6, margin: "2px 0" };
  if (!ex) return <div style={box} />;
  if (now && !ex.nowArt) return <div style={{ ...box, fontSize: ex.now.length > 3 ? 11 : 30, color: "#aaa" }}>{ex.now}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <div style={box}><img src={now ? ex.nowArt : `${DRAFTS}/${ex.file}.png`} alt="" style={{ maxWidth: 60, maxHeight: 60, imageRendering: "pixelated", filter: now && ex.file === "enchantress" ? "hue-rotate(60deg) saturate(1.4)" : undefined }} /></div>;
}

// A visitor's walk strolling to and fro across a strip of floor, turning at each end, at the tavern's pace
// (VISITOR_SPEED blocks a second, 64 px a block, 9 frames a second), drawn 2× for a closer look.
const STROLL_W = 440, STROLL_SCALE = 2, STROLL_PX = VISITOR_SPEED * 64 * STROLL_SCALE; // px a second, on screen
function WalkStrip({ src, frames, label }: { src: string; frames: number; label: string }) {
  const [t, setT] = useState(0);
  useEffect(() => { let id = 0; const t0 = performance.now(); const tick = (n: number) => { setT((n - t0) / 1000); id = requestAnimationFrame(tick); }; id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id); }, []);
  const box = 96 * STROLL_SCALE, run = STROLL_W - box, leg = run / STROLL_PX, k = (t % (2 * leg)) / leg;
  const back = k > 1, x = back ? (2 - k) * run : k * run, f = Math.floor(t * 9) % frames;
  return (
    <div style={{ position: "relative", width: STROLL_W, maxWidth: "100%", height: box + 18, background: "#3a362e", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: x, top: 0, width: box, height: box, transform: back ? "scaleX(-1)" : undefined,
        background: `url(${src}) no-repeat`, backgroundSize: `${frames * 100}% 100%`, backgroundPosition: `${(f / (frames - 1)) * 100}% 0`, imageRendering: "pixelated" }} />
      <div style={{ position: "absolute", left: 8, bottom: 2, fontSize: 11, color: "#cbbf9f" }}>{label}</div>
    </div>
  );
}
