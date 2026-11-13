# Online

Authoritative for accounts, cloud saves, the global registry, leaderboards and PvP (Supabase). Part of the [game design index](../design.md); status tags (✅ 📌 🧪 ❓ ⏸ ✗) are explained in [docs/README.md](../README.md#status-tags). **The code is the truth for numbers:** if this file and a constant disagree, trust the code and fix this file.

Moved here word for word from design.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/design.md)); section numbers are kept, so references like "design.md §N" still find their place.

## 12. Online (📌 the user, 2026-10-31; accounts, cloud saves and the global registry built)

The user is building online infrastructure now, so later design keeps it in mind. This is for
playtesting with friends, not yet hardened. Backend: **Supabase**, as its own project on its own
account, kept entirely apart from Vouchee.

- 📌 **Online first, offline mode as a fallback.** The game starts normally and tries to connect.
  With no connection it says so: online features aren't available. The player taps **Offline
  mode** and plays the rest of the game as normal. Offline:
  - Scans are kept as **sealed Code Caches** that open only once back online (each needs the
    global registry to find out what it holds). They still count against scan limits.
    ✅ Built: a barcode new to you, scanned with the registry out of reach (offline, signed out,
    or no answer in 8 s), waits in the altar window as 🔒 Sealed (save field `sealed`, barcode
    numbers; optional, default none). It takes one of the 9 cache spaces. Rescans of barcodes you
    already have still give gold offline. On visiting the altar, or coming back online, each is
    asked again and becomes an ordinary Code Cache, and the scan counts then. One that turns out
    too rare for your explorer level is dropped, with a note (scan it again later).
  - No trading and no PvP.
  - Everything else (the Den, the Labyrinth, Klutz, inventory) works as now.
- 📌 **Accounts:** for now, **Sign in with Google** (the user, 2026-10-31); the player then picks a
  name. ✅ Built: the title screen's 🌐 box (components/AccountPanel.tsx, rules in
  lib/online/account.ts). Signing in returns to `/start`. Names are 1–16 letters and need not be
  unique. Signing out signs out only this device. **Switch** (beside Sign out, the user, 2026-11-14) signs
  out and goes straight to Google, which asks which account (`prompt=select_account`); after Sign
  out, the next Google sign-in asks too (otherwise Google signs you back in as the account it
  remembers). ✅ Set up and working (2026-10-31): Google Cloud
  project `codex-creatures`, client "Codex Creatures web". 📌 Anyone with a Google account may
  sign in (the user, 2026-10-31: players share the game freely), so the Google app is published
  rather than kept to a test-user list. Google needs the privacy page for that: `/privacy`
  (app/privacy/page.tsx), which must be kept in step with what's really stored.
  Google blocks sign-in inside apps' built-in browsers (e.g. Cursor's): use Chrome or Safari. To
  set it up again from scratch: `npm run setup:google` (scripts/setup-google-login.mjs).
  - **Email links** (no password) are built too but hidden (`EMAIL_LOGIN` in account.ts): Supabase's
    own mailer only reaches the project's team. To switch them on: a domain for the game, then
    **Resend** (approved by the user, 2026-10-31) in Supabase's SMTP settings. The link signs in
    whichever browser opens it (the "implicit" flow: phone mail apps often use their own browser).
  - Later, for the iPhone App Store: Apple requires Sign in with Apple alongside Google.
- 📌 **Cloud saves:** the save syncs to the player's account, so it follows them between devices.
  Decided (the user, 2026-10-31). ✅ Built: lib/online/cloudSave.ts (rules, tests/cloudSave.test.ts),
  the `cloud_saves` table (supabase/migrations), synced on the title screen (app/start) and
  uploaded while playing by components/CloudSync.tsx.
  - 📌 **Sign in to play, one save per account** (the user, 2026-10-31): online, the title screen
    (components/OnlineStart.tsx) asks you to sign in, then loads your account's save: no save
    slots to pick, so there is always a cloud save. Sharing a device: sign out, and the other
    player signs in. Underneath, each account's save is still a slot on the device (the one in
    play when an account first signs in there, unless another account has it; otherwise a new
    "Online" slot). Slots from before stay stored but hidden. A copy without online (the offline
    Windows build) keeps the old slot screen (components/LocalStart.tsx).
  - 📌 **Offline** (the user, 2026-10-31): a device that has synced for the account before (and
    hasn't signed out) may **Play offline**, with a warning: it shows when it last synced, that
    progress from another device may be missing, and that the newer save wins once back online
    (this copy kept as the backup). A device that has never synced needs the internet once.
  - **What syncs:** the game save plus battle history. Not the local barcode registry (online
    builds use the global one instead).
  - **The cloud wins:** signing in on a device whose online slot differs from the account's cloud
    save loads the cloud save, with no question asked. The device's copy is kept as the backup
    (Settings → Restore backup), so nothing is lost for good. An account with no cloud save yet
    uploads the device's slot.
  - Playing signed in uploads the online slot a few seconds after each change (5 s after the last,
    at most every 30 s) and on leaving the page; with no connection it waits and uploads once back
    online.
  - How "differs" is told: the table counts a revision on every write, and each device remembers
    the revision it last matched. The cloud on a newer revision wins (even over this device's own
    unsent play); otherwise this device's play goes up. An upload only writes over the revision
    it last saw, so if another device saved meanwhile, the game goes back to the title screen,
    which loads the newer save. (The local barcode registry, unused online, stays per slot.)
  - 📌 **One game at a time** (the user, 2026-11-03): tapping Play claims the account, and a game
    running on any other device (or tab) goes back to its title screen, which says why ("Tap Play to
    carry on here instead"). ✅ Built: the `play_sessions` table (one row per account: the tab playing
    it, a random id per tab in sessionStorage), lib/online/playSession.ts, claimed in
    components/OnlineStart.tsx and watched by components/CloudSync.tsx (Realtime, plus a check on
    coming back to the tab, on coming online and before each upload). A game played offline claims
    once back online, unless another device started after it. The stopped game's last few seconds
    (since its last upload) stay on that device as the backup.
  - The player name must be picked before playing (not asked again while offline).
  - The user's own game starts fresh with cloud saves (only one game existed, the user's), so no
    old-save migration is needed.
- 📌 **Global registry:** the first scan of a barcode anywhere is rolled **on the server** and
  stored, and everyone after gets that outcome (their own stat roll, as now). This makes "being
  first" (the explorer-level cap, soul stones) work between players. It starts **empty** (a fresh
  start, not a copy of any local registry). No global resets planned for now.
  ✅ Built (2026-10-31): the `barcode_registry` table and the database function `scan_barcode`
  (supabase/migrations), asked by lib/online/registry.ts. Only signed-in players may call it, and
  nobody reads the table directly. It stores the barcode number and its outcome, and in `barcode_finders` (2026-11-01) which players
  found it and when, one row each, so `scan_barcode` can answer `place` (you're the Nth to find it;
  asking again never counts twice). Players only ever see their own place. The server rolls from `registry_rules`, a copy of `REGISTRY_RULES` (lib/barcodeRegistry.ts:
  `SCAN_ODDS`, `RARITY_WEIGHTS`, the species of each rarity, weapon and armour kinds, soul stones,
  gold 50–150). Its `registry_roll` takes the same steps as `rollFromRules`. **After changing any
  of those** (a new species, item or soul stone, new odds), run `npm run registry:rules` and
  apply the migration it writes. tests/registryRules.test.ts fails until the copy matches.
  Until it's applied, the server keeps rolling from the old copy. Labyrinth chests (`CHEST_ODDS`)
  and the altar's Random testing mode still roll on the device and register nothing.
  - Not hardened: a player could script calls to farm fresh barcodes. Accepted for playtesting
    (see Cheating below).
- ✅ **Leaderboards**, the quest board's second tab (`/board`; the first is Quests, §9).
  Boards: creature species you've owned, shown as 12/120 (the altar's "Creatures discovered": creatures and
  cards; ✅ the user, 2026-11-02: one you've let go of still counts, kept in the save's `owned`,
  `ownedSpecies`; older saves start from what they hold); runs started in each dungeon; wins in each
  dungeon (a win is beating its final boss); time played (as Settings counts it, idle time left
  out); barcodes scanned (rescans count too). Starting a new game resets them all. PvP boards come later. Signed-in players only; top
  50 shown, plus your own rank; only named players with more than 0 are listed, ties share a rank.
  - The game works out each player's numbers (`leaderboardStats`, lib/leaderboard.ts) and they go
    up with the cloud save, in `cloud_saves.stats`. The server's `leaderboard(board)` ranks them
    (supabase/migrations …_leaderboards.sql). Like the rest, not hardened against a scripted cheat.
  - **Seasons** (resets run by the user): `select public.start_season();` in the Supabase SQL
    editor. It notes everyone's numbers then, and runs, wins, time and scans count from there. 🧪 Species
    don't reset (Claude's call: they're your collection; the user may want otherwise).
- 📌 **PvP: live, each player controlling their own team.** ✅ Built (2026-11-01) as **duels with
  a friend**; not yet tried by two real players. Rules in lib/pvp (tests/duel.test.ts), the screen
  app/duel, the connection lib/online/duelChannel.ts.
  - **Custom formats** (the user, 2026-11-02; lib/pvp/formats.ts): whoever invites picks the size
    (3v3 or 5v5), the highest rarity (Rare, Epic, Legendary), the level (15 or 25) and the scaling.
    **Default: 3v3 · Rare · up to Lv 15, not scaled** (`DEFAULT_PVP`): a creature above the level
    fights at it, one below keeps its own level. **Scale everyone** (a toggle): every creature
    fights at exactly the level, as all duels did before (the user, 2026-10-31: levelling isn't
    the only edge). The creature's real level is untouched either way. A format travels as an id
    ("3v3-rare-15", "5v5-legendary-25-scaled"); the three old ids still read, scaled.
  - **The screen** (the user, 2026-11-01; `ineligibleReason`): a creature above the format's
    rarity can't be picked, and nor can one wearing a weapon or armour piece above it (a Rare
    creature with an Epic sword). Moves learned from codexes are fine. Unfit creatures show
    greyed with the reason. A creature training in the pit shows greyed too, "In the pit".
  - **Friends** (the user, 2026-11-01): every row on a leaderboard has ➕ to add that player to
    your friend list (one-sided, like following: the `friends` table, `my_friends()`). 👥 on the
    board shows the list, with 🟢 for who's in the game now (Realtime presence, "lobby"), ✕ to
    remove, and ⚔️ Duel for those who are on. Duel shows the options (size, rarity, level,
    scale), with how many of your creatures fit (greyed if you can't fill it).
  - **Invites:** the challenge pops up wherever the friend is in the game
    (components/DuelInbox.tsx), with Accept / No. It lapses after 60 s (`INVITE_SECONDS`).
  - **The steps** (the user, 2026-11-01): bring your team (**20 s**, `PICK_SECONDS`; time out and
    the ones you'd tapped, then the first that fit, are brought for you) → **the lead room**, a
    dungeon room with their line-up at the back and yours at the front → the battle on the usual
    battle screen.
  - **Bring 2 more** (the user, 2026-11-02: the other player sees your team, so it's another way
    to outthink them): you bring the format's size and up to 2 more (`BRING_EXTRA`: 5 for 3v3,
    7 for 5v5). In the lead room both line-ups are shown and each picks who fights, in order (1
    goes out first; 20 s, 🧪 Claude's number; time out and the first brought fight).
  - 🧪 Claude's defaults, agreed by the user 2026-11-01: **30 s a move** (`TURN_SECONDS`; then a
    steady move is made for you; 20 s to send in a replacement); **no potions or battle bag**,
    gear only; **no rewards and no effect on the save** (no XP, gold or injuries; the duel goes
    in your battle history); **leaving loses**, and so does being gone 30 s (`GONE_SECONDS`).
  - **How the two browsers agree** (Claude's answer to the kink below): whoever sent the invite
    is the host and their browser runs the fight with the usual rules; the other player's
    choices go to it and each round's result comes back (the guest's copy is mirrored so both
    see themselves on the left). Lost messages are sent again. Only Supabase Realtime is used:
    no new tables for duels. Not hardened: a guest's team and the host's dice are trusted.
  - ✅ **The PvP portal** (the user, 2026-11-04; app/pvp): a flat stone arch set into the wall, filled with a softly glowing, pulsing green flame (muted, in the cave's colours),
    in the tavern's room, against the back-left wall, left of the Sparring/Training Pit. It's
    there once the rubble's blown open (the second room). Tap it for three tabs: **Duel a
    friend** (the friend list and duel options, components/FriendList.tsx, also still behind 👥
    on the quest board), **Teams** and **Ranked**. A finished or cancelled duel goes back to the
    portal (to the board for a player whose rubble is still shut). While you're signed in, a number
    over its name says how many other players are on now (the lobby's presence, lib/online/duelChannel.ts;
    you don't count), glowing green when it's 1 or more, dim at 0 (the user, 2026-11-14).
  - ✅ **PvP teams** (the user, 2026-11-04; lib/pvp/teams.ts, save field `pvpTeams`, optional,
    default empty): 3 saved line-ups, apart from the Labyrinth's teams, each up to 7 (a 5v5 and
    2 more), in order. Each shows its **rarest** creature or gear. When picking your team in a
    duel, tapping a team brings its members that fit the format, in order, up to what you may
    bring. The collector won't buy a creature in a PvP team either.
  - ⏸️ **Ranked ladders with Elo**: shelved for now (the user, 2026-11-04). They'll live at the
    portal; the tab shows "Coming soon". Not designed yet (format, matchmaking, K-factor, seasons).
  - Later: challenging players who aren't friends.
  - First playtest goal (by about 2026-11-21): the user and a friend fight each other.
- 🧪 **Order of work** (Claude's plan): 1) Supabase project, email login, name, cloud saves, the
  online/offline start (done, but email login waits for a domain); 2) global registry and sealed
  caches (done), leaderboards (done); 3) live PvP (built, 2026-11-01).
- Known kinks to solve, not decided:
  - **Live battles need both browsers to agree.** Solved: the host's browser runs the fight
    (see PvP above).
  - **Cheating:** saves can be edited in the browser, so teams and scores can be faked. Accepted
    for playtesting with friends; server checks come later.
  - **Saves and slots:** settled, see Cloud saves above (one online slot; the cloud wins).
  - Shared barcode lists (§2) become a real risk once the registry is global.
