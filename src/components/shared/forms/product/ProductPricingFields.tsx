// components/shared/forms/product/ProductPricingFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import { FormInput, FormSelect } from "../FormField";
import type { ProductFormInput } from "@/admin/products/types";

interface ProductPricingFieldsProps {
  register: UseFormRegister<ProductFormInput>;
  errors: FieldErrors<ProductFormInput>;
  readOnly?: boolean;
}

export function ProductPricingFields({
  register,
  errors,
  readOnly = false,
}: ProductPricingFieldsProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormInput
          label="Regular Price (₹)"
          required
          disabled={readOnly}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register("price", {
            required: "Price is required",
            valueAsNumber: true,
            min: { value: 0.01, message: "Price must be greater than 0" },
          })}
          error={errors.price?.message}
        />

        <FormInput
          label="Sale Price (₹)"
          disabled={readOnly}
          type="number"
          step="0.01"
          min="0"
          placeholder="Optional"
          {...register("salePrice", { valueAsNumber: true })}
          error={errors.salePrice?.message}
          hint="Leave empty if not on sale"
        />

        {/* CHANGED: Now using FormSelect */}
        <FormSelect
          label="Currency"
          disabled={readOnly}
          {...register("currency")}
          error={errors.currency?.message}
        >
          <option value="INR">INR (₹)</option>
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
        </FormSelect>
      </div>
    </div>
  );
}