"use client";
// components/DailyPopup.tsx
// A small reminder over the Den as you come in: today's daily quests not yet
// claimed (lib/daily.ts openQuests), each with its reward and how far along it
// is. Once a day per visit to the site (so again when new quests come at
// midnight), and only while there's one open. A tap anywhere puts it away;
// its button goes to the quest board.

import Link from "next/link";
import { useEffect, useState } from "react";
import { DAILY_ONLINE, dayKey, openQuests, todayDaily } from "@/lib/daily";

// The day it was last shown on this visit (kept between screens, not saved).
let shownDay: string | null = null;

// ready: the Den's loaded and nothing else needs you first (Klutz's tour, your first creature).
// now: the Den's clock, so it notices midnight.
export default function DailyPopup({ ready, now }: { ready: boolean; now: number }) {
  const [open, setOpen] = useState<ReturnType<typeof openQuests> | null>(null);
  const day = dayKey(new Date(now));
  useEffect(() => {
    if (!ready || shownDay === day) return;
    shownDay = day;
    // (todayDaily fixes today's quests in the save, as the board does.)
    const quests = openQuests(todayDaily(DAILY_ONLINE));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (quests.length) setOpen(quests);
  }, [ready, day]);
  if (!open) return null;
  return (
    <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(0, 0, 0, 0.3)" }}>
      <div className="stone-panel" style={{ width: "min(320px, 86cqw)", padding: 10 }}>
        <div className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0", marginBottom: 6 }}>📜 Today&apos;s quests</div>
        {open.map(({ q, i, done, progress }) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: 8, padding: "5px 0", borderTop: "1px solid #2a2d38" }}>
            <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={q.task}>{q.task}</div>
            <div className="pixel-font" style={{ fontSize: 12, color: done ? "#5ee08a" : "#a9a9b8", whiteSpace: "nowrap" }}>{done ? "✓ Claim" : `${progress}/${q.goal}`}</div>
            <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#d8d4c8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={q.pays}>🎁 {q.pays}</div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span className="pixel-font" style={{ fontSize: 11, color: "#8a8a99" }}>Tap to close</span>
          <Link href="/board" className="chip" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>Quest Board</Link>
        </div>
      </div>
    </div>
  );
}
