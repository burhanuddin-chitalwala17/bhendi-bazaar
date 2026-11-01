/**
 * What one parcel's share of an order is, in integer paise (order-fulfilment D13, D16; Q11, Q33).
 * Pure: the cancel reads the rows and passes them in, so every rule here is tested without a database.
 *
 * Every split is by cumulative floors: parcel i takes floor(T·cumᵢ/W) − floor(T·cumᵢ₋₁/W), so the
 * shares of all parcels sum to T exactly and a parcel's share never depends on which is cancelled first.
 */

/** Exact parts of `total` by integer `weights`, in their order. Zero weights in total split evenly. */
export function cumulativeFloorShares(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const w = weights.reduce((s, x) => s + x, 0) > 0 ? weights : weights.map(() => 1);
  const sum = w.reduce((s, x) => s + x, 0);
  let cum = 0;
  let before = 0;
  return w.map((x) => {
    cum += x;
    const upTo = Math.floor((total * cum) / sum);
    const share = upTo - before;
    before = upTo;
    return share;
  });
}

export interface ShareLine {
  orderItemId: string;
  quantity: number;
  unitPrice: number;
  discountPaise: number;
  /** Of `discountPaise`, what the shop bore; the platform bore the rest. */
  orgFundedPaise: number;
}

export interface ShareParcel {
  id: string;
  /** Parcels are taken in code order, so a split is the same whichever parcel asks. */
  code: string;
  orgId: string;
  shippingCost: number;
  items: { orderItemId: string; quantity: number }[];
}

export interface ParcelShare {
  /** The parcel's lines at what was paid: gross less their discount share, paise. */
  netItemsPaise: number;
  /** The platform-funded discount on the parcel's lines: the weight its offer budget splits by. */
  platformFundedPaise: number;
}

/**
 * Each parcel's net lines and platform-funded discount. A line split across parcels splits its
 * discount by units, cumulatively in code order, so two parcels of one line sum to the line.
 */
export function parcelShares(lines: readonly ShareLine[], parcels: readonly ShareParcel[]): Map<string, ParcelShare> {
  const byId = new Map(lines.map((l) => [l.orderItemId, l]));
  const unitsBefore = new Map<string, number>();
  const out = new Map<string, ParcelShare>();
  for (const parcel of [...parcels].sort((a, b) => a.code.localeCompare(b.code))) {
    let net = 0;
    let platform = 0;
    for (const item of parcel.items) {
      const line = byId.get(item.orderItemId);
      if (!line || line.quantity <= 0) throw new Error(`Parcel ${parcel.id} carries order item ${item.orderItemId}, absent from its order`);
      const prior = unitsBefore.get(line.orderItemId) ?? 0;
      const upTo = Math.min(prior + item.quantity, line.quantity);
      unitsBefore.set(line.orderItemId, upTo);
      const part = (amount: number) => Math.floor((amount * upTo) / line.quantity) - Math.floor((amount * prior) / line.quantity);
      net += line.unitPrice * (upTo - prior) - part(line.discountPaise);
      platform += part(line.discountPaise - line.orgFundedPaise);
    }
    out.set(parcel.id, { netItemsPaise: net, platformFundedPaise: platform });
  }
  return out;
}

/**
 * What a parcel's refund is owed (Q11): its net lines plus its shipping, capped so the order's
 * refunds never pass what was captured. Never negative; zero means nothing is owed.
 */
export function refundOwedPaise(input: { netItemsPaise: number; shippingCost: number; grandTotal: number; alreadyOwedPaise: number }): number {
  const room = input.grandTotal - input.alreadyOwedPaise;
  return Math.max(0, Math.min(input.netItemsPaise + input.shippingCost, room));
}

/**
 * One parcel's share of each offer's budget charge on its shop (Q33): the charge split over that
 * shop's parcels of the order by their platform-funded paise. Answers promotionId → paise, zeros left out.
 */
export function budgetSharesFor(
  parcelId: string,
  charges: readonly { promotionId: string; orgId: string; budgetChargedPaise: number }[],
  parcels: readonly ShareParcel[],
  shares: Map<string, ParcelShare>,
): Map<string, number> {
  const out = new Map<string, number>();
  const parcel = parcels.find((p) => p.id === parcelId);
  if (!parcel) return out;
  const siblings = parcels.filter((p) => p.orgId === parcel.orgId).sort((a, b) => a.code.localeCompare(b.code));
  const at = siblings.findIndex((p) => p.id === parcelId);
  for (const charge of charges) {
    if (charge.orgId !== parcel.orgId || charge.budgetChargedPaise <= 0) continue;
    const split = cumulativeFloorShares(
      charge.budgetChargedPaise,
      siblings.map((p) => shares.get(p.id)?.platformFundedPaise ?? 0),
    );
    if (split[at] > 0) out.set(charge.promotionId, (out.get(charge.promotionId) ?? 0) + split[at]);
  }
  return out;
}
