// lib/tour.ts
// Klutz's tour of the Den: offered once you've opened his box (lib/quest.ts,
// the "stash" stage), and again any time from his page. Each step lights up
// one thing on one screen (TourOverlay) with a line from Klutz; tapping
// anywhere goes on to the next, moving to the next step's screen if it's
// another one. It ends in your Inventory, with the gear from his box.
//
// Where you are in it is kept in the save (its own field, so the main save
// doesn't overwrite it): leave halfway and it carries on where you were.
//
// target: a data-tour="…" mark on that screen ("den-<OBJ id>" is a place's
// label in the Den, lit up by the Den itself); none, and Klutz just talks.

import { OBJ, type ObjId } from "./den/scene";
import { readSave, writeSaveField } from "./save";

export type TourStep = { path: string; target?: string; say: string };

const den = (id: number) => `den-${id}`;

export const TOUR: TourStep[] = [
  // The Den
  { path: "/", say: "This is the Den: home. Tap anything in here to go there. I'll show you round. Tap anywhere to carry on." },
  { path: "/", target: "dock", say: "The same places are down here too, quicker to reach." },

  // The Soul Altar
  { path: "/", target: den(OBJ.altar), say: "The Soul Altar. Scan a real barcode and it opens a Code Cache: creatures, gear, potions." },
  { path: "/altar", target: "altar-progress", say: "How much of the world you've discovered, and your explorer level. Scanning raises it, and higher levels turn up rarer creatures." },
  { path: "/altar", target: "scan", say: "Tap here to scan a barcode with your camera. Every barcode holds something different, and it's the same for every player." },
  { path: "/altar", target: "scan-mode", say: "Looting opens caches straight away. Storage keeps them here to open later." },
  { path: "/altar", target: "altar-window", say: "Your finds show up here. The rarer, the brighter: common, uncommon, rare, epic, legendary." },

  // The Pit
  { path: "/", target: den(OBJ.pit), say: "The Pit. Your creatures live here." },
  { path: "/pit", target: "tabs", say: "Creatures: everyone you own. Roster: the ones you've starred ★, picked first for the Labyrinth. Cards: collect 3 of a creature to summon it." },
  { path: "/pit", target: "grid", say: "Tap a creature to see its level, stats and moves, and to put weapons and armour on it." },
  { path: "/pit", target: "grid", say: "Every creature has a race, and races beat other races. The race chart in a fight shows who's strong against who." },
  { path: "/pit", target: "parts", say: "Items flips to your gear, so you can kit them out without leaving." },

  // The Battle Bag
  { path: "/", target: den(OBJ.bag), say: "Your bag. Whatever you pack goes into the Labyrinth with you." },
  { path: "/bag", say: "Pack potions to heal between rooms, and spare gear to swap in mid-fight. Room's tight, and anything you find down there needs a free slot to come home." },

  // Around the Den
  { path: "/", target: den(OBJ.cage), say: "The cage. Creatures I catch wait in here for you: keep them, or let them go." },
  { path: "/", target: den(OBJ.crate), say: "My crate. Gear I bring back from hunting goes in here: keep it or sell it." },

  // Klutz
  { path: "/", target: den(OBJ.klutz), say: "And that's me! Lend me some gear and I'll hunt in the Labyrinth for you." },
  { path: "/klutz", say: "Gear me up here and send me off. I hunt till something beats me, then come home with creatures for the cage and gear for my crate. I level up too." },

  { path: "/", target: den(OBJ.pool), say: "The healing pool. Hurt creatures rest up in here." },
  { path: "/", target: den(OBJ.bookcase), say: "The bookcase holds codexes. Read one on a creature to teach it a new move." },
  { path: "/", target: den(OBJ.quests), say: "The quest board: see how you rank against other players." },
  { path: "/", target: den(OBJ.scroll), say: "The Bestiary & Rules: every creature you've met, and how fights work. Stuck? Look there, or tap any ? for help." },

  // The Labyrinth
  { path: "/", target: den(OBJ.arch), say: "The Labyrinth. Start with the Encampment: rooms of fights, chests and merchants, and a chief at the end." },
  { path: "/", target: den(OBJ.arch), say: "Your team's HP carries from room to room, so bring potions. Knocked out, and I drag you home, but what's left on the floors is lost." },
  { path: "/", target: den(OBJ.arch), say: "Beat the Encampment's chief and the Labyrinth proper opens up. Its boss is a Cyclops." },

  // The Inventory, and the gear from the box
  { path: "/", target: den(OBJ.chest), say: "Last one: your Inventory. That's where my box went." },
  { path: "/chest", target: "tabs", say: "Weapons, armour, potions and codexes, each in its own box. Boxes fill up, so sell what you don't need." },
  { path: "/chest", target: "grid", say: "Here's the gear from my box. Tap a piece to see its stats." },
  { path: "/chest", target: "grid", say: "Gear's stats are multiplied by your creature's own %s, so the right piece on the right creature counts." },
  { path: "/chest", target: "sell", say: "Sell Mode turns what you don't need into gold." },
  { path: "/chest", say: "To put gear on: go to the Pit, tap your creature, and tap one of its slots. That's the tour! Ask me again any time." },
];

// ── Where you are in it (the save's "tour" field) ──────────────────
export const TOUR_FIELD = "tour";
type TourSave = { step: number };

export function tourStep(save: Record<string, unknown> = readSave()): number | null {
  const t = save[TOUR_FIELD] as TourSave | undefined;
  return t && typeof t.step === "number" && t.step >= 0 && t.step < TOUR.length ? t.step : null;
}
export const startTour = () => writeSaveField(TOUR_FIELD, { step: 0 });
export const endTour = () => writeSaveField(TOUR_FIELD, undefined);
// On to the next step (the last one ends it).
export function nextTourStep() {
  const s = tourStep();
  if (s === null || s + 1 >= TOUR.length) endTour();
  else writeSaveField(TOUR_FIELD, { step: s + 1 });
}
// The Den place lit up at this step, if it's one.
export const tourDenTarget = (step: number | null): ObjId | undefined => {
  const t = step === null ? undefined : TOUR[step]?.target;
  return t?.startsWith("den-") ? (Number(t.slice(4)) as ObjId) : undefined;
};
