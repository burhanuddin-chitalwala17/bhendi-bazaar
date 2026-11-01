"use client";

import { useMemo } from "react";
import { resolveProductType } from "@server/listing/product-type";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import type { ProductForm } from "./ProductSections";
import type { ProductStepKey } from "./product-steps";
import { useCategoryChange } from "./useCategoryChange";
import { useReadinessHints } from "./useReadinessHints";
import { hintsFrom } from "./readiness-hints";

/**
 * What the four sections need beyond the form, for create and edit alike: the chosen type, its
 * readiness hints (D4) and the category-change sheet (D5).
 */
export function useProductSections(
  form: ProductForm,
  categories: { id: string; name: string; parentId?: string | null; productType?: unknown }[],
  productTypes: ProductTypeRecord[],
  sellsElsewhere: boolean,
  current: ProductStepKey,
) {
  const { watch, setValue, formState } = form;
  const orgId = watch("orgId") || "";
  const categoryId = watch("categoryId") || "";
  const typeKey = useMemo(() => resolveProductType(categoryId, categories), [categoryId, categories]);
  const productType = useMemo(() => productTypes.find((type) => type.key === typeKey) ?? null, [productTypes, typeKey]);
  const readiness = useReadinessHints(sellsElsewhere ? orgId : "", productType, current, form.getValues);
  const hints = hintsFrom(readiness.verdicts, productType);
  const categoryChange = useCategoryChange(categories, productTypes, form.getValues, (id) =>
    setValue("categoryId", id, { shouldDirty: true, shouldValidate: !!formState.errors.categoryId }),
  );
  return { productType, readiness, hints, categoryChange };
}
