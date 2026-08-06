// components/shared/forms/product/ProductInventoryFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import { FormInput } from "../FormField";
import type { ProductFormInput } from "@/admin/products/types";

interface ProductInventoryFieldsProps {
  register: UseFormRegister<ProductFormInput>;
  errors: FieldErrors<ProductFormInput>;
  readOnly?: boolean;
}

export function ProductInventoryFields({
  register,
  errors,
  readOnly = false,
}: ProductInventoryFieldsProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Stock Quantity"
          required
          disabled={readOnly}
          type="number"
          min="0"
          placeholder="0"
          {...register("stock", {
            required: "Stock quantity is required",
            valueAsNumber: true,
            min: { value: 0, message: "Stock cannot be negative" },
          })}
          error={errors.stock?.message}
        />

        <FormInput
          label="Low Stock Threshold"
          disabled={readOnly}
          type="number"
          min="0"
          placeholder="10"
          {...register("lowStockThreshold", { valueAsNumber: true })}
          error={errors.lowStockThreshold?.message}
          hint="Alert when stock falls below this number"
        />

        <FormInput
          label="Weight (kg)"
          required
          disabled={readOnly}
          type="number"
          min="0"
          placeholder="0.5"
          {...register("weight", { valueAsNumber: true })}
          error={errors.weight?.message}
          hint="Used to rate shipping"
        />
      </div>
    </div>
  );
}