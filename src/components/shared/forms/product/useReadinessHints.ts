"use client";

import type { UseFormGetValues } from "react-hook-form";
import { holdsKind } from "@server/listing/product-type";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { listingApiClient } from "@/components/product/listingApiClient";
import type { ProductFormInput } from "@/components/product/console/types";
import type { ProductStepKey } from "./product-steps";
import { useListingPrefix } from "./useListingPrefix";

/**
 * What the places this shop sells on would still ask, from the unsaved values (product-form D4).
 * Re-checked each time a step changes, so on leaving a step and on reaching Review. Advice only:
 * a failure reads as nothing, and nothing here touches the save (ADR-0053).
 */
export function useReadinessHints(
  /** Blank for a shop selling nowhere else: nothing is fetched, so nothing shows (R5). */
  orgId: string,
  /** The category's product type; without one no place can be asked anything, so nothing is fetched. */
  type: ProductTypeRecord | null,
  step: ProductStepKey,
  getValues: UseFormGetValues<ProductFormInput>,
) {
  const prefix = useListingPrefix(orgId);
  const { data, loading } = useAsyncData(
    async (signal) => {
      const values = getValues();
      if (!type || !values.categoryId) return [];
      return listingApiClient.readiness(
        prefix,
        {
          categoryId: values.categoryId,
          // A kind left over from another type would be judged against this one (D5).
          kind: holdsKind(type, values.kind) ? (values.kind ?? null) : null,
          familyId: values.familyId ?? null,
          brandId: values.brandId ?? null,
          facts: values.facts,
        },
        signal,
      );
    },
    { enabled: !!orgId, refetchDependencies: [step, type?.key] },
  );
  return { verdicts: data ?? [], loading };
}
