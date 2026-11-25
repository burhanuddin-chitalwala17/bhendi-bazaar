import { z } from "zod";
import type { CartItem } from "@server/cart/cart.types";

/** Where a link was made (checkout-links Q3). Mirrors the `CheckoutLinkSource` enum. */
export const CHECKOUT_LINK_SOURCE = {
  INBOX_ORDER: "INBOX_ORDER",
  AUTOMATIC: "AUTOMATIC",
  CAMPAIGN: "CAMPAIGN",
} as const;
export type CheckoutLinkSource = (typeof CHECKOUT_LINK_SOURCE)[keyof typeof CHECKOUT_LINK_SOURCE];

/** How long a link works (Q1). */
export const CHECKOUT_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * What inbox, automations and campaigns hand `checkoutLinkService.create` (the [CONTRACT] DTO).
 * Products and quantities only: a price here would be a price someone could set (Invariant 1).
 */
export const createCheckoutLinkInput = z.object({
  orgId: z.string().min(1),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(20),
  source: z.enum([CHECKOUT_LINK_SOURCE.INBOX_ORDER, CHECKOUT_LINK_SOURCE.AUTOMATIC, CHECKOUT_LINK_SOURCE.CAMPAIGN]),
  sourceRef: z.string().max(200).optional(),
});
export type CreateCheckoutLinkInput = z.infer<typeof createCheckoutLinkInput>;

export interface CheckoutLinkItem {
  productId: string;
  quantity: number;
}

export interface CreatedCheckoutLink {
  id: string;
  token: string;
  /** Absolute, ready to send in a chat. */
  url: string;
  expiresAt: Date;
}

/** What a `/c/<shop>/<token>` address resolves to before anything is added. */
export type CheckoutLinkResolution =
  | { kind: "unknown" }
  /** The first product's slug, for its page and the expired line; null when it is gone. */
  | { kind: "expired"; productSlug: string | null }
  | { kind: "live"; linkId: string };

/** A link item that was not added, by name (R4). */
export interface LeftOutItem {
  productId: string;
  productName: string;
}

/** The result of opening a link for one cart. */
export type OpenCheckoutLinkResult =
  | { kind: "unknown" }
  | { kind: "expired"; productSlug: string | null }
  | {
      kind: "opened";
      linkId: string;
      /** This cart had opened it before: `lines` is empty, nothing is added again (R3). */
      alreadyOpened: boolean;
      /** Today's prices, each marked `fromLinkId`. Display only; checkout prices the order. */
      lines: CartItem[];
      leftOut: LeftOutItem[];
    };
