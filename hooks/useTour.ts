"use client";
// hooks/useTour.ts
// Which of Klutz's tours you're on, and which step of it (lib/tour.ts), or
// null: kept up to date whenever the save is written.

import { useEffect, useState } from "react";
import { onSaveWritten } from "@/lib/save";
import { tourAt, type TourAt } from "@/lib/tour";

export function useTour(): TourAt | null {
  const [at, setAt] = useState<TourAt | null>(null);
  useEffect(() => {
    // (Only a new object when it's moved on, so a save write elsewhere doesn't re-run what hangs off it.)
    const read = () => setAt((was) => {
      const now = tourAt();
      return now && was && now.id === was.id && now.step === was.step ? was : now;
    });
    read();
    return onSaveWritten(read);
  }, []);
  return at;
}
