// components/shared/forms/AddressFields.tsx

import { FormInput, FormPhoneInput, FormTextarea } from "./FormField";
import { Control, UseFormRegister, FieldErrors } from "react-hook-form";
import { DeliveryAddress } from "@/domain/profile";
import { PINCODE_PATTERN, PINCODE_MESSAGE } from "@server/shared/pincode";
import { ADDRESS_FIELDS_COPY } from "./forms-copy";
import { ADDRESS_FIELDS_HINT_COPY } from "@/components/shared/forms/forms-copy";

interface AddressFieldsProps {
  register: UseFormRegister<DeliveryAddress>;
  control: Control<DeliveryAddress>;
  errors?: FieldErrors;
  namePrefix?: string; // For nested forms like "shippingAddress."
  includeEmail?: boolean;
  includeNotes?: boolean;
  includeLabel?: boolean;
  emailRequired?: boolean;
}

export function AddressFields({
  register,
  control,
  errors,
  namePrefix = "",
  includeEmail = true,
  includeNotes = false,
  includeLabel = false,
  emailRequired = false,
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
          label={ADDRESS_FIELDS_COPY.label}
          placeholder={ADDRESS_FIELDS_COPY.homeOfficeOther}
          {...register("label")}
          error={getError("label")}
        />
      )}

      {/* Full Name and Mobile */}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormInput
          label={ADDRESS_FIELDS_COPY.fullName}
          required
          placeholder={ADDRESS_FIELDS_COPY.yourFullName}
          autoComplete="name"
          {...register("fullName", { required: true })}
          error={getError("fullName")}
        />
        <FormPhoneInput
          name="mobile"
          control={control}
          label={ADDRESS_FIELDS_COPY.mobile}
          required
          placeholder={ADDRESS_FIELDS_COPY.mobileNumber}
        />
      </div>

      {/* Email */}
      {includeEmail && (
        <FormInput
          label={ADDRESS_FIELDS_COPY.email}
          required={emailRequired}
          type="email"
          placeholder={ADDRESS_FIELDS_COPY.yourEmailCom}
          autoComplete="email"
          {...register("email", { required: emailRequired })}
          hint={
            emailRequired
              ? ADDRESS_FIELDS_HINT_COPY.emailRequired
              : ADDRESS_FIELDS_HINT_COPY.emailOptional
          }
          error={getError("email")}
        />
      )}

      {/* Address Line 1 */}
      <FormInput
        label={ADDRESS_FIELDS_COPY.addressLine1}
        required
        placeholder={ADDRESS_FIELDS_COPY.flatHouseNoBuilding}
        autoComplete="address-line1"
        {...register("addressLine1", { required: true })}
        error={getError("addressLine1")}
      />

      {/* Address Line 2 */}
      <FormInput
        label={ADDRESS_FIELDS_COPY.addressLine2}
        placeholder={ADDRESS_FIELDS_COPY.areaStreetOptional}
        autoComplete="address-line2"
        {...register("addressLine2")}
        error={getError("addressLine2")}
      />

      {/* City, State, PIN Row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <FormInput
          label={ADDRESS_FIELDS_COPY.city}
          required
          autoComplete="address-level2"
          {...register("city", { required: true })}
          error={getError("city")}
        />
        <FormInput
          label={ADDRESS_FIELDS_COPY.state}
          required
          autoComplete="address-level1"
          {...register("state", { required: true })}
          error={getError("state")}
        />
        <FormInput
          label={ADDRESS_FIELDS_COPY.pinCode}
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
        label={ADDRESS_FIELDS_COPY.country}
        required
        autoComplete="country-name"
        {...register("country", { required: true })}
        error={getError("country")}
      />

      {/* Notes (optional) */}
      {includeNotes && (
        <FormTextarea
          label={ADDRESS_FIELDS_COPY.notesForTheBazaar}
          rows={3}
          placeholder={ADDRESS_FIELDS_COPY.anySpecialInstructions}
          {...register("notes")}
          error={getError("notes")}
          hint={ADDRESS_FIELDS_COPY.optional}
        />
      )}
    </>
  );
}
