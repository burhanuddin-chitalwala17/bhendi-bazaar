"use client";

/**
 * The terms of one bidding event.
 *
 * Client validation comes from the same schema the handler enforces, so what the org
 * sees inline cannot drift from what the server accepts (ADR-0013).
 *
 * Two things here are more than layout. The product's current selling price is on
 * screen while the starting bid is typed, so the opening number is set against a real
 * one (spec R3). And the quick-bid buttons are a field array rather than a fixed pair,
 * because a ₹200 item and a ₹20,000 item do not share an increment (spec R5) — the
 * smallest of them also floors a custom increase, which the hint says out loud so the
 * rule is visible rather than discovered.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormInput, FormSelect } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
import { formatCurrency, paiseToRupees } from "@/lib/format";
import {
  biddingFormSchema,
  type BiddingFormInput,
} from "@/lib/validation/schemas/bidding.schema";

interface BiddingFormProduct {
  id: string;
  name: string;
  pricePaise: number;
  sizes: string[];
  colors: string[];
  unitsOnHand: number;
}

/** `datetime-local` wants local wall-clock text, and `toISOString` is UTC. */
function toLocalInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function BiddingForm({
  action,
  returnTo,
  product,
}: {
  action: string;
  returnTo: string;
  product: BiddingFormProduct;
}) {
  const router = useRouter();
  const opensIn = new Date(Date.now() + 15 * 60 * 1000);
  const closesIn = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const form = useServerForm<BiddingFormInput>({
    schema: biddingFormSchema,
    defaultValues: {
      productId: product.id,
      size: product.sizes[0],
      color: product.colors[0],
      startAt: opensIn,
      endAt: closesIn,
      startingBid: paiseToRupees(product.pricePaise),
      maxIncrease: 1000,
      quickBids: [50, 100],
    } as never,
    submit: async (data) => {
      const response = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw await readApiError(response);
      return response.json();
    },
    successMessage: "Bidding is set up — share the link",
    onSuccess: () => {
      router.push(returnTo);
      router.refresh();
    },
  });

  const {
    register,
    control,
    formState: { errors },
    setValue,
    onSubmit,
    formError,
    isSubmitting,
  } = form;

  const quickBids = useFieldArray({ control, name: "quickBids" as never });

  // The date inputs need wall-clock strings, and the schema wants Dates. Seeding them
  // once here keeps the conversion in one direction only.
  useEffect(() => {
    setValue("startAt" as never, toLocalInput(opensIn) as never);
    setValue("endAt" as never, toLocalInput(closesIn) as never);
    // Seeded once on mount; re-running would fight the org's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" {...register("productId")} />

      <Card className="space-y-1 p-3 sm:p-4">
        <p className="text-2xs uppercase tracking-label text-muted-foreground">
          Currently selling at
        </p>
        <p className="font-heading text-2xl font-semibold">
          {formatCurrency(product.pricePaise)}
        </p>
        <p className="text-2xs text-muted-foreground">
          {product.unitsOnHand} in stock. One unit is auctioned; the rest stay off sale
          until this event ends.
        </p>
        {/* The product is a hidden field, but its failures are real and reachable —
            nothing in stock, or already up for bidding — so they surface here rather
            than nowhere. */}
        {errors.productId?.message && (
          <p className="text-sm text-destructive">{errors.productId.message}</p>
        )}
      </Card>

      {(product.sizes.length > 0 || product.colors.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {product.sizes.length > 0 && (
            <FormSelect
              label="Size being auctioned"
              required
              error={errors.size?.message}
              {...register("size")}
            >
              {product.sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </FormSelect>
          )}
          {product.colors.length > 0 && (
            <FormSelect
              label="Colour being auctioned"
              required
              error={errors.color?.message}
              {...register("color")}
            >
              {product.colors.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </FormSelect>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <FormInput
          label="Bidding opens"
          required
          type="datetime-local"
          error={errors.startAt?.message}
          {...register("startAt")}
        />
        <FormInput
          label="Bidding closes"
          required
          type="datetime-local"
          error={errors.endAt?.message}
          hint="Bids are refused the moment this passes."
          {...register("endAt")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormInput
          label="Starting bid (₹)"
          required
          type="number"
          step="1"
          min="1"
          error={errors.startingBid?.message}
          hint="The first bid is exactly this."
          {...register("startingBid", { valueAsNumber: true })}
        />
        <FormInput
          label="Most one bid may add (₹)"
          required
          type="number"
          step="1"
          min="1"
          error={errors.maxIncrease?.message}
          hint="Caps a single bid. Someone wanting to go higher simply bids again."
          {...register("maxIncrease", { valueAsNumber: true })}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Quick-bid buttons (₹)</legend>
        <p className="text-2xs text-muted-foreground">
          What a bidder can add with one tap. The smallest is also the least anyone may
          add with a custom amount.
        </p>
        <div className="space-y-2">
          {quickBids.fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-2">
              <FormInput
                label={`Button ${index + 1}`}
                type="number"
                step="1"
                min="1"
                className="flex-1"
                error={errors.quickBids?.[index]?.message}
                {...register(`quickBids.${index}` as never, { valueAsNumber: true })}
              />
              {quickBids.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => quickBids.remove(index)}
                  aria-label={`Remove button ${index + 1}`}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          ))}
        </div>
        {quickBids.fields.length < 4 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => quickBids.append(100 as never)}
          >
            <Plus className="size-4" aria-hidden />
            Add a button
          </Button>
        )}
        {typeof errors.quickBids?.message === "string" && (
          <p className="text-sm text-destructive">{errors.quickBids.message}</p>
        )}
      </fieldset>

      {formError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(returnTo)}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Setting up…" : "Open bidding"}
        </Button>
      </div>
    </form>
  );
}
