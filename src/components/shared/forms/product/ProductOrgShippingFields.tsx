// components/shared/forms/product/ProductOrgShippingFields.tsx

import { UseFormRegister, FieldErrors, UseFormWatch } from "react-hook-form";
import { FormInput, FormSelect } from "../FormField";
import { Info } from "lucide-react";
import type { ProductFormInput } from "@/admin/products/types";

interface ProductOrgShippingFieldsProps {
  register: UseFormRegister<ProductFormInput>;
  errors: FieldErrors<ProductFormInput>;
  watch: UseFormWatch<ProductFormInput>;
  orgs?: { id: string; name: string; code: string; defaultPincode: string; defaultCity: string; defaultState: string; defaultAddress: string }[];
  readOnly?: boolean;
}

export function ProductOrgShippingFields({
  register,
  errors,
  watch,
  orgs,
  readOnly = false,
}: ProductOrgShippingFieldsProps) {
  const selectedOrgId = watch("orgId");
  const selectedOrg = orgs?.find((s) => s.id === selectedOrgId);

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Org & Shipping Location
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select the org and optionally override the shipping location
        </p>
      </div>

      <div className="space-y-6">
        {/* Org Selection */}
        <div>
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

          {/* Where this ships from unless the product overrides it */}
          {selectedOrg && !watch("shippingFromPincode") && (
            <div className="mt-3 p-3 bg-info/10 border border-info/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-info">
                    Ships from:
                  </p>
                  <p className="text-info mt-1">
                    {selectedOrg.defaultAddress && (
                      <>{selectedOrg.defaultAddress}, </>
                    )}
                    {selectedOrg.defaultCity}, {selectedOrg.defaultState} - {selectedOrg.defaultPincode}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-input"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-card text-muted-foreground">
              Override Shipping Location (Optional)
            </span>
          </div>
        </div>

        {/* Override Shipping Location */}
        <div className="space-y-4">
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
            <p className="text-sm text-warning">
              <strong>Note:</strong> Only fill these fields if this product ships from a
              different location than the org&apos;s default address. Fill all three,
              or leave all three empty.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Shipping Pincode"
              placeholder="e.g., 400001"
              {...register("shippingFromPincode")}
              error={errors.shippingFromPincode?.message}
              disabled={readOnly}
            />

            <FormInput
              label="Shipping City"
              placeholder="e.g., Mumbai"
              {...register("shippingFromCity")}
              error={errors.shippingFromCity?.message}
              disabled={readOnly}
            />
          </div>

          <FormInput
            label="Shipping Location/Warehouse"
            placeholder="e.g., Warehouse 2, Mumbai Central"
            {...register("shippingFromLocation")}
            error={errors.shippingFromLocation?.message}
            disabled={readOnly}
          />
        </div>
      </div>
    </div>
  );
}