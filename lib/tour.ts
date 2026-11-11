// lib/tour.ts
// Klutz's tours: offered once you've opened his box (lib/quest.ts, the
// "stash" stage), and again any time from his page. There are three, plus
// all three in a row (TOURS):
// - basics: round the Den, what each place is for, in a line each;
// - combat: how fights work (races and their colours, a move's style and
//   energy, the race chart), with pictures in Klutz's bubble;
// - items: how gear rolls and how a creature's %s boost it, ending in your
//   Inventory with the gear from his box.
// Each step lights up one thing on one screen (TourOverlay) with a line from
// Klutz; tapping anywhere goes on to the next, moving to the next step's
// screen if it's another one.
//
// Where you are in it is kept in the save (its own field, so the main save
// doesn't overwrite it): leave halfway and it carries on where you were.
//
// target: a data-tour="…" mark on that screen ("den-<OBJ id>" is a place's
// label in the Den, lit up by the Den itself); none, and Klutz just talks.
// show: a picture in his bubble (TourOverlay draws it).

import { OBJ, type ObjId } from "./den/scene";
import { readSave, writeSaveField } from "./save";
import { MATCH_BONUS, RACE_EFFECT } from "./combat/raceChart";
import { ENERGY_REGEN, MAX_ENERGY } from "./combat/engine";
import { STEADY_MAX_ENERGY } from "./creatures/creatureData";
import { SWAP_ENERGY_RESTORE } from "./combat/battle";
import { RARITY_BUDGETS } from "./items/budgets";

export type TourPicture = "races" | "tablets" | "styles" | "flip" | "energy" | "chart";
export type TourStep = { path: string; target?: string; say: string; show?: TourPicture };
export type TourId = "basics" | "combat" | "items" | "full";

const den = (id: number) => `den-${id}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

// ── The basics: round the Den ─────────────────────────────────────
const BASICS: TourStep[] = [
  { path: "/", say: "This is the Den: your home. Tap anything in here to go there. I'll show you round. Tap anywhere to carry on." },
  { path: "/", target: "dock", say: "The same places are down here too, quicker to reach." },

  // The Soul Altar
  { path: "/", target: den(OBJ.altar), say: "The Soul Altar. Scan a real barcode (a cereal box, a book, anything) and it cracks open a Code Cache: creatures, gear or potions." },
  { path: "/altar", target: "altar-progress", say: "How much of the world you've discovered, and your explorer level. Scanning raises it, and higher levels turn up rarer creatures." },
  { path: "/altar", target: "scan", say: "Tap here to scan with your camera. Every barcode holds something different, and it's the same thing for every player." },
  { path: "/altar", target: "scan-mode", say: "Looting opens caches straight away. Storage keeps them sealed here to open later." },
  { path: "/altar", target: "altar-window", say: "Your finds land here. The brighter the colour, the rarer: common, uncommon, rare, epic, legendary." },

  // The Pit
  { path: "/", target: den(OBJ.pit), say: "The Pit. Your creatures live here." },
  { path: "/pit", target: "tabs", say: "Creatures: everyone you own. Roster: the ones you've starred ★, picked first for the Labyrinth. Cards: collect 3 of a creature to summon it." },
  { path: "/pit", target: "grid", say: "Tap a creature to see its level, stats and moves, and to put weapons and armour on it." },
  { path: "/pit", target: "parts", say: "Items flips to your gear, so you can kit them out without leaving." },

  // The Battle Bag
  { path: "/", target: den(OBJ.bag), say: "Your bag. Whatever you pack comes into the Labyrinth with you." },
  { path: "/bag", say: "Pack potions to heal between rooms, and spare gear to swap in. Room's tight, and anything you find down there needs a free slot to come home." },

  // Around the Den
  { path: "/", target: den(OBJ.chest), say: "Your Inventory: every weapon, piece of armour, potion and codex you own. The gear from my box is in there." },
  { path: "/", target: den(OBJ.cage), say: "The cage. Creatures I catch wait in here for you: keep them, or let them go." },
  { path: "/", target: den(OBJ.crate), say: "My crate. Gear I bring back from hunting goes in here: keep it or sell it." },

  // Klutz
  { path: "/", target: den(OBJ.klutz), say: "And that's me! Lend me some gear and I'll hunt in the Labyrinth for you." },
  { path: "/klutz", say: "Gear me up here and send me off. I hunt till something beats me, then come home with creatures for the cage and gear for my crate. I level up too." },

  { path: "/", target: den(OBJ.pool), say: "The healing pool. Hurt creatures rest up in here." },
  { path: "/", target: den(OBJ.bookcase), say: "The bookcase holds codexes. Read one to a creature to teach it a new move." },
  { path: "/", target: den(OBJ.quests), say: "The quest board: quests to take on, and how you rank against other players." },
  { path: "/", target: den(OBJ.scroll), say: "The Bestiary & Rules: every creature you've met, and how fights work. Stuck? Look there, or tap any ? for help." },

  // The Labyrinth
  { path: "/", target: den(OBJ.arch), say: "The Labyrinth. Start with the Encampment: rooms of fights, chests and merchants, and a chief at the end. Beat it and the rest opens up." },
  { path: "/", target: den(OBJ.arch), say: "Your team's HP carries from room to room, so bring potions. Knocked out, and I drag you home, but what's left on the floors is lost." },
];
const BASICS_END: TourStep = { path: "/", say: "That's the basics! Ask me about fights or gear any time and I'll go deeper." };

// ── Combat ────────────────────────────────────────────────────────
const COMBAT: TourStep[] = [
  { path: "/", target: den(OBJ.arch), say: "Now, fights. In the Labyrinth your team of 3 takes on theirs, one creature out on each side. Each turn you pick a move, swap, or use an item." },
  { path: "/", show: "races", say: "Every creature has a race (some have two), and every race has its own colour. Learn the colours: they're the key to every fight." },
  { path: "/", show: "tablets", say: "Moves are stone tablets in their race's colour. A grey one is Neutral: it has no race, so it hits everyone the same." },
  { path: "/", show: "styles", say: "The mark carved behind the name is the move's style. An impact is melee, an arrow is ranged, a bolt is magic." },
  { path: "/", show: "styles", say: "The style picks the stats: a melee move uses your melee attack against their melee defence. Same for ranged and magic." },
  { path: "/", show: "flip", say: "Tap the i on a tablet to flip it over: its power, its cost and what it does. Go on, try it! (Tap anywhere else to carry on.)" },
  { path: "/", show: "energy", say: `The number in the corner is its energy (⚡) cost. Everyone starts a fight on ${MAX_ENERGY}, and gets ${ENERGY_REGEN} back after every attack.` },
  { path: "/", show: "energy", say: `So big moves need a turn or two of saving up. Every creature keeps a cheap move (${STEADY_MAX_ENERGY} or less), so it can always attack.` },
  { path: "/", show: "chart", say: `The race chart. Your move's race down the side, theirs along the top. ▲ is effective: +${pct(RACE_EFFECT.strong - 1)} damage. ▼ is resisted: −${pct(1 - RACE_EFFECT.resisted)}.` },
  { path: "/", show: "chart", say: `A move of your creature's own race does +${pct(MATCH_BONUS - 1)} more. Against two races both count: weak to both is a double weakness.` },
  { path: "/", say: `Losing a matchup? Swap. It uses your turn and the one coming in takes their hit, but the one going out gets back ${pct(SWAP_ENERGY_RESTORE)} of its missing energy.` },
  { path: "/", say: "Who goes first? Swaps and items, then attacks: quick moves first, then whoever has more agility." },
  { path: "/", target: den(OBJ.scroll), say: "It's all written up in the Bestiary & Rules." },
  { path: "/guide", target: "race-chart", say: "The race chart lives here, and in every fight behind the ▲▼ button. Mix your team's races, so one foe can't beat you all." },
];

// ── Items ─────────────────────────────────────────────────────────
const b = RARITY_BUDGETS;
const ITEMS: TourStep[] = [
  { path: "/", target: den(OBJ.chest), say: "Now, gear. It all lives in your Inventory. Let's look." },
  { path: "/chest", target: "tabs", say: "Weapons, armour, potions and codexes, each in its own box. Boxes fill up, so sell what you don't need." },
  { path: "/chest", target: "grid", say: "Here's the gear from my box. Tap a piece to see its stats." },
  { path: "/chest", target: "grid", say: `Every piece rolls its stats when it's found. Rarer gear has more points to share out: common ${b.common}, uncommon ${b.uncommon}, rare ${b.rare}, epic ${b.epic}, legendary ${b.legendary}.` },
  { path: "/chest", target: "grid", say: "What it is decides where the points tend to go: a scythe leans to melee, a bow to ranged, a staff to magic. Two of the same can still roll quite differently." },
  { path: "/chest", target: "grid", say: "Armour comes as a helmet, chest and legs: defences, HP and agility. Defence counts at a third, so its numbers run big. Wear all 3 of one kind for a set bonus." },
  { path: "/chest", say: "Now the clever bit. Every creature has a % for each stat: how much extra it gets out of its gear." },
  { path: "/chest", say: "A creature with 40% melee gets 40% more from its weapon's melee: 30 becomes 42. With 0% it's just the 30." },
  { path: "/chest", say: "So the right piece on the right creature counts: melee gear on high melee %s, magic gear on high magic %s. A creature's %s are in the Pit." },
  { path: "/chest", target: "sell", say: "Sell Mode turns what you don't need into gold." },
  { path: "/chest", say: "To put gear on: go to the Pit, tap your creature, and tap one of its slots. That's the tour! Ask me again any time." },
];

export const TOURS: Record<TourId, TourStep[]> = {
  basics: [...BASICS, BASICS_END],
  combat: COMBAT,
  items: ITEMS,
  full: [...BASICS, ...COMBAT, ...ITEMS],
};
// Klutz's page: the choice, in this order.
export const TOUR_CHOICES: { id: TourId; label: string }[] = [
  { id: "basics", label: "🏠 The basics" },
  { id: "combat", label: "⚔️ Combat" },
  { id: "items", label: "🛡️ Items" },
  { id: "full", label: "🗺️ The full tour" },
];

// ── Where you are in it (the save's "tour" field) ──────────────────
// (A save from before there were several tours has no id: the full one.)
export const TOUR_FIELD = "tour";
type TourSave = { step: number; id?: TourId };
export type TourAt = { id: TourId; step: number };

export function tourAt(save: Record<string, unknown> = readSave()): TourAt | null {
  const t = save[TOUR_FIELD] as TourSave | undefined;
  const id: TourId = t?.id && t.id in TOURS ? t.id : "full";
  return t && typeof t.step === "number" && t.step >= 0 && t.step < TOURS[id].length ? { id, step: t.step } : null;
}
// The step you're on, or undefined.
export const stepOf = (at: TourAt | null): TourStep | undefined => (at ? TOURS[at.id][at.step] : undefined);
export const startTour = (id: TourId = "full") => writeSaveField(TOUR_FIELD, { step: 0, id });
export const endTour = () => writeSaveField(TOUR_FIELD, undefined);
// On to the next step (the last one ends it).
export function nextTourStep() {
  const at = tourAt();
  if (at === null || at.step + 1 >= TOURS[at.id].length) endTour();
  else writeSaveField(TOUR_FIELD, { step: at.step + 1, id: at.id });
}
// The Den place lit up at this step, if it's one.
export const tourDenTarget = (at: TourAt | null): ObjId | undefined => {
  const t = stepOf(at)?.target;
  return t?.startsWith("den-") ? (Number(t.slice(4)) as ObjId) : undefined;
};
