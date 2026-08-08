// components/shared/forms/product/ProductAttributeFields.tsx

import { Control } from "react-hook-form";
import { FormController } from "../FormField";
import { MultiSelect } from "@/components/ui/multi-select";
import type { ProductFormInput } from "@/admin/products/types";

interface ProductAttributeFieldsProps {
  control: Control<ProductFormInput>;
  readOnly?: boolean;
}

export function ProductAttributeFields({ control, readOnly = false }: ProductAttributeFieldsProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Product Attributes
      </h2>
      <div className="space-y-4">
        {/* CHANGED: Using FormController wrapper */}
        <FormController
          name="sizes"
          control={control}
          disabled={readOnly}
          render={(field) => (
            <MultiSelect
              label="Sizes"
              value={field.field.value as string[]}
              onChange={(value) => field.field.onChange(value)}
              placeholder="Type size and press Enter (e.g., S, M, L, XL)"
            />
          )}
        />

        <FormController
          name="colors"
          control={control}
          disabled={readOnly}
          render={(field) => (
            <MultiSelect
              label="Colors"
              value={field.field.value as string[]}
              onChange={(value) => field.field.onChange(value)}
              placeholder="Type color and press Enter (e.g., Red, Blue, Black)"
            />
          )}
        />

        <FormController
          name="tags"
          control={control}
          disabled={readOnly}
          render={(field) => (
            <MultiSelect
              label="Tags"
              value={field.field.value as string[]}
              onChange={(value) => field.field.onChange(value)}
              placeholder="Type tag and press Enter (e.g., trending, sale)"
            />
          )}
        />
      </div>
    </div>
  );
}