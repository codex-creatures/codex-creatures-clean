"use client";
// components/BossStage.tsx
// The boss fight's stage: the boss drawn big in its lair, alive.
// - Idle: the Cyclops breathes, the hands scuttle, the Eye floats and glows;
//   the Hydra breathes, its three heads on one body (HydraBody).
// - Each attack it makes lunges at you; each hit it takes makes it flinch.
// - Phase changes play out as a little scene with a clue to what's
//   happening: the body topples and its hands tear free and run at you;
//   then the Eye bursts out of the skull and rises into the air.
// - With more than one on the field (the hands, the Hydra's heads) you tap
//   the one to hit. A Hydra's head that's down stays where it fell, with the
//   rounds until it grows back; its poison cloud hangs over the lair.

import type { BattleSide, GroundEffect } from "@/lib/combat/battle";
import GroundEffects from "./GroundEffects";
import { fieldOf } from "@/lib/combat/battle";
import { CYCLOPS } from "@/lib/combat/bossAi";
import { BOSS_PARTS_OF, HYDRA_PARTS } from "@/lib/creatures/bosses";
import { HYDRA_HEADS, hydraSprite } from "@/lib/sprites/creatures";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import type { Fx, MemberInfo } from "./BattleScreen";
import { FighterLabel, LingeringFloat, fighterFx } from "./BattleScreen";

type Scene = "split" | "eye" | null;

// How big each part is drawn (a PixelSprite scale; the art is about 120px for
// the body, 85px a hand and 55px the eye). The body also plays its own fall.
// On a narrow screen each is also capped to a share of the screen's width
// (MAX_W), so the boss and your creature both fit in the lair.
// (The Hydra is drawn whole, by HydraBody below.)
const SCALE: Record<string, number> = { cyclops: 3, cyclops_hand: 1.8, cyclops_eye: 2.4 };
const MAX_W: Record<string, string> = { cyclops: "40cqw", cyclops_hand: "20cqw", cyclops_eye: "18cqw" };
// Standing on a diagonal, as in a room (the user, 2026-11-04): the boss
// further back in its lair, raised (BOSS_BACK) and drawn at BOSS_DEPTH of its
// size; your creature near and low in front (BattleScreen passes it in).
const BOSS_DEPTH = 0.8;
const BOSS_BACK = "14%";
const fit = (id: string): React.CSSProperties => ({ maxWidth: `calc(${MAX_W[id] ?? "40cqw"} * ${BOSS_DEPTH})`, height: "auto" });
const size = (id: string) => (SCALE[id] ?? 3) * BOSS_DEPTH;
// The boss stands in the right part of the lair; your creature on the left.
const BOSS_SIDE: React.CSSProperties = { paddingLeft: "38%", paddingRight: "2%", paddingBottom: BOSS_BACK };

// target / onTarget: the part you're aiming at, and tapping another (only
// while you can act). cloud: rounds the Hydra's poison cloud still hangs.
// ground: what lies under the boss (your Blood Sacrifice).
export default function BossStage({ side, fx, you, infos, target, onTarget, cloud = 0, ground }: {
  side: BattleSide; fx: Fx | null; you?: React.ReactNode; infos?: MemberInfo[];
  target?: number; onTarget?: (index: number) => void; cloud?: number; ground?: GroundEffect[];
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
      <GroundEffects ground={ground} at={{ left: "66%", width: "58%", bottom: `calc(${BOSS_BACK} - 8%)`, zIndex: 0 }} />
      {/* The body topples as its hands tear free. */}
      {scene === "split" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", ...BOSS_SIDE }}>
          <div key={`fall-${fx!.id}`} className="boss-collapse">
            <PixelSprite sprite={creatureSprite("cyclops")} scale={size("cyclops")} style={{ ...fit("cyclops"), filter: "brightness(0.8) sepia(0.3)" }} />
          </div>
        </div>
      )}
      {kind === "hydra" ? (
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", height: "100%", ...BOSS_SIDE }}>
          <HydraBody side={side} infos={infos} fx={fx} target={target} onTarget={aiming ? onTarget : undefined} reaction={reaction} float={float} />
        </div>
      ) : (
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "4%", height: "100%", ...BOSS_SIDE }}>

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
              <LingeringFloat float={float(i)} id={fx?.id} top={0} />
              <div key={reaction(i) ? `r-${fx!.id}` : "r"} className={dead ? "boss-dead" : reaction(i)} style={{ marginTop: 4 }}>
                <div className={dead ? "" : idle} style={aimed ? { filter: "drop-shadow(0 0 6px #ffd66e)" } : undefined}>
                  <PixelSprite sprite={creatureSprite(id)} scale={size(id)}
                    style={{ ...fit(id), ...(id === "cyclops_hand" && n === 1 ? { transform: "scaleX(-1)" } : {}) }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
      {/* Yours last: nearer, so in front where they overlap. */}
      {you}

      {cloud > 0 && <div className="boss-cloud-tag pixel-font">☠️ Poison cloud · {cloud}</div>}
      {clue && <div key={`clue-${fx!.id}`} className="boss-clue pixel-font">{clue}</div>}
    </div>
  );
}

// The Hydra: one body, its three heads' names and health in a row above it
// (left to right, as the heads are drawn). A head that's cut down shows as a
// bloody stump (its own picture for each mix of heads down) with the rounds
// until it grows back. Tap a head, or its label, to aim at it.
// Where each head is in the picture (% of it: left, top, width, height),
// found by its name, so a fight saved before the heads were reordered still
// lines up.
const HYDRA_HEAD_AT: Record<string, [number, number, number, number]> = {
  "Spitter Head": [2, 10, 25, 42], "Hex Head": [27, 2, 21, 36], "Fang Head": [50, 11, 25, 31],
};
const HYDRA_W = "46cqw";
function HydraBody({ side, infos, fx, target, onTarget, reaction, float }: {
  side: BattleSide; infos?: MemberInfo[]; fx: Fx | null; target?: number; onTarget?: (index: number) => void;
  reaction: (i: number) => string; float: (i: number) => ReturnType<typeof fighterFx>["float"];
}) {
  const t = side.team;
  const heads = t.map((f, i) => ({ f, i }));
  const nameOf = (id: string) => HYDRA_PARTS.find((p) => p.id === id)?.name;
  const down = HYDRA_HEADS.map((id) => t.some((f) => f.name === nameOf(id) && f.hp <= 0));
  const allDown = heads.every((h) => h.f.hp <= 0);
  // The whole beast lunges or flinches with whichever head this step is about.
  const react = heads.map((h) => reaction(h.i)).find(Boolean) ?? "";
  const reactKey = react ? `r-${fx!.id}` : "r";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${heads.length}, 1fr)`, width: "100%", gap: 2 }}>
        {heads.map(({ f, i }) => {
          const dead = f.hp <= 0;
          const aimed = !!onTarget && !dead && i === target;
          return (
            <div key={i} onClick={onTarget && !dead ? () => onTarget(i) : undefined} role={onTarget && !dead ? "button" : undefined}
              aria-label={onTarget && !dead ? `Aim at the ${f.name}` : undefined}
              style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0, minHeight: 44, cursor: onTarget && !dead ? "pointer" : undefined }}>
              <FighterLabel f={f} side={side.key} mi={infos?.[i]} />
              <div className="pixel-font" style={{ fontSize: 11, height: 14, color: dead ? "#ff8a8a" : "#ffd66e", visibility: aimed || (dead && side.boss?.regrow) ? "visible" : "hidden" }}>
                {dead ? `🩸 ${side.boss?.regrow ?? ""}` : "🎯"}
              </div>
              <LingeringFloat float={float(i)} id={fx?.id} top={0} />
            </div>
          );
        })}
      </div>
      <div key={reactKey} className={allDown ? "boss-dead" : react} style={{ position: "relative", width: `calc(${HYDRA_W} * ${BOSS_DEPTH})`, marginTop: 2 }}>
        <div className={allDown ? "" : "boss-breathe"}>
          <PixelSprite sprite={hydraSprite(down)} scale={3} title="The Hydra" style={{ width: "100%", height: "auto" }} />
        </div>
        {onTarget && heads.map(({ f, i }) => {
          const at = HYDRA_HEAD_AT[f.name];
          if (!at || f.hp <= 0) return null;
          return <div key={i} onClick={() => onTarget(i)} role="button" aria-label={`Aim at the ${f.name}`}
            style={{ position: "absolute", left: `${at[0]}%`, top: `${at[1]}%`, width: `${at[2]}%`, height: `${at[3]}%`, cursor: "pointer",
              ...(i === target ? { filter: "drop-shadow(0 0 6px #ffd66e)" } : {}) }} />;
        })}
      </div>
    </div>
  );
}
