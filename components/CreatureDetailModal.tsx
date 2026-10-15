"use client";
// components/CreatureDetailModal.tsx
// A creature's window, in two tabs:
// - Gear & stats: the creature on its pedestal with its weapon on one side
//   and its armour (helmet, chest, legs) on the other, its set bonus if it
//   wears a full set, its stats as bars and its gear multipliers;
// - Moves: its 4 move slots, and the moves it could swap in.
// Tap a slot to browse your gear: picking an item previews the change on
// every stat before you equip it.

import { useEffect, useState } from "react";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { canLearnFromCodex, findCreatureTemplate, MOVE_BY_NAME, type CreatureTemplate } from "@/lib/creatures/creatureData";
import { combatSummary } from "@/lib/combat/loadout";
import { fighterFor, proficiencyOf } from "@/lib/creatures/instance";
import { creatureRoles, ROLE_HINT } from "@/lib/creatures/creatureType";
import { armorPieces, type EquipSlot, type Loadout } from "@/hooks/useGameState";
import { ARMOR_META, ARMOR_SLOTS, ARMOR_SLOT_INFO, SET_BONUS, wornArmor, type ArmorKey } from "@/lib/items/armor";
import MoveSlots from "./MoveSlots";
import RaceTag from "./RaceTag";
import ClassBadge from "./ClassBadge";
import AbilityTag from "./AbilityTag";
import PixelSprite, { creatureSprite, itemSprite } from "./PixelSprite";

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
  onClose: () => void;
  unavailable?: Set<string>;               // items you can't take right now (with Klutz in the Labyrinth)
  // Flicking through your creatures: where this one sits in the list.
  position?: { index: number; count: number };
  onPrev?: () => void;
  onNext?: () => void;
};

const MUTED = "rgba(255,255,255,0.45)";
const GOLD = "#f1d9a0";
const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

const WEAPON_STAT_LABELS: [string, string][] = [["melee", "Atk"], ["ranged", "Rng"], ["magic", "Mag"], ["agility", "Agi"], ["hp", "HP"]];
const ARMOR_STAT_LABELS:  [string, string][] = [["mDef", "MDef"], ["rDef", "RDef"], ["magDef", "MgDef"], ["agility", "Agi"], ["hp", "HP"]];

// Each stat's bar is full at about the best a creature reaches with Legendary gear.
export type StatKey = "hp" | "atk" | "rng" | "mag" | "agil" | "mdef" | "rdef" | "magdef";
export const STATS: { key: StatKey; icon: string; label: string; max: number; color: string }[] = [
  { key: "hp",   icon: "❤️", label: "Health",     max: 350, color: "#e0524a" },
  { key: "atk",  icon: "⚔️", label: "Melee",      max: 180, color: "#ff9f43" },
  { key: "rng",  icon: "🏹", label: "Ranged",     max: 180, color: "#ffd84a" },
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
  equippedOn, creatureNameById, onEquip, onSetMoves, codexes = [], onLearnCodex, onClose, position, onPrev, onNext, unavailable,
}: Props) {
  const template = findCreatureTemplate(creature.creatureId, creature.name);
  const weapon = weapons.find((w) => w.id === loadout?.weaponId);
  const worn   = armorPieces(loadout, (id) => armors.find((a) => a.id === id)); // helmet, chest, legs
  const inSlot = (slot: EquipSlot) => (slot === "weapon" ? weapon : worn[ARMOR_SLOTS.indexOf(slot)]);
  const c = RARITY_COLORS[creature.rarity];

  // The slot being browsed, and the item picked to preview (null = take it off).
  const [picking, setPicking] = useState<EquipSlot | null>(null);
  const [preview, setPreview] = useState<CreatureOrItemDrop | null | undefined>(undefined);
  const [tab, setTab] = useState<"gear" | "moves">("gear");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext]);

  // Opening a slot starts on what's worn now, so you can flick between it and the others.
  const openSlot = (slot: EquipSlot) => {
    setPicking((p) => (p === slot ? null : slot));
    setPreview(inSlot(slot));
  };
  const closePicker = () => { setPicking(null); setPreview(undefined); };

  const summary = (w: CreatureOrItemDrop | undefined, pieces: (CreatureOrItemDrop | undefined)[]) => {
    if (!template) return null;
    const f = fighterFor(creature, template, w?.stats, pieces, loadout?.moves, w?.itemKey);
    return { f, s: combatSummary(f) };
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
    : null;
  const setNow = wornArmor(worn).set;
  const setNext = wornArmor(nextPieces).set;
  const prof = template ? proficiencyOf(creature, template) : undefined;
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-panel stone-panel"
        style={{ borderColor: "#12131a", boxShadow: `inset 3px 3px 0 #3a3e4b, inset -3px -3px 0 #181a21, 0 0 0 2px ${c.border}, 0 0 40px ${c.glow}`, padding: 18, width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", position: "relative" }}>

        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 10, right: 12, background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>

        {/* Previous / next creature */}
        {position && position.count > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, paddingRight: 28 }}>
            <button className="chip" onClick={onPrev} aria-label="Previous creature">◀ Prev</button>
            <span className="pixel-font" style={{ fontSize: 13, color: MUTED }}>{position.index + 1} / {position.count}</span>
            <button className="chip" onClick={onNext} aria-label="Next creature">Next ▶</button>
          </div>
        )}

        {/* Name plate */}
        <div style={{ paddingRight: 28, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            <span className="pixel-font" style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color: c.text, border: `2px solid ${c.border}`, background: c.glow }}>{creature.rarity}</span>
            <RaceTag race={template?.race} />
            <ClassBadge cls={template?.cls} />
            {template && prof && <TypeTags roles={creatureRoles(prof)} />}
          </div>
          <h2 className="pixel-font" style={{ margin: 0, fontSize: 26, fontWeight: 600, color: c.text, lineHeight: 1.1 }}>{creature.name}</h2>
          {template?.flavour && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#a9a59a", fontStyle: "italic", lineHeight: 1.4 }}>{template.flavour}</p>}
          <AbilityTag ability={creature.ability} />
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
                <MoveSlots template={template} moves={loadout?.moves ?? creature.moves} born={creature.moves} learned={creature.learned} onChange={onSetMoves} />
                <CodexShelf template={template} known={[...(creature.moves ?? template.skills.slice(0, 4).map((s) => s.name)), ...(creature.learned ?? [])]} codexes={codexes} onLearn={onLearnCodex} />
              </>
            )}

            {tab === "gear" && <>
            {/* Paper doll: weapon · creature · armour */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, padding: "12px 8px", background: "radial-gradient(ellipse at 50% 60%, rgba(255,170,80,0.10), transparent 70%), #15161d", border: "2px solid #0e0f14", boxShadow: "inset 0 0 24px rgba(0,0,0,0.6)" }}>
              <Slot label="Weapon" item={weapon} active={picking === "weapon"} onClick={() => openSlot("weapon")} />
              <Pedestal creature={creature} glow={c.glow} border={c.border} hp={next?.s.hp ?? now.s.hp} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                {ARMOR_SLOTS.map((slot, i) => (
                  <Slot key={slot} label={ARMOR_SLOT_INFO[slot].name} item={worn[i]} active={picking === slot} onClick={() => openSlot(slot)} small />
                ))}
              </div>
            </div>

            <SetLine worn={worn} now={setNow} next={previewing && picking !== "weapon" ? setNext : setNow} />

            {/* Gear picker */}
            {picking && (
              <div style={{ marginTop: 10, padding: 10, background: "#15161d", border: "2px solid #8a6a3a" }}>
                <div className="pixel-font" style={{ fontSize: 14, color: GOLD, marginBottom: 8 }}>
                  Choose {picking === "weapon" ? "a weapon" : `a ${slotName}`} — tap any to compare
                </div>
                {options.length === 0 ? (
                  <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>You don&apos;t own a {slotName} piece yet. Scan barcodes or explore the labyrinth to find some.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(62px, 1fr))", gap: 6 }}>
                    {current && (
                      <Tile selected={preview === null} onClick={() => setPreview(null)} title="Take it off">
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
                          onClick={() => setPreview(opt)}>
                          {sp ? <PixelSprite sprite={sp} scale={2.5} /> : <span style={{ fontSize: 22 }}>?</span>}
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
              Stats {previewing && <span style={{ fontSize: 12, color: "#ffd66e" }}>· previewing</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {STATS.map((st) => {
                const total = Math.round(now.s[st.key]);
                const after = next ? Math.round(next.s[st.key]) : total;
                const p = st.key === "hp" ? null : prof![st.key];
                const diff = st.key === "hp" || !base ? 0 : prof![st.key] - base[st.key];
                const gear = st.key === "hp" ? `${template.baseHp} base + ${now.f.weapon.hp + now.f.armor.hp} gear`
                  : `${gearValue(now.f, st.key)} gear × +${p}%`;
                return <StatRow key={st.key} icon={st.icon} label={st.label} color={st.color} max={st.max} total={total} after={after} detail={gear} diff={diff} />;
              })}
            </div>
            {/* The creature's own %s: what each point of gear is multiplied by. */}
            <div className="pixel-font" style={{ fontSize: 14, color: GOLD, margin: "16px 0 8px" }}>
              Gear multipliers <span style={{ fontSize: 12, color: MUTED }}>· how much this creature adds to its gear</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(76px, 1fr))", gap: 5 }}>
              {STATS.filter((st) => st.key !== "hp").map((st) => {
                const k = st.key as Exclude<StatKey, "hp">;
                const d = base ? (prof![k] ?? 0) - (base[k] ?? 0) : 0;
                return (
                  <div key={k} title={`${st.label}: gear ${st.label.toLowerCase()} is boosted by +${prof![k]}%`}
                    style={{ textAlign: "center", padding: "6px 2px", background: "#12131a", border: "2px solid #2a2d38", borderTop: `3px solid ${st.color}` }}>
                    <div style={{ fontSize: 13 }}>{st.icon}</div>
                    <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.label}</div>
                    <div style={{ ...NUM, fontSize: 18, color: st.color }}>+{prof![k]}%</div>
                    <div style={{ fontSize: 11, color: d > 0 ? "#7CFC9A" : d < 0 ? "#ff8a80" : MUTED }}>{d > 0 ? `+${d} roll` : d < 0 ? `${d} roll` : "standard"}</div>
                  </div>
                );
              })}
            </div>

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
    </div>
  );
}

function gearValue(f: NonNullable<ReturnType<typeof fighterFor>>, key: StatKey): number {
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
      <div style={{ position: "relative", padding: "6px 10px 0" }}>
        <div style={{ position: "absolute", inset: "10% 0 12%", background: `radial-gradient(circle, ${glow}, transparent 70%)`, filter: "blur(2px)" }} />
        <PixelSprite sprite={creatureSprite(creature.creatureId)} scale={5} title={creature.name} style={{ position: "relative" }} />
      </div>
      <div style={{ width: 120, height: 14, marginTop: -6, background: "#3a3f4c", borderTop: `3px solid ${border}`, boxShadow: "inset 0 -3px 0 #23262f, 0 3px 0 rgba(0,0,0,0.5)", borderRadius: "50% / 40%" }} />
      <div style={{ ...NUM, fontSize: 15, color: "#ff8a80", marginTop: 6 }}>❤️ {Math.round(hp)} HP</div>
    </div>
  );
}

// An equipment slot: a framed square with the item's sprite.
function Slot({ label, item, active, onClick, small }: { label: string; item?: CreatureOrItemDrop; active: boolean; onClick: () => void; small?: boolean }) {
  const col = item ? RARITY_COLORS[item.rarity] : undefined;
  const sp = item && itemSprite(item);
  const size = small ? 46 : 72;
  return (
    <button onClick={onClick} title={item ? `${item.name} — tap to change` : `Equip ${label.toLowerCase()}`}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "white", minWidth: 0 }}>
      <span className="pixel-font" style={{ fontSize: small ? 9 : 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{
        width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
        background: item ? `radial-gradient(circle, ${col!.glow}, #101117 75%)` : "#101117",
        border: `3px solid ${active ? "#ffd66e" : col ? col.border : "#2f3340"}`,
        boxShadow: `inset 2px 2px 0 rgba(255,255,255,0.06), 0 3px 0 rgba(0,0,0,0.5)${active ? ", 0 0 12px rgba(255,214,110,0.5)" : ""}`,
      }}>
        {sp ? <PixelSprite sprite={sp} scale={small ? 2.2 : 3.5} /> : <span style={{ fontSize: small ? 18 : 26, color: "#3a3e4b" }}>＋</span>}
      </span>
      {!small && (
        <span style={{ fontSize: 11, lineHeight: 1.2, textAlign: "center", color: item ? rarityColor(item.rarity) : MUTED, maxWidth: 110 }}>
          {item ? item.name : "Empty"}
        </span>
      )}
    </button>
  );
}

// The armour set: its mechanic if all three pieces match, or how close you are.
// next: the set with the previewed piece in (same as now when not previewing).
function SetLine({ worn, now, next }: { worn: (CreatureOrItemDrop | undefined)[]; now?: ArmorKey; next?: ArmorKey }) {
  const box = (children: React.ReactNode, lit: boolean) => (
    <div style={{ marginTop: 8, padding: "7px 10px", fontSize: 12, lineHeight: 1.4, background: lit ? "rgba(255,214,110,0.08)" : "#12131a",
      border: `2px solid ${lit ? "#8a6a3a" : "#2a2d38"}`, color: lit ? "#f1d9a0" : MUTED, minHeight: 40 }}>{children}</div>
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

function Tile({ children, rarity, selected, title, onClick, disabled }: {
  children: React.ReactNode; rarity?: Rarity; selected?: boolean; title?: string; onClick: () => void; disabled?: boolean;
}) {
  const col = rarity ? RARITY_COLORS[rarity] : undefined;
  return (
    <button onClick={onClick} title={title} aria-pressed={selected} disabled={disabled}
      style={{
        opacity: disabled ? 0.35 : 1,
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
function StatRow({ icon, label, color, max, total, after, detail, diff }: {
  icon: string; label: string; color: string; max: number; total: number; after: number; detail: string; diff: number;
}) {
  const pct = (v: number) => Math.min(100, (v / max) * 100);
  const change = after - total;
  const lo = Math.min(total, after), hi = Math.max(total, after);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "22px minmax(70px, 96px) 1fr auto", alignItems: "center", columnGap: 8 }}>
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
      <span style={{ ...NUM, minWidth: 104, textAlign: "right", fontSize: 18, whiteSpace: "nowrap" }}>
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
                    {mv ? `${mv.self ? "Utility" : `${mv.type} · ${mv.damage} dmg`} · ${mv.energyCost} energy. ` : ""}Learns {c.codexMove} for good; the codex crumbles to dust.
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
