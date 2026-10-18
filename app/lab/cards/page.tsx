"use client";
// app/lab/cards/page.tsx — trial designs for the creature card (dev tool).
// All three follow the user's sketch: race icon | name | attack-style icon;
// the sprite on a faded rarity colour; a Race | Attack style row; then the
// creature's role (tank, brute…) over a line of flavour text. They differ
// only in look. The chosen one replaces CardFace in components/CardGallery.tsx.

import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CLASS_INFO, CREATURE_BY_ID, RACE_INFO, type CreatureTemplate } from "@/lib/creatures/creatureData";
import { spriteWidth } from "@/lib/sprites/pixels";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";

const SERIF = "Georgia, 'Times New Roman', serif";
const scaleFor = (id: string, px: number) => Math.max(1, Math.floor(px / spriteWidth(creatureSprite(id))));

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

type Bits = { rc: { text: string; glow: string }; race?: { name: string; color: string; icon: string }; cls: (typeof CLASS_INFO)["melee"]; role: string };
const bitsOf = (t: CreatureTemplate): Bits => ({ rc: RARITY_COLORS[t.rarity], race: t.race && RACE_INFO[t.race], cls: CLASS_INFO[t.cls], role: roleOf(t) });

const clamp2: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

// 1 · Parchment: warm card stock, ink lines, serif — a classic trading card.
function CardParchment({ t }: { t: CreatureTemplate }) {
  const { rc, race, cls, role } = bitsOf(t);
  const ink = "#3a2a16";
  const coin = (icon: string, title: string) => (
    <span title={title} style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, border: `2px solid ${ink}`, background: "#fbf3dc" }}>{icon}</span>
  );
  return (
    <div style={{ containerType: "inline-size", aspectRatio: "5 / 7", padding: 5, borderRadius: 8, background: rc.text, boxShadow: "0 4px 10px rgba(0,0,0,0.6)" }}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", border: `2px solid ${ink}`, borderRadius: 4, background: "#f1e4c2", color: ink, fontFamily: SERIF, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 4px", borderBottom: `2px solid ${ink}` }}>
          {race && coin(race.icon, race.name)}
          <span style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: "clamp(10px, 8cqw, 14px)", lineHeight: 1.05, ...clamp2 }}>{t.name}</span>
          {coin(cls.icon, cls.name)}
        </div>
        <div style={{ flex: 1, minHeight: 0, margin: 4, border: `2px solid ${ink}`, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle at 50% 50%, ${rc.text}66, ${rc.text}22 75%)` }}>
          <PixelSprite sprite={creatureSprite(t.id)} scale={scaleFor(t.id, 56)} />
        </div>
        <div style={{ display: "flex", borderTop: `2px solid ${ink}`, borderBottom: `2px solid ${ink}`, fontSize: "clamp(8px, 6.6cqw, 12px)", fontWeight: 700, whiteSpace: "nowrap" }}>
          <span style={{ flex: 1, textAlign: "center", padding: "3px 2px", borderRight: `2px solid ${ink}` }}>{race?.name}</span>
          <span style={{ flex: 1, textAlign: "center", padding: "3px 2px" }}>{cls.name}</span>
        </div>
        <div style={{ padding: "4px 6px 6px" }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>{role}</div>
          <div style={{ fontSize: 10, fontStyle: "italic", lineHeight: 1.25, opacity: 0.8, ...clamp2 }}>{t.flavour}</div>
        </div>
      </div>
    </div>
  );
}

// 2 · Stone: the game's dark dungeon panels and pixel font, rarity-coloured trim.
function CardStone({ t }: { t: CreatureTemplate }) {
  const { rc, race, cls, role } = bitsOf(t);
  const line = "#3b3648";
  const coin = (icon: string, title: string, color: string) => (
    <span title={title} style={{ width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, border: `2px solid ${color}`, background: "#0c0b12" }}>{icon}</span>
  );
  return (
    <div style={{ containerType: "inline-size", aspectRatio: "5 / 7", display: "flex", flexDirection: "column", border: `3px solid ${rc.text}`, background: "#17151f", boxShadow: "0 0 0 2px #000, 0 4px 0 rgba(0,0,0,0.5)", color: "#e8e2d2" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 4, borderBottom: `2px solid ${line}` }}>
        {race && coin(race.icon, race.name, race.color)}
        <span className="pixel-font" style={{ flex: 1, textAlign: "center", fontSize: "clamp(9px, 7cqw, 12px)", lineHeight: 1.15, color: rc.text, ...clamp2 }}>{t.name}</span>
        {coin(cls.icon, cls.name, cls.color)}
      </div>
      <div style={{ flex: 1, minHeight: 0, margin: 4, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${line}`, background: `radial-gradient(circle at 50% 55%, ${rc.text}55, ${rc.text}14 75%), #0c0b12` }}>
        <PixelSprite sprite={creatureSprite(t.id)} scale={scaleFor(t.id, 56)} />
      </div>
      <div className="pixel-font" style={{ display: "flex", borderTop: `2px solid ${line}`, borderBottom: `2px solid ${line}`, fontSize: "clamp(7px, 5.6cqw, 11px)", whiteSpace: "nowrap" }}>
        <span style={{ flex: 1, textAlign: "center", padding: "3px 2px", borderRight: `2px solid ${line}`, color: race?.color }}>{race?.name}</span>
        <span style={{ flex: 1, textAlign: "center", padding: "3px 2px", color: cls.color }}>{cls.name}</span>
      </div>
      <div style={{ padding: "4px 6px 6px" }}>
        <div className="pixel-font" style={{ fontSize: 11, color: "#f1d9a0" }}>{role}</div>
        <div style={{ fontSize: 10, lineHeight: 1.25, color: "rgba(255,255,255,0.55)", ...clamp2 }}>{t.flavour}</div>
      </div>
    </div>
  );
}

// 3 · Rarity frame: the whole frame in the rarity colour, light inner panels, bold and clean.
function CardFrame({ t }: { t: CreatureTemplate }) {
  const { rc, race, cls, role } = bitsOf(t);
  const coin = (icon: string, title: string) => (
    <span title={title} style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: "#fff", boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.2)" }}>{icon}</span>
  );
  const panel: React.CSSProperties = { background: "#fbfaf6", borderRadius: 4 };
  return (
    <div style={{ containerType: "inline-size", aspectRatio: "5 / 7", display: "flex", flexDirection: "column", gap: 4, padding: 5, borderRadius: 10, background: `linear-gradient(160deg, ${rc.text}, ${rc.text}bb)`, boxShadow: "0 4px 10px rgba(0,0,0,0.6)", color: "#1d1a16", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {race && coin(race.icon, race.name)}
        <span style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: "clamp(10px, 8cqw, 14px)", lineHeight: 1.05, color: "#1a140c", ...clamp2 }}>{t.name}</span>
        {coin(cls.icon, cls.name)}
      </div>
      <div style={{ ...panel, flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle at 50% 50%, ${rc.text}55, ${rc.text}18 75%), #fbfaf6` }}>
        <PixelSprite sprite={creatureSprite(t.id)} scale={scaleFor(t.id, 56)} />
      </div>
      <div style={{ display: "flex", gap: 4, fontSize: "clamp(8px, 6.6cqw, 12px)", fontWeight: 700, whiteSpace: "nowrap" }}>
        <span style={{ ...panel, flex: 1, textAlign: "center", padding: "3px 2px" }}>{race?.name}</span>
        <span style={{ ...panel, flex: 1, textAlign: "center", padding: "3px 2px" }}>{cls.name}</span>
      </div>
      <div style={{ ...panel, padding: "4px 6px 5px" }}>
        <div style={{ fontWeight: 800, fontSize: 12 }}>{role}</div>
        <div style={{ fontSize: 10, lineHeight: 1.25, opacity: 0.65, ...clamp2 }}>{t.flavour}</div>
      </div>
    </div>
  );
}

const VARIANTS = [
  { key: "1", name: "Parchment", Card: CardParchment },
  { key: "2", name: "Stone", Card: CardStone },
  { key: "3", name: "Rarity frame", Card: CardFrame },
];

export default function CardLab() {
  const beetle = CREATURE_BY_ID.rust_beetle;
  // Others, to see different rarities, races, classes and long names.
  const others = ["rust_beetle", "moss_wolf", "amber_wasp", "monkey_mage", "dire_wolf", "storm_phoenix"]
    .map((id) => CREATURE_BY_ID[id]).filter(Boolean);
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Card designs</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 190px))", gap: 20 }}>
        {VARIANTS.map(({ key, name, Card }) => (
          <div key={key}>
            <div className="pixel-font" style={{ fontSize: 14, marginBottom: 8, color: "#f1d9a0" }}>{key} · {name}</div>
            <Card t={beetle} />
          </div>
        ))}
      </div>
      <h2 className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0", marginTop: 28 }}>At summary size, with other creatures</h2>
      {VARIANTS.map(({ key, Card }) => (
        <div key={key} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 140px)", gap: 10, marginBottom: 16 }}>
          {others.map((t) => <Card key={t.id} t={t} />)}
        </div>
      ))}
    </main>
  );
}
