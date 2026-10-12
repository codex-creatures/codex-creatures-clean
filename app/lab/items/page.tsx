"use client";

import { useMemo, useState } from "react";

import type { Rarity } from "../../../lib/items/budgets";
import { RARITY_BUDGETS } from "../../../lib/items/budgets";
import { ITEM_CEILINGS, ITEM_KEYS, STAT_KEYS, type ItemKey, type StatBlock } from "../../../lib/items/ceilings";
import { rollItemStats } from "../../../lib/items/rollItemStats";

type BatchSummary = {
  rolls: number;
  min: StatBlock;
  max: StatBlock;
  avg: StatBlock;
};

function emptyStats(): StatBlock {
  return { melee: 0, ranged: 0, agility: 0, hp: 0 };
}

function sumStats(s: StatBlock): number {
  return STAT_KEYS.reduce((acc, k) => acc + s[k], 0);
}
function getHighestStat(s: StatBlock) {
  let bestKey = STAT_KEYS[0];
  let bestVal = s[bestKey];

  for (const k of STAT_KEYS) {
    if (s[k] > bestVal) {
      bestVal = s[k];
      bestKey = k;
    }
  }

  const tied = STAT_KEYS.filter((k) => s[k] === bestVal);
  return { bestVal, tied };
}

function getZeroStats(s: StatBlock) {
  return STAT_KEYS.filter((k) => s[k] === 0);
}

function computeBatchSummary(list: StatBlock[]): BatchSummary {
  const rolls = list.length;

  const min: StatBlock = { melee: Infinity, ranged: Infinity, agility: Infinity, hp: Infinity };
  const max: StatBlock = { melee: -Infinity, ranged: -Infinity, agility: -Infinity, hp: -Infinity };
  const sum: StatBlock = emptyStats();

  for (const s of list) {
    for (const k of STAT_KEYS) {
      min[k] = Math.min(min[k], s[k]);
      max[k] = Math.max(max[k], s[k]);
      sum[k] += s[k];
    }
  }

  const avg: StatBlock = emptyStats();
  for (const k of STAT_KEYS) avg[k] = rolls ? Number((sum[k] / rolls).toFixed(2)) : 0;

  // if rolls=0, clean up Infinity values
  if (!rolls) {
    for (const k of STAT_KEYS) {
      min[k] = 0;
      max[k] = 0;
    }
  }

  return { rolls, min, max, avg };
}

export default function Page() {
  const [item, setItem] = useState<ItemKey>(ITEM_KEYS[0]);
  const [rarity, setRarity] = useState<Rarity>("uncommon");

  const [lastRoll, setLastRoll] = useState<StatBlock | null>(null);
  const [batch, setBatch] = useState<BatchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const budget = RARITY_BUDGETS[rarity];
  const ceilings = useMemo(() => ITEM_CEILINGS[item][rarity], [item, rarity]);

  function rollOne() {
    setError(null);
    setBatch(null);
    try {
      const res = rollItemStats(item, rarity);
      setLastRoll(res.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function rollHundred() {
    setError(null);
    try {
      const rolls: StatBlock[] = [];
      let last: StatBlock | null = null;

      for (let i = 0; i < 100; i++) {
        const res = rollItemStats(item, rarity);
        rolls.push(res.stats);
        last = res.stats;
      }

      setLastRoll(last);
      setBatch(computeBatchSummary(rolls));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Item Roll Lab</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <label>
          Item:&nbsp;
          <select value={item} onChange={(e) => setItem(e.target.value as ItemKey)}>
            {ITEM_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label>
          Rarity:&nbsp;
          <select value={rarity} onChange={(e) => setRarity(e.target.value as Rarity)}>
            <option value="common">common</option>
            <option value="uncommon">uncommon</option>
            <option value="rare">rare</option>
            <option value="epic">epic</option>
            <option value="legendary">legendary</option>
          </select>
        </label>

        <button onClick={rollOne}>Roll 1</button>
        <button onClick={rollHundred}>Roll 100</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div>
          Budget: <b>{budget}</b>
        </div>
        <div>
          Ceilings:&nbsp;
          {STAT_KEYS.map((k) => (
            <span key={k} style={{ marginRight: 12 }}>
              {k}: <b>{ceilings[k]}</b>
            </span>
          ))}
        </div>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 12 }}>ERROR: {error}</div>}

      <hr />

      <h2>Last Roll</h2>
      {lastRoll ? (
        <div>
          <div>
            {STAT_KEYS.map((k) => (
              <span key={k} style={{ marginRight: 12 }}>
                {k}: <b>{lastRoll[k]}</b>
              </span>
            ))}
          </div>
          <div>
            Total: <b>{sumStats(lastRoll)}</b> (must equal {budget})
            <div style={{ marginTop: 6 }}>
              <div>
                Highest Stat: <b>{getHighestStat(lastRoll).tied.join(", ")}</b> ({getHighestStat(lastRoll).bestVal})
              </div>
              <div>
                Zero Stats: <b>
                  {getZeroStats(lastRoll).length
                    ? getZeroStats(lastRoll).join(", ")
                    : "none"}
                </b>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>No roll yet.</div>
      )}

      <hr />

      <h2>Batch Summary (100 rolls)</h2>
      {batch ? (
        <div>
          <div>
            Rolls: <b>{batch.rolls}</b>
          </div>

          <h3>Min</h3>
          <div>
            {STAT_KEYS.map((k) => (
              <span key={k} style={{ marginRight: 12 }}>
                {k}: <b>{batch.min[k]}</b>
              </span>
            ))}
          </div>

          <h3>Avg</h3>
          <div>
            {STAT_KEYS.map((k) => (
              <span key={k} style={{ marginRight: 12 }}>
                {k}: <b>{batch.avg[k]}</b>
              </span>
            ))}
          </div>

          <h3>Max</h3>
          <div>
            {STAT_KEYS.map((k) => (
              <span key={k} style={{ marginRight: 12 }}>
                {k}: <b>{batch.max[k]}</b>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div>Click “Roll 100” to see min/avg/max.</div>
      )}
    </div>
  );
}