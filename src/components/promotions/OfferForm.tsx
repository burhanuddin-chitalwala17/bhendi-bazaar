"use client";

/**
 * Create an offer, for either audience.
 *
 * One form, one schema (`promotionFormSchema`), used here for inline validation and
 * by the handler for enforcement — so what a user sees cannot drift from what the
 * server accepts (ADR-0013). Scope is *not* a field: which party funds an offer is
 * decided by the endpoint this posts to, which is why `action` is a prop and `orgId`
 * appears nowhere in the payload.
 *
 * Fields that cannot apply are hidden rather than shown and rejected. A minimum spend
 * on an automatic offer is not a mistake the buyer should be told about after typing
 * it — a product page has no basket to test it against, so the field has no meaning
 * there and should not be on screen.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  promotionFormSchema,
  type PromotionFormInput,
} from "@/lib/validation/schemas/promotion.schema";
import { FormInput, FormSelect } from "@/components/shared/forms/FormField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ProductPicker, type TargetOption } from "@/components/promotions/ProductPicker";
import { readApiError } from "@/lib/api-error";

/** An offer as stored, for editing. Paise and basis points — converted on the way in. */
export interface OfferInitialValues {
  label: string;
  trigger: "AUTOMATIC" | "CODE";
  code: string | null;
  valueType: "PERCENT" | "AMOUNT_OFF" | "FIXED_PRICE";
  percentBps: number | null;
  amountOffPaise: number | null;
  fixedPricePaise: number | null;
  maxDiscountPaise: number | null;
  minSubtotalPaise: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  usageLimit: number | null;
  perUserLimit: number | null;
  categoryIds: string[];
  productIds: string[];
}

interface OfferFormProps {
  /** Where to send it. The endpoint decides scope; the form never names one. */
  action: string;
  /** POST to create, PATCH to edit — the caller knows which it is. */
  method?: "POST" | "PATCH";
  /** Present when editing. */
  initial?: OfferInitialValues;
  /** Where to go once it exists. */
  returnTo: string;
  categories: TargetOption[];
  /** First page of products, plus how many exist and which are already chosen. */
  products: TargetOption[];
  productTotal: number;
  selectedProducts?: TargetOption[];
  /** Where the picker searches — scoped by whichever route rendered this. */
  productSearchPath: string;
  /** An org's codes carry its own code as a prefix, so the field can say so up front. */
  codePrefix?: string;
}

/** A local date-time input's value, from a Date. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function OfferForm({
  action,
  method = "POST",
  initial,
  returnTo,
  categories,
  products,
  productTotal,
  selectedProducts = [],
  productSearchPath,
  codePrefix,
}: OfferFormProps) {
  const isEdit = initial !== undefined;
  const router = useRouter();

  const now = new Date();
  const inAMonth = new Date(now.getTime() + 30 * 86_400_000);

  const form = useServerForm<PromotionFormInput>({
    schema: promotionFormSchema,
    defaultValues: (initial
      ? {
          ...initial,
          code: initial.code ?? undefined,
          // Back to the units a person types (ADR-0004 keeps the storage integral).
          percent: initial.percentBps !== null ? initial.percentBps / 100 : undefined,
          amountOff: initial.amountOffPaise !== null ? initial.amountOffPaise / 100 : undefined,
          fixedPrice:
            initial.fixedPricePaise !== null ? initial.fixedPricePaise / 100 : undefined,
          maxDiscount:
            initial.maxDiscountPaise !== null ? initial.maxDiscountPaise / 100 : undefined,
          minSubtotal: initial.minSubtotalPaise > 0 ? initial.minSubtotalPaise / 100 : undefined,
          usageLimit: initial.usageLimit ?? undefined,
          perUserLimit: initial.perUserLimit ?? undefined,
          startsAt: toLocalInput(initial.startsAt),
          endsAt: toLocalInput(initial.endsAt),
        }
      : {
          label: "",
          trigger: "AUTOMATIC",
          valueType: "PERCENT",
          isActive: true,
          categoryIds: [],
          productIds: [],
          // Every offer is time-boxed (spec R4), so the window is prefilled rather
          // than left empty — a required field with no default reads as an obstacle.
          startsAt: toLocalInput(now),
          endsAt: toLocalInput(inAMonth),
        }) as never,
    submit: async (data) => {
      const response = await fetch(action, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw await readApiError(response);
      return await response.json();
    },
    successMessage: isEdit ? "Offer updated" : "Offer created",
    onSuccess: () => {
      router.push(returnTo);
      router.refresh();
    },
  });

  const { register, watch, setValue, formState, onSubmit, formError, isSubmitting } = form;
  const trigger = watch("trigger");
  const valueType = watch("valueType");
  const categoryIds = watch("categoryIds") ?? [];
  const productIds = watch("productIds") ?? [];

  const isCoupon = trigger === "CODE";
  const isMarkdown = valueType === "FIXED_PRICE";

  const toggle = (field: "categoryIds" | "productIds", id: string, current: string[]) =>
    setValue(field, current.includes(id) ? current.filter((x) => x !== id) : [...current, id], {
      shouldValidate: true,
    });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {formError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {formError}
        </p>
      )}

      <section className="space-y-4 rounded-lg border border-border bg-card p-4 md:p-6">
        <h2 className="text-base font-semibold">What the offer is</h2>

        <FormInput
          label="Name"
          required
          placeholder="Summer Sale"
          hint="Buyers see this on the line it discounts."
          {...register("label")}
          error={formState.errors.label?.message}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormSelect
            label="How it applies"
            required
            {...register("trigger")}
            error={formState.errors.trigger?.message}
          >
            <option value="AUTOMATIC">Automatically — shown as the price</option>
            <option value="CODE">With a coupon code</option>
          </FormSelect>

          {isCoupon && (
            <FormInput
              label="Code"
              required
              placeholder={codePrefix ? `${codePrefix}SUMMER20` : "SUMMER20"}
              hint={
                codePrefix
                  ? `Starts with ${codePrefix} so buyers know whose offer it is.`
                  : "Letters, numbers and hyphens."
              }
              {...register("code")}
              error={formState.errors.code?.message}
            />
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4 md:p-6">
        <h2 className="text-base font-semibold">What it takes off</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <FormSelect
            label="Kind"
            required
            {...register("valueType")}
            // The schema attaches "a fixed selling price is a markdown, not a coupon"
            // here, so this field genuinely can carry an error.
            error={formState.errors.valueType?.message}
          >
            <option value="PERCENT">A percentage</option>
            <option value="AMOUNT_OFF">A fixed amount off</option>
            <option value="FIXED_PRICE">A fixed selling price</option>
          </FormSelect>

          {valueType === "PERCENT" && (
            <FormInput
              label="Percentage"
              required
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              placeholder="20"
              {...register("percent", { valueAsNumber: true })}
              error={formState.errors.percent?.message}
            />
          )}
          {valueType === "AMOUNT_OFF" && (
            <FormInput
              // A flat amount means two different things depending on how the offer
              // applies, and the difference is invisible until an order is placed —
              // so the label carries it rather than the documentation.
              label={isCoupon ? "Amount off the order (₹)" : "Amount off each item (₹)"}
              required
              type="number"
              step="0.01"
              min="0"
              hint={
                isCoupon
                  ? "Taken off once, spread across the items it covers."
                  : "Taken off every unit — ₹100 on a basket of three is ₹300."
              }
              {...register("amountOff", { valueAsNumber: true })}
              error={formState.errors.amountOff?.message}
            />
          )}
          {isMarkdown && (
            <FormInput
              label="Sells at (₹)"
              required
              type="number"
              step="0.01"
              min="0"
              hint="A markdown on named products — pick them below."
              {...register("fixedPrice", { valueAsNumber: true })}
              error={formState.errors.fixedPrice?.message}
            />
          )}
        </div>

        {/* Basket conditions belong to coupons: a product page sets the displayed
            price and has no basket to test them against (promotions D5). */}
        {isCoupon && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              label="Minimum spend (₹)"
              type="number"
              step="0.01"
              min="0"
              placeholder="Optional"
              hint="Measured on the items this offer covers, not the whole basket."
              {...register("minSubtotal", { valueAsNumber: true })}
              error={formState.errors.minSubtotal?.message}
            />
            {/* Only a proportion of an unknown basket needs a ceiling. */}
            {valueType === "PERCENT" && (
              <FormInput
                label="Most it can take off (₹)"
                type="number"
                step="0.01"
                min="0"
                placeholder="Optional"
                hint="Caps a percentage on a large basket."
                {...register("maxDiscount", { valueAsNumber: true })}
                error={formState.errors.maxDiscount?.message}
              />
            )}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4 md:p-6">
        <h2 className="text-base font-semibold">When it runs</h2>
        {/* Stacked at base, side by side from md — a date range squeezed onto a phone
            is where mis-set windows come from. */}
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput
            label="Starts"
            required
            type="datetime-local"
            {...register("startsAt")}
            error={formState.errors.startsAt?.message}
          />
          <FormInput
            label="Ends"
            required
            type="datetime-local"
            hint="Every offer has an end. Stop it sooner with the switch below."
            {...register("endsAt")}
            error={formState.errors.endsAt?.message}
          />
        </div>

        {isCoupon && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              label="Total redemptions"
              type="number"
              min="1"
              placeholder="Unlimited"
              {...register("usageLimit", { valueAsNumber: true })}
              error={formState.errors.usageLimit?.message}
            />
            <FormInput
              label="Per customer"
              type="number"
              min="1"
              placeholder="Unlimited"
              hint="Requires the buyer to be signed in."
              {...register("perUserLimit", { valueAsNumber: true })}
              error={formState.errors.perUserLimit?.message}
            />
          </div>
        )}

        <div className="pt-1">
          <Checkbox
            label="Running"
            // The description has to describe the box as it is, not as the action of
            // clearing it — "stops the offer" beside a ticked box reads backwards.
            description="Untick to stop it immediately, whatever its dates say."
            checked={watch("isActive")}
            onChange={(event) => setValue("isActive", event.target.checked)}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4 md:p-6">
        <h2 className="text-base font-semibold">What it covers</h2>
        <p className="text-sm text-muted-foreground">
          {categoryIds.length === 0 && productIds.length === 0
            ? "Everything you sell. Narrow it by picking categories or products."
            : "Only what you pick below."}
        </p>

        <div>
          <Label className="text-sm">Categories</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            A category includes everything beneath it.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <Checkbox
                key={category.id}
                label={category.name}
                checked={categoryIds.includes(category.id)}
                onChange={() => toggle("categoryIds", category.id, categoryIds)}
              />
            ))}
          </div>
        </div>

        <ProductPicker
          searchPath={productSearchPath}
          initial={products}
          initialTotal={productTotal}
          selectedOptions={selectedProducts}
          value={productIds}
          onChange={(ids) => setValue("productIds", ids, { shouldValidate: true })}
          required={isMarkdown}
          error={formState.errors.productIds?.message}
        />
      </section>

      {/* Docked above the tab bar on a phone, so the primary action is always reachable
          without scrolling a long form to its foot (ADR-0016). */}
      <div className="sticky bottom-tabbar z-10 -mx-4 border-t border-border bg-background/95 p-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting} className="flex-1 md:flex-none">
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create offer"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push(returnTo)}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
