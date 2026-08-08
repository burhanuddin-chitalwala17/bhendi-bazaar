import { ConflictError } from "@server/shared/domain-error";

/**
 * Which location fulfils what (stock-locations R5, TRD D8): fewest parcels first,
 * then the nearest origin to the buyer. Pure over rows the caller loaded, so every
 * branch is a unit test — and the same function runs for the checkout preview and
 * inside the order transaction, so what the customer saw is what gets decremented.
 *
 * "Nearest" is the longest shared pincode prefix with the destination: Indian
 * pincodes are geographically hierarchical (first digit region, first three the
 * sorting district), which makes prefix length an honest distance proxy without a
 * geocoder. Ties break toward more stock, then lexicographic id for determinism.
 */

export interface AllocationLine {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
}

/** One product's availability at one location. Caller passes active locations only. */
export interface LocationAvailability {
  productId: string;
  orgAddressId: string;
  quantity: number;
}

export interface AllocatedParcel {
  orgAddressId: string;
  lines: AllocationLine[];
}

function prefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

export function allocateForOrg(
  lines: AllocationLine[],
  availability: LocationAvailability[],
  locationPincodes: Map<string, string>,
  destinationPincode: string,
  productNames: Map<string, string> = new Map()
): AllocatedParcel[] {
  const needByProduct = new Map<string, number>();
  for (const line of lines) {
    needByProduct.set(line.productId, (needByProduct.get(line.productId) ?? 0) + line.quantity);
  }

  // available[location][product]
  const byLocation = new Map<string, Map<string, number>>();
  for (const row of availability) {
    if (row.quantity <= 0) continue; // a location holding zero is not chosen
    const forLocation = byLocation.get(row.orgAddressId) ?? new Map<string, number>();
    forLocation.set(row.productId, (forLocation.get(row.productId) ?? 0) + row.quantity);
    byLocation.set(row.orgAddressId, forLocation);
  }

  // The total must cover every line before any parcel math (spec: "the total is short").
  for (const [productId, need] of needByProduct) {
    let total = 0;
    for (const forLocation of byLocation.values()) total += forLocation.get(productId) ?? 0;
    if (total < need) {
      const name = productNames.get(productId) ?? "An item in your order";
      throw new ConflictError(
        total > 0
          ? `Only ${total} left of "${name}" — you asked for ${need}. Please adjust your cart.`
          : `"${name}" is out of stock. Please remove it from your cart.`
      );
    }
  }

  const nearness = (locationId: string) =>
    prefixLength(locationPincodes.get(locationId) ?? "", destinationPincode);
  const totalStockAt = (forLocation: Map<string, number>) =>
    [...forLocation.values()].reduce((sum, quantity) => sum + quantity, 0);

  // Fewest parcels: if one location covers everything, it is one parcel — nearest wins.
  const covering = [...byLocation.entries()].filter(([, forLocation]) =>
    [...needByProduct.entries()].every(([productId, need]) => (forLocation.get(productId) ?? 0) >= need)
  );
  if (covering.length > 0) {
    covering.sort(([idA, a], [idB, b]) => {
      const near = nearness(idB) - nearness(idA);
      if (near !== 0) return near;
      const stock = totalStockAt(b) - totalStockAt(a);
      if (stock !== 0) return stock;
      return idA < idB ? -1 : 1;
    });
    return [{ orgAddressId: covering[0][0], lines: [...lines] }];
  }

  // No single cover: greedily take from the location that clears the most remaining
  // units (ties: nearest, then id), splitting variant lines in order.
  const remainingByLine = lines.map((line) => ({ ...line }));
  const remainingByProduct = new Map(needByProduct);
  const parcels: AllocatedParcel[] = [];

  while ([...remainingByProduct.values()].some((need) => need > 0)) {
    let best: { id: string; units: number } | null = null;
    for (const [id, forLocation] of byLocation) {
      let units = 0;
      for (const [productId, need] of remainingByProduct) {
        units += Math.min(need, forLocation.get(productId) ?? 0);
      }
      if (units === 0) continue;
      if (
        !best ||
        units > best.units ||
        (units === best.units && nearness(id) > nearness(best.id)) ||
        (units === best.units && nearness(id) === nearness(best.id) && id < best.id)
      ) {
        best = { id, units };
      }
    }
    // The pre-check above guarantees coverage; this is a belt against a logic error.
    if (!best) throw new ConflictError("Stock changed while you were checking out. Please try again.");

    const forLocation = byLocation.get(best.id) as Map<string, number>;
    const parcelLines: AllocationLine[] = [];
    for (const line of remainingByLine) {
      if (line.quantity === 0) continue;
      const available = forLocation.get(line.productId) ?? 0;
      if (available === 0) continue;
      const take = Math.min(line.quantity, available);
      parcelLines.push({ ...line, quantity: take });
      line.quantity -= take;
      forLocation.set(line.productId, available - take);
      remainingByProduct.set(line.productId, (remainingByProduct.get(line.productId) ?? 0) - take);
    }
    parcels.push({ orgAddressId: best.id, lines: parcelLines });
  }

  return parcels;
}

/**
 * Allocate a whole basket: lines grouped per org (a parcel's org is its location's
 * org by construction), each org allocated independently. Used identically by the
 * checkout preview endpoint and inside the order transaction — same function, so
 * what the customer saw is what gets decremented.
 */
export function allocateAcrossOrgs(
  lines: AllocationLine[],
  productOrgs: Map<string, string>,
  availability: LocationAvailability[],
  locationPincodes: Map<string, string>,
  destinationPincode: string,
  productNames: Map<string, string> = new Map()
): AllocatedParcel[] {
  const linesByOrg = new Map<string, AllocationLine[]>();
  for (const line of lines) {
    const orgId = productOrgs.get(line.productId);
    if (!orgId) continue; // caller already refused unknown products
    const forOrg = linesByOrg.get(orgId) ?? [];
    forOrg.push(line);
    linesByOrg.set(orgId, forOrg);
  }
  return [...linesByOrg.values()].flatMap((orgLines) => {
    const orgProductIds = new Set(orgLines.map((line) => line.productId));
    return allocateForOrg(
      orgLines,
      availability.filter((row) => orgProductIds.has(row.productId)),
      locationPincodes,
      destinationPincode,
      productNames
    );
  });
}

/**
 * The reservation plan: one guarded decrement per (product, location), merged across
 * parcels (two decrements of one row would double-check a changed number) and sorted
 * so concurrent orders lock rows in the same sequence (ADR-0007's deadlock lesson,
 * carried over from the Product.stock era).
 */
export function reservationPlan(
  parcels: AllocatedParcel[]
): Array<{ productId: string; orgAddressId: string; quantity: number }> {
  const merged = new Map<string, { productId: string; orgAddressId: string; quantity: number }>();
  for (const parcel of parcels) {
    for (const line of parcel.lines) {
      const key = `${line.productId}::${parcel.orgAddressId}`;
      const existing = merged.get(key);
      if (existing) existing.quantity += line.quantity;
      else
        merged.set(key, {
          productId: line.productId,
          orgAddressId: parcel.orgAddressId,
          quantity: line.quantity,
        });
    }
  }
  return [...merged.values()].sort((a, b) =>
    a.productId === b.productId
      ? a.orgAddressId.localeCompare(b.orgAddressId)
      : a.productId.localeCompare(b.productId)
  );
}
