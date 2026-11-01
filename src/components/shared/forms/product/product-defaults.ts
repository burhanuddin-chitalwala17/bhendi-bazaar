import { paiseToRupees } from "@/lib/format";
import type { OrgSummary } from "@/domain/org";
import type { ProductCopySource } from "@server/catalog/admin.product.types";
import type { ProductDetails, ProductFormInput } from "@/components/product/console/types";

/**
 * One stock row per offered location, prefilled from the product's rows. `seenQuantity` travels
 * with each existing row, so a sale that lands while the form is open is refused, not undone.
 */
export function stockRows(locationIds: readonly string[], product?: ProductDetails): ProductFormInput["stockLocations"] {
  const held = new Map((product?.stockLocations ?? []).map((row) => [row.orgAddressId, row.quantity]));
  return locationIds.map((orgAddressId) => ({
    orgAddressId,
    quantity: held.get(orgAddressId) ?? 0,
    seenQuantity: held.get(orgAddressId),
  }));
}

/**
 * What the form opens with: a stored product, a copy, or a blank one. Pure, so an edit can reset
 * to the latest product after a refused save (product-form D8) through the same mapping it opened with.
 */
export function productDefaults(
  product: ProductDetails | undefined,
  copy: ProductCopySource | null,
  orgs: OrgSummary[] | undefined,
  locationIds: readonly string[],
): ProductFormInput {
  return {
    name: product?.name || "",
    description: product?.description || copy?.description || "",
    // Stored paise → rupee inputs; the service converts back on submit.
    price: product ? paiseToRupees(product.price) : 0,
    salePrice: product?.salePrice != null ? paiseToRupees(product.salePrice) : undefined,
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
    facts: Object.fromEntries(Object.entries(product?.facts ?? {}).map(([fact, stored]) => [fact, stored.value])),
    measurements: Object.fromEntries(
      Object.entries(product?.measurements ?? {}).map(([key, stored]) => [key, stored.value]),
    ),
    // No cover is pre-selected on create (D17a). On edit the saved flag comes back with the rows.
    media:
      product?.media?.map((item) => ({
        kind: item.kind,
        ref: item.ref,
        description: item.description ?? undefined,
        isThumbnail: item.isThumbnail,
        slot: item.slot ?? null,
      })) || [],
    weight: product?.weight || 0,
    stockLocations: stockRows(locationIds, product),
    sku: product?.sku || "",
    lowStockThreshold: product?.lowStockThreshold || 10,
  };
}
