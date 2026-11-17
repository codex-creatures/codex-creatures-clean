// @vitest-environment happy-dom
// Klutz's Den (app/klutz/page.tsx) in a pretend browser: his tabs, a trip
// from his log opened up with what he set off with, and the Den's crate
// (?tab=crate) opening on his crate.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SAVE_KEY } from "@/lib/save";
import type { KlutzTrip } from "@/lib/klutz";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/klutz" }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const t0 = Date.parse("2026-11-18T10:00:00Z");
const trip: KlutzTrip = {
  startedAt: t0, endsAt: t0 + 40 * 60000, dest: 0, home: "pack", xp: 120, startHp: 90, hpEnd: 41, maxHp: 120,
  kit: { level: 6, maxHp: 120, proficiency: { atk: 8, rng: 0, mag: 0, agil: 3, mdef: 0, rdef: 0, magdef: 0 }, moves: ["Strike", "Smash"], gear: [{ name: "Klutz's Club", rarity: "common" }] },
  fights: [{ creatureId: "moss_wolf", rarity: "common", won: true, caught: true }, { creatureId: "cave_bat", rarity: "common", won: false }],
  finds: [{ name: "Iron Sword", rarity: "uncommon" }, { name: "Nails", rarity: "common", qty: 3 }],
  caged: 1,
};

async function open(search = "") {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory: [], equipment: {}, gold: 0, caged: [], quest: { stage: "done" }, klutz: { level: 6, trips: [trip] } }));
  window.history.replaceState(null, "", `/klutz${search}`);
  const Page = (await import("@/app/klutz/page")).default;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<Page />); });
}
const tap = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };

describe("Klutz's Den", () => {
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  it("is his home, with Hunt, Kit, Skills, Crate and Trips", async () => {
    await open();
    expect(host.textContent).toContain("Klutz's Den");
    expect(host.textContent).toContain("Home");
    await tap(host.querySelector('button[title="His stats and gear"]'));
    expect(host.textContent).toContain("Equip");
    expect(host.textContent).toContain("Weapon");
  });

  it("keeps his trips: each opens on what he set off with, his fights and his finds", async () => {
    await open();
    await tap(host.querySelector('button[aria-label="Trips"]'));
    const text = host.textContent ?? "";
    expect(text).toContain("1/2 won · 1 caught · 2 found");
    expect(text).toContain("+120 XP");
    expect(text).toContain("his pack was full");
    expect(text).toContain("He set off with");
    expect(text).toContain("Lv 6 · ❤️ 90/120");
    expect(text).toContain("Klutz's Club");
    expect(text).toContain("Moss Wolf");
    expect(text).toContain("Nails ×3");
    expect(text).toContain("1 went in the cage");
  });

  it("the Den's crate opens his den on his crate", async () => {
    await open("?tab=crate");
    expect(host.textContent).toContain("His crate · 0/");
  });
});
