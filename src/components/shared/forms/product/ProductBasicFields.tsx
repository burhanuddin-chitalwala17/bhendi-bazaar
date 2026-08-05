// components/shared/forms/product/ProductBasicFields.tsx

import { UseFormRegister, FieldErrors, UseFormSetValue } from "react-hook-form";
import { FormInput, FormSelect, FormTextarea } from "../FormField";
import type { ProductFormInput } from "@/admin/products/types";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

interface ProductBasicFieldsProps {
  register: UseFormRegister<ProductFormInput>;
  errors: FieldErrors<ProductFormInput>;
  setValue: UseFormSetValue<ProductFormInput>;
  categories?: { id: string; name: string }[];
  readOnly?: boolean;
}

export function ProductBasicFields({
  register,
  errors,
  categories,
  readOnly = false,
}: ProductBasicFieldsProps) {
  const router = useRouter();
  const handleAddCategory = () => {
    // Save current product form and navigate to category form
    router.push("/admin/categories/new?returnUrl=/admin/products/new");
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Basic Information
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Product Name"
          required
          placeholder="e.g., Velvet Embroidered Kurta"
          disabled={readOnly}
          {...register("name", { required: "Product name is required" })}
          error={errors.name?.message}
        />

        <div className="md:col-span-2">
          <FormTextarea
            label="Description"
            required
            disabled={readOnly}
            placeholder="Detailed product description..."
            rows={4}
            {...register("description", { required: "Description is required" })}
            error={errors.description?.message}
          />
        </div>
        {/* Category with Add button */}
        <div>
          <FormSelect
            label="Category"
            required
            disabled={readOnly}
            {...register("categoryId", { required: "Category is required" })}
            error={errors.categoryId?.message}
          >
            <option value="">Select a category</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </FormSelect>
          
          {/* Add Category Button */}
          <button
            disabled={readOnly}
            type="button"
            onClick={handleAddCategory}
            className="mt-2 w-full px-3 py-2 text-sm border disabled:opacity-50 disabled:cursor-not-allowed border-dashed border-emerald-500 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Category
          </button>
        </div>
        <FormInput
          label="SKU"
          placeholder="e.g., VEK-001"
          disabled={readOnly}
          {...register("sku")}
          hint="Optional"
        />
      </div>
    </div>
  );
}