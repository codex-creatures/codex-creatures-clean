# Balance audit prompt (for a Fable session)

Drafted 2026-11-22, to paste into a fresh session on the most capable model, ideally after a week
or so of run history has built up in cloud saves. Read-only: it ends in a ranked report, and the
fixes come later as ordinary small sessions.

---

**Balance audit before the open alpha: where should we spend our time?**

Read CLAUDE.md and docs/README.md first; their rules apply (especially: decided numbers change only
when I ask, so present findings as options; no browser checks; I'm on a usage budget).

**Goal:** a ranked list of the balance problems most worth fixing before the open alpha, judged by
how much each one would hurt a new player's first ~20 hours and how much work it is to fix. Don't
change any game code: this session is read-only, apart from throwaway sim files you delete
afterwards.

**Look across the whole game's balance**, including:

- **The gold economy:** every source (runs, selling loot, quests, scans, daily quests, the campaign)
  against every sink (entry fees, merchants, librarians, codexes, soul stones, Den upgrades, the
  training pit). Where is a player at hour 1, 5, 20 and 50, and is anything too plentiful, too
  scarce, or skippable? I suspect selling loot is a big source, and I'd like to keep it.
- **Difficulty and progression:** foe levels and gear by dungeon, against how fast creatures level
  and gear up; where players are likely to get stuck or breeze through.
- **Combat:** moves, enchantments, statuses and the enemy AI. Anything dominant, useless, or broken
  in combination. (Strong but predictable is fine; see the move-design notes in docs.)
- **Drops and rewards:** whether each dungeon's loot is worth its fee and risk compared with the one
  before it.

**What we already know (2026-11-21 sims, walked runs, gold picked up):**

- Full clear: Encampment ~760, Cyclops ~1,930, Hydra ~3,250, Minotaur ~3,860.
- A natural run (straight route plus 4–5 side rooms): ~430 / 690 / 1,170 / 1,430.
- Entry fees: 50 / 100 / 200 / 300.
- Only fight gold scales with depth (`goldScale`); chest and sack gold doesn't.
- The Minotaur pays only ~20% more than the Hydra despite being 5v5.
- Idea on the table: less gold in chests, and a rarer golden money sack that scales with depth.
- Building a whole walked run takes a few seconds (the layout generator), so sims of whole runs
  need to be sized accordingly; run them as a temporary Vitest file (vite-node hung here).

**Real data:** the game's Supabase project (MCP, read-only queries only) holds cloud saves.
`save->'data'->'progress'->'labyrinth'->'meta'` has runs and clears per dungeon, and `history`
holds a record of each run since 2026-11-22 (run.ts `RunRecord`: rooms, cleared, gold found,
spent and sold, and the outcome). Use it to check the sims against real play, and say how much
data there is. Refer to players anonymously.

**Deliverable:** write the report to `docs/balance-audit-2026-11.md`. For each item:

- what's wrong, with evidence (code reference, sim result or real data);
- how confident you are;
- 2–3 fix options with their knock-on effects;
- rough effort.

Rank the items. Also say what you checked and found fine, so I know where not to look. Keep the
code changes for later sessions.
