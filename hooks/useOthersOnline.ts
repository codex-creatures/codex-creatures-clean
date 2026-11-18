"use client";
// hooks/useOthersOnline.ts
// How many other players are in the PvP lobby now (lib/online/duelChannel.ts), for the portal's glowing
// count: a number only, no names. null: you're not in the lobby (signed out, or offline), so nothing's shown.

import { useEffect, useState } from "react";
import { lobbyAccount, onPlayersOnline, othersOnline, playersOnline } from "@/lib/online/duelChannel";

export function useOthersOnline(): number | null {
  const [ids, setIds] = useState(() => playersOnline());
  // (A copy each time, so the count redraws even when the set handed over is the same one: joining the lobby
  // tells us straight away, before anyone's been seen.)
  useEffect(() => onPlayersOnline((s) => setIds(new Set(s))), []);
  const me = lobbyAccount();
  return me ? othersOnline(ids, me) : null;
}
