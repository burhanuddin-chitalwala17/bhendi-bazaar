// components/shared/forms/product/ProductPricingFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import { FormInput, FormSelect } from "../FormField";
import type { ProductFormInput } from "@/components/product/console/types";
import { PRODUCT_PRICING_FIELDS_COPY } from "./product-copy";
import { PRICING_RULES_COPY } from "@/components/shared/forms/product/product-copy";

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
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">{PRODUCT_PRICING_FIELDS_COPY.pricing}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormInput
          label={PRODUCT_PRICING_FIELDS_COPY.regularPrice}
          required
          disabled={readOnly}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register("price", {
            required: PRICING_RULES_COPY.required,
            valueAsNumber: true,
            min: { value: 0.01, message: PRICING_RULES_COPY.min },
          })}
          error={errors.price?.message}
        />

        <FormInput
          label={PRODUCT_PRICING_FIELDS_COPY.salePrice}
          disabled={readOnly}
          type="number"
          step="0.01"
          min="0"
          placeholder={PRODUCT_PRICING_FIELDS_COPY.optional}
          {...register("salePrice", { valueAsNumber: true })}
          error={errors.salePrice?.message}
          hint={PRODUCT_PRICING_FIELDS_COPY.sellsAtThisInsteadLeave}
        />

        {/* CHANGED: Now using FormSelect */}
        <FormSelect
          label={PRODUCT_PRICING_FIELDS_COPY.currency}
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
