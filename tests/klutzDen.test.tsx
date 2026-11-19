// @vitest-environment happy-dom
// Klutz's Den (app/klutz/page.tsx) in a pretend browser: his tabs, a trip
// from his log opened up with what he set off with, and the Den's crate
// (?tab=crate) opening on his crate.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SAVE_KEY } from "@/lib/save";
import type { KlutzTrip } from "@/lib/klutz";
import { EMPTY_LINES } from "@/components/klutz/KlutzStory";

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

async function open(search = "", save: Record<string, unknown> = {}) {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory: [], equipment: {}, gold: 0, caged: [], quest: { stage: "done" }, klutz: { level: 6, trips: [trip] }, ...save }));
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
  it("resting, he can drink a potion from your Inventory: it's used up and he's healed", async () => {
    const potion = { id: "p1", barcode: "", dropType: "item", itemCategory: "consumable", rarity: "common", roll: 0, name: "Lesser Potion", potion: "lesser", createdAt: "" };
    await open("?tab=hunt", { inventory: [potion], klutz: { level: 6, trips: [trip], hp: 10, hpAt: Date.now() } });
    const btn = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("+50 HP"));
    await tap(btn);
    expect([...host.querySelectorAll("button")].some((b) => b.textContent?.includes("+50 HP"))).toBe(false);
    expect(host.textContent).toContain("❤️ 60/");
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    expect(saved.inventory).toEqual([]);
    expect(saved.klutz.hp).toBe(60);
  });

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

  it("while he's out, tapping a stat says why his points can't be spent", async () => {
    const now = Date.now();
    const expedition = { v: 2, dest: 0, startHp: 100, maxHp: 120, startedAt: now - 60000, endsAt: now + 3600000, collected: false, home: "pack", encounters: [], finds: [] };
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory: [], equipment: {}, gold: 0, caged: [], quest: { stage: "done" }, klutz: { level: 6, expedition } }));
    window.history.replaceState(null, "", "/klutz");
    const Page = (await import("@/app/klutz/page")).default;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<Page />); });
    await tap([...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Kit")));
    await tap([...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Look at his gear")));
    const attack = [...document.querySelectorAll("button")].find((b) => b.title.startsWith("Melee:"));
    await tap(attack);
    expect(document.body.textContent).toContain("He's out hunting. Spend his points when he's home.");
    expect(attack?.textContent).not.toContain("+1");
  });

  it("the Den's crate opens his den on his crate", async () => {
    await open("?tab=crate");
    expect(host.textContent).toContain("His crate · 0/");
  });
});

describe("Klutz's trip, told as a story", () => {
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  it("while he's out: each fight and find with how far in, what he left behind, and his pack", async () => {
    const now = Date.now(), start = now - 30 * 60000, min = 60000;
    const item = (name: string, extra: Record<string, unknown>) => ({ id: name, barcode: "", dropType: "item", rarity: "uncommon", roll: 0, name, createdAt: "", ...extra });
    const expedition = {
      v: 2, dest: 0, startHp: 100, maxHp: 120, startedAt: start, endsAt: now + 30 * min, collected: false, home: "pack",
      encounters: [{ at: start + 10 * min, creatureId: "moss_wolf", rarity: "common", gearRarity: "common", won: true, caught: true, rounds: 3, level: 4, hpAfter: 82, loot: [], xp: 20 }],
      finds: [{ at: start + 10 * min, drop: item("Rusty Sword", { itemCategory: "weapon", itemKey: "sword" }) }, { at: start + 20 * min, drop: item("Leather Cap", { itemCategory: "armor", armorSlot: "helmet" }), skill: "armourer" }],
      left: 1, passed: [{ at: start + 20 * min, name: "Nails", rarity: "common", qty: 2 }], empty: [start + 25 * min],
    };
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory: [], equipment: {}, gold: 0, caged: [], quest: { stage: "done" }, klutz: { level: 6, expedition } }));
    window.history.replaceState(null, "", "/klutz?tab=hunt"); // (he opens on his Crate)
    const Page = (await import("@/app/klutz/page")).default;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<Page />); });
    const text = host.textContent ?? "";
    expect(text).toContain("10m");
    expect(text).toContain("fought for 3 rounds and he took 18 damage");
    expect(text).toContain("He caught it!");
    expect(text).toContain("It dropped Rusty Sword");
    expect(text).toContain("His Armourer's eye spotted Leather Cap");
    expect(text).toContain("but it was below your Selective rarity, so he left it behind");
    expect(EMPTY_LINES.some((l) => text.includes(l))).toBe(true); // a window that brought nothing
    expect(text).toContain("…still exploring");
    expect(text).toContain("His pack");
    expect(text).toMatch(/2\/\d+/);
    expect(text).not.toContain("skip to the end");
  });
});
