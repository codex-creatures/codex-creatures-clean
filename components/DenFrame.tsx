"use client";
// components/DenFrame.tsx
// Shared shell for the screens you open from the Den (altar, chest, pit…).

import Link from "next/link";
import GoldCount from "./GoldCount";

export default function DenFrame({
  title, icon, gold, back = "/", backLabel = "The Den", width = 680, children,
}: {
  title: string;
  icon?: string;
  gold?: number;
  back?: string;
  backLabel?: string;
  width?: number; // the column's widest (the Labyrinth keeps to a phone-sized one)
  children: React.ReactNode;
}) {
  return (
    <main style={{ padding: "16px 16px 40px", color: "white", maxWidth: width, margin: "0 auto" }}>
      <div className="title-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <Link href={back} className="pixel-font" style={{ color: "#c9b48a", fontSize: 15 }}>← {backLabel}</Link>
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 24, color: "#f1d9a0", fontWeight: 600 }}>
          {icon ? `${icon} ` : ""}{title}
        </h1>
        <span style={{ minWidth: 60, textAlign: "right" }}>{gold !== undefined && <GoldCount gold={gold} />}</span>
      </div>
      {children}
    </main>
  );
}
