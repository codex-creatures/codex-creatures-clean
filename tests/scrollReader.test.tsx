// @vitest-environment happy-dom
// An XP scroll read from the Inventory (the user, 2026-11-20): tap it, Read,
// and pick who reads it, Klutz among your creatures.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SAVE_KEY } from "@/lib/save";
import { SCROLL_XP } from "@/lib/creatures/levels";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/chest" }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root, host: HTMLDivElement;
const scroll = { id: "s1", barcode: "", dropType: "item", itemCategory: "consumable", rarity: "uncommon", roll: 0, name: "Tattered XP Scroll", scroll: "xp", createdAt: "" };
const wolf = { id: "c1", barcode: "", dropType: "creature", creatureId: "moss_wolf", rarity: "common", roll: 0, name: "Moss Wolf", level: 3, createdAt: "" };
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
const tap = async (el: Element | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };

describe("reading a scroll from the Inventory", () => {
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  it("lists Klutz first, then your creatures; picked, the scroll's read and gone", async () => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory: [scroll, wolf], equipment: {}, gold: 0, caged: [], quest: { stage: "done" }, klutz: { level: 2 } }));
    window.history.replaceState(null, "", "/chest");
    const Page = (await import("@/app/chest/page")).default;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<Page />); });
    await tap(button("Consumables"));
    await tap(host.querySelector("button[title='Tattered XP Scroll']") ?? undefined);
    await tap(button("📜 Read"));
    const names = [...host.querySelectorAll("[data-readers] button")].map((b) => b.getAttribute("title"));
    expect(names).toEqual(["Klutz", "Moss Wolf"]);
    await tap(host.querySelector("[data-readers] button[title='Klutz']") ?? undefined);
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    expect(saved.inventory.map((d: { id: string }) => d.id)).toEqual(["c1"]);
    expect(saved.klutz.level > 2 || saved.klutz.xp > 0).toBe(true); // (his ${SCROLL_XP} XP)
    expect(SCROLL_XP).toBeGreaterThan(0);
  });
});
