# UI philosophy

Authoritative for the settled UI standards (follow them). Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 10. UI philosophy (settled; follow it)

- **Mobile-first**, for iOS/Android later. Touch only: tap targets of 44px or more, no hover-only
  information, safe areas.
- **One fixed phone-sized screen** (`components/GameScreen.tsx`). On a laptop: no border, full window height, 9:16 wide, centred. **Screen size** (Settings, `lib/uiScale.ts`, built 2026-10-20): everything inside is laid out smaller and drawn scaled up; per device, a laptop starts at 150% (175% at first, from the user's browser zoom; too big, 2026-11-07), a phone at 100%, or smaller on a short screen so screens fit (`SHORT_SCREENS`: under 640px tall 90%, under 520px 80%, the height taken once as the game loads; the user, 2026-11-14). Not below 80%: text and buttons get too small. Screens should still fit on their own (fix the screen, then the scale is the safety net).
  - The page never grows or shrinks between areas; long lists scroll inside panels.
  - Tabs inside a scrolling screen keep your place down the page when you switch (the user, 2026-11-24; hooks/useScrollKeep.ts:
    the Storehouse, the Pit, Klutz's Den, whose tabs also stick to the top as you scroll).
  - Actions sit in docks built into the screen, not floating buttons.
  - In battle, the moves fill the bottom ~30% of the screen. Above them, a one-on-one fight's room
    fills the whole stage (the code-drawn room's ceiling and floor carry on, `extend` in
    `lib/dungeon/chamber.ts`); there's no row of who's left (Swap shows your bench).
  - Labyrinth rooms have no frame: edge to edge, the floor fading into the screen.
  - On a laptop, Esc closes whatever's open (`hooks/useEscape.ts`); with nothing open it goes back
    a page (`components/EscapeBack.tsx`), except mid-fight in the Labyrinth.
- **Vibration** (Settings, `lib/haptics.ts`, built 2026-10-24): off by default, per device. When it's on, hits that land buzz briefly, and precise hits and level-ups buzz harder. It only works in browsers that allow vibration (Android, not iPhone), and the switch is hidden elsewhere.
- **Double tap** (`lib/doubleTap.ts`, built 2026-10-24): a quick second tap on the same thing does its main button. In a creature's Equip picker it equips the piece (or unequips, on ⊘); in the loot window it takes the item.
- **Few words.** One-line summaries on screen, and depth behind a "?" (`components/Help.tsx`) in
  big, bold, broken-up text. Klutz's lines are short.
- **Torchlit Stone** (the UI overhaul, the user, 2026-11-17; drafts on the design canvas
  https://claude.ai/artifact/Dx8wgJXtLRvz1Be7hcXnXF): carved bronze main buttons (`.pixel-btn`), stone
  tabs that turn brass when picked (`.chip`, `.dock-tab`), a dark header and dock with a brass trim,
  each screen's title on a brass plaque and the way back a small stone button (`.screen-title`,
  `.screen-back`), brass rivets on the big panels (`.inv-panel`), warm torchlight from above, and
  the creature window's stage lit in the creature's rarity colour. The quest board's campaign and
  today's quests are parchment notes pinned to a wooden board (a chapter's last quest, and the Hydra
  quest, a Wanted poster), and creatures (the Pit's Creatures tab) stand three a row (the Storehouse's gear four: the user, 2026-11-20) on a glow of their
  rarity, with no boxes round them, their races or the grid (the user, 2026-11-17: the words need the room). The Bestiary's creatures too stand on their rarity's glow fading into the panel, with no square round them (the user, 2026-11-27). A creature card (the user, 2026-11-24): the teams it's in top left (T1…), what it wears top right (⚔️ 🛡️), the creature, then its level, then its name; no race or type words. Its window shows the attack style its multipliers favour (`preferredStyles`: "Melee", or two as "Melee - Magic") in place of the type words (Bruiser, Hybrid…). A tapped codex (the bookcase, a creature's Moves tab) opens in a window floating over the page (components/CodexWindow.tsx), with ‹ › on the screen's sides where its middle third meets its bottom third (components/SideArrow.tsx: drawn pixel chevrons on brass buttons, kept off the middle of the window, as on a creature's window; press and hold either to lift both and drag them up or down, the spot kept per device in lib/sideArrow.ts; the user, 2026-11-26), ← → or a sideways swipe for the next; teaching from the bookcase happens in it too; codexes, schematics and soul stones show their own art everywhere, not emoji. Muted, adventurous colours: leather, brass and parchment, never neon. The Labyrinth entrance shows the
  dungeon picked as a showcase (its boss in its own light on a cave backdrop: a shadow for the camp's
  chief and the Warden, who are different every time), with a medallion per dungeon under it to pick
  one, and your creatures in a panel that scrolls inside itself so the screen fits. A medallion is its boss's head
  (components/DungeonHead.tsx; the Encampment's the Baby Cyclops, the Abyss's a shadow), and it stands for its
  dungeon wherever one's named in place of an emoji: Klutz's trips and where he's exploring (the user, 2026-11-27).
- **The stone card standard:**
  - #23262f stone with pixel bevels and a thin rarity-coloured trim;
  - the pixel font in yellow #f1d9a0, and sunken wells for text;
  - **One stat order everywhere** (the user, 2026-11-26): Melee, Ranged, Magic, Agility, then Melee Def, Ranged Def,
    Magic Def, HP: the creature window, cards, the Bestiary, the level-up, the Soul Altar, fights' stat lines, foe cards,
    Klutz's points (his points left where HP would be). Gear lists keep it, skipping what gear hasn't got (`STATS`, components/CreatureDetailModal.tsx).
  - `.inv-panel` for anything holding loot or creatures; your own bag beside a chest's gets a gilded frame (`.inv-mine`) and
    slots as wide as the chest's things (the user, 2026-11-26: the haul's bag was smaller than everything round it);
  - Colour carries **race** (`RACE_INFO`: Beast green, Humanoid blue…; Neutral slate grey); the
    three styles share one neutral cream, so they don't clash.
- **Fixed structure, text fits it** (the user, 2026-10-19: "the text around the box should move as
  that is the variable, not the constant"). Windows are a standard frame of fixed boxes; flicking
  through items or creatures changes only the contents. Varying text gets a fixed number of lines
  (clamped), and absent parts keep their space. This is what makes the game feel polished.
  - **Text budgets** (lib/uiText.ts, checked by tests/uiText.test.ts): a card's name gets two lines
    of at most 14 letters (`CARD_NAME_LINE`), a move tablet's two lines of 12 (`MOVE_NAME_LINE`).
    New creature and move names must fit: write them shorter rather than growing the box.
  - **Move text everywhere it's shown** (the user, 2026-11-14: names were split on narrow tablets,
    and descriptions didn't fit the tablet's back). On a narrow tablet (the battle dock, Klutz's
    tour) the name runs under the i's and the cost's corners (`NAME_INSET`) and shrinks so its
    longest word fits, never below 10px (`NAME_MIN_PX`). Klutz's tour shows two tablets a row. The
    i opens one fixed details window over the screen (MoveTile's `MoveDetails`) instead of flipping
    the tablet; a description gets at most 7 lines of 38 letters there (`DESC_LINE`, `DESC_LINES`),
    with 3 lines kept for a fight's effect lines. In a fight the words are the button's (the user, 2026-11-26: "this needs to feel like the button"): the
    name sits on the line a third of the way down, filling the box's width up to 27% of the tablet's height (a long
    name shrinks, or takes two lines when that's bigger; `fillNameFont` in lib/uiText.ts), and the move's damage range
    against the foe it's aimed at hangs from the line two thirds down, in the same carved pixel lettering, one size on
    every tablet in the dock (sized for "100–120"; `FILL_DAMAGE_*`)
    ("12–14", no "dmg": its hit at the lowest and highest ±5% roll before their armour and defence %s; the race chart against them counted only in the Encampment and the
    Cyclops' Labyrinth, so new players learn the matchups, and left out past the Cyclops and in PvP (`Match.raceHint`); in the name's cream; the
    user, 2026-11-26: raw damage before the foe's defences take their share; `damageRange`, components/BattleScreen.tsx), unless a note (no energy, recharging) needs the line. tests/uiText.test.ts checks every move at every
    place in `TABLET_PLACES` (a 360 × 640 phone); `/lab/movetext` measures the same in a browser and
    the estimates against the real fonts (re-run it after changing the font or a tablet's layout).
  - Built this way (2026-10-26): cards (the name box is always two lines tall), move tablets (name
    box plus one tag/note line, kept when empty), the item window (one fixed size; the ←/→ row
    kept), the creature window's gear picker (a 3×3 grid that scrolls inside itself past 9 pieces, so the Equip button and the stat list below stay put; under it the picked piece's name, five fixed stat boxes in the Stats list's icons and colours with ▲/▼ against what's worn, set and owner lines; no Cancel: tap off the picker to close it; the 🔒 line kept), librarian rows
    (two-line descriptions), the battle dock (no Rest tab; the energy line doubles as "X used Y"),
    and the loot window (one fixed "closer look" box for whatever you tap, chest or bag, its buttons
    in one row that scrolls sideways; the chest's rows never shrink while it's open). With nothing
    tapped the box is gone and the one-line hint under the chest does the job, so the window fits
    without scrolling (the user's call: the bag moves down when you tap something).
  - Bags (2026-10-28): every view draws all `BAG_MAX` (10) slots in rows of 5 (`BAG_COLS`), the
    ones you haven't unlocked yet greyed out with a 🔒, so bindle and backpack share one layout.
  - The creature window's set line follows the armour slot you tap (that piece's set and how
    many of it you wear), instead of always the set you wear most of.
- Creature lists (Chest, Pit) sort highest level first by default (the user, 2026-11-14: the ones
  they've invested in), rarest breaking ties; Rarity, Class, Race, Name and Newest are in the sort
  menu. The card gallery has no levels, so it starts on Rarity.
- One tap on a Den object goes in (no name-first double tap).
