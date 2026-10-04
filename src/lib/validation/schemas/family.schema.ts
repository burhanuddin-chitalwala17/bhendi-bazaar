import { z } from "zod";

/**
 * What a shop may say when making a family
 * ([variants](../../../../docs/specs/listing-vocabulary/variants/) R2).
 *
 * `productType` and `variantAxis` are absent deliberately: both are resolved from the category
 * when the family is made, so accepting either would let a payload group products by a fact
 * their type never asks about (Invariant 4). `orgId` is absent too — it comes from the verified
 * membership.
 */
export const createFamilySchema = z.object({
  name: z.string().trim().min(2, "Give the family a name").max(120),
  description: z.string().trim().max(5000).nullable().optional(),
  categoryId: z.string().trim().min(1, "Choose a category"),
});

export const updateFamilySchema = z.object({
  name: z.string().trim().min(2, "Give the family a name").max(120).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;
