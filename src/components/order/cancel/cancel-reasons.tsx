"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { FormTextarea } from "@/components/shared/forms/FormField";
import { CANCEL_OTHER_MAX } from "@server/checkout/parcel-cancel.types";

/**
 * The reason list on a cancel sheet (order-fulfilment Q21): one tap picks a reason, "Other" opens
 * a line of up to 120 characters. Shared by the shop's, the admin's and the buyer's sheets.
 */
export function CancelReasons<R extends string>({
  labels,
  otherKey,
  value,
  onPick,
  otherField,
  error,
  otherError,
}: {
  labels: Record<R, string>;
  otherKey: R;
  value: R | undefined;
  onPick: (reason: R) => void;
  otherField: React.ComponentProps<"textarea">;
  error?: string;
  otherError?: string;
}) {
  const legend = useId();
  const reasons = Object.keys(labels) as R[];
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-labelledby={legend} aria-invalid={!!error} className="flex flex-col gap-2">
        <span id={legend} className="sr-only">
          Reason
        </span>
        {reasons.map((reason) => (
          <Button
            key={reason}
            type="button"
            role="radio"
            aria-checked={value === reason}
            variant={value === reason ? "default" : "outline"}
            className="min-h-11 justify-start whitespace-normal text-left"
            onClick={() => onPick(reason)}
          >
            {labels[reason]}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {value === otherKey && (
        <FormTextarea label={labels[otherKey]} maxLength={CANCEL_OTHER_MAX} rows={2} error={otherError} {...otherField} />
      )}
    </div>
  );
}
