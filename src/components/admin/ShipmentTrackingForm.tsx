/**
 * Admin Component: Shipment Tracking Form
 * 
 * Allows admin to manually input tracking details
 * after creating shipment on Shiprocket
 */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Package, Truck, Link as LinkIcon } from 'lucide-react';

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

export function ShipmentTrackingForm({
  shipmentId,
  shipmentCode,
  courierName: initialCourier,
  existingTracking,
  onSuccess,
}: ShipmentTrackingFormProps) {
  const [awb, setAwb] = useState(existingTracking?.trackingNumber || '');
  const [courierName, setCourierName] = useState(initialCourier || '');
  const [trackingUrl, setTrackingUrl] = useState(existingTracking?.trackingUrl || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!awb.trim() || !courierName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch(`/api/admin/shipments/${shipmentId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: awb.trim(),
          courierName: courierName.trim(),
          trackingUrl: trackingUrl.trim() || generateTrackingUrl(courierName, awb),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update tracking');
      }

      toast.success('Tracking updated successfully!');
      
      // Call success callback
      onSuccess?.();

    } catch (error) {
      console.error('Failed to update tracking:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update tracking');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-background p-4 rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
        <Package className="w-4 h-4" />
        <span>Update Tracking: {shipmentCode}</span>
      </div>

      {/* AWB Number */}
      <div>
        <label className="block text-sm font-medium text-foreground/80 mb-1">
          AWB / Tracking Number <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={awb}
            onChange={(e) => setAwb(e.target.value)}
            placeholder="Enter AWB from Shiprocket"
            className="w-full px-3 py-2 pl-9 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            required
            disabled={isUpdating}
          />
          <Package className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/70" />
        </div>
      </div>

      {/* Courier Name */}
      <div>
        <label className="block text-sm font-medium text-foreground/80 mb-1">
          Courier Name <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={courierName}
            onChange={(e) => setCourierName(e.target.value)}
            placeholder="e.g., Blue Dart, Delhivery"
            className="w-full px-3 py-2 pl-9 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            required
            disabled={isUpdating}
          />
          <Truck className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/70" />
        </div>
      </div>

      {/* Tracking URL (Optional) */}
      <div>
        <label className="block text-sm font-medium text-foreground/80 mb-1">
          Tracking URL <span className="text-muted-foreground/70 text-xs">(optional)</span>
        </label>
        <div className="relative">
          <input
            type="url"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder="Auto-generated if left empty"
            className="w-full px-3 py-2 pl-9 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isUpdating}
          />
          <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/70" />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isUpdating}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
      >
        {isUpdating ? 'Updating...' : existingTracking ? 'Update Tracking' : 'Add Tracking'}
      </button>
    </form>
  );
}

/**
 * Generate tracking URL based on courier name
 */
function generateTrackingUrl(courier: string, awb: string): string {
  const courierLower = courier.toLowerCase();
  
  const courierUrls: Record<string, string> = {
    'blue dart': `https://www.bluedart.com/tracking/${awb}`,
    'bluedart': `https://www.bluedart.com/tracking/${awb}`,
    'delhivery': `https://www.delhivery.com/track/package/${awb}`,
    'dtdc': `https://www.dtdc.in/tracking/${awb}`,
    'fedex': `https://www.fedex.com/fedextrack/?trknbr=${awb}`,
    'professional': `https://www.tpcindia.com/webtrack.aspx?awbNo=${awb}`,
    'ecom': `https://ecomexpress.in/tracking/?awb_field=${awb}`,
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
