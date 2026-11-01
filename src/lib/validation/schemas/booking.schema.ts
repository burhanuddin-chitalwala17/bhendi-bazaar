import { z } from "zod";
import { isLabelLink } from "@server/shipping/label";
import { indiaToday } from "@server/shared/india-time";

/** Copy exactly as order-fulfilment ux.md "admin book pickup" and "admin change pickup date" sign it off. */
export const BOOKING_ERRORS = {
  pickupDate: "Enter the pickup date.",
  deliveryDate: "Enter the delivery date.",
  deliveryAfterPickup: "Delivery date must be after the pickup date.",
  courier: "Enter the courier.",
  awb: "Enter the AWB from Shiprocket.",
  trackingLink: "Tracking link must start with https://",
  labelLink: "Label link must be the link Shiprocket gives you.",
  pickupPast: "Pickup date can't be in the past.",
} as const;

/** A real calendar day as "YYYY-MM-DD", what `<input type="date">` gives; "2026-02-30" is refused, not rolled over. */
const day = (message: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((v) => {
      const at = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(at.getTime()) && at.toISOString().startsWith(v);
    }, message);

const httpsLink = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https:\/\/[^\s]+$/.test(v), BOOKING_ERRORS.trackingLink);

/** Dates compare as strings: "YYYY-MM-DD" sorts as the days do. */
const deliveryAfterPickup = <T extends { pickupDate: string; estimatedDelivery: string }>(v: T) =>
  v.estimatedDelivery > v.pickupDate;

/** The admin's hand booking (spec R5, Q23; TRD D11). Six fields, all required. */
export const bookingSchema = z
  .object({
    pickupDate: day(BOOKING_ERRORS.pickupDate),
    estimatedDelivery: day(BOOKING_ERRORS.deliveryDate),
    courierName: z.string().trim().min(1, BOOKING_ERRORS.courier).max(80),
    trackingNumber: z.string().trim().min(1, BOOKING_ERRORS.awb).max(40),
    trackingUrl: httpsLink,
    labelUrl: z.string().trim().max(2000).refine(isLabelLink, BOOKING_ERRORS.labelLink),
  })
  .refine(deliveryAfterPickup, { path: ["estimatedDelivery"], message: BOOKING_ERRORS.deliveryAfterPickup });
export type BookingInput = z.infer<typeof bookingSchema>;

/**
 * A booked parcel's dates moved (D11): compare-and-set on `seenPickupDate`, the date the admin's
 * panel opened with, so a change made meanwhile by someone else is refused, not overwritten.
 */
export const pickupDateChangeSchema = z
  .object({
    pickupDate: day(BOOKING_ERRORS.pickupDate).refine((v) => v >= indiaToday(), BOOKING_ERRORS.pickupPast),
    estimatedDelivery: day(BOOKING_ERRORS.deliveryDate),
    seenPickupDate: day(BOOKING_ERRORS.pickupDate),
  })
  .refine(deliveryAfterPickup, { path: ["estimatedDelivery"], message: BOOKING_ERRORS.deliveryAfterPickup });
export type PickupDateChangeInput = z.infer<typeof pickupDateChangeSchema>;
