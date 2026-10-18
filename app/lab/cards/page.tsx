"use client";
// app/lab/cards/page.tsx — three trial designs for the creature card (dev tool).
// Pick one and it replaces CardFace in components/CardGallery.tsx.

import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CLASS_INFO, CREATURE_BY_ID, RACE_INFO, type CreatureTemplate } from "@/lib/creatures/creatureData";
import { spriteWidth } from "@/lib/sprites/pixels";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";

const SERIF = "Georgia, 'Times New Roman', serif";
const scaleFor = (id: string, px: number) => Math.max(1, Math.floor(px / spriteWidth(creatureSprite(id))));

// A: the current card, tidied — smaller art, race as an icon, a style banner, no flavour text.
function CardA({ t }: { t: CreatureTemplate }) {
  const rc = RARITY_COLORS[t.rarity], race = t.race && RACE_INFO[t.race], cls = CLASS_INFO[t.cls];
  return (
    <div style={{ aspectRatio: "5 / 7", padding: 6, borderRadius: 10, background: `linear-gradient(145deg, ${rc.text}, #2a2418 55%, ${rc.text})`, boxShadow: "0 4px 10px rgba(0,0,0,0.6)" }}>
      <div style={{ height: "100%", borderRadius: 6, display: "flex", flexDirection: "column", gap: 6, padding: 7, background: "linear-gradient(180deg, #f3e6c4, #e2cf9f)", color: "#2b1d10", fontFamily: SERIF }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.1 }}>{t.name}</span>
          {race && <span title={race.name} style={{ fontSize: 14 }}>{race.icon}</span>}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "2px solid #8a6a3a", boxShadow: "inset 0 0 12px rgba(0,0,0,0.35)", background: `radial-gradient(circle at 50% 45%, ${race?.color ?? "#999"}aa, #2b2235 80%)` }}>
          <PixelSprite sprite={creatureSprite(t.id)} scale={scaleFor(t.id, 52)} />
        </div>
        <div style={{ textAlign: "center", padding: "3px 0", borderRadius: 4, background: cls.color, color: "#1a140c", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {cls.icon} {cls.name}
        </div>
      </div>
    </div>
  );
}

// B: dark game-UI card — rarity edge, art on top, a two-cell footer (style | race icon).
function CardB({ t }: { t: CreatureTemplate }) {
  const rc = RARITY_COLORS[t.rarity], race = t.race && RACE_INFO[t.race], cls = CLASS_INFO[t.cls];
  return (
    <div style={{ aspectRatio: "5 / 7", display: "flex", flexDirection: "column", border: `3px solid ${rc.text}`, background: "#14121c", boxShadow: `0 0 0 2px #000, 0 4px 0 rgba(0,0,0,0.5), inset 0 0 18px ${rc.glow}` }}>
      <div className="pixel-font" style={{ padding: "6px 7px 4px", fontSize: 13, color: rc.text, textAlign: "center", lineHeight: 1.1 }}>{t.name}</div>
      <div style={{ flex: 1, margin: "0 7px", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle at 50% 55%, ${rc.glow}, transparent 70%), #0c0b12`, border: "2px solid #2c2838" }}>
        <PixelSprite sprite={creatureSprite(t.id)} scale={scaleFor(t.id, 56)} />
      </div>
      <div style={{ display: "flex", margin: 7, gap: 4 }}>
        <div className="pixel-font" style={{ flex: 1, padding: "4px 0", textAlign: "center", fontSize: 11, color: cls.color, background: "#0c0b12", border: `2px solid ${cls.color}` }}>
          {cls.icon} {cls.name.toUpperCase()}
        </div>
        {race && <div title={race.name} style={{ width: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0b12", border: `2px solid ${race.color}`, fontSize: 13 }}>{race.icon}</div>}
      </div>
    </div>
  );
}

// C: full-art — the creature fills the card, name across the top, style ribbon at the bottom, race gem in the corner.
function CardC({ t }: { t: CreatureTemplate }) {
  const rc = RARITY_COLORS[t.rarity], race = t.race && RACE_INFO[t.race], cls = CLASS_INFO[t.cls];
  return (
    <div style={{ position: "relative", aspectRatio: "5 / 7", borderRadius: 10, overflow: "hidden", border: `3px solid ${rc.text}`, boxShadow: "0 4px 10px rgba(0,0,0,0.6)", background: `radial-gradient(circle at 50% 50%, ${race?.color ?? "#999"}88, #1b1622 75%)` }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 10 }}>
        <PixelSprite sprite={creatureSprite(t.id)} scale={scaleFor(t.id, 60)} />
      </div>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "7px 8px 14px", background: "linear-gradient(180deg, rgba(0,0,0,0.75), transparent)", fontFamily: SERIF, fontWeight: 700, fontSize: 14, color: "#f6ead0", textShadow: "0 1px 2px #000" }}>
        {t.name}
      </div>
      {race && <div title={race.name} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: "#1a140c", border: `2px solid ${race.color}` }}>{race.icon}</div>}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "5px 0", textAlign: "center", background: `linear-gradient(90deg, transparent, ${cls.color}dd 20%, ${cls.color}dd 80%, transparent)`, color: "#1a140c", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {cls.icon} {cls.name}
      </div>
    </div>
  );
}

const VARIANTS = [
  { key: "A", name: "Parchment, tidied", Card: CardA },
  { key: "B", name: "Dark game panel", Card: CardB },
  { key: "C", name: "Full art", Card: CardC },
];

export default function CardLab() {
  const beetle = CREATURE_BY_ID.rust_beetle;
  // A few others, to see how each design copes with long names and other races/classes.
  const others = ["rust_beetle", ...Object.keys(CREATURE_BY_ID).filter((id) => CREATURE_BY_ID[id].race).slice(0, 4)]
    .filter((id, i, a) => a.indexOf(id) === i).map((id) => CREATURE_BY_ID[id]);
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Card designs</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 20, maxWidth: 640 }}>
        {VARIANTS.map(({ key, name, Card }) => (
          <div key={key}>
            <div className="pixel-font" style={{ fontSize: 14, marginBottom: 8, color: "#f1d9a0" }}>{key} · {name}</div>
            <Card t={beetle} />
          </div>
        ))}
      </div>
      <h2 className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0", marginTop: 28 }}>At summary size, with other creatures</h2>
      {VARIANTS.map(({ key, Card }) => (
        <div key={key} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10, marginBottom: 16, maxWidth: 640 }}>
          {others.map((t) => <Card key={t.id} t={t} />)}
        </div>
      ))}
    </main>
  );
}
