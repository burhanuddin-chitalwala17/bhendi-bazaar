"use client";

import { Package, Truck, MapPin, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { formatDeliveryEstimate, getEstimatedDeliveryDate, formatDeliveryDate } from "@/utils/shipping";
import { formatShippingCost } from "@/domain/shipping";
import type { ShippingGroup, ShippingRate } from "@/domain/shipping";

interface MultiShippingSectionProps {
  groups: ShippingGroup[];
  onRateSelect: (groupId: string, rate: ShippingRate) => void;
  isLoading: boolean;
}

export function MultiShippingSection({
  groups,
  onRateSelect,
  isLoading,
}: MultiShippingSectionProps) {
  if (isLoading) {
    // A card-shaped skeleton: the default text bar caused a large layout shift when rates landed.
    return <LoadingSkeleton variant="card" count={2} />;
  }
  
  if (groups.length === 0) {
    return null;
  }
  
  // Show multi-shipment notice if more than one group
  const hasMultipleShipments = groups.length > 1;

  // The figure a customer actually wants for a split order (stock-locations R10/A8):
  // when every parcel has a chosen rate, the order completes with the slowest one.
  const selectedDays = groups.map((group) => group.selectedRate?.estimatedDays);
  const completionDays = selectedDays.every((days) => typeof days === "number")
    ? Math.max(...(selectedDays as number[]))
    : null;
  
  return (
    <div className="space-y-4">
      {/* Multi-shipment notice */}
      {hasMultipleShipments && (
        <div className="rounded-lg bg-info/10 border border-info/30 p-3 text-sm">
          <div className="flex items-start gap-2">
            <Package className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-info">
                Multiple Shipments
              </p>
              <p className="text-info mt-1">
                Your order will arrive in <span className="font-semibold">{groups.length} separate parcels</span> as items ship from different locations.
                {completionDays !== null && (
                  <>
                    {" "}Everything arrives by{" "}
                    <span className="font-semibold">
                      {formatDeliveryDate(getEstimatedDeliveryDate(completionDays))}
                    </span>
                    .
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Shipping groups */}
      <div className="space-y-4">
        {groups.map((group, index) => (
          <ShippingGroupCard
            key={group.groupId}
            group={group}
            groupNumber={index + 1}
            totalGroups={groups.length}
            onRateSelect={(rate) => onRateSelect(group.groupId, rate)}
          />
        ))}
      </div>
    </div>
  );
}

interface ShippingGroupCardProps {
  group: ShippingGroup;
  groupNumber: number;
  totalGroups: number;
  onRateSelect: (rate: ShippingRate) => void;
}

function ShippingGroupCard({
  group,
  groupNumber,
  totalGroups,
  onRateSelect,
}: ShippingGroupCardProps) {
  const showGroupNumber = totalGroups > 1;
  
  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {showGroupNumber && (
            <p className="text-xs font-medium text-muted-foreground">
              Parcel {groupNumber} of {totalGroups}
            </p>
          )}
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            {/* Two warehouses can share a city, so the location's own name leads
                and the city is secondary detail (stock-locations D12). */}
            <p className="text-sm font-medium">
              Ships from{" "}
              {group.locationName
                ? `${group.locationName} (${group.fromCity})`
                : `${group.fromCity}, ${group.fromState}`}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Org: {group.orgName}
          </p>
        </div>
        
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Items</p>
          <p className="text-sm font-semibold">{group.items.length}</p>
          {group.billableWeightKg !== undefined && (
            <p className="text-xs text-muted-foreground">
              billed as {group.billableWeightKg} kg
            </p>
          )}
        </div>
      </div>
      
      {/* Items preview */}
      <div className="text-xs text-muted-foreground">
        {group.items.slice(0, 2).map((item: { id: string; productName: string }, idx: number) => (
          <span key={item.id}>
            {item.productName}
            {idx < Math.min(group.items.length, 2) - 1 ? ", " : ""}
          </span>
        ))}
        {group.items.length > 2 && ` and ${group.items.length - 2} more`}
      </div>
      
      <Separator />
      
      {/* Shipping rates */}
      {group.isLoading ? (
        <div className="py-2">
          <p className="text-sm text-muted-foreground">Loading shipping options...</p>
        </div>
      ) : group.error ? (
        <div className="py-2 text-sm text-destructive">
          {group.error}
        </div>
      ) : !group.serviceable ? (
        <div className="py-2 text-sm text-warning">
          Shipping not available to this location
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Select shipping method:
          </p>
          {group.rates.map((rate) => (
            <button
              key={`${rate.providerId}-${rate.courierCode}`}
              type="button"
              onClick={() => onRateSelect(rate)}
              className={`
                w-full p-3 rounded-lg border-2 transition-all text-left
                ${
                  group.selectedRate?.courierCode === rate.courierCode
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{rate.courierName}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDeliveryEstimate(rate.estimatedDays)}
                    </span>
                    {rate.mode && (
                      <span className="px-1.5 py-0.5 rounded bg-muted">
                        {rate.mode}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {formatShippingCost(rate.rate)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
