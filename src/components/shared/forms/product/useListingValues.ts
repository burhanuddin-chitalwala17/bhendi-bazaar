import { useCallback, useEffect, useRef, useState } from "react";

import { listingApiClient } from "@/components/product/listingApiClient";
import { useListingPrefix } from "./useListingPrefix";

export type ValueOption = { key: string; label: string; orgId: string | null };
export type ValuesByList = Record<string, ValueOption[]>;

/**
 * The permitted answers for whichever questions the product is currently asked.
 *
 * One thing only: fetching. The page serves the answers for the category it rendered with, so
 * this runs when the category changes and the new type asks something the form has not loaded
 * ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 *
 * Which lists have been asked for is a ref rather than state, so the effect never depends on
 * what it sets — otherwise each fetch schedules the next one.
 */
export function useListingValues(orgId: string, lists: readonly string[], initial: ValuesByList) {
  const [values, setValues] = useState<ValuesByList>(initial);
  const [loading, setLoading] = useState(false);
  const asked = useRef(new Set(Object.keys(initial)));
  const prefix = useListingPrefix(orgId);

  const load = useCallback(
    async (wanted: string[]) => {
      setLoading(true);
      try {
        const fetched = await listingApiClient.listValues(prefix, wanted);
        setValues((current) => ({ ...current, ...fetched }));
      } catch {
        // A failed load leaves those lists empty rather than the form broken: the questions
        // become unanswerable, which readiness reports, and nothing already typed is lost.
      } finally {
        setLoading(false);
      }
    },
    [prefix],
  );

  const key = lists.join(",");
  useEffect(() => {
    if (!orgId) return;
    const missing = key.split(",").filter((list) => list && !asked.current.has(list));
    if (missing.length === 0) return;
    for (const list of missing) asked.current.add(list);
    void load(missing);
  }, [key, orgId, load]);

  return { values, loading };
}
