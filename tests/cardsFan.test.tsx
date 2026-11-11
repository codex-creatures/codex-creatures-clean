// @vitest-environment happy-dom
// The deck room's cards, turned over (components/CardStack.tsx CardsFan): a tap off the cards closes
// the window (the user, 2026-11-11: the cards are already yours), a tap on them doesn't.
import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { CardsFan } from "@/components/CardStack";
import { stackCards } from "@/components/LootGrid";
import { makeCreatureDrop } from "@/lib/creatures/summon";
import { CREATURE_TEMPLATES } from "@/lib/creatures/creatureData";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("the deck's cards, turned over", () => {
  it("close on a tap off the cards, not on one on them", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const onClose = vi.fn(), root = createRoot(el);
    const drops = CREATURE_TEMPLATES.slice(0, 3).map((t) => ({ drop: makeCreatureDrop(t, "card", "") }));
    act(() => root.render(<CardsFan piles={stackCards(drops)} onClose={onClose} />));
    const dialog = el.querySelector("[role=dialog]") as HTMLElement;
    act(() => (el.querySelector(".encounter-card") as HTMLElement).click());
    expect(onClose).not.toHaveBeenCalled();
    act(() => dialog.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });
});
