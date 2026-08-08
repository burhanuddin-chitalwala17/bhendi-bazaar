// components/shared/forms/product/index.tsx

import React from "react";
import { useServerForm } from "@/hooks/core/useServerForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormController } from "../FormField";
import { ImageUpload } from "@/admin/image-upload";
import { ProductBasicFields } from "./ProductBasicFields";
import { ProductPricingFields } from "./ProductPricingFields";
import { ProductInventoryFields } from "./ProductInventoryFields";
import { ProductAttributeFields } from "./ProductAttributeFields";
import { ProductFlagsFields } from "./ProductFlagsFields";
import { ProductOrgShippingFields } from "./ProductOrgShippingFields";
import { FormActions } from "../../button-groups/FormActions";
import type { ProductFormInput, ProductDetails } from "@/admin/products/types";
import { useFormPersist } from "@/hooks/forms/useFormPersist";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import { paiseToRupees } from "@/lib/format";
interface ProductFormProps {
  product?: ProductDetails;
  categories?: { id: string; name: string }[];
  orgs?: { id: string; name: string; code: string; defaultPincode: string; defaultCity: string; defaultState: string; defaultAddress: string }[];
  onSubmit: (data: ProductFormInput) => Promise<ProductDetails | null | undefined>;
  onCancel: () => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
}

export function ProductForm({
  product,
  categories,
  orgs,
  onSubmit,
  onCancel,
  isSubmitting,
  readOnly = false,
}: ProductFormProps) {

  const isEdit = !!product;


  // Client validation and server error routing both come from this one call:
  // field-attributed server errors land on their fields with no code here.
  const form = useServerForm<ProductFormInput>({
    schema: productFormSchema,
    submit: onSubmit,
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      // Stored paise → rupee inputs; the service converts back on submit.
      price: product ? paiseToRupees(product.price) : 0,
      salePrice: product?.salePrice != null ? paiseToRupees(product.salePrice) : undefined,
      currency: product?.currency || "INR",
      categoryId: product?.category?.id || "",
      orgId: product?.org?.id || "",
      tags: product?.tags || [],
      flags: product?.flags || [],
      images: product?.images || [],
      thumbnail: product?.thumbnail || "",
      weight: product?.weight || 0,
      sizes: product?.sizes || [],
      colors: product?.colors || [],
      stock: product?.stock || 0,
      sku: product?.sku || "",
      lowStockThreshold: product?.lowStockThreshold || 10,
      shippingFromPincode: product?.shippingFromPincode || "",
      shippingFromCity: product?.shippingFromCity || "",
      shippingFromLocation: product?.shippingFromLocation || "",
    },
  }); 
  const {
    register,
    onSubmit: handleFormSubmit,
    formError,
    watch,
    setValue,
    control,
    formState: { errors },
  } = form;

  // form persist
  const { clearSaved } = useFormPersist("product-creation-form-draft", form, {
    enabled: !isEdit,
  });

  const imagesValue = watch("images");

  // Auto-set thumbnail as first image
  React.useEffect(() => {
    if (imagesValue && imagesValue.length > 0 && !product?.thumbnail) {
      setValue("thumbnail", imagesValue[0]);
    }
  }, [imagesValue, setValue, product?.thumbnail]);

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* Server errors that could not be attributed to a field. Field-level ones
          are already showing on their inputs. */}
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {formError}
        </div>
      )}

      {/* Basic Information */}
      <ProductBasicFields
        register={register}
        errors={errors}
        setValue={setValue}
        categories={categories}
        readOnly={readOnly}
      />

      {/* Pricing */}
      <ProductPricingFields
        register={register}
        errors={errors}
        readOnly={readOnly}
      />

      {/* Images */}
      {!readOnly && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Images</h2>
            <FormController
              name="images"
              control={control}
              label="Product Images"
              rules={{ required: "At least one image is required" }}
              render={({ field }) => (
                <ImageUpload
                  label="Product Images"
                  value={field.value as string[]}
                  onChange={field.onChange}
                  maxImages={10}
                  required
                />
              )}
            />
            {errors.images && (
              <p className="text-destructive text-sm mt-1">{errors.images.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* View-only Images */}
      {readOnly && product?.images && product.images.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Images</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {product.images.map((img, idx) => (
                <div key={idx} className="relative aspect-[3/4] rounded-lg overflow-hidden border">
                  <img
                    src={img}
                    alt={`Product ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory */}
      <ProductInventoryFields
        register={register}
        errors={errors}
        readOnly={readOnly}
      />

      {/* Attributes */}
      <ProductAttributeFields
        control={control}
        readOnly={readOnly}
      />

      {/* Flags */}
      <ProductFlagsFields
        control={control}
        readOnly={readOnly}
      />

      {/* Org Shipping */}
      <ProductOrgShippingFields
        register={register}
        errors={errors}
        watch={watch}
        orgs={orgs}
        readOnly={readOnly}
      />

      {/* Actions */}
      {readOnly ? (
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Close
          </Button>
        </div>
      ) : (
        <FormActions
          onCancel={onCancel}
          submitLabel={isEdit ? "Update Product" : "Create Product"}
          isSubmitting={isSubmitting}
        />
      )}
    </form>
  );
}

// Re-export individual field components for flexibility
export { ProductBasicFields } from "./ProductBasicFields";
export { ProductPricingFields } from "./ProductPricingFields";
export { ProductInventoryFields } from "./ProductInventoryFields";
export { ProductAttributeFields } from "./ProductAttributeFields";
export { ProductFlagsFields } from "./ProductFlagsFields";
export { ProductOrgShippingFields } from "./ProductOrgShippingFields";