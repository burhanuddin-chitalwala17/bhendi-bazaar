/**
 * Admin Component: Shipment Tracking Form
 *
 * Allows admin to manually input tracking details
 * after creating shipment on Shiprocket
 */

"use client";

import { useId } from "react";
import { Package, Truck, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useServerForm } from "@/hooks/core/useServerForm";
import { shipmentTrackingApiClient } from "@/components/shipping/shipmentTrackingApiClient";
import {
  updateTrackingSchema,
  type UpdateTrackingInput,
} from "@/lib/validation/schemas/shipment-tracking.schema";

interface ShipmentTrackingFormProps {
  shipmentId: string;
  shipmentCode: string;
  courierName?: string;
  existingTracking?: {
    trackingNumber: string;
    trackingUrl: string;
  };
  onSuccess?: () => void;
}

// A cleared box is "no URL" rather than an invalid one, so the derived link can stand in.
const trimmed = (value: string) => value.trim();
const optional = (value: string) => value.trim() || undefined;

export function ShipmentTrackingForm({
  shipmentId,
  shipmentCode,
  courierName: initialCourier,
  existingTracking,
  onSuccess,
}: ShipmentTrackingFormProps) {
  const id = useId();
  const {
    register,
    onSubmit,
    formState: { errors, isSubmitting: isUpdating },
  } = useServerForm<UpdateTrackingInput>({
    schema: updateTrackingSchema,
    defaultValues: {
      trackingNumber: existingTracking?.trackingNumber || "",
      courierName: initialCourier || "",
      trackingUrl: existingTracking?.trackingUrl || undefined,
    },
    submit: (data) =>
      shipmentTrackingApiClient.updateTracking(shipmentId, {
        ...data,
        trackingUrl: data.trackingUrl || generateTrackingUrl(data.courierName, data.trackingNumber),
      }),
    successMessage: "Tracking updated successfully!",
    fallbackMessage: "Failed to update tracking",
    onSuccess: () => onSuccess?.(),
  });

  return (
    <form
      onSubmit={(event) => void onSubmit(event).catch(() => {})}
      className="space-y-4 bg-background p-4 rounded-lg border border-border"
    >
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
        <Package className="w-4 h-4" />
        <span>Update Tracking: {shipmentCode}</span>
      </div>

      {/* AWB Number */}
      <div>
        <Label htmlFor={`${id}-trackingNumber`}>
          AWB / Tracking Number <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id={`${id}-trackingNumber`}
            type="text"
            {...register("trackingNumber", { setValueAs: trimmed })}
            placeholder="Enter AWB from Shiprocket"
            className="w-full pl-9"
            required
            disabled={isUpdating}
          />
          <Package className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/70" />
        </div>
        {errors.trackingNumber && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {errors.trackingNumber.message}
          </p>
        )}
      </div>

      {/* Courier Name */}
      <div>
        <Label htmlFor={`${id}-courierName`}>
          Courier Name <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id={`${id}-courierName`}
            type="text"
            {...register("courierName", { setValueAs: trimmed })}
            placeholder="e.g., Blue Dart, Delhivery"
            className="w-full pl-9"
            required
            disabled={isUpdating}
          />
          <Truck className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/70" />
        </div>
        {errors.courierName && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {errors.courierName.message}
          </p>
        )}
      </div>

      {/* Tracking URL (Optional) */}
      <div>
        <Label htmlFor={`${id}-trackingUrl`}>
          Tracking URL{" "}
          <span className="text-muted-foreground/70 text-xs">(optional)</span>
        </Label>
        <div className="relative">
          <Input
            id={`${id}-trackingUrl`}
            type="url"
            {...register("trackingUrl", { setValueAs: optional })}
            placeholder="Auto-generated if left empty"
            className="w-full pl-9"
            disabled={isUpdating}
          />
          <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/70" />
        </div>
        {errors.trackingUrl && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {errors.trackingUrl.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" disabled={isUpdating} className="w-full">
        {isUpdating
          ? "Updating..."
          : existingTracking
            ? "Update Tracking"
            : "Add Tracking"}
      </Button>
    </form>
  );
}

/**
 * Generate tracking URL based on courier name
 */
function generateTrackingUrl(courier: string, awb: string): string {
  const courierLower = courier.toLowerCase();

  const courierUrls: Record<string, string> = {
    "blue dart": `https://www.bluedart.com/tracking/${awb}`,
    bluedart: `https://www.bluedart.com/tracking/${awb}`,
    delhivery: `https://www.delhivery.com/track/package/${awb}`,
    dtdc: `https://www.dtdc.in/tracking/${awb}`,
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${awb}`,
    professional: `https://www.tpcindia.com/webtrack.aspx?awbNo=${awb}`,
    ecom: `https://ecomexpress.in/tracking/?awb_field=${awb}`,
  };

  // Check for partial matches
  for (const [key, url] of Object.entries(courierUrls)) {
    if (courierLower.includes(key)) {
      return url;
    }
  }

  // Default to Shiprocket tracking
  return `https://shiprocket.co/tracking/${awb}`;
}
