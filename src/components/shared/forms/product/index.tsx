// components/shared/forms/product/index.tsx

import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import { resolveShotList } from "@server/catalog/shot-list";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Film } from "lucide-react";
import { useServerForm } from "@/hooks/core/useServerForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormController } from "../FormField";
import { ProductMediaManager } from "@/components/product/product-media-manager";
import { ProductBasicFields } from "./ProductBasicFields";
import { ProductPricingFields } from "./ProductPricingFields";
import { ProductInventoryFields } from "./ProductInventoryFields";
import { ProductFactFields } from "./ProductFactFields";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
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
  /**
   * Carrying `parentId`, `shotList` and `productType` lets the form resolve, per category, both
   * the gallery's slots (media-library D4) and the questions this product is asked
   * (listing-vocabulary/categories D1a) — the same walks the server does, so what is asked is
   * what is stored.
   */
  categories?: {
    id: string;
    name: string;
    parentId?: string | null;
    shotList?: unknown;
    productType?: unknown;
  }[];
  /** The question sets, read by the page: they are rows now, so the form cannot import them. */
  productTypes?: ProductTypeRecord[];
  /** The answers for the category the page rendered with; others are fetched on change. */
  listingValues?: Record<string, Array<{ key: string; label: string; orgId: string | null }>>;
  /** Which level supplied each filled-in value, so the form can say so (inherited-facts R3). */
  factOrigins?: Partial<Record<string, string>>;
  /** The org's families, for the picker; a new one is made from the form itself (variants R2). */
  families?: Array<{ id: string; name: string }>;
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
  locations: offeredLocations = [],
  onSubmit,
  onCancel,
  isSubmitting,
  readOnly = false,
  uploadEndpoints,
  productTypes = [],
  listingValues = {},
  factOrigins,
  families = [],
}: ProductFormProps) {
  const isEdit = !!product;

  /**
   * Which level supplied each stored answer, in the words a shop would use — "from your brand".
   * Only values the shop did *not* type get one: an answer marked as the product's own is the
   * shop's, and saying where it came from would be saying "from yourself".
   */
  const origins = useMemo(() => {
    const stored = { ...(product?.facts ?? {}), ...(product?.measurements ?? {}) };
    const words: Record<string, string> = { family: "family", brand: "brand", defaults: "defaults" };
    return Object.fromEntries(
      Object.entries(stored)
        .filter(([, entry]) => entry.origin !== "product")
        .map(([key, entry]) => [key, words[entry.origin] ?? entry.origin]),
    );
  }, [product]);
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
  // Locations can grow while the form is open: the org adds one from here rather than leaving
  // a half-filled product to visit another page (stock-locations R1, org-profile R7).
  const [locations, setLocations] = useState<LocationOption[]>(offeredLocations);
  const addLocation = (location: LocationOption) =>
    setLocations((current) => (current.some((l) => l.id === location.id) ? current : [...current, location]));

  // `seenQuantity` travels with each existing row: the server writes only where it still holds,
  // so a sale that lands while this form is open is a refusal to reload from, not an overwrite.
  const defaultStockRows = locations.map((location) => ({
    orgAddressId: location.id,
    quantity: stockByLocation.get(location.id) ?? 0,
    seenQuantity: stockByLocation.get(location.id),
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
      // In the org portal there is one org to choose from, so it is chosen (nothing to pick).
      orgId: product?.org?.id || (orgs?.length === 1 ? orgs[0].id : ""),
      tags: product?.tags || copy?.tags || [],
      flags: product?.flags || copy?.flags || [],
      kind: product?.kind ?? null,
      familyId: product?.familyId ?? null,
      // A stored answer carries the level that supplied it; the form edits the value and shows
      // the origin beside it (inherited-facts R3, R4).
      facts: Object.fromEntries(
        Object.entries(product?.facts ?? {}).map(([fact, stored]) => [fact, stored.value]),
      ),
      measurements: Object.fromEntries(
        Object.entries(product?.measurements ?? {}).map(([key, stored]) => [key, stored.value]),
      ),
      // No cover is pre-selected on create (D17a). On edit the saved flag comes back
      // with the rows, so an existing product keeps the cover its org chose.
      media:
        product?.media?.map((item) => ({
          kind: item.kind,
          ref: item.ref,
          description: item.description ?? undefined,
          isThumbnail: item.isThumbnail,
          slot: item.slot ?? null,
        })) || [],
      weight: product?.weight || 0,
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
        seenQuantity: stockByLocation.get(location.id),
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
                  savedMedia={product?.media}
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
                  className="relative aspect-[3/4] rounded-lg overflow-hidden border bg-muted"
                >
                  {/* A hosted video has a poster once the worker is done; until then a film mark (video-hosting R3). */}
                  {item.kind === "VIDEO" && !item.poster ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Film className="size-8 text-muted-foreground" aria-hidden />
                    </span>
                  ) : (
                    <Image
                      src={
                        item.kind === "YOUTUBE"
                          ? youtubePosterUrl(item.ref)
                          : item.kind === "VIDEO"
                            ? (item.poster as string)
                            : item.ref
                      }
                      alt={item.description ?? ""}
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      unoptimized={item.kind === "YOUTUBE"}
                      className="object-cover"
                    />
                  )}
                  {(item.kind !== "IMAGE" || item.isThumbnail) && (
                    <span className="absolute left-2 top-2 rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                      {item.isThumbnail ? "Cover" : item.kind === "VIDEO" && item.state !== "ready" ? `Video · ${item.state}` : "Video"}
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
      {/*
        The questions this product's type asks, in place of the free-text sizes and colours
        boxes — a colour typed three ways is three colours to a marketplace
        ([listing-vocabulary](../../../../docs/specs/listing-vocabulary/)).
      */}
      <ProductFactFields
        control={control}
        register={register}
        errors={errors}
        setValue={setValue}
        families={families}
        orgId={watch("orgId") || ""}
        categoryId={watch("categoryId") || ""}
        categories={categories ?? []}
        productTypes={productTypes}
        initialValues={listingValues}
        origins={origins}
        readOnly={readOnly}
      />

      {/* Flags */}
      <ProductFlagsFields control={control} readOnly={readOnly} />

      {/* Org Shipping */}
      <ProductOrgShippingFields
        register={register}
        errors={errors}
        watch={watch}
        orgs={orgs}
        locations={locations}
        onLocationAdded={addLocation}
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
export { ProductFactFields } from "./ProductFactFields";
export { ProductFlagsFields } from "./ProductFlagsFields";
export { ProductOrgShippingFields } from "./ProductOrgShippingFields";
