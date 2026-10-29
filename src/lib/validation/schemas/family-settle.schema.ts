import { z } from "zod";
import { rupeeAmount } from "./common.schemas";

const id = z.string().min(1).max(64);

/**
 * "Make family of n" (family-merge D3). Names listings and the owner's choices only: what each
 * member is, and what the family shares, is planned again on the server from what it read. Prices
 * are in rupees, as the product form sends them.
 */
export const familySettleSchema = z.object({
  listingIds: z.array(id).min(1).max(30),
  familyId: id.optional(),
  name: z.string().trim().min(1, "Give the family a name.").max(250),
  description: z.string().max(5000).default(""),
  categoryId: id.optional(),
  removedAxes: z.array(z.string().min(1).max(60)).max(6).default([]),
  answers: z
    .record(z.string().min(1).max(64), z.record(z.string().min(1).max(60), z.string().min(1).max(120)))
    .refine((a) => Object.keys(a).length <= 31, "Too many answers.")
    .default({}),
  members: z
    .array(
      z.object({
        listingId: id,
        include: z.boolean().default(true),
        move: z.boolean().default(false),
        sku: z.string().trim().min(1, "Enter a SKU.").max(64).optional(),
        price: rupeeAmount("Price").optional(),
        stock: z
          .array(z.object({ locationId: id, quantity: z.number().int().min(0, "Stock can't be below zero.").max(1_000_000) }))
          .max(50)
          .default([]),
      }),
    )
    .max(30),
});

export type FamilySettleFormValues = z.input<typeof familySettleSchema>;

/** "Not one item" on a Flipkart suggestion (family-merge Q21). */
export const dismissGroupSchema = z.object({ listingIds: z.array(id).min(2).max(30) });
