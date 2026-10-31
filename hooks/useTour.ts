"use client";
// hooks/useTour.ts
// Which step of Klutz's tour you're on (lib/tour.ts), or null: kept up to
// date whenever the save is written.

import { useEffect, useState } from "react";
import { onSaveWritten } from "@/lib/save";
import { tourStep } from "@/lib/tour";

export function useTour(): number | null {
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    const read = () => setStep(tourStep());
    read();
    return onSaveWritten(read);
  }, []);
  return step;
}
