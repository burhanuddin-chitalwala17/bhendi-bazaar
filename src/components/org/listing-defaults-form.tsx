"use client";

import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormController, FormInput } from "@/components/shared/forms/FormField";
import { CountryPicker } from "@/components/shared/forms/CountryPicker";
import { asCountryCode } from "@server/shared/countries";
import { useServerForm } from "@/hooks/core/useServerForm";
import { orgListingDefaultsApiClient } from "@/components/org/orgListingDefaultsApiClient";
import {
  listingDefaultsSchema,
  type ListingDefaultsParsed,
} from "@/lib/validation/schemas/listing-defaults.schema";
import type { OrgListingDefaultsDto } from "@server/listing/org-listing-defaults.types";
import { LISTING_DEFAULTS_COPY } from "./org-copy";
import { LISTING_DEFAULTS_SAVE_COPY } from "@/components/org/org-copy";

interface ListingDefaultsFormProps {
  orgId: string;
  defaults: OrgListingDefaultsDto;
  /** The categories the org has products in — the rows of the tax-code list. */
  categories: Array<{ id: string; name: string }>;
}

/**
 * Org-wide listing defaults (org-profile spec R4): what a product starts from when neither it
 * nor its brand says otherwise. Defaults pre-fill and never validate, so every field here may
 * stay blank and the form still saves.
 */
export function ListingDefaultsForm({ orgId, defaults, categories }: ListingDefaultsFormProps) {
  const router = useRouter();
  const {
    register,
    control,
    onSubmit: handleFormSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<ListingDefaultsParsed>({
    schema: listingDefaultsSchema,
    submit: (data) => orgListingDefaultsApiClient.save(orgId, data),
    successMessage: LISTING_DEFAULTS_COPY.saved,
    onSuccess: () => router.refresh(),
    defaultValues: {
      countryOfOrigin: asCountryCode(defaults.countryOfOrigin),
      taxRatePercent: defaults.taxRatePercent ?? undefined,
      taxCodes: categories.map((category) => ({
        categoryId: category.id,
        taxCode: defaults.taxCodes.find((entry) => entry.categoryId === category.id)?.taxCode ?? "",
      })),
    },
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <FormController
        name="countryOfOrigin"
        control={control}
        label={LISTING_DEFAULTS_COPY.country}
        hint={LISTING_DEFAULTS_COPY.countryHint}
        error={errors.countryOfOrigin?.message}
        render={({ field }) => (
          <CountryPicker value={typeof field.value === "string" ? field.value : null} onChange={field.onChange} />
        )}
      />
      <FormInput
        label={LISTING_DEFAULTS_COPY.taxRate}
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        max={100}
        placeholder={LISTING_DEFAULTS_COPY.taxRatePlaceholder}
        {...register("taxRatePercent", { valueAsNumber: true })}
        error={errors.taxRatePercent?.message}
        hint={LISTING_DEFAULTS_COPY.taxRateHint}
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{LISTING_DEFAULTS_COPY.taxCodes}</legend>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{LISTING_DEFAULTS_COPY.noCategories}</p>
        ) : (
          categories.map((category, index) => (
            <div key={category.id}>
              <input type="hidden" {...register(`taxCodes.${index}.categoryId` as const)} />
              <FormInput
                label={category.name}
                placeholder={LISTING_DEFAULTS_COPY.taxCodePlaceholder}
                {...register(`taxCodes.${index}.taxCode` as const)}
                error={errors.taxCodes?.[index]?.taxCode?.message}
              />
            </div>
          ))
        )}
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? LISTING_DEFAULTS_SAVE_COPY.saving : LISTING_DEFAULTS_SAVE_COPY.save}
        </Button>
      </div>
    </form>
  );
}
