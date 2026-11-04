"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { isPincode, useDeliveryCheck } from "@/hooks/product/useDeliveryCheck";
import { formatDeliveryDate, getEstimatedDeliveryDate } from "@/utils/shipping";
import { PRODUCT_PAGE_COPY } from "./product-copy";
import { DELIVERY_CHECK_ERROR_COPY } from "@/components/product/product-copy";

/** "Fri, 8 Nov" for an estimate in days; the courier's estimate, so it reads as "arrives by". */
export const arrivesBy = (days: number) => formatDeliveryDate(getEstimatedDeliveryDate(days));

/** Does this piece reach me, and when (design-system Q25). Errors show only after Check is tapped. */
export function DeliveryCheck({ fromPincode, weight }: { fromPincode: string; weight: number }) {
  const { answer, check, checking, failed, saved, clear } = useDeliveryCheck({ fromPincode, weight });
  const [draft, setDraft] = useState("");
  const [tried, setTried] = useState(false);
  const shown = draft || saved || "";
  const invalid = tried && !isPincode(shown);

  if (answer) {
    return (
      <div className="flex items-start gap-3">
        <Icon name={answer.kind === "delivers" ? "delivery" : "location"} size="md" tone={answer.kind === "delivers" ? "primary" : "warning"} />
        <p className="flex-1 text-small" aria-live="polite">
          {answer.kind === "delivers" ? (
            <>
              {PRODUCT_PAGE_COPY.delivery.deliversTo} <b className="font-semibold">{answer.pincode}</b> {PRODUCT_PAGE_COPY.delivery.arrivesBy}{" "}
              <b className="font-semibold">{arrivesBy(answer.days)}</b>
            </>
          ) : (
            <>
              {PRODUCT_PAGE_COPY.delivery.noDeliveryTo} <b className="font-semibold">{answer.pincode}</b> {PRODUCT_PAGE_COPY.delivery.noDeliveryYet}
            </>
          )}
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => {
            setDraft(answer.pincode);
            clear();
          }}
        >
          {PRODUCT_PAGE_COPY.delivery.change}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-1.5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        void check(shown);
      }}
    >
      <label htmlFor="delivery-pincode" className="flex items-center gap-2 text-small font-medium">
        <Icon name="location" size="md" tone="muted" />
        {PRODUCT_PAGE_COPY.delivery.title}
      </label>
      <div className="flex gap-2">
        <Input
          id="delivery-pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder={PRODUCT_PAGE_COPY.delivery.placeholder}
          value={shown}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid || failed ? "delivery-pincode-error" : undefined}
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="max-w-44"
        />
        <Button type="submit" variant="outline" pending={checking}>
          {PRODUCT_PAGE_COPY.delivery.check}
        </Button>
      </div>
      {(invalid || failed) && (
        <p id="delivery-pincode-error" className="text-caption text-destructive">
          {invalid ? DELIVERY_CHECK_ERROR_COPY.invalid : DELIVERY_CHECK_ERROR_COPY.failed}
        </p>
      )}
    </form>
  );
}
