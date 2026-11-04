import { z } from "zod";
import { teamReasonField } from "./product.schema";
import {
  BULK_ACTION,
  BULK_PRICE_MODE,
  MAX_BULK_PRODUCTS,
  MAX_PRICE_PAISE,
} from "@server/catalog/product-bulk.types";
import { MARKETPLACE_CHANNELS } from "@server/channels/channel-connection.types";
import { STOCK_MAX } from "./product.schema";

/**
 * A bulk action on selected products (design-system Q29), one shape per action. Every object is
 * strict: a server-owned field (a computed price per product, `archivedAt`, `version`, `orgId`,
 * `slug`) is refused by name rather than dropped quietly (Invariant 4). Money is integer paise.
 */

const TOO_MANY = `Choose up to ${MAX_BULK_PRODUCTS} products at a time`;

const productIds = z
  .array(z.string().trim().min(1))
  .min(1, "Choose at least one product")
  .max(MAX_BULK_PRODUCTS, TOO_MANY)
  .refine((ids) => new Set(ids).size === ids.length, { message: "Each product may appear only once" });

const paise = z.number().int("Amounts cross the wire as integer paise");

const priceChange = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal(BULK_PRICE_MODE.SET), pricePaise: paise.min(1, "Price must be greater than 0").max(MAX_PRICE_PAISE, "Price exceeds the maximum") }),
  z.strictObject({
    mode: z.literal(BULK_PRICE_MODE.AMOUNT),
    deltaPaise: paise.min(-MAX_PRICE_PAISE).max(MAX_PRICE_PAISE).refine((v) => v !== 0, "Enter an amount to change by"),
  }),
  z.strictObject({
    mode: z.literal(BULK_PRICE_MODE.PERCENT),
    percent: z
      .number()
      .finite()
      .gt(-100, "A price cannot fall by 100% or more")
      .max(1000, "Up to 1000% at a time")
      .refine((v) => v !== 0, "Enter a percentage to change by")
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "A percentage can have at most two decimal places"),
  }),
]);

const stockRows = z
  .array(
    z.strictObject({
      productId: z.string().trim().min(1),
      orgAddressId: z.string().trim().min(1),
      quantity: z.number().int("Stock must be a whole number").min(0, "Stock cannot be negative").max(STOCK_MAX, "That is more stock than one location can hold — check the number"),
      // What the editor saw at that location (0 when it held none): the write is a compare-and-set on it.
      seenQuantity: z.number().int().min(0).max(STOCK_MAX),
    }),
  )
  .min(1, "Choose at least one product")
  .max(MAX_BULK_PRODUCTS, TOO_MANY)
  .refine((rows) => new Set(rows.map((r) => `${r.productId}:${r.orgAddressId}`)).size === rows.length, {
    message: "Each product and location may appear only once",
  });

const actions = {
  price: { action: z.literal(BULK_ACTION.PRICE), productIds, change: priceChange },
  stock: { action: z.literal(BULK_ACTION.STOCK), rows: stockRows },
  archive: { action: z.literal(BULK_ACTION.ARCHIVE), productIds },
  send: { action: z.literal(BULK_ACTION.SEND), productIds, channel: z.enum(MARKETPLACE_CHANNELS) },
};

/** A shop member's bulk action: its own products, by the org in the path. */
export const bulkProductActionSchema = z.discriminatedUnion("action", [
  z.strictObject(actions.price),
  z.strictObject(actions.stock),
  z.strictObject(actions.archive),
  z.strictObject(actions.send),
]);

/** The team's: the same, with the reason the shop will read (product-form D11, Q22). */
export const teamBulkProductActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ ...actions.price, reason: teamReasonField }),
  z.strictObject({ ...actions.stock, reason: teamReasonField }),
  z.strictObject({ ...actions.archive, reason: teamReasonField }),
  z.strictObject({ ...actions.send, reason: teamReasonField }),
]);

export type BulkProductActionInput = z.infer<typeof bulkProductActionSchema>;
export type TeamBulkProductActionInput = z.infer<typeof teamBulkProductActionSchema>;
