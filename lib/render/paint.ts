// lib/render/paint.ts
// Painting a frame's draw list (scene.ts) onto a canvas: each command is the
// canvas call it names, made in order. A glow becomes a radial gradient when
// it's used; the dark is written into its own small canvas (a pixel a cell,
// kept from frame to frame, as the walk screen always kept it) and drawn
// smoothed up over the view.

import { DARK_RGB, type DrawCmd, type Dark, type Glow } from "./scene";

// The dark's canvas, made with the floorplan's size (a pixel a cell), and its pixels.
export type DarkLayer = { canvas: CanvasImageSource; ctx: { putImageData: (d: ImageData, x: number, y: number) => void }; shade: ImageData };

type Ctx = CanvasRenderingContext2D;
const isGlow = (v: unknown): v is Glow => typeof v === "object" && v !== null && "glow" in v;

export function paintScene(ctx: Ctx, cmds: DrawCmd[], image: (src: string) => CanvasImageSource | null, dark: DarkLayer) {
  const call = ctx as unknown as Record<string, (...a: unknown[]) => void>;
  for (const [op, ...a] of cmds) {
    if (op === "set") {
      const [name, v] = a as [string, unknown];
      let value = v;
      if (isGlow(v)) {
        const g = ctx.createRadialGradient(...v.glow);
        for (const [at, colour] of v.stops) g.addColorStop(at, colour);
        value = g;
      }
      (ctx as unknown as Record<string, unknown>)[name] = value;
    } else if (op === "drawImage") {
      const img = image(a[0] as string);
      if (img) call.drawImage.call(ctx, img, ...a.slice(1));
    } else if (op === "dark") {
      const [d, x, y, w, h] = a as [Dark, number, number, number, number];
      const px = dark.shade.data, wide = dark.shade.width;
      for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
        const k = ((d.y + j) * wide + d.x + i) * 4;
        px[k] = DARK_RGB[0]; px[k + 1] = DARK_RGB[1]; px[k + 2] = DARK_RGB[2]; px[k + 3] = d.alpha[j * d.w + i];
      }
      dark.ctx.putImageData(dark.shade, 0, 0);
      ctx.drawImage(dark.canvas, x, y, w, h);
    } else call[op].call(ctx, ...a);
  }
}
