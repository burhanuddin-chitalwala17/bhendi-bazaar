// components/shared/forms/product/ProductSellerShippingFields.tsx

import { UseFormRegister, FieldErrors, UseFormWatch } from "react-hook-form";
import { FormInput, FormSelect } from "../FormField";
import { Info } from "lucide-react";
import type { ProductFormInput } from "@/admin/products/types";

interface ProductSellerShippingFieldsProps {
  register: UseFormRegister<ProductFormInput>;
  errors: FieldErrors<ProductFormInput>;
  watch: UseFormWatch<ProductFormInput>;
  sellers?: { id: string; name: string; code: string; defaultPincode: string; defaultCity: string; defaultState: string; defaultAddress: string }[];
  readOnly?: boolean;
}

export function ProductSellerShippingFields({
  register,
  errors,
  watch,
  sellers,
  readOnly = false,
}: ProductSellerShippingFieldsProps) {
  const selectedSellerId = watch("sellerId");
  const selectedSeller = sellers?.find((s) => s.id === selectedSellerId);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Seller & Shipping Location
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Select the seller and optionally override the shipping location
        </p>
      </div>

      <div className="space-y-6">
        {/* Seller Selection */}
        <div>
          <FormSelect
            label="Seller"
            required
            {...register("sellerId", { required: "Seller is required" })}
            error={errors.sellerId?.message}
            disabled={readOnly}
          >
            <option value="">Select a seller</option>
            {sellers?.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name} ({seller.code})
              </option>
            ))}
          </FormSelect>

          {/* Show seller's default location */}
          {selectedSeller && !watch("shippingFromPincode") && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">
                    Default Shipping Location:
                  </p>
                  <p className="text-blue-700 mt-1">
                    {selectedSeller.defaultAddress && (
                      <>{selectedSeller.defaultAddress}, </>
                    )}
                    {selectedSeller.defaultCity}, {selectedSeller.defaultState} - {selectedSeller.defaultPincode}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">
              Override Shipping Location (Optional)
            </span>
          </div>
        </div>

        {/* Override Shipping Location */}
        <div className="space-y-4">
          {!watch("shippingFromPincode") && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Only fill these fields if this product ships from a different location than the seller&apos;s default address.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Shipping Pincode"
              placeholder="e.g., 400001"
              {...register("shippingFromPincode")}
              error={errors.shippingFromPincode?.message}
              disabled={readOnly}
              hint="Leave empty to use seller's default"
            />

            <FormInput
              label="Shipping City"
              placeholder="e.g., Mumbai"
              {...register("shippingFromCity")}
              error={errors.shippingFromCity?.message}
              disabled={readOnly}
              hint="Leave empty to use seller's default"
            />
          </div>

          <FormInput
            label="Shipping Location/Warehouse"
            placeholder="e.g., Warehouse 2, Mumbai Central"
            {...register("shippingFromLocation")}
            error={errors.shippingFromLocation?.message}
            disabled={readOnly}
            hint="Optional: Specify warehouse or specific location name"
          />
        </div>
      </div>
    </div>
  );
}