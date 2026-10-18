"use client";
// app/lab/cards/page.tsx — the creature card design, being refined (dev tool).
// Layout from the user's sketch: name; the sprite on a faded rarity colour
// (filling the box, 5% clear each side); a Race | Attack style row; then the
// creature's role over one line of flavour. Three looks in the game's own
// style (stone, wood, pixel bevels) to choose from; the winner replaces
// CardFace in components/CardGallery.tsx.

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

// Blend a #rrggbb colour toward white (amt > 0) or black (amt < 0).
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16), to = amt > 0 ? 255 : 0, a = Math.abs(amt);
  const ch = (v: number) => Math.round(v + (to - v) * a).toString(16).padStart(2, "0");
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

// Pixel bevels: raised (light top-left, dark bottom-right) and sunken (the reverse).
const raised = (base: string, px = 2) => `inset ${px}px ${px}px 0 ${shade(base, 0.3)}, inset -${px}px -${px}px 0 ${shade(base, -0.4)}`;
const sunken = (base: string, px = 2) => `inset ${px}px ${px}px 0 ${shade(base, -0.45)}, inset -${px}px -${px}px 0 ${shade(base, 0.15)}`;

const PIXEL = "var(--font-pixel), 'Courier New', monospace";
const clamp2: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

type Look = {
  frame: React.CSSProperties;   // the outer card
  name: React.CSSProperties;    // the name banner
  art: (rarity: string) => React.CSSProperties;
  plaque: (color: string) => React.CSSProperties; // race / style cells
  info: React.CSSProperties;    // role + flavour box
  role: string; flavour: string; // their text colours
};

function Card({ t, look }: { t: CreatureTemplate; look: Look }) {
  const rc = RARITY_COLORS[t.rarity].text, race = t.race && RACE_INFO[t.race], cls = CLASS_INFO[t.cls];
  return (
    // The outer box is the size container, so cqw below means "% of the card's width".
    <div style={{ containerType: "inline-size" }}>
    <div style={{ aspectRatio: "5 / 7", display: "flex", flexDirection: "column", gap: "3cqw", padding: "5.5cqw", ...look.frame }}>
      <div style={{ textAlign: "center", fontFamily: PIXEL, fontSize: "clamp(9px, 7.5cqw, 15px)", lineHeight: 1.15, padding: "2.5cqw 3cqw", ...clamp2, ...look.name }}>
        {t.name}
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 0, ...look.art(rc) }}>
        <div style={{ position: "absolute", inset: "5%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PixelSprite sprite={creatureSprite(t.id)} scale={4} title={t.name}
            style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "3cqw", fontFamily: PIXEL, fontSize: "clamp(7px, 5.6cqw, 11px)", whiteSpace: "nowrap" }}>
        <span style={{ flex: 1, textAlign: "center", padding: "2cqw 1cqw", ...look.plaque(race?.color ?? "#999") }}>{race?.name}</span>
        <span style={{ flex: 1, textAlign: "center", padding: "2cqw 1cqw", ...look.plaque(cls.color) }}>{cls.name}</span>
      </div>
      <div style={{ padding: "2.5cqw 4cqw 3cqw", ...look.info }}>
        <div style={{ fontFamily: PIXEL, fontSize: "clamp(8px, 6.4cqw, 12px)", color: look.role }}>{roleOf(t)}</div>
        <div style={{ fontSize: "clamp(8px, 5.8cqw, 10px)", lineHeight: 1.2, height: "2.4em", marginTop: 1, color: look.flavour, ...clamp2 }}>{shortFlavour(t.flavour)}</div>
      </div>
    </div>
    </div>
  );
}

// 1 · Stone: the game's stone panels. A rarity-coloured bevelled rim around
// dark stone; the art and text sit in sunken wells.
const stoneLook = (rc: string): Look => ({
  frame: {
    background: "#23262f", border: `3px solid ${shade(rc, -0.55)}`,
    boxShadow: `inset 0 0 0 2px ${rc}, inset 4px 4px 0 ${shade(rc, 0.35)}, inset -4px -4px 0 ${shade(rc, -0.35)}, inset 6px 6px 0 #3a3e4b, inset -6px -6px 0 #181a21, 0 4px 0 rgba(0,0,0,0.5)`,
  },
  name: { color: "#f1d9a0", textShadow: "1px 1px 0 #000" },
  art: (r) => ({ background: `radial-gradient(circle at 50% 50%, ${r}66, ${r}1a 70%), #15171d`, boxShadow: sunken("#2a2d36", 3) }),
  plaque: (c) => ({ background: "#2e323d", color: c, boxShadow: raised("#2e323d") }),
  info: { background: "#191b22", boxShadow: sunken("#2a2d36") },
  role: "#f1d9a0", flavour: "rgba(255,255,255,0.6)",
});

// 2 · Wood & brass: the warm wooden frame of the game's buttons, a rarity
// stripe under the name, parchment wells.
const woodLook = (rc: string): Look => ({
  frame: { background: "#5a3b1c", border: "3px solid #1d1209", boxShadow: "inset 3px 3px 0 #8a5f2f, inset -3px -3px 0 #3a250f, 0 4px 0 rgba(0,0,0,0.5)" },
  name: { color: "#ffe9b0", textShadow: "1px 1px 0 #1d1209", borderBottom: `3px solid ${rc}`, boxShadow: `0 2px 0 ${shade(rc, -0.5)}` },
  art: (r) => ({ background: `radial-gradient(circle at 50% 50%, ${r}55, ${r}14 70%), #efe2c0`, border: "2px solid #1d1209", boxShadow: sunken("#cdb98c", 3) }),
  plaque: () => ({ background: "#3a250f", color: "#ffe9b0", border: "2px solid #1d1209", boxShadow: raised("#4a3015") }),
  info: { background: "#efe2c0", border: "2px solid #1d1209", boxShadow: sunken("#cdb98c") },
  role: "#3a250f", flavour: "rgba(43,29,16,0.75)",
});

// 3 · Rarity metal: a thick stepped-bevel rim in the rarity colour (like a
// minted metal frame), the name on a dark rarity ribbon, dark stone inside.
const metalLook = (rc: string): Look => ({
  frame: {
    background: `linear-gradient(160deg, ${shade(rc, 0.15)}, ${shade(rc, -0.25)})`, border: "3px solid #0d0e13",
    boxShadow: `inset 3px 3px 0 ${shade(rc, 0.5)}, inset -3px -3px 0 ${shade(rc, -0.5)}, inset 6px 6px 0 ${shade(rc, 0.2)}, inset -6px -6px 0 ${shade(rc, -0.3)}, 0 4px 0 rgba(0,0,0,0.5)`,
  },
  name: { color: "#fff6dc", background: shade(rc, -0.55), textShadow: "1px 1px 0 #000", boxShadow: sunken(shade(rc, -0.4)) },
  art: (r) => ({ background: `radial-gradient(circle at 50% 50%, ${r}66, ${r}1a 70%), #15171d`, border: "2px solid #0d0e13", boxShadow: sunken("#2a2d36", 3) }),
  plaque: (c) => ({ background: "#1b1d24", color: c, border: "2px solid #0d0e13", boxShadow: raised("#2a2d36") }),
  info: { background: "#1b1d24", border: "2px solid #0d0e13", boxShadow: sunken("#2a2d36") },
  role: "#f1d9a0", flavour: "rgba(255,255,255,0.6)",
});

const LOOKS = [
  { key: "1", name: "Stone", make: stoneLook },
  { key: "2", name: "Wood & brass", make: woodLook },
  { key: "3", name: "Rarity metal", make: metalLook },
];

export default function CardLab() {
  const ids = ["rust_beetle", "moss_wolf", "monkey_mage", "dire_wolf", "storm_phoenix"];
  const creatures = ids.map((id) => CREATURE_BY_ID[id]).filter(Boolean);
  const beetle = CREATURE_BY_ID.rust_beetle;
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Creature card</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 220px)", gap: 20 }}>
        {LOOKS.map(({ key, name, make }) => (
          <div key={key}>
            <div className="pixel-font" style={{ fontSize: 14, marginBottom: 8, color: "#f1d9a0" }}>{key} · {name}</div>
            <Card t={beetle} look={make(RARITY_COLORS[beetle.rarity].text)} />
          </div>
        ))}
      </div>
      <h2 className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0", marginTop: 28 }}>At summary size</h2>
      {LOOKS.map(({ key, make }) => (
        <div key={key} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 140px)", gap: 12, marginBottom: 16 }}>
          {creatures.map((t) => <Card key={t.id} t={t} look={make(RARITY_COLORS[t.rarity].text)} />)}
        </div>
      ))}
    </main>
  );
}
