"use client";
// components/EscapeBack.tsx
// Esc goes back a page, like the browser's back button (from Klutz back to
// the Den, say). Not on the Den itself, not while typing, and not when
// something open on the page used the key to close itself (it calls
// preventDefault: see the modals).

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function EscapeBack() {
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (path === "/") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      // Wait until every other listener has had the key (a modal closing itself marks it).
      setTimeout(() => {
        if (e.defaultPrevented) return;
        if (window.history.length > 1) router.back();
        else router.push("/");
      }, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path, router]);

  return null;
}
