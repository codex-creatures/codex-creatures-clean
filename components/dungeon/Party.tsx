"use client";
// components/dungeon/Party.tsx
// Your party in a run: the team that fights, the first one leading. Moved out of app/dungeon/page.tsx as it was.

import PartySlots, { type PartyMember } from "@/components/PartySlots";
import { teamSize, fightingTeam, type DungeonRun } from "@/lib/dungeon/run";
import { type OwnedCreature } from "@/components/BattleScreen";

// Your party: three in the team (the first one leads), two on the bench.
// bench: at the map, the rest of the party (under this label); inside, just the team.
export default function Party({ run, byId, onTeam }: { run: DungeonRun; byId: (id: string) => OwnedCreature | undefined; onTeam: (team: string[]) => void }) {
  const member = (id: string): PartyMember[] => {
    const c = byId(id);
    return c ? [{ id, name: c.name, rarity: c.rarity, creatureId: c.creatureId, maxHp: c.fighter.maxHp, hp: run.hp[id] ?? 1 }] : [];
  };
  const team = fightingTeam(run);
  return (
    <>
      <PartySlots size={teamSize(run)} team={team.flatMap(member)} onTeam={onTeam} />
    </>
  );
}
