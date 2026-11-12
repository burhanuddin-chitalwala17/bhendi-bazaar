"use client";

import { useState } from "react";

import type { Feature } from "@server/subscriptions/feature-access.types";
import { lockedFeatureOf } from "./lock-refusal";

/**
 * A lock that lands while the screen is open (ux.md "Stale"): a refused call opens the locked sheet,
 * not an error toast. `refused(error)` answers true when it took the error.
 */
export function useLockSheet() {
  const [feature, setFeature] = useState<Feature | null>(null);
  const refused = (error: unknown): boolean => {
    const locked = lockedFeatureOf(error);
    if (locked) setFeature(locked);
    return locked !== null;
  };
  return { feature, refused, close: () => setFeature(null) };
}
