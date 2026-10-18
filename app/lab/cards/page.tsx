"use client";
// app/lab/cards/page.tsx — the creature card design, being refined (dev tool).
// Follows the user's sketch: race icon | name | attack-style icon; the sprite
// on a faded rarity colour; a Race | Attack style row; then the creature's
// role (tank, brute…) over one line of flavour. The "rarity frame" look won;
// once settled it replaces CardFace in components/CardGallery.tsx.

import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CLASS_INFO, CREATURE_BY_ID, RACE_INFO, type CreatureTemplate } from "@/lib/creatures/creatureData";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";

// A creature's role, read off its stats (a trial rule — could become a field).
function roleOf(t: CreatureTemplate): string {
  const p = t.proficiency;
  const off = t.cls === "melee" ? p.atk : t.cls === "ranged" ? p.rng : p.mag;
  const def = (p.mdef + p.rdef + p.magdef) / 3;
  if (def >= off * 1.3) return "Tank";
  if (p.agil >= off * 1.4) return "Skirmisher";
  if (off >= def * 2.5) return t.cls === "melee" ? "Brute" : t.cls === "ranged" ? "Sharpshooter" : "Glass cannon";
  return t.cls === "melee" ? "Fighter" : t.cls === "ranged" ? "Marksman" : "Spellcaster";
}

// Just the first sentence of the flavour, so it fits.
const shortFlavour = (s: string) => s.split(/(?<=[.!?])\s/)[0];

const clamp2: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

function CreatureCard({ t }: { t: CreatureTemplate }) {
  const rc = RARITY_COLORS[t.rarity], race = t.race && RACE_INFO[t.race], cls = CLASS_INFO[t.cls];
  const coin = (icon: string, title: string) => (
    <span title={title} style={{ width: "16cqw", maxWidth: 24, aspectRatio: "1", flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "clamp(9px, 8cqw, 13px)", background: "#fff", boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.2)" }}>{icon}</span>
  );
  const panel: React.CSSProperties = { background: "#fbfaf6", borderRadius: 4 };
  return (
    <div style={{ containerType: "inline-size", aspectRatio: "5 / 7", display: "flex", flexDirection: "column", gap: 4, padding: 5, borderRadius: 10, background: `linear-gradient(160deg, ${rc.text}, ${rc.text}bb)`, boxShadow: "0 4px 10px rgba(0,0,0,0.6)", color: "#1d1a16", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {race && coin(race.icon, race.name)}
        <span style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: "clamp(10px, 8cqw, 14px)", lineHeight: 1.05, color: "#1a140c", ...clamp2 }}>{t.name}</span>
        {coin(cls.icon, cls.name)}
      </div>

      {/* The sprite fills the art box, keeping 5% clear on every side. */}
      <div style={{ ...panel, position: "relative", flex: 1, minHeight: 0, background: `radial-gradient(circle at 50% 50%, ${rc.text}55, ${rc.text}18 75%), #fbfaf6` }}>
        <div style={{ position: "absolute", inset: "5%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PixelSprite sprite={creatureSprite(t.id)} scale={4} title={t.name}
            style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, fontSize: "clamp(8px, 6.6cqw, 12px)", fontWeight: 700, whiteSpace: "nowrap" }}>
        <span style={{ ...panel, flex: 1, textAlign: "center", padding: "3px 2px" }}>{race?.name}</span>
        <span style={{ ...panel, flex: 1, textAlign: "center", padding: "3px 2px" }}>{cls.name}</span>
      </div>
      <div style={{ ...panel, padding: "3px 6px 4px" }}>
        <div style={{ fontWeight: 800, fontSize: "clamp(9px, 7.5cqw, 13px)" }}>{roleOf(t)}</div>
        <div style={{ fontSize: "clamp(8px, 5.8cqw, 10px)", lineHeight: 1.2, height: "2.4em", opacity: 0.7, ...clamp2 }}>{shortFlavour(t.flavour)}</div>
      </div>
    </div>
  );
}

export default function CardLab() {
  const ids = ["rust_beetle", "moss_wolf", "amber_wasp", "monkey_mage", "dire_wolf", "storm_phoenix", "crystal_golem", "cave_bat"];
  const creatures = ids.map((id) => CREATURE_BY_ID[id]).filter(Boolean);
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Creature card</h1>
      <div style={{ width: 220 }}>
        <CreatureCard t={CREATURE_BY_ID.rust_beetle} />
      </div>
      <h2 className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0", marginTop: 28 }}>At summary size</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 140px)", gap: 12 }}>
        {creatures.map((t) => <CreatureCard key={t.id} t={t} />)}
      </div>
    </main>
  );
}
