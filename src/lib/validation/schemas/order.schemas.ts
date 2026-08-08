import { z } from 'zod';
import { uuidSchema, paiseAmount, quantitySchema, nameSchema, emailSchema, phoneSchema, postalCodeSchema } from './common.schemas';

// Order-specific address schema (requires fullName and state)
const orderAddressSchema = z.object({
  id: z.string(),
  fullName: nameSchema,
  mobile: phoneSchema,
  email: emailSchema.optional(),
  addressLine1: z
    .string()
    .min(5, "Address line 1 too short")
    .max(500, "Address line 1 too long"),
  addressLine2: z.string().max(500, "Address line 2 too long").optional(),
  city: z.string().min(2, "City too short").max(100, "City too long"),
  state: z.string().min(2, "State too short").max(100, "State too long"),
  pincode: postalCodeSchema,
  country: z.string().default("India"),
});

// Cart item schema - matches client-side CartItem type
const cartItemSchema = z.object({
  id: z.string(),
  productId: z.string().min(1),
  productName: z.string().min(1).max(255),
  productSlug: z.string().min(1).max(255),
  thumbnail: z.string().url().max(2048),
  price: paiseAmount,
  salePrice: paiseAmount.optional(),
  quantity: quantitySchema,
  size: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
});

// Shipping method schema
const shippingMethodSchema = z.object({
  providerId: z.string(),
  courierName: z.string(),
  shippingCost: z.number().int().min(0), // paise
  estimatedDays: z.number().int().min(0),
  mode: z.string(),
  packageWeight: z.number().min(0).optional(),
}).optional();

// Order totals schema
const orderTotalsSchema = z.object({
  subtotal: paiseAmount,
  discount: z.number().int().min(0), // paise
  shipping: z.number().int().min(0).optional(), // paise
  total: paiseAmount,
});

// The single-shipment create schema is gone with its path (inventory-reservation D5):
// one order-creation path, so the stock guarantee has no weaker sibling.


// Order lookup schema
export const orderLookupSchema = z.object({
  code: z.string().regex(/^BB-\d+/, 'Invalid order code format'),
});

export type OrderLookupInput = z.infer<typeof orderLookupSchema>;

// Update order schema
export const updateOrderSchema = z.object({
  status: z.enum(['processing', 'packed', 'shipped', 'delivered']).optional(),
  paymentMethod: z.enum(['razorpay']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed']).optional(),
  paymentId: z.string().optional(),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
});

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

// ============================================
// NEW: Multi-Shipment Order Schemas
// ============================================

// What a checkout line is allowed to say about itself: which product, how many.
// Names, thumbnails and every rupee figure are priced server-side from the catalogue
// (Invariant 1) — the fields were removed rather than accepted-and-ignored, because a
// field that is present but ignored is eventually read by someone (trd.md D2).
const shipmentItemSchema = z.object({
  productId: z.string().min(1),
  quantity: quantitySchema,
  // The chosen variant (order-and-cart-lines D5). Optional — validated against the
  // product's declared options server-side, where the catalogue row is in hand.
  size: z.string().trim().min(1).max(50).optional(),
  color: z.string().trim().min(1).max(50).optional(),
});

// Selected shipping rate schema
const selectedRateSchema = z.object({
  providerId: z.string().min(1, "Provider ID required"),
  providerName: z.string().min(1, "Provider name required"),
  courierName: z.string().min(1, "Courier name required"),
  courierCode: z.string().optional(),
  rate: z.number().int().min(0, "Shipping rate cannot be negative"), // paise
  estimatedDays: z.number().int().min(0),
  mode: z.string().min(1),
  etd: z.string().optional(),
});

// Shipping group schema
const shippingGroupSchema = z.object({
  groupId: z.string().min(1),
  orgId: z.string().min(1),
  orgName: z.string().min(1),
  fromPincode: postalCodeSchema,
  fromCity: z.string().min(2).max(100),
  fromState: z.string().min(2).max(100),
  items: z.array(shipmentItemSchema).min(1, "Group must have at least one item"),
  selectedRate: selectedRateSchema,
});

// Create order with shipments schema. No totals object and no consistency refine:
// once the server computes the totals there is nothing for the client's numbers to
// check (trd.md D3). `paymentStatus` is gone too — it is server-owned (Invariant 2).
export const createOrderWithShipmentsSchema = z.object({
  shippingGroups: z
    .array(shippingGroupSchema)
    .min(1, "Order must contain at least one shipping group")
    .max(10, "Order cannot have more than 10 shipments"),
  /** The grand total the customer saw, compared against the server's own — never persisted. */
  displayedGrandTotal: paiseAmount,
  address: orderAddressSchema,
  notes: z.string().max(1000, "Notes too long").optional(),
  paymentMethod: z.enum(["razorpay"]).optional(),
  userId: uuidSchema.optional(),
});

export type CreateOrderWithShipmentsInput = z.infer<typeof createOrderWithShipmentsSchema>;