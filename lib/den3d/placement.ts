// lib/den3d/placement.ts
// 🧪 Where you've moved the new Den's things to (lib/den3d/layout.ts DenLayout), kept in the player's one
// save in its own field (as the Labyrinth's and Klutz's tour are), so it goes with exported save files and
// cloud saves, and the main save never writes over it. Missing (an old save, nothing moved): everything
// stands where it starts. Only what's been moved is written.

import { readSave, writeSaveField } from "../save";
import type { DenLayout } from "./layout";

const SAVE_FIELD = "den3d";

export function loadDenLayout(): DenLayout {
  if (typeof window === "undefined") return {};
  try {
    const v = readSave()[SAVE_FIELD] as DenLayout | undefined;
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

export function saveDenLayout(layout: DenLayout) {
  try { writeSaveField(SAVE_FIELD, layout); } catch { /* storage full or blocked: it stays as it was */ }
}
