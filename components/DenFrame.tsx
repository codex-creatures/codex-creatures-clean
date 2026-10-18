"use client";
// components/DenFrame.tsx
// A screen opened from the Den (altar, chest, pit, the Labyrinth…), built to
// fill the game screen (components/GameScreen.tsx) exactly:
// - a header bar along the top: back, the title, your gold;
// - the content, scrolling inside itself (or, with `fill`, given the whole
//   space to lay out as it likes: a battle);
// - an optional dock along the bottom, built into the screen (`dock`).

import Link from "next/link";
import GoldCount from "./GoldCount";

export default function DenFrame({
  title, icon, gold, back = "/", backLabel = "Den", fill, dock, children,
}: {
  title: string;
  icon?: string;
  gold?: number;
  back?: string;
  backLabel?: string;
  width?: number; // (no longer used: every screen is the game screen's width)
  fill?: boolean;
  dock?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="screen-page">
      <header className="screen-header">
        <Link href={back} className="pixel-font" style={{ color: "#c9b48a", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>← {backLabel}</Link>
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 19, color: "#f1d9a0", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60cqw" }}>
          {icon ? `${icon} ` : ""}{title}
        </h1>
        <span style={{ textAlign: "right" }}>{gold !== undefined && <GoldCount gold={gold} />}</span>
      </header>
      <div className={fill ? "screen-fill" : "screen-scroll"}>{children}</div>
      {dock && <footer className="screen-dock">{dock}</footer>}
    </main>
  );
}
