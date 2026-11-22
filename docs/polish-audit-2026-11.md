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

### Timings, before and after

TODO

### What to check on a phone

TODO

## 2. Inconsistencies

TODO

## 3. Bugs

TODO

## Left for the user (options)

TODO

## UI noticed along the way (not changed)

TODO
