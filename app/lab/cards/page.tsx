"use client";
// app/lab/cards/page.tsx — the creature card design, being refined (dev tool).
// Structure from the user's MTG example: a bold name bar; the art (sprite on
// a faded rarity colour, filling the box with 5% clear each side); a type
// bar (race — attack style, with a rarity gem); a clean text box with the
// role and a line of flavour. The frame is the rarity colour, weathered and
// cracked; the inside stays clean. Shown with and without a black outer
// trim. The winner replaces CardFace in components/CardGallery.tsx.

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

// Cracks for the frame: dark fissures with a light lip, mostly around the
// edges (the middle is hidden under the art and text). Stretched to the card.
const CRACK_PATHS = [
  "M0 12 L3 13 L5 11 L8 12.5", "M0 47 L2.5 48 L4 46.5 L6 47.5", "M0 96 L3 95 L4.5 97 L7 96",
  "M100 25 L97 26 L95.5 24.5 L93 25.5", "M100 70 L97.5 71 L96 69 L93.5 70.5", "M100 118 L97 117 L95 119",
  "M18 0 L19 2.5 L17.5 4 L18.5 6", "M64 0 L63 3 L65 4.5", "M84 0 L85 2 L83.5 3.5",
  "M30 140 L31 137.5 L29.5 136 L30.5 134", "M72 140 L71 137 L73 135.5", "M8 140 L10 138 L9 136",
  "M0 132 L4 130 L5.5 132.5 L9 131", "M100 4 L96 6 L97.5 8",
];
const CRACK_SVG = (dark: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140' preserveAspectRatio='none'>` +
  CRACK_PATHS.map((d) => `<path d='${d}' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='0.7' transform='translate(0.35 0.35)'/><path d='${d}' fill='none' stroke='${dark}' stroke-width='0.6'/>`).join("") +
  `</svg>`)}")`;

// Weathering: darker and lighter blotches over the frame colour.
const weathered = (rc: string) => [
  CRACK_SVG(shade(rc, -0.7)),
  `radial-gradient(ellipse 30% 18% at 12% 20%, ${shade(rc, -0.35)}aa, transparent)`,
  `radial-gradient(ellipse 25% 15% at 88% 60%, ${shade(rc, -0.3)}aa, transparent)`,
  `radial-gradient(ellipse 35% 20% at 30% 92%, ${shade(rc, -0.35)}99, transparent)`,
  `radial-gradient(ellipse 20% 25% at 85% 8%, ${shade(rc, 0.25)}88, transparent)`,
  `linear-gradient(160deg, ${shade(rc, 0.05)}, ${shade(rc, -0.3)})`,
].join(", ");

const SERIF = "Georgia, 'Times New Roman', serif";
const clamp2: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

function Card({ t, blackTrim }: { t: CreatureTemplate; blackTrim: boolean }) {
  const rc = RARITY_COLORS[t.rarity].text, race = t.race && RACE_INFO[t.race], cls = CLASS_INFO[t.cls];
  const ink = "#15110c";
  // The name and type bars: pale rarity colour, a little raised.
  const bar: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "2cqw", padding: "1.6cqw 3.5cqw", borderRadius: "2.5cqw / 50%",
    background: `linear-gradient(180deg, ${shade(rc, 0.82)}, ${shade(rc, 0.62)})`, color: ink,
    border: `1px solid ${shade(rc, -0.6)}`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 ${shade(rc, -0.2)}, 0 1px 2px rgba(0,0,0,0.5)`,
  };
  return (
    // The outer box is the size container, so cqw below means "% of the card's width".
    <div style={{ containerType: "inline-size" }}>
      <div style={{
        aspectRatio: "5 / 7", borderRadius: "4.5cqw", padding: blackTrim ? "3.2cqw" : 0,
        background: blackTrim ? "#0b0a09" : "transparent", boxShadow: "0 4px 10px rgba(0,0,0,0.6)",
      }}>
        <div style={{
          height: "100%", display: "flex", flexDirection: "column", gap: "2.2cqw", padding: "3.5cqw 3cqw 4cqw",
          borderRadius: blackTrim ? "2cqw" : "4.5cqw", background: weathered(rc),
          boxShadow: blackTrim ? `inset 0 0 0 1px ${shade(rc, 0.3)}` : `inset 0 0 0 2px ${shade(rc, -0.55)}, inset 0 0 0 3px ${shade(rc, 0.25)}`,
        }}>
          {/* Name. */}
          <div style={bar}>
            <span style={{ flex: 1, fontFamily: SERIF, fontWeight: 900, fontSize: "clamp(10px, 8cqw, 17px)", lineHeight: 1.1, letterSpacing: "0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t.name}
            </span>
          </div>

          {/* Art: the sprite fills it, 5% clear on every side. */}
          <div style={{
            position: "relative", flex: 1, minHeight: 0, margin: "0 2cqw",
            background: `radial-gradient(circle at 50% 50%, ${rc}55, ${rc}1c 70%), #f7f4ec`,
            border: `1px solid ${ink}`, boxShadow: `0 0 0 1px ${shade(rc, 0.3)}, inset 0 0 6px rgba(0,0,0,0.25)`,
          }}>
            <div style={{ position: "absolute", inset: "5%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PixelSprite sprite={creatureSprite(t.id)} scale={4} title={t.name}
                style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }} />
            </div>
          </div>

          {/* Type line: race — attack style, and a rarity gem (like a set symbol). */}
          <div style={bar}>
            <span style={{ flex: 1, fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(7px, 5.8cqw, 13px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {race?.name} — {cls.name}
            </span>
            <span title={t.rarity} style={{ width: "5cqw", height: "5cqw", flexShrink: 0, transform: "rotate(45deg)", background: rc, border: `1px solid ${ink}`, boxShadow: `inset 1px 1px 0 ${shade(rc, 0.5)}` }} />
          </div>

          {/* Text box: clean and light. */}
          <div style={{
            margin: "0 2cqw", padding: "2.5cqw 4cqw 3cqw", background: shade(rc, 0.9), color: ink,
            border: `1px solid ${shade(rc, -0.5)}`, boxShadow: "inset 0 0 4px rgba(0,0,0,0.12)",
          }}>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(9px, 7cqw, 14px)" }}>{roleOf(t)}</div>
            <div style={{ height: 1, margin: "1.5cqw 0", background: `linear-gradient(90deg, transparent, ${shade(rc, -0.4)}, transparent)` }} />
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "clamp(8px, 5.8cqw, 11px)", lineHeight: 1.2, height: "2.4em", ...clamp2 }}>
              {shortFlavour(t.flavour)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TRIMS = [
  { key: "A", name: "Black trim", blackTrim: true },
  { key: "B", name: "No black trim", blackTrim: false },
];

export default function CardLab() {
  const ids = ["rust_beetle", "moss_wolf", "monkey_mage", "dire_wolf", "storm_phoenix"];
  const creatures = ids.map((id) => CREATURE_BY_ID[id]).filter(Boolean);
  const beetle = CREATURE_BY_ID.rust_beetle;
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Creature card</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 240px)", gap: 24 }}>
        {TRIMS.map(({ key, name, blackTrim }) => (
          <div key={key}>
            <div className="pixel-font" style={{ fontSize: 14, marginBottom: 8, color: "#f1d9a0" }}>{key} · {name}</div>
            <Card t={beetle} blackTrim={blackTrim} />
          </div>
        ))}
      </div>
      <h2 className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0", marginTop: 28 }}>At summary size</h2>
      {TRIMS.map(({ key, blackTrim }) => (
        <div key={key} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 140px)", gap: 12, marginBottom: 16 }}>
          {creatures.map((t) => <Card key={t.id} t={t} blackTrim={blackTrim} />)}
        </div>
      ))}
    </main>
  );
}
