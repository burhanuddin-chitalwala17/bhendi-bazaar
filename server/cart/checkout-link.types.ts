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
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        /** The buyer picks the size among this product's family when opening (D6). */
        pickSize: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(20),
  source: z.enum([CHECKOUT_LINK_SOURCE.INBOX_ORDER, CHECKOUT_LINK_SOURCE.AUTOMATIC, CHECKOUT_LINK_SOURCE.CAMPAIGN]),
  sourceRef: z.string().max(200).optional(),
});
export type CreateCheckoutLinkInput = z.infer<typeof createCheckoutLinkInput>;

export interface CheckoutLinkItem {
  productId: string;
  quantity: number;
  pickSize?: boolean;
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
  | { kind: "live"; linkId: string; sizeSteps: SizeStep[] };

/** One link item whose size the buyer picks before checkout (D6). */
export interface SizeStep {
  /** The link's own item, a member of the family. */
  productId: string;
  /** The family's members on sale with the quantity in stock, named as the product page names them. */
  options: Array<{ productId: string; name: string; thumbnail: string }>;
}

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

/** The lines of one link a checkout holds, as the buyer's device marked them (D4). */
export interface CheckoutLinkNotesRequest {
  linkId: string;
  productIds: string[];
}

/** What checkout says about one link's lines (D4, ux.md state matrix). */
export interface CheckoutLinkNote {
  linkId: string;
  shopName: string;
  shopHandle: string;
  /** Link items neither in this checkout nor addable now: "<item> is out of stock and was left out." */
  leftOut: LeftOutItem[];
  /** A marked line whose price moved since the link was made: "Now ₹x (was ₹y when sent)". Display only. */
  priceChanges: Array<{ productId: string; nowPaise: number; wasPaise: number }>;
}

/** A line of an order being placed that a link added (D5). */
export interface OrderLinkMark {
  linkId: string;
  /** The shop of the product on that line: a link only ever names its own shop's products. */
  orgId: string;
  /** The product on that line: one the link holds, or a size of one it lets the buyer pick. */
  productId: string;
}
