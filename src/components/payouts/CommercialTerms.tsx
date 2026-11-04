"use client";

/**
 * What the platform charges one organisation.
 *
 * Lives on the payout page rather than in the organisation's profile modal, for two
 * reasons. The profile form is rendered in the organisation's *own* portal and its
 * schema is parsed by an endpoint any signed-in user may call — a rate there would be
 * an organisation setting its own commission. And this is where you are already
 * looking at what that rate produced, which is when you would want to change it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray } from "react-hook-form";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useServerForm } from "@/hooks/core/useServerForm";
import { bpsToPercent } from "@/lib/format";
import {
  commercialTermsSchema,
  type CommercialTermsInput,
} from "@/lib/validation/schemas/commercial-terms.schema";
import { payoutsApiClient } from "@/components/payouts/payoutsApiClient";
import { COMMERCIAL_TERMS_COPY } from "./payouts-copy";

export interface CategoryOption {
  id: string;
  name: string;
}

interface CommercialTermsProps {
  orgId: string;
  commissionBps: number;
  maxDiscountBps: number;
  categories: CategoryOption[];
  current: Array<{ categoryId: string; rateBps: number }>;
}

export function CommercialTerms({
  orgId,
  commissionBps,
  maxDiscountBps,
  categories,
  current,
}: CommercialTermsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useServerForm<CommercialTermsInput>({
    schema: commercialTermsSchema,
    defaultValues: {
      commissionPercent: bpsToPercent(commissionBps),
      maxDiscountPercent: bpsToPercent(maxDiscountBps),
      categoryRates: current.map((rule) => ({
        categoryId: rule.categoryId,
        ratePercent: bpsToPercent(rule.rateBps),
      })),
    },
    submit: (data) => payoutsApiClient.setCommercialTerms(orgId, data),
    successMessage: COMMERCIAL_TERMS_COPY.saved,
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  const {
    register,
    control,
    watch,
    getValues,
    formState: { errors },
    onSubmit,
    formError,
    isSubmitting: busy,
  } = form;
  const rates = useFieldArray({ control, name: "categoryRates" });
  const chosen = watch("categoryRates") ?? [];

  const unused = categories.filter(
    (c) => !chosen.some((r) => r.categoryId === c.id),
  );
  const nameOf = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? id;

  const save = () => {
    // A category added and left blank has always been dropped, not refused.
    const blank = (getValues("categoryRates") ?? []).flatMap((rate, index) =>
      Number.isNaN(rate.ratePercent) ? [index] : [],
    );
    if (blank.length > 0) rates.remove(blank);
    return onSubmit();
  };

  if (!open) {
    return (
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-small font-medium">{COMMERCIAL_TERMS_COPY.title}</p>
            <p className="text-caption text-muted-foreground">
              {COMMERCIAL_TERMS_COPY.byDefault(bpsToPercent(commissionBps))}
              {current.length > 0 && COMMERCIAL_TERMS_COPY.categoryRates(current.length)}
              {COMMERCIAL_TERMS_COPY.separator}{COMMERCIAL_TERMS_COPY.cappedAt(bpsToPercent(maxDiscountBps))}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {COMMERCIAL_TERMS_COPY.change}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <p className="text-small font-medium">{COMMERCIAL_TERMS_COPY.title}</p>

      {formError && <p className="text-caption text-destructive">{formError}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="commission" className="text-caption">
            {COMMERCIAL_TERMS_COPY.defaultRate}
          </Label>
          <Input
            id="commission"
            type="number"
            step="0.01"
            min="0"
            max="100"
            className="mt-1"
            aria-invalid={!!errors.commissionPercent}
            {...register("commissionPercent", { valueAsNumber: true })}
          />
          <p className="mt-1 text-caption text-muted-foreground">
            {COMMERCIAL_TERMS_COPY.defaultRateHint}
          </p>
          {errors.commissionPercent?.message && (
            <p className="mt-1 text-caption text-destructive">
              {errors.commissionPercent.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="maxDiscount" className="text-caption">
            {COMMERCIAL_TERMS_COPY.ceiling}
          </Label>
          <Input
            id="maxDiscount"
            type="number"
            step="0.01"
            min="0"
            max="100"
            className="mt-1"
            aria-invalid={!!errors.maxDiscountPercent}
            {...register("maxDiscountPercent", { valueAsNumber: true })}
          />
          <p className="mt-1 text-caption text-muted-foreground">
            {COMMERCIAL_TERMS_COPY.ceilingHint}
          </p>
          {errors.maxDiscountPercent?.message && (
            <p className="mt-1 text-caption text-destructive">
              {errors.maxDiscountPercent.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-caption">{COMMERCIAL_TERMS_COPY.ratesTitle}</Label>
        <p className="text-caption text-muted-foreground">
          {COMMERCIAL_TERMS_COPY.ratesHint}
        </p>
        {rates.fields.map((rate, index) => {
          const error = errors.categoryRates?.[index]?.ratePercent?.message;
          return (
            <div key={rate.id}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-small">
                  {nameOf(rate.categoryId)}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-24"
                  aria-label={COMMERCIAL_TERMS_COPY.rateFor(nameOf(rate.categoryId))}
                  aria-invalid={!!error}
                  {...register(`categoryRates.${index}.ratePercent`, {
                    valueAsNumber: true,
                  })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={COMMERCIAL_TERMS_COPY.removeRate(nameOf(rate.categoryId))}
                  onClick={() => rates.remove(index)}
                >
                  <Icon name="close" />
                </Button>
              </div>
              {error && <p className="mt-1 text-caption text-destructive">{error}</p>}
            </div>
          );
        })}

        {unused.length > 0 && (
          <Select
            value=""
            onChange={(event) =>
              event.target.value &&
              rates.append({
                categoryId: event.target.value,
                // Blank until typed, as before; `save` drops it if it stays that way.
                ratePercent: Number.NaN,
              })
            }
            className="mt-1 h-10 w-full rounded-field bg-background text-small"
            aria-label={COMMERCIAL_TERMS_COPY.addRate}
          >
            <option value="">{COMMERCIAL_TERMS_COPY.addRateOption}</option>
            {unused.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Changing a rate never rewrites a settlement: every rate is snapshotted onto
          the line that used it when the entry was written (R4). */}
      <p className="text-caption text-muted-foreground">
        {COMMERCIAL_TERMS_COPY.fromNow}
      </p>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => void save().catch(() => {})} disabled={busy}>
          {busy ? COMMERCIAL_TERMS_COPY.saving : COMMERCIAL_TERMS_COPY.save}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {COMMERCIAL_TERMS_COPY.cancel}
        </Button>
      </div>
    </Card>
  );
}
