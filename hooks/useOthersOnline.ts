"use client";
// hooks/useOthersOnline.ts
// How many other players are in the PvP lobby now (lib/online/duelChannel.ts), for the portal's glowing
// count: a number only, no names. null: you're not in the lobby (signed out, or offline), so nothing's shown.

import { useEffect, useState } from "react";
import { lobbyAccount, onPlayersOnline, othersOnline, playersOnline } from "@/lib/online/duelChannel";

export function useOthersOnline(): number | null {
  const [ids, setIds] = useState(() => playersOnline());
  useEffect(() => onPlayersOnline(setIds), []);
  const me = lobbyAccount();
  return me ? othersOnline(ids, me) : null;
}
