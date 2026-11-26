// @vitest-environment happy-dom
// The Pit's Items (app/pit/page.tsx) in a pretend browser, beside the Inventory's (app/chest/page.tsx): the same
// list of the same things, so it must say the same about them (docs/polish-audit-2026-11.md, inconsistencies).
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SAVE_KEY } from "@/lib/save";
import { STORAGE_V } from "@/lib/items/storage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/pit" }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;

const sword = (i: number) => ({ id: `w${i}`, barcode: "", dropType: "item", itemCategory: "weapon", itemKey: "iron_sword", rarity: "common", roll: 0, name: `Sword ${i}`, stats: { melee: 5 }, createdAt: "2026-11-20T00:00:00Z" });
const scroll = { id: "s1", barcode: "", dropType: "item", itemCategory: "consumable", rarity: "rare", roll: 0, name: "Tattered XP Scroll", scroll: "xp", desc: "Read it to give one creature, or Klutz, XP.", createdAt: "2026-11-20T00:00:00Z" };
// 55 weapons in a weapons box built up twice (it holds 75), a scroll, and Klutz helping (the first quest done).
const SAVE = { gold: 0, inventory: [...Array.from({ length: 55 }, (_, i) => sword(i)), scroll], equipment: {}, caged: [], quest: { stage: "done" }, klutz: { level: 6 },
  storage: ["weapon", "weapon"], storageV: STORAGE_V };

async function open(page: "pit" | "chest") {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE));
  window.history.replaceState(null, "", `/${page}`);
  const Page = (await import(page === "pit" ? "@/app/pit/page" : "@/app/chest/page")).default;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<Page />); });
}
const tap = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
const tabOf = (name: string) => [...host.querySelectorAll('[role="tab"]')].find((b) => b.textContent?.startsWith(name));
const items = async (page: "pit" | "chest") => { await open(page); if (page === "pit") await tap(button("Items")); };

describe("the Pit's Items, beside the Inventory's", () => {
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  for (const page of ["chest", "pit"] as const) {
    it(`${page === "pit" ? "the Pit" : "the Inventory"}: a box built bigger isn't called full at the size it started`, async () => {
      await items(page);
      const weapons = tabOf("Weapons")!;
      expect(weapons.textContent).toContain("55");
      expect(weapons.textContent).not.toContain("55/"); // (only a full box shows its size: "75/75")
      expect(weapons.querySelector('[title^="Full"]')).toBeNull();
    });

    it(`${page === "pit" ? "the Pit" : "the Inventory"}: an XP scroll can be read to Klutz, as it says on it`, async () => {
      await items(page);
      await tap(tabOf("Consumables"));
      await tap(host.querySelector('button[title="Tattered XP Scroll"]'));
      await tap(button("Read"));
      expect([...host.querySelectorAll("[data-readers] button")].map((b) => b.getAttribute("title"))).toContain("Klutz");
    });
  }
});
