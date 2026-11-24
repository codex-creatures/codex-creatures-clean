"use client";
// components/SideArrow.tsx
// The previous / next buttons on the screen's sides (a creature's window, a codex's): a pixel
// chevron drawn square by square on a brass button, low on the screen so it doesn't sit over the
// middle of the window you're working in (the user, 2026-11-24). Styles: .side-arrow in globals.css.

// The chevron's squares, pointing left: two thick, tip at the left, 7 wide by 11 tall.
const CELLS = Array.from({ length: 11 }, (_, r) => Math.abs(r - 5)).flatMap((d, r) => [[d, r], [d + 1, r]]);

export default function SideArrow({ dir, label, onClick }: { dir: "prev" | "next"; label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button className={`side-arrow ${dir}`} aria-label={label} onClick={onClick}>
      <svg width={21} height={33} viewBox="0 0 8 12" shapeRendering="crispEdges" aria-hidden
        style={{ transform: dir === "next" ? "scaleX(-1)" : undefined }}>
        {CELLS.map(([x, y]) => <rect key={`s${x},${y}`} x={x + 1} y={y + 1} width={1} height={1} fill="#1c140b" />)}
        {CELLS.map(([x, y]) => <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="#f1d9a0" />)}
      </svg>
    </button>
  );
}
