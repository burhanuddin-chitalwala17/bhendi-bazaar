// components/shared/forms/category/CategoryBasicFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import { FormInput, FormSelect, FormTextarea } from "../FormField";
import type { CreateCategoryInput } from "@/domain/admin";

interface CategoryBasicFieldsProps {
  register: UseFormRegister<CreateCategoryInput>;
  errors: FieldErrors<CreateCategoryInput>;
  /** Valid parents — the form excludes self and descendants; the server re-checks. */
  parentOptions: Array<{ id: string; name: string }>;
}

export function CategoryBasicFields({
  register,
  errors,
  parentOptions,
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

