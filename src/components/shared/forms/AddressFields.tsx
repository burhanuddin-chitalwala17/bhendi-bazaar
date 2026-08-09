// components/shared/forms/AddressFields.tsx

import { FormInput, FormTextarea } from "./FormField";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { DeliveryAddress } from "@/domain/profile";
import { PINCODE_PATTERN, PINCODE_MESSAGE } from "@server/shared/pincode";

interface AddressFieldsProps {
  register: UseFormRegister<DeliveryAddress>;
  errors?: FieldErrors;
  namePrefix?: string; // For nested forms like "shippingAddress."
  includeEmail?: boolean;
  includeNotes?: boolean;
  includeLabel?: boolean;
}

export function AddressFields({
  register,
  errors,
  namePrefix = "",
  includeEmail = true,
  includeNotes = false,
  includeLabel = false,
}: AddressFieldsProps) {
  const getFieldName = (field: string) => `${namePrefix}${field}`;

  const getError = (field: string): string | undefined => {
    if (!errors) return undefined;

    try {
      if (namePrefix) {
        // Safely access nested error
        const nestedErrors = errors[namePrefix];
        if (nestedErrors && typeof nestedErrors === "object") {
          const fieldError = (nestedErrors as Record<string, any>)[field];
          return fieldError?.message;
        }
        return undefined;
      }

      // Direct field access
      const fieldError = errors[field];
      return fieldError?.message as string | undefined;
    } catch {
      return undefined;
    }
  };

  return (
    <>
      {/* Label (optional) */}
      {includeLabel && (
        <FormInput
          label="Label"
          placeholder="Home, Office, Other."
          {...register("label")}
          error={getError("label")}
        />
      )}

      {/* Full Name and Mobile */}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormInput
          label="Full Name"
          required
          placeholder="Your full name"
          autoComplete="name"
          {...register("fullName", { required: true })}
          error={getError("fullName")}
        />
        <FormInput
          label="Mobile"
          required
          type="tel"
          placeholder="10-digit Mobile Number"
          autoComplete="tel"
          {...register("mobile", { required: true })}
          error={getError("mobile")}
        />
      </div>

      {/* Email (optional) */}
      {includeEmail && (
        <FormInput
          label="Email"
          type="email"
          placeholder="your@email.com"
          autoComplete="email"
          {...register("email")}
          hint="Optional - for order updates"
          error={getError("email")}
        />
      )}

      {/* Address Line 1 */}
      <FormInput
        label="Address Line 1"
        required
        placeholder="Flat, house no., building"
        autoComplete="address-line1"
        {...register("addressLine1", { required: true })}
        error={getError("addressLine1")}
      />

      {/* Address Line 2 */}
      <FormInput
        label="Address Line 2"
        placeholder="Area, street (optional)"
        autoComplete="address-line2"
        {...register("addressLine2")}
        error={getError("addressLine2")}
      />

      {/* City, State, PIN Row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <FormInput
          label="City"
          required
          autoComplete="address-level2"
          {...register("city", { required: true })}
          error={getError("city")}
        />
        <FormInput
          label="State"
          required
          autoComplete="address-level1"
          {...register("state", { required: true })}
          error={getError("state")}
        />
        <FormInput
          label="PIN Code"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          {...register("pincode", {
            required: true,
            pattern: { value: PINCODE_PATTERN, message: PINCODE_MESSAGE },
          })}
          error={getError("pincode")}
        />
      </div>

      {/* Country */}
      <FormInput
        label="Country"
        required
        autoComplete="country-name"
        {...register("country", { required: true })}
        error={getError("country")}
      />

      {/* Notes (optional) */}
      {includeNotes && (
        <FormTextarea
          label="Notes for the Bazaar"
          rows={3}
          placeholder="Any special instructions..."
          {...register("notes")}
          error={getError("notes")}
          hint="Optional"
        />
      )}
    </>
  );
}