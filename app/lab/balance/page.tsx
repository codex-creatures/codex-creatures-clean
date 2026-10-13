"use client";
// app/lab/balance/page.tsx — automated balance simulations (dev tool)

import { useState } from "react";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import {
  RARITIES, MAX_TURNS, CREATURE_BANDS, runTierList, runStatValue, runTeamBattles, runGearShowdown,
  type GearMode, type TierListResult, type StatValueRow, type TeamSimResult, type CreatureBand, type ShowdownRow,
} from "@/lib/balance/simulate";

const BG = "#0a0a12", PANEL = "#0f0f1e", BORDER = "rgba(255,255,255,0.08)";
const TEXT = "rgba(255,255,255,0.88)", MUTED = "rgba(255,255,255,0.45)";

const GEAR_MODES: { key: GearMode; label: string; help: string }[] = [
  { key: "fitted", label: "Fitted gear", help: "Each creature gets its own gear, with a weapon that suits its type — what a player would equip." },
  { key: "mirror", label: "Same gear",   help: "Both creatures get identical gear each fight — measures the creature itself." },
  { key: "random", label: "Random gear", help: "Each side rolls any weapon, even ones that don't suit the creature." },
  { key: "none",   label: "No gear",     help: "Creatures fight bare — base HP, skills and nothing else." },
];

const rc = (r: Rarity) => RARITY_COLORS[r]?.text ?? "white";
const fmt = (n: number) => n.toFixed(1);

// Green above 50%, red below — for win-rate cells.
function heat(pct: number) {
  const d = Math.max(-1, Math.min(1, (pct - 50) / 50));
  return d >= 0 ? `rgba(34,197,94,${0.08 + d * 0.45})` : `rgba(255,80,80,${0.08 - d * 0.45})`;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${active ? "#4ea1ff" : BORDER}`, background: active ? "rgba(78,161,255,0.15)" : "transparent", color: active ? "#4ea1ff" : TEXT, fontWeight: active ? 700 : 400 }}>
      {children}
    </button>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", flex: "1 1 150px" }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, margin: "2px 0" }}>{value}</div>
      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.3 }}>{hint}</div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "right", padding: "6px 8px", color: MUTED, fontWeight: 500, fontSize: 11, whiteSpace: "nowrap" };
const td: React.CSSProperties = { textAlign: "right", padding: "5px 8px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

export default function BalanceLab() {
  // Tier list
  const [gearMode, setGearMode]     = useState<GearMode>("fitted");
  const [gearRarity, setGearRarity] = useState<Rarity>("epic");
  const [fights, setFights]         = useState(200);
  const [tier, setTier]             = useState<TierListResult | null>(null);
  const [tierLabel, setTierLabel]   = useState("");

  // Stat value
  const [svRarity, setSvRarity] = useState<Rarity>("epic");
  const [bonus, setBonus]       = useState(10);
  const [sv, setSv]             = useState<{ baselineWinPct: number; rows: StatValueRow[] } | null>(null);

  // Team battles
  const [tmRarity, setTmRarity] = useState<Rarity>("epic");
  const [tmBattles, setTmBattles] = useState(1000);
  const [tmBand, setTmBand] = useState<CreatureBand>("rare-legendary");
  const [tmGear, setTmGear] = useState<"fitted" | "optimized">("optimized");

  // Gear showdown
  const [sdBand, setSdBand] = useState<CreatureBand>("rare-legendary");
  const [sd, setSd] = useState<ShowdownRow[] | null>(null);
  const [tm, setTm] = useState<TeamSimResult | null>(null);

  const [busy, setBusy] = useState<string | null>(null);

  // Let the "Running…" label paint before the (synchronous) simulation starts.
  function run(label: string, fn: () => void) {
    setBusy(label);
    setTimeout(() => { fn(); setBusy(null); }, 30);
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>⚖️ Balance Lab</h1>
        <p style={{ margin: "4px 0 20px", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Thousands of automatic 1v1 duels using the real item rolls, creatures and combat engine.
          The auto-battler plays in neutral stance: melee and ranged creatures use their biggest affordable move of their own type; hybrids use whichever move does the most damage against the opponent. Real battles are 3v3 with swaps, so treat these as signals, not verdicts.
        </p>

        {/* ── Tier list ───────────────────────────────────── */}
        <section style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>1 · Creature tier list</h2>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: MUTED }}>Every creature fights every other creature. Win rates include draws as non-wins.</p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: MUTED, width: 70 }}>Gear</span>
            {GEAR_MODES.map((m) => <Chip key={m.key} active={gearMode === m.key} onClick={() => setGearMode(m.key)}>{m.label}</Chip>)}
          </div>
          <div style={{ fontSize: 11, color: MUTED, margin: "0 0 10px 78px" }}>{GEAR_MODES.find((m) => m.key === gearMode)?.help}</div>
          {gearMode !== "none" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: MUTED, width: 70 }}>Gear rarity</span>
              {RARITIES.map((r) => <Chip key={r} active={gearRarity === r} onClick={() => setGearRarity(r)}>{r}</Chip>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: MUTED, width: 70 }}>Fights / pair</span>
            {[50, 200, 1000].map((n) => <Chip key={n} active={fights === n} onClick={() => setFights(n)}>{n}</Chip>)}
          </div>
          <button
            disabled={!!busy}
            onClick={() => run("tier", () => {
              setTier(runTierList({ gearMode, gearRarity, fightsPerPair: fights }));
              setTierLabel(`${GEAR_MODES.find((m) => m.key === gearMode)?.label}${gearMode === "none" ? "" : ` · ${gearRarity}`} · ${fights} fights per pair`);
            })}
            style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#f5c542", color: "#1a1a1a", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
          >
            {busy === "tier" ? "Running…" : "Run tier list"}
          </button>

          {tier && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{tierLabel} — {tier.totalFights.toLocaleString()} fights</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                <Stat label="Avg fight length" value={`${fmt(tier.avgTurns)} turns`} hint="Rounds until someone falls" />
                <Stat label="Stalemates" value={`${fmt(tier.turnLimitPct)}%`} hint={`Fights that hit the ${MAX_TURNS}-turn limit (draw)`} />
                <Stat label="1-damage hits" value={`${fmt(tier.minDamageHitPct)}%`} hint="Hits where defence absorbed everything but the minimum 1" />
                <Stat label="First striker wins" value={`${fmt(tier.firstMoverWinPct)}%`} hint="Of decided fights, how often the faster creature won" />
              </div>

              <h3 style={{ fontSize: 13, margin: "0 0 6px" }}>Creature rarity vs creature rarity <span style={{ color: MUTED, fontWeight: 400 }}>(row&apos;s win % against column)</span></h3>
              <div style={{ overflowX: "auto", marginBottom: 18 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr><th style={th}></th>{RARITIES.map((r) => <th key={r} style={{ ...th, color: rc(r) }}>{r}</th>)}</tr></thead>
                  <tbody>
                    {RARITIES.map((x) => (
                      <tr key={x}>
                        <td style={{ ...td, textAlign: "left", color: rc(x), fontWeight: 600 }}>{x}</td>
                        {RARITIES.map((y) => {
                          const v = tier.rarityVsRarity[x]?.[y] ?? 0;
                          return <td key={y} style={{ ...td, background: x === y ? "transparent" : heat(v) }}>{fmt(v)}%</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 13, margin: "0 0 6px" }}>Creatures</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: "left" }}>#</th>
                      <th style={{ ...th, textAlign: "left" }}>Creature</th>
                      <th style={th}>Win %</th>
                      <th style={th}>Draw %</th>
                      <th style={th}>Win % striking first</th>
                      <th style={th}>Win % striking second</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tier.rows.map((c, i) => (
                      <tr key={c.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <td style={{ ...td, textAlign: "left", color: MUTED }}>{i + 1}</td>
                        <td style={{ ...td, textAlign: "left" }}><span style={{ color: rc(c.rarity), fontWeight: 600 }}>{c.name}</span> <span style={{ fontSize: 11, color: MUTED }}>{c.rarity}</span></td>
                        <td style={{ ...td, background: heat(c.winPct), fontWeight: 700 }}>{fmt(c.winPct)}%</td>
                        <td style={td}>{fmt(c.drawPct)}%</td>
                        <td style={td}>{fmt(c.winPctWhenFirst)}%</td>
                        <td style={td}>{fmt(c.winPctWhenSecond)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ── Stat value ──────────────────────────────────── */}
        <section style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>2 · What is a stat point worth?</h2>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
            Random creature pairs with identical gear. One side gets a bonus to a single stat; the win-rate gain shows how much that stat is worth.
            Every stat costs the same budget when rolling — big differences here mean some points are worth more than others.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: MUTED, width: 70 }}>Gear rarity</span>
            {RARITIES.map((r) => <Chip key={r} active={svRarity === r} onClick={() => setSvRarity(r)}>{r}</Chip>)}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: MUTED, width: 70 }}>Bonus</span>
            {[5, 10, 20].map((n) => <Chip key={n} active={bonus === n} onClick={() => setBonus(n)}>+{n}</Chip>)}
          </div>
          <button
            disabled={!!busy}
            onClick={() => run("sv", () => setSv(runStatValue({ gearRarity: svRarity, bonus, battlesPerStat: 30000 })))}
            style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#f5c542", color: "#1a1a1a", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
          >
            {busy === "sv" ? "Running…" : "Run stat value"}
          </button>

          {sv && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Baseline (no bonus): side A wins {fmt(sv.baselineWinPct)}% — 30,000 duels per stat</div>
              {sv.rows.map((r) => {
                const w = Math.max(0, r.gain) * 8;
                return (
                  <div key={r.key} style={{ display: "grid", gridTemplateColumns: "130px 1fr 70px", gap: 10, alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                    <span>{r.label}</span>
                    <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, w)}%`, background: "#4ea1ff", borderRadius: 999 }} />
                    </div>
                    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{r.gain >= 0 ? "+" : ""}{fmt(r.gain)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Team battles ────────────────────────────────── */}
        <section style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginTop: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>3 · Team battles (3v3 with swapping)</h2>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
            Random teams of 3. Swapping uses your turn (the opponent gets a free hit on the incoming creature) and restores 50% of the leaving creature&apos;s missing energy.
            The auto-battler swaps out of clearly losing matchups and sends in the best matchup after a faint.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: MUTED, width: 70 }}>Gear rarity</span>
            {RARITIES.map((r) => <Chip key={r} active={tmRarity === r} onClick={() => setTmRarity(r)}>{r}</Chip>)}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: MUTED, width: 70 }}>Creatures</span>
            {(Object.keys(CREATURE_BANDS) as CreatureBand[]).map((b) => <Chip key={b} active={tmBand === b} onClick={() => setTmBand(b)}>{CREATURE_BANDS[b].label}</Chip>)}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: MUTED, width: 70 }}>Gear</span>
            <Chip active={tmGear === "optimized"} onClick={() => setTmGear("optimized")}>Optimised</Chip>
            <Chip active={tmGear === "fitted"} onClick={() => setTmGear("fitted")}>Fitted</Chip>
          </div>
          <div style={{ fontSize: 11, color: MUTED, margin: "0 0 10px 78px" }}>
            {tmGear === "optimized"
              ? "Each creature picks its best weapon and armour from 6 owned items per slot — the rolls that suit it best win out."
              : "Each creature gets one random weapon that suits its type, and random armour."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: MUTED, width: 70 }}>Battles</span>
            {[500, 1000, 3000].map((n) => <Chip key={n} active={tmBattles === n} onClick={() => setTmBattles(n)}>{n.toLocaleString()}</Chip>)}
          </div>
          <button
            disabled={!!busy}
            onClick={() => run("tm", () => setTm(runTeamBattles({ gearRarity: tmRarity, gearMode: tmGear, creatureBand: tmBand, battles: tmBattles })))}
            style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#f5c542", color: "#1a1a1a", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
          >
            {busy === "tm" ? "Running…" : "Run team battles"}
          </button>

          {tm && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                <Stat label="Battle length" value={`${fmt(tm.avgRounds)} rounds`} hint="Rounds until one team is wiped" />
                <Stat label="Swaps" value={`${tm.swapsPerBattle.toFixed(2)} / battle`} hint="Voluntary swaps by both teams" />
                <Stat label="1-damage hits" value={`${fmt(tm.minDamageHitPct)}%`} hint="Hits fully absorbed by defence (counters at work)" />
                <Stat label="Good play wins" value={`${fmt(tm.smartWinPct)}%`} hint="Same teams: swaps + best send-ins vs no swaps + send in next in line. 50% = decisions don't matter" />
                <Stat label="Swapping wins" value={`${fmt(tm.swapperWinPct)}%`} hint="Same teams: swapping side vs side that never swaps" />
                <Stat label="Rarer team wins" value={`${fmt(tm.strongerTeamWinPct)}%`} hint="Team with higher total creature rarity (ties excluded)" />
              </div>

              <h3 style={{ fontSize: 13, margin: "0 0 6px" }}>Win % by team rarity gap <span style={{ color: MUTED, fontWeight: 400 }}>(rarity points: common 0 … legendary 4, summed over the team)</span></h3>
              <div style={{ overflowX: "auto", marginBottom: 18 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr><th style={{ ...th, textAlign: "left" }}>Gap</th>{tm.byRarityGap.map((g) => <th key={g.gap} style={th}>{g.gap > 0 ? `+${g.gap}` : g.gap}</th>)}</tr></thead>
                  <tbody>
                    <tr>
                      <td style={{ ...td, textAlign: "left", color: MUTED }}>Win %</td>
                      {tm.byRarityGap.map((g) => <td key={g.gap} style={{ ...td, background: heat(g.winPct) }}>{fmt(g.winPct)}%</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 13, margin: "0 0 6px" }}>Win % of teams containing each creature</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 4 }}>
                {tm.creatures.map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderRadius: 6, background: heat(c.winPct), fontSize: 13 }}>
                    <span style={{ color: rc(c.rarity), fontWeight: 600 }}>{c.name}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmt(c.winPct)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Gear showdown ───────────────────────────────── */}
        <section style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginTop: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>4 · Good roll vs bigger stats</h2>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
            The same three creatures on both sides — only gear differs. One team equips optimised gear (best of 6 per slot) one rarity lower; the other equips ordinary fitted gear one rarity higher.
            The control column shows optimised vs ordinary at the same rarity: how much a good build is worth on its own.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: MUTED, width: 70 }}>Creatures</span>
            {(Object.keys(CREATURE_BANDS) as CreatureBand[]).map((b) => <Chip key={b} active={sdBand === b} onClick={() => setSdBand(b)}>{CREATURE_BANDS[b].label}</Chip>)}
          </div>
          <button
            disabled={!!busy}
            onClick={() => run("sd", () => setSd(runGearShowdown({ band: sdBand, battles: 800 })))}
            style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#f5c542", color: "#1a1a1a", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}
          >
            {busy === "sd" ? "Running… (a few seconds)" : "Run showdown"}
          </button>

          {sd && (
            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left" }}>Optimised gear</th>
                    <th style={{ ...th, textAlign: "left" }}>vs ordinary gear</th>
                    <th style={th}>Optimised wins</th>
                    <th style={th}>Control (same rarity)</th>
                  </tr>
                </thead>
                <tbody>
                  {sd.map((r) => (
                    <tr key={r.optimized} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ ...td, textAlign: "left", color: rc(r.optimized), fontWeight: 600 }}>{r.optimized}</td>
                      <td style={{ ...td, textAlign: "left", color: rc(r.stronger), fontWeight: 600 }}>{r.stronger}</td>
                      <td style={{ ...td, background: heat(r.winPct), fontWeight: 700 }}>{fmt(r.winPct)}%</td>
                      <td style={{ ...td, background: heat(r.sameRarityWinPct) }}>{fmt(r.sameRarityWinPct)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
