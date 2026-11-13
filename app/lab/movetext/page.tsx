"use client";
// app/lab/movetext/page.tsx — does every move's text fit? (dev tool, not in the game)
// Every move drawn as MoveTile in each place the game shows tablets (lib/uiText.ts TABLET_PLACES,
// on its small PHONE), and its details window (MoveDetails, with EXTRA_LINES of a fight's effect
// lines). Names: no word split, two lines at most. Details: nothing cut off. It also measures what
// lib/uiText.ts estimates (NAME_EM, DESC_LINE), so the quick tests' sums can be checked against a
// real browser. Failures are listed at the top, and as JSON in #report for scripts.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MoveDetails, MoveTile } from "@/components/MoveTile";
import { MOVE_BY_NAME, type Skill } from "@/lib/creatures/creatureData";
import { DESC_LINE, EXTRA_LINES, MOVE_DETAILS, NAME_EM, PHONE, TABLET_PLACES, wrapLines } from "@/lib/uiText";

// A fight's effect lines at their longest (components/BattleScreen.tsx MoveButton's tags).
const SAMPLE_EXTRA = ["40%: they flee · else attacks −20%", "poison cloud: 6% a round, 2–4 rounds", "recharging: 2 rounds"].slice(0, EXTRA_LINES);

// True once in the browser. The tiles are only drawn there: drawn at build time, every move in
// every place came to over 20 MB of HTML, past what Vercel will deploy (2026-11-14).
const noSubscribe = () => () => {};
const useInBrowser = () => useSyncExternalStore(noSubscribe, () => true, () => false);

type Miss = { place: string; move: string; why: string };
type Report = { misses: Miss[]; nameEm: number; descWorst: { move: string; lines: number; estimate: number } | null };

// The lines a text node is drawn on, and the words split across two lines.
function lineCheck(el: Element): { lines: number; split: string[] } {
  const text = el.firstChild;
  if (!text || text.nodeType !== Node.TEXT_NODE) return { lines: 0, split: [] };
  const s = text.textContent ?? "";
  const r = document.createRange();
  r.selectNodeContents(text);
  const tops = new Set([...r.getClientRects()].map((q) => Math.round(q.top)));
  const split: string[] = [];
  let at = 0;
  for (const word of s.split(" ")) {
    r.setStart(text, at); r.setEnd(text, at + word.length);
    if (new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size > 1) split.push(word);
    at += word.length + 1;
  }
  return { lines: tops.size, split };
}
// A word's drawn width, in em a letter.
function emPerLetter(span: Element, word: string, start: number): number {
  const r = document.createRange();
  r.setStart(span.firstChild!, start); r.setEnd(span.firstChild!, start + word.length);
  return r.getBoundingClientRect().width / (word.length * parseFloat(getComputedStyle(span).fontSize));
}

export default function MoveTextLab() {
  // (One of each name: a move in several races' stones has the same words on each.)
  const moves: Skill[] = [...new Map(Object.values(MOVE_BY_NAME).map((m) => [m.name, m])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const root = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<Report | null>(null);
  const inBrowser = useInBrowser();

  useEffect(() => {
    if (!inBrowser) return;
    let live = true;
    document.fonts.ready.then(() => requestAnimationFrame(() => {
      if (!live || !root.current) return;
      const misses: Miss[] = [];
      let nameEm = 0, descWorst: Report["descWorst"] = null;
      root.current.querySelectorAll<HTMLElement>("[data-cell]").forEach((cell) => {
        const { place, move } = cell.dataset as { place: string; move: string };
        if (place !== "details") {
          const span = cell.querySelector(`[title="${CSS.escape(move)}"] > span`);
          if (!span) return;
          const { lines, split } = lineCheck(span);
          if (split.length) misses.push({ place, move, why: `splits ${split.join(", ")}` });
          else if (lines > 2) misses.push({ place, move, why: `${lines} lines` });
          let at = 0;
          for (const w of move.split(" ")) { nameEm = Math.max(nameEm, emPerLetter(span, w, at)); at += w.length + 1; }
        } else {
          const box = cell.querySelector<HTMLElement>("[data-move-details]")!, desc = cell.querySelector<HTMLElement>("[data-desc]")!;
          if (box.scrollHeight > box.clientHeight + 1) misses.push({ place, move, why: `needs ${box.scrollHeight}px of ${box.clientHeight}px` });
          const lines = Math.round(desc.getBoundingClientRect().height / (MOVE_DETAILS.font * MOVE_DETAILS.lineHeight));
          const estimate = wrapLines(desc.textContent ?? "", DESC_LINE).length;
          if (desc.textContent && lines - estimate > (descWorst ? descWorst.lines - descWorst.estimate : 0)) descWorst = { move, lines, estimate };
        }
      });
      setReport({ misses, nameEm: Math.round(nameEm * 1000) / 1000, descWorst });
    }));
    return () => { live = false; };
  }, [inBrowser]);

  const places = [...TABLET_PLACES.map((p) => ({ id: p.id, name: p.name })), { id: "details", name: "The details window" }];
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Move text: does it fit?</h1>
      <p style={{ fontSize: 13, opacity: 0.7 }}>{moves.length} moves, everywhere a tablet is shown on a {PHONE.w} × {PHONE.h} phone, and the details window. Names: no word split, two lines at most. Details: nothing cut off.</p>
      <section style={{ margin: "12px 0" }}>
        <h2 className="pixel-font" style={{ fontSize: 16, color: report?.misses.length ? "#ff8a80" : "#9be38a" }}>
          {report === null ? "Measuring…" : report.misses.length ? `${report.misses.length} don't fit` : "Everything fits"}
        </h2>
        {report && (
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Widest name letter: {report.nameEm}em (lib/uiText.ts NAME_EM is {NAME_EM}{report.nameEm > NAME_EM ? ": too small!" : ""}).{" "}
            {report.descWorst ? `Descriptions run up to ${report.descWorst.lines - report.descWorst.estimate} line(s) over the estimate (${report.descWorst.move}): DESC_LINE (${DESC_LINE}) is too big.` : `Descriptions are within the estimate (DESC_LINE ${DESC_LINE}).`}
          </p>
        )}
        {report && places.map((p) => {
          const here = report.misses.filter((m) => m.place === p.id);
          return here.length > 0 && (
            <details key={p.id} style={{ fontSize: 13, margin: "4px 0" }}>
              <summary>{p.name}: {here.length}</summary>
              <ul>{here.map((m) => <li key={m.move}><b>{m.move}</b> ({m.why})</li>)}</ul>
            </details>
          );
        })}
        <pre id="report" hidden>{report === null ? "" : JSON.stringify(report)}</pre>
      </section>
      {inBrowser && <div ref={root}>
        {TABLET_PLACES.map((p) => (
          <section key={p.id} style={{ margin: "18px 0" }}>
            <h2 className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>{p.name}</h2>
            {/* A box the screen's width, so cqw units come out as on the phone. */}
            <div style={{ width: PHONE.w, containerType: "inline-size" }}>
              <div style={{ width: p.width, display: "grid", gridTemplateColumns: `repeat(${p.cols}, 1fr)`, gap: p.fill ? 6 : 10 }}>
                {moves.map((m) => (
                  <div key={m.name} data-cell data-place={p.id} data-move={m.name} style={p.cellH ? { height: p.cellH } : undefined}>
                    <MoveTile m={m} fill={p.fill} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
        <section style={{ margin: "18px 0" }}>
          <h2 className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>The details window (with {EXTRA_LINES} fight lines)</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {moves.map((m) => <div key={m.name} data-cell data-place="details" data-move={m.name}><MoveDetails m={m} extra={SAMPLE_EXTRA} /></div>)}
          </div>
        </section>
      </div>}
    </main>
  );
}
