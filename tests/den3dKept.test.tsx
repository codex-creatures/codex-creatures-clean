// @vitest-environment happy-dom
// The new Den on its page (components/Den3D.tsx) in a pretend browser, its 3D canvas stood in for: it stops drawing
// the moment you tap a place, so the place's screen gets the phone's whole attention (docs/polish-audit-2026-11.md).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SAVE_KEY } from "@/lib/save";

const made = { count: 0 };          // how many times the Den's scene has been made
const push = vi.fn(), prefetch = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, prefetch }) }));
// The 3D canvas, stood in for: a box that says whether it's drawing, counted each time one is made.
vi.mock("@react-three/fiber", async () => {
  const React = await import("react");
  return {
    Canvas: ({ frameloop = "always" }: { frameloop?: string }) => {
      React.useEffect(() => { made.count++; }, []);
      return React.createElement("div", { "data-canvas": "", "data-drawing": frameloop });
    },
    useFrame: () => {}, useThree: () => ({ size: { width: 390, height: 500 }, setDpr: () => {} }),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type Props = import("@/components/Den3D").Den3DProps;
let Den3D: (p: Props) => React.ReactNode;
let root: Root, host: HTMLDivElement;
const props: Props = { klutz: "home", klutzNews: false, rubble: "shut", tavern: {}, tavernNews: false, boardNews: false, crateNews: false, cageNews: false };
const canvas = () => document.querySelector("[data-canvas]") as HTMLElement | null;
const tag = (id: string) => document.querySelector(`[data-den-label="${id}"]`) as HTMLElement | null;
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

async function visit(p: Props = props) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<Den3D {...p} />); });
  await tick();
}
async function leave() {
  await act(async () => { root.unmount(); });
  host.remove();
  await tick();
}

beforeEach(async () => {
  vi.resetModules();
  made.count = 0; push.mockClear();
  localStorage.clear();
  localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory: [], gold: 0 }));
  ({ default: Den3D } = await import("@/components/Den3D"));
});
afterEach(async () => { if (host?.isConnected) await leave(); });

describe("the Den, tapped", () => {
  it("stops drawing the moment you tap a place, and goes there", async () => {
    await visit();
    expect(tag("storehouse")).toBeTruthy();
    await act(async () => { tag("storehouse")!.click(); });
    expect(push).toHaveBeenCalledWith("/chest?store=1");
    expect(canvas()!.dataset.drawing).toBe("never");
  });

  it("draws again if the place never opened (so a tap that went nowhere doesn't leave the Den frozen)", async () => {
    await visit();
    vi.useFakeTimers();
    try {
      await act(async () => { tag("storehouse")!.click(); });
      expect(canvas()!.dataset.drawing).toBe("never");
      await act(async () => { vi.advanceTimersByTime(5000); });
      expect(canvas()!.dataset.drawing).toBe("always");
    } finally { vi.useRealTimers(); }
  });

});
