"use client";

import { useEffect, useState } from "react";

import { orgStorefrontApiClient } from "@/components/org/orgStorefrontApiClient";
import { ApiError } from "@/lib/api-error";
import type { StorefrontSettingsInput } from "@/lib/validation/schemas/storefront.schema";
import { SAVE_SLOW_AFTER_MS, SECTION_COPY } from "./section-copy";

/**
 * One section's save and its states (ux.md section sheet). A 409 is Stale — the server's "Changed
 * by {Name}" and the choice to load theirs or keep mine; a failure we cannot name keeps the words
 * and says so; a field refusal lands on its field through `useServerForm`.
 */
export function useSectionSave(orgId: string) {
  const [stale, setStale] = useState(false);

  const save = async (data: StorefrontSettingsInput) => {
    setStale(false);
    try {
      return await orgStorefrontApiClient.saveSettings(orgId, data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setStale(true);
      // A field's refusal and Stale carry their own words; anything else is "kept here".
      if (error instanceof ApiError && error.status < 500) throw error;
      throw new Error(SECTION_COPY.saveFailed);
    }
  };

  /** Keep mine: the version as it now stands, so the resend compares against theirs. */
  const currentVersion = async () => (await orgStorefrontApiClient.getSettings(orgId)).updatedAt;

  return { save, stale, clearStale: () => setStale(false), currentVersion };
}

/** True once a save has run past ux.md's three seconds; the button keeps working throughout. */
export function useSlow(active: boolean, after = SAVE_SLOW_AFTER_MS) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), after);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active, after]);
  return active && slow;
}
