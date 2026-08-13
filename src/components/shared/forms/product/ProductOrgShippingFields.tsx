// components/shared/forms/product/ProductOrgShippingFields.tsx

import { UseFormRegister, FieldErrors, UseFormWatch } from "react-hook-form";
import Link from "next/link";
import { FormSelect, FormInput } from "../FormField";
import { MapPin } from "lucide-react";
import type { ProductFormInput } from "@/admin/products/types";
import type { OrgSummary } from "@/domain/org";

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
  readOnly?: boolean;
}

export function ProductOrgShippingFields({
  register,
  errors,
  watch,
  orgs,
  locations,
  readOnly = false,
}: ProductOrgShippingFieldsProps) {
  const selectedOrgId = watch("orgId");
  const stockRows = watch("stockLocations") ?? [];
  const totalStock = stockRows.reduce(
    (sum, row) => sum + (Number.isFinite(row?.quantity) ? Number(row.quantity) : 0),
    0
  );
  // Root-level rules (min one location, some stock somewhere, no duplicates) land here.
  const stockLocationsError = (
    errors.stockLocations as { message?: string; root?: { message?: string } } | undefined
  );
  const rootMessage = stockLocationsError?.message ?? stockLocationsError?.root?.message;

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Org & Stock Locations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the organisation, then say where this product physically sits — nothing
          is preselected, and the customer only ever sees the total.
        </p>
      </div>

      <div className="space-y-6">
        <FormSelect
          label="Organisation"
          required
          {...register("orgId", { required: "Organisation is required" })}
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

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Stock per pickup location <span className="text-destructive">*</span>
            </span>
            <span className="text-sm text-muted-foreground">Total: {totalStock}</span>
          </div>

          {rootMessage && (
            <p role="alert" className="mb-2 text-sm text-destructive">
              {rootMessage}
            </p>
          )}

          {locations.length === 0 ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              This organisation has no pickup locations yet.{" "}
              {selectedOrgId && (
                <Link href={`/org/${selectedOrgId}/locations`} className="underline">
                  Add one first
                </Link>
              )}{" "}
              — a product cannot be saved without a location.
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
                      setValueAs: (v) => (v === "" || v === null ? 0 : Number(v)),
                    })}
                    error={errors.stockLocations?.[index]?.quantity?.message}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
