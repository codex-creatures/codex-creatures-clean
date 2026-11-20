// @vitest-environment happy-dom
// The Soul Altar (app/altar/page.tsx) in a pretend browser: Ascend by tapping
// creatures into the slots, the ritual run with the real game state, and
// what's saved afterwards. (The whirlwind is stood in for.)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SAVE_KEY } from "@/lib/save";
import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";
import { makeCreatureDrop } from "@/lib/creatures/summon";
import type { CreatureOrItemDrop } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/altar" }));
vi.mock("@/components/SummonShow", () => ({
  default: ({ result, onDone, words }: { result: CreatureOrItemDrop; onDone: () => void; words?: { done: string } }) =>
    <div data-stub="show"><span>{words?.done ?? `${result.name} summoned!`}</span><button onClick={onDone}>Carry on</button></div>,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const wolf = (level: number, extra: Partial<CreatureOrItemDrop> = {}): CreatureOrItemDrop =>
  ({ ...makeCreatureDrop(CREATURE_BY_ID.moss_wolf, "creature", "x"), level, ...extra });
const saved = () => JSON.parse(localStorage.getItem(SAVE_KEY)!) as { inventory: CreatureOrItemDrop[]; equipment: Record<string, { weaponId?: string }> };
const button = (text: string | RegExp) => [...host.querySelectorAll("button")].find((b) => (typeof text === "string" ? b.textContent?.includes(text) : text.test(b.textContent ?? "")));
const tap = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
const tileOf = (c: CreatureOrItemDrop) => host.querySelector(`button[aria-label^="${c.name}, Lv ${c.level}"]`);
// The inspect panel's button (not a circle slot, whose empty ring says the same word).
const action = (label: string) => [...host.querySelectorAll("button:not([data-slot])")].find((b) => b.textContent?.trim() === label);
const raise = async (c: CreatureOrItemDrop) => { await tap(tileOf(c)); await tap(action("Raise")); };
const offer = async (c: CreatureOrItemDrop) => { await tap(tileOf(c)); await tap(action("Offer")); };

// The altar works once the Encampment's chief is beaten (lib/dungeon/run.ts altarMended).
const MENDED = { labyrinth: { meta: { campClears: 1, clears: 0 }, run: null } };

async function open(inventory: CreatureOrItemDrop[], equipment: Record<string, unknown> = {}) {
  localStorage.clear();
  localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory, equipment, gold: 100, caged: [], ...MENDED }));
  const Page = (await import("@/app/altar/page")).default;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<Page />); });
  await tap(host.querySelector('button[aria-label^="Ascend:"]'));
}

describe("the Soul Altar's Ascend", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  it("raises one Moss Wolf with four more, and gives back the others' gear", async () => {
    const sword = { id: "sword1", barcode: "", dropType: "item" as const, itemCategory: "weapon" as const, itemKey: "sword" as never, rarity: "common" as const, roll: 0, name: "Sword", stats: { melee: 5 }, createdAt: "" };
    const kept = wolf(9), rest = [wolf(5), wolf(6), wolf(7), wolf(8)], low = wolf(4);
    await open([kept, ...rest, low, sword as unknown as CreatureOrItemDrop], { [rest[0].id]: { weaponId: "sword1" } });

    // Too low to take part: greyed, with why.
    expect(tileOf(low)?.textContent).toContain("Needs Lv 5");
    await raise(kept);
    expect(button(/Needs 4 more/)).toBeTruthy();
    for (const c of rest) await offer(c);
    const go = button("Ascend to uncommon");
    expect(go?.hasAttribute("disabled")).toBe(false);
    await tap(go);
    expect(host.textContent).toContain("Moss Wolf ascends!");

    const s = saved();
    const ids = s.inventory.map((d) => d.id);
    expect(ids).toContain(kept.id);
    for (const c of rest) expect(ids).not.toContain(c.id);
    expect(ids).toContain(low.id);
    expect(ids).toContain("sword1");                 // the gear stays yours…
    expect(s.equipment[rest[0].id]).toBeUndefined(); // …off the one given up
    expect(s.inventory.find((d) => d.id === kept.id)).toMatchObject({ ascended: 1, rarity: "uncommon", level: 9 });

    // After the show: back at the altar, the raised one still up top, now needing 2 Uncommons.
    await tap(button("Carry on"));
    expect(button(/Needs 2 more/)).toBeTruthy();
  });

  it("asks before giving up a soul stone", async () => {
    const kept = wolf(5), rest = [wolf(6, { soulStone: "trickster" as never }), wolf(7), wolf(8), wolf(9)];
    await open([kept, ...rest]);
    await raise(kept);
    for (const c of rest) await offer(c);
    await tap(button("Ascend to uncommon"));
    expect(host.querySelector('[role="dialog"][aria-label="Give these up?"]')).toBeTruthy();
    await tap(button("Keep them"));
    expect(saved().inventory.every((d) => !d.ascended)).toBe(true);
    await tap(button("Ascend to uncommon"));
    await tap(button("Give them up"));
    expect(saved().inventory.find((d) => d.id === kept.id)?.ascended).toBe(1);
  });

  it("shows what a creature carries, and takes one back out of the circle", async () => {
    const kept = wolf(5), rest = [wolf(6, { soulStone: "trickster" as never }), wolf(7)];
    await open([kept, ...rest]);
    await raise(kept);
    await offer(rest[0]);
    expect(button(/Needs 4 more/)).toBeTruthy();
    expect(host.textContent).toContain("Trickster");      // its soul stone, in the inspect panel
    expect(host.textContent).toContain("Birth rolls");
    expect(tileOf(rest[0])?.textContent).toContain("In the circle");
    await tap(host.querySelector(`[data-slot="0"]`)!);   // a slot: inspect what's in it…
    await tap(action("Take out"));                       // …and take it out
    expect(tileOf(rest[0])?.textContent).toContain("Lv 6");
    await tap(button("Clear"));
    expect(button("Choose one to raise")).toBeTruthy();
  });
});

describe("the Soul Altar's Summon", () => {
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  it("summons 3 cards of a creature into it", async () => {
    vi.resetModules();
    const cards = [1, 2, 3].map(() => makeCreatureDrop(CREATURE_BY_ID.moss_wolf, "card", "x"));
    localStorage.clear();
    localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory: cards, equipment: {}, gold: 0, caged: [], ...MENDED }));
    const Page = (await import("@/app/altar/page")).default;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<Page />); });
    await tap(host.querySelector('button[aria-label^="Spirit Summon:"]'));
    await tap(host.querySelector('button[aria-label="Moss Wolf card, 3 held"]')!);
    await tap(button("Summon the kept card"));
    expect(host.textContent).toContain("Moss Wolf summoned!");
    const inv = saved().inventory;
    expect(inv.filter((d) => d.dropType === "card")).toHaveLength(0);
    expect(inv.filter((d) => d.dropType === "creature")).toHaveLength(1);
  });
});

describe("the Soul Altar, broken (the user, 2026-11-20)", () => {
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  it("before the Encampment's chief is beaten: no summoning, no ascending", async () => {
    vi.resetModules();
    const cards = [1, 2, 3].map(() => makeCreatureDrop(CREATURE_BY_ID.moss_wolf, "card", "x"));
    localStorage.clear();
    localStorage.setItem(SAVE_KEY, JSON.stringify({ inventory: cards, equipment: {}, gold: 0, caged: [] }));
    const Page = (await import("@/app/altar/page")).default;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<Page />); });
    expect(host.textContent).toContain("The altar is cracked and cold");
    const choices = [...host.querySelectorAll("button.altar-choice")] as HTMLButtonElement[];
    expect(choices.length).toBe(2);
    expect(choices.every((b) => b.disabled)).toBe(true);
  });
});
