// components/shared/forms/category/CategoryBasicFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import { FormInput, FormSelect, FormTextarea } from "../FormField";
import type { CreateCategoryInput } from "@/domain/admin";
import { CATEGORY_BASIC_FIELDS_COPY } from "./category-copy";
import { CATEGORY_BASIC_RULES_COPY } from "@/components/shared/forms/category/category-copy";


interface CategoryBasicFieldsProps {
  register: UseFormRegister<CreateCategoryInput>;
  errors: FieldErrors<CreateCategoryInput>;
  /** The chosen type, so the field can say what leaving it empty costs. */
  watchedProductType?: string | null;
  /** The types that exist, passed in rather than imported — they are rows now, not constants. */
  productTypeOptions?: Array<{ key: string; label: string }>;
  /** Valid parents — the form excludes self and descendants; the server re-checks. */
  parentOptions: Array<{ id: string; name: string }>;
}

export function CategoryBasicFields({
  register,
  errors,
  parentOptions,
  watchedProductType,
  productTypeOptions = [],
}: CategoryBasicFieldsProps) {
  return (
    <div className="rounded-card border border-border bg-card p-6">
      <h2 className="text-title font-semibold text-foreground mb-4">
        {CATEGORY_BASIC_FIELDS_COPY.basicInformation}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={CATEGORY_BASIC_FIELDS_COPY.categoryName}
          required
          placeholder={CATEGORY_BASIC_FIELDS_COPY.eGKurtas}
          {...register("name", { required: CATEGORY_BASIC_RULES_COPY.name })}
          error={errors.name?.message}
        />

        <div className="md:col-span-2">
          <FormTextarea
            label={CATEGORY_BASIC_FIELDS_COPY.description}
            required
            placeholder={CATEGORY_BASIC_FIELDS_COPY.detailedCategoryDescription}
            rows={4}
            {...register("description", {
              required: CATEGORY_BASIC_RULES_COPY.description,
            })}
            error={errors.description?.message}
          />
        </div>

        <FormSelect
          label={CATEGORY_BASIC_FIELDS_COPY.parentCategory}
          {...register("parentId")}
          error={errors.parentId?.message}
          hint={CATEGORY_BASIC_FIELDS_COPY.leaveEmptyForATop}
        >
          <option value="">{CATEGORY_BASIC_FIELDS_COPY.noneTopLevel}</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </FormSelect>

        {/*
          Which listing questions this category's products are asked. Separate from the browsing
          tree on purpose: merchandising reorganises categories, and the questions asked of an
          abaya must not change because somebody moved it under a seasonal heading
          (listing-vocabulary/categories D1a).
        */}
        <FormSelect
          label={CATEGORY_BASIC_FIELDS_COPY.productType}
          {...register("productType")}
          error={errors.productType?.message}
          hint={
            watchedProductType
              ? CATEGORY_BASIC_RULES_COPY.typeHintRoot
              : CATEGORY_BASIC_RULES_COPY.typeHintChild
          }
        >
          <option value="">{CATEGORY_BASIC_FIELDS_COPY.inheritFromParent}</option>
          {productTypeOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </FormSelect>

        <FormInput
          label={CATEGORY_BASIC_FIELDS_COPY.displayOrder}
          type="number"
          min="0"
          placeholder="0"
          {...register("order", { valueAsNumber: true })}
          error={errors.order?.message}
          hint={CATEGORY_BASIC_FIELDS_COPY.lowerNumbersAppearFirst}
        />
      </div>
    </div>
  );
}
