# Polish audit, 2026-11-23 (overnight)

A dated report, like [balance-audit-2026-11.md](balance-audit-2026-11.md): findings, what was fixed, and
what's left for the user with options. **Not a spec.** Nothing here is a decision until the user makes it.

The brief (the user, 2026-11-23): an unattended polish pass in three areas, in this order: (1) the Den
is slow to open and close things, (2) inconsistencies between places where you can do the same thing,
(3) real bugs, PvP first, then combat. One fix a commit, each proved first; nothing pushed.

> The brief arrived with some characters missing from the middle of its lines. Its meaning was clear
> everywhere that mattered; where a line could be read two ways, the reading taken is noted beside
> the finding it affected.

## 1. The Den: opening and closing things

### How it was measured

- A scratch copy of the game (`git archive`, built as the static site, served on a scratch port), in
  headless Edge with its own scratch profile: never the dev server, :8123, the Vercel site or a phone.
- A phone-sized window (390 × 844, 2× pixels), the processor slowed 4× (Chrome's own throttle), a
  mid-game save made for the test: 320 things in the inventory, both rooms of the Den open, the
  tavern repaired, Klutz home.
- **Tap to screen ready:** from the finger lifting to the frame after the new screen is fully there.
  For the Storehouse: its title, its items and their pictures. For the Den: its room drawn (not just
  the black canvas) with its names placed.
- 5 runs each; the median is quoted. Unslowed numbers are this laptop's (Intel Iris Xe).

### Where the time went

Not in the pages, the save or the network: **in how the Den's props were drawn.**

1. **Every face of every prop was its own drawing.** The Den's places are built from recipes
   (lib/props/recipes: the pool alone is 926 faces), and each face was drawn as a separate mesh with
   its own material, its own four buffers on the graphics card and its own per-frame callback. With
   both rooms open that was **3,505 drawings a frame**, 13,900 buffers made every time the Den
   opened, and 3,500 callbacks a frame. Three things followed:
   - **The Den itself ran slowly**: 50 to 83 ms a frame on this laptop unslowed (12 to 20 frames a
     second), so about 450 ms a frame slowed 4×.
   - **Opening a place waited behind those frames.** The tap starts loading the next screen in the
     background, a few milliseconds at a time between frames. With frames that long it got about a
     twentieth of the processor, so a screen that takes a tenth of a second to build took seconds
     to appear. Then leaving the Den had to throw all 13,900 buffers away (0.57 s unslowed in one
     go, plus 0.4 s unhooking the 3,500 callbacks).
   - **Coming back built it all again**: 3,500 materials and meshes, 13,900 buffers sent to the
     graphics card (the 1.3 s the profile shows as "shader linking" was the card catching up on
     them), 0.37 s hooking the callbacks back up.

   **Fixed** (commit "The Den's props are drawn a few drawings each"): a prop's faces that share a
   picture are gathered into one drawing (lib/props/batch.ts). 3,505 drawings a frame became 121;
   13,900 buffers became 474; frames on this laptop went from 50–83 ms to 17 ms (a steady 60 a
   second). Checked by picture: all 28 recipes in the review lab under two lights, before and after,
   compared pixel by pixel: 53 of 56 pictures identical, the other 4 differ by one or two pixels on
   an edge (the cabin and the pit). The Den's own pictures differ only where a "❗" name tag was
   mid-pulse.

2. **The Den's light was worked out from scratch 15 times a second.** Some 20 lights, each
   walking a line to every spot it might reach across the whole Den, though the lights never move:
   only their strength flickers. After fix 1 that was over half of what the Den did each frame
   (about 8 ms of every 66 on this laptop, so about a third of a slowed phone's time).
   **Fixed** (commit "The Den's lights are traced once"): each light's share is traced once
   (lib/render3d/stone.ts `lightShapes`) and the shares mixed again at each flicker (`mixLights`).
   The same light to six decimal places (tests/stone3d.test.ts); the Labyrinth's light, where your
   torch moves, is untouched.

3. **Every flat 3D material logged two or three warnings as it was made.** `makeFlat`
   (components/Props3D.tsx) handed Three.js a picture, a colour and a side whether or not the
   material had them, and Three.js warns about each one that's undefined: about 60 warnings each
   time the Den opened (150 ms of a slowed phone's time in the profile), and the same for every
   chest, crate, barrel and table made in the Labyrinth's 3D rooms.
   **Fixed** (commit "3D props are made without a stream of warnings"): it hands over only what
   the material has. tests/propMaterials.test.ts.

4. **A tapped place loaded in the gaps between the Den's frames.** Tapping a place starts building
   its screen in the background, a few milliseconds at a time, giving way to anything due to draw.
   The Den draws every frame, so on a slow phone the new screen got a small share of the processor:
   with fix 1 in, the Storehouse's screen took 1.2 to 1.4 s (slowed 4×) just to start showing.
   **Fixed** (commit "The Den stops drawing the moment you tap a place"): the Den holds its last
   picture from the tap until it's left (4 s at most, `LEAVE_MS`, in case the place never opens).
   tests/den3dKept.test.tsx.

5. **Coming home built the whole Den again.** Every visit made a new 3D canvas, compiled its 18
   shader programs, sent every picture and buffer to the graphics card again and laid the scene
   out again; every leaving tore it all down. With fixes 1 to 4 in, that was still nearly all of
   the 2.9 s (slowed 4×) between tapping "← Den" and seeing it.
   **Fixed** (commit "The Den is made once and kept"): the Den's scene is kept for as long as the
   site is open. Going into a place parks it off-screen, hidden and not drawing (checked in the
   browser: 0 drawings a second while away); coming home puts it back, with the game as it is now
   and where things stand read again from the save. If the graphics card drops it while parked
   (a phone short of memory may), it's made afresh next visit. tests/den3dKept.test.tsx.
   *What it costs:* the Den's pictures stay on the graphics card while you're elsewhere (small:
   pixel art, about 120 drawings), and the Labyrinth's 3D view runs beside it rather than instead
   of it. See "What to check on a phone".

6. **Every read of the save walked all of it four times.** `readSave` (lib/save.ts) parses the
   whole save and then runs the four upgrades old saves need (old armour, old tool names, the Gold
   Keys taken back, old gear's enchantment roll), each a walk over everything you own. And the save
   is read a lot: counted in the browser, **26 times coming home to the Den, 11 opening the
   Storehouse, and 18 times every 5 seconds just standing in the Den** (the Den's page asks the
   Labyrinth, the campaign, the daily quests, the Challenge and the tavern for news each time its
   clock ticks). With a mid-game save that was about 200 ms of a slowed phone's time each time you
   came home, a hitch every 5 seconds in the Den, and it grows with what you own.
   **Fixed** (commit "The save is read without walking all of it each time"): a save that came
   through the upgrades unchanged is remembered, and while what's stored is still the same text a
   read is only parsed (about a quarter of the work). A save that still needs an upgrade is walked
   at every read, as before, until the game writes it back. tests/saveRead.test.ts checks every
   upgrade still happens, and that the result is what walking it by hand gives.
   *Not done, for the user to weigh:* the Den's page still **reads** the save 18 times every 5
   seconds (each now a parse only). See "Left for the user".

### Timings, before and after

Tap to screen ready, median of 5, in milliseconds. "Before" is the game as it was at the start of the
night (commit bec9eec); "after" has all six fixes. Both timed the same way, one after the other.

| Processor | Den → Storehouse, before | after | Storehouse → Den, before | after |
|---|---|---|---|---|
| This laptop, unslowed | 1,487 | **148** | 2,654 | **105** |
| Slowed 4× (a mid-range phone, roughly) | 10,814 | **641** | 12,105 | **806** |
| Slowed 6× (an old phone, roughly) | 24,693 | **1,572** | 20,737 | **1,723** |

Step by step, slowed 4× (each row adds to the one above):

| | Den → Storehouse | Storehouse → Den |
|---|---|---|
| As it was | 10,814 | 12,105 |
| 1. Props a few drawings each | 1,814 | 2,895 |
| 2–5. Lights traced once, no warnings, drawing stops on a tap, the Den kept | 833 | 1,107 |
| 6. The save not walked at every read | 641 | 806 |

Other counts, before → after: drawings a frame in the Den 3,505 → 121; a frame on this laptop
50–83 ms → 17 ms (12–20 a second → a steady 60); buffers made on the graphics card each visit
13,900 → 474 the first time and none after; while you're in a place the Den draws nothing (it was
gone before; now it's parked).

The first opening of each place after loading the site is slower than later ones (the "first run"
in the raw results: about twice the median), as its code is read for the first time. That was so
before, too.

### What to check on a phone

A real phone can't be measured from here: slowing a laptop's processor imitates a phone's slower
processor, not its graphics chip, its memory or its browser. So, on your phone, on the Vercel site
after you've pushed:

1. **Den → Storehouse → "← Den", three or four times.** The first time after the page loads may
   take a moment; after that both ways should feel close to instant. If "← Den" is still slow on
   the second and third try, the kept Den isn't being reused: tell me.
2. **The Den itself: drag it about.** It should now be smooth. Before, on this laptop it managed
   12 to 20 frames a second; if it was choppy on your phone, this is the change you'll feel most.
3. **Does everything in the Den look the same?** The props were compared by picture, before and
   after, and matched; but that was one graphics chip. Look at the pool's water, the altar's soup
   and the portal's swirl (they're drawn on their own, as before), and the outlines round things.
4. **Stay in the Den for a minute, then go into the Labyrinth and walk about, then come home.**
   The Den is now kept in memory while you're elsewhere, so the Labyrinth's 3D view runs beside
   it. If the walk stutters more than it did, or the Den comes back black or blank, that's this
   change (a phone short of memory). It remakes itself if the graphics chip drops it, but only
   when you next come home.
5. **Leave the game in the background for a few minutes** (another app), then come back to it
   while it was in the Den, and once while it was in a place. Same thing to look for: a black Den.
6. **Tap a place and immediately try to drag the Den.** It holds still from the tap until the
   place opens (that's the fix); it should never stay frozen (it lets go after 4 seconds).
7. **Move something in the Den** (hold a thing, drag it), go into a place, come back: it should be
   where you put it.

## 2. Inconsistencies

Everything a player can do with a creature or an item, against everywhere they can do it. Read from
the code, each difference checked against the docs for a reason.

### Fixed

1. **The Pit called a box "full" at the size it started.** The Pit's Items list is the Inventory's
   list, but wasn't told which boxes you've built bigger: with a weapons box built up to 75 and 55
   weapons in it, the Pit's tab read "55/50" in red ("Full: sell some to go back into the
   Labyrinth") while the Storehouse and the Inventory showed a plain 55. No reason in the docs.
   **Fixed** (commit "The Pit no longer calls a bigger box full"). tests/pitItems.test.tsx.
## 3. Bugs

TODO

## Left for the user (options)

TODO

## UI noticed along the way (not changed)

TODO
