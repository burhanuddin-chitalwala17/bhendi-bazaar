"use client";

import { useMemo } from "react";
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";

import { FormController, FormInput, FormSelect } from "../FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { useListingValues, type ValueOption, type ValuesByList } from "@/hooks/catalog/useListingValues";
import { ANSWER, FACT_DECLARATIONS, type FactKey } from "@server/catalog/listing-facts";
import { resolveProductType } from "@server/catalog/product-type";
import type { ProductTypeRecord } from "@server/catalog/product-type.types";
import type { ProductFormInput } from "@/components/product/console/types";
import { ProductFamilyField, type FamilyOption } from "./ProductFamilyField";

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
  productTypes: ProductTypeRecord[];
  /** The answers the page already loaded for the category it rendered with. */
  initialValues?: ValuesByList;
  /** Where a filled-in value came from, so the form can say so (inherited-facts R3). */
  origins?: Partial<Record<string, string>>;
  readOnly?: boolean;
}

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

  if (!type) {
    return (
      <section className="rounded-card border border-border bg-card p-4 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">Product details</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This category has no product type, so there is nothing more to ask. The product saves
          and sells here; it cannot be published to a marketplace until a type is set.
        </p>
        {/* A family is still legitimate without a type: the siblings share a description even
            where nothing has named what makes them differ. */}
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
      </section>
    );
  }

  return (
    <section className="rounded-card border border-border bg-card p-4 md:p-6">
      <h2 className="text-lg font-semibold text-foreground">{type.label} details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What a marketplace asks about this kind of thing. Leave anything you do not know — it
        saves either way.
      </p>

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

      {type.kinds.length > 0 && (
        <div className="mt-4">
          <FormSelect
            label="Kind"
            {...register("kind")}
            error={errors.kind?.message}
            disabled={readOnly}
          >
            <option value="">Not specified</option>
            {type.kinds.map((kind) => (
              <option key={kind.key} value={kind.key}>
                {kind.label}
              </option>
            ))}
          </FormSelect>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {type.facts.map((fact) => (
          <FactField
            key={fact}
            fact={fact}
            type={type}
            control={control}
            register={register}
            options={values[FACT_DECLARATIONS[fact]?.list ?? ""] ?? []}
            loading={loading}
            error={
              (errors.facts as Record<string, { message?: string }> | undefined)?.[fact]?.message
            }
            origin={origins[fact]}
            readOnly={readOnly}
          />
        ))}
      </div>

      {type.measures.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-medium text-foreground">Measurements</h3>
          <p className="mt-1 text-2xs text-muted-foreground">
            In {type.measures[0]?.unit}. Measured once here rather than guessed at a size label —
            a measurement says which size it is, and a size label does not say the measurement.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
            {type.measures.map((measure) => (
              <FormInput
                key={measure.key}
                label={`${measure.label} (${measure.unit})`}
                type="number"
                step="0.1"
                inputMode="decimal"
                disabled={readOnly}
                {...register(`measurements.${measure.key}` as never, { valueAsNumber: true })}
                error={
                  (errors.measurements as Record<string, { message?: string }> | undefined)?.[
                    measure.key
                  ]?.message
                }
                hint={origins[measure.key] ? `from your ${origins[measure.key]}` : undefined}
              />
            ))}
          </div>
        </>
      )}
    </section>
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
        {...register(name as never, { valueAsNumber: true })}
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
      disabled={readOnly || loading}
      error={error}
      hint={loading ? "Loading the answers…" : hint}
      {...register(name as never)}
    >
      <option value="">Not specified</option>
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
          {option.orgId ? " (yours)" : ""}
        </option>
      ))}
    </FormSelect>
  );
}
