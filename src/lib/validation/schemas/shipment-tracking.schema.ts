import { z } from "zod";

/** The tracking an admin copies in after booking the shipment with the carrier by hand. */
export const updateTrackingSchema = z.object({
  trackingNumber: z.string().min(5, "AWB/Tracking number is required"),
  courierName: z.string().min(2, "Courier name is required"),
  trackingUrl: z.string().url("Invalid tracking URL").optional(),
});

export type UpdateTrackingInput = z.infer<typeof updateTrackingSchema>;
