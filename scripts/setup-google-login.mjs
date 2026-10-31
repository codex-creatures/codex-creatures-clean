// scripts/setup-google-login.mjs: `npm run setup:google`
// Sets up "Sign in with Google" for the game's own Supabase project, once.
//
// Google has no tool for making the login client, so the script opens each
// Google page and says exactly what to type (the long address goes on the
// clipboard). Supabase's side is done for you through its Management API:
// Google switched on, plus the addresses players may come back to.
//
// It asks for a Supabase access token and Google's client secret. Neither is
// saved anywhere: they're only sent to Supabase, and you delete the token
// at the end.

import { exec, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import readline from "node:readline";

// The project ID, read from the one place it's kept (lib/online/config.ts).
const config = readFileSync(new URL("../lib/online/config.ts", import.meta.url), "utf8");
const REF = config.match(/CODEX_PROJECT_REF = "([a-z0-9]{20})"/)?.[1];
if (!REF) { console.error("Couldn't find CODEX_PROJECT_REF in lib/online/config.ts."); process.exit(1); }

const SITE = "https://codex-creatures-clean.vercel.app";
// Where a sign-in may send players back to: the live game, the dev server, the offline copy.
const RETURN_ADDRESSES = [`${SITE}/**`, "http://localhost:3000/**", "http://localhost:8123/**"];
const CALLBACK = `https://${REF}.supabase.co/auth/v1/callback`;
const API = `https://api.supabase.com/v1/projects/${REF}/config/auth`;

const open = (url) => exec(`start "" "${url}"`);
function copy(text) {
  try { const p = spawn("clip"); p.stdin.end(text); return true; } catch { return false; }
}

// One question; `hidden` keeps a pasted secret off the screen.
function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      process.stdout.write(question);
      rl._writeToOutput = () => {}; // (shows nothing as you paste)
    }
    rl.question(hidden ? "" : question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("  (got it)\n");
      resolve(answer.trim());
    });
  });
}
const enter = (what = "Press Enter when that's done.") => ask(`\n   ${what} `);

async function supabase(method, token, body) {
  const res = await fetch(API, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase said ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

console.log(`
Codex Creatures: setting up "Sign in with Google"
Project ${REF}. Sign in to Google with the account that should own the game's
Google project (any Google account is fine; keep it apart from Vouchee).`);

console.log(`
1) A Google Cloud project for the game. (Opening the page.)
   Project name: Codex Creatures. No organisation. Create, then make sure
   it's the project selected at the top of the page.`);
open("https://console.cloud.google.com/projectcreate");
await enter();

console.log(`
2) The sign-in screen players see. (Opening the page.) Tap "Get started":
   App name: Codex Creatures
   User support email: your email
   Audience: External
   Contact email: your email. Agree, then Create.`);
open("https://console.cloud.google.com/auth/branding");
await enter();

console.log(`
3) The login client. (Opening the page.)
   Application type: Web application
   Name: Codex Creatures web
   Authorised redirect URIs > Add URI, and paste:
     ${CALLBACK}
   ${copy(CALLBACK) ? "(It's on your clipboard already.)" : ""}
   Then Create. Google shows a Client ID and a Client secret: keep that box open.`);
open("https://console.cloud.google.com/auth/clients/create");
await enter("Press Enter once you can see the Client ID.");

let clientId = "";
while (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
  clientId = await ask("\n   Paste the Client ID: ");
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) console.log("   That should end in .apps.googleusercontent.com. Try again.");
}
let secret = "";
while (!secret) secret = await ask("   Paste the Client secret (hidden): ", true);

console.log(`
4) Let everyone sign in, not only test users. (Opening the page.)
   Under "Publishing status", tap "Publish app", then Confirm. (The game only
   asks for a name and email, so Google doesn't need to review it.)`);
open("https://console.cloud.google.com/auth/audience");
await enter();

console.log(`
5) A Supabase access token, so this script can switch Google on. (Opening the page.)
   "Generate new token", name it codex-setup, any expiry (1 day is plenty). Copy it.`);
open("https://supabase.com/dashboard/account/tokens");
let token = "";
while (!token.startsWith("sbp_")) {
  token = await ask("\n   Paste the token (hidden): ", true);
  if (!token.startsWith("sbp_")) console.log("   Supabase tokens start with sbp_. Try again.");
}

try {
  const now = await supabase("GET", token);
  const kept = String(now.uri_allow_list ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const allow = [...new Set([...kept, ...RETURN_ADDRESSES])].join(",");
  await supabase("PATCH", token, {
    site_url: SITE,
    uri_allow_list: allow,
    external_google_enabled: true,
    external_google_client_id: clientId,
    external_google_secret: secret,
  });
  const after = await supabase("GET", token);
  const ok = after.external_google_enabled === true && after.external_google_client_id === clientId && after.site_url === SITE;
  if (!ok) throw new Error("The settings didn't stick. Check Supabase > Authentication > Sign In / Providers > Google.");
  console.log(`
   Done. Supabase now has:
   - Google sign-in switched on
   - Site URL: ${SITE}
   - Return addresses: ${after.uri_allow_list}`);
} catch (e) {
  console.error(`\n   Something went wrong: ${e.message}\n   Nothing secret was saved. You can run this again.`);
  process.exitCode = 1;
}

console.log(`
6) Last: delete the codex-setup token (it isn't needed again). (Opening the page.)`);
open("https://supabase.com/dashboard/account/tokens");
await enter("Press Enter to finish.");
