"use client";
// app/error.tsx
// If a screen breaks, this shows instead of a blank page: try again, reload,
// or go back to the Den. Progress is saved as you play, so nothing is lost.
// In the Labyrinth a broken run would break the screen again every time you
// go in, so there you can also give the run up (the party comes home, as if
// you'd retreated).

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { endRun, loadDungeon, saveDungeon } from "@/lib/dungeon/run";

export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const path = usePathname();
  const inLabyrinth = path.startsWith("/dungeon");
  const [armed, setArmed] = useState(false);

  useEffect(() => { console.error(error); }, [error]);

  function abandonRun() {
    const cur = loadDungeon();
    if (cur.run) {
      try {
        saveDungeon(endRun({ ...cur, run: { ...cur.run, status: "retreated" } }));
      } catch {
        // The run itself is what's broken: drop it and keep everything else.
        saveDungeon({ ...cur, run: null });
      }
    }
    window.location.href = "/";
  }

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="inv-panel" style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10, textAlign: "center" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-pixel)", color: "#f1d9a0" }}>Something broke</h2>
        <p style={{ margin: 0, color: "#c9bfa6", fontSize: 14 }}>Your progress is saved.</p>
        <button className="pixel-btn" style={{ minHeight: 44 }} onClick={reset}>🔁 Try again</button>
        <button className="pixel-btn" style={{ minHeight: 44 }} onClick={() => window.location.reload()}>♻️ Reload</button>
        <button className="pixel-btn" style={{ minHeight: 44 }} onClick={() => { window.location.href = "/"; }}>🏠 Back to the Den</button>
        {inLabyrinth && (
          <button className="pixel-btn" style={{ minHeight: 44 }} onClick={() => (armed ? abandonRun() : setArmed(true))}>
            {armed ? "Tap again: give up the run" : "🚪 Abandon this run"}
          </button>
        )}
        {/* Small print, for telling Claude what went wrong. */}
        <p style={{ margin: 0, color: "#6f6858", fontSize: 11, wordBreak: "break-word", minHeight: "2.4em" }}>{error.message}</p>
      </div>
    </div>
  );
}
