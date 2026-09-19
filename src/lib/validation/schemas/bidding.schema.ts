/**
 * What a bidding form may say (Invariant 4, ADR-0013).
 *
 * One schema per surface, used by the form for inline validation and by the handler for
 * enforcement, so what a person sees cannot drift from what the server accepts.
 *
 * Server-owned fields are absent rather than optional. `slug` is generated, and a
 * body-supplied one would let a caller choose another event's link. `orgId` comes from
 * the route, never the body — a body-supplied one is how an organisation would open an
 * event on someone else's goods. `startingBidPaise`, `highestBidPaise` and every other
 * paise column are absent too: rupees arrive here and the service converts once
 * (ADR-0004).
 */

import { z } from "zod";
import { rupeeAmount, emailSchema, phoneSchema, nameSchema } from "./common.schemas";

/**
 * The quick-bid buttons an organisation sets (spec R5).
 *
 * Capped at four because they are thumb targets on a phone, and the smallest of them
 * also floors a custom increase — so a long list of them stops being a convenience and
 * starts being a rule nobody can see.
 */
const quickBidsSchema = z
  .array(rupeeAmount("Quick-bid amount"))
  .min(1, "Add at least one quick-bid button")
  .max(4, "Four quick-bid buttons is the most that fits on a phone");

/**
 * The longest an event may run, counted from when it opens.
 *
 * Exported because the form's date picker caps itself with the same number — a bound a
 * person can pick past and only fails on submit is the drift ADR-0013 exists to stop.
 */
export const MAX_BIDDING_DAYS = 10;
const MAX_BIDDING_MS = MAX_BIDDING_DAYS * 24 * 60 * 60 * 1000;

export const biddingFormSchema = z
  .object({
    productId: z.string().min(1, "Choose the product being auctioned"),

    /** Which item, where the product has options (spec R1a). */
    size: z.string().trim().min(1).optional(),
    color: z.string().trim().min(1).optional(),

    startAt: z.coerce.date(),
    endAt: z.coerce.date(),

    startingBid: rupeeAmount("Starting bid"),
    maxIncrease: rupeeAmount("Maximum increase"),
    quickBids: quickBidsSchema,
  })
  .refine((d) => d.endAt > d.startAt, {
    message: "Bidding must end after it starts",
    path: ["endAt"],
  })
  // A window that has already closed would open and end in the same instant, so the
  // event could never take a bid.
  .refine((d) => d.endAt > new Date(), {
    message: "Bidding cannot end in the past",
    path: ["endAt"],
  })
  .refine((d) => d.endAt.getTime() - d.startAt.getTime() <= MAX_BIDDING_MS, {
    message: `Bidding can run for at most ${MAX_BIDDING_DAYS} days from when it opens`,
    path: ["endAt"],
  })
  .refine((d) => d.maxIncrease >= Math.min(...d.quickBids), {
    message: "The most someone may add cannot be less than your smallest quick-bid button",
    path: ["maxIncrease"],
  });

export type BiddingFormInput = z.infer<typeof biddingFormSchema>;

/**
 * A bid as the page sends it (spec R22/R24).
 *
 * `amount` is in rupees and `expectedHighestBid` in paise, which looks inconsistent and
 * is not: the amount is a figure a person entered, and the expectation is a value the
 * server handed the page to hand back. Converting the latter would lose the exactness
 * that makes the comparison meaningful.
 *
 * Guest details are shaped so the database check has a counterpart the form can show:
 * a name and a number together, or neither because the bidder is signed in.
 */
export const placeBidSchema = z.object({
  amount: rupeeAmount("Bid"),
  expectedHighestBid: z.number().int().nullable(),

  guestName: nameSchema.optional(),
  guestPhone: phoneSchema.optional(),
  /**
   * Optional by decision, not by oversight. A bidder who gives none cannot be told
   * they were outbid, which the form discloses at the point of choosing (spec R22a).
   */
  guestEmail: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    emailSchema.optional()
  ),
});

export type PlaceBidInputBody = z.infer<typeof placeBidSchema>;

/** Recording what an item actually sold for (spec R40/R43). */
export const confirmSaleSchema = z.object({
  bidId: z.string().min(1, "Choose which bidder bought it"),
  amount: rupeeAmount("Sale amount"),
  orgAddressId: z.string().min(1, "Choose which location the unit comes from"),
  /**
   * Required only when the amount differs from the bid — enforced at the service,
   * which is the only place that knows what the bid was.
   */
  reason: z.string().trim().max(500).optional(),
});

export type ConfirmSaleBody = z.infer<typeof confirmSaleSchema>;

export const markUnsoldSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type MarkUnsoldBody = z.infer<typeof markUnsoldSchema>;
