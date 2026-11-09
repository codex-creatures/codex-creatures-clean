# Codex Creatures: game design (index)

The agreed design **as it stands now**, split into one file per subsystem (2026-11-09). Each file
keeps the decisions in their current form, with short reasons, and what was tried and rejected so
it isn't proposed again. **The code is the truth for numbers:** if a design file and a constant
disagree, trust the code and fix the file. Constants are named in `code font` so you can grep for
them. Status tags (✅ built, 📌 decided, 🧪 provisional, ❓ open, ⏸ shelved, ✗ dropped) are
explained in [README.md](README.md#status-tags).

Change rounds, superseded plans and old sims are in [history.md](history.md); this file as it was
before the split is in [archive/2026-11-09/design.md](archive/2026-11-09/design.md). Neither is
needed for normal work.

## Where each section went

Section numbers are kept inside the files, so "design.md §N" in code comments still finds its place.

| § | Subject | File |
|---|---|---|
| 1–2 | Core idea; barcodes, scanning, the altar, the camera | [design/scanning.md](design/scanning.md) |
| 3 | Items: stat rolling (the user's most carefully balanced system), gear, materials, bags, schematics | [design/items.md](design/items.md) |
| 4–5 | Creatures, cards, cages, soul stones; levels and XP | [design/creatures.md](design/creatures.md) |
| 6 | Combat: rules, moves, codexes, Combat V2 races | [design/combat.md](design/combat.md) |
| 7 | The Labyrinth: entrance, dungeons, party, fees, rooms, merchants, the haul, bosses, enemies | [design/labyrinth.md](design/labyrinth.md) |
| 7 (walkable) | The explorable Labyrinth ("New" runs): walking, the scroll, foes, loot, light, art | [design/walkable-play.md](design/walkable-play.md) |
| 7 (walkable) | Its layout generation: rooms, tunnels, guided rolling, size rule, pillars | [design/walkable-layout.md](design/walkable-layout.md) |
| 8 | Klutz | [design/klutz.md](design/klutz.md) |
| 9 | The Den and economy: save slots, the tavern questline, visitors, pits, the collector, daily quests | [design/den.md](design/den.md) |
| 10 | UI philosophy (settled; follow it) | [design/ui.md](design/ui.md) |
| 11 | Art and PixelLab | [design/art.md](design/art.md) |
| 12 | Online: accounts, cloud saves, the global registry, leaderboards, PvP | [design/online.md](design/online.md) |
| 13 | The explorable world's architecture | [world-spec.md](world-spec.md) (the index of the world specification) |

Cross-cutting: [decisions.md](decisions.md) (the key decisions, why, and conflicts awaiting the
user) and [roadmap.md](roadmap.md) (everything decided but not built, open, shelved or dropped).

## Where things stand (2026-10-26)

> ⚠️ Kept word for word from the old design.md. It predates the walkable Labyrinth, the world
> architecture and most of the online work (now built). For what's planned or open now, use
> [roadmap.md](roadmap.md); for what's recent, `git log`.

- **Live:** Combat V2 (7 races, 35 creatures, race kits, codexes for the rest of a creature's kit),
  soul stones, the Labyrinth / Deep Labyrinth / Abyss, Klutz and his hunts, the tavern questline
  (stages 1–9), save slots, Vercel hosting.
- **Recent changes:** see `git log` (the commit messages say what changed for the player).
- **Next (📌, decided, not built):** the onboarding scan gate (§2, later), more soul stones and
  effects (§4, §6), the tavern's interior (§9). Visual work comes first (the user, 2026-11-04):
  the fighters on a diagonal, and the Hydra's own art.
- **Dropped (the user, 2026-11-04):** the merchant's gear wares and armour priced like weapons
  (armour comes at the right rate as it is), the barcode merchant (the tavern has enough), the
  Cyclops's Meditate heal (its strength is right). The re-entry cooldown is set aside: the gold
  fee does the job for now.
- **Going online (📌, 2026-10-31):** accounts, cloud saves, the global registry, leaderboards and
  live PvP, over about 3 weeks (§12).
- **Open (❓, the user's call):** what Klutz gets in place of his old counter bonus; agility doing
  more; race-move rules beyond the kits; shared barcode lists once there's a global registry;
  longer Klutz walks; a creature trader.

## Keeping these files right

- Update a decision **in place**, in its subsystem file, when it changes. Don't add dated rounds;
  move long superseded passages to [history.md](history.md).
- A new decision of lasting weight (it shapes saves, architecture or a settled system) also gets an
  entry in [decisions.md](decisions.md). Something decided but not built goes in
  [roadmap.md](roadmap.md) too, and comes out when it's built.
- Ideas the user floated but never confirmed are ❓, never decisions.
