"use client";
// components/klutz/KlutzStory.tsx
// Klutz's trip told as a story (the user, 2026-11-18): every fight and find in
// the order they happened, with how far in it was. A fight says what it was,
// how long it went, the damage he took and how it ended (caught, got away,
// let go for the cage or the cage filter, or it beat him); a creature's
// dropped gear follows it; a find says what it was (a skill's extra find says
// which skill spotted it); a find under his Selective rarity says he left it.
// It ends with why he came home, or, while he's out, that he's still going.
// In a scrolling panel that keeps the newest line in view.

import { useEffect, useRef } from "react";
import PixelSprite, { creatureSprite, itemSprite } from "@/components/PixelSprite";
import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { ARMOR_SLOT_INFO } from "@/lib/items/armor";
import type { Expedition, KlutzEncounter, KlutzFind } from "@/lib/klutz";
import type { CreatureOrItemDrop, Rarity } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";
const GOOD = "#7CFC9A", BAD = "#ff8a80";
const SKILL_SAW: Record<NonNullable<KlutzFind["skill"]>, string> = { armourer: "His Armourer's eye", scavenger: "His Scavenger's nose", scholar: "His Scholar's instinct" };

// A window that brought nothing (the user, 2026-11-20): one of these, picked by when it was, so it never changes.
export const EMPTY_LINES = [
  "He broke into some crates, but they were empty.",
  "He checked a cage, but it was empty.",
  "He dug through a pile of rubble and found nothing.",
  "He pried open an old chest: just cobwebs.",
  "He followed some tracks, but lost them.",
  "He poked around a dead end. Nothing.",
];

type Line =
  | { at: number; kind: "empty" }
  | { at: number; kind: "fight"; e: KlutzEncounter; dmg: number; kept: boolean }
  | { at: number; kind: "find"; find: KlutzFind; dropped: boolean }
  | { at: number; kind: "left"; name: string; rarity: Rarity; qty?: number };

const Name = ({ r, children }: { r: Rarity; children: React.ReactNode }) => <b style={{ color: RARITY_COLORS[r]?.text ?? GOLD }}>{children}</b>;
const kindOf = (it: CreatureOrItemDrop) => it.itemCategory === "weapon" ? "weapon" : it.armorSlot ? ARMOR_SLOT_INFO[it.armorSlot].name.toLowerCase()
  : it.codexMove ? "codex" : it.potion ? "potion" : it.material ? "material" : it.scroll ? "scroll" : "find";

export default function KlutzStory({ ex, upTo, seenIds, live }: { ex: Expedition; upTo: number; seenIds: Set<string>; live?: boolean }) {
  const lines = storyOf(ex, upTo);
  const box = useRef<HTMLDivElement | null>(null);
  // Keep the newest line in view as the story grows.
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [lines.length]);
  const over = upTo >= ex.endsAt;
  return (
    <div ref={box} style={{ display: "grid", gap: 6, maxHeight: "44cqh", minHeight: 120, overflowY: "auto", padding: 6, background: "#0b0c11", border: "1px solid #24262f", alignContent: "start" }}>
      <Row at={ex.startedAt} ex={ex} icon={<span style={{ fontSize: 18 }}>🎒</span>}>
        He set off with <b>{ex.startHp ?? ex.maxHp}/{ex.maxHp} HP</b>{ex.kit ? <> and {ex.kit.gear.length ? ex.kit.gear.map((g) => g.name).join(", ") : "no gear"}</> : null}.
      </Row>
      {lines.map((l, i) => <StoryLine key={i} l={l} ex={ex} seenIds={seenIds} />)}
      {over ? (
        <Row at={ex.endsAt} ex={ex} icon={<span style={{ fontSize: 18 }}>🏠</span>}>
          <span style={{ color: GOLD }}>{homeLine(ex)}</span>
        </Row>
      ) : live ? (
        <div style={{ fontSize: 13, color: MUTED, padding: "2px 6px" }} className="ritual-slot-empty">…still exploring</div>
      ) : null}
    </div>
  );
}

// The story's lines up to a moment, in order; each fight with the damage he took in it.
export function storyOf(ex: Expedition, upTo: number): Line[] {
  const fights = ex.encounters.filter((e) => e.at <= upTo);
  const finds = (ex.finds ?? []).filter((x) => x.at <= upTo);
  const passed = (ex.passed ?? []).filter((p) => p.at <= upTo);
  const wonAt = new Set(fights.filter((e) => e.won).map((e) => e.at));
  let hp = ex.startHp ?? ex.maxHp, catches = 0;
  const lines: Line[] = [];
  for (const e of fights) {
    const isCatch = ex.v === 2 ? !!e.caught : e.won;
    const kept = !isCatch || (ex.caged !== undefined ? catches < ex.caged : !ex.letGo);
    if (isCatch) catches++;
    lines.push({ at: e.at, kind: "fight", e, dmg: Math.max(0, hp - e.hpAfter), kept });
    hp = e.hpAfter;
    if (e.find) lines.push({ at: e.at, kind: "find", find: { at: e.at, drop: e.find }, dropped: true });
  }
  // (A piece found in the same moment as a fight he won, not by a skill, is what that creature dropped.)
  for (const x of finds) lines.push({ at: x.at, kind: "find", find: x, dropped: !x.skill && wonAt.has(x.at) });
  for (const t of (ex.empty ?? []).filter((t) => t <= upTo)) lines.push({ at: t, kind: "empty" });
  for (const p of passed) lines.push({ at: p.at, kind: "left", name: p.name, rarity: p.rarity, ...(p.qty ? { qty: p.qty } : {}) });
  // (A trip from before v2: one find for the whole trip, at its end.)
  if (ex.find && upTo >= ex.endsAt) lines.push({ at: ex.endsAt, kind: "find", find: { at: ex.endsAt, drop: ex.find }, dropped: false });
  const order = { fight: 0, find: 1, left: 2, empty: 3 } as const;
  return lines.sort((a, b) => a.at - b.at || order[a.kind] - order[b.kind]);
}

function homeLine(ex: Expedition) {
  if (ex.recalled) return "You called him back, and he came home with what he had.";
  switch (ex.home) {
    case "pack": return "His pack was full, so he headed home.";
    case "hurt": return "Battered and low on HP, he headed home.";
    case "ko": return "Beaten, he limped home with what he'd found.";
    case "limit": return "He'd been out long enough, and headed home.";
    default: return "He came home.";
  }
}

function StoryLine({ l, ex, seenIds }: { l: Line; ex: Expedition; seenIds: Set<string> }) {
  if (l.kind === "empty") {
    return (
      <Row at={l.at} ex={ex} icon={<span style={{ fontSize: 16, opacity: 0.6 }}>🕸️</span>} dim>
        {EMPTY_LINES[Math.floor(l.at / 1000) % EMPTY_LINES.length]}
      </Row>
    );
  }
  if (l.kind === "left") {
    return (
      <Row at={l.at} ex={ex} icon={<span style={{ fontSize: 16, opacity: 0.6 }}>🍂</span>} dim>
        He found <Name r={l.rarity}>{l.name}{l.qty && l.qty > 1 ? ` ×${l.qty}` : ""}</Name>, but it was below your Selective rarity, so he left it behind.
      </Row>
    );
  }
  if (l.kind === "find") {
    const it = l.find.drop as CreatureOrItemDrop;
    const sprite = itemSprite(it);
    const what = <Name r={it.rarity}>{it.name}{it.material && (it.qty ?? 1) > 1 ? ` ×${it.qty}` : ""}</Name>;
    return (
      <Row at={l.at} ex={ex} icon={sprite ? <PixelSprite sprite={sprite} scale={1.4} /> : <span style={{ fontSize: 18 }}>🎁</span>}>
        {l.dropped ? <>It dropped {what} <span style={{ color: MUTED }}>({it.rarity} {kindOf(it)})</span>, and he stuffed it in his pack.</>
          : l.find.skill ? <><b style={{ color: GOLD }}>⭐ {SKILL_SAW[l.find.skill]}</b> spotted {what} <span style={{ color: MUTED }}>({it.rarity} {kindOf(it)})</span>.</>
          : <>He found {what} <span style={{ color: MUTED }}>({it.rarity} {kindOf(it)})</span>.</>}
      </Row>
    );
  }
  const e = l.e, t = CREATURE_BY_ID[e.creatureId];
  // Beaten by something you've never met: it stays a shadow.
  if (!e.won && !seenIds.has(e.creatureId)) {
    return (
      <Row at={l.at} ex={ex} icon={<PixelSprite sprite={creatureSprite(e.creatureId)} scale={1} style={{ filter: "brightness(0) drop-shadow(0 0 1px rgba(255,255,255,0.4))" }} />}>
        Something came at him out of the dark. After {e.rounds} round{e.rounds === 1 ? "" : "s"} it had beaten him <span style={{ color: BAD }}>(−{l.dmg} HP)</span>.
        <span style={{ display: "block", fontStyle: "italic", color: "#d8d4c8" }}>&ldquo;Never seen anything like it. It&apos;s still down there.&rdquo;</span>
      </Row>
    );
  }
  const who = <><Name r={e.rarity}>{t?.name ?? e.creatureId}</Name> <span style={{ color: MUTED }}>({e.rarity}{e.level ? `, Lv ${e.level}` : ""})</span></>;
  const took = <span style={{ color: l.dmg ? BAD : MUTED }}>{l.dmg ? `took ${l.dmg} damage` : "took no damage"}</span>;
  const rounds = `${e.rounds} round${e.rounds === 1 ? "" : "s"}`;
  const end = !e.won ? <span style={{ color: BAD }}>It beat him.</span>
    : ex.v !== 2 ? (l.kept ? <span style={{ color: GOOD }}>He won and caught it!</span> : <span style={{ color: GOLD }}>He won, but the cage was full, so he let it go.</span>)
    : e.caught ? (l.kept ? <span style={{ color: GOOD }}>He caught it!</span> : <span style={{ color: GOLD }}>He caught it, but the cage was full, so he let it go.</span>)
    : e.filtered ? <span style={{ color: GOLD }}>He could have caught it, but it was under your cage filter, so he let it go.</span>
    : <span style={{ color: GOLD }}>He beat it, but it got away.</span>;
  return (
    <Row at={l.at} ex={ex} icon={<PixelSprite sprite={creatureSprite(e.creatureId)} scale={1} />}>
      A wild {who} {e.won ? "jumped him" : "came at him"}. They fought for {rounds} and he {took} <span style={{ color: MUTED }}>({e.hpAfter}/{ex.maxHp} HP)</span>. {end}
      {e.won && e.xp ? <span style={{ color: GOOD }}> +{e.xp} XP</span> : null}
    </Row>
  );
}

function Row({ at, ex, icon, dim, children }: { at: number; ex: Expedition; icon: React.ReactNode; dim?: boolean; children: React.ReactNode }) {
  const mins = Math.max(0, Math.round((at - ex.startedAt) / 60000));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "34px 28px 1fr", gap: 6, alignItems: "start", background: "#12131a", padding: "6px 6px", opacity: dim ? 0.75 : 1 }}>
      <span className="pixel-font" style={{ fontSize: 11, color: MUTED, paddingTop: 3, textAlign: "right" }}>{mins}m</span>
      <span style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 24 }}>{icon}</span>
      <span style={{ fontSize: 13, lineHeight: 1.4, minWidth: 0 }}>{children}</span>
    </div>
  );
}
