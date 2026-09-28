"use client";

import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FormInput, FormPhoneInput } from "@/components/shared/forms/FormField";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
import { orgLocationSchema, type OrgLocationInput } from "@/lib/validation/schemas/location.schema";
import type { OrgLocation } from "@server/catalog/org.address.repository";

/**
 * Add or edit a pickup location (stock-locations R1). Its own file because two screens open it:
 * the locations page, and the product form when the org has nowhere to hold stock yet.
 */
export function LocationForm({
  orgId,
  location,
  onDone,
  onCancel,
}: {
  orgId: string;
  location: OrgLocation | null;
  /** Called with the saved location, so a caller can show it without another round trip. */
  onDone: (location: OrgLocation) => void;
  onCancel: () => void;
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
      const response = await fetch(
        location
          ? `/api/org/${orgId}/locations/${location.id}`
          : `/api/org/${orgId}/locations`,
        {
          method: location ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) throw await readApiError(response);
      toast.success(location ? "Location updated" : "Location added");
      onDone((await response.json()) as OrgLocation);
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
