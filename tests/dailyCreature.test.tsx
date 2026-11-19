// @vitest-environment happy-dom
// A daily quest's creature, claimed (the user, 2026-11-20): the Soul Altar's whirl
// climbs to its rarity and the creature steps out, so you see who you got.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SAVE_KEY } from "@/lib/save";
import { DAILY_FIELD, dayKey } from "@/lib/daily";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/board" }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;

describe("claiming a daily creature", () => {
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });
  it("shows the altar's reveal, then the creature you got (it's in your collection)", async () => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory: [], equipment: {}, gold: 0, caged: [], quest: { stage: "done" },
      [DAILY_FIELD]: { day: dayKey(), ids: ["camp", "scans"], progress: [2, 0], claimed: [false, false] } }));
    window.history.replaceState(null, "", "/board?tab=daily");
    const Page = (await import("@/app/board/page")).default;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<Page />); });
    vi.useFakeTimers();
    const claim = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Claim") && !b.disabled);
    expect(claim).toBeTruthy();
    await act(async () => { claim!.click(); });
    expect(host.textContent).toContain("The Soul Altar stirs");
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    const got = saved.inventory.find((d: { dropType: string }) => d.dropType === "creature");
    expect(got).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(host.textContent).toContain(`${got.name} joins you!`);
  });
});
