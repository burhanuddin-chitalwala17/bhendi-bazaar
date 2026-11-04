"use client";

import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import {
  formatDeliveryEstimate,
  getEstimatedDeliveryDate,
  formatDeliveryDate,
} from "@/utils/shipping";
import { formatShippingCost } from "@/domain/shipping";
import type { ShippingGroup, ShippingRate } from "@/domain/shipping";
import { Button } from "@/components/ui/button";
import { SHIPPING_COPY } from "../checkout-copy";

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
  const allChosen = selectedDays.every((days) => {
    return typeof days === "number";
  });
  const completionDays = allChosen ? Math.max(...(selectedDays as number[])) : null;

  return (
    <div className="space-y-4">
      {/* Multi-shipment notice */}
      {hasMultipleShipments && (
        <div className="rounded-field border border-border bg-muted p-3 text-small">
          <div className="flex items-start gap-2">
            <Icon name="parcel" size="sm" tone="primary" className="mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{SHIPPING_COPY.parcels(groups.length)}</p>
              <p className="mt-1 text-muted-foreground">
                {SHIPPING_COPY.arriveIn}{" "}
                <span className="font-semibold">
                  {SHIPPING_COPY.separateParcels(groups.length)}
                </span>{" "}
                {SHIPPING_COPY.differentLocations}
                {completionDays !== null && (
                  <>
                    {" "}
                    {SHIPPING_COPY.everythingBy}{" "}
                    <span className="font-semibold">
                      {formatDeliveryDate(
                        getEstimatedDeliveryDate(completionDays),
                      )}
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
            <p className="text-caption font-medium text-muted-foreground">
              {SHIPPING_COPY.parcelOf(groupNumber, totalGroups)}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Icon name="shop" size="sm" tone="muted" />
            {/* Two warehouses can share a city, so the location's own name leads
                and the city is secondary detail (stock-locations D12). */}
            <p className="text-small font-medium">
              {SHIPPING_COPY.shipsFrom}{" "}
              {group.locationName
                ? `${group.locationName} (${group.fromCity})`
                : `${group.fromCity}, ${group.fromState}`}
            </p>
          </div>
          <p className="text-caption text-muted-foreground">{SHIPPING_COPY.fromShop(group.orgName)}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-caption text-muted-foreground">{SHIPPING_COPY.items}</p>
          <p className="text-small font-semibold">{group.items.length}</p>
          {group.billableWeightKg !== undefined && (
            <p className="text-caption text-muted-foreground">
              {SHIPPING_COPY.billedAs(group.billableWeightKg)}
            </p>
          )}
        </div>
      </div>

      {/* Items preview */}
      <div className="text-caption text-muted-foreground">
        {group.items
          .slice(0, 2)
          .map((item: { id: string; productName: string }, idx: number) => (
            <span key={item.id}>
              {item.productName}
              {idx < Math.min(group.items.length, 2) - 1 ? ", " : ""}
            </span>
          ))}
        {group.items.length > 2 && SHIPPING_COPY.andMore(group.items.length - 2)}
      </div>

      <Separator />

      {/* Shipping rates */}
      {group.isLoading ? (
        <div className="py-2">
          <p className="text-small text-muted-foreground">{SHIPPING_COPY.working}</p>
        </div>
      ) : group.error ? (
        <div className="py-2 text-small text-destructive">{group.error}</div>
      ) : !group.serviceable ? (
        <div className="py-2 text-small text-warning">
          {SHIPPING_COPY.notServiceable}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-caption font-medium text-muted-foreground">{SHIPPING_COPY.choose}</p>
          {group.rates.map((rate) => (
            <Button
              variant="ghost"
              key={`${rate.providerId}-${rate.courierCode}`}
              type="button"
              onClick={() => onRateSelect(rate)}
              className={`
                h-auto w-full justify-start whitespace-normal p-3 rounded-field border-2 transition-all text-left
                ${
                  group.selectedRate?.courierCode === rate.courierCode
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }
              `}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon name="delivery" size="sm" tone="muted" />
                    <p className="text-small font-medium">{rate.courierName}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-caption text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Icon name="time" size="xs" />
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
                  <p className="text-small font-semibold">
                    {formatShippingCost(rate.rate)}
                  </p>
                </div>
              </div>
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}
