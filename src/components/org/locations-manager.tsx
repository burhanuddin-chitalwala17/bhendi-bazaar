"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { useMutation } from "@/hooks/core/useMutation";
import { orgLocationsApiClient } from "@/components/org/orgLocationsApiClient";
import type { OrgLocation } from "@server/catalog/org.address.types";
import { LocationForm } from "@/components/org/location-form";
import { formatPhone } from "@server/shared/phone";
import { LOCATIONS_COPY } from "./locations-copy";

interface LocationsManagerProps {
  orgId: string;
  locations: OrgLocation[];
  /** Opened from Home's setup list: a new address goes back there (own-store onboarding D8). */
  returnTo?: string | null;
}

/**
 * Pickup-location CRUD for the org portal (stock-locations R1/R2/R8). The list is
 * server-rendered by the page; this component only opens the form and refreshes.
 */
export function LocationsManager({ orgId, locations, returnTo = null }: LocationsManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<OrgLocation | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setIsOpen(true);
  };
  const openEdit = (location: OrgLocation) => {
    setEditing(location);
    setIsOpen(true);
  };

  const [confirmingDelete, setConfirmingDelete] = useState<OrgLocation | null>(null);

  const { mutate: removeLocation } = useMutation(
    (locationId: string) => orgLocationsApiClient.remove(orgId, locationId),
    { successMessage: LOCATIONS_COPY.deleted, onSuccess: () => router.refresh() },
  );

  const remove = (location: OrgLocation) => setConfirmingDelete(location);

  const confirmRemove = () => {
    if (!confirmingDelete) return;
    void removeLocation(confirmingDelete.id).catch(() => {});
    setConfirmingDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{LOCATIONS_COPY.intro}</p>
        <Button onClick={openAdd} size="sm">
          <Icon name="add" className="mr-1" /> {LOCATIONS_COPY.add}
        </Button>
      </div>

      {locations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon name="location" size="xl" tone="muted" />
            <p className="text-sm text-muted-foreground">{LOCATIONS_COPY.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {locations.map((location) => (
            <Card key={location.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{location.name}</CardTitle>
                <StatusBadge tone={location.isActive ? "success" : "neutral"}>
                  {location.isActive ? LOCATIONS_COPY.active : LOCATIONS_COPY.inactive}
                </StatusBadge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="text-muted-foreground">
                  <p>
                    {location.addressLine1 || <em>{LOCATIONS_COPY.streetNeeded}</em>}
                  </p>
                  {location.addressLine2 && <p>{location.addressLine2}</p>}
                  <p>
                    {location.city}, {location.state} — {location.pincode}
                  </p>
                </div>
                <p className="text-muted-foreground">
                  {location.contactName ? (
                    <>
                      {location.contactName} ·{" "}
                      {formatPhone(location.contactPhone)}
                    </>
                  ) : (
                    <em>{LOCATIONS_COPY.contactNeeded}</em>
                  )}
                </p>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {LOCATIONS_COPY.usage(location.stockedProducts, location.shipmentCount)}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={LOCATIONS_COPY.editLabel(location.name)}
                      onClick={() => openEdit(location)}
                    >
                      <Icon name="edit" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={LOCATIONS_COPY.deleteLabel(location.name)}
                      onClick={() => remove(location)}
                    >
                      <Icon name="delete" />
                    </Button>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? LOCATIONS_COPY.edit : LOCATIONS_COPY.addPickup}
            </DialogTitle>
          </DialogHeader>
          <LocationForm
            key={editing?.id ?? "new"}
            orgId={orgId}
            location={editing}
            onDone={() => {
              setIsOpen(false);
              if (returnTo && !editing) router.push(returnTo);
              else router.refresh();
            }}
            onCancel={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmingDelete} onOpenChange={() => setConfirmingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{LOCATIONS_COPY.deleteTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {LOCATIONS_COPY.confirmDelete(confirmingDelete?.name)}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(null)}>
              {LOCATIONS_COPY.cancel}
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmRemove}>
              {LOCATIONS_COPY.delete}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
