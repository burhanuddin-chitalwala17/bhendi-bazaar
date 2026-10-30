"use client";

import { useCallback, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { PRODUCT_STEPS, firstStepWithError, type ProductStepKey } from "./product-steps";

/**
 * Which step of a new product is open, and which have been left (product-form D1). "Next" never
 * validates; only the save does, and a failed save opens the first step with a problem (Q5).
 */
export function useProductSteps() {
  const [current, setCurrent] = useState<ProductStepKey>("photos");
  const [visited, setVisited] = useState<ReadonlySet<ProductStepKey>>(() => new Set());

  const goTo = useCallback((step: ProductStepKey) => {
    setCurrent((leaving) => {
      setVisited((seen) => new Set(seen).add(leaving));
      return step;
    });
    if (typeof window !== "undefined") window.scrollTo?.({ top: 0 });
  }, []);

  const index = PRODUCT_STEPS.findIndex((step) => step.key === current);
  const next = useCallback(() => {
    const following = PRODUCT_STEPS[index + 1];
    if (following) goTo(following.key);
  }, [goTo, index]);
  const back = useCallback(() => {
    const previous = PRODUCT_STEPS[index - 1];
    if (previous) goTo(previous.key);
  }, [goTo, index]);

  /** Opens the first step holding an error; returns it, or null when there is none. */
  const showFirstError = useCallback(
    (errors: FieldErrors) => {
      const step = firstStepWithError(errors);
      if (!step) return null;
      goTo(step);
      // The field was hidden when the form tried to focus it; focus it once its step shows (Q5).
      if (typeof window !== "undefined") {
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>('form section:not([hidden]) [aria-invalid="true"]')?.focus(),
        );
      }
      return step;
    },
    [goTo],
  );

  /** A fresh product: the first step, no ticks. */
  const reset = useCallback(() => {
    setCurrent("photos");
    setVisited(new Set());
  }, []);

  return { current, index, visited, goTo, next, back, reset, showFirstError, isFirst: index === 0, isReview: current === "review" };
}
