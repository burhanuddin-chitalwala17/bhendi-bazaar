// components/shared/forms/product/ProductInventoryFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import { FormInput } from "../FormField";
import type { ProductFormInput } from "@/components/product/console/types";
import { PRODUCT_INVENTORY_FIELDS_COPY } from "./product-copy";

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
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">{PRODUCT_INVENTORY_FIELDS_COPY.inventory}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stock itself is entered per pickup location (stock-locations R2/R3). */}
        <FormInput
          label={PRODUCT_INVENTORY_FIELDS_COPY.lowStockThreshold}
          disabled={readOnly}
          type="number"
          min="0"
          placeholder="10"
          {...register("lowStockThreshold", { valueAsNumber: true })}
          error={errors.lowStockThreshold?.message}
          hint={PRODUCT_INVENTORY_FIELDS_COPY.alertWhenStockFallsBelow}
        />

        <FormInput
          label={PRODUCT_INVENTORY_FIELDS_COPY.weightKg}
          required
          disabled={readOnly}
          type="number"
          min="0"
          step="0.001"
          placeholder="0.6"
          {...register("weight", { valueAsNumber: true })}
          error={errors.weight?.message}
          hint={PRODUCT_INVENTORY_FIELDS_COPY.kilogramsDecimalsAllowed06}
        />
      </div>
    </div>
  );
}
