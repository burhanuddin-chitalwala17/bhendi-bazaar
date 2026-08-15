import type { OfferInitialValues } from "@/components/promotions/OfferForm";

/** A stored offer, in the shape the form prefills from. */
export function toInitialValues(offer: {
  label: string;
  trigger: string;
  code: string | null;
  valueType: string;
  percentBps: number | null;
  amountOffPaise: number | null;
  fixedPricePaise: number | null;
  maxDiscountPaise: number | null;
  minSubtotalPaise: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  usageLimit: number | null;
  perUserLimit: number | null;
  targets: Array<{ categoryId: string | null; productId: string | null }>;
}): OfferInitialValues {
  return {
    ...offer,
    trigger: offer.trigger as OfferInitialValues["trigger"],
    valueType: offer.valueType as OfferInitialValues["valueType"],
    categoryIds: offer.targets.flatMap((t) => (t.categoryId ? [t.categoryId] : [])),
    productIds: offer.targets.flatMap((t) => (t.productId ? [t.productId] : [])),
  };
}
