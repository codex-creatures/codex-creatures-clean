"use client";
// components/BossStage.tsx
// The boss fight's stage: the boss drawn big in its lair, alive.
// - Idle: the Cyclops breathes, the hands scuttle, the Eye floats and glows.
// - Each attack it makes lunges at you; each hit it takes makes it flinch.
// - Phase changes play out as a little scene with a clue to what's
//   happening: the body topples and its hands tear free and run at you;
//   then the Eye bursts out of the skull and rises into the air.

import type { BattleSide } from "@/lib/combat/battle";
import { fieldOf } from "@/lib/combat/battle";
import { CYCLOPS } from "@/lib/combat/bossAi";
import { CYCLOPS_PARTS } from "@/lib/creatures/bosses";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import type { Fx } from "./BattleScreen";

type Scene = "split" | "eye" | null;

// How big each part is drawn (a PixelSprite scale; the art is about 120px for
// the body, 85px a hand and 55px the eye). The body also plays its own fall.
const SCALE: Record<string, number> = { cyclops: 3, cyclops_hand: 1.8, cyclops_eye: 2.4 };

export default function BossStage({ side, fx }: { side: BattleSide; fx: Fx | null }) {
  const t = side.team;
  // A phase change playing right now?
  const scene: Scene = fx?.kind === "lineup" && fx.side === side.key && fx.text
    ? (side.active === CYCLOPS.EYE ? "eye" : "split")
    : null;
  const shown = fieldOf(side).filter((i) => !t[i].hidden);
  const clue = scene ? (fx as Extract<Fx, { kind: "lineup" }>).text : undefined;

  // How a part reacts to this step: lunging, flinching, or nothing.
  const reaction = (i: number) => {
    if (fx?.kind === "attack" && fx.side === side.key && (fx.attackerIndex ?? side.active) === i) return "boss-attack";
    if (fx?.kind === "attack" && fx.side !== side.key && (fx.targetIndex ?? side.active) === i) return fx.missed ? "boss-dodge" : "boss-hit";
    return "";
  };

  return (
    <div className="boss-stage" aria-label="The boss's lair">
      <div className="boss-torch boss-torch-left" />
      <div className="boss-torch boss-torch-right" />
      {scene === "eye" && <div key={`flash-${fx!.id}`} className="boss-flash" />}

      <div className="boss-floor" />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 28, height: "100%", paddingBottom: 14 }}>
        {/* The body topples as its hands tear free. */}
        {scene === "split" && (
          <div key={`fall-${fx!.id}`} className="boss-collapse" style={{ position: "absolute", bottom: 14, left: "50%", marginLeft: -89 }}>
            <PixelSprite sprite={creatureSprite("cyclops")} scale={SCALE.cyclops} style={{ filter: "brightness(0.8) sepia(0.3)" }} />
          </div>
        )}

        {shown.map((i, n) => {
          const id = CYCLOPS_PARTS[i]?.id ?? "cyclops";
          const dead = t[i].hp <= 0;
          const idle = id === "cyclops" ? "boss-breathe" : id === "cyclops_hand" ? (n === 0 ? "boss-scuttle" : "boss-scuttle boss-scuttle-late") : "boss-float";
          const enter = scene === "split" ? (n === 0 ? "boss-burst-left" : "boss-burst-right") : scene === "eye" ? "boss-eye-rise" : "";
          return (
            <div key={`${i}-${scene ? fx!.id : 0}`} className={enter} title={t[i].name}>
              <div key={reaction(i) ? `r-${fx!.id}` : "r"} className={dead ? "boss-dead" : reaction(i)}>
                <div className={dead ? "" : idle}>
                  <PixelSprite sprite={creatureSprite(id)} scale={SCALE[id] ?? 3}
                    style={id === "cyclops_hand" && n === 1 ? { transform: "scaleX(-1)" } : undefined} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {clue && <div key={`clue-${fx!.id}`} className="boss-clue pixel-font">{clue}</div>}
    </div>
  );
}
