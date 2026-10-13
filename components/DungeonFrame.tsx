"use client";
// components/DungeonFrame.tsx
// Shared shell for the screens you open from the dungeon (altar, chest, pit…).

import Link from "next/link";

export default function DungeonFrame({
  title, icon, gold, back = "/", backLabel = "Dungeon", children,
}: {
  title: string;
  icon?: string;
  gold?: number;
  back?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ padding: "16px 16px 40px", color: "white", maxWidth: 680, margin: "0 auto" }}>
      <div className="stone-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18, padding: "10px 14px" }}>
        <Link href={back} className="pixel-font" style={{ color: "#c9b48a", fontSize: 15 }}>← {backLabel}</Link>
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 24, color: "#f1d9a0", fontWeight: 600 }}>
          {icon ? `${icon} ` : ""}{title}
        </h1>
        <span className="pixel-font" style={{ fontSize: 16, color: "#f5c542", minWidth: 60, textAlign: "right" }}>
          {gold !== undefined ? `🪙 ${gold.toLocaleString()}` : ""}
        </span>
      </div>
      {children}
    </main>
  );
}
