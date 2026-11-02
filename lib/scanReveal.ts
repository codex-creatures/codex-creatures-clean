// lib/scanReveal.ts
// The unveiling when a Code Cache opens at the altar (components/ScanReveal.tsx):
// the cache rattles up the rarities one stage at a time (white, then green,
// blue, purple, and for a legendary a held breath and gold) until it reaches
// its find's, then cracks open in a flash of that colour and the find pops
// out with its buttons. Rarer finds rattle longer and open bigger.

import type { Drop } from "./types";
import type { Rarity } from "./items/budgets";
import { lootEntry, merchantOffer } from "./dungeon/run";
import { itemDiscoveryKey } from "./items/discovery";
import { CREATURE_TEMPLATES, findCreatureTemplate } from "./creatures/creatureData";

// The rarities in the order the cache climbs through them.
export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
// How long each stage of the rattle lasts (ms): a common find rattles once,
// an uncommon one rattles that and then green, and so on up.
export const STAGE_MS: Record<Rarity, number> = { common: 800, uncommon: 550, rare: 550, epic: 550, legendary: 650 };
// Before turning gold the cache goes still for a moment, as if it's done.
export const LEGENDARY_PAUSE_MS = 450;
export const GOLD_SHAKE_MS = 750;

// One stage of the rattle: which colour it's in, when it starts and how long
// it lasts (ms). "pause" is the held breath before gold.
export type ShakeStage = { rarity: Rarity; at: number; ms: number; pause?: boolean };
export function shakeStages(d: Drop): ShakeStage[] {
  if (d.dropType === "reward") return [{ rarity: "common", at: 0, ms: GOLD_SHAKE_MS }];
  const top = Math.max(0, RARITY_ORDER.indexOf(d.rarity));
  const stages: ShakeStage[] = [];
  let at = 0;
  for (const rarity of RARITY_ORDER.slice(0, top + 1)) {
    if (rarity === "legendary") { stages.push({ rarity: "epic", at, ms: LEGENDARY_PAUSE_MS, pause: true }); at += LEGENDARY_PAUSE_MS; }
    stages.push({ rarity, at, ms: STAGE_MS[rarity] });
    at += STAGE_MS[rarity];
  }
  return stages;
}

// 1st, 2nd, 3rd, 4th… 11th, 12th, 13th… 21st.
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

// The line under the find saying who got here first: the first ever to scan
// the barcode, how many players found it before you (online), or a rescan.
export function findLine(found: "first" | "looted" | undefined, place?: number): string | null {
  if (found === "first" || place === 1) return "✨ First to find this Code Cache!";
  if (found === "looted") return "You've already looted this Code Cache";
  return place ? `You're the ${ordinal(place)} to find this Code Cache` : null;
}

// How big the crack is: a puff of light; light rays (rare); rays, falling gold
// and a jolt (epic); a big golden explosion on top of all that (legendary).
export type RevealTier = "puff" | "rays" | "shower" | "explosion";
export function revealTier(rarity: Rarity | undefined): RevealTier {
  return rarity === "legendary" ? "explosion" : rarity === "epic" ? "shower" : rarity === "rare" ? "rays" : "puff";
}

// What a find sells for at the altar: the merchant's price (lib/dungeon/run.ts
// merchantOffer): gear for what the Inventory pays (gearValue), potions,
// codexes, scrolls and tools for half what they cost. Materials go straight
// to your tally, so they aren't sold here; nor is what he won't buy.
export function findPrice(d: Drop, gearValue: (d: Drop) => number): number {
  if (d.dropType !== "item" || d.material) return 0;
  return merchantOffer(lootEntry(d.id), d, gearValue);
}

// What you can do with it: a creature or creature card let go, gold just
// taken, anything with a price sold. Anything else is kept.
export type RevealChoice = "sell" | "release" | "keep" | "gold";
export function revealChoice(d: Drop, price: number): RevealChoice {
  if (d.dropType === "reward") return "gold";
  if (d.dropType === "creature" || d.dropType === "card") return "release";
  return price > 0 ? "sell" : "keep";
}

// The whole rattle, start to crack (ms).
export function shakeMs(d: Drop): number {
  const last = shakeStages(d).at(-1)!;
  return last.at + last.ms;
}

// Summoning from 3 cards (components/SummonShow.tsx): the cards are set on the
// altar (SUMMON_PLACE_MS), whirl up into a whirlwind that gathers in white
// for SUMMON_GATHER_MS more, then climbs the rarities like a cache (same
// stages, same colours) to the creature's own and bursts into it.
export const SUMMON_PLACE_MS = 1000;
export const SUMMON_GATHER_MS = 700;
export function summonStages(d: Drop): ShakeStage[] {
  return shakeStages(d).map((s, i) => ({ ...s, at: s.at + SUMMON_PLACE_MS + (i > 0 ? SUMMON_GATHER_MS : 0), ms: s.ms + (i === 0 ? SUMMON_GATHER_MS : 0) }));
}
// The whole show, cards down to the burst (ms).
export function summonMs(d: Drop): number {
  const last = summonStages(d).at(-1)!;
  return last.at + last.ms;
}

// Which of these finds are new to you (a "New creature!" or "New item!" as it
// opens): a species you've never owned (owned: "Creatures discovered",
// lib/items/gameHelpers.ts ownedSpecies), or a kind of item you've never had
// (had: "Items discovered"). Of two of the same new kind in one go, only the
// first is new. Gold and the rest never are.
export type NewFind = "creature" | "item";
export function newFinds(drops: Drop[], owned: ReadonlySet<string>, had: ReadonlySet<string>): Map<string, NewFind> {
  const species = new Set(owned), items = new Set(had);
  const out = new Map<string, NewFind>();
  for (const d of drops) {
    if (d.dropType === "creature" || d.dropType === "card") {
      const t = findCreatureTemplate(d.creatureId, d.name);
      if (!t || !CREATURE_TEMPLATES.includes(t) || species.has(t.id)) continue;
      species.add(t.id);
      out.set(d.id, "creature");
    } else {
      const k = itemDiscoveryKey(d);
      if (!k || items.has(k)) continue;
      items.add(k);
      out.set(d.id, "item");
    }
  }
  return out;
}
