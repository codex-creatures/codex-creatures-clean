// lib/dungeon/runText.ts
// The words the Labyrinth screen shows about a run: a boss beaten, its chest, a drop, a foe's
// numbers. Pure, so they're tested (tests/runText.test.ts); moved out of app/dungeon/page.tsx as they were.

import { combatSummary } from "../combat/loadout";
import type { Drop } from "../types";
import { DUNGEONS, type DungeonRun, type DungeonSave, type Room } from "./run";

// A fighter's numbers in one line (a boss part's, in the room window).
export function combatLine(f: Parameters<typeof combatSummary>[0]): string {
  const s = combatSummary(f);
  return `${s.hp} HP · Atk ${Math.round(s.atk)} · Rng ${Math.round(s.rng)} · Mag ${Math.round(s.mag)} · Agi ${Math.round(s.agil)} · MDef ${Math.round(s.mdef)} · RDef ${Math.round(s.rdef)} · MgDef ${Math.round(s.magdef)}`;
}

export function dropLabel(d: Drop): string {
  if (d.dropType === "item" && d.material) return `${d.name} ×${d.qty ?? 1}`;
  if (d.dropType === "reward") return `${d.amount} gold`;
  if (d.dropType === "card") return `${d.name} card`;
  return d.dropType === "item" ? `${d.name} (${d.rarity})` : d.name;
}

// The boss beaten: its name in the celebration's banner, and a line about the clear.
export function beatenTitle(run: DungeonRun) {
  return run.dungeon === 0 ? "The Encampment is yours!" : run.dungeon === 2 ? "The Hydra falls!" : run.dungeon === 3 ? "The Warden falls!" : "The Cyclops falls!";
}
export function clearedLine(run: DungeonRun, lab: DungeonSave) {
  return run.dungeon === 0
    ? `The chief goes down, and the camp is yours. You beat the Encampment on run ${run.runNumber}!${lab.meta.campClears ? "" : " The Cyclops's way in is open now."}`
    : run.dungeon && run.dungeon !== 1
    ? `${run.dungeon === 2 ? "The last head falls" : "The Warden falls"}, and the deep goes quiet. You beat ${DUNGEONS[run.dungeon].name.replace("The", "the")} on run ${run.runNumber}!`
    : `The Eye bursts in a shower of sparks. You beat the Cyclops on run ${run.runNumber}${lab.meta.firstClearRun ? "" : " — your first clear"}! Its head comes home with you: a trophy, and a bounty if anyone's offering one.`;
}
export const chestName = (room: Room) => (room.container === "strongbox" ? "The strongbox" : room.kind === "encampment" ? "The chief's chest" : "The Cyclops' chest");
