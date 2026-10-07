"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
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

interface LocationsManagerProps {
  orgId: string;
  locations: OrgLocation[];
}

/**
 * Pickup-location CRUD for the org portal (stock-locations R1/R2/R8). The list is
 * server-rendered by the page; this component only opens the form and refreshes.
 */
export function LocationsManager({ orgId, locations }: LocationsManagerProps) {
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
    { successMessage: "Location deleted", onSuccess: () => router.refresh() },
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
        <p className="text-sm text-muted-foreground">
          Where your products ship from. Couriers collect at these addresses.
        </p>
        <Button onClick={openAdd} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add location
        </Button>
      </div>

      {locations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No pickup locations yet. Add the shop or warehouse your parcels
              leave from.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {locations.map((location) => (
            <Card key={location.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{location.name}</CardTitle>
                <StatusBadge status={location.isActive ? "inStock" : "default"}>
                  {location.isActive ? "Active" : "Inactive"}
                </StatusBadge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="text-muted-foreground">
                  <p>
                    {location.addressLine1 || <em>Street address needed</em>}
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
                    <em>Pickup contact needed</em>
                  )}
                </p>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {location.stockedProducts} product
                    {location.stockedProducts === 1 ? "" : "s"} stocked ·{" "}
                    {location.shipmentCount} parcel
                    {location.shipmentCount === 1 ? "" : "s"} shipped
                  </span>
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(location)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(location)}
                    >
                      <Trash2 className="h-4 w-4" />
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
              {editing ? "Edit location" : "Add pickup location"}
            </DialogTitle>
          </DialogHeader>
          <LocationForm
            key={editing?.id ?? "new"}
            orgId={orgId}
            location={editing}
            onDone={() => {
              setIsOpen(false);
              router.refresh();
            }}
            onCancel={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmingDelete} onOpenChange={() => setConfirmingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete location</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{confirmingDelete?.name}&rdquo;?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmRemove}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
