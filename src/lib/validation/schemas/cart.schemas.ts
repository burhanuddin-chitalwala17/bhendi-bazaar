import { z } from 'zod';
import { priceSchema, quantitySchema } from "./common.schemas";

// Cart item schema - matches client-side CartItem type
const cartItemSchema = z.object({
  id: z.string(),
  productId: z.string().min(1),
  productName: z.string().min(1).max(255),
  productSlug: z.string().min(1).max(255),
  thumbnail: z.string().url().max(2048),
  price: priceSchema,
  salePrice: priceSchema.nullable().optional(),
  quantity: quantitySchema,
  size: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
});

// Update cart schema
export const updateCartSchema = z.object({
  items: z
    .array(cartItemSchema)
    .max(100, "Cart cannot contain more than 100 items"),
  /** The version this write is based on. Stale → 409, never a silent overwrite (R7). */
  version: z.number().int().positive().optional(),
});

export type UpdateCartInput = z.infer<typeof updateCartSchema>;

// Stock check schema
export const stockCheckSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: quantitySchema,
      })
    )
    .min(1, "At least one item required")
    .max(100),
});

export type StockCheckInput = z.infer<typeof stockCheckSchema>;

