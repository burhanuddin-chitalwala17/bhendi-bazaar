import { z } from 'zod';
import { uuidSchema, priceSchema, quantitySchema, nameSchema, emailSchema, phoneSchema, postalCodeSchema } from './common.schemas';

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
  price: priceSchema,
  salePrice: priceSchema.optional(),
  quantity: quantitySchema,
  size: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
});

// Shipping method schema
const shippingMethodSchema = z.object({
  providerId: z.string(),
  courierName: z.string(),
  shippingCost: z.number().min(0),
  estimatedDays: z.number().int().min(0),
  mode: z.string(),
  packageWeight: z.number().min(0).optional(),
}).optional();

// Order totals schema
const orderTotalsSchema = z.object({
  subtotal: priceSchema,
  discount: z.number().min(0).max(1000000),
  shipping: z.number().min(0).optional(),
  total: priceSchema,
});

// Create order schema
export const createOrderSchema = z
  .object({
    items: z
      .array(cartItemSchema)
      .min(1, "Order must contain at least one item")
      .max(100, "Order cannot contain more than 100 items"),
    totals: orderTotalsSchema,
    address: orderAddressSchema,
    shipping: shippingMethodSchema,
    notes: z.string().max(1000, "Notes too long").optional(),
    paymentMethod: z.enum(["razorpay"]).optional(),
    paymentStatus: z.enum(["pending", "paid", "failed"]).optional(),
    userId: uuidSchema.optional(),
  })
  .refine(
    (data) => {
      // Validate totals match items + shipping
      const calculatedSubtotal = data.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const shippingCost = data.totals.shipping || 0;
      const expectedTotal =
        calculatedSubtotal - data.totals.discount + shippingCost;
      return Math.abs(expectedTotal - data.totals.total) < 0.01;
    },
    { message: "Order totals do not match items", path: ["totals"] }
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

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

// Shipment item schema (simpler than cart item - no cart-specific fields)
const shipmentItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1).max(255),
  productSlug: z.string().min(1).max(255),
  thumbnail: z.string().url().max(2048),
  price: priceSchema,
  salePrice: priceSchema.optional(),
  quantity: quantitySchema,
});

// Selected shipping rate schema
const selectedRateSchema = z.object({
  providerId: z.string().min(1, "Provider ID required"),
  providerName: z.string().min(1, "Provider name required"),
  courierName: z.string().min(1, "Courier name required"),
  courierCode: z.string().optional(),
  rate: z.number().min(0, "Shipping rate cannot be negative"),
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
  totalWeight: z.number().min(0),
  itemsTotal: z.number().min(0),
  selectedRate: selectedRateSchema,
});

// Order totals schema for multi-shipment orders
const orderWithShipmentsTotalsSchema = z.object({
  itemsTotal: priceSchema,
  shippingTotal: z.number().min(0),
  discount: z.number().min(0).max(1000000),
  grandTotal: priceSchema,
});

// Create order with shipments schema
export const createOrderWithShipmentsSchema = z
  .object({
    shippingGroups: z
      .array(shippingGroupSchema)
      .min(1, "Order must contain at least one shipping group")
      .max(10, "Order cannot have more than 10 shipments"),
    totals: orderWithShipmentsTotalsSchema,
    address: orderAddressSchema,
    notes: z.string().max(1000, "Notes too long").optional(),
    paymentMethod: z.enum(["razorpay"]).optional(),
    paymentStatus: z.enum(["pending", "paid", "failed"]).optional(),
    userId: uuidSchema.optional(),
  })
  .refine(
    (data) => {
      // Validate that totals match shipping groups
      const calculatedItemsTotal = data.shippingGroups.reduce(
        (sum, group) => sum + group.itemsTotal,
        0
      );
      const calculatedShippingTotal = data.shippingGroups.reduce(
        (sum, group) => sum + group.selectedRate.rate,
        0
      );
      const expectedGrandTotal =
        calculatedItemsTotal + calculatedShippingTotal - data.totals.discount;

      return (
        Math.abs(calculatedItemsTotal - data.totals.itemsTotal) < 0.01 &&
        Math.abs(calculatedShippingTotal - data.totals.shippingTotal) < 0.01 &&
        Math.abs(expectedGrandTotal - data.totals.grandTotal) < 0.01
      );
    },
    {
      message: "Order totals do not match shipping groups",
      path: ["totals"],
    }
  );

export type CreateOrderWithShipmentsInput = z.infer<typeof createOrderWithShipmentsSchema>;