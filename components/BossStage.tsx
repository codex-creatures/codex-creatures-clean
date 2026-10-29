"use client";
// components/BossStage.tsx
// The boss fight's stage: the boss drawn big in its lair, alive.
// - Idle: the Cyclops breathes, the hands scuttle, the Eye floats and glows;
//   the Hydra's heads sway.
// - Each attack it makes lunges at you; each hit it takes makes it flinch.
// - Phase changes play out as a little scene with a clue to what's
//   happening: the body topples and its hands tear free and run at you;
//   then the Eye bursts out of the skull and rises into the air.
// - With more than one on the field (the hands, the Hydra's heads) you tap
//   the one to hit. A Hydra's head that's down stays where it fell, with the
//   rounds until it grows back; its poison cloud hangs over the lair.

import type { BattleSide } from "@/lib/combat/battle";
import { fieldOf } from "@/lib/combat/battle";
import { CYCLOPS } from "@/lib/combat/bossAi";
import { BOSS_PARTS_OF } from "@/lib/creatures/bosses";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import type { Fx, MemberInfo } from "./BattleScreen";
import { FighterLabel, FloatText, fighterFx } from "./BattleScreen";

type Scene = "split" | "eye" | null;

// How big each part is drawn (a PixelSprite scale; the art is about 120px for
// the body, 85px a hand and 55px the eye). The body also plays its own fall.
// On a narrow screen each is also capped to a share of the screen's width
// (MAX_W), so the boss and your creature both fit in the lair.
const SCALE: Record<string, number> = { cyclops: 3, cyclops_hand: 1.8, cyclops_eye: 2.4, hydra_fang: 1.4, hydra_spitter: 1.4, hydra_hex: 1.4 };
const MAX_W: Record<string, string> = { cyclops: "40cqw", cyclops_hand: "20cqw", cyclops_eye: "18cqw", hydra_fang: "17cqw", hydra_spitter: "17cqw", hydra_hex: "17cqw" };
// 🧪 Stand-in art: the three heads are the Void Serpent, tinted apart, until their own PixelLab art.
const TINT: Record<string, string> = { hydra_spitter: "hue-rotate(90deg)", hydra_hex: "hue-rotate(220deg)" };
const fit = (id: string): React.CSSProperties => ({ maxWidth: MAX_W[id] ?? "40cqw", height: "auto", ...(TINT[id] ? { filter: TINT[id] } : {}) });
// The boss stands in the right part of the lair; your creature on the left.
const BOSS_SIDE: React.CSSProperties = { paddingLeft: "38%", paddingRight: "2%" };

// target / onTarget: the part you're aiming at, and tapping another (only
// while you can act). cloud: rounds the Hydra's poison cloud still hangs.
export default function BossStage({ side, fx, you, infos, target, onTarget, cloud = 0 }: {
  side: BattleSide; fx: Fx | null; you?: React.ReactNode; infos?: MemberInfo[];
  target?: number; onTarget?: (index: number) => void; cloud?: number;
}) {
  const t = side.team;
  const kind = side.boss?.kind ?? "cyclops";
  const parts = BOSS_PARTS_OF[kind];
  // A phase change playing right now?
  const scene: Scene = kind === "cyclops" && fx?.kind === "lineup" && fx.side === side.key && fx.text
    ? (side.active === CYCLOPS.EYE ? "eye" : "split")
    : null;
  const shown = fieldOf(side).filter((i) => !t[i].hidden);
  const clue = scene ? (fx as Extract<Fx, { kind: "lineup" }>).text : undefined;
  const aiming = shown.filter((i) => t[i].hp > 0).length > 1; // more than one to choose from

  // How a part reacts to this step: lunging, flinching, or nothing.
  const reaction = (i: number) => {
    if (fx?.kind === "attack" && fx.side === side.key && (fx.attackerIndex ?? side.active) === i) return "boss-attack";
    if (fx?.kind === "attack" && fx.side !== side.key && (fx.targetIndex ?? side.active) === i) return fx.missed ? "boss-dodge" : "boss-hit";
    return "";
  };
  // The damage (or MISS, or effect) floating up off a part this step.
  // (A step naming no part means the one in front.)
  const float = (i: number) => {
    const at = fx?.kind === "attack" ? fx.targetIndex : fx?.kind === "effect" ? fx.index : undefined;
    return (at ?? side.active) === i ? fighterFx(side.key, i, fx).float : null;
  };

  return (
    <div className="boss-stage" aria-label="The boss's lair">
      <div className="boss-torch boss-torch-left" />
      <div className="boss-torch boss-torch-right" />
      {scene === "eye" && <div key={`flash-${fx!.id}`} className="boss-flash" />}
      {cloud > 0 && <div className="boss-cloud" />}

      <div className="boss-floor" />
      {you}
      {/* The body topples as its hands tear free. */}
      {scene === "split" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 14, ...BOSS_SIDE }}>
          <div key={`fall-${fx!.id}`} className="boss-collapse">
            <PixelSprite sprite={creatureSprite("cyclops")} scale={SCALE.cyclops} style={{ ...fit("cyclops"), filter: "brightness(0.8) sepia(0.3)" }} />
          </div>
        </div>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "4%", height: "100%", paddingBottom: 14, ...BOSS_SIDE }}>

        {shown.map((i, n) => {
          const id = parts[i]?.id ?? "cyclops";
          const dead = t[i].hp <= 0;
          const idle = id === "cyclops" ? "boss-breathe" : id === "cyclops_hand" ? (n === 0 ? "boss-scuttle" : "boss-scuttle boss-scuttle-late") : id === "cyclops_eye" ? "boss-float" : "boss-breathe";
          const enter = scene === "split" ? (n === 0 ? "boss-burst-left" : "boss-burst-right") : scene === "eye" ? "boss-eye-rise" : "";
          const tappable = aiming && !dead && !!onTarget;
          const aimed = aiming && !dead && i === target;
          return (
            <div key={`${i}-${scene ? fx!.id : 0}`} className={enter} title={t[i].name}
              onClick={tappable ? () => onTarget!(i) : undefined} role={tappable ? "button" : undefined} aria-label={tappable ? `Aim at the ${t[i].name}` : undefined}
              style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44, cursor: tappable ? "pointer" : undefined }}>
              {/* Its name and health float above it, like any foe's. */}
              <FighterLabel f={t[i]} side={side.key} mi={infos?.[i]} />
              {/* 🎯 over the one you're aiming at; a cut-down head's rounds until it grows back. (Space kept either way.) */}
              <div className="pixel-font" style={{ fontSize: 11, height: 14, color: dead ? "#ff8a8a" : "#ffd66e", visibility: aimed || (dead && side.boss?.regrow) ? "visible" : "hidden" }}>
                {dead ? `🩸 ${side.boss?.regrow ?? ""}` : "🎯"}
              </div>
              {float(i) && <FloatText key={`f${fx!.id}`} float={float(i)!} top={0} />}
              <div key={reaction(i) ? `r-${fx!.id}` : "r"} className={dead ? "boss-dead" : reaction(i)} style={{ marginTop: 4 }}>
                <div className={dead ? "" : idle} style={aimed ? { filter: "drop-shadow(0 0 6px #ffd66e)" } : undefined}>
                  <PixelSprite sprite={creatureSprite(id)} scale={SCALE[id] ?? 3}
                    style={{ ...fit(id), ...(id === "cyclops_hand" && n === 1 ? { transform: "scaleX(-1)" } : {}) }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {cloud > 0 && <div className="boss-cloud-tag pixel-font">☠️ Poison cloud · {cloud}</div>}
      {clue && <div key={`clue-${fx!.id}`} className="boss-clue pixel-font">{clue}</div>}
    </div>
  );
}
