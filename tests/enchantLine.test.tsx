import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EnchantLine from "../components/EnchantLine";
import { armorDrop } from "../lib/drops";
import { ARMOR_KEYS } from "../lib/items/armor";
import type { CreatureOrItemDrop } from "../lib/types";

// The bug (the user, 2026-11-16): scanning enchanted armour showed its enchantment while the Code Cache
// was still rattling, because the line forced itself visible inside the scan reveal's hidden panel.
describe("an item's enchantment line", () => {
  const piece = { ...(armorDrop(ARMOR_KEYS[0], "epic") as CreatureOrItemDrop), enchant: "ironbound" } as CreatureOrItemDrop;
  it("with an enchantment, it follows its box's visibility (so a hidden box hides it)", () => {
    expect(renderToStaticMarkup(<EnchantLine item={piece} />)).toContain("visibility:inherit");
    expect(renderToStaticMarkup(<div style={{ visibility: "hidden" }}><EnchantLine item={piece} /></div>)).not.toContain("visibility:visible");
  });
  it("without one, it keeps its space, hidden", () => {
    expect(renderToStaticMarkup(<EnchantLine item={{ ...piece, enchant: undefined }} />)).toContain("visibility:hidden");
  });
});
