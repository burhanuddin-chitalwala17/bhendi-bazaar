"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 4000;

/** While a read runs, re-render the page every few seconds so rows and counts fill in (D10). */
export function ReadProgressRefresher({ running }: { running: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), EVERY_MS);
    return () => clearInterval(timer);
  }, [running, router]);
  return null;
}
