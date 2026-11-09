# The docs: what's where, and which wins

Start here to find the one file a task needs. Read that file's relevant section, not everything.

## Which documents are authoritative

1. **Code determines what is currently implemented; approved specs determine intended
   behaviour.** If a doc's description of the game (or a number) disagrees with the code, the code
   is what's built: fix the description. If an approved rule disagrees with the code, that's a
   discrepancy: flag it in [decisions.md](decisions.md#conflicts-to-resolve), don't silently pick one.
2. **For a subject, its subsystem file is the authority** (tables below). Index files
   ([design.md](design.md), [world-spec.md](world-spec.md)) only summarise and point.
3. **Player-facing behaviour** is in `design/`; **how the walkable world is built underneath**
   (units, objects, placement, saves, drawing) is in `world/`. Where they overlap on the walkable
   Labyrinth, `world/` wins for anything placed or saved, and its "as built" sections win over the
   requirements written before them (⚠️ notes mark the places).
4. [decisions.md](decisions.md) is the register of key decisions; the file it links to holds the
   rule. [roadmap.md](roadmap.md) is the only list of what's not built.
5. **Never authoritative:** [history.md](history.md) and [archive/](archive/) (old wording, kept for
   the record), and [ideas/](ideas/) (sketches and references). Something found only there is not a
   requirement.
6. [CLAUDE.md](../CLAUDE.md) holds the working rules (hard rules, git, commands, conventions);
   [README.md](../README.md) at the top is for the human (setup, running, the two computers).

## The game design (`design/`)

| Subject | File |
|---|---|
| Core idea, barcodes, scanning, the altar, the camera | [design/scanning.md](design/scanning.md) |
| Stat rolling, gear, materials, consumables, bags, schematics | [design/items.md](design/items.md) |
| Creatures, cards, cages, soul stones, levels, XP | [design/creatures.md](design/creatures.md) |
| Combat rules, moves, codexes, races | [design/combat.md](design/combat.md) |
| Labyrinth runs: entrance, dungeons, party, fees, room mixes, merchants, the haul, bosses, enemies | [design/labyrinth.md](design/labyrinth.md) |
| Walkable runs: walking, the scroll, foes, fights, loot, cages, campfires, light, decor, art | [design/walkable-play.md](design/walkable-play.md) |
| Walkable layouts: rooms, tunnels, choices, guided rolling, the size rule, pillars | [design/walkable-layout.md](design/walkable-layout.md) |
| Klutz | [design/klutz.md](design/klutz.md) |
| The Den, save slots, the tavern questline, visitors, pits, the collector, daily quests | [design/den.md](design/den.md) |
| UI standards | [design/ui.md](design/ui.md) |
| Art style and PixelLab | [design/art.md](design/art.md) |
| Online: accounts, cloud saves, the global registry, leaderboards, PvP | [design/online.md](design/online.md) |

## The walkable world's technical spec (`world/`)

| Subject | File |
|---|---|
| Principles, units, panels and subcells, coordinates, measurements, creature size classes | [world/space.md](world/space.md) |
| Object definitions, instances, sizes | [world/objects.md](world/objects.md) |
| Camera, projection, anchors, drawing order | [world/rendering.md](world/rendering.md) |
| Occupancy, reservations, placement passes, movement, candles and torches, NPCs; **as built by version** | [world/placement.md](world/placement.md) |
| Art spec, palette, templates, checks, approval | [world/art-pipeline.md](world/art-pipeline.md) |
| Saves, migration, forward compatibility, fixtures, goldens; **the world versions table** | [world/persistence.md](world/persistence.md) |

## Finding things

- **By code name:** grep the constant or function across `docs/` (`grep -rn SCONCE_EVERY docs/design docs/world`).
- **By an old reference** in a code comment ("design.md §7", "world-spec.md §5.4"): the index files
  map each § to its file, and the files keep their § headings. "world-spec.md §8 …" (the phases)
  is in [archive/2026-11-09/world-spec.md](archive/2026-11-09/world-spec.md); its current results
  are in the "as built" sections of `world/placement.md` and `world/persistence.md`.
- **By heading:** `grep -n "^#" docs/design/<file>.md` lists a file's sections.

## Status tags

- ✅ **Built**: in the game now.
- 📌 **Decided**: the user has agreed it, but it isn't built (or only partly).
- 🧪 **Provisional**: built, but with numbers Claude picked as a default or that are still being
  balanced. Fine to tune, but say so.
- ❓ **Open**: the user hasn't decided. Ask; don't pick.
- ⏸ **Shelved** / ✗ **Dropped**: set aside for now, or cut by the user. Don't build unasked.
- 🚧 **In progress**: partly built.
- ⚠️ **Note**: the passage around it is older than a later rule, or conflicts with another; the
  note says which wins or points to [decisions.md](decisions.md#conflicts-to-resolve).

Ideas the user floated but never confirmed are listed as ❓, not as decisions.

## Keeping the docs right

- Update a decision **in place** in its subsystem file. No dated rounds of changes; move long
  superseded passages to [history.md](history.md).
- When a change is built, update its file (and take it out of [roadmap.md](roadmap.md)). A decision
  that shapes saves, architecture or a settled system also gets a line in
  [decisions.md](decisions.md).
- For the walkable world, write what the code now does in the "as built" sections; design proposals
  and approval gates go in the commit message or [history.md](history.md), not in the spec.
- Keep each file to one subject. If one grows past about 30 KB, split it by subject.
- The archive is never edited.
