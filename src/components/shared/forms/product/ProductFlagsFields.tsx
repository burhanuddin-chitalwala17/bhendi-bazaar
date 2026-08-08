// components/shared/forms/product/ProductFlagsFields.tsx

import { Control } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProductFormInput } from "@/admin/products/types";
import { FormController } from "../FormField";
import { ProductFlag, PRODUCT_FLAG_METADATA } from "@/types/product";

interface ProductFlagsFieldsProps {
  control: Control<ProductFormInput>;
  readOnly?: boolean;
}

export function ProductFlagsFields({ control, readOnly = false }: ProductFlagsFieldsProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Product Flags
      </h2>
      <div className="space-y-3">
        <FormController
          name="flags"
          control={control}
          disabled={readOnly}
          render={({ field }) => {
            const currentFlags = (field.value as ProductFlag[]) || [];

            const toggleFlag = (flag: ProductFlag) => {
              const newFlags = currentFlags.includes(flag)
                ? currentFlags.filter((f) => f !== flag)
                : [...currentFlags, flag];
              field.onChange(newFlags);
            };

            return (
              <div className="space-y-3">
                {Object.entries(PRODUCT_FLAG_METADATA).map(([flag, meta]) => (
                  <Checkbox
                    key={flag}
                    disabled={readOnly}
                    label={meta.label}
                    description={meta.description}
                    checked={currentFlags.includes(flag as ProductFlag)}
                    onChange={() => toggleFlag(flag as ProductFlag)}
                  />
                ))}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}