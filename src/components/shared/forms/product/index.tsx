// components/shared/forms/product/index.tsx

import React, { useEffect } from "react";
import { useServerForm } from "@/hooks/core/useServerForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormController } from "../FormField";
import { ProductMediaManager } from "@/admin/product-media-manager";
import { ProductBasicFields } from "./ProductBasicFields";
import { ProductPricingFields } from "./ProductPricingFields";
import { ProductInventoryFields } from "./ProductInventoryFields";
import { ProductAttributeFields } from "./ProductAttributeFields";
import { ProductFlagsFields } from "./ProductFlagsFields";
import { ProductOrgShippingFields, type LocationOption } from "./ProductOrgShippingFields";
import { FormActions } from "../../button-groups/FormActions";
import type { ProductFormInput, ProductDetails } from "@/admin/products/types";
import { useFormPersist } from "@/hooks/forms/useFormPersist";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import { paiseToRupees } from "@/lib/format";
import { youtubePosterUrl, type ProductMediaInput } from "@server/catalog/media";
import type { OrgSummary } from "@/domain/org";
interface ProductFormProps {
  product?: ProductDetails;
  categories?: { id: string; name: string }[];
  orgs?: OrgSummary[];
  /** The org's pickup locations; the form shows a stock input per active one. */
  locations?: LocationOption[];
  onSubmit: (data: ProductFormInput) => Promise<ProductDetails | null | undefined>;
  onCancel: () => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
  /** Where image uploads go — the org portal passes its member-guarded route. */
  uploadEndpoint?: string;
}

export function ProductForm({
  product,
  categories,
  orgs,
  locations = [],
  onSubmit,
  onCancel,
  isSubmitting,
  readOnly = false,
  uploadEndpoint,
}: ProductFormProps) {

  const isEdit = !!product;

  // One row per offered location, prefilled from the product's existing rows. A
  // location the product never stocked shows 0; zero rows are dropped on write.
  const stockByLocation = new Map(
    (product?.stockLocations ?? []).map((row) => [row.orgAddressId, row.quantity])
  );
  const defaultStockRows = locations.map((location) => ({
    orgAddressId: location.id,
    quantity: stockByLocation.get(location.id) ?? 0,
  }));


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
      // No cover is pre-selected on create (D17a). On edit the saved flag comes back
      // with the rows, so an existing product keeps the cover its org chose.
      media:
        product?.media?.map((item) => ({
          kind: item.kind,
          ref: item.ref,
          description: item.description ?? undefined,
          isThumbnail: item.isThumbnail,
        })) || [],
      weight: product?.weight || 0,
      sizes: product?.sizes || [],
      colors: product?.colors || [],
      stockLocations: defaultStockRows,
      sku: product?.sku || "",
      lowStockThreshold: product?.lowStockThreshold || 10,
    },
  }); 
  const {
    register,
    onSubmit: handleFormSubmit,
    formError,
    watch,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = form;

  // form persist
  // Location rows are never draft-persisted: a draft saved while the org had no
  // locations restores an empty array over the fresh rows, and the hidden
  // orgAddressId can then fail validation invisibly (the submit "does nothing").
  const { clearSaved } = useFormPersist("product-creation-form-draft", form, {
    excludeFields: ["stockLocations"],
    enabled: !isEdit,
  });

  // Belt to the exclusion above: whatever restored or reset the form, the rows
  // always mirror the offered locations — typed quantities kept, ids re-asserted.
  const locationIds = locations.map((location) => location.id).join(",");
  useEffect(() => {
    const current = getValues("stockLocations") ?? [];
    const typed = new Map(
      current
        .filter((row) => row && row.orgAddressId)
        .map((row) => [row.orgAddressId, row.quantity])
    );
    setValue(
      "stockLocations",
      locations.map((location) => ({
        orgAddressId: location.id,
        quantity: Number(typed.get(location.id) ?? stockByLocation.get(location.id) ?? 0) || 0,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationIds]);

  // The effect that mirrored the server's deriveThumbnail lived here until
  // product-video (D18). It re-asserted `thumbnail = images[0]` on every gallery change,
  // which is now the opposite of the rule: the cover is a flag the org sets, and
  // reordering the gallery must leave it alone (R16). The form assigns no cover.

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

      {/* Gallery — photographs and video, in the org's order, one photo as cover */}
      {!readOnly && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Gallery</h2>
            <FormController
              name="media"
              control={control}
              label="Photos and video"
              render={({ field }) => (
                <ProductMediaManager
                  value={field.value as ProductMediaInput[]}
                  onChange={field.onChange}
                  endpoint={uploadEndpoint}
                  identifier={watch("name")}
                  orgId={watch("orgId")}
                />
              )}
            />
            {errors.media && (
              <p className="text-destructive text-sm mt-1">
                {errors.media.message ?? errors.media.root?.message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* View-only gallery */}
      {readOnly && product?.media && product.media.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {product.media.map((item) => (
                <div key={item.id} className="relative aspect-[3/4] rounded-lg overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.kind === "YOUTUBE" ? youtubePosterUrl(item.ref) : item.ref}
                    alt={item.description ?? ""}
                    className="w-full h-full object-cover"
                  />
                  {(item.kind === "YOUTUBE" || item.isThumbnail) && (
                    <span className="absolute left-2 top-2 rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                      {item.isThumbnail ? "Cover" : "Video"}
                    </span>
                  )}
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
        locations={locations}
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