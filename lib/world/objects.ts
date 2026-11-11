// lib/world/objects.ts
// Every kind of thing in the explorable world, defined once
// (docs/world-spec.md §3): its physical half (footprint, height, where it
// attaches, collision, sight, light, how you use it), which gameplay reads,
// and its visual half (art, drawing band, bounds, anchor), which only the
// renderer reads. Placed copies (instances) name a definition by id and carry
// only what varies.
//
// Milestone 1 (§4.3): the screen mustn't change, so each definition's art is
// drawn at exactly today's size. `visual.legacy` holds those sizes as they
// were written (in units, from the old "px at 16px a cell"); bounds, anchor
// and art density are worked out from them, for the art standard (§6) to
// use. Heights and footprints are physical sizes, the footprints in subcells
// as the user set them (§3 "Sizes", 2026-11-08): new runs' placer (place.ts)
// reads them; drawing doesn't (no object blocks sight or light today but rock).

import { artFor, type Art } from "../sprites/art";
import { TREASURE_CHEST, TREASURE_CHEST_OPEN, BURLAP_SACK, BURLAP_SACK_OPEN, RICKETY_CHEST, RICKETY_CHEST_OPEN, CARD_DECK, MERCHANT, LIBRARIAN, CARD_WITCH } from "../sprites/props";
import { WALK_CAGE, WALK_CAGE_OPEN, WALK_POOL, WALK_BOOKCASE, WALK_LECTERN, WALK_CAMPFIRE, WALK_CAMPFIRE_OUT, WALK_CANDLE, WALK_CANDLE_LIT, WALK_DECOR, WALK_BANNER, WALK_HERO, WALK_KIT, KIT_PX, type WalkProp } from "../sprites/walk";
import { legacyU } from "../render/projection";
import { SCONCE_RADIUS, CANDLE_RADIUS } from "../dungeon/torch";
import { CAMPFIRE_LIGHT } from "../dungeon/campfire";
import type { DecorKind } from "../dungeon/decor";

export type Attach = "floor" | "wall-north" | "wall-side" | "wall-south" | "overhead";
export type Layer = "floor" | "decal" | "standing" | "overhead"; // drawing bands (§4.5)
export type SizeClass = "tiny" | "small" | "medium" | "large" | "huge";
export type ArtRef = { src: string; w: number; h: number };

// How a definition is drawn today (milestone 1), in units: as wide as `width`
// (or as tall as `height`, its width from the art), with `lift` of the
// picture's height below its feet point; `sortDy` moves it in the drawing
// order (§4.5: a wall torch sorts on its wall, flat things under the rest).
export type LegacyDraw = { width?: number; height?: number; lift?: number; sortDy?: number };

export type ObjectDef = {
  id: string;
  kind: "structure" | "prop" | "interactable" | "light" | "creature" | "npc" | "decal";
  attach: Attach;
  footprint: { w: number; d: number }; // subcells, facing south (0×0: takes no floor)
  clearance?: number;                  // subcells round it kept free of other things (placement only, from world version 4)
  clearFront?: boolean;                // …only in front of it (south), not all round
  occupies?: "structure" | "blocking" | "walk-over" | "trigger" | "overhead"; // its occupancy layer, where it isn't the one its attach and collision give (a trigger area: occupancy.ts layerOf)
  height: number;                      // u
  collision: "solid" | "walk-over" | "none";
  blocksSight: boolean;                // foes' sight (foes.ts)
  blocksLight: boolean;                // torch light (torch.ts)
  light?: { radius: number; colour: string; flicker: boolean };
  // reach: walk this close and it's used; tap: a tap this close counts;
  // tapBody: a tap on someone's body (a cell up) counts too.
  interact?: { points: { dx: number; dy: number }[]; reach: number; tap: number; tapBody?: boolean; verb: string };
  layer: Layer;
  visual: {
    art: Record<string, ArtRef>;       // by state ("shut", "open", "lit", "out"); "base" if it has one
    bounds: { left: number; right: number; up: number; down: number }; // u around the anchor (its first art)
    anchorPx: { x: number; y: number }; // the anchor's pixel in that art
    artPerU: number;                    // art pixels a unit across
    pixelAspect?: number;               // legacy art: an art pixel's height ÷ width on screen
    facings?: ("south" | "east" | "north" | "west")[];
    legacy: LegacyDraw;
  };
  sizeClass?: SizeClass;
};

// A placed copy (§3), saved with the run (WalkRun.placed, lib/world/migrate.ts):
// where generation put it, never changed after. What the player does to it
// (lit, opened, beaten) is run state, kept elsewhere in the run.
export type Instance = {
  id: string; def: string; room: string;     // stable identity, and what it is
  sx: number; sy: number;                    // its anchor subcell (lib/world/grid.ts), whole numbers
  rot?: 0 | 1 | 2 | 3;                       // quarter turns (missing: 0; nothing turns yet)
  wall?: "north" | "east" | "west" | "south"; // a wall thing: the wall beside the floor subcell sx, sy ("south": world version 3 on)
  start?: "lit";                             // the state generation gave it (a wall torch that starts lit)
  facing?: number;                           // a creature: the way generation set it looking
  foe?: FoeStart;                            // a foe (def "foe", id `<room>:foe:<i>`): how it starts out
  size?: { w: number; d: number };           // the footprint it was placed with, unturned (world version 3 on; missing: its definition's)
  legacy?: "panel";                         // placed by the old panel rules: exactly today's behaviour (world-spec §3)
  holds?: "candle";                          // a table (world version 12): what stands on it
};

// How a foe starts out, as generation rolled it (lib/dungeon/foes.ts): it
// walks about or stands looking (for `wait` seconds before it first turns or
// sets off), keeps to one end of a room with two dens, or waits for you (a
// boss at the top of its room: no wait, it never turns).
export type FoeStart = { walks?: true; wait?: number; end?: 0 | 1; waits?: true };

export const REACH_OBJECT = 1.5; // u: this close to a thing you use, it's used
export const TAP_OBJECT = 1;     // u: a tap this close to one counts as tapping it
// Walk up to a thing from any cell round it (or onto it, if it isn't solid).
const AROUND = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ dx, dy })));
const usable = (verb: string, tapBody = false) => ({ points: AROUND, reach: REACH_OBJECT, tap: TAP_OBJECT, tapBody, verb });

// Today's sizes (px at 16px a cell), now in units: the old FOE_PX, NPC_PX, OBJECT_PX and SACK_PX.
export const FOE_U = legacyU(22);    // a foe's height, whatever its species
export const NPC_U = legacyU(26);    // a wanderer's height (the merchant, the librarian, the card witch)
export const OBJECT_U = legacyU(28); // a chest's width
export const SACK_U = legacyU(16);   // …a sack's (stashes, a fight's loot): smaller (the user, 2026-11-06)
// The light a wandering NPC carries (world-spec §5.7): read by nothing till they wander. 🧪
export const NPC_LIGHT = { radius: 2.5, colour: "#ffd27a", flicker: true };
// How tall a wall stands (u): the walls' kit's north wall, in its rows.
const WALL_U = WALK_KIT.size.north / WALK_KIT.size.row;
export const BOSS_SCALE = 2.6, CHIEF_SCALE = 1.3; // a waiting boss drawn this much bigger (the Cyclops; the Encampment's chief)

const ref = (a: Art | WalkProp | undefined): ArtRef => ({ src: a!.src, w: a!.w, h: a!.h });
const propRef = (s: Parameters<typeof artFor>[0]) => ref(artFor(s));

// The visual half from today's draw size: bounds round the anchor (the feet:
// the picture's bottom middle, raised by `lift`).
function legacyVisual(art: Record<string, ArtRef>, legacy: LegacyDraw, extra: Partial<ObjectDef["visual"]> = {}): ObjectDef["visual"] {
  const a = Object.values(art)[0];
  const wide = legacy.width ?? ((legacy.height ?? 1) * a.w) / a.h, tall = (wide * a.h) / a.w, lift = legacy.lift ?? 0;
  return {
    art, legacy, artPerU: a.w / wide,
    bounds: { left: wide / 2, right: wide / 2, up: tall * (1 - lift), down: tall * lift },
    anchorPx: { x: a.w / 2, y: a.h * (1 - lift) },
    ...extra,
  };
}

type Phys = Omit<ObjectDef, "id" | "visual" | "layer"> & { layer?: Layer };
const floorThing = (p: Partial<Phys>): Phys => ({
  kind: "prop", attach: "floor", footprint: { w: 1, d: 1 }, height: 0.8, collision: "solid", blocksSight: false, blocksLight: false, ...p,
});
const def = (id: string, p: Phys, visual: ObjectDef["visual"]): ObjectDef => ({ id, layer: "standing", ...p, visual });
const decorDef = (id: string, kind: DecorKind, p: Partial<Phys>, legacy: Omit<LegacyDraw, "width"> = {}) =>
  def(id, floorThing({ kind: "prop", ...p }), legacyVisual({ base: ref(WALK_DECOR[kind]) }, { width: legacyU(WALK_DECOR[kind].size), ...legacy }));
const WALK_OVER = { collision: "walk-over" as const, height: 0.3, sortDy: -0.6 };

// A rickety table (world version 12, the user, 2026-11-11): furniture, some with a candle on, and the deck
// of cards on one. Drawn in 3D (components/Props3D.tsx); its front picture stands in for it in the 2D view.
export const TABLE_ART: ArtRef = { src: "/sprites/props/table3d/front.png?v=1", w: 40, h: 24 };
export const TABLE_TOP = 0.67; // u: how high its top is (props3d.ts tableArt; a candle on it stands there)

const DEFS: ObjectDef[] = [
  // Things you use.
  def("chest", floorThing({ footprint: { w: 3, d: 2 }, clearance: 1, clearFront: true, kind: "interactable", interact: usable("open") }), legacyVisual({ shut: propRef(TREASURE_CHEST), open: propRef(TREASURE_CHEST_OPEN) }, { width: OBJECT_U })),
  def("sack", floorThing({ footprint: { w: 2, d: 2 }, kind: "interactable", height: 0.6, interact: usable("open") }), legacyVisual({ shut: propRef(BURLAP_SACK), open: propRef(BURLAP_SACK_OPEN) }, { width: SACK_U })),
  def("rickety-chest", floorThing({ footprint: { w: 3, d: 2 }, clearance: 1, clearFront: true, kind: "interactable", interact: usable("open") }), legacyVisual({ shut: propRef(RICKETY_CHEST), open: propRef(RICKETY_CHEST_OPEN) }, { width: OBJECT_U })),
  // A beaten room's loot: a sack dropped where the fight was, which you walk over; a chest (a mini boss's or boss's), solid.
  def("loot-sack", floorThing({ footprint: { w: 2, d: 2 }, kind: "interactable", height: 0.6, collision: "walk-over", interact: usable("open") }), legacyVisual({ shut: propRef(BURLAP_SACK), open: propRef(BURLAP_SACK_OPEN) }, { width: SACK_U })),
  def("loot-chest", floorThing({ footprint: { w: 3, d: 2 }, kind: "interactable", interact: usable("open") }), legacyVisual({ shut: propRef(RICKETY_CHEST), open: propRef(RICKETY_CHEST_OPEN) }, { width: OBJECT_U })),
  def("table", floorThing({ footprint: { w: 3, d: 2 }, clearance: 1, height: TABLE_TOP }), legacyVisual({ base: TABLE_ART }, { width: OBJECT_U * 0.8 })),
  def("card-deck", floorThing({ footprint: { w: 3, d: 2 }, clearance: 1, clearFront: true, kind: "interactable", interact: usable("play") }), legacyVisual({ base: propRef(CARD_DECK) }, { width: OBJECT_U })),
  def("pool", floorThing({ footprint: { w: 3, d: 3 }, clearance: 1, kind: "interactable", height: 0.3, interact: usable("drink") }), legacyVisual({ base: ref(WALK_POOL) }, { width: legacyU(WALK_POOL.size), lift: 0.35 })),
  // (World version 9, decision 39) a library's broken bookcases, searched like a stash, and its locator lectern.
  def("bookcase", floorThing({ footprint: { w: 3, d: 2 }, kind: "interactable", height: 1.4, interact: usable("search") }), legacyVisual({ shut: ref(WALK_BOOKCASE), open: ref(WALK_BOOKCASE) }, { width: legacyU(WALK_BOOKCASE.size) })),
  def("lectern", floorThing({ footprint: { w: 2, d: 2 }, kind: "interactable", height: 1, interact: usable("read") }), legacyVisual({ base: ref(WALK_LECTERN) }, { width: legacyU(WALK_LECTERN.size) })),
  def("cage", floorThing({ footprint: { w: 3, d: 3 }, kind: "interactable", height: 1.2, interact: usable("open") }), legacyVisual({ shut: ref(WALK_CAGE), open: ref(WALK_CAGE_OPEN) }, { width: legacyU(WALK_CAGE.size) })),
  // Lights.
  def("campfire", floorThing({ footprint: { w: 2, d: 2 }, clearance: 1, kind: "light", height: 0.6, light: { radius: CAMPFIRE_LIGHT, colour: "#ff9632", flicker: true } }),
    legacyVisual({ lit: ref(WALK_CAMPFIRE), out: ref(WALK_CAMPFIRE_OUT) }, { width: legacyU(WALK_CAMPFIRE.size), lift: 0.15 })),
  def("candle", floorThing({ footprint: { w: 1, d: 1 }, kind: "light", height: 0.4, collision: "walk-over", light: { radius: CANDLE_RADIUS, colour: "#ffbe5a", flicker: true } }),
    legacyVisual({ out: ref(WALK_CANDLE), lit: ref(WALK_CANDLE_LIT) }, { width: legacyU(WALK_CANDLE.size) })),
  // A floor candle (world version 5 on): a placed object, unlit to start; walk near and it lights (world-spec §8 stage B).
  def("floor-candle", floorThing({ footprint: { w: 1, d: 1 }, kind: "light", height: 0.4, collision: "walk-over", light: { radius: CANDLE_RADIUS, colour: "#ffbe5a", flicker: true } }),
    legacyVisual({ out: ref(WALK_CANDLE), lit: ref(WALK_CANDLE_LIT) }, { width: legacyU(WALK_CANDLE.size) })),
  // Candles on a wall (world-spec §5.6), one for each wall's view: world version 5 places them (place.ts). Each
  // has today's candle as its art till its own is made; its light starts in the floor subcell by its wall.
  ...(["north", "side", "south"] as const).map((w) => def(w === "north" ? "candle-wall" : `candle-wall-${w}`,
    { kind: "light", attach: w === "north" ? "wall-north" : w === "side" ? "wall-side" : "wall-south", footprint: { w: 0, d: 0 }, height: 0.4, collision: "none",
      blocksSight: false, blocksLight: false, light: { radius: CANDLE_RADIUS, colour: "#ffbe5a", flicker: true } },
    legacyVisual({ out: ref(WALK_CANDLE), lit: ref(WALK_CANDLE_LIT) }, { width: legacyU(WALK_CANDLE.size), sortDy: w === "north" ? -0.6 : w === "side" ? 0.4 : -0.5 }))),
  // Wall torches: a bracket and a flame drawn in code, on a top wall or a tunnel's side wall.
  def("sconce", { kind: "light", attach: "wall-north", footprint: { w: 0, d: 0 }, height: 0.5, collision: "none", blocksSight: false, blocksLight: false, light: { radius: SCONCE_RADIUS, colour: "#ff9632", flicker: true } },
    { art: {}, bounds: { left: 0.16, right: 0.16, up: 0.45, down: 0 }, anchorPx: { x: 0, y: 0 }, artPerU: 1, legacy: { sortDy: -0.6 } }),
  def("sconce-side", { kind: "light", attach: "wall-side", footprint: { w: 0, d: 0 }, height: 0.5, collision: "none", blocksSight: false, blocksLight: false, light: { radius: SCONCE_RADIUS, colour: "#ff9632", flicker: true } },
    { art: {}, bounds: { left: 0.16, right: 0.16, up: 0.45, down: 0 }, anchorPx: { x: 0, y: 0 }, artPerU: 1, legacy: { sortDy: 0.4 } }),
  def("banner", { kind: "prop", attach: "wall-north", footprint: { w: 0, d: 0 }, height: 1.2, collision: "none", blocksSight: false, blocksLight: false },
    legacyVisual({ base: ref(WALK_BANNER) }, { width: legacyU(WALK_BANNER.size) })),
  // Structure (as tall as the walls' kit draws its north walls: WALK_KIT.size): a pillar is rock in the floorplan today (interior.ts), so it blocks walking, sight and light as rock.
  def("pillar", { kind: "structure", attach: "floor", footprint: { w: 3, d: 3 }, height: WALL_U, collision: "solid", blocksSight: true, blocksLight: true },
    { art: {}, bounds: { left: 0.5, right: 0.5, up: WALL_U, down: 0.5 }, anchorPx: { x: 0, y: 0 }, artPerU: WALK_KIT.size.px, pixelAspect: WALK_KIT.size.px / WALK_KIT.size.row, legacy: {} }),
  // A south wall's top band, standing up over the floor's last row (the kit's cap).
  def("wall-south", { kind: "structure", attach: "wall-south", footprint: { w: 0, d: 0 }, height: WALL_U, collision: "none", blocksSight: true, blocksLight: true },
    { art: {}, bounds: { left: 0.5, right: 0.5, up: WALK_KIT.size.cap / WALK_KIT.size.row, down: 0 }, anchorPx: { x: 0, y: 0 }, artPerU: WALK_KIT.size.px, pixelAspect: WALK_KIT.size.px / WALK_KIT.size.row, legacy: { sortDy: -0.5 } }),
  // A tunnel's mouth fallen in behind you: rock in the floorplan, rubble drawn on it in code.
  def("rubble", { kind: "structure", attach: "floor", footprint: { w: 3, d: 3 }, height: 0.5, collision: "none", blocksSight: true, blocksLight: true },
    { art: {}, bounds: { left: 0.5, right: 0.5, up: 0.5, down: 0.2 }, anchorPx: { x: 0, y: 0 }, artPerU: 1, legacy: {} }),
  // Decor (lib/dungeon/decor.ts; the lab's samples): solid against the walls, or walked over (drawn under the rest).
  decorDef("barrels", "barrels", { footprint: { w: 3, d: 2 }, height: 0.9 }),
  decorDef("crates", "crates", { footprint: { w: 3, d: 3 }, height: 1.1 }),
  decorDef("fallen-pillar", "pillar", { footprint: { w: 3, d: 2 }, height: 0.7 }),
  decorDef("skull", "skull", WALK_OVER, { lift: 0.3, sortDy: WALK_OVER.sortDy }),
  decorDef("nest", "nest", { ...WALK_OVER, footprint: { w: 2, d: 2 } }, { lift: 0.3, sortDy: WALK_OVER.sortDy }),
  decorDef("pots", "pots", { ...WALK_OVER, footprint: { w: 2, d: 2 }, height: 0.5 }, { lift: 0.3, sortDy: WALK_OVER.sortDy }),
  // People: the merchant and the librarian stand by their carts; the card witch walks about (not solid).
  def("merchant", floorThing({ footprint: { w: 3, d: 2 }, clearance: 1, clearFront: true, kind: "npc", height: 1.4, light: NPC_LIGHT, interact: usable("talk", true) }), legacyVisual({ base: propRef(MERCHANT) }, { height: NPC_U })),
  def("librarian", floorThing({ footprint: { w: 3, d: 2 }, clearance: 1, clearFront: true, kind: "npc", height: 1.4, light: NPC_LIGHT, interact: usable("talk", true) }), legacyVisual({ base: propRef(LIBRARIAN) }, { height: NPC_U })),
  // (World version 9, decision 39) the merchant and the librarian walking about, without their carts (not solid).
  def("merchant-walk", floorThing({ footprint: { w: 2, d: 2 }, kind: "npc", height: 1.4, collision: "none", light: NPC_LIGHT, interact: usable("talk", true) }), legacyVisual({ base: propRef(MERCHANT) }, { height: NPC_U })),
  def("librarian-walk", floorThing({ footprint: { w: 2, d: 2 }, kind: "npc", height: 1.4, collision: "none", light: NPC_LIGHT, interact: usable("talk", true) }), legacyVisual({ base: propRef(LIBRARIAN) }, { height: NPC_U })),
  def("witch", floorThing({ footprint: { w: 2, d: 2 }, kind: "npc", height: 1.3, collision: "none", light: NPC_LIGHT, interact: usable("talk", true) }),
    legacyVisual({ base: propRef(CARD_WITCH) }, { height: NPC_U }, { facings: ["south", "east", "north", "west"] })),
  // You, and foes: a foe's art is its species' (lib/sprites/creatures.ts), drawn FOE_U tall, bigger when it waits.
  def("hero", { kind: "creature", attach: "floor", footprint: { w: 2, d: 2 }, height: 1.1, collision: "none", blocksSight: false, blocksLight: false, sizeClass: "small" },
    { art: { base: { src: WALK_HERO.sheet, w: WALK_HERO.cell, h: WALK_HERO.cell } }, bounds: { left: WALK_HERO.cell / KIT_PX / 2, right: WALK_HERO.cell / KIT_PX / 2, up: WALK_HERO.feet / KIT_PX, down: (WALK_HERO.cell - WALK_HERO.feet) / KIT_PX },
      anchorPx: { x: WALK_HERO.cell / 2, y: WALK_HERO.feet }, artPerU: KIT_PX, facings: ["south", "east", "north", "west"], legacy: {} }),
  def("foe", { kind: "creature", attach: "floor", footprint: { w: 2, d: 2 }, height: 1, collision: "none", blocksSight: false, blocksLight: false },
    { art: {}, bounds: { left: FOE_U / 2, right: FOE_U / 2, up: FOE_U, down: 0 }, anchorPx: { x: 0, y: 0 }, artPerU: 1, legacy: { height: FOE_U } }),
];

export const OBJECTS: Record<string, ObjectDef> = Object.fromEntries(DEFS.map((d) => [d.id, d]));
export const objectDef = (id: string): ObjectDef => {
  const d = OBJECTS[id];
  if (!d) throw new Error(`no object definition "${id}"`);
  return d;
};
// A definition's art in a state (or its only art).
export const artOf = (d: ObjectDef, state?: string): ArtRef | undefined => (state !== undefined ? d.visual.art[state] : undefined) ?? d.visual.art.base;

// The decor kinds (decor.ts) by definition.
export const DECOR_DEF: Record<DecorKind, string> = { barrels: "barrels", crates: "crates", pillar: "fallen-pillar", skull: "skull", nest: "nest", pots: "pots" };

