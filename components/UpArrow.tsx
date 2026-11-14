// components/UpArrow.tsx
// A small green arrow pointing up, in a corner of an icon: "an upgrade" (the user, 2026-11-14: a
// backpack upgrade is the backpack, a little smaller, with this in its corner). Pixel steps, outlined.
export default function UpArrow({ size = "32%" }: { size?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 7 8" shapeRendering="crispEdges" style={{ position: "absolute", right: "6%", top: "6%", width: size, height: "auto", pointerEvents: "none" }}>
      <path d="M3 0h1v1h1v1h1v1h1v2H5v3H2V5H0V3h1V2h1V1h1z" fill="#14100c" />
      <path d="M3 1h1v1h1v1h1v1H4v3H3V4H1V3h1V2h1z" fill="#4ade80" />
    </svg>
  );
}
