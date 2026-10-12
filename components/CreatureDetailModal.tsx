"use client";
// components/CreatureDetailModal.tsx

import { useEffect, useState } from "react";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import { buildFighter, combatSummary } from "@/lib/combat/loadout";
import type { EquipSlot, Loadout } from "@/hooks/useGameState";

type Props = {
  creature: CreatureOrItemDrop;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  loadout?: Loadout;
  weapons: CreatureOrItemDrop[];
  armors: CreatureOrItemDrop[];
  equippedOn: Map<string, string>;      // item id → creature drop id
  creatureNameById: Map<string, string>; // creature drop id → name
  onEquip: (slot: EquipSlot, itemId: string | null) => void;
  onClose: () => void;
};

const WEAPON_STAT_LABELS: [string, string][] = [["melee", "Atk"], ["ranged", "Rng"], ["agility", "Agi"], ["hp", "HP"]];
const ARMOR_STAT_LABELS:  [string, string][] = [["mDef", "MDef"], ["rDef", "RDef"], ["agility", "Agi"], ["hp", "HP"]];

const MUTED = "rgba(255,255,255,0.45)";

function rarityColor(r: Rarity) {
  return RARITY_COLORS[r]?.text ?? "white";
}

function StatLine({ stats, labels }: { stats?: Record<string, number>; labels: [string, string][] }) {
  return (
    <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
      {labels.map(([k, l]) => `${l} ${stats?.[k] ?? 0}`).join(" · ")}
    </span>
  );
}

function SlotCard({
  title, slot, item, options, labels, equippedOn, creatureNameById, creatureId, onEquip,
}: {
  title: string;
  slot: EquipSlot;
  item?: CreatureOrItemDrop;
  options: CreatureOrItemDrop[];
  labels: [string, string][];
  equippedOn: Map<string, string>;
  creatureNameById: Map<string, string>;
  creatureId: string;
  onEquip: (slot: EquipSlot, itemId: string | null) => void;
}) {
  const [picking, setPicking] = useState(false);
  const sorted = [...options].sort((a, b) =>
    RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.name.localeCompare(b.name)
  );

  return (
    <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{title}</div>
          {item ? (
            <>
              <div style={{ fontWeight: 600, color: rarityColor(item.rarity) }}>{item.name}</div>
              <StatLine stats={item.stats} labels={labels} />
            </>
          ) : (
            <div style={{ color: MUTED, fontStyle: "italic" }}>Empty</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {item && <button onClick={() => onEquip(slot, null)} style={smallBtn}>Unequip</button>}
          <button onClick={() => setPicking((v) => !v)} style={smallBtn} disabled={options.length === 0}>
            {options.length === 0 ? "None owned" : picking ? "Close" : item ? "Change" : "Equip"}
          </button>
        </div>
      </div>

      {picking && (
        <div style={{ marginTop: 10, maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {sorted.map((opt) => {
            const ownerId = equippedOn.get(opt.id);
            const isHere  = ownerId === creatureId;
            const owner   = ownerId && !isHere ? creatureNameById.get(ownerId) : undefined;
            return (
              <button
                key={opt.id}
                disabled={isHere}
                onClick={() => { onEquip(slot, opt.id); setPicking(false); }}
                style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: isHere ? "rgba(255,255,255,0.06)" : "transparent", color: "white", cursor: isHere ? "default" : "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: rarityColor(opt.rarity), fontWeight: 600 }}>{opt.name}</span>
                  {isHere && <span style={{ fontSize: 11, color: MUTED }}>equipped</span>}
                  {owner && <span style={{ fontSize: 11, color: "#f5c542" }}>on {owner}</span>}
                </div>
                <StatLine stats={opt.stats} labels={labels} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export default function CreatureDetailModal({
  creature, isFavorite, onToggleFavorite, loadout, weapons, armors,
  equippedOn, creatureNameById, onEquip, onClose,
}: Props) {
  const template = findCreatureTemplate(creature.creatureId, creature.name);
  const weapon = weapons.find((w) => w.id === loadout?.weaponId);
  const armor  = armors.find((a) => a.id === loadout?.armorId);
  const c = RARITY_COLORS[creature.rarity];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const fighter = template ? buildFighter(template, weapon?.stats, armor?.stats) : null;
  const final   = fighter ? combatSummary(fighter) : null;
  const prof    = template?.proficiency;

  // [label, gear total, proficiency %, final]
  const rows: [string, number, number | null, number][] = template && fighter && final && prof ? [
    ["Health",     template.baseHp + fighter.weapon.hp + fighter.armor.hp, null, final.hp],
    ["Melee",      fighter.weapon.atk,                       prof.atk,  final.atk],
    ["Ranged",     fighter.weapon.rng,                       prof.rng,  final.rng],
    ["Agility",    fighter.weapon.agil + fighter.armor.agil, prof.agil, final.agil],
    ["Melee Def",  fighter.armor.mdef,                       prof.mdef, final.mdef],
    ["Ranged Def", fighter.armor.rdef,                       prof.rdef, final.rdef],
  ] : [];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#0f0f1a", border: `1px solid ${c.border}`, boxShadow: `0 0 40px ${c.glow}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>

        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>

        <div style={{ marginBottom: 18, paddingRight: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: c.text, border: `1px solid ${c.border}`, background: c.glow }}>{creature.rarity}</span>
            <span style={{ fontSize: 12, opacity: 0.45 }}>Creature</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>{creature.name}</h2>
          {template?.flavour && <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.55, fontStyle: "italic", lineHeight: 1.4 }}>{template.flavour}</p>}
        </div>

        {!template ? (
          <p style={{ fontSize: 13, color: MUTED }}>This creature is from an older roster and has no combat data, so it can&apos;t be equipped.</p>
        ) : (
          <>
            {/* Equipment */}
            <SlotCard title="Weapon" slot="weapon" item={weapon} options={weapons} labels={WEAPON_STAT_LABELS}
              equippedOn={equippedOn} creatureNameById={creatureNameById} creatureId={creature.id} onEquip={onEquip} />
            <SlotCard title="Armour" slot="armor" item={armor} options={armors} labels={ARMOR_STAT_LABELS}
              equippedOn={equippedOn} creatureNameById={creatureNameById} creatureId={creature.id} onEquip={onEquip} />

            {/* Combat stats */}
            <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", margin: "18px 0 8px" }}>Combat stats</div>
            <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "1fr auto auto auto", columnGap: 14, rowGap: 6, fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: MUTED, fontSize: 11 }}></span>
              <span style={{ color: MUTED, fontSize: 11, textAlign: "right" }}>Gear</span>
              <span style={{ color: MUTED, fontSize: 11, textAlign: "right" }}>Creature</span>
              <span style={{ color: MUTED, fontSize: 11, textAlign: "right" }}>Total</span>
              {rows.map(([label, gear, pct, total]) => (
                <Row key={label} label={label} gear={gear} pct={pct} total={total} baseHp={label === "Health" ? template.baseHp : undefined} />
              ))}
            </div>
            <p style={{ fontSize: 11, color: MUTED, margin: "8px 0 0", lineHeight: 1.4 }}>
              Creature % boosts the matching gear stats. Health is the creature&apos;s base HP plus gear HP.
            </p>

            {/* Skills */}
            <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", margin: "18px 0 8px" }}>Skills</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {template.skills.map((s) => (
                <span key={s.name} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)" }}>
                  {s.name} <span style={{ color: MUTED }}>· {s.type} · {s.damage} dmg · {s.energyCost}⚡</span>
                </span>
              ))}
            </div>
          </>
        )}

        <button onClick={() => onToggleFavorite(creature.id)} style={{ marginTop: 20, width: "100%", padding: "11px 0", borderRadius: 10, border: isFavorite ? "1px solid rgba(245,197,66,0.6)" : "1px solid rgba(255,255,255,0.15)", background: isFavorite ? "rgba(245,197,66,0.12)" : "transparent", color: isFavorite ? "#f5c542" : "rgba(255,255,255,0.7)", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          {isFavorite ? "★ In your roster" : "☆ Add to roster"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, gear, pct, total, baseHp }: { label: string; gear: number; pct: number | null; total: number; baseHp?: number }) {
  return (
    <>
      <span>{label}</span>
      <span style={{ textAlign: "right", color: MUTED }}>{baseHp !== undefined ? `${baseHp} + ${gear - baseHp}` : gear}</span>
      <span style={{ textAlign: "right", color: pct ? "#22c55e" : MUTED }}>{pct === null ? "—" : `+${pct}%`}</span>
      <span style={{ textAlign: "right", fontWeight: 700 }}>{Math.round(total)}</span>
    </>
  );
}

const smallBtn: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 6, fontSize: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "transparent", color: "white", cursor: "pointer",
};
