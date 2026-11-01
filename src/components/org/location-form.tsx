"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FormInput, FormPhoneInput } from "@/components/shared/forms/FormField";
import type { FormEvent, ReactNode } from "react";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import { useServerForm } from "@/hooks/core/useServerForm";
import { ApiError } from "@/lib/api-error";
import { orgLocationsApiClient } from "@/components/org/orgLocationsApiClient";
import { orgLocationSchema, type OrgLocationInput } from "@/lib/validation/schemas/location.schema";
import type { OrgLocation } from "@server/catalog/org.address.types";

/** What a caller's own actions are told: saving now, or the last save failed and can be retried. */
export interface LocationFormActions {
  isSubmitting: boolean;
  failed: boolean;
}

/**
 * Add or edit a pickup location (stock-locations R1). Its own file because two screens open it:
 * the locations page, and `PickupAddressSheet` wherever a form needs an address (own-store onboarding D11).
 */
export function LocationForm({
  orgId,
  location,
  onDone,
  onCancel,
  messages,
  actions,
}: {
  orgId: string;
  location: OrgLocation | null;
  /** Called with the saved location, so a caller can show it without another round trip. */
  onDone: (location: OrgLocation) => void;
  onCancel: () => void;
  /** A caller's own words; `retry` replaces any failure that is not the shop's to fix. */
  messages?: { success: string; retry: string };
  /** Replaces the Cancel/Save pair, e.g. with the sheet's one never-disabled button. */
  actions?: (state: LocationFormActions) => ReactNode;
}) {
  const {
    register,
    control,
    watch,
    setValue,
    onSubmit: handleFormSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<OrgLocationInput>({
    schema: orgLocationSchema,
    submit: async (data) => {
      try {
        return await orgLocationsApiClient.save(orgId, location?.id, data);
      } catch (error) {
        // Our fault or the network's, not a field the shop can fix: say the form is safe.
        if (messages && !(error instanceof ApiError && error.status < 500)) throw new Error(messages.retry);
        throw error;
      }
    },
    successMessage: messages?.success ?? (location ? "Location updated" : "Location added"),
    fallbackMessage: messages?.retry,
    toastErrors: !messages,
    onSuccess: (saved) => onDone(saved as OrgLocation),
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

  // A second press while saving does nothing, so no button needs disabling (ADR-0053).
  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (isSubmitting) {
      event.preventDefault();
      return;
    }
    void handleFormSubmit(event).catch(() => undefined);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
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
        <FormPhoneInput
          name="contactPhone"
          control={control}
          label="Contact phone"
          required
          placeholder="Mobile number"
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
      <FormInput
        label="Landmark"
        {...register("landmark")}
        error={errors.landmark?.message}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormInput
          label="City"
          required
          {...register("city")}
          error={errors.city?.message}
        />
        <FormInput
          label="State"
          required
          {...register("state")}
          error={errors.state?.message}
        />
        <FormInput
          label="Pincode"
          required
          inputMode="numeric"
          {...register("pincode")}
          error={errors.pincode?.message}
        />
      </div>
      <Checkbox
        label="Active"
        description="Offer this location for new stock."
        checked={watch("isActive")}
        onChange={(event) => setValue("isActive", event.target.checked)}
      />

      {actions ? (
        <div className="pt-2">{actions({ isSubmitting, failed: messages !== undefined && formError === messages.retry })}</div>
      ) : (
        <div className="flex justify-end pt-2">
          <FormActions
            onCancel={onCancel}
            isSubmitting={isSubmitting}
            submitLabel={location ? "Save changes" : "Add location"}
          />
        </div>
      )}
    </form>
  );
}
