# Art and PixelLab

Authoritative for the art style, PixelLab workflow and recipes, and the Den's scale. The walkable world's art standard is in [world/art-pipeline.md](../world/art-pipeline.md). Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 11. Art and PixelLab

- 📌 **The walkable world's art will follow a standard** (§13, [world-spec.md](../world-spec.md) §6): the
  shared projection, a palette per setting, templates and report-only checks. Until it's agreed,
  don't make more walkable-world art.
- ✅ All creature, item, room, NPC and prop art is from **PixelLab** (the `pixellab` MCP in Claude
  Code, set up with its key on each computer, never in the repo). Files are in `public/sprites/`, with
  IDs in `public/sprites/PIXELLAB.md`.
- **The style:** a single black outline, a dark-fantasy palette, detailed but clean shading (no noisy
  dithering). Creatures are side-on, trimmed and mirrored to face left (battle flips the player's
  side). Register art in `lib/sprites` (`withArt`, `ART_SIZES`). The old code-drawn grid sprites are gone (2026-11-04): an art sprite's grid is a single dot.
- ✅ **Back views** (2026-11-04): in a fight your creature is shown from behind
  (`public/sprites/creatures/back/`, `BACK_SIZES` and `fightSprite` in lib/sprites/creatures.ts),
  drawn as it looks and not mirrored. 14 approved so far; the rest show their usual art, mirrored,
  until theirs are redone and approved. Foes, and every other screen, use the usual art.
- ✅ **Fighters on a diagonal** (the user, 2026-11-04): yours near and low on the left, the foe
  further back, higher and smaller (`MY_SPOT`, `FOE_SPOT`, `FOE_DEPTH` 0.75 in
  components/BattleScreen.tsx; bosses `BOSS_BACK`, `BOSS_DEPTH` 0.8 in components/BossStage.tsx).
- **The workflow:** samples first, then the user's approval, then the full rollout. When the user
  hands over their own art, **keep their design** and only restyle it (`edit_image_pro_flash` on
  their upscaled image: "keep this exact …, redraw as crisp pixel art …"). Never reinterpret it
  from a description.
- **Recipes that worked:**
  - creatures: `create_image_pixen`, side view, "…to the right in profile…";
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
