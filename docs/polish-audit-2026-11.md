# Polish audit, 2026-11-23 (overnight)

A dated report, like [balance-audit-2026-11.md](balance-audit-2026-11.md): findings, what was fixed, and
what's left for the user with options. **Not a spec.** Nothing here is a decision until the user makes it.

The brief (the user, 2026-11-23): an unattended polish pass in three areas, in this order: (1) the Den
is slow to open and close things, (2) inconsistencies between places where you can do the same thing,
(3) real bugs, PvP first, then combat. One fix a commit, each proved first; nothing pushed.

> The brief arrived with some characters missing from the middle of its lines. Its meaning was clear
> everywhere that mattered. The three places it had to be read into: **(a)** "Quick tests … test:all,
> the type check and lint" was taken as CLAUDE.md has it for unattended work: quick tests with each
> fix, then the full run, the type check and lint once at the end (results at the bottom);
> **(b)** the list of things to leave alone was taken as: balance numbers and settled mechanics,
> the scanner, anything that changes what goes in dungeon rooms, the Supabase database, new
> dependencies, PixelLab credits, and the Labyrinth page's golden file (none was touched; the golden
> never came up); **(c)** the last line was taken as asking for this order in the morning: each
> fix, the Den's timings before and after, what to check on your phone, the test results.

## In short

Most important first. Each fix is its own commit on `main`, with a test that failed before it;
**nothing is pushed.**

| # | What was wrong | Fix (commit starts…) |
|---|---|---|
| 1 | The Den drew every face of every prop as its own drawing (3,505 a frame): it ran at 12–20 frames a second on a laptop, and everything opened from it or closing back to it waited on that | "The Den's props are drawn a few drawings each" |
| 2 | Coming home built the whole Den again, every time | "The Den is made once and kept" (and "Coming home from a run…", its follow-up) |
| 3 | A duel that was over didn't tell a player who hadn't heard: a guest could be left waiting, then told it had won a duel it lost | "A duel that's over tells whoever is still playing it" |
| 4 | A guest waiting on the other's replacement lost its turn if one message went missing | "A guest waiting on the other's replacement asks where things are" |
| 5 | Every read of the save walked all of it four times; the Den's page read it 18 times every 5 seconds | "The save is read without walking all of it each time" |
| 6 | A tapped place loaded in the gaps between the Den's frames | "The Den stops drawing the moment you tap a place" |
| 7 | The Den's 20 lights were re-traced 15 times a second | "The Den's lights are traced once" |
| 8 | The Pit called a box built bigger "full" at 50 | "The Pit no longer calls a bigger box full" |
| 9 | An XP scroll couldn't be read to Klutz from the Pit | "An XP scroll can be read to Klutz from the Pit too" |
| 10 | Every flat 3D material logged two or three warnings as it was made | "3D props are made without a stream of warnings" |

**Den → Storehouse → Den, on a phone-sized window with the processor slowed 4×:** 10.8 s and
12.1 s before; **0.64 s and 0.81 s** after. Unslowed: 1.5 s and 2.7 s before; 0.15 s and 0.11 s
after. Full table in section 1.

**Checked and found sound:** 16,000 battles at random with every move, soul stone, armour set, AI
and boss (section 3): no rule broken. 3,000 duels over a bad connection, after fixes 3 and 4: both
players always end with the same story. Selling prices are the same everywhere.

**For you:** the phone checklist at the end of section 1 (the kept Den is the change to watch),
and options A to K under "Left for the user".

**Also** CLAUDE.md said the walkable world's version was 13; it's 18 (its own commit).

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
   *One thing it broke, found and fixed the same night* (commit "Coming home from a run, you're
   back in the middle of the Den again"): the kept Den noted where its view was a moment after
   it was parked, which was after the Labyrinth's page had forgotten it, so you came home from a
   run to wherever you'd left the view instead of the middle. It now notes it as it's parked.
   Found by driving the scratch copy through a walked run and back; checked the same way.
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
2. **An XP scroll couldn't be read to Klutz from the Pit.** The scroll says on it "Read it to give
   one creature, or Klutz, 100 XP", and from the Inventory or the Storehouse its Read lists Klutz
   first (once he's helping you). The Pit's Items list, the same list, left him out; with no
   creature of your own yet, its Read opened an empty window. No reason in the docs.
   **Fixed** (commit "An XP scroll can be read to Klutz from the Pit too"). tests/pitItems.test.tsx.

### What can be done where (as built)

| | Den: Storehouse / Inventory | Den: the Pit | Den: Bookcase | A run: the bag (between rooms, by a campfire, a merchant's or librarian's room) | A run: an open chest or sack | A battle | Klutz's page | PvP portal |
|---|---|---|---|---|---|---|---|---|
| **Look at a creature** (stats, gear, moves) | yes (Inventory's Creatures) | yes | no | no: the Party sheet only reorders | no | the cards of who you're fighting; not your own | Klutz's own window | no: tapping one adds or removes it |
| **Look at an item** | its window | its window | a codex's box | its stats line, Compare | its stats line, Compare | the battle bag's names | the crate: a stats line | - |
| **Equip** | from a creature's window | from a creature's window | - | tap or drag onto a creature | tap or drag, from the chest or the bag | swap a weapon from the battle bag | his own window | - |
| **Take gear off** | yes | yes | - | no | no | no | yes | - |
| **Teach a codex** | from a creature's Moves | from a creature's Moves | Teach (your creatures; not Klutz) | Teach, or drag onto a creature | **no** | no | his Moves (when he's home) | - |
| **Change which 4 moves it uses** | yes | yes | only as part of teaching | only as part of teaching | no | no | yes (when he's home) | - |
| **Read an XP scroll** | Read (creatures and Klutz) | Read (now Klutz too: fix 2) | - | tap or drag | tap or drag, from the chest or the bag | no | his window | - |
| **Heal** | - (the pool, on its own page; Klutz drinks a potion on his page) | - | - | potions, a Revival Elixir | potions, from the chest or the bag | potions, an elixir | a potion | - |
| **Sell** | Sell mode, or one from its window | one from its window (documented: Sell mode stays at the chest) | Sell a codex | to a merchant or librarian only | no | no | the crate: one or all | - |
| **Edit a team** | a creature's window (Labyrinth teams) | a creature's window (Labyrinth teams) | - | reorder the party | - | swap | - | PvP teams only |
| **Set a soul stone** | a creature's window | a creature's window | - | no | no | no | his window | - |

Prices are the same wherever a thing is sold (`merchantOffer` / `crateSellValue` / `codexSellPrice`
all come to one sum): checked, no difference found.

### Differences left as they are, with why

- **Sell mode only at the Storehouse**, one at a time from the Pit: the Pit's own comment says so
  (app/pit/page.tsx). Deliberate.
- **Klutz is taught from his own window, not the Bookcase's Teach**: klutz.md says so ("Klutz reads
  codexes you own from his Equip window → Moves"). Deliberate, though see option C below.
- **No soul stones, taking gear off or re-picking moves during a run**: nothing in the docs either
  way. They read as "you prepare at home", so left; say if any should be possible in a run.
- **Off-style moves, and players gearing up their own creatures**: your notes; not looked at as
  problems.

## 3. Bugs

### PvP duels

Two machines linked in tests (tests/duelFaults.test.ts), with messages lost, late and out of order,
players dropping out at each step and coming back, and both running out of time.

1. **A duel that was over didn't tell a player who hadn't heard.** Once the host's game had
   finished a duel it ignored everything the guest sent except a first "hello", and the guest only
   says hello while joining. So:
   - **the last round's message lost** (a connection blip as the battle ended): the guest stayed in
     the battle, "Waiting for…", for good;
   - **and when the host then left, the guest was told "… is gone. You win!"**, though it had
     lost: both players had won;
   - **a guest that ran out of time picking a team**, or dropped off for 30 seconds and came back,
     was never told it had lost: it stayed on its screen until the host left, then "won";
   - **a host back from 30 seconds away** (the guest had already taken the win) played on against
     nobody, the guest's moves made for it, to a result only the host saw.

   **Fixed** (commit "A duel that's over tells whoever is still playing it"): the host answers
   anything a guest sends after the end with how it ended (the battle as it finished, so the
   guest's screen shows the last round; or who left). A guest that gave the host up as gone
   answers the host's next word with that, and the host has lost, as the rule says. Five tests,
   all failing before.
2. **A guest waiting on the host's replacement said nothing, so a lost message cost it its turn.**
   When only the host's creature is down, the guest waits for the host to send one in, with no
   choice of its own to repeat. If the host's next message was lost, nobody spoke: the guest sat on
   "Waiting…" until the host's own clock ran out 40 seconds later and made the guest's move for it
   (a steady move it didn't choose). If the duel had ended meanwhile, the guest never heard.
   **Fixed** (commit "A guest waiting on the other's replacement asks where things are"): waiting
   with nothing to repeat, the guest asks every 4 seconds and is sent the battle as it is. Two
   tests, failing before.

**Then many duels at random** (tests/duelFaults.test.ts, "many duels over a bad line"): each with
its own dice for the teams, who leads, every choice (any move allowed, swaps, replacements, and now
and then no choice at all so the clock runs out), which messages are lost, how late the rest are (up
to 6 s, so they overtake each other), and drop-outs of up to 20 s. Checked every round: the guest's
battle is the host's, mirrored; at the end: opposite results, the same reason, the same last
picture. **3,000 duels, from 1 message in 10 lost to 1 in 2: all the same for both** once the two
fixes above were in (before them, the first 40 turned up the second bug). The only uneven ending
left is at the door: on the worst lines a guest whose every hello goes unanswered for 20 seconds
gives up ("The duel has gone."), and the host, who saw it arrive, waits out the picking time and is
told it won. 90 of them run in `npm run test:all`; `DUEL_SWEEP=1000` runs the 3,000.

The mirrored view itself: every field that names a side (the two sides, who must replace, the
winner, and each line of the log) is flipped, and nothing in a battle's state fails to survive
being sent (no Infinity or NaN anywhere in it).

   *Still possible, by design of a two-browser duel with no referee (after fix 1):* if the host closes its page
   within about 4 seconds of the battle ending and the guest missed the last message, nobody is
   left to tell the guest, and after 30 seconds it sees "… is gone. You win!". And if neither can
   see the other for 30 seconds, both take the win. See option I.

### Combat generally

**Battles at random, by the thousand** (tests/battleSoak.test.ts): any species at any level with any
four of all 117 moves in the game (one of them steady, as every set has), any soul stone, any full
armour set, any enchantments, sometimes starting hurt; against random choices (any move at any
target it can reach, swaps, potions, elixirs, a weapon from the bag, rests), the plain AI and the
thinking AIs at each level; in plain fights of 1 to 5 a side, ambushes (two on the field), fights
with a turn limit, and each boss by its script. After every round:

- every creature's HP is between 0 and its most, its energy between 0 and 100, every number in the
  battle a real number, no status with less than no time left;
- nobody knocked out in a round acts later in it (unless something brought it back);
- whoever's out between rounds is standing, or a replacement has been asked for and there's
  someone to send;
- no AI ever chooses, or sends in, what the rules don't allow;
- working a round out on a copy never changes the battle as it stood (the duel's host relies on it);
- rounds count up by one and stop at the last (100); every battle ends; it ends once, and the
  winner is the side left standing (or the turn limit, or a draw at the last round).

**RESULT_LINE**

One thing seen while timing it, not a bug: the Labyrinth's foes think at the "hard" level
(32 imagined futures, 8 rounds deep, for every choice they have), worked out the moment you tap
your own move, before anything shows. In an ordinary 3 v 3 that's about 30 ms on this laptop (80 at
worst), so 0.1 to 0.3 s on a slow phone between your tap and the round starting. See option J.

## Left for the user (options)

**From the Den's timings**

- **A. The Den's page reads the whole save 18 times every 5 seconds** (its clock ticks, and each
  thing it shows a "❗" for asks the save afresh: the Labyrinth, the campaign, the daily quests, the
  Challenge, the tavern). Fix 6 made each read about four times cheaper, but they're still reads.
  Options: (1) leave it (it's small now); (2) have the Den's page read the save once per tick and
  hand it round (a contained change to app/page.tsx and the readers it calls); (3) only re-check
  when the save has actually been written (a listener exists: `onSaveWritten`). I'd pick 3.
- **B. The first opening of each place after the site loads is about twice as slow as later ones.**
  The Den already asks for every place's page in the background as it opens (`router.prefetch`).
  What's left is the browser reading that code for the first time. Options: leave it; or warm the
  two or three biggest places (the Labyrinth, the Storehouse) a second or two after the Den
  settles. Not done: it trades battery and data for a first-tap saving, which is your call.

**From the inconsistencies**

- **C. A codex in an open chest (or in your bag while the chest is open) can't be taught there.**
  Gear can be equipped, a potion drunk and an XP scroll read straight from the chest window; a
  codex can only be taken. You close the chest, open the bag, and teach it there (the 2026-11-21
  change). Options: (1) leave it; (2) add Teach to the chest window for codexes in your bag only
  ("a codex you carry", as labyrinth.md words it); (3) for codexes still in the chest too, as
  scrolls work. It needs the "which move does it forget?" step fitted into the chest's fixed
  window, which is a layout decision, so it's left for you.
- **D. You can't look at one of your own creatures (stats, gear, moves) while picking a party at
  the Labyrinth's entrance, picking a PvP team at the portal, or during a run.** Tapping one there
  adds or removes it. To check a creature you go back to the Pit. Options: leave it; or a long
  press (or a small "i") on a creature opening its window read-only. A new control, so yours.
- **E. Klutz and codexes.** An XP scroll's Read lists Klutz beside your creatures; the Bookcase's
  Teach doesn't (he's taught from his own window, as klutz.md says). Options: leave it; or list
  him at the Bookcase too when he's home.
- **F. "Inventory" and "Storehouse".** The Den's place is the Storehouse (weapons, armour,
  consumables), but six links still open the old three-part Inventory (`/chest` without
  `?store=1`): the scan screen's card, the entrance's "box is full" link, Klutz's crate, the
  campaign's box and schematic quests, and Klutz's tour (whose words also say "Inventory" and
  "codexes"). Already on your list (the tour's text); noted here so the links aren't forgotten.
- **G. "Testing: heal now"** is still the label at the Labyrinth's entrance; the Healing Pool's
  own page had its testing label taken off (2026-11-20). Same shortcut, two wordings.
- **H. A creature training in the pit** can be put in a Labyrinth team (it then shows greyed at
  the entrance) but can't be added to a PvP team at all. Either is defensible; they differ.

**From the bugs**

- **I. A duel's last message, lost, with the host gone at once.** After fix 1 the host tells a
  guest how it ended whenever the guest next speaks, for as long as the host's page is open. If
  the host leaves within about 4 seconds of the end and the guest missed the last message, the
  guest still sees "… is gone. You win!" after 30 seconds. Closing that needs either the host's
  page to linger on the channel for a few seconds after leaving (simple: a short delay before it
  closes), or duels to be recorded on the server (the ranked ladder will need that anyway). Your
  call; nothing is saved from a duel today, so the cost is only a wrong message.
- **J. The foes' thinking happens before your tap shows.** Options: leave it (it's short); or
  show your move pressed first and let the foe think a frame later (no change to how it thinks);
  or think while you're choosing. Not a balance change in any of these.
- **K. A duel invite covers whatever you're doing**, including a walk through the Labyrinth with
  foes coming, or a fight (components/DuelInbox.tsx: a full-screen window, anywhere but the title
  screen, the privacy page and a duel). Accepting leaves the run where it is. Options: leave it;
  hold invites while you're in a run and show them as you come out (they lapse after 60 s, so
  the sender would see "No answer"); or a small badge instead of a window while in a run.

## UI noticed along the way (not changed)

- **"You left the duel."** was what a player read who lost by being away or out of time, not by
  leaving. Changed with the duel fix to "You were away too long. You lose the duel." for those
  (a guest out of time picking a team included); "You left the duel." stays for leaving. If you'd
  word it differently, it's one line in app/duel/page.tsx.
- **The browser's console** (for whoever next has it open): Three.js warns once that
  `THREE.Clock` is deprecated (it's the 3D library's own renderer, not the game); "Texture marked
  for update but no image data found" about a dozen times as the Den first opens (copies of
  pictures made before the pictures have loaded: they fill in a moment later, as they always
  have); and one shader warning from Windows' compiler about a variable in the rock's shader
  ("use of potentially uninitialized variable (f_faceAs_int)"), which draws correctly.
- **Old names in the tour and links** (option F above).
