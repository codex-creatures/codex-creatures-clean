"use client";
// app/privacy/page.tsx
// The privacy policy: Google needs a link to one before anyone outside the
// test-user list can sign in with Google (docs/design.md §12). Keep it in
// step with what the game really stores: update it when cloud saves,
// leaderboards or PvP go live.

import Link from "next/link";

const CONTACT_EMAIL = "adamjbell95@gmail.com";
const UPDATED = "31 October 2026";

const h = { fontSize: 16, color: "#f1d9a0", margin: "14px 0 4px" } as const;
const p = { fontSize: 14, lineHeight: 1.45, margin: "0 0 8px", color: "#d8d4c8" } as const;

export default function PrivacyPage() {
  return (
    <main className="screen-page">
      <header className="screen-header" style={{ gridTemplateColumns: "1fr auto" }}>
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 18, color: "#f1d9a0", fontWeight: 600 }}>Privacy</h1>
        <Link href="/start" className="dock-tab" style={{ minWidth: 44, minHeight: 44, display: "grid", placeItems: "center" }}>Back</Link>
      </header>

      <div className="screen-scroll">
        <div className="stone-panel">
          <p style={{ ...p, color: "rgba(255,255,255,0.55)", fontSize: 12 }}>Codex Creatures · last updated {UPDATED}</p>
          <p style={p}>Codex Creatures is a free hobby game, made by one person and played with friends. This page says what it keeps about you.</p>

          <h2 className="pixel-font" style={h}>Without signing in</h2>
          <p style={p}>Your game is saved only in your own browser, on your device. Nothing about it is sent anywhere. Barcodes you scan stay on your device too.</p>

          <h2 className="pixel-font" style={h}>When you sign in with Google</h2>
          <p style={p}>Google tells the game your email address, your Google account name and profile picture, and an ID for your account. The game also keeps the player name you pick. Sign-in is handled by Supabase, the service that stores this.</p>
          <p style={p}>Your save (your game and your recent battles) is kept online with Supabase, so it follows you to other devices. Only you can see it.</p>
          <p style={p}>When you scan a barcode, its number is sent to the game&apos;s online registry, which keeps what each barcode holds so every player finds the same thing. The registry keeps the barcode number and what it holds, not who scanned it.</p>
          <p style={p}>Coming soon, and only for players who sign in: leaderboards and battles, where other players see your player name (never your email).</p>

          <h2 className="pixel-font" style={h}>What it doesn&apos;t do</h2>
          <p style={p}>No ads, no tracking or analytics, and nothing is sold or shared with anyone else. The game only asks Google for your basic profile and email: it can&apos;t see your Gmail, contacts or anything else.</p>

          <h2 className="pixel-font" style={h}>Where it&apos;s kept</h2>
          <p style={p}>Account details are stored with Supabase. The website is hosted by Vercel, which, like any web host, briefly logs the addresses of devices that visit.</p>

          <h2 className="pixel-font" style={h}>Deleting your account</h2>
          <p style={p}>Email <b>{CONTACT_EMAIL}</b> from the address you signed in with, and your account and everything stored with it will be deleted. Your saves in your own browser stay until you clear them.</p>
        </div>
      </div>
    </main>
  );
}
