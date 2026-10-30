"use client";

import type { UseFormGetValues } from "react-hook-form";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { listingApiClient } from "@/components/product/listingApiClient";
import type { ProductFormInput } from "@/components/product/console/types";
import type { ProductStepKey } from "./product-steps";

/**
 * What the places this shop sells on would still ask, from the unsaved values (product-form D4).
 * Re-checked each time a step changes, so on leaving a step and on reaching Review. Advice only:
 * a failure reads as nothing, and nothing here touches the save (ADR-0053).
 */
export function useReadinessHints(
  orgId: string,
  /** The category's product type; without one no place can be asked anything, so nothing is fetched. */
  typeKey: string | null,
  step: ProductStepKey,
  getValues: UseFormGetValues<ProductFormInput>,
) {
  const { data, loading } = useAsyncData(
    async (signal) => {
      const values = getValues();
      if (!typeKey || !values.categoryId) return [];
      return listingApiClient.readiness(
        orgId,
        {
          categoryId: values.categoryId,
          kind: values.kind ?? null,
          familyId: values.familyId ?? null,
          brandId: values.brandId ?? null,
          facts: values.facts,
        },
        signal,
      );
    },
    { enabled: !!orgId, refetchDependencies: [step, typeKey] },
  );
  return { verdicts: data ?? [], loading };
}
