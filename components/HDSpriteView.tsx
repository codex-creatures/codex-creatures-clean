"use client";
// components/HDSpriteView.tsx
// Draws a detailed ("HD") sprite (lib/sprites/hd.ts) as crisp SVG pixels.

import { useMemo } from "react";
import type { HDSprite } from "@/lib/sprites/hd";

export default function HDSpriteView({ sprite, scale = 2, title, style }: { sprite: HDSprite; scale?: number; title?: string; style?: React.CSSProperties }) {
  const rects = useMemo(() => {
    const out: [number, number, number, string][] = [];
    sprite.px.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        let n = 1;
        while (row[x + n] === row[x]) n++;
        if (row[x]) out.push([x, y, n, row[x]!]);
        x += n;
      }
    });
    return out;
  }, [sprite]);
  return (
    <svg width={sprite.w * scale} height={sprite.h * scale} viewBox={`0 0 ${sprite.w} ${sprite.h}`} shapeRendering="crispEdges"
      role="img" aria-label={title} style={{ display: "block", flexShrink: 0, ...style }}>
      {rects.map(([x, y, n, c], i) => <rect key={i} x={x} y={y} width={n} height={1} fill={c} />)}
    </svg>
  );
}
