import { z } from 'zod';
import { priceSchema, emailSchema } from './common.schemas';

// Create payment order schema
// The caller names the order; the server derives the amount from it (ADR-0002,
// server-side-pricing-authority D5). An `amount` field here was the ₹1-for-anything
// hole: whatever the client sent was what the gateway charged.
export const createPaymentOrderSchema = z.object({
  localOrderId: z.string().min(1),
  customer: z
    .object({
      name: z.string().max(255).optional(),
      email: z.string().email().optional(),
      contact: z.string().max(20).optional(),
    })
    .optional(),
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;

// Verify payment schema
export const verifyPaymentSchema = z.object({
  localOrderId: z.string().min(1, 'Order reference required'),
  razorpay_order_id: z.string().min(1, 'Order ID required'),
  razorpay_payment_id: z.string().min(1, 'Payment ID required'),
  razorpay_signature: z.string().min(1, 'Signature required'),
});

/** A zero-total order has nothing for a gateway to verify; the server checks the total itself. */
export const confirmFreeOrderSchema = z.object({
  localOrderId: z.string().min(1),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

