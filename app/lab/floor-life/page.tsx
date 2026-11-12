"use client";
// app/lab/floor-life/page.tsx — PixelLab samples for the user to judge (dev tool, not in the game):
// a wet puddle and a rat with its mouse hole for the walkable dungeon's floors, and the Gold Key's
// icon (the user, 2026-11-13). Samples live in public/sprites/walk/samples/ and nothing imports them.

const DIR = "/sprites/walk/samples/floor-life";
const SAMPLES = [
  { file: "puddle.png", name: "Wet puddle", note: "On the floor. The torch light on it would be drawn in code, so it shines when you walk near." },
  { file: "rat.png", name: "Rat", note: "Scurries along the walls, not fightable. A still for now: its running animation comes once the look's approved." },
  { file: "mouse-hole.png", name: "Mouse hole", note: "At the foot of a wall: rats dive into it. (Only the hole and its stones would be used, not the whole wall tile.)" },
  { file: "gold-key.png", name: "Gold Key", note: "Its icon in your bag (the gold coin stands in for it now)." },
];
const SCALES = [1, 3, 6];

export default function FloorLifeLab() {
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Floor life: samples</h1>
      <p style={{ fontSize: 13, opacity: 0.7 }}>PixelLab samples on the dungeon floor, at 1×, 3× and 6×. In 3D, under the game's camera: /lab/chest (Floor life).</p>
      {SAMPLES.map((s) => (
        <section key={s.file} style={{ margin: "18px 0" }}>
          <h2 className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0", margin: "0 0 4px" }}>{s.name}</h2>
          <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 8px" }}>{s.note}</p>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", padding: 12,
            backgroundImage: "url(/sprites/walk/kit-e-floor.png)", backgroundSize: "144px 108px", imageRendering: "pixelated" }}>
            {SCALES.map((k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={k} src={`${DIR}/${s.file}`} alt={s.name} style={{ imageRendering: "pixelated", zoom: k }} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
