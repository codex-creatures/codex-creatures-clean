// app/lab/baseline/page.tsx — the visual baseline's scenes (BaselineScenes.tsx;
// tests/visual-baseline/README.md). A dev tool that bundles the test runs, so
// the live site never serves it: only the dev server does, or a local build
// made with LAB_BASELINE=1 for taking the screenshots. Any other build makes
// it "not found" (decided when it's built, so the offline copy builds too).

import { notFound } from "next/navigation";
import BaselineScenes from "./BaselineScenes";

export default function BaselineLab() {
  if (process.env.NODE_ENV === "production" && process.env.LAB_BASELINE !== "1") notFound();
  return <BaselineScenes />;
}
