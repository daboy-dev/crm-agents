"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { sweepRuns } from "./actions";

/**
 * Every few seconds while the tab is visible: asks the server for a sweep
 * (recovery without cron, D22) and re-renders the server components.
 */
export function RunPoller({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await sweepRuns();
      } finally {
        router.refresh();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
