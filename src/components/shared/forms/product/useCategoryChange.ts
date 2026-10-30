"use client";

import { useCallback, useState } from "react";
import { resolveProductType } from "@server/listing/product-type";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import type { ProductFormInput } from "@/components/product/console/types";
import { answersLost } from "./category-change";

interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  productType?: unknown;
}

export interface PendingCategoryChange {
  to: string;
  fromName: string;
  toName: string;
  lost: string[];
}

/**
 * A category pick that would leave typed answers behind waits for the shop to say so (product-form
 * D5, R6). Nothing is cleared either way: the answers stay in the form, so switching back restores them.
 */
export function useCategoryChange(
  categories: readonly Category[],
  productTypes: readonly ProductTypeRecord[],
  getValues: () => Pick<ProductFormInput, "categoryId" | "facts" | "measurements" | "kind">,
  apply: (categoryId: string) => void,
) {
  const [pending, setPending] = useState<PendingCategoryChange | null>(null);

  const typeOf = useCallback(
    (categoryId: string) => {
      const key = resolveProductType(categoryId, categories);
      return productTypes.find((type) => type.key === key) ?? null;
    },
    [categories, productTypes],
  );

  const request = useCallback(
    (to: string) => {
      const values = getValues();
      const from = values.categoryId ?? "";
      const lost = from && from !== to ? answersLost(values, typeOf(from), typeOf(to)) : [];
      if (lost.length === 0) {
        apply(to);
        return;
      }
      const name = (id: string) => categories.find((category) => category.id === id)?.name ?? "";
      setPending({ to, fromName: name(from), toName: name(to), lost });
    },
    [apply, categories, getValues, typeOf],
  );

  const confirm = useCallback(() => {
    if (pending) apply(pending.to);
    setPending(null);
  }, [apply, pending]);

  const keep = useCallback(() => setPending(null), []);

  return { pending, request, confirm, keep };
}
