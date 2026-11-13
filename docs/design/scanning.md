# Scanning and the core idea

Authoritative for the core idea, barcodes, the registry rules as players see them, the altar and the camera. Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 1. Core idea

- ✅ Creatures and items have always lived inside barcodes. Scanning a real barcode opens a
  **Code Cache** with what that barcode holds. Scanning stays the most effective source of items
  forever, even as other sources grow.
- ✅ Battles give scanning a purpose: you take a team into the **Labyrinth**, a roguelike climb of
  rooms to a boss.
- ✅ Home is the **Den**, a gloomy cavern you move around (pan/zoom map) with places to visit.
- Design goal (the user's): attachment to *individual* creatures, and team building plus
  outplaying should decide fights, not rarity alone.

## 2. Barcodes and scanning

- ✅ **The barcode number must not decide the outcome.** The first-ever scan of a barcode rolls its
  outcome at random and registers it. Everyone who scans it later gets the same outcome (item kind
  and rarity, or creature species) but their own stat roll. Rescanning a barcode you already own
  gives gold, never a new item or a reroll. (lib/barcodeRegistry.ts)
- ✅ **Scans stored** (the user, 2026-11-02; lib/scanCharges.ts): up to 9 (`SCAN_MAX`), one more
  every 20 minutes (`SCAN_REGEN_MS`) while below 9, none while full: 9 every 3 hours. Stops mass
  scanning and rewards coming back. A barcode new to you uses one (opened, or kept sealed offline);
  rescans (gold), one too rare for you yet, and the testing "random" mode are free. Saved as
  `scanCharges` (missing: full). Shown under the altar's Scan button with a countdown.
- ✅ **A new game's first scans** (the user, 2026-11-13; lib/firstScans.ts): 50 (`FIRST_SCANS`)
  free scans with no clock, used before the stored scans (which start at 0, their clock running,
  when the last one's used). Klutz gives you his scanner, which needs calibrating: the first 25
  (`CALIBRATION_SCANS`) **calibrate it** (a panel of his above the Scan button; once done he says
  you've still got N free scans, use them while you can: no time limit, just a nudge).
  Each rolls on the spot at the usual odds but nothing past Rare and no soul stone, and asks no
  registry (global or local) and records nothing, so they work offline too and, once calibrated,
  the same barcodes are new to you again and open from the registry with the usual rules. A
  barcode already read while calibrating is free and gives nothing. Saved as `firstScans`
  (`{ used, codes }`); missing (saves from before this): none. "Start new" and "Reset player" give
  a new set.
- ✅ Online builds use the **global registry** (§12): everyone shares one. A copy without online
  (the offline Windows build, tests, a dev build with no Supabase keys) keeps a **local** one
  (`codex_creatures_registry_v3`): "Reset player" keeps it, to simulate a friend; "Global reset"
  (shown only there) clears it.
- 🧪 Outcome odds (`SCAN_ODDS`, 2026-10-20, for playtesting): 40% creature, 13% weapon, 26% armour,
  7% consumable, 6% material, 7% gold, 1% soul stone (2026-10-25, first scanner only). Aim: about 1 legendary creature or card per 250 scans (from
  explorer level 12); a real creature every 12–13 scans. Players will also hunt legendaries with good
  rolls, so the chase goes on past the first. Shared barcode lists (once there's a global database)
  are an open risk: ideas are seasons, limited stock, or the legendary species rolled per player.
- ✅ Labyrinth chests keep the original table (`CHEST_ODDS`): 20% creature, 12% weapon, 24% armour,
  12% consumable, 12% material, 20% gold. Creatures found in the Labyrinth always come as cards;
  only encampment cages hold real creatures.
- ✅ **1 drop per new scan** (`SCAN_DROPS`). Items should stay scarce; gold scans are the
  "dud" consolation.
- ✅ The altar (layout 2026-10-20): a big **Scan Barcode** button, the Looting/Storage toggle, and a
  3×3 loot window (one empty row of 3 until something's in it). **Looting** opens each Code Cache
  at once: the find goes straight to your things and the window shows this visit's latest 9,
  cleared when you leave. **Storage** keeps caches in the window, at most 9 (`CACHE_LIMIT`); when
  full, open some before scanning. ✅ (the user, 2026-11-01) **The unveiling** (lib/scanReveal.ts,
  components/ScanReveal.tsx): every Looting scan, and tapping one stored cache, plays a short show
  on its own dark screen (nothing behind shows through)
  (the cache rattles up the rarities one stage at a time, harder each time: white 0.8s, then green,
  blue and purple 0.55s each, stopping at its find's; a legendary goes still for 0.45s after purple, then
  rattles gold 0.65s (`shakeStages`, about 3.5s in all; gold coins 0.75s). It cracks in a flash of that colour;
  rare adds light rays, epic falling gold and a jolt, legendary a big golden explosion on top; tap to skip), then the find with its stats and
  **Keep / Sell** (at the merchant's price: gear for what the Inventory pays; potions, codexes,
  scrolls and tools for half what they cost), **Keep / Release** (a creature or card), **Keep**
  (materials, which go straight to your tally, and what has no price), or just "+N gold" (tap on).
  Under the find's name, who got there first (`findLine`; the user, 2026-11-01, a treasure hunt for
  barcodes nobody has scanned): "✨ First to find this Code Cache!", online "You're the 3rd to find
  this Code Cache", or "You've already looted this Code Cache" on a rescan. In Storage it shows under
  the window instead. ✅ (the user, 2026-11-02) **New finds:** the first of a kind you've had gets a
  "✨ New creature!" or "✨ New item!" tag over it as it opens (`newFinds`): a species you don't
  have (as "Creatures discovered" counts it, so one you've let go of is new again) or a kind of item
  never had ("Items discovered"). Of two of the same new kind at once, only the first. "Open all" opens stored caches
  together, with no show (each new find tagged NEW once revealed). Typed barcodes (Repeatable by default, or Random) sit at the
  bottom as a testing tool. ✅ (the user, 2026-10-31) Online, the altar's testing tools (typed
  barcodes, Random, the resets, rubble and visitor) show only for the owner's account
  (`ADMIN_IDS`, lib/online/admin.ts); a copy without online keeps them. This hides them in the
  game only: the server can't tell a typed barcode from a scanned one. **✨ Start new** is for
  every player (two taps); the old save is kept as the backup (Settings → Restore backup).
- ✅ **Items discovered** counts every kind of item: weapon and armour types, materials, potions and
  codexes (lib/items/discovery.ts). The save remembers kinds you've used up (`found`).
- ✅ Scanned creatures: 20% are a real creature, 80% a **creature card** (`REAL_CREATURE_CHANCE`).
  In the loot window a real creature shows as the creature itself (its sprite, its plain name), a
  card as the card.
- ✅ Your **explorer level** caps how rare a creature you can take from a barcode **someone already
  found** (`SCAN_UNLOCK`: rare at Lv 2, epic at 6, legendary at 12). That barcode stays sealed: it
  doesn't count, and the altar shows the level needed. **Being first beats the cap** (2026-10-20):
  a barcode nobody has scanned rolls at the usual odds and is yours whatever it is
  (`tooRare`). Online "someone" means any player; locally, any earlier player in this browser.
- ✗ **Barcode merchant** (dropped by the user, 2026-11-04: the tavern has enough merchants). It
  was to be 10% of scans, taken from materials and consumables.
- 📌 **Onboarding scan gate** (the user, 2026-11-04: later), deliberately unconventional: the game stays locked until you scan a
  real barcode, then Klutz drags you out of the labyrinth. Don't "fix" this for convenience. Edge
  cases still need solving: manual entry, no camera, app-store review. Not built: a new game starts
  at the Den.
- ✅ **Global registry** (the user, 2026-10-31): the online registry replaces the local one, and
  offline scans wait as sealed Code Caches. See §12.
- ✅ **The camera** (2026-11-01, for Samsungs that never read a code and phones without a close-up
  lens): opens the main back lens (Android: the lowest "camera2 N, facing back") at 1080p with
  continuous focus, reads shop-type 1D barcodes (no QR) with the browser's own BarcodeDetector where
  there is one (Android Chrome), else ZXing with try-harder. Under the picture: 🔍 zoom 1×/2×/3×
  (the lens's own zoom where it has one, else cropping), 📷 next camera, 🔦 torch where there is one.
  The last lens and zoom are kept per device. Fake-scan detection is still a future project.
  Test with manual barcode entry.
