// components/shared/forms/product/ProductOrgShippingFields.tsx

import { UseFormRegister, FieldErrors, UseFormWatch } from "react-hook-form";
import { FormSelect, FormInput } from "../FormField";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PickupAddressSheet } from "@/components/org/pickup-address-sheet";
import type { ProductFormInput } from "@/components/product/console/types";
import type { OrgSummary } from "@/domain/org";
import type { OrgLocation } from "@server/catalog/org.address.types";

export interface LocationOption {
  id: string;
  name: string;
  city: string;
  pincode: string;
  isActive: boolean;
}

interface ProductOrgShippingFieldsProps {
  register: UseFormRegister<ProductFormInput>;
  errors: FieldErrors<ProductFormInput>;
  watch: UseFormWatch<ProductFormInput>;
  orgs?: OrgSummary[];
  /** The selected org's pickup locations — one stock input per active location (R2/R3). */
  locations: LocationOption[];
  /** Called with a location added from this form, so the stock rows can grow without a reload. */
  onLocationAdded?: (location: LocationOption) => void;
  readOnly?: boolean;
}

export function ProductOrgShippingFields({
  register,
  errors,
  watch,
  orgs,
  locations,
  onLocationAdded,
  readOnly = false,
}: ProductOrgShippingFieldsProps) {
  const selectedOrgId = watch("orgId");
  // One org offered means the caller already knows which — the portal — so nothing is asked.
  const fixedOrg = orgs?.length === 1 ? orgs[0] : null;
  const orgField = register("orgId", { required: "Organisation is required" });
  const stockRows = watch("stockLocations") ?? [];
  const totalStock = stockRows.reduce(
    (sum, row) =>
      sum + (Number.isFinite(row?.quantity) ? Number(row.quantity) : 0),
    0,
  );
  // Root-level rules (min one location, some stock somewhere, no duplicates) land here.
  const stockLocationsError = errors.stockLocations as
    { message?: string; root?: { message?: string } } | undefined;
  const rootMessage =
    stockLocationsError?.message ?? stockLocationsError?.root?.message;
  // One sheet for every place an address is created (own-store onboarding Q26); the form stays underneath.
  const addLocation = (label: string, variant: "outline" | "ghost", className?: string) =>
    selectedOrgId && onLocationAdded && !readOnly ? (
      <PickupAddressSheet
        orgId={selectedOrgId}
        trigger={
          <Button type="button" size="sm" variant={variant} className={className}>
            <Plus className="mr-1 size-4" /> {label}
          </Button>
        }
        onAdded={(location: OrgLocation) =>
          onLocationAdded({
            id: location.id,
            name: location.name,
            city: location.city,
            pincode: location.pincode,
            isActive: location.isActive,
          })
        }
      />
    ) : null;

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          {fixedOrg ? "Stock locations" : "Org & Stock Locations"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {fixedOrg
            ? "Say where this product physically sits — the customer only ever sees the total."
            : "Choose the organisation, then say where this product physically sits — nothing is preselected, and the customer only ever sees the total."}
        </p>
      </div>

      <div className="space-y-6">
        {fixedOrg ? (
          <input type="hidden" {...orgField} />
        ) : (
          <FormSelect
            label="Organisation"
            required
            {...orgField}
            error={errors.orgId?.message}
            disabled={readOnly}
          >
            <option value="">Select an organisation</option>
            {orgs?.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.code})
              </option>
            ))}
          </FormSelect>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Stock per pickup location{" "}
              <span className="text-destructive">*</span>
            </span>
            <span className="text-sm text-muted-foreground">
              Total: {totalStock}
            </span>
          </div>

          {rootMessage && (
            <p role="alert" className="mb-2 text-sm text-destructive">
              {rootMessage}
            </p>
          )}

          {locations.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
              <span>
                {selectedOrgId
                  ? "Where is this kept? Add your shop address once."
                  : "Choose the organisation to see where its stock can sit."}
              </span>
              {addLocation("Add location", "outline")}
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map((location, index) => (
                <div
                  key={location.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <input
                    type="hidden"
                    value={location.id}
                    {...register(`stockLocations.${index}.orgAddressId`)}
                  />
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {location.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {location.city} — {location.pincode}
                    </p>
                  </div>
                  {/* setValueAs, not valueAsNumber: the latter makes a cleared box NaN
                      (CHANGELOG PR-66). */}
                  <FormInput
                    label=""
                    aria-label={`Stock at ${location.name}`}
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-28"
                    disabled={readOnly}
                    {...register(`stockLocations.${index}.quantity`, {
                      setValueAs: (v) =>
                        v === "" || v === null ? 0 : Number(v),
                    })}
                    error={errors.stockLocations?.[index]?.quantity?.message}
                  />
                </div>
              ))}
            </div>
          )}
          {locations.length > 0 && addLocation("Add another location", "ghost", "mt-2")}
        </div>
      </div>
    </div>
  );
}
