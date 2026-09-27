// components/shared/forms/product/index.tsx

import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import { resolveShotList } from "@server/catalog/shot-list";
import React, { useEffect } from "react";
import Image from "next/image";
import { useServerForm } from "@/hooks/core/useServerForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormController } from "../FormField";
import { ProductMediaManager } from "@/components/product/product-media-manager";
import { ProductBasicFields } from "./ProductBasicFields";
import { ProductPricingFields } from "./ProductPricingFields";
import { ProductInventoryFields } from "./ProductInventoryFields";
import { ProductAttributeFields } from "./ProductAttributeFields";
import { ProductFlagsFields } from "./ProductFlagsFields";
import {
  ProductOrgShippingFields,
  type LocationOption,
} from "./ProductOrgShippingFields";
import { FormActions } from "../../button-groups/FormActions";
import type {
  ProductFormInput,
  ProductDetails,
} from "@/components/product/console/types";
import { useFormPersist } from "@/hooks/forms/useFormPersist";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import { paiseToRupees } from "@/lib/format";
import {
  youtubePosterUrl,
  type ProductMediaInput,
} from "@server/catalog/media";
import type { OrgSummary } from "@/domain/org";
import type { ProductCopySource } from "@server/catalog/admin.product.types";
interface ProductFormProps {
  product?: ProductDetails;
  /** Create only: another of the org's products whose descriptive fields seed this one. */
  copySource?: ProductCopySource | null;
  /** Carrying `parentId` and `shotList` lets the gallery resolve its slots per category (media-library D4). */
  categories?: { id: string; name: string; parentId?: string | null; shotList?: unknown }[];
  orgs?: OrgSummary[];
  /** The org's pickup locations; the form shows a stock input per active one. */
  locations?: LocationOption[];
  onSubmit: (
    data: ProductFormInput,
  ) => Promise<ProductDetails | null | undefined>;
  onCancel: () => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
  /**
   * The presign route for image uploads — the org portal passes its member-guarded one.
   * The bytes go browser-to-store, so this route only signs (ADR-0028).
   */
  uploadEndpoints?: UploadEndpoints;
}

export function ProductForm({
  product,
  copySource,
  categories,
  orgs,
  locations = [],
  onSubmit,
  onCancel,
  isSubmitting,
  readOnly = false,
  uploadEndpoints,
}: ProductFormProps) {
  const isEdit = !!product;
  const copy = isEdit ? null : (copySource ?? null);
  // A restored draft would overwrite the copied fields on mount, so a copy is not
  // draft-persisted — and must not clear a blank-form draft the org left behind.
  const persistDraft = !isEdit && !copy;

  // One row per offered location, prefilled from the product's existing rows. A
  // location the product never stocked shows 0; zero rows are dropped on write.
  const stockByLocation = new Map(
    (product?.stockLocations ?? []).map((row) => [
      row.orgAddressId,
      row.quantity,
    ]),
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
    // Deferred: clearSaved is declared below. Without this the saved draft
    // prefills the next "new product" with the one just created.
    onSuccess: () => {
      if (persistDraft) clearSaved();
    },
    defaultValues: {
      name: product?.name || "",
      description: product?.description || copy?.description || "",
      // Stored paise → rupee inputs; the service converts back on submit.
      price: product ? paiseToRupees(product.price) : 0,
      salePrice:
        product?.salePrice != null
          ? paiseToRupees(product.salePrice)
          : undefined,
      currency: product?.currency || "INR",
      categoryId: product?.category?.id || copy?.categoryId || "",
      orgId: product?.org?.id || "",
      tags: product?.tags || copy?.tags || [],
      flags: product?.flags || copy?.flags || [],
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
      sizes: product?.sizes || copy?.sizes || [],
      colors: product?.colors || copy?.colors || [],
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
    enabled: persistDraft,
  });

  // Cancelling a create abandons it: the next "new product" starts blank.
  // Reset first — it fires watch — then clear, which cancels that queued save.
  const handleCancel = () => {
    if (persistDraft) {
      form.reset();
      clearSaved();
    }
    onCancel();
  };

  // Belt to the exclusion above: whatever restored or reset the form, the rows
  // always mirror the offered locations — typed quantities kept, ids re-asserted.
  const locationIds = locations.map((location) => location.id).join(",");
  useEffect(() => {
    const current = getValues("stockLocations") ?? [];
    const typed = new Map(
      current
        .filter((row) => row && row.orgAddressId)
        .map((row) => [row.orgAddressId, row.quantity]),
    );
    setValue(
      "stockLocations",
      locations.map((location) => ({
        orgAddressId: location.id,
        quantity:
          Number(
            typed.get(location.id) ?? stockByLocation.get(location.id) ?? 0,
          ) || 0,
      })),
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

      {/* Gallery — photographs and video, in the org's order, one photo as cover.
          Needs the presign route: without one there is no upload to offer. */}
      {!readOnly && !!uploadEndpoints && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Gallery
            </h2>
            <FormController
              name="media"
              control={control}
              label="Photos and video"
              render={({ field }) => (
                <ProductMediaManager
                  value={field.value as ProductMediaInput[]}
                  onChange={field.onChange}
                  endpoints={uploadEndpoints}
                  shotList={resolveShotList(watch("categoryId"), categories ?? [])}
                  orgId={watch("orgId") || undefined}
                  identifier={watch("name")}
                  // The code, not the id: it is the folder the presign route signs under.
                  orgCode={orgs?.find((org) => org.id === watch("orgId"))?.code}
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
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Gallery
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {product.media.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-[3/4] rounded-lg overflow-hidden border"
                >
                  <Image
                    src={
                      item.kind === "YOUTUBE"
                        ? youtubePosterUrl(item.ref)
                        : item.ref
                    }
                    alt={item.description ?? ""}
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    unoptimized={item.kind === "YOUTUBE"}
                    className="object-cover"
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
      <ProductAttributeFields control={control} readOnly={readOnly} />

      {/* Flags */}
      <ProductFlagsFields control={control} readOnly={readOnly} />

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
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Close
          </Button>
        </div>
      ) : (
        <FormActions
          onCancel={handleCancel}
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
