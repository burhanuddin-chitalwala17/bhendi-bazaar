"use client";

import { useMemo } from "react";
import { useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from "react-hook-form";

import { FormController, FormInput, FormSelect } from "../FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { useListingValues, type ValueOption, type ValuesByList } from "@/components/shared/forms/product/useListingValues";
import { ANSWER, FACT_DECLARATIONS, type FactKey } from "@server/listing/listing-facts";
import { resolveProductType } from "@server/listing/product-type";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import type { FormProductType } from "@server/listing/form-channels.service";
import { ANY_KIND, groupQuestions, type ChannelUse, type Question } from "@server/listing/form-channels";
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

      {(() => {
        // Required now: the store's required measurements and what a channel the shop sells on needs;
        // every other question under "Also helps on…" (R2, ux state matrix). The kind picks its channel types (Q7).
        const use = type.channelUse?.[kind || ANY_KIND] ?? type.channelUse?.[ANY_KIND] ?? {};
        const groups = groupQuestions(type.facts, type.measures, use);
        const factErrors = (errors.facts as Record<string, { message?: string }> | undefined) ?? {};
        const measureErrors = (errors.measurements as Record<string, { message?: string }> | undefined) ?? {};
        // A collapsed group opens itself when it holds an error, so no refusal hides (review).
        const restHasError = groups.rest.some((q) => (q.kind === "fact" ? factErrors : measureErrors)[q.key]?.message);
        const render = (q: Question) => (
          <div key={`${q.kind}:${q.key}`} className="space-y-1">
            {q.kind === "fact" ? (
              <FactField
                fact={q.key as FactKey}
                type={type}
                control={control}
                register={register}
                options={values[FACT_DECLARATIONS[q.key as FactKey]?.list ?? ""] ?? []}
                loading={loading}
                error={factErrors[q.key]?.message}
                origin={origins[q.key]}
                readOnly={readOnly}
              />
            ) : (
              <MeasureField measure={type.measures.find((m) => m.key === q.key)!} register={register} error={measureErrors[q.key]?.message} origin={origins[q.key]} readOnly={readOnly} />
            )}
            <ChannelBadges use={groups.badges[q.key]} />
          </div>
        );
        const helps = groups.helps.map((c) => PRODUCT_FACT_FIELDS_COPY.channelShort[c] ?? c);
        return (
          <>
            {groups.required.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-foreground">{PRODUCT_FACT_FIELDS_COPY.requiredNow}</h3>
                <p className="mt-1 text-2xs text-muted-foreground">{PRODUCT_FACT_FIELDS_COPY.requiredNowBody}</p>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">{groups.required.map(render)}</div>
              </div>
            )}
            {groups.rest.length > 0 && (
              <details className="mt-4 rounded-card border border-border px-3" open={restHasError || undefined}>
                <summary className="flex min-h-10 cursor-pointer items-center py-2 text-sm font-medium text-foreground">{PRODUCT_FACT_FIELDS_COPY.alsoHelpsOn(helps)}</summary>
                <div className="grid grid-cols-1 gap-4 pb-3 md:grid-cols-2">{groups.rest.map(render)}</div>
              </details>
            )}
          </>
        );
      })()}
    </section>
  );
}

/** One measurement in the unit its type fixes (categories D6). */
function MeasureField({ measure, register, error, origin, readOnly }: {
  measure: { key: string; label: string; unit: string };
  register: UseFormRegister<ProductFormInput>;
  error?: string;
  origin?: string;
  readOnly: boolean;
}) {
  return (
    <FormInput
      label={`${measure.label} (${measure.unit})`}
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

/** Which channels need a question, as small chips under it (dynamic-form R2, parent Q27). */
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
