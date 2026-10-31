"use client";
// app/start/page.tsx
// The title screen. Shown when the game is opened (the Den sends you here
// once per visit: STARTED_KEY in lib/saveSlots.ts), and from Settings.
// Online, you sign in and your account's save loads (components/OnlineStart.tsx);
// a copy of the game without online (the offline Windows build) keeps save
// slots instead (components/LocalStart.tsx).

import LocalStart from "@/components/LocalStart";
import OnlineStart from "@/components/OnlineStart";
import { onlineConfig } from "@/lib/online/client";

export default function StartPage() {
  return onlineConfig.ok ? <OnlineStart /> : <LocalStart />;
}
