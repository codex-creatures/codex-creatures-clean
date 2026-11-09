"use client";
// components/dungeon/AtEntrance.tsx
// Standing at the entrance, tunnels leading off (the scroll-map runs). Moved out of app/dungeon/page.tsx as it was.

import { runPosition, type DungeonRun } from "@/lib/dungeon/run";

export default function AtEntrance({ run }: { run: DungeonRun }) {
  const ways = run.map.nodes[runPosition(run)].links.length;
  return (
    <div className="stone-panel">
      <p style={{ fontSize: 13, color: "#d8d4c8", margin: 0, lineHeight: 1.5 }}>
        Water drips somewhere in the dark. {ways > 1 ? "Tunnels lead off" : "A tunnel leads off"} into the gloom — the left-most heads furthest west.
        Tap one to go on.
      </p>
    </div>
  );
}
