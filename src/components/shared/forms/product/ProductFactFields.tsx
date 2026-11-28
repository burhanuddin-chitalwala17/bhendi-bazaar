"use client";

import { useMemo } from "react";
import { useShopPlan } from "@/components/subscriptions/plan-context";
import { FORM_CHANNELS_LOCKED_COPY } from "@/components/subscriptions/subscriptions-copy";
import { useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from "react-hook-form";

import { FormController, FormInput, FormSelect } from "../FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { useListingValues, type ValueOption, type ValuesByList } from "@/components/shared/forms/product/useListingValues";
import { ANSWER, FACT_DECLARATIONS, type FactKey } from "@server/listing/listing-facts";
import { answered } from "@server/listing/fill-facts";
import { resolveProductType } from "@server/listing/product-type";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import type { FormProductType } from "@server/listing/form-channels.service";
import { ANY_KIND, FIELD_FILTER, filterQuestions, type ChannelUse, type Question } from "@server/listing/form-channels";
import { CHANNEL } from "@server/shared/channels";
import { Button } from "@/components/ui/button";
import { useFieldFilter } from "./useFieldFilter";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import type { ProductFormInput } from "@/components/product/console/types";
import { ProductFamilyField, type FamilyOption } from "./ProductFamilyField";
import { PRODUCT_FACT_FIELDS_COPY } from "./product-copy";

interface ProductFactFieldsProps {
  control: Control<ProductFormInput>;
  register: UseFormRegister<ProductFormInput>;
  /** A field and its error are two things: bind one without the other and the form refuses to
   * submit while saying nothing (`tests/unit/form-error-display.test.ts`). */
  errors: FieldErrors<ProductFormInput>;
  setValue: UseFormSetValue<ProductFormInput>;
  /** The org's families, read by the page; a new one can be made from here (variants R2). */
  families?: FamilyOption[];
  orgId: string;
  /** The chosen category, watched: it decides the type, and the type decides the questions. */
  categoryId: string;
  categories: { id: string; name: string; parentId?: string | null; productType?: unknown }[];
  /** With which of the shop's channels need each question, where the page computed it (dynamic-form D1). */
  productTypes: FormProductType[];
  /** The answers the page already loaded for the category it rendered with. */
  initialValues?: ValuesByList;
  /** Where a filled-in value came from, so the form can say so (inherited-facts R3). */
  origins?: Partial<Record<string, string>>;
  readOnly?: boolean;
  /** False where the family is asked elsewhere — the stepped create keeps it in "What it is" (product-form Q7). */
  withFamily?: boolean;
}

/** A blank number box is "not answered", never NaN — valueAsNumber's NaN failed the schema and blocked the save. */
const blankIsUnanswered = (value: unknown) => (value === "" || value == null ? null : Number(value));
// An unticked box looks the same untouched or cleared, so only a tick counts as filled.
const isAnswered = (value: unknown) => value !== false && answered(value as Parameters<typeof answered>[0]);

/** The marketplaces offered as chips, in the order a channel is shown (listing-model Q35). */
const FILTER_CHANNELS = [CHANNEL.AMAZON, CHANNEL.FLIPKART, CHANNEL.MEESHO];

/**
 * The questions this product's type asks
 * ([listing-vocabulary](../../../../../docs/specs/listing-vocabulary/)).
 *
 * It replaces the free-text sizes and colours boxes, which is what the whole phase is for: a
 * colour typed three ways is three colours to a marketplace. Nothing here blocks saving — a
 * product with facts unanswered saves, sells on this storefront, and is told what is missing.
 *
 * The type comes from the category, resolved the same way the server resolves it, so the form
 * asks exactly what the save will store. Changing the category changes the questions, and the
 * answers for the new ones are fetched then — the page serves the first load, so this only runs
 * on an interaction ([ADR-0034](../../../../../docs/adr/0034-render-on-the-server-by-default.md)).
 *
 * Mobile-first ([ADR-0015](../../../../../docs/adr/0015-mobile-first-design.md)): one column at
 * base, two from `md`.
 */
export function ProductFactFields({
  control,
  register,
  errors,
  setValue,
  families = [],
  orgId,
  categoryId,
  categories,
  productTypes,
  initialValues = {},
  origins = {},
  readOnly = false,
  withFamily = true,
}: ProductFactFieldsProps) {
  const plan = useShopPlan();
  const typeKey = useMemo(
    () => resolveProductType(categoryId, categories),
    [categoryId, categories],
  );
  const type = useMemo(
    () => productTypes.find((candidate) => candidate.key === typeKey) ?? null,
    [productTypes, typeKey],
  );

  const lists = useMemo(
    () =>
      (type?.facts ?? [])
        .map((fact) => FACT_DECLARATIONS[fact]?.list)
        .filter((list): list is string => !!list),
    [type],
  );

  const { values, loading } = useListingValues(orgId, lists, initialValues);
  const kind = useWatch({ control, name: "kind" }) as string | null | undefined;
  const factAnswers = useWatch({ control, name: "facts" as never }) as Record<string, unknown> | undefined;
  const measureAnswers = useWatch({ control, name: "measurements" as never }) as Record<string, unknown> | undefined;
  // The kind picks its channel types (Q7).
  const filter = useMemo(() => {
    if (!type) return null;
    const use = type.channelUse?.[kind || ANY_KIND] ?? type.channelUse?.[ANY_KIND] ?? {};
    return filterQuestions(type.facts, type.measures, use, FILTER_CHANNELS);
  }, [type, kind]);
  const { active, pick } = useFieldFilter(filter?.chips ?? []);

  if (!type) {
    return (
      <section className="rounded-card border border-border bg-card p-4 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">{PRODUCT_FACT_FIELDS_COPY.productDetails}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{PRODUCT_FACT_FIELDS_COPY.noProductType}</p>
        {/* A family is still legitimate without a type: the siblings share a description even
            where nothing has named what makes them differ. */}
        {withFamily && (
          <div className="mt-4">
            <ProductFamilyField
              register={register}
              setValue={setValue}
              errors={errors}
              orgId={orgId}
              categoryId={categoryId}
              families={families}
              readOnly={readOnly}
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-card border border-border bg-card p-4 md:p-6">
      <h2 className="text-lg font-semibold text-foreground">{type.label} details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {PRODUCT_FACT_FIELDS_COPY.whatAMarketplaceAsksAbout}
      </p>
      {/* The form is the same with Channels locked; this says why the marketplace questions are still here (feature-access Q5). */}
      {!plan.features.channels && <p className="mt-3 rounded-card bg-info/10 p-3 text-sm">{FORM_CHANNELS_LOCKED_COPY}</p>}

      {withFamily && (
        <div className="mt-4">
          <ProductFamilyField
            register={register}
            setValue={setValue}
            errors={errors}
            orgId={orgId}
            categoryId={categoryId}
            families={families}
            readOnly={readOnly}
          />
        </div>
      )}

      {type.kinds.length > 0 && (
        <div className="mt-4">
          <FormSelect
            // Remounted per type, so a kind kept from an earlier category shows when switched back (D5).
            key={type.key}
            label={PRODUCT_FACT_FIELDS_COPY.kind}
            {...register("kind")}
            error={errors.kind?.message}
            disabled={readOnly}
          >
            <option value="">{PRODUCT_FACT_FIELDS_COPY.notSpecified}</option>
            {type.kinds.map((kind) => (
              <option key={kind.key} value={kind.key}>
                {kind.label}
              </option>
            ))}
          </FormSelect>
        </div>
      )}

      {filter && active && (() => {
        const factErrors = (errors.facts as Record<string, { message?: string }> | undefined) ?? {};
        const measureErrors = (errors.measurements as Record<string, { message?: string }> | undefined) ?? {};
        const errorOf = (q: Question) => (q.kind === "fact" ? factErrors : measureErrors)[q.key]?.message;
        const filledIn = (q: Question) => isAnswered((q.kind === "fact" ? factAnswers : measureAnswers)?.[q.key]);
        const shown = new Set(active.questions.map((q) => q.key));
        const body = active.key === FIELD_FILTER.ALL || active.key === FIELD_FILTER.REQUIRED
          ? PRODUCT_FACT_FIELDS_COPY.filterBody[active.key]
          : PRODUCT_FACT_FIELDS_COPY.filterBody.channel(PRODUCT_FACT_FIELDS_COPY.channelShort[active.key] ?? active.key);
        return (
          <div className="mt-4">
            <div role="group" aria-label={PRODUCT_FACT_FIELDS_COPY.filterLabel} className="flex flex-wrap gap-2">
              {filter.chips.map((chip) => (
                <Button
                  key={chip.key}
                  type="button"
                  size="sm"
                  variant={chip.key === active.key ? "default" : "outline"}
                  aria-pressed={chip.key === active.key}
                  onClick={() => pick(chip.key)}
                >
                  {PRODUCT_FACT_FIELDS_COPY.filterChip[chip.key] ?? chip.key}
                  <span className="sr-only"> </span>
                  <span className="text-2xs opacity-80">{PRODUCT_FACT_FIELDS_COPY.filled(chip.questions.filter(filledIn).length, chip.questions.length)}</span>
                  <span className="sr-only"> {PRODUCT_FACT_FIELDS_COPY.filledSr}</span>
                </Button>
              ))}
            </div>
            <p className="mt-2 text-2xs text-muted-foreground">{body}</p>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              {filter.chips[0].questions.map((q) => (
                // Hidden, never unmounted, so an answer survives a chip change; a field with an error always shows.
                <div key={`${q.kind}:${q.key}`} className={shown.has(q.key) || errorOf(q) ? "space-y-1" : "hidden"}>
                  {q.kind === "fact" ? (
                    <FactField
                      fact={q.key as FactKey}
                      type={type}
                      control={control}
                      register={register}
                      options={values[FACT_DECLARATIONS[q.key as FactKey]?.list ?? ""] ?? []}
                      loading={loading}
                      error={errorOf(q)}
                      origin={origins[q.key]}
                      required={filter.storeRequired.has(q.key)}
                      readOnly={readOnly}
                    />
                  ) : (
                    <MeasureField measure={type.measures.find((m) => m.key === q.key)!} register={register} error={errorOf(q)} origin={origins[q.key]} required={filter.storeRequired.has(q.key)} readOnly={readOnly} />
                  )}
                  <ChannelBadges use={filter.badges[q.key]} />
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </section>
  );
}

/** One measurement in the unit its type fixes (categories D6). */
function MeasureField({ measure, register, error, origin, required, readOnly }: {
  measure: { key: string; label: string; unit: string };
  register: UseFormRegister<ProductFormInput>;
  error?: string;
  origin?: string;
  required: boolean;
  readOnly: boolean;
}) {
  return (
    <FormInput
      label={`${measure.label} (${measure.unit})`}
      required={required}
      type="number"
      step="0.1"
      inputMode="decimal"
      disabled={readOnly}
      {...register(`measurements.${measure.key}` as never, { setValueAs: blankIsUnanswered })}
      error={error}
      hint={origin ? `from your ${origin}` : undefined}
    />
  );
}

/** Who asks a question, as small chips under it: the store's own required ones stand out, marketplaces do not (Q35). */
function ChannelBadges({ use }: { use?: ChannelUse }) {
  if (!use || use.required.length + use.helps.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {use.required.map((c) => <StatusBadge key={c} tone="info">{PRODUCT_FACT_FIELDS_COPY.channelShort[c] ?? c}</StatusBadge>)}
      {use.helps.map((c) => <StatusBadge key={c} tone="neutral">{PRODUCT_FACT_FIELDS_COPY.channelShort[c] ?? c}</StatusBadge>)}
    </div>
  );
}

/** One question, rendered by how it is answered. */
function FactField({
  fact,
  type,
  control,
  register,
  options,
  loading,
  origin,
  error,
  required,
  readOnly,
}: {
  fact: FactKey;
  type: ProductTypeRecord;
  control: Control<ProductFormInput>;
  register: UseFormRegister<ProductFormInput>;
  options: ValueOption[];
  loading: boolean;
  origin?: string;
  error?: string;
  required: boolean;
  readOnly: boolean;
}) {
  const declaration = FACT_DECLARATIONS[fact];
  if (!declaration) return null;

  // A type's trade may use another word for a shared question — cloth is asked its Fabric.
  const label = type.factLabels[fact] ?? declaration.label;
  // Where a value was filled in rather than typed, say so (inherited-facts R3). It stays
  // editable, and editing it makes it the shop's own.
  const hint = origin ? `from your ${origin}` : declaration.hint;
  const name = `facts.${fact}` as const;

  if (declaration.answer === ANSWER.BOOLEAN) {
    return (
      <FormController
        name={name as never}
        control={control}
        disabled={readOnly}
        render={({ field }) => (
          <Checkbox
            label={label}
            description={error ?? hint}
            checked={field.value === true}
            onChange={(event) => field.onChange(event.target.checked)}
          />
        )}
      />
    );
  }

  if (declaration.answer === ANSWER.NUMBER) {
    return (
      <FormInput
        label={label}
        required={required}
        type="number"
        inputMode="numeric"
        disabled={readOnly}
        error={error}
        hint={hint}
        {...register(name as never, { setValueAs: blankIsUnanswered })}
      />
    );
  }

  if (declaration.answer === ANSWER.TEXT) {
    return (
      <FormInput
        label={label}
        required={required}
        disabled={readOnly}
        error={error}
        hint={hint}
        {...register(name as never)}
      />
    );
  }

  return (
    <FormSelect
      label={label}
      required={required}
      // Never disabled while the answers load (product-form A8): the hint says why it is empty.
      disabled={readOnly}
      error={error}
      hint={loading ? "Loading the answers…" : hint}
      {...register(name as never)}
    >
      <option value="">{PRODUCT_FACT_FIELDS_COPY.notSpecified}</option>
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
          {option.orgId ? " (yours)" : ""}
        </option>
      ))}
    </FormSelect>
  );
}
