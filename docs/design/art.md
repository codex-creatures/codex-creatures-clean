# Art and PixelLab

Authoritative for the art style, PixelLab workflow and recipes, and the Den's scale. The walkable world's art standard is in [world/art-pipeline.md](../world/art-pipeline.md). Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 11. Art and PixelLab

- ✅ **Walkable-world art follows the current standard** ([world/art-pipeline.md](../world/art-pipeline.md)):
  world units and subcell footprints with their own visual bounds and anchors
  ([world/objects.md](../world/objects.md)), the one shared projection, 48 art pixels a unit for new
  assets, the dungeon palette and the report-only checks; samples first, approval in the game. (The
  user, 2026-11-09: the old "until it's agreed, don't make more walkable-world art" no longer
  applies.) Where the standard is still undefined, flag it rather than inventing one: the list is in
  [world/art-pipeline.md](../world/art-pipeline.md#still-undefined).
- ✅ All creature, item, room, NPC and prop art is from **PixelLab** (the `pixellab` MCP in Claude
  Code, set up with its key on each computer, never in the repo). Files are in `public/sprites/`, with
  IDs in `public/sprites/PIXELLAB.md`.
- **The style:** a single black outline, a dark-fantasy palette, detailed but clean shading (no noisy
  dithering). Creatures are side-on, trimmed and mirrored to face left (battle flips the player's
  side). Register art in `lib/sprites` (`withArt`, `ART_SIZES`). The old code-drawn grid sprites are gone (2026-11-04): an art sprite's grid is a single dot.
- ✅ **Back views** (2026-11-04): in a fight your creature is shown from behind
  (`public/sprites/creatures/back/`, `BACK_SIZES` and `fightSprite` in lib/sprites/creatures.ts),
  drawn as it looks and not mirrored. Foes, and every other screen, use the usual art. **Every
  creature a player can own has one, Klutz too** (2026-11-27: the 13 from 2026-11-03 plus 33 redone;
  a test checks none is missing). **The standard** (the user, 2026-11-27, naming the Gloom Gnome,
  Gleamling, Gutsnout and Troglodyte Brute as the best): the creature is **truly turned away** in a
  **three-quarter view**, its back and some of its right side showing (the spine left of centre,
  the right shoulder nearer), facing the foe at the upper right. Never the side view's pose or
  stride with just the torso turned (11 first tries were rejected for that), and never dead
  straight from behind either (The Watcher, Rattlebones and Veilstalker were sent back for
  that, 2026-11-28). Legs and feet are
  seen from behind, side by side under the body and planted; a quadruped shows its rump and both
  hind legs, tail in the middle; a flier flies away with its wings out to both sides; a rider's
  horse turns too. The head keeps its share of the height (no shrunk heads; Klutz's head is nearly
  half of him, ears wide, eye domes on top). A held weapon is on the right; anything else clear of
  the body (a bow, a staff, a club) stays in view. No face, chest or belly.
  - **How they're made** (art/back-views-2026-11/README.md, with every candidate, sheet and job id):
    first a written sheet for each creature from its sprite at 4× (body plan, measured
    proportions, near/far/back, held items, what must not show), checked by a second reviewer
    agent; then `edit_image_pro_flash` (text, no background, palette correction, seed 22 did best)
    on the sprite flipped to face right and padded to a square in 4s; then the reviewer measures
    the candidate against the sprite and the sheet. Small misses: a masked
    `inpaint_image_pro_flash`, which beats another text edit; when the model keeps redrawing a
    part, a scripted pixel fix (Aurelius's far forearm clipped, the Gravewarden's shield bars
    recoloured). 33 took 252 generations, and the 11 redone to the standard 111 more. Prompts that
    worked in round 2 say "redraw this exact … seen from BEHIND: its whole body turned away from
    us, facing into the picture and only slightly to the right", spell out where each leg, the
    head (its size "the same as in the original") and the weapon go, and end "no side-on … pose".
    Shrunk heads were fixed with one edit ("make the head about 1.5 times bigger"). "Slightly to
    the right" came out dead straight-on, and editing a straight-on back to turn it barely moves
    it; regenerating from the side art with "seen from behind at a 45-degree angle: the camera is
    behind it and off to its right … its back and its right side about equally … a NEW standing
    pose" gives the Gnome's and Troll's turn (round 3: 55 more generations, 418 of the 500 in all).
  - Redrawn art gets a new address for its back too (`ART_REV`), so phones fetch it at once.
  - Amber Wasp's back (2026-11-03) is still side-on, the only old one off the standard; left for
    the user to decide.
- ✅ **Fighters on a diagonal** (the user, 2026-11-04): yours near and low on the left, the foe
  further back, higher and smaller (`MY_SPOT`, `FOE_SPOT`, `FOE_DEPTH` 0.75 in
  components/BattleScreen.tsx; bosses `BOSS_BACK`, `BOSS_DEPTH` 0.8 in components/BossStage.tsx).
- **The workflow:** samples first, then the user's approval, then the full rollout. When the user
  hands over their own art, **keep their design** and only restyle it (`edit_image_pro_flash` on
  their upscaled image: "keep this exact …, redraw as crisp pixel art …"). Never reinterpret it
  from a description.
- **Recipes that worked:**
  - creatures: `create_image_pixen`, side view, "…to the right in profile…"; **always a 128×128 canvas** (the user,
    2026-11-25: every creature at the Pale Rider's detail, not smaller canvases for small ones), and say "zoomed out small
    full-body sprite … fits inside the frame with empty space on every side, nothing cut off" or about one in three comes
    out cropped. Small fixes: `edit_image_pro_flash` on the 128px raw ("keep this exact …; add/replace …"), 6 generations;
  - items: `create_image_pro_flash` 64×64 with the Void Scythe as the style image;
  - rooms: `edit_image` over the code-drawn chamber, so the tunnels line up.
  - Ask before using the expensive generators (`create_image_pro`, pro characters).
- **Scale (the block standard, 2026-10-20):** the Den and its rooms draw art 1:1 (one PNG pixel =
  one room pixel), and **1 floor block = 64px across**. Plan a prop's footprint in blocks first; its
  width in pixels follows. The Soul Altar is 2×2 blocks (128px); Klutz is about 1 block wide and 1⅓
  tall (69×85px) and is the yardstick for doors. The tavern is 10×5 blocks (510px), its door
  about 130px. An isometric footprint of a×b blocks is (a+b)×32px wide.
  - **Buildings must match the room's 2:1 angle** (walls slope 1 down for every 2 across). AI
    generators draw their own perspective, so: draw a flat-colour block-out in code on the exact grid
    (doors and windows where the code expects them), then `edit_image` (up to 512px, ~25
    generations) on the block-out with an approved sample as the reference image. It keeps the
    shape and angle and copies the look. It comes out a little gloomy: warm it in code (a gentle
    saturation and lamp-light lift), and add the light spill as glows in the room.
  - Don't enlarge a small draft and redraw it with pixflux: it lost the angle and the colours.
- Hand-drawn detailed sprites in code were tried and scrapped. Don't do it again.
- Rejected, so don't reopen: the mushroom/ruin room theme, the Mr. Shadows redraws (keep the old
  sprite), and the parchment / MTG / wood-and-brass card styles.

## The placeholder audit (2026-11-16)

Everything in the game still showing a stand-in (an emoji, another thing's art, a tint, a code
shape), found in the code on 2026-11-16, with the draft made for each. Drafts are samples only
(`public/sprites/walk/samples/drafts/`, shown in `/lab/art`): nothing goes into the game until the
user approves it. Recipes follow §11 and [world/art-pipeline.md](../world/art-pipeline.md): item
icons Pro Flash 64×64 with the Void Scythe as style image; 32px glyphs styled on the approved race
and status icons; NPCs on the collector; dungeon props with the dungeon palette and a crop of kit E.

| Group | Placeholder now | Where | Draft |
|---|---|---|---|
| Material | Essence crystal (was Essence stones): 💎 | `MATERIALS.essence`, `MATERIAL_SPRITES` | 64px icon |
| Soul stones (6) | emoji (☣️ 👻 🪨 🎯 🃏 💚) | `SOUL_STONES` | 64px icon each |
| Locators (3) | the schematic, clairvoyance and codex icons | `TOOL_SPRITES` | 64px icon each |
| Klutz's Pack Upgrade | the backpack icon | `TOOL_SPRITES.klutz_pack` | 64px icon |
| Dynamite | Klutz's crate picture | `DYNAMITE_ART` (lib/world/objects.ts) | 64px prop |
| Campaign crates (4) | none (contents shown loose) | lib/campaign.ts | 64px icon each |
| Cyclops Head | not drawn (the old Den hung the Cyclops sprite on a CSS plaque; `headUp`, lib/tavern.ts) | the Den | 64px trophy |
| Golden chest | the treasure chest, tinted gold | components/Props3D.tsx `golden` | 64px chest, closed |
| Standing torch | the floor candle | `standing-torch` (objects.ts) | dungeon prop |
| Race icons (2) | 🪨 Underkin, 🦠 Toxic | `RACE_INFO` | 32px glyph each |
| Status marks (12) | emoji: haste, mirage, corpse, seal, soak, brace, boost, bleed, weaken, ward, flame, charged | `FighterLabel` (BattleScreen.tsx) | 32px glyph each |
| UI glyphs (6) | emoji: ⚙️ 🐾 ⚔️ 📖 📜 🏆 | the Den's top bar, the quest board's tabs | 32px glyph each |
| Den fireplace (📌, not built) | none | roadmap | Den prop |

Not drafted (each needs the user first):
- **The hero's 8-way walk** (stills with a bob now): about 20–25 generations as one animation job.
- ~~22 creature back views~~ done 2026-11-27 (§11, Back views).
- **The chest's gold inside** (a stand-in box in 3D): could use the approved treasure pile.
- **The tavern's interior** and the **mounted head's wall** need design before art.
- **Walls with square pixels** (still undefined, art-pipeline.md): not touched.

**Drafted 2026-11-16:** 41 drafts for 206 of the cycle's 2,000 generations (1,794 left, refilling
2026-12-16), ids in `public/sprites/PIXELLAB.md`. Shown in **`/lab/art`**: a stone room you walk
round by torchlight (keys, the stick or a tap), each draft on a plinth, its card beside what the
game shows now; then all of them in a grid, fully lit. Claude's notes for the review: the set reads
as one family; the weakest are the Underkin pickaxe (faint outline) and the standing torch (thin,
dark); the golden chest kept the treasure chest's shape, so it could become the 3D chest's gold
faces; the fireplace isn't on the Den's 2:1 angle yet (§11's block-out method would fix that).
Approved ones go into the game with their registries (`lib/sprites`, `RACE_INFO`, `Glyph`).

**The user's review (2026-11-16):** ✅ **approved and in the game:** the six soul stones (`STONE_SPRITES`,
`StoneIcon`), the Essence crystal (renamed from Essence stones), Klutz's Pack Upgrade, the crystal ball
and librarian locator, the dynamite on a storehouse's floor (`DYNAMITE_ART`), the standing torch (its own
picture in 3D, one flame on its bowl), the Toxic race icon, nine status marks (corpsify, mirage, bleed,
boost, burning, ward, weakened, sealed, haste) and four UI icons (items discovered; the board's Campaign,
Quests and Boards tabs: since 2026-11-17 only Quests, by the Quest Board's title, the tabs plain words). (Ward is Crystal Armour's: it clears a creature's statuses and blocks new ones
for 3 rounds.) The rest were redrawn (round 2, the user: "real world props" must look as they will
as a real 3D model in the Labyrinth, or at the Den's angle):
- **The golden chest** as the 3D chest's own faces in gold (front, ends, lid top, with their lit edges
  and underside, made from chest3d's at the same sizes, so they go straight on `Chest`'s boxes): see
  `/lab/chest`, Golden (draft) beside Golden (now).
- **The Cyclops Head** and **the fireplace** by §11's block-out method: a flat-colour shape at the
  2:1 angle (on a wall sloping like the tavern's front), repainted by Pro Flash edit.
- **The Enchantress** styled on the merchant (three-quarter view, hunched, earthy, a prop in hand).
- **The crates** styled on the game's own crate; the merchant's map, Underkin, soaked, brace, charged,
  settings and creatures redrawn; **Stone** (🪨, missed in round 1) drafted.
Round 2 cost 101 generations (1,693 left). In `/lab/art` the room now shows round 2; the
approved ones are listed under it.

**The user's second review (2026-11-16):** ✅ the golden chest's 3D faces (now the game's, with a
Legendary glow round it like a deck's), Stone, the merchant's map, and the settings and creatures icons
are in the game. **Brace gets no mark** (it resolves the same turn, so the log's words do). Redrawn:
**Underkin** as a gloomy stone face with glowing golem eyes. **The crates are 3D now** (the user: loot
boxes are 3D models in this game, not flat pictures): the chest's two boxes with a plain crate's faces
(front, ends, lid, from chest3d's at the same sizes) and a look-down picture of each kind's contents
inside (`crate3d/inside-<kind>.png`), in `/lab/art`'s 3D panel and `/lab/chest`. Still to review: the
Cyclops Head, the fireplace, the Enchantress, soaked and charged.

**The user's third review (2026-11-16):** ✅ Underkin (golem eyes) and Soaked are in the game; the
Materials and Supplies crates (3D) are approved, to go in with the campaign's rewards window. **Codex
rewards come as a bookcase, not a crate** (the reward reads "Codex Bookcase"; the game's 3D bookcase is
its model). **The gear reward is a barrel** with weapons sticking out ("Gear Barrel"): a 3D draft, a
bulging lathe of staves with a straw top and the weapons as an upright picture (`barrel3d/`, in
`/lab/art`'s 3D panel). **The Enchantress** is approved if smaller and walking: redrawn at 64 × 80 (from
80 × 96) and given an 8-frame walk like the other visitors' (PixMiniMax), both in `/lab/art`. Dropped by
the user: the fireplace, the Cyclops Head (the head stays the Cyclops sprite on its plaque) and the
charged mark's draft (charged is a charge move winding up, e.g. Mega Smash; it keeps 💢 for now).

**In the game (2026-11-16, the user's fourth review):** the Gear Barrel, and the Materials and Supplies
Crates (public/sprites/props/crate3d/ and barrel3d/; `Crate` and `Barrel` in components/Props3D.tsx) show
in 3D when a campaign crate reward is claimed (the Codex Bookcase is the game's bookcase), and a
storehouse's crates are the Materials Crate in 3D. Still to review: the Enchantress (smaller, walking).

**The dungeon's flat props in 3D (drafts, 2026-11-16; the user: "we did not build 3D assets for the new
props"):** components/Decor3D.tsx, built like the chest, crate and barrel (shapes in code, PixelLab
surfaces in `walk/samples/drafts/decor3d/`): the corner decor (two lidded barrels, stacked crates, a skull
on scattered bones, a fallen mossy pillar, a twig nest with eggs, three clay pots) and a storehouse's finds
(the dynamite as three bound sticks, the backpack), plus the chest lab's earlier cage and lectern drafts.
In `/lab/art`'s 3D panel, each beside the flat picture it would replace. The banner stays a flat cloth on
its wall. Not in the game till approved. The Enchantress is in the tavern (her walk is to be redone with
the Den, which the user plans to rebuild).

**The fifth review (2026-11-17):** ✅ in the game, built in 3D (components/Decor3D.tsx, tinted by the light
where each stands): a room's corner **barrels** and a storehouse's barrels (two lidded barrels: "your best
design this round"), corner **crates** (two stacked; from world version 17 they can be searched, open once
searched), **pots** (scenery, nothing in them), the library's **lectern**, and the **dynamite** (glowing on
the floor till it's taken, as well as its ❗). Dropped: the fallen pillar and the nest (no nests in new runs'
corners, world version 17). To redo: the backpack (not a box), the skull and bones (hard to read), the
cage (to match the barrels). The collector's and Enchantress's walks barely move: to be redone.
Round 2 of those three (2026-11-17, drafts in `/lab/art`): the skull is a round cranium with its face painted
on, lying on two crossed 3D bones; the backpack a rounded leather body with a front pocket and a bedroll
strapped on top; the cage built like the crates (a plank floor in the crate's wood, corner posts, rusty
iron bars, an open roof of beams and bars so you see in from the high camera). The collector's walk is
redone with big lifted steps (in the tavern now).
**2026-11-17:** ✅ the cage is in the game, made bigger (2.1 u tall against the walls' 2.25, 1.1 u across;
`DECOR_3D.cage`, opening with its cage); the skull and backpack drafts are dropped (the user: not needed).
