"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { FormInput } from "@/components/shared/forms/FormField";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
import {
  orgLocationSchema,
  type OrgLocationInput,
} from "@/lib/validation/schemas/location.schema";
import type { OrgLocation } from "@server/catalog/org.address.repository";

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

  const remove = async (location: OrgLocation) => {
    if (!confirm(`Delete "${location.name}"?`)) return;
    const response = await fetch(`/api/org/${orgId}/locations/${location.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await readApiError(response);
      toast.error(error.message);
      return;
    }
    toast.success("Location deleted");
    router.refresh();
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
              No pickup locations yet. Add the shop or warehouse your parcels leave from.
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
                  <p>{location.addressLine1 || <em>Street address needed</em>}</p>
                  {location.addressLine2 && <p>{location.addressLine2}</p>}
                  <p>
                    {location.city}, {location.state} — {location.pincode}
                  </p>
                </div>
                <p className="text-muted-foreground">
                  {location.contactName ? (
                    <>
                      {location.contactName} · {location.contactPhone}
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
                    <Button variant="ghost" size="sm" onClick={() => openEdit(location)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(location)}
                      disabled={location.stockedProducts > 0 || location.shipmentCount > 0}
                      title={
                        location.stockedProducts > 0
                          ? "Holds stock — move or zero it first"
                          : location.shipmentCount > 0
                            ? "Parcels shipped from here — deactivate instead"
                            : undefined
                      }
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit location" : "Add pickup location"}</DialogTitle>
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
    </div>
  );
}

function LocationForm({
  orgId,
  location,
  onDone,
  onCancel,
}: {
  orgId: string;
  location: OrgLocation | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    onSubmit: handleFormSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<OrgLocationInput>({
    schema: orgLocationSchema,
    submit: async (data) => {
      const response = await fetch(
        location
          ? `/api/org/${orgId}/locations/${location.id}`
          : `/api/org/${orgId}/locations`,
        {
          method: location ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw await readApiError(response);
      toast.success(location ? "Location updated" : "Location added");
      onDone();
    },
    defaultValues: {
      name: location?.name ?? "",
      contactName: location?.contactName ?? "",
      contactPhone: location?.contactPhone ?? "",
      addressLine1: location?.addressLine1 ?? "",
      addressLine2: location?.addressLine2 ?? "",
      landmark: location?.landmark ?? "",
      city: location?.city ?? "",
      state: location?.state ?? "",
      pincode: location?.pincode ?? "",
      isActive: location?.isActive ?? true,
    },
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-3">
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </div>
      )}

      <FormInput
        label="Location name"
        required
        placeholder="e.g., Bhendi Bazaar shop"
        {...register("name")}
        error={errors.name?.message}
        hint="What couriers and your team call this place"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormInput
          label="Pickup contact"
          required
          placeholder="Who answers at pickup"
          {...register("contactName")}
          error={errors.contactName?.message}
        />
        <FormInput
          label="Contact phone"
          required
          type="tel"
          placeholder="10-digit mobile"
          {...register("contactPhone")}
          error={errors.contactPhone?.message}
        />
      </div>
      <FormInput
        label="Address line 1"
        required
        {...register("addressLine1")}
        error={errors.addressLine1?.message}
      />
      <FormInput
        label="Address line 2"
        {...register("addressLine2")}
        error={errors.addressLine2?.message}
      />
      <FormInput label="Landmark" {...register("landmark")} error={errors.landmark?.message} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormInput label="City" required {...register("city")} error={errors.city?.message} />
        <FormInput label="State" required {...register("state")} error={errors.state?.message} />
        <FormInput
          label="Pincode"
          required
          inputMode="numeric"
          {...register("pincode")}
          error={errors.pincode?.message}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("isActive")} className="h-4 w-4" />
        Active — offer this location for new stock
      </label>

      <div className="flex justify-end pt-2">
        <FormActions
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          submitLabel={location ? "Save changes" : "Add location"}
        />
      </div>
    </form>
  );
}
