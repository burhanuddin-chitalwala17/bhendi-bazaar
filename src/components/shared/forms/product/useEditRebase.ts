"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import type { Path } from "react-hook-form";
import type { ProductDetails, ProductFormInput } from "@/components/product/console/types";
import type { ProductForm } from "./ProductSections";
import { EDIT_CONFLICT, editConflictOf, rebase, seenStockTotal, staleStockMessage, valueAt, type EditConflict } from "./edit-overview";

type Pending =
  | { kind: "saved" }
  | { kind: "refused"; conflict: EditConflict; message: string; mine: ProductFormInput; changed: string[] };

/**
 * An edit's save outcome against the page's latest product (product-form D8). A refused save
 * refreshes the page's props, resets to the latest and lays the shop's own changes back over
 * it; a saved one resets to what was stored. No read route: the page is the read.
 */
export function useEditRebase(
  form: ProductForm,
  product: ProductDetails | undefined,
  defaultsOf: (product: ProductDetails) => ProductFormInput,
  /** The version the next save claims to have seen; moved here on every reset. */
  versionRef: RefObject<number>,
) {
  const router = useRouter();
  const pending = useRef<Pending | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set());
  const first = useRef(true);

  /** True when the refusal was the product moving on; the caller still rethrows. */
  const refused = useCallback(
    (error: unknown, mine: ProductFormInput, changed: string[]) => {
      const conflict = editConflictOf(error);
      if (!conflict) return false;
      pending.current = { kind: "refused", conflict, message: (error as Error).message, mine, changed };
      // Shown at once, so a slow or failed refresh never leaves the refusal silent.
      setNotice((error as Error).message);
      router.refresh();
      return true;
    },
    [router],
  );

  const saved = useCallback(
    (result: unknown) => {
      const version = (result as { version?: unknown } | null)?.version;
      versionRef.current = typeof version === "number" ? version : versionRef.current + 1;
      // Clean at once, so the leave guard lets go before the refreshed product arrives.
      form.reset(form.getValues());
      pending.current = { kind: "saved" };
      setNotice(null);
      setKept(new Set());
      router.refresh();
    },
    [form, router, versionRef],
  );

  // A refresh hands down a new product object; the first render's is the one the form opened with.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!product) return;
    const latest = defaultsOf(product);
    const outcome = pending.current;
    pending.current = null;
    if (!outcome) {
      // Refreshed for another reason: follow it only when nothing typed would be lost, and never
      // back to an older version (the leave guard's history.back() can restore a cached page).
      if (!form.formState.isDirty && product.version >= versionRef.current) {
        form.reset(latest);
        versionRef.current = product.version;
      }
      return;
    }
    form.reset(latest);
    versionRef.current = product.version;
    if (outcome.kind === "saved") return;
    const { values, kept: reapplied, applied } = rebase(latest, outcome.mine, outcome.changed, outcome.conflict);
    for (const path of applied) {
      form.setValue(path as Path<ProductFormInput>, valueAt(values, path) as never, { shouldDirty: true });
    }
    setKept(new Set(reapplied));
    setNotice(
      outcome.conflict === EDIT_CONFLICT.VERSION
        ? outcome.message
        : staleStockMessage(seenStockTotal(outcome.mine.stockLocations), seenStockTotal(latest.stockLocations)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new product from the server moves this
  }, [product]);

  const dismiss = useCallback(() => setNotice(null), []);
  return { notice, kept, refused, saved, dismiss };
}
