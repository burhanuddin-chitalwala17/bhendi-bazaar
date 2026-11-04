// components/shared/forms/product/ProductBasicFields.tsx

import { UseFormRegister, FieldErrors, UseFormSetValue } from "react-hook-form";
import { FormInput, FormSelect, FormTextarea } from "../FormField";
import type { ProductFormInput } from "@/components/product/console/types";
import { useRouter } from "next/navigation";
import { PRODUCT_BASIC_FIELDS_COPY } from "./product-copy";
import { ROUTES } from "@server/shared/routes";
import { BASIC_FIELDS_RULES_COPY } from "@/components/shared/forms/product/product-copy";

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
    router.push(`${ROUTES.admin.newCategory}?returnUrl=/admin/products/new`);
  };
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        {PRODUCT_BASIC_FIELDS_COPY.basicInformation}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={PRODUCT_BASIC_FIELDS_COPY.productName}
          required
          placeholder={PRODUCT_BASIC_FIELDS_COPY.eGVelvetEmbroideredKurta}
          disabled={readOnly}
          {...register("name", { required: BASIC_FIELDS_RULES_COPY.name })}
          error={errors.name?.message}
        />

        <div className="md:col-span-2">
          <FormTextarea
            label={PRODUCT_BASIC_FIELDS_COPY.description}
            required
            disabled={readOnly}
            placeholder={PRODUCT_BASIC_FIELDS_COPY.detailedProductDescription}
            rows={4}
            {...register("description", {
              required: BASIC_FIELDS_RULES_COPY.description,
            })}
            error={errors.description?.message}
          />
        </div>
        {/* Category with Add button */}
        <div>
          <FormSelect
            label={PRODUCT_BASIC_FIELDS_COPY.category}
            required
            disabled={readOnly}
            {...register("categoryId", { required: BASIC_FIELDS_RULES_COPY.category })}
            error={errors.categoryId?.message}
          >
            <option value="">{PRODUCT_BASIC_FIELDS_COPY.selectACategory}</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </FormSelect>
        </div>
        <FormInput
          label="SKU"
          placeholder={PRODUCT_BASIC_FIELDS_COPY.eGVek001}
          disabled={readOnly}
          {...register("sku")}
          error={errors.sku?.message}
          hint={PRODUCT_BASIC_FIELDS_COPY.optionalMustBeUnique}
        />
      </div>
    </div>
  );
}
