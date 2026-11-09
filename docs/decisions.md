# Key decisions

The decisions that shape the game's structure, saves and settled systems: what was decided, why,
its status, and where the full rule lives. **The linked file is authoritative**; this is the
register. Smaller decisions live only in their subsystem file. Add an entry when a decision of this
weight is made, and update its status in place. (Started 2026-11-09 from design.md, world-spec.md
and CLAUDE.md; nothing here is new.)

Status: ✅ built and in force · 📌 decided, not (fully) built · 🧪 in force, numbers provisional ·
⏸ shelved · ✗ reversed.

## The game and its platform

| # | Decision | Why | Status | Rule |
|---|---|---|---|---|
| 1 | Plays offline; online features are extra. One backend only: the game's own Supabase project (plus Google sign-in, and Resend once there's a domain). All Supabase calls behind one module. | Players without a connection still play; tests and builds need no internet | ✅ (2026-10-31) | [CLAUDE.md](../CLAUDE.md) rule 1, [design/online.md](design/online.md) |
| 2 | Saves stay compatible: storage keys never renamed without a reader for the old data; new fields optional with defaults; `SAVE_FILE_VERSION` bumped only with a reader | Saves are the players' progress | ✅ | [CLAUDE.md](../CLAUDE.md) rule 2, `lib/save.ts`, `lib/saveFile.ts` |
| 3 | A one-off fresh start for Combat V2: save keys moved, pre-V2 saves left unread and pre-V2 files refused | The user's call, 2026-10-26; not to be repeated unasked | ✅ | [history.md](history.md) |
| 4 | Mobile-first, one fixed phone-sized screen; fixed structure with text fitted to it; few words, depth behind "?" | Polish and touch use | ✅ settled | [design/ui.md](design/ui.md) |
| 5 | Art from PixelLab only; samples first, the user's approval before a rollout; never hand-drawn detailed sprites in code; the user's own art is restyled, keeping their design | Hand-drawn code sprites were tried and scrapped | ✅ | [design/art.md](design/art.md) |

## Scanning, items and creatures

| # | Decision | Why | Status | Rule |
|---|---|---|---|---|
| 6 | The barcode number never decides the outcome: the first-ever scan rolls it and registers it; later scanners get the same outcome with their own stat roll | Fairness, and "being first" means something | ✅ | [design/scanning.md](design/scanning.md) §2 |
| 7 | A global registry rolled on the server, from a copy of the game's rules (`npm run registry:rules` after changing them) | Being first works between players | ✅ (2026-10-31) | [design/online.md](design/online.md) §12 |
| 8 | Stat rolling: rarity weights 40/30/20/9/1, budgets 60–150, the chunked roller. Never changed unasked | The user's most carefully balanced system | ✅ locked by tests | [design/items.md](design/items.md) §3 |
| 9 | Armour pieces roll the whole budget; defence counts at a third; a piece rolls ⅓ of its armour's HP ceiling | Armour mustn't look weak next to weapons | ✅ (HP share 🧪) | [design/items.md](design/items.md) §3 |
| 10 | Soul stones replaced the old abilities | The user's spec, 2026-10-25 | ✅ | [design/creatures.md](design/creatures.md) §4 |

## Combat

| # | Decision | Why | Status | Rule |
|---|---|---|---|---|
| 11 | Combat V2: 7 races replace the class triangle and damage types; magic stays a third style | Team building and matchups over raw rarity | ✅ (2026-10-26), multipliers 🧪 | [design/combat.md](design/combat.md) §6 |
| 12 | Agility only decides who strikes first | Players judge how much to invest; don't "fix" it | ✅ | [design/combat.md](design/combat.md) §6 |
| 13 | No resting: every move set keeps a steady move (≤ 30 energy, no cooldown) | A creature can always attack | ✅ | [design/combat.md](design/combat.md) §6 |
| 14 | PvP: the inviting player's browser runs the fight; Supabase Realtime only, no duel tables | Two browsers must agree; simplest that works | ✅ built, not yet tried by two players | [design/online.md](design/online.md) §12 |

## Runs and accounts

| # | Decision | Why | Status | Rule |
|---|---|---|---|---|
| 15 | Everyone comes home at full health (`HEAL_AT_HOME`) | Decided by the user, 2026-10-20 | ✅ (see conflict 9) | [design/labyrinth.md](design/labyrinth.md) §7 |
| 16 | Mystery rooms stay high risk, high reward | Don't soften them | ✅ | [design/labyrinth.md](design/labyrinth.md) §7 |
| 17 | Online: sign in with Google, one save per account, the cloud wins (the device's copy kept as the backup), one game at a time | Saves follow players between devices without questions | ✅ | [design/online.md](design/online.md) §12 |

## The walkable world

| # | Decision | Why | Status | Rule |
|---|---|---|---|---|
| 18 | The explorable Labyrinth is 2D three-quarter top-down, in the current web game (no engine switch), with procedural randomness kept | The user, 2026-11-05 | ✅ live as "New" runs | [design/walkable-play.md](design/walkable-play.md) |
| 19 | Four layers: world data, simulation, a pure scene builder and one shared projection, and a renderer with no game rules. Gameplay never depends on the camera | A new renderer (or 3D one day) could draw the same world; art and logic stop drifting apart | ✅ (2026-11-07) | [world/space.md](world/space.md) §1 |
| 20 | Fixed three-quarter camera from the south, no rotation. D (floor depth) for new art is decided in phase 3 from two in-game comparisons | The user's sign-off, 2026-11-07 | ✅ camera; ❓ D | [world/rendering.md](world/rendering.md) §4 |
| 21 | A panel (1 u) is exactly 3 × 3 subcells: layout in panels, sizes and placement in subcells, **walking on panels until the user decides** | Fine placement without changing how the game plays | ✅ | [world/space.md](world/space.md) §2 |
| 22 | Footprint, clearance, height, visual bounds and interaction access are separate properties; gameplay never reads the visual ones | Art can change without moving gameplay | ✅ | [world/space.md](world/space.md) §2 |
| 23 | Physical and navigation occupancy are separate maps; "a panel is blocked if any subcell is solid" and "one solid thing a panel" are temporary policies (`lib/world/policy.ts`) | Finer movement later changes only the policies | ✅ | [world/placement.md](world/placement.md) §5.1 |
| 24 | Pillars stay rock in the layout; the placer sees them through the same occupancy rules | No special case; a breakable pillar would later become an instance | ✅ | [world/placement.md](world/placement.md) |
| 25 | What a run places is saved in it, with a world version. **From v3 each version is a new generator for new runs only; a run keeps the rules it was made with for good.** Pin a version before changing placement rules | Changing code never moves things in a run under way | ✅ (now v8) | [world/persistence.md](world/persistence.md#world-versions) |
| 26 | Separate random numbers per room and per placement pass, from (run seed, room, pass) | Changing one pass never moves anything else | ✅ | [world/placement.md](world/placement.md) §5.3 |
| 27 | Migrations are idempotent and never touch run state; one way in (`openWalkSave`, `placedRun`); damaged runs are held, mended only when the player asks | An old run must load months later, and nothing is silently regenerated | ✅ | [world/persistence.md](world/persistence.md) |
| 28 | The v0 converter (`lib/world/compat/v0.ts`) is isolated, frozen and has no time limit; removed only on evidence no supported save needs it, or the user's explicit decision recorded with its date | Backward compatibility mustn't become long-term upkeep | ✅ (see conflict 8) | [world/persistence.md](world/persistence.md) §7 |
| 29 | An older client never overwrites newer world state: it holds a newer run untouched and saves only the rest | Two computers, offline copies and stale tabs | ✅ | [world/persistence.md](world/persistence.md) §7 |
| 30 | A run with no `dungeon` field is the Cyclops's, never the Encampment's | How runs have always been read | ✅ | [world/persistence.md](world/persistence.md) §7 |
| 31 | Goldens are re-recorded only for a change the user approved, in its own "Intended change:" commit; any other difference is a regression | Tests pin behaviour, not whatever the code does | ✅ | [world/persistence.md](world/persistence.md) |
| 32 | Mounted lights by each room's darkness (v5); since v8 they are wall torches, never wall candles, never on south faces; floor candles are decorative and light by walking near | The user, 2026-11-08 and 2026-11-09 | ✅ numbers 🧪 | [world/placement.md](world/placement.md#candles-and-extra-torches-world-versions-58) |
| 33 | Art standard: the user's reference image is a target, not a source (an original palette); checks report and never "fix" art; approval is always in the game; the walls are kit E's look at 48 art pixels a unit | Rights, and consistency across hundreds of assets | 🚧 partly built | [world/art-pipeline.md](world/art-pipeline.md) |
| 34 | Walkable layouts are rolled guided, with backtracking; the Encampment and the Cyclops use 2-tile blocks; a new dungeon's size follows the bench rule (≥ 4 across; route × across ÷ rooms ≤ 1.33) | Smaller rooms are more fun to explore; big layouts must roll fast | ✅ (2026-11-09) | [design/walkable-layout.md](design/walkable-layout.md) |

**The sign-off decisions** (world-spec §10, the user, 2026-11-07), word for word:

1. **Floor depth for new art:** decided in phase 3 from two proper in-game comparisons (§4.6).
2. **Creature sizes:** classes set in phase 1 from intended physical proportions, with sprites as
   a reference only; individual sizes where a class doesn't fit (§2).
3. **New placements may differ from the old generator's** for the same seed; saved runs stay
   compatible; the new generator must be deterministic, keep paths valid and keep the balance (§8).
4. **The palette:** the reference is the target, not a source; an original palette (§6.1).
5. **Order:** 0 → 1 → 2 → 3 → 4, with the art's geometry explored alongside phase 2 (§8).
6. **Old runs:** placements saved once from phase 1; legacy placers kept only until a sunset (§7).
7. **Panels and subcells** (the user, 2026-11-07): a panel (the floor tile, 1 u) is exactly 3 × 3
   subcells. Rooms and corridors are generated in panels; physical sizes, placement and
   occupancy use subcells (from phase 2b; the save format from 2a); walking stays on panels
   until the user decides otherwise (§2, §5). Physical and navigation occupancy are separate,
   the whole-panel blocking rule is interim, legacy panel reservations are kept apart from
   physical size, and creature sizes are examples, with no multi-panel creature movement in 2b.

## Conflicts to resolve

Found while restructuring the docs on 2026-11-09. Each was left as it stands, with a ⚠️ note where
it could mislead, for the user to decide. Remove an entry once it's settled (and fix the file).

1. **Walkable art before the standard.** [design/art.md](design/art.md) §11 says "until [the art
   standard is] agreed, don't make more walkable-world art", but kit E and kit F walls, the round-3
   torch and the candle cluster were made and put in the game (2026-11-09), and the palette and
   checker exist. Is the standard agreed enough to make walkable art, and is that line still in
   force?
2. **Art density: 32 or 48.** [world/art-pipeline.md](world/art-pipeline.md) §6.1 (and the stage B
   sprite notes) say 32 art pixels a unit; §6.3 says new art is 48 since kit E (you and older
   objects stay 32). Is 48 the standard for every new walkable asset, so §6.1 should say 48?
3. **Stage B's leftover steps.** B2 (drawing mounted candles: mount points, sort order, the south
   fade), B3 (their sprites) and B4 (a visual density comparison) were never done, and v8 replaced
   wall candles with wall torches. Are B2–B4 dropped, or do they now apply to the extra torches?
4. **"Labyrinth look: a top-down voxel style is the likely long-term direction"** (❓ in
   [design/labyrinth.md](design/labyrinth.md) §7) against the decided 2D three-quarter view
   (decisions 18–20). Drop the voxel line?
5. **The palette's source.** Phase 3's text (archive §8) says "palette (from the reference, with
   the user's OK)"; §6.1 and sign-off decision 4 say the reference is a target, not a source. The
   palette as built comes from kit E's walls. The roadmap follows §6.1; confirm.
6. **The walkable Cyclops's size.** [design/walkable-play.md](design/walkable-play.md) step 7 says
   "its size is open" (`WALK_LABYRINTH` 30 rooms, 10 to the lair, "for now"), written before
   guided rolling made bigger layouts quick. Still open, or is 30 / 10 settled?
7. **Stale status tags** (facts in other sections say these are built): the Crooked Bookcase change
   is 📌 in [design/items.md](design/items.md) §3 but built per [design/den.md](design/den.md) §9
   step 8; "Tavern … Not built" in §9, where its outside and repair are built (the interior isn't);
   the questline heading says "stages 1–8 built" while stage 9 is built too; the walkable overview
   says it all "stays behind `/lab`" while it's live. Fine to update these tags?
8. **When the v0 converter may go.** Sign-off decision 6 and the old design.md §13 speak of "a
   sunset after phase 2"; world §7 says "no time limit", removal only on evidence or the user's
   explicit decision. Read together: no sunset date, only those two triggers. Confirm.
9. **`HEAL_AT_HOME`: testing switch or decision?** [design/labyrinth.md](design/labyrinth.md) §7
   calls it "🧪 for testing … set it to `false` to bring the pool back", and right after "✅
   Decided: healing after death stays as it is now". Is coming home at full health the design, or
   still a testing shortcut?
10. **Creature footprints: two tables.** [world/space.md](world/space.md) §2 has the 🧪 phase-2b
    proposal (large 4 × 4 to 6 × 6, huge 7 × 7 to 9 × 9); [world/objects.md](world/objects.md) §3
    has what the user set on 2026-11-08 (large 5 × 5, huge 8 × 8). The second is the decision;
    fine to mark the first as superseded?
11. **Phase 1's last check.** Its "done when" asked the user to play a run in each dungeon and
    confirm it looked and played as before; the docs don't record that. Nothing to do unless you
    remember otherwise.
