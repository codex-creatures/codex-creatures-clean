"use client";
// app/lab/cards/page.tsx — the creature card (CardFace) across every rarity,
// for checking its look (dev tool). The Skull Raven is the benchmark.

import { CREATURE_BY_ID, type CreatureTemplate } from "@/lib/creatures/creatureData";
import { CardFace } from "@/components/CardGallery";

export default function CardLab() {
  // One of each rarity, plus a few more.
  const ids = ["storm_phoenix", "crystal_golem", "crystalback", "rust_beetle", "cave_bat", "moss_wolf", "monkey_mage", "dire_wolf"];
  const creatures = ids.map((id) => CREATURE_BY_ID[id]).filter(Boolean);
  const card = (t: CreatureTemplate) => <CardFace key={t.id} t={t} creatureId={t.id} />;
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Creature card</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 220px)", gap: 20 }}>
        {[CREATURE_BY_ID.storm_phoenix, CREATURE_BY_ID.rust_beetle].map(card)}
      </div>
      <h2 className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0", marginTop: 28 }}>At summary size</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 140px)", gap: 12 }}>
        {creatures.map(card)}
      </div>
    </main>
  );
}
