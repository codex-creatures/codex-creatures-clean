"use client";
// app/cage/page.tsx
// The cage in the Den. A new player's first creature is waiting in it; open
// the cage to make it yours. (Later, creatures Klutz captures will end up here.)

import { useState } from "react";
import Link from "next/link";
import DenFrame from "@/components/DenFrame";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";
import RaceTag from "@/components/RaceTag";
import ClassBadge from "@/components/ClassBadge";
import AbilityTag from "@/components/AbilityTag";
import { useGameState } from "@/hooks/useGameState";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";

export default function CagePage() {
  const game = useGameState();
  const [freed, setFreed] = useState<CreatureOrItemDrop | null>(null);
  const caged = game.caged as CreatureOrItemDrop[];

  const open = (d: CreatureOrItemDrop) => { game.releaseCaged(d.id); setFreed(d); };

  return (
    <DenFrame title="Cage" icon="🔒">
      {!game.hydrated ? (
        <p style={{ color: MUTED }}>Loading…</p>
      ) : freed ? (
        <div className="stone-panel" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}><PixelSprite sprite={creatureSprite(freed.creatureId)} scale={4} /></div>
          <div className="pixel-font" style={{ fontSize: 22, color: RARITY_COLORS[freed.rarity].text, marginTop: 8 }}>{freed.name} is yours!</div>
          <p style={{ color: "#c8c4b8", fontSize: 14 }}>It&apos;s in your Creatures and on your roster. Give it some gear in the Pit.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/pit" className="pixel-btn">To the Pit</Link>
            <Link href="/" className="pixel-btn">Back to the Den</Link>
          </div>
        </div>
      ) : caged.length === 0 ? (
        <p style={{ color: MUTED }}>The cage is empty. One day, creatures Klutz captures in the Labyrinth will be brought back here.</p>
      ) : (
        caged.map((d) => {
          const t = findCreatureTemplate(d.creatureId, d.name);
          return (
            <div key={d.id} className="stone-panel" style={{ textAlign: "center" }}>
              <p style={{ color: "#c8c4b8", fontSize: 14, margin: "0 0 10px" }}>Something is rattling the bars…</p>
              <div style={{ display: "flex", justifyContent: "center" }}><PixelSprite sprite={creatureSprite(d.creatureId)} scale={4} /></div>
              <div className="pixel-font" style={{ fontSize: 22, color: RARITY_COLORS[d.rarity].text, marginTop: 8 }}>{d.name}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 6 }}>
                <span className="pixel-font" style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color: RARITY_COLORS[d.rarity].text, border: `2px solid ${RARITY_COLORS[d.rarity].border}` }}>{d.rarity}</span>
                <RaceTag race={t?.race} />
                <ClassBadge cls={t?.cls} />
              </div>
              <AbilityTag ability={d.ability} />
              {t && <p style={{ color: "#a9a59a", fontSize: 13, fontStyle: "italic" }}>{t.flavour}</p>}
              <button className="pixel-btn" onClick={() => open(d)} style={{ marginTop: 6 }}>🔓 Open the cage</button>
            </div>
          );
        })
      )}
    </DenFrame>
  );
}
