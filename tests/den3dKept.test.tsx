// @vitest-environment happy-dom
// The new Den on its page (components/Den3D.tsx) in a pretend browser, its 3D canvas stood in for: it's made once
// and kept between visits (so coming home doesn't build it all again), it stops drawing the moment you tap a
// place (so the place's screen gets the phone's whole attention), and what it shows is always the current game's
// (docs/polish-audit-2026-11.md).
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
let Den3D: (p: Props) => React.ReactNode, forgetDen: () => void;
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
  ({ default: Den3D, forgetDen } = await import("@/components/Den3D"));
});
afterEach(async () => { if (host?.isConnected) await leave(); forgetDen(); });

describe("the Den, kept between visits", () => {
  it("is made once: coming back from a place shows the one that was there, not a new one", async () => {
    await visit();
    const first = canvas();
    expect(first).toBeTruthy();
    expect(made.count).toBe(1);
    await leave();
    expect(first!.closest("[data-den-parked]")).toBeTruthy(); // (parked, hidden, while you're elsewhere)
    expect(host.isConnected).toBe(false);
    await visit();
    expect(canvas()).toBe(first);
    expect(host.contains(first)).toBe(true);
    expect(first!.closest("[data-den-parked]")).toBeNull();
    expect(made.count).toBe(1);
    expect(canvas()!.dataset.drawing).toBe("always");
  });

  it("stops drawing while you're elsewhere, and starts again when you're back", async () => {
    await visit();
    const c = canvas()!;
    expect(c.dataset.drawing).toBe("always");
    await leave();
    expect(c.dataset.drawing).toBe("never");
    await visit();
    expect(c.dataset.drawing).toBe("always");
  });

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

  it("shows the game as it is now when you come back: what changed while you were away, and where things stand in the save", async () => {
    await visit();
    expect(tag("tavern")).toBeNull(); // (the wall's still up)
    await leave();
    // While away: the wall came down, and (another save loaded, say) the altar stands somewhere else.
    localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory: [], gold: 0, den3d: { floor: { altar: { x: 5, y: 14 } } } }));
    await visit({ ...props, rubble: "open", tavern: { blasted: true } });
    expect(made.count).toBe(1);
    expect(tag("tavern")).toBeTruthy();
    const { loadDenLayout } = await import("@/lib/den3d/placement");
    expect(loadDenLayout()).toEqual({ floor: { altar: { x: 5, y: 14 } } }); // (and coming back wrote nothing over it)
  });

  it("after a run in the Labyrinth you're back in its middle, as before (the Labyrinth forgets where the view was as it opens)", async () => {
    const { denView, forgetDenView } = await import("@/lib/den3d/view");
    await visit();
    // As in the browser: the Den's page goes, the Labyrinth's page opens and forgets the view, and only then does
    // the parked Den get round to drawing itself hidden. (So not all in one act(), which would do that first.)
    const act0 = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean });
    act0.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      root.unmount();
      expect(denView()).not.toBeNull(); // (kept as you leave, for coming back from a place)
      forgetDenView();                  // (the Labyrinth's page, opening)
      await new Promise((r) => setTimeout(r, 50));
    } finally { act0.IS_REACT_ACT_ENVIRONMENT = true; }
    host.remove();
    expect(denView()).toBeNull();       // (and the parked Den doesn't put it back)
  });

  it("is made afresh if the graphics card dropped it while you were away (a phone short of memory may)", async () => {
    await visit();
    const first = canvas()!;
    await leave();
    first.dispatchEvent(new Event("webglcontextlost"));
    await visit();
    expect(made.count).toBe(2);
    expect(canvas()).not.toBe(first);
    expect(host.contains(canvas())).toBe(true);
    expect(first.isConnected).toBe(false);
  });

  it("the lab's Den (nothing kept) is made afresh each time, as before", async () => {
    await visit({ ...props, keep: "none" });
    expect(made.count).toBe(1);
    await leave();
    await visit({ ...props, keep: "none" });
    expect(made.count).toBe(2);
  });
});
