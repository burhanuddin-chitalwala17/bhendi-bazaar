import type { ShippingGroup } from "@/domain/shipping";

export interface StepErrors {
  address: string | null;
  delivery: string | null;
}

/** What still stops Pay, by the step that fixes it. Shown only after Pay is tapped (design-system Q20). */
export function checkoutStepErrors({
  hasAddress,
  shippingLoading,
  groups,
  allocationError = null,
}: {
  hasAddress: boolean;
  /** The server could not split the bag into parcels for this address; it says why. */
  allocationError?: string | null;
  shippingLoading: boolean;
  groups: Pick<ShippingGroup, "selectedRate">[];
}): StepErrors {
  if (!hasAddress) return { address: "Add where we should deliver.", delivery: null };
  if (allocationError) return { address: null, delivery: allocationError };
  if (shippingLoading || groups.length === 0) return { address: null, delivery: "Still working out delivery — try Pay again in a moment." };
  const unchosen = groups.filter((group) => !group.selectedRate).length;
  if (unchosen > 0) {
    return { address: null, delivery: unchosen === 1 ? "Choose delivery for your parcel." : `Choose delivery for ${unchosen} parcels.` };
  }
  return { address: null, delivery: null };
}
