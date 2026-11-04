import { z } from "zod";

import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
/** An unknown value is ignored, never an error: the URL is typed by people (Invariant 4). */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(first, z.enum(values).optional().catch(undefined));

const ORDER_STATUSES = Object.values(ORDER_STATUS) as [string, ...string[]];
const PAYMENT_STATUSES = Object.values(PAYMENT_STATUS) as [string, ...string[]];
export const ORDER_LIST_SORTS = ["createdAt", "updatedAt", "total"] as const;

/**
 * The admin orders view as its URL states it: what the list shows and what Export CSV writes are
 * read by this one schema, so the file can never hold a different set from the screen (design-system Q37).
 */
export const adminOrderViewSchema = z.object({
  search: z.preprocess(first, z.string().trim().max(100).optional().catch(undefined)),
  status: optionalEnum(ORDER_STATUSES),
  paymentStatus: optionalEnum(PAYMENT_STATUSES),
  sortBy: z.preprocess(first, z.enum(ORDER_LIST_SORTS).catch("createdAt")),
  sortOrder: z.preprocess(first, z.enum(["asc", "desc"]).catch("desc")),
});
export type AdminOrderView = z.infer<typeof adminOrderViewSchema>;

/** The order the side panel shows (`?order=`, Q36): an id's shape, or nothing. */
export const orderPeekSchema = z.preprocess(first, z.string().regex(/^[a-z0-9]{8,40}$/i).optional().catch(undefined));
