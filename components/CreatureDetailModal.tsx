"use client";
// components/CreatureDetailModal.tsx
// A creature's window, in two tabs:
// - Gear & stats: the creature on its pedestal with its weapon on one side
//   and its armour (helmet, chest, legs) on the other, its set bonus if it
//   wears a full set, its stats as bars and its gear multipliers;
// - Moves: its 4 move slots, and the moves it could swap in.
// Tap a slot to browse your gear: tapping an item previews the change on
// every stat before you equip it; dragging it onto its slot equips it.

import { useEffect, useState } from "react";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { WEAPON_AFFINITY } from "@/lib/items/ceilings";
import { damageTypesOn } from "@/lib/combat/engine";
import { canLearnFromCodex, DAMAGE_TYPE_INFO, defaultMoveNames, findCreatureTemplate, MOVE_BY_NAME, MOVE_SLOTS, resolveMoves, type CreatureTemplate } from "@/lib/creatures/creatureData";
import { combatSummary } from "@/lib/combat/loadout";
import { fighterFor, proficiencyOf } from "@/lib/creatures/instance";
import { clampLevel, hpAt, proficiencyAt, xpToNext, MAX_LEVEL, SCROLL_XP } from "@/lib/creatures/levels";
import { creatureRoles, ROLE_HINT } from "@/lib/creatures/creatureType";
import { armorPieces, type EquipSlot, type Loadout } from "@/hooks/useGameState";
import { ARMOR_META, ARMOR_SLOTS, ARMOR_SLOT_INFO, SET_BONUS, wornArmor, type ArmorKey } from "@/lib/items/armor";
import MoveSlots from "./MoveSlots";
import RaceTag from "./RaceTag";
import ClassBadge from "./ClassBadge";
import Help from "./Help";
import { SOUL_STONES, SOUL_STONE_KEYS, setStoneCost, type SoulStoneKey } from "@/lib/creatures/soulStones";
import { SOUL_COLOR } from "./SoulStoneTag";
import PixelSprite, { creatureSprite, itemSprite } from "./PixelSprite";
import { useDragDrop } from "@/hooks/useDragDrop";
import { doubleTapper } from "@/lib/doubleTap";
import { Coin } from "./GoldCount";

type Props = {
  creature: CreatureOrItemDrop;
  isFavorite: boolean;
  onToggleFavorite?: (id: string) => void; // missing: no roster button (e.g. Klutz)
  loadout?: Loadout;
  weapons: CreatureOrItemDrop[];
  armors: CreatureOrItemDrop[];
  equippedOn: Map<string, string>;      // item id → creature drop id
  creatureNameById: Map<string, string>; // creature drop id → name
  onEquip: (slot: EquipSlot, itemId: string | null) => void;
  onSetMoves?: (moves: string[]) => void;
  codexes?: CreatureOrItemDrop[];          // every codex you own
  onLearnCodex?: (codexId: string) => void;
  scrolls?: CreatureOrItemDrop[];          // every XP scroll you own
  onReadScroll?: (scrollId: string) => void;
  onClose: () => void;
  unavailable?: Set<string>;               // items you can't take right now (with Klutz in the Labyrinth)
  locked?: string;                         // gear can't be changed right now: why (Klutz is away)
  // Flicking through your creatures: where this one sits in the list.
  position?: { index: number; count: number };
  onPrev?: () => void;
  onNext?: () => void;
  // Klutz: his %s are points you spend (lib/klutz.ts), shown in place of the gear multipliers.
  points?: { free: number; onSpend: (add: Partial<Record<ProfKey, number>>) => void; respec: { cost: number; can: boolean; run: () => boolean } };
  // Klutz: you choose his soul stone (lib/klutz.ts). onPick missing: not right now (he's away).
  soulStones?: { choices: SoulStoneKey[]; onPick?: (stone: SoulStoneKey | null) => void };
  // Your creatures: the loose soul stones you own, to set in it for good
  // (free into an empty slot, SOUL_STONE_REPLACE_COST gold to replace one).
  stones?: { owned: CreatureOrItemDrop[]; gold: number; onSet: (stoneId: string) => void };
};
type ProfKey = Exclude<StatKey, "hp">;

const MUTED = "rgba(255,255,255,0.45)";
const GOLD = "#f1d9a0";
const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

const WEAPON_STAT_LABELS: [string, string][] = [["melee", "Atk"], ["ranged", "Rng"], ["magic", "Mag"], ["agility", "Agi"], ["hp", "HP"]];
const ARMOR_STAT_LABELS:  [string, string][] = [["mDef", "MDef"], ["rDef", "RDef"], ["magDef", "MgDef"], ["agility", "Agi"], ["hp", "HP"]];

// Text cut to a number of lines (with …) in a box always that tall: the
// window's boxes stay put whatever the words.
const lines = (n: number, lineHeight: number): React.CSSProperties => ({
  display: "-webkit-box", WebkitLineClamp: n, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight, height: `${n * lineHeight}em`,
});

// Each stat's bar is full at about the best a creature reaches with Legendary gear.
export type StatKey = "hp" | "atk" | "rng" | "mag" | "agil" | "mdef" | "rdef" | "magdef";
export const STATS: { key: StatKey; icon: string; label: string; max: number; color: string }[] = [
  { key: "hp",   icon: "❤️", label: "Health",     max: 350, color: "#e0524a" },
  { key: "atk",  icon: "⚔️", label: "Melee",      max: 180, color: "#ff9f43" },
  { key: "rng",  icon: "🏹", label: "Ranged",     max: 180, color: "#6fdc6f" },
  { key: "mag",  icon: "🔮", label: "Magic",      max: 180, color: "#c08cff" },
  { key: "agil", icon: "💨", label: "Agility",    max: 240, color: "#5ee0c0" },
  { key: "mdef", icon: "🛡️", label: "Melee Def",  max: 160, color: "#7aa7ff" },
  { key: "rdef", icon: "🔰", label: "Ranged Def", max: 160, color: "#8fd0ff" },
  { key: "magdef", icon: "🧿", label: "Magic Def", max: 160, color: "#e0a8ff" },
];

const rarityColor = (r: Rarity) => RARITY_COLORS[r]?.text ?? "white";
// Numbers in a plain, bold face: easy to read at a glance.
const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

export default function CreatureDetailModal({
  creature, isFavorite, onToggleFavorite, loadout, weapons, armors,
  equippedOn, creatureNameById, onEquip, onSetMoves, codexes = [], onLearnCodex, scrolls = [], onReadScroll, onClose, position, onPrev, onNext, unavailable, locked, points, soulStones, stones,
}: Props) {
  // Points tapped onto stats but not yet confirmed (Klutz).
  const [pending, setPending] = useState<Partial<Record<ProfKey, number>>>({});
  const pendingTotal = Object.values(pending).reduce((s, n) => s + (n ?? 0), 0);
  const template = findCreatureTemplate(creature.creatureId, creature.name);
  const weapon = weapons.find((w) => w.id === loadout?.weaponId);
  const worn   = armorPieces(loadout, (id) => armors.find((a) => a.id === id)); // helmet, chest, legs
  // A weapon's damage type (Force, Pierce or Arcane): its moves of that type hit
  // harder. Only under the old rules: Combat V2 has no damage types.
  const weaponKind = damageTypesOn() && weapon?.itemKey && WEAPON_AFFINITY[weapon.itemKey] ? DAMAGE_TYPE_INFO[WEAPON_AFFINITY[weapon.itemKey]] : undefined;
  const inSlot = (slot: EquipSlot) => (slot === "weapon" ? weapon : worn[ARMOR_SLOTS.indexOf(slot)]);
  const c = RARITY_COLORS[creature.rarity];

  // The slot being browsed, and the item picked to preview (null = take it off).
  const [picking, setPicking] = useState<EquipSlot | null>(null);
  const [stonePicking, setStonePicking] = useState(false); // the soul stone picker (Klutz's, or your loose stones)
  const [preview, setPreview] = useState<CreatureOrItemDrop | null | undefined>(undefined);
  const [tab, setTab] = useState<"gear" | "moves">("gear");
  const [teaching, setTeaching] = useState<CreatureOrItemDrop | null>(null); // a codex being read, waiting for a move to forget
  // Gear dragged from the picker onto its slot goes straight on (a tap only previews it).
  const { box: dragBox, ...dnd } = useDragDrop<CreatureOrItemDrop>({ onDrop: (opt, t) => {
    if (!picking || t !== `slot:${picking}` || locked) return;
    if (opt.id !== inSlot(picking)?.id) onEquip(picking, opt.id);
    closePicker();
  } });

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); } // (so it doesn't also go back a page)
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext]);

  // Opening a slot starts on what's worn now, so you can flick between it and the others.
  const openSlot = (slot: EquipSlot) => {
    if (locked) return;
    setPicking((p) => (p === slot ? null : slot));
    setPreview(inSlot(slot));
    setStonePicking(false);
  };
  const closePicker = () => { setPicking(null); setPreview(undefined); };
  // Tapping a piece previews it; a quick second tap puts it on (null: the Unequip tile).
  const [doubleTap] = useState(doubleTapper);
  const tapOption = (opt: CreatureOrItemDrop | null) => {
    setPreview(opt);
    if (!doubleTap(opt?.id ?? "none") || !picking) return;
    if ((opt?.id ?? null) !== (inSlot(picking)?.id ?? null)) onEquip(picking, opt ? opt.id : null);
    closePicker();
  };

  const summary = (w: CreatureOrItemDrop | undefined, pieces: (CreatureOrItemDrop | undefined)[], cr: CreatureOrItemDrop = creature) => {
    if (!template) return null;
    const f = fighterFor(cr, template, w?.stats, pieces, loadout?.moves, w?.itemKey);
    return { f, s: combatSummary(f) };
  };
  // Klutz with his unconfirmed points added (to preview them on his stats).
  const withPending = (): CreatureOrItemDrop => {
    const p = { ...(creature.proficiency ?? template!.proficiency) };
    for (const [k, n] of Object.entries(pending) as [ProfKey, number][]) p[k] = (p[k] ?? 0) + n;
    return { ...creature, proficiency: p };
  };
  const now = summary(weapon, worn);
  const current = picking ? inSlot(picking) : undefined;
  const isCurrent = !!preview && preview.id === current?.id;
  const previewing = picking && preview !== undefined && !isCurrent;
  // The armour pieces with the previewed one swapped in.
  const nextPieces = previewing && picking !== "weapon"
    ? worn.map((p, i) => (ARMOR_SLOTS[i] === picking ? preview ?? undefined : p))
    : worn;
  const next = previewing
    ? summary(picking === "weapon" ? preview ?? undefined : weapon, nextPieces)
    : pendingTotal > 0 ? summary(weapon, worn, withPending()) : null;
  const setNow = wornArmor(worn).set;
  const setNext = wornArmor(nextPieces).set;
  const prof = template ? proficiencyOf(creature, template) : undefined;
  const level = clampLevel(creature.level);
  const base = template?.proficiency;

  const options = picking === "weapon" ? weapons : armors.filter((a) => (a.armorSlot ?? "chest") === picking);
  const slotName = picking === "weapon" ? "weapon" : picking ? ARMOR_SLOT_INFO[picking].name.toLowerCase() : "";
  const sorted = [...options].sort((a, b) =>
    RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.name.localeCompare(b.name));
  const previewOwner = preview && equippedOn.get(preview.id) !== creature.id ? creatureNameById.get(equippedOn.get(preview.id) ?? "") : undefined;

  function confirm() {
    if (!picking || preview === undefined || isCurrent) return;
    onEquip(picking, preview ? preview.id : null);
    closePicker();
  }

  return (
    <div ref={dragBox} onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      {/* Previous / next creature, on the sides of the screen (← → keys too) */}
      {position && position.count > 1 && (["prev", "next"] as const).map((d) => (
        <button key={d} className={`side-arrow ${d}`} aria-label={d === "prev" ? "Previous creature" : "Next creature"}
          onClick={(e) => { e.stopPropagation(); (d === "prev" ? onPrev : onNext)?.(); }}>
          {d === "prev" ? "‹" : "›"}
        </button>
      ))}
      <div onClick={(e) => e.stopPropagation()} className="modal-panel stone-panel"
        style={{ borderColor: "#12131a", boxShadow: `inset 3px 3px 0 #3a3e4b, inset -3px -3px 0 #181a21, 0 0 0 2px ${c.border}, 0 0 40px ${c.glow}`, padding: 18, width: "100%", maxWidth: 520, height: "92cqh", overflowY: "auto", position: "relative" }}>

        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 10, right: 12, background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>

        {/* Which creature this is of the list (the arrows are on the screen's sides) */}
        {position && position.count > 1 && (
          <div className="pixel-font" style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>{position.index + 1} / {position.count}</div>
        )}

        {/* Name plate */}
        <div style={{ paddingRight: 28, marginBottom: 12 }}>
          <div style={{ display: "flex", alignContent: "flex-start", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap", height: 52, overflow: "hidden" }}>
            <span className="pixel-font" style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color: c.text, border: `2px solid ${c.border}`, background: c.glow }}>{creature.rarity}</span>
            <RaceTag race={template?.race} races={template?.races} />
            {template?.neutral && <ClassBadge neutral />}
            {template && prof && !(template.neutral && creatureRoles(prof)[0] === "Balanced") && <TypeTags roles={creatureRoles(prof)} />}
          </div>
          {/* One line (a long name ends in "…"), so flicking between creatures never moves anything below it. */}
          <h2 className="pixel-font" title={creature.name} style={{ margin: 0, fontSize: 26, fontWeight: 600, color: c.text, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {creature.name} <span style={{ fontSize: 18, color: "#f1d9a0" }}>Lv {level}</span>
          </h2>
        </div>

        {!template || !now ? (
          <p style={{ fontSize: 13, color: MUTED }}>This creature is from an older roster and has no combat data, so it can&apos;t be equipped.</p>
        ) : (
          <>
            {/* Tabs: gear & stats, or moves */}
            <div role="tablist" style={{ display: "flex", border: "2px solid #2a2d38", borderRadius: 10, overflow: "hidden", background: "#101117", marginBottom: 12 }}>
              {([["gear", "🛡️ Gear & stats"], ["moves", "⚔️ Moves"]] as const).map(([k, label], i) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); closePicker(); }} className="pixel-font"
                  style={{ flex: 1, minHeight: 44, fontSize: 15, cursor: "pointer", border: "none", borderLeft: i ? "2px solid #2a2d38" : "none",
                    background: tab === k ? "#3a2c16" : "transparent", color: tab === k ? "#ffe9a8" : "rgba(255,255,255,0.6)" }}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "moves" && (
              <>
                <MoveSlots template={template} moves={loadout?.moves ?? creature.moves} born={creature.moves} learned={creature.learned} onChange={onSetMoves}
                  teaching={teaching ? {
                    move: teaching.codexMove!,
                    onPick: (i) => {
                      const next = resolveMoves(template, loadout?.moves ?? creature.moves).map((m) => m.name);
                      next[i] = teaching.codexMove!;
                      onLearnCodex?.(teaching.id); onSetMoves?.(next); setTeaching(null);
                    },
                    onCancel: () => setTeaching(null),
                  } : undefined} />
                {!teaching && (
                  <CodexShelf template={template} known={[...(creature.moves ?? defaultMoveNames(template)), ...(creature.learned ?? [])]} codexes={codexes}
                    onLearn={onLearnCodex && ((codexId) => {
                      // The new move goes straight into a slot: a free one, or one you choose to forget.
                      const codex = codexes.find((c) => c.id === codexId);
                      const slots = resolveMoves(template, loadout?.moves ?? creature.moves).map((m) => m.name);
                      if (!codex?.codexMove || !onSetMoves) { onLearnCodex(codexId); return; }
                      if (slots.length >= MOVE_SLOTS) { setTeaching(codex); return; }
                      onLearnCodex(codexId); onSetMoves([...slots, codex.codexMove]);
                    })} />
                )}
              </>
            )}

            {tab === "gear" && <>
            {/* Paper doll: weapon · creature · armour */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, padding: "12px 8px", background: "radial-gradient(ellipse at 50% 60%, rgba(255,170,80,0.10), transparent 70%), #15161d", border: "2px solid #0e0f14", boxShadow: "inset 0 0 24px rgba(0,0,0,0.6)" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <Slot label={weaponKind ? `${weaponKind.icon} ${weaponKind.name} weapon` : "Weapon"} labelColor={weaponKind?.color} slot="weapon" item={weapon} active={picking === "weapon"} hot={dnd.over === "slot:weapon"} onClick={() => openSlot("weapon")} small />
                <SoulSlot stone={creature.soulStone} active={stonePicking}
                  onClick={(soulStones || stones) && !locked ? () => { setStonePicking((p) => !p); setPicking(null); setPreview(undefined); } : undefined} />
              </div>
              <Pedestal creature={creature} glow={c.glow} border={c.border} hp={next?.s.hp ?? now.s.hp} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                {ARMOR_SLOTS.map((slot, i) => (
                  <Slot key={slot} label={ARMOR_SLOT_INFO[slot].name} slot={slot} item={worn[i]} active={picking === slot} hot={dnd.over === `slot:${slot}`} onClick={() => openSlot(slot)} small />
                ))}
              </div>
            </div>

            {creature.dropType === "creature" && (
              <LevelBar level={level} xp={creature.xp ?? 0}
                scroll={onReadScroll && scrolls.length > 0 ? { count: scrolls.length, read: () => onReadScroll(scrolls[0].id) } : undefined} />
            )}

            <SetLine worn={worn} now={setNow} next={previewing && picking !== "weapon" ? setNext : setNow} />
            {locked && <div style={{ marginTop: 6, fontSize: 12, color: MUTED, textAlign: "center" }}>🔒 {locked}</div>}

            {/* Klutz's soul stone picker: tap one to give it to him */}
            {stonePicking && soulStones && (
              <div style={{ marginTop: 10, padding: 10, background: "#15161d", border: "2px solid #8a6a3a" }}>
                <div className="pixel-font" style={{ fontSize: 14, color: GOLD, marginBottom: 8 }}>Choose his soul stone</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                  <Tile selected={!creature.soulStone} disabled={!soulStones.onPick} onClick={() => soulStones.onPick?.(null)} title="No soul stone">
                    <span style={{ fontSize: 22, color: MUTED }}>⊘</span>
                    <span style={{ fontSize: 11, color: MUTED }}>None</span>
                  </Tile>
                  {soulStones.choices.map((k) => (
                    <Tile key={k} selected={creature.soulStone === k} disabled={!soulStones.onPick} onClick={() => soulStones.onPick?.(k)} title={`${SOUL_STONES[k].name}: ${SOUL_STONES[k].text}`}>
                      <span style={{ fontSize: 22 }}>{SOUL_STONES[k].icon}</span>
                    </Tile>
                  ))}
                </div>
                {/* What the chosen one does (fixed lines, so nothing jumps) */}
                <div style={{ marginTop: 8, minHeight: "4.2em", fontSize: 12, lineHeight: 1.4, color: creature.soulStone ? SOUL_COLOR : MUTED }}>
                  {creature.soulStone ? <><b>{SOUL_STONES[creature.soulStone].name}</b>: {SOUL_STONES[creature.soulStone].text}</> : "None: tap a stone to give it to him. You can change it whenever he's home."}
                </div>
              </div>
            )}

            {/* A creature of yours: set one of your loose soul stones in it */}
            {stonePicking && stones && (
              <StoneSetter current={creature.soulStone} {...stones} onSet={(id) => { stones.onSet(id); setStonePicking(false); }} />
            )}

            {/* Gear picker */}
            {picking && (
              <div style={{ marginTop: 10, padding: 10, background: "#15161d", border: "2px solid #8a6a3a" }}>
                <div className="pixel-font" style={{ fontSize: 14, color: GOLD, marginBottom: 8 }}>
                  Choose {picking === "weapon" ? "a weapon" : `a ${slotName}`}: tap to compare, double-tap or drag onto the slot to equip
                </div>
                {options.length === 0 ? (
                  <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>You don&apos;t own a {slotName} piece yet. Scan barcodes or explore the labyrinth to find some.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(62px, 1fr))", gap: 6 }}>
                    {current && (
                      <Tile selected={preview === null} onClick={() => tapOption(null)} title="Take it off">
                        <span style={{ fontSize: 22, color: MUTED }}>⊘</span>
                        <span style={{ fontSize: 11, color: MUTED }}>Unequip</span>
                      </Tile>
                    )}
                    {sorted.map((opt) => {
                      const owner = equippedOn.get(opt.id);
                      const here = owner === creature.id;
                      const sp = itemSprite(opt);
                      const away = unavailable?.has(opt.id);
                      return (
                        <Tile key={opt.id} rarity={opt.rarity} selected={preview?.id === opt.id} disabled={away}
                          title={away ? `${opt.name} — Klutz has it with him in the Labyrinth` : here ? `${opt.name} (worn now)` : opt.name}
                          grab={away ? undefined : { onPointerDown: dnd.press(opt, { sprite: sp, icon: "📦" }), ...dnd.handlers }}
                          onClick={() => { if (!dnd.wasDrag()) tapOption(opt); }}>
                          {sp ? <PixelSprite sprite={sp} scale={3} /> : <span style={{ fontSize: 22 }}>?</span>}
                          {here && <Badge color={GOLD}>ON</Badge>}
                          {owner && !here && <Badge color="#f5c542">{away ? "🌀" : "⚑"}</Badge>}
                        </Tile>
                      );
                    })}
                  </div>
                )}

                {/* The picked item, and the confirm bar (always there, so nothing jumps) */}
                {options.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", minHeight: 72 }}>
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                      {preview === undefined ? (
                        <div style={{ color: MUTED, fontSize: 13 }}>Nothing in this slot yet — tap one to see what it would do.</div>
                      ) : preview ? (
                        <>
                          <div style={{ fontWeight: 700, color: rarityColor(preview.rarity) }}>
                            {preview.name}{isCurrent && <span style={{ fontSize: 11, color: GOLD, fontWeight: 400 }}> · worn now</span>}
                          </div>
                          <StatLine stats={preview.stats} labels={picking === "weapon" ? WEAPON_STAT_LABELS : ARMOR_STAT_LABELS} />
                          {preview.armorKey && <div style={{ fontSize: 11, color: MUTED }}>Set: {ARMOR_META[preview.armorKey].name} — {SET_BONUS[preview.armorKey].name}</div>}
                          {previewOwner && <div style={{ fontSize: 11, color: "#f5c542" }}>Worn by {previewOwner} — equipping takes it from them.</div>}
                        </>
                      ) : (
                        <div style={{ color: MUTED, fontSize: 13 }}>Leave the {slotName} slot empty.</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="pixel-btn" style={{ fontSize: 14, padding: "6px 12px", opacity: preview === undefined || isCurrent ? 0.4 : 1 }}
                        disabled={preview === undefined || isCurrent} onClick={confirm}>{preview === null ? "Unequip" : "Equip"}</button>
                      <button className="chip" onClick={closePicker}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="pixel-font" style={{ fontSize: 14, color: GOLD, margin: "16px 0 8px" }}>
              Stats {(previewing || pendingTotal > 0) && <span style={{ fontSize: 12, color: "#ffd66e" }}>· previewing</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {STATS.map((st) => {
                const total = Math.round(now.s[st.key]);
                const after = next ? Math.round(next.s[st.key]) : total;
                const p = st.key === "hp" ? null : now.f.proficiency[st.key];
                const diff = st.key === "hp" || !base || points ? 0 : prof![st.key] - base[st.key];
                const gear = st.key === "hp" ? `${hpAt(template, level)} at Lv ${level} + ${now.f.weapon.hp + now.f.armor.hp} gear`
                  : `${gearValue(now.f, st.key)} gear × +${p}%`;
                return <StatRow key={st.key} icon={st.icon} label={st.label} color={st.color} max={st.max} total={total} after={after} detail={gear} diff={diff} />;
              })}
            </div>
            {/* The creature's own %s: what each point of gear is multiplied by. */}
            <div className="pixel-font" style={{ fontSize: 14, color: GOLD, margin: "16px 0 8px" }}>
              Gear multipliers <span style={{ fontSize: 12, color: MUTED }}>· {points ? "tap a stat to spend a point" : "grow with level; its rolls never change"}</span>
            </div>
            {points ? (
              <PointsGrid prof={now.f.proficiency} free={points.free} pending={pending} locked={!!locked}
                onAdd={(k) => setPending((p) => (pendingTotal < points.free ? { ...p, [k]: (p[k] ?? 0) + 1 } : p))}
                onConfirm={() => { points.onSpend(pending); setPending({}); }}
                onCancel={() => setPending({})}
                respec={points.respec} />
            ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(76px, 1fr))", gap: 5 }}>
              {STATS.filter((st) => st.key !== "hp").map((st) => {
                const k = st.key as Exclude<StatKey, "hp">;
                const d = base ? (prof![k] ?? 0) - (base[k] ?? 0) : 0;
                return (
                  <div key={k} title={`${st.label}: gear ${st.label.toLowerCase()} is boosted by ${now.f.proficiency[k]}% (at level 30: ${proficiencyAt(template, prof, MAX_LEVEL)[k]}%)`}
                    style={{ textAlign: "center", padding: "6px 2px", background: "#12131a", border: "2px solid #2a2d38", borderTop: `3px solid ${st.color}` }}>
                    <div style={{ fontSize: 13 }}>{st.icon}</div>
                    <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.label}</div>
                    <div style={{ ...NUM, fontSize: 18, color: st.color }}>{now.f.proficiency[k] >= 0 ? "+" : ""}{now.f.proficiency[k]}%</div>
                    <div style={{ fontSize: 11, color: d > 0 ? "#7CFC9A" : d < 0 ? "#ff8a80" : MUTED }}>{d > 0 ? `+${d} roll` : d < 0 ? `${d} roll` : "standard"}</div>
                  </div>
                );
              })}
            </div>
            )}

            <p style={{ fontSize: 11, color: MUTED, margin: "8px 0 0", lineHeight: 1.4 }}>
              Stats come from gear: each one is the gear&apos;s value boosted by the creature&apos;s % above. With no gear on, only Health has a value.
            </p>
            </>}
          </>
        )}

        {onToggleFavorite && (
          <button onClick={() => onToggleFavorite(creature.id)} className="chip" data-active={isFavorite}
            style={{ marginTop: 16, width: "100%", padding: "9px 0", textTransform: "none" }}>
            {isFavorite ? "★ In your roster" : "☆ Add to roster"}
          </button>
        )}
      </div>
      {dnd.ghost}
    </div>
  );
}

// Klutz's %s as points to spend: attacks on top (with the points left in the
// gap), defences and agility below. Tap a stat to put a point on it, then
// confirm or cancel; the stats above preview it. The boxes never move.
const POINT_ROWS: (ProfKey | "free")[] = ["atk", "rng", "mag", "free", "mdef", "rdef", "magdef", "agil"];
function PointsGrid({ prof, free, pending, locked, onAdd, onConfirm, onCancel, respec }: {
  prof: Record<ProfKey, number>; free: number; pending: Partial<Record<ProfKey, number>>; locked: boolean;
  onAdd: (k: ProfKey) => void; onConfirm: () => void; onCancel: () => void;
  respec: { cost: number; can: boolean; run: () => boolean };
}) {
  const [respecArmed, setRespecArmed] = useState(false);
  const pendingTotal = Object.values(pending).reduce((s, n) => s + (n ?? 0), 0);
  const left = free - pendingTotal;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
        {POINT_ROWS.map((k) => {
          if (k === "free") {
            return (
              <div key="free" className={left > 0 && !locked ? "news-glow" : undefined}
                style={{ textAlign: "center", padding: "6px 2px", background: "#1d1a12", border: `2px solid ${left > 0 ? "#8a6a3a" : "#2a2d38"}` }}>
                <div style={{ ...NUM, fontSize: 22, color: left > 0 ? GOLD : MUTED, lineHeight: 1.2 }}>{left}</div>
                <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.3 }}>skill point{left === 1 ? "" : "s"}<br />to spend</div>
              </div>
            );
          }
          const st = STATS.find((s) => s.key === k)!;
          const add = pending[k] ?? 0;
          return (
            <button key={k} disabled={locked || left <= 0} onClick={() => onAdd(k)}
              title={`${st.label}: gear ${st.label.toLowerCase()} is boosted by ${prof[k]}%. Tap to add 1%.`}
              style={{ textAlign: "center", padding: "6px 2px", minHeight: 44, background: add ? "#1a2416" : "#12131a", border: "2px solid #2a2d38", borderTop: `3px solid ${st.color}`,
                color: "inherit", cursor: locked || left <= 0 ? "default" : "pointer", font: "inherit" }}>
              <div style={{ fontSize: 13 }}>{st.icon}</div>
              <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.label}</div>
              <div style={{ ...NUM, fontSize: 18, color: st.color }}>+{prof[k] + add}%</div>
              <div style={{ fontSize: 11, color: "#7CFC9A", visibility: add ? "visible" : "hidden" }}>+{add}</div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="pixel-btn" style={{ fontSize: 14, padding: "6px 12px", opacity: pendingTotal ? 1 : 0.4 }} disabled={!pendingTotal} onClick={onConfirm}>Confirm</button>
        <button className="chip" style={{ opacity: pendingTotal ? 1 : 0.4 }} disabled={!pendingTotal} onClick={onCancel}>Cancel</button>
        <button className="chip" style={{ marginLeft: "auto", background: respecArmed ? "#6e1f18" : undefined, opacity: respec.can && !locked ? 1 : 0.4 }}
          disabled={!respec.can || locked}
          title="Take back every point he's spent, to spend again"
          onClick={() => {
            if (!respecArmed) { setRespecArmed(true); window.setTimeout(() => setRespecArmed(false), 4000); return; }
            setRespecArmed(false);
            onCancel();
            respec.run();
          }}>{respecArmed ? <>Tap again: re-spec for <Coin /> {respec.cost}</> : <>↺ Re-spec · <Coin /> {respec.cost}</>}</button>
      </div>
    </>
  );
}

export function gearValue(f: NonNullable<ReturnType<typeof fighterFor>>, key: StatKey): number {
  switch (key) {
    case "atk":  return f.weapon.atk;
    case "rng":  return f.weapon.rng;
    case "mag":  return f.weapon.mag;
    case "agil": return f.weapon.agil + f.armor.agil;
    case "mdef": return f.armor.mdef;
    case "rdef": return f.armor.rdef;
    case "magdef": return f.armor.magdef;
    default:     return 0;
  }
}

// The creature standing on its stone pedestal.
function Pedestal({ creature, glow, border, hp }: { creature: CreatureOrItemDrop; glow: string; border: string; hp: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <div style={{ position: "relative", padding: "6px 10px 0", height: 186, boxSizing: "border-box", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {/* The glow sits behind the creature itself, so a short one (Klutz) isn't under a glow floating above it. */}
        <span style={{ position: "relative", display: "flex" }}>
          <span style={{ position: "absolute", inset: "-15%", background: `radial-gradient(circle, ${glow}, transparent 70%)`, filter: "blur(2px)" }} />
          {/* Fitted to a box: the widest art (Aurelius, 124px) would push the slots off the screen.
              (The weapon slot is the armour slots' size, so the creature gets the room.) */}
          <PixelSprite sprite={creatureSprite(creature.creatureId)} scale={5} title={creature.name}
            style={{ position: "relative", width: "auto", height: "auto", maxWidth: "min(180px, 40cqw)", maxHeight: 180 }} />
        </span>
      </div>
      <div style={{ width: 150, height: 14, marginTop: -6, background: "#3a3f4c", borderTop: `3px solid ${border}`, boxShadow: "inset 0 -3px 0 #23262f, 0 3px 0 rgba(0,0,0,0.5)", borderRadius: "50% / 40%" }} />
      <div style={{ ...NUM, fontSize: 15, color: "#ff8a80", marginTop: 6 }}>❤️ {Math.round(hp)} HP</div>
    </div>
  );
}

// The creature's soul stone, under its weapon: always there (empty for none),
// so nothing moves flicking between creatures. What it does is behind the "?".
// onClick: it can be changed (Klutz's): the square is a button.
function SoulSlot({ stone, onClick, active }: { stone?: SoulStoneKey | null; onClick?: () => void; active?: boolean }) {
  const s = stone ? SOUL_STONES[stone] : undefined;
  const Box = onClick ? "button" : "span";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
      <span className="pixel-font" style={{ fontSize: 9, lineHeight: 1.2, color: s ? SOUL_COLOR : MUTED, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Soul stone</span>
      <Box onClick={onClick} title={onClick ? "Choose a soul stone" : s ? `${s.name}: ${s.text}` : "No soul stone"} style={{
        cursor: onClick ? "pointer" : undefined, padding: 0, ...(active ? { outline: "2px solid #ffd66e" } : {}),
        width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
        background: s ? "radial-gradient(circle, rgba(185,230,255,0.25), #101117 75%)" : "#101117",
        border: `3px solid ${s ? "rgba(185,230,255,0.6)" : "#2f3340"}`, boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.06), 0 3px 0 rgba(0,0,0,0.5)",
      }}>{s ? s.icon : <span style={{ fontSize: 18, color: onClick ? MUTED : "#3a3e4b" }}>{onClick ? "+" : "—"}</span>}</Box>
      <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, height: 26, color: s ? SOUL_COLOR : MUTED, maxWidth: 110 }}>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s ? s.name : "None"}</span>
        <span style={{ visibility: s ? "visible" : "hidden" }}><Help title={s ? `Soul stone: ${s.name}` : "Soul stone"}><p>{s?.text}</p></Help></span>
      </span>
    </div>
  );
}

// Your loose soul stones, to set one in a creature: tap one to see what it
// does, then confirm. Free into an empty slot; replacing a stone costs gold
// and destroys the old one. (Fixed lines, so nothing jumps.)
function StoneSetter({ current, owned, gold, onSet }: { current?: SoulStoneKey | null; owned: CreatureOrItemDrop[]; gold: number; onSet: (stoneId: string) => void }) {
  const kinds = SOUL_STONE_KEYS.filter((k) => owned.some((d) => d.stone === k));
  const [chosen, setChosen] = useState<SoulStoneKey | null>(null);
  const cost = setStoneCost(current);
  const stone = chosen && owned.find((d) => d.stone === chosen);
  const cur = current ? SOUL_STONES[current] : undefined;
  return (
    <div style={{ marginTop: 10, padding: 10, background: "#15161d", border: "2px solid #8a6a3a" }}>
      <div className="pixel-font" style={{ fontSize: 14, color: GOLD, marginBottom: 8 }}>Set a soul stone</div>
      {kinds.length === 0 ? (
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>You have no soul stones. They turn up in new barcodes and boss chests.</p>
      ) : <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
          {kinds.map((k) => (
            <Tile key={k} rarity="legendary" selected={chosen === k} onClick={() => setChosen(k)} title={`${SOUL_STONES[k].name}: ${SOUL_STONES[k].text}`}>
              <span style={{ fontSize: 22 }}>{SOUL_STONES[k].icon}</span>
              <Badge color={GOLD}>×{owned.filter((d) => d.stone === k).length}</Badge>
            </Tile>
          ))}
        </div>
        <div style={{ marginTop: 8, height: "4.2em", overflow: "hidden", fontSize: 12, lineHeight: 1.4, color: chosen ? SOUL_COLOR : MUTED }}>
          {chosen ? <><b>{SOUL_STONES[chosen].name}</b>: {SOUL_STONES[chosen].text}</> : cur ? `Tap a stone to replace ${cur.name}.` : "Tap a stone to set it in this creature."}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <button className="pixel-btn" disabled={!stone || gold < cost} onClick={() => stone && onSet(stone.id)} style={{ fontSize: 13 }}>
            {cur ? <>Replace · <Coin /> {cost.toLocaleString()}</> : "Set it in"}
          </button>
          <span style={{ fontSize: 11, lineHeight: 1.3, color: gold < cost ? "#ff8a80" : MUTED, visibility: cur ? "visible" : "hidden" }}>
            {gold < cost ? "Not enough gold." : `${cur?.name ?? ""} is destroyed.`}
          </span>
        </div>
      </>}
    </div>
  );
}

// An equipment slot: a framed square with the item's sprite.
// slot: its name as a drop target (data-drop="slot:<slot>"); hot: gear's being dragged over it.
function Slot({ label, labelColor, slot, item, active, hot, onClick, small }: { label: string; labelColor?: string; slot: EquipSlot; item?: CreatureOrItemDrop; active: boolean; hot?: boolean; onClick: () => void; small?: boolean }) {
  const col = item ? RARITY_COLORS[item.rarity] : undefined;
  const sp = item && itemSprite(item);
  const size = small ? 60 : 72;
  return (
    <button onClick={onClick} data-drop={`slot:${slot}`} title={item ? `${item.name} — tap to change` : `Equip ${label.toLowerCase()}`}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "white", minWidth: 0 }}>
      <span className="pixel-font" style={{ fontSize: small ? 9 : 11, color: labelColor ?? MUTED, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", ...(small ? { lineHeight: 1.2 } : { ...lines(2, 1.2), display: "flex", alignItems: "flex-end", justifyContent: "center" }) }}>{label}</span>
      <span style={{
        width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
        background: item ? `radial-gradient(circle, ${col!.glow}, #101117 75%)` : "#101117",
        border: `3px solid ${active || hot ? "#ffd66e" : col ? col.border : "#2f3340"}`,
        boxShadow: `inset 2px 2px 0 rgba(255,255,255,0.06), 0 3px 0 rgba(0,0,0,0.5)${hot ? ", 0 0 18px rgba(255,214,110,0.8)" : active ? ", 0 0 12px rgba(255,214,110,0.5)" : ""}`,
      }}>
        {sp ? <PixelSprite sprite={sp} scale={small ? 3.3 : 3.5} /> : <span style={{ fontSize: small ? 18 : 26, color: "#3a3e4b" }}>＋</span>}
      </span>
      {!small && (
        <span style={{ fontSize: 11, textAlign: "center", color: item ? rarityColor(item.rarity) : MUTED, maxWidth: 110, ...lines(2, 1.2) }}>
          {item ? item.name : "Empty"}
        </span>
      )}
    </button>
  );
}

// The creature's level: this level on the left, the next on the right, the
// XP between as a bar (the numbers on hover). An XP scroll, if you have one.
export function LevelBar({ level, xp, scroll }: { level: number; xp: number; scroll?: { count: number; read: () => void } }) {
  const max = level >= MAX_LEVEL;
  const need = xpToNext(level);
  return (
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
      <span className="pixel-font" style={{ fontSize: 13, color: GOLD, whiteSpace: "nowrap" }}>Lv {level}</span>
      <div title={max ? "Max level" : `${xp} / ${need} XP to level ${level + 1}`} style={{ position: "relative", flex: 1, height: 12, background: "#0e0f14", border: "2px solid #2a2d38" }}>
        <div style={{ position: "absolute", inset: 0, width: `${max ? 100 : Math.min(100, (100 * xp) / need)}%`, background: GOLD, transition: "width 0.3s" }} />
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg, transparent 0 9px, rgba(0,0,0,0.35) 9px 10px)" }} />
      </div>
      <span className="pixel-font" style={{ fontSize: 13, color: max ? MUTED : GOLD, whiteSpace: "nowrap" }}>{max ? "Max" : `Lv ${level + 1}`}</span>
      {scroll && !max && (
        <button className="pixel-btn" title={`Read an XP scroll: +${SCROLL_XP} XP`} onClick={scroll.read} style={{ fontSize: 11, padding: "1px 6px", minHeight: 28 }}>
          📜 +{SCROLL_XP} <span style={{ color: MUTED }}>×{scroll.count}</span>
        </button>
      )}
    </div>
  );
}

// The armour set: its mechanic if all three pieces match, or how close you are.
// next: the set with the previewed piece in (same as now when not previewing).
function SetLine({ worn, now, next }: { worn: (CreatureOrItemDrop | undefined)[]; now?: ArmorKey; next?: ArmorKey }) {
  const box = (children: React.ReactNode, lit: boolean) => (
    <div style={{ marginTop: 8, padding: "7px 10px", fontSize: 12, lineHeight: 1.4, background: lit ? "rgba(255,214,110,0.08)" : "#12131a",
      border: `2px solid ${lit ? "#8a6a3a" : "#2a2d38"}`, color: lit ? "#f1d9a0" : MUTED, height: "calc(3 * 1.4em + 18px)", overflow: "hidden", boxSizing: "border-box" }}>{children}</div>
  );
  if (next) {
    const b = SET_BONUS[next];
    return box(<>
      <b>✨ {ARMOR_META[next].name} — {b.name}</b>{next !== now && <span style={{ color: "#7CFC9A" }}> · completes the set</span>}
      <div>{b.text}</div>
    </>, true);
  }
  if (now) return box(<><b style={{ color: "#ff8a80" }}>Breaks your {ARMOR_META[now].name} set</b><div>You&apos;d lose {SET_BONUS[now].name}.</div></>, false);
  // Closest set: the armour you have the most pieces of.
  const counts = new Map<ArmorKey, number>();
  for (const p of worn) if (p?.armorKey) counts.set(p.armorKey, (counts.get(p.armorKey) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best) return box(<>Wear a helmet, chest and legs from the same armour to unlock its set bonus.</>, false);
  return box(<><b>{ARMOR_META[best[0]].name} {best[1]}/3</b> — the full set gives {SET_BONUS[best[0]].name}: {SET_BONUS[best[0]].text}</>, false);
}

function Tile({ children, rarity, selected, title, onClick, disabled, grab }: {
  children: React.ReactNode; rarity?: Rarity; selected?: boolean; title?: string; onClick: () => void; disabled?: boolean;
  grab?: React.HTMLAttributes<HTMLElement>; // drag it (hooks/useDragDrop)
}) {
  const col = rarity ? RARITY_COLORS[rarity] : undefined;
  return (
    <button onClick={onClick} title={title} aria-pressed={selected} disabled={disabled} {...grab}
      style={{
        opacity: disabled ? 0.35 : 1, ...(grab ? { touchAction: "none" } : {}),
        position: "relative", aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        background: col ? `radial-gradient(circle, ${col.glow}, #101117 75%)` : "#101117",
        border: `2px solid ${selected ? "#ffd66e" : col ? col.border : "#2f3340"}`,
        boxShadow: selected ? "0 0 10px rgba(255,214,110,0.55)" : "0 2px 0 rgba(0,0,0,0.5)",
        cursor: "pointer", padding: 2,
      }}>
      {children}
    </button>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{ ...NUM, position: "absolute", top: 1, right: 3, fontSize: 11, color }}>{children}</span>;
}

// One stat: icon, name, a chunky bar (with the previewed change), the total.
// compact: smaller, for narrow windows (EquipPreview).
export function StatRow({ icon, label, color, max, total, after, detail, diff, compact }: {
  icon: string; label: string; color: string; max: number; total: number; after: number; detail: string; diff: number; compact?: boolean;
}) {
  const pct = (v: number) => Math.min(100, (v / max) * 100);
  const change = after - total;
  const lo = Math.min(total, after), hi = Math.max(total, after);
  return (
    <div style={{ display: "grid", gridTemplateColumns: compact ? "18px minmax(64px, 1.3fr) 1fr auto" : "22px minmax(70px, 96px) 1fr auto", alignItems: "center", columnGap: compact ? 6 : 8 }}>
      <span style={{ fontSize: 15, textAlign: "center" }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.15 }}>
        {label}
        {diff !== 0 && <sup style={{ marginLeft: 2, fontSize: 11, color: diff > 0 ? "#7CFC9A" : "#ff8a80" }}>{diff > 0 ? `+${diff}` : diff}</sup>}
        <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: MUTED }}>{detail}</span>
      </span>
      <div style={{ position: "relative", height: 12, background: "#0e0f14", border: "2px solid #2a2d38" }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct(lo)}%`, background: color, transition: "width 0.25s" }} />
        {change !== 0 && (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%`, background: change > 0 ? "#7CFC9A" : "#ff5d5d", opacity: 0.85, transition: "all 0.25s" }} />
        )}
        {/* pixel segments */}
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg, transparent 0 9px, rgba(0,0,0,0.35) 9px 10px)" }} />
      </div>
      {/* Fixed width, change on the same line: flicking between items never moves anything. */}
      <span style={{ ...NUM, minWidth: compact ? 72 : 104, textAlign: "right", fontSize: compact ? 15 : 18, whiteSpace: "nowrap" }}>
        {change !== 0 && <span style={{ fontSize: 13, marginRight: 6, color: change > 0 ? "#7CFC9A" : "#ff8a80" }}>{change > 0 ? `▲+${change}` : `▼${change}`}</span>}
        {change !== 0 ? <span style={{ color: change > 0 ? "#7CFC9A" : "#ff8a80" }}>{after}</span> : total}
      </span>
    </div>
  );
}

function StatLine({ stats, labels }: { stats?: Record<string, number>; labels: [string, string][] }) {
  return (
    <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
      {labels.map(([k, l]) => `${l} ${stats?.[k] ?? 0}`).join(" · ")}
    </span>
  );
}

export function TypeTags({ roles }: { roles: string[] }) {
  return (
    <>
      {roles.map((r) => (
        <span key={r} title={ROLE_HINT[r]} style={{ fontSize: 11, padding: "1px 7px", border: "2px solid #2f3340", background: "#1b1d25", color: "rgba(255,255,255,0.75)" }}>{r}</span>
      ))}
    </>
  );
}

// Codexes on your bookcase this creature could read (one per move): any
// learnable move, or its own race's move — if it doesn't know it already.
// Reading uses the codex up.
function CodexShelf({ template, known, codexes, onLearn }: {
  template: CreatureTemplate; known: string[]; codexes: CreatureOrItemDrop[]; onLearn?: (codexId: string) => void;
}) {
  const seen = new Set<string>();
  const readable = codexes.filter((c) => {
    const mv = c.codexMove!;
    if (seen.has(mv) || known.includes(mv) || !canLearnFromCodex(template, mv)) return false;
    seen.add(mv);
    return true;
  });
  return (
    <div style={{ marginTop: 16 }}>
      <div className="pixel-font" style={{ fontSize: 14, color: "#f1d9a0", marginBottom: 8 }}>On your bookcase</div>
      {readable.length === 0 ? (
        <div style={{ fontSize: 12, color: MUTED }}>
          📖 No codexes it could read. Codexes teach new moves — find them by scanning and exploring the Labyrinth.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {readable.map((c) => {
            const mv = MOVE_BY_NAME[c.codexMove!];
            return (
              <button key={c.id} className="card-btn" disabled={!onLearn} onClick={() => onLearn?.(c.id)} style={{ borderColor: "#a99cff" }}>
                <span>
                  <b style={{ color: "#c7b8ff" }}>📖 Read {c.name}</b>
                  <span style={{ display: "block", fontSize: 12, color: MUTED }}>
                    {mv ? `${mv.self ? "Utility" : `${mv.type} · ${mv.damage} dmg`} · ${mv.energyCost} energy. ` : ""}Learns {c.codexMove} into a move slot; the codex crumbles to dust.
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
