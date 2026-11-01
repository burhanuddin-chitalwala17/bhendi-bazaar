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

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  platformPromotionSchema,
  promotionFormSchema,
  type PlatformPromotionFormInput,
} from "@/lib/validation/schemas/promotion.schema";
import {
  CONFIRM_LOSS_PHRASE,
  LOSS_BUDGET_REQUIRED,
  couldCostMoreThanCommission,
  lossWarning,
} from "@server/promotions/loss";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormInput, FormSelect } from "@/components/shared/forms/FormField";
import { Button } from "@/components/ui/button";
import type { ZodType } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ProductPicker,
  type TargetOption,
} from "@/components/promotions/ProductPicker";
import { offersApiClient } from "@/components/promotions/offersApiClient";
import { bpsToPercent, paiseToRupees, rupeesToPaise } from "@/lib/format";

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
  /** Platform offers only (offers-hardening D5). */
  platformBudgetPaise?: number | null;
  /** A shop's codes only (storefront-themes Q20). */
  showOnStorefront?: boolean;
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
  /**
   * Platform forms only: the lowest commission in force, so the loss panel shows from the rule
   * the server refuses with (offers-hardening D6). Absent, there is no budget or panel.
   */
  lossRule?: { lowestRateBps: number };
}

/** The platform form's fields plus the one a shop's adds (storefront-themes Q20). */
type OfferFormValues = PlatformPromotionFormInput & { showOnStorefront?: boolean };

/** A local date-time input's value, from a Date. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** A typed number, or null while the field is empty (`valueAsNumber` gives NaN). */
const typed = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

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
  lossRule,
}: OfferFormProps) {
  const isEdit = initial !== undefined;
  const router = useRouter();

  const now = new Date();
  const inAMonth = new Date(now.getTime() + 30 * 86_400_000);

  // A shop's schema strips budget and confirmation, so the platform form is a superset.
  const form = useServerForm<OfferFormValues>({
    schema: (lossRule ? platformPromotionSchema : promotionFormSchema) as unknown as ZodType<OfferFormValues>,
    defaultValues: (initial
      ? {
          ...initial,
          code: initial.code ?? undefined,
          // Back to the units a person types (ADR-0004 keeps the storage integral).
          percent:
            initial.percentBps !== null
              ? bpsToPercent(initial.percentBps)
              : undefined,
          amountOff:
            initial.amountOffPaise !== null
              ? paiseToRupees(initial.amountOffPaise)
              : undefined,
          fixedPrice:
            initial.fixedPricePaise !== null
              ? paiseToRupees(initial.fixedPricePaise)
              : undefined,
          maxDiscount:
            initial.maxDiscountPaise !== null
              ? paiseToRupees(initial.maxDiscountPaise)
              : undefined,
          minSubtotal:
            initial.minSubtotalPaise > 0
              ? paiseToRupees(initial.minSubtotalPaise)
              : undefined,
          usageLimit: initial.usageLimit ?? undefined,
          perUserLimit: initial.perUserLimit ?? undefined,
          budget:
            initial.platformBudgetPaise != null
              ? paiseToRupees(initial.platformBudgetPaise)
              : undefined,
          startsAt: toLocalInput(initial.startsAt),
          endsAt: toLocalInput(initial.endsAt),
        }
      : {
          label: "",
          trigger: "AUTOMATIC",
          valueType: "PERCENT",
          isActive: true,
          ...(lossRule ? {} : { showOnStorefront: false }),
          categoryIds: [],
          productIds: [],
          // Every offer is time-boxed (spec R4), so the window is prefilled rather
          // than left empty — a required field with no default reads as an obstacle.
          startsAt: toLocalInput(now),
          endsAt: toLocalInput(inAMonth),
        }) as never,
    submit: (data) => offersApiClient.save(action, method, data),
    successMessage: "Offer saved.",
    fallbackMessage: "Couldn't save. Try again.",
    onSuccess: () => {
      router.push(returnTo);
      router.refresh();
    },
  });

  const {
    register,
    watch,
    setValue,
    formState,
    onSubmit,
    formError,
    isSubmitting,
  } = form;
  const trigger = watch("trigger");
  const valueType = watch("valueType");
  const categoryIds = watch("categoryIds") ?? [];
  const productIds = watch("productIds") ?? [];

  const isCoupon = trigger === "CODE";
  const isMarkdown = valueType === "FIXED_PRICE";

  const [percent, amountOff, fixedPrice, minSubtotal] = watch([
    "percent",
    "amountOff",
    "fixedPrice",
    "minSubtotal",
  ]).map(typed);
  const couldLose =
    lossRule !== undefined &&
    couldCostMoreThanCommission(
      {
        valueType,
        percentBps: percent !== null ? Math.round(percent * 100) : null,
        amountOffPaise: amountOff !== null ? rupeesToPaise(amountOff) : null,
        fixedPricePaise: fixedPrice !== null ? rupeesToPaise(fixedPrice) : null,
        minSubtotalPaise:
          isCoupon && minSubtotal !== null ? rupeesToPaise(minSubtotal) : 0,
      },
      lossRule.lowestRateBps,
    );

  const toggle = (
    field: "categoryIds" | "productIds",
    id: string,
    current: string[],
  ) =>
    setValue(
      field,
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      {
        shouldValidate: true,
      },
    );

  return (
    // The button stays enabled while saving (ADR-0053); a second press is ignored here instead.
    <form
      onSubmit={(event) => (isSubmitting ? event.preventDefault() : onSubmit(event))}
      className="space-y-5"
    >
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
            <option value="AUTOMATIC">
              Automatically — shown as the price
            </option>
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
              label={
                isCoupon
                  ? "Amount off the order (₹)"
                  : "Amount off each item (₹)"
              }
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

        {/* Full width in the form column on every size (ux.md, loss panel). */}
        {couldLose && lossRule && (
          <Alert className="space-y-3 border-warning/40 bg-warning/10">
            <AlertDescription>{lossWarning(lossRule.lowestRateBps)}</AlertDescription>
            <FormInput
              label="Confirm"
              required
              autoComplete="off"
              autoCapitalize="characters"
              placeholder={CONFIRM_LOSS_PHRASE}
              {...register("confirmLoss")}
              error={formState.errors.confirmLoss?.message}
            />
          </Alert>
        )}

        {lossRule && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              label="Budget (₹)"
              required={couldLose}
              type="number"
              step="0.01"
              min="0"
              hint={
                couldLose
                  ? LOSS_BUDGET_REQUIRED
                  : "Stop the offer once it has cost this much. Optional."
              }
              {...register("budget", { valueAsNumber: true })}
              error={formState.errors.budget?.message}
            />
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

        {isCoupon && !lossRule && (
          <Checkbox
            label="Show on my shop"
            description="Prints this code in your shop's deals, where anyone can use it."
            checked={watch("showOnStorefront") === true}
            onChange={(event) => setValue("showOnStorefront", event.target.checked)}
          />
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
          onChange={(ids) =>
            setValue("productIds", ids, { shouldValidate: true })
          }
          required={isMarkdown}
          error={formState.errors.productIds?.message}
        />
      </section>

      {/* Docked above the tab bar on a phone, so the primary action is always reachable
          without scrolling a long form to its foot (ADR-0016). */}
      <div className="sticky bottom-tabbar z-10 -mx-4 border-t border-border bg-background/95 p-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex gap-3">
          <Button
            type="submit"
            aria-busy={isSubmitting}
            className="flex-1 md:flex-none"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isEdit ? "Save changes" : "Create offer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(returnTo)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
