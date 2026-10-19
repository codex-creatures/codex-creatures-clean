"use client";
// app/pool/page.tsx
// The healing pool in the Den: creatures hurt in the Labyrinth heal here,
// slowly, in real time. It starts as a soggy cave pool; upgrades come later.

import { useEffect, useState } from "react";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";
import { loadOwnedCreatures, type OwnedCreature } from "@/components/BattleScreen";
import { hoursToFull, loadDungeon, poolLevel, saveDungeon, type DungeonSave } from "@/lib/dungeon/run";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";

const MUTED = "rgba(255,255,255,0.5)";

function duration(hours: number): string {
  const mins = Math.ceil(hours * 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function PoolPage() {
  const [lab, setLab] = useState<DungeonSave | null>(null);
  const [owned, setOwned] = useState<OwnedCreature[]>([]);

  // Loading the save lets the pool catch up; then it ticks every minute.
  useEffect(() => {
    const tick = () => { const s = loadDungeon(); saveDungeon(s); setLab(s); };
    tick();
    setOwned(loadOwnedCreatures());
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!lab) return <DenFrame title="Healing Pool" icon="⛲"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  const level = poolLevel(lab.meta);
  const injured = owned.filter((c) => lab.meta.injuries[c.id] !== undefined);
  const away = new Set(lab.run?.party ?? []);
  const healAll = () => { const s = { ...lab, meta: { ...lab.meta, injuries: {} } }; saveDungeon(s); setLab(s); };

  return (
    <DenFrame title="Healing Pool" icon="⛲">
      <div className="stone-panel">
        <div className="pixel-font" style={{ fontSize: 17, color: "#9fd8d8" }}>{level.name}</div>
        <p style={{ fontSize: 13, color: "#c8c4b8", margin: "4px 0 0", lineHeight: 1.5 }}>
          {level.desc} Creatures hurt in the Labyrinth soak here and get back
          <b> {Math.round(level.healPerHour * 100)}% of their health an hour</b>. Upgrades to the pool will come later.
        </p>
      </div>

      {injured.length === 0 ? (
        <p style={{ color: MUTED, marginTop: 16 }}>Nobody needs the pool right now. Everyone&apos;s at full health.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {injured.map((c) => {
            const hp = lab.meta.injuries[c.id];
            return (
              <div key={c.id} className="stone-panel" style={{ display: "flex", gap: 10, alignItems: "center", padding: 10 }}>
                <PixelSprite sprite={creatureSprite(c.template.id)} scale={2} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pixel-font" style={{ color: RARITY_COLORS[c.rarity].text, fontSize: 15 }}>{c.name}</div>
                  <div style={{ height: 8, background: "#0e0f14", marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${hp * 100}%`, background: hp > 0.5 ? "#22c55e" : hp > 0.25 ? "#f5c542" : "#ef4444" }} />
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
                    {away.has(c.id) ? "Away in the Labyrinth" : `${Math.round(hp * 100)}% · full in ${duration(hoursToFull(lab.meta, hp))}`}
                  </div>
                </div>
              </div>
            );
          })}
          <button className="chip" onClick={healAll} style={{ justifySelf: "start" }} title="A shortcut for playtesting">Testing: heal everyone now</button>
        </div>
      )}
    </DenFrame>
  );
}
