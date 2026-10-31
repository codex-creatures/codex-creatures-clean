"use client";
// components/AccountPanel.tsx
// The title screen's sign-in box (docs/design.md §12): Google (or, once it's
// switched on, an email link), then a name. One fixed row, plus a form under
// it while signing in or naming. The rules live in lib/online/account.ts;
// this only shows them.

import { useEffect, useState } from "react";

import Help from "@/components/Help";
import { onlineClient } from "@/lib/online/client";
import {
  readAccount, returnProblem, saveName, sendLoginLink, signInWithGoogle, signOut,
  EMAIL_LOGIN, MAX_PLAYER_NAME, type Account,
} from "@/lib/online/account";

const MUTED = "rgba(255,255,255,0.55)", BAD = "#ff8a80", GOOD = "#5ee08a";
const one = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;
const field = { fontSize: 16, padding: 8, minHeight: 44, background: "#1a1610", color: "#f1d9a0", border: "2px solid #5a3e1e", borderRadius: 4, minWidth: 0 } as const;

export default function AccountPanel() {
  const [account, setAccount] = useState<Account>({ status: "loading" });
  const [form, setForm] = useState<"email" | "sent" | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const problem = returnProblem(window.location.search, window.location.hash);
    if (problem) { setError(problem); if (EMAIL_LOGIN) setForm("email"); }
    const client = onlineClient();
    if (!client) { setAccount({ status: "off" }); return; }
    let live = true;
    const refresh = () => readAccount(client).then((a) => { if (live) setAccount(a); }, () => { if (live) setAccount({ status: "out" }); });
    refresh();
    // (Supabase asks for no calls inside this callback, hence the timeout.)
    const { data } = client.auth.onAuthStateChange(() => { window.setTimeout(refresh, 0); });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);

  // Tidy the sign-in's leftovers (#access_token=…, ?error=…) out of the address.
  useEffect(() => {
    if (account.status !== "loading" && (window.location.hash || window.location.search)) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [account.status]);

  async function google() {
    const client = onlineClient();
    if (!client || busy) return;
    setBusy(true); setError("");
    const r = await signInWithGoogle(client, window.location.origin);
    if (!r.ok) { setBusy(false); setError(r.error); } // (otherwise the page is leaving for Google)
  }
  async function send() {
    const client = onlineClient();
    if (!client || busy) return;
    setBusy(true);
    const r = await sendLoginLink(client, email, window.location.origin);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setError(""); setForm("sent");
  }
  async function submitName() {
    const client = onlineClient();
    if (!client || busy || account.status !== "in") return;
    setBusy(true);
    const r = await saveName(client, account.id, name);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setError(""); setAccount({ ...account, name: r.name ?? name });
  }
  async function out() {
    const client = onlineClient();
    if (!client || busy) return;
    setBusy(true);
    await signOut(client);
    setBusy(false);
    setAccount({ status: "out" }); setForm(null); setError("");
  }
  function signIn() {
    if (!EMAIL_LOGIN) { google(); return; }
    setForm(form ? null : "email"); setError("");
  }

  const s = account.status;
  const needsName = s === "in" && !account.name;
  const label = s === "in" ? (account.name ?? "Signed in") : s === "out" ? "Not signed in" : s === "off" ? "Offline" : "…";
  const sub = s === "in" ? account.email : s === "out" ? "Sign in to play online" : s === "off" ? "Online isn't in this copy of the game" : "";

  return (
    <div className="stone-panel" style={{ display: "grid", gap: 8, padding: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div className="pixel-font" style={{ ...one, fontSize: 16, color: "#f1d9a0" }}>🌐 {label}</div>
          <div style={{ ...one, fontSize: 12, color: MUTED, visibility: sub ? undefined : "hidden" }}>{sub || "…"}</div>
        </div>
        <Help title="Online">
          <ul>
            {EMAIL_LOGIN
              ? <li>Sign in with your <b>Google account</b> or your <b>email</b> (we send a link: tap it on the device you want to play on). No password.</li>
              : <li>Sign in with your <b>Google account</b>. No new password.</li>}
            <li>Your <b>name</b> is what other players will see.</li>
            <li>Online features (cloud saves, the global registry, PvP) are on their way. Your game plays the same either way.</li>
          </ul>
        </Help>
        {s === "in" ? (
          <button className="dock-tab" disabled={busy} onClick={out} style={{ minWidth: 44, minHeight: 44 }}>Sign out</button>
        ) : (
          <button className="dock-tab" disabled={s !== "out" || busy} onClick={signIn}
            style={{ minWidth: 44, minHeight: 44, visibility: s === "off" ? "hidden" : undefined }}>
            {form ? "Cancel" : EMAIL_LOGIN ? "Sign in" : "Sign in with Google"}
          </button>
        )}
      </div>

      {s === "out" && form === "email" && (
        <div style={{ display: "grid", gap: 6 }}>
          <button className="dock-tab" disabled={busy} onClick={google}>Sign in with Google</button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
            <input type="email" autoComplete="email" inputMode="email" value={email} placeholder="…or your email"
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} style={field} />
            <button className="dock-tab" data-active="true" disabled={busy || !email.trim()} onClick={send}>Send link</button>
          </div>
        </div>
      )}
      {s === "out" && form === "sent" && (
        <div style={{ fontSize: 13, color: GOOD }}>
          ✉️ Link sent to <b>{email.trim()}</b>. Open it on this device to sign in.
        </div>
      )}

      {needsName && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
          <input autoFocus value={name} maxLength={MAX_PLAYER_NAME} placeholder="Pick your name"
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitName(); }} style={field} />
          <button className="dock-tab" data-active="true" disabled={busy || !name.trim()} onClick={submitName}>Save</button>
        </div>
      )}

      {error && <div role="status" style={{ fontSize: 13, color: BAD }}>⚠️ {error}</div>}
    </div>
  );
}
