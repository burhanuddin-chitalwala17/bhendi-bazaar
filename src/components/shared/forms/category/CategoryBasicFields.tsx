// components/shared/forms/category/CategoryBasicFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import { FormInput, FormSelect, FormTextarea } from "../FormField";
import type { CreateCategoryInput } from "@/domain/admin";
import { PRODUCT_TYPE_DECLARATIONS, PRODUCT_TYPES } from "@server/catalog/product-type";

interface CategoryBasicFieldsProps {
  register: UseFormRegister<CreateCategoryInput>;
  errors: FieldErrors<CreateCategoryInput>;
  /** The chosen type, so the field can say what leaving it empty costs. */
  watchedProductType?: string | null;
  /** Valid parents — the form excludes self and descendants; the server re-checks. */
  parentOptions: Array<{ id: string; name: string }>;
}

export function CategoryBasicFields({
  register,
  errors,
  parentOptions,
  watchedProductType,
}: CategoryBasicFieldsProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Basic Information
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Category Name"
          required
          placeholder="e.g., Kurtas"
          {...register("name", { required: "Category name is required" })}
          error={errors.name?.message}
        />

        <div className="md:col-span-2">
          <FormTextarea
            label="Description"
            required
            placeholder="Detailed category description..."
            rows={4}
            {...register("description", {
              required: "Description is required",
            })}
            error={errors.description?.message}
          />
        </div>

        <FormSelect
          label="Parent Category"
          {...register("parentId")}
          error={errors.parentId?.message}
          hint="Leave empty for a top-level category"
        >
          <option value="">None — top level</option>
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
          label="Product type"
          {...register("productType")}
          error={errors.productType?.message}
          hint={
            watchedProductType
              ? "Decides which listing questions its products are asked."
              : "Decides which listing questions its products are asked. Left empty, this category inherits from its parent — and if no ancestor sets one either, products here save and sell on the storefront but cannot be published to a marketplace."
          }
        >
          <option value="">Inherit from parent</option>
          {PRODUCT_TYPES.map((key) => (
            <option key={key} value={key}>
              {PRODUCT_TYPE_DECLARATIONS[key].label}
            </option>
          ))}
        </FormSelect>

        <FormInput
          label="Display Order"
          type="number"
          min="0"
          placeholder="0"
          {...register("order", { valueAsNumber: true })}
          error={errors.order?.message}
          hint="Lower numbers appear first"
        />
      </div>
    </div>
  );
}
