import { productService } from "@server/catalog/product.service";
import { allocateAcrossOrgs, type AllocationLine } from "@server/checkout/allocation";
import { billableWeightKg } from "@server/shipping/billable-weight";

/**
 * Which parcels a basket becomes (stock-locations R5, R10): the same pure allocation the order
 * transaction runs, as a preview. Names parcels and contents, never per-location stock (A9).
 */
export async function previewParcels(items: AllocationLine[], destinationPincode: string) {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const { products, stockRows } = await productService.listForAllocation(productIds);

  const productsById = new Map(products.map((product) => [product.id, product]));
  const locationInfo = new Map(stockRows.map((row) => [row.orgAddressId, row.orgAddress]));
  const parcels = allocateAcrossOrgs(
    items,
    new Map(products.map((product) => [product.id, product.orgId])),
    stockRows,
    new Map([...locationInfo.entries()].map(([id, info]) => [id, info.address.pincode])),
    destinationPincode,
    new Map(products.map((product) => [product.id, product.name])),
  );

  return parcels.map((parcel) => {
    const location = locationInfo.get(parcel.orgAddressId);
    const anyProduct = productsById.get(parcel.lines[0]?.productId ?? "");
    const totalWeight = parcel.lines.reduce(
      (sum, line) => sum + (productsById.get(line.productId)?.weight ?? 0) * line.quantity,
      0,
    );
    return {
      groupId: parcel.orgAddressId,
      orgId: location?.orgId ?? "",
      orgName: anyProduct?.org.name ?? "",
      orgCode: anyProduct?.org.code ?? "",
      locationName: location?.name ?? "",
      fromPincode: location?.address.pincode ?? "",
      fromCity: location?.address.city ?? "",
      fromState: location?.address.state ?? "",
      items: parcel.lines,
      totalWeight,
      // What the rate is quoted on: the sum rounded up to whole kilograms, floor 1 kg
      // (product-weight-and-rates, decided 2026-08-10).
      billableWeightKg: billableWeightKg(totalWeight),
    };
  });
}
