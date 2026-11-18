"use client";
// app/lab/propreview/page.tsx — 🧪 the props built from recipes, lit, to walk round (./Review.tsx). Loaded in the
// browser only (it can read the prop builder's drafts kept there). The game doesn't use it.

import dynamic from "next/dynamic";

const Review = dynamic(() => import("./Review"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16, background: "#111", minHeight: "100vh", margin: 0 }}>Loading…</p> });

export default function PropReviewPage() {
  return <Review />;
}
