"use client";
// app/simulator/page.tsx — Manual combat simulator

import { useState, useCallback } from "react";
import { CREATURE_TEMPLATES, type CreatureTemplate, type Skill } from "@/lib/creatures/creatureData";
import { calcDamage, effectiveAgil, type Fighter, type Stance, type TurnLog } from "@/lib/combat/engine";
import { ITEM_KEYS } from "@/lib/items/ceilings";
import { ARMOR_KEYS, ARMOR_META } from "@/lib/items/armor";
import { RARITY_WEIGHTS } from "@/lib/items/budgets";
import type { Rarity } from "@/lib/items/budgets";
import { rollItemStats } from "@/lib/items/rollItemStats";
import { rollArmorStats } from "@/lib/items/rollArmorStats";
import { ITEM_META } from "@/lib/items/metadata";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { buildFighter } from "@/lib/combat/loadout";

type SimWeapon = { id: string; name: string; rarity: Rarity; itemKey: string; stats: Record<string, number> };
type SimArmor  = { id: string; name: string; rarity: Rarity; armorKey: string; stats: Record<string, number> };
type LiveFighter = Fighter & { currentHp: number; currentEnergy: number };

function rollRarity(): Rarity {
  const entries = Object.entries(RARITY_WEIGHTS) as [Rarity, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = Math.floor(Math.random() * total) + 1;
  for (const [rarity, weight] of entries) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return "common";
}

function rollWeapons(n: number): SimWeapon[] {
  return Array.from({ length: n }, (_, i) => {
    const rarity  = rollRarity();
    const itemKey = ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)];
    const rolled  = rollItemStats(itemKey, rarity, Math.random);
    const meta    = ITEM_META[itemKey];
    return { id: `w${i}`, name: meta?.name ?? itemKey, rarity, itemKey, stats: rolled.stats };
  });
}

function rollArmors(n: number): SimArmor[] {
  return Array.from({ length: n }, (_, i) => {
    const rarity   = rollRarity();
    const armorKey = ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)];
    const rolled   = rollArmorStats(armorKey, rarity, Math.random);
    const meta     = ARMOR_META[armorKey];
    return { id: `a${i}`, name: meta?.name ?? armorKey, rarity, armorKey, stats: rolled.stats };
  });
}

function toLive(f: Fighter): LiveFighter {
  return { ...f, currentHp: f.maxHp, currentEnergy: 100 };
}

const BG    = "#0a0a12";
const PANEL = "#0f0f1e";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT  = "rgba(255,255,255,0.88)";
const MUTED = "rgba(255,255,255,0.4)";
const P1COL = "#4ea1ff";
const P2COL = "#ff6b6b";

const rarityColor = (r: Rarity) => RARITY_COLORS[r]?.text ?? "white";

function btn(active = false, color = P1COL): React.CSSProperties {
  return { padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, border: active ? `1px solid ${color}` : `1px solid ${BORDER}`, background: active ? `${color}22` : "transparent", color: active ? color : TEXT, transition: "all 0.15s" };
}

function StatPill({ label, value }: { label: string; value: number }) {
  return <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: MUTED, marginRight: 4, display: "inline-block", marginBottom: 2 }}>{label} <b style={{ color: TEXT }}>{value}</b></span>;
}

function ItemCard({ item, selected, onClick }: { item: SimWeapon | SimArmor; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 4, cursor: "pointer", border: selected ? `1px solid ${rarityColor(item.rarity)}` : "1px solid transparent", background: selected ? "rgba(255,255,255,0.04)" : "transparent" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: rarityColor(item.rarity), textTransform: "uppercase" }}>{item.rarity[0]}</span>
        <span style={{ fontSize: 13 }}>{item.name}</span>
      </div>
      <div>{Object.entries(item.stats).filter(([, v]) => v > 0).map(([k, v]) => <StatPill key={k} label={k} value={v as number} />)}</div>
    </div>
  );
}

function CreatureCard({ c, selected, onClick }: { c: CreatureTemplate; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 4, cursor: "pointer", border: selected ? `1px solid ${rarityColor(c.rarity)}` : "1px solid transparent", background: selected ? "rgba(255,255,255,0.04)" : "transparent" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: rarityColor(c.rarity), textTransform: "uppercase" }}>{c.rarity[0]}</span>
        <span style={{ fontSize: 13 }}>{c.name}</span>
        <span style={{ fontSize: 11, color: MUTED, marginLeft: "auto" }}>HP {c.baseHp}</span>
      </div>
      <div>{Object.entries(c.proficiency).map(([k, v]) => <StatPill key={k} label={k} value={v} />)}</div>
    </div>
  );
}

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = pct > 50 ? "#22c55e" : pct > 25 ? "#f5c542" : "#ff6b6b";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color, fontWeight: 700 }}>HP</span>
        <span style={{ color: TEXT }}>{Math.max(0, current)} / {max}</span>
      </div>
      <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function EnergyBar({ current }: { current: number }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "#a855f7", fontWeight: 700 }}>Energy</span>
        <span style={{ color: TEXT }}>{current} / 100</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${current}%`, background: "#a855f7", borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

export default function SimulatorPage() {
  const [weapons, setWeapons] = useState<SimWeapon[]>([]);
  const [armors,  setArmors]  = useState<SimArmor[]>([]);

  const [p1Creature, setP1Creature] = useState<CreatureTemplate | null>(null);
  const [p1Weapon,   setP1Weapon]   = useState<SimWeapon | null>(null);
  const [p1Armor,    setP1Armor]    = useState<SimArmor | null>(null);
  const [p2Creature, setP2Creature] = useState<CreatureTemplate | null>(null);
  const [p2Weapon,   setP2Weapon]   = useState<SimWeapon | null>(null);
  const [p2Armor,    setP2Armor]    = useState<SimArmor | null>(null);

  const [p1Live, setP1Live] = useState<LiveFighter | null>(null);
  const [p2Live, setP2Live] = useState<LiveFighter | null>(null);
  const [log,    setLog]    = useState<TurnLog[]>([]);
  const [round,  setRound]  = useState(0);
  const [winner, setWinner] = useState<string | null>(null);

  const [p1Skill,  setP1Skill]  = useState<Skill | null>(null);
  const [p2Skill,  setP2Skill]  = useState<Skill | null>(null);
  const [p1Stance, setP1Stance] = useState<Stance>("neutral");
  const [p2Stance, setP2Stance] = useState<Stance>("neutral");

  const [selecting, setSelecting] = useState<"p1c"|"p1w"|"p1a"|"p2c"|"p2w"|"p2a" | null>(null);

  const rollAll = useCallback(() => {
    setWeapons(rollWeapons(50));
    setArmors(rollArmors(50));
    setP1Weapon(null); setP1Armor(null);
    setP2Weapon(null); setP2Armor(null);
    setP1Live(null); setP2Live(null);
    setLog([]); setRound(0); setWinner(null);
  }, []);

  const canSetup = p1Creature && p1Weapon && p1Armor && p2Creature && p2Weapon && p2Armor;

  function startBattle() {
    if (!canSetup) return;
    const f1 = buildFighter(p1Creature!, p1Weapon!.stats, p1Armor!.stats);
    const f2 = buildFighter(p2Creature!, p2Weapon!.stats, p2Armor!.stats);
    setP1Live(toLive(f1));
    setP2Live(toLive(f2));
    setLog([]); setRound(0); setWinner(null);
    setP1Skill(null); setP2Skill(null);
    setP1Stance("neutral"); setP2Stance("neutral");
  }

  function resolveRound() {
    if (!p1Live || !p2Live || !p1Skill || !p2Skill || winner) return;

    const newRound = round + 1;
    const newLog = [...log];

    const a1: Fighter = { ...p1Live, hp: p1Live.currentHp, energy: p1Live.currentEnergy, stance: p1Stance };
    const a2: Fighter = { ...p2Live, hp: p2Live.currentHp, energy: p2Live.currentEnergy, stance: p2Stance };

    const agil1 = effectiveAgil(a1);
    const agil2 = effectiveAgil(a2);
    const p1First = agil1 >= agil2;

    const ordered: [Fighter, Skill, "p1"|"p2"][] = p1First
      ? [[a1, p1Skill, "p1"], [a2, p2Skill, "p2"]]
      : [[a2, p2Skill, "p2"], [a1, p1Skill, "p1"]];

    let hp1 = p1Live.currentHp;
    let hp2 = p2Live.currentHp;
    let e1  = Math.min(100, p1Live.currentEnergy + 30);
    let e2  = Math.min(100, p2Live.currentEnergy + 30);

    for (const [atker, skill, who] of ordered) {
      const isP1 = who === "p1";
      const atkHp     = isP1 ? hp1 : hp2;
      const defHp     = isP1 ? hp2 : hp1;
      const atkEnergy = isP1 ? e1 : e2;

      if (atkHp <= 0 || defHp <= 0) continue;
      if (skill.energyCost > atkEnergy) continue;

      const precise = Math.random() < 0.05;
      const atkFighter: Fighter = { ...atker, hp: atkHp, energy: atkEnergy, stance: isP1 ? p1Stance : p2Stance };
      const defFighter: Fighter = { ...(isP1 ? a2 : a1), hp: defHp, stance: isP1 ? p2Stance : p1Stance };

      const { damage: dmg, braceBlocked, braceFailed } = calcDamage(skill, atkFighter, defFighter, precise);
      const hpBefore = defHp;

      if (isP1) { e1 -= Number(skill.energyCost); hp2 = Math.max(0, hp2 - Number(dmg)); }
      else       { e2 -= Number(skill.energyCost); hp1 = Math.max(0, hp1 - Number(dmg)); }

      newLog.unshift({
        turn: newRound,
        attacker: atker.name,
        defender: isP1 ? a2.name : a1.name,
        skill,
        stance: isP1 ? p1Stance : p2Stance,
        defenderStance: isP1 ? p2Stance : p1Stance,
        rawDamage: skill.damage,
        finalDamage: dmg,
        precise,
        braceBlocked,
        braceFailed,
        attackerEnergyBefore: atkEnergy,
        attackerEnergyAfter: isP1 ? e1 : e2,
        defenderHpBefore: hpBefore,
        defenderHpAfter: isP1 ? hp2 : hp1,
        stanceChosen: isP1 ? p1Stance : p2Stance,
      });
    }

    setP1Live(prev => prev ? { ...prev, currentHp: hp1, currentEnergy: e1 } : null);
    setP2Live(prev => prev ? { ...prev, currentHp: hp2, currentEnergy: e2 } : null);
    setLog(newLog);
    setRound(newRound);
    setP1Skill(null);
    setP2Skill(null);

    if (hp1 <= 0 || hp2 <= 0) {
      setWinner(hp1 <= 0 && hp2 <= 0 ? "Draw" : hp1 <= 0 ? p2Live.name : p1Live.name);
    }
  }

  const inBattle = !!p1Live && !!p2Live;
  const bothPicked = !!p1Skill && !!p2Skill;
  const STANCES: Stance[] = ["neutral", "float", "entrench"];
  const stanceDesc: Record<Stance, string> = {
    neutral:  "No modifiers",
    float:    "+10% ranged dealt, -10% melee taken, +10% ranged taken",
    entrench: "+10% melee dealt, -10% ranged taken, +10% melee taken",
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>⚔️ Combat Simulator</h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>Manual mode — pick skills each turn. Isolated from main game.</p>
          </div>
          <button onClick={rollAll} style={{ ...btn(false, "#22c55e"), fontSize: 14, padding: "10px 22px" }}>🎲 Roll 50 Weapons + 50 Armor</button>
        </div>

        {weapons.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 12, color: MUTED }}>
            Press the button above to generate your test inventory
          </div>
        )}

        {weapons.length > 0 && !inBattle && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              {([["p1", "Player 1", P1COL], ["p2", "Player 2", P2COL]] as const).map(([pid, label, col]) => {
                const creature = pid === "p1" ? p1Creature : p2Creature;
                const weapon   = pid === "p1" ? p1Weapon   : p2Weapon;
                const armor    = pid === "p1" ? p1Armor    : p2Armor;
                return (
                  <div key={pid} style={{ background: PANEL, borderRadius: 12, padding: 16, border: `1px solid ${col}33` }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 15, color: col }}>{label}</h3>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Creature</div>
                      {creature ? <CreatureCard c={creature} selected onClick={() => setSelecting(`${pid}c` as any)} /> : <button onClick={() => setSelecting(`${pid}c` as any)} style={{ ...btn(false, col), width: "100%" }}>Select Creature</button>}
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Weapon</div>
                      {weapon ? <ItemCard item={weapon} selected onClick={() => setSelecting(`${pid}w` as any)} /> : <button onClick={() => setSelecting(`${pid}w` as any)} style={{ ...btn(false, col), width: "100%" }}>Select Weapon</button>}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Armor</div>
                      {armor ? <ItemCard item={armor} selected onClick={() => setSelecting(`${pid}a` as any)} /> : <button onClick={() => setSelecting(`${pid}a` as any)} style={{ ...btn(false, col), width: "100%" }}>Select Armor</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            {canSetup && (
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <button onClick={startBattle} style={{ ...btn(false, "#f5c542"), fontSize: 16, padding: "12px 40px" }}>⚔️ Start Battle</button>
              </div>
            )}
          </>
        )}

        {inBattle && p1Live && p2Live && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              {([["p1", p1Live, P1COL], ["p2", p2Live, P2COL]] as const).map(([pid, live, col]) => (
                <div key={pid} style={{ background: PANEL, borderRadius: 12, padding: 16, border: `1px solid ${col}33` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: col }}>{live.name}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>Round {round}</span>
                  </div>
                  <HpBar current={live.currentHp} max={live.maxHp} color={col} />
                  <EnergyBar current={live.currentEnergy} />
                </div>
              ))}
            </div>

            {!winner && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  {([
                    ["p1", p1Live, P1COL, p1Stance, setP1Stance, p1Skill, setP1Skill],
                    ["p2", p2Live, P2COL, p2Stance, setP2Stance, p2Skill, setP2Skill],
                  ] as any[]).map(([pid, live, col, stance, setStance, skill, setSkill]: any) => (
                    <div key={pid} style={{ background: PANEL, borderRadius: 12, padding: 16, border: `1px solid ${col}22` }}>
                      <div style={{ fontWeight: 700, color: col, marginBottom: 10, fontSize: 13 }}>{live.name} — Pick Stance</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                        {STANCES.map(s => (
                          <div key={s} style={{ flex: 1, minWidth: 80 }}>
                            <button onClick={() => setStance(s)} style={{ ...btn(stance === s, col), width: "100%", textAlign: "center", padding: "6px 8px", fontSize: 12 }}>{s}</button>
                            <div style={{ fontSize: 11, color: MUTED, marginTop: 3, lineHeight: 1.3 }}>{stanceDesc[s]}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontWeight: 700, color: col, marginBottom: 10, fontSize: 13 }}>Pick Skill</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {live.skills.map((sk: Skill) => {
                          const energyAfterRegen = Math.min(100, live.currentEnergy + 30);
                          const canAfford = sk.energyCost <= energyAfterRegen;
                          const energyAfter = energyAfterRegen - sk.energyCost;
                          return (
                            <button key={sk.name} onClick={() => canAfford && setSkill(sk)} disabled={!canAfford}
                              style={{ ...btn(skill?.name === sk.name, col), opacity: canAfford ? 1 : 0.35, cursor: canAfford ? "pointer" : "not-allowed", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span>{sk.name} <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>({sk.type})</span></span>
                              <span style={{ display: "flex", gap: 10, fontSize: 12 }}>
                                <span style={{ color: "#ff6b6b" }}>💥{sk.damage}</span>
                                <span style={{ color: "#a855f7" }}>⚡{sk.energyCost}</span>
                                {canAfford && <span style={{ color: MUTED }}>→{energyAfter}e</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <button onClick={resolveRound} disabled={!bothPicked}
                    style={{ ...btn(bothPicked, "#f5c542"), fontSize: 16, padding: "12px 40px", opacity: bothPicked ? 1 : 0.4, cursor: bothPicked ? "pointer" : "not-allowed" }}>
                    {bothPicked ? "⚔️ Resolve Round" : `Waiting — ${!p1Skill ? p1Live.name : p2Live.name} hasn't picked`}
                  </button>
                </div>
              </>
            )}

            {winner && (
              <div style={{ textAlign: "center", padding: 24, background: "rgba(245,197,66,0.08)", border: "1px solid rgba(245,197,66,0.3)", borderRadius: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏆</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#f5c542" }}>{winner} wins!</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>after {round} rounds</div>
                <button onClick={startBattle} style={{ ...btn(false, "#22c55e"), marginTop: 16 }}>🔄 Rematch</button>
                <button onClick={() => { setP1Live(null); setP2Live(null); setLog([]); setRound(0); setWinner(null); }} style={{ ...btn(false), marginTop: 16, marginLeft: 8 }}>← Change Setup</button>
              </div>
            )}

            {log.length > 0 && (
              <div style={{ background: PANEL, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Battle Log — newest first</div>
                <div style={{ maxHeight: 360, overflowY: "auto", fontFamily: "monospace", fontSize: 12 }}>
                  {log.map((t, i) => (
                    <div key={i} style={{ padding: "5px 8px", borderRadius: 6, marginBottom: 2, background: t.precise ? "rgba(245,197,66,0.06)" : i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", borderLeft: t.precise ? "2px solid #f5c542" : "2px solid transparent" }}>
                      <span style={{ color: MUTED, marginRight: 6 }}>R{t.turn}</span>
                      <span style={{ color: t.attacker === p1Live.name ? P1COL : P2COL }}>{t.attacker}</span>
                      <span style={{ color: MUTED }}> → </span>
                      <span style={{ color: TEXT, fontWeight: 600 }}>{t.skill.name}</span>
                      <span style={{ color: MUTED }}> ({t.skill.type}) </span>
                      {t.stance !== "neutral" && <span style={{ color: "#22c55e" }}>[{t.stance}] </span>}
                      {t.precise && <span style={{ color: "#f5c542" }}>⚡ PRECISE </span>}
                      <span style={{ color: "#ff6b6b", fontWeight: 700 }}>−{t.finalDamage}</span>
                      <span style={{ color: MUTED }}> ({t.defender}: {t.defenderHpBefore}→{t.defenderHpAfter})</span>
                      <span style={{ color: "#a855f7", marginLeft: 8 }}>{t.attackerEnergyBefore}→{t.attackerEnergyAfter}e</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {selecting && (
          <div onClick={() => setSelecting(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#12121f", borderRadius: "16px 16px 0 0", padding: 20, width: "100%", maxWidth: 600, maxHeight: "70vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {selecting.includes("c") ? "Select Creature" : selecting.includes("w") ? "Select Weapon" : "Select Armor"}
                  <span style={{ color: MUTED, fontWeight: 400 }}> — {selecting.startsWith("p1") ? "Player 1" : "Player 2"}</span>
                </span>
                <button onClick={() => setSelecting(null)} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>
              {selecting.includes("c") && CREATURE_TEMPLATES.map(c => (
                <CreatureCard key={c.id} c={c} selected={false} onClick={() => { if (selecting === "p1c") setP1Creature(c); else setP2Creature(c); setSelecting(null); }} />
              ))}
              {selecting.includes("w") && weapons.map(w => (
                <ItemCard key={w.id} item={w} selected={false} onClick={() => { if (selecting === "p1w") setP1Weapon(w); else setP2Weapon(w); setSelecting(null); }} />
              ))}
              {selecting.includes("a") && armors.map(a => (
                <ItemCard key={a.id} item={a} selected={false} onClick={() => { if (selecting === "p1a") setP1Armor(a); else setP2Armor(a); setSelecting(null); }} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}