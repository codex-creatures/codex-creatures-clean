// @vitest-environment happy-dom
// The Pit's creature card in the pickers (the user, 2026-11-27: a duel's team and who reads an XP scroll are
// listed as the Pit lists them): its pick number, greyed when it can't go, and why, on a line kept either way.
import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CreatureCard } from "@/components/TileGrid";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const wolf = { name: "Moss Wolf", rarity: "common" as const, creatureId: "moss_wolf", level: 7 };
function show(el: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(el));
  return host.querySelector("button")!;
}

describe("a creature card in a picker", () => {
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  it("shows its name and level, and its place in the team being picked", () => {
    const b = show(<CreatureCard d={wolf} pick={2} note="" onClick={() => {}} />);
    expect(b.textContent).toContain("Moss Wolf");
    expect(b.textContent).toContain("Lv 7");
    expect(b.textContent?.startsWith("2")).toBe(true);
    expect(b.getAttribute("aria-pressed")).toBe("true");
  });
  it("can't be tapped when it can't go, and says why", () => {
    let taps = 0;
    const b = show(<CreatureCard d={wolf} disabled note="In the pit" onClick={() => taps++} />);
    act(() => b.click());
    expect(taps).toBe(0);
    expect(b.disabled).toBe(true);
    expect(b.textContent).toContain("In the pit");
  });
  it("keeps the reason's line when there's none, so the cards line up", () => {
    const withLine = show(<CreatureCard d={wolf} note="" onClick={() => {}} />).children.length;
    act(() => root.unmount()); host.remove();
    const without = show(<CreatureCard d={wolf} onClick={() => {}} />).children.length;
    expect(withLine).toBe(without + 1);
  });
});
